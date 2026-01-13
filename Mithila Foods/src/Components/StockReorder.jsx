// src/Components/StockReorder.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getDoctypeList } from "./erpBackendApi";
import "../CSS/StockReorder.css";

// ✅ no warehouse selector in UI
// ✅ stock is ALWAYS computed from this warehouse
const DEFAULT_WAREHOUSE = "Raw Material - MF";

const CHILD_PAGE_SIZE = 2000;
const CHUNK_SIZE = 150;

function chunkArray(arr, size = 150) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function StockReorder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // rows with category header rows mixed in
  const [rows, setRows] = useState([]);

  // category expand/collapse (category = Item Group)
  const [expandedGroups, setExpandedGroups] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    setRows([]);
    setExpandedGroups({});

    try {
      // 1) Get Item Reorder rows (child table) for DEFAULT_WAREHOUSE
      const reorderRows = [];
      let start = 0;

      while (true) {
        const part = await getDoctypeList("Item Reorder", {
          parent: "Item", // ✅ required for child table permissions
          fields: JSON.stringify([
            "parent", // Item code
            "warehouse",
            "warehouse_reorder_level",
            "warehouse_reorder_qty",
          ]),
          filters: JSON.stringify([
            ["Item Reorder", "warehouse", "=", DEFAULT_WAREHOUSE],
            // include anything that has a reorder level/qty
            ["Item Reorder", "warehouse_reorder_level", ">", 0],
          ]),
          limit_page_length: CHILD_PAGE_SIZE,
          limit_start: start,
        });

        reorderRows.push(...(part || []));
        if (!part || part.length < CHILD_PAGE_SIZE) break;

        start += CHILD_PAGE_SIZE;
        if (start > 200000) break;
      }

      // If some items only have reorder_qty (and reorder_level is 0), include them too:
      // (ERP setups vary; keeping this makes it more robust)
      // NOTE: We do an extra pull only if needed.
      const needsQtyFallback = reorderRows.length === 0;
      if (needsQtyFallback) {
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

      // Deduplicate per item (parent) and keep the max reorder level
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
        return;
      }

      // 2) Fetch item meta (name + item_group)
      const itemMetaMap = new Map(); // code -> { item_name, item_group }
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

      // 3) Fetch current qty from Bin for DEFAULT_WAREHOUSE (bulk)
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

      // 4) Build flat rows
      const flat = itemCodes
        .map((code) => {
          const meta = itemMetaMap.get(code) || { item_name: code, item_group: "Unknown" };
          const current_qty = Number(binQtyMap.get(code) || 0);

          const rr = reorderMap.get(code) || { reorder_level: 0, reorder_qty: 0 };
          const reorder_level = Number(rr.reorder_level || 0) || Number(rr.reorder_qty || 0);

          return {
            item_code: code,
            item_name: meta.item_name || code,
            item_group: meta.item_group || "Unknown",
            current_qty,
            reorder_level,
            difference: current_qty - reorder_level ,
          };
        })
        // only keep items where a reorder is actually set
        .filter((r) => Number(r.reorder_level || 0) > 0);

      // 5) Group by Item Group (category = item_group)
      const groups = new Map(); // item_group -> rows[]
      flat.forEach((r) => {
        const g = r.item_group || "Unknown";
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(r);
      });

      // Sort groups by name; within group, show biggest shortage first
      const groupNames = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));

      const finalRows = [];
      const expanded = {};

      groupNames.forEach((g) => {
        const catKey = `IG:${g}`;
        expanded[catKey] = true;

        finalRows.push({
          is_category_header: true,
          category_key: catKey,
          category_label: g,
        });

        const items = (groups.get(g) || []).slice().sort((a, b) => {
          const da = Number(b.difference || 0) - Number(a.difference || 0);
          if (da !== 0) return da;
          return (a.item_name || "").localeCompare(b.item_name || "");
        });

        items.forEach((it) => {
          finalRows.push({
            ...it,
            category_key: catKey,
          });
        });
      });

      setRows(finalRows);
      setExpandedGroups(expanded);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to load reorder levels");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const lowerSearch = search.trim().toLowerCase();

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

  const visibleRows = useMemo(() => {
    // apply expand/collapse (category = item_group)
    return displayRows.filter((r) => {
      if (r.is_category_header) return true;
      if (lowerSearch) return true; // when searching, keep all matched rows visible
      if (r.category_key && expandedGroups[r.category_key] === false) return false;
      return true;
    });
  }, [displayRows, expandedGroups, lowerSearch]);

  const toggleCategory = (key) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !(prev[key] !== false) }));
  };

  const Num = ({ v }) => {
    const n = Number(v || 0);
    if (!isFinite(n)) return <span>0</span>;
    return <span>{n}</span>;
  };

  const Diff = ({ v }) => {
    const n = Number(v || 0);
    const style =
      n > 0
        ? { fontWeight: 700, color: "#16a34a" }
        : n < 0
        ? { fontWeight: 700, color: "#dc2626" }
        : undefined;
    return <span style={style}>{n}</span>;
  };

  return (
    <div className="stock-reorder">
      <div className="stock-reorder-header-row">
        <div className="stock-reorder-header">
          <h2 className="stock-reorder-title">Stock Reorder</h2>
          <p className="stock-reorder-subtitle">
            Items with reorder level (stock checked in default Raw Material warehouse)
          </p>
        </div>

        <div className="stock-reorder-controls">
          <input
            className="input stock-reorder-search"
            placeholder="Search item name / code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button type="button" className="btn btn-primary btn-sm" onClick={loadData} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && <p className="alert alert-error">{error}</p>}
      {loading && <p className="text-muted">Loading reorder levels...</p>}
      {!loading && !error && visibleRows.length === 0 && <p className="text-muted">No items found.</p>}

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
                      style={{ cursor: "pointer" }}
                    >
                      <td colSpan={4} className="stock-reorder-category-cell">
                        <span className="stock-reorder-category-icon">📁</span>
                        {r.category_label}
                        <span className="stock-reorder-category-toggle">{isOpen ? "▾" : "▸"}</span>
                      </td>
                    </tr>
                  );
                }

                // ✅ show ONLY ONE name (item_name), no duplicate line, no warehouse
                return (
                  <tr key={`${r.item_code}-${idx}`} className="stock-reorder-row">
                    <td className="stock-reorder-item">
                      <div className="stock-reorder-item-name">{r.item_name}</div>
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

//// src/Components/StockReorder.jsx
//import React, { useCallback, useEffect, useMemo, useState } from "react";
//import { getDoctypeList } from "./erpBackendApi";
//import "../CSS/StockReorder.css";

//// ✅ no warehouse selector in UI
//// ✅ stock is ALWAYS computed from this warehouse
//const DEFAULT_WAREHOUSE = "Raw Material - MF";

//const CHILD_PAGE_SIZE = 2000;
//const CHUNK_SIZE = 150;

//function chunkArray(arr, size = 150) {
//  const out = [];
//  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
//  return out;
//}

//function StockReorder() {
//  const [loading, setLoading] = useState(false);
//  const [error, setError] = useState("");
//  const [search, setSearch] = useState("");

//  // rows with category header rows mixed in
//  const [rows, setRows] = useState([]);

//  // category expand/collapse (category = custom_category)
//  const [expandedGroups, setExpandedGroups] = useState({});

//  const loadData = useCallback(async () => {
//    setLoading(true);
//    setError("");
//    setRows([]);
//    setExpandedGroups({});

//    try {
//      // 1) Get Item Reorder rows (child table) for DEFAULT_WAREHOUSE
//      const reorderRows = [];
//      let start = 0;

//      while (true) {
//        const part = await getDoctypeList("Item Reorder", {
//          parent: "Item", // ✅ required for child table permissions
//          fields: JSON.stringify([
//            "parent", // Item code
//            "warehouse",
//            "warehouse_reorder_level",
//            "warehouse_reorder_qty",
//          ]),
//          filters: JSON.stringify([
//            ["Item Reorder", "warehouse", "=", DEFAULT_WAREHOUSE],
//            ["Item Reorder", "warehouse_reorder_level", ">", 0],
//          ]),
//          limit_page_length: CHILD_PAGE_SIZE,
//          limit_start: start,
//        });

//        reorderRows.push(...(part || []));
//        if (!part || part.length < CHILD_PAGE_SIZE) break;

//        start += CHILD_PAGE_SIZE;
//        if (start > 200000) break;
//      }

//      // fallback: if only reorder_qty is used in your ERP
//      const needsQtyFallback = reorderRows.length === 0;
//      if (needsQtyFallback) {
//        start = 0;
//        while (true) {
//          const part = await getDoctypeList("Item Reorder", {
//            parent: "Item",
//            fields: JSON.stringify([
//              "parent",
//              "warehouse",
//              "warehouse_reorder_level",
//              "warehouse_reorder_qty",
//            ]),
//            filters: JSON.stringify([
//              ["Item Reorder", "warehouse", "=", DEFAULT_WAREHOUSE],
//              ["Item Reorder", "warehouse_reorder_qty", ">", 0],
//            ]),
//            limit_page_length: CHILD_PAGE_SIZE,
//            limit_start: start,
//          });

//          reorderRows.push(...(part || []));
//          if (!part || part.length < CHILD_PAGE_SIZE) break;

//          start += CHILD_PAGE_SIZE;
//          if (start > 200000) break;
//        }
//      }

//      // Deduplicate per item (parent) and keep the max reorder level
//      const reorderMap = new Map(); // item_code -> { reorder_level, reorder_qty }
//      (reorderRows || []).forEach((r) => {
//        const code = r?.parent;
//        if (!code) return;

//        const lvl = Number(r.warehouse_reorder_level || 0);
//        const qty = Number(r.warehouse_reorder_qty || 0);

//        const prev = reorderMap.get(code) || { reorder_level: 0, reorder_qty: 0 };
//        reorderMap.set(code, {
//          reorder_level: Math.max(prev.reorder_level, lvl),
//          reorder_qty: Math.max(prev.reorder_qty, qty),
//        });
//      });

//      const itemCodes = Array.from(reorderMap.keys());
//      if (!itemCodes.length) {
//        setRows([]);
//        setExpandedGroups({});
//        return;
//      }

//      // 2) Fetch item meta (name + custom_category)
//      const itemMetaMap = new Map(); // code -> { item_name, custom_category }
//      for (const part of chunkArray(itemCodes, CHUNK_SIZE)) {
//        const items = await getDoctypeList("Item", {
//          fields: JSON.stringify(["name", "item_name", "custom_category"]),
//          filters: JSON.stringify([["Item", "name", "in", part]]),
//          limit_page_length: 1000,
//        });

//        (items || []).forEach((it) => {
//          if (!it?.name) return;
//          itemMetaMap.set(it.name, {
//            item_name: it.item_name || it.name,
//            custom_category: String(it.custom_category || "").trim(),
//          });
//        });
//      }

//      // 3) Fetch current qty from Bin for DEFAULT_WAREHOUSE (bulk)
//      const binQtyMap = new Map(); // item_code -> actual_qty
//      for (const part of chunkArray(itemCodes, CHUNK_SIZE)) {
//        const bins = await getDoctypeList("Bin", {
//          fields: JSON.stringify(["item_code", "actual_qty"]),
//          filters: JSON.stringify([
//            ["Bin", "warehouse", "=", DEFAULT_WAREHOUSE],
//            ["Bin", "item_code", "in", part],
//          ]),
//          limit_page_length: 10000,
//        });

//        (bins || []).forEach((b) => {
//          const code = b?.item_code;
//          if (!code) return;
//          binQtyMap.set(code, Number(b.actual_qty || 0));
//        });
//      }

//      // 4) Build flat rows
//      const flat = itemCodes
//        .map((code) => {
//          const meta = itemMetaMap.get(code) || { item_name: code, custom_category: "" };
//          const current_qty = Number(binQtyMap.get(code) || 0);

//          const rr = reorderMap.get(code) || { reorder_level: 0, reorder_qty: 0 };
//          const reorder_level = Number(rr.reorder_level || 0) || Number(rr.reorder_qty || 0);

//          const custom_category = (meta.custom_category || "").trim() || "Uncategorized";

//          return {
//            item_code: code,
//            item_name: meta.item_name || code,
//            custom_category,
//            current_qty,
//            reorder_level,
//            difference: current_qty - reorder_level,
//          };
//        })
//        .filter((r) => Number(r.reorder_level || 0) > 0);

//      // 5) Group by custom_category ✅
//      const groups = new Map(); // custom_category -> rows[]
//      flat.forEach((r) => {
//        const g = r.custom_category || "Uncategorized";
//        if (!groups.has(g)) groups.set(g, []);
//        groups.get(g).push(r);
//      });

//      const groupNames = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));

//      const finalRows = [];
//      const expanded = {};

//      groupNames.forEach((g) => {
//        const catKey = `CC:${g}`;
//        expanded[catKey] = true;

//        finalRows.push({
//          is_category_header: true,
//          category_key: catKey,
//          category_label: g,
//        });

//        const items = (groups.get(g) || []).slice().sort((a, b) => {
//          const da = Number(b.difference || 0) - Number(a.difference || 0);
//          if (da !== 0) return da;
//          return (a.item_name || "").localeCompare(b.item_name || "");
//        });

//        items.forEach((it) => {
//          finalRows.push({
//            ...it,
//            category_key: catKey,
//          });
//        });
//      });

//      setRows(finalRows);
//      setExpandedGroups(expanded);
//    } catch (e) {
//      console.error(e);
//      setError(e?.message || "Failed to load reorder levels");
//    } finally {
//      setLoading(false);
//    }
//  }, []);

//  useEffect(() => {
//    loadData();
//  }, [loadData]);

//  const lowerSearch = search.trim().toLowerCase();

//  const displayRows = useMemo(() => {
//    if (!lowerSearch) return rows;

//    const out = [];
//    let currentCat = null;
//    let bucket = [];

//    const flush = () => {
//      if (!currentCat) return;
//      if (bucket.length) {
//        out.push(currentCat);
//        bucket.forEach((x) => out.push(x));
//      }
//      currentCat = null;
//      bucket = [];
//    };

//    rows.forEach((r) => {
//      if (r.is_category_header) {
//        flush();
//        currentCat = r;
//        return;
//      }

//      const name = String(r.item_name || "").toLowerCase();
//      const code = String(r.item_code || "").toLowerCase();
//      if (name.includes(lowerSearch) || code.includes(lowerSearch)) {
//        bucket.push(r);
//      }
//    });

//    flush();
//    return out;
//  }, [rows, lowerSearch]);

//  const visibleRows = useMemo(() => {
//    return displayRows.filter((r) => {
//      if (r.is_category_header) return true;
//      if (lowerSearch) return true;
//      if (r.category_key && expandedGroups[r.category_key] === false) return false;
//      return true;
//    });
//  }, [displayRows, expandedGroups, lowerSearch]);

//  const toggleCategory = (key) => {
//    setExpandedGroups((prev) => ({ ...prev, [key]: !(prev[key] !== false) }));
//  };

//  const Num = ({ v }) => {
//    const n = Number(v || 0);
//    if (!isFinite(n)) return <span>0</span>;
//    return <span>{n}</span>;
//  };

//  const Diff = ({ v }) => {
//    const n = Number(v || 0);
//    const style =
//      n > 0
//        ? { fontWeight: 700, color: "#16a34a" }
//        : n < 0
//        ? { fontWeight: 700, color: "#dc2626" }
//        : undefined;
//    return <span style={style}>{n}</span>;
//  };

//  return (
//    <div className="stock-reorder">
//      <div className="stock-reorder-header-row">
//        <div className="stock-reorder-header">
//          <h2 className="stock-reorder-title">Stock Reorder</h2>
//          <p className="stock-reorder-subtitle">
//            Items with reorder level (stock checked in default Raw Material warehouse)
//          </p>
//        </div>

//        <div className="stock-reorder-controls">
//          <input
//            className="input stock-reorder-search"
//            placeholder="Search item name / code"
//            value={search}
//            onChange={(e) => setSearch(e.target.value)}
//          />

//          <button type="button" className="btn btn-primary btn-sm" onClick={loadData} disabled={loading}>
//            {loading ? "Loading..." : "Refresh"}
//          </button>
//        </div>
//      </div>

//      {error && <p className="alert alert-error">{error}</p>}
//      {loading && <p className="text-muted">Loading reorder levels...</p>}
//      {!loading && !error && visibleRows.length === 0 && <p className="text-muted">No items found.</p>}

//      {!loading && !error && visibleRows.length > 0 && (
//        <div className="stock-reorder-table-wrapper">
//          <table className="stock-reorder-table">
//            <thead>
//              <tr>
//                <th style={{ width: "46%" }}>Item</th>
//                <th style={{ width: "18%" }}>Current Qty</th>
//                <th style={{ width: "18%" }}>Reorder Level</th>
//                <th style={{ width: "18%" }}>Difference</th>
//              </tr>
//            </thead>

//            <tbody>
//              {visibleRows.map((r, idx) => {
//                if (r.is_category_header) {
//                  const isOpen = expandedGroups[r.category_key] !== false;
//                  return (
//                    <tr
//                      key={`cat-${r.category_key}-${idx}`}
//                      className="stock-reorder-category-row"
//                      onClick={() => toggleCategory(r.category_key)}
//                      style={{ cursor: "pointer" }}
//                    >
//                      <td colSpan={4} className="stock-reorder-category-cell">
//                        <span className="stock-reorder-category-icon">📁</span>
//                        {r.category_label}
//                        <span className="stock-reorder-category-toggle">{isOpen ? "▾" : "▸"}</span>
//                      </td>
//                    </tr>
//                  );
//                }

//                return (
//                  <tr key={`${r.item_code}-${idx}`} className="stock-reorder-row">
//                    <td className="stock-reorder-item">
//                      <div className="stock-reorder-item-name">{r.item_name}</div>
//                    </td>
//                    <td className="stock-reorder-num">
//                      <Num v={r.current_qty} />
//                    </td>
//                    <td className="stock-reorder-num">
//                      <Num v={r.reorder_level} />
//                    </td>
//                    <td className="stock-reorder-num">
//                      <Diff v={r.difference} />
//                    </td>
//                  </tr>
//                );
//              })}
//            </tbody>
//          </table>
//        </div>
//      )}
//    </div>
//  );
//}

//export default StockReorder;

