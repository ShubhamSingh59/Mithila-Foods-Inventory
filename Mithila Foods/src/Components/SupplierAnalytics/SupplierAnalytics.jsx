// SupplierAnalytics.jsx
import React, { useState } from "react";
import PurchasePayablesWidget from "../Analytics/PurchasePayablesWidget";
import PurchaseOrderPipelineWidget from "../Analytics/PurchaseOrderPipelineWidget";
import PurchaseReceiptQualityWidget from "../Analytics/PurchaseReceiptQualityWidget";
import SuppliersSpendingBarWidget from "../Analytics/SuppliersSpendingBarWidget";

function SupplierAnalytics() {
    return (
        <>
            <PurchasePayablesWidget/>
            <PurchaseOrderPipelineWidget/>
            <PurchaseReceiptQualityWidget />
            <SuppliersSpendingBarWidget topN={10} includeOthers />
        </>
    )
}

export default SupplierAnalytics