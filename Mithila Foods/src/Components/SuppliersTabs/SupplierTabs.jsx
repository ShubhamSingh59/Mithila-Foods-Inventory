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
    <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: "20px" }}>
      
      {/* Tabs Header Row - Inline CSS for positioning */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", paddingBottom: "10px", borderBottom: "1px solid #e2e8f0" }}>
        <div className="mfg-tabs">
          <button
            type="button"
            className={`mfg-tab ${tab === TABS.SUPPLIERS ? "active" : ""}`}
            onClick={() => setTab(TABS.SUPPLIERS)}
          >
            List And Overview
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

      {/* Content Area */}
      <div style={{ flex: 1, width: "100%" }}>
        {/* Keep both mounted */}
        <div style={{ display: tab === TABS.SUPPLIERS ? "block" : "none" }}>
          <SupplierPanel/>
        </div>

        <div style={{ display: tab === TABS.ANALYTICS ? "block" : "none" }}>
          <SupplierAnalytics/>
        </div>
      </div>
    </div>
  );
}