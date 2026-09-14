import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Battle, Catalog, Command } from "../../game/model.ts";
import { BattleIcon } from "./BattleIcon.tsx";
export function SlotBoard({ state, catalog, onCommand, disabled = false }: { state: Battle; catalog: Catalog; onCommand: (command: Command) => void; disabled?: boolean }) {
  const [spinning, setSpinning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { rules } = catalog;
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function spin() {
    if (spinning || disabled || state.ap < rules.spinCost) return;
    onCommand({ type: "spin" });
    setSpinning(true);
    timer.current = setTimeout(() => setSpinning(false), 600);
  }
  return <section className="board-panel" aria-label="拉霸盤面">
    <div className="section-heading"><h2>九格轉輪</h2><span>鎖定喜歡的一欄</span></div>
    <div className="reel-machine">
      <div className="column-controls">{Array.from({ length: rules.columns }, (_, column) => {
        const locked = state.locked.includes(column);
        return <button key={column} type="button" aria-label={`${locked ? "解鎖" : "鎖定"}第 ${column + 1} 欄`} aria-pressed={locked} disabled={disabled || spinning || (!locked && (state.ap < rules.lockCost || state.locked.length >= rules.columns - 1))} onClick={() => onCommand({ type: "lock", column })}><BattleIcon name={locked ? "lock" : "unlock"} /><span>{locked ? "已鎖定" : `鎖欄 · ${rules.lockCost} AP`}</span></button>;
      })}</div>
      <div className="slot-grid">{state.board.map((symbol, index) => <div key={index} className={`slot-cell symbol-${symbol} ${state.locked.includes(index % rules.columns) ? "locked" : spinning ? "spinning" : ""}`} title={rules.symbols[symbol].label} style={{ "--reel-delay": `${(index % rules.columns) * 45}ms` } as CSSProperties}><span><BattleIcon name={symbol} /></span></div>)}</div>
    </div>
    <p className="board-caption">{state.retained.length > 0 ? `已有 ${state.retained.length} 張保留卡片，確認後一起加入手牌。` : "確認盤面，取得 8 張卡片。"}</p>
    <div className="board-actions"><button type="button" disabled={disabled || spinning || state.ap < rules.spinCost} onClick={spin}><BattleIcon name="rotate" />{spinning ? "轉動中…" : "重轉"} <small>−{rules.spinCost} AP</small></button><button type="button" className="primary" disabled={disabled || spinning} onClick={() => onCommand({ type: "confirmBoard" })}>確認盤面<BattleIcon name="arrow" /></button></div>
  </section>;
}
