import { getDoctypeList, getDoc, createDoc, submitDoc, api } from "./core";

// --- Sales Items ---
export async function getFinishedItemsForSales() {
    return getDoctypeList("Item", {
        fields: JSON.stringify(["name", "item_name", "stock_uom", "item_group", "custom_asin", "custom_easy_ship_sku", "custom_fba_sku"]),
        filters: JSON.stringify([["Item", "item_group", "=", "Products"]]),
        limit_page_length: 1000,
    });
}

// --- Sales Invoice ---
export async function getRecentSalesInvoices(limit = 20) {
    return getDoctypeList("Sales Invoice", {
        fields: JSON.stringify(["name", "customer", "company", "posting_date", "grand_total", "status", "is_return"]),
        filters: JSON.stringify([["Sales Invoice", "docstatus", "=", 1], ["Sales Invoice", "is_return", "=", 0]]),
        order_by: "posting_date desc, creation desc",
        limit_page_length: limit,
    });
}

export async function getSalesInvoiceWithItems(name) {
    return getDoc("Sales Invoice", name);
}

export async function createSalesInvoice(payload) {
    // payload must include { doctype: "Sales Invoice", ... }
    return createDoc("Sales Invoice", payload);
}

// --- Sales Returns ---
export async function getRecentSalesReturns(limit = 50) {
     return getDoctypeList("Sales Invoice", {
        fields: JSON.stringify(["name", "customer", "company", "posting_date", "grand_total", "return_against"]),
        filters: JSON.stringify([["Sales Invoice", "docstatus", "=", 1], ["Sales Invoice", "is_return", "=", 1]]),
        order_by: "posting_date desc, creation desc",
        limit_page_length: limit,
    });
}

// --- Payments ---
export async function createPaymentEntryForInvoice(inv) {
    const amount = inv.outstanding_amount || inv.grand_total;
    const payload = {
        doctype: "Payment Entry",
        payment_type: "Receive", // Sales = Receive
        company: inv.company,
        posting_date: new Date().toISOString().slice(0, 10),
        mode_of_payment: "Cash",
        party_type: "Customer",
        party: inv.customer,
        paid_to: "Cash - MF",
        paid_amount: amount,
        received_amount: amount,
        references: [{ reference_doctype: "Sales Invoice", reference_name: inv.name, allocated_amount: amount }]
    };
    
    const pe = await createDoc("Payment Entry", payload);
    if(pe.data?.name) await submitDoc("Payment Entry", pe.data.name);
    return pe.data?.name;
}