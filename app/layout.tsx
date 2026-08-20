import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://slot-battle.qaws936936.chatgpt.site"),
  title: "拉霸戰鬥｜瀏覽器單人 Boss 戰",
  description: "每次拉霸立即攻擊或疊甲，累積法力並在回合中自由施放三種技能，擊破遺跡守衛。",
  openGraph: {
    title: "拉霸戰鬥",
    description: "即時攻擊、疊甲與技能決策，擊破遺跡守衛。",
    url: "/",
    siteName: "拉霸戰鬥",
    locale: "zh_TW",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "拉霸戰鬥：投入行動點，擊破遺跡守衛" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "拉霸戰鬥",
    description: "即時攻擊、疊甲與技能決策，擊破遺跡守衛。",
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
