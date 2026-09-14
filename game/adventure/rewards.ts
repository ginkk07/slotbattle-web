import type { Catalog } from "../model.ts";
import { random, weightedDraw } from "../random.ts";
import type { Adventure, AdventureRules, Adventurer, LootTable, Rarity, Reward, RewardType } from "./model.ts";

const fallback: Record<Rarity, Rarity[]> = { 普通: ["普通", "稀有", "傳說"], 稀有: ["稀有", "普通", "傳說"], 傳說: ["傳說", "稀有", "普通"] };
export const upgradableSkills = (player: Adventurer, catalog: Catalog) => player.skills.filter((skill) => skill.level < catalog.skills[skill.id].levels.length);
export const upgradableWeapons = (player: Adventurer, rules: AdventureRules) => player.equipment.filter((id) => rules.weaponUpgrades[id]);

export function rewardPool(player: Adventurer, catalog: Catalog, rules: AdventureRules, types: RewardType[], rarity: Rarity, options: { shop?: boolean; newSkill?: boolean; allowReplacement?: boolean } = {}): Reward[] {
  const result: Reward[] = [];
  for (const type of types) {
    const contents = type === "equipment" ? catalog.equipment : type === "skill" ? catalog.skills : catalog.consumables;
    for (const entry of Object.values(contents)) {
      if (entry.rarity !== rarity) continue;
      if (type === "equipment") {
        // Reinforcements are obtained from forging, never random drops.
        if (Object.values(rules.weaponUpgrades).includes(entry.id)) continue;
        if (player.equipment.includes(entry.id) || player.equipment.includes(rules.weaponUpgrades[entry.id])) continue;
      } else if (type === "skill") {
        const owned = player.skills.find((skill) => skill.id === entry.id);
        if (owned && (options.newSkill || owned.level >= catalog.skills[entry.id].levels.length)) continue;
        if (!owned && !options.allowReplacement && player.skills.length >= rules.maxHeldSkills) continue;
      } else if (!options.shop && (player.inventory[entry.id] ?? 0) > 0) continue;
      result.push({ id: entry.id, type, rarity });
    }
  }
  return result;
}

export function rollRewards(state: Adventure, catalog: Catalog, rules: AdventureRules, table: Pick<LootTable, "choices" | "types" | "weights">, shop = false): Reward[] {
  const rewards: Reward[] = [];
  for (let index = 0; index < table.choices; index++) {
    const rarity = weightedDraw(Object.entries(table.weights).filter(([, weight]) => weight > 0) as [Rarity, number][], () => random(state));
    const pools = fallback[rarity].map((candidate) => rewardPool(state.player, catalog, rules, table.types, candidate, { shop }).filter((item) => !rewards.some((existing) => existing.id === item.id && existing.type === item.type)));
    const pool = pools.find((entries) => entries.length);
    if (!pool) break;
    rewards.push(weightedDraw(pool.map((item) => [item, 100]), () => random(state)));
  }
  return rewards;
}

export function grantReward(player: Adventurer, reward: Reward, catalog: Catalog, rules: AdventureRules, replacement?: string): void {
  if (reward.type === "skill") {
    const definition = catalog.skills[reward.id];
    if (!definition) throw new Error("技能不存在");
    const owned = player.skills.find((skill) => skill.id === reward.id);
    if (owned) {
      if (owned.level >= definition.levels.length) throw new Error("技能已滿級");
      owned.level++;
    } else {
      if (player.skills.length >= rules.maxHeldSkills) {
        if (!replacement || !player.skills.some((skill) => skill.id === replacement)) throw new Error("請先選擇要替換的技能");
        player.skills = player.skills.filter((skill) => skill.id !== replacement);
      }
      player.skills.push({ id: reward.id, level: 1 });
    }
  } else if (reward.type === "equipment") {
    if (!catalog.equipment[reward.id] || player.equipment.includes(reward.id)) throw new Error("裝備無法重複取得");
    player.equipment.push(reward.id);
  } else {
    if (!catalog.consumables[reward.id]) throw new Error("消耗品不存在");
    player.inventory[reward.id] = (player.inventory[reward.id] ?? 0) + 1;
  }
}

export function rewardName(reward: Reward, catalog: Catalog, player?: Adventurer): string {
  const content = reward.type === "skill" ? catalog.skills[reward.id] : reward.type === "equipment" ? catalog.equipment[reward.id] : catalog.consumables[reward.id];
  const owned = reward.type === "skill" ? player?.skills.find((skill) => skill.id === reward.id) : undefined;
  return `${content.name}${owned ? ` → Lv.${owned.level + 1}` : ""}`;
}

export function shopPrice(state: Adventure, rules: AdventureRules): number {
  const shop = state.encounter?.shop;
  if (!shop) throw new Error("目前不在商店");
  return Math.round(rules.shop.basePrice * rules.shop.depthMultiplier ** (state.depth - 1) * rules.shop.purchaseMultiplier ** shop.purchases);
}

export const randomInteger = (state: Adventure, minimum: number, maximum: number): number => minimum + Math.floor(random(state) * (maximum - minimum + 1));
