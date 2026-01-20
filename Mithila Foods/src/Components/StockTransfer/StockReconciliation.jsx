// src/StockReconciliation.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getItemsForBOM,          // reused API: gives item list for dropdown
  getWarehouses,           // warehouse list (not directly used in UI now, but used for company auto-pick)
  getBinForItemWarehouse,  // live current stock + valuation from Bin
  createDoc,               // create ERPNext document
  submitDoc,               // submit ERPNext document
  getCompanies,            // company list for company dropdown
} from "../erpBackendApi";
import "./StockReconciliation.css";

// Default warehouses (used to auto-fill warehouse based on item group)
const RAW_MATERIAL_WAREHOUSE = "Raw Material - MF";
const FINISHED_GOODS_WAREHOUSE = "Finished Goods - MF";

function StockReconciliation() {
  // Master data lists
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [companies, setCompanies] = useState([]);

  // Header fields
  const [company, setCompany] = useState("");

  // Default posting date = today (YYYY-MM-DD) in local timezone
  const [postingDate, setPostingDate] = useState(
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10)
  );

  // Line items (rows)
  const [rows, setRows] = useState([createEmptyRow(0)]);

  // UI state
  const [loadingInit, setLoadingInit] = useState(false); // loading master data
  const [saving, setSaving] = useState(false);           // creating/submitting document
  const [error, setError] = useState("");                // page-level error
  const [message, setMessage] = useState("");            // success message

  /*
    Creates a clean row object.
    Each row represents one item + warehouse with physical quantity.
  */
  function createEmptyRow(id) {
    return {
      id,
      item_code: "",
      warehouse: "",
      current_qty: "",
      new_qty: "",
      valuation_rate: "",
      loadingRow: false,
      rowError: "",
    };
  }

  /*
    Decide warehouse automatically from item_group.
    This reduces manual selection and forces a consistent warehouse selection.
  */
  function pickWarehouseForItemGroup(item) {
    const g = String(item?.item_group || "").toLowerCase();

    // Raw materials, packing material, etc.
    if (g.includes("raw material") || g.includes("pouch") || g.includes("sticker")) {
      return RAW_MATERIAL_WAREHOUSE;
    }

    // Finished goods / products
    if (g.includes("products") || g.includes("product")) {
      return FINISHED_GOODS_WAREHOUSE;
    }

    // If unknown group, keep blank (user will see "—")
    return "";
  }

  // ---------------------------------------------
  // Initial load: items + warehouses + companies
  // ---------------------------------------------
  useEffect(() => {
    async function load() {
      setLoadingInit(true);
      setError("");

      try {
        const [itemData, whData, companiesData] = await Promise.all([
          getItemsForBOM(),   // gives list of items (name, item_name, stock_uom, item_group, etc.)
          getWarehouses(),    // used for company auto-select fallback
          getCompanies(),     // for company dropdown
        ]);

        setItems(itemData || []);
        setWarehouses(whData || []);
        setCompanies(companiesData || []);

        // Auto-select company if possible:
        // 1) Only 1 company => pick it
        // 2) Else try to pick company from first warehouse
        if (!company) {
          if ((companiesData || []).length === 1) {
            setCompany(companiesData[0].name);
          } else if ((whData || []).length > 0) {
            setCompany(whData[0].company || "");
          }
        }
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load items / warehouses / companies");
      } finally {
        setLoadingInit(false);
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------
  // Load current stock + valuation rate for a row
  // Called whenever row item or warehouse changes
  // ---------------------------------------------
  async function refreshBinForRow(rowId, itemCode, warehouse) {
    // If either field is missing, clear related fields
    if (!itemCode || !warehouse) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? { ...r, current_qty: "", valuation_rate: "", rowError: "" }
            : r
        )
      );
      return;
    }

    // Show loading indicator for only this row
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, loadingRow: true, rowError: "" } : r
      )
    );

    try {
      const bin = await getBinForItemWarehouse(itemCode, warehouse);

      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                // Actual quantity from Bin
                current_qty: bin && bin.actual_qty != null ? String(bin.actual_qty) : "0",

                // Default new_qty to current_qty so user can adjust from real value
                new_qty: bin && bin.actual_qty != null ? String(bin.actual_qty) : "",

                // Valuation rate is stored in Bin; keep existing if Bin has no valuation_rate
                valuation_rate:
                  bin && bin.valuation_rate != null
                    ? String(bin.valuation_rate)
                    : r.valuation_rate,

                loadingRow: false,

                // If no bin record exists, show guidance (still allows user to enter qty)
                rowError: !bin ? "No Bin record (no stock yet)" : "",
              }
            : r
        )
      );
    } catch (err) {
      console.error(err);
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                loadingRow: false,
                rowError: err.message || "Failed to load current stock",
              }
            : r
        )
      );
    }
  }

  /*
    Generic row change handler for simple fields.
    Clears rowError when user edits.
  */
  function handleRowChange(rowId, field, value) {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, [field]: value, rowError: "" } : r))
    );
  }

  /*
    When item changes:
    1) Auto-choose warehouse based on item_group
    2) Fetch current stock + valuation from Bin if warehouse is found
  */
  function handleItemChange(rowId, itemCode) {
    const item = (items || []).find((x) => x.name === itemCode) || null;
    const autoWh = pickWarehouseForItemGroup(item);

    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? { ...r, item_code: itemCode, warehouse: autoWh, rowError: "" }
          : r
      )
    );

    if (itemCode && autoWh) {
      refreshBinForRow(rowId, itemCode, autoWh);
    }
  }

  /*
    Warehouse change handler.
    (UI currently shows warehouse as read-only, but this stays here if you enable dropdown later.)
  */
  function handleWarehouseChange(rowId, wh) {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, warehouse: wh, rowError: "" } : r))
    );

    const row = rows.find((r) => r.id === rowId);
    const itemCode = row ? row.item_code : "";

    if (itemCode && wh) {
      refreshBinForRow(rowId, itemCode, wh);
    }
  }

  // Add a new blank row
  function addRow() {
    setRows((prev) => [
      ...prev,
      createEmptyRow(prev.length ? prev[prev.length - 1].id + 1 : 0),
    ]);
  }

  // Remove a row by id
  function removeRow(rowId) {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  }

  // ---------------------------------------------
  // Submit: create Stock Reconciliation and submit it
  // ---------------------------------------------
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    // Basic validations
    if (!company) {
      setError("Company is required.");
      return;
    }

    if (!postingDate) {
      setError("Posting date is required.");
      return;
    }

    // Only include rows that are fully valid
    const validRows = rows.filter(
      (r) =>
        r.item_code &&
        r.warehouse && // must be auto-filled
        !isNaN(parseFloat(r.new_qty)) &&
        r.new_qty !== ""
    );

    if (!validRows.length) {
      setError("Add at least one row with item and new quantity (warehouse auto-fills).");
      return;
    }

    // ERPNext payload
    const payload = {
      doctype: "Stock Reconciliation",
      company,
      posting_date: postingDate,
      purpose: "Stock Reconciliation",
      items: validRows.map((r) => ({
        item_code: r.item_code,
        warehouse: r.warehouse,
        qty: parseFloat(r.new_qty), // physical count
        // Optional valuation rate
        valuation_rate: r.valuation_rate ? parseFloat(r.valuation_rate) : undefined,
      })),
    };

    try {
      setSaving(true);

      // 1) Create draft
      const doc = await createDoc("Stock Reconciliation", payload);
      const name = doc.data?.name;

      // 2) Submit if name exists
      if (name) {
        await submitDoc("Stock Reconciliation", name);
        setMessage(`Stock Reconciliation created and submitted: ${name}`);
      } else {
        setMessage("Stock Reconciliation created (no name returned).");
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          "Failed to create/submit Stock Reconciliation."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stock-recon">
      {/* Page header */}
      <div className="stock-recon-header">
        <div className="stock-recon-title-block">
          <h2 className="stock-recon-title">Stock Reconciliation</h2>
          <p className="stock-recon-subtitle">
            Adjust stock to match physical count across items & warehouses
          </p>
        </div>

        {/* Right side count */}
        <div className="stock-recon-pill">
          {rows.length} line item{rows.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Page messages */}
      {loadingInit && (
        <div className="stock-recon-loading text-muted">
          Loading items / warehouses...
        </div>
      )}
      {error && <div className="alert alert-error stock-recon-error">{error}</div>}
      {message && <div className="alert alert-success stock-recon-message">{message}</div>}

      {/* Main form */}
      <form onSubmit={handleSubmit} className="stock-recon-form">
        {/* Company + Posting Date */}
        <div className="stock-recon-form-grid">
          <div className="stock-recon-field-group">
            <label htmlFor="stock-recon-company" className="form-label stock-recon-field-label">
              Company
            </label>
            <select
              id="stock-recon-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="select"
            >
              <option value="">-- select company --</option>
              {companies.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.company_name || c.name} ({c.abbr})
                </option>
              ))}
            </select>
          </div>

          <div className="stock-recon-field-group">
            <label htmlFor="stock-recon-posting-date" className="form-label stock-recon-field-label">
              Posting Date
            </label>
            <input
              id="stock-recon-posting-date"
              type="date"
              value={postingDate}
              onChange={(e) => setPostingDate(e.target.value)}
              className="input"
            />
          </div>
        </div>

        {/* Items section header */}
        <div className="stock-recon-items-header">
          <h3 className="stock-recon-items-title">Items to Reconcile</h3>
          <button type="button" onClick={addRow} className="btn btn-accent btn-sm">
            + Add Item
          </button>
        </div>

        {/* Line item cards */}
        <div className="stock-recon-rows">
          {rows.map((row, index) => (
            <div key={row.id} className="stock-recon-row-card">
              <div className="stock-recon-row-header">
                <span className="stock-recon-row-title">
                  Line #{index + 1}
                  {row.item_code ? ` · ${row.item_code}` : ""}
                </span>

                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="btn btn-ghost btn-sm"
                >
                  Remove
                </button>
              </div>

              <div className="stock-recon-row-grid">
                {/* Item dropdown (searchable) */}
                <div className="stock-recon-row-field">
                  <label className="form-label">Item</label>
                  <ItemSearchDropdown
                    items={items}
                    value={row.item_code}
                    onSelect={(code) => handleItemChange(row.id, code)}
                    placeholder="Search item name / code..."
                  />
                </div>

                {/* Auto-picked warehouse (read-only) */}
                <div className="stock-recon-row-field">
                  <label className="form-label">Warehouse</label>
                  <input value={row.warehouse || "—"} readOnly className="input input-readonly" />
                </div>

                {/* Current stock from Bin */}
                <div className="stock-recon-row-field">
                  <label className="form-label">Current Qty</label>
                  <input value={row.current_qty} readOnly className="input input-readonly" />
                </div>

                {/* Physical stock count */}
                <div className="stock-recon-row-field">
                  <label className="form-label">New (Physical) Qty</label>
                  <input
                    type="number"
                    value={row.new_qty}
                    min="0"
                    onChange={(e) => handleRowChange(row.id, "new_qty", e.target.value)}
                    className="input"
                  />
                </div>

                {/* Valuation rate (optional) */}
                <div className="stock-recon-row-field">
                  <label className="form-label">Valuation Rate</label>
                  <input
                    type="number"
                    value={row.valuation_rate}
                    onChange={(e) => handleRowChange(row.id, "valuation_rate", e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              {/* Per-row loading/error */}
              {(row.loadingRow || row.rowError) && (
                <div className="stock-recon-row-footer">
                  {row.loadingRow && (
                    <span className="stock-recon-row-loading text-muted">
                      Loading current stock...
                    </span>
                  )}
                  {row.rowError && <span className="stock-recon-row-error">{row.rowError}</span>}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Submit button */}
        <div className="stock-recon-submit-row">
          <button type="submit" disabled={saving || loadingInit} className="btn btn-primary">
            {saving ? "Reconciling..." : "Create Stock Reconciliation"}
          </button>
        </div>
      </form>
    </div>
  );
}

/*
  ItemSearchDropdown (same idea as StockTransfer)
  - Click to open
  - Shows all items initially
  - Search inside to filter by code or name
*/
function ItemSearchDropdown({ items, value, onSelect, placeholder }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  // Selected item object for display
  const selected = useMemo(() => {
    return items.find((x) => x.name === value) || null;
  }, [items, value]);

  // Filter items based on search text
  const filtered = useMemo(() => {
    const s = (q || "").trim().toLowerCase();
    const base = !s
      ? items
      : items.filter((it) => {
          const code = (it.name || "").toLowerCase();
          const name = (it.item_name || "").toLowerCase();
          return code.includes(s) || name.includes(s);
        });

    // Limit results for performance
    return base.slice(0, 80);
  }, [items, q]);

  // Close dropdown if clicked outside
  useEffect(() => {
    function onDown(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="stdrop" ref={ref}>
      <button
        type="button"
        className={`stdrop-control ${open ? "is-open" : ""}`}
        onClick={() =>
          setOpen((v) => {
            const next = !v;
            // When opening, clear search so user sees full list first
            if (next) setQ("");
            return next;
          })
        }
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

export default StockReconciliation;
