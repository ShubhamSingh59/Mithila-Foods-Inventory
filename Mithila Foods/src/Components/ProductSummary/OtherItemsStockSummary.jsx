//// src/Components/OtherItemsStockSummary.jsx
//import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
//import { getStockLedgerUpToDate, getDoctypeList, getDoc } from "../erpBackendApi.jsx";
//import "./DailyStockSummary.css";

//// ✅ Same warehouse scope as your existing summary
//const ROOT_WAREHOUSE = "Jharkahand Warehouse - MF";

//// ✅ This summary is for items that are NOT in these groups
//const EXCLUDED_ITEM_GROUPS = ["Raw Material", "Products"];
//const EXCLUDED_ITEM_GROUP_SET = new Set(EXCLUDED_ITEM_GROUPS);

//// Warehouses used in your logic
//const WH_STOCK_INWARD = "Raw Material - MF";
//const WH_DAMAGED = "Damaged - MF";
//const WH_WASTAGE = "Wastage - MF";

//// ✅ Exclude these warehouses completely from Opening/Current calculations
//// + ✅ also exclude Damaged so Current Stock = only "good" warehouses
//const EXCLUDED_WAREHOUSES = new Set([
//  "Wastage - MF",
//  "Goods In Transit - MF",
//  "Work In Progress - MF",
//  "Rejected Warehouse - MF",
//  WH_DAMAGED,
//]);

//// ✅ Columns you asked for
//const COLUMNS = [
//  { key: "opening_stock", label: "Opening Stock", noDot: true },
//  { key: "stock_inward", label: "Stock Inward" },
//  { key: "packing_activity", label: "Paking Activity" },
//  { key: "adjustment_qty", label: "Adjustment" },
//  { key: "current_stock", label: "Current Stock", noDot: true },
//];

//const GROUP_PAGE_SIZE = 4;

//function OtherItemsStockSummary() {
//  const [date, setDate] = useState(new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
//    .toISOString()
//    .slice(0, 10));
//  const [rows, setRows] = useState([]);
//  const [expandedGroups, setExpandedGroups] = useState({});
//  const [expandedCategories, setExpandedCategories] = useState({});
//  const [loading, setLoading] = useState(false);
//  const [error, setError] = useState("");

//  const [searchTerm, setSearchTerm] = useState("");

//  const [itemGroups, setItemGroups] = useState([]);
//  const [selectedItemGroup, setSelectedItemGroup] = useState("ALL");

//  const [columnFilter, setColumnFilter] = useState("ALL");

//  const [categories, setCategories] = useState([]);
//  const [selectedCategory, setSelectedCategory] = useState("ALL");

//  const [movementOnly, setMovementOnly] = useState(false);

//  const [visibleGroupCount, setVisibleGroupCount] = useState(GROUP_PAGE_SIZE);
//  const sentinelRef = useRef(null);

//  const allowedItemsLoadedRef = useRef(false);
//  const allowedItemMapRef = useRef({});
//  const allowedItemCodesRef = useRef([]);

//  const toggleCategory = (categoryKey) => {
//    setExpandedCategories((prev) => ({
//      ...prev,
//      [categoryKey]: !(prev[categoryKey] !== false),
//    }));
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

//  // ✅ Sign + color cell
//  const DotCell = ({ value }) => {
//    const n = Number(value || 0);
//    if (n === 0) return <span>0</span>;

//    const isPos = n > 0;
//    const color = isPos ? "#16a34a" : "#dc2626";
//    const sign = isPos ? "+" : "−";

//    return (
//      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color, fontWeight: 600 }}>
//        <span style={{ fontWeight: 800 }}>{sign}</span>
//        <span>{Math.abs(n)}</span>
//      </span>
//    );
//  };

//  const getCellValue = (r, key) => Number(r[key] || 0);

//  // used for sorting / movement-only filter (simple + reliable)
//  const getMovementScore = (r) => Math.abs(Number(r.current_stock || 0) - Number(r.opening_stock || 0));

//  async function loadAllowedItemsOnce() {
//    if (allowedItemsLoadedRef.current) return;

//    const pageSize = 2000;
//    let start = 0;
//    const all = [];

//    while (true) {
//      const part = await getDoctypeList("Item", {
//        fields: JSON.stringify(["name", "item_name", "item_group", "custom_category"]),
//        filters: JSON.stringify([
//          ["Item", "item_group", "not in", EXCLUDED_ITEM_GROUPS],
//        ]),
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
//    const groupSet = new Set();
//    const catSet = new Set();

//    (all || []).forEach((it) => {
//      if (!it?.name) return;

//      const ig = String(it.item_group || "").trim();
//      if (!ig) return;
//      if (EXCLUDED_ITEM_GROUP_SET.has(ig)) return;

//      map[it.name] = {
//        item_name: it.item_name || "",
//        item_group: ig,
//        custom_category: it.custom_category || "",
//      };
//      codes.push(it.name);

//      groupSet.add(ig);

//      const c = String(it.custom_category || "").trim();
//      if (c) catSet.add(c);
//    });

//    allowedItemMapRef.current = map;
//    allowedItemCodesRef.current = codes;
//    allowedItemsLoadedRef.current = true;

//    setItemGroups(Array.from(groupSet).sort((a, b) => a.localeCompare(b)));
//    setCategories(Array.from(catSet).sort((a, b) => a.localeCompare(b)));
//  }

//  const loadData = useCallback(async (selectedDate) => {
//    setLoading(true);
//    setError("");
//    setRows([]);
//    setExpandedGroups({});
//    setExpandedCategories({});
//    setVisibleGroupCount(GROUP_PAGE_SIZE);

//    try {
//      await loadAllowedItemsOnce();

//      const [sleToSelected, reconDocs, whList, seList] = await Promise.all([
//        getStockLedgerUpToDate(selectedDate),

//        getDoctypeList("Stock Reconciliation", {
//          fields: JSON.stringify(["name", "posting_date", "docstatus"]),
//          filters: JSON.stringify([
//            ["Stock Reconciliation", "posting_date", "=", selectedDate],
//            ["Stock Reconciliation", "docstatus", "=", 1],
//          ]),
//          limit_page_length: 500,
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

//      // Warehouse subtree under ROOT
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

//      // ✅ Manufacturing Stock Entry set ONLY (no transfer)
//      const manufacturingSE = new Set();
//      (seList || []).forEach((se) => {
//        const purpose = String(se.purpose || "").toLowerCase();
//        const seType = String(se.stock_entry_type || "").toLowerCase();
//        const isMfg =
//          purpose.includes("manufact") ||
//          purpose.includes("repack") ||
//          seType.includes("manufact") ||
//          seType.includes("repack");
//        if (se.name && isMfg) manufacturingSE.add(se.name);
//      });

//      // Recon docs
//      const reconNameSet = new Set((reconDocs || []).map((d) => d.name));
//      const reconFullDocs = await Promise.all(
//        (reconDocs || []).map((r) => getDoc("Stock Reconciliation", r.name).catch(() => null))
//      );

//      const allowedSet = new Set(allowedItemCodesRef.current);

//      // Maps keyed by item||warehouse
//      const openingMap = {};
//      const movementMap = {};     // all non-recon movements
//      const adjustmentMap = {};   // recon delta

//      const packingActMap = {};       // manufacturing movement (all warehouses)
//      const purchaseInwardMap = {};   // Purchase Invoice/Receipt movement in Raw Material - MF

//      const lastBeforeDay = {};

//      (sleToSelected || []).forEach((entry) => {
//        const itemCode = entry.item_code;
//        const warehouse = entry.warehouse;
//        if (!itemCode || !warehouse) return;
//        if (!allowedSet.has(itemCode)) return;
//        if (!jhWarehouses.has(warehouse)) return;

//        const entryDate = entry.posting_date;

//        // ignore wastage + other excluded warehouses for opening/current
//        if (warehouse === WH_WASTAGE) return;
//        if (EXCLUDED_WAREHOUSES.has(warehouse)) return;

//        const key = `${itemCode}||${warehouse}`;

//        const qty = parseFloat(entry.actual_qty) || 0;
//        const balance = parseFloat(entry.qty_after_transaction) || 0;

//        const rawVtype = entry.voucher_type || "";
//        const vtype = typeof rawVtype === "string" ? rawVtype.trim() : rawVtype;

//        const ts = makeTs(entry);

//        // opening = last balance before date
//        if (entryDate < selectedDate) {
//          const existing = lastBeforeDay[key];
//          if (!existing || ts > existing.ts) lastBeforeDay[key] = { ts, balance };
//        }

//        if (entryDate !== selectedDate) return;

//        const isRecon = reconNameSet.has(entry.voucher_no);

//        // ✅ Packing Activity = Manufacturing Stock Entries (ALL warehouses)
//        if (vtype === "Stock Entry") {
//          const seName = entry.voucher_no;
//          if (manufacturingSE.has(seName)) {
//            packingActMap[key] = (packingActMap[key] || 0) + qty;
//          }
//        }

//        // ✅ Stock Inward = ONLY Purchase Invoice/Receipt movement in Raw Material warehouse
//        if (warehouse === WH_STOCK_INWARD && (vtype === "Purchase Invoice" || vtype === "Purchase Receipt")) {
//          purchaseInwardMap[key] = (purchaseInwardMap[key] || 0) + qty;
//        }

//        // normal movement (exclude recon)
//        if (!isRecon) {
//          movementMap[key] = (movementMap[key] || 0) + qty;
//        }
//      });

//      Object.keys(lastBeforeDay).forEach((key) => {
//        openingMap[key] = lastBeforeDay[key].balance;
//      });

//      // Reconciliation adjustments
//      for (const doc of reconFullDocs || []) {
//        if (!doc) continue;
//        (doc.items || []).forEach((it) => {
//          const itemCode = it.item_code;
//          const warehouse = it.warehouse;
//          if (!itemCode || !warehouse) return;
//          if (!allowedSet.has(itemCode)) return;
//          if (!jhWarehouses.has(warehouse)) return;
//          if (warehouse === WH_WASTAGE) return;
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
//        ...Object.keys(packingActMap),
//        ...Object.keys(purchaseInwardMap),
//      ]);

//      // Flat rows per item||warehouse
//      const flat = Array.from(keys).map((key) => {
//        const [item_code, warehouse] = key.split("||");

//        const opening_stock = Number(openingMap[key] || 0);
//        const movement_qty = Number(movementMap[key] || 0);
//        const adjustment_qty = Number(adjustmentMap[key] || 0);

//        const packing_act_qty = Number(packingActMap[key] || 0);
//        const purchase_inward_qty = Number(purchaseInwardMap[key] || 0);

//        const current_stock = opening_stock + movement_qty + adjustment_qty;

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
//          adjustment_qty,

//          packing_act_qty,
//          purchase_inward_qty,

//          current_stock,
//        };
//      });

//      // Pivot init for all allowed items (so grouping stays consistent)
//      const pivotByItem = {};
//      (allowedItemCodesRef.current || []).forEach((code) => {
//        const meta = allowedItemMapRef.current[code] || {};
//        pivotByItem[code] = {
//          item_code: code,
//          item_name: meta.item_name || "",
//          item_group: meta.item_group || "",
//          custom_category: meta.custom_category || "",

//          opening_stock: 0,
//          stock_inward: 0,
//          packing_activity: 0,
//          adjustment_qty: 0,
//          current_stock: 0,
//        };
//      });

//      flat.forEach((r) => {
//        const pr = pivotByItem[r.item_code];
//        if (!pr) return;

//        pr.opening_stock += Number(r.opening_stock || 0);
//        pr.adjustment_qty += Number(r.adjustment_qty || 0);
//        pr.current_stock += Number(r.current_stock || 0);

//        // ✅ Packing activity sums manufacturing movement from ALL warehouses
//        pr.packing_activity += Number(r.packing_act_qty || 0);

//        // ✅ Stock inward only Purchase Invoice/Receipt in Raw Material warehouse
//        if (r.warehouse === WH_STOCK_INWARD) {
//          pr.stock_inward += Number(r.purchase_inward_qty || 0);
//        }
//      });

//      // Grouping by base label
//      const labelGroups = {};
//      Object.values(pivotByItem).forEach((it) => {
//        const ig = String(it.item_group || "").trim();
//        if (!ig || EXCLUDED_ITEM_GROUP_SET.has(ig)) return;

//        const label = baseHeadingLabel(it.item_name || it.item_code);
//        if (!labelGroups[label]) labelGroups[label] = [];
//        labelGroups[label].push(it.item_code);
//      });

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

//      // Category super heading
//      const categoryOrder = Array.from(new Set(groupMeta.map((g) => g.category))).sort((a, b) => a.localeCompare(b));

//      const groupsByCategory = {};
//      categoryOrder.forEach((c) => (groupsByCategory[c] = []));
//      groupMeta.forEach((g) => {
//        if (!groupsByCategory[g.category]) groupsByCategory[g.category] = [];
//        groupsByCategory[g.category].push(g);
//      });

//      const finalRows = [];
//      const newExpanded = {};
//      const newCatExpanded = {};

//      categoryOrder.forEach((cat) => {
//        const list = groupsByCategory[cat] || [];
//        if (!list.length) return;

//        const catKey = `CAT:${cat}`;

//        finalRows.push({
//          is_category_header: true,
//          category_key: catKey,
//          category_label: cat,
//        });

//        newCatExpanded[catKey] = true;

//        list.forEach(({ label, score }) => {
//          const codes = labelGroups[label] || [];

//          const sortedCodes = codes.slice().sort((a, b) => {
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
//            group_score: score,
//            category_key: catKey,
//            category_label: cat,
//          });

//          sortedCodes.forEach((code, idx) => {
//            const row = pivotByItem[code];
//            if (!row) return;

//            // mark first as "parent" just for styling consistency
//            const isParent = idx === 0;

//            finalRows.push({
//              ...row,
//              group_item_code: groupKey,
//              is_parent_item: isParent,
//              parent_item_code: isParent ? null : sortedCodes[0],
//              category_key: catKey,
//              category_label: cat,
//            });
//          });

//          newExpanded[groupKey] = true;
//        });
//      });

//      setRows(finalRows);
//      setExpandedGroups(newExpanded);
//      setExpandedCategories(newCatExpanded);
//    } catch (err) {
//      console.error(err);
//      setError(err.message || "Failed to load stock summary");
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

//  // column filter options
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

//  const colCount = 1 + displayedColumns.length;

//  // ---------------- DISPLAY FILTERS ----------------
//  const lowerSearch = searchTerm.trim().toLowerCase();
//  let displayRows = rows;

//  const needsFiltering =
//    lowerSearch || selectedItemGroup !== "ALL" || selectedCategory !== "ALL" || movementOnly;

//  if (needsFiltering) {
//    const out = [];

//    let currentCategory = null;
//    let categoryBucket = [];

//    let currentGroupHeader = null;
//    let groupBucket = [];

//    const flushGroup = () => {
//      if (!currentGroupHeader) return;

//      const groupScore = Number(currentGroupHeader.group_score || 0);
//      if (movementOnly && groupScore === 0) {
//        currentGroupHeader = null;
//        groupBucket = [];
//        return;
//      }

//      const byItemGroup =
//        selectedItemGroup === "ALL"
//          ? groupBucket
//          : groupBucket.filter((d) => (d.item_group || "") === selectedItemGroup);

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

//    if (!needsFiltering) {
//      const catKey = r.category_key;
//      if (catKey && expandedCategories[catKey] === false) return count;
//      if (r.group_item_code && expandedGroups[r.group_item_code] === false) return count;
//    }

//    return count + 1;
//  }, 0);

//  function downloadSummaryAsCsv() {
//    const dataRows = [];

//    rows.forEach((r) => {
//      if (r.is_group_header || r.is_category_header) return;

//      const row = {
//        Category: r.custom_category || "",
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
//    link.download = `other-items-stock-summary-${date}.csv`;
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

//  const getDisplayItemPrimary = (r) => {
//    const cleaned = cleanLabel(r.item_name || r.item_code);

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
//          <h2 className="daily-stock-summary-title">Other Items Daily Stock Summary</h2>
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
//                <th>Item</th>
//                {displayedColumns.map((c) => (
//                  <th key={c.key}>{c.label}</th>
//                ))}
//              </tr>
//            </thead>

//            <tbody>
//              {displayRows.map((r, idx) => {
//                if (r.is_category_header) {
//                  const isOpen = expandedCategories[r.category_key] !== false;

//                  return (
//                    <tr
//                      key={`cat-${r.category_key}-${idx}`}
//                      className="daily-stock-summary-group-row"
//                      onClick={() => toggleCategory(r.category_key)}
//                      style={{ cursor: "pointer" }}
//                    >
//                      <td className="daily-stock-summary-group-header" colSpan={colCount}>
//                        <span className="daily-stock-summary-group-icon">📁</span> {r.category_label}
//                        <span className="daily-stock-summary-group-toggle">{isOpen ? "▾" : "▸"}</span>
//                      </td>
//                    </tr>
//                  );
//                }

//                if (!needsFiltering && r.category_key && expandedCategories[r.category_key] === false) {
//                  return null;
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
//                      style={{ cursor: "pointer" }}
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

//                    {displayedColumns.map((c) => (
//                      <td key={`${r.item_code}-${c.key}`} className="daily-stock-summary-num">
//                        {renderColumnCell(r, c)}
//                      </td>
//                    ))}
//                  </tr>
//                );
//              })}
//            </tbody>
//          </table>

//          {!needsFiltering && visibleGroupCount < allGroupKeys.length && <div ref={sentinelRef} style={{ height: 1 }} />}
//        </div>
//      )}
//    </div>
//  );
//}

//export default OtherItemsStockSummary;


// src/Components/OtherItemsStockSummary.jsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { getStockLedgerUpToDate, getDoctypeList, getDoc } from "../erpBackendApi";
import { useOrg } from "../Context/OrgContext"; // ✅ Imported OrgContext
import "./DailyStockSummary.css";

// Same warehouse scope as your existing summary
const ROOT_WAREHOUSE = "Jharkahand Warehouse - MF";

// This summary is for items that are NOT in these groups
const EXCLUDED_ITEM_GROUPS = ["Raw Material", "Products"];
const EXCLUDED_ITEM_GROUP_SET = new Set(EXCLUDED_ITEM_GROUPS);

// Warehouses used in your logic
const WH_STOCK_INWARD = "Raw Material - MF";
const WH_DAMAGED = "Damaged - MF";
const WH_WASTAGE = "Wastage - MF";

// Exclude these warehouses completely from Opening/Current calculations
const EXCLUDED_WAREHOUSES = new Set([
  "Wastage - MF",
  "Goods In Transit - MF",
  "Work In Progress - MF",
  "Rejected Warehouse - MF",
  WH_DAMAGED,
]);

// Columns for Other Items
const COLUMNS = [
  { key: "opening_stock", label: "Opening Stock", noDot: true },
  { key: "stock_inward", label: "Stock Inward" },
  { key: "packing_activity", label: "Packing Activity" },
  { key: "adjustment_qty", label: "Adjustment" },
  { key: "current_stock", label: "Current Stock", noDot: true },
];

const GROUP_PAGE_SIZE = 4;

function OtherItemsStockSummary() {
  const { activeOrg, orgs, changeOrg } = useOrg(); // ✅ Pull in Brand Context

  const [date, setDate] = useState(new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10));
  const [rows, setRows] = useState([]);
  const [expandedHouses, setExpandedHouses] = useState({}); // ✅ Replaced Category with House
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");

  const [itemGroups, setItemGroups] = useState([]);
  const [selectedItemGroup, setSelectedItemGroup] = useState("ALL");

  const [columnFilter, setColumnFilter] = useState("ALL");

  const [houseNames, setHouseNames] = useState([]);
  const [selectedHouse, setSelectedHouse] = useState("ALL");

  const [movementOnly, setMovementOnly] = useState(false);

  const [visibleHouseCount, setVisibleHouseCount] = useState(GROUP_PAGE_SIZE);
  const sentinelRef = useRef(null);

  const allowedItemsLoadedRef = useRef(false);
  const allowedItemMapRef = useRef({});
  const allowedItemCodesRef = useRef([]);

  const toggleHouse = (houseKey) => {
    setExpandedHouses((prev) => ({
      ...prev,
      [houseKey]: !(prev[houseKey] !== false),
    }));
  };

  function makeTs(entry) {
    return `${entry.posting_date} ${entry.posting_time || "00:00:00"}`;
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

  const getCellValue = (r, key) => Number(r[key] || 0);

  // Movement calculation for filtering
  const getMovementScore = (r) => Math.abs(Number(r.current_stock || 0) - Number(r.opening_stock || 0));

  async function loadAllowedItemsOnce() {
    if (allowedItemsLoadedRef.current) return;

    const pageSize = 2000;
    let start = 0;
    const all = [];

    while (true) {
      const part = await getDoctypeList("Item", {
        // ✅ Added custom_house_name and brand
        fields: JSON.stringify(["name", "item_name", "item_group", "custom_house_name", "brand"]),
        filters: JSON.stringify([
          ["Item", "item_group", "not in", EXCLUDED_ITEM_GROUPS],
        ]),
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
    const groupSet = new Set();
    const houseSet = new Set();

    (all || []).forEach((it) => {
      if (!it?.name) return;

      const ig = String(it.item_group || "").trim();
      if (!ig) return;
      if (EXCLUDED_ITEM_GROUP_SET.has(ig)) return;

      map[it.name] = {
        item_name: it.item_name || "",
        item_group: ig,
        custom_house_name: it.custom_house_name || "",
        brand: it.brand || "", // Store brand
      };
      codes.push(it.name);

      groupSet.add(ig);

      const h = String(it.custom_house_name || "").trim();
      if (h) houseSet.add(h);
    });

    allowedItemMapRef.current = map;
    allowedItemCodesRef.current = codes;
    allowedItemsLoadedRef.current = true;

    setItemGroups(Array.from(groupSet).sort((a, b) => a.localeCompare(b)));
    setHouseNames(Array.from(houseSet).sort((a, b) => a.localeCompare(b)));
  }

  const loadData = useCallback(async (selectedDate, currentOrg) => {
    setLoading(true);
    setError("");
    setRows([]);
    setExpandedHouses({});
    setVisibleHouseCount(GROUP_PAGE_SIZE);

    try {
      await loadAllowedItemsOnce();

      const [sleToSelected, reconDocs, whList, seList] = await Promise.all([
        getStockLedgerUpToDate(selectedDate),

        getDoctypeList("Stock Reconciliation", {
          fields: JSON.stringify(["name", "posting_date", "docstatus"]),
          filters: JSON.stringify([
            ["Stock Reconciliation", "posting_date", "=", selectedDate],
            ["Stock Reconciliation", "docstatus", "=", 1],
          ]),
          limit_page_length: 500,
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
      const packingActMap = {};
      const purchaseInwardMap = {};
      const lastBeforeDay = {};

      (sleToSelected || []).forEach((entry) => {
        const itemCode = entry.item_code;
        const warehouse = entry.warehouse;
        if (!itemCode || !warehouse) return;
        if (!allowedSet.has(itemCode)) return;
        if (!jhWarehouses.has(warehouse)) return;

        // ✅ Brand Filter applied to ledger
        const meta = allowedItemMapRef.current[itemCode] || {};
        if (currentOrg !== "F2D TECH PRIVATE LIMITED" && meta.brand !== currentOrg) return;

        const entryDate = entry.posting_date;

        if (warehouse === WH_WASTAGE) return;
        if (EXCLUDED_WAREHOUSES.has(warehouse)) return;

        const key = `${itemCode}||${warehouse}`;
        const qty = parseFloat(entry.actual_qty) || 0;
        const balance = parseFloat(entry.qty_after_transaction) || 0;
        const rawVtype = entry.voucher_type || "";
        const vtype = typeof rawVtype === "string" ? rawVtype.trim() : rawVtype;
        const ts = makeTs(entry);

        if (entryDate < selectedDate) {
          const existing = lastBeforeDay[key];
          if (!existing || ts > existing.ts) lastBeforeDay[key] = { ts, balance };
        }

        if (entryDate !== selectedDate) return;

        const isRecon = reconNameSet.has(entry.voucher_no);

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
          if (warehouse === WH_WASTAGE) return;
          if (EXCLUDED_WAREHOUSES.has(warehouse)) return;

          // ✅ Brand Filter applied to Reconciliation
          const meta = allowedItemMapRef.current[itemCode] || {};
          if (currentOrg !== "F2D TECH PRIVATE LIMITED" && meta.brand !== currentOrg) return;

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
        ...Object.keys(packingActMap),
        ...Object.keys(purchaseInwardMap),
      ]);

      const flat = Array.from(keys).map((key) => {
        const [item_code, warehouse] = key.split("||");

        const opening_stock = Number(openingMap[key] || 0);
        const movement_qty = Number(movementMap[key] || 0);
        const adjustment_qty = Number(adjustmentMap[key] || 0);
        const packing_act_qty = Number(packingActMap[key] || 0);
        const purchase_inward_qty = Number(purchaseInwardMap[key] || 0);

        const current_stock = opening_stock + movement_qty + adjustment_qty;

        return {
          item_code,
          warehouse,
          opening_stock,
          adjustment_qty,
          packing_act_qty,
          purchase_inward_qty,
          current_stock,
        };
      });

      const pivotByItem = {};
      (allowedItemCodesRef.current || []).forEach((code) => {
        const meta = allowedItemMapRef.current[code] || {};
        
        // ✅ Filter Pivot by Brand
        if (currentOrg !== "F2D TECH PRIVATE LIMITED" && meta.brand !== currentOrg) return;

        pivotByItem[code] = {
          item_code: code,
          item_name: meta.item_name || "",
          item_group: meta.item_group || "",
          custom_house_name: meta.custom_house_name || "Uncategorized",
          opening_stock: 0,
          stock_inward: 0,
          packing_activity: 0,
          adjustment_qty: 0,
          current_stock: 0,
        };
      });

      flat.forEach((r) => {
        const pr = pivotByItem[r.item_code];
        if (!pr) return;

        pr.opening_stock += Number(r.opening_stock || 0);
        pr.adjustment_qty += Number(r.adjustment_qty || 0);
        pr.current_stock += Number(r.current_stock || 0);
        pr.packing_activity += Number(r.packing_act_qty || 0);

        if (r.warehouse === WH_STOCK_INWARD) {
          pr.stock_inward += Number(r.purchase_inward_qty || 0);
        }
      });

      // ✅ 3. STRAIGHT LIST GROUPING (No fake BOM grouping)
      const houseOrder = Array.from(new Set(Object.values(pivotByItem).map((it) => it.custom_house_name))).sort();

      const finalRows = [];
      const newHouseExpanded = {};

      houseOrder.forEach((house) => {
        const itemsInHouse = Object.values(pivotByItem).filter((it) => it.custom_house_name === house);
        if (!itemsInHouse.length) return;

        const houseKey = `HOUSE:${house}`;

        finalRows.push({
          is_house_header: true,
          house_key: houseKey,
          house_label: house,
        });

        newHouseExpanded[houseKey] = true;

        // Sort items alphabetically inside the house
        itemsInHouse.sort((a, b) => a.item_name.localeCompare(b.item_name));

        itemsInHouse.forEach((it) => {
          finalRows.push({
            ...it,
            house_key: houseKey,
          });
        });
      });

      setRows(finalRows);
      setExpandedHouses(newHouseExpanded);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load stock summary");
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ Trigger fetch when Date OR Brand changes
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

  const colCount = 1 + displayedColumns.length;

  // ---------------- DISPLAY FILTERS ----------------
  const lowerSearch = searchTerm.trim().toLowerCase();
  let displayRows = rows;

  const needsFiltering =
    lowerSearch || selectedItemGroup !== "ALL" || selectedHouse !== "ALL" || movementOnly;

  if (needsFiltering) {
    const out = [];
    let currentHouse = null;
    let itemBucket = [];

    const flushHouse = () => {
      if (!currentHouse) return;

      const filteredItems = itemBucket.filter((d) => {
        if (selectedItemGroup !== "ALL" && d.item_group !== selectedItemGroup) return false;
        if (movementOnly && getMovementScore(d) === 0) return false;
        if (lowerSearch) {
          const name = (d.item_name || "").toLowerCase();
          const codeStr = (d.item_code || "").toLowerCase();
          return name.includes(lowerSearch) || codeStr.includes(lowerSearch);
        }
        return true;
      });

      const hName = currentHouse.house_label || "Uncategorized";
      if (selectedHouse !== "ALL" && hName !== selectedHouse) {
        // drop
      } else if (filteredItems.length > 0) {
        out.push(currentHouse);
        filteredItems.forEach((x) => out.push(x));
      }

      currentHouse = null;
      itemBucket = [];
    };

    rows.forEach((r) => {
      if (r.is_house_header) {
        flushHouse();
        currentHouse = r;
      } else {
        itemBucket.push(r);
      }
    });

    flushHouse();
    displayRows = out;
  }

  // ---------------- INFINITE HOUSE PAGING ----------------
  const allHouseKeys = useMemo(
    () => rows.filter((r) => r.is_house_header).map((r) => r.house_key),
    [rows]
  );

  const visibleHouseKeySet = useMemo(() => {
    if (needsFiltering) return new Set(allHouseKeys);
    return new Set(allHouseKeys.slice(0, visibleHouseCount));
  }, [needsFiltering, allHouseKeys, visibleHouseCount]);

  displayRows = displayRows.filter((r) => r.house_key && visibleHouseKeySet.has(r.house_key));

  useEffect(() => {
    setVisibleHouseCount(GROUP_PAGE_SIZE);
  }, [date, activeOrg]);

  useEffect(() => {
    if (needsFiltering) return;
    const el = sentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries?.[0]?.isIntersecting) return;
        setVisibleHouseCount((v) => Math.min(v + GROUP_PAGE_SIZE, allHouseKeys.length));
      },
      { root: null, rootMargin: "250px", threshold: 0 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [needsFiltering, allHouseKeys.length]);

  const visibleRowCount = displayRows.reduce((count, r) => {
    if (r.is_house_header) return count;
    if (!needsFiltering && r.house_key && expandedHouses[r.house_key] === false) return count;
    return count + 1;
  }, 0);

  function downloadSummaryAsCsv() {
    const dataRows = [];

    rows.forEach((r) => {
      if (r.is_house_header) return;

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
    link.download = `other-items-stock-summary-${date}.csv`;
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

  return (
    <div className="daily-stock-summary">
      <div className="daily-stock-summary-header-row">
        <div className="daily-stock-summary-header">
          <h2 className="daily-stock-summary-title">Other Items Daily Stock Summary</h2>
        </div>

        <div className="daily-stock-summary-controls">
          <span className="daily-stock-summary-date-label">Date</span>
          <input
            type="date"
            className="input daily-stock-summary-date-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          {/* ✅ BRAND SWITCHER */}
          <select
            className="input daily-stock-summary-group-filter"
            value={activeOrg}
            onChange={(e) => changeOrg(e.target.value)}
            title="Switch Brand / Organization"
            style={{ fontWeight: "bold", color: "#007bff" }}
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
            value={selectedHouse}
            onChange={(e) => setSelectedHouse(e.target.value)}
            title="Filter by House Name"
          >
            <option value="ALL">All Houses</option>
            {houseNames.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setMovementOnly((v) => !v)}
            title="Show only items where movement happened"
          >
            {movementOnly ? "Show All" : "Movement Only"}
          </button>

          <input
            type="text"
            className="input daily-stock-summary-search-input"
            placeholder="Search item / code"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <button
            type="button"
            className="btn btn-secondary btn-sm daily-stock-summary-download"
            onClick={downloadSummaryAsCsv}
          >
            Download Excel
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm daily-stock-summary-refresh"
            onClick={() => loadData(date, activeOrg)}
          >
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
      {!loading && !error && displayRows.length === 0 && (
        <p className="daily-stock-summary-empty text-muted">No rows match your filters.</p>
      )}

      {!loading && !error && displayRows.length > 0 && (
        <div className="daily-stock-summary-table-wrapper">
          <table className="daily-stock-summary-table">
            <thead>
              <tr>
                <th>Item</th>
                {displayedColumns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
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

                // 🚀 Notice: Removed all the old parent/child row CSS classes and base-label formatting
                return (
                  <tr key={`${r.item_code}-${r.house_key}`}>
                    <td className="daily-stock-summary-item">
                      <div className="daily-stock-summary-item-code">{r.item_name || r.item_code}</div>
                    </td>

                    {displayedColumns.map((c) => (
                      <td key={`${r.item_code}-${c.key}`} className="daily-stock-summary-num">
                        {renderColumnCell(r, c)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!needsFiltering && visibleHouseCount < allHouseKeys.length && <div ref={sentinelRef} style={{ height: 1 }} />}
        </div>
      )}
    </div>
  );
}

export default OtherItemsStockSummary;