// src/api/sales.js
import axios from "axios";
import { BACKEND_URL, getDoctypeList, getDoc, createDoc, submitDoc } from "./core.js";

// convert any date format to YYYY-MM-DD
export function toYMD(input) {
  if (input == null) return "";
  if (input instanceof Date && !isNaN(input.getTime())) return input.toISOString().slice(0, 10);
  const s = String(input).trim();
  if (!s) return "";
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[t\s].*)?$/i);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  if (/^\d{8}$/.test(s)) return `${s.slice(4, 8)}-${s.slice(2, 4)}-${s.slice(0, 2)}`;
  return "";
}


// ------------------------------
// Sales Invoices
// ------------------------------


export async function createSalesInvoice({ customer, company, posting_date, due_date, warehouse, items, po_no, po_date, remarks }) {
  const posting = toYMD(posting_date) || new Date().toISOString().slice(0, 10);
  let due = toYMD(due_date) || posting;
  if (due && posting && due < posting) due = posting;

  const payload = {
    doctype: "Sales Invoice", customer, company, posting_date: posting, due_date: due,
    po_no, po_date: toYMD(po_date), remarks, update_stock: 1, // This will helps us to update the stock with the sales. Here we Diracly make the sales invoice without SO
    items: (items || []).map((row) => ({
      item_code: row.item_code, qty: Number(row.qty), rate: row.rate != null ? Number(row.rate) : undefined, warehouse,
    })),
  };

  const res = await createDoc("Sales Invoice", payload);
  if (res?.data && !res.data.name && res.data.id) return { ...res, data: { ...res.data, name: res.data.id } };
  return res;
}

export async function getRecentSalesInvoices(limit = 20) {
  return getDoctypeList("Sales Invoice", {
    fields: JSON.stringify(["name", "customer", "company", "posting_date", "grand_total", "outstanding_amount", "status", "is_return"]),
    filters: JSON.stringify([["Sales Invoice", "docstatus", "=", 1], ["Sales Invoice", "is_return", "=", 0]]),
    order_by: "posting_date desc, creation desc",
    limit_page_length: limit,
  });
}

export async function getSalesInvoiceWithItems(name) {
  const res = await axios.get(`${BACKEND_URL}/api/doc/Sales Invoice/${encodeURIComponent(name)}`);
  return res.data.data;
}


// ------------------------------
// Sales Returns
// ------------------------------


export async function createSalesReturn(invoiceDoc, quality) {
  const GOOD_RETURN_WH = "Finished Goods - MF";
  const DAMAGED_RETURN_WH = "Damaged - MF";
  const targetWarehouse = quality === "damaged" ? DAMAGED_RETURN_WH : GOOD_RETURN_WH;

  const items = (invoiceDoc.items || []).map((it) => ({
    item_code: it.item_code, qty: -Math.abs(parseFloat(it.qty) || 0), rate: it.rate, warehouse: targetWarehouse,
  }));

  const payload = {
    doctype: "Sales Invoice", is_return: 1, return_against: invoiceDoc.name,
    company: invoiceDoc.company, customer: invoiceDoc.customer, posting_date: new Date().toISOString().slice(0, 10),
    update_stock: 1, items,
  };

  const res = await createDoc("Sales Invoice", payload);
  if (res.data?.name) await submitDoc("Sales Invoice", res.data.name);
  return res.data?.name;
}

export async function getRecentSalesReturns(limit = 50) {
  return getDoctypeList("Sales Invoice", {
    fields: JSON.stringify(["name", "customer", "company", "posting_date", "grand_total", "return_against"]),
    filters: JSON.stringify([["Sales Invoice", "docstatus", "=", 1], ["Sales Invoice", "is_return", "=", 1]]),
    order_by: "posting_date desc, creation desc",
    limit_page_length: limit,
  });
}

export async function createReturnDeliveryNote({ customer, company, posting_date, items }) {
  return createDoc("Delivery Note", {
    doctype: "Delivery Note", customer, company, posting_date, is_return: 1,
    items: items.map((row) => ({
      item_code: row.item_code, qty: -Math.abs(Number(row.qty) || 0), rate: row.rate != null ? Number(row.rate) : undefined, warehouse: row.warehouse,
    })),
  });
}

export async function createStandaloneSalesReturnInvoice({ customer, company, posting_date, items }) {
  return createDoc("Sales Invoice", {
    doctype: "Sales Invoice", customer, company, posting_date, due_date: posting_date, is_return: 1, update_stock: 0,
    items: items.map((row) => ({
      item_code: row.item_code, qty: -Math.abs(Number(row.qty) || 0), rate: row.rate != null ? Number(row.rate) : undefined,
    })),
  });
}


// ------------------------------
// Sales Payments
// ------------------------------


export async function createPaymentEntryForInvoice(inv) {
  const amount = typeof inv.outstanding_amount === "number" && !isNaN(inv.outstanding_amount) ? inv.outstanding_amount : inv.grand_total;
  
  const payload = {
    doctype: "Payment Entry", payment_type: "Receive", company: inv.company,
    posting_date: new Date().toISOString().slice(0, 10), mode_of_payment: "Cash", party_type: "Customer",
    party: inv.customer, paid_to: "Cash - MF", paid_amount: amount, received_amount: amount,
    references: [{ reference_doctype: "Sales Invoice", reference_name: inv.name, total_amount: inv.grand_total, outstanding_amount: inv.outstanding_amount, allocated_amount: amount }],
  };

  const pe = await createDoc("Payment Entry", payload);
  if (pe.data?.name) await submitDoc("Payment Entry", pe.data.name);
  return pe.data?.name;
}

// ------------------------------
// Sales Orders & Drafts
// ------------------------------

export async function createSalesOrder(payload) {
  const res = await axios.post(`${BACKEND_URL}/api/resource/Sales Order`, payload);
  return res.data;
}

export async function getRecentSalesOrders(limit = 10) {
  return getDoctypeList("Sales Order", {
    fields: JSON.stringify([
      "name", "customer", "company", "transaction_date", "grand_total",
      "status", "docstatus", "per_billed", "modified",
    ]),
    filters: JSON.stringify([["Sales Order", "docstatus", "=", 1]]),
    order_by: "modified desc",
    limit_page_length: limit,
  });
}

export async function getSalesOrderWithItems(name) {
  return getDoc("Sales Order", name);
}

export async function createSalesInvoiceFromSalesOrder(salesOrderName) {
  const mapped = await axios.post(
    `${BACKEND_URL}/api/method/erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice`,
    { source_name: salesOrderName }
  );

  const siDoc = mapped?.data?.message;
  if (!siDoc) throw new Error("make_sales_invoice did not return a Sales Invoice document.");

  const inserted = await axios.post(`${BACKEND_URL}/api/method/frappe.client.insert`, {
    doc: siDoc,
  });

  const insertedDoc = inserted?.data?.message;
  const siName = insertedDoc?.name || insertedDoc;
  if (!siName) throw new Error("Inserted Sales Invoice name not returned.");

  return { siName };
}