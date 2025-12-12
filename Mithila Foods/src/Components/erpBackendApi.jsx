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


{/* Below function gives the List of the all docs present in erpNext*/}
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
    fields: JSON.stringify(["name", "item_name"]),
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
    fields: JSON.stringify(["name", "item_name", "stock_uom", "item_group"]),
    filters: JSON.stringify([["Item", "item_group", "=", "Products"]]),
    limit_page_length: 1000,
  });
}

// Create Sales Invoice (we’ll use this for EasyShip)
export async function createSalesInvoice({
  customer,
  company,
  posting_date,
  warehouse,
  items,
}) {
  const payload = {
    doctype: "Sales Invoice",
    customer,
    company,
    posting_date,
    due_date: posting_date,
    update_stock: 1, // so this reduces stock directly
    // if you later add a custom field `custom_sales_channel` in ERPNext:
    // custom_sales_channel: "EasyShip",
    items: items.map((row) => ({
      item_code: row.item_code,
      qty: Number(row.qty),
      rate: row.rate != null ? Number(row.rate) : undefined,
      warehouse, // same warehouse for all rows for now
    })),
  };

  return createDoc("Sales Invoice", payload);
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
export async function updateDoc(doctype, name, data) {
  const response = await fetch(`/api/resource/${doctype}/${name}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem('authToken')}`
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update ${doctype} ${name}`);
  }
  
  return response.json();
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
