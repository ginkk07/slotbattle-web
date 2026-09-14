import type { Catalog } from "../model.ts";
import { createBattle, dispatch } from "../battle.ts";
import { random, weightedDraw } from "../random.ts";
import type { Adventure, AdventureCommand, AdventureHost, AdventureRules, AdventureSetup, Rarity, Reward } from "./model.ts";
import { chooseOption, searchCorpse, skillReward } from "./event-effects.ts";
import { chooseWager, lockCollector, spinCollector } from "./collector.ts";
import { grantReward, randomInteger, rewardName, rollRewards, shopPrice, upgradableSkills, upgradableWeapons } from "./rewards.ts";

export function eliteChance(state: Adventure, catalog: Catalog, rules: AdventureRules): number {
  const minimums = state.player.equipment.flatMap((id) => catalog.equipment[id].modifiers ?? []).filter((modifier) => modifier.kind === "eliteChanceMinimum").map((modifier) => typeof modifier.value === "number" ? modifier.value : 0);
  return Math.min(1, Math.max(rules.region.eliteChance, ...minimums));
}

export function enterEvent(state: Adventure, id: string, rules: AdventureRules): void {
  const definition = rules.events[id];
  if (!definition) throw new Error("奇遇不存在");
  state.phase = "event";
  state.encounter = { id, stage: "choice", text: definition.description };
  state.log.push(`遇見${definition.name}。`);
}

function hostFor(state: Adventure, catalog: Catalog, rules: AdventureRules): AdventureHost {
  const host: AdventureHost = {
    state, catalog, rules, random: () => random(state),
    result: (text) => { state.encounter!.stage = "result"; state.encounter!.text = text; state.log.push(text); },
    grant: (reward, replacement) => { const name = rewardName(reward, catalog, state.player); grantReward(state.player, reward, catalog, rules, replacement); state.log.push(`取得${name}。`); },
    startBattle: (rank = "normal", id) => {
      const candidates = rules.encounters.filter((entry) => entry.rank === rank && entry.weight > 0 && !catalog.enemies[entry.id]?.draft);
      const enemyId = id ?? weightedDraw(candidates.map((entry) => [entry.id, entry.weight]), host.random);
      if (!rules.encounters.some((entry) => entry.id === enemyId)) throw new Error("敵人未加入探索資料");
      state.enemyId = enemyId;
      state.battle = createBattle({ seed: state.rng, playerHp: state.player.maxHp, currentHp: state.player.hp, enemies: [enemyId], skills: state.player.skills, equipment: state.player.equipment, consumables: state.player.inventory, sealedSkills: state.player.sealedNext, startingStatuses: state.player.statusesNext, enemyScale: { hp: 1 + (state.depth - 1) * rules.region.hpPerDepth, attack: 1 + (state.depth - 1) * rules.region.attackPerDepth } }, catalog);
      state.rng = state.battle.rng;
      state.player.sealedNext = [];
      state.player.statusesNext = [];
      state.phase = "battle";
      state.encounter = null;
      state.rewards = [];
      state.log.push(`遭遇${catalog.enemies[enemyId].name}。`);
    },
  };
  return host;
}

export function nextEncounter(state: Adventure, catalog: Catalog, rules: AdventureRules): void {
  const host = hostFor(state, catalog, rules);
  const bossChance = state.progress >= rules.region.bossMinimum ? Math.min(1, state.progress * rules.region.bossChancePerProgress) : 0;
  if (random(state) < bossChance) { host.startBattle("boss"); return; }
  if (state.completed > 0 && random(state) < rules.region.eventChance) {
    const eligible = Object.values(rules.events).filter((event) => !event.requirements?.upgradableEquipment || upgradableWeapons(state.player, rules).length > 0);
    const rarityEntries = Object.entries(rules.eventRarity).filter(([rarity, weight]) => weight > 0 && eligible.some((event) => event.rarity === rarity)) as [Rarity, number][];
    if (rarityEntries.length) {
      const rarity = weightedDraw(rarityEntries, host.random);
      const event = weightedDraw(eligible.filter((entry) => entry.rarity === rarity).map((entry) => [entry, entry.weight]), host.random);
      enterEvent(state, event.id, rules);
      return;
    }
  }
  host.startBattle(random(state) < eliteChance(state, catalog, rules) ? "elite" : "normal");
}

export function createAdventure(setup: AdventureSetup, catalog: Catalog, rules: AdventureRules): Adventure {
  if (!Number.isFinite(setup.seed)) throw new Error("種子必須是有效數字");
  const valid = (ids: string[], allowed: string[], maximum: number) => ids.length <= maximum && new Set(ids).size === ids.length && ids.every((id) => allowed.includes(id));
  if (!valid(setup.skills, rules.starting.skills, rules.starting.maxSkills) || !valid(setup.equipment, rules.starting.equipment, rules.starting.maxEquipment)) throw new Error("起始技能或裝備不符合攜帶規則");
  const state: Adventure = { version: 1, phase: "battle", rng: setup.seed >>> 0, depth: 1, progress: 0, completed: 0, victories: 0, bosses: 0, player: { hp: rules.starting.hp, maxHp: rules.starting.hp, gold: 0, skills: setup.skills.map((id) => ({ id, level: 1 })), equipment: [...setup.equipment], inventory: {}, sealedNext: [], statusesNext: [] }, battle: null, enemyId: null, encounter: null, rewards: [], rewardGold: 0, advanceDepth: false, log: ["踏入遺跡，冒險開始。"] };
  nextEncounter(state, catalog, rules);
  return state;
}

function settleBattle(host: AdventureHost): void {
  const { state, catalog, rules } = host;
  if (state.phase !== "battle" || !state.battle?.outcome) throw new Error("戰鬥尚未結束");
  const unit = state.battle.units.find((entry) => entry.id === state.battle!.playerId)!;
  state.player.hp = unit.hp;
  state.player.maxHp = unit.maxHp;
  state.player.inventory = { ...state.battle.inventory };
  state.rng = state.battle.rng;
  if (state.battle.outcome !== "victory") { state.phase = "ended"; state.log.push("本次冒險結束。"); return; }
  const entry = rules.encounters.find((enemy) => enemy.id === state.enemyId)!;
  const table = rules.loot[entry.lootTable];
  if (!table) throw new Error("戰鬥掉落表不存在");
  state.victories++;
  state.completed++;
  state.progress++;
  state.advanceDepth = entry.rank === "boss";
  if (state.advanceDepth) {
    state.bosses++;
    if (rules.region.healAfterBoss) state.player.hp = state.player.maxHp;
  }
  const dropped = random(state) < table.dropChance;
  state.rewardGold = randomInteger(state, ...table.gold);
  state.player.gold += state.rewardGold;
  state.rewards = dropped ? rollRewards(state, catalog, rules, table) : [];
  state.phase = "reward";
  state.log.push(`戰鬥勝利，獲得 ${state.rewardGold} 枚金幣。`);
}

function selectEventSkill(host: AdventureHost, id: string): void {
  const event = host.state.encounter!;
  if (event.stage === "wager") { chooseWager(host, id); return; }
  if (event.stage === "replace" && event.reward) {
    host.grant(event.reward, id);
    host.result(`獲得${rewardName(event.reward, host.catalog)}。`);
    return;
  }
  if (event.stage !== "upgrade" || !upgradableSkills(host.state.player, host.catalog).some((skill) => skill.id === id)) throw new Error("目前不能升級此技能");
  host.grant(skillReward(id, host));
  host.result(`${host.catalog.skills[id].name}已升級。`);
}

function buy(host: AdventureHost, id: string, kind: "item" | "skill"): void {
  const event = host.state.encounter!;
  if (event.stage !== "shop" || !event.shop) throw new Error("目前不在商店");
  const price = shopPrice(host.state, host.rules);
  if (host.state.player.gold < price) throw new Error("金幣不足");
  let reward: Reward;
  if (kind === "skill") {
    if (!upgradableSkills(host.state.player, host.catalog).some((skill) => skill.id === id)) throw new Error("技能無法再升級");
    reward = skillReward(id, host);
  } else {
    const offer = event.shop.offers.find((item) => item.id === id && !item.purchased);
    if (!offer) throw new Error("商品已售出或不存在");
    offer.purchased = true;
    reward = offer;
  }
  host.grant(reward);
  host.state.player.gold -= price;
  event.shop.purchases++;
  event.shop.spent += price;
}

function perform(host: AdventureHost, command: AdventureCommand): void {
  const { state, catalog, rules } = host;
  if (state.phase === "ended") throw new Error("本次冒險已結束");
  if (command.type === "battle") {
    if (state.phase !== "battle" || !state.battle) throw new Error("目前不在戰鬥中");
    const result = dispatch(state.battle, command.command, catalog);
    if (result.error) throw new Error(result.error);
    state.battle = result.state;
    state.rng = result.state.rng;
    return;
  }
  if (command.type === "settleBattle") { settleBattle(host); return; }
  if (command.type === "reward") {
    if (state.phase !== "reward") throw new Error("目前沒有待領取獎勵");
    if (command.index !== null) {
      const reward = state.rewards[command.index];
      if (!Number.isInteger(command.index) || !reward) throw new Error("獎勵不存在");
      host.grant(reward);
    }
    state.rewards = [];
    if (state.advanceDepth) { state.depth++; state.progress = 0; state.advanceDepth = false; }
    nextEncounter(state, catalog, rules);
    return;
  }
  if (state.phase !== "event" || !state.encounter) throw new Error("目前不在奇遇中");
  const event = state.encounter;
  switch (command.type) {
    case "continue":
      if (event.stage !== "result") throw new Error("奇遇仍有未完成的選擇");
      state.completed++; state.progress++;
      nextEncounter(state, catalog, rules);
      break;
    case "option": chooseOption(host, command.id); break;
    case "eventSkill": selectEventSkill(host, command.id); break;
    case "forge": {
      if (event.stage !== "forge" || !upgradableWeapons(state.player, rules).includes(command.id)) throw new Error("此武器無法強化");
      const success = host.random() < (event.pending?.successChance ?? 0);
      const next = rules.weaponUpgrades[command.id];
      if (success) state.player.equipment = state.player.equipment.map((id) => id === command.id ? next : id);
      host.result(success ? `強化成功，獲得${catalog.equipment[next].name}。` : "強化失敗，武器保持不變；已用掉的費用與材料不會返還。");
      break;
    }
    case "vault":
      if (event.stage !== "vault" || !event.reward) throw new Error("沒有可領取的石室裝備");
      if (command.accept) host.grant(event.reward);
      host.result(command.accept ? `取得${rewardName(event.reward, catalog)}。` : "留下裝備，離開石室。已支付的生命不會返還。");
      break;
    case "buy": buy(host, command.id, command.kind); break;
    case "leave":
      if (!["shop", "corpse"].includes(event.stage)) throw new Error("請先完成目前的選擇");
      host.result(event.shop ? `離開商店，本次花費 ${event.shop.spent} 枚金幣。` : "保留已取得的物品，離開屍體。");
      break;
    case "search": searchCorpse(host); break;
    case "collectorLock": lockCollector(host, command.index); break;
    case "collectorSpin": spinCollector(host); break;
  }
}

/** Commands are transactional, including RNG, costs and reward ownership. */
export function dispatchAdventure(state: Adventure, command: AdventureCommand, catalog: Catalog, rules: AdventureRules): { state: Adventure; error?: string } {
  const next = structuredClone(state);
  try {
    perform(hostFor(next, catalog, rules), command);
    next.log = next.log.slice(-100);
    return { state: next };
  } catch (error) { return { state, error: error instanceof Error ? error.message : "操作無法完成" }; }
}
