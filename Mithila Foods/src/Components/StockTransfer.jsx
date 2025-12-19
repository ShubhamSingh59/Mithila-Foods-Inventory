// src/StockTransfer.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getDoctypeList,          // ✅ use generic list to fetch ALL items
  getWarehouses,
  getBinForItemWarehouse,
  createDoc,
  submitDoc,
  getCompanies,
} from "./erpBackendApi";
import "../CSS/StockTransfer.css";

function StockTransfer() {
  const [items, setItems] = useState([]);          // ✅ all items
  const [warehouses, setWarehouses] = useState([]);
  const [companies, setCompanies] = useState([]);

  const [company, setCompany] = useState("");
  const [postingDate, setPostingDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [fromWarehouse, setFromWarehouse] = useState("");
  const [toWarehouse, setToWarehouse] = useState("");

  const [rows, setRows] = useState([createEmptyRow(0)]);

  const [loadingInit, setLoadingInit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

  // ✅ load ALL items + warehouses + companies
  useEffect(() => {
    async function load() {
      setLoadingInit(true);
      setError("");

      try {
        const [itemsData, whData, companiesData] = await Promise.all([
          getDoctypeList("Item", {
            fields: JSON.stringify(["name", "item_name", "stock_uom", "disabled"]),
            filters: JSON.stringify([["Item", "disabled", "=", 0]]),
            limit_page_length: 5000,
            order_by: "modified desc",
          }),
          getWarehouses(),
          getCompanies(),
        ]);

        setItems(itemsData || []);
        setWarehouses(whData || []);
        setCompanies(companiesData || []);

        // auto company
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

  // refresh current qty for a row when item or fromWarehouse changes
  async function refreshBinForRow(rowId, itemCode, sourceWh) {
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

    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, loadingRow: true, rowError: "" } : r
      )
    );

    try {
      const bin = await getBinForItemWarehouse(itemCode, sourceWh);
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                current_qty:
                  bin && bin.actual_qty != null ? String(bin.actual_qty) : "0",
                loadingRow: false,
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

    if (itemCode && fromWarehouse) {
      refreshBinForRow(rowId, itemCode, fromWarehouse);
    }
  }

  function handleQtyChange(rowId, value) {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, qty: value, rowError: "" } : r))
    );
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      createEmptyRow(prev.length ? prev[prev.length - 1].id + 1 : 0),
    ]);
  }

  function removeRow(rowId) {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  }

  function handleFromWarehouseChange(value) {
    setFromWarehouse(value);

    // refresh bins for already selected items
    rows.forEach((row) => {
      if (row.item_code && value) {
        refreshBinForRow(row.id, row.item_code, value);
      }
      if (!value) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id ? { ...r, current_qty: "" } : r
          )
        );
      }
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!company) return setError("Company is required.");
    if (!postingDate) return setError("Posting date is required.");
    if (!fromWarehouse || !toWarehouse)
      return setError("Select both From and To warehouse.");
    if (fromWarehouse === toWarehouse)
      return setError("From and To warehouse cannot be same.");

    const validRows = rows.filter(
      (r) => r.item_code && !isNaN(parseFloat(r.qty)) && parseFloat(r.qty) > 0
    );

    if (!validRows.length) return setError("Add at least one item with quantity.");

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
      const doc = await createDoc("Stock Entry", payload);
      const name = doc.data?.name;

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
      <div className="stock-transfer-header">
        <div className="stock-transfer-title-block">
          <h2 className="stock-transfer-title">Stock Transfer (Any Item)</h2>
          <p className="stock-transfer-subtitle">
            Move any item between warehouses with live stock info
          </p>
        </div>
        <div className="stock-transfer-pill">
          {rows.length} line item{rows.length !== 1 ? "s" : ""}
        </div>
      </div>

      {loadingInit && (
        <div className="stock-transfer-loading text-muted">
          Loading items / warehouses...
        </div>
      )}
      {error && <div className="alert alert-error stock-transfer-error">{error}</div>}
      {message && (
        <div className="alert alert-success stock-transfer-message">{message}</div>
      )}

      <form onSubmit={handleSubmit} className="stock-transfer-form">
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

        <div className="stock-transfer-items-header">
          <h3 className="stock-transfer-items-title">Items</h3>
          <button type="button" onClick={addRow} className="btn btn-accent btn-sm">
            + Add Item
          </button>
        </div>

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
                  <input
                    value={row.current_qty}
                    readOnly
                    className="input input-readonly"
                  />
                </div>

                <div className="stock-transfer-row-field">
                  <label className="form-label">Transfer Qty</label>
                  <input
                    type="number"
                    value={row.qty}
                    onChange={(e) => handleQtyChange(row.id, e.target.value)}
                    className="input"
                  />
                </div>
              </div>

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

function ItemSearchDropdown({ items, value, onSelect, placeholder }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  const selected = useMemo(() => {
    return items.find((x) => x.name === value) || null;
  }, [items, value]);

  const filtered = useMemo(() => {
    const s = (q || "").trim().toLowerCase();
    const base = !s
      ? items
      : items.filter((it) => {
          const code = (it.name || "").toLowerCase();
          const name = (it.item_name || "").toLowerCase();
          return code.includes(s) || name.includes(s);
        });

    return base.slice(0, 80); // keep dropdown fast
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
    <div className="stdrop" ref={ref}>
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

export default StockTransfer;
