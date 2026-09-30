import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { mountReelhouse } from "./reelhouse";
import "./style.css";

function ReelhouseShell() {
  useEffect(() => {
    mountReelhouse();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return (
    <>
      <header id="nav">
        <span className="logo">Reelhouse</span>
        <span className="sp" />
        <button className="btn" id="dice" title="Open a random top-rated movie">
          <span>🎲</span> Surprise me
        </button>
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
