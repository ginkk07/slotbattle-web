import { armor, content, damage, indexById, status } from "./helpers.ts";
import type { Content, Effect } from "../model.ts";
const consumable = (id: string, effects: Effect[]): Content & { effects: Effect[] } => ({ ...content("消耗品", id), effects });
export const consumables = indexById([
  consumable("healing-potion", [{ op: "heal", target: "self", amount: 10 }]),
  consumable("whetstone", [status("attack-up-7", 3)]),
  consumable("hardening-potion", [armor(15)]),
  consumable("magic-mushroom", [{ op: "card", symbols: ["star", "star", "star"] }]),
  consumable("fire-bomb", [damage(8), status("burning", undefined, undefined, 3, "target")]),
]);
