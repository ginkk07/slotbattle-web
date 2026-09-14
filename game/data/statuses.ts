import type { StatusDefinition } from "../model.ts";
import { armor, damage, hook, indexById, multiply, read, sourceRow, status } from "./helpers.ts";

const base = (id: string, more: Partial<StatusDefinition> = {}): StatusDefinition => {
  const row = sourceRow("狀態", id);
  return { id, name: row[1], description: row[7], stacking: "refresh", ...more };
};

export const statuses = indexById([
  base("armor-reinforcement", { modifiers: [{ kind: "damageReduction", damageType: "battle", stage: "percent", value: 0.2 }] }),
  base("shield-block", { hooks: [hook("playerTurnEnd", [armor(multiply(read("counter.blockCards"), read("param.power"))), { op: "removeStatus", status: "shield-block", target: "self" }])] }),
  base("fire-imbue", { hooks: [hook("cardPlayed", [damage(read("param.power"))])] }),
  base("flame-cover", { hooks: [hook("enemyTurnEnd", [status("burning", undefined, undefined, read("param.power"), "attackers")])] }),
  base("holy-shield", { modifiers: [{ kind: "armorGain", value: read("param.power"), mode: "multiply" }, { kind: "weight", symbol: "defense", value: 25, mode: "add" }, { kind: "weight", symbol: "attack", value: -25, mode: "add" }] }),
  base("burning", { stacking: "add", hooks: [hook("roundEnd", [
    { op: "damage", damageType: "burn", target: "self", source: "applier", amount: read("status.stacks") },
    { op: "decay", amount: 0.5 },
  ])] }),
  base("poisoned", { draft: true }),
  base("frozen", { modifiers: [{ kind: "skipAction" }] }),
  base("stunned", { tags: ["stun"], modifiers: [{ kind: "skipAction" }] }),
  ...[3, 5, 7, 9].map((amount) => base(`attack-up-${amount}`, { onAcquire: [{ op: "pool", amount, target: "self" }], hooks: [hook("poolInit", [{ op: "pool", amount, target: "self" }])] })),
  base("regeneration", { draft: true }),
  base("damage-reflection", { stacking: "add", hooks: [hook("receivedDamage", [{ op: "damage", target: "source", damageType: "reflection", amount: read("status.stacks") }], { left: read("event.isBattle"), compare: "=", right: 1 })] }),
  base("curse", { stacking: "add", tags: ["curse"] }),
  base("armor-break", { stacking: "add", tags: ["armorBreak"] }),
  base("iron-eating", { hooks: [hook("roundEnd", [{ op: "pendingStat", target: "self", field: "baseAttack", amount: { calc: "round", args: [multiply(read("target.armor"), 1 / 6)] } }, { op: "pendingStat", target: "self", field: "baseDefense", amount: { calc: "round", args: [multiply(read("target.armor"), 1 / 6)] } }])] }),
  base("hardened-scales", { hooks: [hook("receivedDamage", [armor(read("self.baseDefense"))], { left: read("event.isExtra"), compare: "=", right: 1 })] }),
]);
