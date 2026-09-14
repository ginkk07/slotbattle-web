import type { Card, Rules, SymbolId } from "./model.ts";

export function printed(card: Card, symbol: SymbolId): number {
  return card.symbols.filter((value) => value === symbol).length;
}

export function effective(card: Card, symbol: SymbolId): number {
  return printed(card, symbol) + (["attack", "defense", "star"].includes(symbol) ? printed(card, "lucky") : 0);
}

export function isCursed(card: Card): boolean {
  return card.symbols.length === 3 && printed(card, "skull") === 3;
}

export function cardScore(card: Card, rules: Rules, skullBoost = false): { attack: number; armor: number } {
  if (isCursed(card)) return { attack: 0, armor: 0 };
  function score(symbol: SymbolId) {
    let count = effective(card, symbol);
    // Skull amplification requires the printed base symbol; it is never a wildcard.
    if (skullBoost && printed(card, symbol) > 0) count += printed(card, "skull");
    return rules.combo[Math.min(count, rules.combo.length - 1)] ?? 0;
  }
  return { attack: score("attack"), armor: score("defense") };
}

export function boardCards(board: SymbolId[], rules: Rules, nextId: () => string): Card[] {
  if (board.length !== rules.boardSize) throw new Error("盤面格數不符");
  return rules.lines.map((line) => ({ id: nextId(), origin: line.name, symbols: line.cells.map((index) => board[index]) }));
}
