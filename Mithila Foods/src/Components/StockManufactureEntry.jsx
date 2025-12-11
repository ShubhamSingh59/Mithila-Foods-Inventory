//// src/StockManufactureEntry.jsx
//import React, { useEffect, useState } from "react";
//import {
//  getBoms,
//  getBomDocWithItems,
//  createDoc,
//  submitDoc,
//  getFinishedItems,
//  getCompanies,
//} from "./erpBackendApi";
//import "../CSS/StockManufactureEntry.css";

//const SOURCE_WH = "Raw Material - MF";
//const TARGET_WH = "Finished Goods - MF";

//function StockManufactureEntry() {
//  const [boms, setBoms] = useState([]);
//  const [finishedItems, setFinishedItems] = useState([]);
//  const [companies, setCompanies] = useState([]);

//  const [finishedItem, setFinishedItem] = useState("");
//  const [selectedBomName, setSelectedBomName] = useState("");
//  const [company, setCompany] = useState("");

//  const [fgQty, setFgQty] = useState("1");

//  const [bomItemsBase, setBomItemsBase] = useState([]);
//  const [rows, setRows] = useState([]);

//  const [loadingBoms, setLoadingBoms] = useState(false);
//  const [loadingItems, setLoadingItems] = useState(false);
//  const [saving, setSaving] = useState(false);

//  const [error, setError] = useState("");
//  const [message, setMessage] = useState("");

//  // helper: scale BOM items according to fgQty
//  function scaleRowsFromBom(items, finishedQty, bomQty) {
//    const fg = parseFloat(finishedQty);
//    const bq = parseFloat(bomQty);
//    const ratio = !isNaN(fg) && fg > 0 && !isNaN(bq) && bq > 0 ? fg / bq : 1;

//    return items.map((it, idx) => ({
//      id: it.name || idx,
//      item_code: it.item_code,
//      item_name: it.item_name,
//      uom: it.uom,
//      qty: (parseFloat(it.qty) || 0) * ratio,
//    }));
//  }

//  // load BOM doc + child items and scale by quantity
//  async function loadBomDocAndRows(bomName, finishedQty, bomQty) {
//    if (!bomName) return;
//    setLoadingItems(true);
//    setError("");
//    try {
//      const bomDoc = await getBomDocWithItems(bomName);
//      const items = bomDoc.items || [];
//      setBomItemsBase(items);
//      const scaled = scaleRowsFromBom(items, finishedQty, bomQty);
//      setRows(scaled);
//    } catch (err) {
//      console.error(err);
//      setError(err.message || "Failed to load BOM items");
//    } finally {
//      setLoadingItems(false);
//    }
//  }

//  // load BOMs + finished items + companies at start
//  useEffect(() => {
//    async function init() {
//      setLoadingBoms(true);
//      setError("");
//      try {
//        const [bomData, finishedItemData, companiesData] = await Promise.all([
//          getBoms(),
//          getFinishedItems(),
//          getCompanies(),
//        ]);

//        setBoms(bomData);
//        setFinishedItems(finishedItemData);
//        setCompanies(companiesData);

//        // default finished item = first Products item (if any)
//        let defaultFinishedItem = finishedItemData[0]?.name || "";
//        if (defaultFinishedItem) {
//          setFinishedItem(defaultFinishedItem);
//        }

//        // find first BOM for that finished item
//        let firstBom =
//          bomData.find((b) => b.item === defaultFinishedItem) || bomData[0];

//        if (firstBom) {
//          setSelectedBomName(firstBom.name);
//          const defaultCompany =
//            firstBom.company ||
//            (companiesData.length > 0 ? companiesData[0].name : "");
//          setCompany(defaultCompany);
//          await loadBomDocAndRows(firstBom.name, fgQty, firstBom.quantity);
//        } else if (!company && companiesData.length > 0) {
//          setCompany(companiesData[0].name);
//        }
//      } catch (err) {
//        console.error(err);
//        setError(
//          err.message ||
//            "Failed to load BOMs / finished items / companies"
//        );
//      } finally {
//        setLoadingBoms(false);
//      }
//    }

//    init();
//  }, []); // run once

//  // list of BOMs filtered by selected finished item
//  const filteredBoms = finishedItem
//    ? boms.filter((b) => b.item === finishedItem)
//    : boms;

//  async function handleFinishedItemChange(e) {
//    const itemCode = e.target.value;
//    setFinishedItem(itemCode);
//    setMessage("");
//    setError("");

//    // when finished item changes, pick first BOM for that item
//    const bomForItem = boms.find((b) => b.item === itemCode);
//    if (!bomForItem) {
//      setSelectedBomName("");
//      setBomItemsBase([]);
//      setRows([]);
//      return;
//    }

//    setSelectedBomName(bomForItem.name);

//    if (bomForItem.company) {
//      setCompany(bomForItem.company);
//    }

//    await loadBomDocAndRows(bomForItem.name, fgQty, bomForItem.quantity);
//  }

//  async function handleBomChange(e) {
//    const name = e.target.value;
//    setSelectedBomName(name);
//    setMessage("");
//    setError("");

//    const bom = boms.find((b) => b.name === name);
//    if (!bom) {
//      setBomItemsBase([]);
//      setRows([]);
//      return;
//    }

//    // keep finishedItem in sync with the BOM's item
//    if (bom.item && bom.item !== finishedItem) {
//      setFinishedItem(bom.item);
//    }

//    if (bom.company) {
//      setCompany(bom.company);
//    }

//    await loadBomDocAndRows(bom.name, fgQty, bom.quantity);
//  }

//  function handleFgQtyChange(e) {
//    const value = e.target.value;
//    setFgQty(value);
//    setMessage("");
//    setError("");

//    const bom = boms.find((b) => b.name === selectedBomName);
//    if (!bom) return;

//    const scaled = scaleRowsFromBom(bomItemsBase, value, bom.quantity);
//    setRows(scaled);
//  }

//  function handleRowQtyChange(rowId, value) {
//    setRows((prev) =>
//      prev.map((r) => (r.id === rowId ? { ...r, qty: value } : r))
//    );
//  }

//  async function handleSubmit(e) {
//    e.preventDefault();
//    setError("");
//    setMessage("");

//    const bom = boms.find((b) => b.name === selectedBomName);
//    if (!bom) {
//      setError("Select a BOM.");
//      return;
//    }

//    const fg = parseFloat(fgQty);
//    if (isNaN(fg) || fg <= 0) {
//      setError("Enter valid finished quantity.");
//      return;
//    }

//    if (!company) {
//      setError("Company is required (same as ERPNext).");
//      return;
//    }

//    const validRows = rows.filter(
//      (r) => !isNaN(parseFloat(r.qty)) && parseFloat(r.qty) > 0
//    );
//    if (!validRows.length) {
//      setError("No raw material rows with quantity.");
//      return;
//    }

//    const payload = {
//      doctype: "Stock Entry",
//      stock_entry_type: "Manufacture",
//      company,
//      bom_no: bom.name,
//      fg_completed_qty: fg,
//      items: [
//        ...validRows.map((r) => ({
//          item_code: r.item_code,
//          qty: parseFloat(r.qty),
//          s_warehouse: SOURCE_WH,
//        })),
//        {
//          item_code: bom.item,
//          qty: fg,
//          t_warehouse: TARGET_WH,
//          is_finished_item: 1,
//        },
//      ],
//    };

//    try {
//      setSaving(true);
//      const doc = await createDoc("Stock Entry", payload);
//      const name = doc.data?.name;

//      if (name) {
//        await submitDoc("Stock Entry", name);
//        setMessage(
//          `Stock Entry (Manufacture) created and submitted: ${name}`
//        );
//      } else {
//        setMessage("Stock Entry created (no name returned).");
//      }
//    } catch (err) {
//      console.error(err);
//      setError(
//        err.response?.data?.error?.message ||
//          err.message ||
//          "Failed to create/submit Stock Entry."
//      );
//    } finally {
//      setSaving(false);
//    }
//  }

//  return (
//    <div className="stock-mfg">
//      {/* Header */}
//      <div className="stock-mfg-header">
//        <div className="stock-mfg-title-block">
//          <h2 className="stock-mfg-title">
//            Stock Entry – Manufacture (Raw → Finished)
//          </h2>
//          <p className="stock-mfg-subtitle">
//            Consume raw material from Stores and create finished goods
//          </p>
//        </div>
//        <div className="stock-mfg-pill">
//          {rows.length} raw material row{rows.length !== 1 ? "s" : ""}
//        </div>
//      </div>

//      {/* Messages */}
//      {loadingBoms && (
//        <div className="stock-mfg-loading text-muted">
//          Loading BOMs...
//        </div>
//      )}
//      {error && (
//        <div className="alert alert-error stock-mfg-error">
//          {error}
//        </div>
//      )}
//      {message && (
//        <div className="alert alert-success stock-mfg-message">
//          {message}
//        </div>
//      )}

//      {/* Form card */}
//      <form onSubmit={handleSubmit} className="stock-mfg-form">
//        <div className="stock-mfg-form-grid">
//          {/* Finished item – searchable input + datalist */}
//          <div className="stock-mfg-field-group">
//            <label
//              htmlFor="stock-mfg-finished-item"
//              className="form-label stock-mfg-field-label"
//            >
//              Finished Item
//            </label>
//            <input
//              id="stock-mfg-finished-item"
//              list="stock-mfg-finished-item-list"
//              value={finishedItem}
//              onChange={handleFinishedItemChange}
//              className="input stock-mfg-finished-input"
//              placeholder="Type or select finished item code"
//            />
//            <datalist id="stock-mfg-finished-item-list">
//              {finishedItems.map((it) => (
//                <option
//                  key={it.name}
//                  value={it.name}
//                  label={`${it.name} - ${it.item_name}`}
//                />
//              ))}
//            </datalist>
//          </div>

//          {/* BOM dropdown (filtered by finished item) */}
//          <div className="stock-mfg-field-group">
//            <label
//              htmlFor="stock-mfg-bom"
//              className="form-label stock-mfg-field-label"
//            >
//              BOM
//            </label>
//            <select
//              id="stock-mfg-bom"
//              value={selectedBomName}
//              onChange={handleBomChange}
//              className="select"
//            >
//              <option value="">-- Select BOM --</option>
//              {filteredBoms.map((bom) => (
//                <option key={bom.name} value={bom.name}>
//                  {bom.name} ({bom.item})
//                </option>
//              ))}
//            </select>
//          </div>

//          {/* Finished qty */}
//          <div className="stock-mfg-field-group">
//            <label
//              htmlFor="stock-mfg-fgqty"
//              className="form-label stock-mfg-field-label"
//            >
//              Finished Qty
//            </label>
//            <input
//              id="stock-mfg-fgqty"
//              type="number"
//              value={fgQty}
//              onChange={handleFgQtyChange}
//              className="input"
//            />
//          </div>

//          {/* Company dropdown */}
//          <div className="stock-mfg-field-group">
//            <label
//              htmlFor="stock-mfg-company"
//              className="form-label stock-mfg-field-label"
//            >
//              Company
//            </label>
//            <select
//              id="stock-mfg-company"
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
//        </div>

//        <div className="stock-mfg-warehouse-card">
//          <div>
//            <span className="stock-mfg-warehouse-label">
//              Source Warehouse (Raw)
//            </span>
//            <span className="stock-mfg-warehouse-value">
//              {SOURCE_WH}
//            </span>
//          </div>
//          <div>
//            <span className="stock-mfg-warehouse-label">
//              Target Warehouse (Finished)
//            </span>
//            <span className="stock-mfg-warehouse-value">
//              {TARGET_WH}
//            </span>
//          </div>
//        </div>

//        <div className="stock-mfg-raw-header">
//          <h3 className="stock-mfg-raw-title">
//            Raw Materials (from BOM)
//          </h3>
//        </div>

//        {loadingItems && (
//          <div className="stock-mfg-raw-loading text-muted">
//            Loading BOM items...
//          </div>
//        )}

//        {!loadingItems && rows.length === 0 && (
//          <div className="stock-mfg-raw-empty text-muted">
//            No items for this BOM.
//          </div>
//        )}

//        {!loadingItems && rows.length > 0 && (
//          <div className="stock-mfg-table-wrapper table-container">
//            <table className="table stock-mfg-table">
//              <thead>
//                <tr>
//                  <th>Item</th>
//                  <th>Item Name</th>
//                  <th>UOM</th>
//                  <th>Qty (scaled)</th>
//                  <th>Source Warehouse</th>
//                </tr>
//              </thead>
//              <tbody>
//                {rows.map((r) => (
//                  <tr key={r.id}>
//                    <td className="stock-mfg-item-cell">{r.item_code}</td>
//                    <td className="stock-mfg-itemname-cell">{r.item_name}</td>
//                    <td className="stock-mfg-uom-cell">{r.uom}</td>
//                    <td className="stock-mfg-qty-cell">
//                      <input
//                        type="number"
//                        value={r.qty}
//                        onChange={(e) =>
//                          handleRowQtyChange(r.id, e.target.value)
//                        }
//                        className="input stock-mfg-qty-input"
//                      />
//                    </td>
//                    <td className="stock-mfg-wh-cell">{SOURCE_WH}</td>
//                  </tr>
//                ))}
//              </tbody>
//            </table>
//          </div>
//        )}

//        <div className="stock-mfg-submit-row">
//          <button
//            type="submit"
//            disabled={saving || loadingBoms || loadingItems}
//            className="btn btn-primary"
//          >
//            {saving ? "Creating..." : "Create Manufacture Stock Entry"}
//          </button>
//        </div>
//      </form>
//    </div>
//  );
//}

//export default StockManufactureEntry;


// src/StockManufactureEntry.jsx
import React, { useEffect, useState } from "react";
import {
  getBoms,
  getBomDocWithItems,
  createDoc,
  submitDoc,
  getFinishedItems,
  getCompanies,
  getItemsForBOM, // NEW: list of raw items to choose from
} from "./erpBackendApi";
import "../CSS/StockManufactureEntry.css";

const SOURCE_WH = "Raw Material - MF";
const TARGET_WH = "Finished Goods - MF";

function StockManufactureEntry() {
  const [boms, setBoms] = useState([]);
  const [finishedItems, setFinishedItems] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [rawItems, setRawItems] = useState([]); // NEW

  const [finishedItem, setFinishedItem] = useState("");
  const [selectedBomName, setSelectedBomName] = useState("");
  const [company, setCompany] = useState("");

  const [fgQty, setFgQty] = useState("1");

  const [bomItemsBase, setBomItemsBase] = useState([]);
  const [rows, setRows] = useState([]);

  const [loadingBoms, setLoadingBoms] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // helper: scale BOM items according to fgQty
  // manualRows are preserved and appended (not scaled)
  function scaleRowsFromBom(items, finishedQty, bomQty, manualRows = []) {
    const fg = parseFloat(finishedQty);
    const bq = parseFloat(bomQty);
    const ratio = !isNaN(fg) && fg > 0 && !isNaN(bq) && bq > 0 ? fg / bq : 1;

    const bomRows = items.map((it, idx) => ({
      id: it.name || `bom-${idx}`,
      item_code: it.item_code,
      item_name: it.item_name,
      uom: it.uom,
      qty: ((parseFloat(it.qty) || 0) * ratio).toString(),
      fromBom: true, // mark as BOM row
    }));

    return [...bomRows, ...manualRows];
  }

  // load BOM doc + child items and scale by quantity
  async function loadBomDocAndRows(bomName, finishedQty, bomQty) {
    if (!bomName) return;
    setLoadingItems(true);
    setError("");
    try {
      const bomDoc = await getBomDocWithItems(bomName);
      const items = bomDoc.items || [];
      const manualRows = rows.filter((r) => !r.fromBom); // keep manual rows
      setBomItemsBase(items);
      const scaled = scaleRowsFromBom(items, finishedQty, bomQty, manualRows);
      setRows(scaled);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load BOM items");
    } finally {
      setLoadingItems(false);
    }
  }

  // load BOMs + finished items + companies + raw items at start
  useEffect(() => {
    async function init() {
      setLoadingBoms(true);
      setError("");
      try {
        const [
          bomData,
          finishedItemData,
          companiesData,
          rawItemData,
        ] = await Promise.all([
          getBoms(),
          getFinishedItems(),
          getCompanies(),
          getItemsForBOM(), // all raw items
        ]);

        setBoms(bomData);
        setFinishedItems(finishedItemData);
        setCompanies(companiesData);
        setRawItems(rawItemData || []);

        // default finished item = first Products item (if any)
        let defaultFinishedItem = finishedItemData[0]?.name || "";
        if (defaultFinishedItem) {
          setFinishedItem(defaultFinishedItem);
        }

        // find first BOM for that finished item
        let firstBom =
          bomData.find((b) => b.item === defaultFinishedItem) || bomData[0];

        if (firstBom) {
          setSelectedBomName(firstBom.name);
          const defaultCompany =
            firstBom.company ||
            (companiesData.length > 0 ? companiesData[0].name : "");
          setCompany(defaultCompany);
          await loadBomDocAndRows(firstBom.name, fgQty, firstBom.quantity);
        } else if (!company && companiesData.length > 0) {
          setCompany(companiesData[0].name);
        }
      } catch (err) {
        console.error(err);
        setError(
          err.message ||
            "Failed to load BOMs / finished items / companies"
        );
      } finally {
        setLoadingBoms(false);
      }
    }

    init();
  }, []); // run once

  // list of BOMs filtered by selected finished item
  const filteredBoms = finishedItem
    ? boms.filter((b) => b.item === finishedItem)
    : boms;

  async function handleFinishedItemChange(e) {
    const itemCode = e.target.value;
    setFinishedItem(itemCode);
    setMessage("");
    setError("");

    // when finished item changes, pick first BOM for that item
    const bomForItem = boms.find((b) => b.item === itemCode);
    if (!bomForItem) {
      setSelectedBomName("");
      setBomItemsBase([]);
      // keep only manual rows
      setRows((prev) => prev.filter((r) => !r.fromBom));
      return;
    }

    setSelectedBomName(bomForItem.name);

    if (bomForItem.company) {
      setCompany(bomForItem.company);
    }

    await loadBomDocAndRows(bomForItem.name, fgQty, bomForItem.quantity);
  }

  async function handleBomChange(e) {
    const name = e.target.value;
    setSelectedBomName(name);
    setMessage("");
    setError("");

    const bom = boms.find((b) => b.name === name);
    if (!bom) {
      setBomItemsBase([]);
      setRows((prev) => prev.filter((r) => !r.fromBom));
      return;
    }

    // keep finishedItem in sync with the BOM's item
    if (bom.item && bom.item !== finishedItem) {
      setFinishedItem(bom.item);
    }

    if (bom.company) {
      setCompany(bom.company);
    }

    await loadBomDocAndRows(bom.name, fgQty, bom.quantity);
  }

  function handleFgQtyChange(e) {
    const value = e.target.value;
    setFgQty(value);
    setMessage("");
    setError("");

    const bom = boms.find((b) => b.name === selectedBomName);
    if (!bom) return;

    const manualRows = rows.filter((r) => !r.fromBom);
    const scaled = scaleRowsFromBom(
      bomItemsBase,
      value,
      bom.quantity,
      manualRows
    );
    setRows(scaled);
  }

  function handleRowQtyChange(rowId, value) {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, qty: value } : r))
    );
  }

  // change item in a manual row only (we won't render inputs for fromBom rows)
  function handleRowItemChange(rowId, itemCode) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const it = rawItems.find((x) => x.name === itemCode);
        return {
          ...r,
          item_code: itemCode,
          item_name: it ? it.item_name : "",
          uom: it ? it.stock_uom : "",
        };
      })
    );
  }

  // add a completely manual raw material row
  function handleAddRow() {
    setRows((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}-${Math.random()}`,
        item_code: "",
        item_name: "",
        uom: "",
        qty: "",
        fromBom: false,
      },
    ]);
  }

  // remove any row (BOM row or manual row)
  function handleRemoveRow(rowId) {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    const bom = boms.find((b) => b.name === selectedBomName);
    if (!bom) {
      setError("Select a BOM.");
      return;
    }

    const fg = parseFloat(fgQty);
    if (isNaN(fg) || fg <= 0) {
      setError("Enter valid finished quantity.");
      return;
    }

    if (!company) {
      setError("Company is required (same as ERPNext).");
      return;
    }

    const validRows = rows.filter(
      (r) =>
        r.item_code &&
        !isNaN(parseFloat(r.qty)) &&
        parseFloat(r.qty) > 0
    );
    if (!validRows.length) {
      setError("No raw material rows with item and quantity.");
      return;
    }

    const payload = {
      doctype: "Stock Entry",
      stock_entry_type: "Manufacture",
      company,
      bom_no: bom.name, // still linking to BOM, but rows are editable
      fg_completed_qty: fg,
      items: [
        ...validRows.map((r) => ({
          item_code: r.item_code,
          qty: parseFloat(r.qty),
          s_warehouse: SOURCE_WH,
        })),
        {
          item_code: bom.item,
          qty: fg,
          t_warehouse: TARGET_WH,
          is_finished_item: 1,
        },
      ],
    };

    try {
      setSaving(true);
      const doc = await createDoc("Stock Entry", payload);
      const name = doc.data?.name;

      if (name) {
        await submitDoc("Stock Entry", name);
        setMessage(
          `Stock Entry (Manufacture) created and submitted: ${name}`
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
    <div className="stock-mfg">
      {/* Header */}
      <div className="stock-mfg-header">
        <div className="stock-mfg-title-block">
          <h2 className="stock-mfg-title">
            Stock Entry – Manufacture (Raw → Finished)
          </h2>
          <p className="stock-mfg-subtitle">
            Consume raw material from Stores and create finished goods
          </p>
        </div>
        <div className="stock-mfg-pill">
          {rows.length} raw material row{rows.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Messages */}
      {loadingBoms && (
        <div className="stock-mfg-loading text-muted">
          Loading BOMs...
        </div>
      )}
      {error && (
        <div className="alert alert-error stock-mfg-error">
          {error}
        </div>
      )}
      {message && (
        <div className="alert alert-success stock-mfg-message">
          {message}
        </div>
      )}

      {/* Form card */}
      <form onSubmit={handleSubmit} className="stock-mfg-form">
        <div className="stock-mfg-form-grid">
          {/* Finished item – searchable input + datalist */}
          <div className="stock-mfg-field-group">
            <label
              htmlFor="stock-mfg-finished-item"
              className="form-label stock-mfg-field-label"
            >
              Finished Item
            </label>
            <input
              id="stock-mfg-finished-item"
              list="stock-mfg-finished-item-list"
              value={finishedItem}
              onChange={handleFinishedItemChange}
              className="input stock-mfg-finished-input"
              placeholder="Type or select finished item code"
            />
            <datalist id="stock-mfg-finished-item-list">
              {finishedItems.map((it) => (
                <option
                  key={it.name}
                  value={it.name}
                  label={`${it.name} - ${it.item_name}`}
                />
              ))}
            </datalist>
          </div>

          {/* BOM dropdown (filtered by finished item) */}
          <div className="stock-mfg-field-group">
            <label
              htmlFor="stock-mfg-bom"
              className="form-label stock-mfg-field-label"
            >
              Material List
            </label>
            <select
              id="stock-mfg-bom"
              value={selectedBomName}
              onChange={handleBomChange}
              className="select"
            >
              <option value="">-- Select BOM --</option>
              {filteredBoms.map((bom) => (
                <option key={bom.name} value={bom.name}>
                  {bom.name} ({bom.item})
                </option>
              ))}
            </select>
          </div>

          {/* Finished qty */}
          <div className="stock-mfg-field-group">
            <label
              htmlFor="stock-mfg-fgqty"
              className="form-label stock-mfg-field-label"
            >
              Finished Qty
            </label>
            <input
              id="stock-mfg-fgqty"
              type="number"
              value={fgQty}
              onChange={handleFgQtyChange}
              className="input"
            />
          </div>

          {/* Company dropdown */}
          <div className="stock-mfg-field-group">
            <label
              htmlFor="stock-mfg-company"
              className="form-label stock-mfg-field-label"
            >
              Company
            </label>
            <select
              id="stock-mfg-company"
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

        <div className="stock-mfg-warehouse-card">
          <div>
            <span className="stock-mfg-warehouse-label">
              Source Warehouse (Raw)
            </span>
            <span className="stock-mfg-warehouse-value">
              {SOURCE_WH}
            </span>
          </div>
          <div>
            <span className="stock-mfg-warehouse-label">
              Target Warehouse (Finished)
            </span>
            <span className="stock-mfg-warehouse-value">
              {TARGET_WH}
            </span>
          </div>
        </div>

        <div className="stock-mfg-raw-header">
          <h3 className="stock-mfg-raw-title">
            Raw Materials (you can add / remove)
          </h3>
          <button
            type="button"
            onClick={handleAddRow}
            className="btn btn-accent btn-sm"
          >
            + Add Raw Item
          </button>
        </div>

        {/* Datalist for manual raw-item search */}
        <datalist id="stock-mfg-raw-item-list">
          {rawItems.map((it) => (
            <option
              key={it.name}
              value={it.name}
              label={`${it.name} - ${it.item_name}`}
            />
          ))}
        </datalist>

        {loadingItems && (
          <div className="stock-mfg-raw-loading text-muted">
            Loading BOM items...
          </div>
        )}

        {!loadingItems && rows.length === 0 && (
          <div className="stock-mfg-raw-empty text-muted">
            No items for this BOM. Add raw items manually.
          </div>
        )}

        {!loadingItems && rows.length > 0 && (
          <div className="stock-mfg-table-wrapper table-container">
            <table className="table stock-mfg-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Item Name</th>
                  <th>Unit</th>
                  <th>Qty</th>
                  <th>Source Warehouse</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="stock-mfg-item-cell">
                      {r.fromBom ? (
                        // BOM rows: fixed item, no dropdown
                        <span>{r.item_code}</span>
                      ) : (
                        // Manual rows: searchable input with datalist
                        <input
                          className="input stock-mfg-item-input"
                          list="stock-mfg-raw-item-list"
                          value={r.item_code}
                          onChange={(e) =>
                            handleRowItemChange(r.id, e.target.value)
                          }
                          placeholder="Type or select item"
                        />
                      )}
                    </td>
                    <td className="stock-mfg-itemname-cell">
                      {r.item_name}
                    </td>
                    <td className="stock-mfg-uom-cell">{r.uom}</td>
                    <td className="stock-mfg-qty-cell">
                      <input
                        type="number"
                        value={r.qty}
                        onChange={(e) =>
                          handleRowQtyChange(r.id, e.target.value)
                        }
                        className="input stock-mfg-qty-input"
                      />
                    </td>
                    <td className="stock-mfg-wh-cell">{SOURCE_WH}</td>
                    <td className="stock-mfg-actions-cell">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleRemoveRow(r.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="stock-mfg-submit-row">
          <button
            type="submit"
            disabled={saving || loadingBoms || loadingItems}
            className="btn btn-primary"
          >
            {saving ? "Creating..." : "Create Manufacture Stock Entry"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default StockManufactureEntry;
