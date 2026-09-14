import source from "./source-sheet.json" with { type: "json" };
import type { AdventureRules, Rank } from "../adventure/model.ts";
import { events } from "./events.ts";

// Exploration numbers are inherited from ROBOT-slotbattle's regions, loot,
// progression and shop catalogs. Battle content comes from the revised sheet.
const ranks: Record<string, Rank> = { 普通: "normal", 菁英: "elite", Boss: "boss" };
export const adventureRules: AdventureRules = {
  region: { id: "ruins", name: "遺跡", eventChance: 0.2, eliteChance: 0.12, bossMinimum: 8, bossChancePerProgress: 0.05, hpPerDepth: 0.5, attackPerDepth: 0.5, healAfterBoss: true },
  eventRarity: { 普通: 60, 稀有: 30, 傳說: 10 },
  starting: { hp: 45, skills: ["life-recovery", "power-strike", "fire-imbue"], equipment: ["sword", "lucky-clover", "shuriken"], maxSkills: 1, maxEquipment: 1 },
  maxHeldSkills: 3,
  encounters: source.sheets.怪物.values.slice(1).filter((row) => row[3] === "已實裝").map((row) => ({ id: row[2], rank: ranks[row[4]], weight: Number(row[9]) || 0, lootTable: row[11].replace(/（.*$/, "") })),
  loot: {
    "ruins-common-loot": { choices: 3, dropChance: 0.25, types: ["equipment"], weights: { 普通: 90, 稀有: 10, 傳說: 0 }, gold: [10, 20] },
    "ruins-elite-loot": { choices: 3, dropChance: 0.5, types: ["equipment", "skill"], weights: { 普通: 70, 稀有: 29, 傳說: 1 }, gold: [15, 30] },
    "ruins-boss-loot": { choices: 3, dropChance: 1, types: ["equipment", "skill"], weights: { 普通: 0, 稀有: 50, 傳說: 50 }, gold: [60, 80] },
    "ruins-ornate-chest-item": { choices: 1, dropChance: 1, types: ["equipment", "consumable"], weights: { 普通: 70, 稀有: 29, 傳說: 1 }, gold: [0, 0] },
    "ruins-ornate-chest-skill": { choices: 1, dropChance: 1, types: ["skill"], weights: { 普通: 70, 稀有: 29, 傳說: 1 }, gold: [0, 0] },
  },
  shop: { choices: 3, weights: { 普通: 90, 稀有: 9, 傳說: 1 }, basePrice: 38, depthMultiplier: 1.66, purchaseMultiplier: 1.77 },
  weaponUpgrades: { sword: "reinforced-longsword", shuriken: "reinforced-shuriken", "knight-hammer": "reinforced-knight-hammer", crossbow: "reinforced-crossbow" },
  collector: { attempts: 4, reels: 3, maxLocks: 1 },
  events,
};
