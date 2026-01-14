//// src/Components/OpeningStockEntry.jsx
//import React, { useEffect, useMemo, useRef, useState } from "react";

//import {
//  getItemsForBOM, // 👈 make sure this API includes `item_group`
//  getPriceLists,
//  getItemRateFromPriceList,
//  getItemWarehouseValuationRate,
//  getCompanies,
//  createDoc,
//  submitDoc,
//} from "./erpBackendApi";
//import "../CSS/OpeningStockEntry.css";

//const RAW_WH = "Raw Material - MF";
//const FINISHED_WH = "Finished Goods - MF";

//// ✅ use the NON-group child account here
//const DEFAULT_DIFFERENCE_ACCOUNT = "Temporary Opening - MF";

//// Price List names (display names you want)
//const PL_SELLING = "Standard Selling";
//const PL_BUYING = "Standard Buying";

//function createEmptyRow(id) {
//  return {
//    id,
//    item_code: "",
//    item_group: "",
//    warehouse: RAW_WH, // ✅ auto changes after item select
//    uom: "",
//    qty: "",
//    price_list: "", // ✅ auto changes after item select
//    rate: "",
//    loadingRate: false,
//    rowError: "",
//  };
//}

//function isFinishedGroup(itemGroup) {
//  const g = String(itemGroup || "").trim().toLowerCase();
//  // supports "Product", "Products", "Finished", etc.
//  return g === "product" || g === "products" || g.includes("finished") || g.includes("product");
//}

//function pickPriceListName(target, priceLists) {
//  const t = String(target || "").trim().toLowerCase();
//  const found = (priceLists || []).find(
//    (pl) =>
//      String(pl.name || "").toLowerCase() === t ||
//      String(pl.price_list_name || "").toLowerCase() === t
//  );
//  return found?.name || target || "";
//}

//function ItemSearchDropdown({ items, value, onSelect, placeholder, className = "" }) {
//  const [open, setOpen] = useState(false);
//  const [q, setQ] = useState("");
//  const ref = useRef(null);

//  const selected = useMemo(() => items.find((x) => x.name === value) || null, [items, value]);

//  const filtered = useMemo(() => {
//    const s = (q || "").trim().toLowerCase();
//    const base = !s
//      ? items
//      : items.filter((it) => {
//          const code = (it.name || "").toLowerCase();
//          const name = (it.item_name || "").toLowerCase();
//          return code.includes(s) || name.includes(s);
//        });
//    return base.slice(0, 80);
//  }, [items, q]);

//  useEffect(() => {
//    function onDown(e) {
//      if (!ref.current) return;
//      if (!ref.current.contains(e.target)) setOpen(false);
//    }
//    document.addEventListener("mousedown", onDown);
//    return () => document.removeEventListener("mousedown", onDown);
//  }, []);

//  return (
//    <div className={`stdrop ${className}`} ref={ref}>
//      <button
//        type="button"
//        className={`stdrop-control ${open ? "is-open" : ""} opening-stock-item-input`}
//        onClick={() => setOpen((v) => !v)}
//      >
//        <div className="stdrop-value">
//          {selected ? (
//            <>
//              <div className="stdrop-title">{selected.name}</div>
//              <div className="stdrop-sub">
//                {selected.item_name || ""} {selected.stock_uom ? `· ${selected.stock_uom}` : ""}
//              </div>
//            </>
//          ) : (
//            <div className="stdrop-placeholder">{placeholder}</div>
//          )}
//        </div>
//        <div className="stdrop-caret">▾</div>
//      </button>

//      {open && (
//        <div className="stdrop-popover">
//          <div className="stdrop-search">
//            <input
//              autoFocus
//              className="input"
//              value={q}
//              onChange={(e) => setQ(e.target.value)}
//              placeholder="Type to search..."
//            />
//          </div>

//          <div className="stdrop-list">
//            {filtered.map((it) => (
//              <button
//                key={it.name}
//                type="button"
//                className="stdrop-item"
//                onClick={() => {
//                  onSelect(it.name);
//                  setOpen(false);
//                  setQ("");
//                }}
//              >
//                <div className="stdrop-item-title">{it.name}</div>
//                <div className="stdrop-item-sub">
//                  {it.item_name || ""} {it.stock_uom ? `· ${it.stock_uom}` : ""}
//                </div>
//              </button>
//            ))}

//            {!filtered.length ? (
//              <div className="stdrop-empty">No items found.</div>
//            ) : (
//              <div className="stdrop-hint">Showing up to 80 results</div>
//            )}
//          </div>
//        </div>
//      )}
//    </div>
//  );
//}

//function OpeningStockEntry() {
//  const [items, setItems] = useState([]);
//  const [priceLists, setPriceLists] = useState([]);
//  const [companies, setCompanies] = useState([]);

//  const [company, setCompany] = useState("");
//  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10));

//  const [rows, setRows] = useState([createEmptyRow(0)]);

//  const [loadingInit, setLoadingInit] = useState(false);
//  const [saving, setSaving] = useState(false);
//  const [error, setError] = useState("");
//  const [message, setMessage] = useState("");

//  // initial load
//  useEffect(() => {
//    async function init() {
//      setLoadingInit(true);
//      setError("");
//      try {
//        const [itemData, plData, companyData] = await Promise.all([
//          getItemsForBOM(), // ✅ must include item_group
//          getPriceLists(),
//          getCompanies(),
//        ]);

//        setItems(itemData || []);
//        setPriceLists(plData || []);
//        setCompanies(companyData || []);

//        if (companyData && companyData.length > 0) setCompany(companyData[0].name);
//      } catch (err) {
//        console.error(err);
//        setError(err.message || "Failed to load items / price lists / companies");
//      } finally {
//        setLoadingInit(false);
//      }
//    }
//    init();
//  }, []);

//  function addRow() {
//    setRows((prev) => [
//      ...prev,
//      createEmptyRow(prev.length ? prev[prev.length - 1].id + 1 : 0),
//    ]);
//  }

//  function removeRow(rowId) {
//    setRows((prev) => {
//      const next = prev.filter((r) => r.id !== rowId);
//      return next.length ? next : [createEmptyRow(0)];
//    });
//  }

//  function handleRowFieldChange(rowId, field, value) {
//    setRows((prev) =>
//      prev.map((r) => (r.id === rowId ? { ...r, [field]: value, rowError: "" } : r))
//    );
//  }

//  async function fetchRateForRow(row) {
//    if (!row.item_code) return row;

//    const item = items.find((it) => it.name === row.item_code);
//    const updated = { ...row, loadingRate: true, rowError: "" };

//    try {
//      const finished = isFinishedGroup(item?.item_group || row.item_group);
//      const targetPL = finished ? PL_SELLING : PL_BUYING;
//      const pl = pickPriceListName(updated.price_list || targetPL, priceLists);

//      updated.price_list = pl;

//      // 1) Try price list rate (auto)
//      if (pl) {
//        const priceRow = await getItemRateFromPriceList(updated.item_code, pl);
//        const pr = Number(priceRow?.price_list_rate);

//        if (Number.isFinite(pr) && pr > 0) {
//          updated.rate = String(pr);
//        } else {
//          // 2) Fallback valuation_rate on Item
//          const vr = Number(item?.valuation_rate);
//          if (Number.isFinite(vr) && vr > 0) {
//            updated.rate = String(vr);
//          } else {
//            // 3) Fallback Bin valuation per warehouse
//            const wh = updated.warehouse || RAW_WH;
//            const bin = await getItemWarehouseValuationRate(updated.item_code, wh);
//            const br = Number(bin?.valuation_rate);
//            if (Number.isFinite(br) && br > 0) updated.rate = String(br);
//            else updated.rowError = "No rate in price list / valuation / bin";
//          }
//        }
//      } else {
//        updated.rowError = "Price list not found";
//      }
//    } catch (err) {
//      console.error(err);
//      updated.rowError = err.message || "Failed to fetch rate";
//    }

//    updated.loadingRate = false;
//    return updated;
//  }

//  // ✅ When item changes:
//  // - auto set Warehouse (Finished vs Raw)
//  // - auto set Price List (Standard Selling vs Standard Buying)
//  // - auto set UOM
//  // - auto fetch Rate
//  async function handleRowItemChange(rowId, itemCode) {
//    const item = items.find((it) => it.name === itemCode);
//    const uom = item?.stock_uom || item?.uom || item?.default_uom || "";
//    const group = item?.item_group || "";

//    const finished = isFinishedGroup(group);
//    const nextWarehouse = finished ? FINISHED_WH : RAW_WH;
//    const nextPL = pickPriceListName(finished ? PL_SELLING : PL_BUYING, priceLists);

//    let targetRow = null;

//    setRows((prev) =>
//      prev.map((r) => {
//        if (r.id !== rowId) return r;

//        const updated = {
//          ...r,
//          item_code: itemCode,
//          item_group: group,
//          uom,
//          warehouse: nextWarehouse, // ✅ auto
//          price_list: nextPL, // ✅ auto
//          rate: "", // reset before refetch
//          rowError: "",
//        };

//        targetRow = updated;
//        return updated;
//      })
//    );

//    if (!targetRow) return;
//    const updated = await fetchRateForRow(targetRow);
//    setRows((prev) => prev.map((r) => (r.id === rowId ? updated : r)));
//  }

//  async function handleRefreshRate(rowId) {
//    const row = rows.find((r) => r.id === rowId);
//    if (!row) return;
//    const updated = await fetchRateForRow(row);
//    setRows((prev) => prev.map((r) => (r.id === rowId ? updated : r)));
//  }

//  async function handleSubmit(e) {
//    e.preventDefault();
//    setError("");
//    setMessage("");

//    if (!company) return setError("Company is required.");
//    if (!postingDate) return setError("Posting date is required.");

//    const validRows = rows.filter(
//      (r) =>
//        r.item_code &&
//        r.warehouse &&
//        !isNaN(parseFloat(r.qty)) &&
//        parseFloat(r.qty) >= 0
//    );

//    if (!validRows.length) {
//      return setError("Add at least one row with item and quantity.");
//    }

//    const itemsPayload = validRows.map((r) => ({
//      item_code: r.item_code,
//      warehouse: r.warehouse,
//      qty: parseFloat(r.qty),
//      valuation_rate: r.rate ? parseFloat(r.rate) : undefined,
//    }));

//    const payload = {
//      doctype: "Stock Reconciliation",
//      purpose: "Opening Stock",
//      company,
//      posting_date: postingDate,
//      expense_account: DEFAULT_DIFFERENCE_ACCOUNT,
//      is_opening: "Yes",
//      items: itemsPayload,
//    };

//    try {
//      setSaving(true);
//      const doc = await createDoc("Stock Reconciliation", payload);
//      const name = doc.data?.name;

//      if (name) {
//        await submitDoc("Stock Reconciliation", name);
//        setMessage(`Opening Stock created via Stock Reconciliation: ${name}`);
//      } else {
//        setMessage("Stock Reconciliation created (no name returned).");
//      }
//    } catch (err) {
//      console.error(err);
//      setError(err.response?.data?.error?.message || err.message || "Failed to create/submit Stock Reconciliation");
//    } finally {
//      setSaving(false);
//    }
//  }

//  return (
//    <div className="opening-stock">
//      <div className="opening-stock-header-row">
//        <div className="opening-stock-header">
//          <h2 className="opening-stock-title">Opening Stock Entry</h2>
//          <p className="opening-stock-subtitle">
//            Create opening stock using Stock Reconciliation (per item)
//          </p>
//        </div>
//        <div className="opening-stock-pill">
//          {rows.length} line{rows.length !== 1 ? "s" : ""} • {company || "No company"}
//        </div>
//      </div>

//      {loadingInit && (
//        <p className="text-muted opening-stock-loading">
//          Loading items, price lists...
//        </p>
//      )}
//      {error && <p className="alert alert-error">{error}</p>}
//      {message && <p className="alert alert-success">{message}</p>}

//      <form onSubmit={handleSubmit} className="opening-stock-form">
//        {/* top controls */}
//        <div className="opening-stock-top-grid">
//          <div className="field-group">
//            <label className="form-label">Company</label>
//            <select value={company} onChange={(e) => setCompany(e.target.value)} className="select">
//              <option value="">-- select company --</option>
//              {companies.map((c) => (
//                <option key={c.name} value={c.name}>
//                  {c.company_name || c.name}
//                  {c.abbr ? ` (${c.abbr})` : ""}
//                </option>
//              ))}
//            </select>
//          </div>

//          <div className="field-group">
//            <label className="form-label">Posting Date</label>
//            <input
//              type="date"
//              value={postingDate}
//              onChange={(e) => setPostingDate(e.target.value)}
//              className="input"
//            />
//          </div>
//        </div>

//        {/* rows header + add button */}
//        <div className="opening-stock-rows-header">
//          <h3 className="opening-stock-rows-title">Items</h3>
//          <button type="button" onClick={addRow} className="btn btn-accent btn-sm">
//            + Add Item
//          </button>
//        </div>

//        {/* rows table */}
//        <div className="table-container opening-stock-table-wrapper">
//          <table className="table opening-stock-table">
//            <thead>
//              <tr>
//                <th>Item</th>
//                <th>Warehouse</th>
//                <th>Unit</th>
//                <th>Qty</th>
//                <th>Price List</th>
//                <th>Rate</th>
//                <th>Actions</th>
//              </tr>
//            </thead>

//            <tbody>
//              {rows.map((row) => (
//                <tr key={row.id}>
//                  {/* Item: searchable */}
//                  <td>
//                    <ItemSearchDropdown
//                      items={items}
//                      value={row.item_code}
//                      onSelect={(code) => handleRowItemChange(row.id, code)}
//                      placeholder="Search item name / code..."
//                    />
//                  </td>

//                  {/* Warehouse: auto (not editable) */}
//                  <td>
//                    <span className="text-muted">{row.warehouse || RAW_WH}</span>
//                  </td>

//                  {/* UOM from item */}
//                  <td>{row.uom}</td>

//                  {/* Qty */}
//                  <td>
//                    <input
//                      type="number"
//                      min="0"
//                      value={row.qty}
//                      onChange={(e) => handleRowFieldChange(row.id, "qty", e.target.value)}
//                      className="input"
//                    />
//                  </td>

//                  {/* Price list: auto (not editable) */}
//                  <td>
//                    <span className="text-muted">{row.price_list || "—"}</span>
//                  </td>

//                  {/* Rate + auto button */}
//                  <td>
//                    <div className="opening-stock-rate-cell">
//                      <input
//                        value={row.loadingRate ? "Loading..." : row.rate}
//                        onChange={(e) => handleRowFieldChange(row.id, "rate", e.target.value)}
//                        className="input"
//                      />
//                      <button
//                        type="button"
//                        className="btn btn-outline btn-sm opening-stock-rate-btn"
//                        onClick={() => handleRefreshRate(row.id)}
//                        disabled={!row.item_code || row.loadingRate}
//                      >
//                        Auto
//                      </button>
//                    </div>

//                    {row.rowError && (
//                      <div className="opening-stock-row-error">{row.rowError}</div>
//                    )}
//                  </td>

//                  {/* Remove */}
//                  <td>
//                    <button
//                      type="button"
//                      onClick={() => removeRow(row.id)}
//                      className="btn btn-ghost btn-sm"
//                    >
//                      Remove
//                    </button>
//                  </td>
//                </tr>
//              ))}

//              {rows.length === 0 && (
//                <tr>
//                  <td colSpan={7} className="text-muted">
//                    No rows added yet.
//                  </td>
//                </tr>
//              )}
//            </tbody>
//          </table>
//        </div>

//        <div className="opening-stock-submit-row">
//          <button type="submit" disabled={saving || loadingInit} className="btn btn-primary">
//            {saving ? "Saving..." : "Create Opening Stock"}
//          </button>
//        </div>
//      </form>
//    </div>
//  );
//}

//export default OpeningStockEntry;
// src/Components/OpeningStockEntry.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  getItemsForBOM, // 👈 make sure this API includes `item_group`
  getPriceLists,
  getItemRateFromPriceList,
  getItemWarehouseValuationRate,
  getCompanies,
  createDoc,
  submitDoc,
} from "./erpBackendApi";
import "../CSS/OpeningStockEntry.css";

const RAW_WH = "Raw Material - MF";
const FINISHED_WH = "Finished Goods - MF";

// ✅ use the NON-group child account here
const DEFAULT_DIFFERENCE_ACCOUNT = "Temporary Opening - MF";

// Price List names (display names you want)
const PL_SELLING = "Standard Selling";
const PL_BUYING = "Standard Buying";

function createEmptyRow(id) {
  return {
    id,
    item_code: "",
    item_group: "",
    warehouse: RAW_WH, // ✅ auto changes after item select
    uom: "",
    qty: "",
    price_list: "", // ✅ auto changes after item select
    rate: "",
    loadingRate: false,
    rowError: "",
  };
}

function isFinishedGroup(itemGroup) {
  const g = String(itemGroup || "").trim().toLowerCase();
  // supports "Product", "Products", "Finished", etc.
  return g === "product" || g === "products" || g.includes("finished") || g.includes("product");
}

function pickPriceListName(target, priceLists) {
  const t = String(target || "").trim().toLowerCase();
  const found = (priceLists || []).find(
    (pl) =>
      String(pl.name || "").toLowerCase() === t ||
      String(pl.price_list_name || "").toLowerCase() === t
  );
  return found?.name || target || "";
}

// ---------------------------
// Bulk helpers (CSV/TSV/XLSX)
// ---------------------------
function normalizeKey(k) {
  return String(k ?? "")
    .replace(/\uFEFF/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/_+/g, "-");
}

function looseKey(k) {
  return String(k || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pickFirstSmart(row, aliases) {
  if (!row) return "";

  // 1) direct key match
  for (const k of aliases || []) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }

  // 2) loose match (punctuation/extra chars)
  const map = new Map();
  Object.keys(row).forEach((k) => map.set(looseKey(k), k));

  for (const k of aliases || []) {
    const realKey = map.get(looseKey(k));
    if (!realKey) continue;
    const v = row[realKey];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }

  return "";
}

// Small CSV/TSV parser (handles quotes)
function parseDelimited(text) {
  const rawLines = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (!rawLines.length) return [];

  const first = rawLines[0];
  const tabCount = (first.match(/\t/g) || []).length;
  const commaCount = (first.match(/,/g) || []).length;
  const delim = tabCount >= commaCount ? "\t" : ",";

  const splitLine = (line) => {
    const out = [];
    let cur = "";
    let inQ = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
        continue;
      }

      if (!inQ && ch === delim) {
        out.push(cur);
        cur = "";
        continue;
      }

      cur += ch;
    }

    out.push(cur);
    return out.map((x) => String(x ?? "").trim());
  };

  const headers = splitLine(rawLines[0]).map(normalizeKey);
  const rows = [];

  for (let i = 1; i < rawLines.length; i++) {
    const cols = splitLine(rawLines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? "";
    });
    rows.push(obj);
  }

  return rows;
}

// ✅ header variations (normalized keys)
const BULK_COL = {
  itemCode: ["item-code", "item_code", "item", "item-id", "itemid", "item-name", "itemname", "code"],
  qty: ["qty", "quantity", "opening-qty", "opening-stock", "stock", "count"],
  warehouse: ["warehouse", "wh", "location", "store", "godown"],
  rate: ["rate", "valuation-rate", "valuation_rate", "valuation", "unit-rate", "unit-price", "price"],
};

async function parseAnyFile(file) {
  const name = String(file?.name || "").toLowerCase();

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    let mod;
    try {
      mod = await import("xlsx");
    } catch (e) {
      throw new Error('To import .xlsx, run: npm i xlsx (then restart dev server).');
    }

    const XLSX = mod?.default || mod;
    if (!XLSX?.read || !XLSX?.utils) {
      throw new Error("xlsx library not loaded correctly. Restart dev server.");
    }

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

    const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

    return json.map((row) => {
      const out = {};
      Object.keys(row || {}).forEach((k) => {
        out[normalizeKey(k)] = row[k];
      });
      return out;
    });
  }

  const text = await file.text();
  return parseDelimited(text);
}

// Concurrency limiter (for bulk rate fetching)
async function runWithLimit(items, limit, workerFn, onProgress) {
  const out = new Array(items.length);
  let i = 0;

  const workers = new Array(limit).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await workerFn(items[idx], idx);
      onProgress?.(idx + 1);
    }
  });

  await Promise.all(workers);
  return out;
}

function ItemSearchDropdown({ items, value, onSelect, placeholder, className = "" }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  const selected = useMemo(() => items.find((x) => x.name === value) || null, [items, value]);

  const filtered = useMemo(() => {
    const s = (q || "").trim().toLowerCase();
    const base = !s
      ? items
      : items.filter((it) => {
          const code = (it.name || "").toLowerCase();
          const name = (it.item_name || "").toLowerCase();
          return code.includes(s) || name.includes(s);
        });
    return base.slice(0, 80);
  }, [items, q]);

  useEffect(() => {
    function onDown(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className={`stdrop ${className}`} ref={ref}>
      <button
        type="button"
        className={`stdrop-control ${open ? "is-open" : ""} opening-stock-item-input`}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="stdrop-value">
          {selected ? (
            <>
              <div className="stdrop-title">{selected.name}</div>
              <div className="stdrop-sub">
                {selected.item_name || ""} {selected.stock_uom ? `· ${selected.stock_uom}` : ""}
              </div>
            </>
          ) : (
            <div className="stdrop-placeholder">{placeholder}</div>
          )}
        </div>
        <div className="stdrop-caret">▾</div>
      </button>

      {open && (
        <div className="stdrop-popover">
          <div className="stdrop-search">
            <input
              autoFocus
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type to search..."
            />
          </div>

          <div className="stdrop-list">
            {filtered.map((it) => (
              <button
                key={it.name}
                type="button"
                className="stdrop-item"
                onClick={() => {
                  onSelect(it.name);
                  setOpen(false);
                  setQ("");
                }}
              >
                <div className="stdrop-item-title">{it.name}</div>
                <div className="stdrop-item-sub">
                  {it.item_name || ""} {it.stock_uom ? `· ${it.stock_uom}` : ""}
                </div>
              </button>
            ))}

            {!filtered.length ? (
              <div className="stdrop-empty">No items found.</div>
            ) : (
              <div className="stdrop-hint">Showing up to 80 results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OpeningStockEntry() {
  const [items, setItems] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [companies, setCompanies] = useState([]);

  const [company, setCompany] = useState("");
  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10));

  const [rows, setRows] = useState([createEmptyRow(0)]);

  const [loadingInit, setLoadingInit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ✅ Tabs
  const [activeTab, setActiveTab] = useState("manual"); // "manual" | "bulk"

  // ✅ Bulk state
  const fileRef = useRef(null);
  const [bulkParsing, setBulkParsing] = useState(false);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkParseError, setBulkParseError] = useState("");
  const [bulkLines, setBulkLines] = useState([]); // {rowNo,item_code,warehouse,qty,rate?}
  const [bulkResults, setBulkResults] = useState([]); // per-line status
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const itemByCode = useMemo(() => {
    const m = new Map();
    (items || []).forEach((it) => {
      if (it?.name) m.set(it.name, it);
    });
    return m;
  }, [items]);

  // initial load
  useEffect(() => {
    async function init() {
      setLoadingInit(true);
      setError("");
      try {
        const [itemData, plData, companyData] = await Promise.all([
          getItemsForBOM(), // ✅ must include item_group
          getPriceLists(),
          getCompanies(),
        ]);

        setItems(itemData || []);
        setPriceLists(plData || []);
        setCompanies(companyData || []);

        if (companyData && companyData.length > 0) setCompany(companyData[0].name);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load items / price lists / companies");
      } finally {
        setLoadingInit(false);
      }
    }
    init();
  }, []);

  function addRow() {
    setRows((prev) => [
      ...prev,
      createEmptyRow(prev.length ? prev[prev.length - 1].id + 1 : 0),
    ]);
  }

  function removeRow(rowId) {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== rowId);
      return next.length ? next : [createEmptyRow(0)];
    });
  }

  function handleRowFieldChange(rowId, field, value) {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, [field]: value, rowError: "" } : r))
    );
  }

  async function fetchRateForRow(row) {
    if (!row.item_code) return row;

    const item = items.find((it) => it.name === row.item_code);
    const updated = { ...row, loadingRate: true, rowError: "" };

    try {
      const finished = isFinishedGroup(item?.item_group || row.item_group);
      const targetPL = finished ? PL_SELLING : PL_BUYING;
      const pl = pickPriceListName(updated.price_list || targetPL, priceLists);

      updated.price_list = pl;

      // 1) Try price list rate (auto)
      if (pl) {
        const priceRow = await getItemRateFromPriceList(updated.item_code, pl);
        const pr = Number(priceRow?.price_list_rate);

        if (Number.isFinite(pr) && pr > 0) {
          updated.rate = String(pr);
        } else {
          // 2) Fallback valuation_rate on Item
          const vr = Number(item?.valuation_rate);
          if (Number.isFinite(vr) && vr > 0) {
            updated.rate = String(vr);
          } else {
            // 3) Fallback Bin valuation per warehouse
            const wh = updated.warehouse || RAW_WH;
            const bin = await getItemWarehouseValuationRate(updated.item_code, wh);
            const br = Number(bin?.valuation_rate);
            if (Number.isFinite(br) && br > 0) updated.rate = String(br);
            else updated.rowError = "No rate in price list / valuation / bin";
          }
        }
      } else {
        updated.rowError = "Price list not found";
      }
    } catch (err) {
      console.error(err);
      updated.rowError = err.message || "Failed to fetch rate";
    }

    updated.loadingRate = false;
    return updated;
  }

  // ✅ When item changes:
  // - auto set Warehouse (Finished vs Raw)
  // - auto set Price List (Standard Selling vs Standard Buying)
  // - auto set UOM
  // - auto fetch Rate
  async function handleRowItemChange(rowId, itemCode) {
    const item = items.find((it) => it.name === itemCode);
    const uom = item?.stock_uom || item?.uom || item?.default_uom || "";
    const group = item?.item_group || "";

    const finished = isFinishedGroup(group);
    const nextWarehouse = finished ? FINISHED_WH : RAW_WH;
    const nextPL = pickPriceListName(finished ? PL_SELLING : PL_BUYING, priceLists);

    let targetRow = null;

    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;

        const updated = {
          ...r,
          item_code: itemCode,
          item_group: group,
          uom,
          warehouse: nextWarehouse, // ✅ auto
          price_list: nextPL, // ✅ auto
          rate: "", // reset before refetch
          rowError: "",
        };

        targetRow = updated;
        return updated;
      })
    );

    if (!targetRow) return;
    const updated = await fetchRateForRow(targetRow);
    setRows((prev) => prev.map((r) => (r.id === rowId ? updated : r)));
  }

  async function handleRefreshRate(rowId) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const updated = await fetchRateForRow(row);
    setRows((prev) => prev.map((r) => (r.id === rowId ? updated : r)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!company) return setError("Company is required.");
    if (!postingDate) return setError("Posting date is required.");

    const validRows = rows.filter(
      (r) =>
        r.item_code &&
        r.warehouse &&
        !isNaN(parseFloat(r.qty)) &&
        parseFloat(r.qty) >= 0
    );

    if (!validRows.length) {
      return setError("Add at least one row with item and quantity.");
    }

    const itemsPayload = validRows.map((r) => ({
      item_code: r.item_code,
      warehouse: r.warehouse,
      qty: parseFloat(r.qty),
      valuation_rate: r.rate ? parseFloat(r.rate) : undefined,
    }));

    const payload = {
      doctype: "Stock Reconciliation",
      purpose: "Opening Stock",
      company,
      posting_date: postingDate,
      expense_account: DEFAULT_DIFFERENCE_ACCOUNT,
      is_opening: "Yes",
      items: itemsPayload,
    };

    try {
      setSaving(true);
      const doc = await createDoc("Stock Reconciliation", payload);
      const name = doc.data?.name;

      if (name) {
        await submitDoc("Stock Reconciliation", name);
        setMessage(`Opening Stock created via Stock Reconciliation: ${name}`);
      } else {
        setMessage("Stock Reconciliation created (no name returned).");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || err.message || "Failed to create/submit Stock Reconciliation");
    } finally {
      setSaving(false);
    }
  }

  // ------------------------
  // Bulk handlers
  // ------------------------
  function clearBulkFile() {
    if (fileRef.current) fileRef.current.value = "";
  }

  function resetBulk() {
    setBulkParseError("");
    setBulkLines([]);
    setBulkResults([]);
    setBulkProgress({ done: 0, total: 0 });
    clearBulkFile();
  }

  async function handleBulkFilePicked(e) {
    setBulkParseError("");
    setBulkLines([]);
    setBulkResults([]);
    setBulkProgress({ done: 0, total: 0 });

    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setBulkParsing(true);

      const raw = await parseAnyFile(file);
      const lines = [];
      const errs = [];

      raw.forEach((r, idx) => {
        const rowNo = idx + 2;

        const item_code = String(pickFirstSmart(r, BULK_COL.itemCode) || "").trim();
        const qtyRaw = pickFirstSmart(r, BULK_COL.qty);
        const whRaw = String(pickFirstSmart(r, BULK_COL.warehouse) || "").trim();
        const rateRaw = pickFirstSmart(r, BULK_COL.rate);

        const qty = qtyRaw === "" || qtyRaw == null ? NaN : parseFloat(qtyRaw);
        const rateNum =
          String(rateRaw ?? "").trim() !== "" && !isNaN(parseFloat(rateRaw))
            ? parseFloat(rateRaw)
            : undefined;

        if (!item_code) {
          errs.push(`Row ${rowNo}: missing item_code`);
          return;
        }

        const item = itemByCode.get(item_code);
        if (!item) {
          errs.push(`Row ${rowNo}: invalid item_code (not found in Item master): ${item_code}`);
          return;
        }

        if (!Number.isFinite(qty) || qty < 0) {
          errs.push(`Row ${rowNo}: missing/invalid qty (must be number >= 0)`);
          return;
        }

        // warehouse: file value OR auto by item_group
        let warehouse = whRaw;
        if (!warehouse) {
          const finished = isFinishedGroup(item?.item_group);
          warehouse = finished ? FINISHED_WH : RAW_WH;
        }

        lines.push({
          rowNo,
          item_code,
          item_group: item?.item_group || "",
          warehouse,
          qty,
          rate: rateNum, // optional, will auto-fill if missing
        });
      });

      if (errs.length) {
        setBulkParseError(
          errs.slice(0, 5).join(" | ") + (errs.length > 5 ? ` (+${errs.length - 5} more)` : "")
        );
      }

      setBulkLines(lines);
    } catch (err) {
      console.error(err);
      setBulkParseError(err.message || "Failed to parse file");
    } finally {
      setBulkParsing(false);
    }
  }

  async function handleBulkCreateOpeningStock() {
    setError("");
    setMessage("");
    setBulkResults([]);

    if (!company) return setError("Company is required.");
    if (!postingDate) return setError("Posting date is required.");
    if (!bulkLines.length) return setError("No parsed lines. Upload a file first.");

    setBulkCreating(true);

    try {
      // ✅ auto-fill missing rates using same logic as manual
      const needRateTotal = bulkLines.filter((l) => !(Number.isFinite(l.rate) && l.rate > 0)).length;
      setBulkProgress({ done: 0, total: needRateTotal || 0 });

      const enriched = await runWithLimit(
        bulkLines,
        4,
        async (l) => {
          if (Number.isFinite(l.rate) && l.rate > 0) return { ...l, _rateNote: "" };

          // build a fake row and reuse fetchRateForRow()
          const finished = isFinishedGroup(l.item_group);
          const targetPL = finished ? PL_SELLING : PL_BUYING;
          const pl = pickPriceListName(targetPL, priceLists);

          const tmp = {
            item_code: l.item_code,
            item_group: l.item_group,
            warehouse: l.warehouse,
            price_list: pl,
            rate: "",
            loadingRate: false,
            rowError: "",
          };

          const updated = await fetchRateForRow(tmp);
          const rnum = parseFloat(updated.rate);
          const ok = Number.isFinite(rnum) && rnum > 0;

          return {
            ...l,
            rate: ok ? rnum : undefined,
            _rateNote: ok ? "" : (updated.rowError || "Rate not found"),
          };
        },
        (done) => {
          if (needRateTotal > 0) setBulkProgress({ done, total: needRateTotal });
        }
      );

      // Build payload (one Stock Reconciliation for all lines)
      const itemsPayload = enriched.map((r) => ({
        item_code: r.item_code,
        warehouse: r.warehouse,
        qty: Number(r.qty),
        valuation_rate: Number.isFinite(r.rate) && r.rate > 0 ? Number(r.rate) : undefined,
      }));

      const payload = {
        doctype: "Stock Reconciliation",
        purpose: "Opening Stock",
        company,
        posting_date: postingDate,
        expense_account: DEFAULT_DIFFERENCE_ACCOUNT,
        is_opening: "Yes",
        items: itemsPayload,
      };

      const created = await createDoc("Stock Reconciliation", payload);
      const name = created?.data?.name;

      if (!name) {
        throw new Error("Stock Reconciliation created but name not returned.");
      }

      await submitDoc("Stock Reconciliation", name);

      // Results per line
      const results = enriched.map((r) => ({
        rowNo: r.rowNo,
        item_code: r.item_code,
        warehouse: r.warehouse,
        qty: r.qty,
        rate: r.rate,
        status: "OK",
        sr_name: name,
        message: r._rateNote ? `Created (but rate missing: ${r._rateNote})` : "Created & submitted",
      }));

      setBulkResults(results);
      setMessage(`Bulk Opening Stock created via Stock Reconciliation: ${name}`);
      clearBulkFile();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error?.message || err?.response?.data?.error || err.message || "Bulk create failed";
      setError(msg);

      // show FAILED results if we already parsed
      if (bulkLines.length) {
        setBulkResults(
          bulkLines.map((r) => ({
            rowNo: r.rowNo,
            item_code: r.item_code,
            warehouse: r.warehouse,
            qty: r.qty,
            rate: r.rate,
            status: "FAILED",
            sr_name: "",
            message: msg,
          }))
        );
      }
    } finally {
      setBulkCreating(false);
      setBulkProgress({ done: 0, total: 0 });
    }
  }

  return (
    <div className="opening-stock">
      <div className="opening-stock-header-row">
        <div className="opening-stock-header">
          <h2 className="opening-stock-title">Opening Stock Entry</h2>
          <p className="opening-stock-subtitle">
            Create opening stock using Stock Reconciliation (per item)
          </p>
        </div>
        <div className="opening-stock-pill">
          {activeTab === "manual" ? "Manual" : "Bulk"} • {company || "No company"}
        </div>
      </div>

      {/* ✅ Tabs */}
      <div className="opening-stock-tabs">
        <button
          type="button"
          className={`opening-stock-tab ${activeTab === "manual" ? "is-active" : ""}`}
          onClick={() => setActiveTab("manual")}
        >
          Manual Entry
        </button>
        <button
          type="button"
          className={`opening-stock-tab ${activeTab === "bulk" ? "is-active" : ""}`}
          onClick={() => setActiveTab("bulk")}
        >
          Bulk Upload
        </button>
      </div>

      {loadingInit && (
        <p className="text-muted opening-stock-loading">
          Loading items, price lists...
        </p>
      )}
      {error && <p className="alert alert-error">{error}</p>}
      {message && <p className="alert alert-success">{message}</p>}

      {/* --------------------- */}
      {/* MANUAL TAB (same flow) */}
      {/* --------------------- */}
      {activeTab === "manual" && (
        <form onSubmit={handleSubmit} className="opening-stock-form">
          {/* top controls */}
          <div className="opening-stock-top-grid">
            <div className="field-group">
              <label className="form-label">Company</label>
              <select value={company} onChange={(e) => setCompany(e.target.value)} className="select">
                <option value="">-- select company --</option>
                {companies.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.company_name || c.name}
                    {c.abbr ? ` (${c.abbr})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label className="form-label">Posting Date</label>
              <input
                type="date"
                value={postingDate}
                onChange={(e) => setPostingDate(e.target.value)}
                className="input"
              />
            </div>
          </div>

          {/* rows header + add button */}
          <div className="opening-stock-rows-header">
            <h3 className="opening-stock-rows-title">Items</h3>
            <button type="button" onClick={addRow} className="btn btn-accent btn-sm">
              + Add Item
            </button>
          </div>

          {/* rows table */}
          <div className="table-container opening-stock-table-wrapper">
            <table className="table opening-stock-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Warehouse</th>
                  <th>Unit</th>
                  <th>Qty</th>
                  <th>Price List</th>
                  <th>Rate</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    {/* Item: searchable */}
                    <td>
                      <ItemSearchDropdown
                        items={items}
                        value={row.item_code}
                        onSelect={(code) => handleRowItemChange(row.id, code)}
                        placeholder="Search item name / code..."
                      />
                    </td>

                    {/* Warehouse: auto (not editable) */}
                    <td>
                      <span className="text-muted">{row.warehouse || RAW_WH}</span>
                    </td>

                    {/* UOM from item */}
                    <td>{row.uom}</td>

                    {/* Qty */}
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={row.qty}
                        onChange={(e) => handleRowFieldChange(row.id, "qty", e.target.value)}
                        className="input"
                      />
                    </td>

                    {/* Price list: auto (not editable) */}
                    <td>
                      <span className="text-muted">{row.price_list || "—"}</span>
                    </td>

                    {/* Rate + auto button */}
                    <td>
                      <div className="opening-stock-rate-cell">
                        <input
                          value={row.loadingRate ? "Loading..." : row.rate}
                          onChange={(e) => handleRowFieldChange(row.id, "rate", e.target.value)}
                          className="input"
                        />
                        <button
                          type="button"
                          className="btn btn-outline btn-sm opening-stock-rate-btn"
                          onClick={() => handleRefreshRate(row.id)}
                          disabled={!row.item_code || row.loadingRate}
                        >
                          Auto
                        </button>
                      </div>

                      {row.rowError && (
                        <div className="opening-stock-row-error">{row.rowError}</div>
                      )}
                    </td>

                    {/* Remove */}
                    <td>
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="btn btn-ghost btn-sm"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-muted">
                      No rows added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="opening-stock-submit-row">
            <button type="submit" disabled={saving || loadingInit} className="btn btn-primary">
              {saving ? "Saving..." : "Create Opening Stock"}
            </button>
          </div>
        </form>
      )}

      {/* ---------------- */}
      {/* BULK TAB (new)   */}
      {/* ---------------- */}
      {activeTab === "bulk" && (
        <div className="opening-stock-bulk">
          {/* top controls (same state) */}
          <div className="opening-stock-top-grid" style={{ marginTop: 10 }}>
            <div className="field-group">
              <label className="form-label">Company</label>
              <select
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="select"
                disabled={bulkParsing || bulkCreating}
              >
                <option value="">-- select company --</option>
                {companies.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.company_name || c.name}
                    {c.abbr ? ` (${c.abbr})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label className="form-label">Posting Date</label>
              <input
                type="date"
                value={postingDate}
                onChange={(e) => setPostingDate(e.target.value)}
                className="input"
                disabled={bulkParsing || bulkCreating}
              />
            </div>
          </div>

          <div className="opening-stock-bulk-head">
            <h3 className="opening-stock-rows-title">Bulk Upload (Opening Stock)</h3>
            <button type="button" onClick={resetBulk} className="btn btn-secondary btn-sm">
              Clear
            </button>
          </div>

          <div className="opening-stock-bulk-grid">
            <div className="field-group">
              <label className="form-label">Upload file (.xlsx / .csv / .tsv)</label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.xls"
                className="input"
                onChange={handleBulkFilePicked}
                disabled={bulkParsing || bulkCreating}
              />
              <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
                Required columns: <b>item_code</b> and <b>qty</b>. Optional: <b>warehouse</b>, <b>rate</b>.
                <br />
                If warehouse is missing, it auto-picks: <b>{FINISHED_WH}</b> for Products, else <b>{RAW_WH}</b>.
              </div>
            </div>

            <div className="opening-stock-bulk-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleBulkCreateOpeningStock}
                disabled={bulkCreating || bulkParsing || !bulkLines.length}
              >
                {bulkCreating ? "Creating..." : "Create Opening Stock from File"}
              </button>

              <div className="text-muted" style={{ fontSize: 12 }}>
                Parsed lines: <b>{bulkLines.length}</b>
                {bulkCreating && bulkProgress.total > 0 ? (
                  <>
                    {" "}
                    | Rate Auto Progress: <b>{bulkProgress.done}/{bulkProgress.total}</b>
                  </>
                ) : null}
              </div>

              {bulkParseError ? (
                <div className="alert alert-error" style={{ marginTop: 10 }}>
                  {bulkParseError}
                </div>
              ) : null}
            </div>
          </div>

          {bulkResults.length > 0 && (
            <div className="table-container opening-stock-table-wrapper" style={{ marginTop: 14 }}>
              <table className="table opening-stock-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Item</th>
                    <th>Warehouse</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>Status</th>
                    <th>Stock Reco</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkResults.map((r, idx) => (
                    <tr key={`${r.rowNo}-${r.item_code}-${idx}`}>
                      <td>{r.rowNo}</td>
                      <td>{r.item_code}</td>
                      <td>{r.warehouse}</td>
                      <td>{r.qty}</td>
                      <td>{Number.isFinite(r.rate) ? r.rate : "-"}</td>
                      <td>
                        <span className={"opening-stock-status-pill " + (r.status === "OK" ? "ok" : "fail")}>
                          {r.status}
                        </span>
                      </td>
                      <td>{r.sr_name || "-"}</td>
                      <td style={{ maxWidth: 520, whiteSpace: "pre-wrap" }}>{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default OpeningStockEntry;
