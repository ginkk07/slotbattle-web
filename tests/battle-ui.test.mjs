import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

let server;
let Hand, SlotBoard, BattleView, Arena, BattleIcon, conditionLabel, skillIcon, gameViewportScale, GAME_WIDTH, GAME_HEIGHT, catalog, createBattle, setPlaybackBusy;
before(async () => {
  // Transform the actual TSX with the existing Vite toolchain; no browser or
  // Cloudflare runtime is needed for these rendering/availability regressions.
  server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    envFile: false,
    appType: "custom",
    logLevel: "error",
    plugins: [{
      name: "playback-render-fixture", enforce: "pre",
      transform(code, id) {
        if (!id.replaceAll("\\", "/").endsWith("/components/battle/useBattlePlayback.ts")) return;
        return code.replace("export function useBattlePlayback(", "function actualBattlePlayback(") + `
          let fixtureBusy = false;
          export function setPlaybackBusy(value) { fixtureBusy = value; }
          export function useBattlePlayback(state) {
            return fixtureBusy ? { scene: state, hit: { label: "盾牌投擲" }, group: [], busy: true } : actualBattlePlayback(state);
          }
        `;
      },
    }, react()],
    // Keep React in Node's module cache for the renderer and transformed TSX,
    // including Windows installs that use package-manager symlinks.
    ssr: { external: ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "react-dom"] },
    server: { middlewareMode: true, ws: false, watch: null },
  });
  ({ Hand } = await server.ssrLoadModule("/components/battle/Hand.tsx"));
  ({ SlotBoard } = await server.ssrLoadModule("/components/battle/SlotBoard.tsx"));
  ({ BattleView } = await server.ssrLoadModule("/components/battle/BattleView.tsx"));
  ({ setPlaybackBusy } = await server.ssrLoadModule("/components/battle/useBattlePlayback.ts"));
  ({ Arena } = await server.ssrLoadModule("/components/battle/Arena.tsx"));
  ({ gameViewportScale, GAME_WIDTH, GAME_HEIGHT } = await server.ssrLoadModule("/components/ui/GameViewport.tsx"));
  ({ BattleIcon, conditionLabel, skillIcon } = await server.ssrLoadModule("/components/battle/BattleIcon.tsx"));
  ({ catalog } = await server.ssrLoadModule("/game/data/catalog.ts"));
  ({ createBattle } = await server.ssrLoadModule("/game/battle.ts"));
});
after(async () => { await server?.close(); });

const card = (id, symbols, extra = {}) => ({ id, origin: `橫線 ${id}`, symbols, ...extra });
const render = (component, props) => renderToStaticMarkup(createElement(component, props));
const buttons = (html) => html.match(/<button\b[^>]*>[\s\S]*?<\/button>/gu) ?? [];
const buttonWith = (html, text) => {
  const button = buttons(html).find((entry) => entry.includes(text));
  assert.ok(button, `Missing button: ${text}`);
  return button;
};
const handProps = (cards, extra = {}) => ({
  cards, selected: [], catalog, onToggle() {}, disabled: false,
  material: false, skullBoost: false, ...extra,
});
const battle = (extra = {}) => createBattle({
  seed: 73, playerHp: 100, enemies: ["ruins-sentinel"],
  skills: [{ id: "power-strike", level: 1 }, { id: "life-recovery", level: 1 }, { id: "shield-block", level: 1 }],
  equipment: [], ...extra,
}, catalog);
const battleProps = (state) => ({ state, catalog, onCommand() {}, onComplete() {} });

test("eight cards retain all 24 symbols and accessible numeric scores", () => {
  const cards = Array.from({ length: 8 }, (_, index) => card(String(index), ["attack", "defense", "star"]));
  const html = render(Hand, handProps(cards));
  assert.equal(buttons(html).length, 8);
  assert.equal((html.match(/src="[^" ]*hud-v2\/icons\/cards\/(?:attack|defense|star|lucky|skull)\.png"/gu) ?? []).length, 24);
  assert.match(html, /role="group" aria-label="選擇手牌"/u);
  assert.match(html, /劍、盾、星，攻擊 1，護甲 1/u);
  assert.doesNotMatch(html, /⚔|🛡|✨|🍀|💀/u);
});

test("selected cards expose a pressed state and keep their card ID callback", () => {
  let toggled;
  const props = handProps([card("a", ["attack", "attack", "attack"])], {
    selected: ["a"], onToggle(id) { toggled = id; },
  });
  const html = render(Hand, props);
  assert.match(html, /aria-pressed="true"/u);
  assert.match(html, /cards\/card-selected\.png/u);
  assert.match(render(Hand, handProps(props.cards)), /cards\/card-idle\.png/u);
  assert.match(html, /攻擊 9，護甲 0/u);
  const element = Hand(props);
  const button = element.props.children[0];
  assert.equal(button.props.type, "button");
  button.props.onClick();
  assert.equal(toggled, "a");
});

test("cursed cards stay disabled and explain the AP penalty", () => {
  const html = render(Hand, handProps([card("curse", ["skull", "skull", "skull"])]));
  assert.match(buttons(html)[0], /disabled=""/u);
  assert.match(html, /詛咒卡不能使用，下回合 AP 減 1/u);
  assert.doesNotMatch(html, /class="card-score"/u);
});

test("expired retention cards cannot be retained but remain playable this round", () => {
  const cards = [card("expires", ["attack", "star", "star"], { expiresAt: 2 })];
  const retained = render(Hand, handProps(cards, { retainingRound: 2 }));
  assert.match(retained, /選擇保留卡片/u);
  assert.match(buttons(retained)[0], /disabled=""/u);
  assert.match(retained, /僅限本回合，不能保留/u);
  assert.doesNotMatch(buttons(render(Hand, handProps(cards)))[0], /disabled=""/u);
});

test("future retention cards remain enabled and a locked hand disables all cards", () => {
  const cards = [card("later", ["star", "star", "star"], { expiresAt: 3 })];
  assert.doesNotMatch(buttons(render(Hand, handProps(cards, { retainingRound: 2 })))[0], /disabled=""/u);
  assert.match(buttons(render(Hand, handProps(cards, { disabled: true })))[0], /disabled=""/u);
});

test("skill material mode keeps its accessible label without visible card text", () => {
  const html = render(Hand, handProps([card("material", ["star", "star", "star"])], { material: true }));
  assert.match(html, /選擇技能卡片/u);
  assert.match(html, /技能素材/u);
  assert.doesNotMatch(html, /class="card-origin"|class="card-score"/u);
});

test("symbol art is decorative and every current skill has an icon", () => {
  for (const name of ["attack", "defense", "star", "lucky", "skull"]) {
    assert.match(render(BattleIcon, { name }), /aria-hidden="true"/u);
  }
  for (const id of Object.keys(catalog.skills)) {
    assert.match(render(BattleIcon, { name: skillIcon(id), variant: "skill" }), /hud-v2\/icons\/skills\/[^" ]+\.png/u);
  }
  assert.equal(skillIcon("future-skill"), "star");
});

test("readable conditions do not mutate source recipes", () => {
  const before = JSON.stringify(catalog.skills);
  assert.equal(conditionLabel("Σ⚔️>=2 & Σ✨>=2"), "合計 劍≥2 · 合計 星≥2");
  assert.equal(conditionLabel("[🛡️=3], [✨=3]"), "[盾=3], [星=3]");
  for (const skill of Object.values(catalog.skills)) {
    for (const level of skill.levels) assert.doesNotMatch(conditionLabel(level.condition), /⚔|🛡|✨/u);
  }
  assert.equal(JSON.stringify(catalog.skills), before);
});

test("card phase keeps skill availability, hand selection and end-turn controls", () => {
  const state = battle();
  state.phase = "cards";
  state.hand = [card("one", ["attack", "attack", "attack"])];
  state.sealedSkills = ["power-strike"];
  const html = render(BattleView, battleProps(state));
  assert.match(html, /class="skill-medallion"/u);
  assert.match(buttonWith(html, 'aria-label="強擊'), /attack-disabled\.png/u);
  assert.match(buttonWith(html, 'aria-label="治癒'), /heal\.png/u);
  assert.match(html, /class="skill-name">強擊/u);
  assert.doesNotMatch(html, /class="card-origin"|class="card-score"/u);
  assert.match(buttonWith(html, 'aria-label="強擊'), /disabled=""/u);
  assert.doesNotMatch(buttonWith(html, 'aria-label="治癒'), /disabled=""/u);
  assert.match(buttonWith(html, "出牌"), /disabled=""/u);
  assert.doesNotMatch(buttonWith(html, "結束回合"), /disabled=""/u);
  assert.match(html, /class="action-dock"/u);
});

test("player HUD shows combat damage, armor and the current AP capacity", () => {
  const state = battle();
  state.phase = "cards";
  state.hand = [card("one", ["attack", "defense", "star"])];
  const html = render(BattleView, battleProps(state));
  const row = html.match(/<div class="player-resource-bar"[^>]*>(.*?)<\/div><div class="command-row"/u)?.[1] ?? "";
  assert.match(row, /戰鬥傷害/u);
  assert.match(row, /護甲/u);
  assert.match(row, /class="ap-resource"/u);
  assert.match(row, new RegExp(`<strong>${state.ap}<small>/${state.apCapacity}`));
  assert.doesNotMatch(row, /生命|ap-pips/u);
});

test("both units have PNG health bars beneath their actors and retain inspection", () => {
  const state = battle();
  state.units[0].hp = state.units[0].maxHp / 2;
  const html = render(Arena, { state, catalog, hit: null, group: [], busy: false });
  assert.equal((html.match(/class="unit-health" role="progressbar"/gu) ?? []).length, 2);
  assert.match(html, /health\/hp-fill-teal\.png/u);
  assert.match(html, /health\/hp-fill-red\.png/u);
  assert.match(html, /clip-path:inset\(0 50% 0 0\)/u);
  assert.match(html, /characters\/knight\.png/u);
  assert.match(html, /characters\/sentinel\.png/u);
  for (const button of buttons(html)) {
    assert.ok(button.indexOf('class="actor-motion') < button.indexOf('class="unit-health'));
    assert.match(button, /查看狀態/u);
  }
});

test("zero AP disables paid reel actions but not confirming the board", () => {
  const state = battle();
  state.ap = 0;
  const html = render(SlotBoard, { state, catalog, onCommand() {} });
  assert.equal((html.match(/class="slot-cell /gu) ?? []).length, 9);
  assert.match(buttonWith(html, "重轉"), /disabled=""/u);
  assert.match(buttonWith(html, 'aria-label="鎖定第 1 欄"'), /disabled=""/u);
  assert.doesNotMatch(buttonWith(html, "確認盤面"), /disabled=""/u);
});

test("locked columns remain unlockable at zero AP", () => {
  const state = battle();
  state.ap = 0;
  state.locked = [0];
  const html = render(SlotBoard, { state, catalog, onCommand() {} });
  assert.doesNotMatch(buttonWith(html, 'aria-label="解鎖第 1 欄"'), /disabled=""/u);
  assert.match(buttonWith(html, 'aria-label="解鎖第 1 欄"'), /aria-pressed="true"/u);
});

test("retention and victory retain their original distinct actions", () => {
  const state = battle();
  state.phase = "retain";
  state.hand = [card("one", ["attack", "star", "star"], { expiresAt: state.round })];
  const retained = render(BattleView, battleProps(state));
  assert.doesNotMatch(retained, /class="skill-tray"/u);
  assert.match(retained, /不保留，發動攻擊/u);
  assert.match(buttonWith(retained, "橫線 one"), /disabled=""/u);
  state.outcome = "victory";
  const victory = render(BattleView, battleProps(state));
  assert.match(victory, /勝利/u);
  assert.doesNotMatch(victory, /class="action-dock"/u);
});

test("rendering preserves the battle state and the reel remains a dialog", () => {
  const state = battle();
  const before = JSON.stringify(state);
  const html = render(BattleView, battleProps(state));
  assert.match(html, /<dialog[^>]*reels-modal/u);
  assert.match(html, /打開拉霸/u);
  assert.equal(JSON.stringify(state), before);
});

test("game viewport preserves one 9:16 coordinate system on portrait and landscape screens", () => {
  assert.equal(GAME_WIDTH, 450);
  assert.equal(GAME_HEIGHT, 800);
  for (const [width, height] of [[450, 800], [390, 844], [320, 667], [1280, 720], [1920, 1080]]) {
    const scale = gameViewportScale(width, height);
    assert.ok(scale > 0);
    assert.ok(GAME_WIDTH * scale <= width + 1e-9);
    assert.ok(GAME_HEIGHT * scale <= height + 1e-9);
    assert.equal((GAME_WIDTH * scale) / (GAME_HEIGHT * scale), 9 / 16);
  }
});

test("HUD CSS uses fixed coordinates with internal scrolling and reduced motion", async () => {
  const css = await readFile(new URL("../components/battle/battle-ui.css", import.meta.url), "utf8");
  assert.match(css, /\.battle-screen \.unit-health/u);
  assert.match(css, /var\(--action-primary-disabled\)/u);
  assert.match(css, /grid-auto-flow: column/u);
  assert.match(css, /overflow-x: auto/u);
  assert.doesNotMatch(css, /\b(?:dvh|svh|vh|vw|cqh)\b|@media\s*\((?:max|min)-(?:width|height)/u);
  assert.match(css, /prefers-reduced-motion/u);
});

test("a damage playback keeps the hand and both actions visible, but disables input", () => {
  // Exercise the real view in the transient playback state, which static idle
  // rendering cannot reach because React effects do not run in the SSR renderer.
  setPlaybackBusy(true);
  try {
    const state = battle();
    state.phase = "cards";
    state.hand = [card("first", ["defense", "defense", "attack"]), card("second", ["attack", "star", "star"])];
    const html = render(BattleView, battleProps(state));
    assert.match(html, /aria-busy="true"/u);
    assert.match(html, /選擇手牌/u);
    assert.match(buttonWith(html, "橫線 first"), /disabled=""/u);
    assert.match(buttonWith(html, "橫線 second"), /disabled=""/u);
    assert.match(buttonWith(html, "結束回合"), /disabled=""/u);
    assert.match(buttonWith(html, "出牌"), /disabled=""/u);
    assert.match(html, /效果結算中/u);
    assert.doesNotMatch(html, /class="battle-result"/u);
  } finally {
    setPlaybackBusy(false);
  }
});

test("idle and retention keep the same guidance slot before the hand", () => {
  const state = battle();
  state.phase = "cards";
  state.hand = [card("first", ["attack", "defense", "star"])];
  const idle = render(BattleView, battleProps(state));
  state.phase = "retain";
  const retained = render(BattleView, battleProps(state));
  for (const html of [idle, retained]) {
    assert.equal((html.match(/class="decision-information"/gu) ?? []).length, 1);
    assert.ok(html.indexOf('class="decision-information"') < html.indexOf('class="hand-grid"'));
  }
  assert.match(idle, /選擇你的卡片/u);
  assert.match(retained, /每張保留卡花費/u);
});
