//// src/Components/OpeningStockEntry.jsx
//import React, { useEffect, useState } from "react";
//import {
//  getItemsForBOM,              // 👈 use this instead of getAllItems
//  getPriceLists,
//  getItemRateFromPriceList,
//  getItemWarehouseValuationRate,
//  getCompanies,
//  getWarehouses,
//  createDoc,
//  submitDoc,
//} from "./erpBackendApi";
//import "../CSS/OpeningStockEntry.css";

//const DEFAULT_WH = "Raw Material - MF";
//const DEFAULT_DIFFERENCE_ACCOUNT = "Temporary Opening - MF";

//const BASIS_OPTIONS = [
//  { value: "valuation", label: "Valuation Rate" },
//  { value: "price_list", label: "Price List" },
//];

//function createEmptyRow(id) {
//  return {
//    id,
//    item_code: "",
//    item_name: "",
//    warehouse: DEFAULT_WH,
//    uom: "",
//    qty: "",
//    basis: "valuation",
//    price_list: "",
//    rate: "",
//    loadingRate: false,
//    rowError: "",
//  };
//}

//function OpeningStockEntry() {
//  const [items, setItems] = useState([]);
//  const [priceLists, setPriceLists] = useState([]);
//  const [companies, setCompanies] = useState([]);
//  const [warehouses, setWarehouses] = useState([]);

//  const [company, setCompany] = useState("");
//  const [postingDate, setPostingDate] = useState(
//    new Date().toISOString().slice(0, 10)
//  );

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
//        const [itemData, plData, companyData, warehouseData] = await Promise.all(
//          [
//            getItemsForBOM(),   // 👈 returns name, item_name, stock_uom, valuation_rate
//            getPriceLists(),
//            getCompanies(),
//            getWarehouses(),
//          ]
//        );

//        setItems(itemData || []);
//        setPriceLists(plData || []);
//        setCompanies(companyData || []);
//        setWarehouses(warehouseData || []);

//        if (companyData && companyData.length > 0) {
//          setCompany(companyData[0].name);
//        }
//      } catch (err) {
//        console.error(err);
//        setError(
//          err.message ||
//          "Failed to load items / price lists / companies / warehouses"
//        );
//      } finally {
//        setLoadingInit(false);
//      }
//    }
//    init();
//  }, []);

//  // row helpers

//  function addRow() {
//    setRows((prev) => [
//      ...prev,
//      createEmptyRow(prev.length ? prev[prev.length - 1].id + 1 : 0),
//    ]);
//  }

//  function removeRow(rowId) {
//    setRows((prev) => prev.filter((r) => r.id !== rowId));
//  }

//  function handleRowFieldChange(rowId, field, value) {
//    setRows((prev) =>
//      prev.map((r) => (r.id === rowId ? { ...r, [field]: value, rowError: "" } : r))
//    );
//  }

//  // When item changes, set item_code, item_name, and UOM from item.stock_uom
//  function handleRowItemChange(rowId, itemCode) {
//    const item = items.find((it) => it.name === itemCode);
//    const uom =
//      item?.stock_uom || item?.uom || item?.default_uom || ""; // 👈 extra fallbacks

//    setRows((prev) =>
//      prev.map((r) =>
//        r.id === rowId
//          ? {
//            ...r,
//            item_code: itemCode,
//            item_name: item ? item.item_name : "",
//            uom,
//            rowError: "",
//          }
//          : r
//      )
//    );
//  }

//  async function fetchRateForRow(row) {
//    if (!row.item_code) return row;

//    const item = items.find((it) => it.name === row.item_code);
//    const updated = { ...row, loadingRate: true, rowError: "" };

//    try {
//      if (row.basis === "valuation") {
//        // 1) Item.valuation_rate
//        if (item && item.valuation_rate != null && item.valuation_rate > 0) {
//          updated.rate = String(item.valuation_rate);
//        } else {
//          // 2) Bin valuation (per warehouse)
//          const wh = row.warehouse || DEFAULT_WH;
//          const bin = await getItemWarehouseValuationRate(row.item_code, wh);
//          if (bin && bin.valuation_rate != null && bin.valuation_rate > 0) {
//            updated.rate = String(bin.valuation_rate);
//          } else {
//            updated.rowError = "No valuation rate on Item or Bin";
//          }
//        }
//      } else if (row.basis === "price_list") {
//        const pl = row.price_list || (priceLists[0] && priceLists[0].name);
//        if (!pl) {
//          updated.rowError = "No price list selected";
//        } else {
//          updated.price_list = pl;
//          const priceRow = await getItemRateFromPriceList(row.item_code, pl);
//          if (!priceRow || priceRow.price_list_rate == null) {
//            updated.rowError = "No rate in that price list";
//          } else {
//            updated.rate = String(priceRow.price_list_rate);
//          }
//        }
//      }
//    } catch (err) {
//      console.error(err);
//      updated.rowError = err.message || "Failed to fetch rate";
//    }

//    updated.loadingRate = false;
//    return updated;
//  }

//  async function handleBasisChange(rowId, newBasis) {
//    let targetRow;
//    setRows((prev) =>
//      prev.map((r) => {
//        if (r.id !== rowId) return r;
//        const updated = { ...r, basis: newBasis };
//        targetRow = updated;
//        return updated;
//      })
//    );

//    if (!targetRow) return;
//    const updated = await fetchRateForRow(targetRow);
//    setRows((prev) => prev.map((r) => (r.id === rowId ? updated : r)));
//  }

//  async function handlePriceListChange(rowId, plName) {
//    let targetRow;
//    setRows((prev) =>
//      prev.map((r) => {
//        if (r.id !== rowId) return r;
//        const updated = { ...r, price_list: plName };
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

//  // submit

//  async function handleSubmit(e) {
//    e.preventDefault();
//    setError("");
//    setMessage("");

//    if (!company) {
//      setError("Company is required.");
//      return;
//    }
//    if (!postingDate) {
//      setError("Posting date is required.");
//      return;
//    }

//    const validRows = rows.filter(
//      (r) =>
//        r.item_code &&
//        r.warehouse &&
//        !isNaN(parseFloat(r.qty)) &&
//        parseFloat(r.qty) >= 0
//    );

//    if (!validRows.length) {
//      setError("Add at least one row with item, warehouse and quantity.");
//      return;
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
//      difference_account: DEFAULT_DIFFERENCE_ACCOUNT, // correct field for Opening
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
//      setError(
//        err.response?.data?.error?.message ||
//        err.message ||
//        "Failed to create/submit Stock Reconciliation"
//      );
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
//            Create opening stock using Stock Reconciliation (per item & warehouse)
//          </p>
//        </div>
//        <div className="opening-stock-pill">
//          {rows.length} line{rows.length !== 1 ? "s" : ""} •{" "}
//          {company || "No company"}
//        </div>
//      </div>

//      {loadingInit && (
//        <p className="text-muted opening-stock-loading">
//          Loading items, price lists & warehouses...
//        </p>
//      )}
//      {error && <p className="alert alert-error">{error}</p>}
//      {message && <p className="alert alert-success">{message}</p>}

//      <form onSubmit={handleSubmit} className="opening-stock-form">
//        {/* top controls */}
//        <div className="opening-stock-top-grid">
//          <div className="field-group">
//            <label className="form-label">Company</label>
//            <select
//              value={company}
//              onChange={(e) => setCompany(e.target.value)}
//              className="select"
//            >
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

//        {/* datalists for searchables */}
//        <datalist id="opening-stock-item-list">
//          {items.map((it) => (
//            <option
//              key={it.name}
//              value={it.name}
//              label={`${it.name} - ${it.item_name}`}
//            />
//          ))}
//        </datalist>

//        <datalist id="opening-stock-warehouse-list">
//          {warehouses.map((wh) => (
//            <option
//              key={wh.name}
//              value={wh.name}
//              label={wh.warehouse_name || wh.name}
//            />
//          ))}
//        </datalist>

//        {/* rows header + add button */}
//        <div className="opening-stock-rows-header">
//          <h3 className="opening-stock-rows-title">Items</h3>
//          <button
//            type="button"
//            onClick={addRow}
//            className="btn btn-accent btn-sm"
//          >
//            + Add Item
//          </button>
//        </div>

//        {/* rows table */}
//        <div className="table-container opening-stock-table-wrapper">
//          <table className="table opening-stock-table">
//            <thead>
//              <tr>
//                <th>Item</th>
//                <th>Item Name</th>
//                <th>Warehouse</th>
//                <th>Unit</th>
//                <th>Qty</th>
//                <th>Rate Based On</th>
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
//                    <input
//                      className="input opening-stock-item-input"
//                      list="opening-stock-item-list"
//                      value={row.item_code}
//                      onChange={(e) =>
//                        handleRowItemChange(row.id, e.target.value)
//                      }
//                      placeholder="Type or select item"
//                    />
//                  </td>

//                  {/* Item name (auto) */}
//                  <td>{row.item_name}</td>

//                  {/* Warehouse: searchable */}
//                  <td>
//                    <input
//                      className="input opening-stock-warehouse-input"
//                      list="opening-stock-warehouse-list"
//                      value={row.warehouse}
//                      onChange={(e) =>
//                        handleRowFieldChange(
//                          row.id,
//                          "warehouse",
//                          e.target.value
//                        )
//                      }
//                      placeholder={DEFAULT_WH}
//                    />
//                  </td>

//                  {/* UOM from item */}
//                  <td>{row.uom}</td>

//                  {/* Qty */}
//                  <td>
//                    <input
//                      type="number"
//                      value={row.qty}
//                      onChange={(e) =>
//                        handleRowFieldChange(row.id, "qty", e.target.value)
//                      }
//                      className="input"
//                    />
//                  </td>

//                  {/* Rate basis */}
//                  <td>
//                    <select
//                      value={row.basis}
//                      onChange={(e) =>
//                        handleBasisChange(row.id, e.target.value)
//                      }
//                      className="select"
//                    >
//                      {BASIS_OPTIONS.map((opt) => (
//                        <option key={opt.value} value={opt.value}>
//                          {opt.label}
//                        </option>
//                      ))}
//                    </select>
//                  </td>

//                  {/* Price list (only if basis = price_list) */}
//                  <td>
//                    {row.basis === "price_list" ? (
//                      <select
//                        value={row.price_list}
//                        onChange={(e) =>
//                          handlePriceListChange(row.id, e.target.value)
//                        }
//                        className="select"
//                      >
//                        <option value="">-- select price list --</option>
//                        {priceLists.map((pl) => (
//                          <option key={pl.name} value={pl.name}>
//                            {pl.price_list_name || pl.name}
//                          </option>
//                        ))}
//                      </select>
//                    ) : (
//                      <span className="text-muted">N/A</span>
//                    )}
//                  </td>

//                  {/* Rate + auto button */}
//                  <td>
//                    <div className="opening-stock-rate-cell">
//                      <input
//                        value={row.loadingRate ? "Loading..." : row.rate}
//                        onChange={(e) =>
//                          handleRowFieldChange(row.id, "rate", e.target.value)
//                        }
//                        className="input"
//                      />
//                      <button
//                        type="button"
//                        className="btn btn-outline btn-sm opening-stock-rate-btn"
//                        onClick={() => handleRefreshRate(row.id)}
//                      >
//                        Auto
//                      </button>
//                    </div>
//                    {row.rowError && (
//                      <div className="opening-stock-row-error">
//                        {row.rowError}
//                      </div>
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
//                  <td colSpan={9} className="text-muted">
//                    No rows added yet.
//                  </td>
//                </tr>
//              )}
//            </tbody>
//          </table>
//        </div>

//        <div className="opening-stock-submit-row">
//          <button
//            type="submit"
//            disabled={saving || loadingInit}
//            className="btn btn-primary"
//          >
//            {saving ? "Saving..." : "Create Opening Stock"}
//          </button>
//        </div>
//      </form>
//    </div>
//  );
//}

//export default OpeningStockEntry;
// src/Components/OpeningStockEntry.jsx
import React, { useEffect, useState } from "react";
import {
  getItemsForBOM,              // 👈 use this instead of getAllItems
  getPriceLists,
  getItemRateFromPriceList,
  getItemWarehouseValuationRate,
  getCompanies,
  getWarehouses,
  createDoc,
  submitDoc,
} from "./erpBackendApi";
import "../CSS/OpeningStockEntry.css";

const DEFAULT_WH = "Raw Material - MF";
// ✅ use the NON-group child account here
const DEFAULT_DIFFERENCE_ACCOUNT = "Temporary Opening - MF";

const BASIS_OPTIONS = [
  { value: "valuation", label: "Valuation Rate" },
  { value: "price_list", label: "Price List" },
];

function createEmptyRow(id) {
  return {
    id,
    item_code: "",
    item_name: "",
    warehouse: DEFAULT_WH,
    uom: "",
    qty: "",
    basis: "valuation",
    price_list: "",
    rate: "",
    loadingRate: false,
    rowError: "",
  };
}

function OpeningStockEntry() {
  const [items, setItems] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const [company, setCompany] = useState("");
  const [postingDate, setPostingDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

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
        const [itemData, plData, companyData, warehouseData] = await Promise.all(
          [
            getItemsForBOM(),   // returns name, item_name, stock_uom, valuation_rate
            getPriceLists(),
            getCompanies(),
            getWarehouses(),
          ]
        );

        setItems(itemData || []);
        setPriceLists(plData || []);
        setCompanies(companyData || []);
        setWarehouses(warehouseData || []);

        if (companyData && companyData.length > 0) {
          setCompany(companyData[0].name);
        }
      } catch (err) {
        console.error(err);
        setError(
          err.message ||
            "Failed to load items / price lists / companies / warehouses"
        );
      } finally {
        setLoadingInit(false);
      }
    }
    init();
  }, []);

  // row helpers

  function addRow() {
    setRows((prev) => [
      ...prev,
      createEmptyRow(prev.length ? prev[prev.length - 1].id + 1 : 0),
    ]);
  }

  function removeRow(rowId) {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  }

  function handleRowFieldChange(rowId, field, value) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, [field]: value, rowError: "" } : r
      )
    );
  }

  // When item changes, set item_code, item_name, and UOM from item.stock_uom
  function handleRowItemChange(rowId, itemCode) {
    const item = items.find((it) => it.name === itemCode);
    const uom =
      item?.stock_uom || item?.uom || item?.default_uom || ""; // extra fallbacks

    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              item_code: itemCode,
              item_name: item ? item.item_name : "",
              uom,
              rowError: "",
            }
          : r
      )
    );
  }

  async function fetchRateForRow(row) {
    if (!row.item_code) return row;

    const item = items.find((it) => it.name === row.item_code);
    const updated = { ...row, loadingRate: true, rowError: "" };

    try {
      if (row.basis === "valuation") {
        // 1) Item.valuation_rate
        if (item && item.valuation_rate != null && item.valuation_rate > 0) {
          updated.rate = String(item.valuation_rate);
        } else {
          // 2) Bin valuation (per warehouse)
          const wh = row.warehouse || DEFAULT_WH;
          const bin = await getItemWarehouseValuationRate(row.item_code, wh);
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

  async function handlePriceListChange(rowId, plName) {
    let targetRow;
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const updated = { ...r, price_list: plName };
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

  // submit

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
        !isNaN(parseFloat(r.qty)) &&
        parseFloat(r.qty) >= 0
    );

    if (!validRows.length) {
      setError("Add at least one row with item, warehouse and quantity.");
      return;
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
      // ✅ this is the field ERPNext actually uses
      expense_account: DEFAULT_DIFFERENCE_ACCOUNT,
      is_opening: "Yes", // opening entry
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
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          "Failed to create/submit Stock Reconciliation"
      );
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
            Create opening stock using Stock Reconciliation (per item & warehouse)
          </p>
        </div>
        <div className="opening-stock-pill">
          {rows.length} line{rows.length !== 1 ? "s" : ""} •{" "}
          {company || "No company"}
        </div>
      </div>

      {loadingInit && (
        <p className="text-muted opening-stock-loading">
          Loading items, price lists & warehouses...
        </p>
      )}
      {error && <p className="alert alert-error">{error}</p>}
      {message && <p className="alert alert-success">{message}</p>}

      <form onSubmit={handleSubmit} className="opening-stock-form">
        {/* top controls */}
        <div className="opening-stock-top-grid">
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

        {/* datalists for searchables */}
        <datalist id="opening-stock-item-list">
          {items.map((it) => (
            <option
              key={it.name}
              value={it.name}
              label={`${it.name} - ${it.item_name}`}
            />
          ))}
        </datalist>

        <datalist id="opening-stock-warehouse-list">
          {warehouses.map((wh) => (
            <option
              key={wh.name}
              value={wh.name}
              label={wh.warehouse_name || wh.name}
            />
          ))}
        </datalist>

        {/* rows header + add button */}
        <div className="opening-stock-rows-header">
          <h3 className="opening-stock-rows-title">Items</h3>
          <button
            type="button"
            onClick={addRow}
            className="btn btn-accent btn-sm"
          >
            + Add Item
          </button>
        </div>

        {/* rows table */}
        <div className="table-container opening-stock-table-wrapper">
          <table className="table opening-stock-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Item Name</th>
                <th>Warehouse</th>
                <th>Unit</th>
                <th>Qty</th>
                <th>Rate Based On</th>
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
                    <input
                      className="input opening-stock-item-input"
                      list="opening-stock-item-list"
                      value={row.item_code}
                      onChange={(e) =>
                        handleRowItemChange(row.id, e.target.value)
                      }
                      placeholder="Type or select item"
                    />
                  </td>

                  {/* Item name (auto) */}
                  <td>{row.item_name}</td>

                  {/* Warehouse: searchable */}
                  <td>
                    <input
                      className="input opening-stock-warehouse-input"
                      list="opening-stock-warehouse-list"
                      value={row.warehouse}
                      onChange={(e) =>
                        handleRowFieldChange(row.id, "warehouse", e.target.value)
                      }
                      placeholder={DEFAULT_WH}
                    />
                  </td>

                  {/* UOM from item */}
                  <td>{row.uom}</td>

                  {/* Qty */}
                  <td>
                    <input
                      type="number"
                      value={row.qty}
                      onChange={(e) =>
                        handleRowFieldChange(row.id, "qty", e.target.value)
                      }
                      className="input"
                    />
                  </td>

                  {/* Rate basis */}
                  <td>
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
                  </td>

                  {/* Price list (only if basis = price_list) */}
                  <td>
                    {row.basis === "price_list" ? (
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
                    ) : (
                      <span className="text-muted">N/A</span>
                    )}
                  </td>

                  {/* Rate + auto button */}
                  <td>
                    <div className="opening-stock-rate-cell">
                      <input
                        value={row.loadingRate ? "Loading..." : row.rate}
                        onChange={(e) =>
                          handleRowFieldChange(row.id, "rate", e.target.value)
                        }
                        className="input"
                      />
                      <button
                        type="button"
                        className="btn btn-outline btn-sm opening-stock-rate-btn"
                        onClick={() => handleRefreshRate(row.id)}
                      >
                        Auto
                      </button>
                    </div>
                    {row.rowError && (
                      <div className="opening-stock-row-error">
                        {row.rowError}
                      </div>
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
                  <td colSpan={9} className="text-muted">
                    No rows added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="opening-stock-submit-row">
          <button
            type="submit"
            disabled={saving || loadingInit}
            className="btn btn-primary"
          >
            {saving ? "Saving..." : "Create Opening Stock"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default OpeningStockEntry;
