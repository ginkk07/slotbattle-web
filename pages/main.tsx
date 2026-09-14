import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import SlotBattle from "../app/page";

// The Pages Router bundle can be imported during the server build. Mount only
// in a browser; the App Router owns the server-rendered `/` entry point.
if (typeof document !== "undefined") {
  const root = document.getElementById("root");
  if (!root) throw new Error("找不到遊戲掛載節點");
  createRoot(root).render(
    <StrictMode>
      <SlotBattle />
    </StrictMode>,
  );
}
