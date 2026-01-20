// src/SupplierTabSwitch.jsx
import React, { useState } from "react";
import SupplierPanel from "../Components/SupplierAndTransporter/SupplierPanel";
import TransporterPanel from "../Components/SupplierAndTransporter/TransporterPanel";

export default function SupplierTabView() {
  const [activeTab, setActiveTab] = useState("suppliers");

  return (
    <div className={"supplier-page " + (activeTab === "suppliers" ? "is-suppliers" : "is-transporters")}>
      {/* Tabs */}
      <div className="theme-tabs">
        <button
          type="button"
          className={"theme-tab-btn" + (activeTab === "suppliers" ? " active" : "")}
          onClick={() => setActiveTab("suppliers")}
        >
          Suppliers
        </button>

        <button
          type="button"
          className={"theme-tab-btn" + (activeTab === "transporters" ? " active" : "")}
          onClick={() => setActiveTab("transporters")}
        >
          Transporters
        </button>
      </div>

      {/* Keep mounted so state stays when switching tabs */}
      <div style={{ display: activeTab === "suppliers" ? "block" : "none" }}>
        <SupplierPanel />
      </div>

      <div style={{ display: activeTab === "transporters" ? "block" : "none" }}>
        <TransporterPanel />
      </div>
    </div>
  );
}
