import { useState, type CSSProperties } from "react";
import type { Catalog } from "../../game/model.ts";
import type { AdventureRules, AdventureSetup as Settings } from "../../game/adventure/model.ts";
import { Modal } from "../ui/Modal.tsx";
import { BattleIcon, conditionLabel, skillIcon, type BattleIconName } from "./BattleIcon.tsx";
import { cardArt, characterArt, hudTheme } from "./presentation.ts";
import "./adventure-title.css";

export function AdventureSetup({ catalog, rules, onStart, onSandbox }: { catalog: Catalog; rules: AdventureRules; onStart: (setup: Settings) => void; onSandbox: () => void }) {
  const [skills, setSkills] = useState([rules.starting.skills[1] ?? rules.starting.skills[0]].filter(Boolean));
  const [equipment, setEquipment] = useState(rules.starting.equipment.slice(0, 1));
  const [menu, setMenu] = useState<"preparation" | "guide" | null>(null);
  function select(ids: string[], id: string, limit: number): string[] { return ids.includes(id) ? ids.filter((entry) => entry !== id) : limit === 1 ? [id] : ids.length < limit ? [...ids, id] : ids; }
  const equipmentIcon = (id: string): BattleIconName => id === "lucky-clover" ? "lucky" : id === "shuriken" ? "star" : "attack";

  return <section className="title-screen" aria-label="遊戲標題畫面" style={hudTheme as CSSProperties}>
    <div className="title-scenery" aria-hidden="true"><span className="title-mote mote-one" /><span className="title-mote mote-two" /><span className="title-mote mote-three" /><span className="title-mote mote-four" /></div>
    <div className="title-frame" aria-hidden="true" />
    <header className="title-masthead"><p className="title-chapter">遺跡冒險</p><h2 aria-label="SLOT BATTLE 拉霸戰鬥"><span>SLOT</span><strong>BATTLE</strong></h2><p className="title-name">拉霸戰鬥</p><div className="title-divider" aria-hidden="true"><span />◆<span /></div></header>
    <div className="title-party" aria-hidden="true">
      <div className="title-ground" />
      <img className="title-enemy" src={characterArt["ruins-sentinel"].src} alt="" draggable={false} />
      <img className="title-knight" src={characterArt.player.src} alt="" draggable={false} />
      <div className="title-card-emblem">{(["attack", "defense", "star"] as const).map((symbol) => <span key={symbol}><img className="emblem-card" src={cardArt.base} alt="" draggable={false} /><img className="emblem-symbol" src={cardArt.symbols[symbol]} alt="" draggable={false} /></span>)}</div>
    </div>
    <nav className="title-menu" aria-label="遊戲主選單">
      <button type="button" className="primary title-start" onClick={() => onStart({ seed: Date.now() >>> 0, skills, equipment })}><span className="menu-diamond" aria-hidden="true">◆</span>開始冒險<span className="menu-diamond" aria-hidden="true">◆</span></button>
      <p className="title-loadout">{skills.length ? skills.map((id) => catalog.skills[id].name).join("、") : "未攜帶技能"}<span>·</span>{equipment.length ? equipment.map((id) => catalog.equipment[id].name).join("、") : "未攜帶裝備"}</p>
      <button type="button" className="title-option" onClick={() => setMenu("preparation")}>出發準備</button>
      <button type="button" className="title-option" onClick={() => setMenu("guide")}>遊戲說明</button>
    </nav>
    <footer className="title-footer"><p>3 × 3 卡片戰鬥</p><button type="button" className="quiet" onClick={onSandbox}>戰鬥測試</button></footer>

    <Modal open={menu === "preparation"} title="出發準備" eyebrow="選擇你的起始技能與裝備" onClose={() => setMenu(null)} className="title-modal preparation-modal">
      <div className="title-modal-body">
        <div className="preparation-resources"><span><BattleIcon name="heart" />生命 {rules.starting.hp}</span><span><BattleIcon name="ap" />{catalog.rules.baseAp} AP</span></div>
        <section className="preparation-section" aria-label="起始技能"><div className="preparation-heading"><h3>起始技能</h3><span>最多 {rules.starting.maxSkills} 項</span></div><div className="preparation-options">{rules.starting.skills.map((id) => {
          const definition = catalog.skills[id], level = definition.levels[0];
          return <button key={id} type="button" className={`preparation-choice ${skills.includes(id) ? "chosen" : ""}`} aria-pressed={skills.includes(id)} aria-label={`${definition.name}，${conditionLabel(level.condition)}`} title={level.description} disabled={rules.starting.maxSkills > 1 && skills.length >= rules.starting.maxSkills && !skills.includes(id)} onClick={() => setSkills(select(skills, id, rules.starting.maxSkills))}><span className="preparation-emblem"><BattleIcon name={skillIcon(id)} variant="skill" /></span><strong>{definition.name}</strong><small>{conditionLabel(level.condition)}</small></button>;
        })}</div><p className="preparation-description">{skills.length ? skills.map((id) => catalog.skills[id].levels[0].description).join(" ") : "選擇一項技能，或直接出發。"}</p></section>
        <section className="preparation-section" aria-label="起始裝備"><div className="preparation-heading"><h3>起始裝備</h3><span>最多 {rules.starting.maxEquipment} 項</span></div><div className="preparation-options">{rules.starting.equipment.map((id) => <button key={id} type="button" className={`preparation-choice ${equipment.includes(id) ? "chosen" : ""}`} aria-pressed={equipment.includes(id)} aria-label={catalog.equipment[id].name} title={catalog.equipment[id].description} disabled={rules.starting.maxEquipment > 1 && equipment.length >= rules.starting.maxEquipment && !equipment.includes(id)} onClick={() => setEquipment(select(equipment, id, rules.starting.maxEquipment))}><span className="preparation-emblem"><BattleIcon name={equipmentIcon(id)} variant="card" /></span><strong>{catalog.equipment[id].name}</strong></button>)}</div><p className="preparation-description">{equipment.length ? equipment.map((id) => catalog.equipment[id].description).join(" ") : "選擇一件裝備，或直接出發。"}</p></section>
      </div>
      <div className="title-modal-actions"><button type="button" className="primary" onClick={() => setMenu(null)}>完成準備</button></div>
    </Modal>
    <Modal open={menu === "guide"} title="遊戲說明" eyebrow="拉霸 · 出牌 · 冒險" onClose={() => setMenu(null)} className="title-modal guide-modal">
      <ol className="title-guide">
        <li><span className="guide-number">01</span><BattleIcon name="reel" /><div><h3>轉出你的手牌</h3><p>初始盤面免費。鎖欄花 {catalog.rules.lockCost} AP，重轉花 {catalog.rules.spinCost} AP；確認後取得卡片。</p></div></li>
        <li><span className="guide-number">02</span><BattleIcon name="attack" variant="card" /><div><h3>出牌或施放技能</h3><p>直接出牌累積攻防，或將卡片當作技能素材。每回合可以多次操作。</p></div></li>
        <li><span className="guide-number">03</span><BattleIcon name="end" /><div><h3>留下下一手</h3><p>用剩餘 AP 保留卡片，結束回合時發動攻擊。擊敗敵人，繼續深入遺跡。</p></div></li>
      </ol>
      <div className="title-modal-actions"><button type="button" className="primary" onClick={() => setMenu(null)}>返回標題</button></div>
    </Modal>
  </section>;
}
