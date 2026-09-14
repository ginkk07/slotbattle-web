import type { EnemyDefinition, EnemySkill } from "../model.ts";
import { check, indexById, multiply, read, sourceRow, status } from "./helpers.ts";

function enemy(id: string, intentCycle: string[], passives: string[], statusRules?: EnemyDefinition["statusRules"]): EnemyDefinition {
  const row = sourceRow("怪物", id);
  return { id, name: row[1], hp: Number(row[6]), attack: Number(row[7]), defense: Number(row[8]), tier: row[4], draft: row[3] === "設計草案", passives, intentCycle, statusRules };
}
function enemySkill(id: string, more: Partial<EnemySkill> = {}): EnemySkill {
  const row = sourceRow("怪物技能", id);
  return { id, name: row[1], description: row[6], multiplier: Number(row[5]), ...more };
}
export const enemySkills = indexById([
  { id: "basic-attack", name: "攻擊", description: "造成基礎攻擊100%的戰鬥傷害。", multiplier: 1 },
  enemySkill("guardian-strike"),
  enemySkill("crushing-blow", { effects: [{ ...status("stunned", 2, undefined, 1, "target"), chance: 0.2 }] }),
  enemySkill("ruin-overload"),
  enemySkill("armor-breaking-strike", { effects: [status("armor-break", undefined, undefined, 2, "target")] }),
  enemySkill("mana-purge-strike", { bonus: multiply(read("self.baseAttack"), { countCards: { where: check("printed.star", ">=", 1) }, unit: "player" }) }),
]);
export const enemies = indexById([
  enemy("ruins-sentinel", ["guardian-strike"], []),
  enemy("elite-ruins-sentinel", ["guardian-strike", "crushing-blow"], ["armor-reinforcement"], [{ status: "stunned", chanceMultiplier: 0.5 }]),
  enemy("ruins-guardian", ["guardian-strike", "crushing-blow", "ruin-overload"], ["armor-reinforcement"], [{ status: "frozen", immune: true }, { status: "stunned", durationMultiplier: 0.5 }]),
  enemy("ruins-mimic", ["armor-breaking-strike"], ["armor-reinforcement"]),
  enemy("iron-beast", ["basic-attack"], ["iron-eating"]),
  enemy("arcane-hound", ["mana-purge-strike"], []),
  enemy("rockscale-lizard", ["guardian-strike"], ["hardened-scales"]),
]);
