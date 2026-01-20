// src/App.jsx
import React, { useEffect, useState } from "react";

// ------------------------------
// Screens (main pages shown inside the layout)
// ------------------------------
import PurchaseOrderView from "./views/PurchaseOrderView";
import Analytics from "./Components/Analytics";
import MfWorkflow from "./Components/MfWorkflow/MfWorkflow";

// MFG and Stock views (tabs based screens)
import MfgTabsView from "./views/MfgTabsView";
import StockSummaryTabsView from "./views/StockSummaryTabsView";
import StockReorder from "./Components/StockReorder/StockReorder";

// Sales views
import SalesReturnTabsView from "./views/SalesReturnTabsView";
import SalesOrderView from "./views/SalesOrderView";

// Supplier view
import SupplierTabView from "./views/SupplierTabView";

// ------------------------------
// CSS for overall shell layout and tabs styling
// ------------------------------
import "./App.css";

// ------------------------------
// App view keys
// These values decide which screen is active in the main area.
// ------------------------------
const VIEWS = {
  DAILY_STOCK: "DAILY_STOCK",
  STOCK_REORDER: "STOCK_REORDER",
  PURCHASE: "PURCHASE",
  MFG: "MFG",
  SUPPLIERS: "SUPPLIERS",
  //OPENING_STOCK: "OPENING_STOCK",
  WORK_ORDER_FLOW: "WORK_ORDER_FLOW",
  WO_TRACKING: "WO_TRACKING",
  ANALYTICS: "ANALYTICS",
  SALES: "SALES",
  SALES_RETURN: "SALES_RETURN",
  MF_WORKFLOW: "MF_WORKFLOW",
};

function App() {
  // ------------------------------
  // activeView decides what is currently visible in main content
  // ------------------------------
  const [activeView, setActiveView] = useState(VIEWS.DAILY_STOCK);

  // ------------------------------
  // mountedViews keeps track of views already opened once.
  // This is used so screens stay mounted in memory
  // and we just hide them using display:none.
  // ------------------------------
  const [mountedViews, setMountedViews] = useState([VIEWS.DAILY_STOCK]);

  // ------------------------------
  // When user clicks sidebar option:
  // 1) set activeView
  // 2) if this view was never opened before, add to mountedViews
  // ------------------------------
  const handleViewChange = (view) => {
    setActiveView(view);
    setMountedViews((prev) => (prev.includes(view) ? prev : [...prev, view]));
  };

  // Helpers for readability in JSX
  const isMounted = (view) => mountedViews.includes(view);
  const isActive = (view) => activeView === view;

  // ------------------------------
  // On first load:
  // If URL contains ?view=PURCHASE or PO quick-create params,
  // automatically open Purchase view.
  // Example URL:
  //   ?view=PURCHASE
  //   ?itemCode=...&qty=...&warehouse=...
  // ------------------------------
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const viewParam = params.get("view");
    const hasPOParams =
      params.get("itemCode") || params.get("qty") || params.get("warehouse");

    if (viewParam === "PURCHASE" || hasPOParams) {
      handleViewChange(VIEWS.PURCHASE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app-shell">
      {/* ==============================
          LEFT SIDEBAR
         ============================== */}
      <aside className="app-sidebar">
        {/* Sidebar header / branding */}
        <div className="app-sidebar-header">
          <div className="app-logo-circle">S</div>
          <div className="app-logo-text">
            <div className="app-logo-title">Stock & Supplier</div>
            <div className="app-logo-subtitle">ERPNext Console</div>
          </div>
        </div>

        {/* Sidebar navigation groups */}
        <nav className="app-nav">
          {/* 1) Stock tracker group */}
          <div className="app-nav-group">
            <div className="app-nav-group-label">Stock tracker</div>

            <button
              type="button"
              className={
                "app-nav-link" + (activeView === VIEWS.DAILY_STOCK ? " active" : "")
              }
              onClick={() => handleViewChange(VIEWS.DAILY_STOCK)}
            >
              <span className="app-nav-dot app-nav-dot-blue" />
              Daily Stock Summary
            </button>

            <button
              type="button"
              className={
                "app-nav-link" + (activeView === VIEWS.STOCK_REORDER ? " active" : "")
              }
              onClick={() => handleViewChange(VIEWS.STOCK_REORDER)}
            >
              <span className="app-nav-dot app-nav-dot-amber" />
              Stock Reorder
            </button>
          </div>

          {/* 2) Purchase group */}
          <div className="app-nav-group">
            <div className="app-nav-group-label">Purchase</div>

            <button
              type="button"
              className={
                "app-nav-link" + (activeView === VIEWS.PURCHASE ? " active" : "")
              }
              onClick={() => handleViewChange(VIEWS.PURCHASE)}
            >
              <span className="app-nav-dot app-nav-dot-green" />
              Purchase Orders
            </button>
          </div>

          {/* 3) Sales group */}
          <div className="app-nav-group">
            <div className="app-nav-group-label">Sales</div>

            <button
              type="button"
              className={"app-nav-link" + (isActive(VIEWS.SALES) ? " active" : "")}
              onClick={() => handleViewChange(VIEWS.SALES)}
            >
              <span className="app-nav-dot app-nav-dot-pink" />
              Sales
            </button>

            <button
              type="button"
              className={
                "app-nav-link" + (isActive(VIEWS.SALES_RETURN) ? " active" : "")
              }
              onClick={() => handleViewChange(VIEWS.SALES_RETURN)}
            >
              <span className="app-nav-dot app-nav-dot-amber" />
              Sales Return
            </button>
          </div>

          {/* 4) Manufacturing & Adjustments group */}
          <div className="app-nav-group">
            <div className="app-nav-group-label">Manufacturing & Adjustments</div>

            <button
              type="button"
              className={"app-nav-link" + (activeView === VIEWS.MFG ? " active" : "")}
              onClick={() => handleViewChange(VIEWS.MFG)}
            >
              <span className="app-nav-dot app-nav-dot-teal" />
              Packing and Stock Transfer
            </button>

            {/* Work Order Flow and WO Tracking are currently disabled */}
            {/*<button
              type="button"
              className={"app-nav-link" + (isActive(VIEWS.WORK_ORDER_FLOW) ? " active" : "")}
              onClick={() => handleViewChange(VIEWS.WORK_ORDER_FLOW)}
            >
              <span className="app-nav-dot app-nav-dot-teal" />
              Work Order Flow
            </button>

            <button
              type="button"
              className={"app-nav-link" + (isActive(VIEWS.WO_TRACKING) ? " active" : "")}
              onClick={() => handleViewChange(VIEWS.WO_TRACKING)}
            >
              <span className="app-nav-dot app-nav-dot-blue" />
              WO Tracking
            </button>*/}

            <button
              type="button"
              className={
                "app-nav-link" + (isActive(VIEWS.MF_WORKFLOW) ? " active" : "")
              }
              onClick={() => handleViewChange(VIEWS.MF_WORKFLOW)}
            >
              <span className="app-nav-dot app-nav-dot-purple" />
              MF Workflow
            </button>
          </div>

          {/* 5) Suppliers group */}
          <div className="app-nav-group">
            <div className="app-nav-group-label">Suppliers & Transporters</div>

            <button
              type="button"
              className={
                "app-nav-link" + (activeView === VIEWS.SUPPLIERS ? " active" : "")
              }
              onClick={() => handleViewChange(VIEWS.SUPPLIERS)}
            >
              <span className="app-nav-dot app-nav-dot-pink" />
              Supplier & Transporter List
            </button>
          </div>

          {/* 6) Analytics group */}
          <div className="app-nav-group">
            <div className="app-nav-group-label">Analytics</div>

            <button
              type="button"
              className={
                "app-nav-link" + (activeView === VIEWS.ANALYTICS ? " active" : "")
              }
              onClick={() => handleViewChange(VIEWS.ANALYTICS)}
            >
              <span className="app-nav-dot app-nav-dot-purple" />
              Company Analytics
            </button>
          </div>
        </nav>

        {/* Sidebar footer */}
        <div className="app-sidebar-footer">
          <div className="app-sidebar-footer-label">Today</div>
          <div className="app-sidebar-footer-badge">Stock & Supplier tracker</div>
        </div>
      </aside>

      {/* ==============================
          MAIN CONTENT
         ============================== */}
      <main className="app-main">
        {/* Daily Stock Summary view */}
        {isMounted(VIEWS.DAILY_STOCK) && (
          <div
            className="app-main-inner"
            style={{ display: isActive(VIEWS.DAILY_STOCK) ? "block" : "none" }}
          >
            <StockSummaryTabsView />
          </div>
        )}

        {/* Stock Reorder view */}
        {isMounted(VIEWS.STOCK_REORDER) && (
          <div
            className="app-main-inner"
            style={{ display: isActive(VIEWS.STOCK_REORDER) ? "block" : "none" }}
          >
            <StockReorder />
          </div>
        )}

        {/* Purchase Orders view */}
        {isMounted(VIEWS.PURCHASE) && (
          <div
            className="app-main-inner app-main-stack"
            style={{ display: isActive(VIEWS.PURCHASE) ? "block" : "none" }}
          >
            <div className="app-panel">
              <PurchaseOrderView />
            </div>
          </div>
        )}

        {/* Sales view */}
        {isMounted(VIEWS.SALES) && (
          <div
            className="app-main-inner app-main-stack"
            style={{ display: isActive(VIEWS.SALES) ? "block" : "none" }}
          >
            <div className="app-panel">
              <SalesOrderView />
            </div>
          </div>
        )}

        {/* Sales Return view */}
        {isMounted(VIEWS.SALES_RETURN) && (
          <div
            className="app-main-inner app-main-stack"
            style={{ display: isActive(VIEWS.SALES_RETURN) ? "block" : "none" }}
          >
            <div className="app-panel app-panel-secondary">
              <SalesReturnTabsView />
            </div>
          </div>
        )}

        {/* Manufacturing tabs view */}
        {isMounted(VIEWS.MFG) && (
          <div
            className="app-main-inner app-main-stack"
            style={{ display: isActive(VIEWS.MFG) ? "block" : "none" }}
          >
            <MfgTabsView />
          </div>
        )}

        {/* Work Order Flow view is currently disabled */}
        {/*{isMounted(VIEWS.WORK_ORDER_FLOW) && (
          <div className="app-main-inner app-main-stack" style={{ display: isActive(VIEWS.WORK_ORDER_FLOW) ? "block" : "none" }}>
            <div className="app-panel">
              <WorkOrderFlow />
            </div>
          </div>
        )}*/}

        {/* WO Tracking view is currently disabled */}
        {/*{isMounted(VIEWS.WO_TRACKING) && (
          <div className="app-main-inner app-main-stack" style={{ display: isActive(VIEWS.WO_TRACKING) ? "block" : "none" }}>
            <div className="app-panel">
              <WOTracking />
            </div>
          </div>
        )}*/}

        {/* MF Workflow view */}
        {isMounted(VIEWS.MF_WORKFLOW) && (
          <div
            className="app-main-inner app-main-stack"
            style={{ display: isActive(VIEWS.MF_WORKFLOW) ? "block" : "none" }}
          >
            <div className="app-panel">
              <MfWorkflow />
            </div>
          </div>
        )}

        {/* Opening Stock view is currently disabled */}
        {/*{isMounted(VIEWS.OPENING_STOCK) && (
          <div className="app-main-inner app-main-stack" style={{ display: isActive(VIEWS.OPENING_STOCK) ? "block" : "none" }}>
            <section className="app-panel app-panel-primary">
              <OpeningStockEntry />
            </section>
          </div>
        )}*/}

        {/* Supplier view */}
        {isMounted(VIEWS.SUPPLIERS) && (
          <div
            className="app-main-inner app-main-stack"
            style={{ display: isActive(VIEWS.SUPPLIERS) ? "block" : "none" }}
          >
            <section className="app-panel app-panel-primary">
              <SupplierTabView />
            </section>
          </div>
        )}

        {/* Analytics view */}
        {isMounted(VIEWS.ANALYTICS) && (
          <div
            className="app-main-inner app-main-stack"
            style={{ display: isActive(VIEWS.ANALYTICS) ? "block" : "none" }}
          >
            <div className="app-panel app-panel-primary">
              <Analytics />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
