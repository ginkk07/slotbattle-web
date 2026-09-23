/// <reference types="vite/client" />

const uiBase = `${import.meta.env.BASE_URL}ui/`;

export type UiAsset = {
  id: string;
  name: string;
  file: string;
  src: string;
  category: "panel" | "button" | "icon" | "ornament" | "card";
  usage: string;
  native: string;
  display: string;
};

function asset(
  id: string,
  name: string,
  file: string,
  category: UiAsset["category"],
  native: string,
  display: string,
  usage: string,
): UiAsset {
  return { id, name, file, src: `${uiBase}${file}`, category, native, display, usage };
}

export const uiAssets = [
  asset("hud-panel", "玩家操作面板", "panels/hud-panel.png", "panel", "1024 × 1536", "512 × 768", "完整四排玩家操作區底板；文字與互動元件由程式疊加"),
  asset("button-idle", "橫向按鈕／一般", "buttons/pill-idle.png", "button", "291 × 135", "194 × 90", "技能與次要操作的預設狀態"),
  asset("button-selected", "橫向按鈕／選取", "buttons/pill-selected.png", "button", "299 × 154", "194 × 100", "技能選取與目前操作狀態"),
  asset("button-disabled", "橫向按鈕／停用", "buttons/pill-disabled.png", "button", "285 × 133", "194 × 91", "條件不足或不可操作狀態"),
  asset("item-idle", "物品按鈕／一般", "buttons/item-idle.png", "button", "225 × 243", "92 × 99", "第二排物品入口"),
  asset("item-selected", "物品按鈕／選取", "buttons/item-selected.png", "button", "254 × 253", "100 × 100", "物品面板開啟狀態"),
  asset("action-dark", "行動按鈕／深色", "buttons/action-dark.png", "button", "429 × 182", "236 × 100", "結束回合與返回"),
  asset("action-primary", "行動按鈕／主要", "buttons/action-primary.png", "button", "430 × 189", "236 × 104", "出牌與確認"),
  asset("stat-attack", "戰鬥傷害", "icons/stat-attack.png", "icon", "141 × 257", "44 × 80", "第一排戰鬥傷害"),
  asset("stat-defense", "護甲", "icons/stat-defense.png", "icon", "179 × 231", "58 × 75", "第一排護甲"),
  asset("stat-ap", "AP", "icons/stat-ap.png", "icon", "209 × 222", "62 × 66", "第一排行動點數"),
  asset("stat-coin", "金幣", "icons/stat-coin.png", "icon", "201 × 204", "62 × 63", "第一排金幣"),
  asset("item-bag", "物品", "icons/item-bag.png", "icon", "183 × 202", "60 × 66", "第二排物品按鈕內圖示"),
  asset("action-play", "出牌", "icons/action-play.png", "icon", "169 × 179", "54 × 57", "主要行動按鈕圖示"),
  asset("action-end", "結束回合", "icons/action-end.png", "icon", "142 × 182", "46 × 59", "結束回合按鈕圖示"),
  asset("divider", "橫向分隔線", "ornaments/divider.png", "ornament", "409 × 103", "260 × 65", "區塊之間的低對比裝飾"),
  asset("diamond", "菱形節點", "ornaments/diamond.png", "ornament", "124 × 127", "38 × 39", "面板與分隔線節點"),
] as const satisfies readonly UiAsset[];

export const uiArt = {
  panel: uiAssets[0].src,
  buttons: {
    idle: uiAssets[1].src,
    selected: uiAssets[2].src,
    disabled: uiAssets[3].src,
    item: uiAssets[4].src,
    itemSelected: uiAssets[5].src,
    dark: uiAssets[6].src,
    primary: uiAssets[7].src,
  },
  icons: {
    attack: uiAssets[8].src,
    defense: uiAssets[9].src,
    ap: uiAssets[10].src,
    coin: uiAssets[11].src,
    item: uiAssets[12].src,
    play: uiAssets[13].src,
    end: uiAssets[14].src,
  },
  ornaments: {
    divider: uiAssets[15].src,
    diamond: uiAssets[16].src,
  },
} as const;

/** Fixed design-space regions for the 1024 × 1536 HUD panel. */
export const hudLayout = {
  width: 1024,
  height: 1536,
  regions: {
    stats: { x: 56, y: 40, width: 912, height: 168 },
    commands: { x: 56, y: 222, width: 912, height: 218 },
    cards: { x: 56, y: 464, width: 912, height: 714 },
    actions: { x: 56, y: 1204, width: 912, height: 276 },
  },
} as const;
