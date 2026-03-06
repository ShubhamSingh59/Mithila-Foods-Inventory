//import React, { useEffect, useState } from "react";
//import { useLocation, useNavigate } from "react-router-dom";
//import SupplierOperationsRoutes from "./SupplierOperationsRoutes"; // Adjust path if needed

//export default function PurchaseTrackerView() {
//    const [activeTab, setActiveTab] = useState("tracker");
//    const navigate = useNavigate();
//    const location = useLocation();

//    // Sync tab highlight with URL
//    useEffect(() => {
//        const p = location.pathname.toLowerCase();

//        // Check for the second tab's route
//        if (p.includes("logistics-hub")) {
//            setActiveTab("logistics");
//        } else {
//            // Default to tracker
//            setActiveTab("tracker");
//        }
//    }, [location.pathname]);

//    // Navigation handlers (Using relative paths for flexibility)
//    function goTracker() {
//        setActiveTab("tracker");
//        navigate("/suppliers/purchase-tracker");
//    }

//    function goLogistics() {
//        setActiveTab("logistics");
//        navigate("/suppliers/logistics-hub");
//    }

//    return (
//        <div
//            className={
//                "purchase-view-page " +
//                (activeTab === "logistics" ? "is-logistics" : "is-tracker")
//            }
//        >
//            <div className="theme-tabs">
//                <button
//                    type="button"
//                    className={"theme-tab-btn " + (activeTab === "tracker" ? "active" : "")}
//                    onClick={goTracker}
//                >
//                    Purchase Tracker
//                </button>

//                <button
//                    type="button"
//                    className={"theme-tab-btn " + (activeTab === "logistics" ? "active" : "")}
//                    onClick={goLogistics}
//                >
//                    City Logistics Hub
//                </button>
//            </div>

//            {/* Render the Routes you provided */}
//            <SupplierOperationsRoutes />
//        </div>
//    );
//}

import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import PurchaseRegisterList from "../Components/PurchaseTracker/PurchaseRegisterList";
import CityLogisticsHub from "../Components/CityLogisticsHub/CityLogisticsHub";

export default function PurchaseTrackerView() {
    const [activeTab, setActiveTab] = useState("tracker");
    const navigate = useNavigate();
    const location = useLocation();

    // Sync tab highlight with URL
    useEffect(() => {
        const p = location.pathname.toLowerCase();
        if (p.includes("logistics-hub")) {
            setActiveTab("logistics");
        } else {
            setActiveTab("tracker");
        }
    }, [location.pathname]);

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
            
            {/* TABS */}
            <div className="theme-tabs">
                <button
                    type="button"
                    className={"theme-tab-btn " + (activeTab === "tracker" ? "active" : "")}
                    onClick={() => navigate("/suppliers/operations/purchase-tracker")}
                >
                    Purchase Tracker
                </button>

                <button
                    type="button"
                    className={"theme-tab-btn " + (activeTab === "logistics" ? "active" : "")}
                    onClick={() => navigate("/suppliers/operations/logistics-hub")}
                >
                    City Logistics Hub
                </button>
            </div>

            {/* RENDER COMPONENTS (Keep Alive) */}
            <div style={{ display: activeTab === "tracker" ? "block" : "none", flex: 1 }}>
                <PurchaseRegisterList />
            </div>

            <div style={{ display: activeTab === "logistics" ? "block" : "none", flex: 1 }}>
                <CityLogisticsHub />
            </div>

        </div>
    );
}