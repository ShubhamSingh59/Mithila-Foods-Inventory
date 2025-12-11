// src/Components/BomCreateForm.jsx
import React, { useEffect, useState } from "react";
import {
  getItemsForBOM,
  getPriceLists,
  getItemRateFromPriceList,
  getItemLastPurchaseRate,
  createBOM,
  submitDoc,
  getFinishedItems,
  getItemWarehouseValuationRate,
  getCompanies,              // 👈 NEW import
} from "./erpBackendApi";
import "../CSS/BomCreateForm.css";

const RAW_WAREHOUSE = "Raw Material - MF";

const BASIS_OPTIONS = [
  { value: "valuation", label: "Valuation Rate" },
  { value: "price_list", label: "Price List" },
  { value: "last_purchase", label: "Last Purchase Rate" },
];

function createEmptyRow(id) {
  return {
    id,
    item_code: "",
    uom: "",
    qty: "1",
    basis: "valuation",
    price_list: "",
    rate: "",
    loadingRate: false,
    rowError: "",
  };
}

function BomCreateForm() {
  const [items, setItems] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [finishedItems, setFinishedItems] = useState([]);
  const [companies, setCompanies] = useState([]);      // 👈 NEW
  const [finishedItem, setFinishedItem] = useState("");
  const [finishedQty, setFinishedQty] = useState("1");
  const [company, setCompany] = useState("");

  const [rows, setRows] = useState([createEmptyRow(0)]);

  const [loadingInit, setLoadingInit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Load items + price lists + finished items + companies
  useEffect(() => {
    async function load() {
      setLoadingInit(true);
      setError("");

      try {
        const [
          itemData,
          plData,
          finishedItemData,
          companyData,                 // 👈 NEW
        ] = await Promise.all([
          getItemsForBOM(),            // all items (raw materials)
          getPriceLists(),
          getFinishedItems(),          // ONLY Products group
          getCompanies(),              // 👈 all companies
        ]);

        setItems(itemData);
        setPriceLists(plData);
        setFinishedItems(finishedItemData);
        setCompanies(companyData || []);

        if (finishedItemData.length > 0) {
          setFinishedItem(finishedItemData[0].name);
        }

        if (companyData && companyData.length > 0) {
          setCompany(companyData[0].name); // default to first company
        }
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load items / price lists / companies");
      } finally {
        setLoadingInit(false);
      }
    }

    load();
  }, []);

  function handleFinishedItemChange(e) {
    setFinishedItem(e.target.value);
  }

  function handleRowItemChange(rowId, itemCode) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const item = items.find((it) => it.name === itemCode);
        return {
          ...r,
          item_code: itemCode,
          uom: item ? item.stock_uom : "",
          rate:
            r.basis === "valuation" && item && item.valuation_rate != null
              ? String(item.valuation_rate)
              : r.rate,
          rowError: "",
        };
      })
    );
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
      if (row.basis === "valuation") {
        // 1) try Item.valuation_rate first
        if (item && item.valuation_rate != null && item.valuation_rate > 0) {
          updated.rate = String(item.valuation_rate);
        } else {
          // 2) fall back to Bin valuation (per warehouse)
          const bin = await getItemWarehouseValuationRate(
            row.item_code,
            RAW_WAREHOUSE
          );

          if (bin && bin.valuation_rate != null && bin.valuation_rate > 0) {
            updated.rate = String(bin.valuation_rate);
          } else {
            updated.rowError = "No valuation rate on Item or Bin";
          }
        }
      } else if (row.basis === "price_list") {
        const pl = row.price_list || (priceLists[0] && priceLists[0].name);
        if (!pl) {
          updated.rowError = "No price list selected";
        } else {
          updated.price_list = pl;
          const priceRow = await getItemRateFromPriceList(row.item_code, pl);
          if (!priceRow || priceRow.price_list_rate == null) {
            updated.rowError = "No rate in that price list";
          } else {
            updated.rate = String(priceRow.price_list_rate);
          }
        }
      } else if (row.basis === "last_purchase") {
        const pr = await getItemLastPurchaseRate(row.item_code);
        if (!pr || pr.rate == null) {
          updated.rowError = "No last purchase rate";
        } else {
          updated.rate = String(pr.rate);
        }
      }
    } catch (err) {
      console.error(err);
      updated.rowError = err.message || "Failed to fetch rate";
    }

    updated.loadingRate = false;
    return updated;
  }

  async function handleBasisChange(rowId, newBasis) {
    let targetRow;
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const updated = { ...r, basis: newBasis };
        targetRow = updated;
        return updated;
      })
    );

    if (!targetRow) return;
    const updated = await fetchRateForRow(targetRow);
    setRows((prev) => prev.map((r) => (r.id === rowId ? updated : r)));
  }

  async function handlePriceListChange(rowId, priceList) {
    let targetRow;
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const updated = { ...r, price_list: priceList };
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

    if (!finishedItem) {
      setError("Select finished item.");
      return;
    }
    const fgQtyNum = parseFloat(finishedQty);
    if (isNaN(fgQtyNum) || fgQtyNum <= 0) {
      setError("Enter valid finished quantity.");
      return;
    }
    if (!company) {
      setError("Select company.");
      return;
    }

    const validRows = rows.filter((r) => r.item_code && parseFloat(r.qty) > 0);
    if (!validRows.length) {
      setError("Add at least one raw material row with qty.");
      return;
    }

    const bomItems = validRows.map((r) => ({
      doctype: "BOM Item",
      item_code: r.item_code,
      qty: parseFloat(r.qty),
      uom: r.uom || undefined,
      rate: r.rate ? parseFloat(r.rate) : undefined,
    }));

    const payload = {
      doctype: "BOM",
      item: finishedItem,
      quantity: fgQtyNum,
      company,
      is_active: 1,
      is_default: 0,
      items: bomItems,
    };

    try {
      setSaving(true);
      // 1) create BOM (draft)
      const doc = await createBOM(payload);
      const name = doc.data?.name;

      // 2) submit BOM if we got a name
      if (name) {
        await submitDoc("BOM", name);
        setMessage(`BOM created and submitted: ${name}`);
      } else {
        setMessage("BOM created (no name returned).");
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          "Failed to create/submit BOM"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bom-create">
      <div className="bom-create-header-row">
        <div className="bom-create-header">
          <h2 className="bom-create-title">Create Material List</h2>
          <p className="bom-create-subtitle">
            Define finished item, company and raw material breakdown
          </p>
        </div>
        <div className="bom-create-pill">
          {rows.length} raw material row{rows.length !== 1 ? "s" : ""}
        </div>
      </div>

      {loadingInit && (
        <p className="bom-create-loading text-muted">Loading items...</p>
      )}
      {error && <p className="alert alert-error">{error}</p>}
      {message && <p className="alert alert-success">{message}</p>}

      <form onSubmit={handleSubmit} className="bom-create-form">
        {/* Top grid */}
        <div className="bom-create-top-grid">
          {/* Finished item with searchable datalist */}
          <div className="field-group">
            <label className="form-label">Finished Item</label>
            <input
              list="finished-items-list"
              value={finishedItem}
              onChange={handleFinishedItemChange}
              className="input"
              placeholder="Type or select finished item code"
            />
            <datalist id="finished-items-list">
              {finishedItems.map((it) => (
                <option
                  key={it.name}
                  value={it.name}
                  label={`${it.name} - ${it.item_name}`}
                />
              ))}
            </datalist>
          </div>

          <div className="field-group">
            <label className="form-label">Finished Quantity</label>
            <input
              type="number"
              value={finishedQty}
              onChange={(e) => setFinishedQty(e.target.value)}
              className="input"
            />
          </div>

          {/* Company dropdown */}
          <div className="field-group">
            <label className="form-label">Company</label>
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="select"
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
        </div>

        {/* Raw materials */}
        <div className="bom-create-raw-header-row">
          <h3 className="bom-create-raw-title">Raw Materials</h3>
          <button
            type="button"
            onClick={addRow}
            className="btn btn-accent btn-sm"
          >
            + Add Raw Material
          </button>
        </div>

        <div className="bom-create-rows">
          {rows.map((row, index) => (
            <div key={row.id} className="bom-row-card">
              <div className="bom-row-header">
                <span className="bom-row-title">Row #{index + 1}</span>
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="btn btn-ghost btn-sm"
                >
                  Remove
                </button>
              </div>

              <div className="bom-row-grid">
                <div className="field-group">
                  <label className="form-label">Item</label>
                  <select
                    value={row.item_code}
                    onChange={(e) =>
                      handleRowItemChange(row.id, e.target.value)
                    }
                    className="select"
                  >
                    <option value="">-- select item --</option>
                    {items.map((it) => (
                      <option key={it.name} value={it.name}>
                        {it.name} - {it.item_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-group">
                  <label className="form-label">Unit</label>
                  <input
                    value={row.uom}
                    readOnly
                    className="input input-readonly"
                  />
                </div>

                <div className="field-group">
                  <label className="form-label">Qty</label>
                  <input
                    type="number"
                    value={row.qty}
                    onChange={(e) =>
                      handleRowFieldChange(row.id, "qty", e.target.value)
                    }
                    className="input"
                  />
                </div>

                <div className="field-group">
                  <label className="form-label">Rate Based On</label>
                  <select
                    value={row.basis}
                    onChange={(e) =>
                      handleBasisChange(row.id, e.target.value)
                    }
                    className="select"
                  >
                    {BASIS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {row.basis === "price_list" && (
                  <div className="field-group">
                    <label className="form-label">Price List</label>
                    <select
                      value={row.price_list}
                      onChange={(e) =>
                        handlePriceListChange(row.id, e.target.value)
                      }
                      className="select"
                    >
                      <option value="">-- select price list --</option>
                      {priceLists.map((pl) => (
                        <option key={pl.name} value={pl.name}>
                          {pl.price_list_name || pl.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="field-group">
                  <label className="form-label">Rate</label>
                  <div className="bom-row-rate-wrapper">
                    <input
                      value={row.loadingRate ? "Loading..." : row.rate}
                      onChange={(e) =>
                        handleRowFieldChange(row.id, "rate", e.target.value)
                      }
                      className="input"
                    />
                    <button
                      type="button"
                      onClick={() => handleRefreshRate(row.id)}
                      className="btn btn-outline btn-sm bom-row-rate-btn"
                    >
                      Auto-Fetch
                    </button>
                  </div>
                </div>
              </div>

              {(row.loadingRate || row.rowError) && (
                <div className="bom-row-footer">
                  {row.loadingRate && (
                    <span className="text-muted">Fetching rate…</span>
                  )}
                  {row.rowError && (
                    <span className="bom-row-error">{row.rowError}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="bom-create-submit-row">
          <button
            type="submit"
            disabled={saving || loadingInit}
            className="btn btn-primary"
          >
            {saving ? "Creating BOM..." : "Create BOM"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default BomCreateForm;
