"use client";

import { cardArt } from "../battle/presentation.ts";
import { uiAssets, type UiAsset } from "./ui-assets.ts";
import "./ui-library.css";

const categories: { id: UiAsset["category"]; label: string; note: string }[] = [
  { id: "panel", label: "01 面板", note: "區域底板；不含文字與互動內容" },
  { id: "button", label: "02 按鈕", note: "同一套尺寸比例，文字由程式疊加" },
  { id: "icon", label: "03 資源與操作圖示", note: "透明 PNG；第一排固定包含傷害、護甲、AP、金幣" },
  { id: "ornament", label: "04 裝飾", note: "只做分區與節奏，不承擔功能" },
];

const baseUrl = import.meta.env.BASE_URL;

export function UiLibrary() {
  return <main className="ui-library">
    <header className="ui-library-header">
      <div>
        <p>SLOT BATTLE · ART SYSTEM</p>
        <h1>戰鬥介面 UI 資產庫</h1>
        <span>點陣圖片元件 · 透明 PNG · 無內嵌文字</span>
      </div>
      <a href={baseUrl}>返回遊戲</a>
    </header>

    <section className="ui-library-rules" aria-label="資產規則">
      <div><b>固定區塊</b><span>數值 → 物品／技能 → 卡片 → 行動</span></div>
      <div><b>縮放方式</b><span>固定高度，等比例縮放</span></div>
      <div><b>程式責任</b><span>文字、數值、狀態與點擊範圍</span></div>
      <div><b>圖片責任</b><span>框體、材質、圖示與裝飾</span></div>
    </section>

    {categories.map((category) => <section className="ui-library-section" key={category.id}>
      <header><h2>{category.label}</h2><p>{category.note}</p></header>
      <div className={`ui-asset-grid category-${category.id}`}>
        {uiAssets.filter((item) => item.category === category.id).map((item) => <article className="ui-asset-card" key={item.id}>
          <div className="ui-asset-preview"><img src={item.src} alt="" /></div>
          <div className="ui-asset-meta">
            <h3>{item.name}</h3>
            <code>{item.file}</code>
            <dl><div><dt>原始</dt><dd>{item.native}</dd></div><div><dt>展示</dt><dd>{item.display}</dd></div></dl>
            <p>{item.usage}</p>
          </div>
        </article>)}
      </div>
    </section>)}

    <section className="ui-library-section">
      <header><h2>05 既有卡片素材</h2><p>維持目前定案，不在這一輪重畫</p></header>
      <div className="card-asset-row">
        <figure><img src={cardArt.base} alt="空白卡片底圖" /><figcaption>card-base.png</figcaption></figure>
        {Object.entries(cardArt.symbols).map(([id, src]) => <figure key={id}><img src={src} alt="" /><figcaption>{src.split("/").pop()}</figcaption></figure>)}
      </div>
    </section>
  </main>;
}
