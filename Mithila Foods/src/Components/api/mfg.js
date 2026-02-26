// src/api/mfg.js
// This hanlde the whole process of Manufecturing
import axios from "axios";
import { BACKEND_URL, getDoctypeList, getDoc, createDoc, submitDoc, updateDoc } from "./core.js";

// --------------
// BOM
// -----------


export async function getBoms() {
  return getDoctypeList("BOM", {
    fields: JSON.stringify(["name", "item", "quantity", "company", "is_active", "is_default", "raw_material_cost", "total_cost"]),
    limit_page_length: 500,
  });
}

export async function getBomItems(bomName) {
  return getDoctypeList("BOM Item", {
    fields: JSON.stringify(["item_code", "item_name", "uom", "qty"]),
    filters: JSON.stringify([["BOM Item", "parent", "=", bomName]]),
    limit_page_length: 1000,
  });
}

export async function getBomDocWithItems(name) {
  const res = await axios.get(`${BACKEND_URL}/api/doc/BOM/${encodeURIComponent(name)}`);
  return res.data.data;
}

export async function createBOM(payload) {
  return createDoc("BOM", payload);
}

export async function updateBOM(name, payload) {
  return updateDoc("BOM", name, payload);
}


// ------------------------------
// Work Orders
// ------------------------------


export async function getRecentWorkOrders(limit = 20) {
  return getDoctypeList("Work Order", {
    fields: JSON.stringify(["name", "production_item", "qty", "produced_qty", "status", "docstatus", "bom_no", "company", "modified"]),
    order_by: "modified desc",
    limit_page_length: limit,
  });
}

export async function createAndSubmitWorkOrder(payload) {
  const created = await createDoc("Work Order", payload);
  if (!created?.data?.name) throw new Error("Work Order not created (missing name).");
  await submitDoc("Work Order", created.data.name);
  return created.data.name;
}

export async function setWorkOrderStatus(workOrderName, status) {
  try {
    const res = await axios.post(
      `${BACKEND_URL}/api/method/erpnext.manufacturing.doctype.work_order.work_order.update_status`,
      { status, name: workOrderName }
    );
    return res.data;
  } catch (err) {
    const res2 = await axios.post(`${BACKEND_URL}/api/method/frappe.client.set_value`, {
      doctype: "Work Order", name: workOrderName, fieldname: "status", value: status,
    });
    return res2.data;
  }
}


// ------------------------------
// MF Workflow Tracking 
// ------------------------------


export async function createAndSubmitStockEntry(payload) {
  const created = await createDoc("Stock Entry", payload);
  if (!created?.data?.name) throw new Error("Stock Entry not created (missing name).");
  await submitDoc("Stock Entry", created.data.name);
  return created.data.name;
}

export async function listMfFlowStockEntries({ flowTag, limit = 300 } = {}) {
  if (!flowTag) return [];
  return getDoctypeList("Stock Entry", {
    fields: JSON.stringify(["name", "stock_entry_type", "purpose", "posting_date", "posting_time", "company", "remarks", "docstatus", "modified", "custom_mf_track"]),
    filters: JSON.stringify([["Stock Entry", "custom_mf_track", "=", 1], ["Stock Entry", "remarks", "like", `%${flowTag}%`]]),
    order_by: "posting_date desc, posting_time desc, modified desc",
    limit_page_length: limit,
  });
}

export async function listMfFlowManufactureEntries({ flowTag, limit = 300 } = {}) {
  const all = await listMfFlowStockEntries({ flowTag, limit });
  return (all || []).filter((x) => x.docstatus === 1 && x.stock_entry_type === "Manufacture");
}

export async function getMfFlowSleForWarehouse({ voucherNos = [], warehouse }) {
  if (!voucherNos.length || !warehouse) return [];
  const chunk = (arr, size = 150) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
  
  const all = [];
  for (const part of chunk(voucherNos, 150)) {
    const rows = await getDoctypeList("Stock Ledger Entry", {
      fields: JSON.stringify(["item_code", "warehouse", "actual_qty", "voucher_no", "posting_date", "posting_time"]),
      filters: JSON.stringify([["Stock Ledger Entry", "voucher_type", "=", "Stock Entry"], ["Stock Ledger Entry", "warehouse", "=", warehouse], ["Stock Ledger Entry", "voucher_no", "in", part]]),
      order_by: "posting_date asc, posting_time asc, creation asc",
      limit_page_length: 10000,
    });
    all.push(...(rows || []));
  }
  return all;
}

export async function getMfFlowWipBalances({ flowTag, wipWarehouse }) {
  if (!flowTag || !wipWarehouse) return [];
  const ses = await listMfFlowStockEntries({ flowTag, limit: 500 });
  const voucherNos = (ses || []).map((x) => x.name).filter(Boolean);
  if (!voucherNos.length) return [];

  const sle = await getMfFlowSleForWarehouse({ voucherNos, warehouse: wipWarehouse });
  const map = new Map();
  (sle || []).forEach((r) => {
    map.set(r.item_code, (map.get(r.item_code) || 0) + (Number(r.actual_qty) || 0));
  });

  return Array.from(map.entries())
    .map(([item_code, remaining_qty]) => ({ item_code, remaining_qty }))
    .filter((x) => x.remaining_qty > 0.0000001)
    .sort((a, b) => a.item_code.localeCompare(b.item_code));
}