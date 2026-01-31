import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SupplierOperationsRoutes from "./SupplierOperationsRoutes"; // Adjust path if needed

export default function PurchaseTrackerView() {
    const [activeTab, setActiveTab] = useState("tracker");
    const navigate = useNavigate();
    const location = useLocation();

    // Sync tab highlight with URL
    useEffect(() => {
        const p = location.pathname.toLowerCase();

        // Check for the second tab's route
        if (p.includes("logistics-hub")) {
            setActiveTab("logistics");
        } else {
            // Default to tracker
            setActiveTab("tracker");
        }
    }, [location.pathname]);

    // Navigation handlers (Using relative paths for flexibility)
    function goTracker() {
        setActiveTab("tracker");
        navigate("/suppliers/purchase-tracker");
    }

    function goLogistics() {
        setActiveTab("logistics");
        navigate("/suppliers/logistics-hub");
    }

    return (
        <div
            className={
                "purchase-view-page " +
                (activeTab === "logistics" ? "is-logistics" : "is-tracker")
            }
        >
            <div className="theme-tabs">
                <button
                    type="button"
                    className={"theme-tab-btn " + (activeTab === "tracker" ? "active" : "")}
                    onClick={goTracker}
                >
                    Purchase Tracker
                </button>

                <button
                    type="button"
                    className={"theme-tab-btn " + (activeTab === "logistics" ? "active" : "")}
                    onClick={goLogistics}
                >
                    City Logistics Hub
                </button>
            </div>

            {/* Render the Routes you provided */}
            <SupplierOperationsRoutes />
        </div>
    );
}