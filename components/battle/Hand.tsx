import type { Card, Catalog } from "../../game/model.ts";
import { cardScore, isCursed } from "../../game/cards.ts";
import { BattleIcon } from "./BattleIcon.tsx";

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
      const tone = card.symbols.every((symbol) => symbol === card.symbols[0]) ? card.symbols[0] : "mixed";

      return <button
        type="button"
        key={card.id}
        className={`hand-card ${isSelected ? "selected" : ""} ${cursed ? "cursed" : ""} ${expires ? "expired" : ""}`}
        data-symbol={tone}
        aria-pressed={isSelected}
        aria-label={`${card.origin}，${symbols}，攻擊 ${score.attack}，護甲 ${score.armor}${unavailable}`}
        disabled={disabled || cursed || expires}
        onClick={() => onToggle(card.id)}
      >
        <span className="card-origin">
          <span className="origin-label" title={card.origin}>{card.origin}</span>
          <span className="selection-mark" aria-hidden="true">{isSelected ? <BattleIcon name="check" /> : cursed || expires ? <BattleIcon name="lock" /> : null}</span>
        </span>
        <span className="card-symbols" aria-hidden="true">
          {card.symbols.map((symbol, index) => <BattleIcon key={index} name={symbol} className={`symbol-${symbol}`} />)}
        </span>
        <span className="card-score">
          {cursed ? <span className="card-state">下回合 AP −1</span>
            : expires ? <span className="card-state">僅限本回合</span>
            : material ? <span className="card-state"><BattleIcon name="diamond" />技能素材</span>
            : <><span className="card-attack"><BattleIcon name="attack" />{score.attack}</span><span className="card-armor"><BattleIcon name="defense" />{score.armor}</span></>}
        </span>
      </button>;
    })}
  </div>;
}
