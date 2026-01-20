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
