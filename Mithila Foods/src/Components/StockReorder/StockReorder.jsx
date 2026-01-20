// src/Components/StockReorder.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDoctypeList } from "../erpBackendApi";
import "./StockReorder.css";

/**
 * Stock Reorder (Read-only dashboard)
 * ----------------------------------
 * Goal:
 * - Show items that have a reorder level set (from "Item Reorder" child table)
 * - Compare Current Stock (Bin.actual_qty) vs Reorder Level
 * - Group by Item Group (category sections)
 *
 * Rules:
 * - Warehouse is FIXED: DEFAULT_WAREHOUSE (no selector in UI)
 * - Reorder threshold is taken from:
 *   - warehouse_reorder_level (preferred)
 *   - if reorder_level is 0, fallback to warehouse_reorder_qty
 *
 * UI features:
 * - Search by item code or name
 * - Expand/collapse categories
 * - Sort by Difference (Current - Reorder) without re-fetching
 * - Refresh (re-fetch)
 */

const DEFAULT_WAREHOUSE = "Raw Material - MF";

const CHILD_PAGE_SIZE = 2000; // pagination for Item Reorder child table
const CHUNK_SIZE = 150;       // chunk size for "IN" filters (Item / Bin)

function chunkArray(arr, size = 150) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function StockReorder() {
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Search
  const [search, setSearch] = useState("");

  // Grouped table rows (category headers + item rows)
  const [rows, setRows] = useState([]);

  // Flat item rows (kept so we can re-sort without refetch)
  const [flatItems, setFlatItems] = useState([]);

  // Expand/collapse per category key (category = item_group)
  const [expandedGroups, setExpandedGroups] = useState({});

  // Sort by Difference column (Current - Reorder)
  const [diffSortDir, setDiffSortDir] = useState("desc");
  const diffSortDirRef = useRef(diffSortDir);

  // Keep a ref so sorting does NOT re-trigger loadData fetch
  useEffect(() => {
    diffSortDirRef.current = diffSortDir;
  }, [diffSortDir]);

  const diffSortLabel = useMemo(
    () => (diffSortDir === "asc" ? "Diff: Low → High" : "Diff: High → Low"),
    [diffSortDir]
  );

  /**
   * Convert flat item rows into:
   * - category header rows (Item Group)
   * - item rows under each category
   * Also:
   * - sorts items inside each category by Difference (asc/desc)
   * - keeps/initializes expanded state per category
   */
  const buildRowsFromFlat = useCallback((flat, prevExpanded = {}, sortDir = "desc") => {
    const groups = new Map(); // item_group -> items[]
    (flat || []).forEach((r) => {
      const g = r.item_group || "Unknown";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(r);
    });

    const groupNames = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));

    const finalRows = [];
    const expandedNext = { ...(prevExpanded || {}) };

    groupNames.forEach((g) => {
      const catKey = `IG:${g}`;

      // default: expanded (open)
      if (expandedNext[catKey] == null) expandedNext[catKey] = true;

      // category header row
      finalRows.push({
        is_category_header: true,
        category_key: catKey,
        category_label: g,
      });

      const sortedItems = (groups.get(g) || []).slice().sort((a, b) => {
        const da = Number(a.difference || 0);
        const db = Number(b.difference || 0);

        // primary: difference
        const diffCmp = sortDir === "asc" ? da - db : db - da;
        if (diffCmp !== 0) return diffCmp;

        // tie-break: item name
        return (a.item_name || "").localeCompare(b.item_name || "");
      });

      sortedItems.forEach((it) => {
        finalRows.push({ ...it, category_key: catKey });
      });
    });

    return { finalRows, expandedNext };
  }, []);

  /**
   * Load data from ERPNext:
   * 1) Item Reorder (child table) for DEFAULT_WAREHOUSE
   * 2) Item meta: item_name + item_group (from Item)
   * 3) Bin qty: actual_qty (from Bin)
   * 4) Build final flat rows and grouped rows
   */
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    setRows([]);
    setFlatItems([]);
    setExpandedGroups({});

    try {
      // ------------------------------------------------------------
      // 1) Fetch Item Reorder rows for DEFAULT_WAREHOUSE
      // ------------------------------------------------------------
      const reorderRows = [];
      let start = 0;

      // Prefer reorder_level > 0
      while (true) {
        const part = await getDoctypeList("Item Reorder", {
          parent: "Item", // required for child table permissions
          fields: JSON.stringify([
            "parent", // Item code
            "warehouse",
            "warehouse_reorder_level",
            "warehouse_reorder_qty",
          ]),
          filters: JSON.stringify([
            ["Item Reorder", "warehouse", "=", DEFAULT_WAREHOUSE],
            ["Item Reorder", "warehouse_reorder_level", ">", 0],
          ]),
          limit_page_length: CHILD_PAGE_SIZE,
          limit_start: start,
        });

        reorderRows.push(...(part || []));
        if (!part || part.length < CHILD_PAGE_SIZE) break;

        start += CHILD_PAGE_SIZE;
        if (start > 200000) break; // safety
      }

      // If nothing found, fallback to reorder_qty > 0 (some setups only fill qty)
      if (reorderRows.length === 0) {
        start = 0;
        while (true) {
          const part = await getDoctypeList("Item Reorder", {
            parent: "Item",
            fields: JSON.stringify([
              "parent",
              "warehouse",
              "warehouse_reorder_level",
              "warehouse_reorder_qty",
            ]),
            filters: JSON.stringify([
              ["Item Reorder", "warehouse", "=", DEFAULT_WAREHOUSE],
              ["Item Reorder", "warehouse_reorder_qty", ">", 0],
            ]),
            limit_page_length: CHILD_PAGE_SIZE,
            limit_start: start,
          });

          reorderRows.push(...(part || []));
          if (!part || part.length < CHILD_PAGE_SIZE) break;

          start += CHILD_PAGE_SIZE;
          if (start > 200000) break;
        }
      }

      // Deduplicate per item_code (parent) and keep max reorder values
      const reorderMap = new Map(); // item_code -> { reorder_level, reorder_qty }
      (reorderRows || []).forEach((r) => {
        const code = r?.parent;
        if (!code) return;

        const lvl = Number(r.warehouse_reorder_level || 0);
        const qty = Number(r.warehouse_reorder_qty || 0);

        const prev = reorderMap.get(code) || { reorder_level: 0, reorder_qty: 0 };
        reorderMap.set(code, {
          reorder_level: Math.max(prev.reorder_level, lvl),
          reorder_qty: Math.max(prev.reorder_qty, qty),
        });
      });

      const itemCodes = Array.from(reorderMap.keys());
      if (!itemCodes.length) {
        setRows([]);
        setExpandedGroups({});
        setFlatItems([]);
        return;
      }

      // ------------------------------------------------------------
      // 2) Fetch Item meta for those items (name + group)
      // ------------------------------------------------------------
      const itemMetaMap = new Map(); // item_code -> { item_name, item_group }

      for (const part of chunkArray(itemCodes, CHUNK_SIZE)) {
        const items = await getDoctypeList("Item", {
          fields: JSON.stringify(["name", "item_name", "item_group"]),
          filters: JSON.stringify([["Item", "name", "in", part]]),
          limit_page_length: 1000,
        });

        (items || []).forEach((it) => {
          if (!it?.name) return;
          itemMetaMap.set(it.name, {
            item_name: it.item_name || it.name,
            item_group: it.item_group || "Unknown",
          });
        });
      }

      // ------------------------------------------------------------
      // 3) Fetch current qty from Bin for DEFAULT_WAREHOUSE
      // ------------------------------------------------------------
      const binQtyMap = new Map(); // item_code -> actual_qty

      for (const part of chunkArray(itemCodes, CHUNK_SIZE)) {
        const bins = await getDoctypeList("Bin", {
          fields: JSON.stringify(["item_code", "actual_qty"]),
          filters: JSON.stringify([
            ["Bin", "warehouse", "=", DEFAULT_WAREHOUSE],
            ["Bin", "item_code", "in", part],
          ]),
          limit_page_length: 10000,
        });

        (bins || []).forEach((b) => {
          const code = b?.item_code;
          if (!code) return;
          binQtyMap.set(code, Number(b.actual_qty || 0));
        });
      }

      // ------------------------------------------------------------
      // 4) Build flat rows (one per item)
      // ------------------------------------------------------------
      const flat = itemCodes
        .map((code) => {
          const meta = itemMetaMap.get(code) || { item_name: code, item_group: "Unknown" };
          const current_qty = Number(binQtyMap.get(code) || 0);

          const rr = reorderMap.get(code) || { reorder_level: 0, reorder_qty: 0 };

          // If reorder_level is 0 but reorder_qty exists, we use reorder_qty as fallback threshold
          const reorder_level =
            Number(rr.reorder_level || 0) || Number(rr.reorder_qty || 0);

          return {
            item_code: code,
            item_name: meta.item_name || code,
            item_group: meta.item_group || "Unknown",
            current_qty,
            reorder_level,
            difference: current_qty - reorder_level,
          };
        })
        .filter((r) => Number(r.reorder_level || 0) > 0); // keep only configured items

      setFlatItems(flat);

      // ------------------------------------------------------------
      // 5) Build grouped rows using CURRENT sort dir (no refetch on toggle)
      // ------------------------------------------------------------
      const { finalRows, expandedNext } = buildRowsFromFlat(flat, {}, diffSortDirRef.current);
      setRows(finalRows);
      setExpandedGroups(expandedNext);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to load reorder levels");
    } finally {
      setLoading(false);
    }
  }, [buildRowsFromFlat]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ============================================================
     Derived UI: search + expand/collapse
     ============================================================ */
  const lowerSearch = search.trim().toLowerCase();

  // When searching, keep category headers only if they have matches
  const displayRows = useMemo(() => {
    if (!lowerSearch) return rows;

    const out = [];
    let currentCat = null;
    let bucket = [];

    const flush = () => {
      if (!currentCat) return;
      if (bucket.length) {
        out.push(currentCat);
        bucket.forEach((x) => out.push(x));
      }
      currentCat = null;
      bucket = [];
    };

    rows.forEach((r) => {
      if (r.is_category_header) {
        flush();
        currentCat = r;
        return;
      }

      const name = String(r.item_name || "").toLowerCase();
      const code = String(r.item_code || "").toLowerCase();

      if (name.includes(lowerSearch) || code.includes(lowerSearch)) {
        bucket.push(r);
      }
    });

    flush();
    return out;
  }, [rows, lowerSearch]);

  // Apply expand/collapse only when NOT searching
  const visibleRows = useMemo(() => {
    return displayRows.filter((r) => {
      if (r.is_category_header) return true;
      if (lowerSearch) return true; // keep matches visible even if category collapsed
      if (r.category_key && expandedGroups[r.category_key] === false) return false;
      return true;
    });
  }, [displayRows, expandedGroups, lowerSearch]);

  /* ============================================================
     Actions
     ============================================================ */
  const toggleCategory = (key) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !(prev[key] !== false) }));
  };

  const toggleDiffSort = () => {
    setDiffSortDir((prevDir) => {
      const next = prevDir === "desc" ? "asc" : "desc";

      // Re-sort from existing flatItems (no fetch)
      if (flatItems && flatItems.length) {
        setExpandedGroups((prevExpanded) => {
          const { finalRows, expandedNext } = buildRowsFromFlat(flatItems, prevExpanded, next);
          setRows(finalRows);
          return expandedNext;
        });
      }

      return next;
    });
  };

  /* ============================================================
     Small display helpers
     ============================================================ */
  const Num = ({ v }) => {
    const n = Number(v || 0);
    return <span>{Number.isFinite(n) ? n : 0}</span>;
  };

  const Diff = ({ v }) => {
    const n = Number(v || 0);
    const cls = n > 0 ? "diff-pos" : n < 0 ? "diff-neg" : "diff-zero";
    return <span className={`diff ${cls}`}>{Number.isFinite(n) ? n : 0}</span>;
  };

  return (
    <div className="stock-reorder">
      {/* Header + controls */}
      <div className="stock-reorder-header-row">
        <div className="stock-reorder-header">
          <h2 className="stock-reorder-title">Stock Reorder</h2>
          <p className="stock-reorder-subtitle">
            Items with reorder level (stock checked in: <b>{DEFAULT_WAREHOUSE}</b>)
          </p>
        </div>

        <div className="stock-reorder-controls">
          <input
            className="input stock-reorder-search-input"
            placeholder="Search item name / code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={toggleDiffSort}
            disabled={loading || (flatItems || []).length === 0}
            title="Toggle sorting by Difference"
          >
            Sort: {diffSortLabel}
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={loadData}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && <p className="alert alert-error">{error}</p>}
      {loading && <p className="text-muted">Loading reorder levels...</p>}
      {!loading && !error && visibleRows.length === 0 && (
        <p className="text-muted">No items found.</p>
      )}

      {/* Table */}
      {!loading && !error && visibleRows.length > 0 && (
        <div className="stock-reorder-table-wrapper">
          <table className="stock-reorder-table">
            <thead>
              <tr>
                <th style={{ width: "46%" }}>Item</th>
                <th style={{ width: "18%" }}>Current Qty</th>
                <th style={{ width: "18%" }}>Reorder Level</th>
                <th style={{ width: "18%" }}>Difference</th>
              </tr>
            </thead>

            <tbody>
              {visibleRows.map((r, idx) => {
                if (r.is_category_header) {
                  const isOpen = expandedGroups[r.category_key] !== false;

                  return (
                    <tr
                      key={`cat-${r.category_key}-${idx}`}
                      className="stock-reorder-category-row"
                      onClick={() => toggleCategory(r.category_key)}
                    >
                      <td colSpan={4} className="stock-reorder-category-cell">
                        <span className="stock-reorder-category-icon">📁</span>
                        <span className="stock-reorder-category-label">{r.category_label}</span>
                        <span className="stock-reorder-category-toggle">
                          {isOpen ? "▾" : "▸"}
                        </span>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={`${r.item_code}-${idx}`} className="stock-reorder-row">
                    <td className="stock-reorder-item">
                      <div className="stock-reorder-item-name">{r.item_name}</div>
                      <div className="stock-reorder-item-sub text-muted">{r.item_code}</div>
                    </td>

                    <td className="stock-reorder-num">
                      <Num v={r.current_qty} />
                    </td>

                    <td className="stock-reorder-num">
                      <Num v={r.reorder_level} />
                    </td>

                    <td className="stock-reorder-num">
                      <Diff v={r.difference} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default StockReorder;
