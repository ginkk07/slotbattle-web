import type { Battle, Card, Catalog, Content, Context, DamageRecord, DamageType, Effect, EventName, Modifier, Status, SymbolId, Target, Unit } from "./model.ts";
import { calculateDamage } from "./damage.ts";
import { matchingCards, testPredicate, value } from "./evaluation.ts";
import { random, weightedDraw } from "./random.ts";
import { handlers } from "./effects.ts";
import { lifecycleUnits, opposingUnits } from "./targeting.ts";

export class Runtime {
  state: Battle;
  catalog: Catalog;
  private depth = 0;
  private deathDepth = 0;
  constructor(state: Battle, catalog: Catalog) { this.state = state; this.catalog = catalog; }
  get player(): Unit { return this.state.units.find((unit) => unit.id === this.state.playerId)!; }
  id(): number { return ++this.state.sequence; }
  random(): number { return random(this.state); }
  log(text: string, tone: "normal" | "good" | "danger" = "normal"): void {
    this.state.logs.push({ id: this.id(), round: this.state.round, text, tone });
    this.state.logs = this.state.logs.slice(-this.catalog.rules.logLimit);
  }
  target(self: Unit): Unit | undefined {
    return opposingUnits(this.state, self)[0];
  }
  context(self: Unit, more: Partial<Context> = {}): Context {
    return { self, values: {}, label: self.name, origin: "system", ...more };
  }
  targets(which: Target | undefined, context: Context): Unit[] {
    if (which === "enemies" || which === "attackers") return opposingUnits(this.state, context.self).filter((unit) => which !== "attackers" || unit.attacked);
    const unit = which === "source" ? context.source : which === "target" ? (context.target ?? this.target(context.self)) : context.self;
    return unit ? [unit] : [];
  }
  sources(unit: Unit): { content: Content; status?: Status; kind: "skill" | "equipment"; order: number }[] {
    return [
      ...unit.statuses.map((status) => ({ content: this.catalog.statuses[status.id], status, kind: status.origin === "equipment" ? "equipment" as const : "skill" as const, order: status.order })),
      ...unit.equipment.map((id, index) => ({ content: this.catalog.equipment[id], kind: "equipment" as const, order: index })),
    ];
  }
  modifiers(unit: Unit, kind: Modifier["kind"]): { modifier: Modifier; context: Context }[] {
    return this.sources(unit).flatMap((source) => (source.content.modifiers ?? []).filter((modifier) => modifier.kind === kind).map((modifier) => ({ modifier, context: this.context(unit, { status: source.status, origin: source.kind, label: source.content.name }) })))
      .sort((a, b) => Number(a.modifier.mode === "multiply") - Number(b.modifier.mode === "multiply"));
  }
  hasModifier(unit: Unit, kind: Modifier["kind"]): boolean { return this.modifiers(unit, kind).length > 0; }
  hasTag(unit: Unit, tag: string): boolean { return this.sources(unit).some((source) => source.content.tags?.includes(tag)); }
  taggedStacks(unit: Unit, tag: string): number { return unit.statuses.filter((status) => this.catalog.statuses[status.id].tags?.includes(tag)).reduce((sum, status) => sum + status.stacks, 0); }
  modified(base: number, unit: Unit, kind: Modifier["kind"], filter: (modifier: Modifier) => boolean = () => true): number {
    for (const { modifier, context } of this.modifiers(unit, kind).filter((entry) => filter(entry.modifier))) {
      const amount = value(modifier.value ?? 0, this.state, context);
      base = modifier.mode === "multiply" ? base * amount : base + amount;
    }
    return base;
  }
  emit(event: EventName, unit: Unit, more: Partial<Context> = {}): void {
    if (unit.hp <= 0 && event !== "death") return;
    if (++this.depth > 64) throw new Error("效果事件形成循環，已中止本次動作");
    try {
      const hooks = this.sources(unit).flatMap((source) => (source.content.hooks ?? []).map((hook, index) => ({ source, hook, index }))).filter((entry) => entry.hook.event === event)
        .sort((a, b) => Number(a.hook.order === "multiply") - Number(b.hook.order === "multiply") || Number(a.source.kind === "equipment") - Number(b.source.kind === "equipment") || a.source.order - b.source.order || a.index - b.index);
      for (const { source, hook, index } of hooks) {
        if (source.status && !unit.statuses.includes(source.status)) continue;
        const context = this.context(unit, { ...more, event, status: source.status, label: source.content.name, origin: source.kind });
        const key = `${unit.id}:${source.content.id}:${index}`;
        if (hook.oncePerBattle && this.state.usedHooks.includes(key)) continue;
        if (!testPredicate(hook.when, this.state, context)) continue;
        if (hook.oncePerBattle) this.state.usedHooks.push(key);
        if (hook.forEachCard) {
          const cards = matchingCards(unit, hook.forEachCard, this.state, context);
          for (const { card } of cards) {
            const target = hook.targeting === "perCard" ? this.target(unit) : context.target;
            if (this.state.outcome || (target && target.hp <= 0)) break;
            this.effects(hook.effects, { ...context, card, target });
          }
        } else this.effects(hook.effects, context);
        if (this.state.outcome && event !== "battleEnd" && event !== "death") break;
      }
    } finally { this.depth--; }
  }
  emitAll(event: EventName): void {
    for (const unit of lifecycleUnits(this.state)) {
      if (this.state.outcome) break;
      this.emit(event, unit, { target: this.target(unit), values: { elite: Number(this.state.units.some((enemy) => enemy.side === "enemy" && this.catalog.enemies[enemy.definitionId!]?.tier !== "普通")) } });
    }
  }
  effects(effects: Effect[], context: Context): void {
    for (const effect of effects) {
      if (context.self.hp <= 0 && context.event !== "death") break;
      // A locked target's death never cancels the actor's own cost/status effect.
      if (this.state.outcome && effect.target !== "self") continue;
      const evaluated = { ...context, target: context.target ?? this.target(context.self) };
      if (!testPredicate(effect.when, this.state, evaluated)) continue;
      if (effect.op !== "status" && effect.chance !== undefined && this.random() >= effect.chance) continue;
      const handler = handlers[effect.op];
      if (!handler) throw new Error(`沒有註冊的效果處理器：${effect.op}`);
      handler(this, effect, evaluated);
    }
  }
  addStatus(target: Unit, id: string, context: Context, options: { rounds?: number; stacks?: number; params?: Record<string, number>; chance?: number } = {}): void {
    if (target.hp <= 0) return;
    const definition = this.catalog.statuses[id];
    if (!definition || definition.draft) throw new Error(`狀態 ${id} 尚未啟用`);
    const resistance = target.definitionId ? this.catalog.enemies[target.definitionId]?.statusRules?.find((rule) => rule.status === id) : undefined;
    if (resistance?.immune) return;
    const chance = (options.chance ?? 1) * (resistance?.chanceMultiplier ?? 1);
    if (chance < 1 && this.random() >= chance) return;
    const stacks = Math.max(0, Math.round(options.stacks ?? 1));
    if (stacks === 0) return;
    const duration = options.rounds === undefined ? null : Math.round(options.rounds * (resistance?.durationMultiplier ?? 1));
    if (duration !== null && duration < 1) return;
    let status = target.statuses.find((entry) => entry.id === id);
    const fresh = !status;
    if (status) {
      status.stacks = definition.stacking === "add" ? status.stacks + stacks : stacks;
      status.remaining = duration;
      status.params = options.params ?? status.params;
      status.source = context.self.id;
      status.origin = context.origin;
    } else {
      status = { id, stacks, remaining: duration, params: options.params ?? {}, order: this.id(), source: context.self.id, origin: context.origin };
      target.statuses.push(status);
    }
    this.log(`${target.name}獲得${definition.name}${definition.stacking === "add" ? ` ${stacks} 層` : ""}${duration ? `（${duration} 回合）` : ""}`);
    if (fresh) this.effects(definition.onAcquire ?? [], this.context(target, { status, origin: context.origin, label: definition.name }));
    this.emit("statusAdded", target, { status, values: { isStun: Number(definition.tags?.includes("stun")) } });
  }
  gainArmor(unit: Unit, amount: number, context: Context): void {
    if (unit.hp <= 0 || amount <= 0) return;
    if (this.hasModifier(unit, "blockCardArmor") && (context.origin === "card" || (context.origin === "equipment" && !!context.card))) return;
    amount = Math.max(0, Math.round(this.modified(amount, unit, "armorGain", (modifier) => !modifier.onlySkill || context.origin === "skill")));
    unit.armor += amount;
    if (amount) this.log(`${context.label}：${unit.name}護甲 +${amount}`, "good");
  }
  heal(unit: Unit, amount: number, context: Context): void {
    if (unit.hp <= 0) return;
    amount = Math.max(0, Math.min(unit.maxHp - unit.hp, Math.round(this.modified(amount, unit, "healing"))));
    unit.hp += amount;
    if (amount) this.log(`${context.label}：${unit.name}回復 ${amount} 點生命`, "good");
  }
  createCard(symbols: SymbolId[], origin: string): Card { return { id: `card-${this.id()}`, symbols: [...symbols], origin }; }
  symbolWeights(): [SymbolId, number][] {
    return Object.entries(this.catalog.rules.symbols).map(([id, symbol]) => {
      const weight = this.modified(symbol.weight, this.player, "weight", (modifier) => modifier.symbol === id);
      return [id as SymbolId, Math.max(this.catalog.rules.minimumWeight, weight)] as [SymbolId, number];
    });
  }
  drawBoard(): void {
    const weights = this.symbolWeights();
    this.state.board = Array.from({ length: this.catalog.rules.boardSize }, (_, index) => this.state.locked.includes(index % this.catalog.rules.columns) ? this.state.board[index] : weightedDraw(weights, () => this.random()));
    this.emit("boardDrawn", this.player);
    this.emit("spin", this.player, { values: { skulls: this.state.board.filter((symbol) => symbol === "skull").length } });
    this.log(this.state.locked.length ? "未鎖定欄位已重轉；鎖定維持。" : "九格盤面已產生。確認後取得卡片。");
  }
  spendAp(amount: number): void {
    if (this.state.ap < amount) throw new Error("AP 不足");
    this.state.ap -= amount;
    if (this.state.ap === 0 && this.state.phase === "slots") this.emit("apEmpty", this.player);
  }
  private damageContext(source: Unit, target: Unit, type: DamageType, amount: number, bypass: number, label: string): Context {
    return this.context(source, { target, source, label, damageType: type, values: { amount, bypass, isBattle: Number(type === "battle"), isExtra: Number(type === "extra"), isCurse: Number(type === "curse") } });
  }
  prepareDamage(source: Unit, target: Unit, type: DamageType, amount: number, label: string, bypass = 0): DamageRecord | undefined {
    if (!this.catalog.rules.damage[type].enabled) throw new Error(`傷害類別 ${type} 尚未實作`);
    if (this.modifiers(target, "damageImmunity").some(({ modifier }) => !modifier.damageType || modifier.damageType === type)) return;
    const context = this.damageContext(source, target, type, amount, bypass, label);
    for (const unit of lifecycleUnits(this.state)) {
      context.values.isSource = Number(unit.id === source.id);
      context.values.isTarget = Number(unit.id === target.id);
      this.emit("beforeDamage", unit, { ...context, self: unit });
    }
    // All owners modify the same event object. This never adds a damage event.
    if (context.values.amount <= 0 || target.hp <= 0 || this.state.outcome) return;
    if (type === "battle") target.armor = Math.max(0, target.armor - this.taggedStacks(target, "armorBreak"));
    const modifiers = this.modifiers(target, "damageReduction").filter(({ modifier }) => modifier.damageType === type || (!modifier.damageType && this.catalog.rules.damage[type].generalReduction));
    const amountAt = (stage: string) => modifiers.filter((entry) => entry.modifier.stage === stage).reduce((sum, entry) => sum + value(entry.modifier.value ?? 0, this.state, entry.context), 0);
    const result = calculateDamage(context.values.amount, type, target, this.catalog.rules, { percent: amountAt("percent"), fixed: amountAt("fixed"), special: (remaining) => type === "battle" && this.hasTag(target, "smallBattleHitToOne") && remaining >= 1 && remaining <= 4 ? 1 : remaining }, context.values.bypass);
    return { ...result, id: this.id(), round: this.state.round, source: source.id, target: target.id, label, type };
  }
  private applyDamage(record: DamageRecord): void {
    const target = this.state.units.find((unit) => unit.id === record.target)!;
    const source = this.state.units.find((unit) => unit.id === record.source)!;
    target.armor -= record.armorBlocked;
    target.hp -= record.hpDamage;
    if (record.raw > 0) source.damageDealt = true;
    record.scene = this.state.units.map(({ id, hp, armor }) => ({ id, hp, armor }));
    this.state.damage.push(record);
    this.state.damage = this.state.damage.slice(-200);
    const names: Record<DamageType, string> = { battle: "戰鬥", extra: "額外", burn: "燃燒", reflection: "反射", curse: "詛咒", poison: "毒素" };
    this.log(`${record.label} → ${target.name}：${record.raw} ${names[record.type]}傷害，護甲抵擋 ${record.armorBlocked}，生命傷害 ${record.hpDamage}${record.overkill ? `，溢出 ${record.overkill}` : ""}`, target.side === "player" ? "danger" : "good");
  }
  /** Content uses this entrypoint; battle damage is always deferred. */
  damage(source: Unit, target: Unit | undefined, type: DamageType, amount: number, label: string, bypass = 0): void {
    if (this.state.outcome || amount <= 0) return;
    if (type === "battle") {
      if (source.hp <= 0) return;
      source.pool = Math.max(0, Math.round(source.pool + amount));
      this.log(`${label}：戰鬥傷害池 ${source.pool}`);
      return;
    }
    this.resolveDamage(source, target, type, amount, label, bypass);
  }
  private resolveDamage(source: Unit, target: Unit | undefined, type: DamageType, amount: number, label: string, bypass = 0): DamageRecord | undefined {
    if (!target || target.hp <= 0 || amount <= 0 || this.state.outcome) return;
    const record = this.prepareDamage(source, target, type, amount, label, bypass);
    if (!record || record.raw <= 0) return;
    if (type === "battle") {
      source.attacked = true;
      // This event is reached only after attack modifiers have completed and
      // a positive, non-immune battle hit has been established (even vs armor).
      this.emit("battleHit", source, this.damageContext(source, target, type, record.raw, record.bypass, label));
      if (target.hp <= 0 || source.hp <= 0 || this.state.outcome) return;
    }
    this.applyDamage(record);
    this.deaths();
    if (this.state.outcome) return record;
    const context = this.damageContext(source, target, type, record.raw, record.bypass, label);
    context.values.hpDamage = record.hpDamage;
    context.values.isSource = 1;
    this.emit("afterDamage", source, context);
    if (!this.state.outcome) this.emit("receivedDamage", target, { ...context, self: target, source });
    return record;
  }
  curse(source: Unit, battleAmount: number): void {
    if (this.state.outcome || battleAmount <= 0) return;
    const targets = this.state.units.filter((unit) => unit.hp > 0 && this.taggedStacks(unit, "curse") > 0);
    const records = targets.map((target) => this.prepareDamage(source, target, "curse", Math.min(battleAmount, this.taggedStacks(target, "curse")), "詛咒")).filter((record): record is DamageRecord => !!record);
    for (const record of records) this.applyDamage(record);
    // Atomic effects share one presentation frame and one death judgment.
    for (const record of records) {
      record.batchId = records[0].id;
      record.scene = this.state.units.map(({ id, hp, armor }) => ({ id, hp, armor }));
    }
    this.deaths();
  }
  attack(source: Unit, target: Unit | undefined, amount: number, label: string): void {
    if (!target || amount <= 0 || source.hp <= 0 || this.state.outcome) return;
    const context = this.context(source, { target, source, label, damageType: "battle", values: { amount, bypass: 0 } });
    this.emit("beforeBattle", source, context);
    if (this.state.outcome || source.hp <= 0 || target.hp <= 0) return;
    const record = this.resolveDamage(source, target, "battle", context.values.amount, label, context.values.bypass);
    if (!record) return;
    this.curse(source, record.raw);
    if (!this.state.outcome && source.hp > 0) this.emit("afterBattle", source, context);
  }
  deaths(): void {
    this.deathDepth++;
    try {
      for (const unit of lifecycleUnits(this.state)) if (unit.hp <= 0 && !unit.counters.dead) {
        unit.hp = 0;
        unit.counters.dead = 1;
        this.log(`${unit.name}倒下。`, unit.side === "player" ? "danger" : "good");
        this.emit("death", unit);
      }
    } finally { this.deathDepth--; }
    // Resolve all nested death effects before deciding victory, defeat or draw.
    if (this.deathDepth > 0) return;
    const playersAlive = this.state.units.some((unit) => unit.side === "player" && unit.hp > 0);
    const enemiesAlive = this.state.units.some((unit) => unit.side === "enemy" && unit.hp > 0);
    if (this.state.outcome || (playersAlive && enemiesAlive)) return;
    this.state.outcome = !playersAlive && !enemiesAlive ? "draw" : playersAlive ? "victory" : "defeat";
    this.state.phase = "finished";
    for (const unit of this.state.units) if (unit.hp > 0) this.emit("battleEnd", unit);
    this.log(this.state.outcome === "victory" ? "戰鬥勝利。" : this.state.outcome === "draw" ? "雙方全滅。" : "戰鬥失敗。", playersAlive ? "good" : "danger");
  }
}
