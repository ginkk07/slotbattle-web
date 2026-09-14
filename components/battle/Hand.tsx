import type { Card, Catalog } from "../../game/model.ts";
import { cardScore, isCursed } from "../../game/cards.ts";
export function Hand({ cards, selected, catalog, onToggle, disabled, material, skullBoost, retainingRound }: { cards: Card[]; selected: string[]; catalog: Catalog; onToggle: (id: string) => void; disabled: boolean; material: boolean; skullBoost: boolean; retainingRound?: number }) {
  return <div className="hand-grid" aria-label={material ? "選擇技能卡片" : "選擇手牌"}>{cards.map((card) => {
    const cursed = isCursed(card); const score = cardScore(card, catalog.rules, skullBoost);
    const expires = retainingRound !== undefined && card.expiresAt !== undefined && card.expiresAt <= retainingRound;
    return <button type="button" key={card.id} className={`hand-card ${selected.includes(card.id) ? "selected" : ""} ${cursed ? "cursed" : ""}`} aria-pressed={selected.includes(card.id)} aria-label={`${card.origin} ${card.symbols.map((symbol) => catalog.rules.symbols[symbol].icon).join("")}${cursed ? " 詛咒卡不能使用" : ""}`} disabled={disabled || cursed || expires} onClick={() => onToggle(card.id)}><span className="card-origin"><span className="origin-label">{card.origin}</span><span className="selection-mark">{selected.includes(card.id) ? "✓" : "+"}</span></span><span className="card-symbols">{card.symbols.map((symbol, index) => <span key={index}>{catalog.rules.symbols[symbol].icon}</span>)}</span><span className="card-score">{cursed ? "下回合 AP −1" : expires ? "僅限本回合" : material ? "用於技能" : <>⚔️ {score.attack}<span>🛡️ {score.armor}</span></>}</span></button>;
  })}</div>;
}
