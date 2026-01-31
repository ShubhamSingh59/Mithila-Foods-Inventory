import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SupplierIntelligenceRoutes from "./SupplierIntelligenceRoutes"; // Adjust path if needed

export default function SupplierIntelligenceView() {
    const [activeTab, setActiveTab] = useState("scorecard");
    const navigate = useNavigate();
    const location = useLocation();

    // Sync tab highlight with URL
    useEffect(() => {
        const p = location.pathname.toLowerCase();

        // Check for the second tab's route
        if (p.includes("item-trends")) {
            setActiveTab("trends");
        } else {
            // Default to scorecard (analytics)
            setActiveTab("scorecard");
        }
    }, [location.pathname]);

    // Navigation handlers (Using relative paths)
    function goScorecard() {
        setActiveTab("scorecard");
        navigate("/suppliers/analytics");
    }

    function goTrends() {
        setActiveTab("trends");
        navigate("/suppliers/item-trends");
    }
    return (
        <div
            className={
                "intelligence-view-page " +
                (activeTab === "trends" ? "is-trends" : "is-scorecard")
            }
        >
            <div className="theme-tabs">
                <button
                    type="button"
                    className={"theme-tab-btn " + (activeTab === "scorecard" ? "active" : "")}
                    onClick={goScorecard}
                >
                    Supplier Scorecard
                </button>

                <button
                    type="button"
                    className={"theme-tab-btn " + (activeTab === "trends" ? "active" : "")}
                    onClick={goTrends}
                >
                    Item Price Trends
                </button>
            </div>

            {/* Render the Routes you provided */}
            <SupplierIntelligenceRoutes />
        </div>
    );
}