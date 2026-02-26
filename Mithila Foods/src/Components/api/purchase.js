// src/api/purchase.js
// In this we handle the purchase and some custom logic which we have made

import axios from "axios";
import { BACKEND_URL, getDoctypeList, getDoc, createDoc, submitDoc, updateDoc, mapLimit } from "./core.js";
import { fetchTransporterServiceAreas } from "./master.js";


// ------------------------------
// Shared Helpers & Constants
// ------------------------------


export const MF_PO_FIELDS = {
  status: "custom_mf_status", // These are the custom status fields which we have made to track down the POs and also let us handle the QC
  updatedOn: "custom_mf_status_updated_on",
  stockPercent: "custom_mf_stock_in_percent",
};

export const MF_STATUS_OPTIONS = [ // These are multiple custome satus which we have made also linked some with the ERP satus
  "PO Draft", "PO Confirmed", "In Transit", "Delivered", 
  "QC In", "QC Pass", "Completed", "Cancelled",
];

export function nowKolkataErpDatetime() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${m.year}-${m.month}-${m.day} ${m.hour}:${m.minute}:${m.second}`;
}

function prChunk(arr, size = 100) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function prDateOnly(input) {
  if (!input) return "";
  const s = String(input).trim();
  return s ? s.slice(0, 10) : "";
}


// ------------------------------
// Purchase Orders
// ------------------------------


export async function createPurchaseOrder({ supplier, item_code, qty, rate, notes, warehouse, po_date, schedule_date }) {
  const today = new Date().toISOString().slice(0, 10);
  const txDate = po_date || today;
  const schedDate = schedule_date || txDate;

  const payload = {
    doctype: "Purchase Order",
    supplier,
    transaction_date: txDate,
    schedule_date: schedDate,
    notes: notes || "",
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

export async function getPurchaseOrderWithItems(name) {
  return getDoc("Purchase Order", name);
}

export async function updatePurchaseOrder(name, payload) {
  return updateDoc("Purchase Order", name, payload);
}

export async function cancelPurchaseOrder(name) {
  const res = await axios.post(`${BACKEND_URL}/api/cancel_doc`, { doctype: "Purchase Order", name });
  return res.data;
}

export async function deletePurchaseOrder(name) {
  const res = await axios.post(`${BACKEND_URL}/api/method/frappe.client.delete`, { doctype: "Purchase Order", name });
  return res.data;
}

export async function closePurchaseOrder(poName) {
  const res = await axios.post(
    `${BACKEND_URL}/api/method/erpnext.buying.doctype.purchase_order.purchase_order.close_or_unclose_purchase_orders`,
    { names: [poName], status: "Closed" }
  );
  return res.data;
}

export async function setPurchaseOrderStatus(name, status) {
  const res = await axios.post(
    `${BACKEND_URL}/api/method/erpnext.buying.doctype.purchase_order.purchase_order.update_status`,
    { status, name }
  );
  return res.data;
}

export async function setPurchaseOrderMfStatus(poName, mfStatus, { stockPercent } = {}) {
  const now = nowKolkataErpDatetime();
  const patch = {
    [MF_PO_FIELDS.status]: mfStatus,
    [MF_PO_FIELDS.updatedOn]: now,
  };

  if (mfStatus === "Delivered") {
    patch["custom_goods_delivered_date"] = now;
  }

  if (stockPercent !== undefined && stockPercent !== null && stockPercent !== "") {
    patch[MF_PO_FIELDS.stockPercent] = Number(stockPercent);
  }

  return updateDoc("Purchase Order", poName, patch);
}

export async function setPurchaseOrderTransporter(poName, transporterName) {
  return updateDoc("Purchase Order", poName, { custom_transporter: transporterName || "" });
}

export async function sendPurchaseOrderEmail({ poName, recipients, subject, message, printFormat = "Standard" }) {
  const payload = {
    recipients,
    subject: subject || `Purchase Order ${poName}`,
    content: message || `Dear Supplier,<br><br>Please find attached Purchase Order <b>${poName}</b>.<br><br>Regards,`,
    doctype: "Purchase Order",
    name: poName,
    send_email: 1,
    send_me_a_copy: 0,
    print_html: 0,
    print_format: printFormat,
  };

  const res = await axios.post(`${BACKEND_URL}/api/method/frappe.core.doctype.communication.email.make`, payload);
  return res.data;
}

export function getPurchaseOrderPdfUrl(poName, format = "Standard") { // This is where we download the PO pdf
  const params = new URLSearchParams({ doctype: "Purchase Order", name: poName, format, no_letterhead: "0" });
  return `${BACKEND_URL}/api/method/frappe.utils.print_format.download_pdf?${params.toString()}`;
}


// ------------------------------
// Purchase Receipts
// ------------------------------


export async function setPurchaseReceiptStatus(docname, status) {
  const res = await axios.post(
    `${BACKEND_URL}/api/method/erpnext.stock.doctype.purchase_receipt.purchase_receipt.update_purchase_receipt_status`,
    { docname, status }
  );
  return res.data;
}

export async function getPurchaseReceiptQualitySummary({ supplier, from_date, to_date } = {}) {
  const pageSize = 1000;
  let start = 0, receiptCount = 0, totalAcceptedQty = 0, totalRejectedQty = 0;
  const filters = [["Purchase Receipt", "docstatus", "=", 1]];
  
  if (supplier) filters.push(["Purchase Receipt", "supplier", "=", supplier]);
  if (from_date) filters.push(["Purchase Receipt", "posting_date", ">=", from_date]);
  if (to_date) filters.push(["Purchase Receipt", "posting_date", "<=", to_date]);

  let parents = [];
  while (true) {
    const rows = await getDoctypeList("Purchase Receipt", {
      fields: JSON.stringify(["name", "supplier", "posting_date", "docstatus"]),
      filters: JSON.stringify(filters),
      order_by: "posting_date desc",
      limit_page_length: pageSize,
      limit_start: start,
    });
    if (!rows || !rows.length) break;
    parents.push(...rows);
    if (rows.length < pageSize) break;
    start += pageSize;
  }

  receiptCount = parents.length;
  const parentNames = parents.map((p) => p.name).filter(Boolean);
  if (!parentNames.length) return { receiptCount: 0, totalAcceptedQty: 0, totalRejectedQty: 0, totalQty: 0 };

  for (const part of prChunk(parentNames, 100)) {
    const items = await getDoctypeList("Purchase Receipt Item", {
      parent: "Purchase Receipt",
      fields: JSON.stringify(["parent", "qty", "rejected_qty"]),
      filters: JSON.stringify([["Purchase Receipt Item", "parent", "in", part]]),
      limit_page_length: 10000,
    });
    for (const it of items || []) {
      totalAcceptedQty += Number(it.qty) || 0;
      totalRejectedQty += Number(it.rejected_qty) || 0;
    }
  }

  return { receiptCount, totalAcceptedQty, totalRejectedQty, totalQty: totalAcceptedQty + totalRejectedQty };
}


// ------------------------------
// Purchase Invoices & Payments
// ------------------------------


export async function createPaymentEntryForPurchaseInvoice(pi) {
  const amount = typeof pi.outstanding_amount === "number" && !isNaN(pi.outstanding_amount)
      ? pi.outstanding_amount : pi.grand_total;
  const today = new Date().toISOString().slice(0, 10);

  const payload = {
    doctype: "Payment Entry", payment_type: "Pay", company: pi.company,
    posting_date: today, mode_of_payment: "Cash", party_type: "Supplier",
    party: pi.supplier, paid_from: "Cash - MF", paid_amount: amount, received_amount: amount,
    references: [{
      reference_doctype: "Purchase Invoice", reference_name: pi.name,
      total_amount: pi.grand_total, outstanding_amount: pi.outstanding_amount, allocated_amount: amount,
    }],
  };

  const pe = await createDoc("Payment Entry", payload);
  if (pe.data?.name) await submitDoc("Payment Entry", pe.data.name);
  return pe.data?.name;
}

export async function getPurchaseInvoicePayablesSummary({ from_date, to_date, supplier } = {}) {
  let start = 0, totalInvoiceValue = 0, totalOutstanding = 0, invoiceCount = 0;
  const filters = [["Purchase Invoice", "docstatus", "=", 1]];
  if (supplier) filters.push(["Purchase Invoice", "supplier", "=", supplier]);
  if (from_date) filters.push(["Purchase Invoice", "posting_date", ">=", from_date]);
  if (to_date) filters.push(["Purchase Invoice", "posting_date", "<=", to_date]);

  while (true) {
    const list = await getDoctypeList("Purchase Invoice", {
      fields: JSON.stringify(["name", "grand_total", "outstanding_amount"]),
      filters: JSON.stringify(filters),
      limit_page_length: 1000, limit_start: start,
    });
    if (!list || !list.length) break;
    invoiceCount += list.length;
    for (const r of list) {
      totalInvoiceValue += Number(r.grand_total) || 0;
      totalOutstanding += Number(r.outstanding_amount) || 0;
    }
    if (list.length < 1000) break;
    start += 1000;
  }
  return { invoiceCount, totalInvoiceValue, totalPaid: totalInvoiceValue - totalOutstanding, totalOutstanding };
}

export async function createTransporterInvoice({ transporter, amount, poName, company, posting_date }) {
  const payload = {
    doctype: "Purchase Invoice", supplier: transporter, company,
    posting_date: posting_date || new Date().toISOString().slice(0, 10),
    due_date: posting_date || new Date().toISOString().slice(0, 10),
    custom_linked_po: poName, update_stock: 0,
    items: [{ item_code: "Transportation", qty: 1, rate: Number(amount), description: `Transport charges for PO: ${poName}` }]
  };
  const res = await createDoc("Purchase Invoice", payload);
  if (!res.data?.name) throw new Error("Failed to create Transporter Invoice draft.");
  await submitDoc("Purchase Invoice", res.data.name);
  return res.data.name;
}


// ------------------------------------
// Large Analytics Like Our Tracker
// -------------------------------------

export async function getSuppliersByPurchaseOrderSpending({ from_date, to_date, topN = 10, includeOthers = true } = {}) {
  let start = 0;
  const filters = [["Purchase Order", "docstatus", "=", 1]];
  if (from_date) filters.push(["Purchase Order", "transaction_date", ">=", from_date]);
  if (to_date) filters.push(["Purchase Order", "transaction_date", "<=", to_date]);

  const map = new Map();
  while (true) {
    const list = await getDoctypeList("Purchase Order", {
      fields: JSON.stringify(["supplier", "supplier_name", "grand_total"]),
      filters: JSON.stringify(filters),
      limit_page_length: 1000, limit_start: start,
    });
    if (!list || !list.length) break;

    for (const po of list) {
      const label = String(po.supplier_name || po.supplier || "Unknown").trim();
      const prev = map.get(label) || { supplier: label, totalValue: 0, orderCount: 0 };
      prev.totalValue += Number(po.grand_total) || 0;
      prev.orderCount += 1;
      map.set(label, prev);
    }
    if (list.length < 1000) break;
    start += 1000;
  }

  const sorted = Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
  const n = Math.max(1, Number(topN) || 10);
  const top = sorted.slice(0, n);
  if (includeOthers && sorted.slice(n).length) {
    top.push(sorted.slice(n).reduce((acc, x) => {
      acc.totalValue += x.totalValue; acc.orderCount += x.orderCount; return acc;
    }, { supplier: "Others", totalValue: 0, orderCount: 0 }));
  }
  return { overallTotal: sorted.reduce((sum, x) => sum + x.totalValue, 0), suppliers: top };
}

// ------------------------------
// Purchase Order Summary
// ------------------------------


// ======= This Function to build analytics graph about POs ======== //
export async function getPurchaseOrderPipelineSummary({ 
  supplier,   
  from_date, 
  to_date,    
} = {}) {
  const pageSize = 1000;
  let start = 0;

  // Totals (exclude drafts: docstatus=0)
  let totalOrdersCount = 0;
  let totalOrdersValue = 0;

  // Differnet Buckets
  const buckets = [
    {
      key: "pending_everything", name: "Pending Everything", statuses: ["To Receive and Bill"],
      count: 0, value: 0, clientText: "We are waiting for both the goods and the invoice.",
    },
    {
      key: "waiting_goods", name: "Waiting for Goods", statuses: ["To Receive"],
      count: 0, value: 0, clientText: "We have the bill (Invoice), but the truck hasn't arrived.",
    },
    {
      key: "waiting_invoice", name: "Waiting for Invoice", statuses: ["To Bill"],
      count: 0, value: 0, clientText: "The goods are here, but the supplier hasn't billed us.",
    },
    {
      key: "delivered", name: "Delivered", statuses: ["Delivered"],
      count: 0, value: 0, clientText: "Goods are delivered.",
    },
    {
      key: "finished", name: "Finished", statuses: ["Completed", "Closed"],
      count: 0, value: 0, clientText: "This order is done and off our plate.",
    },
    {
      key: "cancelled", name: "Cancelled", statuses: ["Cancelled"],
      count: 0, value: 0, clientText: "This order has been cancelled.",
    },
    {
      key: "other", name: "Other", statuses: [], 
      count: 0, value: 0, clientText: "Any other status (ex: On Hold, etc.)",
    },
  ];

  const statusToBucketKey = new Map();
  buckets.forEach((b) => (b.statuses || []).forEach((s) => statusToBucketKey.set(s, b.key)));

  const filters = [["Purchase Order", "docstatus", "=", 1]];

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

  return { totalOrdersCount, totalOrdersValue, buckets };
}


// ------------------------------
// Purchase Register List 
// ------------------------------


// ======= This is function which helping us to making the purchase tracker ======== //
export async function getPurchaseRegisterList({
  supplier, po_from_date, po_to_date, goods_from_date, goods_to_date,
  mf_status, po_status, payment_status, transporter_q, item_q, invoice_q,
  min_value, max_value, includeUninvoiced = true, includeUnreceived = true, limit = 500,
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
        "name", "supplier", "supplier_name", "transaction_date", "status", "grand_total", "advance_paid",
        "custom_mf_status", "custom_mf_status_updated_on", "custom_goods_delivered_date", "custom_transporter",
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

  // --- Transporter Name Lookup -- //
  const transporterIds = [...new Set(poParents.map(p => p.custom_transporter).filter(Boolean))];
  const transporterMap = new Map();

  if (transporterIds.length > 0) {
    const tBatches = prChunk(transporterIds, 100);
    for (const batch of tBatches) {
      const tRows = await getDoctypeList("Supplier", {
        fields: JSON.stringify(["name", "supplier_name"]),
        filters: JSON.stringify([["name", "in", batch]]),
        limit_page_length: 1000
      });
      (tRows || []).forEach(t => transporterMap.set(t.name, t.supplier_name || t.name));
    }
  }

  // --- Lookup Transporter Invoices via 'custom_linked_po' //
  const transporterInvMap = new Map();
  
  if (poNames.length > 0) {
    const piBatches = prChunk(poNames, 100);
    for (const batch of piBatches) {
      const transPis = await getDoctypeList("Purchase Invoice", {
        fields: JSON.stringify(["name", "grand_total", "outstanding_amount", "custom_linked_po"]),
        filters: JSON.stringify([["custom_linked_po", "in", batch], ["docstatus", "=", 1]]),
        limit_page_length: 1000
      });
      (transPis || []).forEach(pi => transporterInvMap.set(pi.custom_linked_po, pi));
    }
  }

  // 2) Load PO Items
  const poItems = [];
  for (const part of prChunk(poNames, 100)) {
    const rows = await getDoctypeList("Purchase Order Item", {
      parent: "Purchase Order",
      fields: JSON.stringify(["name", "parent", "item_code", "item_name", "qty", "rate", "amount", "base_rate", "base_amount"]),
      filters: JSON.stringify([["Purchase Order Item", "parent", "in", part]]),
      limit_page_length: 10000,
    });
    poItems.push(...(rows || []));
  }
  
  // 3) PR Logic
  const prItems = [];
  for (const part of prChunk(poNames, 100)) {
    const rows = await getDoctypeList("Purchase Receipt Item", {
        parent: "Purchase Receipt",
        fields: JSON.stringify(["parent", "purchase_order", "purchase_order_item"]), 
        filters: JSON.stringify([["Purchase Receipt Item", "purchase_order", "in", part]]),
        limit_page_length: 10000,
    });
    
    (rows || []).forEach(r => {
        prItems.push({
            parent: r.parent,
            purchase_order: r.purchase_order,
            purchase_order_item: r.purchase_order_item 
        });
    });
  }

  const prNames = Array.from(new Set(prItems.map((x) => x.parent).filter(Boolean)));
  const prMetaByName = new Map();

  for (const part of prChunk(prNames, 100)) {
    const prs = await getDoctypeList("Purchase Receipt", {
      fields: JSON.stringify(["name", "posting_date", "docstatus"]),
      filters: JSON.stringify([["Purchase Receipt", "name", "in", part], ["Purchase Receipt", "docstatus", "=", 1]]),
      limit_page_length: 1000,
    });
    (prs || []).forEach((pr) => prMetaByName.set(pr.name, pr));
  }

  const prDetailsByPoItem = new Map();
  const prDetailsByPo = new Map();

  for (const it of prItems) {
    const prMeta = prMetaByName.get(it.parent);
    if (!prMeta) continue;
    const details = { date: prMeta.posting_date || "", name: prMeta.name };
    const poi = it.purchase_order_item;
    const po = it.purchase_order;
    if (poi) {
      const prev = prDetailsByPoItem.get(poi);
      if (!prev || details.date > prev.date) prDetailsByPoItem.set(poi, details);
    }
    if (po) {
      const prev2 = prDetailsByPo.get(po);
      if (!prev2 || details.date > prev2.date) prDetailsByPo.set(po, details);
    }
  }

  // 4) PI Mapping (Regular Supplier Invoice)
  const piItemLinks = [];
  for (const part of prChunk(poNames, 100)) {
    const rows = await getDoctypeList("Purchase Invoice Item", {
      parent: "Purchase Invoice",
      fields: JSON.stringify(["parent", "purchase_order", "po_detail"]), 
      filters: JSON.stringify([["Purchase Invoice Item", "purchase_order", "in", part]]),
      limit_page_length: 10000,
    });
    piItemLinks.push(...(rows || []));
  }

  const piNames = Array.from(new Set(piItemLinks.map((x) => x.parent).filter(Boolean)));
  const piMetaByName = new Map();
  for (const part of prChunk(piNames, 100)) {
    const pis = await getDoctypeList("Purchase Invoice", {
      fields: JSON.stringify(["name", "bill_no", "status", "grand_total", "outstanding_amount", "posting_date", "docstatus"]),
      filters: JSON.stringify([["Purchase Invoice", "name", "in", part], ["Purchase Invoice", "docstatus", "in", [0, 1]]]),
      limit_page_length: 1000,
    });
    (pis || []).forEach((pi) => piMetaByName.set(pi.name, pi));
  }

  const piByPoItem = new Map();
  const piByPo = new Map();
  
  for (const link of piItemLinks) {
      const piName = link.parent;
      const poName = link.purchase_order;
      const poiName = link.po_detail || link.purchase_order_item; 
      const meta = piMetaByName.get(piName);
      
      if (!meta) continue;
      
      if (poiName) {
          const curr = piByPoItem.get(poiName);
          const currMeta = curr ? piMetaByName.get(curr) : null;
          if (!curr || (meta.posting_date > (currMeta?.posting_date || ""))) {
              piByPoItem.set(poiName, piName);
          }
      }
      
      if (poName) {
          const curr = piByPo.get(poName);
          const currMeta = curr ? piMetaByName.get(curr) : null;
          if (!curr || (meta.posting_date > (currMeta?.posting_date || ""))) {
              piByPo.set(poName, piName);
          }
      }
  }

  // 5) Final Rows
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
    const mfDate = po.custom_mf_status_updated_on ? prDateOnly(po.custom_mf_status_updated_on) : "";

    const prDetails = prDetailsByPoItem.get(it.name) || prDetailsByPo.get(it.parent);
    const prDate = prDetails?.date || "";
    const prName = prDetails?.name || "";

    const goodsDeliveredDate = po.custom_goods_delivered_date ? prDateOnly(po.custom_goods_delivered_date) : "";

    const tId = po.custom_transporter;
    const transporterName = transporterMap.get(tId) || tId || "";

    const transpInv = transporterInvMap.get(po.name);
    const transpInvNo = transpInv ? transpInv.name : "";
    const transpAmt = transpInv ? (Number(transpInv.grand_total) || 0) : 0;
    const transpOutstanding = transpInv ? (Number(transpInv.outstanding_amount) || 0) : 0;
    const transpPaid = transpAmt - transpOutstanding;

    const piName = piByPoItem.get(it.name) || piByPo.get(it.parent) || "";
    const pi = piName ? piMetaByName.get(piName) : null;
    const invoiceDate = pi?.posting_date || "";
    const erpInvoiceNo = pi?.name || "";
    const supplierInvoiceNo = pi?.bill_no || "";
    const payStatus = String(pi?.status || (piName ? "Unknown" : "Not Invoiced")).trim();
    const outstanding = Number(pi?.outstanding_amount) || 0;
    const advancePaid = Number(po.advance_paid) || 0;

    const qty = Number(it.qty) || 0;
    const rate = Number(it.rate) || 0;
    const value = Number(it.base_amount) || Number(it.amount) || (qty * rate);

    if (!includeUnreceived && !goodsDeliveredDate) continue;
    if (!includeUninvoiced && !piName) continue;
    if (goods_from_date && goodsDeliveredDate < goods_from_date) continue;
    if (goods_to_date && goodsDeliveredDate > goods_to_date) continue;
    if (payment_status && pi) {
        if (String(pi.status || "").trim().toLowerCase() !== String(payment_status).trim().toLowerCase()) continue;
    }
    if (qTrans && !transporterName.toLowerCase().includes(qTrans)) continue;
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
      po_name: po.name, po_date: po.transaction_date || "", vendor_name: po.supplier_name || po.supplier || "",
      item_name: it.item_name || "", item_code: it.item_code || "", rate: rate, value: value,
      po_grand_total: Number(po.grand_total) || 0, po_status: po.status || "", mf_status: mf, mf_status_date: mfDate,
      goods_delivered_date: goodsDeliveredDate, goods_receipt_no: prName, pr_date: prDate,
      erp_invoice_no: erpInvoiceNo, invoice_date: invoiceDate, supplier_invoice_no: supplierInvoiceNo,
      payment_status: payStatus, advance_paid: advancePaid, outstanding_amount: outstanding,
      transporter_name: transporterName, transporter_invoice_no: transpInvNo, transporter_payment_paid: transpPaid, transporter_amount: transpAmt 
    });

    if (rowsOut.length >= Number(limit) && Number(limit) > 0) break;
  }

  const totalValue = rowsOut.reduce((sum, r) => sum + (Number(r.value) || 0), 0);

  return { totalRows: rowsOut.length, totalValue, rows: rowsOut };
}


// ----------------------------------------------------------------
// Supplier Detail Page Funtions
// ----------------------------------------------------------------


export async function getItemsBySupplier(supplierName) {
  const links = await getDoctypeList("Item Supplier", {
    parent: "Item", 
    fields: JSON.stringify(["parent", "supplier_part_no"]),
    filters: JSON.stringify([["supplier", "=", supplierName]]),
    limit_page_length: 500
  });

  if (!links || links.length === 0) return [];
  const itemCodes = [...new Set(links.map(l => l.parent))];

  let allItems = [];
  for (const batch of prChunk(itemCodes, 50)) {
    const items = await getDoctypeList("Item", {
      fields: JSON.stringify(["name", "item_name", "stock_uom", "image"]),
      filters: JSON.stringify([["name", "in", batch]]),
      limit_page_length: 50
    });
    allItems = [...allItems, ...items];
  }
  return allItems;
}

export async function getRecentPOsBySupplier(supplierName) {
  const pos = await getDoctypeList("Purchase Order", {
    fields: JSON.stringify(["name", "transaction_date", "grand_total", "status", "custom_mf_status"]),
    filters: JSON.stringify([["supplier", "=", supplierName]]),
    order_by: "transaction_date desc",
    limit_page_length: 5
  });

  if (!pos || pos.length === 0) return [];
  const poNames = pos.map(p => p.name);

  const items = await getDoctypeList("Purchase Order Item", {
    parent: "Purchase Order", 
    fields: JSON.stringify(["parent", "item_name", "item_code"]),
    filters: JSON.stringify([["parent", "in", poNames]]),
    limit_page_length: 500
  });

  const itemsMap = {};
  items.forEach(item => {
    if (!itemsMap[item.parent]) itemsMap[item.parent] = [];
    itemsMap[item.parent].push(item.item_name || item.item_code);
  });

  return pos.map(po => {
    const poItems = itemsMap[po.name] || [];
    let itemDisplay = "—";
    if (poItems.length > 0) {
      const distinct = [...new Set(poItems)]; 
      if (distinct.length <= 2) {
        itemDisplay = distinct.join(", ");
      } else {
        itemDisplay = `${distinct.slice(0, 2).join(", ")} +${distinct.length - 2} more`;
      }
    }
    return { ...po, _items_display: itemDisplay };
  });
}


// ----------------------------------------------------------------
// Item Analytics Functions
// ----------------------------------------------------------------


export async function getItemAnalyticsData(itemCode) {
  if (!itemCode) return null;

  const itemData = await getDoctypeList("Item", {
    fields: JSON.stringify(["name", "item_name", "stock_uom", "valuation_rate", "standard_rate", "image"]),
    filters: JSON.stringify([["name", "=", itemCode]]),
    limit_page_length: 1
  });

  if (!itemData || !itemData.length) return null;
  const item = itemData[0];

  const itemPrices = await getDoctypeList("Item Price", {
    fields: JSON.stringify(["price_list", "price_list_rate", "buying", "selling"]),
    filters: JSON.stringify([["item_code", "=", itemCode]]),
    limit_page_length: 100 
  });

  const purchaseChildren = await getDoctypeList("Purchase Receipt Item", {
    parent: "Purchase Receipt",
    fields: JSON.stringify(["parent", "qty", "rejected_qty", "rate", "amount", "received_qty"]),
    filters: JSON.stringify([["item_code", "=", itemCode], ["docstatus", "=", 1]]),
    order_by: "creation desc",
    limit_page_length: 5000 
  });

  let purchaseHistory = [];
  if (purchaseChildren.length) {
    const pNames = [...new Set(purchaseChildren.map(x => x.parent))];
    const pDocs = await getDoctypeList("Purchase Receipt", {
      fields: JSON.stringify(["name", "posting_date", "supplier"]),
      filters: JSON.stringify([["name", "in", pNames]]),
      limit_page_length: pNames.length
    });
    const pMap = new Map(pDocs.map(d => [d.name, d]));

    purchaseHistory = purchaseChildren.map(child => {
      const parent = pMap.get(child.parent);
      return { ...child, posting_date: parent?.posting_date || "", supplier: parent?.supplier || "Unknown" };
    }).sort((a, b) => (a.posting_date < b.posting_date ? 1 : -1));
  }

  const salesChildren = await getDoctypeList("Sales Invoice Item", {
    parent: "Sales Invoice",
    fields: JSON.stringify(["parent", "qty", "rate", "amount"]),
    filters: JSON.stringify([["item_code", "=", itemCode], ["docstatus", "=", 1]]),
    order_by: "creation desc",
    limit_page_length: 5000 
  });

  let salesHistory = [];
  if (salesChildren.length) {
    const sNames = [...new Set(salesChildren.map(x => x.parent))];
    const sDocs = await getDoctypeList("Sales Invoice", {
      fields: JSON.stringify(["name", "posting_date", "customer"]),
      filters: JSON.stringify([["name", "in", sNames]]),
      limit_page_length: sNames.length
    });
    const sMap = new Map(sDocs.map(d => [d.name, d]));

    salesHistory = salesChildren.map(child => {
      const parent = sMap.get(child.parent);
      return { ...child, posting_date: parent?.posting_date || "", customer: parent?.customer || "Unknown" };
    }).sort((a, b) => (a.posting_date < b.posting_date ? 1 : -1));
  }

  return { item, itemPrices, purchaseHistory, salesHistory };
}


// ----------------------------------------------------------------
// Supplier Tracker Functions
// ----------------------------------------------------------------


export async function getSupplierTrackerData(supplierName) {
  if (!supplierName) return null;

  const supplierData = await getDoctypeList("Supplier", {
    fields: JSON.stringify(["name", "supplier_name", "supplier_group", "mobile_no", "email_id", "pan", "gstin"]),
    filters: JSON.stringify([["name", "=", supplierName]]),
    limit_page_length: 1
  });
  const supplier = supplierData[0];

  const orders = await getDoctypeList("Purchase Order", {
    fields: JSON.stringify(["name", "grand_total", "status", "transaction_date", "per_received"]),
    filters: JSON.stringify([["supplier", "=", supplierName], ["docstatus", "=", 1]]),
    order_by: "transaction_date desc", 
    limit_page_length: 1000
  });

  const receipts = await getDoctypeList("Purchase Receipt", {
    fields: JSON.stringify(["name", "posting_date", "per_billed", "status"]),
    filters: JSON.stringify([["supplier", "=", supplierName], ["docstatus", "=", 1]]),
    order_by: "posting_date desc", 
    limit_page_length: 1000
  });

  const receiptItems = await getDoctypeList("Purchase Receipt Item", {
    parent: "Purchase Receipt",
    fields: JSON.stringify(["qty", "rejected_qty", "item_code", "item_name", "amount", "parent", "stock_uom", "rate"]),
    filters: JSON.stringify([["docstatus", "=", 1]]),
    limit_page_length: 5000
  });

  const supplierReceiptNames = new Set(receipts.map(r => r.name));
  const validReceiptItems = receiptItems.filter(ri => supplierReceiptNames.has(ri.parent));

  const invoices = await getDoctypeList("Purchase Invoice", {
    fields: JSON.stringify(["name", "grand_total", "outstanding_amount", "posting_date", "due_date", "status"]),
    filters: JSON.stringify([["supplier", "=", supplierName], ["docstatus", "=", 1]]),
    limit_page_length: 1000
  });

  const approvedLinks = await getDoctypeList("Item Supplier", {
    parent: "Item", 
    fields: JSON.stringify(["parent"]), 
    filters: JSON.stringify([["supplier", "=", supplierName]]),
    limit_page_length: 1000
  });

  let approvedItems = [];
  if (approvedLinks.length > 0) {
    const itemCodes = [...new Set(approvedLinks.map(l => l.parent))];
    const itemDetails = await getDoctypeList("Item", {
      fields: JSON.stringify(["name", "item_name"]),
      filters: JSON.stringify([["name", "in", itemCodes]]),
      limit_page_length: itemCodes.length
    });

    const nameMap = new Map();
    itemDetails.forEach(i => nameMap.set(i.name, i.item_name));
    approvedItems = approvedLinks.map(l => ({ item_code: l.parent, item_name: nameMap.get(l.parent) || l.parent }));
  }

  const itemMap = {};
  validReceiptItems.forEach(item => {
    if (!itemMap[item.item_code]) {
      itemMap[item.item_code] = {
        code: item.item_code, name: item.item_name || item.item_code, uom: item.stock_uom,
        totalQty: 0, totalRejected: 0, totalValue: 0, rates: [], lastRate: 0, lastDate: "" 
      };
    }
    const entry = itemMap[item.item_code];
    entry.totalQty += (item.qty + item.rejected_qty);
    entry.totalRejected += item.rejected_qty;
    entry.totalValue += item.amount;
    if (item.rate > 0) entry.rates.push(item.rate);

    const rDate = receipts.find(r => r.name === item.parent)?.posting_date || "";
    if (rDate >= entry.lastDate) {
      entry.lastDate = rDate;
      entry.lastRate = item.rate;
    }
  });

  const supplyHistory = Object.values(itemMap).map(i => {
    const avgRate = i.rates.length ? i.rates.reduce((a, b) => a + b, 0) / i.rates.length : 0;
    const qualityPct = i.totalQty > 0 ? ((i.totalQty - i.totalRejected) / i.totalQty) * 100 : 100;
    return { ...i, avgRate, qualityPct };
  }).sort((a, b) => b.totalValue - a.totalValue);

  return { supplier, orders, receipts, invoices, validReceiptItems, approvedItems, supplyHistory };
}


// ----------------------------------------------------------------
// CIty Logistic Function (Where we match the city of Transporter and Supplier)
// ----------------------------------------------------------------


export async function getLogisticsByCity(fullCityStateString) {
  if (!fullCityStateString) return { suppliers: [], transporters: [] };

  const cityKey = fullCityStateString.split(",")[0].trim();

  try {
    const matchedRows = await getDoctypeList("Transporter Service Area", {
      parent: "Supplier",
      fields: JSON.stringify(["parent"]),
      filters: JSON.stringify([["city", "like", `%${cityKey}%`]]),
      limit_page_length: 100
    });

    const transporterIds = [...new Set(matchedRows.map(r => r.parent))];
    let transporters = [];
    
    if (transporterIds.length > 0) {
      const tList = await getDoctypeList("Supplier", {
        fields: JSON.stringify(["name", "supplier_name", "custom_contact_person", "mobile_no", "custom_vehicle_type"]),
        filters: JSON.stringify([["name", "in", transporterIds]]),
        limit_page_length: 100
      });

      const serviceMap = await fetchTransporterServiceAreas(transporterIds);
      transporters = tList.map(t => ({ ...t, custom_service_areas: serviceMap[t.name] || [] }));
    }

    const addresses = await getDoctypeList("Address", {
      fields: JSON.stringify(["name", "address_line1", "city", "state", "phone", "email_id"]),
      filters: JSON.stringify([["city", "like", `%${cityKey}%`]]),
      limit_page_length: 100
    });

    let suppliers = [];
    if (addresses.length > 0) {
      const addressIds = addresses.map(a => a.name);
      const links = await getDoctypeList("Dynamic Link", {
        parent: "Address",
        fields: JSON.stringify(["link_name", "parent"]),
        filters: JSON.stringify([["link_doctype", "=", "Supplier"], ["parent", "in", addressIds]]),
        limit_page_length: 100
      });

      const supplierAddressMap = {};
      const validSupplierNames = [];

      links.forEach(link => {
        const addr = addresses.find(a => a.name === link.parent);
        if (addr) {
          supplierAddressMap[link.link_name] = addr;
          validSupplierNames.push(link.link_name);
        }
      });

      if (validSupplierNames.length > 0) {
        suppliers = await getDoctypeList("Supplier", {
          fields: JSON.stringify(["name", "supplier_name", "supplier_group", "custom_contact_person", "mobile_no"]),
          filters: JSON.stringify([["name", "in", validSupplierNames], ["supplier_group", "!=", "Transporter"]]),
          limit_page_length: 100
        });
        suppliers = suppliers.map(s => ({ ...s, _address: supplierAddressMap[s.name] }));
      }
    }

    return { suppliers, transporters };

  } catch (err) {
    console.error("Error fetching logistics:", err);
    return { suppliers: [], transporters: [] };
  }
}