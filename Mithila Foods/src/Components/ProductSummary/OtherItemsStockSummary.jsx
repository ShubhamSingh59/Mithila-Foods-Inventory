// src/Components/OtherItemsStockSummary.jsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { getStockLedgerUpToDate } from "../api/stock";
import {getDoctypeList, getDoc} from "../api/core";
import { useOrg } from "../Context/OrgContext";
import "./DailyStockSummary.css";

const ROOT_WAREHOUSE = "Jharkahand Warehouse - MF";

const EXCLUDED_ITEM_GROUPS = ["Raw Material", "Products"];
const EXCLUDED_ITEM_GROUP_SET = new Set(EXCLUDED_ITEM_GROUPS);

const WH_STOCK_INWARD = "Raw Material - MF";
const WH_DAMAGED = "Damaged - MF";
const WH_WASTAGE = "Wastage - MF";

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
  const { activeOrg, orgs, changeOrg } = useOrg(); 

  const [date, setDate] = useState(new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10));
  const [rows, setRows] = useState([]);
  const [expandedHouses, setExpandedHouses] = useState({}); 
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
        brand: it.brand || "", 
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