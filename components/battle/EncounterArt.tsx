import type { CSSProperties } from "react";

/** Art can be replaced without changing an encounter's rules or outcomes. */
const encounterCells: Record<string, number> = {
  "ruins-mysterious-spring": 0,
  "ruins-sealed-vault": 1,
  "ruins-mysterious-shop": 2,
  "ruins-abandoned-camp": 3,
  "ruins-disordered-footprints": 4,
  "ruins-aged-explorer": 5,
  "ruins-ornate-chest": 6,
  "ruins-ancient-echo": 7,
  "ruins-treasure-blacksmith": 8,
  "ruins-adventurer-corpse": 9,
  "ruins-mysterious-collector": 10,
};
export function EncounterArt({ id, label, className = "" }: { id?: string; label: string; className?: string }) {
  const cell = encounterCells[id ?? ""] ?? 11;
  const style = { "--art-x": `${cell % 3 * 50}%`, "--art-y": `${Math.floor(cell / 3) * 100 / 3}%` } as CSSProperties;
  return <div className={`encounter-art ${className}`} role="img" aria-label={label} style={style}><div className="encounter-art-tile" /></div>;
}
