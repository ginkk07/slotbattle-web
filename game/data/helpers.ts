import source from "./source-sheet.json" with { type: "json" };
import type { Content, Effect, EventName, Hook, Predicate, Scalar } from "../model.ts";

export const read = (field: string): Scalar => ({ read: field });
export const multiply = (...args: Scalar[]): Scalar => ({ calc: "multiply", args });
export const add = (...args: Scalar[]): Scalar => ({ calc: "add", args });
export const check = (field: string, compare: ">=" | "<=" | ">" | "<" | "=", right: number): Predicate => ({ left: read(field), compare, right });
export const all = (...predicates: Predicate[]): Predicate => ({ all: predicates });
export const hook = (event: EventName, effects: Effect[], when?: Predicate, order?: "add" | "multiply"): Hook => ({ event, effects, when, order });
export const status = (id: string, rounds?: number, params?: Record<string, Scalar>, stacks: Scalar = 1, target: "self" | "target" | "attackers" = "self"): Effect => ({ op: "status", target, status: id, rounds, params, stacks });
export const damage = (amount: Scalar, damageType: "extra" | "battle" = "extra"): Effect => ({ op: "damage", target: "target", amount, damageType });
export const armor = (amount: Scalar): Effect => ({ op: "armor", target: "self", amount });
export const change = (field: string, amount: Scalar, mode: "add" | "multiply" | "set" = "add"): Effect => ({ op: "event", field, amount, mode });

export function sourceRow(tab: "技能" | "裝備" | "狀態" | "消耗品" | "怪物" | "怪物技能", id: string): string[] {
  const row = source.sheets[tab].values.find((entry) => entry[2] === id);
  if (!row) throw new Error(`資料來源缺少 ${tab} / ${id}`);
  return row;
}
export function content(tab: "技能" | "裝備" | "消耗品", id: string): Content {
  const row = sourceRow(tab, id);
  return { id, name: row[1], rarity: row[3], description: row[tab === "技能" ? 6 : 4] };
}
export const indexById = <T extends { id: string }>(entries: T[]): Record<string, T> => Object.fromEntries(entries.map((entry) => [entry.id, entry]));
