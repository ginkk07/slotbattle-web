/// <reference types="vite/client" />

/** Visual choices live outside the content and combat engine. */
const artBase = `${import.meta.env.BASE_URL}art/`;
const hudBase = `${artBase}hud-v2/`;
const uiBase = `${artBase}ui-v3/`;
export const cardArt = {
  base: `${uiBase}card-idle.png`,
  selected: `${uiBase}card-selected.png`,
  symbols: {
    attack: `${hudBase}icons/cards/attack.png`,
    defense: `${hudBase}icons/cards/defense.png`,
    star: `${hudBase}icons/cards/star.png`,
    lucky: `${hudBase}icons/cards/lucky.png`,
    skull: `${hudBase}icons/cards/skull.png`,
  },
} as const;
export const battleArt = {
  background: `${hudBase}background/forest-ruins.png`,
  atlas: `${artBase}battle-characters.png`,
  columns: 4,
  rows: 2,
};
export const titleArt = { background: `${artBase}title/ruins-gateway-v2.png` };
export const hudArt = {
  icons: Object.fromEntries(["ap", "attack", "bag", "coin", "defense", "end", "play", "play-disabled", "settings"].map((name) => [name, `${hudBase}icons/hud/${name}.png`])) as Record<string, string>,
  skills: Object.fromEntries(["attack", "defense", "flame", "heal", "star"].flatMap((name) => [name, `${name}-disabled`]).map((name) => [name, `${hudBase}icons/skills/${name}.png`])) as Record<string, string>,
  health: { track: `${hudBase}health/hp-track.png`, player: `${hudBase}health/hp-fill-teal.png`, enemy: `${hudBase}health/hp-fill-red.png` },
};
/** Resolve asset URLs through Vite's base so both local and GitHub Pages work. */
const controlNames = ["skill-idle", "skill-selected", "skill-disabled", "action-primary-idle", "action-primary-hover", "action-primary-pressed", "action-primary-disabled", "action-secondary-idle", "action-secondary-hover", "action-secondary-pressed", "action-secondary-disabled", "choice-idle", "choice-selected", "disc-dark", "disc-light", "panel-light"];
export const interfaceTheme = Object.fromEntries(controlNames.map((name) => [`--${name}`, `url("${uiBase}${name}.png")`]));
export const hudTheme = { "--battle-background": `url("${battleArt.background}")`, ...interfaceTheme };
export const titleTheme = { "--title-background": `url("${titleArt.background}")`, ...interfaceTheme };
export const hudStatePreloads = controlNames.filter((name) => /hover|pressed|disabled|selected/.test(name)).map((name) => `${uiBase}${name}.png`);
export type CharacterArt = { cell: number; filter?: string; scale?: number; src?: string };
export const characterArt: Record<string, CharacterArt> = {
  player: { cell: 0, src: `${hudBase}characters/knight.png` },
  "ruins-sentinel": { cell: 4, src: `${hudBase}characters/sentinel.png` },
  "elite-ruins-sentinel": { cell: 4, src: `${hudBase}characters/sentinel.png`, filter: "sepia(.45) saturate(1.4)", scale: 1.05 },
  "ruins-guardian": { cell: 4, src: `${hudBase}characters/sentinel.png`, filter: "sepia(.8) saturate(2.5) hue-rotate(325deg)", scale: 1.1 },
  "ruins-mimic": { cell: 0, src: `${artBase}battle-mimic.png` },
  "iron-beast": { cell: 7, filter: "grayscale(.8) brightness(1.2)", scale: 1.1 },
  "arcane-hound": { cell: 6 },
  "rockscale-lizard": { cell: 7 },
};
export const damageNames = { battle: "戰鬥", extra: "額外", burn: "燃燒", reflection: "反射", curse: "詛咒", poison: "中毒" };
