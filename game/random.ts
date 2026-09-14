/** RNG is carried in state, so command replays and tests are deterministic. */
export function random(state: { rng: number }): number {
  state.rng = (Math.imul(1664525, state.rng) + 1013904223) >>> 0;
  return state.rng / 4294967296;
}

export function weightedDraw<T>(entries: [T, number][], next: () => number): T {
  if (!entries.length || entries.some(([, weight]) => !Number.isFinite(weight) || weight <= 0)) throw new Error("權重必須是大於 0 的有限值");
  const sum = entries.reduce((total, [, weight]) => total + weight, 0);
  const cursor = next() * sum;
  let cumulative = 0;
  for (const [value, weight] of entries) {
    cumulative += weight;
    if (cursor < cumulative) return value;
  }
  return entries[entries.length - 1][0];
}
