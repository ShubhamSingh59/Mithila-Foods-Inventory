import React, { useState } from "react";

import StockManufactureEntry from "./StockManufactureEntry";
import StockReconciliation from "./StockReconciliation";
import StockTransfer from "./StockTransfer";

const MFG_TABS = {
  MANUFACTURE: "MANUFACTURE",
  RECON: "RECON",
  TRANSFER: "TRANSFER",
};

export default function MfgTabsView() {
  const [mfgTab, setMfgTab] = useState(MFG_TABS.MANUFACTURE);

  return (
    <>
      {/* Tabs header */}
      <div className="app-panel" style={{ paddingBottom: 12 }}>
        <div className="mfg-tabs">
          <button
            type="button"
            className={`mfg-tab ${mfgTab === MFG_TABS.MANUFACTURE ? "active" : ""}`}
            onClick={() => setMfgTab(MFG_TABS.MANUFACTURE)}
          >
            Manufacture Entry
          </button>

          <button
            type="button"
            className={`mfg-tab ${mfgTab === MFG_TABS.RECON ? "active" : ""}`}
            onClick={() => setMfgTab(MFG_TABS.RECON)}
          >
            Stock Reconciliation
          </button>

          <button
            type="button"
            className={`mfg-tab ${mfgTab === MFG_TABS.TRANSFER ? "active" : ""}`}
            onClick={() => setMfgTab(MFG_TABS.TRANSFER)}
          >
            Stock Transfer
          </button>
        </div>
      </div>

      {/* Keep all mounted (same as your App.jsx) */}
      <div className="app-panel" style={{ display: mfgTab === MFG_TABS.MANUFACTURE ? "block" : "none" }}>
        <StockManufactureEntry />
      </div>

      <div className="app-panel" style={{ display: mfgTab === MFG_TABS.RECON ? "block" : "none" }}>
        <StockReconciliation />
      </div>

      <div className="app-panel" style={{ display: mfgTab === MFG_TABS.TRANSFER ? "block" : "none" }}>
        <StockTransfer />
      </div>
    </>
  );
}
