import React from "react";
import "./SupplierAnalytics.css"; // ✅ Import new CSS
import PurchasePayablesWidget from "../Analytics/PurchasePayablesWidget";
import PurchaseOrderPipelineWidget from "../Analytics/PurchaseOrderPipelineWidget";
import PurchaseReceiptQualityWidget from "../Analytics/PurchaseReceiptQualityWidget";
import SuppliersSpendingBarWidget from "../Analytics/SuppliersSpendingBarWidget";

function SupplierAnalytics() {
    return (
        <div className="supplier-analytics-grid">
            {/* Top Row: Key Metrics & Donuts */}
            <div className="analytics-widget-wrapper">
                <PurchasePayablesWidget/>
            </div>
            <div className="analytics-widget-wrapper">
                <PurchaseOrderPipelineWidget/>
            </div>
            <div className="analytics-widget-wrapper">
                <PurchaseReceiptQualityWidget />
            </div>

            {/* Bottom Row: Detailed Bar Chart (Full Width) */}
            <div className="analytics-widget-wrapper full-width">
                <SuppliersSpendingBarWidget topN={10} includeOthers />
            </div>
        </div>
    )
}

export default SupplierAnalytics;