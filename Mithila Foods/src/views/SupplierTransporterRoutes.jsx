import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import SupplierPanel from "../Components/SupplierAndTransporter/SupplierPanel";
import TransporterPanel from "../Components/SupplierAndTransporter/TransporterPanel";
import SupplierDetailPage from "../Components/SupplierDetailPage/SupplierDetailPage";
import TransporterDetailPage from "../Components/TransporterDetailPage/TransporterDetailPage";
import PurchaseRegisterList from "../Components/PurchaseTracker/PurchaseRegisterList";
import SupplierTabs from "../Components/SuppliersTabs/SupplierTabs";

export default function SupplierTransporterRoutes() {
  return (
    <Routes>
      {/* Redirect root "/suppliers" to the main list "/suppliers/list" 
         This prevents "empty" states if someone just types /suppliers
      */}
      <Route path="/suppliers" element={<Navigate to="/suppliers/list" replace />} />

      {/* 1. Suppliers Tab (The main list with internal Analytics tab) */}
      <Route path="/suppliers/list" element={<SupplierPanel />} />
      
      {/* Supplier Detail Page */}
      {/* Note: We use 'details' prefix to avoid collision with other keywords */}
      <Route path="/suppliers/list/:id" element={<SupplierDetailPage />} />

      {/* 2. Transporters Tab */}
      <Route path="/suppliers/transporters" element={<TransporterPanel />} />
      <Route path="/suppliers/transporters/:id" element={<TransporterDetailPage />} />
    </Routes>
  );
}