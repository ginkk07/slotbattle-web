import { useEffect, useRef, useState } from "react";
import type { Battle, DamageRecord } from "../../game/model.ts";
import { playbackGroups } from "./playback.ts";

/** Replay committed hits, without timers or UI state inside the combat engine. */
export function useBattlePlayback(state: Battle) {
  const previous = useRef(state);
  const [scene, setScene] = useState(state);
  const [hit, setHit] = useState<DamageRecord | null>(null);
  const [group, setGroup] = useState<DamageRecord[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    const lastId = before.damage.at(-1)?.id ?? -1;
    const hits = state.damage.filter((entry) => entry.id > lastId);
    if (!hits.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setScene(state); setHit(null); setGroup([]); setBusy(false); return;
    }
    setBusy(true);
    const groups = playbackGroups(hits);
    const interval = Math.max(90, Math.min(440, 3200 / groups.length));
    let index = 0;
    let timer: ReturnType<typeof setTimeout>;
    function step() {
      const current = groups[index++];
      const record = current?.[0];
      if (!record) { setScene(state); setHit(null); setGroup([]); setBusy(false); return; }
      setGroup(current);
      setHit(record);
      setScene({ ...before, units: before.units.map((unit) => ({ ...unit, ...record.scene?.find((snapshot) => snapshot.id === unit.id) })) });
      timer = setTimeout(step, interval);
    }
    step();
    return () => clearTimeout(timer);
  }, [state]);
  return { scene, hit, group, busy };
}
