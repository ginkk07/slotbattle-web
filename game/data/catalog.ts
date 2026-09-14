import type { Catalog } from "../model.ts";
import { skills } from "./skills.ts";
import { equipment } from "./equipment.ts";
import { statuses } from "./statuses.ts";
import { enemies, enemySkills } from "./enemies.ts";
import { consumables } from "./consumables.ts";
import { rules } from "./rules.ts";

export const catalog: Catalog = { rules, skills, equipment, statuses, enemies, enemySkills, consumables };
