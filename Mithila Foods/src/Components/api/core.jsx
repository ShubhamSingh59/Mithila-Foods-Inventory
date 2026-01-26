import axios from "axios";

// 1. Centralize Configuration
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

// 2. Create Axios Instance
export const api = axios.create({
  baseURL: BACKEND_URL,
});

// 3. Stock Event Bus (Triggers refresh when stock moves)
const STOCK_AFFECTING_DOCTYPES = new Set([
  "Stock Reconciliation", "Stock Entry", "Purchase Receipt", 
  "Delivery Note", "Sales Invoice", "Purchase Invoice"
]);
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

// 4. Generic CRUD Helpers

// Get List
export async function getDoctypeList(doctype, params = {}) {
  const res = await api.get(`/api/doctype/${doctype}`, { params });
  return res.data.data;
}

// Get Single Doc
export async function getDoc(doctype, name) {
  const res = await api.get(`/api/doc/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`);
  return res.data.data;
}

// Create
export async function createDoc(doctype, payload) {
  const res = await api.post(`/api/doctype/${doctype}`, payload);
  return res.data;
}

// Update
export async function updateDoc(doctype, name, payload) {
  const res = await api.put(
    `/api/doc/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
    payload
  );
  return res.data;
}

// Submit (and trigger stock refresh if needed)
export async function submitDoc(doctype, name) {
  const res = await api.post(`/api/submit`, { doctype, name });
  if (STOCK_AFFECTING_DOCTYPES.has(doctype)) {
    emitStockChanged();
  }
  return res.data;
}

// Cancel
export async function cancelDoc(doctype, name) {
  const res = await api.post(`/api/cancel_doc`, { doctype, name });
  return res.data;
}

// Delete
export async function deleteDoc(doctype, name) {
  const res = await api.post(`/api/method/frappe.client.delete`, { doctype, name });
  return res.data;
}

// Upload File
export async function uploadFileToDoc({ doctype, docname, file, is_private = 1 }) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("doctype", doctype);
  fd.append("docname", docname);
  fd.append("is_private", String(is_private));
  fd.append("file_name", file.name);

  const res = await api.post(`/api/upload`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

// Run Report
export async function runReport(report_name, filters = {}) {
  const res = await api.post(`/api/report/run`, { report_name, filters });
  return res.data;
}

// Utility: Concurrency Limiter
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