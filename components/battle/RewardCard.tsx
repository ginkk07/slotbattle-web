import type { Catalog } from "../../game/model.ts";
import type { Adventure, Reward } from "../../game/adventure/model.ts";
import { rewardName } from "../../game/adventure/rewards.ts";

export function RewardCard({ reward, state, catalog, onChoose, disabled = false, action }: {
  reward: Reward; state: Adventure; catalog: Catalog; onChoose: () => void; disabled?: boolean; action?: string;
}) {
  const definition = reward.type === "skill" ? catalog.skills[reward.id] : reward.type === "equipment" ? catalog.equipment[reward.id] : catalog.consumables[reward.id];
  const owned = state.player.skills.find((skill) => skill.id === reward.id);
  const nextLevel = reward.type === "skill" ? catalog.skills[reward.id].levels[owned?.level ?? 0] : undefined;
  const kind = reward.type === "skill" ? "技能" : reward.type === "equipment" ? "裝備" : "消耗品";
  return <button type="button" className={`skill-card reward-card rarity-${reward.rarity}`} disabled={disabled} onClick={onChoose}>
    <span className="reward-icon" aria-hidden="true">{reward.type === "skill" ? "✨" : reward.type === "equipment" ? "⚔️" : "✚"}</span>
    <span className="reward-content"><span className="skill-title"><strong>{rewardName(reward, catalog, state.player)}</strong><span>{reward.rarity} · {kind}</span></span>{nextLevel && <b className="condition">{nextLevel.condition}</b>}<span className="reward-description">{nextLevel?.description ?? definition.description}</span><b className="reward-action">{action ?? "選擇這項獎勵"} <span aria-hidden="true">→</span></b></span>
  </button>;
}
