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

//import "./App.css";
//import OpeningStockEntry from "./Components/OpeningStockEntry";

//const VIEWS = {
//  DAILY_STOCK: "DAILY_STOCK",
//  ITEMS: "ITEMS",
//  BOM: "BOM",
//  PURCHASE: "PURCHASE",
//  SALES: "SALES",
//  MFG: "MFG",
//  SUPPLIERS: "SUPPLIERS",
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
//  return (
//    <div className="app-main-inner app-main-stack">
//      {/* Create BOM – full width top card */}
//      <section className="app-panel app-panel-primary">
//        <BomCreateForm />
//      </section>

//      {/* BOM List – full width card below */}
//      <section className="app-panel app-panel-secondary">
//        <BomList />
//      </section>
//    </div>
//  );


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
//        case VIEWS.SUPPLIERS:    
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
//            <div className="app-nav-group-label">Bill of Materials</div>
//            <button
//              type="button"
//              className={
//                "app-nav-link" +
//                (activeView === VIEWS.BOM ? " active" : "")
//              }
//              onClick={() => setActiveView(VIEWS.BOM)}
//            >
//              <span className="app-nav-dot app-nav-dot-amber" />
//              BOM Create & List
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
//          </div>
//          {/* 4. Suppliers – NEW GROUP */}
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
//      <main className="app-main">
//        {renderMain()}
//        <OpeningStockEntry/>
//      </main>

//    </div>
//  );
//}

//export default App;
// src/App.jsx
import React, { useState } from "react";

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

import "./App.css";

const VIEWS = {
  DAILY_STOCK: "DAILY_STOCK",
  ITEMS: "ITEMS",
  BOM: "BOM",
  PURCHASE: "PURCHASE",
  SALES: "SALES",
  MFG: "MFG",
  SUPPLIERS: "SUPPLIERS",
  OPENING_STOCK: "OPENING_STOCK",
};

function App() {
  const [activeView, setActiveView] = useState(VIEWS.DAILY_STOCK);

  function renderMain() {
    switch (activeView) {
      case VIEWS.DAILY_STOCK:
        return (
          <div className="app-main-inner">
            <DailyStockSummary />
          </div>
        );

      case VIEWS.ITEMS:
        return (
          <div className="app-main-inner">
            <ItemTable />
          </div>
        );

      case VIEWS.BOM:
        return (
          <div className="app-main-inner app-main-stack">
            {/* Create BOM – full width top card */}
            <section className="app-panel app-panel-primary">
              <BomCreateForm />
            </section>

            {/* BOM List – full width card below */}
            <section className="app-panel app-panel-secondary">
              <BomList />
            </section>
          </div>
        );

      case VIEWS.PURCHASE:
        return (
          <div className="app-main-inner app-main-stack">
            <div className="app-panel">
              <PurchaseOrder />
            </div>
          </div>
        );

      case VIEWS.SALES:
        return (
          <div className="app-main-inner app-main-stack">
            <div className="app-panel">
              <SalesEasyShip />
            </div>
            <div className="app-panel app-panel-secondary">
              <SalesReturn />
            </div>
          </div>
        );

      case VIEWS.MFG:
        return (
          <div className="app-main-inner app-main-stack">
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
        );

      case VIEWS.OPENING_STOCK:
        return (
          <div className="app-main-inner app-main-stack">
            <section className="app-panel app-panel-primary">
              <OpeningStockEntry />
            </section>
          </div>
        );

      case VIEWS.SUPPLIERS:
        return (
          <div className="app-main-inner app-main-stack">
            <section className="app-panel app-panel-primary">
              <SupplierList />
            </section>
          </div>
        );

      default:
        return null;
    }
  }

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
              onClick={() => setActiveView(VIEWS.DAILY_STOCK)}
            >
              <span className="app-nav-dot app-nav-dot-blue" />
              Daily Stock Summary
            </button>

            <button
              type="button"
              className={
                "app-nav-link" +
                (activeView === VIEWS.ITEMS ? " active" : "")
              }
              onClick={() => setActiveView(VIEWS.ITEMS)}
            >
              <span className="app-nav-dot app-nav-dot-purple" />
              Item Master
            </button>
          </div>

          {/* 2. BOM */}
          <div className="app-nav-group">
            <div className="app-nav-group-label">Material List</div>
            <button
              type="button"
              className={
                "app-nav-link" +
                (activeView === VIEWS.BOM ? " active" : "")
              }
              onClick={() => setActiveView(VIEWS.BOM)}
            >
              <span className="app-nav-dot app-nav-dot-amber" />
              Create Material List
            </button>
          </div>

          {/* 3. Purchase */}
          <div className="app-nav-group">
            <div className="app-nav-group-label">Purchase</div>
            <button
              type="button"
              className={
                "app-nav-link" +
                (activeView === VIEWS.PURCHASE ? " active" : "")
              }
              onClick={() => setActiveView(VIEWS.PURCHASE)}
            >
              <span className="app-nav-dot app-nav-dot-green" />
              Purchase Orders
            </button>
          </div>

          {/* 4. Sales */}
          <div className="app-nav-group">
            <div className="app-nav-group-label">Sales</div>
            <button
              type="button"
              className={
                "app-nav-link" +
                (activeView === VIEWS.SALES ? " active" : "")
              }
              onClick={() => setActiveView(VIEWS.SALES)}
            >
              <span className="app-nav-dot app-nav-dot-pink" />
              EasyShip & Returns
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
                "app-nav-link" +
                (activeView === VIEWS.MFG ? " active" : "")
              }
              onClick={() => setActiveView(VIEWS.MFG)}
            >
              <span className="app-nav-dot app-nav-dot-teal" />
              Manufacture · Reco · Transfer
            </button>

            {/* Opening Stock – funky dot here */}
            <button
              type="button"
              className={
                "app-nav-link" +
                (activeView === VIEWS.OPENING_STOCK ? " active" : "")
              }
              onClick={() => setActiveView(VIEWS.OPENING_STOCK)}
            >
              <span className="app-nav-dot app-nav-dot-amber" />
              Opening Stock
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
              onClick={() => setActiveView(VIEWS.SUPPLIERS)}
            >
              <span className="app-nav-dot app-nav-dot-pink" />
              Supplier List
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
      <main className="app-main">{renderMain()}</main>
    </div>
  );
}

export default App;
