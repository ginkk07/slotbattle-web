import { effective, printed } from "./cards.ts";
import { compare } from "./conditions.ts";
import type { Battle, CardQuery, Context, Predicate, Scalar, SymbolId, Unit } from "./model.ts";

export function matchingCards(unit: Unit | undefined, query: CardQuery, battle: Battle, context: Context) {
  return (unit?.cardUses ?? []).filter((entry) => (!query.use || entry.use === query.use)
    && testPredicate(query.where, battle, { ...context, card: entry.card }));
}

export function value(expression: Scalar, battle: Battle, context: Context): number {
  if (typeof expression === "number") return expression;
  if ("countCards" in expression) {
    const unit = expression.unit === "player" ? battle.units.find((entry) => entry.id === battle.playerId) : context[expression.unit ?? "self"];
    return matchingCards(unit, expression.countCards, battle, context).length;
  }
  if ("calc" in expression) {
    const args = expression.args.map((argument) => value(argument, battle, context));
    switch (expression.calc) {
      case "add": return args.reduce((sum, item) => sum + item, 0);
      case "multiply": return args.reduce((product, item) => product * item, 1);
      case "min": return Math.min(...args);
      case "max": return Math.max(...args);
      case "round": return Math.round(args[0]);
      case "floor": return Math.floor(args[0]);
      case "ceil": return Math.ceil(args[0]);
    }
  }
  const [scope, field] = expression.read.split(".");
  if (scope === "event") return context.values[field] ?? 0;
  if (scope === "counter") return context.self.counters[field] ?? 0;
  if (scope === "param") return context.status?.params[field] ?? 0;
  if (scope === "status") return field === "stacks" ? (context.status?.stacks ?? 0) : (context.status?.remaining ?? 0);
  if (scope === "effective" || scope === "printed") return context.card ? (scope === "effective" ? effective : printed)(context.card, field as SymbolId) : 0;
  if (expression.read === "round") return battle.round;
  if (expression.read === "ap") return battle.ap;
  if (expression.read === "emptyHand") return Number(battle.preRetainEmpty);
  if (scope === "self" || scope === "target" || scope === "source") {
    const unit = context[scope];
    if (!unit) return 0;
    if (field === "damageDealt") return Number(unit.damageDealt);
    if (field === "isPlayer") return Number(unit.side === "player");
    const result = unit[field as keyof typeof unit];
    if (typeof result === "number") return result;
  }
  throw new Error(`未知的數值欄位：${expression.read}`);
}

export function testPredicate(predicate: Predicate | undefined, battle: Battle, context: Context): boolean {
  if (!predicate) return true;
  if ("all" in predicate) return predicate.all.every((part) => testPredicate(part, battle, context));
  if ("any" in predicate) return predicate.any.some((part) => testPredicate(part, battle, context));
  return compare(value(predicate.left, battle, context), predicate.compare, value(predicate.right, battle, context));
}
