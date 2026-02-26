// src/views/StockSummaryTabsView.jsx
import React, { useState } from "react";

import DailyStockSummary from "../Components/ProductSummary/DailyStockSummary";
import OtherItemsStockSummary from "../Components/ProductSummary/OtherItemsStockSummary";

const STOCK_TABS = {
  RM_PRODUCTS: "RM_PRODUCTS",
  OTHER_ITEMS: "OTHER_ITEMS",
};

export default function StockSummaryTabsView() {
  const [tab, setTab] = useState(STOCK_TABS.RM_PRODUCTS);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
      {/* ✅ 1. Removed .app-panel wrapper
        ✅ 2. Using the clean .theme-tabs class 
      */}
      <div className="theme-tabs">
        <button
          type="button"
          className={`theme-tab-btn ${tab === STOCK_TABS.RM_PRODUCTS ? "active" : ""}`}
          onClick={() => setTab(STOCK_TABS.RM_PRODUCTS)}
        >
          Raw + Products Summary
        </button>

        <button
          type="button"
          className={`theme-tab-btn ${tab === STOCK_TABS.OTHER_ITEMS ? "active" : ""}`}
          onClick={() => setTab(STOCK_TABS.OTHER_ITEMS)}
        >
          Other Items Summary
        </button>
      </div>

      {/* ✅ Removed .app-panel wrappers around the components so they 
           can sit flush against the edges of the main window.
      */}
      <div style={{ display: tab === STOCK_TABS.RM_PRODUCTS ? "block" : "none", flex: 1 }}>
        <DailyStockSummary />
      </div>

      <div style={{ display: tab === STOCK_TABS.OTHER_ITEMS ? "block" : "none", flex: 1 }}>
        <OtherItemsStockSummary />
      </div>
    </div>
  );
}