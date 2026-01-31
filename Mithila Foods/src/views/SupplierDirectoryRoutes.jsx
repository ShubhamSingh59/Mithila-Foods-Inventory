import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Components
import SupplierPanel from "../Components/SupplierAndTransporter/SupplierPanel";
import SupplierDetailPage from "../Components/SupplierDetailPage/SupplierDetailPage";
import TransporterPanel from "../Components/SupplierAndTransporter/TransporterPanel";
import TransporterDetailPage from "../Components/TransporterDetailPage/TransporterDetailPage";

export default function SupplierDirectoryRoutes() {
  return (
    <Routes>
      {/* Default Redirect within Directory */}
      <Route path="/" element={<Navigate to="list" replace />} />

      {/* Suppliers */}
      <Route path="list" element={<SupplierPanel />} />
      <Route path="list/:id" element={<SupplierDetailPage />} />

      {/* Transporters */}
      <Route path="transporters" element={<TransporterPanel />} />
      <Route path="transporters/:id" element={<TransporterDetailPage />} />
    </Routes>
  );
}