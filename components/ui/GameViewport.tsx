"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import "./game-viewport.css";

export const GAME_WIDTH = 450;
export const GAME_HEIGHT = 800;

/** One game coordinate system; the viewport only changes its uniform scale. */
export function gameViewportScale(width: number, height: number): number {
  return Math.max(0, Math.min(width / GAME_WIDTH, height / GAME_HEIGHT));
}

export function GameViewport({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(gameViewportScale(entry.contentRect.width, entry.contentRect.height));
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);

  return <div ref={viewport} className="game-viewport" style={{ "--game-scale": scale } as CSSProperties}>
    <div className="game-frame" style={{ width: GAME_WIDTH * scale, height: GAME_HEIGHT * scale }}>
      <div className="game-canvas" data-design-width={GAME_WIDTH} data-design-height={GAME_HEIGHT}>{children}</div>
    </div>
  </div>;
}
