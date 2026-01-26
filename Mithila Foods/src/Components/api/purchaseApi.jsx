import { getDoctypeList, getDoc, createDoc, submitDoc, updateDoc, cancelDoc, api } from "./core";

// --- Constants ---
export const MF_PO_FIELDS = {
  status: "custom_mf_status",
  updatedOn: "custom_mf_status_updated_on",
  stockPercent: "custom_mf_stock_in_percent",
};

export const MF_STATUS_OPTIONS = [
  "PO Draft", "PO Confirmed", "In Transit", "Delivered", 
  "QC Pass", "QC In", "Completed", "Cancelled"
];

function nowKolkata() {
    // Simplified timestamp
    return new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata", hour12: false }).replace(",","");
}

// --- Items ---
export async function getItemsForPO() {
  return getDoctypeList("Item", {
    fields: JSON.stringify(["name", "item_name", "item_group", "stock_uom"]),
    filters: JSON.stringify([["Item", "item_group", "in", ["Raw Material", "Pouch", "Sticker"]]]),
    limit_page_length: 1000,
  });
}

// --- Purchase Order ---
export async function createPurchaseOrder({ supplier, items, notes, po_date, schedule_date }) {
    const payload = {
        doctype: "Purchase Order",
        supplier,
        transaction_date: po_date,
        schedule_date: schedule_date,
        notes: notes || "",
        [MF_PO_FIELDS.status]: "PO Draft",
        [MF_PO_FIELDS.updatedOn]: nowKolkata(),
        items
    };
    return createDoc("Purchase Order", payload);
}

export async function getPurchaseOrderWithItems(name) {
    return getDoc("Purchase Order", name);
}

export async function updatePurchaseOrder(name, payload) {
    return updateDoc("Purchase Order", name, payload);
}

export async function setPurchaseOrderMfStatus(name, status, { stockPercent } = {}) {
    const patch = {
        [MF_PO_FIELDS.status]: status,
        [MF_PO_FIELDS.updatedOn]: nowKolkata(),
    };
    if (stockPercent != null) patch[MF_PO_FIELDS.stockPercent] = stockPercent;
    return updateDoc("Purchase Order", name, patch);
}

export async function setPurchaseOrderTransporter(poName, transporterName) {
    return updateDoc("Purchase Order", poName, { custom_transporter: transporterName });
}

export async function deletePurchaseOrder(name) {
    return api.post(`/api/method/frappe.client.delete`, { doctype: "Purchase Order", name });
}

export async function closePurchaseOrder(poName) {
    return api.post(`/api/method/erpnext.buying.doctype.purchase_order.purchase_order.close_or_unclose_purchase_orders`, {
        names: [poName], status: "Closed"
    });
}

export function getPurchaseOrderPdfUrl(poName) {
    const params = new URLSearchParams({ doctype: "Purchase Order", name: poName, format: "Standard", no_letterhead: "0" });
    return `${api.defaults.baseURL}/api/method/frappe.utils.print_format.download_pdf?${params.toString()}`;
}

// --- Purchase Receipt ---
export async function getPurchaseReceiptQualitySummary(opts) {
    // Copy logic from original file... 
    // Logic: fetch PRs -> fetch PR items -> sum accepted/rejected.
}

// --- Purchase Register ---
export async function getPurchaseRegisterList(opts) {
    // Copy the massive logic for getPurchaseRegisterList here. 
    // It's specific to purchase analytics.
}