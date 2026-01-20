// src/StockManufactureEntry.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getBoms,                    // fetch BOM list
  getBomDocWithItems,         // fetch BOM document + its items
  createDoc,                  // create ERPNext document
  submitDoc,                  // submit ERPNext document
  getFinishedItems,           // list finished items (FG)
  getCompanies,               // list companies
  getItemsForBOM,             // list raw items (RM) for manual add
  getBinForItemWarehouse,     // to show Available Qty from Bin
  mapLimit,                   // helper to limit parallel API calls
} from "../erpBackendApi";
import "./StockManufactureEntry.css";

// Fixed warehouses for this screen (Raw -> Finished)
const SOURCE_WH = "Raw Material - MF";
const TARGET_WH = "Finished Goods - MF";

/**
 * Searchable dropdown (same style as StockTransfer dropdown)
 * - Opens full list
 * - Search inside the popover
 * - Returns selected "value"
 */
function ErpSearchDropdown({ options, value, onSelect, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  // Find the currently selected option object (for display)
  const selected = useMemo(() => {
    return options.find((x) => x.value === value) || null;
  }, [options, value]);

  // Filter options when user types in search box
  const filtered = useMemo(() => {
    const s = (q || "").trim().toLowerCase();
    if (!s) return options;

    return options.filter((opt) => {
      const v = (opt.value || "").toLowerCase();
      const t = (opt.title || "").toLowerCase();
      const sub = (opt.sub || "").toLowerCase();
      return v.includes(s) || t.includes(s) || sub.includes(s);
    });
  }, [options, q]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function onDown(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className={`stdrop ${disabled ? "is-disabled" : ""}`} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        className={`stdrop-control ${open ? "is-open" : ""}`}
        onClick={() => {
          if (disabled) return;

          // Toggle dropdown
          setOpen((v) => {
            const next = !v;
            if (next) setQ(""); // when opening, clear search so it shows full list first
            return next;
          });
        }}
      >
        <div className="stdrop-value">
          {selected ? (
            <>
              <div className="stdrop-title">{selected.title || selected.value}</div>
              {selected.sub ? <div className="stdrop-sub">{selected.sub}</div> : null}
            </>
          ) : (
            <div className="stdrop-placeholder">{placeholder}</div>
          )}
        </div>
        <div className="stdrop-caret">▾</div>
      </button>

      {/* Dropdown popup */}
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
            {filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="stdrop-item"
                onClick={() => {
                  onSelect(opt.value); // pass real value back
                  setOpen(false);
                  setQ("");
                }}
              >
                <div className="stdrop-item-title">{opt.title || opt.value}</div>
                {opt.sub ? <div className="stdrop-item-sub">{opt.sub}</div> : null}
              </button>
            ))}

            {!filtered.length ? <div className="stdrop-empty">No results found.</div> : null}
          </div>
        </div>
      )}
    </div>
  );
}

function StockManufactureEntry() {
  // Master data
  const [boms, setBoms] = useState([]);
  const [finishedItems, setFinishedItems] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [rawItems, setRawItems] = useState([]);

  // Header selections
  const [finishedItem, setFinishedItem] = useState("");
  const [selectedBomName, setSelectedBomName] = useState("");
  const [company, setCompany] = useState("");

  // Finished goods quantity (fg_completed_qty)
  const [fgQty, setFgQty] = useState("1");

  // BOM base items (original quantities from BOM)
  const [bomItemsBase, setBomItemsBase] = useState([]);

  // Rows shown in the table (BOM rows + manual rows)
  const [rows, setRows] = useState([]);

  // Loading / saving flags
  const [loadingBoms, setLoadingBoms] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);

  // UI messages
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Available quantity map: { item_code: available_qty }
  const [availMap, setAvailMap] = useState({});

  /**
   * Create table rows from BOM items, and scale quantities based on finished quantity.
   * We keep manual rows at the end.
   */
  function scaleRowsFromBom(items, finishedQty, bomQty, manualRows = []) {
    const fg = parseFloat(finishedQty);
    const bq = parseFloat(bomQty);

    // ratio = finishedQty / bomQty (example: BOM for 1, user makes 10 => multiply RM by 10)
    const ratio = !isNaN(fg) && fg > 0 && !isNaN(bq) && bq > 0 ? fg / bq : 1;

    // Convert each BOM item to a table row
    const bomRows = items.map((it, idx) => ({
      id: it.name || `bom-${idx}`,
      item_code: it.item_code,
      item_name: it.item_name,
      uom: it.uom,
      qty: ((parseFloat(it.qty) || 0) * ratio).toString(),
      fromBom: true, // marks it as BOM row (not manual)
    }));

    return [...bomRows, ...manualRows];
  }

  /**
   * Load BOM document + items, then rebuild rows (scaled),
   * while keeping any manual rows already added.
   */
  async function loadBomDocAndRows(bomName, finishedQty, bomQty) {
    if (!bomName) return;

    setLoadingItems(true);
    setError("");

    try {
      const bomDoc = await getBomDocWithItems(bomName);
      const items = bomDoc.items || [];

      // Keep manual rows, replace BOM rows
      const manualRows = rows.filter((r) => !r.fromBom);

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

  /**
   * Whenever rows change, load available qty for all unique item codes.
   * Uses mapLimit to avoid too many parallel requests.
   */
  useEffect(() => {
    let alive = true;

    async function loadAvail() {
      const codes = Array.from(new Set((rows || []).map((r) => r.item_code).filter(Boolean)));

      // No items => clear map
      if (!codes.length) {
        if (alive) setAvailMap({});
        return;
      }

      try {
        const results = await mapLimit(codes, 6, async (code) => {
          const bin = await getBinForItemWarehouse(code, SOURCE_WH);
          const qty = bin ? Number(bin.actual_qty ?? 0) : 0;
          return { code, qty };
        });

        const next = {};
        results.forEach(({ code, qty }) => {
          next[code] = qty;
        });

        if (alive) setAvailMap(next);
      } catch (e) {
        console.error("Failed to load available qty:", e);
        // Keep old values if API fails
      }
    }

    loadAvail();
    return () => {
      alive = false;
    };
  }, [rows]);

  /**
   * On first load:
   * - load BOMs, finished items, companies, and raw item list
   * - reset selections
   */
  useEffect(() => {
    async function init() {
      setLoadingBoms(true);
      setError("");

      try {
        const [bomData, finishedItemData, companiesData, rawItemData] = await Promise.all([
          getBoms(),
          getFinishedItems(),
          getCompanies(),
          getItemsForBOM(),
        ]);

        setBoms(bomData || []);
        setFinishedItems(finishedItemData || []);
        setCompanies(companiesData || []);
        setRawItems(rawItemData || []);

        // start empty
        setFinishedItem("");
        setSelectedBomName("");
        setBomItemsBase([]);
        setRows([]);

        // default company = first company (if any)
        if ((companiesData || []).length > 0) setCompany(companiesData[0].name);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load BOMs / finished items / companies");
      } finally {
        setLoadingBoms(false);
      }
    }

    init();
  }, []);

  // Only show BOMs that match selected finished item
  const filteredBoms = finishedItem ? boms.filter((b) => b.item === finishedItem) : [];

  /**
   * When user selects Finished Item:
   * - find first matching BOM
   * - auto-select BOM and company (if BOM has company)
   * - load BOM items into rows
   */
  async function handleFinishedItemValueChange(itemCode) {
    setFinishedItem(itemCode);
    setMessage("");
    setError("");

    if (!itemCode) {
      setSelectedBomName("");
      setBomItemsBase([]);
      setRows((prev) => prev.filter((r) => !r.fromBom)); // keep manual rows only
      return;
    }

    const bomForItem = boms.find((b) => b.item === itemCode);

    // No BOM for this finished item
    if (!bomForItem) {
      setSelectedBomName("");
      setBomItemsBase([]);
      setRows((prev) => prev.filter((r) => !r.fromBom));
      return;
    }

    // Auto select BOM + company
    setSelectedBomName(bomForItem.name);
    if (bomForItem.company) setCompany(bomForItem.company);

    await loadBomDocAndRows(bomForItem.name, fgQty, bomForItem.quantity);
  }

  /**
   * When user selects BOM option:
   * - sync finished item/company
   * - load BOM items and rebuild rows
   */
  async function handleBomValueChange(name) {
    setSelectedBomName(name);
    setMessage("");
    setError("");

    if (!name) {
      setBomItemsBase([]);
      setRows((prev) => prev.filter((r) => !r.fromBom));
      return;
    }

    const bom = boms.find((b) => b.name === name);
    if (!bom) return;

    if (bom.item && bom.item !== finishedItem) setFinishedItem(bom.item);
    if (bom.company) setCompany(bom.company);

    await loadBomDocAndRows(bom.name, fgQty, bom.quantity);
  }

  /**
   * Finished qty change:
   * - rescale BOM rows based on new qty
   * - keep manual rows unchanged
   */
  function handleFgQtyChange(e) {
    const value = e.target.value;
    setFgQty(value);
    setMessage("");
    setError("");

    if (value < 0) return;
    if (value === "") {
      setFgQty("");
      return;
    }

    const bom = boms.find((b) => b.name === selectedBomName);
    if (!bom) return;

    const manualRows = rows.filter((r) => !r.fromBom);
    const scaled = scaleRowsFromBom(bomItemsBase, value, bom.quantity, manualRows);
    setRows(scaled);
  }

  // Update qty for a row
  function handleRowQtyChange(rowId, value) {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, qty: value } : r)));
  }

  // When manual row item changes, fill item_name and UOM from rawItems list
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

  // Add a manual row (not from BOM)
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

  // Remove any row (BOM or manual)
  function handleRemoveRow(rowId) {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  }

  /**
   * Submit:
   * Create Stock Entry (Manufacture)
   * - RM rows consume from SOURCE_WH
   * - FG item adds to TARGET_WH
   */
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    const bom = boms.find((b) => b.name === selectedBomName);
    if (!bom) return setError("Select a BOM.");

    const fg = parseFloat(fgQty);
    if (isNaN(fg) || fg <= 0) return setError("Enter valid finished quantity.");
    if (!company) return setError("Company is required (same as ERPNext).");

    const validRows = rows.filter(
      (r) => r.item_code && !isNaN(parseFloat(r.qty)) && parseFloat(r.qty) > 0
    );
    if (!validRows.length) return setError("No raw material rows with item and quantity.");

    const payload = {
      doctype: "Stock Entry",
      stock_entry_type: "Manufacture",
      company,
      bom_no: bom.name,
      fg_completed_qty: fg,
      items: [
        // Raw material consumption lines
        ...validRows.map((r) => ({
          item_code: r.item_code,
          qty: parseFloat(r.qty),
          s_warehouse: SOURCE_WH,
        })),

        // Finished goods receive line
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
        setMessage(`Stock Entry (Manufacture) created and submitted: ${name}`);
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

  // Finished item dropdown options (show code + name)
  const finishedItemOptions = useMemo(
    () =>
      finishedItems.map((it) => ({
        value: it.name,
        title: it.name,
        sub: it.item_name || "",
      })),
    [finishedItems]
  );

  // BOM dropdown options (UI shows Option 1/2/3..., value is real BOM name)
  const bomOptions = useMemo(
    () =>
      filteredBoms.map((bom, idx) => ({
        value: bom.name,            // real BOM ID
        title: `Option ${idx + 1}`, // only show option number
        sub: "",
      })),
    [filteredBoms]
  );

  return (
    <div className="stock-mfg">
      {/* Page header */}
      <div className="stock-mfg-header">
        <div className="stock-mfg-title-block">
          <h2 className="stock-mfg-title">Stock Entry – Manufacture (Raw → Finished)</h2>
          <p className="stock-mfg-subtitle">
            Consume raw material from Stores and create finished goods
          </p>
        </div>

        {/* Right side count */}
        <div className="stock-mfg-pill">
          {rows.length} raw material row{rows.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Page messages */}
      {loadingBoms && <div className="stock-mfg-loading text-muted">Loading BOMs...</div>}
      {error && <div className="alert alert-error stock-mfg-error">{error}</div>}
      {message && <div className="alert alert-success stock-mfg-message">{message}</div>}

      {/* Main form */}
      <form onSubmit={handleSubmit} className="stock-mfg-form">
        {/* Top inputs */}
        <div className="stock-mfg-form-grid">
          <div className="stock-mfg-field-group">
            <label className="form-label stock-mfg-field-label">Finished Item</label>
            <ErpSearchDropdown
              options={finishedItemOptions}
              value={finishedItem}
              onSelect={handleFinishedItemValueChange}
              placeholder="Search finished item..."
              disabled={loadingBoms}
            />
          </div>

          <div className="stock-mfg-field-group">
            <label className="form-label stock-mfg-field-label">Material List</label>
            <ErpSearchDropdown
              options={bomOptions}
              value={selectedBomName}
              onSelect={handleBomValueChange}
              placeholder={finishedItem ? "Select option..." : "Select finished item first"}
              disabled={loadingBoms || !finishedItem}
            />
          </div>

          <div className="stock-mfg-field-group">
            <label className="form-label stock-mfg-field-label">Finished Qty</label>
            <input
              type="number"
              min={0}
              value={fgQty}
              onChange={handleFgQtyChange}
              className="input"
            />
          </div>

          <div className="stock-mfg-field-group">
            <label className="form-label stock-mfg-field-label">Company</label>
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

        {/* Warehouse display (fixed for this screen) */}
        <div className="stock-mfg-warehouse-card">
          <div>
            <span className="stock-mfg-warehouse-label">Source Warehouse (Raw)</span>
            <span className="stock-mfg-warehouse-value">{SOURCE_WH}</span>
          </div>
          <div>
            <span className="stock-mfg-warehouse-label">Target Warehouse (Finished)</span>
            <span className="stock-mfg-warehouse-value">{TARGET_WH}</span>
          </div>
        </div>

        {/* Raw material section header */}
        <div className="stock-mfg-raw-header">
          <h3 className="stock-mfg-raw-title">Raw Materials (you can add / remove)</h3>
          <button type="button" onClick={handleAddRow} className="btn btn-accent btn-sm">
            + Add Raw Item
          </button>
        </div>

        {/* Suggestions for manual raw item input */}
        <datalist id="stock-mfg-raw-item-list">
          {rawItems.map((it) => (
            <option key={it.name} value={it.name} label={`${it.name} - ${it.item_name}`} />
          ))}
        </datalist>

        {loadingItems && (
          <div className="stock-mfg-raw-loading text-muted">Loading BOM items...</div>
        )}

        {!loadingItems && rows.length === 0 && (
          <div className="stock-mfg-raw-empty text-muted">
            No items for this BOM. Add raw items manually.
          </div>
        )}

        {/* Raw materials table */}
        {!loadingItems && rows.length > 0 && (
          <div className="stock-mfg-table-wrapper table-container">
            <table className="table stock-mfg-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Item Name</th>
                  <th>Unit</th>
                  <th>Qty</th>
                  <th>Available Qty</th>
                  <th>Source Warehouse</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="stock-mfg-item-cell">
                      {/* BOM rows show item code as text, manual rows allow editing */}
                      {r.fromBom ? (
                        <span>{r.item_code}</span>
                      ) : (
                        <input
                          className="input stock-mfg-item-input"
                          list="stock-mfg-raw-item-list"
                          value={r.item_code}
                          onChange={(e) => handleRowItemChange(r.id, e.target.value)}
                          placeholder="Type or select item"
                        />
                      )}
                    </td>

                    <td className="stock-mfg-itemname-cell">{r.item_name}</td>
                    <td className="stock-mfg-uom-cell">{r.uom}</td>

                    <td className="stock-mfg-qty-cell">
                      <input
                        type="number"
                        value={r.qty}
                        onChange={(e) => handleRowQtyChange(r.id, e.target.value)}
                        className="input stock-mfg-qty-input"
                      />
                    </td>

                    {/* Available qty from Bin */}
                    <td className="stock-mfg-avail-cell">
                      {r.item_code ? (availMap[r.item_code] ?? "-") : "-"}
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

        {/* Submit */}
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
