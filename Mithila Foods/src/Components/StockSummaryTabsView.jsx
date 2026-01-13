// src/Components/StockSummaryTabsView.jsx
import React, { useState } from "react";

import DailyStockSummary from "./DailyStockSummary";
import OtherItemsStockSummary from "./OtherItemsStockSummary";

const STOCK_TABS = {
  RM_PRODUCTS: "RM_PRODUCTS",
  OTHER_ITEMS: "OTHER_ITEMS",
};

export default function StockSummaryTabsView() {
  const [tab, setTab] = useState(STOCK_TABS.RM_PRODUCTS);

  return (
    <>
      {/* Tabs header */}
      <div className="app-panel" style={{ paddingBottom: 12 }}>
        <div className="mfg-tabs">
          <button
            type="button"
            className={`mfg-tab ${tab === STOCK_TABS.RM_PRODUCTS ? "active" : ""}`}
            onClick={() => setTab(STOCK_TABS.RM_PRODUCTS)}
          >
            Raw + Products Summary
          </button>

          <button
            type="button"
            className={`mfg-tab ${tab === STOCK_TABS.OTHER_ITEMS ? "active" : ""}`}
            onClick={() => setTab(STOCK_TABS.OTHER_ITEMS)}
          >
            Other Items Summary
          </button>
        </div>
      </div>

      {/* Keep all mounted */}
      <div className="app-panel" style={{ display: tab === STOCK_TABS.RM_PRODUCTS ? "block" : "none" }}>
        <DailyStockSummary />
      </div>

      <div className="app-panel" style={{ display: tab === STOCK_TABS.OTHER_ITEMS ? "block" : "none" }}>
        <OtherItemsStockSummary />
      </div>
    </>
  );
}
