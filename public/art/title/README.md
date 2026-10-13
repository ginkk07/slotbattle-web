# 標題主美術：遺跡之門

- 日期：2026-10-13（Asia/Taipei）。
- 遊戲資產：`public/art/title/ruins-gateway-v2.png`。
- 來源：內建 `image_gen`，先生成原創主美術，再用同一工具局部編輯移除人物。
- 最終畫面只有石門、橋徑、森林、瀑布與光影；沒有角色、怪物、卡牌、文字或 UI。
- 原始尺寸：941 × 1672，PNG，2,585,363 bytes。生成請求尺寸未完全採用，以上為實際檔案尺寸。
- SHA-256：`9719cc7c6d34e6e29c4c820ce474f6324f7561e55853eb049aeb6e77a498790f`。
- PNG 以獨立二進位檔案保存及 Git 傳輸，沒有 Base64 或文字內嵌。
- 標題與選單由遊戲介面疊加，採固定 450 × 800、9:16 座標；此圖不替換戰鬥背景。

## 美術參考

實際查看以下官方主視覺，以獨立的構圖、焦點與景深安排標題畫面。此圖為原創生成，沒有取用、下載或合成其他遊戲的圖片。

- [Slay the Spire 官方素材](https://www.megacrit.com/press-kits/slay-the-spire/)
- [Wildfrost 官方網站](https://www.wildfrostgame.com/)
- [Monster Train 官方網站](https://www.themonstertrain.com/)

## 最終編輯提示

使用者追加「不要放人物」後，執行以下局部編輯。只有無人物的最終版本納入遊戲。

```text
Edit target: the provided portrait fantasy title key art.
Make one targeted change: completely remove the blue-haired knight in the lower-left foreground, including the knight's body, head, blue cape, armor, shield, sword and character-shaped shadow. Naturally reconstruct that area as an empty, weathered stone path with moss, small plants and soft ambient shadow, continuing the existing environment and lighting.
The title key art must contain NO PEOPLE or CHARACTERS of any kind: no human, knight, adventurer, silhouette, humanoid statue, creature or monster. No cards, card deck, floating icons, dice, text, logo, HUD or UI.
Preserve the existing composition, portrait 9:16 aspect ratio and high resolution, the monumental moss-covered gateway on the right, the bridge/path leading toward it, the warm light inside the gateway, cool forest mist, tree roots, distant ruins, waterfall, stone texture, atmospheric depth, color palette and painterly style. Keep the calm upper space and dark foreground suitable for a game logo and menu overlay. Change only what is necessary to remove the character and reconstruct the environment. No replacement subject in the removed character's location.
```

## 初始生成提示

以下是編輯前的生成提示，作為完整製作紀錄；其中人物已由上述編輯全部移除。

```text
Use case: stylized-concept.
Asset type: ORIGINAL finished key art background for a fantasy adventure game's TITLE SCREEN, portrait 9:16, requested 1440 x 2560 pixels, sharp high-resolution painted illustration.
Primary request: Create one coherent, professionally art-directed fantasy illustration of an adventurer about to enter an ancient forest ruin. This is the opening promise of a journey. The composition has convincing perspective, integrated character/environment lighting, a single clear architectural focal point, and thoughtful visual hierarchy.
Scene/backdrop: A weathered, moss-covered stone gateway at the end of a diagonal ancient path/short bridge, nested among enormous tree roots and ruined pillars. A subdued warm amber glow inside the tall gateway contrasts with cool teal-green forest mist. Layer foreground vegetation, the middle-distance path and gateway, and faint distant canopy/ruin silhouettes for depth. Make the scene inviting and mysterious, quiet and adventurous.
Subject: Exactly one small stylized blue-haired knight, seen in rear three-quarter view from behind in the left foreground, gazing towards the gateway and beginning to walk toward it. He has spiky teal-blue hair, a blue cape, silver plate armor with muted gold trim, a blue round/oval shield with a simple gold rim, and a lowered sheathed/downward sword. Rounded stylized fantasy-game proportions, not realistic adult anatomy. His pose is relaxed and exploratory. He belongs physically inside the painting with natural cast shadow, shared lighting, and perspective. Do not draw him as a pasted, front-facing battle sprite.
Composition/framing: Full-bleed portrait 9:16. Reserve the upper roughly 24% as calm low-detail mist/canopy shadow so the game logo can be overlaid in code. Main storytelling scene occupies approximately 25% to 72% of the height: the knight is a small foreground figure in the lower left of this region, while the monumental gateway is farther away near the center-right, with the path leading the eye towards it. The gateway and environment dominate the image; the knight is about 18% of total image height. Keep the bottom 28% dark and comparatively uncluttered with softly painted natural ground/vegetation tones so actual game-menu controls can be overlaid. Natural atmospheric light continues across the whole image; no artificial black UI panels. Keep all important elements comfortably within the central 85% of the image width.
Style/medium: Premium hand-painted 2D fantasy game key art, strong shapes, tasteful textured brushwork, crisp silhouettes and controlled detail, beautiful environmental storytelling, a unified painterly finish. Use moss green, dark teal and weathered stone, with restrained warm amber highlights. Original artwork, not a copy of another game's characters or composition.
Text: NONE. No letters, no title, no logo, no menu, no buttons, no labels, no watermark.
Strict constraints: No enemy figures, no stone golem/monster, no opposing units, no combat pose, no battlefield side-view layout, no health bars, no HUD, no card deck, no cards, no floating icons, no dice, no coins, no slot machine, no gambling imagery, no extra characters. It must read as a composed adventure title illustration, never as a screenshot of a battle arena.
```
