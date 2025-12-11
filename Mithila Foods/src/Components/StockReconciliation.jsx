// src/StockReconciliation.jsx
import React, { useEffect, useState } from "react";
import {
  getItemsForBOM, // we reuse this to list items
  getWarehouses,
  getBinForItemWarehouse,
  createDoc,
  submitDoc,
  getCompanies,
} from "./erpBackendApi";
import "../CSS/StockReconciliation.css";

function StockReconciliation() {
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [companies, setCompanies] = useState([]);

  const [company, setCompany] = useState("");
  const [postingDate, setPostingDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [rows, setRows] = useState([createEmptyRow(0)]);

  const [loadingInit, setLoadingInit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

  // Load items + warehouses + companies on mount
  useEffect(() => {
    async function load() {
      setLoadingInit(true);
      setError("");
      try {
        const [itemData, whData, companiesData] = await Promise.all([
          getItemsForBOM(),
          getWarehouses(),
          getCompanies(),
        ]);

        setItems(itemData);
        setWarehouses(whData);
        setCompanies(companiesData);

        // auto-select company if possible
        if (!company) {
          if (companiesData.length === 1) {
            setCompany(companiesData[0].name);
          } else if (whData.length > 0) {
            setCompany(whData[0].company || "");
          }
        }
      } catch (err) {
        console.error(err);
        setError(
          err.message || "Failed to load items / warehouses / companies"
        );
      } finally {
        setLoadingInit(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When item or warehouse changes in a row, fetch current qty + valuation
  async function refreshBinForRow(rowId, itemCode, warehouse) {
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
                current_qty:
                  bin && bin.actual_qty != null ? String(bin.actual_qty) : "0",
                // default new_qty to current_qty initially
                new_qty:
                  bin && bin.actual_qty != null ? String(bin.actual_qty) : "",
                valuation_rate:
                  bin && bin.valuation_rate != null
                    ? String(bin.valuation_rate)
                    : r.valuation_rate,
                loadingRow: false,
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

  function handleRowChange(rowId, field, value) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, [field]: value, rowError: "" } : r
      )
    );
  }

  function handleItemChange(rowId, itemCode) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, item_code: itemCode, rowError: "" } : r
      )
    );
    const row = rows.find((r) => r.id === rowId);
    const wh = row ? row.warehouse : "";
    if (itemCode && wh) {
      refreshBinForRow(rowId, itemCode, wh);
    }
  }

  function handleWarehouseChange(rowId, wh) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, warehouse: wh, rowError: "" } : r
      )
    );
    const row = rows.find((r) => r.id === rowId);
    const itemCode = row ? row.item_code : "";
    if (itemCode && wh) {
      refreshBinForRow(rowId, itemCode, wh);
    }
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!company) {
      setError("Company is required.");
      return;
    }

    if (!postingDate) {
      setError("Posting date is required.");
      return;
    }

    const validRows = rows.filter(
      (r) =>
        r.item_code &&
        r.warehouse &&
        !isNaN(parseFloat(r.new_qty)) &&
        r.new_qty !== ""
    );

    if (!validRows.length) {
      setError("Add at least one row with item, warehouse and new quantity.");
      return;
    }

    const payload = {
      doctype: "Stock Reconciliation",
      company,
      posting_date: postingDate,
      purpose: "Stock Reconciliation",
      items: validRows.map((r) => ({
        item_code: r.item_code,
        warehouse: r.warehouse,
        qty: parseFloat(r.new_qty), // physical count
        valuation_rate: r.valuation_rate
          ? parseFloat(r.valuation_rate)
          : undefined,
      })),
    };

    try {
      setSaving(true);

      // 1) Create draft
      const doc = await createDoc("Stock Reconciliation", payload);
      const name = doc.data?.name;

      if (name) {
        // 2) Submit it
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
      {/* Header */}
      <div className="stock-recon-header">
        <div className="stock-recon-title-block">
          <h2 className="stock-recon-title">Stock Reconciliation</h2>
          <p className="stock-recon-subtitle">
            Adjust stock to match physical count across items & warehouses
          </p>
        </div>
        <div className="stock-recon-pill">
          {rows.length} line item{rows.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Messages */}
      {loadingInit && (
        <div className="stock-recon-loading text-muted">
          Loading items / warehouses...
        </div>
      )}
      {error && (
        <div className="alert alert-error stock-recon-error">
          {error}
        </div>
      )}
      {message && (
        <div className="alert alert-success stock-recon-message">
          {message}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="stock-recon-form">
        {/* Top fields */}
        <div className="stock-recon-form-grid">
          <div className="stock-recon-field-group">
            <label
              htmlFor="stock-recon-company"
              className="form-label stock-recon-field-label"
            >
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
            <label
              htmlFor="stock-recon-posting-date"
              className="form-label stock-recon-field-label"
            >
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

        <div className="stock-recon-items-header">
          <h3 className="stock-recon-items-title">Items to Reconcile</h3>
          <button
            type="button"
            onClick={addRow}
            className="btn btn-accent btn-sm"
          >
            + Add Item
          </button>
        </div>

        {/* Rows */}
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
                {/* SEARCHABLE ITEM FIELD */}
                <div className="stock-recon-row-field">
                  <label className="form-label">Item</label>
                  <input
                    list={`stock-recon-item-list-${row.id}`}
                    value={row.item_code}
                    onChange={(e) =>
                      handleItemChange(row.id, e.target.value)
                    }
                    className="input stock-recon-item-input"
                    placeholder="Type or select item code"
                  />
                  <datalist id={`stock-recon-item-list-${row.id}`}>
                    {items.map((it) => (
                      <option
                        key={it.name}
                        value={it.name}
                        label={`${it.name} - ${it.item_name}`}
                      />
                    ))}
                  </datalist>
                </div>

                <div className="stock-recon-row-field">
                  <label className="form-label">Warehouse</label>
                  <select
                    value={row.warehouse}
                    onChange={(e) =>
                      handleWarehouseChange(row.id, e.target.value)
                    }
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

                <div className="stock-recon-row-field">
                  <label className="form-label">Current Qty</label>
                  <input
                    value={row.current_qty}
                    readOnly
                    className="input input-readonly"
                  />
                </div>

                <div className="stock-recon-row-field">
                  <label className="form-label">New (Physical) Qty</label>
                  <input
                    type="number"
                    value={row.new_qty}
                    onChange={(e) =>
                      handleRowChange(row.id, "new_qty", e.target.value)
                    }
                    className="input"
                  />
                </div>

                <div className="stock-recon-row-field">
                  <label className="form-label">Valuation Rate</label>
                  <input
                    type="number"
                    value={row.valuation_rate}
                    onChange={(e) =>
                      handleRowChange(row.id, "valuation_rate", e.target.value)
                    }
                    className="input"
                  />
                </div>
              </div>

              {(row.loadingRow || row.rowError) && (
                <div className="stock-recon-row-footer">
                  {row.loadingRow && (
                    <span className="stock-recon-row-loading text-muted">
                      Loading current stock...
                    </span>
                  )}
                  {row.rowError && (
                    <span className="stock-recon-row-error">
                      {row.rowError}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="stock-recon-submit-row">
          <button
            type="submit"
            disabled={saving || loadingInit}
            className="btn btn-primary"
          >
            {saving ? "Reconciling..." : "Create Stock Reconciliation"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default StockReconciliation;
