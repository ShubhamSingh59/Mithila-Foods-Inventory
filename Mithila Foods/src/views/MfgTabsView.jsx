import React, { useState } from "react";

import StockManufactureEntry from "../Components/StockTransfer/StockManufactureEntry";
import StockReconciliation from "../Components/StockTransfer/StockReconciliation";
import StockTransfer from "../Components/StockTransfer/StockTransfer";
import OpeningStockEntry from "../Components/StockTransfer/OpeningStockEntry";
import StockReconciliationList from "../Components/StockTransfer/StockReconciliationList";

const MFG_TABS = {
  MANUFACTURE: "MANUFACTURE",
  RECON: "RECON",
  TRANSFER: "TRANSFER",
  OPENING: "OPENING",
  RECON_LIST: "RECON_LIST",
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
           <button
            type="button"
            className={`mfg-tab ${mfgTab === MFG_TABS.OPENING ? "active" : ""}`}
            onClick={() => setMfgTab(MFG_TABS.OPENING)}
          >
            Opening Stock
          </button>
          <button
            type="button"
            className={`mfg-tab ${mfgTab === MFG_TABS.RECON_LIST ? "active" : ""}`}
            onClick={() => setMfgTab(MFG_TABS.RECON_LIST)}
          >
            Stock Reconciliation List
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
      <div className="app-panel" style={{ display: mfgTab === MFG_TABS.OPENING ? "block" : "none" }}>
        <OpeningStockEntry/>
      </div>
       <div className="app-panel" style={{ display: mfgTab === MFG_TABS.RECON_LIST ? "block" : "none" }}>
        <StockReconciliationList />
      </div>
    </>
  );
}
