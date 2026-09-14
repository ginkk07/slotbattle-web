import type { Battle, BattleSetup, Card, Catalog, Command, Unit } from "./model.ts";
import { boardCards, cardScore, effective, isCursed } from "./cards.ts";
import { meetsCondition } from "./conditions.ts";
import { value } from "./evaluation.ts";
import { Runtime } from "./runtime.ts";

export function createUnit(id: string, side: "player" | "enemy", name: string, hp: number, attack = 0, defense = 0): Unit {
  return { id, side, name, hp, maxHp: hp, baseAttack: attack, baseDefense: defense, armor: 0, pool: 0, equipment: [], statuses: [], skills: [], attacked: false, damageDealt: false, retainedArmor: 0, pendingAttack: 0, pendingDefense: 0, intent: null, counters: {}, cardUses: [] };
}

export function createBattle(setup: BattleSetup, catalog: Catalog): Battle {
  if (!setup.enemies.length || !Number.isFinite(setup.seed) || setup.playerHp <= 0) throw new Error("戰鬥設定不完整");
  const player = createUnit("player", "player", "冒險者", setup.playerHp, setup.playerAttack ?? 0, setup.playerDefense ?? 0);
  player.hp = Math.min(player.maxHp, setup.currentHp ?? player.maxHp);
  if (!Number.isFinite(player.hp) || player.hp <= 0) throw new Error("玩家生命必須大於 0");
  for (const entry of setup.skills) if (!catalog.skills[entry.id]?.levels[entry.level - 1]) throw new Error(`未知技能或等級：${entry.id}`);
  for (const id of setup.equipment) if (!catalog.equipment[id]) throw new Error(`未知裝備：${id}`);
  player.equipment = [...new Set(setup.equipment)];
  player.skills = setup.skills.map((skill) => ({ ...skill }));
  const units = [player, ...setup.enemies.map((id, index) => {
    const definition = catalog.enemies[id];
    if (!definition) throw new Error(`未知敵人：${id}`);
    return { ...createUnit(`enemy-${index}`, "enemy", definition.name, Math.max(1, Math.round(definition.hp * (setup.enemyScale?.hp ?? 1))), Math.round(definition.attack * (setup.enemyScale?.attack ?? 1)), definition.defense), definitionId: id };
  })];
  const state: Battle = { version: 1, round: 0, phase: "resolving", outcome: null, rng: setup.seed >>> 0, sequence: 0, units, playerId: player.id, ap: 0, apCapacity: 0, board: [], locked: [], hand: [], retained: [], pendingCards: [], nextCards: [], nextApPenalty: 0, preRetainEmpty: false, logs: [], damage: [], inventory: { ...setup.consumables }, usedHooks: [], sealedSkills: [...(setup.sealedSkills ?? [])] };
  const runtime = new Runtime(state, catalog);
  for (const status of setup.startingStatuses ?? []) runtime.addStatus(player, status.id, runtime.context(player, { origin: "skill" }), { rounds: status.rounds, stacks: status.stacks, params: status.params });
  for (const enemy of units.filter((unit) => unit.side === "enemy")) for (const id of catalog.enemies[enemy.definitionId!].passives) runtime.addStatus(enemy, id, runtime.context(enemy));
  runtime.emitAll("battleStart");
  startRound(runtime);
  return state;
}

export function startRound(runtime: Runtime): void {
  const state = runtime.state;
  if (state.outcome) return;
  state.round++;
  state.phase = "resolving";
  state.ap = 0;
  state.apCapacity = Math.max(0, Math.round(runtime.modified(runtime.catalog.rules.baseAp, runtime.player, "ap")));
  state.ap = Math.max(0, state.apCapacity - state.nextApPenalty);
  if (state.nextApPenalty) runtime.log(`詛咒卡：本回合 AP −${state.nextApPenalty}`, "danger");
  state.nextApPenalty = 0;
  state.locked = [];
  state.preRetainEmpty = false;
  state.pendingCards.push(...state.nextCards);
  state.nextCards = [];
  for (const unit of state.units.filter((unit) => unit.hp > 0)) {
    unit.baseAttack += unit.pendingAttack;
    unit.baseDefense += unit.pendingDefense;
    unit.pendingAttack = 0;
    unit.pendingDefense = 0;
    unit.pool = unit.baseAttack;
    unit.armor = 0;
    unit.attacked = false;
    unit.damageDealt = false;
    unit.counters = {};
    unit.cardUses = [];
    runtime.emit("poolInit", unit);
    runtime.gainArmor(unit, unit.baseDefense, runtime.context(unit, { label: "基礎防禦" }));
    unit.armor += unit.retainedArmor;
    unit.retainedArmor = 0;
  }
  runtime.emitAll("roundStart");
  for (const enemy of state.units.filter((unit) => unit.side === "enemy" && unit.hp > 0)) {
    const cycle = runtime.catalog.enemies[enemy.definitionId!].intentCycle;
    enemy.intent = cycle[(state.round - 1) % cycle.length];
  }
  state.phase = "slots";
  runtime.drawBoard();
  if (state.ap === 0) runtime.emit("apEmpty", runtime.player);
  if (runtime.hasModifier(runtime.player, "skipAction")) {
    confirmBoard(runtime);
    runtime.log("目前無法行動。可選擇保留卡片後結束回合。", "danger");
  }
}

function confirmBoard(runtime: Runtime): void {
  const state = runtime.state;
  const generated = boardCards(state.board, runtime.catalog.rules, () => `card-${runtime.id()}`);
  state.nextApPenalty += generated.filter(isCursed).length;
  state.hand = [...generated, ...state.retained.filter((card) => !card.expiresAt || card.expiresAt >= state.round), ...state.pendingCards];
  state.retained = [];
  state.pendingCards = [];
  state.phase = "cards";
  runtime.emit("cardsReady", runtime.player);
  runtime.log(`確認盤面：取得 ${generated.length} 張卡片${state.nextApPenalty ? `，其中 ${state.nextApPenalty} 張詛咒卡使下回合 AP 減少` : ""}。`);
}

function selectedCards(state: Battle, ids: string[], allowEmpty = false): Card[] {
  if ((!allowEmpty && !ids.length) || new Set(ids).size !== ids.length) throw new Error("請選擇不同的卡片");
  return ids.map((id) => {
    const card = state.hand.find((item) => item.id === id);
    if (!card || isCursed(card)) throw new Error("該卡片不能使用");
    return card;
  });
}
function consume(runtime: Runtime, cards: Card[], origin: "skill" | "card"): void {
  const ids = new Set(cards.map((card) => card.id));
  runtime.state.hand = runtime.state.hand.filter((card) => !ids.has(card.id));
  for (const card of cards) {
    runtime.player.cardUses.push({ card, use: origin === "card" ? "play" : "skill" });
    runtime.emit("cardUsed", runtime.player, { card, origin });
  }
}

function play(runtime: Runtime, cards: Card[]): void {
  for (const card of cards) {
    if (runtime.state.outcome) break;
    consume(runtime, [card], "card");
    if (runtime.state.outcome || runtime.player.hp <= 0) break;
    const context = runtime.context(runtime.player, { card, origin: "card", label: card.origin });
    const score = cardScore(card, runtime.catalog.rules, runtime.hasModifier(runtime.player, "skullBoost"));
    runtime.damage(runtime.player, undefined, "battle", score.attack, card.origin);
    runtime.gainArmor(runtime.player, score.armor, context);
    runtime.log(`${card.origin}：戰鬥傷害 +${score.attack}`);
    // No target here: separate on-play damage events acquire the next living target.
    runtime.emit("cardPlayed", runtime.player, { card });
  }
}

export function enemyIntentDamage(state: Battle, unit: Unit, catalog: Catalog): number {
  const definition = catalog.enemySkills[unit.intent ?? ""];
  if (!definition) return 0;
  const runtime = new Runtime(state, catalog);
  const context = runtime.context(unit);
  return Math.round(unit.baseAttack * definition.multiplier + (definition.bonus ? value(definition.bonus, state, context) : 0));
}

function endRound(runtime: Runtime, retained: Card[]): void {
  const state = runtime.state;
  const price = retained.length * runtime.catalog.rules.retainCost;
  if (price > state.ap) throw new Error("保留卡片所需 AP 不足");
  if (retained.some((card) => card.expiresAt !== undefined && card.expiresAt <= state.round)) throw new Error("僅限本回合使用的卡片不能保留");
  state.ap -= price;
  state.retained = retained.map((card) => ({ ...card, origin: `保留 · ${card.origin.replace(/^保留 · /, "")}` }));
  state.hand = [];
  state.phase = "resolving";
  runtime.emitAll("playerTurnEnd");
  if (!runtime.hasModifier(runtime.player, "skipAction")) runtime.attack(runtime.player, runtime.target(runtime.player), runtime.player.pool, "戰鬥攻擊");
  if (state.outcome) return;
  for (const enemy of state.units.filter((unit) => unit.side === "enemy")) {
    if (state.outcome) return;
    if (enemy.hp <= 0 || runtime.hasModifier(enemy, "skipAction")) continue;
    const target = runtime.target(enemy);
    const skill = runtime.catalog.enemySkills[enemy.intent ?? ""];
    if (!skill || !target) continue;
    runtime.attack(enemy, target, enemyIntentDamage(state, enemy, runtime.catalog), skill.name);
    if (!state.outcome) runtime.effects(skill.effects ?? [], runtime.context(enemy, { target, origin: "skill", label: skill.name }));
  }
  if (state.outcome) return;
  runtime.emitAll("enemyTurnEnd");
  runtime.emitAll("roundEnd");
  runtime.emitAll("retainArmor");
  if (state.outcome) return;
  for (const unit of state.units) {
    for (const status of unit.statuses) if (status.remaining !== null) status.remaining--;
    unit.statuses = unit.statuses.filter((status) => status.stacks > 0 && (status.remaining === null || status.remaining > 0));
  }
  runtime.emitAll("roundFinal");
  startRound(runtime);
}

function perform(runtime: Runtime, command: Command): void {
  const state = runtime.state;
  if (state.outcome) throw new Error("戰鬥已結束");
  const immobilized = runtime.hasModifier(runtime.player, "skipAction");
  if (immobilized && !["beginEnd", "end", "cancelEnd"].includes(command.type)) throw new Error("目前狀態無法行動");
  switch (command.type) {
    case "lock": {
      if (state.phase !== "slots") throw new Error("只有拉霸階段可以鎖欄");
      if (!Number.isInteger(command.column) || command.column < 0 || command.column >= runtime.catalog.rules.columns) throw new Error("欄位不存在");
      if (state.locked.includes(command.column)) { state.locked = state.locked.filter((column) => column !== command.column); break; }
      if (state.locked.length >= runtime.catalog.rules.columns - 1) throw new Error("至少保留一欄可重轉");
      if (state.ap < runtime.catalog.rules.lockCost) throw new Error("AP 不足");
      state.locked.push(command.column);
      runtime.spendAp(runtime.catalog.rules.lockCost);
      break;
    }
    case "spin":
      if (state.phase !== "slots") throw new Error("目前不是拉霸階段");
      runtime.spendAp(runtime.catalog.rules.spinCost);
      runtime.drawBoard();
      break;
    case "confirmBoard":
      if (state.phase !== "slots") throw new Error("盤面已確認");
      confirmBoard(runtime);
      break;
    case "play":
      if (state.phase !== "cards") throw new Error("請先確認盤面");
      play(runtime, selectedCards(state, command.cardIds));
      break;
    case "skill": {
      if (state.phase !== "cards") throw new Error("目前不能使用技能");
      const owned = runtime.player.skills.find((skill) => skill.id === command.skillId);
      if (!owned) throw new Error("尚未持有該技能");
      if (state.sealedSkills.includes(owned.id)) throw new Error("此技能在本場戰鬥中被封印");
      const definition = runtime.catalog.skills[owned.id];
      const level = definition.levels[owned.level - 1];
      const cards = selectedCards(state, command.cardIds);
      if (!meetsCondition(cards, level.condition)) throw new Error(`材料不符合 ${level.condition}`);
      const target = runtime.target(runtime.player);
      consume(runtime, cards, "skill");
      runtime.log(`使用${definition.name} Lv.${owned.level}，消耗 ${cards.length} 張卡片。`);
      runtime.effects(level.effects, runtime.context(runtime.player, { target, origin: "skill", label: definition.name, values: { materialCount: cards.length, starTotal: cards.reduce((sum, card) => sum + effective(card, "star"), 0) } }));
      break;
    }
    case "consumable": {
      if (state.phase !== "cards") throw new Error("請在出牌階段使用消耗品");
      const item = runtime.catalog.consumables[command.itemId];
      if (!item || !(state.inventory[item.id] > 0)) throw new Error("沒有這項消耗品");
      state.inventory[item.id]--;
      runtime.effects(item.effects, runtime.context(runtime.player, { target: runtime.target(runtime.player), origin: "system", label: item.name }));
      break;
    }
    case "beginEnd":
      if (state.phase !== "cards") throw new Error("目前無法結束回合");
      state.preRetainEmpty = state.hand.length === 0;
      state.phase = "retain";
      break;
    case "cancelEnd":
      if (state.phase !== "retain") throw new Error("目前不在保留選擇階段");
      state.phase = "cards";
      break;
    case "end":
      if (state.phase !== "retain") throw new Error("請先進入保留卡片階段");
      endRound(runtime, selectedCards(state, command.cardIds, true));
      break;
  }
}

/** Rejected commands are atomic: no cards, AP or RNG are consumed. */
export function dispatch(state: Battle, command: Command, catalog: Catalog): { state: Battle; error?: string } {
  const next = structuredClone(state);
  try {
    perform(new Runtime(next, catalog), command);
    return { state: next };
  } catch (error) {
    return { state, error: error instanceof Error ? error.message : "動作無法完成" };
  }
}
