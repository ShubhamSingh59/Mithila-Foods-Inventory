import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Components
import SupplierTracker from "../Components/SupplierAnalytics/SupplierTracker";
import ItemAnalyticsDashboard from "../Components/Analytics/ItemAnalyticsDashboard";

export default function SupplierIntelligenceRoutes() {
    return (
        <Routes>
            {/* Default Redirect to Scorecard */}
            <Route path="/" element={<Navigate to="/suppliers/analytics" replace />} />

            {/* Tabs - MUST use absolute paths */}
            <Route path="/suppliers/analytics" element={<SupplierTracker />} />
            <Route path="/suppliers/item-trends" element={<ItemAnalyticsDashboard />} />
        </Routes>
    );
}