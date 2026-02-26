// src/api/stock.js
// These api hanlde all the taks related to our stocks
import { getDoctypeList, getDoc, mapLimit } from "./core.js";

// ------------------------------
// Stock Levels & Ledger
// ------------------------------


export async function getBinForItemWarehouse(itemCode, warehouse) {
  const rows = await getDoctypeList("Bin", {
    fields: JSON.stringify(["item_code", "warehouse", "actual_qty", "valuation_rate", "stock_value"]),
    filters: JSON.stringify([["Bin", "item_code", "=", itemCode], ["Bin", "warehouse", "=", warehouse]]),
    limit_page_length: 1,
  });
  return rows[0] || null;
}

export async function getStockLedgerUpToDate(date) {
  return getDoctypeList("Stock Ledger Entry", {
    fields: JSON.stringify([
      "name", "item_code", "warehouse", "posting_date", "posting_time",
      "actual_qty", "qty_after_transaction", "voucher_type", "voucher_no"
    ]),
    filters: JSON.stringify([["Stock Ledger Entry", "posting_date", "<=", date]]),
    order_by: "posting_date asc, posting_time asc, creation asc",
    limit_page_length: 10000,
  });
}


// ------------------------------
// Rates & Valuation
// ------------------------------


export async function getPriceLists() {
  return getDoctypeList("Price List", {
    fields: JSON.stringify(["name", "price_list_name", "buying", "selling"]),
    filters: JSON.stringify([["Price List", "enabled", "=", 1]]),
    limit_page_length: 100,
  });
}

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
    filters: JSON.stringify([["Bin", "item_code", "=", itemCode], ["Bin", "warehouse", "=", warehouse]]),
    limit_page_length: 1,
  });
  return rows[0] || null;
}

export async function getItemRateFromPriceList(itemCode, priceList) {
  const rows = await getDoctypeList("Item Price", {
    fields: JSON.stringify(["price_list_rate", "currency"]),
    filters: JSON.stringify([["Item Price", "item_code", "=", itemCode], ["Item Price", "price_list", "=", priceList]]),
    limit_page_length: 1,
  });
  return rows[0] || null;
}

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
// Stock Reconciliation
// ------------------------------


export async function getStockReconciliationEntries({ from_date, to_date, includeDrafts = true, limit = 500 } = {}) {
  const filters = [];
  if (from_date) filters.push(["Stock Reconciliation", "posting_date", ">=", from_date]);
  if (to_date) filters.push(["Stock Reconciliation", "posting_date", "<=", to_date]);
  filters.push(["Stock Reconciliation", "purpose", "=", "Stock Reconciliation"]);
  filters.push(["Stock Reconciliation", "docstatus", includeDrafts ? "in" : "=", includeDrafts ? [0, 1] : 1]);

  return getDoctypeList("Stock Reconciliation", {
    fields: JSON.stringify(["name", "posting_date", "posting_time", "company", "purpose", "docstatus", "modified"]),
    filters: JSON.stringify(filters),
    order_by: "posting_date desc, posting_time desc, modified desc",
    limit_page_length: limit,
  });
}

export async function getStockReconciliationItemsForParents(parentNames = []) {
  if (!parentNames.length) return [];
  const chunk = (arr, size = 100) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const all = [];
  for (const part of chunk(parentNames, 100)) {
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

export async function getStockReconciliationEntriesWithSummary(opts = {}) {
  const parents = await getStockReconciliationEntries(opts);
  const parentNames = (parents || []).map((p) => p.name).filter(Boolean);
  if (!parentNames.length) return [];

  let childRows = [];
  try {
    childRows = await getStockReconciliationItemsForParents(parentNames);
  } catch (e) {
    console.error("Child list failed, fallback to getDoc per parent", e);
    const docs = await mapLimit(parents, 6, async (p) => getDoc("Stock Reconciliation", p.name));
    docs.forEach((doc) => {
      (doc.items || []).forEach((it) => {
        childRows.push({ parent: doc.name, item_code: it.item_code, warehouse: it.warehouse, qty: it.qty, current_qty: it.current_qty });
      });
    });
  }

  const itemCodes = Array.from(new Set(childRows.map((x) => x.item_code).filter(Boolean)));
  const itemNameMap = new Map();
  if (itemCodes.length) {
    const items = await getDoctypeList("Item", {
      fields: JSON.stringify(["name", "item_name"]),
      filters: JSON.stringify([["Item", "name", "in", itemCodes]]),
      limit_page_length: 1000,
    });
    (items || []).forEach((it) => itemNameMap.set(it.name, it.item_name || it.name));
  }

  const summarize = (arr) => {
    const uniq = Array.from(new Set(arr.filter(Boolean)));
    if (!uniq.length) return "—";
    if (uniq.length === 1) return uniq[0];
    return `${uniq[0]} +${uniq.length - 1}`;
  };

  const byParent = new Map();
  childRows.forEach((r) => {
    if (!byParent.has(r.parent)) byParent.set(r.parent, []);
    byParent.get(r.parent).push(r);
  });

  return (parents || []).map((p) => {
    const lines = byParent.get(p.name) || [];
    const itemNames = lines.map((l) => itemNameMap.get(l.item_code) || l.item_code);
    const warehouses = lines.map((l) => l.warehouse);
    const qtyChange = lines.reduce((sum, l) => sum + ((Number(l.qty) || 0) - (Number(l.current_qty) || 0)), 0);

    return {
      ...p,
      _itemsCount: lines.length,
      _itemDisplay: summarize(itemNames),
      _warehouseDisplay: summarize(warehouses),
      _qtyChange: qtyChange,
    };
  });
}