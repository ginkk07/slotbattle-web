"use client";
import { useState } from "react";
import type { Battle, Catalog, Command } from "../../game/model.ts";
import { cardScore, isCursed } from "../../game/cards.ts";
import { meetsCondition } from "../../game/conditions.ts";
import { Arena } from "./Arena.tsx";
import { SlotBoard } from "./SlotBoard.tsx";
import { Hand } from "./Hand.tsx";
import { CombatLog } from "./CombatLog.tsx";
import { useBattlePlayback } from "./useBattlePlayback.ts";
import { Modal } from "../ui/Modal.tsx";
import { BattleIcon, conditionLabel, skillIcon } from "./BattleIcon.tsx";
import "./battle-ui.css";

type Panel = "action" | "bag" | "log";
export function BattleView({ state, catalog, onCommand, onComplete, completionLabel = "再戰一場", error }: { state: Battle; catalog: Catalog; onCommand: (command: Command) => string | undefined; onComplete: () => void; completionLabel?: string; error?: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [skillId, setSkillId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("action");
  const [slotsOpen, setSlotsOpen] = useState(state.phase === "slots");
  const [previousPhase, setPreviousPhase] = useState({ phase: state.phase, round: state.round });
  if (previousPhase.phase !== state.phase || previousPhase.round !== state.round) {
    setPreviousPhase({ phase: state.phase, round: state.round });
    setSlotsOpen(state.phase === "slots");
    if (state.phase === "slots") { setPanel("action"); setSelected([]); setSkillId(null); }
  }
  const { scene, hit, group, busy } = useBattlePlayback(state);
  const player = state.units.find((unit) => unit.id === state.playerId)!;
  const visiblePlayer = scene.units.find((unit) => unit.id === state.playerId)!;
  const ownedSkill = player.skills.find((skill) => skill.id === skillId);
  const skill = skillId ? catalog.skills[skillId] : null;
  const level = skill && ownedSkill ? skill.levels[ownedSkill.level - 1] : null;
  const selectedCards = state.hand.filter((card) => selected.includes(card.id));
  const canUseSkill = !!level && meetsCondition(selectedCards, level.condition);
  const immobilized = player.statuses.some((status) => catalog.statuses[status.id].modifiers?.some((modifier) => modifier.kind === "skipAction"));
  const skullBoost = player.equipment.some((id) => catalog.equipment[id].modifiers?.some((modifier) => modifier.kind === "skullBoost"));
  const preview = selectedCards.reduce((total, card) => { const score = cardScore(card, catalog.rules, skullBoost); return { attack: total.attack + score.attack, armor: total.armor + score.armor }; }, { attack: 0, armor: 0 });
  const retain = state.phase === "retain";
  const locked = busy || !!state.outcome;
  function command(action: Command) {
    if (busy) return;
    const problem = onCommand(action);
    if (!problem) { setSelected([]); setSkillId(null); }
  }
  function toggleCard(id: string) { setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); }
  function selectSkill(id: string | null) { setSkillId(id); setSelected([]); }

  return <div className="battle-screen" aria-busy={busy}>
    <Arena state={scene} catalog={catalog} hit={hit} group={group} busy={busy} />
    <div className="player-resource-bar" role="group" aria-label="玩家資源">
      <div className="resource-hp">
        <span className="resource-label"><BattleIcon name="heart" />生命</span>
        <strong>{visiblePlayer.hp}<small> / {visiblePlayer.maxHp}</small></strong>
        <div className="hp-track" aria-hidden="true"><span style={{ width: `${100 * visiblePlayer.hp / visiblePlayer.maxHp}%` }} /></div>
      </div>
      <div className="pool-resource">
        <span className="resource-label"><BattleIcon name="attack" />戰鬥傷害</span>
        <strong key={visiblePlayer.pool} className="number-change">{visiblePlayer.pool}</strong>
      </div>
      <div className="armor-resource">
        <span className="resource-label"><BattleIcon name="defense" />護甲</span>
        <strong key={visiblePlayer.armor} className="number-change">{visiblePlayer.armor}</strong>
      </div>
      <div className="ap-resource">
        <span className="resource-label"><BattleIcon name="diamond" />行動點</span>
        <strong>{scene.ap}<small> / {scene.apCapacity}</small></strong>
        <span className="ap-pips" aria-hidden="true">{Array.from({ length: scene.apCapacity }, (_, index) => <i key={index} className={index < scene.ap ? "filled" : ""} />)}</span>
      </div>
    </div>
    <nav className="battle-nav" aria-label="戰鬥操作面板">
      <button type="button" className={panel === "action" ? "active" : ""} aria-pressed={panel === "action"} onClick={() => setPanel("action")}><BattleIcon name={state.phase === "slots" ? "reel" : "cards"} />{state.outcome ? "戰鬥結果" : state.phase === "slots" ? "拉霸" : retain ? "保留卡片" : "手牌與技能"}</button>
      <button type="button" className={panel === "bag" ? "active" : ""} aria-pressed={panel === "bag"} onClick={() => setPanel("bag")}><BattleIcon name="bag" />背包</button>
      <button type="button" className={panel === "log" ? "active" : ""} aria-pressed={panel === "log"} onClick={() => setPanel("log")}><BattleIcon name="log" />紀錄</button>
    </nav>
    <div className="battle-controls">
      {busy ? <section className="battle-result"><span className="result-sigil"><BattleIcon name="attack" /></span><p>回合 {scene.round}</p><h2>{state.round !== scene.round || state.outcome ? "回合結算" : "效果結算"}</h2><p>{hit?.label}</p></section> : state.outcome && panel === "action" ? <section className="battle-result" role="status"><span className="result-sigil"><BattleIcon name={state.outcome === "victory" ? "star" : "diamond"} /></span><p>戰鬥結束</p><h2>{state.outcome === "victory" ? "勝利" : state.outcome === "draw" ? "雙方全滅" : "冒險暫告一段落"}</h2><button type="button" className="primary" onClick={onComplete}>{completionLabel}</button></section> :
      panel === "log" ? <CombatLog state={state} /> :
      panel === "bag" ? <section className="bag-panel"><div className="section-heading"><h2>消耗品</h2><span>{Object.values(state.inventory).reduce((a, b) => a + b, 0)} 件</span></div><div className="consumable-list">{Object.entries(state.inventory).filter(([, count]) => count > 0).map(([id, count]) => <div className="consumable-item" key={id}><div><strong>{catalog.consumables[id].name} ×{count}</strong><p>{catalog.consumables[id].description}</p></div><button type="button" disabled={locked || state.phase !== "cards" || immobilized} onClick={() => command({ type: "consumable", itemId: id })}>使用</button></div>)}</div>{!Object.values(state.inventory).some((count) => count > 0) && <p className="muted">沒有消耗品。</p>}<h2 className="bag-heading">裝備</h2><div className="equipment-list">{player.equipment.map((id) => <details key={id}><summary>{catalog.equipment[id].name}</summary><p>{catalog.equipment[id].description}</p></details>)}{!player.equipment.length && <p className="muted">未攜帶裝備。</p>}</div></section> :
      state.phase === "slots" ? <section className="slot-entry"><div className="mini-board" aria-hidden="true">{state.board.map((symbol, index) => <span key={index}><BattleIcon name={symbol} /></span>)}</div><p className="eyebrow">拉霸階段</p><h2>準備這回合的卡片</h2><p>查看敵人的行動，決定要不要重轉。</p><button type="button" className="primary" onClick={() => setSlotsOpen(true)}>打開拉霸 <BattleIcon name="arrow" /></button><small>剩餘 {state.ap} AP · 確認盤面後進入出牌階段</small></section> :
      <section className="decision-panel">
        {!retain && <div className="skill-tray" aria-label="選擇技能">{player.skills.map((owned) => {
          const definition = catalog.skills[owned.id];
          const current = definition.levels[owned.level - 1];
          const sealed = state.sealedSkills.includes(owned.id);
          const icon = skillIcon(owned.id);
          return <button
            type="button"
            className={`skill-tile skill-${icon} rarity-${definition.rarity} ${skillId === owned.id ? "active" : ""}`}
            aria-pressed={skillId === owned.id}
            aria-label={`${definition.name}，等級 ${owned.level}，${conditionLabel(current.condition)}${sealed ? "，已封印" : ""}`}
            title={current.description}
            disabled={locked || state.phase !== "cards" || immobilized || sealed}
            key={owned.id}
            onClick={() => selectSkill(skillId === owned.id ? null : owned.id)}
          >
            <span className="skill-medallion" aria-hidden="true">
              <BattleIcon name={icon} />
              <span className="skill-level">{sealed ? <BattleIcon name="lock" /> : owned.level}</span>
            </span>
            <span className="skill-name">{definition.name}</span>
            <span className="skill-condition">{sealed ? "已封印" : conditionLabel(current.condition)}</span>
          </button>;
        })}{!player.skills.length && <span className="muted skill-empty">尚未持有技能</span>}</div>}
        {level && !retain && <div className="material-hint"><div><strong>{skill?.name}</strong><button type="button" className="quiet" onClick={() => selectSkill(null)}>取消</button></div><p>{level.description}</p><span className={canUseSkill ? "condition-met" : "muted"}>{canUseSkill ? "✓ 條件達成" : `選擇卡片 · ${conditionLabel(level.condition)}`}</span></div>}
        {retain && <p className="notice">選擇要留到下一回合的卡片。每張花費 {catalog.rules.retainCost} AP。</p>}
        {immobilized && <p className="notice">目前無法行動，仍可保留卡片與結束回合。</p>}
        <div className="hand-heading"><h2>{retain ? "保留卡片" : "手牌"}</h2><span>{retain ? `${selected.length} / ${Math.floor(state.ap / catalog.rules.retainCost)} 張` : `已選 ${selected.length} 張`}</span><button type="button" className="quiet" disabled={locked || (immobilized && !retain)} onClick={() => selected.length ? setSelected([]) : setSelected(state.hand.filter((card) => !isCursed(card) && (!retain || card.expiresAt === undefined || card.expiresAt > state.round)).map((card) => card.id))}>{selected.length ? "取消全選" : "全選"}</button></div>
        {state.hand.length ? <Hand cards={state.hand} selected={selected} catalog={catalog} onToggle={toggleCard} disabled={locked || (immobilized && !retain)} material={!!skill && !retain} skullBoost={skullBoost} retainingRound={retain ? state.round : undefined} /> : <div className="empty-hand"><span><BattleIcon name="cards" /></span><p>手牌已用完</p><small>結束回合，發動戰鬥攻擊。</small></div>}
      </section>}
    </div>
    {!state.outcome && panel === "action" && state.phase !== "slots" && <div className="action-dock">
      {busy ? <p className="resolving-label" role="status">戰鬥結算中…</p> : retain ? <>
        <button type="button" onClick={() => command({ type: "cancelEnd" })}><BattleIcon name="arrow" className="back-icon" />返回</button>
        <button type="button" className="primary" disabled={selected.length * catalog.rules.retainCost > state.ap} onClick={() => command({ type: "end", cardIds: selected })}>{selected.length ? `保留 ${selected.length} 張並攻擊` : "不保留，發動攻擊"}<BattleIcon name="arrow" /></button>
      </> : <>
        <div className="selection-preview" aria-live="polite" aria-atomic="true">
          <span>已選 <strong>{selected.length}</strong> 張</span>
          {skill ? <span className={canUseSkill ? "condition-met" : "selection-condition"}>{canUseSkill ? "條件達成 · 可施放" : "請選擇技能素材"}</span> : <b>
            <span><BattleIcon name="attack" />+{preview.attack}</span>
            <span><BattleIcon name="defense" />+{preview.armor}</span>
          </b>}
        </div>
        <div className="main-actions">
          <button type="button" className="end-turn" onClick={() => command({ type: "beginEnd" })}><BattleIcon name="end" />結束回合</button>
          <button type="button" className="primary" disabled={immobilized || (skill ? !canUseSkill : !selected.length)} onClick={() => command(skill ? { type: "skill", skillId: skill.id, cardIds: selected } : { type: "play", cardIds: selected })}>
            <BattleIcon name={skill ? skillIcon(skill.id) : "cards"} />{skill ? "使用技能" : `出牌${selected.length ? ` · ${selected.length}` : ""}`}<BattleIcon name="arrow" />
          </button>
        </div>
      </>}
    </div>}
    {busy && (state.phase === "slots" || !!state.outcome) && <div className="playback-status" role="status">戰鬥結算中…</div>}
    <Modal open={slotsOpen && state.phase === "slots" && !locked} title="命運轉輪" eyebrow={`回合 ${String(state.round).padStart(2, "0")} · 拉霸階段`} onClose={() => setSlotsOpen(false)} className="reels-modal" error={error}>
      <div className="modal-resource"><span>行動點數</span><strong><BattleIcon name="diamond" />{state.ap}<small> / {state.apCapacity} AP</small></strong></div>
      <SlotBoard state={state} catalog={catalog} onCommand={command} disabled={locked || state.phase !== "slots"} />
      <p className="modal-footnote">鎖欄與重轉各自花費 AP。重轉後，鎖定仍會保留。</p>
    </Modal>
  </div>;
}
