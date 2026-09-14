import type { Adventure } from "../../game/adventure/model.ts";
import { EncounterArt } from "./EncounterArt.tsx";

export function RunEndScreen({ state, onRestart }: { state: Adventure; onRestart: () => void }) {
  return <section className="run-end" aria-labelledby="run-end-title">
    <div className="run-end-art"><EncounterArt label="曙光照進寂靜的遺跡" /><div className="run-end-heading"><p className="eyebrow">JOURNEY ENDS</p><h2 id="run-end-title">冒險暫告一段落</h2><p>每一手選擇，都留下了足跡。</p></div></div>
    <div className="run-end-summary"><span className="eyebrow">本次抵達</span><div className="depth-medallion"><span>遺跡</span><strong>{String(state.depth).padStart(2, "0")}</strong><span>層</span></div><dl className="journey-stats"><div><dt>擊敗魔物</dt><dd>{state.victories}</dd></div><div><dt>擊敗 Boss</dt><dd>{state.bosses}</dd></div><div><dt>持有金幣</dt><dd>{state.player.gold}</dd></div></dl><button type="button" className="primary start-button" onClick={onRestart}>重新出發 <span>→</span></button><p className="muted">重新挑選技能與裝備，開始下一次冒險。</p></div>
  </section>;
}
