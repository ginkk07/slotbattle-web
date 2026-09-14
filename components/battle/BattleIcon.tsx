import type { ReactNode } from "react";
import type { SymbolId } from "../../game/model.ts";

export type BattleIconName = SymbolId | "heart" | "heal" | "flame" | "diamond" | "reel" | "cards" | "bag" | "log" | "lock" | "unlock" | "arrow" | "check" | "end" | "rotate";

const artwork: Record<BattleIconName, ReactNode> = {
  attack: <><path d="m19 4 9-1-1 9-12 12-7-7Z" fill="currentColor" fillOpacity=".16" /><path d="M25 6 12 19M6 15l11 11M9 22l-6 6m0-4 5 5" /></>,
  defense: <><path d="M16 3 27 8v8c0 6-6 10-11 13C11 26 5 22 5 16V8Z" fill="currentColor" fillOpacity=".14" /><path d="m16 7 7 4v5c0 4-4 7-7 9-3-2-7-5-7-9v-5ZM16 7v18M9 15h14" /></>,
  star: <><path d="m16 3 3.6 8.8L29 13l-7 6.3 2 9.2-8-4.8-8 4.8 2-9.2L3 13l9.4-1.2Z" fill="currentColor" fillOpacity=".18" /><path d="m16 9 1.8 7-1.8 5-1.8-5Z" fill="currentColor" stroke="none" /></>,
  lucky: <><path d="M16 15C6 16 3 10 7 6c4-4 9-1 9 9Zm1 0c-1-10 5-13 9-9s1 9-9 9Zm0 2c10-1 13 5 9 9s-9 1-9-9Zm-2 0c1 10-5 13-9 9s-1-9 9-9Z" fill="currentColor" fillOpacity=".16" /><path d="m16 16-3 14" /></>,
  skull: <><path d="M6 13a10 10 0 0 1 20 0v7l-5 3v6H11v-6l-5-3Z" fill="currentColor" fillOpacity=".12" /><circle cx="12" cy="14" r="2.2" fill="currentColor" /><circle cx="21" cy="14" r="2.2" fill="currentColor" /><path d="m16 19-1.5 3h3ZM15 25v4m3-4v4" /></>,
  heart: <><path d="M16 27 5 16C-3 7 9-2 16 8c7-10 19-1 11 8Z" fill="currentColor" fillOpacity=".15" /><path d="M6 16h6l2-5 4 10 2-5h6" /></>,
  heal: <><path d="m16 2 4 7 7 4-7 4-4 13-4-13-7-4 7-4Z" fill="currentColor" fillOpacity=".12" /><path d="M16 8v13m-6-6h12M4 24l2 2m20-20 2-2" /></>,
  flame: <><path d="M18 2c2 10-7 10-3 17 3-2 4-4 4-7 7 5 11 16-2 18C0 31 3 17 8 12c0 6 3 6 3 6C9 9 16 8 18 2Z" fill="currentColor" fillOpacity=".16" /><path d="M16 23c-4 3-2 6 1 7" /></>,
  diamond: <><path d="m16 3 8 13-8 13-8-13Z" fill="currentColor" fillOpacity=".22" /><path d="m16 9 4 7-4 7-4-7Z" fill="currentColor" stroke="none" /></>,
  reel: <><rect x="3" y="3" width="26" height="26" rx="4" /><path d="M12 4v24M21 4v24M4 12h24M4 21h24" /><path d="m8 14 2 2-2 2-2-2Zm9 0 2 2-2 2-2-2Zm8 0 2 2-2 2-2-2Z" fill="currentColor" stroke="none" /></>,
  cards: <><path d="m8 6-5 2 5 22 16-4-1-4" /><rect x="10" y="2" width="18" height="24" rx="2" fill="currentColor" fillOpacity=".1" /><path d="m19 8 4 6-4 6-4-6Z" /></>,
  bag: <><path d="M10 10V7a6 6 0 0 1 12 0v3M6 10h20l2 19H4Z" fill="currentColor" fillOpacity=".1" /><path d="M5 17h22m-14 0v5h6v-5" /></>,
  log: <><path d="M8 4h17v24H8c-5 0-5-7 0-7h17M8 4C3 4 3 0 8 0" transform="translate(0 2)" /><path d="M11 10h9m-9 5h9M8 5v18" /></>,
  lock: <><rect x="6" y="13" width="20" height="16" rx="3" fill="currentColor" fillOpacity=".14" /><path d="M10 13V8a6 6 0 0 1 12 0v5M16 19v4" /></>,
  unlock: <><rect x="6" y="13" width="20" height="16" rx="3" fill="currentColor" fillOpacity=".08" /><path d="M10 13V8a6 6 0 0 1 11-3M16 19v4" /></>,
  arrow: <path d="M4 16h23M18 7l9 9-9 9" />,
  check: <path d="m6 16 7 7L27 8" />,
  end: <><path d="M8 3v27M9 5h16l-4 6 4 6H9" /><path d="M4 29h8" /></>,
  rotate: <><path d="M27 13A11 11 0 1 0 27 21M27 4v9h-9" /></>,
};

/** Decorative SVGs; their button or adjacent text provides the accessible name. */
export function BattleIcon({ name, className = "" }: { name: BattleIconName; className?: string }) {
  return <svg className={`battle-icon ${className}`} viewBox="0 0 32 32" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{artwork[name]}</svg>;
}

const skillArtwork: Record<string, BattleIconName> = {
  "life-recovery": "heal",
  "power-strike": "attack",
  "shield-block": "defense",
  "fire-imbue": "flame",
  "mana-armor": "star",
  "flame-cover": "flame",
  "shield-throw": "defense",
  "flame-impact": "flame",
  "shield-bash": "defense",
  "holy-shield": "defense",
};

export function skillIcon(id: string): BattleIconName {
  return skillArtwork[id] ?? "star";
}

/** Presentation only: the original condition still goes to the game engine. */
export function conditionLabel(value: string): string {
  return value.replace(/⚔️?/gu, "劍").replace(/🛡️?/gu, "盾")
    .replaceAll("✨", "星").replaceAll("🍀", "萬用").replaceAll("💀", "骷髏")
    .replaceAll("Σ", "合計 ").replaceAll(">=", "≥").replaceAll("&", "·");
}
