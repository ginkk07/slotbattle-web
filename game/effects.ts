import { value } from "./evaluation.ts";
import type { Context, Effect, Unit } from "./model.ts";
import type { Runtime } from "./runtime.ts";
import { changeDamage } from "./damage.ts";

export type EffectHandler = (runtime: Runtime, effect: Effect, context: Context) => void;
const amount = (runtime: Runtime, effect: Effect, context: Context) => value(effect.amount ?? 0, runtime.state, context);
function alter(current: number, delta: number, mode: Effect["mode"]): number {
  return Math.round(mode === "set" ? delta : mode === "multiply" ? current * delta : current + delta);
}
const forTargets = (run: (runtime: Runtime, effect: Effect, context: Context, target: Unit) => void): EffectHandler => (runtime, effect, context) => {
  for (const target of runtime.targets(effect.target, context)) {
    if (runtime.state.outcome && effect.target !== "self") break;
    if (target.hp > 0) run(runtime, effect, context, target);
  }
};

/** New content combines these primitives; genuinely new mechanics register a handler here. */
export const handlers: Record<string, EffectHandler> = {
  pool: forTargets((runtime, effect, context, target) => {
    target.pool = Math.max(0, alter(target.pool, amount(runtime, effect, context), effect.mode));
    runtime.log(`${context.label}：戰鬥傷害池 ${target.pool}`);
  }),
  event: (runtime, effect, context) => {
    const field = effect.field!;
    if (field === "amount") changeDamage(context.values, amount(runtime, effect, context), effect.mode);
    else context.values[field] = alter(context.values[field] ?? 0, amount(runtime, effect, context), effect.mode);
  },
  armor: forTargets((runtime, effect, context, target) => runtime.gainArmor(target, amount(runtime, effect, context), context)),
  heal: forTargets((runtime, effect, context, target) => runtime.heal(target, amount(runtime, effect, context), context)),
  damage: (runtime, effect, context) => {
    const source = effect.source === "applier" ? runtime.state.units.find((unit) => unit.id === context.status?.source) ?? context.self : context.self;
    // Authored battle damage always contributes to the actor's pool once.
    // Only the end-of-turn attack resolver can commit battle damage to HP.
    if (effect.damageType === "battle") {
      runtime.damage(source, undefined, "battle", amount(runtime, effect, context), context.label);
      return;
    }
    forTargets((runtime, effect, context, target) => {
      const targeted = effect.target === "enemies" || effect.target === "attackers" ? { ...context, target } : context;
      runtime.damage(source, target, effect.damageType ?? "extra", amount(runtime, effect, targeted), context.label);
    })(runtime, effect, context);
  },
  revive: (runtime, effect, context) => {
    if (context.event !== "death") throw new Error("復活只可由死亡時效果執行");
    const unit = context.self;
    if (unit.hp > 0) return;
    unit.hp = Math.min(unit.maxHp, Math.max(0, Math.round(amount(runtime, effect, context))));
    if (unit.hp > 0) { delete unit.counters.dead; runtime.log(`${unit.name}復活，生命 ${unit.hp}。`, "good"); }
  },
  status: forTargets((runtime, effect, context, target) => runtime.addStatus(target, effect.status!, context, {
    stacks: value(effect.stacks ?? 1, runtime.state, context), rounds: effect.rounds, chance: effect.chance,
    params: effect.params ? Object.fromEntries(Object.entries(effect.params).map(([key, expression]) => [key, value(expression, runtime.state, context)])) : undefined,
  })),
  removeStatus: forTargets((_runtime, effect, _context, target) => { target.statuses = target.statuses.filter((status) => status.id !== effect.status); }),
  decay: (runtime, effect, context) => {
    if (!context.status) return;
    context.status.stacks = context.status.stacks <= 1 ? 0 : Math.round(context.status.stacks * amount(runtime, effect, context));
    context.self.statuses = context.self.statuses.filter((status) => status.stacks > 0);
  },
  stat: forTargets((runtime, effect, context, target) => {
    const field = effect.field;
    if (field !== "armor" && field !== "maxHp" && field !== "baseAttack" && field !== "baseDefense") throw new Error(`不允許改寫的單位欄位：${field}`);
    target[field] = Math.max(0, alter(target[field], amount(runtime, effect, context), effect.mode));
  }),
  pendingStat: forTargets((runtime, effect, context, target) => {
    const key = effect.field === "baseAttack" ? "pendingAttack" : "pendingDefense";
    target[key] += Math.max(0, Math.round(amount(runtime, effect, context)));
  }),
  counter: forTargets((runtime, effect, context, target) => {
    target.counters[effect.field!] = alter(target.counters[effect.field!] ?? 0, amount(runtime, effect, context), effect.mode);
  }),
  card: (runtime, effect, context) => {
    const card = runtime.createCard(effect.symbols ?? [], context.label);
    if (effect.timing === "next") runtime.state.nextCards.push(card);
    else if (runtime.state.phase === "cards") runtime.state.hand.push(card);
    else runtime.state.pendingCards.push(card);
    runtime.log(`${context.label}：${effect.timing === "next" ? "下回合" : ""}獲得特殊卡片。`, "good");
  },
  ap: (runtime, effect, context) => {
    runtime.state.ap = Math.max(0, alter(runtime.state.ap, amount(runtime, effect, context), effect.mode));
    runtime.log(`${context.label}：AP +${amount(runtime, effect, context)}`, "good");
  },
  saveArmor: forTargets((runtime, effect, context, target) => { target.retainedArmor = Math.round(target.armor * amount(runtime, effect, context)); }),
  ensureSymbol: (runtime, effect, context) => {
    const symbol = effect.symbols![0];
    if (!runtime.state.board.includes(symbol)) runtime.state.board[Math.floor(runtime.random() * runtime.state.board.length)] = symbol;
    context.values.skulls = runtime.state.board.filter((cell) => cell === "skull").length;
  },
};
