import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://slot-battle.qaws936936.chatgpt.site"),
  title: "拉霸 Battle｜3×3 卡片戰鬥",
  description: "九格拉霸生成卡片，出牌累積攻防、消耗卡片使用技能，並以剩餘 AP 保留手牌。",
  openGraph: {
    title: "拉霸戰鬥",
    description: "拉霸取得卡片，出牌、施放技能、保留手牌，探索遺跡與奇遇。",
    url: "/",
    siteName: "拉霸戰鬥",
    locale: "zh_TW",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "拉霸戰鬥：投入行動點，擊破遺跡守衛" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "拉霸戰鬥",
    description: "拉霸取得卡片，出牌、施放技能、保留手牌，探索遺跡與奇遇。",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}
