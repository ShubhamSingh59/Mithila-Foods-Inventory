// src/SupplierTabs.jsx
import React, { useState } from "react"; 
import SupplierPanel from "../SupplierAndTransporter/SupplierPanel";
import SupplierAnalytics from "../SupplierAnalytics/SupplierAnalytics";
import ItemAnalyticsDashboard from "../Analytics/ItemAnalyticsDashboard";
import SupplierTracker from "../SupplierAnalytics/SupplierTracker";
const TABS = {
  SUPPLIERS: "SUPPLIERS",
  ANALYTICS: "ANALYTICS",
  ITEM_360: "ITEM_360", 
  TRACKER: "TRACKER",
};

export default function SupplierTabs() {
  const [tab, setTab] = useState(TABS.SUPPLIERS);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: "20px" }}>
      
      {/* Tabs Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", paddingBottom: "10px", borderBottom: "1px solid #e2e8f0" }}>
        <div className="mfg-tabs">
          <button
            type="button"
            className={`mfg-tab ${tab === TABS.SUPPLIERS ? "active" : ""}`}
            onClick={() => setTab(TABS.SUPPLIERS)}
          >
            Suppliers List
          </button>

          <button
            type="button"
            className={`mfg-tab ${tab === TABS.ANALYTICS ? "active" : ""}`}
            onClick={() => setTab(TABS.ANALYTICS)}
          >
            Dashboard Analytics
          </button>

          <button
            type="button"
            className={`mfg-tab ${tab === TABS.ITEM_360 ? "active" : ""}`}
            onClick={() => setTab(TABS.ITEM_360)}
          >
            Item 360° (Negotiator)
          </button>
          <button
            type="button"
            className={`mfg-tab ${tab === TABS.TRACKER ? "active" : ""}`}
            onClick={() => setTab(TABS.TRACKER)}
          >
            TRACKER
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, width: "100%" }}>
        
        {/* Suppliers List Panel */}
        <div style={{ display: tab === TABS.SUPPLIERS ? "block" : "none" }}>
          <SupplierPanel/>
        </div>

        {/* General Analytics Dashboard */}
        <div style={{ display: tab === TABS.ANALYTICS ? "block" : "none" }}>
          <SupplierAnalytics/>
        </div>

        <div style={{ display: tab === TABS.ITEM_360 ? "block" : "none" }}>
          <ItemAnalyticsDashboard/>
        </div>

         <div style={{ display: tab === TABS.TRACKER ? "block" : "none" }}>
          <SupplierTracker/>
        </div>

      </div>
    </div>
  );
}