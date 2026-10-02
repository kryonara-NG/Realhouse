import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { mountReelhouse } from "./reelhouse";
import "./style.css";

function ReelhouseShell() {
  useEffect(() => {
    document.documentElement.classList.add("app-booting");
    const splash = document.getElementById("appSplash");
    const hideSplash = () => {
      splash?.classList.add("hide");
      document.documentElement.classList.remove("app-booting");
      setTimeout(() => splash?.remove(), 650);
    };
    const reportBootFailure = (error) => {
      console.error("[Reelhouse boot]", error);
      const view = document.getElementById("view");
      if (view && !view.innerHTML.trim()) {
        view.innerHTML = '<div class="pg"><div class="empty"><b>Reelhouse could not finish starting.</b><br><small>Refresh once. If this keeps happening, the app will show the diagnostic details in the browser console.</small></div></div>';
      }
      hideSplash();
    };

    try {
      mountReelhouse();
    } catch (error) {
      reportBootFailure(error);
    }


    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(error => console.warn("[Reelhouse SW]", error));
    }

    const t = setTimeout(hideSplash, 1200);
    window.addEventListener("load", hideSplash, { once: true });
    window.addEventListener("error", reportBootFailure, { once: true });
    window.addEventListener("unhandledrejection", event => reportBootFailure(event.reason), { once: true });

    return () => {
      clearTimeout(t);
      window.removeEventListener("load", hideSplash);
      window.removeEventListener("error", reportBootFailure);
    };
  }, []);

  return (
    <>
      <div id="appSplash" className="app-splash" aria-hidden="true">
        <div className="splash-mark">R</div>
        <div className="splash-word">REELHOUSE</div>
        <div className="splash-line">Lights down. Movie on.</div>
        <div className="splash-loader"><span /></div>
      </div>
      <header id="nav">
        <span className="logo">Reelhouse</span>
        <span className="sp" />
        <div className="nav-actions" aria-label="Quick actions">
          <button className="btn nav-surprise" id="dice" title="Open a random top-rated movie">
            <span aria-hidden="true">🎲</span><span>Surprise me</span>
          </button>
        </div>
      </header>
      <nav id="tab" aria-label="Main">
        <a href="#/home" data-r="home"><svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg><span>Home</span></a>
        <a href="#/search" data-r="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg><span>Search</span></a>
        <a href="#/list" data-r="list"><svg viewBox="0 0 24 24"><path d="M5 3h14v18l-7-5-7 5z" /></svg><span>Library</span></a>
        <a href="#/me" data-r="me"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" /></svg><span>Me</span></a>
      </nav>
      <main id="view" />
      <div className="ov" id="modal" />
      <div className="ov" id="sheet" />
      <div className="ov" id="notifications" aria-hidden="true" />
      <div className="welcome-modal" id="welcomeModal" aria-hidden="true">
        <div className="welcome-backdrop" data-welcome-close />
        <section className="welcome-sheet" role="dialog" aria-modal="true" aria-labelledby="welcomeTitle">
          <button className="welcome-close" data-welcome-close aria-label="Close welcome message">×</button>
          <div className="welcome-art">
            <img src="https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=82" alt="" />
            <div className="welcome-art-copy"><span>REELHOUSE</span><b>Lights down.<br/>Movie on.</b></div>
          </div>
          <div className="welcome-copy">
            <p className="welcome-kicker">WELCOME IN</p>
            <h2 id="welcomeTitle">Your next watch is already waiting.</h2>
            <p>Find something good, save the stuff you want to come back to, and pick up right where you left off. No tour. Just come in.</p>
            <button className="btn pri welcome-enter" data-welcome-enter>Enter Reelhouse</button>
          </div>
        </section>
      </div>
      <div id="bar" />
      <div id="toast" />
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <HashRouter>
    <ReelhouseShell />
  </HashRouter>
);
