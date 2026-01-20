// src/StockTransfer.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getDoctypeList,          // use generic list to fetch items
  getWarehouses,           // fetch warehouse list
  getBinForItemWarehouse,  // fetch live stock (Bin) for item + warehouse
  createDoc,               // create ERPNext document (Stock Entry)
  submitDoc,               // submit ERPNext document (docstatus = 1)
  getCompanies,            // fetch companies list
} from "../erpBackendApi";
import "./StockTransfer.css";

function StockTransfer() {
  // Master data lists used in dropdowns
  const [items, setItems] = useState([]);          // all items
  const [warehouses, setWarehouses] = useState([]); // all warehouses
  const [companies, setCompanies] = useState([]);   // all companies

  // Header form fields
  const [company, setCompany] = useState("");

  // Default posting date = today in YYYY-MM-DD (local date)
  const [postingDate, setPostingDate] = useState(
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10)
  );

  // Warehouses for transfer
  const [fromWarehouse, setFromWarehouse] = useState("");
  const [toWarehouse, setToWarehouse] = useState("");

  // Line items for transfer
  const [rows, setRows] = useState([createEmptyRow(0)]);

  // UI state
  const [loadingInit, setLoadingInit] = useState(false); // loading master data
  const [saving, setSaving] = useState(false);           // creating/submitting entry
  const [error, setError] = useState("");                // page level error
  const [message, setMessage] = useState("");            // success message

  // Create a blank row structure (used for Add Item and initial row)
  function createEmptyRow(id) {
    return {
      id,
      item_code: "",
      current_qty: "",
      qty: "",
      uom: "",
      loadingRow: false,
      rowError: "",
    };
  }

  // ---------------------------------------------
  // Initial load: items + warehouses + companies
  // ---------------------------------------------
  useEffect(() => {
    async function load() {
      setLoadingInit(true);
      setError("");

      try {
        const [itemsData, whData, companiesData] = await Promise.all([
          // Load all active (not disabled) items
          getDoctypeList("Item", {
            fields: JSON.stringify(["name", "item_name", "stock_uom", "disabled"]),
            filters: JSON.stringify([["Item", "disabled", "=", 0]]),
            limit_page_length: 5000,
            order_by: "modified desc",
          }),
          // Load warehouses (non-group warehouses in your helper)
          getWarehouses(),
          // Load companies
          getCompanies(),
        ]);

        setItems(itemsData || []);
        setWarehouses(whData || []);
        setCompanies(companiesData || []);

        // Auto-select company to reduce manual work
        // 1) If only one company exists, select it
        // 2) Else try using first warehouse company as default
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
  // Fetch current stock (Bin) for a row
  // Runs when item changes or fromWarehouse changes
  // ---------------------------------------------
  async function refreshBinForRow(rowId, itemCode, sourceWh) {
    // If item or warehouse not selected, clear current qty and row errors
    if (!itemCode || !sourceWh) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? { ...r, current_qty: "", rowError: "", loadingRow: false }
            : r
        )
      );
      return;
    }

    // Show loading state for only this row
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, loadingRow: true, rowError: "" } : r
      )
    );

    try {
      // Bin gives actual_qty in that warehouse
      const bin = await getBinForItemWarehouse(itemCode, sourceWh);

      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                // If no bin exists, show 0
                current_qty:
                  bin && bin.actual_qty != null ? String(bin.actual_qty) : "0",
                loadingRow: false,
                // If bin is missing, show a helpful message
                rowError: !bin ? "No Bin (no stock yet)" : "",
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
                rowError: err.message || "Failed to load stock",
              }
            : r
        )
      );
    }
  }

  // When user picks an item, fill item_code + uom and refresh stock for that row
  function handleSelectItem(rowId, itemCode) {
    const it = items.find((x) => x.name === itemCode);

    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              item_code: itemCode,
              uom: it?.stock_uom || "",
              rowError: "",
            }
          : r
      )
    );

    // If from warehouse already selected, fetch current stock
    if (itemCode && fromWarehouse) {
      refreshBinForRow(rowId, itemCode, fromWarehouse);
    }
  }

  // Update transfer quantity for one row
  function handleQtyChange(rowId, value) {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, qty: value, rowError: "" } : r))
    );
  }

  // Add a new row to the list
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

  // When from warehouse changes, refresh current stock for every selected row item
  function handleFromWarehouseChange(value) {
    setFromWarehouse(value);

    rows.forEach((row) => {
      // If an item is selected, reload Bin from the new warehouse
      if (row.item_code && value) {
        refreshBinForRow(row.id, row.item_code, value);
      }

      // If warehouse was cleared, clear current_qty
      if (!value) {
        setRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, current_qty: "" } : r))
        );
      }
    });
  }

  // ---------------------------------------------
  // Submit: create Stock Entry (Material Transfer) and submit it
  // ---------------------------------------------
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    // Basic validations
    if (!company) return setError("Company is required.");
    if (!postingDate) return setError("Posting date is required.");
    if (!fromWarehouse || !toWarehouse)
      return setError("Select both From and To warehouse.");
    if (fromWarehouse === toWarehouse)
      return setError("From and To warehouse cannot be same.");

    // Only keep rows that have item and qty > 0
    const validRows = rows.filter(
      (r) => r.item_code && !isNaN(parseFloat(r.qty)) && parseFloat(r.qty) > 0
    );

    if (!validRows.length) return setError("Add at least one item with quantity.");

    // ERPNext Stock Entry payload
    const payload = {
      doctype: "Stock Entry",
      stock_entry_type: "Material Transfer",
      company,
      posting_date: postingDate,
      items: validRows.map((r) => ({
        item_code: r.item_code,
        qty: parseFloat(r.qty),
        s_warehouse: fromWarehouse,
        t_warehouse: toWarehouse,
      })),
    };

    try {
      setSaving(true);

      // Create draft Stock Entry
      const doc = await createDoc("Stock Entry", payload);
      const name = doc.data?.name;

      // Submit if we got a document name
      if (name) {
        await submitDoc("Stock Entry", name);
        setMessage(`Stock Entry (Material Transfer) created and submitted: ${name}`);
      } else {
        setMessage("Stock Entry created (no name returned).");
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          "Failed to create/submit Stock Entry."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stock-transfer">
      {/* Page header */}
      <div className="stock-transfer-header">
        <div className="stock-transfer-title-block">
          <h2 className="stock-transfer-title">Stock Transfer (Any Item)</h2>
          <p className="stock-transfer-subtitle">
            Move any item between warehouses with live stock info
          </p>
        </div>

        {/* Small count text on right side */}
        <div className="stock-transfer-pill">
          {rows.length} line item{rows.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Page level messages */}
      {loadingInit && (
        <div className="stock-transfer-loading text-muted">
          Loading items / warehouses...
        </div>
      )}
      {error && <div className="alert alert-error stock-transfer-error">{error}</div>}
      {message && (
        <div className="alert alert-success stock-transfer-message">{message}</div>
      )}

      {/* Main form */}
      <form onSubmit={handleSubmit} className="stock-transfer-form">
        {/* Top header fields */}
        <div className="stock-transfer-form-grid">
          <div className="stock-transfer-field-group">
            <label className="form-label stock-transfer-field-label">Company</label>
            <select
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

          <div className="stock-transfer-field-group">
            <label className="form-label stock-transfer-field-label">Posting Date</label>
            <input
              type="date"
              value={postingDate}
              onChange={(e) => setPostingDate(e.target.value)}
              className="input"
            />
          </div>

          <div className="stock-transfer-field-group">
            <label className="form-label stock-transfer-field-label">From Warehouse</label>
            <select
              value={fromWarehouse}
              onChange={(e) => handleFromWarehouseChange(e.target.value)}
              className="select"
            >
              <option value="">-- select warehouse --</option>
              {warehouses.map((wh) => (
                <option key={wh.name} value={wh.name}>
                  {wh.name}
                </option>
              ))}
            </select>
          </div>

          <div className="stock-transfer-field-group">
            <label className="form-label stock-transfer-field-label">To Warehouse</label>
            <select
              value={toWarehouse}
              onChange={(e) => setToWarehouse(e.target.value)}
              className="select"
            >
              <option value="">-- select warehouse --</option>
              {warehouses.map((wh) => (
                <option key={wh.name} value={wh.name}>
                  {wh.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Items section header */}
        <div className="stock-transfer-items-header">
          <h3 className="stock-transfer-items-title">Items</h3>
          <button type="button" onClick={addRow} className="btn btn-accent btn-sm">
            + Add Item
          </button>
        </div>

        {/* Line item cards */}
        <div className="stock-transfer-rows">
          {rows.map((row, index) => (
            <div key={row.id} className="stock-transfer-row-card">
              <div className="stock-transfer-row-header">
                <span className="stock-transfer-row-title">
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

              <div className="stock-transfer-row-grid">
                <div className="stock-transfer-row-field">
                  <label className="form-label">Item</label>
                  <ItemSearchDropdown
                    items={items}
                    value={row.item_code}
                    onSelect={(code) => handleSelectItem(row.id, code)}
                    placeholder="Search item name / code..."
                  />
                </div>

                <div className="stock-transfer-row-field">
                  <label className="form-label">Unit</label>
                  <input value={row.uom} readOnly className="input input-readonly" />
                </div>

                <div className="stock-transfer-row-field">
                  <label className="form-label">Current Qty in From Warehouse</label>
                  <input value={row.current_qty} readOnly className="input input-readonly" />
                </div>

                <div className="stock-transfer-row-field">
                  <label className="form-label">Transfer Qty</label>
                  <input
                    type="number"
                    min="0"
                    value={row.qty}
                    onChange={(e) => handleQtyChange(row.id, e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              {/* Per-row loading or error */}
              {(row.loadingRow || row.rowError) && (
                <div className="stock-transfer-row-footer">
                  {row.loadingRow && (
                    <span className="stock-transfer-row-loading text-muted">
                      Loading stock...
                    </span>
                  )}
                  {row.rowError && (
                    <span className="stock-transfer-row-error">{row.rowError}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Submit button */}
        <div className="stock-transfer-submit-row">
          <button
            type="submit"
            disabled={saving || loadingInit}
            className="btn btn-primary"
          >
            {saving ? "Transferring..." : "Create Stock Transfer"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------
// ItemSearchDropdown
// A custom searchable dropdown to pick an item.
// It shows item code + item name + UOM.
// ---------------------------------------------
function ItemSearchDropdown({ items, value, onSelect, placeholder }) {
  const [open, setOpen] = useState(false); // dropdown open/close
  const [q, setQ] = useState("");          // search text inside dropdown
  const ref = useRef(null);                // wrapper ref for outside click close

  // Selected item object (used to display current value)
  const selected = useMemo(() => {
    return items.find((x) => x.name === value) || null;
  }, [items, value]);

  // Filter items list by typed query
  const filtered = useMemo(() => {
    const s = (q || "").trim().toLowerCase();

    const base = !s
      ? items
      : items.filter((it) => {
          const code = (it.name || "").toLowerCase();
          const name = (it.item_name || "").toLowerCase();
          return code.includes(s) || name.includes(s);
        });

    // Limit results to keep dropdown fast
    return base.slice(0, 80);
  }, [items, q]);

  // Close dropdown if user clicks outside the control
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
      {/* Main control button */}
      <button
        type="button"
        className={`stdrop-control ${open ? "is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="stdrop-value">
          {selected ? (
            <>
              <div className="stdrop-title">{selected.name}</div>
              <div className="stdrop-sub">
                {selected.item_name || ""}{" "}
                {selected.stock_uom ? `· ${selected.stock_uom}` : ""}
              </div>
            </>
          ) : (
            <div className="stdrop-placeholder">{placeholder}</div>
          )}
        </div>
        <div className="stdrop-caret">▾</div>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="stdrop-popover">
          {/* Search field inside dropdown */}
          <div className="stdrop-search">
            <input
              autoFocus
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type to search..."
            />
          </div>

          {/* Scrollable result list */}
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

            {/* Empty state + hint */}
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

export default StockTransfer;
