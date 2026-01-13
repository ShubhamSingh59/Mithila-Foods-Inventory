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
          {rows.length} line{rows.length !== 1 ? "s" : ""} • {company || "No company"}
        </div>
      </div>

      {loadingInit && (
        <p className="text-muted opening-stock-loading">
          Loading items, price lists...
        </p>
      )}
      {error && <p className="alert alert-error">{error}</p>}
      {message && <p className="alert alert-success">{message}</p>}

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
    </div>
  );
}

export default OpeningStockEntry;
