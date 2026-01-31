import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Components
import PurchaseRegisterList from "../Components/PurchaseTracker/PurchaseRegisterList";
import CityLogisticsHub from "../Components/CityLogisticsHub/CityLogisticsHub";

export default function SupplierOperationsRoutes() {
    return (
        <Routes>
            {/* Default Redirect to Tracker */}
            <Route path="/" element={<Navigate to="/suppliers/purchase-tracker" replace />} />

            {/* Tabs - MUST use absolute paths */}
            <Route path="/suppliers/purchase-tracker" element={<PurchaseRegisterList />} />
            <Route path="/suppliers/logistics-hub" element={<CityLogisticsHub />} />
        </Routes>
    );
}