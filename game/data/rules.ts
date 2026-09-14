import type { Rules } from "../model.ts";

export const rules: Rules = {
  symbols: {
    attack: { icon: "⚔️", label: "劍", weight: 30 },
    defense: { icon: "🛡️", label: "盾", weight: 30 },
    star: { icon: "✨", label: "星", weight: 30 },
    lucky: { icon: "🍀", label: "萬用", weight: 5 },
    skull: { icon: "💀", label: "骷髏", weight: 5 },
  },
  lines: [
    { name: "橫線 1", cells: [0, 1, 2] }, { name: "橫線 2", cells: [3, 4, 5] }, { name: "橫線 3", cells: [6, 7, 8] },
    { name: "直線 1", cells: [0, 3, 6] }, { name: "直線 2", cells: [1, 4, 7] }, { name: "直線 3", cells: [2, 5, 8] },
    { name: "斜線 ↘", cells: [0, 4, 8] }, { name: "斜線 ↙", cells: [2, 4, 6] },
  ],
  combo: [0, 1, 3, 9], boardSize: 9, columns: 3, baseAp: 3,
  lockCost: 1, spinCost: 1, retainCost: 1, minimumWeight: 1, logLimit: 120,
  damage: {
    battle: { armor: true, generalReduction: true, enabled: true, pipeline: ["armor", "percent", "fixed", "special"] },
    extra: { armor: true, generalReduction: true, enabled: true, pipeline: ["armor", "percent", "fixed", "special"] },
    burn: { armor: true, generalReduction: true, enabled: true, pipeline: ["armor", "percent", "fixed", "special"] },
    reflection: { armor: true, generalReduction: false, enabled: true, pipeline: ["percent", "fixed", "special", "armor"] },
    curse: { armor: false, generalReduction: false, enabled: true, pipeline: ["armor", "percent", "fixed", "special"] },
    poison: { armor: true, generalReduction: true, enabled: false, pipeline: ["armor", "percent", "fixed", "special"] },
  },
};
