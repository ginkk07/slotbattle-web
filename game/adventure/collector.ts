import { Runtime } from "../runtime.ts";
import { weightedDraw } from "../random.ts";
import type { AdventureHost, EventOutcome } from "./model.ts";
import { rewardName, rewardPool } from "./rewards.ts";

export function beginCollector(host: AdventureHost, outcome: EventOutcome): void {
  const { state, catalog, rules } = host;
  const event = state.encounter!;
  const pool = rewardPool(state.player, catalog, rules, [outcome.rewardType!], "傳說", { newSkill: true, allowReplacement: true });
  if (!pool.length || !state.player.skills.length) { host.result(!pool.length ? "收藏家沒有能提供的新傳說獎勵。" : "目前沒有可作為賭注的技能。"); return; }
  const reward = weightedDraw(pool.map((item) => [item, 100]), host.random);
  event.collector = { attempt: 0, lockedIndex: null, wager: null, reels: [], reward };
  event.stage = "wager";
  event.text = `挑戰獎勵：${rewardName(reward, catalog)}。請選擇一項技能作為賭注；成功保留技能，失敗失去技能。`;
}

export function chooseWager(host: AdventureHost, id: string): void {
  const event = host.state.encounter!;
  if (event.stage !== "wager" || !host.state.player.skills.some((skill) => skill.id === id)) throw new Error("目前無法選擇此技能作為賭注");
  event.collector!.wager = id;
  event.stage = "spin";
  event.text = `已選擇${host.catalog.skills[id].name}。按下「開始轉動」進行第 1 次挑戰。`;
}

export function lockCollector(host: AdventureHost, index: number): void {
  const event = host.state.encounter!;
  const collector = event.collector;
  if (event.stage !== "spin" || !collector || collector.reels.length !== host.rules.collector.reels) throw new Error("第一次轉動後才可鎖格");
  if (host.rules.collector.maxLocks < 1 || !Number.isInteger(index) || index < 0 || index >= collector.reels.length) throw new Error("此格不能鎖定");
  collector.lockedIndex = collector.lockedIndex === index ? null : index;
  // This command intentionally leaves attempt, RNG and reels untouched.
}

export function spinCollector(host: AdventureHost): void {
  const { state, rules, catalog } = host;
  const event = state.encounter!;
  const collector = event.collector;
  if (event.stage !== "spin" || !collector?.wager || collector.attempt >= rules.collector.attempts) throw new Error("目前不能轉動");
  // The exploration snapshot supplies equipment weights only. Expired battle
  // statuses, spin equipment events, AP and the battle RNG never participate.
  const snapshot = structuredClone(state.battle!);
  const player = snapshot.units.find((unit) => unit.id === snapshot.playerId)!;
  player.equipment = [...state.player.equipment];
  player.statuses = [];
  const weights = new Runtime(snapshot, catalog).symbolWeights();
  collector.reels = Array.from({ length: rules.collector.reels }, (_, index) => index === collector.lockedIndex ? collector.reels[index] : weightedDraw(weights, host.random));
  collector.attempt++;
  const fixed = collector.reels.filter((symbol) => symbol !== "lucky");
  const win = !fixed.includes("skull") && new Set(fixed).size <= 1;
  if (win) {
    if (collector.reward.type === "skill" && state.player.skills.length >= rules.maxHeldSkills) {
      event.stage = "replace";
      event.reward = collector.reward;
      event.text = `挑戰成功！技能欄已滿，選擇要替換為「${rewardName(collector.reward, catalog)}」的技能。`;
    } else {
      host.grant(collector.reward);
      host.result(`挑戰成功！獲得${rewardName(collector.reward, catalog)}，並保留賭注技能。`);
    }
  } else if (collector.attempt === rules.collector.attempts) {
    state.player.skills = state.player.skills.filter((skill) => skill.id !== collector.wager);
    host.result(`${rules.collector.attempts} 次轉動皆未連線，失去${catalog.skills[collector.wager].name}。`);
  } else event.text = `第 ${collector.attempt}／${rules.collector.attempts} 次未連線。可鎖定一格，再轉動其餘格子。`;
}
