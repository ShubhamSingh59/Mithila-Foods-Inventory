// src/erpBackendApi.js
import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";
const STOCK_AFFECTING_DOCTYPES = new Set([
  "Stock Reconciliation",
  "Stock Entry",
  "Purchase Receipt",
  "Delivery Note",
  "Sales Invoice",
  "Purchase Invoice",
]);


{/* Below function gives the List of the all docs present in erpNext*/ }
export async function getDoctypeList(doctype, params = {}) {
  const res = await axios.get(`${BACKEND_URL}/api/doctype/${doctype}`, {
    params,
  });
  return res.data.data;
}

export async function getDoc(doctype, name) {
  const res = await axios.get(
    `${BACKEND_URL}/api/doc/${encodeURIComponent(doctype)}/${encodeURIComponent(
      name
    )}`
  );
  return res.data.data;
}

// Generic POST create
export async function createDoc(doctype, payload) {
  const res = await axios.post(`${BACKEND_URL}/api/doctype/${doctype}`, payload);
  return res.data;
}

export async function submitDoc(doctype, name) {
  const res = await axios.post(`${BACKEND_URL}/api/submit`, { doctype, name });

  // ✅ auto refresh everywhere after stock-affecting submit
  if (STOCK_AFFECTING_DOCTYPES.has(doctype)) {
    emitStockChanged();
  }

  // ✅ MF Status auto-update for Purchase Order
  if (doctype === "Purchase Order") {
    try {
      await setPurchaseOrderMfStatus(name, "PO Confirmed");
    } catch (e) {
      console.error("MF status update failed:", e);
      // do NOT break your existing flow
    }
  }


  return res.data;
}

export async function getSuppliers() {
  return getDoctypeList("Supplier", {
    fields: JSON.stringify([
      "name",
      "supplier_name",
      "email_id",
    ]),
    filters: JSON.stringify([["Supplier", "disabled", "=", 0]]),
    limit_page_length: 500,
  });
}


//export async function getItemsForPO() {
//  return getDoctypeList("Item", {
//    fields: JSON.stringify([
//      "name",
//      "item_name",
//      "item_group",
//      "stock_uom",
//    ]),
//    filters: JSON.stringify([
//      [
//        "Item",
//        "item_group",
//        "in",
//        ["Raw Material", "Pouch", "Sticker"],  // 👈 only these groups
//      ],
//    ]),
//    limit_page_length: 1000,
//  });
//}

export async function getItemsForPO() {
  return getDoctypeList("Item", {
    fields: JSON.stringify([
      "name",
      "item_name",
      "item_group",
      "stock_uom",
      // ❌ remove "default_supplier" – it caused "Field not permitted in query"
    ]),
    filters: JSON.stringify([
      [
        "Item",
        "item_group",
        "in",
        ["Raw Material", "Pouch", "Sticker"],
      ],
    ]),
    limit_page_length: 1000,
  });
}



//export async function createPurchaseOrder({
//  supplier,
//  item_code,
//  qty,
//  rate,
//  notes,
//  warehouse,
//}) {
//  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

//  const payload = {
//    doctype: "Purchase Order",
//    supplier,
//    transaction_date: today,
//    schedule_date: today,
//    notes: notes || "",
//    items: [
//      {
//        item_code,
//        qty: Number(qty),
//        rate: rate != null ? Number(rate) : undefined,
//        schedule_date: today,
//        warehouse: warehouse || undefined,
//      },
//    ],
//  };

//  return createDoc("Purchase Order", payload);
//}

// src/erpBackendApi.js

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
    transaction_date: txDate,    // 🆕 use selected PO date
    schedule_date: schedDate,    // 🆕 header schedule date
    notes: notes || "",
    [MF_PO_FIELDS.status]: "PO Draft",
    [MF_PO_FIELDS.updatedOn]: nowKolkataErpDatetime(),
    items: [
      {
        item_code,
        qty: Number(qty),
        rate: rate != null ? Number(rate) : undefined,
        schedule_date: schedDate, // 🆕 child schedule date
        warehouse: warehouse || undefined,
      },
    ],
  };

  return createDoc("Purchase Order", payload);
}


// get Purchase Order with its child items (avoids direct Purchase Order Item calls)
export async function getPurchaseOrderWithItems(name) {
  return getDoc("Purchase Order", name); // { name, supplier, company, items: [...] }
}


// --- BOM helpers ---

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

// child table: BOM Item (items under one BOM)
export async function getBomItems(bomName) {
  return getDoctypeList("BOM Item", {
    fields: JSON.stringify(["item_code", "item_name", "uom", "qty"]),
    filters: JSON.stringify([["BOM Item", "parent", "=", bomName]]),
    limit_page_length: 1000,
  });
}

// price lists dropdown
export async function getPriceLists() {
  return getDoctypeList("Price List", {
    fields: JSON.stringify(["name", "price_list_name", "buying", "selling"]),
    filters: JSON.stringify([["Price List", "enabled", "=", 1]]),
    limit_page_length: 100,
  });
}

// valuation rate (simple: from Item)
export async function getItemValuationRate(itemCode) {
  const rows = await getDoctypeList("Item", {
    fields: JSON.stringify(["name", "stock_uom", "valuation_rate", "last_purchase_rate"]),
    filters: JSON.stringify([["Item", "name", "=", itemCode]]),
    limit_page_length: 1,
  });
  return rows[0] || null;
}

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

// Items for BOM (finished + raw), with UOM & basic rates
export async function getItemsForBOM() {
  return getDoctypeList("Item", {
    fields: JSON.stringify([
      "name",
      "item_name",
      "stock_uom",
      "valuation_rate",
      "last_purchase_rate",
    ]),
    limit_page_length: 1000,
  });
}


// Rate from Item Price (Price List)
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

// Last purchase rate from Purchase Order Item (latest)
export async function getItemLastPurchaseRate(itemCode) {
  const rows = await getDoctypeList("Purchase Order Item", {
    fields: JSON.stringify(["rate", "parent", "creation"]),
    filters: JSON.stringify([["Purchase Order Item", "item_code", "=", itemCode]]),
    order_by: "creation desc",
    limit_page_length: 1,
  });
  return rows[0] || null;
}

// Create BOM
export async function createBOM(payload) {
  // payload should be { doctype:"BOM", item, quantity, company, items:[...]}
  return createDoc("BOM", payload);
}

// get BOM doc with child items (avoids direct BOM Item permission issues)
export async function getBomDocWithItems(name) {
  const res = await axios.get(
    `${BACKEND_URL}/api/doc/BOM/${encodeURIComponent(name)}`
  );
  // ERPNext: { data: { ...bom, items: [ { item_code, qty, uom, ... }, ... ] } }
  return res.data.data;
}


// Finished items for manufacturing (item_group = Products)
export async function getFinishedItems() {
  return getDoctypeList("Item", {
    fields: JSON.stringify(["name", "item_name", "stock_uom", "item_group"]),
    filters: JSON.stringify([["Item", "item_group", "=", "Products"]]),
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

  return rows[0] || null; // may be null if no stock yet
}

// Get stock ledger entries up to a given date (inclusive)
export async function getStockLedgerUpToDate(date) {
  return getDoctypeList("Stock Ledger Entry", {
    fields: JSON.stringify([
      "name",
      "item_code",
      "warehouse",
      "posting_date",
      "posting_time",          // 👈 we use this in makeTs(...)
      "actual_qty",            // 👈 movement qty (used for In/Out/Adj/Sold/Return)
      "qty_after_transaction", // 👈 running balance (used for opening & current stock)
      "voucher_type",          // 👈 MUST be here for Adjustment/Sold/Return
      "voucher_no",
    ]),
    filters: JSON.stringify([
      ["Stock Ledger Entry", "posting_date", "<=", date],
    ]),
    order_by: "posting_date asc, posting_time asc, creation asc",
    limit_page_length: 10000,
  });
}




// We reuse your existing item helper for item names
// (if you don't have it, you can add this)
export async function getAllItems() {
  return getDoctypeList("Item", {
    fields: JSON.stringify(["name", "item_name", "item_group"]),
    limit_page_length: 5000,
  });
}


// --- SALES HELPERS ---

// Get customers for dropdown
export async function getCustomers() {
  return getDoctypeList("Customer", {
    fields: JSON.stringify(["name", "customer_name"]),
    filters: JSON.stringify([["Customer", "disabled", "=", 0]]),
    limit_page_length: 1000,
  });
}

// Finished items for sales (Products group)
export async function getFinishedItemsForSales() {
  // if you already have getFinishedItems() that returns Products, you can reuse that
  return getDoctypeList("Item", {
    fields: JSON.stringify(["name", "item_name", "stock_uom", "item_group", "custom_asin"]),
    filters: JSON.stringify([["Item", "item_group", "=", "Products"]]),
    limit_page_length: 1000,
  });
}

// Create Sales Invoice (we’ll use this for EasyShip)
//export async function createSalesInvoice({
//  customer,
//  company,
//  posting_date,
//  warehouse,
//  items,
//}) {
//  const payload = {
//    doctype: "Sales Invoice",
//    customer,
//    company,
//    posting_date,
//    due_date: posting_date,
//    update_stock: 1, // so this reduces stock directly
//    // if you later add a custom field `custom_sales_channel` in ERPNext:
//    // custom_sales_channel: "EasyShip",
//    items: items.map((row) => ({
//      item_code: row.item_code,
//      qty: Number(row.qty),
//      rate: row.rate != null ? Number(row.rate) : undefined,
//      warehouse, // same warehouse for all rows for now
//    })),
//  };

//  return createDoc("Sales Invoice", payload);
//}
function toYMD(input) {
  if (input == null) return "";

  if (input instanceof Date && !isNaN(input.getTime())) {
    return input.toISOString().slice(0, 10);
  }

  const s = String(input).trim();
  if (!s) return "";

  // YYYY-MM-DD or YYYY-MM-DDTHH:MM...
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[t\s].*)?$/i);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  // DDMMYYYY
  if (/^\d{8}$/.test(s)) {
    const dd = s.slice(0, 2);
    const mm = s.slice(2, 4);
    const yyyy = s.slice(4, 8);
    return `${yyyy}-${mm}-${dd}`;
  }

  return "";
}

export async function createSalesInvoice({
  customer,
  company,
  posting_date,
  due_date,
  warehouse,
  items,
  po_no,
  po_date,     // ✅ NEW
  remarks,
}) {
  const today = new Date().toISOString().slice(0, 10);

  const posting = toYMD(posting_date) || today;

  // ✅ keep due >= posting always
  let due = toYMD(due_date) || posting;
  if (due && posting && due < posting) due = posting;

  // ✅ NEW: normalize po_date too (from sheet purchase-date)
  const poDate = toYMD(po_date);

  const payload = {
    doctype: "Sales Invoice",
    customer,
    company,
    posting_date: posting,
    due_date: due,
    po_no: po_no || undefined,
    po_date: poDate || undefined,  // ✅ send only if valid
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

  // ✅ normalize id->name if backend returns id
  if (res?.data && !res.data.name && res.data.id) {
    return { ...res, data: { ...res.data, name: res.data.id } };
  }

  return res;
}

// ✅ Create Sales Order (DRAFT)
export async function createSalesOrder(payload) {
  // POST /api/resource/Sales Order
  return api.post("/api/resource/Sales Order", payload);
}

// ✅ Recent submitted Sales Orders
export async function getRecentSalesOrders(limit = 10) {
  // You already have getDoctypeList(), so we reuse it
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
    filters: JSON.stringify([
      ["Sales Order", "docstatus", "=", 1],
    ]),
    order_by: "modified desc",
    limit_page_length: limit,
  });
}

// ✅ Get Sales Order with items
export async function getSalesOrderWithItems(name) {
  // You already have getDoc() but keeping a dedicated function is cleaner
  return getDoc("Sales Order", name);
}

/**
 * ✅ Make Sales Invoice from Sales Order (server-side method)
 * Returns: { siName }
 *
 * This uses ERPNext's standard "make_sales_invoice" mapper,
 * so the Sales Invoice lines will link back to Sales Order lines
 * and ERPNext will update SO billing/status automatically after submit.
 */
export async function createSalesInvoiceFromSalesOrder(salesOrderName) {
  // 1) map SO -> Sales Invoice draft doc
  const mapped = await api.post(
    "/api/method/erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice",
    { source_name: salesOrderName }
  );

  const siDoc = mapped?.data?.message;
  if (!siDoc) throw new Error("make_sales_invoice did not return a Sales Invoice document.");

  // 2) insert Sales Invoice (draft)
  const inserted = await api.post("/api/method/frappe.client.insert", {
    doc: siDoc,
  });

  const insertedDoc = inserted?.data?.message;
  const siName = insertedDoc?.name || insertedDoc;
  if (!siName) throw new Error("Inserted Sales Invoice name not returned.");

  return { siName };
}


// Recent submitted invoices (ONLY normal sales, no returns)
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
      ["Sales Invoice", "is_return", "=", 0], // 👈 exclude returns
    ]),
    order_by: "posting_date desc, creation desc",
    limit_page_length: limit,
  });
}


// --- Payment for Sales Invoice (mark as Paid) ---

// NOTE: change these to your real values in ERPNext
const DEFAULT_MODE_OF_PAYMENT = "Cash";       // or "Bank", "UPI", etc.
const DEFAULT_PAID_TO_ACCOUNT = "Cash - MF";   // e.g. "Cash - MF" or "Bank - SINGH"

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

  // create PE (draft)
  const pe = await createDoc("Payment Entry", payload);
  const name = pe.data?.name;

  // submit PE – this will update the Sales Invoice status to Paid
  if (name) {
    await submitDoc("Payment Entry", name);
  }

  return name;
}


// --- Sales Return helpers (shared across all sales channels) ---
// Full Sales Invoice with items
export async function getSalesInvoiceWithItems(name) {
  const res = await axios.get(
    `${BACKEND_URL}/api/doc/Sales Invoice/${encodeURIComponent(name)}`
  );
  return res.data.data; // { ...invoice, items: [...] }
}

// Create Sales Return (credit note) for any Sales Invoice.
// quality: "good"  => stock back to Finished Goods warehouse
//          "damaged" => stock into Damaged warehouse
export async function createSalesReturn(invoiceDoc, quality) {
  // 🔁 change these to match your real warehouses
  const GOOD_RETURN_WH = "Finished Goods - MF";
  const DAMAGED_RETURN_WH = "Damaged - MF";

  const targetWarehouse =
    quality === "damaged" ? DAMAGED_RETURN_WH : GOOD_RETURN_WH;

  const today = new Date().toISOString().slice(0, 10);

  const items = (invoiceDoc.items || []).map((it) => ({
    item_code: it.item_code,
    // ERPNext usually expects negative qty on return invoice
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
    update_stock: 1, // bring stock back in
    items,
  };

  const res = await createDoc("Sales Invoice", payload);
  const name = res.data?.name;
  if (name) {
    await submitDoc("Sales Invoice", name);
  }
  return name;
}

// Recent Sales Returns (all platforms) – just "is_return = 1"
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

// --- PURCHASE ORDER EMAIL & PDF (via generic /api/method) ---

// Send PO email to supplier
export async function sendPurchaseOrderEmail({
  poName,
  recipients,         // "a@x.com,b@y.com"
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

// Build a URL to download PO PDF via generic GET method
export function getPurchaseOrderPdfUrl(poName, format = "Standard") {
  const params = new URLSearchParams({
    doctype: "Purchase Order",
    name: poName,
    format,
    no_letterhead: "0",
  });

  // This hits our generic /api/method route, which proxies to ERPNext
  return `${BACKEND_URL}/api/method/frappe.utils.print_format.download_pdf?${params.toString()}`;
}

// --- Supplier list (detailed) ---

//export async function getSuppliersForList() {
//  return getDoctypeList("Supplier", {
//    fields: JSON.stringify([
//      "name",                 // ID
//      "supplier_name",        // display name
//      "supplier_group",       // category
//      "supplier_type",        // extra category
//      "disabled",             // status
//      "mobile_no",            // phone
//      "email_id",             // email (core field, NOT supplier_email)
//    ]),
//    limit_page_length: 1000,
//    order_by: "modified desc"
//  });
//}

// --- Supplier list (detailed) ---

export async function getSuppliersForList() {
  return getDoctypeList("Supplier", {
    fields: JSON.stringify([
      "name",                 // ID
      "supplier_name",        // display name
      "supplier_group",       // category
      "supplier_type",        // extra category
      "disabled",             // status
      "mobile_no",            // phone
      "email_id",             // email (core field)
      // 🆕 custom fields:
      "custom_contact_person",
      "custom_credit_limit",
      "custom_status",

      "pan",
      "gstin",
      "gst_category",
      "supplier_primary_address",
      "primary_address",
      "default_bank_account",
    ]),
    limit_page_length: 1000,
    order_by: "modified desc",
  });
}

// --- Purchase side Payment Entry (mark Purchase Invoice as Paid) ---

const DEFAULT_PURCHASE_MODE_OF_PAYMENT = "Cash";     // or "Bank", "UPI", etc.
const DEFAULT_PURCHASE_PAID_FROM_ACCOUNT = "Cash - MF"; // your asset/bank account (credit)

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
    // paid_from = your cash/bank account (credit)
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

// Generic doc update
//export async function updateDoc(doctype, name, payload) {
//  const res = await axios.put(
//    `${BACKEND_URL}/api/doc/${encodeURIComponent(doctype)}/${encodeURIComponent(
//      name
//    )}`,
//    payload
//  );
//  return res.data; // { data: {...} } from ERPNext
//}
// src/Components/erpBackendApi.js
// ADD THIS FUNCTION if it doesn't exist
//export async function updateDoc(doctype, name, data) {
//  const response = await fetch(`/api/resource/${doctype}/${name}`, {
//    method: "PUT",
//    headers: {
//      "Content-Type": "application/json",
//      "Authorization": `Bearer ${localStorage.getItem('authToken')}`
//    },
//    body: JSON.stringify(data)
//  });

//  if (!response.ok) {
//    throw new Error(`Failed to update ${doctype} ${name}`);
//  }

//  return response.json();
//}

// ✅ Generic doc update (uses your Node backend route /api/doc/:doctype/:name)
export async function updateDoc(doctype, name, payload) {
  const res = await axios.put(
    `${BACKEND_URL}/api/doc/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
    payload
  );
  return res.data; // { data: {...} }
}


// Flip Purchase Order status (e.g. "Completed", "Cancelled")
export async function updatePurchaseOrderStatus(name, status) {
  return updateDoc("Purchase Order", name, { status });
}

// Update an existing Purchase Order (draft)
export async function updatePurchaseOrder(name, payload) {
  const res = await axios.put(
    `${BACKEND_URL}/api/doc/${encodeURIComponent("Purchase Order")}/${encodeURIComponent(
      name
    )}`,
    payload
  );
  return res.data; // { data: {...updated po...} }
}

// Cancel PO via frappe.client.cancel (sets docstatus=2 and status="Cancelled")
export async function cancelPurchaseOrder(name) {
  const res = await axios.post(`${BACKEND_URL}/api/cancel_doc`, {
    doctype: "Purchase Order",
    name,
  });
  return res.data;
}



// Add this helper function
async function getPurchaseReceiptWithItems(prName) {
  try {
    const response = await fetch(`/api/resource/Purchase Receipt/${prName}`, {
      headers: {
        "Authorization": `Bearer ${localStorage.getItem('authToken')}`
      }
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

// --- Status helpers for Purchase Order & Purchase Receipt ---

// Uses whitelisted method: erpnext.buying.doctype.purchase_order.purchase_order.update_status(status, name)
export async function setPurchaseOrderStatus(name, status) {
  const res = await axios.post(
    `${BACKEND_URL}/api/method/erpnext.buying.doctype.purchase_order.purchase_order.update_status`,
    { status, name }
  );
  return res.data;
}

// Uses whitelisted method: erpnext.stock.doctype.purchase_receipt.purchase_receipt.update_purchase_receipt_status(docname, status)
export async function setPurchaseReceiptStatus(docname, status) {
  const res = await axios.post(
    `${BACKEND_URL}/api/method/erpnext.stock.doctype.purchase_receipt.purchase_receipt.update_purchase_receipt_status`,
    { docname, status }
  );
  return res.data;
}


// Get Companies for dropdown
export async function getCompanies() {
  return getDoctypeList("Company", {
    fields: JSON.stringify([
      "name",
      "company_name",
      "abbr",
    ]),
    limit_page_length: 1000,
  });
}

// Get all possible values of Supplier.custom_status (Select field options)
export async function getSupplierStatusOptions() {
  const res = await axios.get(
    `${BACKEND_URL}/api/method/frappe.desk.form.load.getdoctype`,
    {
      params: { doctype: "Supplier" },
    }
  );

  // ERPNext returns meta as docs[0].fields
  const docs = res.data.docs || [];
  if (!docs.length) return [];

  const fields = docs[0].fields || [];
  const statusField = fields.find((f) => f.fieldname === "custom_status");

  if (!statusField || !statusField.options) return [];

  // options are a newline-separated string
  return statusField.options
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);
}

// Child table: Item Supplier (which item is linked to which supplier)
// We use this to build supplier → items mapping
//export async function getItemSuppliers() {
//  return getDoctypeList("Item Supplier", {
//    fields: JSON.stringify([
//      "parent",   // Item code
//      "supplier", // Supplier ID
//    ]),
//    limit_page_length: 5000, // adjust as needed
//  });
//}
export async function getItemSuppliers() {
  return getDoctypeList("Item Supplier", {
    parent: "Item",   // 👈 tell Frappe this child belongs to Item
    fields: JSON.stringify([
      "parent",   // Item code
      "supplier", // Supplier ID
    ]),
    limit_page_length: 5000,
  });
}




// --- RETURN DELIVERY NOTE + STANDALONE SALES RETURN INVOICE ---

// Create a Return Delivery Note (stock IN from customer, no link to original invoice)
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
    is_return: 1, // 👈 mark as return
    items: items.map((row) => ({
      item_code: row.item_code,
      // For return DN, ERPNext expects negative qty (stock coming back in)
      qty: -Math.abs(Number(row.qty) || 0),
      rate: row.rate != null ? Number(row.rate) : undefined,
      warehouse: row.warehouse || undefined,
    })),
  };

  return createDoc("Delivery Note", payload);
}

// Create a standalone Sales Return Invoice (credit note, no original invoice)
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
    is_return: 1, // 👈 credit note
    // Stock already adjusted via Return Delivery Note, so no stock update here
    update_stock: 0,
    items: items.map((row) => ({
      item_code: row.item_code,
      // Negative qty for return
      qty: -Math.abs(Number(row.qty) || 0),
      rate: row.rate != null ? Number(row.rate) : undefined,
      // no warehouse on SI (pure accounting return)
    })),
  };

  return createDoc("Sales Invoice", payload);
}


// Delete a Purchase Order (usually draft) using frappe.client.delete
export async function deletePurchaseOrder(name) {
  const res = await axios.post(
    `${BACKEND_URL}/api/method/frappe.client.delete`,
    {
      doctype: "Purchase Order",
      name,
    }
  );
  return res.data;
}

export async function updateBOM(name, payload) {
  return updateDoc("BOM", name, payload);
}

// --- stock change event bus ---
const stockListeners = new Set();

export function onStockChanged(fn) {
  stockListeners.add(fn);
  return () => stockListeners.delete(fn);
}

export function emitStockChanged() {
  stockListeners.forEach((fn) => {
    try { fn(); } catch (e) { console.error(e); }
  });
}

// ===== Manufacturing helpers (NO new backend APIs) =====

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

export async function createAndSubmitWorkOrder(payload) {
  // payload must include doctype:"Work Order"
  const created = await createDoc("Work Order", payload);
  const name = created?.data?.name;
  if (!name) throw new Error("Work Order not created (missing name).");
  await submitDoc("Work Order", name);
  return name;
}

export async function createAndSubmitStockEntry(payload) {
  const created = await createDoc("Stock Entry", payload);
  const name = created?.data?.name;
  if (!name) throw new Error("Stock Entry not created (missing name).");
  await submitDoc("Stock Entry", name);
  return name;
}

// small concurrency limiter to avoid slowdown / too many requests
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
export async function setWorkOrderStatus(workOrderName, status) {
  // 1) Best: try ERPNext's own status updater (if your ERPNext version has it)
  try {
    const res = await axios.post(
      `${BACKEND_URL}/api/method/erpnext.manufacturing.doctype.work_order.work_order.update_status`,
      { status, name: workOrderName }
    );
    return res.data;
  } catch (err) {
    // 2) Fallback: directly set the field (works in many setups)
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


// Analitics 

export async function runReport(report_name, filters = {}) {
  const res = await axios.post(`${BACKEND_URL}/api/report/run`, {
    report_name,
    filters,
  });
  return res.data; // { columns, result, ... }
}



export async function getActiveFiscalYears() {
  const res = await axios.get(`${BACKEND_URL}/api/doctype/Fiscal Year`, {
    params: {
      fields: JSON.stringify(["name", "year_start_date", "year_end_date", "disabled"]),
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

// Profit & Loss (ERPNext needs periodicity)
export function getProfitAndLoss({ company, from_date, to_date, periodicity = "Monthly" }) {
  return runReport("Profit and Loss Statement", {
    company,
    periodicity,
    period_start_date: from_date,
    period_end_date: to_date,
  });
}

// Sales Analytics (ERPNext expects company as STRING + range/from/to + value_quantity)
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
    company,          // ✅ STRING (NOT array)
    from_date,
    to_date,
    range,
    value_quantity,
    tree_type,
    doc_type,
  });
}

// Purchase Analytics (same style)
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
    company,          // ✅ STRING (NOT array)
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

// ⚠️ CHANGE these to match ERPNext "Fieldname" exactly
export const MF_PO_FIELDS = {
  status: "custom_mf_status",
  updatedOn: "custom_mf_status_updated_on",
  stockPercent: "custom_mf_stock_in_percent",
};

// Matches your Select options
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



function nowKolkataErpDatetime() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const m = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${m.year}-${m.month}-${m.day} ${m.hour}:${m.minute}:${m.second}`;
}

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


export async function uploadFileToDoc({ doctype, docname, file, is_private = 1 }) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("doctype", doctype);
  fd.append("docname", docname);
  fd.append("is_private", String(is_private)); // 1 = private (logged-in users)
  fd.append("file_name", file.name);

  const res = await axios.post(`${BACKEND_URL}/api/upload`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
}

export async function closePurchaseOrder(poName) {
  const res = await axios.post(
    `${BACKEND_URL}/api/method/erpnext.buying.doctype.purchase_order.purchase_order.close_or_unclose_purchase_orders`,
    { names: [poName], status: "Closed" }
  );
  return res.data;
}
// ✅ ADD in erpBackendApi.js

// helper: list Sales Invoice with filters
export async function listSalesInvoices({ filters = [], fields, order_by, limit = 20 }) {
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

// ✅ Returns list = (ALL drafts) + (last 10 submitted)
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

  // drafts first, then submitted (unique by name)
  const map = new Map();
  (drafts || []).forEach((d) => map.set(d.name, d));
  (submitted || []).forEach((s) => {
    if (!map.has(s.name)) map.set(s.name, s);
  });

  return Array.from(map.values());
}

// ✅ Returns list = (ALL drafts) + (last 10 submitted)
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

// ✅ Save doc (used for updating draft with child table)
export async function saveDoc(doc) {
  // frappe.client.save expects: { doc: {...} }
  const res = await axios.post(
    `${BASE_URL}/api/method/frappe.client.save`,
    { doc },
    { headers: authHeaders() }
  );
  // returns {message: { ...saved_doc }}
  return res.data?.message;
}

// ===== MF FLOW HELPERS (only for MF workflow tracker) =====

function chunkArray(arr, size = 150) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ✅ list Stock Entries created by our MF flow (FILTER BY custom_mf_track)
// list Stock Entries created by our MF flow (by remarks tag) + custom_mf_track=1
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
      "custom_mf_track", // ✅ include field
    ]),
    filters: JSON.stringify([
      ["Stock Entry", "custom_mf_track", "=", 1], // ✅ ONLY our MF process
      ["Stock Entry", "remarks", "like", like],   // ✅ this flow only
    ]),
    order_by: "posting_date desc, posting_time desc, modified desc",
    limit_page_length: limit,
  });
}


// ✅ list only Manufacture Stock Entries for this MF flow
export async function listMfFlowManufactureEntries({ flowTag, limit = 300 } = {}) {
  const all = await listMfFlowStockEntries({ flowTag, limit });
  return (all || []).filter((x) => x.docstatus === 1 && x.stock_entry_type === "Manufacture");
}

// get Stock Ledger entries for given voucher_nos + warehouse
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

// remaining qty in WIP for this MF flow (net balance)
export async function getMfFlowWipBalances({ flowTag, wipWarehouse }) {
  if (!flowTag || !wipWarehouse) return [];

  // ✅ now this only returns Stock Entries where custom_mf_track=1 AND remarks contains flowTag
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
    const q = Number(r.actual_qty) || 0; // +in, -out
    map.set(code, (map.get(code) || 0) + q);
  });

  return Array.from(map.entries())
    .map(([item_code, remaining_qty]) => ({ item_code, remaining_qty }))
    .filter((x) => x.remaining_qty > 0.0000001)
    .sort((a, b) => a.item_code.localeCompare(b.item_code));
}

// erpBackendApi.js

// 🔧 change this to your custom doctype name in ERPNext
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
//export async function getTransporterStatusOptions() {
//  // Same logic as getSupplierStatusOptions, but for transporter doctype
//  return await getSelectOptionsFromMeta(TRANSPORTER_DOCTYPE, "custom_status");
//}
// ✅ Stock Reconciliation list (parent) with date filter
export async function getStockReconciliationEntries({
  from_date,
  to_date,
  includeDrafts = true,
  limit = 500,
} = {}) {
  const filters = [];

  if (from_date) filters.push(["Stock Reconciliation", "posting_date", ">=", from_date]);
  if (to_date) filters.push(["Stock Reconciliation", "posting_date", "<=", to_date]);

  // ✅ EXCLUDE OPENING STOCK
  filters.push(["Stock Reconciliation", "purpose", "=", "Stock Reconciliation"]);

  // exclude cancelled by default
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

// ✅ Fetch Stock Reconciliation Item rows for multiple parents (child table)
// NOTE: `parent: "Stock Reconciliation"` is REQUIRED, otherwise PermissionError happens.
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
      parent: "Stock Reconciliation", // ✅ required
      fields: JSON.stringify(["parent", "item_code", "warehouse", "qty", "current_qty"]),
      filters: JSON.stringify([["Stock Reconciliation Item", "parent", "in", part]]),
      limit_page_length: 10000,
    });

    all.push(...(rows || []));
  }

  return all;
}

export async function getStockReconciliationEntriesWithSummary(opts = {}) {
  const parents = await getStockReconciliationEntries(opts);

  const parentNames = (parents || []).map((p) => p.name).filter(Boolean);
  if (!parentNames.length) return [];

  let childRows = [];
  try {
    childRows = await getStockReconciliationItemsForParents(parentNames);
  } catch (e) {
    console.error("Child list failed, fallback to getDoc per parent", e);

    childRows = [];
    const docs = await mapLimit(parents, 6, async (p) => getDoc("Stock Reconciliation", p.name));
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

  // item_code -> item_name
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

  const summarize = (arr) => {
    const uniq = Array.from(new Set(arr.filter(Boolean)));
    if (!uniq.length) return "—";
    if (uniq.length === 1) return uniq[0];
    return `${uniq[0]} +${uniq.length - 1}`;
  };

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

    // ✅ Qty Change = qty - current_qty
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
      _qtyChange: qtyChange, // ✅ THIS IS WHAT UI WILL SHOW
    };
  });
}
