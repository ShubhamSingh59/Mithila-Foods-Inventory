// src/SupplierTabs.jsx
import React, { useState } from "react"; 
import SupplierPanel from "../SupplierAndTransporter/SupplierPanel";
import SupplierAnalytics from "../SupplierAnalytics/SupplierAnalytics";

const TABS = {
  SUPPLIERS: "SUPPLIERS",
  ANALYTICS: "ANALYTICS",
};

export default function SupplierTabs() {
  const [tab, setTab] = useState(TABS.SUPPLIERS);

  return (
    <>
      {/* Tabs header */}
      <div className="app-panel" style={{ paddingBottom: 12 }}>
        <div className="mfg-tabs">
          <button
            type="button"
            className={`mfg-tab ${tab === TABS.SUPPLIERS ? "active" : ""}`}
            onClick={() => setTab(TABS.SUPPLIERS)}
          >
            Suppliers
          </button>

          <button
            type="button"
            className={`mfg-tab ${tab === TABS.ANALYTICS ? "active" : ""}`}
            onClick={() => setTab(TABS.ANALYTICS)}
          >
            Analytics
          </button>
        </div>
      </div>

      {/* Keep both mounted */}
      <div className="app-panel" style={{ display: tab === TABS.SUPPLIERS ? "block" : "none" }}>
        <SupplierPanel/>
      </div>

      <div className="app-panel" style={{ display: tab === TABS.ANALYTICS ? "block" : "none" }}>
        <SupplierAnalytics/>
      </div>
    </>
  );
}
