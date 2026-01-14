// src/SalesReturnTabsView.jsx
import React, { useState } from "react";
import SalesReturn from "./SalesReturn";
import SalesReturnSummary from "./SalesReturnSummary";

const TABS = {
  RETURNS: "RETURNS",
  SUMMARY: "SUMMARY",
};

export default function SalesReturnTabsView() {
  const [tab, setTab] = useState(TABS.RETURNS);

  return (
    <>
      {/* Tabs header */}
      <div className="app-panel" style={{ paddingBottom: 12 }}>
        <div className="mfg-tabs">
          <button
            type="button"
            className={`mfg-tab ${tab === TABS.RETURNS ? "active" : ""}`}
            onClick={() => setTab(TABS.RETURNS)}
          >
            Sales Returns
          </button>

          <button
            type="button"
            className={`mfg-tab ${tab === TABS.SUMMARY ? "active" : ""}`}
            onClick={() => setTab(TABS.SUMMARY)}
          >
            Returns Summary
          </button>
        </div>
      </div>

      {/* Keep both mounted */}
      <div className="app-panel" style={{ display: tab === TABS.RETURNS ? "block" : "none" }}>
        <SalesReturn />
      </div>

      <div className="app-panel" style={{ display: tab === TABS.SUMMARY ? "block" : "none" }}>
        <SalesReturnSummary />
      </div>
    </>
  );
}
