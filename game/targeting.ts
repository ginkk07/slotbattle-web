import type { Battle, Side, Unit } from "./model.ts";

/** State order is formation order; selection never mutates the formation. */
export function sideUnits(state: Battle, side: Side): Unit[] {
  return state.units.filter((unit) => unit.side === side);
}

export function opposingUnits(state: Battle, actor: Unit): Unit[] {
  const units = sideUnits(state, actor.side === "player" ? "enemy" : "player").filter((unit) => unit.hp > 0);
  return actor.side === "enemy" ? units.reverse() : units;
}

export function lifecycleUnits(state: Battle): Unit[] {
  return [...sideUnits(state, "player"), ...sideUnits(state, "enemy")];
}
