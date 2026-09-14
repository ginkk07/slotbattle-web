import { useState } from "react";
import type { BattleSetup, Catalog } from "../../game/model.ts";
export function Setup({ catalog, onStart }: { catalog: Catalog; onStart: (setup: BattleSetup) => void }) {
  const [enemyIds, setEnemyIds] = useState(["ruins-sentinel"]);
  const [equipmentIds, setEquipmentIds] = useState(["sword", "iron-shield"]);
  const [skillIds, setSkillIds] = useState(Object.keys(catalog.skills));
  const [level, setLevel] = useState(1); const [items, setItems] = useState(false);
  function toggle(list: string[], id: string): string[] { return list.includes(id) ? list.filter((item) => item !== id) : [...list, id]; }
  return <section className="setup panel"><div className="setup-heading"><div><p className="eyebrow">3 × 3 · 卡片戰鬥</p><h2>進入遺跡</h2><p className="muted">轉輪決定手牌。出牌累積攻防，消耗卡片使用技能。</p></div><button type="button" className="primary start-button" disabled={!enemyIds.length} onClick={() => onStart({ seed: Date.now() >>> 0, playerHp: 45, enemies: enemyIds, skills: skillIds.map((id) => ({ id, level })), equipment: equipmentIds, consumables: items ? Object.fromEntries(Object.keys(catalog.consumables).map((id) => [id, 1])) : {} })}>開始戰鬥 <span>→</span></button></div>
    <div className="setup-summary"><span>生命 <b>45</b></span><span>技能 <b>{skillIds.length}</b></span><span>裝備 <b>{equipmentIds.length}</b></span><span>敵人 <b>{enemyIds.length}</b></span></div>
    <details className="configuration" open><summary>調整戰鬥測試配置</summary><p className="muted">此配置用於獨立戰鬥測試。敵人依選取順序由左至右排列。</p>
      <fieldset><legend>敵方單位</legend><div className="option-grid">{Object.values(catalog.enemies).map((enemy) => <label key={enemy.id} className="choice"><input type="checkbox" checked={enemyIds.includes(enemy.id)} onChange={() => setEnemyIds(toggle(enemyIds, enemy.id))} /><span>{enemy.name}<small>{enemy.hp} HP · {enemy.tier}{enemy.draft ? " · 測試" : ""}</small></span></label>)}</div></fieldset>
      <fieldset><legend>攜帶技能</legend><label className="level-select">測試等級 <select value={level} onChange={(event) => setLevel(Number(event.target.value))}>{[1, 2, 3].map((value) => <option key={value} value={value}>Lv.{value}</option>)}</select></label><div className="option-grid">{Object.values(catalog.skills).map((skill) => <label key={skill.id} className="choice"><input type="checkbox" checked={skillIds.includes(skill.id)} onChange={() => setSkillIds(toggle(skillIds, skill.id))} /><span>{skill.name}<small>{skill.rarity}</small></span></label>)}</div></fieldset>
      <fieldset><legend>攜帶裝備</legend><div className="option-grid equipment-options">{Object.values(catalog.equipment).filter((item) => !item.tags?.includes("encounterOnly")).map((item) => <label key={item.id} className="choice" title={item.description}><input type="checkbox" checked={equipmentIds.includes(item.id)} onChange={() => setEquipmentIds(toggle(equipmentIds, item.id))} /><span>{item.name}<small>{item.description}</small></span></label>)}</div></fieldset><label className="choice"><input type="checkbox" checked={items} onChange={(event) => setItems(event.target.checked)} />帶入每種消耗品各 1 個</label>
    </details><div className="quick-guide"><div><span>01</span><h3>確認盤面</h3><p>免費拉霸，花 AP 鎖欄或重轉。</p></div><div><span>02</span><h3>決定卡片用途</h3><p>出牌獲得攻防，或用來使用技能。</p></div><div><span>03</span><h3>結束回合</h3><p>花剩餘 AP 保留手牌，統一結算戰鬥傷害。</p></div></div>
  </section>;
}
