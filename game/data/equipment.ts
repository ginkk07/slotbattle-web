import type { CardQuery, Content, Hook, Scalar } from "../model.ts";
import { all, armor, change, check, content, damage, hook, indexById, multiply, read, status } from "./helpers.ts";

const item = (id: string, more: Partial<Content> = {}): Content => ({ ...content("裝備", id), ...more });
const onExtra = all(check("event.isSource", "=", 1), check("event.isExtra", "=", 1), check("event.amount", ">", 1));
const triple = check("effective.attack", ">=", 3);
const playedTriple: CardQuery = { use: "play", where: triple };
const skullCards: Scalar = { countCards: { use: "play", where: check("printed.skull", ">=", 1) } };
const perTriple = (effects: Hook["effects"]): Hook => ({ ...hook("beforeBattle", effects), forEachCard: playedTriple });

export const equipment = indexById([
  item("sword", { hooks: [hook("battleStart", [status("attack-up-3", 3)])] }),
  item("lucky-clover", { modifiers: [{ kind: "weight", symbol: "lucky", value: 2, mode: "multiply" }] }),
  item("croissant", { hooks: [hook("roundStart", [{ op: "heal", target: "self", amount: 1 }])] }),
  item("red-oni-mask", { tags: ["encounterOnly"], modifiers: [{ kind: "eliteChanceMinimum", value: 0.2 }] }),
  item("iron-shield", { hooks: [hook("roundStart", [armor(5)])] }),
  item("thorns", { hooks: [hook("battleStart", [status("damage-reflection", undefined, undefined, 5)])] }),
  item("magic-stone", { hooks: [hook("battleStart", [{ op: "card", symbols: ["star"] }])] }),
  item("shuriken", { hooks: [hook("cardPlayed", [{ ...damage(1), chance: 0.5 }])] }),
  item("gamblers-left-hand", { hooks: [hook("beforeBattle", [change("amount", 1.5, "multiply")], check("emptyHand", "=", 1), "multiply")] }),
  item("rune-cube", { hooks: [hook("cardPlayed", [armor(2)], check("effective.defense", ">=", 1))] }),
  item("lucky-coin", { hooks: [hook("apEmpty", [{ op: "ap", amount: 1, chance: 0.77 }])] }),
  item("star-staff", { hooks: [hook("cardPlayed", [damage(1)], check("effective.star", ">=", 1))] }),
  item("bounty-poster", { hooks: [hook("roundStart", [armor(20), status("attack-up-7", 1)], all(check("round", "=", 1), check("event.elite", "=", 1)))] }),
  item("singing-bowl", { hooks: [hook("cardPlayed", [{ op: "heal", target: "self", amount: 1 }], check("effective.star", ">=", 1))] }),
  item("peace-charm", { tags: ["smallBattleHitToOne"] }),
  item("lucky-carrot", { hooks: [hook("cardPlayed", [{ op: "pool", target: "self", amount: 2 }, armor(2)], check("printed.lucky", ">=", 1))] }),
  item("cursed-snake-scale", { modifiers: [{ kind: "blockCardArmor" }, { kind: "armorGain", value: 2, mode: "multiply", onlySkill: true }] }),
  item("vip-membership", { modifiers: [{ kind: "ap", value: 1, mode: "add" }] }),
  item("star-sea-compass", { hooks: [hook("cardsReady", [{ op: "card", symbols: ["star", "star", "star"] }])] }),
  item("flame-sword", { hooks: [hook("afterDamage", [status("burning", undefined, undefined, 1, "target")], onExtra)] }),
  item("summer-gift-anchor", { hooks: [hook("roundFinal", [{ op: "card", symbols: ["attack", "attack", "attack"], timing: "next" }], check("self.damageDealt", "=", 0))] }),
  item("diamond", { hooks: [hook("retainArmor", [{ op: "saveArmor", amount: 0.5, target: "self" }])] }),
  item("regeneration-herb", { hooks: [hook("battleEnd", [{ op: "heal", target: "self", amount: 6 }])] }),
  item("tinder-bag", { hooks: [hook("battleStart", [status("burning", undefined, undefined, 3, "target")])] }),
  item("black-cat-tail", { hooks: [hook("spin", [{ op: "stat", target: "self", field: "maxHp", amount: 2 }], check("event.skulls", ">=", 1))] }),
  item("insurance-contract", { hooks: [hook("playerTurnEnd", [armor({ calc: "add", args: [6, multiply(read("self.armor"), -1)] })], check("self.armor", "<", 6))] }),
  item("elemental-bottle", { hooks: [hook("beforeDamage", [change("amount", 1)], onExtra)] }),
  item("blood-leech", { hooks: [hook("battleHit", [{ op: "heal", target: "self", amount: 3 }])] }),
  item("voodoo-doll", { hooks: [hook("afterBattle", [status("curse", undefined, undefined, skullCards, "target"), status("curse", undefined, undefined, skullCards)])] }),
  item("prayer-beads", { modifiers: [{ kind: "damageReduction", damageType: "curse", stage: "fixed", value: 3 }] }),
  item("shock-device", { hooks: [{ ...hook("statusAdded", [{ op: "removeStatus", target: "self", status: "stunned" }], check("event.isStun", "=", 1)), oncePerBattle: true }] }),
  item("first-aid-kit", { modifiers: [{ kind: "healing", value: 1.4, mode: "multiply" }] }),
  item("demon-blood", { modifiers: [{ kind: "skullBoost" }] }),
  item("knight-hammer", { hooks: [perTriple([status("armor-break", undefined, undefined, 1, "target")])] }),
  item("crossbow", { hooks: [perTriple([change("amount", 9), change("bypass", 9)])] }),
  item("reinforced-longsword", { hooks: [hook("battleStart", [status("attack-up-7", 3)])] }),
  item("reinforced-shuriken", { hooks: [hook("cardPlayed", [damage(1)])] }),
  item("reinforced-knight-hammer", { hooks: [{ ...perTriple([
    { ...damage(3), when: check("target.armor", "=", 0) },
    status("armor-break", undefined, undefined, 3, "target"),
  ]), targeting: "perCard" }] }),
  item("reinforced-crossbow", { hooks: [
    perTriple([change("amount", 9), change("bypass", 9)]),
    hook("beforeBattle", [change("amount", 1.5, "multiply")], check("target.armor", "=", 0), "multiply"),
  ] }),
  item("rams skull", { hooks: [
    hook("boardDrawn", [{ op: "ensureSymbol", symbols: ["skull"] }]),
    hook("beforeDamage", [change("amount", 2, "multiply")], all(check("event.isCurse", "=", 1), check("target.isPlayer", "=", 0)), "multiply"),
  ] }),
]);

// A condition can be reused by future equipment without adding engine branches.
export const playedTripleSwordCondition = triple;
