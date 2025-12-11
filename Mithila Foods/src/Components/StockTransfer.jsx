// src/StockTransfer.jsx
import React, { useEffect, useState } from "react";
import {
  getFinishedItems,
  getWarehouses,
  getBinForItemWarehouse,
  createDoc,
  submitDoc,
  getCompanies, // 👈 NEW
} from "./erpBackendApi";
import "../CSS/StockTransfer.css";

function StockTransfer() {
  const [finishedItems, setFinishedItems] = useState([]);
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

  // load finished items + warehouses + companies
  useEffect(() => {
    async function load() {
      setLoadingInit(true);
      setError("");

      try {
        const [itemsData, whData, companiesData] = await Promise.all([
          getFinishedItems(),
          getWarehouses(),
          getCompanies(),
        ]);

        setFinishedItems(itemsData);
        setWarehouses(whData);
        setCompanies(companiesData);

        // if not set yet, try to auto-fill company
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
  }, []); // run once

  // refresh current qty for a row when item or fromWarehouse changes
  async function refreshBinForRow(rowId, itemCode, sourceWh) {
    if (!itemCode || !sourceWh) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? { ...r, current_qty: "", uom: "", rowError: "" }
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
      const item = finishedItems.find((it) => it.name === itemCode);

      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                current_qty:
                  bin && bin.actual_qty != null ? String(bin.actual_qty) : "0",
                uom: item ? item.stock_uom : "",
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

  function handleItemChange(rowId, itemCode) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, item_code: itemCode, rowError: "" } : r
      )
    );
    if (itemCode && fromWarehouse) {
      refreshBinForRow(rowId, itemCode, fromWarehouse);
    }
  }

  function handleQtyChange(rowId, value) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, qty: value, rowError: "" } : r
      )
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
    // when fromWarehouse changes, refresh bin for each row that has item_code
    rows.forEach((row) => {
      if (row.item_code && value) {
        refreshBinForRow(row.id, row.item_code, value);
      }
    });
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

    if (!fromWarehouse || !toWarehouse) {
      setError("Select both From and To warehouse.");
      return;
    }

    if (fromWarehouse === toWarehouse) {
      setError("From and To warehouse cannot be same.");
      return;
    }

    const validRows = rows.filter(
      (r) =>
        r.item_code && !isNaN(parseFloat(r.qty)) && parseFloat(r.qty) > 0
    );

    if (!validRows.length) {
      setError("Add at least one item with quantity.");
      return;
    }

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
        setMessage(
          `Stock Entry (Material Transfer) created and submitted: ${name}`
        );
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
      {/* Header */}
      <div className="stock-transfer-header">
        <div className="stock-transfer-title-block">
          <h2 className="stock-transfer-title">
            Stock Transfer (Finished Goods - Products)
          </h2>
          <p className="stock-transfer-subtitle">
            Move finished products between warehouses with live stock info
          </p>
        </div>
        <div className="stock-transfer-pill">
          {rows.length} line item{rows.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Messages */}
      {loadingInit && (
        <div className="stock-transfer-loading text-muted">
          Loading items / warehouses...
        </div>
      )}
      {error && (
        <div className="alert alert-error stock-transfer-error">
          {error}
        </div>
      )}
      {message && (
        <div className="alert alert-success stock-transfer-message">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="stock-transfer-form">
        {/* Top form grid */}
        <div className="stock-transfer-form-grid">
          <div className="stock-transfer-field-group">
            <label
              htmlFor="stock-transfer-company"
              className="form-label stock-transfer-field-label"
            >
              Company
            </label>
            <select
              id="stock-transfer-company"
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
            <label
              htmlFor="stock-transfer-posting-date"
              className="form-label stock-transfer-field-label"
            >
              Posting Date
            </label>
            <input
              id="stock-transfer-posting-date"
              type="date"
              value={postingDate}
              onChange={(e) => setPostingDate(e.target.value)}
              className="input"
            />
          </div>

          <div className="stock-transfer-field-group">
            <label
              htmlFor="stock-transfer-from-wh"
              className="form-label stock-transfer-field-label"
            >
              From Warehouse
            </label>
            <select
              id="stock-transfer-from-wh"
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
            <label
              htmlFor="stock-transfer-to-wh"
              className="form-label stock-transfer-field-label"
            >
              To Warehouse
            </label>
            <select
              id="stock-transfer-to-wh"
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

        {/* Items header */}
        <div className="stock-transfer-items-header">
          <h3 className="stock-transfer-items-title">
            Items (Finished Goods - Products)
          </h3>
          <button
            type="button"
            onClick={addRow}
            className="btn btn-accent btn-sm"
          >
            + Add Item
          </button>
        </div>

        {/* Rows */}
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
                {/* 🔍 SEARCHABLE ITEM FIELD */}
                <div className="stock-transfer-row-field">
                  <label className="form-label">Item</label>
                  <input
                    list={`stock-transfer-item-list-${row.id}`}
                    value={row.item_code}
                    onChange={(e) =>
                      handleItemChange(row.id, e.target.value)
                    }
                    className="input stock-transfer-item-input"
                    placeholder="Type or select finished item"
                  />
                  <datalist id={`stock-transfer-item-list-${row.id}`}>
                    {finishedItems.map((it) => (
                      <option
                        key={it.name}
                        value={it.name}
                        label={`${it.name} - ${it.item_name}`}
                      />
                    ))}
                  </datalist>
                </div>

                <div className="stock-transfer-row-field">
                  <label className="form-label">Unit</label>
                  <input
                    value={row.uom}
                    readOnly
                    className="input input-readonly"
                  />
                </div>

                <div className="stock-transfer-row-field">
                  <label className="form-label">
                    Current Qty in From Warehouse
                  </label>
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
                    onChange={(e) =>
                      handleQtyChange(row.id, e.target.value)
                    }
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
                    <span className="stock-transfer-row-error">
                      {row.rowError}
                    </span>
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

export default StockTransfer;
