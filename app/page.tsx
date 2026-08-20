"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SymbolId = "attack" | "defense" | "skill" | "lucky" | "unlucky";
type GameStatus = "active" | "won" | "lost" | "abandoned";
type SkillId = "heal" | "power-strike" | "fire-imbue";

type CommandPoints = { attack: number; defense: number; skill: number };
type SpinResult = {
  reels: SymbolId[];
  wager: number;
  stunned: boolean;
  awarded: CommandPoints;
};
type SpinImpact = {
  attackDamage: number;
  armorGained: number;
  tokensGained: number;
  fireBonus: number;
};
type TurnResolution = {
  round: number;
  stunned: boolean;
  armorUsed: number;
  bossAttack: number;
  damageTaken: number;
};
type LogEntry = { id: number; tone: "normal" | "good" | "danger"; text: string };
type GameState = {
  status: GameStatus;
  round: number;
  playerHp: number;
  bossHp: number;
  action: number;
  armor: number;
  skillTokens: number;
  fireTurns: number;
  stunned: boolean;
  lastSpin: SpinResult | null;
  lastImpact: SpinImpact | null;
  lastResolution: TurnResolution | null;
  logs: LogEntry[];
  nextLogId: number;
};

const PLAYER_MAX_HP = 45;
const BOSS_MAX_HP = 60;
const ACTION_POINTS = 4;
const BOSS_ATTACKS = [15, 17, 20, 22] as const;
const COMBO_VALUE = [0, 1, 3, 9] as const;

const SYMBOL_META: Record<SymbolId, { label: string; icon: string }> = {
  attack: { label: "攻擊", icon: "⚔" },
  defense: { label: "防禦", icon: "◆" },
  skill: { label: "法力", icon: "✦" },
  lucky: { label: "幸運", icon: "♣" },
  unlucky: { label: "不幸", icon: "☠" },
};

const SKILLS: Record<SkillId, { name: string; icon: string; cost: number; description: string }> = {
  heal: { name: "治癒", icon: "✚", cost: 3, description: "立即回復 5 HP" },
  "power-strike": { name: "強擊", icon: "✹", cost: 2, description: "立即對目標造成 5 傷害" },
  "fire-imbue": { name: "火焰附加", icon: "♨", cost: 2, description: "每次攻擊 +1，持續 3 回合" },
};

const START_REELS: SymbolId[] = ["attack", "defense", "skill"];

function createGame(): GameState {
  return {
    status: "active",
    round: 1,
    playerHp: PLAYER_MAX_HP,
    bossHp: BOSS_MAX_HP,
    action: ACTION_POINTS,
    armor: 0,
    skillTokens: 0,
    fireTurns: 0,
    stunned: false,
    lastSpin: null,
    lastImpact: null,
    lastResolution: null,
    logs: [{ id: 1, tone: "normal", text: "遺跡守衛甦醒。攻擊與疊甲會在每次拉霸後立即生效。" }],
    nextLogId: 2,
  };
}

function drawSymbol(): SymbolId {
  const roll = Math.floor(Math.random() * 100);
  if (roll < 30) return "attack";
  if (roll < 60) return "defense";
  if (roll < 90) return "skill";
  if (roll < 95) return "lucky";
  return "unlucky";
}

function drawReels(): SymbolId[] {
  return [drawSymbol(), drawSymbol(), drawSymbol()];
}

function scoreSpin(reels: SymbolId[], wager: number): SpinResult {
  const counts: Record<SymbolId, number> = { attack: 0, defense: 0, skill: 0, lucky: 0, unlucky: 0 };
  reels.forEach((symbol) => { counts[symbol] += 1; });

  if (counts.unlucky === 3) {
    return { reels, wager, stunned: true, awarded: { attack: 0, defense: 0, skill: 0 } };
  }

  const luckyValue = COMBO_VALUE[counts.lucky];
  return {
    reels,
    wager,
    stunned: false,
    awarded: {
      attack: (COMBO_VALUE[counts.attack] + luckyValue) * wager,
      defense: (COMBO_VALUE[counts.defense] + luckyValue) * wager,
      skill: (COMBO_VALUE[counts.skill] + luckyValue) * wager,
    },
  };
}

function addLog(state: GameState, text: string, tone: LogEntry["tone"] = "normal"): GameState {
  return {
    ...state,
    logs: [{ id: state.nextLogId, tone, text }, ...state.logs].slice(0, 8),
    nextLogId: state.nextLogId + 1,
  };
}

function bossIntent(round: number): number {
  return BOSS_ATTACKS[(round - 1) % BOSS_ATTACKS.length];
}

function finishVictory(state: GameState): GameState {
  return addLog({ ...state, status: "won", bossHp: 0 }, "遺跡守衛停止運作。戰鬥勝利！", "good");
}

function endPlayerTurn(state: GameState): GameState {
  if (state.status !== "active") return state;

  const stunned = state.stunned;
  const incomingAttack = bossIntent(state.round);
  const armorUsed = stunned ? 0 : state.armor;
  const damageTaken = Math.max(0, incomingAttack - armorUsed);
  const nextPlayerHp = Math.max(0, state.playerHp - damageTaken);
  const resolution: TurnResolution = {
    round: state.round,
    stunned,
    armorUsed,
    bossAttack: incomingAttack,
    damageTaken,
  };

  let next: GameState = {
    ...state,
    playerHp: nextPlayerHp,
    action: 0,
    armor: 0,
    skillTokens: 0,
    fireTurns: Math.max(0, state.fireTurns - 1),
    stunned: false,
    lastResolution: resolution,
  };

  next = addLog(
    next,
    stunned
      ? `第 ${state.round} 回合｜暈眩！行動點、護甲與法力全部消失，承受 ${damageTaken} 傷害。`
      : `第 ${state.round} 回合結束｜守衛攻擊 ${incomingAttack}，護甲抵擋 ${armorUsed}，承受 ${damageTaken} 傷害。`,
    stunned || nextPlayerHp === 0 ? "danger" : "normal",
  );

  if (nextPlayerHp === 0) {
    return addLog({ ...next, status: "lost" }, "生命歸零，挑戰失敗。", "danger");
  }

  return {
    ...next,
    round: state.round + 1,
    action: ACTION_POINTS,
    stunned: false,
  };
}

function applySpin(state: GameState, wager: number, reels: SymbolId[]): GameState {
  if (
    state.status !== "active" ||
    state.stunned ||
    wager < 1 ||
    wager > state.action
  ) return state;

  const result = scoreSpin(reels, wager);
  let next: GameState = {
    ...state,
    action: state.action - wager,
    lastSpin: result,
  };

  if (result.stunned) {
    return addLog({
      ...next,
      stunned: true,
      action: 0,
      armor: 0,
      skillTokens: 0,
      lastImpact: { attackDamage: 0, armorGained: 0, tokensGained: 0, fireBonus: 0 },
    }, "☠ ☠ ☠　三個不幸！進入暈眩，所有操作已鎖定；請手動結束玩家回合。", "danger");
  }

  const fireBonus = result.awarded.attack > 0 && state.fireTurns > 0 ? 1 : 0;
  const attackDamage = Math.min(state.bossHp, result.awarded.attack + fireBonus);
  const nextBossHp = state.bossHp - attackDamage;
  const impact: SpinImpact = {
    attackDamage,
    armorGained: result.awarded.defense,
    tokensGained: result.awarded.skill,
    fireBonus,
  };

  next = {
    ...next,
    bossHp: nextBossHp,
    armor: state.armor + result.awarded.defense,
    skillTokens: state.skillTokens + result.awarded.skill,
    lastImpact: impact,
  };

  const effects = [
    result.awarded.attack ? `造成${attackDamage}點傷害${fireBonus ? "（火焰+1）" : ""}` : null,
    result.awarded.defense ? `護甲+${result.awarded.defense}` : null,
    result.awarded.skill ? `法力+${result.awarded.skill}` : null,
  ].filter(Boolean).join("・");

  next = addLog(
    next,
    `投入 ${wager} 點｜${reels.map((item) => SYMBOL_META[item].label).join("／")}｜${effects || "沒有產生效果"}`,
    effects ? "good" : "normal",
  );

  return nextBossHp === 0 ? finishVictory(next) : next;
}

function activateSkill(state: GameState, skillId: SkillId): GameState {
  if (state.status !== "active" || state.stunned) return state;
  const skill = SKILLS[skillId];
  if (state.skillTokens < skill.cost) return state;

  if (skillId === "heal") {
    if (state.playerHp >= PLAYER_MAX_HP) return state;
    const healing = Math.min(5, PLAYER_MAX_HP - state.playerHp);
    return addLog({
      ...state,
      playerHp: state.playerHp + healing,
      skillTokens: state.skillTokens - skill.cost,
    }, `施放治癒，回復 ${healing} HP。`, "good");
  }

  if (skillId === "power-strike") {
    const fireBonus = state.fireTurns > 0 ? 1 : 0;
    const damage = Math.min(state.bossHp, 5 + fireBonus);
    const next = addLog({
      ...state,
      bossHp: state.bossHp - damage,
      skillTokens: state.skillTokens - skill.cost,
    }, `施放強擊，對守衛造成 ${damage} 傷害${fireBonus ? "（火焰 +1）" : ""}。`, "good");
    return next.bossHp === 0 ? finishVictory(next) : next;
  }

  if (state.fireTurns > 0) return state;
  return addLog({
    ...state,
    skillTokens: state.skillTokens - skill.cost,
    fireTurns: 3,
  }, "施放火焰附加：本回合起，每次攻擊傷害 +1，持續 3 回合。", "good");
}

function formatSpinImpact(result: SpinResult | null, impact: SpinImpact | null): string {
  if (!result) return "選擇投入點數，啟動拉霸";
  if (result.stunned) return "三個不幸｜本回合暈眩";
  if (!impact) return "指令處理完成";
  const effects = [
    result.awarded.attack ? `造成${impact.attackDamage}點傷害` : null,
    impact.armorGained ? `護甲+${impact.armorGained}` : null,
    impact.tokensGained ? `法力+${impact.tokensGained}` : null,
  ].filter(Boolean).join("　");
  return effects || "沒有產生效果";
}

function HealthBar({ value, max, label, danger = false }: { value: number; max: number; label: string; danger?: boolean }) {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`health-block ${danger ? "is-danger" : ""}`}>
      <div className="health-label"><span>{label}</span><strong>{value}<small> / {max}</small></strong></div>
      <div className="health-track" role="progressbar" aria-label={`${label}生命值`} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
        <span style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export default function Home() {
  const [game, setGame] = useState<GameState>(() => createGame());
  const [displayReels, setDisplayReels] = useState<SymbolId[]>(START_REELS);
  const [isSpinning, setIsSpinning] = useState(false);
  const spinInterval = useRef<number | null>(null);
  const spinTimeout = useRef<number | null>(null);
  const intent = bossIntent(game.round);
  const canInteract = game.status === "active" && !isSpinning;
  const canCommand = canInteract && !game.stunned;
  const canSpin = canCommand && game.action > 0;
  const slotPhaseFinished = game.status === "active" && game.action === 0 && !game.stunned;

  const statusCopy = useMemo(() => {
    if (game.status === "won") return { kicker: "BATTLE CLEAR", title: "守衛已擊破", tone: "good" };
    if (game.status === "lost") return { kicker: "SYSTEM DOWN", title: "挑戰失敗", tone: "danger" };
    if (game.status === "abandoned") return { kicker: "MISSION ABORT", title: "戰鬥已放棄", tone: "muted" };
    return null;
  }, [game.status]);

  useEffect(() => () => {
    if (spinInterval.current !== null) window.clearInterval(spinInterval.current);
    if (spinTimeout.current !== null) window.clearTimeout(spinTimeout.current);
  }, []);

  function spin(wager: number) {
    if (!canSpin || wager < 1 || wager > game.action) return;
    setIsSpinning(true);
    spinInterval.current = window.setInterval(() => setDisplayReels(drawReels()), 75);
    spinTimeout.current = window.setTimeout(() => {
      if (spinInterval.current !== null) window.clearInterval(spinInterval.current);
      const finalReels = drawReels();
      setDisplayReels(finalReels);
      setGame((current) => applySpin(current, wager, finalReels));
      setIsSpinning(false);
      spinInterval.current = null;
      spinTimeout.current = null;
    }, 675);
  }

  function castSkill(skillId: SkillId) {
    if (canCommand) setGame((current) => activateSkill(current, skillId));
  }

  function endTurn() {
    if (canInteract) setGame((current) => endPlayerTurn(current));
  }

  function abandon() {
    if (!canCommand) return;
    setGame((current) => current.status !== "active" ? current : addLog({
      ...current,
      status: "abandoned",
      action: 0,
      armor: 0,
      skillTokens: 0,
    }, "你離開了遺跡，戰鬥結束。"));
  }

  function restart() {
    setGame(createGame());
    setDisplayReels(START_REELS);
    setIsSpinning(false);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || !canInteract) return;
      if (event.key.toLowerCase() === "e") {
        endTurn();
        return;
      }
      if (!canCommand) return;
      if (event.key === "1") spin(1);
      if (event.key === "2") spin(2);
      if (event.key === "3") spin(3);
      if (event.key.toLowerCase() === "a") spin(game.action);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <main className="site-shell">
      <div className="ambient-grid" aria-hidden="true" />
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">SB</span>
          <div><p>RELIC TERMINAL // 02</p><h1>SLOT<span>BATTLE</span></h1></div>
        </div>
        <div className="round-readout" aria-label={`目前第 ${game.round} 回合`}><span>ROUND</span><strong>{String(game.round).padStart(2, "0")}</strong></div>
      </header>

      <section className="battle-grid" aria-label="拉霸戰鬥遊戲區">
        <aside className="panel enemy-panel">
          <div className="panel-heading"><span>ENEMY / 001</span><i className="status-dot" /></div>
          <div className="sentinel" aria-hidden="true">
            <div className="sentinel-halo" />
            <div className="sentinel-head"><span className="sentinel-eye left" /><span className="sentinel-eye right" /><span className="sentinel-mouth" /></div>
            <div className="sentinel-body"><span /></div>
          </div>
          <div className="enemy-identity"><p>ANCIENT AUTOMATON</p><h2>遺跡守衛</h2></div>
          <HealthBar value={game.bossHp} max={BOSS_MAX_HP} label="BOSS HP" danger />
          <div className="target-lock"><span>攻擊目標</span><strong>遺跡守衛</strong><small>TARGET LOCKED</small></div>
          <div className="intent-card"><div><span>NEXT ATTACK</span><small>結束回合後發動</small></div><strong>{game.status === "active" ? intent : "--"}</strong></div>
        </aside>

        <section className="machine-wrap">
          <div className="machine-label"><span>IMMEDIATE COMMAND</span><span>{game.stunned ? "STUNNED" : `${game.action} AP LEFT`}</span></div>
          <div className={`slot-machine ${isSpinning ? "is-spinning" : ""}`}>
            <div className="machine-bolts" aria-hidden="true"><i /><i /><i /><i /></div>
            <div className="reel-window" aria-live="polite" aria-label="拉霸結果">
              {displayReels.map((symbol, index) => (
                <div className={`reel symbol-${symbol}`} key={`${index}-${symbol}`} aria-label={SYMBOL_META[symbol].label}>
                  <span className="reel-index">0{index + 1}</span><strong aria-hidden="true"><span>{SYMBOL_META[symbol].icon}</span></strong><small>{SYMBOL_META[symbol].label}</small>
                </div>
              ))}
            </div>
            <div className="result-line" aria-live="polite"><span className="result-signal" /><strong>{isSpinning ? "CALCULATING..." : formatSpinImpact(game.lastSpin, game.lastImpact)}</strong></div>
            {statusCopy && <div className={`end-screen is-${statusCopy.tone}`} role="status"><p>{statusCopy.kicker}</p><h2>{statusCopy.title}</h2><button type="button" onClick={restart}>重新挑戰</button></div>}
          </div>

          <div className="wager-section">
            <div className="wager-heading">
              <div><span>投入行動點</span><small>攻擊與防禦會在這一次拉霸後立即生效</small></div>
              <div className="action-pips" aria-label={`剩餘 ${game.action} 點行動點`}>
                {Array.from({ length: ACTION_POINTS }, (_, index) => <i className={index < game.action ? "is-active" : ""} key={index} />)}
              </div>
            </div>
            <div className="wager-buttons">
              {[1, 2, 3].map((value) => <button type="button" key={value} disabled={!canSpin || value > game.action} onClick={() => spin(value)} aria-label={`投入 ${value} 點行動點`}><span>{value}</span><small>KEY {value}</small></button>)}
              <button type="button" className="all-in" disabled={!canSpin} onClick={() => spin(game.action)} aria-label={`投入剩餘全部 ${game.action} 點行動點`}><span>ALL</span><small>KEY A</small></button>
            </div>
            {game.stunned
              ? <div className="decision-notice is-stunned" role="status"><span>暈眩中</span><p>拉霸、技能與放棄已鎖定。請手動結束玩家回合。</p></div>
              : slotPhaseFinished && <div className="decision-notice" role="status"><span>行動點已用完</span><p>仍可使用技能；完成決策後請手動結束回合。</p></div>}
            <div className="secondary-actions">
              <button type="button" className="end-turn" disabled={!canInteract} onClick={endTurn}>結束玩家回合 <kbd>E</kbd></button>
              <button type="button" disabled={!canCommand} onClick={abandon}>放棄戰鬥</button>
            </div>
          </div>

          <section className="skill-dock" aria-label="攜帶技能">
            <div className="skill-dock-head">
              <div><span>攜帶技能</span><small>可在任意兩次拉霸之間使用</small></div>
              <strong><i>✦</i>{game.skillTokens}<small> 法力</small></strong>
            </div>
            <div className="skill-grid">
              <article className="skill-card heal">
                <div className="skill-icon">{SKILLS.heal.icon}</div>
                <div className="skill-copy"><span>{SKILLS.heal.name}</span><small>{SKILLS.heal.description}</small></div>
                <button type="button" onClick={() => castSkill("heal")} disabled={!canCommand || game.skillTokens < SKILLS.heal.cost || game.playerHp >= PLAYER_MAX_HP}><b>{SKILLS.heal.cost}</b> 法力</button>
              </article>
              <article className="skill-card strike">
                <div className="skill-icon">{SKILLS["power-strike"].icon}</div>
                <div className="skill-copy"><span>{SKILLS["power-strike"].name}</span><small>{SKILLS["power-strike"].description}</small></div>
                <button type="button" onClick={() => castSkill("power-strike")} disabled={!canCommand || game.skillTokens < SKILLS["power-strike"].cost}><b>{SKILLS["power-strike"].cost}</b> 法力</button>
              </article>
              <article className={`skill-card fire ${game.fireTurns > 0 ? "is-active" : ""}`}>
                <div className="skill-icon">{SKILLS["fire-imbue"].icon}</div>
                <div className="skill-copy"><span>{SKILLS["fire-imbue"].name}</span><small>{game.fireTurns > 0 ? `作用中｜剩餘 ${game.fireTurns} 回合` : SKILLS["fire-imbue"].description}</small></div>
                <button type="button" onClick={() => castSkill("fire-imbue")} disabled={!canCommand || game.skillTokens < SKILLS["fire-imbue"].cost || game.fireTurns > 0}>{game.fireTurns > 0 ? "作用中" : <><b>{SKILLS["fire-imbue"].cost}</b> 法力</>}</button>
              </article>
            </div>
          </section>
        </section>

        <aside className="panel player-panel">
          <div className="panel-heading"><span>OPERATOR / YOU</span><i className="status-dot is-player" /></div>
          <HealthBar value={game.playerHp} max={PLAYER_MAX_HP} label="PLAYER HP" />
          <div className="resource-title"><div><span>角色資源</span><small>PLAYER RESOURCES</small></div><strong>{game.action}<small> AP</small></strong></div>
          <div className="resource-stack">
            <div className="resource-card action"><div className="resource-icon">●</div><div><span>行動點</span><small>剩餘可投入點數</small></div><strong>{game.action}</strong></div>
            <div className="resource-card defense"><div className="resource-icon">◆</div><div><span>護甲</span><small>結束回合時抵銷傷害</small></div><strong>{game.armor}</strong></div>
            <div className="resource-card skill"><div className="resource-icon">✦</div><div><span>法力</span><small>可在拉霸之間使用技能</small></div><strong>{game.skillTokens}</strong></div>
          </div>
          {(game.stunned || game.fireTurns > 0) && (
            <section className="status-section" aria-label="角色狀態" aria-live="polite">
              <div className="status-heading"><span>狀態</span><small>STATUS</small></div>
              <div className="status-list">
                {game.stunned && (
                  <article className="status-card is-stunned">
                    <div><small>狀態</small><strong>暈眩</strong></div>
                    <div><small>狀態說明</small><span>無法行動，只能結束回合</span></div>
                    <div><small>持續回合</small><strong>1 回合</strong></div>
                  </article>
                )}
                {game.fireTurns > 0 && (
                  <article className="status-card is-fire">
                    <div><small>狀態</small><strong>火焰附加</strong></div>
                    <div><small>狀態說明</small><span>每次攻擊傷害 +1</span></div>
                    <div><small>持續回合</small><strong>{game.fireTurns} 回合</strong></div>
                  </article>
                )}
              </div>
            </section>
          )}
          <div className="combo-note"><span>COMBO VALUE</span><div><b>1</b><i>→</i><b>1</b></div><div><b>2</b><i>→</i><b>3</b></div><div><b>3</b><i>→</i><b>9</b></div><small>同類圖示數量 → 基礎指令點，再乘本次投入</small></div>
        </aside>
      </section>

      <section className="lower-grid">
        <div className="combat-log">
          <div className="section-title"><span>BATTLE LOG</span><small>最近戰況</small></div>
          <ol aria-live="polite">{game.logs.map((entry) => <li className={`is-${entry.tone}`} key={entry.id}><span>{String(entry.id).padStart(2, "0")}</span><p>{entry.text}</p></li>)}</ol>
        </div>
        <details className="rules-panel">
          <summary><span>怎麼玩</span><small>HOW TO PLAY ＋</small></summary>
          <div className="rules-content">
            <ol className="quick-rules">
              <li><span>投入行動點進行拉霸，對目標造成傷害或進行防禦。</span></li>
              <li><span>消耗法力可使用技能。</span></li>
              <li><span>結束回合時，行動點與法力不會累積到下個回合。</span></li>
              <li><span>3 個不幸，玩家將暈眩 1 回合。</span></li>
            </ol>
          </div>
        </details>
      </section>
    </main>
  );
}
