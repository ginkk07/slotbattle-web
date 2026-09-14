import { effective, isCursed } from "./cards.ts";
import type { Card, Comparator, SymbolId } from "./model.ts";

type Requirement = { scope: "sum" | "each"; symbol: SymbolId; compare: Comparator; count: number };
type Condition = { kind: "all"; requirements: Requirement[] } | { kind: "slots"; slots: Requirement[][] };
const SYMBOLS: Record<string, SymbolId> = { "⚔": "attack", "🛡": "defense", "✨": "star", "🍀": "lucky", "💀": "skull" };
export function compare(left: number, operator: Comparator, right: number): boolean {
  switch (operator) { case ">=": return left >= right; case "<=": return left <= right; case ">": return left > right; case "<": return left < right; case "=": return left === right; }
}

export function parseCondition(text: string): Condition {
  const normalized = text.replaceAll("\uFE0F", "").replaceAll("≥", ">=").replaceAll("≤", "<=").replaceAll("，", ",").replace(/\s/g, "");
  function group(value: string): Requirement[] {
    return value.split("&").map((part) => {
      const match = part.match(/^(?:Σ([^\[\]]+)|\[([^\[\]]+)\])$/u);
      if (!match) throw new Error(`不支援的材料條件：${part}`);
      const requirement = (match[1] ?? match[2]).match(/^(⚔|🛡|✨|🍀|💀)(>=|<=|=|>|<)(\d+)$/u);
      if (!requirement) throw new Error(`條件必須明寫比較符號：${part}`);
      return { scope: match[1] ? "sum" : "each", symbol: SYMBOLS[requirement[1]], compare: requirement[2] as Comparator, count: Number(requirement[3]) };
    });
  }
  if (!normalized.includes(",")) return { kind: "all", requirements: group(normalized) };
  const slots = normalized.split(",").map(group);
  if (slots.some((requirements) => requirements.some((item) => item.scope !== "each"))) throw new Error("固定卡槽只能使用單張卡片條件");
  return { kind: "slots", slots };
}

export function meetsCondition(cards: Card[], text: string): boolean {
  if (!cards.length || new Set(cards.map((card) => card.id)).size !== cards.length || cards.some(isCursed)) return false;
  const parsed = parseCondition(text);
  const matches = (card: Card, requirement: Requirement) => compare(effective(card, requirement.symbol), requirement.compare, requirement.count);
  if (parsed.kind === "all") {
    return parsed.requirements.every((requirement) => requirement.scope === "each"
      ? cards.every((card) => matches(card, requirement))
      : compare(cards.reduce((sum, card) => sum + effective(card, requirement.symbol), 0), requirement.compare, requirement.count));
  }
  if (cards.length !== parsed.slots.length) return false;
  const slots = parsed.slots;
  // Backtracking is required: a greedy wildcard assignment can reject a valid pair.
  function assign(index: number, used: Set<string>): boolean {
    if (index === slots.length) return true;
    return cards.some((card) => {
      if (used.has(card.id) || !slots[index].every((rule) => matches(card, rule))) return false;
      used.add(card.id);
      const valid = assign(index + 1, used);
      used.delete(card.id);
      return valid;
    });
  }
  return assign(0, new Set());
}
