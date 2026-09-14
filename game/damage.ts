import type { DamageRecord, DamageStage, DamageType, Rules, Unit } from "./model.ts";

export type Mitigation = { percent: number; fixed: number; special?: (value: number) => number };

/** Whole-hit multipliers also multiply its armor-bypassing component. */
export function changeDamage(values: Record<string, number>, delta: number, mode: "add" | "multiply" | "set" = "add"): void {
  const current = values.amount ?? 0;
  values.amount = Math.max(0, Math.round(mode === "multiply" ? current * delta : mode === "set" ? delta : current + delta));
  if (mode === "multiply") values.bypass = Math.round((values.bypass ?? 0) * delta);
  values.bypass = Math.min(values.amount, Math.max(0, values.bypass ?? 0));
}

/** Each type declares its stages. This function never changes HP or armor. */
export function calculateDamage(raw: number, type: DamageType, target: Unit, rules: Rules, mitigation: Mitigation, bypass = 0): Omit<DamageRecord, "id" | "round" | "source" | "target" | "label" | "type"> {
  const rule = rules.damage[type];
  if (!rule.enabled) throw new Error(`傷害類別 ${type} 尚未實作`);
  raw = Math.max(0, Math.round(raw));
  bypass = Math.max(0, Math.min(raw, Math.round(bypass)));
  let remaining = raw;
  let armorBlocked = 0;
  const stages: Record<DamageStage, number> = { armor: raw, percent: raw, fixed: raw, special: raw };
  const steps: DamageRecord["steps"] = [];
  const handlers: Record<DamageStage, () => number> = {
    armor: () => {
      armorBlocked = rule.armor ? Math.min(target.armor, Math.max(0, remaining - bypass)) : 0;
      return remaining - armorBlocked;
    },
    percent: () => Math.round(remaining * (1 - Math.min(1, Math.max(0, mitigation.percent)))),
    fixed: () => remaining - Math.round(mitigation.fixed),
    special: () => mitigation.special?.(remaining) ?? remaining,
  };
  for (const stage of rule.pipeline) {
    const before = remaining;
    remaining = Math.max(0, handlers[stage]());
    stages[stage] = remaining;
    steps.push({ stage, before, after: remaining });
  }
  return {
    raw, bypass, armorBlocked, afterArmor: stages.armor, afterPercent: stages.percent,
    afterFixed: stages.fixed, afterSpecial: stages.special,
    hpDamage: Math.min(target.hp, remaining), overkill: Math.max(0, remaining - target.hp), steps,
  };
}
