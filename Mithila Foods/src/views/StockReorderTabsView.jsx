// src/views/StockReorderTabsView.jsx
import React, { useState } from "react";

// Import our two separated reorder components
import StockReorder from "../Components/StockReorder/StockReorder";
import OtherReorder from "../Components/StockReorder/OtherReorder";

const REORDER_TABS = {
  RM_PRODUCTS: "RM_PRODUCTS",
  OTHER_ITEMS: "OTHER_ITEMS",
};

export default function StockReorderTabsView() {
  const [tab, setTab] = useState(REORDER_TABS.RM_PRODUCTS);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>

      {/* Tabs Header */}
      <div className="theme-tabs">
        <button
          type="button"
          className={`theme-tab-btn ${tab === REORDER_TABS.RM_PRODUCTS ? "active" : ""}`}
          onClick={() => setTab(REORDER_TABS.RM_PRODUCTS)}
        >
          Raw + Products Reorder
        </button>

        <button
          type="button"
          className={`theme-tab-btn ${tab === REORDER_TABS.OTHER_ITEMS ? "active" : ""}`}
          onClick={() => setTab(REORDER_TABS.OTHER_ITEMS)}
        >
          Other Items Reorder
        </button>
      </div>
      <div style={{ display: tab === REORDER_TABS.RM_PRODUCTS ? "block" : "none", flex: 1 }}>
        <StockReorder />
      </div>

      <div style={{ display: tab === REORDER_TABS.OTHER_ITEMS ? "block" : "none", flex: 1 }}>
        <OtherReorder />
      </div>
      
    </div>
  );
}