import type { Catalog } from "../model.ts";
import type { AdventureCommand, AdventureRules, AdventureSetup } from "./model.ts";
import { createAdventure, dispatchAdventure } from "./engine.ts";

// Store a validated command journal rather than trusting imported battle state.
// Storage adapters may persist the same JSON in a browser, file or future API.
export const saveKey = "slotbattle.adventure.v1";
export type Save = { version: 1; revision: "cards-2026-09-12"; setup: AdventureSetup; commands: AdventureCommand[] };
export const newSave = (setup: AdventureSetup): Save => ({ version: 1, revision: "cards-2026-09-12", setup: structuredClone(setup), commands: [] });

export function restoreAdventure(raw: string, catalog: Catalog, rules: AdventureRules) {
  if (raw.length > 2_000_000) throw new Error("存檔過大，無法載入");
  const parsed = JSON.parse(raw) as Save;
  if (parsed?.version !== 1 || parsed.revision !== "cards-2026-09-12" || !parsed.setup || !Array.isArray(parsed.setup.skills) || !Array.isArray(parsed.setup.equipment) || !Array.isArray(parsed.commands)) throw new Error("存檔版本或格式不相容");
  let state = createAdventure(parsed.setup, catalog, rules);
  const commands = new Set(["battle", "settleBattle", "reward", "continue", "option", "eventSkill", "forge", "vault", "buy", "leave", "search", "collectorLock", "collectorSpin"]);
  const battleCommands = new Set(["lock", "spin", "confirmBoard", "play", "skill", "consumable", "beginEnd", "cancelEnd", "end"]);
  for (const command of parsed.commands) {
    if (!command || !commands.has(command.type) || (command.type === "battle" && !battleCommands.has(command.command?.type))) throw new Error("存檔包含無效操作");
    const result = dispatchAdventure(state, command, catalog, rules);
    if (result.error) throw new Error(`存檔無法重播：${result.error}`);
    state = result.state;
  }
  return { state, save: parsed };
}
