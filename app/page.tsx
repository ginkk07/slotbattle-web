"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Battle, BattleSetup, Command } from "../game/model.ts";
import type { Adventure, AdventureCommand, AdventureSetup as RunSetup } from "../game/adventure/model.ts";
import { catalog } from "../game/data/catalog.ts";
import { adventureRules } from "../game/data/adventure.ts";
import { createBattle, dispatch } from "../game/battle.ts";
import { createAdventure, dispatchAdventure } from "../game/adventure/engine.ts";
import { newSave, restoreAdventure, saveKey, type Save } from "../game/adventure/save.ts";
import { BattleView } from "../components/battle/BattleView.tsx";
import { Setup } from "../components/battle/Setup.tsx";
import { AdventureSetup } from "../components/battle/AdventureSetup.tsx";
import { AdventurePanel, RunProgress } from "../components/battle/AdventurePanel.tsx";
import { Modal } from "../components/ui/Modal.tsx";
import { UiLibrary } from "../components/ui/UiLibrary.tsx";

const subscribeToClient = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export default function Home() {
  const loaded = useSyncExternalStore(subscribeToClient, clientSnapshot, serverSnapshot);
  // Initialize browser storage after hydration, while keeping the server shell identical.
  if (loaded && new URLSearchParams(window.location.search).get("ui") === "library") return <UiLibrary />;
  return <HomeContent key={loaded ? "client" : "server"} loaded={loaded} />;
}

function HomeContent({ loaded }: { loaded: boolean }) {
  const [initialSave] = useState(() => {
    try {
      const raw = loaded ? window.localStorage.getItem(saveKey) : null;
      const restored = raw ? restoreAdventure(raw, catalog, adventureRules) : null;
      return { run: restored?.state ?? null, journal: restored?.save ?? null, error: "" };
    } catch {
      return { run: null, journal: null, error: "無法載入先前存檔，可重新開始冒險。" };
    }
  });
  const [run, setRun] = useState<Adventure | null>(initialSave.run);
  const [journal, setJournal] = useState<Save | null>(initialSave.journal);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [sandbox, setSandbox] = useState(false);
  const [error, setError] = useState(initialSave.error);
  const [showReset, setShowReset] = useState(false);
  const currentBattle = run?.phase === "battle" ? run.battle : battle;
  const hasCurrentBattle = !!currentBattle;

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [run?.phase, run?.encounter?.id, sandbox, hasCurrentBattle]);

  function persist(save: Save | null) {
    try { if (save) window.localStorage.setItem(saveKey, JSON.stringify(save)); else window.localStorage.removeItem(saveKey); }
    catch { setError("此瀏覽器無法儲存進度，本次仍可繼續遊玩。"); }
  }
  function startRun(setup: RunSetup) {
    try {
      const next = createAdventure(setup, catalog, adventureRules);
      const save = newSave(setup);
      setRun(next); setJournal(save); setBattle(null); setError(""); persist(save);
    } catch (exception) { setError(exception instanceof Error ? exception.message : "無法開始冒險"); }
  }
  function sendRun(command: AdventureCommand): string | undefined {
    if (!run || !journal) return "目前沒有進行中的冒險";
    const result = dispatchAdventure(run, command, catalog, adventureRules);
    setError(result.error ?? "");
    if (result.error) return result.error;
    const save = { ...journal, commands: [...journal.commands, command] };
    setRun(result.state); setJournal(save); persist(save);
  }
  function startBattle(setup: BattleSetup) {
    try { setBattle(createBattle(setup, catalog)); setError(""); }
    catch (exception) { setError(exception instanceof Error ? exception.message : "無法開始戰鬥"); }
  }
  function sendBattle(command: Command): string | undefined {
    if (run) return sendRun({ type: "battle", command });
    if (!battle) return "沒有進行中的戰鬥";
    const result = dispatch(battle, command, catalog);
    setError(result.error ?? "");
    if (!result.error) setBattle(result.state);
    return result.error;
  }
  function reset() {
    setRun(null); setJournal(null); setBattle(null); setSandbox(false); setError(""); setShowReset(false); persist(null);
  }

  return <main className={`site-shell ${currentBattle ? "is-battle" : "is-adventure"} ${!run && !battle && !sandbox ? "is-opening" : ""}`}>
    <header className="topbar"><div className="brand"><span className="brand-mark">SB</span><div><h1>SLOT<span>BATTLE</span></h1><p>拉霸 Battle · {sandbox ? "戰鬥測試" : "遺跡冒險"}</p></div></div><div className="header-right">{(run || battle) && !showReset && <button type="button" className="quiet" onClick={() => setShowReset(true)}>重新開始</button>}</div></header>
    {error && <div className="error-message" role="alert">{error}</div>}
    <Modal open={showReset} title="重新開始冒險？" onClose={() => setShowReset(false)} className="reset-modal"><p>目前的冒險將會結束，回到出發準備。</p><div className="button-row"><button type="button" onClick={() => setShowReset(false)}>繼續遊玩</button><button type="button" className="primary" onClick={reset}>重新開始</button></div></Modal>
    {!loaded ? <section className="panel"><p>載入冒險…</p></section> : <>
      {!run && !battle && (sandbox ? <><button type="button" className="quiet" onClick={() => setSandbox(false)}>← 返回冒險</button><Setup catalog={catalog} onStart={startBattle} /></> : <AdventureSetup catalog={catalog} rules={adventureRules} onStart={startRun} onSandbox={() => setSandbox(true)} />)}
      {run && <RunProgress state={run} catalog={catalog} rules={adventureRules} />}
      {currentBattle && <BattleView state={currentBattle} catalog={catalog} onCommand={sendBattle} error={error} onComplete={() => { if (run) sendRun({ type: "settleBattle" }); else setBattle(null); }} completionLabel={run ? currentBattle.outcome === "victory" ? "領取戰利品" : "查看冒險結果" : "重新配置"} />}
      {run && run.phase !== "battle" && <AdventurePanel state={run} catalog={catalog} rules={adventureRules} onCommand={sendRun} onRestart={reset} error={error} />}
    </>}
    <footer><span>冒險進度會自動保存在此瀏覽器</span></footer>
  </main>;
}
