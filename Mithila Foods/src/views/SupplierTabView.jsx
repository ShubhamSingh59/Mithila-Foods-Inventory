import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SupplierTransporterRoutes from "./SupplierTransporterRoutes";

export default function SupplierTabView() {
  const [activeTab, setActiveTab] = useState("suppliers");
  const navigate = useNavigate();
  const location = useLocation();

  // Sync tab highlight with URL
  useEffect(() => {
    const p = location.pathname.toLowerCase();
    if (p.includes("/suppliers/purchase-tracker")) {
      setActiveTab("purchase-tracker");
    } else if (p.includes("/suppliers/transporters")) {
      setActiveTab("transporters");
    } else {
      setActiveTab("suppliers");
    }
  }, [location.pathname]);

  // Navigation handlers - Use Absolute Paths
  function goSuppliers() {
    setActiveTab("suppliers");
    navigate("/suppliers/list"); 
  }

  function goTransporters() {
    setActiveTab("transporters");
    navigate("/suppliers/transporters");
  }

  function goPurchaseTracker() {
    setActiveTab("purchase-tracker");
    navigate("/suppliers/purchase-tracker");
  }

  return (
    <div
      className={
        "supplier-page " +
        (activeTab === "suppliers"
          ? "is-suppliers"
          : activeTab === "transporters"
          ? "is-transporters"
          : "is-purchase-tracker")
      }
    >
      <div className="theme-tabs">
        <button
          type="button"
          className={"theme-tab-btn" + (activeTab === "suppliers" ? " active" : "")}
          onClick={goSuppliers}
        >
          Suppliers
        </button>

        <button
          type="button"
          className={"theme-tab-btn" + (activeTab === "transporters" ? " active" : "")}
          onClick={goTransporters}
        >
          Transporters
        </button>

        <button
          type="button"
          className={"theme-tab-btn" + (activeTab === "purchase-tracker" ? " active" : "")}
          onClick={goPurchaseTracker}
        >
          Purchase Tracker
        </button>
      </div>

      {/* Render the Routes */}
      <SupplierTransporterRoutes />
    </div>
  );
}