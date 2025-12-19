////// src/App.jsx
////import React, { useState } from "react";

////// Screens
////import DailyStockSummary from "./Components/DailyStockSummary";
////import ItemTable from "./Components/ItemTable";
////import BomCreateForm from "./Components/BomCreateForm";
////import BomList from "./Components/BomList";
////import PurchaseOrder from "./Components/purchaseOrder";
////import PurchaseOrderList from "./Components/PurchaseOrderList";
////import SalesEasyShip from "./Components/SalesEasyShip";
////import SalesReturn from "./Components/SalesReturn";
////import StockManufactureEntry from "./Components/StockManufactureEntry";
////import StockReconciliation from "./Components/StockReconciliation";
////import StockTransfer from "./Components/StockTransfer";
////import SupplierList from "./Components/SupplierList"; 

////import "./App.css";
////import OpeningStockEntry from "./Components/OpeningStockEntry";

////const VIEWS = {
////  DAILY_STOCK: "DAILY_STOCK",
////  ITEMS: "ITEMS",
////  BOM: "BOM",
////  PURCHASE: "PURCHASE",
////  SALES: "SALES",
////  MFG: "MFG",
////  SUPPLIERS: "SUPPLIERS",
////};

////function App() {
////  const [activeView, setActiveView] = useState(VIEWS.DAILY_STOCK);

////  function renderMain() {
////    switch (activeView) {
////      case VIEWS.DAILY_STOCK:
////        return (
////          <div className="app-main-inner">
////            <DailyStockSummary />
////          </div>
////        );

////      case VIEWS.ITEMS:
////        return (
////          <div className="app-main-inner">
////            <ItemTable />
////          </div>
////        );

////      case VIEWS.BOM:
////  return (
////    <div className="app-main-inner app-main-stack">
////      {/* Create BOM – full width top card */}
////      <section className="app-panel app-panel-primary">
////        <BomCreateForm />
////      </section>

////      {/* BOM List – full width card below */}
////      <section className="app-panel app-panel-secondary">
////        <BomList />
////      </section>
////    </div>
////  );


////      case VIEWS.PURCHASE:
////        return (
////          <div className="app-main-inner app-main-stack">
////            <div className="app-panel">
////              <PurchaseOrder />
////            </div>
////          </div>
////        );

////      case VIEWS.SALES:
////        return (
////          <div className="app-main-inner app-main-stack">
////            <div className="app-panel">
////              <SalesEasyShip />
////            </div>
////            <div className="app-panel app-panel-secondary">
////              <SalesReturn />
////            </div>
////          </div>
////        );

////      case VIEWS.MFG:
////        return (
////          <div className="app-main-inner app-main-stack">
////            <div className="app-panel">
////              <StockManufactureEntry />
////            </div>
////            <div className="app-panel">
////              <StockReconciliation />
////            </div>
////            <div className="app-panel">
////              <StockTransfer />
////            </div>
////          </div>
////        );
////        case VIEWS.SUPPLIERS:    
////        return (
////          <div className="app-main-inner app-main-stack">
////            <section className="app-panel app-panel-primary">
////              <SupplierList />
////            </section>
////          </div>
////        );
////      default:
////        return null;
////    }
////  }

////  return (
////    <div className="app-shell">
////      {/* LEFT SIDEBAR */}
////      <aside className="app-sidebar">
////        <div className="app-sidebar-header">
////          <div className="app-logo-circle">S</div>
////          <div className="app-logo-text">
////            <div className="app-logo-title">Stock & Supplier</div>
////            <div className="app-logo-subtitle">ERPNext Console</div>
////          </div>
////        </div>

////        <nav className="app-nav">
////          {/* 1. Stock tracker */}
////          <div className="app-nav-group">
////            <div className="app-nav-group-label">Stock tracker</div>
////            <button
////              type="button"
////              className={
////                "app-nav-link" +
////                (activeView === VIEWS.DAILY_STOCK ? " active" : "")
////              }
////              onClick={() => setActiveView(VIEWS.DAILY_STOCK)}
////            >
////              <span className="app-nav-dot app-nav-dot-blue" />
////              Daily Stock Summary
////            </button>

////            <button
////              type="button"
////              className={
////                "app-nav-link" +
////                (activeView === VIEWS.ITEMS ? " active" : "")
////              }
////              onClick={() => setActiveView(VIEWS.ITEMS)}
////            >
////              <span className="app-nav-dot app-nav-dot-purple" />
////              Item Master
////            </button>
////          </div>

////          {/* 2. BOM */}
////          <div className="app-nav-group">
////            <div className="app-nav-group-label">Bill of Materials</div>
////            <button
////              type="button"
////              className={
////                "app-nav-link" +
////                (activeView === VIEWS.BOM ? " active" : "")
////              }
////              onClick={() => setActiveView(VIEWS.BOM)}
////            >
////              <span className="app-nav-dot app-nav-dot-amber" />
////              BOM Create & List
////            </button>
////          </div>

////          {/* 3. Purchase */}
////          <div className="app-nav-group">
////            <div className="app-nav-group-label">Purchase</div>
////            <button
////              type="button"
////              className={
////                "app-nav-link" +
////                (activeView === VIEWS.PURCHASE ? " active" : "")
////              }
////              onClick={() => setActiveView(VIEWS.PURCHASE)}
////            >
////              <span className="app-nav-dot app-nav-dot-green" />
////              Purchase Orders
////            </button>
////          </div>

////          {/* 4. Sales */}
////          <div className="app-nav-group">
////            <div className="app-nav-group-label">Sales</div>
////            <button
////              type="button"
////              className={
////                "app-nav-link" +
////                (activeView === VIEWS.SALES ? " active" : "")
////              }
////              onClick={() => setActiveView(VIEWS.SALES)}
////            >
////              <span className="app-nav-dot app-nav-dot-pink" />
////              EasyShip & Returns
////            </button>
////          </div>

////          {/* 5. Manufacturing & Adjustments */}
////          <div className="app-nav-group">
////            <div className="app-nav-group-label">
////              Manufacturing & Adjustments
////            </div>
////            <button
////              type="button"
////              className={
////                "app-nav-link" +
////                (activeView === VIEWS.MFG ? " active" : "")
////              }
////              onClick={() => setActiveView(VIEWS.MFG)}
////            >
////              <span className="app-nav-dot app-nav-dot-teal" />
////              Manufacture · Reco · Transfer
////            </button>
////          </div>
////          {/* 4. Suppliers – NEW GROUP */}
////          <div className="app-nav-group">
////            <div className="app-nav-group-label">Suppliers</div>
////            <button
////              type="button"
////              className={
////                "app-nav-link" +
////                (activeView === VIEWS.SUPPLIERS ? " active" : "")
////              }
////              onClick={() => setActiveView(VIEWS.SUPPLIERS)}
////            >
////              <span className="app-nav-dot app-nav-dot-pink" />
////              Supplier List
////            </button>
////          </div>
////        </nav>

////        <div className="app-sidebar-footer">
////          <div className="app-sidebar-footer-label">Today</div>
////          <div className="app-sidebar-footer-badge">
////            Stock & Supplier tracker
////          </div>
////        </div>
////      </aside>

////      {/* MAIN CONTENT */}
////      <main className="app-main">
////        {renderMain()}
////        <OpeningStockEntry/>
////      </main>

////    </div>
////  );
////}

////export default App;
//// src/App.jsx
//import React, { useState } from "react";

//// Screens
//import DailyStockSummary from "./Components/DailyStockSummary";
//import ItemTable from "./Components/ItemTable";
//import BomCreateForm from "./Components/BomCreateForm";
//import BomList from "./Components/BomList";
//import PurchaseOrder from "./Components/purchaseOrder";
//import PurchaseOrderList from "./Components/PurchaseOrderList";
//import SalesEasyShip from "./Components/SalesEasyShip";
//import SalesReturn from "./Components/SalesReturn";
//import StockManufactureEntry from "./Components/StockManufactureEntry";
//import StockReconciliation from "./Components/StockReconciliation";
//import StockTransfer from "./Components/StockTransfer";
//import SupplierList from "./Components/SupplierList";
//import OpeningStockEntry from "./Components/OpeningStockEntry";

//import "./App.css";

//const VIEWS = {
//  DAILY_STOCK: "DAILY_STOCK",
//  ITEMS: "ITEMS",
//  BOM: "BOM",
//  PURCHASE: "PURCHASE",
//  SALES: "SALES",
//  MFG: "MFG",
//  SUPPLIERS: "SUPPLIERS",
//  OPENING_STOCK: "OPENING_STOCK",
//};

//function App() {
//  const [activeView, setActiveView] = useState(VIEWS.DAILY_STOCK);

//  function renderMain() {
//    switch (activeView) {
//      case VIEWS.DAILY_STOCK:
//        return (
//          <div className="app-main-inner">
//            <DailyStockSummary />
//          </div>
//        );

//      case VIEWS.ITEMS:
//        return (
//          <div className="app-main-inner">
//            <ItemTable />
//          </div>
//        );

//      case VIEWS.BOM:
//        return (
//          <div className="app-main-inner app-main-stack">
//            {/* Create BOM – full width top card */}
//            <section className="app-panel app-panel-primary">
//              <BomCreateForm />
//            </section>

//            {/* BOM List – full width card below */}
//            <section className="app-panel app-panel-secondary">
//              <BomList />
//            </section>
//          </div>
//        );

//      case VIEWS.PURCHASE:
//        return (
//          <div className="app-main-inner app-main-stack">
//            <div className="app-panel">
//              <PurchaseOrder />
//            </div>
//          </div>
//        );

//      case VIEWS.SALES:
//        return (
//          <div className="app-main-inner app-main-stack">
//            <div className="app-panel">
//              <SalesEasyShip />
//            </div>
//            <div className="app-panel app-panel-secondary">
//              <SalesReturn />
//            </div>
//          </div>
//        );

//      case VIEWS.MFG:
//        return (
//          <div className="app-main-inner app-main-stack">
//            <div className="app-panel">
//              <StockManufactureEntry />
//            </div>
//            <div className="app-panel">
//              <StockReconciliation />
//            </div>
//            <div className="app-panel">
//              <StockTransfer />
//            </div>
//          </div>
//        );

//      case VIEWS.OPENING_STOCK:
//        return (
//          <div className="app-main-inner app-main-stack">
//            <section className="app-panel app-panel-primary">
//              <OpeningStockEntry />
//            </section>
//          </div>
//        );

//      case VIEWS.SUPPLIERS:
//        return (
//          <div className="app-main-inner app-main-stack">
//            <section className="app-panel app-panel-primary">
//              <SupplierList />
//            </section>
//          </div>
//        );

//      default:
//        return null;
//    }
//  }

//  return (
//    <div className="app-shell">
//      {/* LEFT SIDEBAR */}
//      <aside className="app-sidebar">
//        <div className="app-sidebar-header">
//          <div className="app-logo-circle">S</div>
//          <div className="app-logo-text">
//            <div className="app-logo-title">Stock & Supplier</div>
//            <div className="app-logo-subtitle">ERPNext Console</div>
//          </div>
//        </div>

//        <nav className="app-nav">
//          {/* 1. Stock tracker */}
//          <div className="app-nav-group">
//            <div className="app-nav-group-label">Stock tracker</div>
//            <button
//              type="button"
//              className={
//                "app-nav-link" +
//                (activeView === VIEWS.DAILY_STOCK ? " active" : "")
//              }
//              onClick={() => setActiveView(VIEWS.DAILY_STOCK)}
//            >
//              <span className="app-nav-dot app-nav-dot-blue" />
//              Daily Stock Summary
//            </button>

//            <button
//              type="button"
//              className={
//                "app-nav-link" +
//                (activeView === VIEWS.ITEMS ? " active" : "")
//              }
//              onClick={() => setActiveView(VIEWS.ITEMS)}
//            >
//              <span className="app-nav-dot app-nav-dot-purple" />
//              Item Master
//            </button>
//          </div>

//          {/* 2. BOM */}
//          <div className="app-nav-group">
//            <div className="app-nav-group-label">Material List</div>
//            <button
//              type="button"
//              className={
//                "app-nav-link" +
//                (activeView === VIEWS.BOM ? " active" : "")
//              }
//              onClick={() => setActiveView(VIEWS.BOM)}
//            >
//              <span className="app-nav-dot app-nav-dot-amber" />
//              Create Material List
//            </button>
//          </div>

//          {/* 3. Purchase */}
//          <div className="app-nav-group">
//            <div className="app-nav-group-label">Purchase</div>
//            <button
//              type="button"
//              className={
//                "app-nav-link" +
//                (activeView === VIEWS.PURCHASE ? " active" : "")
//              }
//              onClick={() => setActiveView(VIEWS.PURCHASE)}
//            >
//              <span className="app-nav-dot app-nav-dot-green" />
//              Purchase Orders
//            </button>
//          </div>

//          {/* 4. Sales */}
//          <div className="app-nav-group">
//            <div className="app-nav-group-label">Sales</div>
//            <button
//              type="button"
//              className={
//                "app-nav-link" +
//                (activeView === VIEWS.SALES ? " active" : "")
//              }
//              onClick={() => setActiveView(VIEWS.SALES)}
//            >
//              <span className="app-nav-dot app-nav-dot-pink" />
//              EasyShip & Returns
//            </button>
//          </div>

//          {/* 5. Manufacturing & Adjustments */}
//          <div className="app-nav-group">
//            <div className="app-nav-group-label">
//              Manufacturing & Adjustments
//            </div>
//            <button
//              type="button"
//              className={
//                "app-nav-link" +
//                (activeView === VIEWS.MFG ? " active" : "")
//              }
//              onClick={() => setActiveView(VIEWS.MFG)}
//            >
//              <span className="app-nav-dot app-nav-dot-teal" />
//              Manufacture · Reco · Transfer
//            </button>

//            {/* Opening Stock – funky dot here */}
//            <button
//              type="button"
//              className={
//                "app-nav-link" +
//                (activeView === VIEWS.OPENING_STOCK ? " active" : "")
//              }
//              onClick={() => setActiveView(VIEWS.OPENING_STOCK)}
//            >
//              <span className="app-nav-dot app-nav-dot-amber" />
//              Opening Stock
//            </button>
//          </div>

//          {/* 6. Suppliers */}
//          <div className="app-nav-group">
//            <div className="app-nav-group-label">Suppliers</div>
//            <button
//              type="button"
//              className={
//                "app-nav-link" +
//                (activeView === VIEWS.SUPPLIERS ? " active" : "")
//              }
//              onClick={() => setActiveView(VIEWS.SUPPLIERS)}
//            >
//              <span className="app-nav-dot app-nav-dot-pink" />
//              Supplier List
//            </button>
//          </div>
//        </nav>

//        <div className="app-sidebar-footer">
//          <div className="app-sidebar-footer-label">Today</div>
//          <div className="app-sidebar-footer-badge">
//            Stock & Supplier tracker
//          </div>
//        </div>
//      </aside>

//      {/* MAIN CONTENT */}
//      <main className="app-main">{renderMain()}</main>
//    </div>
//  );
//}

//export default App;


// src/App.jsx
import React, { useEffect, useState } from "react";

// Screens
import DailyStockSummary from "./Components/DailyStockSummary";
import ItemTable from "./Components/ItemTable";
import BomCreateForm from "./Components/BomCreateForm";
import BomList from "./Components/BomList";
import PurchaseOrder from "./Components/purchaseOrder";
import PurchaseOrderList from "./Components/PurchaseOrderList";
import SalesEasyShip from "./Components/SalesEasyShip";
import SalesReturn from "./Components/SalesReturn";
import StockManufactureEntry from "./Components/StockManufactureEntry";
import StockReconciliation from "./Components/StockReconciliation";
import StockTransfer from "./Components/StockTransfer";
import SupplierList from "./Components/SupplierList";
import OpeningStockEntry from "./Components/OpeningStockEntry";
import WorkOrderFlow from "./Components/WorkOrderFlow";
import WOTracking from "./Components/WOTracking";
import Analytics from "./Components/Analytics";

import "./App.css";

const VIEWS = {
  DAILY_STOCK: "DAILY_STOCK",
  PURCHASE: "PURCHASE",
  MFG: "MFG",
  SUPPLIERS: "SUPPLIERS",
  OPENING_STOCK: "OPENING_STOCK",
  WORK_ORDER_FLOW: "WORK_ORDER_FLOW",
  WO_TRACKING: "WO_TRACKING",
  ANALYTICS: "ANALYTICS",

  // ✅ split sales into two screens
  SALES_EASYSHIP: "SALES_EASYSHIP",
  SALES_RETURN: "SALES_RETURN",
};


function App() {
  const [activeView, setActiveView] = useState(VIEWS.DAILY_STOCK);

  // 👇 keep track which views are already mounted
  const [mountedViews, setMountedViews] = useState([VIEWS.DAILY_STOCK]);

  const handleViewChange = (view) => {
    setActiveView(view);
    setMountedViews((prev) =>
      prev.includes(view) ? prev : [...prev, view]
    );
  };

  const isMounted = (view) => mountedViews.includes(view);
  const isActive = (view) => activeView === view;
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // If user clicked email link, we’ll get either view=PURCHASE
    // OR at least itemCode present
    const viewParam = params.get("view");
    const hasPOParams = params.get("itemCode") || params.get("qty") || params.get("warehouse");

    if (viewParam === "PURCHASE" || hasPOParams) {
      handleViewChange(VIEWS.PURCHASE);
    }
  }, []);


  return (
    <div className="app-shell">
      {/* LEFT SIDEBAR */}
      <aside className="app-sidebar">
        <div className="app-sidebar-header">
          <div className="app-logo-circle">S</div>
          <div className="app-logo-text">
            <div className="app-logo-title">Stock & Supplier</div>
            <div className="app-logo-subtitle">ERPNext Console</div>
          </div>
        </div>

        <nav className="app-nav">
          {/* 1. Stock tracker */}
          <div className="app-nav-group">
            <div className="app-nav-group-label">Stock tracker</div>

            <button
              type="button"
              className={
                "app-nav-link" +
                (activeView === VIEWS.DAILY_STOCK ? " active" : "")
              }
              onClick={() => handleViewChange(VIEWS.DAILY_STOCK)}
            >
              <span className="app-nav-dot app-nav-dot-blue" />
              Daily Stock Summary
            </button>

            {/*<button
              type="button"
              className={
                "app-nav-link" +
                (activeView === VIEWS.ITEMS ? " active" : "")
              }
              onClick={() => handleViewChange(VIEWS.ITEMS)}
            >
              <span className="app-nav-dot app-nav-dot-purple" />
              Item Master
            </button>*/}
          </div>

          {/*2. BOM
          <div className="app-nav-group">
            <div className="app-nav-group-label">Material List</div>
            <button
              type="button"
              className={
                "app-nav-link" + (activeView === VIEWS.BOM ? " active" : "")
              }
              onClick={() => handleViewChange(VIEWS.BOM)}
            >
              <span className="app-nav-dot app-nav-dot-amber" />
              Create Material List
            </button>
          </div>*/}

          {/* 3. Purchase */}
          <div className="app-nav-group">
            <div className="app-nav-group-label">Purchase</div>
            <button
              type="button"
              className={
                "app-nav-link" +
                (activeView === VIEWS.PURCHASE ? " active" : "")
              }
              onClick={() => handleViewChange(VIEWS.PURCHASE)}
            >
              <span className="app-nav-dot app-nav-dot-green" />
              Purchase Orders
            </button>
          </div>

          {/* 4. Sales */}
          {/* 4. Sales */}
          <div className="app-nav-group">
            <div className="app-nav-group-label">Sales</div>

            <button
              type="button"
              className={"app-nav-link" + (isActive(VIEWS.SALES_EASYSHIP) ? " active" : "")}
              onClick={() => handleViewChange(VIEWS.SALES_EASYSHIP)}
            >
              <span className="app-nav-dot app-nav-dot-pink" />
              EasyShip
            </button>

            <button
              type="button"
              className={"app-nav-link" + (isActive(VIEWS.SALES_RETURN) ? " active" : "")}
              onClick={() => handleViewChange(VIEWS.SALES_RETURN)}
            >
              <span className="app-nav-dot app-nav-dot-amber" />
              Sales Return
            </button>
          </div>


          {/* 5. Manufacturing & Adjustments */}
          <div className="app-nav-group">
            <div className="app-nav-group-label">
              Manufacturing & Adjustments
            </div>
            <button
              type="button"
              className={
                "app-nav-link" + (activeView === VIEWS.MFG ? " active" : "")
              }
              onClick={() => handleViewChange(VIEWS.MFG)}
            >
              <span className="app-nav-dot app-nav-dot-teal" />
              Manufacture · Reco · Transfer
            </button>

            <button
              type="button"
              className={
                "app-nav-link" +
                (activeView === VIEWS.OPENING_STOCK ? " active" : "")
              }
              onClick={() => handleViewChange(VIEWS.OPENING_STOCK)}
            >
              <span className="app-nav-dot app-nav-dot-amber" />
              Opening Stock
            </button>
            {/* ✅ NEW: Work Order Flow */}
            <button
              type="button"
              className={"app-nav-link" + (isActive(VIEWS.WORK_ORDER_FLOW) ? " active" : "")}
              onClick={() => handleViewChange(VIEWS.WORK_ORDER_FLOW)}
            >
              <span className="app-nav-dot app-nav-dot-teal" />
              Work Order Flow
            </button>

            {/* ✅ NEW: WO Tracking */}
            <button
              type="button"
              className={"app-nav-link" + (isActive(VIEWS.WO_TRACKING) ? " active" : "")}
              onClick={() => handleViewChange(VIEWS.WO_TRACKING)}
            >
              <span className="app-nav-dot app-nav-dot-blue" />
              WO Tracking
            </button>
          </div>

          {/* 6. Suppliers */}
          <div className="app-nav-group">
            <div className="app-nav-group-label">Suppliers</div>
            <button
              type="button"
              className={
                "app-nav-link" +
                (activeView === VIEWS.SUPPLIERS ? " active" : "")
              }
              onClick={() => handleViewChange(VIEWS.SUPPLIERS)}
            >
              <span className="app-nav-dot app-nav-dot-pink" />
              Supplier List
            </button>
          </div>
          {/* 7. Analytics */}
          <div className="app-nav-group">
            <div className="app-nav-group-label">Analytics</div>

            <button
              type="button"
              className={
                "app-nav-link" +
                (activeView === VIEWS.ANALYTICS ? " active" : "")
              }
              onClick={() => handleViewChange(VIEWS.ANALYTICS)}
            >
              <span className="app-nav-dot app-nav-dot-purple" />
              Company Analytics
            </button>
          </div>

        </nav>

        <div className="app-sidebar-footer">
          <div className="app-sidebar-footer-label">Today</div>
          <div className="app-sidebar-footer-badge">
            Stock & Supplier tracker
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="app-main">
        {/* DAILY STOCK */}
        {isMounted(VIEWS.DAILY_STOCK) && (
          <div
            className="app-main-inner"
            style={{
              display: isActive(VIEWS.DAILY_STOCK) ? "block" : "none",
            }}
          >
            <DailyStockSummary />
          </div>
        )}

        {/*ITEMS
        {isMounted(VIEWS.ITEMS) && (
          <div
            className="app-main-inner"
            style={{
              display: isActive(VIEWS.ITEMS) ? "block" : "none",
            }}
          >
            <ItemTable />
          </div>
        )}*/}

        {/* BOM */}
        {/*{isMounted(VIEWS.BOM) && (
          <div
            className="app-main-inner app-main-stack"
            style={{
              display: isActive(VIEWS.BOM) ? "block" : "none",
            }}
          >
            <section className="app-panel app-panel-primary">
              <BomCreateForm />
            </section>
            <section className="app-panel app-panel-secondary">
              <BomList />
            </section>
          </div>
        )}*/}

        {/* PURCHASE */}
        {isMounted(VIEWS.PURCHASE) && (
          <div
            className="app-main-inner app-main-stack"
            style={{
              display: isActive(VIEWS.PURCHASE) ? "block" : "none",
            }}
          >
            <div className="app-panel">
              <PurchaseOrder />
            </div>
          </div>
        )}

        {/* SALES */}
        {/* ✅ SALES: EASYSHIP */}
        {isMounted(VIEWS.SALES_EASYSHIP) && (
          <div
            className="app-main-inner app-main-stack"
            style={{ display: isActive(VIEWS.SALES_EASYSHIP) ? "block" : "none" }}
          >
            <div className="app-panel">
              <SalesEasyShip />
            </div>
          </div>
        )}

        {/* ✅ SALES: RETURN */}
        {isMounted(VIEWS.SALES_RETURN) && (
          <div
            className="app-main-inner app-main-stack"
            style={{ display: isActive(VIEWS.SALES_RETURN) ? "block" : "none" }}
          >
            <div className="app-panel app-panel-secondary">
              <SalesReturn />
            </div>
          </div>
        )}


        {/* MFG */}
        {isMounted(VIEWS.MFG) && (
          <div
            className="app-main-inner app-main-stack"
            style={{
              display: isActive(VIEWS.MFG) ? "block" : "none",
            }}
          >
            <div className="app-panel">
              <StockManufactureEntry />
            </div>
            <div className="app-panel">
              <StockReconciliation />
            </div>
            <div className="app-panel">
              <StockTransfer />
            </div>
          </div>
        )}
        {/* ✅ NEW: WORK ORDER FLOW */}
        {isMounted(VIEWS.WORK_ORDER_FLOW) && (
          <div className="app-main-inner app-main-stack" style={{ display: isActive(VIEWS.WORK_ORDER_FLOW) ? "block" : "none" }}>
            <div className="app-panel">
              <WorkOrderFlow />
            </div>
          </div>
        )}

        {/* ✅ NEW: WO TRACKING */}
        {isMounted(VIEWS.WO_TRACKING) && (
          <div className="app-main-inner app-main-stack" style={{ display: isActive(VIEWS.WO_TRACKING) ? "block" : "none" }}>
            <div className="app-panel">
              <WOTracking />
            </div>
          </div>
        )}

        {/* OPENING STOCK */}
        {isMounted(VIEWS.OPENING_STOCK) && (
          <div
            className="app-main-inner app-main-stack"
            style={{
              display: isActive(VIEWS.OPENING_STOCK) ? "block" : "none",
            }}
          >
            <section className="app-panel app-panel-primary">
              <OpeningStockEntry />
            </section>
          </div>
        )}

        {/* SUPPLIERS */}
        {isMounted(VIEWS.SUPPLIERS) && (
          <div
            className="app-main-inner app-main-stack"
            style={{
              display: isActive(VIEWS.SUPPLIERS) ? "block" : "none",
            }}
          >
            <section className="app-panel app-panel-primary">
              <SupplierList />
            </section>
          </div>
        )}
        {/* ✅ ANALYTICS */}
        {isMounted(VIEWS.ANALYTICS) && (
          <div
            className="app-main-inner app-main-stack"
            style={{
              display: isActive(VIEWS.ANALYTICS) ? "block" : "none",
            }}
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
