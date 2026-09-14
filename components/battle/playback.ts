import type { DamageRecord } from "../../game/model.ts";

export function playbackGroups(records: DamageRecord[]): DamageRecord[][] {
  const groups: DamageRecord[][] = [];
  for (const record of records) {
    const last = groups.at(-1);
    if (record.batchId !== undefined && last?.[0].batchId === record.batchId) last.push(record);
    else groups.push([record]);
  }
  return groups;
}
