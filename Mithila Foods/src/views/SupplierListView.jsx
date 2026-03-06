//import React, { useEffect, useState } from "react";
//import { useLocation, useNavigate } from "react-router-dom";
//import SupplierTransporterRoutes from "./SupplierTransporterRoutes";

//export default function SupplierTabView() {
//  const [activeTab, setActiveTab] = useState("suppliers");
//  const navigate = useNavigate();
//  const location = useLocation();

//  useEffect(() => {
//    const p = location.pathname.toLowerCase();
//    if (p === "/suppliers/create") setActiveTab("create-supplier");
//    else if (p === "/suppliers/transporters/create") setActiveTab("create-transporter");
//    else if (p.includes("/suppliers/transporters")) setActiveTab("transporters");
//    else setActiveTab("suppliers");
//  }, [location.pathname]);

//  return (
//    <div className="supplier-page">
//      <div className="theme-tabs">
//        <button type="button" 
//          className={"theme-tab-btn" + (activeTab === "suppliers" ? " active" : "")}
//          onClick={() => navigate("/suppliers/list")}>Suppliers List</button>

//        <button type="button" 
//          className={"theme-tab-btn" + (activeTab === "create-supplier" ? " active" : "")}
//          onClick={() => navigate("/suppliers/create")}>+ New Supplier</button>

//        <button type="button" 
//          className={"theme-tab-btn" + (activeTab === "transporters" ? " active" : "")}
//          onClick={() => navigate("/suppliers/transporters")}>Transporters List</button>

//        <button type="button" 
//          className={"theme-tab-btn" + (activeTab === "create-transporter" ? " active" : "")}
//          onClick={() => navigate("/suppliers/transporters/create")}>+ New Transporter</button>
//      </div>

//      <SupplierTransporterRoutes />
//    </div>
//  );
//}

import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, Routes, Route } from "react-router-dom";

import SupplierPanel from "../Components/SupplierAndTransporter/SupplierPanel";
import TransporterPanel from "../Components/SupplierAndTransporter/TransporterPanel";
import SupplierDetailPage from "../Components/SupplierDetailPage/SupplierDetailPage";
import TransporterDetailPage from "../Components/TransporterDetailPage/TransporterDetailPage";
import SupplierCreateForm from "../Components/SupplierAndTransporter/SupplierCreateForm";
import TransporterCreateForm from "../Components/SupplierAndTransporter/TransporterCreateForm";

export default function SupplierTabView() {
  const [activeTab, setActiveTab] = useState("suppliers");
  const navigate = useNavigate();
  const location = useLocation();

  // Sync tab with URL on load/change
  // Sync tab with URL on load/change
  useEffect(() => {
    const p = location.pathname.toLowerCase();
    if (p.endsWith("/create")) {
      if (p.includes("/transporters")) setActiveTab("create-transporter");
      else setActiveTab("create-supplier");
    } else if (p.includes("/transporters")) {
      setActiveTab("transporters");
    } else {
      setActiveTab("suppliers");
    }
  }, [location.pathname]);

  // Safely check if we are looking at a specific ID
  // e.g. "/suppliers/directory/list/123" -> ["suppliers", "directory", "list", "123"] (Length 4)
  // e.g. "/suppliers/directory/list" -> ["suppliers", "directory", "list"] (Length 3)
  const urlSegments = location.pathname.split("/").filter(Boolean);
  const isDetailView = urlSegments.length > 3 && !location.pathname.includes("/create");

  if (isDetailView) {
    return (
      <Routes>
        <Route path="/suppliers/directory/list/:id" element={<SupplierDetailPage />} />
        <Route path="/suppliers/directory/transporters/:id" element={<TransporterDetailPage />} />
      </Routes>
    );
  }
  return (
    <div className="supplier-page" style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>

      {/* TABS */}
      <div className="theme-tabs">
        <button type="button"
          className={"theme-tab-btn" + (activeTab === "suppliers" ? " active" : "")}
          onClick={() => navigate("/suppliers/directory/list")}>Suppliers List</button>

        <button type="button"
          className={"theme-tab-btn" + (activeTab === "create-supplier" ? " active" : "")}
          onClick={() => navigate("/suppliers/directory/create")}>+ New Supplier</button>

        <button type="button"
          className={"theme-tab-btn" + (activeTab === "transporters" ? " active" : "")}
          onClick={() => navigate("/suppliers/directory/transporters")}>Transporters List</button>

        <button type="button"
          className={"theme-tab-btn" + (activeTab === "create-transporter" ? " active" : "")}
          onClick={() => navigate("/suppliers/directory/transporters/create")}>+ New Transporter</button>
      </div>

      {/* RENDER ALL COMPONENTS (Hide inactive ones using CSS to keep data alive) */}
      <div style={{ display: activeTab === "suppliers" ? "block" : "none", flex: 1 }}>
        <SupplierPanel />
      </div>

      <div style={{ display: activeTab === "create-supplier" ? "block" : "none", flex: 1 }}>
        <SupplierCreateForm />
      </div>

      <div style={{ display: activeTab === "transporters" ? "block" : "none", flex: 1 }}>
        <TransporterPanel />
      </div>

      <div style={{ display: activeTab === "create-transporter" ? "block" : "none", flex: 1 }}>
        <TransporterCreateForm />
      </div>

    </div>
  );
}