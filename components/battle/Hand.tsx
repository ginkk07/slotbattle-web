import type { Card, Catalog } from "../../game/model.ts";
import { cardScore, isCursed } from "../../game/cards.ts";
import { cardArt } from "./presentation.ts";

export function Hand({ cards, selected, catalog, onToggle, disabled, material, skullBoost, retainingRound }: {
  cards: Card[]; selected: string[]; catalog: Catalog; onToggle: (id: string) => void;
  disabled: boolean; material: boolean; skullBoost: boolean; retainingRound?: number;
}) {
  return <div className="hand-grid" role="group" aria-label={retainingRound !== undefined ? "選擇保留卡片" : material ? "選擇技能卡片" : "選擇手牌"}>
    {cards.map((card) => {
      const cursed = isCursed(card);
      const score = cardScore(card, catalog.rules, skullBoost);
      const isSelected = selected.includes(card.id);
      const expires = retainingRound !== undefined && card.expiresAt !== undefined && card.expiresAt <= retainingRound;
      const symbols = card.symbols.map((symbol) => catalog.rules.symbols[symbol].label).join("、");
      const unavailable = cursed ? "，詛咒卡不能使用，下回合 AP 減 1" : expires ? "，僅限本回合，不能保留" : "";
      const context = material ? "技能素材，" : "";

      return <button
        type="button"
        key={card.id}
        className={`hand-card ${isSelected ? "selected" : ""} ${cursed ? "cursed" : ""} ${expires ? "expired" : ""}`}
        aria-pressed={isSelected}
        aria-label={`${context}${card.origin}，${symbols}，攻擊 ${score.attack}，護甲 ${score.armor}${unavailable}`}
        disabled={disabled || cursed || expires}
        onClick={() => onToggle(card.id)}
      >
        <img className="card-base-art" src={cardArt.base} alt="" draggable={false} />
        <span className="card-symbols" aria-hidden="true">
          {card.symbols.map((symbol, index) => <img key={index} src={cardArt.symbols[symbol]} alt="" draggable={false} />)}
        </span>
      </button>;
    })}
  </div>;
}
