import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

let server;
let Hand, SlotBoard, BattleView, BattleIcon, conditionLabel, skillIcon, catalog, createBattle;
before(async () => {
  // Transform the actual TSX with the existing Vite toolchain; no browser or
  // Cloudflare runtime is needed for these rendering/availability regressions.
  server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    envFile: false,
    appType: "custom",
    logLevel: "error",
    plugins: [react()],
    server: { middlewareMode: true, ws: false, watch: null },
  });
  ({ Hand } = await server.ssrLoadModule("/components/battle/Hand.tsx"));
  ({ SlotBoard } = await server.ssrLoadModule("/components/battle/SlotBoard.tsx"));
  ({ BattleView } = await server.ssrLoadModule("/components/battle/BattleView.tsx"));
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
  assert.equal((html.match(/src="[^" ]*icon-(?:attack|defense|skill|luck|misfortune)\.png"/gu) ?? []).length, 24);
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
    assert.match(render(BattleIcon, { name }), /aria-hidden="true" focusable="false"/u);
  }
  for (const id of Object.keys(catalog.skills)) {
    assert.match(render(BattleIcon, { name: skillIcon(id) }), /<svg/u);
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
  assert.doesNotMatch(html, /class="skill-medallion"/u);
  assert.match(html, /class="skill-name">強擊/u);
  assert.doesNotMatch(html, /class="card-origin"|class="card-score"/u);
  assert.match(buttonWith(html, 'aria-label="強擊'), /disabled=""/u);
  assert.doesNotMatch(buttonWith(html, 'aria-label="治癒'), /disabled=""/u);
  assert.match(buttonWith(html, "出牌"), /disabled=""/u);
  assert.doesNotMatch(buttonWith(html, "結束回合"), /disabled=""/u);
  assert.match(html, /class="action-dock"/u);
});

test("player HUD first row contains combat damage and armor only", () => {
  const state = battle();
  state.phase = "cards";
  state.hand = [card("one", ["attack", "defense", "star"])];
  const html = render(BattleView, battleProps(state));
  const row = html.match(/<div class="player-resource-bar"[^>]*>(.*?)<\/div><div class="command-row"/u)?.[1] ?? "";
  assert.match(row, /戰鬥傷害/u);
  assert.match(row, /護甲/u);
  assert.doesNotMatch(row, /生命|行動點|ap-pips/u);
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

test("foundation CSS scopes changes away from the arena and includes narrow-screen layout", async () => {
  const css = await readFile(new URL("../components/battle/battle-ui.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /\.(arena|topbar|run-progress|character-sprite)\b/u);
  assert.match(css, /grid-auto-flow: column/u);
  assert.match(css, /overflow-x: auto/u);
  assert.match(css, /@media \(max-width: 359px\)/u);
  assert.match(css, /prefers-reduced-motion/u);
});
