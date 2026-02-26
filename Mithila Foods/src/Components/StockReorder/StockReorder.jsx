// src/Components/StockReorder.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDoctypeList } from "../api/core";
import "./StockReorder.css";
import { useOrg } from "../Context/OrgContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";



const CHILD_PAGE_SIZE = 2000;
const CHUNK_SIZE = 150;

function chunkArray(arr, size = 150) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function StockReorder() {
  const { activeOrg, orgs, changeOrg } = useOrg();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [flatItems, setFlatItems] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [diffSortDir, setDiffSortDir] = useState("desc");
  const diffSortDirRef = useRef(diffSortDir);

  useEffect(() => {
    diffSortDirRef.current = diffSortDir;
  }, [diffSortDir]);

  const targetWarehouses = useMemo(() => {
    const base = ["Raw Material - MF"];
    if (activeOrg === "Mithila Foods") return [...base, "Finished Goods Mithila - MF"];
    if (activeOrg === "Prepto") return [...base, "Finished Goods Prepto - MF"];
    if (activeOrg === "Howrah Foods") return [...base, "Finished Goods Howrah - MF"];

    // If Parent (F2D) is selected, look at everything
    if (activeOrg === "F2D TECH PRIVATE LIMITED") {
      return [...base, "Finished Goods Mithila - MF", "Finished Goods Prepto - MF", "Finished Goods Howrah - MF"];
    }
    return base;
  }, [activeOrg]);

  useEffect(() => {
    diffSortDirRef.current = diffSortDir;
  }, [diffSortDir]);

  const diffSortLabel = useMemo(
    () => (diffSortDir === "asc" ? "Diff: Low → High" : "Diff: High → Low"),
    [diffSortDir]
  );


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

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    setRows([]);
    setFlatItems([]);
    setExpandedGroups({});

    try {
      const reorderRows = [];
      let start = 0;

      // Prefer reorder_level > 0
      while (true) {
        const part = await getDoctypeList("Item Reorder", {
          parent: "Item", // required for child table permissions
          fields: JSON.stringify([
            "parent",
            "warehouse",
            "warehouse_reorder_level",
            "warehouse_reorder_qty",
            "material_request_type"
          ]),
          filters: JSON.stringify([
            ["Item Reorder", "warehouse", "in", targetWarehouses], ["Item Reorder", "warehouse_reorder_level", ">", 0],
          ]),
          limit_page_length: CHILD_PAGE_SIZE,
          limit_start: start,
        });

        reorderRows.push(...(part || []));
        if (!part || part.length < CHILD_PAGE_SIZE) break;

        start += CHILD_PAGE_SIZE;
        if (start > 200000) break;
      }

      // If nothing found, fallback to reorder_qty > 0 
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
              "material_request_type"
            ]),
            filters: JSON.stringify([
              ["Item Reorder", "warehouse", "in", targetWarehouses], ["Item Reorder", "warehouse_reorder_qty", ">", 0],
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

      const reorderMap = new Map(); // item_code -> { reorder_level, reorder_qty }
      (reorderRows || []).forEach((r) => {
        const code = r?.parent;
        if (!code) return;

        const lvl = Number(r.warehouse_reorder_level || 0);
        const qty = Number(r.warehouse_reorder_qty || 0);
        const reqType = r.material_request_type || "Purchase";
        const prev = reorderMap.get(code) || { reorder_level: 0, reorder_qty: 0 };
        reorderMap.set(code, {
          reorder_level: Math.max(prev.reorder_level, lvl),
          reorder_qty: Math.max(prev.reorder_qty, qty),
          material_request_type: reqType,
        });
      });

      const itemCodes = Array.from(reorderMap.keys());
      if (!itemCodes.length) {
        setRows([]);
        setExpandedGroups({});
        setFlatItems([]);
        return;
      }

      const itemMetaMap = new Map(); // item_code -> { item_name, item_group }

      for (const part of chunkArray(itemCodes, CHUNK_SIZE)) {
        const items = await getDoctypeList("Item", {
          fields: JSON.stringify(["name", "item_name", "item_group", "brand"]),
          filters: JSON.stringify([["Item", "name", "in", part]]),
          limit_page_length: 1000,
        });

        (items || []).forEach((it) => {
          if (!it?.name) return;
          itemMetaMap.set(it.name, {
            item_name: it.item_name || it.name,
            item_group: it.item_group || "Unknown",
            brand: it.brand
          });
        });
      }

      const binQtyMap = new Map(); // item_code -> actual_qty

      for (const part of chunkArray(itemCodes, CHUNK_SIZE)) {
        const bins = await getDoctypeList("Bin", {
          fields: JSON.stringify(["item_code", "actual_qty"]),
          filters: JSON.stringify([
            ["Bin", "warehouse", "in", targetWarehouses], ["Bin", "item_code", "in", part],
          ]),
          limit_page_length: 10000,
        });

        (bins || []).forEach((b) => {
          const code = b?.item_code;
          if (!code) return;
          binQtyMap.set(code, Number(b.actual_qty || 0));
        });
      }

      const flat = itemCodes
        .map((code) => {
          const meta = itemMetaMap.get(code) || { item_name: code, item_group: "Unknown" };
          const current_qty = Number(binQtyMap.get(code) || 0);

          const rr = reorderMap.get(code) || { reorder_level: 0, reorder_qty: 0, material_request_type: "Purchase" };

          const reorder_level =
            Number(rr.reorder_level || 0) || Number(rr.reorder_qty || 0);

          return {
            item_code: code,
            item_name: meta.item_name || code,
            item_group: meta.item_group || "Unknown",
            brand: meta.brand,
            current_qty,
            reorder_level,
            difference: current_qty - reorder_level,
          };
        })
        .filter((r) => Number(r.reorder_level || 0) > 0) // keep only configured items
        .filter((r) => {
          if (activeOrg === "F2D TECH PRIVATE LIMITED") return true;
          return r.brand === activeOrg;
        });
      setFlatItems(flat);

      const { finalRows, expandedNext } = buildRowsFromFlat(flat, {}, diffSortDirRef.current);
      setRows(finalRows);
      setExpandedGroups(expandedNext);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to load reorder levels");
    } finally {
      setLoading(false);
    }
  }, [buildRowsFromFlat, activeOrg, targetWarehouses]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const visibleRows = useMemo(() => {
    return displayRows.filter((r) => {
      if (r.is_category_header) return true;
      if (lowerSearch) return true; // keep matches visible even if category collapsed
      if (r.category_key && expandedGroups[r.category_key] === false) return false;
      return true;
    });
  }, [displayRows, expandedGroups, lowerSearch]);

  const toggleCategory = (key) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !(prev[key] !== false) }));
  };

  const toggleDiffSort = () => {
    setDiffSortDir((prevDir) => {
      const next = prevDir === "desc" ? "asc" : "desc";

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

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Stock Reorder Report`, 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Brand: ${activeOrg} | Date: ${new Date().toLocaleDateString()}`, 14, 22);

    const tableData = [];
    visibleRows.forEach(r => {
      if (r.is_category_header) {
        tableData.push([{ content: ` ${r.category_label}`, colSpan: 5, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }]);
      } else {
        tableData.push([r.item_name, r.current_qty, r.reorder_level, r.difference, r.material_request_type]);
      }
    });

    autoTable(doc, {
      startY: 28,
      head: [['Item', 'Current Qty', 'Reorder Level', 'Difference', 'Request Type']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 9 },
    });

    const safeOrgName = String(activeOrg || "All_Brands").replace(/\s+/g, '_');
    doc.save(`Reorder_List_${safeOrgName}.pdf`);
  };

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
            Item Reorder Levels
          </p>
        </div>

        <div className="stock-reorder-controls">
          {/* BRAND SWITCHER */}
          <select
            className="input stock-reorder-search-input"
            value={activeOrg}
            onChange={(e) => changeOrg(e.target.value)}
            title="Switch Brand / Organization"
            style={{ fontWeight: "bold", color: "#007bff", width: "180px" }}
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
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
          <button type="button" className="btn btn-secondary" onClick={downloadPDF} disabled={loading || visibleRows.length === 0}>
            Download PDF
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
                <th style={{ width: "15%" }}>Request Type</th>
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
                      <td colSpan={5} className="stock-reorder-category-cell">
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
                      {/*<div className="stock-reorder-item-sub text-muted">{r.item_code}</div>*/}
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

                    <td className="stock-reorder-num">
                      {r.material_request_type}
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