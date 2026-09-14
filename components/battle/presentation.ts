/// <reference types="vite/client" />

/** Visual choices live outside the content and combat engine. */
const artBase = `${import.meta.env.BASE_URL}art/`;
export const battleArt = {
  background: `${artBase}ruins-battle.png`,
  atlas: `${artBase}battle-characters.png`,
  columns: 4,
  rows: 2,
};
export type CharacterArt = { cell: number; filter?: string; scale?: number; src?: string };
export const characterArt: Record<string, CharacterArt> = {
  player: { cell: 0 },
  "ruins-sentinel": { cell: 4, scale: .9 },
  "elite-ruins-sentinel": { cell: 4, filter: "sepia(.45) saturate(1.4)", scale: 1.05 },
  "ruins-guardian": { cell: 4, filter: "sepia(.8) saturate(2.5) hue-rotate(325deg)", scale: 1.2 },
  "ruins-mimic": { cell: 0, src: `${artBase}battle-mimic.png` },
  "iron-beast": { cell: 7, filter: "grayscale(.8) brightness(1.2)", scale: 1.1 },
  "arcane-hound": { cell: 6 },
  "rockscale-lizard": { cell: 7 },
};
export const damageNames = { battle: "戰鬥", extra: "額外", burn: "燃燒", reflection: "反射", curse: "詛咒", poison: "中毒" };
