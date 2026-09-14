import type { Catalog } from "../../game/model.ts";
import type { Adventure, AdventureCommand } from "../../game/adventure/model.ts";
import { Modal } from "../ui/Modal.tsx";
import { EncounterArt } from "./EncounterArt.tsx";
import { RewardCard } from "./RewardCard.tsx";

export function RewardModal({ state, catalog, onCommand, error }: { state: Adventure; catalog: Catalog; onCommand: (command: AdventureCommand) => void; error?: string }) {
  return <>
    <section className="journey-interlude"><EncounterArt label="通往遺跡深處的道路" /><div><p className="eyebrow">遺跡第 {state.depth} 層</p><h2>收起戰利品，繼續前行</h2></div></section>
    <Modal open={state.phase === "reward"} title="戰鬥勝利" eyebrow="VICTORY" className="reward-modal" error={error}>
      <div className="reward-banner"><EncounterArt id="ruins-ornate-chest" label="遺跡中的戰利品寶箱" /><div className="reward-haul"><span>獲得金幣</span><strong>+{state.rewardGold}</strong></div></div>
      <div className="reward-body">
        {state.advanceDepth && <p className="notice">Boss 已擊敗，生命完全恢復。準備前往下一層。</p>}
        <p className="reward-instruction">{state.rewards.length ? "選擇一項戰利品，帶上新的力量。" : "本次沒有物品掉落，前方還有更多寶藏。"}</p>
        <div className="skill-grid">{state.rewards.map((reward, index) => <RewardCard key={`${reward.type}-${reward.id}`} reward={reward} state={state} catalog={catalog} onChoose={() => onCommand({ type: "reward", index })} />)}</div>
        <button type="button" className={state.rewards.length ? "quiet reward-continue" : "primary reward-continue"} onClick={() => onCommand({ type: "reward", index: null })}>{state.rewards.length ? "放棄戰利品，繼續探索" : "繼續探索 →"}</button>
      </div>
    </Modal>
  </>;
}
