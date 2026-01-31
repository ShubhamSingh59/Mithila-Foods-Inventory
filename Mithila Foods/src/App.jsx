import React, { useState } from "react";
import { BrowserRouter as Router, useLocation, Navigate, Routes, Route } from "react-router-dom";

// Components
import Sidebar from "./Components/Sidebar/Sidebar";
import NotFound from "./Components/NotFound";
import ErrorBoundary from "./Components/ErrorBoundary";

// Views (Screens)
import PurchaseOrderView from "./views/PurchaseOrderView";
import Analytics from "./Components/Analytics";
import MfWorkflow from "./Components/MfWorkflow/MfWorkflow";
import MfgTabsView from "./views/MfgTabsView";
import StockSummaryTabsView from "./views/StockSummaryTabsView";
import StockReorder from "./Components/StockReorder/StockReorder";
import SalesReturnTabsView from "./views/SalesReturnTabsView";
import SalesOrderView from "./views/SalesOrderView";

// ✅ 1. Import the 3 Supplier Views
import SupplierTabView from "./views/SupplierListView"; // View 1: Directory
import PurchaseTrackerView from "./views/PurchaseTrackerView"; // View 2: Operations
import SupplierIntelligenceView from "./views/SupplierIntelligenceView"; // View 3: Intelligence

// CSS
import "./App.css";

// --- KeepAlive Wrapper (Updated) ---
// ✅ Updated to accept 'triggerPaths' (array) for views with multiple sub-routes
const KeepAlivePage = ({ triggerPath, triggerPaths, children }) => {
  const location = useLocation();
  
  let isActive = false;
  if (triggerPath) {
    isActive = location.pathname.startsWith(triggerPath);
  } else if (triggerPaths) {
    // Check if current URL starts with ANY of the provided paths
    isActive = triggerPaths.some(path => location.pathname.startsWith(path));
  }

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

            {/* ✅ 5. SUPPLIER VIEWS (Split into 3 Sections) 
                We use 'triggerPaths' array because each view handles multiple tabs.
            */}

            {/* View 1: Directory (Suppliers & Transporters) */}
            <KeepAlivePage triggerPaths={["/suppliers/list", "/suppliers/transporters"]}>
              <section className="app-panel app-panel-primary">
                <SupplierTabView/>
              </section>
            </KeepAlivePage>

            {/* View 2: Operations (Tracker & Logistics) */}
            <KeepAlivePage triggerPaths={["/suppliers/purchase-tracker", "/suppliers/logistics-hub"]}>
              <section className="app-panel app-panel-primary">
                <PurchaseTrackerView />
              </section>
            </KeepAlivePage>

            {/* View 3: Intelligence (Scorecard & Trends) */}
            <KeepAlivePage triggerPaths={["/suppliers/analytics", "/suppliers/item-trends"]}>
              <section className="app-panel app-panel-primary">
                <SupplierIntelligenceView />
              </section>
            </KeepAlivePage>


            {/* 6. ANALYTICS VIEWS (General) */}
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