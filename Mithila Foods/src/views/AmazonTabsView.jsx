import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Import your Amazon Components
import AmazonOrders from "../Components/Marketplaces/Amazon/AmazonOrders";
import AmazonShippingTester from "../Components/Marketplaces/Amazon/AmazonShippingTester";
import AmazonShipmentList from "../Components/Marketplaces/Amazon/AmazonShipmentList";
import AmazonBulkShipment from "../Components/Marketplaces/Amazon/AmazonBulkShipment";
import AmazonBulkProcessing from "../Components/Marketplaces/Amazon/AmazonBulkProcessing";
import FbaInventory from "../Components/Marketplaces/Amazon/FbaInventory";
import AmazonPayoutWidget from "../Components/Marketplaces/Amazon/AmazonPayoutWidget";

export default function AmazonTabsView() {
    const [activeTab, setActiveTab] = useState("orders");
    const navigate = useNavigate();
    const location = useLocation();

    // --- Shipping Flow State (Moved here from App.jsx) ---
    const [selectedOrders, setSelectedOrders] = useState([]);
    const [shipView, setShipView] = useState('list'); // 'list', 'bulk', or 'processing'
    const [configuredBulkData, setConfiguredBulkData] = useState([]);

    // Sync tab with URL on load/change
    useEffect(() => {
        const p = location.pathname.toLowerCase();
        if (p.includes("/ship")) setActiveTab("shipping");
        else if (p.includes("/fbainventory")) setActiveTab("fba");
        else if (p.includes("/payout")) setActiveTab("payouts");
        else setActiveTab("orders"); // default to dashboard/orders
    }, [location.pathname]);

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
            
            {/* TABS */}
            <div className="theme-tabs" style={{ marginBottom: '20px' }}>
                <button type="button"
                    className={"theme-tab-btn" + (activeTab === "orders" ? " active" : "")}
                    onClick={() => navigate("/ecommerce/amazon/dashboard")}>Orders Dashboard</button>

                <button type="button"
                    className={"theme-tab-btn" + (activeTab === "shipping" ? " active" : "")}
                    onClick={() => navigate("/ecommerce/amazon/ship")}>Orders to Ship</button>

                <button type="button"
                    className={"theme-tab-btn" + (activeTab === "fba" ? " active" : "")}
                    onClick={() => navigate("/ecommerce/amazon/fbainventory")}>FBA Inventory</button>

                <button type="button"
                    className={"theme-tab-btn" + (activeTab === "payouts" ? " active" : "")}
                    onClick={() => navigate("/ecommerce/amazon/payout")}>Payouts & Reserve</button>
            </div>

            {/* RENDER ALL COMPONENTS (Hidden inactive ones keep data alive) */}
            
            {/* TAB 1: Orders Dashboard */}
            <div style={{ display: activeTab === "orders" ? "block" : "none", flex: 1 }}>
                <AmazonOrders />
                {/* Keeping your tester component here if you still need it */}
                <AmazonShippingTester /> 
            </div>

            {/* TAB 2: Shipping Flow */}
            <div style={{ display: activeTab === "shipping" ? "block" : "none", flex: 1 }}>
                {shipView === 'list' && (
                    <AmazonShipmentList
                        onProceedToBulk={(orders) => {
                            setSelectedOrders(orders);
                            setShipView('bulk');
                        }}
                    />
                )}
                {shipView === 'bulk' && (
                    <AmazonBulkShipment
                        selectedOrders={selectedOrders}
                        onBack={() => setShipView('list')}
                        onSchedule={(dataWithDimensions) => {
                            setConfiguredBulkData(dataWithDimensions);
                            setShipView('processing'); 
                        }}
                    />
                )}
                {shipView === 'processing' && (
                    <AmazonBulkProcessing
                        ordersToProcess={configuredBulkData}
                        onDone={() => setShipView('list')} 
                    />
                )}
            </div>

            {/* TAB 3: FBA Inventory */}
            <div style={{ display: activeTab === "fba" ? "block" : "none", flex: 1 }}>
                <FbaInventory />
            </div>

            {/* TAB 4: Payouts */}
            <div style={{ display: activeTab === "payouts" ? "block" : "none", flex: 1 }}>
                <AmazonPayoutWidget />
            </div>

        </div>
    );
}