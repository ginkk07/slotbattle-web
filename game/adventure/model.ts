import type { Battle, BattleSetup, Catalog, Command, SymbolId } from "../model.ts";

export type Rank = "normal" | "elite" | "boss";
export type RewardType = "equipment" | "skill" | "consumable";
export type Rarity = "普通" | "稀有" | "傳說";
export type Reward = { type: RewardType; id: string; rarity: Rarity };
export type LootTable = { choices: number; dropChance: number; types: RewardType[]; weights: Record<Rarity, number>; gold: [number, number] };
export type EventOutcome = {
  id: string; type: string; weight: number; text: string;
  rank?: Rank; unitId?: string; damageMaxHpRatio?: number; rewardRarity?: string; rewardType?: RewardType;
  maxHpRatio?: number; successChance?: number; lootTableId?: string;
  gold?: { minimum: number; maximum: number }; statusId?: string; duration?: number; stacks?: number; potency?: number;
  lootWeights?: { consumable: number; weapon: number; gold: number }; eliteChances?: number[];
};
export type EventDefinition = {
  id: string; name: string; description: string; rarity: Rarity; weight: number; tags: string[];
  requirements?: { upgradableEquipment?: boolean };
  options: { id: string; label: string; goldCost?: number; itemCost?: { itemId: string; quantity: number }; outcomes: EventOutcome[] }[];
};
export type AdventureRules = {
  region: { id: string; name: string; eventChance: number; eliteChance: number; bossMinimum: number; bossChancePerProgress: number; hpPerDepth: number; attackPerDepth: number; healAfterBoss: boolean };
  eventRarity: Record<Rarity, number>;
  starting: { hp: number; skills: string[]; equipment: string[]; maxSkills: number; maxEquipment: number };
  maxHeldSkills: number;
  encounters: { id: string; rank: Rank; weight: number; lootTable: string }[];
  loot: Record<string, LootTable>;
  shop: { choices: number; weights: Record<Rarity, number>; basePrice: number; depthMultiplier: number; purchaseMultiplier: number };
  weaponUpgrades: Record<string, string>;
  collector: { attempts: number; reels: number; maxLocks: number };
  events: Record<string, EventDefinition>;
};
export type Adventurer = {
  hp: number; maxHp: number; gold: number; skills: { id: string; level: number }[];
  equipment: string[]; inventory: Record<string, number>;
  sealedNext: string[]; statusesNext: NonNullable<BattleSetup["startingStatuses"]>;
};
export type Encounter = {
  id: string; stage: "choice" | "result" | "shop" | "upgrade" | "forge" | "vault" | "corpse" | "wager" | "spin" | "replace";
  text: string; pending?: EventOutcome;
  reward?: Reward;
  shop?: { purchases: number; spent: number; offers: (Reward & { purchased: boolean })[] };
  corpse?: { attempts: number; weaponFound: boolean };
  collector?: { attempt: number; lockedIndex: number | null; wager: string | null; reels: SymbolId[]; reward: Reward };
};
export type Adventure = {
  version: 1; phase: "battle" | "reward" | "event" | "ended"; rng: number;
  depth: number; progress: number; completed: number; victories: number; bosses: number;
  player: Adventurer; battle: Battle | null; enemyId: string | null; encounter: Encounter | null;
  rewards: Reward[]; rewardGold: number; advanceDepth: boolean;
  log: string[];
};
export type AdventureSetup = { seed: number; skills: string[]; equipment: string[] };
export type AdventureCommand =
  | { type: "battle"; command: Command }
  | { type: "settleBattle" }
  | { type: "reward"; index: number | null }
  | { type: "continue" }
  | { type: "option"; id: string }
  | { type: "eventSkill"; id: string }
  | { type: "forge"; id: string }
  | { type: "vault"; accept: boolean }
  | { type: "buy"; id: string; kind: "item" | "skill" }
  | { type: "leave" }
  | { type: "search" }
  | { type: "collectorLock"; index: number }
  | { type: "collectorSpin" };
export type AdventureHost = {
  state: Adventure; catalog: Catalog; rules: AdventureRules;
  random: () => number;
  startBattle: (rank?: Rank, id?: string) => void;
  result: (text: string) => void;
  grant: (reward: Reward, replacement?: string) => void;
};
