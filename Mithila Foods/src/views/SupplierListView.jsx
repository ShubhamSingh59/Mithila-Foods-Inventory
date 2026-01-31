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
    
    // Removed Purchase Tracker condition
    if (p.includes("/suppliers/transporters")) {
      setActiveTab("transporters");
    } else {
      setActiveTab("suppliers");
    }
  }, [location.pathname]);

  // Navigation handlers
  function goSuppliers() {
    setActiveTab("suppliers");
    navigate("/suppliers/list"); 
  }

  function goTransporters() {
    setActiveTab("transporters");
    navigate("/suppliers/transporters");
  }

  return (
    <div
      className={
        "supplier-page " +
        (activeTab === "transporters" ? "is-transporters" : "is-suppliers")
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
      </div>

      <SupplierTransporterRoutes />
    </div>
  );
}