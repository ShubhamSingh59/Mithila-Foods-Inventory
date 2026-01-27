// src/erpBackendApi.js
// This file contains all frontend helpers used to talk to your Node backend,
// which then talks to ERPNext.

// ------------------------------
// Imports
// ------------------------------
import axios from "axios";

// ------------------------------
// Base config and shared constants
// ------------------------------

// Base URL for your Node backend (proxy to ERPNext)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

// These doctypes change stock on submit.
// After submit, we notify the app so stock-related screens can refresh.
const STOCK_AFFECTING_DOCTYPES = new Set([
  "Stock Reconciliation",
  "Stock Entry",
  "Purchase Receipt",
  "Delivery Note",
  "Sales Invoice",
  "Purchase Invoice",
]);

// ------------------------------
// Generic helpers (CRUD + submit)
// ------------------------------

// Get list of documents from a doctype.
// Example: getDoctypeList("Item", { fields, filters, limit_page_length })
export async function getDoctypeList(doctype, params = {}) {
  const res = await axios.get(`${BACKEND_URL}/api/doctype/${doctype}`, {
    params,
  });
  return res.data.data;
}

// Get one document by doctype + name.
export async function getDoc(doctype, name) {
  const res = await axios.get(
    `${BACKEND_URL}/api/doc/${encodeURIComponent(doctype)}/${encodeURIComponent(
      name
    )}`
  );
  return res.data.data;
}

// Create a new document (generic).
// payload should contain "doctype" and other fields.
export async function createDoc(doctype, payload) {
  const res = await axios.post(`${BACKEND_URL}/api/doctype/${doctype}`, payload);
  return res.data;
}

// Submit a document (generic).
// Also triggers:
// 1) Stock refresh for stock affecting doctypes
// 2) MF status update when submitting Purchase Order
export async function submitDoc(doctype, name) {
  const res = await axios.post(`${BACKEND_URL}/api/submit`, { doctype, name });

  // Auto refresh everywhere after stock-affecting submit
  if (STOCK_AFFECTING_DOCTYPES.has(doctype)) {
    emitStockChanged();
  }

  // MF Status auto-update for Purchase Order
  if (doctype === "Purchase Order") {
    try {
      await setPurchaseOrderMfStatus(name, "PO Confirmed");
    } catch (e) {
      // Do not break your normal submit flow if status update fails
      console.error("MF status update failed:", e);
    }
  }

  return res.data;
}

// Update document (generic).
// Uses your Node backend route: PUT /api/doc/:doctype/:name
export async function updateDoc(doctype, name, payload) {
  const res = await axios.put(
    `${BACKEND_URL}/api/doc/${encodeURIComponent(doctype)}/${encodeURIComponent(
      name
    )}`,
    payload
  );
  return res.data; // { data: {...} }
}

// ------------------------------
// Master data helpers (Supplier / Customer / Company / Item / Warehouse)
// ------------------------------

// Supplier dropdown list (simple)
export async function getSuppliers() {
  return getDoctypeList("Supplier", {
    fields: JSON.stringify(["name", "supplier_name", "email_id"]),
    filters: JSON.stringify([["Supplier", "disabled", "=", 0]]),
    limit_page_length: 500,
  });
}

// Supplier list (detailed) with custom fields
export async function getSuppliersForList() {
  return getDoctypeList("Supplier", {
    fields: JSON.stringify([
      "name",
      "supplier_name",
      "supplier_group",
      "supplier_type",
      "disabled",
      "mobile_no",
      "email_id",

      // Custom fields
      "custom_contact_person",
      "custom_credit_limit",
      "custom_status",
      "custom_payment_qr",

      // Compliance and address/bank details
      "pan",
      "gstin",
      "gst_category",
      "supplier_primary_address",
      "primary_address",
      "default_bank_account",
      "custom_fssai",
      "custom_msme",
      "custom_udyam",
    ]),
    limit_page_length: 1000,
    order_by: "modified desc",
  });
}

// Read Select options from Supplier meta for custom_status field.
export async function getSupplierStatusOptions() {
  const res = await axios.get(
    `${BACKEND_URL}/api/method/frappe.desk.form.load.getdoctype`,
    { params: { doctype: "Supplier" } }
  );

  // ERPNext returns meta as docs[0].fields
  const docs = res.data.docs || [];
  if (!docs.length) return [];

  const fields = docs[0].fields || [];
  const statusField = fields.find((f) => f.fieldname === "custom_status");

  if (!statusField || !statusField.options) return [];

  // Options are newline-separated
  return statusField.options
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);
}
// --- Supplier Dashboard Stats (Tiles by custom status) ---
// Change this if your fieldname is different:
const SUPPLIER_STATUS_FIELD = "custom_status"; // e.g. "custom_supplier_status"

export async function getSupplierDashboardStatsByStatus() {
  // 1) Get all allowed statuses from meta (Select options)
  const statusOptions = await getSupplierStatusOptions(); // already in your file

  // 2) Fetch suppliers (minimal fields) in pages
  const pageSize = 1000;
  let start = 0;
  let all = [];

  while (true) {
    const rows = await getDoctypeList("Supplier", {
      fields: JSON.stringify(["name", "supplier_group", SUPPLIER_STATUS_FIELD]),
      limit_page_length: pageSize,
      limit_start: start,
      order_by: "modified desc",
    });

    all = all.concat(rows || []);
    if (!rows || rows.length < pageSize) break;
    start += pageSize;
  }

  // 3) Compute totals
  const total = all.length;

  const groups = new Set();
  const statusCounts = new Map();

  // Initialize counts for all known statuses
  (statusOptions || []).forEach((s) => statusCounts.set(s, 0));

  // Optional bucket for missing/unknown status values
  const UNKNOWN = "Unspecified";

  for (const s of all) {
    if (s.supplier_group) groups.add(s.supplier_group);

    const valRaw = s?.[SUPPLIER_STATUS_FIELD];
    const val = (valRaw && String(valRaw).trim()) || UNKNOWN;

    // If meta options didn't include it, still count it
    statusCounts.set(val, (statusCounts.get(val) || 0) + 1);
  }

  // Keep order: meta options first, then any extras (like Unspecified)
  const orderedStatusEntries = [];
  (statusOptions || []).forEach((opt) => {
    orderedStatusEntries.push([opt, statusCounts.get(opt) || 0]);
    statusCounts.delete(opt);
  });
  // append remaining (Unspecified / unexpected)
  for (const [k, v] of statusCounts.entries()) orderedStatusEntries.push([k, v]);

  return {
    total,
    categories: groups.size,
    statuses: orderedStatusEntries.map(([status, count]) => ({ status, count })),
  };
}

// Customer dropdown list
export async function getCustomers() {
  return getDoctypeList("Customer", {
    fields: JSON.stringify(["name", "customer_name"]),
    filters: JSON.stringify([["Customer", "disabled", "=", 0]]),
    limit_page_length: 1000,
  });
}

// Company dropdown list
export async function getCompanies() {
  return getDoctypeList("Company", {
    fields: JSON.stringify(["name", "company_name", "abbr"]),
    limit_page_length: 1000,
  });
}

// Get all warehouses (only non-group)
export async function getWarehouses() {
  return getDoctypeList("Warehouse", {
    fields: JSON.stringify(["name", "warehouse_name", "company", "is_group"]),
    filters: JSON.stringify([["Warehouse", "is_group", "=", 0]]),
    limit_page_length: 500,
  });
}

// Get all items (lightweight for mapping item_code -> item_name)
export async function getAllItems() {
  return getDoctypeList("Item", {
    fields: JSON.stringify(["name", "item_name", "item_group"]),
    limit_page_length: 5000,
  });
}

// Items allowed for Purchase Order (limited to specific item groups)
export async function getItemsForPO() {
  return getDoctypeList("Item", {
    fields: JSON.stringify(["name", "item_name", "item_group", "stock_uom"]),
    filters: JSON.stringify([
      ["Item", "item_group", "in", ["Raw Material", "Pouch", "Sticker"]],
    ]),
    limit_page_length: 1000,
  });
}

// Items for BOM screens (finished + raw), includes basic rates
export async function getItemsForBOM() {
  return getDoctypeList("Item", {
    fields: JSON.stringify([
      "name",
      "item_name",
      "stock_uom",
      "item_group",
      "item_group",
      "valuation_rate",
      "last_purchase_rate",
    ]),
    limit_page_length: 1000,
  });
}

// Finished goods items (Products group)
export async function getFinishedItems() {
  return getDoctypeList("Item", {
    fields: JSON.stringify(["name", "item_name", "stock_uom", "item_group"]),
    filters: JSON.stringify([["Item", "item_group", "=", "Products"]]),
    limit_page_length: 1000,
  });
}

// Finished goods for Sales (Products group) with custom SKU fields
export async function getFinishedItemsForSales() {
  return getDoctypeList("Item", {
    fields: JSON.stringify([
      "name",
      "item_name",
      "stock_uom",
      "item_group",
      "custom_asin",
      "custom_easy_ship_sku",
      "custom_fba_sku",
      "custom_fk_sku",
      "custom_blinkit_upc",
    ]),
    filters: JSON.stringify([["Item", "item_group", "=", "Products"]]),
    limit_page_length: 1000,
  });
}

// Child table: Item Supplier
// Used to build supplier -> items mapping.
// The "parent: Item" is important to avoid permission issues.
export async function getItemSuppliers() {
  return getDoctypeList("Item Supplier", {
    parent: "Item",
    fields: JSON.stringify(["parent", "supplier"]),
    limit_page_length: 5000,
  });
}

// ------------------------------
// Purchase Order helpers
// ------------------------------

// Create a Purchase Order with one item row.
// Supports selecting transaction_date and schedule_date.
export async function createPurchaseOrder({
  supplier,
  item_code,
  qty,
  rate,
  notes,
  warehouse,
  po_date,
  schedule_date,
}) {
  const today = new Date().toISOString().slice(0, 10);

  const txDate = po_date || today;
  const schedDate = schedule_date || txDate;

  const payload = {
    doctype: "Purchase Order",
    supplier,
    transaction_date: txDate,
    schedule_date: schedDate,
    notes: notes || "",

    // MF custom tracking fields
    [MF_PO_FIELDS.status]: "PO Draft",
    [MF_PO_FIELDS.updatedOn]: nowKolkataErpDatetime(),

    items: [
      {
        item_code,
        qty: Number(qty),
        rate: rate != null ? Number(rate) : undefined,
        schedule_date: schedDate,
        warehouse: warehouse || undefined,
      },
    ],
  };

  return createDoc("Purchase Order", payload);
}

// Get PO with child items.
// Using getDoc avoids direct "Purchase Order Item" list permissions.
export async function getPurchaseOrderWithItems(name) {
  return getDoc("Purchase Order", name);
}

// Update PO status field directly (not ERPNext workflow status method).
export async function updatePurchaseOrderStatus(name, status) {
  return updateDoc("Purchase Order", name, { status });
}

// Update PO (usually draft)
export async function updatePurchaseOrder(name, payload) {
  const res = await axios.put(
    `${BACKEND_URL}/api/doc/${encodeURIComponent(
      "Purchase Order"
    )}/${encodeURIComponent(name)}`,
    payload
  );
  return res.data;
}

// Cancel PO via backend helper (docstatus=2, status="Cancelled")
export async function cancelPurchaseOrder(name) {
  const res = await axios.post(`${BACKEND_URL}/api/cancel_doc`, {
    doctype: "Purchase Order",
    name,
  });
  return res.data;
}

// Delete PO via frappe.client.delete (usually only safe for drafts)
export async function deletePurchaseOrder(name) {
  const res = await axios.post(
    `${BACKEND_URL}/api/method/frappe.client.delete`,
    { doctype: "Purchase Order", name }
  );
  return res.data;
}

// Close Purchase Order using ERPNext method (bulk API expects array of names)
export async function closePurchaseOrder(poName) {
  const res = await axios.post(
    `${BACKEND_URL}/api/method/erpnext.buying.doctype.purchase_order.purchase_order.close_or_unclose_purchase_orders`,
    { names: [poName], status: "Closed" }
  );
  return res.data;
}

// Update Purchase Order status using ERPNext whitelisted method
export async function setPurchaseOrderStatus(name, status) {
  const res = await axios.post(
    `${BACKEND_URL}/api/method/erpnext.buying.doctype.purchase_order.purchase_order.update_status`,
    { status, name }
  );
  return res.data;
}

// ------------------------------
// Purchase Receipt helpers
// ------------------------------

// Update Purchase Receipt status using ERPNext whitelisted method
export async function setPurchaseReceiptStatus(docname, status) {
  const res = await axios.post(
    `${BACKEND_URL}/api/method/erpnext.stock.doctype.purchase_receipt.purchase_receipt.update_purchase_receipt_status`,
    { docname, status }
  );
  return res.data;
}

// Fetch one Purchase Receipt doc with items.
// This uses direct ERPNext /api/resource and localStorage token.
// It assumes your frontend is served from same origin as ERPNext,
// or you have a proxy that supports this route.
async function getPurchaseReceiptWithItems(prName) {
  try {
    const response = await fetch(`/api/resource/Purchase Receipt/${prName}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch PR ${prName}`);
    }

    const data = await response.json();
    return data.data;
  } catch (err) {
    console.error("Error fetching PR:", err);
    return null;
  }
}

// ------------------------------
// Purchase Email and PDF helpers
// ------------------------------

// Send PO email to supplier using frappe email maker
export async function sendPurchaseOrderEmail({
  poName,
  recipients, // "a@x.com,b@y.com"
  subject,
  message,
  printFormat = "Standard",
}) {
  const payload = {
    recipients,
    subject: subject || `Purchase Order ${poName}`,
    content:
      message ||
      `Dear Supplier,<br><br>Please find attached Purchase Order <b>${poName}</b>.<br><br>Regards,`,
    doctype: "Purchase Order",
    name: poName,
    send_email: 1,
    send_me_a_copy: 0,
    print_html: 0,
    print_format: printFormat,
  };

  const res = await axios.post(
    `${BACKEND_URL}/api/method/frappe.core.doctype.communication.email.make`,
    payload
  );
  return res.data;
}

// Build URL to download PO PDF through backend proxy
export function getPurchaseOrderPdfUrl(poName, format = "Standard") {
  const params = new URLSearchParams({
    doctype: "Purchase Order",
    name: poName,
    format,
    no_letterhead: "0",
  });

  return `${BACKEND_URL}/api/method/frappe.utils.print_format.download_pdf?${params.toString()}`;
}

// ------------------------------
// Purchase Payment Entry helpers (mark Purchase Invoice as Paid)
// ------------------------------

const DEFAULT_PURCHASE_MODE_OF_PAYMENT = "Cash";
const DEFAULT_PURCHASE_PAID_FROM_ACCOUNT = "Cash - MF";

// Create and submit Payment Entry for Purchase Invoice.
// Expects: pi.name, pi.company, pi.supplier, pi.grand_total, pi.outstanding_amount
export async function createPaymentEntryForPurchaseInvoice(pi) {
  const amount =
    typeof pi.outstanding_amount === "number" && !isNaN(pi.outstanding_amount)
      ? pi.outstanding_amount
      : pi.grand_total;

  const today = new Date().toISOString().slice(0, 10);

  const payload = {
    doctype: "Payment Entry",
    payment_type: "Pay",
    company: pi.company,
    posting_date: today,
    mode_of_payment: DEFAULT_PURCHASE_MODE_OF_PAYMENT,
    party_type: "Supplier",
    party: pi.supplier,

    // paid_from is your cash/bank account (credit)
    paid_from: DEFAULT_PURCHASE_PAID_FROM_ACCOUNT,

    paid_amount: amount,
    received_amount: amount,

    references: [
      {
        reference_doctype: "Purchase Invoice",
        reference_name: pi.name,
        total_amount: pi.grand_total,
        outstanding_amount: pi.outstanding_amount,
        allocated_amount: amount,
      },
    ],
  };

  const pe = await createDoc("Payment Entry", payload);
  const name = pe.data?.name;

  if (name) {
    await submitDoc("Payment Entry", name);
  }

  return name;
}

// ------------------------------
// BOM helpers
// ------------------------------

export async function getBoms() {
  return getDoctypeList("BOM", {
    fields: JSON.stringify([
      "name",
      "item",
      "quantity",
      "company",
      "is_active",
      "is_default",
      "raw_material_cost",
      "total_cost",
    ]),
    limit_page_length: 500,
  });
}

// Get child items of BOM using child doctype list
export async function getBomItems(bomName) {
  return getDoctypeList("BOM Item", {
    fields: JSON.stringify(["item_code", "item_name", "uom", "qty"]),
    filters: JSON.stringify([["BOM Item", "parent", "=", bomName]]),
    limit_page_length: 1000,
  });
}

// Get full BOM doc with items using doc API (avoids permission issues)
export async function getBomDocWithItems(name) {
  const res = await axios.get(
    `${BACKEND_URL}/api/doc/BOM/${encodeURIComponent(name)}`
  );
  return res.data.data;
}

// Create BOM doc (payload must include doctype:"BOM" and items array)
export async function createBOM(payload) {
  return createDoc("BOM", payload);
}

// Update BOM doc
export async function updateBOM(name, payload) {
  return updateDoc("BOM", name, payload);
}

// Price lists dropdown
export async function getPriceLists() {
  return getDoctypeList("Price List", {
    fields: JSON.stringify(["name", "price_list_name", "buying", "selling"]),
    filters: JSON.stringify([["Price List", "enabled", "=", 1]]),
    limit_page_length: 100,
  });
}

// Valuation rate from Item master
export async function getItemValuationRate(itemCode) {
  const rows = await getDoctypeList("Item", {
    fields: JSON.stringify([
      "name",
      "stock_uom",
      "valuation_rate",
      "last_purchase_rate",
    ]),
    filters: JSON.stringify([["Item", "name", "=", itemCode]]),
    limit_page_length: 1,
  });
  return rows[0] || null;
}

// Valuation rate for a specific warehouse from Bin
export async function getItemWarehouseValuationRate(itemCode, warehouse) {
  const rows = await getDoctypeList("Bin", {
    fields: JSON.stringify(["valuation_rate", "actual_qty", "stock_value"]),
    filters: JSON.stringify([
      ["Bin", "item_code", "=", itemCode],
      ["Bin", "warehouse", "=", warehouse],
    ]),
    limit_page_length: 1,
  });

  return rows[0] || null;
}

// Rate from Item Price for a given price list
export async function getItemRateFromPriceList(itemCode, priceList) {
  const rows = await getDoctypeList("Item Price", {
    fields: JSON.stringify(["price_list_rate", "currency"]),
    filters: JSON.stringify([
      ["Item Price", "item_code", "=", itemCode],
      ["Item Price", "price_list", "=", priceList],
    ]),
    limit_page_length: 1,
  });
  return rows[0] || null;
}

// Last purchase rate from latest Purchase Order Item
export async function getItemLastPurchaseRate(itemCode) {
  const rows = await getDoctypeList("Purchase Order Item", {
    fields: JSON.stringify(["rate", "parent", "creation"]),
    filters: JSON.stringify([["Purchase Order Item", "item_code", "=", itemCode]]),
    order_by: "creation desc",
    limit_page_length: 1,
  });
  return rows[0] || null;
}

// ------------------------------
// Sales helpers (Invoice / Order / Returns / Payments)
// ------------------------------

// Convert different date formats to YYYY-MM-DD.
// Supported: Date object, "YYYY-MM-DD", "DD-MM-YYYY", "DD/MM/YYYY", "DDMMYYYY"
function toYMD(input) {
  if (input == null) return "";

  if (input instanceof Date && !isNaN(input.getTime())) {
    return input.toISOString().slice(0, 10);
  }

  const s = String(input).trim();
  if (!s) return "";

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[t\s].*)?$/i);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  if (/^\d{8}$/.test(s)) {
    const dd = s.slice(0, 2);
    const mm = s.slice(2, 4);
    const yyyy = s.slice(4, 8);
    return `${yyyy}-${mm}-${dd}`;
  }

  return "";
}

// Create Sales Invoice with update_stock=1.
// Supports due date, PO number, PO date, and remarks.
export async function createSalesInvoice({
  customer,
  company,
  posting_date,
  due_date,
  warehouse,
  items,
  po_no,
  po_date,
  remarks,
}) {
  const today = new Date().toISOString().slice(0, 10);

  const posting = toYMD(posting_date) || today;

  // Keep due date >= posting date
  let due = toYMD(due_date) || posting;
  if (due && posting && due < posting) due = posting;

  const poDate = toYMD(po_date);

  const payload = {
    doctype: "Sales Invoice",
    customer,
    company,
    posting_date: posting,
    due_date: due,
    po_no: po_no || undefined,
    po_date: poDate || undefined,
    remarks: remarks || undefined,
    update_stock: 1,

    items: (items || []).map((row) => ({
      item_code: row.item_code,
      qty: Number(row.qty),
      rate: row.rate != null ? Number(row.rate) : undefined,
      warehouse,
    })),
  };

  const res = await createDoc("Sales Invoice", payload);

  // If backend returns id but not name, normalize it
  if (res?.data && !res.data.name && res.data.id) {
    return { ...res, data: { ...res.data, name: res.data.id } };
  }

  return res;
}

// Recent submitted invoices (exclude returns)
export async function getRecentSalesInvoices(limit = 20) {
  return getDoctypeList("Sales Invoice", {
    fields: JSON.stringify([
      "name",
      "customer",
      "company",
      "posting_date",
      "grand_total",
      "outstanding_amount",
      "status",
      "is_return",
    ]),
    filters: JSON.stringify([
      ["Sales Invoice", "docstatus", "=", 1],
      ["Sales Invoice", "is_return", "=", 0],
    ]),
    order_by: "posting_date desc, creation desc",
    limit_page_length: limit,
  });
}

// Get full Sales Invoice with items using doc API
export async function getSalesInvoiceWithItems(name) {
  const res = await axios.get(
    `${BACKEND_URL}/api/doc/Sales Invoice/${encodeURIComponent(name)}`
  );
  return res.data.data;
}

// Create a Sales Return (credit note) linked to original invoice.
// quality decides which warehouse stock returns to.
export async function createSalesReturn(invoiceDoc, quality) {
  // Change these to your actual warehouses
  const GOOD_RETURN_WH = "Finished Goods - MF";
  const DAMAGED_RETURN_WH = "Damaged - MF";

  const targetWarehouse = quality === "damaged" ? DAMAGED_RETURN_WH : GOOD_RETURN_WH;
  const today = new Date().toISOString().slice(0, 10);

  const items = (invoiceDoc.items || []).map((it) => ({
    item_code: it.item_code,
    qty: -Math.abs(parseFloat(it.qty) || 0),
    rate: it.rate,
    warehouse: targetWarehouse,
  }));

  const payload = {
    doctype: "Sales Invoice",
    is_return: 1,
    return_against: invoiceDoc.name,
    company: invoiceDoc.company,
    customer: invoiceDoc.customer,
    posting_date: today,
    update_stock: 1,
    items,
  };

  const res = await createDoc("Sales Invoice", payload);
  const name = res.data?.name;

  if (name) {
    await submitDoc("Sales Invoice", name);
  }

  return name;
}

// Recent Sales Returns (submitted only)
export async function getRecentSalesReturns(limit = 50) {
  return getDoctypeList("Sales Invoice", {
    fields: JSON.stringify([
      "name",
      "customer",
      "company",
      "posting_date",
      "grand_total",
      "return_against",
    ]),
    filters: JSON.stringify([
      ["Sales Invoice", "docstatus", "=", 1],
      ["Sales Invoice", "is_return", "=", 1],
    ]),
    order_by: "posting_date desc, creation desc",
    limit_page_length: limit,
  });
}

// Create a Return Delivery Note (stock comes back in).
// Not linked to original invoice.
export async function createReturnDeliveryNote({
  customer,
  company,
  posting_date,
  items,
}) {
  const payload = {
    doctype: "Delivery Note",
    customer,
    company,
    posting_date,
    is_return: 1,
    items: items.map((row) => ({
      item_code: row.item_code,
      qty: -Math.abs(Number(row.qty) || 0),
      rate: row.rate != null ? Number(row.rate) : undefined,
      warehouse: row.warehouse || undefined,
    })),
  };

  return createDoc("Delivery Note", payload);
}

// Create a standalone Sales Return Invoice (credit note).
// Stock is not updated here (assumes Return Delivery Note already did stock update).
export async function createStandaloneSalesReturnInvoice({
  customer,
  company,
  posting_date,
  items,
}) {
  const payload = {
    doctype: "Sales Invoice",
    customer,
    company,
    posting_date,
    due_date: posting_date,
    is_return: 1,
    update_stock: 0,
    items: items.map((row) => ({
      item_code: row.item_code,
      qty: -Math.abs(Number(row.qty) || 0),
      rate: row.rate != null ? Number(row.rate) : undefined,
    })),
  };

  return createDoc("Sales Invoice", payload);
}

// Payment Entry for Sales Invoice (mark invoice as Paid)
const DEFAULT_MODE_OF_PAYMENT = "Cash";
const DEFAULT_PAID_TO_ACCOUNT = "Cash - MF";

// inv must have: name, customer, company, grand_total, outstanding_amount
export async function createPaymentEntryForInvoice(inv) {
  const amount =
    typeof inv.outstanding_amount === "number" && !isNaN(inv.outstanding_amount)
      ? inv.outstanding_amount
      : inv.grand_total;

  const today = new Date().toISOString().slice(0, 10);

  const payload = {
    doctype: "Payment Entry",
    payment_type: "Receive",
    company: inv.company,
    posting_date: today,
    mode_of_payment: DEFAULT_MODE_OF_PAYMENT,
    party_type: "Customer",
    party: inv.customer,
    paid_to: DEFAULT_PAID_TO_ACCOUNT,
    paid_amount: amount,
    received_amount: amount,
    references: [
      {
        reference_doctype: "Sales Invoice",
        reference_name: inv.name,
        total_amount: inv.grand_total,
        outstanding_amount: inv.outstanding_amount,
        allocated_amount: amount,
      },
    ],
  };

  const pe = await createDoc("Payment Entry", payload);
  const name = pe.data?.name;

  if (name) {
    await submitDoc("Payment Entry", name);
  }

  return name;
}

// Sales Order helpers below rely on a variable named "api" that is not defined in this file.
// If you want to keep these, define "api" as an axios instance or update them to use axios/BACKEND_URL.

// Create Sales Order (DRAFT)
export async function createSalesOrder(payload) {
  return api.post("/api/resource/Sales Order", payload);
}

// Recent submitted Sales Orders
export async function getRecentSalesOrders(limit = 10) {
  return getDoctypeList("Sales Order", {
    fields: JSON.stringify([
      "name",
      "customer",
      "company",
      "transaction_date",
      "grand_total",
      "status",
      "docstatus",
      "per_billed",
      "modified",
    ]),
    filters: JSON.stringify([["Sales Order", "docstatus", "=", 1]]),
    order_by: "modified desc",
    limit_page_length: limit,
  });
}

// Get Sales Order with items
export async function getSalesOrderWithItems(name) {
  return getDoc("Sales Order", name);
}

// Create Sales Invoice from Sales Order using ERPNext mapper.
// Uses "api" axios instance, not BACKEND_URL/axios directly.
export async function createSalesInvoiceFromSalesOrder(salesOrderName) {
  const mapped = await api.post(
    "/api/method/erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice",
    { source_name: salesOrderName }
  );

  const siDoc = mapped?.data?.message;
  if (!siDoc) throw new Error("make_sales_invoice did not return a Sales Invoice document.");

  const inserted = await api.post("/api/method/frappe.client.insert", {
    doc: siDoc,
  });

  const insertedDoc = inserted?.data?.message;
  const siName = insertedDoc?.name || insertedDoc;
  if (!siName) throw new Error("Inserted Sales Invoice name not returned.");

  return { siName };
}

// ------------------------------
// Stock helpers (Bin + Stock Ledger)
// ------------------------------

// Get Bin row for a given item + warehouse (current stock & valuation)
export async function getBinForItemWarehouse(itemCode, warehouse) {
  const rows = await getDoctypeList("Bin", {
    fields: JSON.stringify([
      "item_code",
      "warehouse",
      "actual_qty",
      "valuation_rate",
      "stock_value",
    ]),
    filters: JSON.stringify([
      ["Bin", "item_code", "=", itemCode],
      ["Bin", "warehouse", "=", warehouse],
    ]),
    limit_page_length: 1,
  });

  return rows[0] || null;
}

// Get stock ledger entries up to a given date (inclusive)
export async function getStockLedgerUpToDate(date) {
  return getDoctypeList("Stock Ledger Entry", {
    fields: JSON.stringify([
      "name",
      "item_code",
      "warehouse",
      "posting_date",
      "posting_time",
      "actual_qty",
      "qty_after_transaction",
      "voucher_type",
      "voucher_no",
    ]),
    filters: JSON.stringify([["Stock Ledger Entry", "posting_date", "<=", date]]),
    order_by: "posting_date asc, posting_time asc, creation asc",
    limit_page_length: 10000,
  });
}

// ------------------------------
// Manufacturing helpers (Work Order + Stock Entry)
// ------------------------------

export async function getRecentWorkOrders(limit = 20) {
  return getDoctypeList("Work Order", {
    fields: JSON.stringify([
      "name",
      "production_item",
      "qty",
      "produced_qty",
      "status",
      "docstatus",
      "bom_no",
      "company",
      "modified",
    ]),
    order_by: "modified desc",
    limit_page_length: limit,
  });
}

// Create Work Order and submit it
export async function createAndSubmitWorkOrder(payload) {
  const created = await createDoc("Work Order", payload);
  const name = created?.data?.name;
  if (!name) throw new Error("Work Order not created (missing name).");
  await submitDoc("Work Order", name);
  return name;
}

// Create Stock Entry and submit it
export async function createAndSubmitStockEntry(payload) {
  const created = await createDoc("Stock Entry", payload);
  const name = created?.data?.name;
  if (!name) throw new Error("Stock Entry not created (missing name).");
  await submitDoc("Stock Entry", name);
  return name;
}

// Small concurrency limiter to reduce too many requests at once
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;

  const workers = new Array(limit).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return out;
}

// Set Work Order status using ERPNext method if available, else fallback to set_value
export async function setWorkOrderStatus(workOrderName, status) {
  try {
    const res = await axios.post(
      `${BACKEND_URL}/api/method/erpnext.manufacturing.doctype.work_order.work_order.update_status`,
      { status, name: workOrderName }
    );
    return res.data;
  } catch (err) {
    const res2 = await axios.post(
      `${BACKEND_URL}/api/method/frappe.client.set_value`,
      {
        doctype: "Work Order",
        name: workOrderName,
        fieldname: "status",
        value: status,
      }
    );
    return res2.data;
  }
}

// ------------------------------
// Analytics helpers (ERPNext Reports)
// ------------------------------

export async function runReport(report_name, filters = {}) {
  const res = await axios.post(`${BACKEND_URL}/api/report/run`, {
    report_name,
    filters,
  });
  return res.data;
}

export async function getActiveFiscalYears() {
  const res = await axios.get(`${BACKEND_URL}/api/doctype/Fiscal Year`, {
    params: {
      fields: JSON.stringify([
        "name",
        "year_start_date",
        "year_end_date",
        "disabled",
      ]),
      filters: JSON.stringify([["Fiscal Year", "disabled", "=", 0]]),
      order_by: "year_start_date desc",
      limit_page_length: 1000,
    },
  });
  return res.data.data;
}

export function pickFiscalYearForDate(fys, dateStr) {
  return (
    fys.find((fy) => fy.year_start_date <= dateStr && dateStr <= fy.year_end_date) ||
    fys[0] ||
    null
  );
}

export function getProfitAndLoss({
  company,
  from_date,
  to_date,
  periodicity = "Monthly",
}) {
  return runReport("Profit and Loss Statement", {
    company,
    periodicity,
    period_start_date: from_date,
    period_end_date: to_date,
  });
}

export function getSalesAnalytics({
  company,
  from_date,
  to_date,
  range = "Monthly",
  value_quantity = "Value",
  tree_type = "Item Group",
  doc_type = "Sales Invoice",
}) {
  return runReport("Sales Analytics", {
    company,
    from_date,
    to_date,
    range,
    value_quantity,
    tree_type,
    doc_type,
  });
}

export function getPurchaseAnalytics({
  company,
  from_date,
  to_date,
  range = "Monthly",
  value_quantity = "Value",
  tree_type = "Item Group",
  doc_type = "Purchase Invoice",
}) {
  return runReport("Purchase Analytics", {
    company,
    from_date,
    to_date,
    range,
    value_quantity,
    tree_type,
    doc_type,
  });
}

export function getStockBalance({ company }) {
  return runReport("Stock Balance", { company });
}

export function getAccountsReceivable({ company, report_date }) {
  return runReport("Accounts Receivable", { company, report_date });
}

export function getAccountsPayable({ company, report_date }) {
  return runReport("Accounts Payable", { company, report_date });
}

// ------------------------------
// MF custom fields and MF status update helpers
// ------------------------------

// Fieldnames must match your ERPNext custom fields
export const MF_PO_FIELDS = {
  status: "custom_mf_status",
  updatedOn: "custom_mf_status_updated_on",
  stockPercent: "custom_mf_stock_in_percent",
};

// Allowed values for MF status (must match Select options in ERPNext)
export const MF_STATUS_OPTIONS = [
  "PO Draft",
  "PO Confirmed",
  "In Transit",
  "Delivered",
  "QC Pass",
  "QC In",
  "Completed",
  "Cancelled",
];

// ERPNext expects datetime as "YYYY-MM-DD HH:mm:ss"
function nowKolkataErpDatetime() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${m.year}-${m.month}-${m.day} ${m.hour}:${m.minute}:${m.second}`;
}

// Update MF status fields on Purchase Order
export async function setPurchaseOrderMfStatus(poName, mfStatus, { stockPercent } = {}) {
  const patch = {
    [MF_PO_FIELDS.status]: mfStatus,
    [MF_PO_FIELDS.updatedOn]: nowKolkataErpDatetime(),
  };

  if (stockPercent !== undefined && stockPercent !== null && stockPercent !== "") {
    patch[MF_PO_FIELDS.stockPercent] = Number(stockPercent);
  }

  return updateDoc("Purchase Order", poName, patch);
}

// ------------------------------
// File upload helper
// ------------------------------

// Upload file and attach to a document
export async function uploadFileToDoc({ doctype, docname, file, is_private = 1 }) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("doctype", doctype);
  fd.append("docname", docname);
  fd.append("is_private", String(is_private));
  fd.append("file_name", file.name);

  const res = await axios.post(`${BACKEND_URL}/api/upload`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
}

// ------------------------------
// Stock change event bus (frontend refresh trigger)
// ------------------------------

const stockListeners = new Set();

// Subscribe to stock changes.
// Returns an unsubscribe function.
export function onStockChanged(fn) {
  stockListeners.add(fn);
  return () => stockListeners.delete(fn);
}

// Notify all subscribers that stock changed
export function emitStockChanged() {
  stockListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  });
}

// ------------------------------
// Sales listing helpers (drafts + recent submitted)
// ------------------------------

// These list helpers use "api" which is not defined in this file.
// If you want these to work, define "api" (axios instance) or rewrite using axios + BACKEND_URL.

// List Sales Invoices with filters
export async function listSalesInvoices({
  filters = [],
  fields,
  order_by,
  limit = 20,
}) {
  const res = await api.get(`/api/resource/Sales%20Invoice`, {
    params: {
      fields: JSON.stringify(
        fields || [
          "name",
          "customer",
          "company",
          "posting_date",
          "grand_total",
          "outstanding_amount",
          "status",
          "docstatus",
          "modified",
        ]
      ),
      filters: JSON.stringify(filters),
      order_by: order_by || "modified desc",
      limit_page_length: limit,
    },
  });

  return res?.data?.data || [];
}

// Returns: all drafts + last N submitted returns
export async function getSalesReturnsRecentAndDrafts({
  draftLimit = 200,
  recentSubmittedLimit = 10,
} = {}) {
  const [drafts, submitted] = await Promise.all([
    listSalesInvoices({
      filters: [
        ["is_return", "=", 1],
        ["docstatus", "=", 0],
      ],
      order_by: "modified desc",
      limit: draftLimit,
    }),
    listSalesInvoices({
      filters: [
        ["is_return", "=", 1],
        ["docstatus", "=", 1],
      ],
      order_by: "modified desc",
      limit: recentSubmittedLimit,
    }),
  ]);

  const map = new Map();
  (drafts || []).forEach((d) => map.set(d.name, d));
  (submitted || []).forEach((s) => {
    if (!map.has(s.name)) map.set(s.name, s);
  });

  return Array.from(map.values());
}

// Returns: all drafts + last N submitted invoices (non-returns)
export async function getSalesInvoicesRecentAndDrafts({
  draftLimit = 200,
  recentSubmittedLimit = 10,
} = {}) {
  const [drafts, submitted] = await Promise.all([
    listSalesInvoices({
      filters: [
        ["is_return", "=", 0],
        ["docstatus", "=", 0],
      ],
      order_by: "modified desc",
      limit: draftLimit,
    }),
    listSalesInvoices({
      filters: [
        ["is_return", "=", 0],
        ["docstatus", "=", 1],
      ],
      order_by: "modified desc",
      limit: recentSubmittedLimit,
    }),
  ]);

  const map = new Map();
  (drafts || []).forEach((d) => map.set(d.name, d));
  (submitted || []).forEach((s) => {
    if (!map.has(s.name)) map.set(s.name, s);
  });

  return Array.from(map.values());
}

// Save doc (used to update drafts with child tables).
// This uses BASE_URL and authHeaders which are not defined in this file.
export async function saveDoc(doc) {
  const res = await axios.post(
    `${BASE_URL}/api/method/frappe.client.save`,
    { doc },
    { headers: authHeaders() }
  );
  return res.data?.message;
}

// ------------------------------
// MF flow helpers (Stock Entry tracking by remarks tag)
// ------------------------------

function chunkArray(arr, size = 150) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// List Stock Entries for MF flow by:
// 1) custom_mf_track = 1
// 2) remarks contains flowTag
export async function listMfFlowStockEntries({ flowTag, limit = 300 } = {}) {
  if (!flowTag) return [];
  const like = `%${flowTag}%`;

  return getDoctypeList("Stock Entry", {
    fields: JSON.stringify([
      "name",
      "stock_entry_type",
      "purpose",
      "posting_date",
      "posting_time",
      "company",
      "remarks",
      "docstatus",
      "modified",
      "custom_mf_track",
    ]),
    filters: JSON.stringify([
      ["Stock Entry", "custom_mf_track", "=", 1],
      ["Stock Entry", "remarks", "like", like],
    ]),
    order_by: "posting_date desc, posting_time desc, modified desc",
    limit_page_length: limit,
  });
}

// List only submitted Manufacture stock entries for this flow
export async function listMfFlowManufactureEntries({ flowTag, limit = 300 } = {}) {
  const all = await listMfFlowStockEntries({ flowTag, limit });
  return (all || []).filter(
    (x) => x.docstatus === 1 && x.stock_entry_type === "Manufacture"
  );
}

// Get Stock Ledger Entries for given voucher numbers and warehouse
export async function getMfFlowSleForWarehouse({ voucherNos = [], warehouse }) {
  if (!voucherNos.length || !warehouse) return [];
  const chunks = chunkArray(voucherNos, 150);

  const all = [];
  for (const part of chunks) {
    const rows = await getDoctypeList("Stock Ledger Entry", {
      fields: JSON.stringify([
        "item_code",
        "warehouse",
        "actual_qty",
        "voucher_no",
        "posting_date",
        "posting_time",
      ]),
      filters: JSON.stringify([
        ["Stock Ledger Entry", "voucher_type", "=", "Stock Entry"],
        ["Stock Ledger Entry", "warehouse", "=", warehouse],
        ["Stock Ledger Entry", "voucher_no", "in", part],
      ]),
      order_by: "posting_date asc, posting_time asc, creation asc",
      limit_page_length: 10000,
    });
    all.push(...(rows || []));
  }
  return all;
}

// Remaining qty in WIP for this flow (net balance in WIP warehouse)
export async function getMfFlowWipBalances({ flowTag, wipWarehouse }) {
  if (!flowTag || !wipWarehouse) return [];

  const ses = await listMfFlowStockEntries({ flowTag, limit: 500 });
  const voucherNos = (ses || []).map((x) => x.name).filter(Boolean);
  if (!voucherNos.length) return [];

  const sle = await getMfFlowSleForWarehouse({
    voucherNos,
    warehouse: wipWarehouse,
  });

  const map = new Map();
  (sle || []).forEach((r) => {
    const code = r.item_code;
    const q = Number(r.actual_qty) || 0;
    map.set(code, (map.get(code) || 0) + q);
  });

  return Array.from(map.entries())
    .map(([item_code, remaining_qty]) => ({ item_code, remaining_qty }))
    .filter((x) => x.remaining_qty > 0.0000001)
    .sort((a, b) => a.item_code.localeCompare(b.item_code));
}

// ------------------------------
// Transporter helpers
// ------------------------------

// Change this doctype name to your real Transporter doctype
const TRANSPORTER_DOCTYPE = "Transporter";

export async function getTransportersForList() {
  return getDoctypeList(TRANSPORTER_DOCTYPE, {
    fields: JSON.stringify([
      "name",
      "transporter_name",
      "point_of_contact",
      "contact",
      "address",
      "rating",
      "working_days",
    ]),
    limit_page_length: 1000,
    order_by: "modified desc",
  });
}

// ------------------------------
// Stock Reconciliation helpers (list + child items + summary)
// ------------------------------

// List Stock Reconciliation entries with optional date range.
// Excludes Opening Stock by enforcing purpose = "Stock Reconciliation".
export async function getStockReconciliationEntries({
  from_date,
  to_date,
  includeDrafts = true,
  limit = 500,
} = {}) {
  const filters = [];

  if (from_date) filters.push(["Stock Reconciliation", "posting_date", ">=", from_date]);
  if (to_date) filters.push(["Stock Reconciliation", "posting_date", "<=", to_date]);

  // Exclude opening stock
  filters.push(["Stock Reconciliation", "purpose", "=", "Stock Reconciliation"]);

  // Exclude cancelled
  if (includeDrafts) {
    filters.push(["Stock Reconciliation", "docstatus", "in", [0, 1]]);
  } else {
    filters.push(["Stock Reconciliation", "docstatus", "=", 1]);
  }

  return getDoctypeList("Stock Reconciliation", {
    fields: JSON.stringify([
      "name",
      "posting_date",
      "posting_time",
      "company",
      "purpose",
      "docstatus",
      "modified",
    ]),
    filters: JSON.stringify(filters),
    order_by: "posting_date desc, posting_time desc, modified desc",
    limit_page_length: limit,
  });
}

// Fetch Stock Reconciliation Item rows for multiple parents.
// "parent: Stock Reconciliation" is required for permissions.
export async function getStockReconciliationItemsForParents(parentNames = []) {
  if (!parentNames.length) return [];

  const chunk = (arr, size = 100) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const all = [];
  const parts = chunk(parentNames, 100);

  for (const part of parts) {
    const rows = await getDoctypeList("Stock Reconciliation Item", {
      parent: "Stock Reconciliation",
      fields: JSON.stringify(["parent", "item_code", "warehouse", "qty", "current_qty"]),
      filters: JSON.stringify([["Stock Reconciliation Item", "parent", "in", part]]),
      limit_page_length: 10000,
    });

    all.push(...(rows || []));
  }

  return all;
}

// Get Stock Reconciliation entries and attach summary:
// 1) item count
// 2) first item name + how many more
// 3) first warehouse + how many more
// 4) total qty change (qty - current_qty) across all lines
export async function getStockReconciliationEntriesWithSummary(opts = {}) {
  const parents = await getStockReconciliationEntries(opts);
  const parentNames = (parents || []).map((p) => p.name).filter(Boolean);
  if (!parentNames.length) return [];

  let childRows = [];
  try {
    childRows = await getStockReconciliationItemsForParents(parentNames);
  } catch (e) {
    // Fallback: load each parent doc and read items
    console.error("Child list failed, fallback to getDoc per parent", e);

    childRows = [];
    const docs = await mapLimit(parents, 6, async (p) =>
      getDoc("Stock Reconciliation", p.name)
    );

    docs.forEach((doc) => {
      (doc.items || []).forEach((it) => {
        childRows.push({
          parent: doc.name,
          item_code: it.item_code,
          warehouse: it.warehouse,
          qty: it.qty,
          current_qty: it.current_qty,
        });
      });
    });
  }

  // Build item_code -> item_name map
  const itemCodes = Array.from(new Set(childRows.map((x) => x.item_code).filter(Boolean)));
  const itemNameMap = new Map();

  if (itemCodes.length) {
    const chunk = (arr, size = 100) => {
      const out = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };

    for (const part of chunk(itemCodes, 100)) {
      const items = await getDoctypeList("Item", {
        fields: JSON.stringify(["name", "item_name"]),
        filters: JSON.stringify([["Item", "name", "in", part]]),
        limit_page_length: 1000,
      });

      (items || []).forEach((it) => itemNameMap.set(it.name, it.item_name || it.name));
    }
  }

  // Helper to show: "First +N"
  const summarize = (arr) => {
    const uniq = Array.from(new Set(arr.filter(Boolean)));
    if (!uniq.length) return "—";
    if (uniq.length === 1) return uniq[0];
    return `${uniq[0]} +${uniq.length - 1}`;
  };

  // Group child rows by parent name
  const byParent = new Map();
  childRows.forEach((r) => {
    if (!r.parent) return;
    if (!byParent.has(r.parent)) byParent.set(r.parent, []);
    byParent.get(r.parent).push(r);
  });

  return (parents || []).map((p) => {
    const lines = byParent.get(p.name) || [];
    const itemNames = lines.map((l) => itemNameMap.get(l.item_code) || l.item_code);
    const warehouses = lines.map((l) => l.warehouse);

    // Qty Change = qty - current_qty
    const qtyChange = lines.reduce((sum, l) => {
      const qty = Number(l.qty) || 0;
      const currentQty = Number(l.current_qty) || 0;
      return sum + (qty - currentQty);
    }, 0);

    return {
      ...p,
      _itemsCount: lines.length,
      _itemDisplay: summarize(itemNames),
      _warehouseDisplay: summarize(warehouses),
      _qtyChange: qtyChange,
    };
  });
}

// ------------------------------
// Generic: read Select options from doctype meta for any field
// ------------------------------
export async function getDoctypeFieldOptions(doctype, fieldname) {
  const res = await axios.get(
    `${BACKEND_URL}/api/method/frappe.desk.form.load.getdoctype`,
    { params: { doctype } }
  );

  const docs = res.data.docs || [];
  if (!docs.length) return [];

  const fields = docs[0].fields || [];
  const f = fields.find((x) => x.fieldname === fieldname);

  if (!f || !f.options) return [];

  return String(f.options)
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);
}

// ------------------------------
// Transporter Dashboard Stats (Tiles by status field)
// ------------------------------
export async function getTransporterDashboardStatsByStatus() {
  const STATUS_FIELD = "status";
  const UNKNOWN = "Unspecified";

  // 1) status options from meta (if Select)
  const statusOptions = await getDoctypeFieldOptions(TRANSPORTER_DOCTYPE, STATUS_FIELD);

  // 2) fetch transporters in pages (minimal fields)
  const pageSize = 1000;
  let start = 0;
  let all = [];

  while (true) {
    const rows = await getDoctypeList(TRANSPORTER_DOCTYPE, {
      fields: JSON.stringify(["name", STATUS_FIELD]),
      limit_page_length: pageSize,
      limit_start: start,
      order_by: "modified desc",
    });

    all = all.concat(rows || []);
    if (!rows || rows.length < pageSize) break;
    start += pageSize;
  }

  const total = all.length;

  // 3) count by status
  const statusCounts = new Map();
  (statusOptions || []).forEach((s) => statusCounts.set(s, 0));

  for (const t of all) {
    const valRaw = t?.[STATUS_FIELD];
    const val = (valRaw && String(valRaw).trim()) || UNKNOWN;
    statusCounts.set(val, (statusCounts.get(val) || 0) + 1);
  }

  // Active count (case-insensitive match "Active")
  let active = 0;
  for (const [k, v] of statusCounts.entries()) {
    if (String(k).toLowerCase() === "active") active = v;
  }

  // keep meta order first, then extra values
  const ordered = [];
  (statusOptions || []).forEach((opt) => {
    ordered.push([opt, statusCounts.get(opt) || 0]);
    statusCounts.delete(opt);
  });
  for (const [k, v] of statusCounts.entries()) ordered.push([k, v]);

  return {
    total,
    active,
    statuses: ordered.map(([status, count]) => ({ status, count })),
  };
}

// ------------------------------
// Purchase Payables Analytics (Purchase Invoice)
// ------------------------------

// Fetch all submitted (docstatus=1) Purchase Invoices and compute totals
// ------------------------------
// Purchase Invoice Payables Summary (Paid vs Outstanding)
// ------------------------------
export async function getPurchaseInvoicePayablesSummary({
  from_date,
  to_date,
  supplier, // optional
} = {}) {
  const pageSize = 1000;
  let start = 0;

  let totalInvoiceValue = 0;
  let totalOutstanding = 0;
  let invoiceCount = 0;

  const filters = [
    ["Purchase Invoice", "docstatus", "=", 1], // submitted only
    // optional: ignore returns if you use credit notes in Purchase Invoice
    // ["Purchase Invoice", "is_return", "=", 0],
  ];

  if (supplier) filters.push(["Purchase Invoice", "supplier", "=", supplier]);
  if (from_date) filters.push(["Purchase Invoice", "posting_date", ">=", from_date]);
  if (to_date) filters.push(["Purchase Invoice", "posting_date", "<=", to_date]);

  while (true) {
    const rows = await getDoctypeList("Purchase Invoice", {
      fields: JSON.stringify(["name", "grand_total", "outstanding_amount"]),
      filters: JSON.stringify(filters),
      limit_page_length: pageSize,
      limit_start: start,
      order_by: "posting_date desc, creation desc",
    });

    const list = rows || [];
    invoiceCount += list.length;

    for (const r of list) {
      totalInvoiceValue += Number(r.grand_total) || 0;
      totalOutstanding += Number(r.outstanding_amount) || 0;
    }

    if (list.length < pageSize) break;
    start += pageSize;
  }

  const totalPaid = totalInvoiceValue - totalOutstanding;

  return {
    invoiceCount,
    totalInvoiceValue,
    totalPaid,
    totalOutstanding,
  };
}


// Optional: group totals by supplier (useful for analytics table / ranking)
export async function getPurchasePayablesBySupplier({
  company,
  from_date,
  to_date,
  includeReturns = false,
} = {}) {
  // reuse the summary fetch but without supplier filter
  const filters = [["Purchase Invoice", "docstatus", "=", 1]];
  if (!includeReturns) filters.push(["Purchase Invoice", "is_return", "=", 0]);
  if (company) filters.push(["Purchase Invoice", "company", "=", company]);
  if (from_date) filters.push(["Purchase Invoice", "posting_date", ">=", from_date]);
  if (to_date) filters.push(["Purchase Invoice", "posting_date", "<=", to_date]);

  const pageSize = 1000;
  let start = 0;
  let all = [];

  while (true) {
    const rows = await getDoctypeList("Purchase Invoice", {
      fields: JSON.stringify(["supplier", "grand_total", "outstanding_amount"]),
      filters: JSON.stringify(filters),
      order_by: "posting_date desc, creation desc",
      limit_page_length: pageSize,
      limit_start: start,
    });

    all = all.concat(rows || []);
    if (!rows || rows.length < pageSize) break;
    start += pageSize;
  }

  const map = new Map();

  for (const r of all) {
    const key = r.supplier || "Unknown";
    const total = Number(r.grand_total) || 0;
    const out = Number(r.outstanding_amount) || 0;

    const prev = map.get(key) || { supplier: key, totalInvoiceValue: 0, outstandingBalance: 0 };
    prev.totalInvoiceValue += total;
    prev.outstandingBalance += out;
    map.set(key, prev);
  }

  const result = Array.from(map.values()).map((x) => ({
    ...x,
    totalPaid: x.totalInvoiceValue - x.outstandingBalance,
  }));

  // biggest suppliers first
  result.sort((a, b) => b.totalInvoiceValue - a.totalInvoiceValue);

  return result;
}

// --- Transporter dropdown (light list) ---
export async function getTransporters() {
  return getDoctypeList(TRANSPORTER_DOCTYPE, {
    fields: JSON.stringify(["name", "transporter_name"]),
    limit_page_length: 1000,
    order_by: "modified desc",
  });
}

// --- Set transporter on Purchase Order (Draft only in UI) ---
export async function setPurchaseOrderTransporter(poName, transporterName) {
  return updateDoc("Purchase Order", poName, {
    custom_transporter: transporterName || "",
  });
}

// ------------------------------
// Purchase Order Pipeline Summary (for Donut)
// ------------------------------
export async function getPurchaseOrderPipelineSummary({
  supplier,   // optional: if passed => only this supplier
  from_date,  // optional: YYYY-MM-DD
  to_date,    // optional: YYYY-MM-DD
} = {}) {
  const pageSize = 1000;
  let start = 0;

  // Totals (exclude drafts: docstatus=0)
  let totalOrdersCount = 0;
  let totalOrdersValue = 0;

  // Buckets
  const buckets = [
    {
      key: "pending_everything",
      name: "Pending Everything",
      statuses: ["To Receive and Bill"],
      count: 0,
      value: 0,
      clientText: "We are waiting for both the goods and the invoice.",
    },
    {
      key: "waiting_goods",
      name: "Waiting for Goods",
      statuses: ["To Receive"],
      count: 0,
      value: 0,
      clientText: "We have the bill (Invoice), but the truck hasn't arrived.",
    },
    {
      key: "waiting_invoice",
      name: "Waiting for Invoice",
      statuses: ["To Bill"],
      count: 0,
      value: 0,
      clientText: "The goods are here, but the supplier hasn't billed us.",
    },

    // ✅ NEW: Delivered bucket
    {
      key: "delivered",
      name: "Delivered",
      statuses: ["Delivered"],
      count: 0,
      value: 0,
      clientText: "Goods are delivered.",
    },

    // ✅ Finished bucket (Completed + Closed)
    {
      key: "finished",
      name: "Finished",
      statuses: ["Completed", "Closed"],
      count: 0,
      value: 0,
      clientText: "This order is done and off our plate.",
    },

    // ✅ NEW: Cancelled bucket
    {
      key: "cancelled",
      name: "Cancelled",
      statuses: ["Cancelled"],
      count: 0,
      value: 0,
      clientText: "This order has been cancelled.",
    },

    // ✅ Other = everything else (except Draft)
    {
      key: "other",
      name: "Other",
      statuses: [], // IMPORTANT: we keep empty; mapping will send unknown statuses here
      count: 0,
      value: 0,
      clientText: "Any other status (ex: On Hold, etc.)",
    },
  ];


  // Quick map: ERPNext status -> bucket
  const statusToBucketKey = new Map();
  buckets.forEach((b) => (b.statuses || []).forEach((s) => statusToBucketKey.set(s, b.key)));

  const filters = [
    // exclude drafts => only submitted
    ["Purchase Order", "docstatus", "=", 1],
  ];

  if (supplier) filters.push(["Purchase Order", "supplier", "=", supplier]);
  if (from_date) filters.push(["Purchase Order", "transaction_date", ">=", from_date]);
  if (to_date) filters.push(["Purchase Order", "transaction_date", "<=", to_date]);

  while (true) {
    const rows = await getDoctypeList("Purchase Order", {
      fields: JSON.stringify(["name", "supplier", "status", "grand_total", "transaction_date", "docstatus"]),
      filters: JSON.stringify(filters),
      order_by: "transaction_date desc, creation desc",
      limit_page_length: pageSize,
      limit_start: start,
    });

    const list = rows || [];
    if (!list.length) break;

    for (const po of list) {
      totalOrdersCount += 1;
      const amt = Number(po.grand_total) || 0;
      totalOrdersValue += amt;

      const st = String(po.status || "").trim();
      const key = statusToBucketKey.get(st) || "other";

      const bucket = buckets.find((b) => b.key === key);
      if (bucket) {
        bucket.count += 1;
        bucket.value += amt;
      }
    }

    if (list.length < pageSize) break;
    start += pageSize;
  }

  return {
    totalOrdersCount,
    totalOrdersValue,
    buckets, // we will use buckets to build donut data
  };
}

// ------------------------------
// Purchase Receipt Quality Summary (Accepted vs Rejected)
// ------------------------------
export async function getPurchaseReceiptQualitySummary({
  supplier,   // optional: filter by supplier
  from_date,  // optional: posting_date >=
  to_date,    // optional: posting_date <=
} = {}) {
  const pageSize = 1000;
  let start = 0;

  let receiptCount = 0;
  let totalAcceptedQty = 0;
  let totalRejectedQty = 0;

  // 1) Load submitted Purchase Receipts (parents)
  const filters = [
    ["Purchase Receipt", "docstatus", "=", 1], // submitted only (no Draft)
  ];
  if (supplier) filters.push(["Purchase Receipt", "supplier", "=", supplier]);
  if (from_date) filters.push(["Purchase Receipt", "posting_date", ">=", from_date]);
  if (to_date) filters.push(["Purchase Receipt", "posting_date", "<=", to_date]);

  let parents = [];

  while (true) {
    const rows = await getDoctypeList("Purchase Receipt", {
      fields: JSON.stringify(["name", "supplier", "posting_date", "docstatus"]),
      filters: JSON.stringify(filters),
      order_by: "posting_date desc, creation desc",
      limit_page_length: pageSize,
      limit_start: start,
    });

    const list = rows || [];
    if (!list.length) break;

    parents.push(...list);
    if (list.length < pageSize) break;
    start += pageSize;
  }

  receiptCount = parents.length;
  const parentNames = parents.map((p) => p.name).filter(Boolean);
  if (!parentNames.length) {
    return {
      receiptCount: 0,
      totalAcceptedQty: 0,
      totalRejectedQty: 0,
      totalQty: 0,
    };
  }

  // 2) Load child rows in chunks (Purchase Receipt Item)
  const chunk = (arr, size = 100) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  for (const part of chunk(parentNames, 100)) {
    const items = await getDoctypeList("Purchase Receipt Item", {
      parent: "Purchase Receipt",
      fields: JSON.stringify(["parent", "qty", "rejected_qty"]),
      filters: JSON.stringify([["Purchase Receipt Item", "parent", "in", part]]),
      limit_page_length: 10000,
    });

    for (const it of items || []) {
      const accepted = Number(it.qty) || 0;           // ✅ usually "Accepted"
      const rejected = Number(it.rejected_qty) || 0;  // ✅ standard field
      totalAcceptedQty += accepted;
      totalRejectedQty += rejected;
    }
  }

  return {
    receiptCount,
    totalAcceptedQty,
    totalRejectedQty,
    totalQty: totalAcceptedQty + totalRejectedQty,
  };
}

// ------------------------------
// Suppliers by Spending (Purchase Orders grand_total sum)
// ------------------------------
export async function getSuppliersByPurchaseOrderSpending({
  from_date,            // optional: YYYY-MM-DD
  to_date,              // optional: YYYY-MM-DD
  topN = 10,            // how many suppliers to return
  includeOthers = true, // group remaining as "Others"
} = {}) {
  const pageSize = 1000;
  let start = 0;

  // Submitted only (excludes Draft). Cancelled is docstatus=2 so excluded.
  const filters = [["Purchase Order", "docstatus", "=", 1]];
  if (from_date) filters.push(["Purchase Order", "transaction_date", ">=", from_date]);
  if (to_date) filters.push(["Purchase Order", "transaction_date", "<=", to_date]);

  // We will use supplier_name for display, fallback to supplier id
  const map = new Map(); // label -> { supplier, totalValue, orderCount }

  while (true) {
    const rows = await getDoctypeList("Purchase Order", {
      fields: JSON.stringify(["supplier", "supplier_name", "grand_total", "transaction_date"]),
      filters: JSON.stringify(filters),
      order_by: "transaction_date desc, creation desc",
      limit_page_length: pageSize,
      limit_start: start,
    });

    const list = rows || [];          // ✅ FIX: define list
    if (!list.length) break;

    for (const po of list) {
      const label = String(po.supplier_name || po.supplier || "Unknown").trim(); // ✅ show supplier_name
      const amt = Number(po.grand_total) || 0;

      const prev = map.get(label) || { supplier: label, totalValue: 0, orderCount: 0 };
      prev.totalValue += amt;
      prev.orderCount += 1;
      map.set(label, prev);
    }

    if (list.length < pageSize) break;
    start += pageSize;
  }

  const sorted = Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);

  const n = Math.max(1, Number(topN) || 10);
  const top = sorted.slice(0, n);
  const rest = sorted.slice(n);

  if (includeOthers && rest.length) {
    const others = rest.reduce(
      (acc, x) => {
        acc.totalValue += Number(x.totalValue) || 0;
        acc.orderCount += Number(x.orderCount) || 0;
        return acc;
      },
      { supplier: "Others", totalValue: 0, orderCount: 0 }
    );
    top.push(others);
  }

  const overallTotal = sorted.reduce((sum, x) => sum + (Number(x.totalValue) || 0), 0);

  return {
    overallTotal,
    suppliers: top, // [{ supplier: "ABC Traders", totalValue, orderCount }]
  };
}

//// ------------------------------
//// Purchase Register List (PO-first, MF Delivered date priority)
//// ------------------------------
//function prDateOnly(input) {
//  if (!input) return "";
//  const s = String(input).trim();
//  if (!s) return "";
//  return s.slice(0, 10); // YYYY-MM-DD
//}

//function prChunk(arr, size = 100) {
//  const out = [];
//  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
//  return out;
//}

//export async function getPurchaseRegisterList({
//  supplier,

//  po_from_date,
//  po_to_date,

//  goods_from_date,
//  goods_to_date,

//  mf_status,
//  po_status,

//  payment_status,
//  transporter_q,

//  item_q,
//  invoice_q,

//  min_value,
//  max_value,

//  includeUninvoiced = true,
//  includeUnreceived = true,

//  limit = 500,
//} = {}) {
//  const pageSize = 1000;

//  // 1) Load Purchase Orders
//  const poFilters = [["Purchase Order", "docstatus", "=", 1]];
//  if (supplier) poFilters.push(["Purchase Order", "supplier", "=", supplier]);
//  if (po_from_date) poFilters.push(["Purchase Order", "transaction_date", ">=", po_from_date]);
//  if (po_to_date) poFilters.push(["Purchase Order", "transaction_date", "<=", po_to_date]);
//  if (mf_status) poFilters.push(["Purchase Order", "custom_mf_status", "=", mf_status]);
//  if (po_status) poFilters.push(["Purchase Order", "status", "=", po_status]);

//  let start = 0;
//  const poParents = [];

//  while (true) {
//    const rows = await getDoctypeList("Purchase Order", {
//      fields: JSON.stringify([
//        "name",
//        "supplier",
//        "supplier_name",
//        "transaction_date",
//        "status",

//        // ✅ MF fields
//        "custom_mf_status",
//        "custom_mf_status_updated_on",

//        // transporter (use the one you actually have)
//        "custom_transporter",
//      ]),
//      filters: JSON.stringify(poFilters),
//      order_by: "transaction_date desc, creation desc",
//      limit_page_length: pageSize,
//      limit_start: start,
//    });

//    const list = rows || [];
//    if (!list.length) break;

//    poParents.push(...list);
//    if (list.length < pageSize) break;
//    start += pageSize;

//    if (poParents.length > 5000) break;
//  }

//  const poByName = new Map();
//  (poParents || []).forEach((p) => poByName.set(p.name, p));

//  const poNames = Array.from(poByName.keys());
//  if (!poNames.length) return { totalRows: 0, totalValue: 0, rows: [] };

//  // 2) Load Purchase Order Items (base rows)
//  const poItems = [];
//  for (const part of prChunk(poNames, 100)) {
//    const rows = await getDoctypeList("Purchase Order Item", {
//      parent: "Purchase Order",
//      fields: JSON.stringify([
//        "name",
//        "parent",
//        "item_code",
//        "item_name",
//        "qty",
//        "rate",
//        "amount",
//        "base_rate",
//        "base_amount",
//      ]),
//      filters: JSON.stringify([["Purchase Order Item", "parent", "in", part]]),
//      limit_page_length: 10000,
//    });
//    poItems.push(...(rows || []));
//  }
//  if (!poItems.length) return { totalRows: 0, totalValue: 0, rows: [] };

//  // 3) PR posting_date mapping (try purchase_order_item, fallback to po_detail)
//  const prItems = [];
//  for (const part of prChunk(poNames, 100)) {
//    try {
//      const rows = await getDoctypeList("Purchase Receipt Item", {
//        parent: "Purchase Receipt",
//        fields: JSON.stringify(["parent", "purchase_order", "purchase_order_item"]),
//        filters: JSON.stringify([["Purchase Receipt Item", "purchase_order", "in", part]]),
//        limit_page_length: 10000,
//      });
//      prItems.push(...(rows || []));
//    } catch (e) {
//      // fallback fieldname in many ERPNext versions
//      const rows2 = await getDoctypeList("Purchase Receipt Item", {
//        parent: "Purchase Receipt",
//        fields: JSON.stringify(["parent", "purchase_order", "po_detail"]),
//        filters: JSON.stringify([["Purchase Receipt Item", "purchase_order", "in", part]]),
//        limit_page_length: 10000,
//      });

//      // normalize to purchase_order_item
//      (rows2 || []).forEach((r) => {
//        prItems.push({
//          parent: r.parent,
//          purchase_order: r.purchase_order,
//          purchase_order_item: r.po_detail,
//        });
//      });
//    }
//  }

//  const prNames = Array.from(new Set(prItems.map((x) => x.parent).filter(Boolean)));
//  const prPostingDateByName = new Map();

//  for (const part of prChunk(prNames, 100)) {
//    const prs = await getDoctypeList("Purchase Receipt", {
//      fields: JSON.stringify(["name", "posting_date", "docstatus"]),
//      filters: JSON.stringify([
//        ["Purchase Receipt", "name", "in", part],
//        ["Purchase Receipt", "docstatus", "=", 1],
//      ]),
//      limit_page_length: 1000,
//    });

//    (prs || []).forEach((pr) => prPostingDateByName.set(pr.name, pr.posting_date || ""));
//  }

//  const prDateByPoItem = new Map();
//  const prDateByPo = new Map();

//  for (const it of prItems) {
//    const prDate = prPostingDateByName.get(it.parent) || "";
//    if (!prDate) continue;

//    const poi = it.purchase_order_item;
//    const po = it.purchase_order;

//    if (poi) {
//      const prev = prDateByPoItem.get(poi);
//      if (!prev || prDate < prev) prDateByPoItem.set(poi, prDate);
//    }
//    if (po) {
//      const prev2 = prDateByPo.get(po);
//      if (!prev2 || prDate < prev2) prDateByPo.set(po, prDate);
//    }
//  }

//  // 4) ✅ Purchase Invoice mapping (NO purchase_order_item in list query)
//  // 4a) List PI items using only permitted fields
//  const piItemLinks = [];
//  for (const part of prChunk(poNames, 100)) {
//    const rows = await getDoctypeList("Purchase Invoice Item", {
//      parent: "Purchase Invoice",
//      fields: JSON.stringify(["parent", "purchase_order"]), // ✅ safe
//      filters: JSON.stringify([["Purchase Invoice Item", "purchase_order", "in", part]]),
//      limit_page_length: 10000,
//    });
//    piItemLinks.push(...(rows || []));
//  }

//  const piNames = Array.from(new Set(piItemLinks.map((x) => x.parent).filter(Boolean)));

//  // 4b) Fetch PI meta for display + sorting
//  const piMetaByName = new Map();
//  for (const part of prChunk(piNames, 100)) {
//    const pis = await getDoctypeList("Purchase Invoice", {
//      fields: JSON.stringify([
//        "name",
//        "bill_no",
//        "status",
//        "grand_total",
//        "outstanding_amount",
//        "posting_date",
//        "docstatus",
//      ]),
//      filters: JSON.stringify([
//        ["Purchase Invoice", "name", "in", part],
//        ["Purchase Invoice", "docstatus", "in", [0, 1]],
//      ]),
//      limit_page_length: 1000,
//    });

//    (pis || []).forEach((pi) => piMetaByName.set(pi.name, pi));
//  }

//  // 4c) Fallback mapping by PO (if item-level link missing)
//  const piByPo = new Map(); // PO -> PI (latest posting_date)
//  for (const link of piItemLinks) {
//    const po = link.purchase_order;
//    const piName = link.parent;
//    if (!po || !piName) continue;

//    const pi = piMetaByName.get(piName);
//    if (!pi) continue;

//    const curr = piByPo.get(po);
//    if (!curr) {
//      piByPo.set(po, piName);
//      continue;
//    }

//    const currMeta = piMetaByName.get(curr);
//    const currDate = currMeta?.posting_date || "";
//    const newDate = pi.posting_date || "";
//    if (newDate && (!currDate || newDate > currDate)) piByPo.set(po, piName);
//  }

//  // 4d) Item-level mapping by reading full PI docs (robust across versions)
//  const piByPoItem = new Map(); // PO Item -> PI Name (latest posting_date)

//  // use your existing concurrency helper
//  const piDocs = await mapLimit(piNames, 6, async (name) => {
//    try {
//      return await getDoc("Purchase Invoice", name);
//    } catch (e) {
//      return null;
//    }
//  });

//  for (const doc of piDocs || []) {
//    if (!doc?.name) continue;
//    const meta = piMetaByName.get(doc.name);
//    const piDate = meta?.posting_date || doc.posting_date || "";

//    for (const row of doc.items || []) {
//      const poi = row.purchase_order_item || row.po_detail || ""; // ✅ supports both
//      if (!poi) continue;

//      const curr = piByPoItem.get(poi);
//      if (!curr) {
//        piByPoItem.set(poi, doc.name);
//        continue;
//      }

//      const currMeta = piMetaByName.get(curr);
//      const currDate = currMeta?.posting_date || "";
//      if (piDate && (!currDate || piDate > currDate)) piByPoItem.set(poi, doc.name);
//    }
//  }

//  // 5) Build rows + filters
//  const qItem = String(item_q || "").trim().toLowerCase();
//  const qInv = String(invoice_q || "").trim().toLowerCase();
//  const qTrans = String(transporter_q || "").trim().toLowerCase();

//  const minVal =
//    min_value !== undefined && min_value !== null && min_value !== "" ? Number(min_value) : null;
//  const maxVal =
//    max_value !== undefined && max_value !== null && max_value !== "" ? Number(max_value) : null;

//  const rowsOut = [];

//  for (const it of poItems) {
//    const po = poByName.get(it.parent);
//    if (!po) continue;

//    const mf = String(po.custom_mf_status || "").trim();

//    // ✅ Priority: MF Delivered date first, else PR posting_date
//    const deliveredDate =
//      mf.toLowerCase() === "delivered" ? prDateOnly(po.custom_mf_status_updated_on) : "";

//    const prDate = prDateByPoItem.get(it.name) || prDateByPo.get(it.parent) || "";
//    const goodsReceivedDate = deliveredDate || prDate || "";

//    const transporter = String(po.custom_transporter || "").trim();

//    // ✅ PI mapping: item-level first, else PO-level fallback
//    const piName = piByPoItem.get(it.name) || piByPo.get(it.parent) || "";
//    const pi = piName ? piMetaByName.get(piName) : null;

//    const invoiceNo = String(pi?.bill_no || "").trim();
//    const payStatus = String(pi?.status || (piName ? "Unknown" : "Not Invoiced")).trim();

//    const grandTotal = Number(pi?.grand_total) || 0;
//    const outstanding = Number(pi?.outstanding_amount) || 0;
//    const amountPaid = pi ? Math.max(0, grandTotal - outstanding) : 0;

//    const qty = Number(it.qty) || 0;
//    const value =
//      Number(it.base_amount) ||
//      Number(it.amount) ||
//      qty * (Number(it.base_rate) || Number(it.rate) || 0);

//    // filters
//    if (!includeUnreceived && !goodsReceivedDate) continue;
//    if (!includeUninvoiced && !piName) continue;

//    if ((goods_from_date || goods_to_date) && !goodsReceivedDate) continue;
//    if (goods_from_date && goodsReceivedDate < goods_from_date) continue;
//    if (goods_to_date && goodsReceivedDate > goods_to_date) continue;

//    if (payment_status) {
//      if (!pi) continue;
//      if (String(pi.status || "").trim().toLowerCase() !== String(payment_status).trim().toLowerCase())
//        continue;
//    }

//    if (qTrans && !transporter.toLowerCase().includes(qTrans)) continue;
//    if (qInv && !invoiceNo.toLowerCase().includes(qInv)) continue;

//    if (qItem) {
//      const blob = `${it.item_code || ""} ${it.item_name || ""}`.toLowerCase();
//      if (!blob.includes(qItem)) continue;
//    }

//    if (minVal != null && value < minVal) continue;
//    if (maxVal != null && value > maxVal) continue;

//    rowsOut.push({
//      goods_received_date: goodsReceivedDate,
//      goods_received_source: deliveredDate ? "MF Delivered" : prDate ? "Purchase Receipt" : "",
//      vendor_name: po.supplier_name || po.supplier || "",
//      po_name: po.name,
//      po_date: po.transaction_date || "",
//      invoice_name: piName,
//      invoice_no: invoiceNo,
//      item_code: it.item_code || "",
//      item_name: it.item_name || "",
//      quantity: qty,
//      value,
//      payment_status: payStatus,
//      amount_paid: amountPaid,
//      transporter_name: transporter,
//      po_status: po.status || "",
//      mf_status: mf,
//    });

//    if (rowsOut.length >= Number(limit) && Number(limit) > 0) break;
//  }

//  const totalValue = rowsOut.reduce((sum, r) => sum + (Number(r.value) || 0), 0);

//  return {
//    totalRows: rowsOut.length,
//    totalValue,
//    rows: rowsOut,
//  };
//}

// src/erpBackendApi.js

// ... (keep all your existing imports and helper functions above this) ...

// ------------------------------
// Purchase Register List (Updated with new columns & Lookups)
// ------------------------------
function prDateOnly(input) {
  if (!input) return "";
  const s = String(input).trim();
  if (!s) return "";
  return s.slice(0, 10); // YYYY-MM-DD
}

function prChunk(arr, size = 100) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function getPurchaseRegisterList({
  supplier,
  po_from_date,
  po_to_date,
  goods_from_date,
  goods_to_date,
  mf_status,
  po_status,
  payment_status,
  transporter_q,
  item_q,
  invoice_q,
  min_value,
  max_value,
  includeUninvoiced = true,
  includeUnreceived = true,
  limit = 500,
} = {}) {
  const pageSize = 1000;

  // 1) Load Purchase Orders
  const poFilters = [["Purchase Order", "docstatus", "=", 1]];
  if (supplier) poFilters.push(["Purchase Order", "supplier", "=", supplier]);
  if (po_from_date) poFilters.push(["Purchase Order", "transaction_date", ">=", po_from_date]);
  if (po_to_date) poFilters.push(["Purchase Order", "transaction_date", "<=", po_to_date]);
  if (mf_status) poFilters.push(["Purchase Order", "custom_mf_status", "=", mf_status]);
  if (po_status) poFilters.push(["Purchase Order", "status", "=", po_status]);

  let start = 0;
  const poParents = [];

  while (true) {
    const rows = await getDoctypeList("Purchase Order", {
      fields: JSON.stringify([
        "name",
        "supplier",
        "supplier_name",
        "transaction_date",
        "status", // ERP Standard Status

        // ✅ MF fields
        "custom_mf_status",
        "custom_mf_status_updated_on", // ✅ New Field

        // ✅ Transporter ID
        "custom_transporter",
      ]),
      filters: JSON.stringify(poFilters),
      order_by: "transaction_date desc, creation desc",
      limit_page_length: pageSize,
      limit_start: start,
    });

    const list = rows || [];
    if (!list.length) break;

    poParents.push(...list);
    if (list.length < pageSize) break;
    start += pageSize;

    if (poParents.length > 5000) break;
  }

  const poByName = new Map();
  (poParents || []).forEach((p) => poByName.set(p.name, p));

  const poNames = Array.from(poByName.keys());
  if (!poNames.length) return { totalRows: 0, totalValue: 0, rows: [] };

  // --- ✅ 1.5 Fetch Transporter Names ---
  // Collect all unique Transporter IDs
  const transporterIds = [...new Set(poParents.map(p => p.custom_transporter).filter(Boolean))];
  const transporterMap = new Map(); // ID -> Name

  if (transporterIds.length > 0) {
    const tBatches = prChunk(transporterIds, 100);
    for (const batch of tBatches) {
      const tRows = await getDoctypeList("Transporter", { // Change "Transporter" if your doctype name differs
        fields: JSON.stringify(["name", "transporter_name"]),
        filters: JSON.stringify([["name", "in", batch]]),
        limit_page_length: 1000
      });
      (tRows || []).forEach(t => {
        transporterMap.set(t.name, t.transporter_name || t.name);
      });
    }
  }

  // 2) Load Purchase Order Items (base rows)
  const poItems = [];
  for (const part of prChunk(poNames, 100)) {
    const rows = await getDoctypeList("Purchase Order Item", {
      parent: "Purchase Order",
      fields: JSON.stringify([
        "name",
        "parent",
        "item_code",
        "item_name",
        "qty",
        "rate",
        "amount",
        "base_rate",
        "base_amount",
      ]),
      filters: JSON.stringify([["Purchase Order Item", "parent", "in", part]]),
      limit_page_length: 10000,
    });
    poItems.push(...(rows || []));
  }
  if (!poItems.length) return { totalRows: 0, totalValue: 0, rows: [] };

  // 3) PR Link Logic
  const prItems = [];
  for (const part of prChunk(poNames, 100)) {
    try {
      const rows = await getDoctypeList("Purchase Receipt Item", {
        parent: "Purchase Receipt",
        fields: JSON.stringify(["parent", "purchase_order", "purchase_order_item"]),
        filters: JSON.stringify([["Purchase Receipt Item", "purchase_order", "in", part]]),
        limit_page_length: 10000,
      });
      prItems.push(...(rows || []));
    } catch (e) {
      // Fallback for older ERPNext versions
      const rows2 = await getDoctypeList("Purchase Receipt Item", {
        parent: "Purchase Receipt",
        fields: JSON.stringify(["parent", "purchase_order", "po_detail"]),
        filters: JSON.stringify([["Purchase Receipt Item", "purchase_order", "in", part]]),
        limit_page_length: 10000,
      });
      (rows2 || []).forEach((r) => {
        prItems.push({
          parent: r.parent,
          purchase_order: r.purchase_order,
          purchase_order_item: r.po_detail,
        });
      });
    }
  }

  const prNames = Array.from(new Set(prItems.map((x) => x.parent).filter(Boolean)));
  const prMetaByName = new Map(); // Store full PR meta (date + name)

  for (const part of prChunk(prNames, 100)) {
    const prs = await getDoctypeList("Purchase Receipt", {
      fields: JSON.stringify(["name", "posting_date", "docstatus"]),
      filters: JSON.stringify([
        ["Purchase Receipt", "name", "in", part],
        ["Purchase Receipt", "docstatus", "=", 1],
      ]),
      limit_page_length: 1000,
    });

    (prs || []).forEach((pr) => prMetaByName.set(pr.name, pr));
  }

  // Maps to link PO Item -> PR Details
  const prDetailsByPoItem = new Map(); // POItem -> { date, name }
  const prDetailsByPo = new Map();     // PO -> { date, name } (fallback)

  for (const it of prItems) {
    const prMeta = prMetaByName.get(it.parent);
    if (!prMeta) continue;

    const details = { date: prMeta.posting_date || "", name: prMeta.name };
    
    const poi = it.purchase_order_item;
    const po = it.purchase_order;

    if (poi) {
      const prev = prDetailsByPoItem.get(poi);
      // If multiple PRs, take the latest one
      if (!prev || details.date > prev.date) prDetailsByPoItem.set(poi, details);
    }
    if (po) {
      const prev2 = prDetailsByPo.get(po);
      if (!prev2 || details.date > prev2.date) prDetailsByPo.set(po, details);
    }
  }

  // 4) Purchase Invoice Mapping
  const piItemLinks = [];
  for (const part of prChunk(poNames, 100)) {
    const rows = await getDoctypeList("Purchase Invoice Item", {
      parent: "Purchase Invoice",
      fields: JSON.stringify(["parent", "purchase_order"]),
      filters: JSON.stringify([["Purchase Invoice Item", "purchase_order", "in", part]]),
      limit_page_length: 10000,
    });
    piItemLinks.push(...(rows || []));
  }

  const piNames = Array.from(new Set(piItemLinks.map((x) => x.parent).filter(Boolean)));

  // Fetch PI Meta
  const piMetaByName = new Map();
  for (const part of prChunk(piNames, 100)) {
    const pis = await getDoctypeList("Purchase Invoice", {
      fields: JSON.stringify([
        "name",
        "bill_no", // Standard Supplier Invoice No
        "custom_supplier_invoice", // Custom Supplier Invoice No
        "status",
        "grand_total",
        "outstanding_amount",
        "posting_date",
        "docstatus",
      ]),
      filters: JSON.stringify([
        ["Purchase Invoice", "name", "in", part],
        ["Purchase Invoice", "docstatus", "in", [0, 1]],
      ]),
      limit_page_length: 1000,
    });

    (pis || []).forEach((pi) => piMetaByName.set(pi.name, pi));
  }

  // PI Mapping Logic (Item Level -> PO Level Fallback)
  const piByPoItem = new Map();
  const piByPo = new Map();

  // Load PI Docs for Item-level precision
  const piDocs = await mapLimit(piNames, 6, async (name) => {
    try {
      return await getDoc("Purchase Invoice", name);
    } catch (e) { return null; }
  });

  for (const doc of piDocs || []) {
    if (!doc?.name) continue;
    const meta = piMetaByName.get(doc.name);
    if (!meta) continue;

    const piDate = meta.posting_date || doc.posting_date || "";

    // 4c. Map by PO (fallback)
    const poLink = doc.items?.[0]?.purchase_order; // grab from first item
    if(poLink) {
        const curr = piByPo.get(poLink);
        const currMeta = curr ? piMetaByName.get(curr) : null;
        if (!curr || (piDate && piDate > (currMeta?.posting_date || ""))) {
            piByPo.set(poLink, doc.name);
        }
    }

    // 4d. Map by PO Item
    for (const row of doc.items || []) {
      const poi = row.purchase_order_item || row.po_detail || "";
      if (!poi) continue;

      const curr = piByPoItem.get(poi);
      const currMeta = curr ? piMetaByName.get(curr) : null;
      if (!curr || (piDate && piDate > (currMeta?.posting_date || ""))) {
        piByPoItem.set(poi, doc.name);
      }
    }
  }

  // 5) Build Final Rows
  const qItem = String(item_q || "").trim().toLowerCase();
  const qInv = String(invoice_q || "").trim().toLowerCase();
  const qTrans = String(transporter_q || "").trim().toLowerCase();

  const minVal = min_value !== undefined && min_value !== "" ? Number(min_value) : null;
  const maxVal = max_value !== undefined && max_value !== "" ? Number(max_value) : null;

  const rowsOut = [];

  for (const it of poItems) {
    const po = poByName.get(it.parent);
    if (!po) continue;

    const mf = String(po.custom_mf_status || "").trim();
    // ✅ Updated On Date
    const mfDate = po.custom_mf_status_updated_on ? prDateOnly(po.custom_mf_status_updated_on) : "";

    // ✅ Goods Receipt Data
    // Delivered date priority: MF Updated On (if Delivered) -> else PR Posting Date
    const deliveredDate = mf.toLowerCase() === "delivered" ? mfDate : "";
    
    const prDetails = prDetailsByPoItem.get(it.name) || prDetailsByPo.get(it.parent);
    const prDate = prDetails?.date || "";
    const prName = prDetails?.name || ""; // ✅ Goods Receipt Number

    const goodsReceivedDate = deliveredDate || prDate || "";

    // ✅ Transporter Name Lookup
    const tId = po.custom_transporter;
    const transporterName = transporterMap.get(tId) || tId || "";

    // ✅ Invoice Logic
    const piName = piByPoItem.get(it.name) || piByPo.get(it.parent) || "";
    const pi = piName ? piMetaByName.get(piName) : null;

    const erpInvoiceNo = pi?.name || ""; // Internal ID
    const supplierInvoiceNo = pi?.custom_supplier_invoice || pi?.bill_no || ""; // External Bill No
    
    // Status & Amounts
    const payStatus = String(pi?.status || (piName ? "Unknown" : "Not Invoiced")).trim();
    const grandTotal = Number(pi?.grand_total) || 0;
    const outstanding = Number(pi?.outstanding_amount) || 0;
    const amountPaid = pi ? Math.max(0, grandTotal - outstanding) : 0;

    const qty = Number(it.qty) || 0;
    const value = Number(it.base_amount) || Number(it.amount) || qty * (Number(it.base_rate) || Number(it.rate) || 0);

    // --- Filters ---
    if (!includeUnreceived && !goodsReceivedDate) continue;
    if (!includeUninvoiced && !piName) continue;

    if (goods_from_date && goodsReceivedDate < goods_from_date) continue;
    if (goods_to_date && goodsReceivedDate > goods_to_date) continue;

    if (payment_status) {
      if (!pi) continue;
      if (String(pi.status || "").trim().toLowerCase() !== String(payment_status).trim().toLowerCase()) continue;
    }

    if (qTrans && !transporterName.toLowerCase().includes(qTrans)) continue;
    
    // Filter by ANY invoice number (internal or external)
    if (qInv) {
        const combinedInv = (erpInvoiceNo + " " + supplierInvoiceNo).toLowerCase();
        if (!combinedInv.includes(qInv)) continue;
    }

    if (qItem) {
      const blob = `${it.item_code || ""} ${it.item_name || ""}`.toLowerCase();
      if (!blob.includes(qItem)) continue;
    }

    if (minVal != null && value < minVal) continue;
    if (maxVal != null && value > maxVal) continue;

    rowsOut.push({
      goods_received_date: goodsReceivedDate,
      goods_received_source: deliveredDate ? "MF Delivered" : prDate ? "Purchase Receipt" : "",
      goods_receipt_no: prName, // ✅ New Column Data
      vendor_name: po.supplier_name || po.supplier || "",
      po_name: po.name,
      po_date: po.transaction_date || "",
      po_status: po.status || "", // ✅ New Column Data
      
      erp_invoice_no: erpInvoiceNo, // ✅ Renamed
      supplier_invoice_no: supplierInvoiceNo, // ✅ New Column Data
      
      item_code: it.item_code || "",
      item_name: it.item_name || "",
      quantity: qty,
      value,
      payment_status: payStatus,
      amount_paid: amountPaid,
      transporter_name: transporterName, // ✅ Human Name
      mf_status: mf,
      mf_status_date: mfDate, // ✅ New Column Data
    });

    if (rowsOut.length >= Number(limit) && Number(limit) > 0) break;
  }

  const totalValue = rowsOut.reduce((sum, r) => sum + (Number(r.value) || 0), 0);

  return {
    totalRows: rowsOut.length,
    totalValue,
    rows: rowsOut,
  };
}
// ----------------------------------------------------------------
// ✅ NEW: Supplier Detail Page Helpers
// ----------------------------------------------------------------

// src/erpBackendApi.js

export async function getItemsBySupplier(supplierName) {
  // Step A: Find links in the "Item Supplier" child table
  const links = await getDoctypeList("Item Supplier", {
    parent: "Item", // ✅ REQUIRED: Tells ERPNext to check "Item" permissions
    fields: JSON.stringify(["parent", "supplier_part_no"]),
    filters: JSON.stringify([["supplier", "=", supplierName]]),
    limit_page_length: 500
  });

  if (!links || links.length === 0) return [];

  // Step B: Extract unique Item Codes (the 'parent' field)
  const itemCodes = [...new Set(links.map(l => l.parent))];

  // Step C: Fetch details for these items
  const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));

  let allItems = [];
  for (const batch of chunk(itemCodes, 50)) {
    const items = await getDoctypeList("Item", {
      fields: JSON.stringify(["name", "item_name", "stock_uom", "image"]),
      filters: JSON.stringify([["name", "in", batch]]),
      limit_page_length: 50
    });
    allItems = [...allItems, ...items];
  }

  return allItems;
}

// 2. Get Recent Purchase Orders for this supplier (Enriched with Item Names)
export async function getRecentPOsBySupplier(supplierName) {
  // A. Fetch the main POs (Limit 10)
  const pos = await getDoctypeList("Purchase Order", {
    fields: JSON.stringify([
      "name",
      "transaction_date",
      "grand_total",
      "status",
      "custom_mf_status"
    ]),
    filters: JSON.stringify([["supplier", "=", supplierName]]),
    order_by: "transaction_date desc",
    limit_page_length: 5
  });

  if (!pos || pos.length === 0) return [];

  // B. Extract PO Names to fetch their items
  const poNames = pos.map(p => p.name);

  // C. Fetch "Purchase Order Item" rows for these POs
  const items = await getDoctypeList("Purchase Order Item", {
    parent: "Purchase Order", // ✅ ADD THIS LINE (Fixes Permission Error)
    fields: JSON.stringify(["parent", "item_name", "item_code"]),
    filters: JSON.stringify([["parent", "in", poNames]]),
    limit_page_length: 500
  });

  // D. Group Items by PO Name
  const itemsMap = {};
  items.forEach(item => {
    if (!itemsMap[item.parent]) itemsMap[item.parent] = [];
    // Prefer item_name, fallback to item_code
    itemsMap[item.parent].push(item.item_name || item.item_code);
  });

  // E. Attach the item display string to the PO objects
  return pos.map(po => {
    const poItems = itemsMap[po.name] || [];

    // Format: "Item A, Item B" or "Item A, Item B +2 more"
    let itemDisplay = "—";
    if (poItems.length > 0) {
      const distinct = [...new Set(poItems)]; // Remove duplicates
      if (distinct.length <= 2) {
        itemDisplay = distinct.join(", ");
      } else {
        itemDisplay = `${distinct.slice(0, 2).join(", ")} +${distinct.length - 2} more`;
      }
    }

    return {
      ...po,
      _items_display: itemDisplay // ✅ New field we will use in UI
    };
  });
}