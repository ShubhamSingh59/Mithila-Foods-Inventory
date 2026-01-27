// src/App.jsx
import React, { useState } from "react";
import { BrowserRouter as Router, useLocation, Navigate, Routes, Route } from "react-router-dom";

// Components
import Sidebar from "./Components/Sidebar";
import NotFound from "./Components/NotFound";

// Views (Screens)
import PurchaseOrderView from "./views/PurchaseOrderView";
import Analytics from "./Components/Analytics";
import MfWorkflow from "./Components/MfWorkflow/MfWorkflow";
import MfgTabsView from "./views/MfgTabsView";
import StockSummaryTabsView from "./views/StockSummaryTabsView";
import StockReorder from "./Components/StockReorder/StockReorder";
import SalesReturnTabsView from "./views/SalesReturnTabsView";
import SalesOrderView from "./views/SalesOrderView";
import SupplierTabView from "./views/SupplierTabView";

// CSS
import "./App.css";
import ErrorBoundary from "./Components/ErrorBoundary";

// --- KeepAlive Wrapper ---
// Renders the component hidden instead of unmounting it.
const KeepAlivePage = ({ triggerPath, children }) => {
  const location = useLocation();
  const isActive = location.pathname.startsWith(triggerPath);

  return (
    <div
      className="app-main-inner"
      style={{ display: isActive ? "block" : "none" }}
    >
      {children}
    </div>
  );
};

// --- Check404 Helper ---
// Shows 404 page only if no other known route is active
function Check404() {
  const location = useLocation();
  const validPrefixes = [
    "/stock", "/purchase", "/sales", "/mfg", "/suppliers", "/analytics"
  ];

  const isValid = validPrefixes.some(prefix => location.pathname.startsWith(prefix));

  if (isValid) return null;
  return <NotFound />;
}

// --- Main App Logic ---
export default function App() {
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <Router>
      <div
        className="app-shell"
        // 64px is the collapsed width defined in CSS
        style={{ "--sidebar-width": sidebarOpen ? "250px" : "64px" }}
      >
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Main Content Area */}
        <main className="app-main">
          <ErrorBoundary>
            {/* 1. STOCK VIEWS */}
            <KeepAlivePage triggerPath="/stock/daily">
              <StockSummaryTabsView />
            </KeepAlivePage>

            <KeepAlivePage triggerPath="/stock/reorder">
              <StockReorder />
            </KeepAlivePage>

            {/* 2. PURCHASE VIEWS */}
            <KeepAlivePage triggerPath="/purchase">
              <div className="app-panel">
                <PurchaseOrderView />
              </div>
            </KeepAlivePage>

            {/* 3. SALES VIEWS */}
            <KeepAlivePage triggerPath="/sales/orders">
              <div className="app-panel">
                <SalesOrderView />
              </div>
            </KeepAlivePage>

            <KeepAlivePage triggerPath="/sales/return">
              <div className="app-panel app-panel-secondary">
                <SalesReturnTabsView />
              </div>
            </KeepAlivePage>

            {/* 4. MFG VIEWS */}
            <KeepAlivePage triggerPath="/mfg/transfer">
              <MfgTabsView />
            </KeepAlivePage>

            <KeepAlivePage triggerPath="/mfg/workflow">
              <div className="app-panel">
                <MfWorkflow />
              </div>
            </KeepAlivePage>

            {/* 5. SUPPLIER VIEWS */}
            <KeepAlivePage triggerPath="/suppliers">
              <section className="app-panel app-panel-primary">
                <SupplierTabView />
              </section>
            </KeepAlivePage>

            {/* 6. ANALYTICS VIEWS */}
            <KeepAlivePage triggerPath="/analytics">
              <div className="app-panel app-panel-primary">
                <Analytics />
              </div>
            </KeepAlivePage>

            {/* ROUTING: Redirects & 404 */}
            <Routes>
              <Route path="/" element={<Navigate to="/stock/daily" replace />} />
              <Route path="*" element={<Check404 />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </Router>
  );
}