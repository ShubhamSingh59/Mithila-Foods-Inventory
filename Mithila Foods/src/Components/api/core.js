// src/api/core.jsx
import axios from "axios";

// ------------------------------
// Base config and shared constants
// ------------------------------



// ======= This is the line which connects our frontend with the backend ========//
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";


// ------------------------------
// Stock change event bus
// ------------------------------



// ======= This list of doctype chnage the stock value in ERP. This will help us to update the stock summary list. ========//
const STOCK_AFFECTING_DOCTYPES = new Set([
  "Stock Reconciliation",
  "Stock Entry",
  "Purchase Receipt",
  "Delivery Note",
  "Sales Invoice",
  "Purchase Invoice",
]);

// ==== In this part of the code. We try to litsen the chnages which coudl effect the values in the other comopenet ========//
const stockListeners = new Set();

export function onStockChanged(fn) {
  stockListeners.add(fn);
  return () => stockListeners.delete(fn);
}

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
// Generic helpers (CRUD + submit)
// ------------------------------


// ===== Get all the docs like all the PO. But in the params we can specify what kind of the doc we want ========//
export async function getDoctypeList(doctype, params = {}) {
  const res = await axios.get(`${BACKEND_URL}/api/doctype/${doctype}`, {
    params,
  });
  return res.data.data;
}

// ======= This is to get a specific doc ========//
export async function getDoc(doctype, name) {
  const res = await axios.get(
    `${BACKEND_URL}/api/doc/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`
  );
  return res.data.data;
}

// ======= This is to create a doc ========//
export async function createDoc(doctype, payload) {
  const res = await axios.post(`${BACKEND_URL}/api/doctype/${doctype}`, payload);
  return res.data;
}

// ======= This is to update a doc ========//
export async function updateDoc(doctype, name, payload) {
  const res = await axios.put(
    `${BACKEND_URL}/api/doc/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
    payload
  );
  return res.data;
}

// ======= To submit the doc like submiting the PO after confirmation ========//
export async function submitDoc(doctype, name) {
  const res = await axios.post(`${BACKEND_URL}/api/submit`, { doctype, name });

  if (STOCK_AFFECTING_DOCTYPES.has(doctype)) {
    emitStockChanged();
  }

  // WE need the condition because in PO we are also tracking down a custom status.
  if (doctype === "Purchase Order") {
    try {
      // Dynamic import to avoid circular dependency. This function helps to set that custom status
      const { setPurchaseOrderMfStatus } = await import("./purchase.js");
      await setPurchaseOrderMfStatus(name, "PO Confirmed");
    } catch (e) {
      console.error("MF status update failed:", e);
    }
  }

  return res.data;
}



// ------------------------------
// Utilities
// ------------------------------



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
  return String(f.options).split("\n").map((o) => o.trim()).filter(Boolean);
}