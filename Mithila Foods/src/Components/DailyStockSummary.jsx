////////// src/Components/DailyStockSummary.jsx
////////import React, { useEffect, useState, useCallback, useMemo } from "react";
////////import { getStockLedgerUpToDate, getDoctypeList, getDoc } from "./erpBackendApi";
////////import "../CSS/DailyStockSummary.css";

/////////**
//////// * ✅ UPDATED DEFINITIONS
//////// *
//////// * Parent warehouse:
//////// *  - Opening Stock  = SUM of stock in ALL child warehouses under "Jharkahand Warehouse - MF" at start of day
//////// *  - Current Stock  = SUM of stock in ALL child warehouses under "Jharkahand Warehouse - MF" at end of selected day
//////// *
//////// * Columns:
//////// *  - Packing Activity = stock change in Finished Goods warehouse ONLY from:
//////// *      (1) Manufacturing Stock Entries
//////// *      (2) Stock Transfer Stock Entries
//////// *  - Stock Inward     = stock change in Raw Material warehouse by any non-reconciliation movement (includes stock transfers)
//////// *  - Wastage          = stock change in Wastage warehouse by any non-reconciliation movement (includes stock transfers)
//////// *  - Sold Qty         = stock change in Finished Goods due to Sales Invoice (customer filter)
//////// *  - Return Qty       = Good -> return into Finished Goods (Sales Invoice stock-in)
//////// *                     = Bad  -> return into Damaged (Sales Invoice stock-in)
//////// *  - Reconciliation   = delta from Stock Reconciliation (any Jharkahand child warehouse)
//////// *  - Other Activity   = Transit -> movement in Goods In Transit
//////// *                     = In Use  -> movement in Work In Progress
//////// *                     = Rejected Material -> movement in Rejected Warehouse
//////// */

////////const ROOT_WAREHOUSE = "Jharkahand Warehouse - MF";

////////const WH_STOCK_INWARD = "Raw Material - MF";
////////const WH_PACKING = "Finished Goods - MF";
////////const WH_WASTAGE = "Wastage - MF";
////////const WH_TRANSIT = "Goods In Transit - MF";
////////const WH_IN_USE = "Work In Progress - MF";
////////const WH_DAMAGED = "Damaged - MF";
////////const WH_REJECTED = "Rejected Warehouse - MF";

////////const RETURN_TYPES = {
////////  ALL: "ALL",
////////  GOOD: "GOOD",
////////  BAD: "BAD",
////////};

////////const OTHER_ACTIVITY_TYPES = {
////////  ALL: "ALL",
////////  TRANSIT: "TRANSIT",
////////  IN_USE: "IN_USE",
////////  REJECTED: "REJECTED",
////////};

////////// Columns order exactly like your screenshot
////////const COLUMNS = [
////////  { key: "opening_stock", label: "Opening Stock (TOTAL)", noDot: true },
////////  { key: "adjustment_qty", label: "Reconciliation" },
////////  { key: "sold_qty", label: "Sold Qty", headerFilter: "customer" },
////////  { key: "return_qty", label: "Return Qty", headerFilter: "returnType" },
////////  { key: "other_activity", label: "Other Activity", headerFilter: "otherActivity" },
////////  { key: "current_stock", label: "Current Stock (TOTAL)", noDot: true },
////////  { key: "packing_activity", label: "Paking Activity" },
////////  { key: "stock_inward", label: "Stock Inward" },
////////  { key: "wastage", label: "Wastage" },
////////];

////////function chunkArray(arr, size) {
////////  const out = [];
////////  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
////////  return out;
////////}

////////function DailyStockSummary() {
////////  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
////////  const [rows, setRows] = useState([]);
////////  const [expandedGroups, setExpandedGroups] = useState({});
////////  const [loading, setLoading] = useState(false);
////////  const [error, setError] = useState("");

////////  const [searchTerm, setSearchTerm] = useState("");

////////  // Row filter by Item Group
////////  const [itemGroups, setItemGroups] = useState([]);
////////  const [selectedItemGroup, setSelectedItemGroup] = useState("ALL");

////////  // Column filter (show Item + ONE selected column)
////////  const [columnFilter, setColumnFilter] = useState("ALL");

////////  // Sold filter (customer dropdown in header)
////////  const [customers, setCustomers] = useState([]);
////////  const [selectedCustomer, setSelectedCustomer] = useState("ALL");

////////  // Return filter (Good/Bad dropdown in header)
////////  const [selectedReturnType, setSelectedReturnType] = useState(RETURN_TYPES.ALL);

////////  // Other activity dropdown in header (All default)
////////  const [selectedOtherActivityType, setSelectedOtherActivityType] = useState(
////////    OTHER_ACTIVITY_TYPES.ALL
////////  );

////////  function makeTs(entry) {
////////    return `${entry.posting_date} ${entry.posting_time || "00:00:00"}`;
////////  }

////////  // remove "Raw" ONLY from beginning + remove Pouch/Sticker words
////////  // ✅ keep "Pouch" and "Sticker" in headings (do NOT remove them)
////////  function cleanLabel(s) {
////////    let x = String(s || "");
////////    x = x.replace(/^\s*raw\s+/i, "");   // remove ONLY leading "Raw "
////////    x = x.replace(/\s+/g, " ").trim();  // normalize spaces
////////    return x;
////////  }


////////  function extractWeight(s) {
////////    const str = String(s || "");
////////    const m1 = str.match(/\(([^)]+)\)/);
////////    if (m1 && m1[1]) return m1[1].trim();

////////    const m2 = str.match(/\b\d+(\.\d+)?\s*(kg|g|gm|grams|ml|l)\b/i);
////////    if (m2) return m2[0].trim();

////////    return "";
////////  }

////////  function baseHeadingLabel(nameOrCode) {
////////    // ✅ For "non-BOM items" heading: remove bracket part + remove weight tokens
////////    let s = cleanLabel(nameOrCode);
////////    s = s.replace(/\([^)]*\)/g, " "); // remove "(...)"
////////    s = s.replace(/\b\d+(\.\d+)?\s*(kg|g|gm|grams|ml|l)\b/gi, " ");
////////    s = s.replace(/\s+/g, " ").trim();
////////    return s || String(nameOrCode || "");
////////  }

////////  function parseWeightToGrams(weightStr) {
////////    const w = String(weightStr || "").trim().toLowerCase();
////////    const m = w.match(/(\d+(\.\d+)?)\s*(kg|g|gm|grams|ml|l)\b/);
////////    if (!m) return Number.POSITIVE_INFINITY;
////////    const num = parseFloat(m[1]);
////////    const unit = m[3];
////////    if (!isFinite(num)) return Number.POSITIVE_INFINITY;

////////    // Treat ml as g and l as kg (good enough for sorting)
////////    if (unit === "kg" || unit === "l") return num * 1000;
////////    return num; // g/gm/grams/ml
////////  }

////////  // ✅ Dots: green if value>0, red if value<0. Show ABS(value). No +/-.
////////  const DotCell = ({ value }) => {
////////    const n = Number(value || 0);
////////    if (n === 0) return <span>0</span>;

////////    return (
////////      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
////////        <span
////////          style={{
////////            width: 8,
////////            height: 8,
////////            borderRadius: 999,
////////            background: n > 0 ? "#16a34a" : "#dc2626",
////////            flex: "0 0 auto",
////////          }}
////////        />
////////        {Math.abs(n)}
////////      </span>
////////    );
////////  };

////////  // --------- value getters (respect dropdowns) ----------
////////  const getSoldValue = (r) => {
////////    if (selectedCustomer === "ALL") return Number(r.sold_qty || 0);
////////    return Number(r.sold_by_customer?.[selectedCustomer] || 0);
////////  };

////////  const getReturnValue = (r) => {
////////    const good = Number(r.return_good_qty || 0);
////////    const bad = Number(r.return_bad_qty || 0);
////////    if (selectedReturnType === RETURN_TYPES.GOOD) return good;
////////    if (selectedReturnType === RETURN_TYPES.BAD) return bad;
////////    return good + bad;
////////  };

////////  const getOtherActivityValue = (r) => {
////////    const t = Number(r.other_activity_transit || 0);
////////    const u = Number(r.other_activity_in_use || 0);
////////    const rej = Number(r.other_activity_rejected || 0);

////////    if (selectedOtherActivityType === OTHER_ACTIVITY_TYPES.TRANSIT) return t;
////////    if (selectedOtherActivityType === OTHER_ACTIVITY_TYPES.IN_USE) return u;
////////    if (selectedOtherActivityType === OTHER_ACTIVITY_TYPES.REJECTED) return rej;

////////    return t + u + rej;
////////  };

////////  const getCellValue = (r, key) => {
////////    if (key === "sold_qty") return getSoldValue(r);
////////    if (key === "return_qty") return getReturnValue(r);
////////    if (key === "other_activity") return getOtherActivityValue(r);
////////    return Number(r[key] || 0);
////////  };

////////  async function fetchItemsByCodes(itemCodes) {
////////    const unique = Array.from(new Set(itemCodes)).filter(Boolean);
////////    if (unique.length === 0) return [];

////////    // Chunk to avoid "too long" filter payloads
////////    const chunks = chunkArray(unique, 400);
////////    const out = [];

////////    for (const part of chunks) {
////////      const rows = await getDoctypeList("Item", {
////////        fields: JSON.stringify(["name", "item_name", "item_group"]),
////////        filters: JSON.stringify([["Item", "name", "in", part]]),
////////        limit_page_length: part.length,
////////      });
////////      out.push(...(rows || []));
////////    }

////////    return out;
////////  }

////////  // --------- load data ----------
////////  const loadData = useCallback(async (selectedDate) => {
////////    setLoading(true);
////////    setError("");
////////    setRows([]);
////////    setExpandedGroups({});

////////    try {
////////      const [
////////        sleToSelected,
////////        reconDocs,
////////        bomList,
////////        siList,
////////        whList,
////////        seList,
////////      ] = await Promise.all([
////////        getStockLedgerUpToDate(selectedDate),

////////        getDoctypeList("Stock Reconciliation", {
////////          fields: JSON.stringify(["name", "posting_date", "docstatus"]),
////////          filters: JSON.stringify([
////////            ["Stock Reconciliation", "posting_date", "=", selectedDate],
////////            ["Stock Reconciliation", "docstatus", "=", 1],
////////          ]),
////////          limit_page_length: 500,
////////        }),

////////        getDoctypeList("BOM", {
////////          fields: JSON.stringify(["name", "item", "is_active", "docstatus"]),
////////          filters: JSON.stringify([
////////            ["BOM", "docstatus", "=", 1],
////////            ["BOM", "is_active", "=", 1],
////////          ]),
////////          limit_page_length: 1000,
////////        }),

////////        // Sales Invoice list for voucher_no -> customer (includes returns too)
////////        getDoctypeList("Sales Invoice", {
////////          fields: JSON.stringify(["name", "customer", "posting_date", "docstatus"]),
////////          filters: JSON.stringify([
////////            ["Sales Invoice", "posting_date", "=", selectedDate],
////////            ["Sales Invoice", "docstatus", "=", 1],
////////          ]),
////////          limit_page_length: 20000,
////////        }),

////////        // Warehouse tree (need parent_warehouse)
////////        getDoctypeList("Warehouse", {
////////          fields: JSON.stringify(["name", "parent_warehouse", "is_group"]),
////////          limit_page_length: 20000,
////////        }),

////////        // Stock Entry list for manufacturing + stock transfer detection
////////        getDoctypeList("Stock Entry", {
////////          fields: JSON.stringify([
////////            "name",
////////            "purpose",
////////            "stock_entry_type",
////////            "posting_date",
////////            "docstatus",
////////          ]),
////////          filters: JSON.stringify([
////////            ["Stock Entry", "posting_date", "=", selectedDate],
////////            ["Stock Entry", "docstatus", "=", 1],
////////          ]),
////////          limit_page_length: 20000,
////////        }),
////////      ]);

////////      // ✅ invoice -> customer map
////////      const invoiceToCustomer = {};
////////      (siList || []).forEach((si) => {
////////        if (si?.name) invoiceToCustomer[si.name] = si.customer || "";
////////      });

////////      // ✅ Build all warehouses under ROOT_WAREHOUSE
////////      const childrenByParent = {};
////////      (whList || []).forEach((w) => {
////////        const p = w.parent_warehouse || "";
////////        if (!childrenByParent[p]) childrenByParent[p] = [];
////////        childrenByParent[p].push(w.name);
////////      });

////////      const jhWarehouses = new Set();
////////      const stack = [ROOT_WAREHOUSE];

////////      while (stack.length) {
////////        const w = stack.pop();
////////        if (!w || jhWarehouses.has(w)) continue;
////////        jhWarehouses.add(w);
////////        const kids = childrenByParent[w] || [];
////////        kids.forEach((k) => stack.push(k));
////////      }

////////      // ✅ Manufacturing + Stock Transfer Stock Entry sets
////////      const manufacturingSE = new Set();
////////      const transferSE = new Set();

////////      (seList || []).forEach((se) => {
////////        const purpose = String(se.purpose || "").toLowerCase();
////////        const seType = String(se.stock_entry_type || "").toLowerCase();

////////        const isMfg =
////////          purpose.includes("manufact") ||
////////          purpose.includes("repack") ||
////////          seType.includes("manufact") ||
////////          seType.includes("repack");

////////        const isTransfer =
////////          purpose.includes("material transfer") ||
////////          seType.includes("material transfer");

////////        if (se.name) {
////////          if (isMfg) manufacturingSE.add(se.name);
////////          if (isTransfer) transferSE.add(se.name);
////////        }
////////      });

////////      // ✅ BOM maps (also collect item codes from BOM)
////////      const rawToFinishedMap = {};
////////      const finishedToRawMap = {};
////////      const bomItemCodes = new Set();

////////      for (const bom of bomList || []) {
////////        try {
////////          const bomDoc = await getDoc("BOM", bom.name);
////////          const finishedItem = bom.item;
////////          if (!finishedItem) continue;

////////          bomItemCodes.add(finishedItem);

////////          (bomDoc.items || []).forEach((line) => {
////////            const rawItem = line.item_code;
////////            if (!rawItem) return;

////////            bomItemCodes.add(rawItem);

////////            if (!rawToFinishedMap[rawItem]) rawToFinishedMap[rawItem] = new Set();
////////            rawToFinishedMap[rawItem].add(finishedItem);

////////            if (!finishedToRawMap[finishedItem]) finishedToRawMap[finishedItem] = new Set();
////////            finishedToRawMap[finishedItem].add(rawItem);
////////          });
////////        } catch (e) {
////////          console.error("Failed to load BOM", bom.name, e);
////////        }
////////      }

////////      // ✅ Collect item codes ONLY needed (Jharkahand subtree SLE + BOM)
////////      const neededItemCodes = new Set([...bomItemCodes]);
////////      (sleToSelected || []).forEach((e) => {
////////        if (!e?.item_code || !e?.warehouse) return;
////////        if (!jhWarehouses.has(e.warehouse)) return;
////////        neededItemCodes.add(e.item_code);
////////      });

////////      // ✅ Fetch only those items (NOT all items)
////////      const itemRows = await fetchItemsByCodes(Array.from(neededItemCodes));

////////      const itemMap = {};
////////      const itemGroupMap = {};
////////      const groupSet = new Set();

////////      (itemRows || []).forEach((it) => {
////////        itemMap[it.name] = it.item_name;
////////        itemGroupMap[it.name] = it.item_group || "";
////////        if (it.item_group) groupSet.add(it.item_group);
////////      });

////////      setItemGroups(Array.from(groupSet).sort((a, b) => a.localeCompare(b)));

////////      // Recon vouchers list
////////      const reconNameSet = new Set((reconDocs || []).map((d) => d.name));

////////      // maps keyed by item||warehouse
////////      const openingMap = {};
////////      const movementMap = {}; // non-sales-invoice, non-recon daily movement
////////      const adjustmentMap = {}; // recon delta

////////      // total Sales Invoice qty (ALL warehouses) so current_stock stays correct
////////      const siTotalQtyMap = {};

////////      // display-only sold/return (Finished Goods / Damaged only)
////////      const soldTotalMap = {};
////////      const soldByCustomerMap = {};
////////      const goodReturnMap = {};
////////      const badReturnMap = {};

////////      // packing activity: Finished Goods, only Manufacturing + Transfer stock entries
////////      const packingActMap = {};

////////      const lastBeforeDay = {};

////////      // ---------- Opening + movement + sales/returns ----------
////////      (sleToSelected || []).forEach((entry) => {
////////        const itemCode = entry.item_code;
////////        const warehouse = entry.warehouse;
////////        if (!itemCode || !warehouse) return;

////////        if (!jhWarehouses.has(warehouse)) return;

////////        const key = `${itemCode}||${warehouse}`;

////////        const qty = parseFloat(entry.actual_qty) || 0;
////////        const balance = parseFloat(entry.qty_after_transaction) || 0;

////////        const rawVtype = entry.voucher_type || "";
////////        const vtype = typeof rawVtype === "string" ? rawVtype.trim() : rawVtype;

////////        const entryDate = entry.posting_date;
////////        const ts = makeTs(entry);

////////        const isRecon = reconNameSet.has(entry.voucher_no);

////////        // opening = last balance before date
////////        if (entryDate < selectedDate) {
////////          const existing = lastBeforeDay[key];
////////          if (!existing || ts > existing.ts) lastBeforeDay[key] = { ts, balance };
////////        }

////////        if (entryDate !== selectedDate) return;

////////        // ✅ Sales Invoice handling
////////        if (vtype === "Sales Invoice") {
////////          siTotalQtyMap[key] = (siTotalQtyMap[key] || 0) + qty;

////////          const invName = entry.voucher_no;
////////          const customer = invoiceToCustomer[invName] || "Unknown";

////////          // Sold Qty = only Finished Goods and qty negative
////////          if (warehouse === WH_PACKING && qty < 0) {
////////            const n = -Math.abs(qty);
////////            soldTotalMap[key] = (soldTotalMap[key] || 0) + n;

////////            if (!soldByCustomerMap[key]) soldByCustomerMap[key] = {};
////////            soldByCustomerMap[key][customer] =
////////              (soldByCustomerMap[key][customer] || 0) + n;
////////          }

////////          // Return Qty = qty positive:
////////          if (qty > 0) {
////////            if (warehouse === WH_PACKING) {
////////              goodReturnMap[key] = (goodReturnMap[key] || 0) + qty;
////////            } else if (warehouse === WH_DAMAGED) {
////////              badReturnMap[key] = (badReturnMap[key] || 0) + qty;
////////            } else {
////////              goodReturnMap[key] = (goodReturnMap[key] || 0) + qty;
////////            }
////////          }

////////          return;
////////        }

////////        // ✅ Packing Activity = Finished Goods + (Manufacturing OR Transfer)
////////        if (warehouse === WH_PACKING && vtype === "Stock Entry") {
////////          const seName = entry.voucher_no;
////////          if (manufacturingSE.has(seName) || transferSE.has(seName)) {
////////            packingActMap[key] = (packingActMap[key] || 0) + qty;
////////          }
////////        }

////////        // normal movement (exclude recon)
////////        if (!isRecon) {
////////          movementMap[key] = (movementMap[key] || 0) + qty;
////////        }
////////      });

////////      Object.keys(lastBeforeDay).forEach((key) => {
////////        openingMap[key] = lastBeforeDay[key].balance;
////////      });

////////      // ---------- Reconciliation adjustments ----------
////////      for (const recon of reconDocs || []) {
////////        const doc = await getDoc("Stock Reconciliation", recon.name);
////////        (doc.items || []).forEach((it) => {
////////          const itemCode = it.item_code;
////////          const warehouse = it.warehouse;
////////          if (!itemCode || !warehouse) return;

////////          if (!jhWarehouses.has(warehouse)) return;

////////          const key = `${itemCode}||${warehouse}`;
////////          const currentQty = parseFloat(it.current_qty || 0);
////////          const newQty = parseFloat(it.qty || 0);
////////          const delta = newQty - currentQty;

////////          adjustmentMap[key] = (adjustmentMap[key] || 0) + delta;
////////        });
////////      }

////////      // Build key set
////////      const keys = new Set([
////////        ...Object.keys(openingMap),
////////        ...Object.keys(movementMap),
////////        ...Object.keys(adjustmentMap),
////////        ...Object.keys(siTotalQtyMap),
////////        ...Object.keys(soldTotalMap),
////////        ...Object.keys(goodReturnMap),
////////        ...Object.keys(badReturnMap),
////////        ...Object.keys(packingActMap),
////////      ]);

////////      // Flat rows per item||warehouse
////////      const flat = Array.from(keys).map((key) => {
////////        const [item_code, warehouse] = key.split("||");

////////        const opening_stock = Number(openingMap[key] || 0);
////////        const movement_qty = Number(movementMap[key] || 0);
////////        const adjustment_qty = Number(adjustmentMap[key] || 0);

////////        const si_qty_total = Number(siTotalQtyMap[key] || 0);

////////        const sold_qty = Number(soldTotalMap[key] || 0);
////////        const sold_by_customer = soldByCustomerMap[key] || {};

////////        const good_return_qty = Number(goodReturnMap[key] || 0);
////////        const bad_return_qty = Number(badReturnMap[key] || 0);

////////        const packing_act_qty = Number(packingActMap[key] || 0);

////////        const current_stock = opening_stock + movement_qty + adjustment_qty + si_qty_total;

////////        return {
////////          item_code,
////////          item_name: itemMap[item_code] || "",
////////          item_group: itemGroupMap[item_code] || "",
////////          warehouse,

////////          opening_stock,
////////          movement_qty,
////////          adjustment_qty,

////////          sold_qty,
////////          sold_by_customer,
////////          good_return_qty,
////////          bad_return_qty,

////////          packing_act_qty,

////////          current_stock,
////////        };
////////      });

////////      // ✅ Sold customers dropdown ONLY from Sold activity (Finished Goods)
////////      const soldCustomerSet = new Set();
////////      Object.values(soldByCustomerMap).forEach((custMap) => {
////////        Object.keys(custMap || {}).forEach((c) => c && soldCustomerSet.add(c));
////////      });
////////      setCustomers(Array.from(soldCustomerSet).sort((a, b) => a.localeCompare(b)));

////////      // Pivot: ONE row per item
////////      const pivotByItem = {};
////////      flat.forEach((r) => {
////////        if (!pivotByItem[r.item_code]) {
////////          pivotByItem[r.item_code] = {
////////            item_code: r.item_code,
////////            item_name: r.item_name || "",
////////            item_group: r.item_group || "",

////////            opening_stock: 0,
////////            adjustment_qty: 0,

////////            sold_qty: 0,
////////            sold_by_customer: {},

////////            return_good_qty: 0,
////////            return_bad_qty: 0,

////////            other_activity_transit: 0,
////////            other_activity_in_use: 0,
////////            other_activity_rejected: 0,

////////            packing_activity: 0,
////////            stock_inward: 0,
////////            wastage: 0,

////////            current_stock: 0,
////////          };
////////        }

////////        const pr = pivotByItem[r.item_code];

////////        pr.opening_stock += Number(r.opening_stock || 0);
////////        pr.adjustment_qty += Number(r.adjustment_qty || 0);
////////        pr.current_stock += Number(r.current_stock || 0);

////////        pr.sold_qty += Number(r.sold_qty || 0);
////////        Object.entries(r.sold_by_customer || {}).forEach(([cust, qty]) => {
////////          pr.sold_by_customer[cust] = (pr.sold_by_customer[cust] || 0) + Number(qty || 0);
////////        });

////////        pr.return_good_qty += Number(r.good_return_qty || 0);
////////        pr.return_bad_qty += Number(r.bad_return_qty || 0);

////////        if (r.warehouse === WH_TRANSIT) pr.other_activity_transit += Number(r.movement_qty || 0);
////////        if (r.warehouse === WH_IN_USE) pr.other_activity_in_use += Number(r.movement_qty || 0);
////////        if (r.warehouse === WH_REJECTED)
////////          pr.other_activity_rejected += Number(r.movement_qty || 0);

////////        if (r.warehouse === WH_PACKING) pr.packing_activity += Number(r.packing_act_qty || 0);

////////        if (r.warehouse === WH_STOCK_INWARD) pr.stock_inward += Number(r.movement_qty || 0);
////////        if (r.warehouse === WH_WASTAGE) pr.wastage += Number(r.movement_qty || 0);
////////      });

////////      // ---------- BOM grouping (same as before) ----------
////////      const chosenParentOfFinished = {};
////////      Object.keys(finishedToRawMap).forEach((finishedItem) => {
////////        const rawItems = Array.from(finishedToRawMap[finishedItem]);
////////        if (rawItems.length === 0) return;

////////        let bestParent = rawItems[0];
////////        rawItems.forEach((rawCode) => {
////////          const name = (itemMap[rawCode] || rawCode).toLowerCase();
////////          const bestName = (itemMap[bestParent] || bestParent).toLowerCase();

////////          const isRawLike = name.startsWith("raw ") || name.includes(" raw ");
////////          const bestIsRawLike = bestName.startsWith("raw ") || bestName.includes(" raw ");

////////          if (isRawLike && !bestIsRawLike) bestParent = rawCode;
////////          else if (isRawLike === bestIsRawLike) {
////////            if (rawCode < bestParent) bestParent = rawCode;
////////          }
////////        });

////////        chosenParentOfFinished[finishedItem] = bestParent;
////////      });

////////      const parentToChildren = {};
////////      Object.entries(chosenParentOfFinished).forEach(([fg, parentRaw]) => {
////////        if (!parentToChildren[parentRaw]) parentToChildren[parentRaw] = new Set();
////////        parentToChildren[parentRaw].add(fg);
////////      });

////////      const parentForItem = {};
////////      Object.entries(chosenParentOfFinished).forEach(([fg, parentRaw]) => {
////////        parentForItem[fg] = parentRaw;
////////      });

////////      // group movement flag
////////      const groupMovement = {};
////////      Object.values(pivotByItem).forEach((pr) => {
////////        const groupCode = parentForItem[pr.item_code] || pr.item_code;
////////        const hasMovement =
////////          Number(pr.adjustment_qty || 0) !== 0 ||
////////          Number(pr.sold_qty || 0) !== 0 ||
////////          Number(pr.return_good_qty || 0) !== 0 ||
////////          Number(pr.return_bad_qty || 0) !== 0 ||
////////          Number(pr.other_activity_transit || 0) !== 0 ||
////////          Number(pr.other_activity_in_use || 0) !== 0 ||
////////          Number(pr.other_activity_rejected || 0) !== 0 ||
////////          Number(pr.packing_activity || 0) !== 0 ||
////////          Number(pr.stock_inward || 0) !== 0 ||
////////          Number(pr.wastage || 0) !== 0;

////////        if (hasMovement) groupMovement[groupCode] = true;
////////      });

////////      const makeDummyRow = (itemCode) => ({
////////        item_code: itemCode,
////////        item_name: itemMap[itemCode] || "",
////////        item_group: itemGroupMap[itemCode] || "",

////////        opening_stock: 0,
////////        adjustment_qty: 0,

////////        sold_qty: 0,
////////        sold_by_customer: {},

////////        return_good_qty: 0,
////////        return_bad_qty: 0,

////////        other_activity_transit: 0,
////////        other_activity_in_use: 0,
////////        other_activity_rejected: 0,

////////        packing_activity: 0,
////////        stock_inward: 0,
////////        wastage: 0,

////////        current_stock: 0,
////////      });

////////      const usedItemCodes = new Set();
////////      const finalRows = [];

////////      // ✅ First: BOM groups (raw parent -> children)
////////      const parentCandidateSet = new Set([
////////        ...Object.keys(parentToChildren),
////////        ...Object.keys(rawToFinishedMap),
////////      ]);

////////      const parentCodes = Array.from(parentCandidateSet).sort((a, b) => {
////////        const aMove = !!groupMovement[a];
////////        const bMove = !!groupMovement[b];
////////        if (aMove !== bMove) return aMove ? -1 : 1;

////////        const nA = (itemMap[a] || a).toLowerCase();
////////        const nB = (itemMap[b] || b).toLowerCase();
////////        return nA.localeCompare(nB);
////////      });

////////      parentCodes.forEach((parentCode) => {
////////        const childItemCodes = Array.from(parentToChildren[parentCode] || []).sort((a, b) => {
////////          const nA = (itemMap[a] || a).toLowerCase();
////////          const nB = (itemMap[b] || b).toLowerCase();
////////          return nA.localeCompare(nB);
////////        });

////////        finalRows.push({
////////          is_group_header: true,
////////          group_item_code: parentCode,
////////          group_label: cleanLabel(itemMap[parentCode] || parentCode),
////////        });

////////        const parentRow = pivotByItem[parentCode] || makeDummyRow(parentCode);
////////        if (!usedItemCodes.has(parentRow.item_code)) {
////////          usedItemCodes.add(parentRow.item_code);
////////          finalRows.push({
////////            ...parentRow,
////////            is_parent_item: true,
////////            parent_item_code: null,
////////            group_item_code: parentCode,
////////          });
////////        }

////////        childItemCodes.forEach((fgCode) => {
////////          const childRow = pivotByItem[fgCode] || makeDummyRow(fgCode);
////////          if (usedItemCodes.has(childRow.item_code)) return;
////////          usedItemCodes.add(childRow.item_code);

////////          finalRows.push({
////////            ...childRow,
////////            parent_item_code: parentCode,
////////            group_item_code: parentCode,
////////          });
////////        });
////////      });

////////      // ✅ Second: Non-BOM items grouped by "base name" (remove weight in brackets)
////////      const leftoverItemCodes = Object.keys(pivotByItem).filter((code) => !usedItemCodes.has(code));

////////      const labelGroups = {};
////////      leftoverItemCodes.forEach((code) => {
////////        const nm = itemMap[code] || code;
////////        const label = baseHeadingLabel(nm);
////////        if (!labelGroups[label]) labelGroups[label] = [];
////////        labelGroups[label].push(code);
////////      });

////////      const sortedLabels = Object.keys(labelGroups).sort((a, b) =>
////////        a.toLowerCase().localeCompare(b.toLowerCase())
////////      );

////////      sortedLabels.forEach((label) => {
////////        const codes = labelGroups[label] || [];

////////        // sort: Raw first, then by weight
////////        const sortedCodes = codes.slice().sort((a, b) => {
////////          const aIsRaw = String(itemGroupMap[a] || "").toLowerCase().includes("raw");
////////          const bIsRaw = String(itemGroupMap[b] || "").toLowerCase().includes("raw");
////////          if (aIsRaw !== bIsRaw) return aIsRaw ? -1 : 1;

////////          const aw = parseWeightToGrams(extractWeight(itemMap[a] || a));
////////          const bw = parseWeightToGrams(extractWeight(itemMap[b] || b));
////////          if (aw !== bw) return aw - bw;

////////          const nA = (itemMap[a] || a).toLowerCase();
////////          const nB = (itemMap[b] || b).toLowerCase();
////////          return nA.localeCompare(nB);
////////        });

////////        const groupKey = `LBL:${label}`;

////////        finalRows.push({
////////          is_group_header: true,
////////          group_item_code: groupKey,
////////          group_label: label,
////////        });

////////        // choose a "parent row" so child rows show only weight
////////        const parentCode =
////////          sortedCodes.find((c) => String(itemGroupMap[c] || "").toLowerCase().includes("raw")) ||
////////          sortedCodes[0];

////////        sortedCodes.forEach((code) => {
////////          const row = pivotByItem[code] || makeDummyRow(code);
////////          const isParent = code === parentCode;

////////          finalRows.push({
////////            ...row,
////////            is_parent_item: isParent,
////////            parent_item_code: isParent ? null : parentCode,
////////            group_item_code: groupKey,
////////          });
////////        });
////////      });

////////      // expand all by default
////////      const newExpanded = {};
////////      finalRows.forEach((r) => {
////////        if (r.is_group_header) newExpanded[r.group_item_code] = true;
////////      });

////////      setRows(finalRows);
////////      setExpandedGroups(newExpanded);
////////    } catch (err) {
////////      console.error(err);
////////      setError(err.message || "Failed to load daily stock summary");
////////    } finally {
////////      setLoading(false);
////////    }
////////  }, []);

////////  useEffect(() => {
////////    loadData(date);
////////  }, [date, loadData]);

////////  // keep dropdown selections valid
////////  useEffect(() => {
////////    if (selectedItemGroup !== "ALL" && !itemGroups.includes(selectedItemGroup)) {
////////      setSelectedItemGroup("ALL");
////////    }
////////  }, [itemGroups, selectedItemGroup]);

////////  useEffect(() => {
////////    if (selectedCustomer !== "ALL" && !customers.includes(selectedCustomer)) {
////////      setSelectedCustomer("ALL");
////////    }
////////  }, [customers, selectedCustomer]);

////////  // ---------- Column filter ----------
////////  const columnOptions = useMemo(() => {
////////    const opts = [{ value: "ALL", label: "All Columns" }];
////////    COLUMNS.forEach((c) => opts.push({ value: c.key, label: c.label }));
////////    return opts;
////////  }, []);

////////  const displayedColumns = useMemo(() => {
////////    if (columnFilter === "ALL") return COLUMNS;
////////    const found = COLUMNS.find((c) => c.key === columnFilter);
////////    return found ? [found] : COLUMNS;
////////  }, [columnFilter]);

////////  const colCount = 1 + displayedColumns.length;

////////  // ---------- Search + item group filter ----------
////////  const lowerSearch = searchTerm.trim().toLowerCase();
////////  let displayRows = rows;

////////  const needsFiltering = lowerSearch || selectedItemGroup !== "ALL";

////////  if (needsFiltering) {
////////    const passesItemGroup = (d) =>
////////      selectedItemGroup === "ALL" || (d.item_group || "") === selectedItemGroup;

////////    const passesSearch = (d) => {
////////      if (!lowerSearch) return true;

////////      const name = (d.item_name || "").toLowerCase();
////////      const codeStr = (d.item_code || "").toLowerCase();

////////      if (name.includes(lowerSearch) || codeStr.includes(lowerSearch)) return true;

////////      if (lowerSearch.includes("transit")) return Number(d.other_activity_transit || 0) !== 0;
////////      if (lowerSearch.includes("reject")) return Number(d.other_activity_rejected || 0) !== 0;
////////      if (lowerSearch.includes("use") || lowerSearch.includes("wip"))
////////        return Number(d.other_activity_in_use || 0) !== 0;

////////      if (lowerSearch.includes("inward")) return Number(d.stock_inward || 0) !== 0;
////////      if (lowerSearch.includes("pack")) return Number(d.packing_activity || 0) !== 0;
////////      if (lowerSearch.includes("waste")) return Number(d.wastage || 0) !== 0;

////////      return false;
////////    };

////////    // keep headers + details together
////////    const groups = {};
////////    rows.forEach((r, idx) => {
////////      if (r.is_group_header) {
////////        const code = r.group_item_code || `__header_${idx}`;
////////        if (!groups[code]) groups[code] = { header: r, details: [], firstIndex: idx };
////////        else groups[code].header = r;
////////      } else {
////////        const code = r.group_item_code || r.item_code || `__row_${idx}`;
////////        if (!groups[code]) groups[code] = { header: null, details: [], firstIndex: idx };
////////        groups[code].details.push(r);
////////      }
////////    });

////////    const orderedCodes = Object.keys(groups).sort(
////////      (a, b) => groups[a].firstIndex - groups[b].firstIndex
////////    );

////////    const filtered = [];

////////    orderedCodes.forEach((code) => {
////////      const g = groups[code];
////////      const header = g.header;
////////      const details = g.details;

////////      const detailsByGroup = details.filter(passesItemGroup);

////////      const headerMatches =
////////        !!lowerSearch &&
////////        header &&
////////        ((header.group_label || "").toLowerCase().includes(lowerSearch) ||
////////          (header.group_item_code || "").toLowerCase().includes(lowerSearch));

////////      const detailsBySearchAndGroup = detailsByGroup.filter(passesSearch);

////////      if (headerMatches && detailsByGroup.length > 0) {
////////        if (header) filtered.push(header);
////////        detailsByGroup.forEach((d) => filtered.push(d));
////////        return;
////////      }

////////      if (detailsBySearchAndGroup.length > 0) {
////////        if (header) filtered.push(header);
////////        detailsBySearchAndGroup.forEach((d) => filtered.push(d));
////////      }
////////    });

////////    displayRows = filtered;
////////  }

////////  const visibleRowCount = displayRows.reduce((count, r) => {
////////    if (r.is_group_header) return count;
////////    if (!needsFiltering && r.group_item_code && expandedGroups[r.group_item_code] === false)
////////      return count;
////////    return count + 1;
////////  }, 0);

////////  // ---------- CSV ----------
////////  function isAllZeroRow(r) {
////////    const keys = [
////////      "opening_stock",
////////      "adjustment_qty",
////////      "sold_qty",
////////      "return_good_qty",
////////      "return_bad_qty",
////////      "other_activity_transit",
////////      "other_activity_in_use",
////////      "other_activity_rejected",
////////      "packing_activity",
////////      "stock_inward",
////////      "wastage",
////////      "current_stock",
////////    ];
////////    return keys.every((k) => Number(r[k] || 0) === 0);
////////  }

////////  function downloadSummaryAsCsv() {
////////    const dataRows = [];

////////    displayRows.forEach((r) => {
////////      if (r.is_group_header) return;
////////      if (isAllZeroRow(r)) return;

////////      const row = {
////////        "Item Code": r.item_code || "",
////////        "Item Name": r.item_name || "",
////////        "Item Group": r.item_group || "",
////////      };

////////      displayedColumns.forEach((c) => {
////////        row[c.label] = getCellValue(r, c.key);
////////      });

////////      dataRows.push(row);
////////    });

////////    if (dataRows.length === 0) {
////////      window.alert("Nothing to download (all rows are zero).");
////////      return;
////////    }

////////    const headers = Object.keys(dataRows[0]);
////////    const lines = [];

////////    lines.push(headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(","));

////////    dataRows.forEach((row) => {
////////      lines.push(
////////        headers.map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(",")
////////      );
////////    });

////////    const csv = lines.join("\n");
////////    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
////////    const url = URL.createObjectURL(blob);

////////    const link = document.createElement("a");
////////    link.href = url;
////////    link.download = `daily-stock-summary-${date}.csv`;
////////    document.body.appendChild(link);
////////    link.click();
////////    document.body.removeChild(link);
////////    URL.revokeObjectURL(url);
////////  }

////////  // Opening/Current: no dot. Others: dot.
////////  const renderColumnCell = (r, c) => {
////////    const val = getCellValue(r, c.key);
////////    if (c.noDot) return <span>{val}</span>;
////////    return <DotCell value={val} />;
////////  };

////////  // ✅ Compact item labels:
////////  //  - Group header already cleaned/base label
////////  //  - Parent raw item row => show "Raw"
////////  //  - Child items => show ONLY weight/variation
////////  //  - (NO extra text lines under item name)
////////  const getDisplayItemPrimary = (r) => {
////////    const cleaned = cleanLabel(r.item_name || r.item_code);

////////    if (r.is_parent_item && String(r.item_group || "").toLowerCase().includes("raw")) {
////////      return "Raw";
////////    }

////////    if (!!r.parent_item_code && !r.is_parent_item) {
////////      const w = extractWeight(cleaned);
////////      return w || cleaned;
////////    }

////////    return cleaned;
////////  };

////////  return (
////////    <div className="daily-stock-summary">
////////      <div className="daily-stock-summary-header-row">
////////        <div className="daily-stock-summary-header">
////////          <h2 className="daily-stock-summary-title">Daily Stock Summary</h2>
////////          <p className="daily-stock-summary-subtitle">
////////            Sold/Return/Other Activity filters affect only those columns
////////          </p>
////////        </div>

////////        <div className="daily-stock-summary-controls">
////////          <span className="daily-stock-summary-date-label">Date</span>
////////          <input
////////            type="date"
////////            className="input daily-stock-summary-date-input"
////////            value={date}
////////            onChange={(e) => setDate(e.target.value)}
////////          />

////////          <select
////////            className="input daily-stock-summary-group-filter"
////////            value={selectedItemGroup}
////////            onChange={(e) => setSelectedItemGroup(e.target.value)}
////////            title="Filter rows by Item Group"
////////          >
////////            <option value="ALL">All Item Groups</option>
////////            {itemGroups.map((g) => (
////////              <option key={g} value={g}>
////////                {g}
////////              </option>
////////            ))}
////////          </select>

////////          <select
////////            className="input daily-stock-summary-column-filter"
////////            value={columnFilter}
////////            onChange={(e) => setColumnFilter(e.target.value)}
////////            title="Show Item + selected column only"
////////          >
////////            {columnOptions.map((o) => (
////////              <option key={o.value} value={o.value}>
////////                {o.label}
////////              </option>
////////            ))}
////////          </select>

////////          <input
////////            type="text"
////////            className="input daily-stock-summary-search-input"
////////            placeholder="Search item / code / transit / rejected / inward / pack / wastage"
////////            value={searchTerm}
////////            onChange={(e) => setSearchTerm(e.target.value)}
////////          />

////////          <button
////////            type="button"
////////            className="btn btn-secondary btn-sm daily-stock-summary-download"
////////            onClick={downloadSummaryAsCsv}
////////          >
////////            Download Excel
////////          </button>

////////          <button
////////            type="button"
////////            className="btn btn-primary btn-sm daily-stock-summary-refresh"
////////            onClick={() => loadData(date)}
////////          >
////////            Refresh
////////          </button>
////////        </div>
////////      </div>

////////      <div className="daily-stock-summary-meta-row">
////////        <span className="daily-stock-summary-meta">
////////          Showing {visibleRowCount} line{visibleRowCount !== 1 ? "s" : ""}
////////        </span>
////////      </div>

////////      {loading && (
////////        <p className="daily-stock-summary-loading text-muted">Loading stock summary...</p>
////////      )}
////////      {error && <p className="daily-stock-summary-error alert alert-error">{error}</p>}
////////      {!loading && !error && displayRows.length === 0 && (
////////        <p className="daily-stock-summary-empty text-muted">No rows match your filters.</p>
////////      )}

////////      {!loading && !error && displayRows.length > 0 && (
////////        <div className="daily-stock-summary-table-wrapper">
////////          <table className="daily-stock-summary-table">
////////            <thead>
////////              <tr>
////////                <th>Item</th>

////////                {displayedColumns.map((c) => {
////////                  if (c.headerFilter === "customer") {
////////                    return (
////////                      <th key={c.key}>
////////                        <div className="daily-stock-summary-th-wrap">
////////                          <div className="daily-stock-summary-th-title">Sold Qty</div>
////////                          <select
////////                            className="daily-stock-summary-th-filter"
////////                            value={selectedCustomer}
////////                            onChange={(e) => setSelectedCustomer(e.target.value)}
////////                            title="Filter Sold Qty by Customer"
////////                          >
////////                            <option value="ALL">All Customers</option>
////////                            {customers.map((cu) => (
////////                              <option key={cu} value={cu}>
////////                                {cu}
////////                              </option>
////////                            ))}
////////                          </select>
////////                        </div>
////////                      </th>
////////                    );
////////                  }

////////                  if (c.headerFilter === "returnType") {
////////                    return (
////////                      <th key={c.key}>
////////                        <div className="daily-stock-summary-th-wrap">
////////                          <div className="daily-stock-summary-th-title">Return Qty</div>
////////                          <select
////////                            className="daily-stock-summary-th-filter"
////////                            value={selectedReturnType}
////////                            onChange={(e) => setSelectedReturnType(e.target.value)}
////////                            title="Filter Return Qty"
////////                          >
////////                            <option value={RETURN_TYPES.ALL}>All</option>
////////                            <option value={RETURN_TYPES.GOOD}>Good</option>
////////                            <option value={RETURN_TYPES.BAD}>Bad</option>
////////                          </select>
////////                        </div>
////////                      </th>
////////                    );
////////                  }

////////                  if (c.headerFilter === "otherActivity") {
////////                    return (
////////                      <th key={c.key}>
////////                        <div className="daily-stock-summary-th-wrap">
////////                          <div className="daily-stock-summary-th-title">Other Activity</div>
////////                          <select
////////                            className="daily-stock-summary-th-filter"
////////                            value={selectedOtherActivityType}
////////                            onChange={(e) => setSelectedOtherActivityType(e.target.value)}
////////                            title="Other Activity split"
////////                          >
////////                            <option value={OTHER_ACTIVITY_TYPES.ALL}>All</option>
////////                            <option value={OTHER_ACTIVITY_TYPES.TRANSIT}>Transit</option>
////////                            <option value={OTHER_ACTIVITY_TYPES.IN_USE}>In use</option>
////////                            <option value={OTHER_ACTIVITY_TYPES.REJECTED}>
////////                              Rejected Material
////////                            </option>
////////                          </select>
////////                        </div>
////////                      </th>
////////                    );
////////                  }

////////                  return (
////////                    <th key={c.key}>
////////                      <div className="daily-stock-summary-th-wrap">
////////                        <div className="daily-stock-summary-th-title">{c.label}</div>
////////                      </div>
////////                    </th>
////////                  );
////////                })}
////////              </tr>
////////            </thead>

////////            <tbody>
////////              {displayRows.map((r, idx) => {
////////                if (r.is_group_header) {
////////                  const isOpen = expandedGroups[r.group_item_code] !== false;
////////                  return (
////////                    <tr
////////                      key={`group-${r.group_item_code}-${idx}`}
////////                      className="daily-stock-summary-group-row"
////////                      onClick={() =>
////////                        setExpandedGroups((prev) => ({
////////                          ...prev,
////////                          [r.group_item_code]: !isOpen,
////////                        }))
////////                      }
////////                    >
////////                      <td className="daily-stock-summary-group-header" colSpan={colCount}>
////////                        <span className="daily-stock-summary-group-icon">📦</span>{" "}
////////                        {r.group_label}
////////                        <span className="daily-stock-summary-group-toggle">
////////                          {isOpen ? "▾" : "▸"}
////////                        </span>
////////                      </td>
////////                    </tr>
////////                  );
////////                }

////////                if (
////////                  !needsFiltering &&
////////                  r.group_item_code &&
////////                  expandedGroups[r.group_item_code] === false
////////                ) {
////////                  return null;
////////                }

////////                const topLabel = getDisplayItemPrimary(r);

////////                return (
////////                  <tr
////////                    key={`${r.item_code}||${r.parent_item_code || ""}||${r.group_item_code || ""}`}
////////                    className={[
////////                      r.is_parent_item ? "daily-stock-summary-row-parent" : "",
////////                      !!r.parent_item_code && !r.is_parent_item
////////                        ? "daily-stock-summary-row-child"
////////                        : "",
////////                    ]
////////                      .join(" ")
////////                      .trim()}
////////                  >
////////                    <td className="daily-stock-summary-item">
////////                      {/* ✅ ONLY one line (no extra text like code/group) */}
////////                      <div className="daily-stock-summary-item-code">{topLabel}</div>
////////                    </td>

////////                    {displayedColumns.map((c) => (
////////                      <td key={`${r.item_code}-${c.key}`} className="daily-stock-summary-num">
////////                        {renderColumnCell(r, c)}
////////                      </td>
////////                    ))}
////////                  </tr>
////////                );
////////              })}
////////            </tbody>
////////          </table>
////////        </div>
////////      )}
////////    </div>
////////  );
////////}

////////export default DailyStockSummary;
//////// src/Components/DailyStockSummary.jsx
//////import React, { useEffect, useState, useCallback, useMemo } from "react";
//////import { getStockLedgerUpToDate, getDoctypeList, getDoc } from "./erpBackendApi";
//////import "../CSS/DailyStockSummary.css";

///////**
////// * ✅ UPDATED DEFINITIONS
////// *
////// * Parent warehouse:
////// *  - Opening Stock  = SUM of stock in ALL child warehouses under "Jharkahand Warehouse - MF" at start of day
////// *  - Current Stock  = SUM of stock in ALL child warehouses under "Jharkahand Warehouse - MF" at end of selected day
////// *
////// * Columns:
////// *  - Packing Activity = stock change in Finished Goods warehouse ONLY from:
////// *      (1) Manufacturing Stock Entries
////// *      (2) Stock Transfer Stock Entries
////// *  - Stock Inward     = stock change in Raw Material warehouse by any non-reconciliation movement (includes stock transfers)
////// *  - Wastage          = stock change in Wastage warehouse by any non-reconciliation movement (includes stock transfers)
////// *  - Sold Qty         = stock change in Finished Goods due to Sales Invoice (customer filter)
////// *  - Return Qty       = Good -> return into Finished Goods (Sales Invoice stock-in)
////// *                     = Bad  -> return into Damaged (Sales Invoice stock-in)
////// *  - Reconciliation   = delta from Stock Reconciliation (any Jharkahand child warehouse)
////// *  - Other Activity   = Transit -> movement in Goods In Transit
////// *                     = In Use  -> movement in Work In Progress
////// *                     = Rejected Material -> movement in Rejected Warehouse
////// */

//////const ROOT_WAREHOUSE = "Jharkahand Warehouse - MF";

//////// ✅ show ONLY these item groups (no Pouch/Sticker/etc)
//////const ALLOWED_ITEM_GROUPS = new Set(["Raw Material", "Products"]);

//////const WH_STOCK_INWARD = "Raw Material - MF";
//////const WH_PACKING = "Finished Goods - MF";
//////const WH_WASTAGE = "Wastage - MF";
//////const WH_TRANSIT = "Goods In Transit - MF";
//////const WH_IN_USE = "Work In Progress - MF";
//////const WH_DAMAGED = "Damaged - MF";
//////const WH_REJECTED = "Rejected Warehouse - MF";

//////const RETURN_TYPES = {
//////  ALL: "ALL",
//////  GOOD: "GOOD",
//////  BAD: "BAD",
//////};

//////const OTHER_ACTIVITY_TYPES = {
//////  ALL: "ALL",
//////  TRANSIT: "TRANSIT",
//////  IN_USE: "IN_USE",
//////  REJECTED: "REJECTED",
//////};

//////// Columns order exactly like your screenshot
//////const COLUMNS = [
//////  { key: "opening_stock", label: "Opening Stock (TOTAL)", noDot: true },
//////  { key: "adjustment_qty", label: "Reconciliation" },
//////  { key: "sold_qty", label: "Sold Qty", headerFilter: "customer" },
//////  { key: "return_qty", label: "Return Qty", headerFilter: "returnType" },
//////  { key: "other_activity", label: "Other Activity", headerFilter: "otherActivity" },
//////  { key: "current_stock", label: "Current Stock (TOTAL)", noDot: true },
//////  { key: "packing_activity", label: "Paking Activity" },
//////  { key: "stock_inward", label: "Stock Inward" },
//////  { key: "wastage", label: "Wastage" },
//////];

//////function chunkArray(arr, size) {
//////  const out = [];
//////  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
//////  return out;
//////}

//////function DailyStockSummary() {
//////  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
//////  const [rows, setRows] = useState([]);
//////  const [expandedGroups, setExpandedGroups] = useState({});
//////  const [loading, setLoading] = useState(false);
//////  const [error, setError] = useState("");

//////  const [searchTerm, setSearchTerm] = useState("");

//////  // Row filter by Item Group
//////  const [itemGroups, setItemGroups] = useState([]);
//////  const [selectedItemGroup, setSelectedItemGroup] = useState("ALL");

//////  // Column filter (show Item + ONE selected column)
//////  const [columnFilter, setColumnFilter] = useState("ALL");

//////  // Sold filter (customer dropdown in header)
//////  const [customers, setCustomers] = useState([]);
//////  const [selectedCustomer, setSelectedCustomer] = useState("ALL");

//////  // Return filter (Good/Bad dropdown in header)
//////  const [selectedReturnType, setSelectedReturnType] = useState(RETURN_TYPES.ALL);

//////  // Other activity dropdown in header (All default)
//////  const [selectedOtherActivityType, setSelectedOtherActivityType] = useState(
//////    OTHER_ACTIVITY_TYPES.ALL
//////  );

//////  function makeTs(entry) {
//////    return `${entry.posting_date} ${entry.posting_time || "00:00:00"}`;
//////  }

//////  // remove "Raw" ONLY from beginning + remove Pouch/Sticker words
//////  // ✅ keep "Pouch" and "Sticker" in headings (do NOT remove them)
//////  function cleanLabel(s) {
//////    let x = String(s || "");
//////    x = x.replace(/^\s*raw\s+/i, ""); // remove ONLY leading "Raw "
//////    x = x.replace(/\s+/g, " ").trim(); // normalize spaces
//////    return x;
//////  }

//////  // ✅ Dots: green if value>0, red if value<0. Show ABS(value). No +/-.
//////  const DotCell = ({ value }) => {
//////    const n = Number(value || 0);
//////    if (n === 0) return <span>0</span>;

//////    return (
//////      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
//////        <span
//////          style={{
//////            width: 8,
//////            height: 8,
//////            borderRadius: 999,
//////            background: n > 0 ? "#16a34a" : "#dc2626",
//////            flex: "0 0 auto",
//////          }}
//////        />
//////        {Math.abs(n)}
//////      </span>
//////    );
//////  };

//////  // --------- value getters (respect dropdowns) ----------
//////  const getSoldValue = (r) => {
//////    if (selectedCustomer === "ALL") return Number(r.sold_qty || 0);
//////    return Number(r.sold_by_customer?.[selectedCustomer] || 0);
//////  };

//////  const getReturnValue = (r) => {
//////    const good = Number(r.return_good_qty || 0);
//////    const bad = Number(r.return_bad_qty || 0);
//////    if (selectedReturnType === RETURN_TYPES.GOOD) return good;
//////    if (selectedReturnType === RETURN_TYPES.BAD) return bad;
//////    return good + bad;
//////  };

//////  const getOtherActivityValue = (r) => {
//////    const t = Number(r.other_activity_transit || 0);
//////    const u = Number(r.other_activity_in_use || 0);
//////    const rej = Number(r.other_activity_rejected || 0);

//////    if (selectedOtherActivityType === OTHER_ACTIVITY_TYPES.TRANSIT) return t;
//////    if (selectedOtherActivityType === OTHER_ACTIVITY_TYPES.IN_USE) return u;
//////    if (selectedOtherActivityType === OTHER_ACTIVITY_TYPES.REJECTED) return rej;

//////    return t + u + rej;
//////  };

//////  const getCellValue = (r, key) => {
//////    if (key === "sold_qty") return getSoldValue(r);
//////    if (key === "return_qty") return getReturnValue(r);
//////    if (key === "other_activity") return getOtherActivityValue(r);
//////    return Number(r[key] || 0);
//////  };

//////  async function fetchItemsByCodes(itemCodes) {
//////    const unique = Array.from(new Set(itemCodes)).filter(Boolean);
//////    if (unique.length === 0) return [];

//////    // Chunk to avoid "too long" filter payloads
//////    const chunks = chunkArray(unique, 400);
//////    const out = [];

//////    for (const part of chunks) {
//////      const rows = await getDoctypeList("Item", {
//////        fields: JSON.stringify(["name", "item_name", "item_group"]),
//////        filters: JSON.stringify([
//////          ["Item", "name", "in", part],
//////          ["Item", "item_group", "in", Array.from(ALLOWED_ITEM_GROUPS)], // ✅ only Raw Material + Products
//////        ]),
//////        limit_page_length: part.length,
//////      });
//////      out.push(...(rows || []));
//////    }

//////    return out;
//////  }

//////  // --------- load data ----------
//////  const loadData = useCallback(async (selectedDate) => {
//////    setLoading(true);
//////    setError("");
//////    setRows([]);
//////    setExpandedGroups({});

//////    try {
//////      const [sleToSelected, reconDocs, siList, whList, seList] = await Promise.all([
//////        getStockLedgerUpToDate(selectedDate),

//////        getDoctypeList("Stock Reconciliation", {
//////          fields: JSON.stringify(["name", "posting_date", "docstatus"]),
//////          filters: JSON.stringify([
//////            ["Stock Reconciliation", "posting_date", "=", selectedDate],
//////            ["Stock Reconciliation", "docstatus", "=", 1],
//////          ]),
//////          limit_page_length: 500,
//////        }),

//////        // Sales Invoice list for voucher_no -> customer (includes returns too)
//////        getDoctypeList("Sales Invoice", {
//////          fields: JSON.stringify(["name", "customer", "posting_date", "docstatus"]),
//////          filters: JSON.stringify([
//////            ["Sales Invoice", "posting_date", "=", selectedDate],
//////            ["Sales Invoice", "docstatus", "=", 1],
//////          ]),
//////          limit_page_length: 20000,
//////        }),

//////        // Warehouse tree (need parent_warehouse)
//////        getDoctypeList("Warehouse", {
//////          fields: JSON.stringify(["name", "parent_warehouse", "is_group"]),
//////          limit_page_length: 20000,
//////        }),

//////        // Stock Entry list for manufacturing + stock transfer detection
//////        getDoctypeList("Stock Entry", {
//////          fields: JSON.stringify(["name", "purpose", "stock_entry_type", "posting_date", "docstatus"]),
//////          filters: JSON.stringify([
//////            ["Stock Entry", "posting_date", "=", selectedDate],
//////            ["Stock Entry", "docstatus", "=", 1],
//////          ]),
//////          limit_page_length: 20000,
//////        }),
//////      ]);

//////      // ✅ invoice -> customer map
//////      const invoiceToCustomer = {};
//////      (siList || []).forEach((si) => {
//////        if (si?.name) invoiceToCustomer[si.name] = si.customer || "";
//////      });

//////      // ✅ Build all warehouses under ROOT_WAREHOUSE
//////      const childrenByParent = {};
//////      (whList || []).forEach((w) => {
//////        const p = w.parent_warehouse || "";
//////        if (!childrenByParent[p]) childrenByParent[p] = [];
//////        childrenByParent[p].push(w.name);
//////      });

//////      const jhWarehouses = new Set();
//////      const stack = [ROOT_WAREHOUSE];

//////      while (stack.length) {
//////        const w = stack.pop();
//////        if (!w || jhWarehouses.has(w)) continue;
//////        jhWarehouses.add(w);
//////        const kids = childrenByParent[w] || [];
//////        kids.forEach((k) => stack.push(k));
//////      }

//////      // ✅ Manufacturing + Stock Transfer Stock Entry sets
//////      const manufacturingSE = new Set();
//////      const transferSE = new Set();

//////      (seList || []).forEach((se) => {
//////        const purpose = String(se.purpose || "").toLowerCase();
//////        const seType = String(se.stock_entry_type || "").toLowerCase();

//////        const isMfg =
//////          purpose.includes("manufact") ||
//////          purpose.includes("repack") ||
//////          seType.includes("manufact") ||
//////          seType.includes("repack");

//////        const isTransfer =
//////          purpose.includes("material transfer") || seType.includes("material transfer");

//////        if (se.name) {
//////          if (isMfg) manufacturingSE.add(se.name);
//////          if (isTransfer) transferSE.add(se.name);
//////        }
//////      });

//////      // ✅ Recon vouchers list (for SLE detection)
//////      const reconNameSet = new Set((reconDocs || []).map((d) => d.name));

//////      // ✅ Fetch recon full docs in parallel (speed)
//////      const reconFullDocs = await Promise.all(
//////        (reconDocs || []).map((r) => getDoc("Stock Reconciliation", r.name).catch(() => null))
//////      );

//////      // ✅ Collect needed item codes (only Jharkahand subtree)
//////      const neededItemCodes = new Set();
//////      (sleToSelected || []).forEach((e) => {
//////        if (!e?.item_code || !e?.warehouse) return;
//////        if (!jhWarehouses.has(e.warehouse)) return;
//////        neededItemCodes.add(e.item_code);
//////      });

//////      (reconFullDocs || []).forEach((doc) => {
//////        if (!doc) return;
//////        (doc.items || []).forEach((it) => {
//////          if (!it?.item_code || !it?.warehouse) return;
//////          if (!jhWarehouses.has(it.warehouse)) return;
//////          neededItemCodes.add(it.item_code);
//////        });
//////      });

//////      // ✅ Fetch only allowed groups meta (Raw Material + Products)
//////      const itemRows = await fetchItemsByCodes(Array.from(neededItemCodes));

//////      const itemMap = {};
//////      const itemGroupMap = {};
//////      const groupSet = new Set();

//////      (itemRows || []).forEach((it) => {
//////        itemMap[it.name] = it.item_name;
//////        itemGroupMap[it.name] = it.item_group || "";
//////        if (it.item_group && ALLOWED_ITEM_GROUPS.has(it.item_group)) groupSet.add(it.item_group);
//////      });

//////      // ✅ keep dropdown only these, in stable order
//////      const orderedGroups = ["Raw Material", "Products"].filter((g) => groupSet.has(g));
//////      setItemGroups(orderedGroups);

//////      // maps keyed by item||warehouse
//////      const openingMap = {};
//////      const movementMap = {}; // non-sales-invoice, non-recon daily movement
//////      const adjustmentMap = {}; // recon delta

//////      // total Sales Invoice qty (ALL warehouses) so current_stock stays correct
//////      const siTotalQtyMap = {};

//////      // display-only sold/return (Finished Goods / Damaged only)
//////      const soldTotalMap = {};
//////      const soldByCustomerMap = {};
//////      const goodReturnMap = {};
//////      const badReturnMap = {};

//////      // packing activity: Finished Goods, only Manufacturing + Transfer stock entries
//////      const packingActMap = {};

//////      const lastBeforeDay = {};

//////      // ---------- Opening + movement + sales/returns ----------
//////      (sleToSelected || []).forEach((entry) => {
//////        const itemCode = entry.item_code;
//////        const warehouse = entry.warehouse;
//////        if (!itemCode || !warehouse) return;

//////        if (!jhWarehouses.has(warehouse)) return;

//////        const key = `${itemCode}||${warehouse}`;

//////        const qty = parseFloat(entry.actual_qty) || 0;
//////        const balance = parseFloat(entry.qty_after_transaction) || 0;

//////        const rawVtype = entry.voucher_type || "";
//////        const vtype = typeof rawVtype === "string" ? rawVtype.trim() : rawVtype;

//////        const entryDate = entry.posting_date;
//////        const ts = makeTs(entry);

//////        const isRecon = reconNameSet.has(entry.voucher_no);

//////        // opening = last balance before date
//////        if (entryDate < selectedDate) {
//////          const existing = lastBeforeDay[key];
//////          if (!existing || ts > existing.ts) lastBeforeDay[key] = { ts, balance };
//////        }

//////        if (entryDate !== selectedDate) return;

//////        // ✅ Sales Invoice handling
//////        if (vtype === "Sales Invoice") {
//////          siTotalQtyMap[key] = (siTotalQtyMap[key] || 0) + qty;

//////          const invName = entry.voucher_no;
//////          const customer = invoiceToCustomer[invName] || "Unknown";

//////          // Sold Qty = only Finished Goods and qty negative
//////          if (warehouse === WH_PACKING && qty < 0) {
//////            const n = -Math.abs(qty);
//////            soldTotalMap[key] = (soldTotalMap[key] || 0) + n;

//////            if (!soldByCustomerMap[key]) soldByCustomerMap[key] = {};
//////            soldByCustomerMap[key][customer] = (soldByCustomerMap[key][customer] || 0) + n;
//////          }

//////          // Return Qty = qty positive:
//////          if (qty > 0) {
//////            if (warehouse === WH_PACKING) {
//////              goodReturnMap[key] = (goodReturnMap[key] || 0) + qty;
//////            } else if (warehouse === WH_DAMAGED) {
//////              badReturnMap[key] = (badReturnMap[key] || 0) + qty;
//////            } else {
//////              goodReturnMap[key] = (goodReturnMap[key] || 0) + qty;
//////            }
//////          }

//////          return;
//////        }

//////        // ✅ Packing Activity = Finished Goods + (Manufacturing OR Transfer)
//////        if (warehouse === WH_PACKING && vtype === "Stock Entry") {
//////          const seName = entry.voucher_no;
//////          if (manufacturingSE.has(seName) || transferSE.has(seName)) {
//////            packingActMap[key] = (packingActMap[key] || 0) + qty;
//////          }
//////        }

//////        // normal movement (exclude recon)
//////        if (!isRecon) {
//////          movementMap[key] = (movementMap[key] || 0) + qty;
//////        }
//////      });

//////      Object.keys(lastBeforeDay).forEach((key) => {
//////        openingMap[key] = lastBeforeDay[key].balance;
//////      });

//////      // ---------- Reconciliation adjustments (parallel-loaded docs) ----------
//////      for (const doc of reconFullDocs || []) {
//////        if (!doc) continue;
//////        (doc.items || []).forEach((it) => {
//////          const itemCode = it.item_code;
//////          const warehouse = it.warehouse;
//////          if (!itemCode || !warehouse) return;

//////          if (!jhWarehouses.has(warehouse)) return;

//////          const key = `${itemCode}||${warehouse}`;
//////          const currentQty = parseFloat(it.current_qty || 0);
//////          const newQty = parseFloat(it.qty || 0);
//////          const delta = newQty - currentQty;

//////          adjustmentMap[key] = (adjustmentMap[key] || 0) + delta;
//////        });
//////      }

//////      // Build key set
//////      const keys = new Set([
//////        ...Object.keys(openingMap),
//////        ...Object.keys(movementMap),
//////        ...Object.keys(adjustmentMap),
//////        ...Object.keys(siTotalQtyMap),
//////        ...Object.keys(soldTotalMap),
//////        ...Object.keys(goodReturnMap),
//////        ...Object.keys(badReturnMap),
//////        ...Object.keys(packingActMap),
//////      ]);

//////      // Flat rows per item||warehouse
//////      const flat = Array.from(keys).map((key) => {
//////        const [item_code, warehouse] = key.split("||");

//////        const opening_stock = Number(openingMap[key] || 0);
//////        const movement_qty = Number(movementMap[key] || 0);
//////        const adjustment_qty = Number(adjustmentMap[key] || 0);

//////        const si_qty_total = Number(siTotalQtyMap[key] || 0);

//////        const sold_qty = Number(soldTotalMap[key] || 0);
//////        const sold_by_customer = soldByCustomerMap[key] || {};

//////        const good_return_qty = Number(goodReturnMap[key] || 0);
//////        const bad_return_qty = Number(badReturnMap[key] || 0);

//////        const packing_act_qty = Number(packingActMap[key] || 0);

//////        const current_stock = opening_stock + movement_qty + adjustment_qty + si_qty_total;

//////        return {
//////          item_code,
//////          item_name: itemMap[item_code] || "",
//////          item_group: itemGroupMap[item_code] || "",
//////          warehouse,

//////          opening_stock,
//////          movement_qty,
//////          adjustment_qty,

//////          sold_qty,
//////          sold_by_customer,
//////          good_return_qty,
//////          bad_return_qty,

//////          packing_act_qty,

//////          current_stock,
//////        };
//////      });

//////      // ✅ Sold customers dropdown ONLY from Sold activity (Finished Goods)
//////      const soldCustomerSet = new Set();
//////      Object.values(soldByCustomerMap).forEach((custMap) => {
//////        Object.keys(custMap || {}).forEach((c) => c && soldCustomerSet.add(c));
//////      });
//////      setCustomers(Array.from(soldCustomerSet).sort((a, b) => a.localeCompare(b)));

//////      // Pivot: ONE row per item
//////      const pivotByItem = {};
//////      flat.forEach((r) => {
//////        // ✅ drop anything not in allowed item groups
//////        // (if item meta was not fetched, item_group will be "" and gets excluded)
//////        if (!ALLOWED_ITEM_GROUPS.has(r.item_group)) return;

//////        if (!pivotByItem[r.item_code]) {
//////          pivotByItem[r.item_code] = {
//////            item_code: r.item_code,
//////            item_name: r.item_name || "",
//////            item_group: r.item_group || "",

//////            opening_stock: 0,
//////            adjustment_qty: 0,

//////            sold_qty: 0,
//////            sold_by_customer: {},

//////            return_good_qty: 0,
//////            return_bad_qty: 0,

//////            other_activity_transit: 0,
//////            other_activity_in_use: 0,
//////            other_activity_rejected: 0,

//////            packing_activity: 0,
//////            stock_inward: 0,
//////            wastage: 0,

//////            current_stock: 0,
//////          };
//////        }

//////        const pr = pivotByItem[r.item_code];

//////        pr.opening_stock += Number(r.opening_stock || 0);
//////        pr.adjustment_qty += Number(r.adjustment_qty || 0);
//////        pr.current_stock += Number(r.current_stock || 0);

//////        pr.sold_qty += Number(r.sold_qty || 0);
//////        Object.entries(r.sold_by_customer || {}).forEach(([cust, qty]) => {
//////          pr.sold_by_customer[cust] = (pr.sold_by_customer[cust] || 0) + Number(qty || 0);
//////        });

//////        pr.return_good_qty += Number(r.good_return_qty || 0);
//////        pr.return_bad_qty += Number(r.bad_return_qty || 0);

//////        if (r.warehouse === WH_TRANSIT) pr.other_activity_transit += Number(r.movement_qty || 0);
//////        if (r.warehouse === WH_IN_USE) pr.other_activity_in_use += Number(r.movement_qty || 0);
//////        if (r.warehouse === WH_REJECTED)
//////          pr.other_activity_rejected += Number(r.movement_qty || 0);

//////        if (r.warehouse === WH_PACKING) pr.packing_activity += Number(r.packing_act_qty || 0);

//////        if (r.warehouse === WH_STOCK_INWARD) pr.stock_inward += Number(r.movement_qty || 0);
//////        if (r.warehouse === WH_WASTAGE) pr.wastage += Number(r.movement_qty || 0);
//////      });

//////      // ✅ Build rows with ONLY 2 headings (no BOM fetching / no heavy grouping)
//////      const allowedPivotRows = Object.values(pivotByItem);

//////      const finalRows = [];
//////      const groupOrder = ["Raw Material", "Products"];

//////      groupOrder.forEach((grp) => {
//////        const grpRows = allowedPivotRows
//////          .filter((r) => r.item_group === grp)
//////          .sort((a, b) => {
//////            const nA = (a.item_name || a.item_code || "").toLowerCase();
//////            const nB = (b.item_name || b.item_code || "").toLowerCase();
//////            return nA.localeCompare(nB);
//////          });

//////        if (grpRows.length === 0) return;

//////        const groupKey = `IG:${grp}`;

//////        finalRows.push({
//////          is_group_header: true,
//////          group_item_code: groupKey,
//////          group_label: grp,
//////        });

//////        grpRows.forEach((r) => {
//////          finalRows.push({
//////            ...r,
//////            group_item_code: groupKey,
//////            is_parent_item: false,
//////            parent_item_code: null,
//////          });
//////        });
//////      });

//////      // expand all by default
//////      const newExpanded = {};
//////      finalRows.forEach((r) => {
//////        if (r.is_group_header) newExpanded[r.group_item_code] = true;
//////      });

//////      setRows(finalRows);
//////      setExpandedGroups(newExpanded);
//////    } catch (err) {
//////      console.error(err);
//////      setError(err.message || "Failed to load daily stock summary");
//////    } finally {
//////      setLoading(false);
//////    }
//////  }, []);

//////  useEffect(() => {
//////    loadData(date);
//////  }, [date, loadData]);

//////  // keep dropdown selections valid
//////  useEffect(() => {
//////    if (selectedItemGroup !== "ALL" && !itemGroups.includes(selectedItemGroup)) {
//////      setSelectedItemGroup("ALL");
//////    }
//////  }, [itemGroups, selectedItemGroup]);

//////  useEffect(() => {
//////    if (selectedCustomer !== "ALL" && !customers.includes(selectedCustomer)) {
//////      setSelectedCustomer("ALL");
//////    }
//////  }, [customers, selectedCustomer]);

//////  // ---------- Column filter ----------
//////  const columnOptions = useMemo(() => {
//////    const opts = [{ value: "ALL", label: "All Columns" }];
//////    COLUMNS.forEach((c) => opts.push({ value: c.key, label: c.label }));
//////    return opts;
//////  }, []);

//////  const displayedColumns = useMemo(() => {
//////    if (columnFilter === "ALL") return COLUMNS;
//////    const found = COLUMNS.find((c) => c.key === columnFilter);
//////    return found ? [found] : COLUMNS;
//////  }, [columnFilter]);

//////  const colCount = 1 + displayedColumns.length;

//////  // ---------- Search + item group filter ----------
//////  const lowerSearch = searchTerm.trim().toLowerCase();
//////  let displayRows = rows;

//////  const needsFiltering = lowerSearch || selectedItemGroup !== "ALL";

//////  if (needsFiltering) {
//////    const passesItemGroup = (d) =>
//////      selectedItemGroup === "ALL" || (d.item_group || "") === selectedItemGroup;

//////    const passesSearch = (d) => {
//////      if (!lowerSearch) return true;

//////      const name = (d.item_name || "").toLowerCase();
//////      const codeStr = (d.item_code || "").toLowerCase();

//////      if (name.includes(lowerSearch) || codeStr.includes(lowerSearch)) return true;

//////      if (lowerSearch.includes("transit")) return Number(d.other_activity_transit || 0) !== 0;
//////      if (lowerSearch.includes("reject")) return Number(d.other_activity_rejected || 0) !== 0;
//////      if (lowerSearch.includes("use") || lowerSearch.includes("wip"))
//////        return Number(d.other_activity_in_use || 0) !== 0;

//////      if (lowerSearch.includes("inward")) return Number(d.stock_inward || 0) !== 0;
//////      if (lowerSearch.includes("pack")) return Number(d.packing_activity || 0) !== 0;
//////      if (lowerSearch.includes("waste")) return Number(d.wastage || 0) !== 0;

//////      return false;
//////    };

//////    // keep headers + details together
//////    const groups = {};
//////    rows.forEach((r, idx) => {
//////      if (r.is_group_header) {
//////        const code = r.group_item_code || `__header_${idx}`;
//////        if (!groups[code]) groups[code] = { header: r, details: [], firstIndex: idx };
//////        else groups[code].header = r;
//////      } else {
//////        const code = r.group_item_code || r.item_code || `__row_${idx}`;
//////        if (!groups[code]) groups[code] = { header: null, details: [], firstIndex: idx };
//////        groups[code].details.push(r);
//////      }
//////    });

//////    const orderedCodes = Object.keys(groups).sort(
//////      (a, b) => groups[a].firstIndex - groups[b].firstIndex
//////    );

//////    const filtered = [];

//////    orderedCodes.forEach((code) => {
//////      const g = groups[code];
//////      const header = g.header;
//////      const details = g.details;

//////      const detailsByGroup = details.filter(passesItemGroup);

//////      const headerMatches =
//////        !!lowerSearch &&
//////        header &&
//////        ((header.group_label || "").toLowerCase().includes(lowerSearch) ||
//////          (header.group_item_code || "").toLowerCase().includes(lowerSearch));

//////      const detailsBySearchAndGroup = detailsByGroup.filter(passesSearch);

//////      if (headerMatches && detailsByGroup.length > 0) {
//////        if (header) filtered.push(header);
//////        detailsByGroup.forEach((d) => filtered.push(d));
//////        return;
//////      }

//////      if (detailsBySearchAndGroup.length > 0) {
//////        if (header) filtered.push(header);
//////        detailsBySearchAndGroup.forEach((d) => filtered.push(d));
//////      }
//////    });

//////    displayRows = filtered;
//////  }

//////  const visibleRowCount = displayRows.reduce((count, r) => {
//////    if (r.is_group_header) return count;
//////    if (!needsFiltering && r.group_item_code && expandedGroups[r.group_item_code] === false)
//////      return count;
//////    return count + 1;
//////  }, 0);

//////  // ---------- CSV ----------
//////  function isAllZeroRow(r) {
//////    const keys = [
//////      "opening_stock",
//////      "adjustment_qty",
//////      "sold_qty",
//////      "return_good_qty",
//////      "return_bad_qty",
//////      "other_activity_transit",
//////      "other_activity_in_use",
//////      "other_activity_rejected",
//////      "packing_activity",
//////      "stock_inward",
//////      "wastage",
//////      "current_stock",
//////    ];
//////    return keys.every((k) => Number(r[k] || 0) === 0);
//////  }

//////  function downloadSummaryAsCsv() {
//////    const dataRows = [];

//////    displayRows.forEach((r) => {
//////      if (r.is_group_header) return;
//////      if (isAllZeroRow(r)) return;

//////      const row = {
//////        "Item Code": r.item_code || "",
//////        "Item Name": r.item_name || "",
//////        "Item Group": r.item_group || "",
//////      };

//////      displayedColumns.forEach((c) => {
//////        row[c.label] = getCellValue(r, c.key);
//////      });

//////      dataRows.push(row);
//////    });

//////    if (dataRows.length === 0) {
//////      window.alert("Nothing to download (all rows are zero).");
//////      return;
//////    }

//////    const headers = Object.keys(dataRows[0]);
//////    const lines = [];

//////    lines.push(headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(","));

//////    dataRows.forEach((row) => {
//////      lines.push(headers.map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(","));
//////    });

//////    const csv = lines.join("\n");
//////    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
//////    const url = URL.createObjectURL(blob);

//////    const link = document.createElement("a");
//////    link.href = url;
//////    link.download = `daily-stock-summary-${date}.csv`;
//////    document.body.appendChild(link);
//////    link.click();
//////    document.body.removeChild(link);
//////    URL.revokeObjectURL(url);
//////  }

//////  // Opening/Current: no dot. Others: dot.
//////  const renderColumnCell = (r, c) => {
//////    const val = getCellValue(r, c.key);
//////    if (c.noDot) return <span>{val}</span>;
//////    return <DotCell value={val} />;
//////  };

//////  // ✅ Compact item labels (now just cleaned name since we removed parent/child BOM grouping)
//////  const getDisplayItemPrimary = (r) => {
//////    const cleaned = cleanLabel(r.item_name || r.item_code);
//////    return cleaned;
//////  };

//////  return (
//////    <div className="daily-stock-summary">
//////      <div className="daily-stock-summary-header-row">
//////        <div className="daily-stock-summary-header">
//////          <h2 className="daily-stock-summary-title">Daily Stock Summary</h2>
//////          <p className="daily-stock-summary-subtitle">
//////            Sold/Return/Other Activity filters affect only those columns
//////          </p>
//////        </div>

//////        <div className="daily-stock-summary-controls">
//////          <span className="daily-stock-summary-date-label">Date</span>
//////          <input
//////            type="date"
//////            className="input daily-stock-summary-date-input"
//////            value={date}
//////            onChange={(e) => setDate(e.target.value)}
//////          />

//////          <select
//////            className="input daily-stock-summary-group-filter"
//////            value={selectedItemGroup}
//////            onChange={(e) => setSelectedItemGroup(e.target.value)}
//////            title="Filter rows by Item Group"
//////          >
//////            <option value="ALL">All Item Groups</option>
//////            {itemGroups.map((g) => (
//////              <option key={g} value={g}>
//////                {g}
//////              </option>
//////            ))}
//////          </select>

//////          <select
//////            className="input daily-stock-summary-column-filter"
//////            value={columnFilter}
//////            onChange={(e) => setColumnFilter(e.target.value)}
//////            title="Show Item + selected column only"
//////          >
//////            {columnOptions.map((o) => (
//////              <option key={o.value} value={o.value}>
//////                {o.label}
//////              </option>
//////            ))}
//////          </select>

//////          <input
//////            type="text"
//////            className="input daily-stock-summary-search-input"
//////            placeholder="Search item / code / transit / rejected / inward / pack / wastage"
//////            value={searchTerm}
//////            onChange={(e) => setSearchTerm(e.target.value)}
//////          />

//////          <button
//////            type="button"
//////            className="btn btn-secondary btn-sm daily-stock-summary-download"
//////            onClick={downloadSummaryAsCsv}
//////          >
//////            Download Excel
//////          </button>

//////          <button
//////            type="button"
//////            className="btn btn-primary btn-sm daily-stock-summary-refresh"
//////            onClick={() => loadData(date)}
//////          >
//////            Refresh
//////          </button>
//////        </div>
//////      </div>

//////      <div className="daily-stock-summary-meta-row">
//////        <span className="daily-stock-summary-meta">
//////          Showing {visibleRowCount} line{visibleRowCount !== 1 ? "s" : ""}
//////        </span>
//////      </div>

//////      {loading && <p className="daily-stock-summary-loading text-muted">Loading stock summary...</p>}
//////      {error && <p className="daily-stock-summary-error alert alert-error">{error}</p>}
//////      {!loading && !error && displayRows.length === 0 && (
//////        <p className="daily-stock-summary-empty text-muted">No rows match your filters.</p>
//////      )}

//////      {!loading && !error && displayRows.length > 0 && (
//////        <div className="daily-stock-summary-table-wrapper">
//////          <table className="daily-stock-summary-table">
//////            <thead>
//////              <tr>
//////                <th>Item</th>

//////                {displayedColumns.map((c) => {
//////                  if (c.headerFilter === "customer") {
//////                    return (
//////                      <th key={c.key}>
//////                        <div className="daily-stock-summary-th-wrap">
//////                          <div className="daily-stock-summary-th-title">Sold Qty</div>
//////                          <select
//////                            className="daily-stock-summary-th-filter"
//////                            value={selectedCustomer}
//////                            onChange={(e) => setSelectedCustomer(e.target.value)}
//////                            title="Filter Sold Qty by Customer"
//////                          >
//////                            <option value="ALL">All Customers</option>
//////                            {customers.map((cu) => (
//////                              <option key={cu} value={cu}>
//////                                {cu}
//////                              </option>
//////                            ))}
//////                          </select>
//////                        </div>
//////                      </th>
//////                    );
//////                  }

//////                  if (c.headerFilter === "returnType") {
//////                    return (
//////                      <th key={c.key}>
//////                        <div className="daily-stock-summary-th-wrap">
//////                          <div className="daily-stock-summary-th-title">Return Qty</div>
//////                          <select
//////                            className="daily-stock-summary-th-filter"
//////                            value={selectedReturnType}
//////                            onChange={(e) => setSelectedReturnType(e.target.value)}
//////                            title="Filter Return Qty"
//////                          >
//////                            <option value={RETURN_TYPES.ALL}>All</option>
//////                            <option value={RETURN_TYPES.GOOD}>Good</option>
//////                            <option value={RETURN_TYPES.BAD}>Bad</option>
//////                          </select>
//////                        </div>
//////                      </th>
//////                    );
//////                  }

//////                  if (c.headerFilter === "otherActivity") {
//////                    return (
//////                      <th key={c.key}>
//////                        <div className="daily-stock-summary-th-wrap">
//////                          <div className="daily-stock-summary-th-title">Other Activity</div>
//////                          <select
//////                            className="daily-stock-summary-th-filter"
//////                            value={selectedOtherActivityType}
//////                            onChange={(e) => setSelectedOtherActivityType(e.target.value)}
//////                            title="Other Activity split"
//////                          >
//////                            <option value={OTHER_ACTIVITY_TYPES.ALL}>All</option>
//////                            <option value={OTHER_ACTIVITY_TYPES.TRANSIT}>Transit</option>
//////                            <option value={OTHER_ACTIVITY_TYPES.IN_USE}>In use</option>
//////                            <option value={OTHER_ACTIVITY_TYPES.REJECTED}>Rejected Material</option>
//////                          </select>
//////                        </div>
//////                      </th>
//////                    );
//////                  }

//////                  return (
//////                    <th key={c.key}>
//////                      <div className="daily-stock-summary-th-wrap">
//////                        <div className="daily-stock-summary-th-title">{c.label}</div>
//////                      </div>
//////                    </th>
//////                  );
//////                })}
//////              </tr>
//////            </thead>

//////            <tbody>
//////              {displayRows.map((r, idx) => {
//////                if (r.is_group_header) {
//////                  const isOpen = expandedGroups[r.group_item_code] !== false;
//////                  return (
//////                    <tr
//////                      key={`group-${r.group_item_code}-${idx}`}
//////                      className="daily-stock-summary-group-row"
//////                      onClick={() =>
//////                        setExpandedGroups((prev) => ({
//////                          ...prev,
//////                          [r.group_item_code]: !isOpen,
//////                        }))
//////                      }
//////                    >
//////                      <td className="daily-stock-summary-group-header" colSpan={colCount}>
//////                        <span className="daily-stock-summary-group-icon">📦</span>{" "}
//////                        {r.group_label}
//////                        <span className="daily-stock-summary-group-toggle">
//////                          {isOpen ? "▾" : "▸"}
//////                        </span>
//////                      </td>
//////                    </tr>
//////                  );
//////                }

//////                if (
//////                  !needsFiltering &&
//////                  r.group_item_code &&
//////                  expandedGroups[r.group_item_code] === false
//////                ) {
//////                  return null;
//////                }

//////                const topLabel = getDisplayItemPrimary(r);

//////                return (
//////                  <tr
//////                    key={`${r.item_code}||${r.parent_item_code || ""}||${r.group_item_code || ""}`}
//////                    className={[r.is_parent_item ? "daily-stock-summary-row-parent" : ""]
//////                      .join(" ")
//////                      .trim()}
//////                  >
//////                    <td className="daily-stock-summary-item">
//////                      {/* ✅ ONLY one line (no extra text like code/group) */}
//////                      <div className="daily-stock-summary-item-code">{topLabel}</div>
//////                    </td>

//////                    {displayedColumns.map((c) => (
//////                      <td key={`${r.item_code}-${c.key}`} className="daily-stock-summary-num">
//////                        {renderColumnCell(r, c)}
//////                      </td>
//////                    ))}
//////                  </tr>
//////                );
//////              })}
//////            </tbody>
//////          </table>
//////        </div>
//////      )}
//////    </div>
//////  );
//////}

//////export default DailyStockSummary;
////// src/Components/DailyStockSummary.jsx
////import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
////import { getStockLedgerUpToDate, getDoctypeList, getDoc } from "./erpBackendApi";
////import "../CSS/DailyStockSummary.css";


////// * Definations------>
////// * Parent warehouse:
////// *  - Opening Stock  = SUM of stock in ALL child warehouses under "Jharkahand Warehouse - MF" at start of day
////// *  - Current Stock  = SUM of stock in ALL child warehouses under "Jharkahand Warehouse - MF" at end of selected day
////// *
////// * Columns:
////// *  - Packing Activity = stock change in Finished Goods warehouse ONLY from:
////// *      (1) Manufacturing Stock Entries
////// *      (2) Stock Transfer Stock Entries
////// *  - Stock Inward     = stock change in Raw Material warehouse by any non-reconciliation movement (includes stock transfers)
////// *  - Wastage          = stock change in Wastage warehouse by any non-reconciliation movement (includes stock transfers)
////// *  - Sold Qty         = stock change in Finished Goods due to Sales Invoice (customer filter)
////// *  - Return Qty       = Good -> return into Finished Goods (Sales Invoice stock-in)
////// *                     = Bad  -> return into Damaged (Sales Invoice stock-in)
////// *  - Reconciliation   = delta from Stock Reconciliation (any Jharkahand child warehouse)
////// *  - Other Activity   = Transit -> movement in Goods In Transit
////// *                     = In Use  -> movement in Work In Progress
////// *                     = Rejected Material -> movement in Rejected Warehouse

////const ROOT_WAREHOUSE = "Jharkahand Warehouse - MF";

////const ALLOWED_GROUPS = ["Raw Material", "Products"];
////const ALLOWED_GROUP_SET = new Set(ALLOWED_GROUPS);

////const WH_STOCK_INWARD = "Raw Material - MF";
////const WH_PACKING = "Finished Goods - MF";
////const WH_WASTAGE = "Wastage - MF";
////const WH_TRANSIT = "Goods In Transit - MF";
////const WH_IN_USE = "Work In Progress - MF";
////const WH_DAMAGED = "Damaged - MF";
////const WH_REJECTED = "Rejected Warehouse - MF";

////const RETURN_TYPES = { ALL: "ALL", GOOD: "GOOD", BAD: "BAD" };
////const OTHER_ACTIVITY_TYPES = { ALL: "ALL", TRANSIT: "TRANSIT", IN_USE: "IN_USE", REJECTED: "REJECTED" };

////const COLUMNS = [
////  { key: "opening_stock", label: "Opening Stock (TOTAL)", noDot: true },
////  { key: "adjustment_qty", label: "Reconciliation" },
////  { key: "sold_qty", label: "Sold Qty", headerFilter: "customer" },
////  { key: "return_qty", label: "Return Qty", headerFilter: "returnType" },
////  { key: "other_activity", label: "Other Activity", headerFilter: "otherActivity" },
////  { key: "current_stock", label: "Current Stock (TOTAL)", noDot: true },
////  { key: "packing_activity", label: "Paking Activity" },
////  { key: "stock_inward", label: "Stock Inward" },
////  { key: "wastage", label: "Wastage" },
////];

////const GROUP_PAGE_SIZE = 4;

////function DailyStockSummary() {
////  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
////  const [rows, setRows] = useState([]);
////  const [expandedGroups, setExpandedGroups] = useState({});
////  const [loading, setLoading] = useState(false);
////  const [error, setError] = useState("");

////  const [searchTerm, setSearchTerm] = useState("");

////  const [itemGroups, setItemGroups] = useState(ALLOWED_GROUPS);
////  const [selectedItemGroup, setSelectedItemGroup] = useState("ALL");

////  const [columnFilter, setColumnFilter] = useState("ALL");

////  // ✅ customers as options: [{value, label}]
////  const [customers, setCustomers] = useState([]);
////  const [selectedCustomer, setSelectedCustomer] = useState("ALL");

////  const [selectedReturnType, setSelectedReturnType] = useState(RETURN_TYPES.ALL);
////  const [selectedOtherActivityType, setSelectedOtherActivityType] = useState(OTHER_ACTIVITY_TYPES.ALL);

////  const [visibleGroupCount, setVisibleGroupCount] = useState(GROUP_PAGE_SIZE);
////  const sentinelRef = useRef(null);

////  const allowedItemsLoadedRef = useRef(false);
////  const allowedItemMapRef = useRef({});
////  const allowedItemCodesRef = useRef([]);

////  // ✅ customers cache (load once)
////  const customersLoadedRef = useRef(false);
////  const customerOptionsRef = useRef([]);

////  const [showColumnDropdowns, setShowColumnDropdowns] = useState(false);

////  const toggleColumnDropdowns = () => {
////    setShowColumnDropdowns((v) => !v);
////  };


////  // ✅ expandable metric columns (replaces dropdowns)
////  const [expandedMetrics, setExpandedMetrics] = useState({
////    sold_qty: false,
////    return_qty: false,
////    other_activity: false,
////  });

////  const toggleMetric = (key) => {
////    setExpandedMetrics((prev) => ({ ...prev, [key]: !prev[key] }));
////  };



////  function makeTs(entry) {
////    return `${entry.posting_date} ${entry.posting_time || "00:00:00"}`;
////  }

////  function cleanLabel(s) {
////    let x = String(s || "");
////    x = x.replace(/^\s*raw\s+/i, "");
////    x = x.replace(/\s+/g, " ").trim();
////    return x;
////  }

////  function extractWeight(s) {
////    const str = String(s || "");
////    const m1 = str.match(/\(([^)]+)\)/);
////    if (m1 && m1[1]) return m1[1].trim();

////    const m2 = str.match(/\b\d+(\.\d+)?\s*(kg|g|gm|grams|ml|l)\b/i);
////    if (m2) return m2[0].trim();

////    return "";
////  }

////  function baseHeadingLabel(nameOrCode) {
////    let s = cleanLabel(nameOrCode);
////    s = s.replace(/\([^)]*\)/g, " ");
////    s = s.replace(/\b\d+(\.\d+)?\s*(kg|g|gm|grams|ml|l)\b/gi, " ");
////    s = s.replace(/\s+/g, " ").trim();
////    return s || String(nameOrCode || "");
////  }

////  function parseWeightToGrams(weightStr) {
////    const w = String(weightStr || "").trim().toLowerCase();
////    const m = w.match(/(\d+(\.\d+)?)\s*(kg|g|gm|grams|ml|l)\b/);
////    if (!m) return Number.POSITIVE_INFINITY;
////    const num = parseFloat(m[1]);
////    const unit = m[3];
////    if (!isFinite(num)) return Number.POSITIVE_INFINITY;
////    if (unit === "kg" || unit === "l") return num * 1000;
////    return num;
////  }

////  const DotCell = ({ value }) => {
////    const n = Number(value || 0);
////    if (n === 0) return <span>0</span>;

////    return (
////      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
////        <span
////          style={{
////            width: 8,
////            height: 8,
////            borderRadius: 999,
////            background: n > 0 ? "#16a34a" : "#dc2626",
////            flex: "0 0 auto",
////          }}
////        />
////        {Math.abs(n)}
////      </span>
////    );
////  };

////  // Collapsed view always shows "All"
////  const getSoldValue = (r) => Number(r.sold_qty || 0);

////  const getReturnValue = (r) =>
////    Number(r.return_good_qty || 0) + Number(r.return_bad_qty || 0);

////  const getOtherActivityValue = (r) =>
////    Number(r.other_activity_transit || 0) +
////    Number(r.other_activity_in_use || 0) +
////    Number(r.other_activity_rejected || 0);


////  const getCellValue = (r, key) => {
////    if (key === "sold_qty") return getSoldValue(r);
////    if (key === "return_qty") return getReturnValue(r);
////    if (key === "other_activity") return getOtherActivityValue(r);
////    return Number(r[key] || 0);
////  };

////  const getMovementScore = (r) => {
////    const parts = [
////      "adjustment_qty",
////      "sold_qty",
////      "return_good_qty",
////      "return_bad_qty",
////      "other_activity_transit",
////      "other_activity_in_use",
////      "other_activity_rejected",
////      "packing_activity",
////      "stock_inward",
////      "wastage",
////    ];
////    return parts.reduce((sum, k) => sum + Math.abs(Number(r[k] || 0)), 0);
////  };

////  async function loadAllowedItemsOnce() {
////    if (allowedItemsLoadedRef.current) return;

////    const pageSize = 2000;
////    let start = 0;
////    const all = [];

////    while (true) {
////      const part = await getDoctypeList("Item", {
////        fields: JSON.stringify(["name", "item_name", "item_group"]),
////        filters: JSON.stringify([["Item", "item_group", "in", ALLOWED_GROUPS]]),
////        limit_page_length: pageSize,
////        limit_start: start,
////      });

////      all.push(...(part || []));
////      if (!part || part.length < pageSize) break;
////      start += pageSize;
////      if (start > 200000) break;
////    }

////    const map = {};
////    const codes = [];
////    (all || []).forEach((it) => {
////      if (!it?.name) return;
////      if (!ALLOWED_GROUP_SET.has(it.item_group)) return;
////      map[it.name] = { item_name: it.item_name || "", item_group: it.item_group || "" };
////      codes.push(it.name);
////    });

////    allowedItemMapRef.current = map;
////    allowedItemCodesRef.current = codes;
////    allowedItemsLoadedRef.current = true;

////    setItemGroups(ALLOWED_GROUPS);
////  }

////  // ✅ NEW: load ALL customers once for Sold Qty dropdown
////  async function loadCustomersOnce() {
////    if (customersLoadedRef.current) return;

////    const pageSize = 2000;
////    let start = 0;
////    const out = [];

////    while (true) {
////      const part = await getDoctypeList("Customer", {
////        fields: JSON.stringify(["name", "customer_name", "disabled"]),
////        filters: JSON.stringify([["Customer", "disabled", "=", 0]]),
////        limit_page_length: pageSize,
////        limit_start: start,
////      });

////      out.push(...(part || []));
////      if (!part || part.length < pageSize) break;
////      start += pageSize;
////      if (start > 200000) break;
////    }

////    const opts = (out || [])
////      .filter((c) => c?.name)
////      .map((c) => ({ value: c.name, label: c.customer_name || c.name }))
////      .sort((a, b) => a.label.localeCompare(b.label));

////    customerOptionsRef.current = opts;
////    customersLoadedRef.current = true;
////    setCustomers(opts);
////  }

////  const loadData = useCallback(async (selectedDate) => {
////    setLoading(true);
////    setError("");
////    setRows([]);
////    setExpandedGroups({});
////    setVisibleGroupCount(GROUP_PAGE_SIZE);

////    try {
////      await loadAllowedItemsOnce();
////      await loadCustomersOnce(); // ✅ keep dropdown full always

////      const [sleToSelected, reconDocs, siList, whList, seList] = await Promise.all([
////        getStockLedgerUpToDate(selectedDate),

////        getDoctypeList("Stock Reconciliation", {
////          fields: JSON.stringify(["name", "posting_date", "docstatus"]),
////          filters: JSON.stringify([
////            ["Stock Reconciliation", "posting_date", "=", selectedDate],
////            ["Stock Reconciliation", "docstatus", "=", 1],
////          ]),
////          limit_page_length: 500,
////        }),

////        getDoctypeList("Sales Invoice", {
////          fields: JSON.stringify(["name", "customer", "posting_date", "docstatus"]),
////          filters: JSON.stringify([
////            ["Sales Invoice", "posting_date", "=", selectedDate],
////            ["Sales Invoice", "docstatus", "=", 1],
////          ]),
////          limit_page_length: 20000,
////        }),

////        getDoctypeList("Warehouse", {
////          fields: JSON.stringify(["name", "parent_warehouse", "is_group"]),
////          limit_page_length: 20000,
////        }),

////        getDoctypeList("Stock Entry", {
////          fields: JSON.stringify(["name", "purpose", "stock_entry_type", "posting_date", "docstatus"]),
////          filters: JSON.stringify([
////            ["Stock Entry", "posting_date", "=", selectedDate],
////            ["Stock Entry", "docstatus", "=", 1],
////          ]),
////          limit_page_length: 20000,
////        }),
////      ]);

////      const invoiceToCustomer = {};
////      (siList || []).forEach((si) => {
////        if (si?.name) invoiceToCustomer[si.name] = si.customer || "";
////      });

////      const childrenByParent = {};
////      (whList || []).forEach((w) => {
////        const p = w.parent_warehouse || "";
////        if (!childrenByParent[p]) childrenByParent[p] = [];
////        childrenByParent[p].push(w.name);
////      });

////      const jhWarehouses = new Set();
////      const stack = [ROOT_WAREHOUSE];
////      while (stack.length) {
////        const w = stack.pop();
////        if (!w || jhWarehouses.has(w)) continue;
////        jhWarehouses.add(w);
////        const kids = childrenByParent[w] || [];
////        kids.forEach((k) => stack.push(k));
////      }

////      const manufacturingSE = new Set();
////      const transferSE = new Set();

////      (seList || []).forEach((se) => {
////        const purpose = String(se.purpose || "").toLowerCase();
////        const seType = String(se.stock_entry_type || "").toLowerCase();

////        const isMfg =
////          purpose.includes("manufact") ||
////          purpose.includes("repack") ||
////          seType.includes("manufact") ||
////          seType.includes("repack");

////        const isTransfer = purpose.includes("material transfer") || seType.includes("material transfer");

////        if (se.name) {
////          if (isMfg) manufacturingSE.add(se.name);
////          if (isTransfer) transferSE.add(se.name);
////        }
////      });

////      const reconNameSet = new Set((reconDocs || []).map((d) => d.name));
////      const reconFullDocs = await Promise.all(
////        (reconDocs || []).map((r) => getDoc("Stock Reconciliation", r.name).catch(() => null))
////      );

////      const allowedSet = new Set(allowedItemCodesRef.current);

////      const openingMap = {};
////      const movementMap = {};
////      const adjustmentMap = {};
////      const siTotalQtyMap = {};

////      const soldTotalMap = {};
////      const soldByCustomerMap = {};
////      const goodReturnMap = {};
////      const badReturnMap = {};

////      const packingActMap = {};
////      const lastBeforeDay = {};

////      (sleToSelected || []).forEach((entry) => {
////        const itemCode = entry.item_code;
////        const warehouse = entry.warehouse;
////        if (!itemCode || !warehouse) return;
////        if (!allowedSet.has(itemCode)) return;
////        if (!jhWarehouses.has(warehouse)) return;

////        const key = `${itemCode}||${warehouse}`;

////        const qty = parseFloat(entry.actual_qty) || 0;
////        const balance = parseFloat(entry.qty_after_transaction) || 0;

////        const rawVtype = entry.voucher_type || "";
////        const vtype = typeof rawVtype === "string" ? rawVtype.trim() : rawVtype;

////        const entryDate = entry.posting_date;
////        const ts = makeTs(entry);

////        const isRecon = reconNameSet.has(entry.voucher_no);

////        if (entryDate < selectedDate) {
////          const existing = lastBeforeDay[key];
////          if (!existing || ts > existing.ts) lastBeforeDay[key] = { ts, balance };
////        }

////        if (entryDate !== selectedDate) return;

////        if (vtype === "Sales Invoice") {
////          siTotalQtyMap[key] = (siTotalQtyMap[key] || 0) + qty;

////          const invName = entry.voucher_no;
////          const customer = invoiceToCustomer[invName] || "Unknown";

////          if (warehouse === WH_PACKING && qty < 0) {
////            const n = -Math.abs(qty);
////            soldTotalMap[key] = (soldTotalMap[key] || 0) + n;

////            if (!soldByCustomerMap[key]) soldByCustomerMap[key] = {};
////            soldByCustomerMap[key][customer] = (soldByCustomerMap[key][customer] || 0) + n;
////          }

////          if (qty > 0) {
////            if (warehouse === WH_PACKING) {
////              goodReturnMap[key] = (goodReturnMap[key] || 0) + qty;
////            } else if (warehouse === WH_DAMAGED) {
////              badReturnMap[key] = (badReturnMap[key] || 0) + qty;
////            } else {
////              goodReturnMap[key] = (goodReturnMap[key] || 0) + qty;
////            }
////          }

////          return;
////        }

////        if (warehouse === WH_PACKING && vtype === "Stock Entry") {
////          const seName = entry.voucher_no;
////          if (manufacturingSE.has(seName) || transferSE.has(seName)) {
////            packingActMap[key] = (packingActMap[key] || 0) + qty;
////          }
////        }

////        if (!isRecon) {
////          movementMap[key] = (movementMap[key] || 0) + qty;
////        }
////      });

////      Object.keys(lastBeforeDay).forEach((key) => {
////        openingMap[key] = lastBeforeDay[key].balance;
////      });

////      for (const doc of reconFullDocs || []) {
////        if (!doc) continue;
////        (doc.items || []).forEach((it) => {
////          const itemCode = it.item_code;
////          const warehouse = it.warehouse;
////          if (!itemCode || !warehouse) return;
////          if (!allowedSet.has(itemCode)) return;
////          if (!jhWarehouses.has(warehouse)) return;

////          const key = `${itemCode}||${warehouse}`;
////          const currentQty = parseFloat(it.current_qty || 0);
////          const newQty = parseFloat(it.qty || 0);
////          const delta = newQty - currentQty;

////          adjustmentMap[key] = (adjustmentMap[key] || 0) + delta;
////        });
////      }

////      const keys = new Set([
////        ...Object.keys(openingMap),
////        ...Object.keys(movementMap),
////        ...Object.keys(adjustmentMap),
////        ...Object.keys(siTotalQtyMap),
////        ...Object.keys(soldTotalMap),
////        ...Object.keys(goodReturnMap),
////        ...Object.keys(badReturnMap),
////        ...Object.keys(packingActMap),
////      ]);

////      const flat = Array.from(keys).map((key) => {
////        const [item_code, warehouse] = key.split("||");

////        const opening_stock = Number(openingMap[key] || 0);
////        const movement_qty = Number(movementMap[key] || 0);
////        const adjustment_qty = Number(adjustmentMap[key] || 0);

////        const si_qty_total = Number(siTotalQtyMap[key] || 0);

////        const sold_qty = Number(soldTotalMap[key] || 0);
////        const sold_by_customer = soldByCustomerMap[key] || {};

////        const good_return_qty = Number(goodReturnMap[key] || 0);
////        const bad_return_qty = Number(badReturnMap[key] || 0);

////        const packing_act_qty = Number(packingActMap[key] || 0);

////        const current_stock = opening_stock + movement_qty + adjustment_qty + si_qty_total;

////        const meta = allowedItemMapRef.current[item_code] || { item_name: "", item_group: "" };

////        return {
////          item_code,
////          item_name: meta.item_name || "",
////          item_group: meta.item_group || "",
////          warehouse,

////          opening_stock,
////          movement_qty,
////          adjustment_qty,

////          sold_qty,
////          sold_by_customer,
////          good_return_qty,
////          bad_return_qty,

////          packing_act_qty,

////          current_stock,
////        };
////      });

////      const pivotByItem = {};
////      (allowedItemCodesRef.current || []).forEach((code) => {
////        const meta = allowedItemMapRef.current[code] || {};
////        pivotByItem[code] = {
////          item_code: code,
////          item_name: meta.item_name || "",
////          item_group: meta.item_group || "",

////          opening_stock: 0,
////          adjustment_qty: 0,

////          sold_qty: 0,
////          sold_by_customer: {},

////          return_good_qty: 0,
////          return_bad_qty: 0,

////          other_activity_transit: 0,
////          other_activity_in_use: 0,
////          other_activity_rejected: 0,

////          packing_activity: 0,
////          stock_inward: 0,
////          wastage: 0,

////          current_stock: 0,
////        };
////      });

////      flat.forEach((r) => {
////        const pr = pivotByItem[r.item_code];
////        if (!pr) return;

////        pr.opening_stock += Number(r.opening_stock || 0);
////        pr.adjustment_qty += Number(r.adjustment_qty || 0);
////        pr.current_stock += Number(r.current_stock || 0);

////        pr.sold_qty += Number(r.sold_qty || 0);
////        Object.entries(r.sold_by_customer || {}).forEach(([cust, qty]) => {
////          pr.sold_by_customer[cust] = (pr.sold_by_customer[cust] || 0) + Number(qty || 0);
////        });

////        pr.return_good_qty += Number(r.good_return_qty || 0);
////        pr.return_bad_qty += Number(r.bad_return_qty || 0);

////        if (r.warehouse === WH_TRANSIT) pr.other_activity_transit += Number(r.movement_qty || 0);
////        if (r.warehouse === WH_IN_USE) pr.other_activity_in_use += Number(r.movement_qty || 0);
////        if (r.warehouse === WH_REJECTED) pr.other_activity_rejected += Number(r.movement_qty || 0);

////        if (r.warehouse === WH_PACKING) pr.packing_activity += Number(r.packing_act_qty || 0);

////        if (r.warehouse === WH_STOCK_INWARD) pr.stock_inward += Number(r.movement_qty || 0);
////        if (r.warehouse === WH_WASTAGE) pr.wastage += Number(r.movement_qty || 0);
////      });

////      const labelGroups = {};
////      Object.values(pivotByItem).forEach((it) => {
////        if (!ALLOWED_GROUP_SET.has(it.item_group)) return;
////        const label = baseHeadingLabel(it.item_name || it.item_code);
////        if (!labelGroups[label]) labelGroups[label] = [];
////        labelGroups[label].push(it.item_code);
////      });

////      const groupMeta = Object.keys(labelGroups).map((label) => {
////        const codes = labelGroups[label] || [];
////        let score = 0;
////        codes.forEach((code) => {
////          const r = pivotByItem[code];
////          if (!r) return;
////          score += getMovementScore(r);
////        });
////        return { label, score };
////      });

////      groupMeta.sort((a, b) => {
////        const aHas = a.score > 0;
////        const bHas = b.score > 0;
////        if (aHas !== bHas) return aHas ? -1 : 1;
////        if (aHas && bHas && a.score !== b.score) return b.score - a.score;
////        return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
////      });

////      const finalRows = [];
////      const newExpanded = {};

////      groupMeta.forEach(({ label }) => {
////        const codes = labelGroups[label] || [];
////        const sortedCodes = codes.slice().sort((a, b) => {
////          const aIsRaw = (pivotByItem[a]?.item_group || "").toLowerCase() === "raw material";
////          const bIsRaw = (pivotByItem[b]?.item_group || "").toLowerCase() === "raw material";
////          if (aIsRaw !== bIsRaw) return aIsRaw ? -1 : 1;

////          const aw = parseWeightToGrams(extractWeight(pivotByItem[a]?.item_name || a));
////          const bw = parseWeightToGrams(extractWeight(pivotByItem[b]?.item_name || b));
////          if (aw !== bw) return aw - bw;

////          const nA = (pivotByItem[a]?.item_name || a).toLowerCase();
////          const nB = (pivotByItem[b]?.item_name || b).toLowerCase();
////          return nA.localeCompare(nB);
////        });

////        const groupKey = `LBL:${label}`;

////        finalRows.push({
////          is_group_header: true,
////          group_item_code: groupKey,
////          group_label: label,
////        });

////        const parentCode =
////          sortedCodes.find((c) => (pivotByItem[c]?.item_group || "").toLowerCase() === "raw material") ||
////          sortedCodes[0];

////        sortedCodes.forEach((code) => {
////          const row = pivotByItem[code];
////          if (!row) return;

////          const isParent = code === parentCode;
////          finalRows.push({
////            ...row,
////            group_item_code: groupKey,
////            is_parent_item: isParent,
////            parent_item_code: isParent ? null : parentCode,
////          });
////        });

////        newExpanded[groupKey] = true;
////      });

////      setRows(finalRows);
////      setExpandedGroups(newExpanded);
////    } catch (err) {
////      console.error(err);
////      setError(err.message || "Failed to load daily stock summary");
////    } finally {
////      setLoading(false);
////    }
////  }, []);

////  useEffect(() => {
////    loadData(date);
////  }, [date, loadData]);

////  useEffect(() => {
////    if (selectedItemGroup !== "ALL" && !itemGroups.includes(selectedItemGroup)) {
////      setSelectedItemGroup("ALL");
////    }
////  }, [itemGroups, selectedItemGroup]);

////  // ✅ validate selected customer against ALL customers list
////  useEffect(() => {
////    if (selectedCustomer === "ALL") return;
////    if (!customers.some((c) => c.value === selectedCustomer)) {
////      setSelectedCustomer("ALL");
////    }
////  }, [customers, selectedCustomer]);

////  const columnOptions = useMemo(() => {
////    const opts = [{ value: "ALL", label: "All Columns" }];
////    COLUMNS.forEach((c) => opts.push({ value: c.key, label: c.label }));
////    return opts;
////  }, []);

////  const displayedColumns = useMemo(() => {
////    if (columnFilter === "ALL") return COLUMNS;
////    const found = COLUMNS.find((c) => c.key === columnFilter);
////    return found ? [found] : COLUMNS;
////  }, [columnFilter]);

////  // --- sub columns (when expanded) ---

////  // include ALL customers + also include any extra keys like "Unknown"
////  const soldSubcols = useMemo(() => {
////    const base = (customers || []).map((c) => ({ key: c.value, label: c.label }));
////    const known = new Set(base.map((x) => x.key));

////    const extra = new Set();
////    rows.forEach((r) => {
////      if (r.is_group_header) return;
////      Object.keys(r.sold_by_customer || {}).forEach((k) => {
////        if (!known.has(k)) extra.add(k); // e.g. "Unknown"
////      });
////    });

////    const extraCols = Array.from(extra)
////      .sort((a, b) => a.localeCompare(b))
////      .map((k) => ({ key: k, label: k }));

////    const all = [...base, ...extraCols];
////    return all.length ? all : [{ key: "__NONE__", label: "(No customers)" }];
////  }, [customers, rows]);

////  const returnSubcols = useMemo(
////    () => [
////      { key: "GOOD", label: "Good" },
////      { key: "BAD", label: "Bad" },
////    ],
////    []
////  );

////  const otherSubcols = useMemo(
////    () => [
////      { key: "TRANSIT", label: "Transit" },
////      { key: "IN_USE", label: "In use" },
////      { key: "REJECTED", label: "Rejected Material" },
////    ],
////    []
////  );

////  // build columns used by the table (some become groups when expanded)
////  const effectiveColumns = useMemo(() => {
////    const out = [];
////    displayedColumns.forEach((c) => {
////      if (c.key === "sold_qty" && expandedMetrics.sold_qty) {
////        out.push({ type: "group", key: "sold_qty", label: "Sold Qty", subcols: soldSubcols });
////        return;
////      }
////      if (c.key === "return_qty" && expandedMetrics.return_qty) {
////        out.push({ type: "group", key: "return_qty", label: "Return Qty", subcols: returnSubcols });
////        return;
////      }
////      if (c.key === "other_activity" && expandedMetrics.other_activity) {
////        out.push({ type: "group", key: "other_activity", label: "Other Activity", subcols: otherSubcols });
////        return;
////      }
////      out.push({ type: "col", ...c });
////    });
////    return out;
////  }, [displayedColumns, expandedMetrics, soldSubcols, returnSubcols, otherSubcols]);

////  const leafColumnCount = useMemo(() => {
////    return effectiveColumns.reduce((sum, c) => {
////      if (c.type === "group") return sum + (c.subcols?.length || 0);
////      return sum + 1;
////    }, 0);
////  }, [effectiveColumns]);

////  // ✅ this replaces: 1 + displayedColumns.length
////  const colCount = 1 + leafColumnCount;


////  const lowerSearch = searchTerm.trim().toLowerCase();
////  let displayRows = rows;

////  const needsFiltering = lowerSearch || selectedItemGroup !== "ALL";

////  if (needsFiltering) {
////    const passesItemGroup = (d) => selectedItemGroup === "ALL" || (d.item_group || "") === selectedItemGroup;

////    const passesSearch = (d) => {
////      if (!lowerSearch) return true;

////      const name = (d.item_name || "").toLowerCase();
////      const codeStr = (d.item_code || "").toLowerCase();

////      if (name.includes(lowerSearch) || codeStr.includes(lowerSearch)) return true;

////      if (lowerSearch.includes("transit")) return Number(d.other_activity_transit || 0) !== 0;
////      if (lowerSearch.includes("reject")) return Number(d.other_activity_rejected || 0) !== 0;
////      if (lowerSearch.includes("use") || lowerSearch.includes("wip")) return Number(d.other_activity_in_use || 0) !== 0;

////      if (lowerSearch.includes("inward")) return Number(d.stock_inward || 0) !== 0;
////      if (lowerSearch.includes("pack")) return Number(d.packing_activity || 0) !== 0;
////      if (lowerSearch.includes("waste")) return Number(d.wastage || 0) !== 0;

////      return false;
////    };

////    const groups = {};
////    rows.forEach((r, idx) => {
////      if (r.is_group_header) {
////        const code = r.group_item_code || `__header_${idx}`;
////        if (!groups[code]) groups[code] = { header: r, details: [], firstIndex: idx };
////        else groups[code].header = r;
////      } else {
////        const code = r.group_item_code || r.item_code || `__row_${idx}`;
////        if (!groups[code]) groups[code] = { header: null, details: [], firstIndex: idx };
////        groups[code].details.push(r);
////      }
////    });

////    const orderedCodes = Object.keys(groups).sort((a, b) => groups[a].firstIndex - groups[b].firstIndex);
////    const filtered = [];

////    orderedCodes.forEach((code) => {
////      const g = groups[code];
////      const header = g.header;
////      const details = g.details;

////      const detailsByGroup = details.filter(passesItemGroup);

////      const headerMatches =
////        !!lowerSearch &&
////        header &&
////        ((header.group_label || "").toLowerCase().includes(lowerSearch) ||
////          (header.group_item_code || "").toLowerCase().includes(lowerSearch));

////      const detailsBySearchAndGroup = detailsByGroup.filter(passesSearch);

////      if (headerMatches && detailsByGroup.length > 0) {
////        if (header) filtered.push(header);
////        detailsByGroup.forEach((d) => filtered.push(d));
////        return;
////      }

////      if (detailsBySearchAndGroup.length > 0) {
////        if (header) filtered.push(header);
////        detailsBySearchAndGroup.forEach((d) => filtered.push(d));
////      }
////    });

////    displayRows = filtered;
////  }

////  const allGroupKeys = useMemo(
////    () => rows.filter((r) => r.is_group_header).map((r) => r.group_item_code),
////    [rows]
////  );

////  const visibleGroupKeySet = useMemo(() => {
////    if (needsFiltering) return new Set(allGroupKeys);
////    return new Set(allGroupKeys.slice(0, visibleGroupCount));
////  }, [needsFiltering, allGroupKeys, visibleGroupCount]);

////  displayRows = displayRows.filter((r) => {
////    if (!r.group_item_code) return true;
////    return visibleGroupKeySet.has(r.group_item_code);
////  });

////  useEffect(() => {
////    setVisibleGroupCount(GROUP_PAGE_SIZE);
////  }, [date]);

////  useEffect(() => {
////    if (needsFiltering) return;
////    const el = sentinelRef.current;
////    if (!el) return;

////    const obs = new IntersectionObserver(
////      (entries) => {
////        if (!entries?.[0]?.isIntersecting) return;
////        setVisibleGroupCount((v) => Math.min(v + GROUP_PAGE_SIZE, allGroupKeys.length));
////      },
////      { root: null, rootMargin: "250px", threshold: 0 }
////    );

////    obs.observe(el);
////    return () => obs.disconnect();
////  }, [needsFiltering, allGroupKeys.length]);

////  const visibleRowCount = displayRows.reduce((count, r) => {
////    if (r.is_group_header) return count;
////    if (!needsFiltering && r.group_item_code && expandedGroups[r.group_item_code] === false) return count;
////    return count + 1;
////  }, 0);

////  function isAllZeroRow(r) {
////    const keys = [
////      "opening_stock",
////      "adjustment_qty",
////      "sold_qty",
////      "return_good_qty",
////      "return_bad_qty",
////      "other_activity_transit",
////      "other_activity_in_use",
////      "other_activity_rejected",
////      "packing_activity",
////      "stock_inward",
////      "wastage",
////      "current_stock",
////    ];
////    return keys.every((k) => Number(r[k] || 0) === 0);
////  }

////  function downloadSummaryAsCsv() {
////    const dataRows = [];

////    displayRows.forEach((r) => {
////      if (r.is_group_header) return;
////      if (isAllZeroRow(r)) return;

////      const row = {
////        "Item Code": r.item_code || "",
////        "Item Name": r.item_name || "",
////        "Item Group": r.item_group || "",
////      };

////      displayedColumns.forEach((c) => {
////        row[c.label] = getCellValue(r, c.key);
////      });

////      dataRows.push(row);
////    });

////    if (dataRows.length === 0) {
////      window.alert("Nothing to download (all rows are zero).");
////      return;
////    }

////    const headers = Object.keys(dataRows[0]);
////    const lines = [];
////    lines.push(headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(","));

////    dataRows.forEach((row) => {
////      lines.push(headers.map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(","));
////    });

////    const csv = lines.join("\n");
////    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
////    const url = URL.createObjectURL(blob);

////    const link = document.createElement("a");
////    link.href = url;
////    link.download = `daily-stock-summary-${date}.csv`;
////    document.body.appendChild(link);
////    link.click();
////    document.body.removeChild(link);
////    URL.revokeObjectURL(url);
////  }

////  const renderColumnCell = (r, c) => {
////    const val = getCellValue(r, c.key);
////    if (c.noDot) return <span>{val}</span>;
////    return <DotCell value={val} />;
////  };

////  const getDisplayItemPrimary = (r) => {
////    const cleaned = cleanLabel(r.item_name || r.item_code);

////    if (r.is_parent_item && String(r.item_group || "").toLowerCase().includes("raw")) {
////      return "Raw";
////    }

////    if (!!r.parent_item_code && !r.is_parent_item) {
////      const w = extractWeight(cleaned);
////      return w || cleaned;
////    }

////    return cleaned;
////  };

////  return (
////    <div className="daily-stock-summary">
////      <div className="daily-stock-summary-header-row">
////        <div className="daily-stock-summary-header">
////          <h2 className="daily-stock-summary-title">Daily Stock Summary</h2>
////          <p className="daily-stock-summary-subtitle">Sold/Return/Other Activity filters affect only those columns</p>
////        </div>

////        <div className="daily-stock-summary-controls">
////          <span className="daily-stock-summary-date-label">Date</span>
////          <input
////            type="date"
////            className="input daily-stock-summary-date-input"
////            value={date}
////            onChange={(e) => setDate(e.target.value)}
////          />

////          <select
////            className="input daily-stock-summary-group-filter"
////            value={selectedItemGroup}
////            onChange={(e) => setSelectedItemGroup(e.target.value)}
////            title="Filter rows by Item Group"
////          >
////            <option value="ALL">All Item Groups</option>
////            {itemGroups.map((g) => (
////              <option key={g} value={g}>
////                {g}
////              </option>
////            ))}
////          </select>

////          <select
////            className="input daily-stock-summary-column-filter"
////            value={columnFilter}
////            onChange={(e) => setColumnFilter(e.target.value)}
////            title="Show Item + selected column only"
////          >
////            {columnOptions.map((o) => (
////              <option key={o.value} value={o.value}>
////                {o.label}
////              </option>
////            ))}
////          </select>

////          <input
////            type="text"
////            className="input daily-stock-summary-search-input"
////            placeholder="Search item / code / transit / rejected / inward / pack / wastage"
////            value={searchTerm}
////            onChange={(e) => setSearchTerm(e.target.value)}
////          />

////          <button type="button" className="btn btn-secondary btn-sm daily-stock-summary-download" onClick={downloadSummaryAsCsv}>
////            Download Excel
////          </button>

////          <button type="button" className="btn btn-primary btn-sm daily-stock-summary-refresh" onClick={() => loadData(date)}>
////            Refresh
////          </button>
////        </div>
////      </div>

////      <div className="daily-stock-summary-meta-row">
////        <span className="daily-stock-summary-meta">
////          Showing {visibleRowCount} line{visibleRowCount !== 1 ? "s" : ""}
////        </span>
////      </div>

////      {loading && <p className="daily-stock-summary-loading text-muted">Loading stock summary...</p>}
////      {error && <p className="daily-stock-summary-error alert alert-error">{error}</p>}
////      {!loading && !error && displayRows.length === 0 && <p className="daily-stock-summary-empty text-muted">No rows match your filters.</p>}

////      {!loading && !error && displayRows.length > 0 && (
////        <div className="daily-stock-summary-table-wrapper">
////          <table className="daily-stock-summary-table">
////            <thead>
////              <tr>
////                <th rowSpan={2}>Item</th>

////                {effectiveColumns.map((c) => {
////                  const isExpandable =
////                    c.key === "sold_qty" || c.key === "return_qty" || c.key === "other_activity";
////                  const isOpen = !!expandedMetrics[c.key];

////                  // Expanded group header (spans multiple cols)
////                  if (c.type === "group") {
////                    return (
////                      <th key={c.key} colSpan={c.subcols.length} className="dss-group-th">
////                        <button type="button" className="dss-expand-btn" onClick={() => toggleMetric(c.key)}>
////                          {c.label} <span className="dss-caret">{isOpen ? "▴" : "▾"}</span>
////                        </button>
////                      </th>
////                    );
////                  }

////                  // Normal single header (rowSpan=2)
////                  return (
////                    <th key={c.key} rowSpan={2} className={isExpandable ? "dss-expandable-th" : undefined}>
////                      {isExpandable ? (
////                        <button type="button" className="dss-expand-btn" onClick={() => toggleMetric(c.key)}>
////                          {c.label} <span className="dss-caret">{isOpen ? "▴" : "▾"}</span>
////                        </button>
////                      ) : (
////                        c.label
////                      )}
////                    </th>
////                  );
////                })}
////              </tr>

////              <tr>
////                {effectiveColumns.map((c) => {
////                  if (c.type !== "group") return null;
////                  return c.subcols.map((sc) => (
////                    <th key={`${c.key}-${sc.key}`} className="dss-sub-th">
////                      {sc.label}
////                    </th>
////                  ));
////                })}
////              </tr>
////            </thead>


////            <tbody>
////              {displayRows.map((r, idx) => {
////                if (r.is_group_header) {
////                  const isOpen = expandedGroups[r.group_item_code] !== false;
////                  return (
////                    <tr
////                      key={`group-${r.group_item_code}-${idx}`}
////                      className="daily-stock-summary-group-row"
////                      onClick={() =>
////                        setExpandedGroups((prev) => ({
////                          ...prev,
////                          [r.group_item_code]: !isOpen,
////                        }))
////                      }
////                    >
////                      <td className="daily-stock-summary-group-header" colSpan={colCount}>
////                        <span className="daily-stock-summary-group-icon">📦</span> {r.group_label}
////                        <span className="daily-stock-summary-group-toggle">{isOpen ? "▾" : "▸"}</span>
////                      </td>
////                    </tr>
////                  );
////                }

////                if (!needsFiltering && r.group_item_code && expandedGroups[r.group_item_code] === false) {
////                  return null;
////                }

////                const topLabel = getDisplayItemPrimary(r);

////                return (
////                  <tr
////                    key={`${r.item_code}||${r.parent_item_code || ""}||${r.group_item_code || ""}`}
////                    className={[
////                      r.is_parent_item ? "daily-stock-summary-row-parent" : "",
////                      !!r.parent_item_code && !r.is_parent_item ? "daily-stock-summary-row-child" : "",
////                    ]
////                      .join(" ")
////                      .trim()}
////                  >
////                    <td className="daily-stock-summary-item">
////                      <div className="daily-stock-summary-item-code">{topLabel}</div>
////                    </td>

////                    {effectiveColumns.map((c) => {
////                      // expanded: Sold Qty → customer breakdown only (NO "All")
////                      if (c.type === "group" && c.key === "sold_qty") {
////                        return c.subcols.map((sc) => (
////                          <td key={`${r.item_code}-sold-${sc.key}`} className="daily-stock-summary-num">
////                            <DotCell value={Number(r.sold_by_customer?.[sc.key] || 0)} />
////                          </td>
////                        ));
////                      }

////                      // expanded: Return Qty → Good/Bad only (NO "All")
////                      if (c.type === "group" && c.key === "return_qty") {
////                        return c.subcols.map((sc) => (
////                          <td key={`${r.item_code}-ret-${sc.key}`} className="daily-stock-summary-num">
////                            <DotCell value={sc.key === "GOOD" ? Number(r.return_good_qty || 0) : Number(r.return_bad_qty || 0)} />
////                          </td>
////                        ));
////                      }

////                      // expanded: Other Activity → Transit/In use/Rejected only (NO "All")
////                      if (c.type === "group" && c.key === "other_activity") {
////                        return c.subcols.map((sc) => {
////                          const v =
////                            sc.key === "TRANSIT"
////                              ? Number(r.other_activity_transit || 0)
////                              : sc.key === "IN_USE"
////                                ? Number(r.other_activity_in_use || 0)
////                                : Number(r.other_activity_rejected || 0);

////                          return (
////                            <td key={`${r.item_code}-oa-${sc.key}`} className="daily-stock-summary-num">
////                              <DotCell value={v} />
////                            </td>
////                          );
////                        });
////                      }

////                      // normal column (including collapsed sold/return/other = All totals)
////                      return (
////                        <td key={`${r.item_code}-${c.key}`} className="daily-stock-summary-num">
////                          {renderColumnCell(r, c)}
////                        </td>
////                      );
////                    })}

////                  </tr>
////                );
////              })}
////            </tbody>
////          </table>

////          {!needsFiltering && visibleGroupCount < allGroupKeys.length && <div ref={sentinelRef} style={{ height: 1 }} />}
////        </div>
////      )}
////    </div>
////  );
////}

////export default DailyStockSummary;


//// src/Components/DailyStockSummary.jsx
//import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
//import { getStockLedgerUpToDate, getDoctypeList, getDoc } from "./erpBackendApi";
//import "../CSS/DailyStockSummary.css";

//// * Definations------>
//// * Parent warehouse:
//// *  - Opening Stock  = SUM of stock in ALL child warehouses under "Jharkahand Warehouse - MF" at start of day
//// *  - Current Stock  = SUM of stock in ALL child warehouses under "Jharkahand Warehouse - MF" at end of selected day
//// *
//// * Columns:
//// *  - Packing Activity = stock change in Finished Goods warehouse ONLY from:
//// *      (1) Manufacturing Stock Entries
//// *      (2) Stock Transfer Stock Entries
//// *  - Stock Inward     = stock change in Raw Material warehouse by any non-reconciliation movement (includes stock transfers)
//// *  - Sold Qty         = stock change in Finished Goods due to Sales Invoice (customer breakdown in expanded view)
//// *  - Return Qty       = Good -> return into Finished Goods (Sales Invoice stock-in)
//// *                     = Bad  -> return into Damaged (Sales Invoice stock-in)
//// *  - Reconciliation   = delta from Stock Reconciliation (any Jharkahand child warehouse)
//// *
//// * ❌ Removed from totals + UI:
//// *  - Transit (Goods In Transit - MF)
//// *  - In Use (Work In Progress - MF)
//// *  - Wastage (Wastage - MF)
//// *  - Rejected (Rejected Warehouse - MF)

//const ROOT_WAREHOUSE = "Jharkahand Warehouse - MF";

//const ALLOWED_GROUPS = ["Raw Material", "Products"];
//const ALLOWED_GROUP_SET = new Set(ALLOWED_GROUPS);

//const WH_STOCK_INWARD = "Raw Material - MF";
//const WH_PACKING = "Finished Goods - MF";
//// const WH_WASTAGE = "Wastage - MF";                // ❌ removed
//// const WH_TRANSIT = "Goods In Transit - MF";       // ❌ removed
//// const WH_IN_USE = "Work In Progress - MF";        // ❌ removed
//const WH_DAMAGED = "Damaged - MF";
//// const WH_REJECTED = "Rejected Warehouse - MF";    // ❌ removed

//// ✅ Exclude these warehouses completely from Opening/Current calculations
//const EXCLUDED_WAREHOUSES = new Set([
//  "Wastage - MF",
//  "Goods In Transit - MF",
//  "Work In Progress - MF",
//  "Rejected Warehouse - MF",
//]);

//const RETURN_TYPES = { ALL: "ALL", GOOD: "GOOD", BAD: "BAD" };

//// ✅ Column list: keep your current columns (but remove wastage/other_activity from UI)
//const COLUMNS = [
//  { key: "opening_stock", label: "Opening Stock (TOTAL)", noDot: true },
//  { key: "adjustment_qty", label: "Reconciliation" },
//  { key: "sold_qty", label: "Sold Qty" },
//  { key: "return_qty", label: "Return Qty" },
//  // { key: "other_activity", label: "Other Activity" }, // ❌ removed
//  { key: "current_stock", label: "Current Stock (TOTAL)", noDot: true },
//  { key: "packing_activity", label: "Paking Activity" },
//  { key: "stock_inward", label: "Stock Inward" },
//  // { key: "wastage", label: "Wastage" }, // ❌ removed
//];

//const GROUP_PAGE_SIZE = 4;

//function DailyStockSummary() {
//  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
//  const [rows, setRows] = useState([]);
//  const [expandedGroups, setExpandedGroups] = useState({});
//  const [loading, setLoading] = useState(false);
//  const [error, setError] = useState("");

//  const [searchTerm, setSearchTerm] = useState("");

//  const [itemGroups, setItemGroups] = useState(ALLOWED_GROUPS);
//  const [selectedItemGroup, setSelectedItemGroup] = useState("ALL");

//  const [columnFilter, setColumnFilter] = useState("ALL");

//  // ✅ Category filter (optional UI later if you want)
//  const [categories, setCategories] = useState([]);
//  const [selectedCategory, setSelectedCategory] = useState("ALL");

//  // ✅ Movement only button (UI)
//  const [movementOnly, setMovementOnly] = useState(false);

//  // ✅ customers as options: [{value, label}]
//  const [customers, setCustomers] = useState([]);
//  const [selectedCustomer, setSelectedCustomer] = useState("ALL");

//  const [selectedReturnType, setSelectedReturnType] = useState(RETURN_TYPES.ALL);

//  const [visibleGroupCount, setVisibleGroupCount] = useState(GROUP_PAGE_SIZE);
//  const sentinelRef = useRef(null);

//  const allowedItemsLoadedRef = useRef(false);
//  const allowedItemMapRef = useRef({});
//  const allowedItemCodesRef = useRef([]);

//  // ✅ customers cache (load once)
//  const customersLoadedRef = useRef(false);

//  // keep your existing expandable columns logic (ONLY Sold/Return remain)
//  const [expandedMetrics, setExpandedMetrics] = useState({
//    sold_qty: false,
//    return_qty: false,
//    // other_activity: false, // ❌ removed
//  });

//  const toggleMetric = (key) => {
//    setExpandedMetrics((prev) => ({ ...prev, [key]: !prev[key] }));
//  };

//  function makeTs(entry) {
//    return `${entry.posting_date} ${entry.posting_time || "00:00:00"}`;
//  }

//  function cleanLabel(s) {
//    let x = String(s || "");
//    x = x.replace(/^\s*raw\s+/i, "");
//    x = x.replace(/\s+/g, " ").trim();
//    return x;
//  }

//  function extractWeight(s) {
//    const str = String(s || "");
//    const m1 = str.match(/\(([^)]+)\)/);
//    if (m1 && m1[1]) return m1[1].trim();

//    const m2 = str.match(/\b\d+(\.\d+)?\s*(kg|g|gm|grams|ml|l)\b/i);
//    if (m2) return m2[0].trim();

//    return "";
//  }

//  function baseHeadingLabel(nameOrCode) {
//    let s = cleanLabel(nameOrCode);
//    s = s.replace(/\([^)]*\)/g, " ");
//    s = s.replace(/\b\d+(\.\d+)?\s*(kg|g|gm|grams|ml|l)\b/gi, " ");
//    s = s.replace(/\s+/g, " ").trim();
//    return s || String(nameOrCode || "");
//  }

//  function parseWeightToGrams(weightStr) {
//    const w = String(weightStr || "").trim().toLowerCase();
//    const m = w.match(/(\d+(\.\d+)?)\s*(kg|g|gm|grams|ml|l)\b/);
//    if (!m) return Number.POSITIVE_INFINITY;
//    const num = parseFloat(m[1]);
//    const unit = m[3];
//    if (!isFinite(num)) return Number.POSITIVE_INFINITY;
//    if (unit === "kg" || unit === "l") return num * 1000;
//    return num;
//  }

//  // ✅ Replace DotCell only (no other logic changes)
//  const DotCell = ({ value }) => {
//    const n = Number(value || 0);
//    if (n === 0) return <span>0</span>;

//    const isPos = n > 0;
//    const color = isPos ? "#16a34a" : "#dc2626";
//    const sign = isPos ? "+" : "−"; // minus for negative

//    return (
//      <span
//        style={{
//          display: "inline-flex",
//          alignItems: "center",
//          gap: 6,
//          color,
//          fontWeight: 600,
//        }}
//      >
//        <span style={{ fontWeight: 800 }}>{sign}</span>
//        <span>{Math.abs(n)}</span>
//      </span>
//    );
//  };


//  // Collapsed view always shows totals
//  const getSoldValue = (r) => Number(r.sold_qty || 0);

//  const getReturnValue = (r) =>
//    Number(r.return_good_qty || 0) + Number(r.return_bad_qty || 0);

//  const getCellValue = (r, key) => {
//    if (key === "sold_qty") return getSoldValue(r);
//    if (key === "return_qty") return getReturnValue(r);
//    return Number(r[key] || 0);
//  };

//  const getMovementScore = (r) => {
//    const parts = [
//      "adjustment_qty",
//      "sold_qty",
//      "return_good_qty",
//      "return_bad_qty",
//      "packing_activity",
//      "stock_inward",
//      // "wastage", // ❌ removed
//      // other_activity_* // ❌ removed
//    ];
//    return parts.reduce((sum, k) => sum + Math.abs(Number(r[k] || 0)), 0);
//  };

//  async function loadAllowedItemsOnce() {
//    if (allowedItemsLoadedRef.current) return;

//    const pageSize = 2000;
//    let start = 0;
//    const all = [];

//    while (true) {
//      const part = await getDoctypeList("Item", {
//        fields: JSON.stringify(["name", "item_name", "item_group", "custom_category"]),
//        filters: JSON.stringify([["Item", "item_group", "in", ALLOWED_GROUPS]]),
//        limit_page_length: pageSize,
//        limit_start: start,
//      });

//      all.push(...(part || []));
//      if (!part || part.length < pageSize) break;
//      start += pageSize;
//      if (start > 200000) break;
//    }

//    const map = {};
//    const codes = [];
//    const catSet = new Set();

//    (all || []).forEach((it) => {
//      if (!it?.name) return;
//      if (!ALLOWED_GROUP_SET.has(it.item_group)) return;

//      map[it.name] = {
//        item_name: it.item_name || "",
//        item_group: it.item_group || "",
//        custom_category: it.custom_category || "",
//      };
//      codes.push(it.name);

//      const c = String(it.custom_category || "").trim();
//      if (c) catSet.add(c);
//    });

//    allowedItemMapRef.current = map;
//    allowedItemCodesRef.current = codes;
//    allowedItemsLoadedRef.current = true;

//    setItemGroups(ALLOWED_GROUPS);
//    setCategories(Array.from(catSet).sort((a, b) => a.localeCompare(b)));
//  }

//  async function loadCustomersOnce() {
//    if (customersLoadedRef.current) return;

//    const pageSize = 2000;
//    let start = 0;
//    const out = [];

//    while (true) {
//      const part = await getDoctypeList("Customer", {
//        fields: JSON.stringify(["name", "customer_name", "disabled"]),
//        filters: JSON.stringify([["Customer", "disabled", "=", 0]]),
//        limit_page_length: pageSize,
//        limit_start: start,
//      });

//      out.push(...(part || []));
//      if (!part || part.length < pageSize) break;
//      start += pageSize;
//      if (start > 200000) break;
//    }

//    const opts = (out || [])
//      .filter((c) => c?.name)
//      .map((c) => ({ value: c.name, label: c.customer_name || c.name }))
//      .sort((a, b) => a.label.localeCompare(b.label));

//    customersLoadedRef.current = true;
//    setCustomers(opts);
//  }

//  const loadData = useCallback(async (selectedDate) => {
//    setLoading(true);
//    setError("");
//    setRows([]);
//    setExpandedGroups({});
//    setVisibleGroupCount(GROUP_PAGE_SIZE);

//    try {
//      await loadAllowedItemsOnce();
//      await loadCustomersOnce();

//      const [sleToSelected, reconDocs, siList, whList, seList] = await Promise.all([
//        getStockLedgerUpToDate(selectedDate),

//        getDoctypeList("Stock Reconciliation", {
//          fields: JSON.stringify(["name", "posting_date", "docstatus"]),
//          filters: JSON.stringify([
//            ["Stock Reconciliation", "posting_date", "=", selectedDate],
//            ["Stock Reconciliation", "docstatus", "=", 1],
//          ]),
//          limit_page_length: 500,
//        }),

//        getDoctypeList("Sales Invoice", {
//          fields: JSON.stringify(["name", "customer", "posting_date", "docstatus"]),
//          filters: JSON.stringify([
//            ["Sales Invoice", "posting_date", "=", selectedDate],
//            ["Sales Invoice", "docstatus", "=", 1],
//          ]),
//          limit_page_length: 20000,
//        }),

//        getDoctypeList("Warehouse", {
//          fields: JSON.stringify(["name", "parent_warehouse", "is_group"]),
//          limit_page_length: 20000,
//        }),

//        getDoctypeList("Stock Entry", {
//          fields: JSON.stringify(["name", "purpose", "stock_entry_type", "posting_date", "docstatus"]),
//          filters: JSON.stringify([
//            ["Stock Entry", "posting_date", "=", selectedDate],
//            ["Stock Entry", "docstatus", "=", 1],
//          ]),
//          limit_page_length: 20000,
//        }),
//      ]);

//      const invoiceToCustomer = {};
//      (siList || []).forEach((si) => {
//        if (si?.name) invoiceToCustomer[si.name] = si.customer || "";
//      });

//      const childrenByParent = {};
//      (whList || []).forEach((w) => {
//        const p = w.parent_warehouse || "";
//        if (!childrenByParent[p]) childrenByParent[p] = [];
//        childrenByParent[p].push(w.name);
//      });

//      const jhWarehouses = new Set();
//      const stack = [ROOT_WAREHOUSE];
//      while (stack.length) {
//        const w = stack.pop();
//        if (!w || jhWarehouses.has(w)) continue;
//        jhWarehouses.add(w);
//        const kids = childrenByParent[w] || [];
//        kids.forEach((k) => stack.push(k));
//      }

//      const manufacturingSE = new Set();
//      const transferSE = new Set();

//      (seList || []).forEach((se) => {
//        const purpose = String(se.purpose || "").toLowerCase();
//        const seType = String(se.stock_entry_type || "").toLowerCase();

//        const isMfg =
//          purpose.includes("manufact") ||
//          purpose.includes("repack") ||
//          seType.includes("manufact") ||
//          seType.includes("repack");

//        const isTransfer =
//          purpose.includes("material transfer") || seType.includes("material transfer");

//        if (se.name) {
//          if (isMfg) manufacturingSE.add(se.name);
//          if (isTransfer) transferSE.add(se.name);
//        }
//      });

//      const reconNameSet = new Set((reconDocs || []).map((d) => d.name));
//      const reconFullDocs = await Promise.all(
//        (reconDocs || []).map((r) => getDoc("Stock Reconciliation", r.name).catch(() => null))
//      );

//      const allowedSet = new Set(allowedItemCodesRef.current);

//      const openingMap = {};
//      const movementMap = {};
//      const adjustmentMap = {};
//      const siTotalQtyMap = {};

//      const soldTotalMap = {};
//      const soldByCustomerMap = {};
//      const goodReturnMap = {};
//      const badReturnMap = {};

//      const packingActMap = {};
//      const lastBeforeDay = {};

//      (sleToSelected || []).forEach((entry) => {
//        const itemCode = entry.item_code;
//        const warehouse = entry.warehouse;
//        if (!itemCode || !warehouse) return;
//        if (!allowedSet.has(itemCode)) return;
//        if (!jhWarehouses.has(warehouse)) return;

//        // ✅ removed warehouses do NOT participate in opening/current
//        if (EXCLUDED_WAREHOUSES.has(warehouse)) return;

//        const key = `${itemCode}||${warehouse}`;

//        const qty = parseFloat(entry.actual_qty) || 0;
//        const balance = parseFloat(entry.qty_after_transaction) || 0;

//        const rawVtype = entry.voucher_type || "";
//        const vtype = typeof rawVtype === "string" ? rawVtype.trim() : rawVtype;

//        const entryDate = entry.posting_date;
//        const ts = makeTs(entry);

//        const isRecon = reconNameSet.has(entry.voucher_no);

//        if (entryDate < selectedDate) {
//          const existing = lastBeforeDay[key];
//          if (!existing || ts > existing.ts) lastBeforeDay[key] = { ts, balance };
//        }

//        if (entryDate !== selectedDate) return;

//        if (vtype === "Sales Invoice") {
//          siTotalQtyMap[key] = (siTotalQtyMap[key] || 0) + qty;

//          const invName = entry.voucher_no;
//          const customer = invoiceToCustomer[invName] || "Unknown";

//          if (warehouse === WH_PACKING && qty < 0) {
//            const n = -Math.abs(qty);
//            soldTotalMap[key] = (soldTotalMap[key] || 0) + n;

//            if (!soldByCustomerMap[key]) soldByCustomerMap[key] = {};
//            soldByCustomerMap[key][customer] =
//              (soldByCustomerMap[key][customer] || 0) + n;
//          }

//          if (qty > 0) {
//            if (warehouse === WH_PACKING) {
//              goodReturnMap[key] = (goodReturnMap[key] || 0) + qty;
//            } else if (warehouse === WH_DAMAGED) {
//              badReturnMap[key] = (badReturnMap[key] || 0) + qty;
//            } else {
//              goodReturnMap[key] = (goodReturnMap[key] || 0) + qty;
//            }
//          }

//          return;
//        }

//        if (warehouse === WH_PACKING && vtype === "Stock Entry") {
//          const seName = entry.voucher_no;
//          if (manufacturingSE.has(seName) || transferSE.has(seName)) {
//            packingActMap[key] = (packingActMap[key] || 0) + qty;
//          }
//        }

//        if (!isRecon) {
//          movementMap[key] = (movementMap[key] || 0) + qty;
//        }
//      });

//      Object.keys(lastBeforeDay).forEach((key) => {
//        openingMap[key] = lastBeforeDay[key].balance;
//      });

//      for (const doc of reconFullDocs || []) {
//        if (!doc) continue;
//        (doc.items || []).forEach((it) => {
//          const itemCode = it.item_code;
//          const warehouse = it.warehouse;
//          if (!itemCode || !warehouse) return;
//          if (!allowedSet.has(itemCode)) return;
//          if (!jhWarehouses.has(warehouse)) return;

//          // ✅ removed warehouses do NOT participate in opening/current
//          if (EXCLUDED_WAREHOUSES.has(warehouse)) return;

//          const key = `${itemCode}||${warehouse}`;
//          const currentQty = parseFloat(it.current_qty || 0);
//          const newQty = parseFloat(it.qty || 0);
//          const delta = newQty - currentQty;

//          adjustmentMap[key] = (adjustmentMap[key] || 0) + delta;
//        });
//      }

//      const keys = new Set([
//        ...Object.keys(openingMap),
//        ...Object.keys(movementMap),
//        ...Object.keys(adjustmentMap),
//        ...Object.keys(siTotalQtyMap),
//        ...Object.keys(soldTotalMap),
//        ...Object.keys(goodReturnMap),
//        ...Object.keys(badReturnMap),
//        ...Object.keys(packingActMap),
//      ]);

//      const flat = Array.from(keys).map((key) => {
//        const [item_code, warehouse] = key.split("||");

//        const opening_stock = Number(openingMap[key] || 0);
//        const movement_qty = Number(movementMap[key] || 0);
//        const adjustment_qty = Number(adjustmentMap[key] || 0);

//        const si_qty_total = Number(siTotalQtyMap[key] || 0);

//        const sold_qty = Number(soldTotalMap[key] || 0);
//        const sold_by_customer = soldByCustomerMap[key] || {};

//        const good_return_qty = Number(goodReturnMap[key] || 0);
//        const bad_return_qty = Number(badReturnMap[key] || 0);

//        const packing_act_qty = Number(packingActMap[key] || 0);

//        const current_stock =
//          opening_stock + movement_qty + adjustment_qty + si_qty_total;

//        const meta = allowedItemMapRef.current[item_code] || {
//          item_name: "",
//          item_group: "",
//          custom_category: "",
//        };

//        return {
//          item_code,
//          item_name: meta.item_name || "",
//          item_group: meta.item_group || "",
//          custom_category: meta.custom_category || "",
//          warehouse,

//          opening_stock,
//          movement_qty,
//          adjustment_qty,

//          sold_qty,
//          sold_by_customer,
//          good_return_qty,
//          bad_return_qty,

//          packing_act_qty,

//          current_stock,
//        };
//      });

//      // Pivot init for all allowed items
//      const pivotByItem = {};
//      (allowedItemCodesRef.current || []).forEach((code) => {
//        const meta = allowedItemMapRef.current[code] || {};
//        pivotByItem[code] = {
//          item_code: code,
//          item_name: meta.item_name || "",
//          item_group: meta.item_group || "",
//          custom_category: meta.custom_category || "",

//          opening_stock: 0,
//          adjustment_qty: 0,

//          sold_qty: 0,
//          sold_by_customer: {},

//          return_good_qty: 0,
//          return_bad_qty: 0,

//          packing_activity: 0,
//          stock_inward: 0,

//          current_stock: 0,
//        };
//      });

//      flat.forEach((r) => {
//        const pr = pivotByItem[r.item_code];
//        if (!pr) return;

//        pr.opening_stock += Number(r.opening_stock || 0);
//        pr.adjustment_qty += Number(r.adjustment_qty || 0);
//        pr.current_stock += Number(r.current_stock || 0);

//        pr.sold_qty += Number(r.sold_qty || 0);
//        Object.entries(r.sold_by_customer || {}).forEach(([cust, qty]) => {
//          pr.sold_by_customer[cust] =
//            (pr.sold_by_customer[cust] || 0) + Number(qty || 0);
//        });

//        pr.return_good_qty += Number(r.good_return_qty || 0);
//        pr.return_bad_qty += Number(r.bad_return_qty || 0);

//        if (r.warehouse === WH_PACKING)
//          pr.packing_activity += Number(r.packing_act_qty || 0);

//        if (r.warehouse === WH_STOCK_INWARD)
//          pr.stock_inward += Number(r.movement_qty || 0);

//        // wastage / transit / in_use / rejected removed
//      });

//      // ✅ YOUR CURRENT GROUPING LOGIC stays: group by baseHeadingLabel
//      const labelGroups = {};
//      Object.values(pivotByItem).forEach((it) => {
//        if (!ALLOWED_GROUP_SET.has(it.item_group)) return;
//        const label = baseHeadingLabel(it.item_name || it.item_code);
//        if (!labelGroups[label]) labelGroups[label] = [];
//        labelGroups[label].push(it.item_code);
//      });

//      // groupMeta: keep your movement-first sorting (unchanged)
//      const groupMeta = Object.keys(labelGroups).map((label) => {
//        const codes = labelGroups[label] || [];
//        let score = 0;
//        let category = "";

//        codes.forEach((code) => {
//          const r = pivotByItem[code];
//          if (!r) return;
//          score += getMovementScore(r);
//          if (!category) category = String(r.custom_category || "").trim();
//        });

//        return {
//          label,
//          score,
//          category: category || "Uncategorized",
//        };
//      });

//      groupMeta.sort((a, b) => {
//        const aHas = a.score > 0;
//        const bHas = b.score > 0;
//        if (aHas !== bHas) return aHas ? -1 : 1;
//        if (aHas && bHas && a.score !== b.score) return b.score - a.score;
//        return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
//      });

//      // ✅ NEW: Super Heading = Category
//      // Under category: keep the same group header + raw/weights logic
//      const categoryOrder = Array.from(
//        new Set(groupMeta.map((g) => g.category))
//      ).sort((a, b) => a.localeCompare(b));

//      const groupsByCategory = {};
//      categoryOrder.forEach((c) => (groupsByCategory[c] = []));
//      groupMeta.forEach((g) => {
//        if (!groupsByCategory[g.category]) groupsByCategory[g.category] = [];
//        groupsByCategory[g.category].push(g);
//      });

//      const finalRows = [];
//      const newExpanded = {};

//      categoryOrder.forEach((cat) => {
//        const list = groupsByCategory[cat] || [];
//        if (!list.length) return;

//        // Category super header row
//        finalRows.push({
//          is_category_header: true,
//          category_key: `CAT:${cat}`,
//          category_label: cat,
//        });

//        list.forEach(({ label, score }) => {
//          const codes = labelGroups[label] || [];

//          const sortedCodes = codes.slice().sort((a, b) => {
//            const aIsRaw =
//              (pivotByItem[a]?.item_group || "").toLowerCase() === "raw material";
//            const bIsRaw =
//              (pivotByItem[b]?.item_group || "").toLowerCase() === "raw material";
//            if (aIsRaw !== bIsRaw) return aIsRaw ? -1 : 1;

//            const aw = parseWeightToGrams(extractWeight(pivotByItem[a]?.item_name || a));
//            const bw = parseWeightToGrams(extractWeight(pivotByItem[b]?.item_name || b));
//            if (aw !== bw) return aw - bw;

//            const nA = (pivotByItem[a]?.item_name || a).toLowerCase();
//            const nB = (pivotByItem[b]?.item_name || b).toLowerCase();
//            return nA.localeCompare(nB);
//          });

//          const groupKey = `LBL:${label}`;

//          finalRows.push({
//            is_group_header: true,
//            group_item_code: groupKey,
//            group_label: label,
//            group_score: score, // used by Movement Only view
//            category_key: `CAT:${cat}`,
//            category_label: cat,
//          });

//          const parentCode =
//            sortedCodes.find(
//              (c) =>
//                (pivotByItem[c]?.item_group || "").toLowerCase() === "raw material"
//            ) || sortedCodes[0];

//          sortedCodes.forEach((code) => {
//            const row = pivotByItem[code];
//            if (!row) return;

//            const isParent = code === parentCode;
//            finalRows.push({
//              ...row,
//              group_item_code: groupKey,
//              is_parent_item: isParent,
//              parent_item_code: isParent ? null : parentCode,
//              category_key: `CAT:${cat}`,
//              category_label: cat,
//            });
//          });

//          newExpanded[groupKey] = true;
//        });
//      });

//      setRows(finalRows);
//      setExpandedGroups(newExpanded);
//    } catch (err) {
//      console.error(err);
//      setError(err.message || "Failed to load daily stock summary");
//    } finally {
//      setLoading(false);
//    }
//  }, []);

//  useEffect(() => {
//    loadData(date);
//  }, [date, loadData]);

//  useEffect(() => {
//    if (selectedItemGroup !== "ALL" && !itemGroups.includes(selectedItemGroup)) {
//      setSelectedItemGroup("ALL");
//    }
//  }, [itemGroups, selectedItemGroup]);

//  useEffect(() => {
//    if (selectedCustomer === "ALL") return;
//    if (!customers.some((c) => c.value === selectedCustomer)) {
//      setSelectedCustomer("ALL");
//    }
//  }, [customers, selectedCustomer]);

//  const columnOptions = useMemo(() => {
//    const opts = [{ value: "ALL", label: "All Columns" }];
//    COLUMNS.forEach((c) => opts.push({ value: c.key, label: c.label }));
//    return opts;
//  }, []);

//  const displayedColumns = useMemo(() => {
//    if (columnFilter === "ALL") return COLUMNS;
//    const found = COLUMNS.find((c) => c.key === columnFilter);
//    return found ? [found] : COLUMNS;
//  }, [columnFilter]);

//  // --- sub columns (when expanded) ---
//  const soldSubcols = useMemo(() => {
//    const base = (customers || []).map((c) => ({ key: c.value, label: c.label }));
//    const known = new Set(base.map((x) => x.key));

//    const extra = new Set();
//    rows.forEach((r) => {
//      if (r.is_group_header || r.is_category_header) return;
//      Object.keys(r.sold_by_customer || {}).forEach((k) => {
//        if (!known.has(k)) extra.add(k);
//      });
//    });

//    const extraCols = Array.from(extra)
//      .sort((a, b) => a.localeCompare(b))
//      .map((k) => ({ key: k, label: k }));

//    const all = [...base, ...extraCols];
//    return all.length ? all : [{ key: "__NONE__", label: "(No customers)" }];
//  }, [customers, rows]);

//  const returnSubcols = useMemo(
//    () => [
//      { key: "GOOD", label: "Good" },
//      { key: "BAD", label: "Bad" },
//    ],
//    []
//  );

//  // build columns used by the table (some become groups when expanded)
//  const effectiveColumns = useMemo(() => {
//    const out = [];
//    displayedColumns.forEach((c) => {
//      if (c.key === "sold_qty" && expandedMetrics.sold_qty) {
//        out.push({ type: "group", key: "sold_qty", label: "Sold Qty", subcols: soldSubcols });
//        return;
//      }
//      if (c.key === "return_qty" && expandedMetrics.return_qty) {
//        out.push({ type: "group", key: "return_qty", label: "Return Qty", subcols: returnSubcols });
//        return;
//      }
//      out.push({ type: "col", ...c });
//    });
//    return out;
//  }, [displayedColumns, expandedMetrics, soldSubcols, returnSubcols]);

//  const leafColumnCount = useMemo(() => {
//    return effectiveColumns.reduce((sum, c) => {
//      if (c.type === "group") return sum + (c.subcols?.length || 0);
//      return sum + 1;
//    }, 0);
//  }, [effectiveColumns]);

//  const colCount = 1 + leafColumnCount;

//  // ---------------- DISPLAY FILTERS ----------------
//  const lowerSearch = searchTerm.trim().toLowerCase();
//  let displayRows = rows;

//  const needsFiltering =
//    lowerSearch || selectedItemGroup !== "ALL" || selectedCategory !== "ALL" || movementOnly;

//  if (needsFiltering) {
//    // custom filtering that preserves:
//    // Category Header -> Group Header -> rows
//    const out = [];

//    let currentCategory = null;
//    let categoryBucket = [];

//    let currentGroupHeader = null;
//    let groupBucket = [];

//    const flushGroup = () => {
//      if (!currentGroupHeader) return;

//      const groupScore = Number(currentGroupHeader.group_score || 0);

//      // Movement only filter
//      if (movementOnly && groupScore === 0) {
//        currentGroupHeader = null;
//        groupBucket = [];
//        return;
//      }

//      // Item Group filter (applies to detail rows)
//      const byItemGroup =
//        selectedItemGroup === "ALL"
//          ? groupBucket
//          : groupBucket.filter((d) => (d.item_group || "") === selectedItemGroup);

//      // Search filter
//      const headerMatches =
//        lowerSearch &&
//        ((currentGroupHeader.group_label || "").toLowerCase().includes(lowerSearch) ||
//          (currentGroupHeader.group_item_code || "").toLowerCase().includes(lowerSearch));

//      const detailsBySearch = byItemGroup.filter((d) => {
//        if (!lowerSearch) return true;
//        const name = (d.item_name || "").toLowerCase();
//        const codeStr = (d.item_code || "").toLowerCase();
//        return name.includes(lowerSearch) || codeStr.includes(lowerSearch);
//      });

//      const keepDetails = headerMatches ? byItemGroup : detailsBySearch;

//      if (keepDetails.length > 0) {
//        categoryBucket.push(currentGroupHeader);
//        keepDetails.forEach((d) => categoryBucket.push(d));
//      }

//      currentGroupHeader = null;
//      groupBucket = [];
//    };

//    const flushCategory = () => {
//      flushGroup();
//      if (!currentCategory) return;

//      const catName = currentCategory.category_label || "Uncategorized";
//      if (selectedCategory !== "ALL" && catName !== selectedCategory) {
//        // drop
//      } else if (categoryBucket.length > 0) {
//        out.push(currentCategory);
//        categoryBucket.forEach((x) => out.push(x));
//      }

//      currentCategory = null;
//      categoryBucket = [];
//    };

//    rows.forEach((r) => {
//      if (r.is_category_header) {
//        flushCategory();
//        currentCategory = r;
//        return;
//      }

//      if (r.is_group_header) {
//        flushGroup();
//        currentGroupHeader = r;
//        return;
//      }

//      // detail row
//      groupBucket.push(r);
//    });

//    flushCategory();

//    displayRows = out;
//  }

//  // ---------------- INFINITE GROUP PAGING ----------------
//  const allGroupKeys = useMemo(
//    () => rows.filter((r) => r.is_group_header).map((r) => r.group_item_code),
//    [rows]
//  );

//  const visibleGroupKeySet = useMemo(() => {
//    if (needsFiltering) return new Set(allGroupKeys);
//    return new Set(allGroupKeys.slice(0, visibleGroupCount));
//  }, [needsFiltering, allGroupKeys, visibleGroupCount]);

//  // keep category headers if they contain at least one visible group
//  const visibleCategoryKeySet = useMemo(() => {
//    const set = new Set();
//    rows.forEach((r) => {
//      if (r.is_group_header && visibleGroupKeySet.has(r.group_item_code) && r.category_key) {
//        set.add(r.category_key);
//      }
//    });
//    return set;
//  }, [rows, visibleGroupKeySet]);

//  displayRows = displayRows.filter((r) => {
//    if (r.is_category_header) return visibleCategoryKeySet.has(r.category_key);
//    if (r.is_group_header) return visibleGroupKeySet.has(r.group_item_code);
//    if (r.group_item_code) return visibleGroupKeySet.has(r.group_item_code);
//    return true;
//  });

//  useEffect(() => {
//    setVisibleGroupCount(GROUP_PAGE_SIZE);
//  }, [date]);

//  useEffect(() => {
//    if (needsFiltering) return;
//    const el = sentinelRef.current;
//    if (!el) return;

//    const obs = new IntersectionObserver(
//      (entries) => {
//        if (!entries?.[0]?.isIntersecting) return;
//        setVisibleGroupCount((v) => Math.min(v + GROUP_PAGE_SIZE, allGroupKeys.length));
//      },
//      { root: null, rootMargin: "250px", threshold: 0 }
//    );

//    obs.observe(el);
//    return () => obs.disconnect();
//  }, [needsFiltering, allGroupKeys.length]);

//  const visibleRowCount = displayRows.reduce((count, r) => {
//    if (r.is_group_header || r.is_category_header) return count;
//    if (!needsFiltering && r.group_item_code && expandedGroups[r.group_item_code] === false)
//      return count;
//    return count + 1;
//  }, 0);

//  function downloadSummaryAsCsv() {
//    // ✅ download full list (not the filtered/movement-only view)
//    const dataRows = [];

//    rows.forEach((r) => {
//      if (r.is_group_header || r.is_category_header) return;

//      const row = {
//        "Category": r.custom_category || "",
//        "Item Code": r.item_code || "",
//        "Item Name": r.item_name || "",
//        "Item Group": r.item_group || "",
//      };

//      displayedColumns.forEach((c) => {
//        row[c.label] = getCellValue(r, c.key);
//      });

//      dataRows.push(row);
//    });

//    if (dataRows.length === 0) {
//      window.alert("Nothing to download.");
//      return;
//    }

//    const headers = Object.keys(dataRows[0]);
//    const lines = [];
//    lines.push(headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(","));

//    dataRows.forEach((row) => {
//      lines.push(headers.map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(","));
//    });

//    const csv = lines.join("\n");
//    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
//    const url = URL.createObjectURL(blob);

//    const link = document.createElement("a");
//    link.href = url;
//    link.download = `daily-stock-summary-${date}.csv`;
//    document.body.appendChild(link);
//    link.click();
//    document.body.removeChild(link);
//    URL.revokeObjectURL(url);
//  }

//  const renderColumnCell = (r, c) => {
//    const val = getCellValue(r, c.key);
//    if (c.noDot) return <span>{val}</span>;
//    return <DotCell value={val} />;
//  };

//  // ✅ your current label logic (Raw/weights)
//  const getDisplayItemPrimary = (r) => {
//    const cleaned = cleanLabel(r.item_name || r.item_code);

//    if (r.is_parent_item && String(r.item_group || "").toLowerCase().includes("raw")) {
//      return "Raw";
//    }

//    if (!!r.parent_item_code && !r.is_parent_item) {
//      const w = extractWeight(cleaned);
//      return w || cleaned;
//    }

//    return cleaned;
//  };

//  return (
//    <div className="daily-stock-summary">
//      <div className="daily-stock-summary-header-row">
//        <div className="daily-stock-summary-header">
//          <h2 className="daily-stock-summary-title">Daily Stock Summary</h2>
//          <p className="daily-stock-summary-subtitle">
//            Sold/Return filters affect only those expanded columns
//          </p>
//        </div>

//        <div className="daily-stock-summary-controls">
//          <span className="daily-stock-summary-date-label">Date</span>
//          <input
//            type="date"
//            className="input daily-stock-summary-date-input"
//            value={date}
//            onChange={(e) => setDate(e.target.value)}
//          />

//          <select
//            className="input daily-stock-summary-group-filter"
//            value={selectedItemGroup}
//            onChange={(e) => setSelectedItemGroup(e.target.value)}
//            title="Filter rows by Item Group"
//          >
//            <option value="ALL">All Item Groups</option>
//            {itemGroups.map((g) => (
//              <option key={g} value={g}>
//                {g}
//              </option>
//            ))}
//          </select>

//          <select
//            className="input daily-stock-summary-column-filter"
//            value={columnFilter}
//            onChange={(e) => setColumnFilter(e.target.value)}
//            title="Show Item + selected column only"
//          >
//            {columnOptions.map((o) => (
//              <option key={o.value} value={o.value}>
//                {o.label}
//              </option>
//            ))}
//          </select>

//          {/* ✅ Category filter (optional but requested earlier) */}
//          <select
//            className="input daily-stock-summary-column-filter"
//            value={selectedCategory}
//            onChange={(e) => setSelectedCategory(e.target.value)}
//            title="Filter by Category"
//          >
//            <option value="ALL">All Categories</option>
//            {categories.map((c) => (
//              <option key={c} value={c}>
//                {c}
//              </option>
//            ))}
//          </select>

//          {/* ✅ Movement Only toggle */}
//          <button
//            type="button"
//            className="btn btn-secondary btn-sm"
//            onClick={() => setMovementOnly((v) => !v)}
//            title="Show only groups where movement happened"
//          >
//            {movementOnly ? "Show All" : "Movement Only"}
//          </button>

//          <input
//            type="text"
//            className="input daily-stock-summary-search-input"
//            placeholder="Search item / code / group"
//            value={searchTerm}
//            onChange={(e) => setSearchTerm(e.target.value)}
//          />

//          <button
//            type="button"
//            className="btn btn-secondary btn-sm daily-stock-summary-download"
//            onClick={downloadSummaryAsCsv}
//          >
//            Download Excel
//          </button>

//          <button
//            type="button"
//            className="btn btn-primary btn-sm daily-stock-summary-refresh"
//            onClick={() => loadData(date)}
//          >
//            Refresh
//          </button>
//        </div>
//      </div>

//      <div className="daily-stock-summary-meta-row">
//        <span className="daily-stock-summary-meta">
//          Showing {visibleRowCount} line{visibleRowCount !== 1 ? "s" : ""}
//        </span>
//      </div>

//      {loading && <p className="daily-stock-summary-loading text-muted">Loading stock summary...</p>}
//      {error && <p className="daily-stock-summary-error alert alert-error">{error}</p>}
//      {!loading && !error && displayRows.length === 0 && (
//        <p className="daily-stock-summary-empty text-muted">No rows match your filters.</p>
//      )}

//      {!loading && !error && displayRows.length > 0 && (
//        <div className="daily-stock-summary-table-wrapper">
//          <table className="daily-stock-summary-table">
//            <thead>
//              <tr>
//                <th rowSpan={2}>Item</th>

//                {effectiveColumns.map((c) => {
//                  const isExpandable = c.key === "sold_qty" || c.key === "return_qty";
//                  const isOpen = !!expandedMetrics[c.key];

//                  if (c.type === "group") {
//                    return (
//                      <th key={c.key} colSpan={c.subcols.length} className="dss-group-th">
//                        <button
//                          type="button"
//                          className="dss-expand-btn"
//                          onClick={() => toggleMetric(c.key)}
//                        >
//                          {c.label} <span className="dss-caret">{isOpen ? "▴" : "▾"}</span>
//                        </button>
//                      </th>
//                    );
//                  }

//                  return (
//                    <th
//                      key={c.key}
//                      rowSpan={2}
//                      className={isExpandable ? "dss-expandable-th" : undefined}
//                    >
//                      {isExpandable ? (
//                        <button
//                          type="button"
//                          className="dss-expand-btn"
//                          onClick={() => toggleMetric(c.key)}
//                        >
//                          {c.label} <span className="dss-caret">{isOpen ? "▴" : "▾"}</span>
//                        </button>
//                      ) : (
//                        c.label
//                      )}
//                    </th>
//                  );
//                })}
//              </tr>

//              <tr>
//                {effectiveColumns.map((c) => {
//                  if (c.type !== "group") return null;
//                  return c.subcols.map((sc) => (
//                    <th key={`${c.key}-${sc.key}`} className="dss-sub-th">
//                      {sc.label}
//                    </th>
//                  ));
//                })}
//              </tr>
//            </thead>

//            <tbody>
//              {displayRows.map((r, idx) => {
//                // ✅ Category super header row
//                if (r.is_category_header) {
//                  return (
//                    <tr
//                      key={`cat-${r.category_key}-${idx}`}
//                      className="daily-stock-summary-group-row"
//                    >
//                      <td className="daily-stock-summary-group-header" colSpan={colCount}>
//                        <span className="daily-stock-summary-group-icon">📁</span> {r.category_label}
//                      </td>
//                    </tr>
//                  );
//                }

//                if (r.is_group_header) {
//                  const isOpen = expandedGroups[r.group_item_code] !== false;
//                  return (
//                    <tr
//                      key={`group-${r.group_item_code}-${idx}`}
//                      className="daily-stock-summary-group-row"
//                      onClick={() =>
//                        setExpandedGroups((prev) => ({
//                          ...prev,
//                          [r.group_item_code]: !isOpen,
//                        }))
//                      }
//                    >
//                      <td className="daily-stock-summary-group-header" colSpan={colCount}>
//                        <span className="daily-stock-summary-group-icon">📦</span> {r.group_label}
//                        <span className="daily-stock-summary-group-toggle">{isOpen ? "▾" : "▸"}</span>
//                      </td>
//                    </tr>
//                  );
//                }

//                if (!needsFiltering && r.group_item_code && expandedGroups[r.group_item_code] === false) {
//                  return null;
//                }

//                const topLabel = getDisplayItemPrimary(r);

//                return (
//                  <tr
//                    key={`${r.item_code}||${r.parent_item_code || ""}||${r.group_item_code || ""}`}
//                    className={[
//                      r.is_parent_item ? "daily-stock-summary-row-parent" : "",
//                      !!r.parent_item_code && !r.is_parent_item ? "daily-stock-summary-row-child" : "",
//                    ]
//                      .join(" ")
//                      .trim()}
//                  >
//                    <td className="daily-stock-summary-item">
//                      <div className="daily-stock-summary-item-code">{topLabel}</div>
//                    </td>

//                    {effectiveColumns.map((c) => {
//                      if (c.type === "group" && c.key === "sold_qty") {
//                        return c.subcols.map((sc) => (
//                          <td key={`${r.item_code}-sold-${sc.key}`} className="daily-stock-summary-num">
//                            <DotCell value={Number(r.sold_by_customer?.[sc.key] || 0)} />
//                          </td>
//                        ));
//                      }

//                      if (c.type === "group" && c.key === "return_qty") {
//                        return c.subcols.map((sc) => (
//                          <td key={`${r.item_code}-ret-${sc.key}`} className="daily-stock-summary-num">
//                            <DotCell
//                              value={
//                                sc.key === "GOOD"
//                                  ? Number(r.return_good_qty || 0)
//                                  : Number(r.return_bad_qty || 0)
//                              }
//                            />
//                          </td>
//                        ));
//                      }

//                      return (
//                        <td key={`${r.item_code}-${c.key}`} className="daily-stock-summary-num">
//                          {renderColumnCell(r, c)}
//                        </td>
//                      );
//                    })}
//                  </tr>
//                );
//              })}
//            </tbody>
//          </table>

//          {!needsFiltering && visibleGroupCount < allGroupKeys.length && (
//            <div ref={sentinelRef} style={{ height: 1 }} />
//          )}
//        </div>
//      )}
//    </div>
//  );
//}

//export default DailyStockSummary;
// src/Components/DailyStockSummary.jsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { getStockLedgerUpToDate, getDoctypeList, getDoc } from "./erpBackendApi";
import "../CSS/DailyStockSummary.css";

// * Definitions (kept same intent)
// * Parent warehouse:
// *  - Opening Stock  = SUM of stock in ALL child warehouses under "Jharkahand Warehouse - MF" at start of day
// *  - Current Stock  = SUM of stock in ALL child warehouses under "Jharkahand Warehouse - MF" at end of selected day
// *
// * Columns:
// *  - Packing Activity = Manufacturing Stock Entries movement (Raw consumed is - , FG produced is +)  ✅ UPDATED
// *  - Stock Inward     = Raw Material warehouse movement ONLY from Purchase Invoice ✅ UPDATED
// *  - Sold Qty         = Sales Invoice movement in FG (expanded view = customer breakdown)
// *  - Return Qty       = Sales Invoice stock-in (expanded = Good/Bad)
// *  - Reconciliation   = delta from Stock Reconciliation
// *
// * ❌ Removed from totals + UI:
// *  - Transit (Goods In Transit - MF)
// *  - In Use (Work In Progress - MF)
// *  - Wastage (Wastage - MF)
// *  - Rejected (Rejected Warehouse - MF)

const ROOT_WAREHOUSE = "Jharkahand Warehouse - MF";

const ALLOWED_GROUPS = ["Raw Material", "Products"];
const ALLOWED_GROUP_SET = new Set(ALLOWED_GROUPS);

const WH_STOCK_INWARD = "Raw Material - MF";
const WH_PACKING = "Finished Goods - MF";
const WH_DAMAGED = "Damaged - MF";

// ✅ Exclude these warehouses completely from Opening/Current calculations
const EXCLUDED_WAREHOUSES = new Set([
  "Wastage - MF",
  "Goods In Transit - MF",
  "Work In Progress - MF",
  "Rejected Warehouse - MF",
]);

const RETURN_TYPES = { ALL: "ALL", GOOD: "GOOD", BAD: "BAD" };

const COLUMNS = [
  { key: "opening_stock", label: "Opening Stock (TOTAL)", noDot: true },
  { key: "adjustment_qty", label: "Reconciliation" },
  { key: "sold_qty", label: "Sold Qty" },
  { key: "return_qty", label: "Return Qty" },
  { key: "current_stock", label: "Current Stock (TOTAL)", noDot: true },
  { key: "packing_activity", label: "Paking Activity" },
  { key: "stock_inward", label: "Stock Inward" },
];

const GROUP_PAGE_SIZE = 4;

function DailyStockSummary() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({}); // ✅ NEW: category collapse like headings
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");

  const [itemGroups, setItemGroups] = useState(ALLOWED_GROUPS);
  const [selectedItemGroup, setSelectedItemGroup] = useState("ALL");

  const [columnFilter, setColumnFilter] = useState("ALL");

  // ✅ Category filter (dropdown)
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  // ✅ Movement only button
  const [movementOnly, setMovementOnly] = useState(false);

  // ✅ customers (for Sold Qty expansion)
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer] = useState("ALL"); // kept for compatibility (not used now, expanded shows all)

  const [selectedReturnType] = useState(RETURN_TYPES.ALL); // kept for compatibility (expanded shows both)

  const [visibleGroupCount, setVisibleGroupCount] = useState(GROUP_PAGE_SIZE);
  const sentinelRef = useRef(null);

  const allowedItemsLoadedRef = useRef(false);
  const allowedItemMapRef = useRef({});
  const allowedItemCodesRef = useRef([]);

  const customersLoadedRef = useRef(false);

  // expandable metrics (only Sold + Return)
  const [expandedMetrics, setExpandedMetrics] = useState({
    sold_qty: false,
    return_qty: false,
  });

  const toggleMetric = (key) => {
    setExpandedMetrics((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleCategory = (categoryKey) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryKey]: !(prev[categoryKey] !== false),
    }));
  };

  function makeTs(entry) {
    return `${entry.posting_date} ${entry.posting_time || "00:00:00"}`;
  }

  function cleanLabel(s) {
    let x = String(s || "");
    x = x.replace(/^\s*raw\s+/i, "");
    x = x.replace(/\s+/g, " ").trim();
    return x;
  }

  function extractWeight(s) {
    const str = String(s || "");
    const m1 = str.match(/\(([^)]+)\)/);
    if (m1 && m1[1]) return m1[1].trim();

    const m2 = str.match(/\b\d+(\.\d+)?\s*(kg|g|gm|grams|ml|l)\b/i);
    if (m2) return m2[0].trim();

    return "";
  }

  function baseHeadingLabel(nameOrCode) {
    let s = cleanLabel(nameOrCode);
    s = s.replace(/\([^)]*\)/g, " ");
    s = s.replace(/\b\d+(\.\d+)?\s*(kg|g|gm|grams|ml|l)\b/gi, " ");
    s = s.replace(/\s+/g, " ").trim();
    return s || String(nameOrCode || "");
  }

  function parseWeightToGrams(weightStr) {
    const w = String(weightStr || "").trim().toLowerCase();
    const m = w.match(/(\d+(\.\d+)?)\s*(kg|g|gm|grams|ml|l)\b/);
    if (!m) return Number.POSITIVE_INFINITY;
    const num = parseFloat(m[1]);
    const unit = m[3];
    if (!isFinite(num)) return Number.POSITIVE_INFINITY;
    if (unit === "kg" || unit === "l") return num * 1000;
    return num;
  }

  // ✅ Sign + color cell
  const DotCell = ({ value }) => {
    const n = Number(value || 0);
    if (n === 0) return <span>0</span>;

    const isPos = n > 0;
    const color = isPos ? "#16a34a" : "#dc2626";
    const sign = isPos ? "+" : "−";

    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color, fontWeight: 600 }}>
        <span style={{ fontWeight: 800 }}>{sign}</span>
        <span>{Math.abs(n)}</span>
      </span>
    );
  };

  // collapsed totals
  const getSoldValue = (r) => Number(r.sold_qty || 0);
  const getReturnValue = (r) => Number(r.return_good_qty || 0) + Number(r.return_bad_qty || 0);

  const getCellValue = (r, key) => {
    if (key === "sold_qty") return getSoldValue(r);
    if (key === "return_qty") return getReturnValue(r);
    return Number(r[key] || 0);
  };

  const getMovementScore = (r) => {
    const parts = [
      "adjustment_qty",
      "sold_qty",
      "return_good_qty",
      "return_bad_qty",
      "packing_activity",
      "stock_inward",
    ];
    return parts.reduce((sum, k) => sum + Math.abs(Number(r[k] || 0)), 0);
  };

  async function loadAllowedItemsOnce() {
    if (allowedItemsLoadedRef.current) return;

    const pageSize = 2000;
    let start = 0;
    const all = [];

    while (true) {
      const part = await getDoctypeList("Item", {
        fields: JSON.stringify(["name", "item_name", "item_group", "custom_category"]),
        filters: JSON.stringify([["Item", "item_group", "in", ALLOWED_GROUPS]]),
        limit_page_length: pageSize,
        limit_start: start,
      });

      all.push(...(part || []));
      if (!part || part.length < pageSize) break;
      start += pageSize;
      if (start > 200000) break;
    }

    const map = {};
    const codes = [];
    const catSet = new Set();

    (all || []).forEach((it) => {
      if (!it?.name) return;
      if (!ALLOWED_GROUP_SET.has(it.item_group)) return;

      map[it.name] = {
        item_name: it.item_name || "",
        item_group: it.item_group || "",
        custom_category: it.custom_category || "",
      };
      codes.push(it.name);

      const c = String(it.custom_category || "").trim();
      if (c) catSet.add(c);
    });

    allowedItemMapRef.current = map;
    allowedItemCodesRef.current = codes;
    allowedItemsLoadedRef.current = true;

    setItemGroups(ALLOWED_GROUPS);
    setCategories(Array.from(catSet).sort((a, b) => a.localeCompare(b)));
  }

  async function loadCustomersOnce() {
    if (customersLoadedRef.current) return;

    const pageSize = 2000;
    let start = 0;
    const out = [];

    while (true) {
      const part = await getDoctypeList("Customer", {
        fields: JSON.stringify(["name", "customer_name", "disabled"]),
        filters: JSON.stringify([["Customer", "disabled", "=", 0]]),
        limit_page_length: pageSize,
        limit_start: start,
      });

      out.push(...(part || []));
      if (!part || part.length < pageSize) break;
      start += pageSize;
      if (start > 200000) break;
    }

    const opts = (out || [])
      .filter((c) => c?.name)
      .map((c) => ({ value: c.name, label: c.customer_name || c.name }))
      .sort((a, b) => a.label.localeCompare(b.label));

    customersLoadedRef.current = true;
    setCustomers(opts);
  }

  const loadData = useCallback(async (selectedDate) => {
    setLoading(true);
    setError("");
    setRows([]);
    setExpandedGroups({});
    setExpandedCategories({});
    setVisibleGroupCount(GROUP_PAGE_SIZE);

    try {
      await loadAllowedItemsOnce();
      await loadCustomersOnce();

      const [sleToSelected, reconDocs, siList, whList, seList] = await Promise.all([
        getStockLedgerUpToDate(selectedDate),

        getDoctypeList("Stock Reconciliation", {
          fields: JSON.stringify(["name", "posting_date", "docstatus"]),
          filters: JSON.stringify([
            ["Stock Reconciliation", "posting_date", "=", selectedDate],
            ["Stock Reconciliation", "docstatus", "=", 1],
          ]),
          limit_page_length: 500,
        }),

        getDoctypeList("Sales Invoice", {
          fields: JSON.stringify(["name", "customer", "posting_date", "docstatus"]),
          filters: JSON.stringify([
            ["Sales Invoice", "posting_date", "=", selectedDate],
            ["Sales Invoice", "docstatus", "=", 1],
          ]),
          limit_page_length: 20000,
        }),

        getDoctypeList("Warehouse", {
          fields: JSON.stringify(["name", "parent_warehouse", "is_group"]),
          limit_page_length: 20000,
        }),

        getDoctypeList("Stock Entry", {
          fields: JSON.stringify(["name", "purpose", "stock_entry_type", "posting_date", "docstatus"]),
          filters: JSON.stringify([
            ["Stock Entry", "posting_date", "=", selectedDate],
            ["Stock Entry", "docstatus", "=", 1],
          ]),
          limit_page_length: 20000,
        }),
      ]);

      // invoice -> customer
      const invoiceToCustomer = {};
      (siList || []).forEach((si) => {
        if (si?.name) invoiceToCustomer[si.name] = si.customer || "";
      });

      // Warehouse subtree under ROOT
      const childrenByParent = {};
      (whList || []).forEach((w) => {
        const p = w.parent_warehouse || "";
        if (!childrenByParent[p]) childrenByParent[p] = [];
        childrenByParent[p].push(w.name);
      });

      const jhWarehouses = new Set();
      const stack = [ROOT_WAREHOUSE];
      while (stack.length) {
        const w = stack.pop();
        if (!w || jhWarehouses.has(w)) continue;
        jhWarehouses.add(w);
        const kids = childrenByParent[w] || [];
        kids.forEach((k) => stack.push(k));
      }

      // ✅ Manufacturing Stock Entry set ONLY (no transfer)
      const manufacturingSE = new Set();
      (seList || []).forEach((se) => {
        const purpose = String(se.purpose || "").toLowerCase();
        const seType = String(se.stock_entry_type || "").toLowerCase();
        const isMfg =
          purpose.includes("manufact") ||
          purpose.includes("repack") ||
          seType.includes("manufact") ||
          seType.includes("repack");
        if (se.name && isMfg) manufacturingSE.add(se.name);
      });

      // Recon docs
      const reconNameSet = new Set((reconDocs || []).map((d) => d.name));
      const reconFullDocs = await Promise.all(
        (reconDocs || []).map((r) => getDoc("Stock Reconciliation", r.name).catch(() => null))
      );

      const allowedSet = new Set(allowedItemCodesRef.current);

      // Maps keyed by item||warehouse
      const openingMap = {};
      const movementMap = {}; // all non-recon movements (except Sales Invoice which is handled separately)
      const adjustmentMap = {}; // recon delta
      const siTotalQtyMap = {}; // Sales Invoice qty total (for accurate current_stock)

      const soldTotalMap = {};
      const soldByCustomerMap = {};
      const goodReturnMap = {};
      const badReturnMap = {};

      const packingActMap = {}; // ✅ Manufacturing only, +/- will come naturally
      const purchaseInwardMap = {}; // ✅ NEW: Purchase Invoice only for Stock Inward

      const lastBeforeDay = {};

      (sleToSelected || []).forEach((entry) => {
        const itemCode = entry.item_code;
        const warehouse = entry.warehouse;
        if (!itemCode || !warehouse) return;
        if (!allowedSet.has(itemCode)) return;
        if (!jhWarehouses.has(warehouse)) return;

        // excluded warehouses do not participate in opening/current
        if (EXCLUDED_WAREHOUSES.has(warehouse)) return;

        const key = `${itemCode}||${warehouse}`;

        const qty = parseFloat(entry.actual_qty) || 0;
        const balance = parseFloat(entry.qty_after_transaction) || 0;

        const rawVtype = entry.voucher_type || "";
        const vtype = typeof rawVtype === "string" ? rawVtype.trim() : rawVtype;

        const entryDate = entry.posting_date;
        const ts = makeTs(entry);

        const isRecon = reconNameSet.has(entry.voucher_no);

        // opening = last balance before date
        if (entryDate < selectedDate) {
          const existing = lastBeforeDay[key];
          if (!existing || ts > existing.ts) lastBeforeDay[key] = { ts, balance };
        }

        if (entryDate !== selectedDate) return;

        // ✅ Sales Invoice handling
        if (vtype === "Sales Invoice") {
          siTotalQtyMap[key] = (siTotalQtyMap[key] || 0) + qty;

          const invName = entry.voucher_no;
          const customer = invoiceToCustomer[invName] || "Unknown";

          // sold: only FG with negative qty
          if (warehouse === WH_PACKING && qty < 0) {
            const n = -Math.abs(qty);
            soldTotalMap[key] = (soldTotalMap[key] || 0) + n;

            if (!soldByCustomerMap[key]) soldByCustomerMap[key] = {};
            soldByCustomerMap[key][customer] = (soldByCustomerMap[key][customer] || 0) + n;
          }

          // returns: qty positive, good -> FG, bad -> Damaged
          if (qty > 0) {
            if (warehouse === WH_PACKING) goodReturnMap[key] = (goodReturnMap[key] || 0) + qty;
            else if (warehouse === WH_DAMAGED) badReturnMap[key] = (badReturnMap[key] || 0) + qty;
            else goodReturnMap[key] = (goodReturnMap[key] || 0) + qty;
          }

          return; // do not include in movementMap
        }

        // ✅ Packing Activity = Manufacturing Stock Entries (ALL warehouses)
        // Raw consumed = -ve, Finished produced = +ve (same column)
        if (vtype === "Stock Entry") {
          const seName = entry.voucher_no;
          if (manufacturingSE.has(seName)) {
            packingActMap[key] = (packingActMap[key] || 0) + qty;
          }
        }

        // ✅ Stock Inward = ONLY Purchase Invoice movement in Raw Material warehouse
        if (warehouse === WH_STOCK_INWARD && vtype === "Purchase Invoice") {
          purchaseInwardMap[key] = (purchaseInwardMap[key] || 0) + qty;
        }

        // normal movement (exclude recon)
        if (!isRecon) {
          movementMap[key] = (movementMap[key] || 0) + qty;
        }
      });

      Object.keys(lastBeforeDay).forEach((key) => {
        openingMap[key] = lastBeforeDay[key].balance;
      });

      // Reconciliation adjustments
      for (const doc of reconFullDocs || []) {
        if (!doc) continue;
        (doc.items || []).forEach((it) => {
          const itemCode = it.item_code;
          const warehouse = it.warehouse;
          if (!itemCode || !warehouse) return;
          if (!allowedSet.has(itemCode)) return;
          if (!jhWarehouses.has(warehouse)) return;
          if (EXCLUDED_WAREHOUSES.has(warehouse)) return;

          const key = `${itemCode}||${warehouse}`;
          const currentQty = parseFloat(it.current_qty || 0);
          const newQty = parseFloat(it.qty || 0);
          const delta = newQty - currentQty;

          adjustmentMap[key] = (adjustmentMap[key] || 0) + delta;
        });
      }

      const keys = new Set([
        ...Object.keys(openingMap),
        ...Object.keys(movementMap),
        ...Object.keys(adjustmentMap),
        ...Object.keys(siTotalQtyMap),
        ...Object.keys(soldTotalMap),
        ...Object.keys(goodReturnMap),
        ...Object.keys(badReturnMap),
        ...Object.keys(packingActMap),
        ...Object.keys(purchaseInwardMap),
      ]);

      // Flat rows per item||warehouse
      const flat = Array.from(keys).map((key) => {
        const [item_code, warehouse] = key.split("||");

        const opening_stock = Number(openingMap[key] || 0);
        const movement_qty = Number(movementMap[key] || 0);
        const adjustment_qty = Number(adjustmentMap[key] || 0);

        const si_qty_total = Number(siTotalQtyMap[key] || 0);

        const sold_qty = Number(soldTotalMap[key] || 0);
        const sold_by_customer = soldByCustomerMap[key] || {};

        const good_return_qty = Number(goodReturnMap[key] || 0);
        const bad_return_qty = Number(badReturnMap[key] || 0);

        const packing_act_qty = Number(packingActMap[key] || 0);

        const purchase_inward_qty = Number(purchaseInwardMap[key] || 0);

        const current_stock = opening_stock + movement_qty + adjustment_qty + si_qty_total;

        const meta = allowedItemMapRef.current[item_code] || {
          item_name: "",
          item_group: "",
          custom_category: "",
        };

        return {
          item_code,
          item_name: meta.item_name || "",
          item_group: meta.item_group || "",
          custom_category: meta.custom_category || "",
          warehouse,

          opening_stock,
          movement_qty,
          adjustment_qty,

          sold_qty,
          sold_by_customer,
          good_return_qty,
          bad_return_qty,

          packing_act_qty,
          purchase_inward_qty,

          current_stock,
        };
      });

      // Pivot init for all allowed items
      const pivotByItem = {};
      (allowedItemCodesRef.current || []).forEach((code) => {
        const meta = allowedItemMapRef.current[code] || {};
        pivotByItem[code] = {
          item_code: code,
          item_name: meta.item_name || "",
          item_group: meta.item_group || "",
          custom_category: meta.custom_category || "",

          opening_stock: 0,
          adjustment_qty: 0,

          sold_qty: 0,
          sold_by_customer: {},

          return_good_qty: 0,
          return_bad_qty: 0,

          packing_activity: 0,
          stock_inward: 0,

          current_stock: 0,
        };
      });

      flat.forEach((r) => {
        const pr = pivotByItem[r.item_code];
        if (!pr) return;

        pr.opening_stock += Number(r.opening_stock || 0);
        pr.adjustment_qty += Number(r.adjustment_qty || 0);
        pr.current_stock += Number(r.current_stock || 0);

        pr.sold_qty += Number(r.sold_qty || 0);
        Object.entries(r.sold_by_customer || {}).forEach(([cust, qty]) => {
          pr.sold_by_customer[cust] = (pr.sold_by_customer[cust] || 0) + Number(qty || 0);
        });

        pr.return_good_qty += Number(r.good_return_qty || 0);
        pr.return_bad_qty += Number(r.bad_return_qty || 0);

        // ✅ Packing activity now sums manufacturing movement from ALL warehouses
        pr.packing_activity += Number(r.packing_act_qty || 0);

        // ✅ Stock inward only Purchase Invoice in Raw Material warehouse
        if (r.warehouse === WH_STOCK_INWARD) {
          pr.stock_inward += Number(r.purchase_inward_qty || 0);
        }
      });

      // Grouping by base label
      const labelGroups = {};
      Object.values(pivotByItem).forEach((it) => {
        if (!ALLOWED_GROUP_SET.has(it.item_group)) return;
        const label = baseHeadingLabel(it.item_name || it.item_code);
        if (!labelGroups[label]) labelGroups[label] = [];
        labelGroups[label].push(it.item_code);
      });

      const groupMeta = Object.keys(labelGroups).map((label) => {
        const codes = labelGroups[label] || [];
        let score = 0;
        let category = "";

        codes.forEach((code) => {
          const r = pivotByItem[code];
          if (!r) return;
          score += getMovementScore(r);
          if (!category) category = String(r.custom_category || "").trim();
        });

        return {
          label,
          score,
          category: category || "Uncategorized",
        };
      });

      groupMeta.sort((a, b) => {
        const aHas = a.score > 0;
        const bHas = b.score > 0;
        if (aHas !== bHas) return aHas ? -1 : 1;
        if (aHas && bHas && a.score !== b.score) return b.score - a.score;
        return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
      });

      // Category super heading
      const categoryOrder = Array.from(new Set(groupMeta.map((g) => g.category))).sort((a, b) =>
        a.localeCompare(b)
      );

      const groupsByCategory = {};
      categoryOrder.forEach((c) => (groupsByCategory[c] = []));
      groupMeta.forEach((g) => {
        if (!groupsByCategory[g.category]) groupsByCategory[g.category] = [];
        groupsByCategory[g.category].push(g);
      });

      const finalRows = [];
      const newExpanded = {};
      const newCatExpanded = {};

      categoryOrder.forEach((cat) => {
        const list = groupsByCategory[cat] || [];
        if (!list.length) return;

        const catKey = `CAT:${cat}`;

        finalRows.push({
          is_category_header: true,
          category_key: catKey,
          category_label: cat,
        });

        newCatExpanded[catKey] = true; // ✅ expand all categories by default

        list.forEach(({ label, score }) => {
          const codes = labelGroups[label] || [];

          const sortedCodes = codes.slice().sort((a, b) => {
            const aIsRaw = (pivotByItem[a]?.item_group || "").toLowerCase() === "raw material";
            const bIsRaw = (pivotByItem[b]?.item_group || "").toLowerCase() === "raw material";
            if (aIsRaw !== bIsRaw) return aIsRaw ? -1 : 1;

            const aw = parseWeightToGrams(extractWeight(pivotByItem[a]?.item_name || a));
            const bw = parseWeightToGrams(extractWeight(pivotByItem[b]?.item_name || b));
            if (aw !== bw) return aw - bw;

            const nA = (pivotByItem[a]?.item_name || a).toLowerCase();
            const nB = (pivotByItem[b]?.item_name || b).toLowerCase();
            return nA.localeCompare(nB);
          });

          const groupKey = `LBL:${label}`;

          finalRows.push({
            is_group_header: true,
            group_item_code: groupKey,
            group_label: label,
            group_score: score,
            category_key: catKey,
            category_label: cat,
          });

          const parentCode =
            sortedCodes.find((c) => (pivotByItem[c]?.item_group || "").toLowerCase() === "raw material") ||
            sortedCodes[0];

          sortedCodes.forEach((code) => {
            const row = pivotByItem[code];
            if (!row) return;

            const isParent = code === parentCode;
            finalRows.push({
              ...row,
              group_item_code: groupKey,
              is_parent_item: isParent,
              parent_item_code: isParent ? null : parentCode,
              category_key: catKey,
              category_label: cat,
            });
          });

          newExpanded[groupKey] = true; // expand all groups by default
        });
      });

      setRows(finalRows);
      setExpandedGroups(newExpanded);
      setExpandedCategories(newCatExpanded);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load daily stock summary");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(date);
  }, [date, loadData]);

  useEffect(() => {
    if (selectedItemGroup !== "ALL" && !itemGroups.includes(selectedItemGroup)) {
      setSelectedItemGroup("ALL");
    }
  }, [itemGroups, selectedItemGroup]);

  // column filter options
  const columnOptions = useMemo(() => {
    const opts = [{ value: "ALL", label: "All Columns" }];
    COLUMNS.forEach((c) => opts.push({ value: c.key, label: c.label }));
    return opts;
  }, []);

  const displayedColumns = useMemo(() => {
    if (columnFilter === "ALL") return COLUMNS;
    const found = COLUMNS.find((c) => c.key === columnFilter);
    return found ? [found] : COLUMNS;
  }, [columnFilter]);

  // Expanded sub columns
  const soldSubcols = useMemo(() => {
    const base = (customers || []).map((c) => ({ key: c.value, label: c.label }));
    const known = new Set(base.map((x) => x.key));

    const extra = new Set();
    rows.forEach((r) => {
      if (r.is_group_header || r.is_category_header) return;
      Object.keys(r.sold_by_customer || {}).forEach((k) => {
        if (!known.has(k)) extra.add(k); // e.g. "Unknown"
      });
    });

    const extraCols = Array.from(extra)
      .sort((a, b) => a.localeCompare(b))
      .map((k) => ({ key: k, label: k }));

    const all = [...base, ...extraCols];
    return all.length ? all : [{ key: "__NONE__", label: "(No customers)" }];
  }, [customers, rows]);

  const returnSubcols = useMemo(
    () => [
      { key: "GOOD", label: "Good" },
      { key: "BAD", label: "Bad" },
    ],
    []
  );

  const effectiveColumns = useMemo(() => {
    const out = [];
    displayedColumns.forEach((c) => {
      if (c.key === "sold_qty" && expandedMetrics.sold_qty) {
        out.push({ type: "group", key: "sold_qty", label: "Sold Qty", subcols: soldSubcols });
        return;
      }
      if (c.key === "return_qty" && expandedMetrics.return_qty) {
        out.push({ type: "group", key: "return_qty", label: "Return Qty", subcols: returnSubcols });
        return;
      }
      out.push({ type: "col", ...c });
    });
    return out;
  }, [displayedColumns, expandedMetrics, soldSubcols, returnSubcols]);

  const leafColumnCount = useMemo(() => {
    return effectiveColumns.reduce((sum, c) => {
      if (c.type === "group") return sum + (c.subcols?.length || 0);
      return sum + 1;
    }, 0);
  }, [effectiveColumns]);

  const colCount = 1 + leafColumnCount;

  // ---------------- DISPLAY FILTERS ----------------
  const lowerSearch = searchTerm.trim().toLowerCase();
  let displayRows = rows;

  const needsFiltering =
    lowerSearch || selectedItemGroup !== "ALL" || selectedCategory !== "ALL" || movementOnly;

  if (needsFiltering) {
    const out = [];

    let currentCategory = null;
    let categoryBucket = [];

    let currentGroupHeader = null;
    let groupBucket = [];

    const flushGroup = () => {
      if (!currentGroupHeader) return;

      const groupScore = Number(currentGroupHeader.group_score || 0);

      if (movementOnly && groupScore === 0) {
        currentGroupHeader = null;
        groupBucket = [];
        return;
      }

      const byItemGroup =
        selectedItemGroup === "ALL"
          ? groupBucket
          : groupBucket.filter((d) => (d.item_group || "") === selectedItemGroup);

      const headerMatches =
        lowerSearch &&
        ((currentGroupHeader.group_label || "").toLowerCase().includes(lowerSearch) ||
          (currentGroupHeader.group_item_code || "").toLowerCase().includes(lowerSearch));

      const detailsBySearch = byItemGroup.filter((d) => {
        if (!lowerSearch) return true;
        const name = (d.item_name || "").toLowerCase();
        const codeStr = (d.item_code || "").toLowerCase();
        return name.includes(lowerSearch) || codeStr.includes(lowerSearch);
      });

      const keepDetails = headerMatches ? byItemGroup : detailsBySearch;

      if (keepDetails.length > 0) {
        categoryBucket.push(currentGroupHeader);
        keepDetails.forEach((d) => categoryBucket.push(d));
      }

      currentGroupHeader = null;
      groupBucket = [];
    };

    const flushCategory = () => {
      flushGroup();
      if (!currentCategory) return;

      const catName = currentCategory.category_label || "Uncategorized";
      if (selectedCategory !== "ALL" && catName !== selectedCategory) {
        // drop
      } else if (categoryBucket.length > 0) {
        out.push(currentCategory);
        categoryBucket.forEach((x) => out.push(x));
      }

      currentCategory = null;
      categoryBucket = [];
    };

    rows.forEach((r) => {
      if (r.is_category_header) {
        flushCategory();
        currentCategory = r;
        return;
      }

      if (r.is_group_header) {
        flushGroup();
        currentGroupHeader = r;
        return;
      }

      groupBucket.push(r);
    });

    flushCategory();
    displayRows = out;
  }

  // ---------------- INFINITE GROUP PAGING ----------------
  const allGroupKeys = useMemo(
    () => rows.filter((r) => r.is_group_header).map((r) => r.group_item_code),
    [rows]
  );

  const visibleGroupKeySet = useMemo(() => {
    if (needsFiltering) return new Set(allGroupKeys);
    return new Set(allGroupKeys.slice(0, visibleGroupCount));
  }, [needsFiltering, allGroupKeys, visibleGroupCount]);

  // keep category headers if they contain at least one visible group
  const visibleCategoryKeySet = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      if (r.is_group_header && visibleGroupKeySet.has(r.group_item_code) && r.category_key) {
        set.add(r.category_key);
      }
    });
    return set;
  }, [rows, visibleGroupKeySet]);

  displayRows = displayRows.filter((r) => {
    if (r.is_category_header) return visibleCategoryKeySet.has(r.category_key);
    if (r.is_group_header) return visibleGroupKeySet.has(r.group_item_code);
    if (r.group_item_code) return visibleGroupKeySet.has(r.group_item_code);
    return true;
  });

  useEffect(() => {
    setVisibleGroupCount(GROUP_PAGE_SIZE);
  }, [date]);

  useEffect(() => {
    if (needsFiltering) return;
    const el = sentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries?.[0]?.isIntersecting) return;
        setVisibleGroupCount((v) => Math.min(v + GROUP_PAGE_SIZE, allGroupKeys.length));
      },
      { root: null, rootMargin: "250px", threshold: 0 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [needsFiltering, allGroupKeys.length]);

  const visibleRowCount = displayRows.reduce((count, r) => {
    if (r.is_group_header || r.is_category_header) return count;

    if (!needsFiltering) {
      const catKey = r.category_key;
      if (catKey && expandedCategories[catKey] === false) return count;
      if (r.group_item_code && expandedGroups[r.group_item_code] === false) return count;
    }

    return count + 1;
  }, 0);

  function downloadSummaryAsCsv() {
    const dataRows = [];

    rows.forEach((r) => {
      if (r.is_group_header || r.is_category_header) return;

      const row = {
        Category: r.custom_category || "",
        "Item Code": r.item_code || "",
        "Item Name": r.item_name || "",
        "Item Group": r.item_group || "",
      };

      displayedColumns.forEach((c) => {
        row[c.label] = getCellValue(r, c.key);
      });

      dataRows.push(row);
    });

    if (dataRows.length === 0) {
      window.alert("Nothing to download.");
      return;
    }

    const headers = Object.keys(dataRows[0]);
    const lines = [];
    lines.push(headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(","));

    dataRows.forEach((row) => {
      lines.push(headers.map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(","));
    });

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `daily-stock-summary-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const renderColumnCell = (r, c) => {
    const val = getCellValue(r, c.key);
    if (c.noDot) return <span>{val}</span>;
    return <DotCell value={val} />;
  };

  const getDisplayItemPrimary = (r) => {
    const cleaned = cleanLabel(r.item_name || r.item_code);

    if (r.is_parent_item && String(r.item_group || "").toLowerCase().includes("raw")) {
      return "Raw";
    }

    if (!!r.parent_item_code && !r.is_parent_item) {
      const w = extractWeight(cleaned);
      return w || cleaned;
    }

    return cleaned;
  };

  return (
    <div className="daily-stock-summary">
      <div className="daily-stock-summary-header-row">
        <div className="daily-stock-summary-header">
          <h2 className="daily-stock-summary-title">Daily Stock Summary</h2>
          <p className="daily-stock-summary-subtitle">Sold/Return filters affect only those expanded columns</p>
        </div>

        <div className="daily-stock-summary-controls">
          <span className="daily-stock-summary-date-label">Date</span>
          <input
            type="date"
            className="input daily-stock-summary-date-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <select
            className="input daily-stock-summary-group-filter"
            value={selectedItemGroup}
            onChange={(e) => setSelectedItemGroup(e.target.value)}
            title="Filter rows by Item Group"
          >
            <option value="ALL">All Item Groups</option>
            {itemGroups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <select
            className="input daily-stock-summary-column-filter"
            value={columnFilter}
            onChange={(e) => setColumnFilter(e.target.value)}
            title="Show Item + selected column only"
          >
            {columnOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            className="input daily-stock-summary-column-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            title="Filter by Category"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setMovementOnly((v) => !v)}
            title="Show only groups where movement happened"
          >
            {movementOnly ? "Show All" : "Movement Only"}
          </button>

          <input
            type="text"
            className="input daily-stock-summary-search-input"
            placeholder="Search item / code / group"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <button type="button" className="btn btn-secondary btn-sm daily-stock-summary-download" onClick={downloadSummaryAsCsv}>
            Download Excel
          </button>

          <button type="button" className="btn btn-primary btn-sm daily-stock-summary-refresh" onClick={() => loadData(date)}>
            Refresh
          </button>
        </div>
      </div>

      <div className="daily-stock-summary-meta-row">
        <span className="daily-stock-summary-meta">
          Showing {visibleRowCount} line{visibleRowCount !== 1 ? "s" : ""}
        </span>
      </div>

      {loading && <p className="daily-stock-summary-loading text-muted">Loading stock summary...</p>}
      {error && <p className="daily-stock-summary-error alert alert-error">{error}</p>}
      {!loading && !error && displayRows.length === 0 && <p className="daily-stock-summary-empty text-muted">No rows match your filters.</p>}

      {!loading && !error && displayRows.length > 0 && (
        <div className="daily-stock-summary-table-wrapper">
          <table className="daily-stock-summary-table">
            <thead>
              <tr>
                <th rowSpan={2}>Item</th>

                {effectiveColumns.map((c) => {
                  const isExpandable = c.key === "sold_qty" || c.key === "return_qty";
                  const isOpen = !!expandedMetrics[c.key];

                  if (c.type === "group") {
                    return (
                      <th key={c.key} colSpan={c.subcols.length} className="dss-group-th">
                        <button type="button" className="dss-expand-btn" onClick={() => toggleMetric(c.key)}>
                          {c.label} <span className="dss-caret">{isOpen ? "▴" : "▾"}</span>
                        </button>
                      </th>
                    );
                  }

                  return (
                    <th key={c.key} rowSpan={2} className={isExpandable ? "dss-expandable-th" : undefined}>
                      {isExpandable ? (
                        <button type="button" className="dss-expand-btn" onClick={() => toggleMetric(c.key)}>
                          {c.label} <span className="dss-caret">{isOpen ? "▴" : "▾"}</span>
                        </button>
                      ) : (
                        c.label
                      )}
                    </th>
                  );
                })}
              </tr>

              <tr>
                {effectiveColumns.map((c) => {
                  if (c.type !== "group") return null;
                  return c.subcols.map((sc) => (
                    <th key={`${c.key}-${sc.key}`} className="dss-sub-th">
                      {sc.label}
                    </th>
                  ));
                })}
              </tr>
            </thead>

            <tbody>
              {displayRows.map((r, idx) => {
                // ✅ Category super header row (click-to-collapse like heading)
                if (r.is_category_header) {
                  const isOpen = expandedCategories[r.category_key] !== false;

                  return (
                    <tr
                      key={`cat-${r.category_key}-${idx}`}
                      className="daily-stock-summary-group-row"
                      onClick={() => toggleCategory(r.category_key)}
                      style={{ cursor: "pointer" }}
                    >
                      <td className="daily-stock-summary-group-header" colSpan={colCount}>
                        <span className="daily-stock-summary-group-icon">📁</span> {r.category_label}
                        <span className="daily-stock-summary-group-toggle">{isOpen ? "▾" : "▸"}</span>
                      </td>
                    </tr>
                  );
                }

                // hide category content when collapsed (only in normal browse mode)
                if (!needsFiltering && r.category_key && expandedCategories[r.category_key] === false) {
                  return null;
                }

                if (r.is_group_header) {
                  const isOpen = expandedGroups[r.group_item_code] !== false;
                  return (
                    <tr
                      key={`group-${r.group_item_code}-${idx}`}
                      className="daily-stock-summary-group-row"
                      onClick={() =>
                        setExpandedGroups((prev) => ({
                          ...prev,
                          [r.group_item_code]: !isOpen,
                        }))
                      }
                      style={{ cursor: "pointer" }}
                    >
                      <td className="daily-stock-summary-group-header" colSpan={colCount}>
                        <span className="daily-stock-summary-group-icon">📦</span> {r.group_label}
                        <span className="daily-stock-summary-group-toggle">{isOpen ? "▾" : "▸"}</span>
                      </td>
                    </tr>
                  );
                }

                if (!needsFiltering && r.group_item_code && expandedGroups[r.group_item_code] === false) {
                  return null;
                }

                const topLabel = getDisplayItemPrimary(r);

                return (
                  <tr
                    key={`${r.item_code}||${r.parent_item_code || ""}||${r.group_item_code || ""}`}
                    className={[
                      r.is_parent_item ? "daily-stock-summary-row-parent" : "",
                      !!r.parent_item_code && !r.is_parent_item ? "daily-stock-summary-row-child" : "",
                    ]
                      .join(" ")
                      .trim()}
                  >
                    <td className="daily-stock-summary-item">
                      <div className="daily-stock-summary-item-code">{topLabel}</div>
                    </td>

                    {effectiveColumns.map((c) => {
                      if (c.type === "group" && c.key === "sold_qty") {
                        return c.subcols.map((sc) => (
                          <td key={`${r.item_code}-sold-${sc.key}`} className="daily-stock-summary-num">
                            <DotCell value={Number(r.sold_by_customer?.[sc.key] || 0)} />
                          </td>
                        ));
                      }

                      if (c.type === "group" && c.key === "return_qty") {
                        return c.subcols.map((sc) => (
                          <td key={`${r.item_code}-ret-${sc.key}`} className="daily-stock-summary-num">
                            <DotCell
                              value={sc.key === "GOOD" ? Number(r.return_good_qty || 0) : Number(r.return_bad_qty || 0)}
                            />
                          </td>
                        ));
                      }

                      return (
                        <td key={`${r.item_code}-${c.key}`} className="daily-stock-summary-num">
                          {renderColumnCell(r, c)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!needsFiltering && visibleGroupCount < allGroupKeys.length && <div ref={sentinelRef} style={{ height: 1 }} />}
        </div>
      )}
    </div>
  );
}

export default DailyStockSummary;
