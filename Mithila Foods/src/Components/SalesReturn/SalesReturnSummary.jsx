// src/SalesReturnSummary.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  getCustomers,
  getCompanies,
  getFinishedItemsForSales,
  getDoctypeList,
  getDoc,
  mapLimit,
} from "../erpBackendApi";

import "./SalesReturnSummary.css";

/**
 * SALES RETURN SUMMARY
 * --------------------
 * What this screen does:
 * 1) Reads Sales Invoices where `is_return = 1` (Sales Returns)
 * 2) Filters by date range + optional Company/Customer/Item filters
 * 3) Splits quantities into:
 *    - GOOD_WH    : items returned to Finished Goods warehouse
 *    - DAMAGED_WH : items returned to Damaged warehouse
 * 4) Shows two views:
 *    - DAY tab  : day-wise totals + customer list
 *    - ITEM tab : date-wise item totals
 *
 * Notes:
 * - We treat Sales Return item qty as ABS(qty) because ERPNext often stores returns as negative qty.
 * - Warehouse is read from item row `it.warehouse`; if missing we assume GOOD_WH.
 */

const GOOD_WH = "Finished Goods - MF";
const DAMAGED_WH = "Damaged - MF";

/* =========================================================
   Utility helpers
   ========================================================= */

/**
 * Convert "YYYY-MM-DD" into a timestamp-like number for sorting.
 * Safe fallback returns 0.
 */
function toSortTs(v) {
  if (!v) return 0;
  const s = String(v).trim();
  if (!s) return 0;

  // Accept "YYYY-MM-DD HH:mm:ss" and convert to ISO-like
  const isoLike = s.includes(" ") ? s.replace(" ", "T") : s;
  const d = new Date(isoLike);
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Normalize a date input into "YYYY-MM-DD"
 * Accepts:
 * - Date instance
 * - "YYYY-MM-DD"
 * - "DD/MM/YYYY" or "DD-MM-YYYY"
 * - "DDMMYYYY"
 */
function toYMD(input) {
  if (input == null) return "";

  if (input instanceof Date && !isNaN(input.getTime())) {
    return input.toISOString().slice(0, 10);
  }

  const s = String(input).trim();
  if (!s) return "";

  // YYYY-MM-DD (with optional time)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[t\s].*)?$/i);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  // DDMMYYYY
  if (/^\d{8}$/.test(s)) {
    const dd = s.slice(0, 2);
    const mm = s.slice(2, 4);
    const yyyy = s.slice(4, 8);
    return `${yyyy}-${mm}-${dd}`;
  }

  return "";
}

function uniqSorted(arr) {
  return Array.from(new Set((arr || []).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function joinAll(arr) {
  const xs = uniqSorted(arr);
  return xs.length ? xs.join(", ") : "—";
}

function lastNDaysRange(n = 30) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (n - 1));
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

/* =========================================================
   SearchDropdown (stdrop) - reusable "searchable select"
   ========================================================= */
/**
 * options: [{ value, label, sub, raw }]
 * value: currently selected option.value
 * onSelect: (newValue) => void
 * searchKeys: keys pulled from option.raw to search on
 */
function SearchDropdown({
  options = [],
  value,
  onSelect,
  placeholder = "Search...",
  disabled = false,
  getTitle,
  getSub,
  searchKeys = [],
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  const selected = useMemo(
    () => (options || []).find((x) => x.value === value) || null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const s = (q || "").trim().toLowerCase();
    if (!s) return (options || []).slice(0, 80);

    const out = (options || []).filter((opt) => {
      const hay = [
        opt.value,
        opt.label,
        ...(searchKeys || []).map((k) => String(opt?.raw?.[k] || "")),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(s);
    });

    return out.slice(0, 80);
  }, [options, q, searchKeys]);

  // close dropdown on outside click
  useEffect(() => {
    function onDown(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // clear selected value
  const clearSelection = (e) => {
    e?.stopPropagation?.();
    if (disabled) return;
    onSelect?.("");
    setOpen(false);
    setQ("");
  };

  return (
    <div className="stdrop" ref={ref}>
      <button
        type="button"
        className={`stdrop-control ${open ? "is-open" : ""}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
      >
        <div className="stdrop-value">
          {selected ? (
            <>
              <div className="stdrop-title">{getTitle ? getTitle(selected) : selected.label}</div>
              <div className="stdrop-sub">{getSub ? getSub(selected) : selected.sub || ""}</div>
            </>
          ) : (
            <div className="stdrop-placeholder">{placeholder}</div>
          )}
        </div>

        <div className="stdrop-actions">
          {!!value && !disabled && (
            <span
              className="stdrop-clear"
              role="button"
              tabIndex={0}
              title="Clear"
              onClick={clearSelection}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && clearSelection(e)}
            >
              ✕
            </span>
          )}
          <div className="stdrop-caret">▾</div>
        </div>
      </button>

      {open && !disabled && (
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
            {!!value && (
              <button
                type="button"
                className="stdrop-item stdrop-item-clear"
                onClick={() => {
                  onSelect?.("");
                  setOpen(false);
                  setQ("");
                }}
              >
                <div className="stdrop-item-title">Clear selection</div>
              </button>
            )}

            {filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="stdrop-item"
                onClick={() => {
                  onSelect?.(opt.value);
                  setOpen(false);
                  setQ("");
                }}
              >
                <div className="stdrop-item-title">{opt.label}</div>
                {opt.sub ? <div className="stdrop-item-sub">{opt.sub}</div> : null}
              </button>
            ))}

            {!filtered.length ? (
              <div className="stdrop-empty">No results found.</div>
            ) : (
              <div className="stdrop-hint">Showing up to 80 results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   Main Component
   ========================================================= */
export default function SalesReturnSummary() {
  // master data
  const [customers, setCustomers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [itemsCatalog, setItemsCatalog] = useState([]);

  // date range defaults: last 30 days
  const dflt = lastNDaysRange(30);
  const [fromDate, setFromDate] = useState(dflt.from);
  const [toDate, setToDate] = useState(dflt.to);

  // filter rows (each row is one selection; we allow + Add multiple)
  const [companyRows, setCompanyRows] = useState([""]);
  const [customerRows, setCustomerRows] = useState([""]);
  const [itemRowsFilter, setItemRowsFilter] = useState([""]);

  // UI state
  const [activeTab, setActiveTab] = useState("DAY"); // DAY | ITEM
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  // output state
  const [dayRows, setDayRows] = useState([]);
  const [itemRows, setItemRows] = useState([]);
  const [totalQtyAll, setTotalQtyAll] = useState(0);
  const [totalGoodAll, setTotalGoodAll] = useState(0);
  const [totalDamagedAll, setTotalDamagedAll] = useState(0);

  // item_code -> item_name (fallback when invoice row has missing item_name)
  const itemNameMap = useMemo(() => {
    const m = new Map();
    (itemsCatalog || []).forEach((it) => {
      if (!it?.name) return;
      m.set(it.name, it.item_name || it.name);
    });
    return m;
  }, [itemsCatalog]);

  // Load dropdown masters (customers, companies, items)
  useEffect(() => {
    async function loadMaster() {
      try {
        const [cust, comp, items] = await Promise.all([
          getCustomers(),
          getCompanies(),
          getFinishedItemsForSales(),
        ]);
        setCustomers(cust || []);
        setCompanies(comp || []);
        setItemsCatalog(items || []);
      } catch {
        // not fatal — screen still loads, user can retry via Apply Filter
      }
    }
    loadMaster();
  }, []);

  /* -------------------------
     Dropdown options
     ------------------------- */
  const companyOptions = useMemo(
    () =>
      (companies || []).map((c) => ({
        value: c.name,
        label: c.company_name || c.name,
        sub: c.abbr ? `(${c.abbr})` : "",
        raw: c,
      })),
    [companies]
  );

  const customerOptions = useMemo(
    () =>
      (customers || []).map((c) => ({
        value: c.name,
        label: c.customer_name || c.name,
        sub: c.customer_name && c.customer_name !== c.name ? c.name : "",
        raw: c,
      })),
    [customers]
  );

  const itemOptions = useMemo(
    () =>
      (itemsCatalog || []).map((it) => ({
        value: it.name,
        label: it.item_name || it.name,
        sub: it.name,
        raw: it,
      })),
    [itemsCatalog]
  );

  // Selected lists (unique + non-empty)
  const selectedCompanies = useMemo(() => uniqSorted(companyRows.filter(Boolean)), [companyRows]);
  const selectedCustomers = useMemo(() => uniqSorted(customerRows.filter(Boolean)), [customerRows]);
  const selectedItems = useMemo(() => uniqSorted(itemRowsFilter.filter(Boolean)), [itemRowsFilter]);

  /* -------------------------
     Filter row helpers
     ------------------------- */
  function addRow(setter) {
    setter((prev) => [...prev, ""]);
  }

  function removeRow(setter, idx) {
    setter((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? next : [""];
    });
  }

  function updateRow(setter, idx, val) {
    setter((prev) => prev.map((x, i) => (i === idx ? val : x)));
  }

  /* -------------------------
     Build ERPNext query filters
     ------------------------- */
  function buildFilters() {
    // Basic return filter (draft + submitted)
    const f = [
      ["Sales Invoice", "is_return", "=", 1],
      ["Sales Invoice", "docstatus", "in", [0, 1]],
    ];

    const fFrom = toYMD(fromDate);
    const fTo = toYMD(toDate);

    if (fFrom) f.push(["Sales Invoice", "posting_date", ">=", fFrom]);
    if (fTo) f.push(["Sales Invoice", "posting_date", "<=", fTo]);

    if (selectedCompanies.length) f.push(["Sales Invoice", "company", "in", selectedCompanies]);
    if (selectedCustomers.length) f.push(["Sales Invoice", "customer", "in", selectedCustomers]);

    return f;
  }

  /**
   * Reset filter UI and reload.
   */
  function clearAllFilters() {
    const d = lastNDaysRange(30);
    setFromDate(d.from);
    setToDate(d.to);
    setCompanyRows([""]);
    setCustomerRows([""]);
    setItemRowsFilter([""]);
    setTimeout(() => loadSummary(), 0);
  }

  /* =========================================================
     MAIN LOAD
     ========================================================= */
  const loadSummary = useCallback(async () => {
    setErr("");
    setInfo("");
    setLoading(true);

    try {
      // Validate date range (lexicographic works for YYYY-MM-DD)
      const fFrom = toYMD(fromDate);
      const fTo = toYMD(toDate);
      if (fFrom && fTo && fFrom > fTo) {
        setErr("From Date cannot be greater than To Date.");
        setLoading(false);
        return;
      }

      // 1) Get Sales Invoice headers (fast list)
      const headers = await getDoctypeList("Sales Invoice", {
        fields: JSON.stringify(["name", "posting_date", "customer", "company", "docstatus", "modified"]),
        filters: JSON.stringify(buildFilters()),
        order_by: "posting_date desc, modified desc",
        limit_page_length: 1000,
      });

      // Normalize and drop invalid rows
      const normalized = (headers || [])
        .map((h) => ({
          name: h.name,
          posting_date: toYMD(h.posting_date),
          customer: h.customer,
          company: h.company,
          docstatus: h.docstatus,
          modified: h.modified,
        }))
        .filter((h) => h.name && h.posting_date);

      if (!normalized.length) {
        setDayRows([]);
        setItemRows([]);
        setTotalQtyAll(0);
        setTotalGoodAll(0);
        setTotalDamagedAll(0);
        setInfo("No returns found for the selected range/filters.");
        setLoading(false);
        return;
      }

      // 2) Fetch full docs (need items table)
      const docs =
        typeof mapLimit === "function"
          ? await mapLimit(normalized, 6, async (h) => getDoc("Sales Invoice", h.name))
          : await (async () => {
              const out = [];
              for (const h of normalized) {
                // eslint-disable-next-line no-await-in-loop
                out.push(await getDoc("Sales Invoice", h.name));
              }
              return out;
            })();

      // Aggregators:
      // dayAgg: date -> totals + customers
      // itemAgg: (date||item_name) -> totals
      const dayAgg = new Map();   // date -> {date, docs, goodQty, damagedQty, totalQty, customers:Set}
      const itemAgg = new Map();  // key -> {date, item_name, goodQty, damagedQty, totalQty}

      let totalAll = 0;
      let totalGood = 0;
      let totalDamaged = 0;

      // 3) Aggregate
      for (const doc of docs || []) {
        const date = toYMD(doc?.posting_date);
        if (!date) continue;

        const cust = String(doc?.customer || "").trim();
        const its = Array.isArray(doc?.items) ? doc.items : [];

        if (!dayAgg.has(date)) {
          dayAgg.set(date, {
            date,
            docs: 0,
            goodQty: 0,
            damagedQty: 0,
            totalQty: 0,
            customers: new Set(),
          });
        }

        const d = dayAgg.get(date);
        d.docs += 1;
        if (cust) d.customers.add(cust);

        for (const it of its) {
          const item_code = it?.item_code;
          if (!item_code) continue;

          // Optional item filter: if selectedItems exists, only keep those
          if (selectedItems.length && !selectedItems.includes(item_code)) continue;

          // Sales return qty may be negative in ERPNext
          const qty = Math.abs(Number(it?.qty || 0)) || 0;
          if (!qty) continue;

          // Classify good vs damaged based on warehouse
          const wh = it?.warehouse || GOOD_WH;
          const isDamaged = wh === DAMAGED_WH;

          if (isDamaged) {
            d.damagedQty += qty;
            totalDamaged += qty;
          } else {
            d.goodQty += qty;
            totalGood += qty;
          }

          d.totalQty += qty;
          totalAll += qty;

          // Item name resolution:
          // 1) use row item_name if present
          // 2) else fallback to catalog map
          // 3) else item_code
          const nameFromRow = String(it?.item_name || "").trim();
          const item_name = nameFromRow || itemNameMap.get(item_code) || item_code;

          // Item-wise aggregate key
          const key = `${date}||${item_name}`;

          if (!itemAgg.has(key)) {
            itemAgg.set(key, { date, item_name, goodQty: 0, damagedQty: 0, totalQty: 0 });
          }

          const r = itemAgg.get(key);
          if (isDamaged) r.damagedQty += qty;
          else r.goodQty += qty;
          r.totalQty += qty;
        }
      }

      // 4) Build output arrays (sorted)
      const dayOut = Array.from(dayAgg.values())
        .sort((a, b) => toSortTs(b.date) - toSortTs(a.date))
        .map((x) => ({ ...x, customersText: joinAll(Array.from(x.customers)) }));

      const itemOut = Array.from(itemAgg.values()).sort((a, b) => {
        const td = toSortTs(b.date) - toSortTs(a.date);
        if (td !== 0) return td;
        return String(a.item_name || "").localeCompare(String(b.item_name || ""));
      });

      // 5) Save state
      setDayRows(dayOut);
      setItemRows(itemOut);
      setTotalQtyAll(totalAll);
      setTotalGoodAll(totalGood);
      setTotalDamagedAll(totalDamaged);
      setInfo("");
    } catch (e) {
      console.error(e);
      setErr(e?.response?.data?.error?.message || e?.message || "Failed to load summary");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, itemNameMap, selectedCompanies, selectedCustomers, selectedItems]);

  // initial load
  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="sales-return-summary">
      {/* Header */}
      <div className="sr-head">
        <div>
          <h2 className="sr-title">Sales Return Summary</h2>
          <div className="sr-subtitle">Date range + filters • Day-wise + Item-wise</div>
        </div>

        {/* Totals summary boxes */}
        <div className="sr-totals">
          <div className="sr-totalbox">
            <div className="sr-total-label">Total Qty</div>
            <div className="sr-total-value">{Number(totalQtyAll || 0).toFixed(2)}</div>
          </div>
          <div className="sr-totalbox">
            <div className="sr-total-label">Good Qty</div>
            <div className="sr-total-value">{Number(totalGoodAll || 0).toFixed(2)}</div>
          </div>
          <div className="sr-totalbox">
            <div className="sr-total-label">Damaged Qty</div>
            <div className="sr-total-value">{Number(totalDamagedAll || 0).toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="sr-filters">
        <div className="sr-filter">
          <label className="form-label">From Date</label>
          <input
            type="date"
            className="input"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="sr-filter">
          <label className="form-label">To Date</label>
          <input
            type="date"
            className="input"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Company rows */}
        <div className="sr-filter sr-filter-wide">
          <div className="sr-label-row">
            <label className="form-label">Company (optional)</label>
            <button
              type="button"
              className="sr-add-btn"
              onClick={() => addRow(setCompanyRows)}
              disabled={loading}
            >
              + Add
            </button>
          </div>

          <div className="sr-rows">
            {companyRows.map((val, idx) => (
              <div key={`co-${idx}`} className="sr-row">
                <SearchDropdown
                  options={companyOptions}
                  value={val}
                  onSelect={(v) => updateRow(setCompanyRows, idx, v)}
                  placeholder="Search company..."
                  disabled={loading}
                  searchKeys={["company_name", "abbr", "name"]}
                  getTitle={(o) => o.label}
                  getSub={(o) => o.sub}
                />

                <button
                  type="button"
                  className="sr-remove-btn"
                  onClick={() => removeRow(setCompanyRows, idx)}
                  disabled={loading}
                  title="Remove"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Customer rows */}
        <div className="sr-filter sr-filter-wide">
          <div className="sr-label-row">
            <label className="form-label">Customer (optional)</label>
            <button
              type="button"
              className="sr-add-btn"
              onClick={() => addRow(setCustomerRows)}
              disabled={loading}
            >
              + Add
            </button>
          </div>

          <div className="sr-rows">
            {customerRows.map((val, idx) => (
              <div key={`cu-${idx}`} className="sr-row">
                <SearchDropdown
                  options={customerOptions}
                  value={val}
                  onSelect={(v) => updateRow(setCustomerRows, idx, v)}
                  placeholder="Search customer..."
                  disabled={loading}
                  searchKeys={["customer_name", "name"]}
                  getTitle={(o) => o.label}
                  getSub={(o) => o.sub}
                />

                <button
                  type="button"
                  className="sr-remove-btn"
                  onClick={() => removeRow(setCustomerRows, idx)}
                  disabled={loading}
                  title="Remove"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Item rows */}
        <div className="sr-filter sr-filter-wide">
          <div className="sr-label-row">
            <label className="form-label">Item (optional)</label>
            <button
              type="button"
              className="sr-add-btn"
              onClick={() => addRow(setItemRowsFilter)}
              disabled={loading}
            >
              + Add
            </button>
          </div>

          <div className="sr-rows">
            {itemRowsFilter.map((val, idx) => (
              <div key={`it-${idx}`} className="sr-row">
                <SearchDropdown
                  options={itemOptions}
                  value={val}
                  onSelect={(v) => updateRow(setItemRowsFilter, idx, v)}
                  placeholder="Search item..."
                  disabled={loading}
                  searchKeys={["item_name", "name", "custom_asin"]}
                  getTitle={(o) => o.label}
                  getSub={(o) => o.sub}
                />

                <button
                  type="button"
                  className="sr-remove-btn"
                  onClick={() => removeRow(setItemRowsFilter, idx)}
                  disabled={loading}
                  title="Remove"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="sr-filter sr-filter-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadSummary} disabled={loading}>
            {loading ? "Loading..." : "Apply Filter"}
          </button>

          <button type="button" className="btn btn-light btn-sm" onClick={clearAllFilters} disabled={loading}>
            Clear All Filters
          </button>
        </div>
      </div>

      {/* Messages */}
      {err ? (
        <div className="alert alert-error" style={{ marginTop: 10 }}>
          {err}
        </div>
      ) : null}
      {info ? (
        <div className="text-muted" style={{ marginTop: 10 }}>
          {info}
        </div>
      ) : null}

      {/* Tabs */}
      <div className="sr-tabs">
        <button
          type="button"
          className={`sr-tab ${activeTab === "DAY" ? "is-active" : ""}`}
          onClick={() => setActiveTab("DAY")}
        >
          Day-wise Summary
        </button>

        <button
          type="button"
          className={`sr-tab ${activeTab === "ITEM" ? "is-active" : ""}`}
          onClick={() => setActiveTab("ITEM")}
        >
          Item-wise (Date-wise) Summary
        </button>
      </div>

      {/* DAY TAB */}
      {activeTab === "DAY" && (
        <div className="table-container" style={{ marginTop: 10 }}>
          <table className="table sr-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Returns</th>
                <th>Customers</th>
                <th>Good Qty</th>
                <th>Damaged Qty</th>
                <th>Total Qty</th>
              </tr>
            </thead>
            <tbody>
              {(dayRows || []).map((r) => (
                <tr key={r.date}>
                  <td>{r.date}</td>
                  <td>{r.docs}</td>
                  <td className="sr-customers-cell">{r.customersText}</td>
                  <td>{Number(r.goodQty || 0).toFixed(2)}</td>
                  <td>{Number(r.damagedQty || 0).toFixed(2)}</td>
                  <td>{Number(r.totalQty || 0).toFixed(2)}</td>
                </tr>
              ))}

              {!dayRows.length ? (
                <tr>
                  <td colSpan={6} className="text-muted" style={{ padding: 12 }}>
                    No rows.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {/* ITEM TAB */}
      {activeTab === "ITEM" && (
        <div className="table-container" style={{ marginTop: 10 }}>
          <table className="table sr-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Item</th>
                <th>Good Qty</th>
                <th>Damaged Qty</th>
                <th>Total Qty</th>
              </tr>
            </thead>
            <tbody>
              {(itemRows || []).map((r, idx) => (
                <tr key={`${r.date}||${r.item_name}||${idx}`}>
                  <td>{r.date}</td>
                  <td className="sr-item-cell">{r.item_name}</td>
                  <td>{Number(r.goodQty || 0).toFixed(2)}</td>
                  <td>{Number(r.damagedQty || 0).toFixed(2)}</td>
                  <td>{Number(r.totalQty || 0).toFixed(2)}</td>
                </tr>
              ))}

              {!itemRows.length ? (
                <tr>
                  <td colSpan={5} className="text-muted" style={{ padding: 12 }}>
                    No rows.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
