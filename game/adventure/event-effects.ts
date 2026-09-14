import { weightedDraw } from "../random.ts";
import type { AdventureHost, EventOutcome, Rarity, Reward } from "./model.ts";
import { beginCollector } from "./collector.ts";
import { randomInteger, rewardName, rewardPool, rollRewards, upgradableSkills, upgradableWeapons } from "./rewards.ts";

type Handler = (host: AdventureHost, outcome: EventOutcome) => void;
const choose = <T,>(pool: T[], host: AdventureHost): T => weightedDraw(pool.map((entry) => [entry, 100]), host.random);
const rarityNames: Record<string, Rarity> = { common: "普通", rare: "稀有", legendary: "傳說" };

export function searchCorpse(host: AdventureHost): void {
  const { state, rules, catalog } = host;
  const event = state.encounter!;
  if (event.stage !== "corpse" || !event.corpse || !event.pending?.eliteChances) throw new Error("目前不能搜刮");
  const outcome = event.pending;
  const corpse = event.corpse;
  const chances = outcome.eliteChances!;
  if (corpse.attempts >= chances.length) throw new Error("搜刮次數已用完");
  const chance = chances[corpse.attempts++];
  if (host.random() < chance) { host.startBattle("elite"); return; }
  const weapons = rewardPool(state.player, catalog, rules, ["equipment"], "普通").filter((item) => !corpse.weaponFound && !!rules.weaponUpgrades[item.id]);
  const items = rewardPool(state.player, catalog, rules, ["consumable"], "普通", { shop: true });
  const choices: ["gold" | "weapon" | "consumable", number][] = [["gold", outcome.lootWeights!.gold]];
  if (weapons.length) choices.push(["weapon", outcome.lootWeights!.weapon]);
  if (items.length) choices.push(["consumable", outcome.lootWeights!.consumable]);
  const type = weightedDraw(choices, host.random);
  let text: string;
  if (type === "gold") {
    const amount = randomInteger(state, outcome.gold!.minimum, outcome.gold!.maximum);
    state.player.gold += amount;
    text = `獲得 ${amount} 枚金幣。`;
  } else {
    const reward = choose(type === "weapon" ? weapons : items, host);
    host.grant(reward);
    if (type === "weapon") corpse.weaponFound = true;
    text = `獲得${rewardName(reward, catalog)}。`;
  }
  state.log.push(`第 ${corpse.attempts} 次搜刮：${text}`);
  event.text = `${text}下一次搜刮有 ${Math.round((chances[corpse.attempts] ?? 0) * 100)}% 機率遇到菁英。`;
  if (corpse.attempts === chances.length) host.result(`${text}搜刮結束。`);
}

/** Register a new outcome mechanism here; individual event IDs stay in data. */
export const eventEffects: Record<string, Handler> = {
  continue: (host, outcome) => host.result(outcome.text),
  "full-heal": (host, outcome) => { host.state.player.hp = host.state.player.maxHp; host.result(`${outcome.text}\n生命完全恢復。`); },
  "seal-random-skill": (host, outcome) => {
    const pool = host.state.player.skills.filter((skill) => !host.state.player.sealedNext.includes(skill.id));
    const skill = pool.length ? choose(pool, host) : undefined;
    if (skill) host.state.player.sealedNext.push(skill.id);
    host.result(`${outcome.text}${skill ? `\n${host.catalog.skills[skill.id].name}在下一場戰鬥中被封印。` : ""}`);
  },
  "full-heal-start-combat": (host, outcome) => { host.state.player.hp = host.state.player.maxHp; host.startBattle(outcome.rank, outcome.unitId); },
  "start-combat": (host, outcome) => host.startBattle(outcome.rank, outcome.unitId),
  "gain-gold": (host, outcome) => {
    const amount = randomInteger(host.state, outcome.gold!.minimum, outcome.gold!.maximum);
    host.state.player.gold += amount;
    host.result(`${outcome.text}\n獲得 ${amount} 枚金幣。`);
  },
  "grant-next-battle-status": (host, outcome) => {
    if (!host.catalog.statuses[outcome.statusId!]) throw new Error("奇遇狀態不存在");
    host.state.player.statusesNext.push({ id: outcome.statusId!, rounds: outcome.duration, stacks: outcome.stacks });
    host.result(`${outcome.text}\n下一場戰鬥獲得「${host.catalog.statuses[outcome.statusId!].name}」，持續 ${outcome.duration} 回合。`);
  },
  "grant-random-reward": (host, outcome) => {
    const table = host.rules.loot[outcome.lootTableId!];
    if (!table) throw new Error("奇遇掉落表不存在");
    const reward = rollRewards(host.state, host.catalog, host.rules, table)[0];
    if (reward) host.grant(reward);
    host.result(`${outcome.text}\n${reward ? `獲得${rewardName(reward, host.catalog)}。` : "沒有符合持有規則的新獎勵。"}`);
  },
  "blood-unseal": (host, outcome) => {
    const pool = rewardPool(host.state.player, host.catalog, host.rules, ["equipment"], rarityNames[outcome.rewardRarity!] ?? "稀有");
    if (!pool.length) { host.result("石臺上已沒有可取得的新裝備，生命未被奪走。"); return; }
    const player = host.state.player;
    const paid = Math.min(Math.max(0, player.hp - 1), Math.round(player.maxHp * outcome.damageMaxHpRatio!));
    player.hp -= paid;
    const event = host.state.encounter!;
    event.reward = choose(pool, host);
    event.stage = "vault";
    event.text = `支付 ${paid} 點生命，封印解除。石臺上是「${rewardName(event.reward, host.catalog)}」。`;
  },
  "reduce-max-hp-upgrade-skill": (host, outcome) => {
    const player = host.state.player;
    const before = player.maxHp;
    player.maxHp = Math.max(1, Math.round(before * outcome.maxHpRatio!));
    player.hp = Math.min(player.hp, player.maxHp);
    const event = host.state.encounter!;
    event.text = `最大生命降低 ${before - player.maxHp} 點。請選擇要升級的技能。`;
    event.stage = "upgrade";
    if (!upgradableSkills(player, host.catalog).length) host.result(`最大生命降低 ${before - player.maxHp} 點，目前沒有可升級的技能。`);
  },
  "begin-weapon-upgrade": (host, outcome) => {
    if (!upgradableWeapons(host.state.player, host.rules).length) { host.result("目前沒有可強化的武器。"); return; }
    host.state.encounter!.stage = "forge";
    host.state.encounter!.text = outcome.text;
  },
  "search-adventurer-corpse": (host) => {
    host.state.encounter!.stage = "corpse";
    host.state.encounter!.corpse = { attempts: 0, weaponFound: false };
    searchCorpse(host);
  },
  "collector-challenge": beginCollector,
  "open-shop": (host, outcome) => {
    const event = host.state.encounter!;
    event.stage = "shop";
    event.text = outcome.text;
    event.shop = { purchases: 0, spent: 0, offers: rollRewards(host.state, host.catalog, host.rules, { choices: host.rules.shop.choices, types: ["equipment", "consumable"], weights: host.rules.shop.weights }, true).map((reward) => ({ ...reward, purchased: false })) };
  },
};

export function chooseOption(host: AdventureHost, id: string): void {
  const event = host.state.encounter!;
  if (event.stage !== "choice") throw new Error("這個奇遇已完成選擇");
  const option = host.rules.events[event.id].options.find((entry) => entry.id === id);
  if (!option) throw new Error("奇遇選項不存在");
  if (host.state.player.gold < (option.goldCost ?? 0)) throw new Error("金幣不足");
  if (option.itemCost && (host.state.player.inventory[option.itemCost.itemId] ?? 0) < option.itemCost.quantity) throw new Error("缺少所需物品");
  const outcome = weightedDraw(option.outcomes.map((entry) => [entry, entry.weight]), host.random);
  const handler = eventEffects[outcome.type];
  if (!handler) throw new Error(`尚未實作奇遇效果：${outcome.type}`);
  host.state.player.gold -= option.goldCost ?? 0;
  if (option.itemCost) host.state.player.inventory[option.itemCost.itemId] -= option.itemCost.quantity;
  event.pending = outcome;
  handler(host, outcome);
}

export function skillReward(id: string, host: AdventureHost): Reward {
  const skill = host.catalog.skills[id];
  if (!skill) throw new Error("技能不存在");
  return { type: "skill", id, rarity: skill.rarity as Rarity };
}
