// src/views/SalesReturnTabsView.jsx
import React, { useState } from "react"; 
import SalesReturnSummary from "../Components/SalesReturn/SalesReturnSummary";
import SalesReturn from "../Components/SalesReturn/SalesReturn";

const TABS = {
  RETURNS: "RETURNS",
  SUMMARY: "SUMMARY",
};

export default function SalesReturnTabsView() {
  const [tab, setTab] = useState(TABS.RETURNS);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
      
      {/* ✅ 1. Removed .app-panel wrapper to kill the giant white box
          ✅ 2. Using .theme-tabs and .theme-tab-btn to pull them to the left 
      */}
      <div className="theme-tabs">
        <button
          type="button"
          className={`theme-tab-btn ${tab === TABS.RETURNS ? "active" : ""}`}
          onClick={() => setTab(TABS.RETURNS)}
        >
          Sales Returns
        </button>

        <button
          type="button"
          className={`theme-tab-btn ${tab === TABS.SUMMARY ? "active" : ""}`}
          onClick={() => setTab(TABS.SUMMARY)}
        >
          Returns Summary
        </button>
      </div>

      {/* ✅ 3. Removed .app-panel wrappers around the components so they 
             can handle their own clean layout.
      */}
      <div style={{ display: tab === TABS.RETURNS ? "block" : "none", flex: 1 }}>
        <SalesReturn/>
      </div>

      <div style={{ display: tab === TABS.SUMMARY ? "block" : "none", flex: 1 }}>
        <SalesReturnSummary/>
      </div>
      
    </div>
  );
}