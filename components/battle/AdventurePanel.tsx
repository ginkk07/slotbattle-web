import type { Catalog } from "../../game/model.ts";
import type { Adventure, AdventureCommand, AdventureRules } from "../../game/adventure/model.ts";
import { rewardName, shopPrice, upgradableSkills, upgradableWeapons } from "../../game/adventure/rewards.ts";

import { EncounterArt } from "./EncounterArt.tsx";
import { RewardCard } from "./RewardCard.tsx";
import { RewardModal } from "./RewardModal.tsx";
import { RunEndScreen } from "./RunEndScreen.tsx";

export function RunProgress({ state, rules }: { state: Adventure; catalog: Catalog; rules: AdventureRules }) {
  return <section className="run-progress" aria-label="冒險進度"><strong>{rules.region.name} · 第 {state.depth} 層</strong>{state.phase !== "battle" && <span>生命 {state.player.hp} / {state.player.maxHp}</span>}<span>金幣 <b>{state.player.gold}</b></span><span className="progress-secondary">擊敗魔物 {state.victories} · 探索 {state.progress}</span></section>;
}

export function AdventurePanel({ state, catalog, rules, onCommand, onRestart, error }: { state: Adventure; catalog: Catalog; rules: AdventureRules; onCommand: (command: AdventureCommand) => void; onRestart: () => void; error?: string }) {
  const event = state.encounter;
  const definition = event ? rules.events[event.id] : undefined;
  const upgradeSkills = upgradableSkills(state.player, catalog);
  const price = event?.stage === "shop" ? shopPrice(state, rules) : 0;
  const choices = event?.stage === "upgrade" ? upgradeSkills : state.player.skills;
  return <>
    {state.phase === "ended" && <RunEndScreen state={state} onRestart={onRestart} />}
    {state.phase === "reward" && <RewardModal state={state} catalog={catalog} onCommand={onCommand} error={error} />}
    {state.phase === "event" && event && definition && <section className="encounter-panel" aria-labelledby="encounter-title"><div className="encounter-hero"><EncounterArt id={event.id} label={definition.name + "場景"} /><div className="encounter-heading"><p className="eyebrow">{definition.rarity}奇遇 · 遺跡第 {state.depth} 層</p><h2 id="encounter-title">{definition.name}</h2></div></div><div className="encounter-content"><p className="event-text" role="status">{event.text}</p>
      {event.stage === "choice" && <div className="event-options">{definition.options.map((option) => {
        const missingGold = state.player.gold < (option.goldCost ?? 0);
        const missingItem = !!option.itemCost && (state.player.inventory[option.itemCost.itemId] ?? 0) < option.itemCost.quantity;
        return <button type="button" key={option.id} disabled={missingGold || missingItem} onClick={() => onCommand({ type: "option", id: option.id })}>{option.label}{missingGold ? <small> · 金幣不足</small> : missingItem && option.itemCost ? <small> · 缺少{catalog.consumables[option.itemCost.itemId].name}</small> : null}</button>;
      })}</div>}
      {event.stage === "result" && <button type="button" className="primary" onClick={() => onCommand({ type: "continue" })}>繼續探索 →</button>}
      {["upgrade", "wager", "replace"].includes(event.stage) && <div className="event-options">{choices.map((skill) => <button type="button" key={skill.id} onClick={() => onCommand({ type: "eventSkill", id: skill.id })}>{catalog.skills[skill.id].name} Lv.{skill.level}{event.stage === "upgrade" ? ` → Lv.${skill.level + 1}` : ""}</button>)}</div>}
      {event.stage === "forge" && <div className="event-options">{upgradableWeapons(state.player, rules).map((id) => <button type="button" key={id} onClick={() => onCommand({ type: "forge", id })}>{catalog.equipment[id].name} → {catalog.equipment[rules.weaponUpgrades[id]].name}</button>)}</div>}
      {event.stage === "vault" && event.reward && <><div className="skill-grid"><RewardCard reward={event.reward} state={state} catalog={catalog} onChoose={() => onCommand({ type: "vault", accept: true })} /></div><button type="button" className="quiet" onClick={() => onCommand({ type: "vault", accept: false })}>留下裝備</button></>}
      {event.stage === "shop" && event.shop && <><p className="notice">本次交易：{price} 金幣。每次購買後，下一筆交易價格提高。</p><div className="skill-grid">{event.shop.offers.map((offer) => <RewardCard key={offer.id} reward={offer} state={state} catalog={catalog} disabled={offer.purchased || state.player.gold < price} action={offer.purchased ? "已售出" : `購買 · ${price} 金幣`} onChoose={() => onCommand({ type: "buy", id: offer.id, kind: "item" })} />)}</div>{upgradeSkills.length > 0 && <><h3>強化技能</h3><div className="event-options">{upgradeSkills.map((skill) => <button type="button" key={skill.id} disabled={state.player.gold < price} onClick={() => onCommand({ type: "buy", id: skill.id, kind: "skill" })}>{catalog.skills[skill.id].name} Lv.{skill.level} → Lv.{skill.level + 1} · {price} 金幣</button>)}</div></>}<button type="button" className="quiet" onClick={() => onCommand({ type: "leave" })}>離開商店</button></>}
      {event.stage === "corpse" && <div className="event-options"><button type="button" onClick={() => onCommand({ type: "search" })}>繼續搜刮 · 第 {(event.corpse?.attempts ?? 0) + 1} 次</button><button type="button" className="quiet" onClick={() => onCommand({ type: "leave" })}>保留收穫，離開</button></div>}
      {event.collector && <div className="collector"><div className="section-heading"><span>轉動 {event.collector.attempt} / {rules.collector.attempts}</span><span>獎勵：{rewardName(event.collector.reward, catalog)}</span></div><div className="collector-reels">{Array.from({ length: rules.collector.reels }, (_, index) => <button type="button" key={index} className={event.collector!.lockedIndex === index ? "locked" : ""} aria-pressed={event.collector!.lockedIndex === index} disabled={event.stage !== "spin" || !event.collector!.reels.length} onClick={() => onCommand({ type: "collectorLock", index })}><span>{event.collector!.reels[index] ? catalog.rules.symbols[event.collector!.reels[index]].icon : "?"}</span><small>{event.collector!.lockedIndex === index ? "已鎖定 · 點擊解除" : `鎖定第 ${index + 1} 格`}</small></button>)}</div>{event.stage === "spin" && <button type="button" className="primary" onClick={() => onCommand({ type: "collectorSpin" })}>{event.collector.attempt === 0 ? "開始轉動" : "再次轉動"}</button>}</div>}
    </div></section>}
    <details className="panel adventure-roster"><summary>我的行囊 <span>技能 {state.player.skills.length} / {rules.maxHeldSkills} · 裝備 {state.player.equipment.length}</span></summary><div className="equipment-list">{state.player.skills.map((skill) => <details key={skill.id}><summary>{catalog.skills[skill.id].name} Lv.{skill.level}</summary><p>{catalog.skills[skill.id].levels[skill.level - 1].condition}<br />{catalog.skills[skill.id].levels[skill.level - 1].description}</p></details>)}{state.player.equipment.map((id) => <details key={id}><summary>{catalog.equipment[id].name}</summary><p>{catalog.equipment[id].description}</p></details>)}</div><div className="inventory-readout">{Object.entries(state.player.inventory).filter(([, count]) => count > 0).map(([id, count]) => <span key={id} title={catalog.consumables[id].description}>{catalog.consumables[id].name} ×{count}</span>)}</div></details>
    <details className="panel adventure-history"><summary>冒險紀錄</summary><ol>{state.log.slice(-20).map((text, index) => <li key={`${index}-${text}`}>{text}</li>)}</ol></details>
  </>;
}
