import type { Effect, SkillDefinition } from "../model.ts";
import { armor, content, damage, indexById, multiply, read, sourceRow, status } from "./helpers.ts";

function skill(id: string, makeEffects: (level: number) => Effect[]): SkillDefinition {
  const row = sourceRow("技能", id);
  const descriptions = row[6].split("\n");
  const conditions = row[5].includes("\n") ? row[5].split("\n").map((line) => line.replace(/^LV\d:/i, "")) : [row[5], row[5], row[5]];
  return { ...content("技能", id), levels: descriptions.map((description, index) => ({ condition: conditions[index], description: description.replace(/^Lv\.\d：/, ""), effects: makeEffects(index + 1) })) };
}

export const skills = indexById([
  skill("life-recovery", (level) => [{ op: "heal", target: "self", amount: 4 * level }]),
  skill("power-strike", (level) => [{ op: "pool", target: "self", amount: 12 * level }]),
  skill("shield-block", (level) => [
    { op: "counter", target: "self", field: "blockCards", amount: read("event.materialCount") },
    status("shield-block", undefined, { power: 3 * level }),
  ]),
  skill("fire-imbue", (level) => [status("fire-imbue", 3, { power: level })]),
  skill("mana-armor", (level) => [armor(multiply(read("event.starTotal"), 2 * level))]),
  skill("flame-cover", (level) => [armor(4 * level), status("flame-cover", 1, { power: [5, 5, 10][level - 1] })]),
  skill("shield-throw", (level) => [damage(9 * level)]),
  skill("flame-impact", (level) => [damage([10, 15, 20][level - 1]), { ...status("burning", undefined, undefined, 5 * level, "target"), chance: 0.75 }]),
  skill("shield-bash", (level) => [damage(multiply(read("self.armor"), level)), { op: "stat", target: "self", field: "armor", amount: 0.5, mode: "multiply" }]),
  skill("holy-shield", (level) => [status("holy-shield", 3, { power: [2, 2, 3][level - 1] })]),
]);
