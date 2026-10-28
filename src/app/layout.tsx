import {GameVersion} from "./game-version";
import type { Metadata } from "next";
import {Suspense} from "react";
import {TileEffectTooltip} from "./tile-effect-tooltip";
import {DesignProvider} from './design-settings';
import "./globals.css";
import "./game-screen.css";
import "./tile-help.css";
import "./board-surfaces.css";
export const metadata: Metadata = {
  title: "Burgundy Expanded | 나만의 영지를 완성하세요",
  description: "부르고뉴에서 영감을 받은 한국어 전략 보드게임 인터랙티브 데모",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><DesignProvider>{children}<Suspense fallback={null}><TileEffectTooltip/><GameVersion/></Suspense></DesignProvider></body></html>;
}
