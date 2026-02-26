// src/Components/DailyStockSummary.jsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { getStockLedgerUpToDate } from "../api/stock";
import {getDoctypeList, getDoc} from "../api/core";
import { useOrg } from "../Context/OrgContext";
import "./DailyStockSummary.css";

const ROOT_WAREHOUSE = "Jharkahand Warehouse - MF";

const ALLOWED_GROUPS = ["Raw Material", "Products"];
const ALLOWED_GROUP_SET = new Set(ALLOWED_GROUPS);

const WH_STOCK_INWARD = "Raw Material - MF";
const WH_DAMAGED = "Damaged - MF";
const WH_WASTAGE = "Wastage - MF";

// Chnaging the Finished Goods Warehouse According to the Brand
function isFGWarehouse(warehouseName, activeOrg) {
  if (!warehouseName) return false;

  if (activeOrg === "Prepto") return warehouseName === "Finished Goods Prepto - MF";
  if (activeOrg === "Howrah Foods") return warehouseName === "Finished Goods Howrah - MF";
  if (activeOrg === "Mithila Foods") return warehouseName === "Finished Goods Mithila - MF" || warehouseName === "Finished Goods - MF";

  // If F2D (Parent) is selected, count ALL warehouses that start with "Finished Goods"
  return warehouseName.startsWith("Finished Goods");
}

// Exclude these warehouses completely from Opening/Current calculations
const EXCLUDED_WAREHOUSES = new Set([
  "Wastage - MF",
  "Goods In Transit - MF",
  "Work In Progress - MF",
  "Rejected Warehouse - MF",
]);

const RETURN_TYPES = { ALL: "ALL", GOOD: "GOOD", BAD: "BAD" };

const COLUMNS = [
  { key: "opening_stock", label: "Opening Stock", noDot: true },
  { key: "stock_inward", label: "Stock Inward" },
  { key: "packing_activity", label: "Packing Activity" },
  { key: "sold_qty", label: "Sold Qty" },
  { key: "return_qty", label: "Return Qty" },
  { key: "adjustment_qty", label: "Adjustment" },
  { key: "wastage_material", label: "Wastage Material" },
  { key: "current_stock", label: "Current Stock", noDot: true },
];

const GROUP_PAGE_SIZE = 4;

function DailyStockSummary() {
  const { activeOrg, orgs, changeOrg } = useOrg();

  const [date, setDate] = useState(new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10)
  );
  const [rows, setRows] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedHouses, setExpandedHouses] = useState({}); // House Headers
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");

  const [itemGroups, setItemGroups] = useState(ALLOWED_GROUPS);
  const [selectedItemGroup, setSelectedItemGroup] = useState("ALL");

  const [columnFilter, setColumnFilter] = useState("ALL");

  const [houseNames, setHouseNames] = useState([]);
  const [selectedHouse, setSelectedHouse] = useState("ALL");

  const [movementOnly, setMovementOnly] = useState(false);

  const [customers, setCustomers] = useState([]);

  const [visibleGroupCount, setVisibleGroupCount] = useState(GROUP_PAGE_SIZE);
  const sentinelRef = useRef(null);

  const allowedItemsLoadedRef = useRef(false);
  const allowedItemMapRef = useRef({});
  const allowedItemCodesRef = useRef([]);

  const customersLoadedRef = useRef(false);

  const [expandedMetrics, setExpandedMetrics] = useState({ sold_qty: false });

  // The column expand and collaspe
  const toggleMetric = (key) => {
    setExpandedMetrics((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // This is dropdown for house superheading
  const toggleHouse = (houseKey) => {
    setExpandedHouses((prev) => ({
      ...prev,
      [houseKey]: !(prev[houseKey] !== false),
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

  // only take the item weight form itemname
  function extractWeight(s) {
    const str = String(s || "");
    const m1 = str.match(/\(([^)]+)\)/);
    if (m1 && m1[1]) return m1[1].trim();

    const m2 = str.match(/\b\d+(\.\d+)?\s*(kg|g|gm|grams|ml|l)\b/i);
    if (m2) return m2[0].trim();

    return "";
  }

  // Base Heading for the variations 
  function baseHeadingLabel(nameOrCode) {
    let s = cleanLabel(nameOrCode);
    s = s.replace(/\([^)]*\)/g, " ");
    s = s.replace(/\b\d+(\.\d+)?\s*(kg|g|gm|grams|ml|l)\b/gi, " ");
    s = s.replace(/\s+/g, " ").trim();
    return s || String(nameOrCode || "");
  }

  // hELPS US TO PUT THE ITEM IN OPRDER OF WEIGHTS
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

  // Coloered value and the + and - Signs
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

  const getSoldValue = (r) => Number(r.sold_qty || 0);
  const getReturnValue = (r) => Number(r.return_good_qty || 0);

  const getCellValue = (r, key) => {
    if (key === "sold_qty") return getSoldValue(r);
    if (key === "return_qty") return getReturnValue(r);
    return Number(r[key] || 0);
  };

  const getMovementScore = (r) => {
    const parts = [
      "adjustment_qty", "sold_qty", "return_good_qty", "return_bad_qty",
      "packing_activity", "stock_inward", "wastage_material",
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
        fields: JSON.stringify(["name", "item_name", "item_group", "custom_house_name", "brand"]),
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
    const houseSet = new Set();

    (all || []).forEach((it) => {
      if (!it?.name) return;
      if (!ALLOWED_GROUP_SET.has(it.item_group)) return;

      map[it.name] = {
        item_name: it.item_name || "",
        item_group: it.item_group || "",
        custom_house_name: it.custom_house_name || "",
        brand: it.brand || "",
      };
      codes.push(it.name);

      const h = String(it.custom_house_name || "").trim();
      if (h) houseSet.add(h);
    });

    allowedItemMapRef.current = map;
    allowedItemCodesRef.current = codes;
    allowedItemsLoadedRef.current = true;

    setItemGroups(ALLOWED_GROUPS);
    setHouseNames(Array.from(houseSet).sort((a, b) => a.localeCompare(b)));
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

  const loadData = useCallback(async (selectedDate, currentOrg) => {
    setLoading(true);
    setError("");
    setRows([]);
    setExpandedGroups({});
    setExpandedHouses({});
    setVisibleGroupCount(GROUP_PAGE_SIZE);

    try {
      await loadAllowedItemsOnce();
      await loadCustomersOnce();

      // Find the base labels of all products belonging to the active brand
      const activeBaseLabels = new Set();
      (allowedItemCodesRef.current || []).forEach((code) => {
        const meta = allowedItemMapRef.current[code] || {};
        if (currentOrg === "F2D TECH PRIVATE LIMITED" || meta.brand === currentOrg) {
          activeBaseLabels.add(baseHeadingLabel(meta.item_name || code));
        }
      });

      // Filter function to permit items (Brand OR Shared Raw Material linked to Brand)
      const isItemAllowedForView = (itemCode) => {
        if (currentOrg === "F2D TECH PRIVATE LIMITED") return true;
        const meta = allowedItemMapRef.current[itemCode] || {};

        // Let the brand's finished goods pass
        if (meta.brand === currentOrg) return true;

        // Let shared raw materials pass IF their base label matches a brand product!
        const isRaw = (meta.item_group || "").toLowerCase() === "raw material";
        if (isRaw && activeBaseLabels.has(baseHeadingLabel(meta.item_name || itemCode))) {
          return true;
        }

        return false;
      };

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

      const invoiceToCustomer = {};
      (siList || []).forEach((si) => {
        if (si?.name) invoiceToCustomer[si.name] = si.customer || "";
      });

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

      const reconNameSet = new Set((reconDocs || []).map((d) => d.name));
      const reconFullDocs = await Promise.all(
        (reconDocs || []).map((r) => getDoc("Stock Reconciliation", r.name).catch(() => null))
      );

      const allowedSet = new Set(allowedItemCodesRef.current);

      const openingMap = {};
      const movementMap = {};
      const adjustmentMap = {};
      const siTotalQtyMap = {};

      const soldTotalMap = {};
      const soldByCustomerMap = {};
      const goodReturnMap = {};
      const badReturnMap = {};
      const packingActMap = {};
      const purchaseInwardMap = {};

      const lastBeforeDay = {};
      const wastageMaterialMap = {};

      (sleToSelected || []).forEach((entry) => {
        const itemCode = entry.item_code;
        const warehouse = entry.warehouse;

        if (!itemCode || !warehouse) return;
        if (!allowedSet.has(itemCode)) return;
        if (!jhWarehouses.has(warehouse)) return;

        if (!isItemAllowedForView(itemCode)) return;

        const entryDate = entry.posting_date;

        if (warehouse === WH_WASTAGE) {
          if (entryDate === selectedDate) {
            const key = `${itemCode}||${warehouse}`;
            const qty = parseFloat(entry.actual_qty) || 0;
            wastageMaterialMap[key] = (wastageMaterialMap[key] || 0) + qty;
          }
          return;
        }

        if (EXCLUDED_WAREHOUSES.has(warehouse)) return;

        const key = `${itemCode}||${warehouse}`;
        const qty = parseFloat(entry.actual_qty) || 0;
        const balance = parseFloat(entry.qty_after_transaction) || 0;
        const rawVtype = entry.voucher_type || "";
        const vtype = typeof rawVtype === "string" ? rawVtype.trim() : rawVtype;
        const ts = makeTs(entry);
        const isRecon = reconNameSet.has(entry.voucher_no);

        if (entryDate < selectedDate) {
          const existing = lastBeforeDay[key];
          if (!existing || ts > existing.ts) lastBeforeDay[key] = { ts, balance };
        }

        if (entryDate !== selectedDate) return;

        if (vtype === "Sales Invoice") {
          siTotalQtyMap[key] = (siTotalQtyMap[key] || 0) + qty;
          const invName = entry.voucher_no;
          const customer = invoiceToCustomer[invName] || "Unknown";

          if (isFGWarehouse(warehouse, currentOrg) && qty < 0) {
            const n = -Math.abs(qty);
            soldTotalMap[key] = (soldTotalMap[key] || 0) + n;
            if (!soldByCustomerMap[key]) soldByCustomerMap[key] = {};
            soldByCustomerMap[key][customer] = (soldByCustomerMap[key][customer] || 0) + n;
          }

          if (qty > 0) {
            if (isFGWarehouse(warehouse, currentOrg)) goodReturnMap[key] = (goodReturnMap[key] || 0) + qty;
            else if (warehouse === WH_DAMAGED) badReturnMap[key] = (badReturnMap[key] || 0) + qty;
            else goodReturnMap[key] = (goodReturnMap[key] || 0) + qty;
          }
          return;
        }

        if (vtype === "Stock Entry") {
          const seName = entry.voucher_no;
          if (manufacturingSE.has(seName)) {
            packingActMap[key] = (packingActMap[key] || 0) + qty;
          }
        }

        if (warehouse === WH_STOCK_INWARD && (vtype === "Purchase Invoice" || vtype === "Purchase Receipt")) {
          purchaseInwardMap[key] = (purchaseInwardMap[key] || 0) + qty;
        }

        if (!isRecon) {
          movementMap[key] = (movementMap[key] || 0) + qty;
        }
      });

      Object.keys(lastBeforeDay).forEach((key) => {
        openingMap[key] = lastBeforeDay[key].balance;
      });

      for (const doc of reconFullDocs || []) {
        if (!doc) continue;
        (doc.items || []).forEach((it) => {
          const itemCode = it.item_code;
          const warehouse = it.warehouse;
          if (!itemCode || !warehouse) return;
          if (!allowedSet.has(itemCode)) return;
          if (!jhWarehouses.has(warehouse)) return;
          if (EXCLUDED_WAREHOUSES.has(warehouse)) return;

          if (!isItemAllowedForView(itemCode)) return;

          const key = `${itemCode}||${warehouse}`;
          const currentQty = parseFloat(it.current_qty || 0);
          const newQty = parseFloat(it.qty || 0);
          const delta = newQty - currentQty;

          adjustmentMap[key] = (adjustmentMap[key] || 0) + delta;
        });
      }

      const keys = new Set([
        ...Object.keys(openingMap), ...Object.keys(movementMap), ...Object.keys(adjustmentMap),
        ...Object.keys(siTotalQtyMap), ...Object.keys(soldTotalMap), ...Object.keys(goodReturnMap),
        ...Object.keys(badReturnMap), ...Object.keys(packingActMap), ...Object.keys(purchaseInwardMap),
        ...Object.keys(wastageMaterialMap),
      ]);

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
        const wastage_material_qty = Number(wastageMaterialMap[key] || 0);

        const current_stock = opening_stock + movement_qty + adjustment_qty + si_qty_total;

        const meta = allowedItemMapRef.current[item_code] || {};

        return {
          item_code,
          item_name: meta.item_name || "",
          item_group: meta.item_group || "",
          custom_house_name: meta.custom_house_name || "",
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
          wastage_material_qty,
          current_stock,
        };
      });

      const pivotByItem = {};
      (allowedItemCodesRef.current || []).forEach((code) => {
        if (!isItemAllowedForView(code)) return;

        const meta = allowedItemMapRef.current[code] || {};

        pivotByItem[code] = {
          item_code: code,
          item_name: meta.item_name || "",
          item_group: meta.item_group || "",
          custom_house_name: meta.custom_house_name || "",
          opening_stock: 0,
          adjustment_qty: 0,
          sold_qty: 0,
          sold_by_customer: {},
          return_good_qty: 0,
          return_bad_qty: 0,
          packing_activity: 0,
          stock_inward: 0,
          wastage_material: 0,
          current_stock: 0,
        };
      });

      flat.forEach((r) => {
        const pr = pivotByItem[r.item_code];
        if (!pr) return;

        if (r.warehouse !== WH_DAMAGED) {
          pr.opening_stock += Number(r.opening_stock || 0);
          pr.adjustment_qty += Number(r.adjustment_qty || 0);
          pr.current_stock += Number(r.current_stock || 0);
        }

        pr.sold_qty += Number(r.sold_qty || 0);
        Object.entries(r.sold_by_customer || {}).forEach(([cust, qty]) => {
          pr.sold_by_customer[cust] = (pr.sold_by_customer[cust] || 0) + Number(qty || 0);
        });

        pr.return_good_qty += Number(r.good_return_qty || 0);
        pr.return_bad_qty += Number(r.bad_return_qty || 0);
        pr.packing_activity += Number(r.packing_act_qty || 0);

        if (r.warehouse === WH_WASTAGE) {
          pr.wastage_material += Number(r.wastage_material_qty || 0);
        }

        if (r.warehouse === WH_STOCK_INWARD) {
          pr.stock_inward += Number(r.purchase_inward_qty || 0);
        }
      });

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
        let houseName = "";

        codes.forEach((code) => {
          const r = pivotByItem[code];
          if (!r) return;
          score += getMovementScore(r);
          if (!houseName) houseName = String(r.custom_house_name || "").trim();
        });

        return { label, score, houseName: houseName || "Uncategorized" };
      });

      groupMeta.sort((a, b) => {
        const aHas = a.score > 0;
        const bHas = b.score > 0;
        if (aHas !== bHas) return aHas ? -1 : 1;
        if (aHas && bHas && a.score !== b.score) return b.score - a.score;
        return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
      });

      const houseOrder = Array.from(new Set(groupMeta.map((g) => g.houseName))).sort((a, b) => a.localeCompare(b));
      const groupsByHouse = {};
      houseOrder.forEach((h) => (groupsByHouse[h] = []));
      groupMeta.forEach((g) => {
        if (!groupsByHouse[g.houseName]) groupsByHouse[g.houseName] = [];
        groupsByHouse[g.houseName].push(g);
      });

      const finalRows = [];
      const newExpanded = {};
      const newHouseExpanded = {};

      houseOrder.forEach((house) => {
        const list = groupsByHouse[house] || [];
        if (!list.length) return;

        const houseKey = `HOUSE:${house}`;

        finalRows.push({
          is_house_header: true,
          house_key: houseKey,
          house_label: house,
        });

        newHouseExpanded[houseKey] = true;

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
            house_key: houseKey,
            house_label: house,
          });

          const parentCode = sortedCodes.find((c) => (pivotByItem[c]?.item_group || "").toLowerCase() === "raw material") || sortedCodes[0];

          sortedCodes.forEach((code) => {
            const row = pivotByItem[code];
            if (!row) return;

            const isParent = code === parentCode;
            finalRows.push({
              ...row,
              group_item_code: groupKey,
              is_parent_item: isParent,
              parent_item_code: isParent ? null : parentCode,
              house_key: houseKey,
              house_label: house,
            });
          });

          newExpanded[groupKey] = true;
        });
      });

      setRows(finalRows);
      setExpandedGroups(newExpanded);
      setExpandedHouses(newHouseExpanded);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load daily stock summary");
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger refresh when Date OR Active Brand changes
  useEffect(() => {
    loadData(date, activeOrg);
  }, [date, activeOrg, loadData]);

  useEffect(() => {
    if (selectedItemGroup !== "ALL" && !itemGroups.includes(selectedItemGroup)) {
      setSelectedItemGroup("ALL");
    }
  }, [itemGroups, selectedItemGroup]);

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

  const soldSubcols = useMemo(() => {
    const base = (customers || []).map((c) => ({ key: c.value, label: c.label }));
    const known = new Set(base.map((x) => x.key));

    const extra = new Set();
    rows.forEach((r) => {
      if (r.is_group_header || r.is_house_header) return;
      Object.keys(r.sold_by_customer || {}).forEach((k) => {
        if (!known.has(k)) extra.add(k);
      });
    });

    const extraCols = Array.from(extra).sort((a, b) => a.localeCompare(b)).map((k) => ({ key: k, label: k }));
    const all = [...base, ...extraCols];
    return all.length ? all : [{ key: "__NONE__", label: "(No customers)" }];
  }, [customers, rows]);

  const effectiveColumns = useMemo(() => {
    const out = [];
    displayedColumns.forEach((c) => {
      if (c.key === "sold_qty" && expandedMetrics.sold_qty) {
        out.push({ type: "group", key: "sold_qty", label: "Sold Qty", subcols: soldSubcols });
        return;
      }
      out.push({ type: "col", ...c });
    });
    return out;
  }, [displayedColumns, expandedMetrics, soldSubcols]);

  const leafColumnCount = useMemo(() => {
    return effectiveColumns.reduce((sum, c) => {
      if (c.type === "group") return sum + (c.subcols?.length || 0);
      return sum + 1;
    }, 0);
  }, [effectiveColumns]);

  const colCount = 1 + leafColumnCount;

  const lowerSearch = searchTerm.trim().toLowerCase();
  let displayRows = rows;

  const needsFiltering = lowerSearch || selectedItemGroup !== "ALL" || selectedHouse !== "ALL" || movementOnly;

  if (needsFiltering) {
    const out = [];
    let currentHouse = null;
    let houseBucket = [];
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

      const byItemGroup = selectedItemGroup === "ALL" ? groupBucket : groupBucket.filter((d) => (d.item_group || "") === selectedItemGroup);
      const headerMatches = lowerSearch && ((currentGroupHeader.group_label || "").toLowerCase().includes(lowerSearch) || (currentGroupHeader.group_item_code || "").toLowerCase().includes(lowerSearch));

      const detailsBySearch = byItemGroup.filter((d) => {
        if (!lowerSearch) return true;
        const name = (d.item_name || "").toLowerCase();
        const codeStr = (d.item_code || "").toLowerCase();
        return name.includes(lowerSearch) || codeStr.includes(lowerSearch);
      });

      const keepDetails = headerMatches ? byItemGroup : detailsBySearch;

      if (keepDetails.length > 0) {
        houseBucket.push(currentGroupHeader);
        keepDetails.forEach((d) => houseBucket.push(d));
      }

      currentGroupHeader = null;
      groupBucket = [];
    };

    const flushHouse = () => {
      flushGroup();
      if (!currentHouse) return;

      const hName = currentHouse.house_label || "Uncategorized";
      if (selectedHouse !== "ALL" && hName !== selectedHouse) {
        // drop
      } else if (houseBucket.length > 0) {
        out.push(currentHouse);
        houseBucket.forEach((x) => out.push(x));
      }

      currentHouse = null;
      houseBucket = [];
    };

    rows.forEach((r) => {
      if (r.is_house_header) {
        flushHouse();
        currentHouse = r;
        return;
      }
      if (r.is_group_header) {
        flushGroup();
        currentGroupHeader = r;
        return;
      }
      groupBucket.push(r);
    });

    flushHouse();
    displayRows = out;
  }

  const allGroupKeys = useMemo(() => rows.filter((r) => r.is_group_header).map((r) => r.group_item_code), [rows]);

  const visibleGroupKeySet = useMemo(() => {
    if (needsFiltering) return new Set(allGroupKeys);
    return new Set(allGroupKeys.slice(0, visibleGroupCount));
  }, [needsFiltering, allGroupKeys, visibleGroupCount]);

  const visibleHouseKeySet = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      if (r.is_group_header && visibleGroupKeySet.has(r.group_item_code) && r.house_key) {
        set.add(r.house_key);
      }
    });
    return set;
  }, [rows, visibleGroupKeySet]);

  displayRows = displayRows.filter((r) => {
    if (r.is_house_header) return visibleHouseKeySet.has(r.house_key);
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
    if (r.is_group_header || r.is_house_header) return count;

    if (!needsFiltering) {
      const hKey = r.house_key;
      if (hKey && expandedHouses[hKey] === false) return count;
      if (r.group_item_code && expandedGroups[r.group_item_code] === false) return count;
    }

    return count + 1;
  }, 0);

  function downloadSummaryAsCsv() {
    const dataRows = [];
    rows.forEach((r) => {
      if (r.is_group_header || r.is_house_header) return;

      const row = {
        "House Name": r.custom_house_name || "",
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
          <h2 className="daily-stock-summary-title">Daily Stock Movement Summary</h2>
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
            value={activeOrg}
            onChange={(e) => changeOrg(e.target.value)}
            title="Switch Brand / Organization"
            style={{ fontWeight: "bold", color: "#007bff" }} // Highlights that this is the main brand filter
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            className="input daily-stock-summary-group-filter"
            value={selectedItemGroup}
            onChange={(e) => setSelectedItemGroup(e.target.value)}
            title="Filter rows by Item Group"
          >
            <option value="ALL">All Item Groups</option>
            {itemGroups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <select
            className="input daily-stock-summary-column-filter"
            value={columnFilter}
            onChange={(e) => setColumnFilter(e.target.value)}
            title="Show Item + selected column only"
          >
            {columnOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            className="input daily-stock-summary-column-filter"
            value={selectedHouse}
            onChange={(e) => setSelectedHouse(e.target.value)}
            title="Filter by House Name"
          >
            <option value="ALL">All Houses</option>
            {houseNames.map((c) => (
              <option key={c} value={c}>{c}</option>
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

          <button type="button" className="btn btn-primary btn-sm daily-stock-summary-refresh" onClick={() => loadData(date, activeOrg)}>
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
                  const isExpandable = c.key === "sold_qty";
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
                    <th key={`${c.key}-${sc.key}`} className="dss-sub-th">{sc.label}</th>
                  ));
                })}
              </tr>
            </thead>

            <tbody>
              {displayRows.map((r, idx) => {
                if (r.is_house_header) {
                  const isOpen = expandedHouses[r.house_key] !== false;

                  return (
                    <tr
                      key={`house-${r.house_key}-${idx}`}
                      className="daily-stock-summary-group-row"
                      onClick={() => toggleHouse(r.house_key)}
                      style={{ cursor: "pointer" }}
                    >
                      <td className="daily-stock-summary-group-header" colSpan={colCount}>
                        <span className="daily-stock-summary-group-icon">🏠</span> {r.house_label}
                        <span className="daily-stock-summary-group-toggle">{isOpen ? "▾" : "▸"}</span>
                      </td>
                    </tr>
                  );
                }

                if (!needsFiltering && r.house_key && expandedHouses[r.house_key] === false) {
                  return null;
                }

                if (r.is_group_header) {
                  const isOpen = expandedGroups[r.group_item_code] !== false;
                  return (
                    <tr
                      key={`group-${r.group_item_code}-${idx}`}
                      className="daily-stock-summary-group-row"
                      onClick={() =>
                        setExpandedGroups((prev) => ({ ...prev, [r.group_item_code]: !isOpen }))
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
                    ].join(" ").trim()}
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