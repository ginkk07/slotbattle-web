import { useState, type CSSProperties } from "react";
import type { Battle, Catalog, DamageRecord, Unit } from "../../game/model.ts";
import { enemyIntentDamage } from "../../game/battle.ts";
import { Modal } from "../ui/Modal.tsx";
import { battleArt, characterArt, damageNames } from "./presentation.ts";

function Combatant({ unit, state, catalog, hit, onInspect }: { unit: Unit; state: Battle; catalog: Catalog; hit: DamageRecord | null; onInspect: () => void }) {
  const player = unit.side === "player";
  const art = characterArt[player ? "player" : unit.definitionId ?? ""] ?? characterArt["ruins-sentinel"];
  const receiving = hit?.target === unit.id;
  const attacking = hit?.source === unit.id && hit.source !== hit.target;
  const style = {
    "--sprite-x": `${(art.cell % battleArt.columns) * 100 / (battleArt.columns - 1)}%`,
    "--sprite-y": `${Math.floor(art.cell / battleArt.columns) * 100 / (battleArt.rows - 1)}%`,
    "--sprite-filter": art.filter ?? "none", "--sprite-scale": art.scale ?? 1,
    "--direction": player ? 1 : -1,
  } as CSSProperties;
  return <button type="button" className={`combatant ${player ? "player" : "enemy"} ${unit.hp <= 0 ? "defeated" : ""}`} style={style} onClick={onInspect} aria-label={`${unit.name}，生命 ${unit.hp}/${unit.maxHp}，護甲 ${unit.armor}，查看狀態`}>
    <div className="unit-hud">
      <strong className="unit-name">{unit.name}</strong>
      <div className="hp-track" role="progressbar" aria-label={`${unit.name}生命`} aria-valuenow={unit.hp} aria-valuemin={0} aria-valuemax={unit.maxHp}><span style={{ width: `${100 * unit.hp / unit.maxHp}%` }} /></div>
      <span className="unit-numbers"><span>{unit.hp}<small>/{unit.maxHp}</small></span>{unit.armor > 0 && <span className="armor-number">🛡️ {unit.armor}</span>}</span>
      {!player && unit.hp > 0 && <span className="intent" title={catalog.enemySkills[unit.intent ?? ""]?.description}>{catalog.enemySkills[unit.intent ?? ""]?.name} <b>⚔️ {enemyIntentDamage(state, unit, catalog)}</b></span>}
    </div>
    <span key={`actor-${hit?.id ?? "idle"}`} className={`actor-motion ${receiving ? "is-hit" : attacking ? "is-attacking" : ""}`}>
      <span className="actor-idle"><span className={`character-sprite ${art.src ? "standalone-sprite" : ""}`} style={art.src ? { backgroundImage: `url("${art.src}")` } : undefined} /></span>
    </span>
    {receiving && <span key={`damage-${hit.id}`} className={`damage-popup damage-${hit.type}`}><b>{hit.hpDamage > 0 ? `−${hit.hpDamage}` : "抵擋"}</b>{hit.armorBlocked > 0 && <small>🛡️ −{hit.armorBlocked}</small>}</span>}
    {unit.statuses.length > 0 && <span className="unit-status-count">{unit.statuses.length} 個狀態</span>}
  </button>;
}
export function Arena({ state, catalog, hit, group, busy }: { state: Battle; catalog: Catalog; hit: DamageRecord | null; group: DamageRecord[]; busy: boolean }) {
  const [inspected, setInspected] = useState<string | null>(null);
  const unit = state.units.find((entry) => entry.id === inspected);
  return <><section className="arena" aria-label="戰鬥場景" style={{ backgroundImage: `url("${battleArt.background}")` }}>
    <div className="arena-caption"><span>回合 {String(state.round).padStart(2, "0")} · {busy ? "戰鬥進行中" : state.outcome ? "戰鬥結束" : "我方回合"}</span><span>{hit ? `${hit.label} · ${damageNames[hit.type]}傷害` : "點選單位查看狀態"}</span></div>
    <div className="formation">
      <div className="party">{state.units.filter((entry) => entry.side === "player").map((entry) => <Combatant key={entry.id} unit={entry} state={state} catalog={catalog} hit={group.find((record) => record.target === entry.id) ?? group.find((record) => record.source === entry.id) ?? null} onInspect={() => setInspected(entry.id)} />)}</div>
      <div className="enemies">{state.units.filter((entry) => entry.side === "enemy").map((entry) => <Combatant key={entry.id} unit={entry} state={state} catalog={catalog} hit={group.find((record) => record.target === entry.id) ?? group.find((record) => record.source === entry.id) ?? null} onInspect={() => setInspected(entry.id)} />)}</div>
    </div>
  </section>
    {unit && <Modal open title={unit.name} onClose={() => setInspected(null)} className="unit-status-modal">
      {unit.statuses.length > 0
        ? <ul className="unit-status-list" aria-label="目前狀態">{unit.statuses.map((status) => <li key={status.id}>{catalog.statuses[status.id].name}</li>)}</ul>
        : <p className="unit-status-empty">目前沒有狀態。</p>}
    </Modal>}
  </>;
}
