/** Serializable domain types: no React, DOM, network or global randomness. */
export type SymbolId = "attack" | "defense" | "star" | "lucky" | "skull";
export type DamageType = "battle" | "extra" | "burn" | "reflection" | "curse" | "poison";
export type Side = "player" | "enemy";
export type Phase = "slots" | "cards" | "retain" | "resolving" | "finished";
export type Comparator = ">=" | "<=" | ">" | "<" | "=";
export type Card = { id: string; symbols: SymbolId[]; origin: string; expiresAt?: number };
export type CardQuery = { use?: "play" | "skill"; where?: Predicate };
export type Scalar = number | { read: string } | { countCards: CardQuery; unit?: "self" | "target" | "source" | "player" } | { calc: "add" | "multiply" | "min" | "max" | "round" | "floor" | "ceil"; args: Scalar[] };
export type Predicate = { left: Scalar; compare: Comparator; right: Scalar } | { all: Predicate[] } | { any: Predicate[] };
export type Target = "self" | "target" | "source" | "enemies" | "attackers";
export type EventName = "battleStart" | "poolInit" | "roundStart" | "boardDrawn" | "spin" | "apEmpty" | "cardsReady" | "cardPlayed" | "cardUsed" | "playerTurnEnd" | "beforeArmor" | "beforeHeal" | "beforeBattle" | "battleHit" | "afterBattle" | "beforeDamage" | "afterDamage" | "receivedDamage" | "enemyTurnEnd" | "roundEnd" | "retainArmor" | "roundFinal" | "statusAdded" | "battleEnd" | "death";
export type Effect = {
  op: string;
  target?: Target;
  amount?: Scalar;
  field?: string;
  mode?: "add" | "multiply" | "set";
  damageType?: DamageType;
  status?: string;
  rounds?: number;
  stacks?: Scalar;
  params?: Record<string, Scalar>;
  symbols?: SymbolId[];
  timing?: "now" | "next";
  when?: Predicate;
  chance?: number;
  source?: "self" | "applier";
};
export type Hook = { event: EventName; effects: Effect[]; when?: Predicate; oncePerBattle?: boolean; order?: "add" | "multiply"; forEachCard?: CardQuery; targeting?: "locked" | "perCard" };
export type Modifier = {
  kind: "weight" | "ap" | "armorGain" | "healing" | "skipAction" | "blockCardArmor" | "skullBoost" | "damageReduction" | "damageImmunity" | "eliteChanceMinimum";
  value?: Scalar;
  symbol?: SymbolId;
  mode?: "add" | "multiply";
  damageType?: DamageType;
  stage?: "percent" | "fixed";
  onlySkill?: boolean;
};
export type Content = { id: string; name: string; description: string; rarity?: string; hooks?: Hook[]; modifiers?: Modifier[]; tags?: string[] };
export type StatusDefinition = Content & { stacking: "add" | "refresh"; draft?: boolean; onAcquire?: Effect[] };
export type SkillLevel = { condition: string; description: string; effects: Effect[] };
export type SkillDefinition = Content & { levels: SkillLevel[] };
export type EnemyDefinition = { id: string; name: string; hp: number; attack: number; defense: number; tier: string; passives: string[]; intentCycle: string[]; draft?: boolean; statusRules?: { status: string; immune?: boolean; chanceMultiplier?: number; durationMultiplier?: number }[] };
export type EnemySkill = Content & { multiplier: number; bonus?: Scalar; effects?: Effect[] };
export type DamageStage = "armor" | "percent" | "fixed" | "special";
export type Rules = {
  symbols: Record<SymbolId, { icon: string; label: string; weight: number }>;
  lines: { name: string; cells: number[] }[];
  combo: number[];
  boardSize: number;
  columns: number;
  baseAp: number;
  lockCost: number;
  spinCost: number;
  retainCost: number;
  minimumWeight: number;
  logLimit: number;
  damage: Record<DamageType, { armor: boolean; generalReduction: boolean; enabled: boolean; pipeline: DamageStage[] }>;
};
export type Catalog = {
  rules: Rules;
  skills: Record<string, SkillDefinition>;
  equipment: Record<string, Content>;
  statuses: Record<string, StatusDefinition>;
  enemies: Record<string, EnemyDefinition>;
  enemySkills: Record<string, EnemySkill>;
  consumables: Record<string, Content & { effects: Effect[] }>;
};
export type Status = { id: string; stacks: number; remaining: number | null; params: Record<string, number>; order: number; source: string; origin: Context["origin"] };
export type Unit = {
  id: string; definitionId?: string; side: Side; name: string; hp: number; maxHp: number;
  armor: number; baseAttack: number; baseDefense: number; pool: number;
  equipment: string[]; statuses: Status[]; skills: { id: string; level: number }[];
  attacked: boolean; damageDealt: boolean; retainedArmor: number;
  pendingAttack: number; pendingDefense: number; intent: string | null;
  counters: Record<string, number>;
  cardUses: { card: Card; use: "play" | "skill" }[];
};
export type DamageRecord = {
  id: number; round: number; source: string; target: string; label: string; type: DamageType;
  raw: number; bypass: number; armorBlocked: number; afterArmor: number;
  afterPercent: number; afterFixed: number; afterSpecial: number; hpDamage: number; overkill: number;
  steps: { stage: DamageStage; before: number; after: number }[];
  /** Read-only presentation snapshot; never used to calculate damage. */
  scene?: { id: string; hp: number; armor: number }[];
  batchId?: number;
};
export type Log = { id: number; round: number; text: string; tone: "normal" | "good" | "danger" };
export type Battle = {
  version: 1; round: number; phase: Phase; outcome: "victory" | "defeat" | "draw" | null;
  rng: number; sequence: number; units: Unit[]; playerId: string;
  ap: number; apCapacity: number; board: SymbolId[]; locked: number[];
  hand: Card[]; retained: Card[]; pendingCards: Card[]; nextCards: Card[];
  nextApPenalty: number; preRetainEmpty: boolean; logs: Log[]; damage: DamageRecord[];
  inventory: Record<string, number>; usedHooks: string[];
  sealedSkills: string[];
};
export type Context = {
  self: Unit; target?: Unit; source?: Unit; card?: Card; status?: Status;
  values: Record<string, number>; label: string; origin: "skill" | "equipment" | "card" | "system";
  damageType?: DamageType;
  event?: EventName;
};
export type BattleSetup = {
  seed: number; playerHp: number; playerDefense?: number; playerAttack?: number;
  enemies: string[]; skills: { id: string; level: number }[]; equipment: string[];
  consumables?: Record<string, number>;
  currentHp?: number;
  sealedSkills?: string[];
  startingStatuses?: { id: string; rounds?: number; stacks?: number; params?: Record<string, number> }[];
  enemyScale?: { hp: number; attack: number };
};
export type Command =
  | { type: "lock"; column: number }
  | { type: "spin" }
  | { type: "confirmBoard" }
  | { type: "play"; cardIds: string[] }
  | { type: "skill"; skillId: string; cardIds: string[] }
  | { type: "consumable"; itemId: string }
  | { type: "beginEnd" }
  | { type: "cancelEnd" }
  | { type: "end"; cardIds: string[] };
