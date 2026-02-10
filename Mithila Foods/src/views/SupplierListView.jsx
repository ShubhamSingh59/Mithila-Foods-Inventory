import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SupplierTransporterRoutes from "./SupplierTransporterRoutes";

//export default function SupplierTabView() {
//  const [activeTab, setActiveTab] = useState("suppliers");
//  const navigate = useNavigate();
//  const location = useLocation();

//  // Sync tab highlight with URL
//  useEffect(() => {
//    const p = location.pathname.toLowerCase();
    
//    // Removed Purchase Tracker condition
//    if (p.includes("/suppliers/transporters")) {
//      setActiveTab("transporters");
//    } else {
//      setActiveTab("suppliers");
//    }
//  }, [location.pathname]);

//  // Navigation handlers
//  function goSuppliers() {
//    setActiveTab("suppliers");
//    navigate("/suppliers/list"); 
//  }

//  function goTransporters() {
//    setActiveTab("transporters");
//    navigate("/suppliers/transporters");
//  }

//  return (
//    <div
//      className={
//        "supplier-page " +
//        (activeTab === "transporters" ? "is-transporters" : "is-suppliers")
//      }
//    >
//      <div className="theme-tabs">
//        <button
//          type="button"
//          className={"theme-tab-btn" + (activeTab === "suppliers" ? " active" : "")}
//          onClick={goSuppliers}
//        >
//          Suppliers
//        </button>

//        <button
//          type="button"
//          className={"theme-tab-btn" + (activeTab === "transporters" ? " active" : "")}
//          onClick={goTransporters}
//        >
//          Transporters
//        </button>
//      </div>

//      <SupplierTransporterRoutes />
//    </div>
//  );
//}
export default function SupplierTabView() {
  const [activeTab, setActiveTab] = useState("suppliers");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const p = location.pathname.toLowerCase();
    if (p === "/suppliers/create") setActiveTab("create-supplier");
    else if (p === "/suppliers/transporters/create") setActiveTab("create-transporter");
    else if (p.includes("/suppliers/transporters")) setActiveTab("transporters");
    else setActiveTab("suppliers");
  }, [location.pathname]);

  return (
    <div className="supplier-page">
      <div className="theme-tabs">
        <button type="button" 
          className={"theme-tab-btn" + (activeTab === "suppliers" ? " active" : "")}
          onClick={() => navigate("/suppliers/list")}>Suppliers List</button>

        <button type="button" 
          className={"theme-tab-btn" + (activeTab === "create-supplier" ? " active" : "")}
          onClick={() => navigate("/suppliers/create")}>+ New Supplier</button>

        <button type="button" 
          className={"theme-tab-btn" + (activeTab === "transporters" ? " active" : "")}
          onClick={() => navigate("/suppliers/transporters")}>Transporters List</button>

        <button type="button" 
          className={"theme-tab-btn" + (activeTab === "create-transporter" ? " active" : "")}
          onClick={() => navigate("/suppliers/transporters/create")}>+ New Transporter</button>
      </div>

      <SupplierTransporterRoutes />
    </div>
  );
}