import { useState, type CSSProperties } from "react";
import type { Catalog } from "../../game/model.ts";
import type { AdventureRules, AdventureSetup as Settings } from "../../game/adventure/model.ts";

export function AdventureSetup({ catalog, rules, onStart, onSandbox }: { catalog: Catalog; rules: AdventureRules; onStart: (setup: Settings) => void; onSandbox: () => void }) {
  const [skills, setSkills] = useState([rules.starting.skills[1] ?? rules.starting.skills[0]].filter(Boolean));
  const [equipment, setEquipment] = useState(rules.starting.equipment.slice(0, 1));
  function select(ids: string[], id: string, limit: number): string[] { return ids.includes(id) ? ids.filter((entry) => entry !== id) : limit === 1 ? [id] : ids.length < limit ? [...ids, id] : ids; }
  return <section className="opening-screen">
    <div className="opening-hero"><div className="opening-rune" aria-hidden="true">✧</div><div className="opening-title"><p className="eyebrow">3 × 3 · 遺跡冒險</p><h2>轉動命運<br /><span>打出你的下一手</span></h2><p>一座遺跡，無數種可能。<br />帶著你的卡片，走得更遠。</p></div><div className="opening-character" aria-hidden="true"><span className="actor-idle"><span className="character-sprite" style={{ "--sprite-x": "0%", "--sprite-y": "0%", "--sprite-filter": "none", "--sprite-scale": 1 } as CSSProperties} /></span></div><div className="opening-symbols" aria-hidden="true"><span>⚔️</span><span>🛡️</span><span>✨</span></div></div>
    <div className="opening-loadout">
      <div className="loadout-heading"><div><p className="eyebrow">出發準備</p><h3>準備你的第一手</h3></div><div className="starting-resources"><span>♥ {rules.starting.hp}</span><span>❇️ {catalog.rules.baseAp} AP</span></div></div>
      <fieldset><legend>起始技能 <span>最多 {rules.starting.maxSkills} 項</span></legend><div className="option-grid">{rules.starting.skills.map((id) => <label key={id} className="choice"><input type="checkbox" name="starting-skill" checked={skills.includes(id)} disabled={rules.starting.maxSkills > 1 && skills.length >= rules.starting.maxSkills && !skills.includes(id)} onChange={() => setSkills(select(skills, id, rules.starting.maxSkills))} /><span><strong>{catalog.skills[id].name}</strong><b className="choice-condition">{catalog.skills[id].levels[0].condition}</b><small>{catalog.skills[id].levels[0].description}</small></span></label>)}</div></fieldset>
      <fieldset><legend>起始裝備 <span>最多 {rules.starting.maxEquipment} 項</span></legend><div className="option-grid">{rules.starting.equipment.map((id) => <label key={id} className="choice"><input type="checkbox" name="starting-equipment" checked={equipment.includes(id)} disabled={rules.starting.maxEquipment > 1 && equipment.length >= rules.starting.maxEquipment && !equipment.includes(id)} onChange={() => setEquipment(select(equipment, id, rules.starting.maxEquipment))} /><span><strong>{catalog.equipment[id].name}</strong><small>{catalog.equipment[id].description}</small></span></label>)}</div></fieldset>
      <details className="how-to-play"><summary>第一次冒險？查看玩法</summary><div className="quick-guide"><div><span>01</span><h3>拉霸與鎖欄</h3><p>初始盤面免費。鎖欄花 {catalog.rules.lockCost} AP，重轉花 {catalog.rules.spinCost} AP。重轉後維持鎖定。</p></div><div><span>02</span><h3>決定卡片用途</h3><p>出牌取得攻防，或消耗卡片使用技能。可以多次操作。</p></div><div><span>03</span><h3>留下下一手</h3><p>剩餘 AP 可保留卡片，結束回合時統一攻擊。</p></div></div></details>
      <div className="sandbox-link"><button type="button" className="quiet" onClick={onSandbox}>戰鬥測試配置 →</button><span className="muted">自由測試技能、裝備與多個敵人。</span></div>
    </div>
    <div className="opening-dock"><p>{skills.length ? skills.map((id) => catalog.skills[id].name).join("、") : "未選技能"}<span>＋</span>{equipment.length ? equipment.map((id) => catalog.equipment[id].name).join("、") : "未選裝備"}</p><button type="button" className="primary start-button" onClick={() => onStart({ seed: Date.now() >>> 0, skills, equipment })}>開始冒險 <span>→</span></button></div>
  </section>;
}
