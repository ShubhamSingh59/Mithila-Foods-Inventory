//////////// src/Components/DailyStockSummary.jsx
//////////import React, { useEffect, useState } from "react";
//////////import {
//////////  getStockLedgerUpToDate,
//////////  getAllItems,
//////////  getDoctypeList,
//////////  getDoc,
//////////} from "./erpBackendApi";
//////////import "../CSS/DailyStockSummary.css";

//////////// Must match GOOD_RETURN_WH used in createSalesReturn
//////////const GOOD_RETURN_WH = "Finished Goods - MF";

//////////function DailyStockSummary() {
//////////  const [date, setDate] = useState(
//////////    new Date().toISOString().slice(0, 10) // today
//////////  );
//////////  const [rows, setRows] = useState([]);
//////////  const [loading, setLoading] = useState(false);
//////////  const [error, setError] = useState("");

//////////  function makeTs(entry) {
//////////    // "YYYY-MM-DD HH:MM:SS"
//////////    return `${entry.posting_date} ${entry.posting_time || "00:00:00"}`;
//////////  }

//////////  async function loadData(selectedDate) {
//////////    setLoading(true);
//////////    setError("");
//////////    setRows([]);

//////////    try {
//////////      const todayStr = new Date().toISOString().slice(0, 10);

//////////      // 1) SLE up to selected date (for opening + daily movement)
//////////      // 2) SLE up to today (for current stock "now")
//////////      // 3) Item master for item_name
//////////      // 4) Stock Reconciliation docs ON selected date
//////////      const [sleToSelected, sleToToday, items, reconDocs] = await Promise.all([
//////////        getStockLedgerUpToDate(selectedDate),
//////////        getStockLedgerUpToDate(todayStr),
//////////        getAllItems(),
//////////        getDoctypeList("Stock Reconciliation", {
//////////          fields: JSON.stringify(["name", "posting_date", "docstatus"]),
//////////          filters: JSON.stringify([
//////////            ["Stock Reconciliation", "posting_date", "=", selectedDate],
//////////            ["Stock Reconciliation", "docstatus", "=", 1],
//////////          ]),
//////////          limit_page_length: 500,
//////////        }),
//////////      ]);

//////////      // item_code -> item_name
//////////      const itemMap = {};
//////////      items.forEach((it) => {
//////////        itemMap[it.name] = it.item_name;
//////////      });

//////////      // set of reconciliation voucher_nos (so we can identify their SLEs)
//////////      const reconNameSet = new Set(reconDocs.map((d) => d.name));

//////////      // maps keyed by "item_code||warehouse"
//////////      const openingMap = {};      // opening qty at start of selected day
//////////      const inMap = {};           // normal IN qty on selected day
//////////      const outMap = {};          // normal OUT qty on selected day
//////////      const adjustmentMap = {};   // reconciliation delta on selected day
//////////      const soldMap = {};         // sold qty (Sales Invoice OUT) on selected day
//////////      const goodReturnMap = {};   // good return qty (Sales Invoice IN to GOOD_RETURN_WH) on selected day
//////////      const currentMap = {};      // current qty "now" (end of today)

//////////      // helper maps to track latest SLE for opening & current
//////////      const lastBeforeDay = {};   // latest entry BEFORE selected date
//////////      const lastTillToday = {};   // latest entry up to today

//////////      // ---------- 1) Opening & daily movement from SLE ----------

//////////      sleToSelected.forEach((entry) => {
//////////        const itemCode = entry.item_code;
//////////        const warehouse = entry.warehouse;
//////////        if (!itemCode || !warehouse) return;

//////////        const key = `${itemCode}||${warehouse}`;
//////////        const qty = parseFloat(entry.actual_qty) || 0;
//////////        const balance = parseFloat(entry.qty_after_transaction) || 0;
//////////        const rawVtype = entry.voucher_type || "";
//////////        const vtype =
//////////          typeof rawVtype === "string" ? rawVtype.trim() : rawVtype;
//////////        const entryDate = entry.posting_date;
//////////        const ts = makeTs(entry);

//////////        const isRecon = reconNameSet.has(entry.voucher_no);

//////////        // Track latest entry BEFORE selected date for opening
//////////        if (entryDate < selectedDate) {
//////////          const existing = lastBeforeDay[key];
//////////          if (!existing || ts > existing.ts) {
//////////            lastBeforeDay[key] = { ts, balance };
//////////          }
//////////        }

//////////        // Movement ON the selected date
//////////        if (entryDate === selectedDate) {
//////////          // Normal IN / OUT: we EXCLUDE entries that belong
//////////          // to Stock Reconciliation vouchers (we'll compute their
//////////          // effect from the Stock Reconciliation doc itself)
//////////          if (!isRecon) {
//////////            if (qty > 0) {
//////////              inMap[key] = (inMap[key] || 0) + qty;
//////////            } else if (qty < 0) {
//////////              outMap[key] = (outMap[key] || 0) + Math.abs(qty);
//////////            }
//////////          }

//////////          // Sales Invoice movements for Sold and Good Return
//////////          if (vtype === "Sales Invoice") {
//////////            // sold = stock going OUT
//////////            if (qty < 0) {
//////////              soldMap[key] = (soldMap[key] || 0) + Math.abs(qty);
//////////            }
//////////            // good return = positive qty into GOOD_RETURN_WH
//////////            if (qty > 0 && warehouse === GOOD_RETURN_WH) {
//////////              goodReturnMap[key] = (goodReturnMap[key] || 0) + qty;
//////////            }
//////////          }
//////////        }
//////////      });

//////////      // Build openingMap from lastBeforeDay balances
//////////      Object.keys(lastBeforeDay).forEach((key) => {
//////////        openingMap[key] = lastBeforeDay[key].balance;
//////////      });

//////////      // ---------- 2) Adjustment from Stock Reconciliation docs ----------

//////////      // For each reconciliation on that day, load its full doc
//////////      // and derive delta = new_qty - current_qty per line.
//////////      for (const recon of reconDocs) {
//////////        const doc = await getDoc("Stock Reconciliation", recon.name);
//////////        const items = doc.items || [];

//////////        items.forEach((it) => {
//////////          const itemCode = it.item_code;
//////////          const warehouse = it.warehouse;
//////////          if (!itemCode || !warehouse) return;

//////////          const key = `${itemCode}||${warehouse}`;
//////////          const currentQty = parseFloat(it.current_qty || 0); // before reconciliation
//////////          const newQty = parseFloat(it.qty || 0);             // after reconciliation
//////////          const delta = newQty - currentQty;                  // +increase / -decrease

//////////          adjustmentMap[key] = (adjustmentMap[key] || 0) + delta;
//////////        });
//////////      }

//////////      // ---------- 3) Current stock "now" from SLE ----------

//////////      sleToToday.forEach((entry) => {
//////////        const itemCode = entry.item_code;
//////////        const warehouse = entry.warehouse;
//////////        if (!itemCode || !warehouse) return;

//////////        const key = `${itemCode}||${warehouse}`;
//////////        const balance = parseFloat(entry.qty_after_transaction) || 0;
//////////        const ts = makeTs(entry);

//////////        const existing = lastTillToday[key];
//////////        if (!existing || ts > existing.ts) {
//////////          lastTillToday[key] = { ts, balance };
//////////        }
//////////      });

//////////      Object.keys(lastTillToday).forEach((key) => {
//////////        currentMap[key] = lastTillToday[key].balance;
//////////      });

//////////      // ---------- 4) Build final row array ----------

//////////      const keys = new Set([
//////////        ...Object.keys(openingMap),
//////////        ...Object.keys(inMap),
//////////        ...Object.keys(outMap),
//////////        ...Object.keys(adjustmentMap),
//////////        ...Object.keys(soldMap),
//////////        ...Object.keys(goodReturnMap),
//////////        ...Object.keys(currentMap),
//////////      ]);

//////////      const result = Array.from(keys).map((key) => {
//////////        const [item_code, warehouse] = key.split("||");
//////////        const opening = openingMap[key] || 0;
//////////        const inQty = inMap[key] || 0;
//////////        const outQty = outMap[key] || 0;
//////////        const adjQty = adjustmentMap[key] || 0;
//////////        const soldQty = soldMap[key] || 0;
//////////        const returnQty = goodReturnMap[key] || 0;
//////////        const currentStock = currentMap[key] || 0;

//////////        return {
//////////          item_code,
//////////          item_name: itemMap[item_code] || "",
//////////          warehouse,
//////////          opening_stock: opening,
//////////          in_qty: inQty,
//////////          out_qty: outQty,
//////////          adjustment_qty: adjQty,      // signed: +increase, -decrease
//////////          sold_qty: soldQty,
//////////          good_return_qty: returnQty,
//////////          current_stock: currentStock, // live stock now
//////////        };
//////////      });

//////////      // sort by warehouse then item
//////////      result.sort((a, b) => {
//////////        if (a.warehouse === b.warehouse) {
//////////          return a.item_code.localeCompare(b.item_code);
//////////        }
//////////        return a.warehouse.localeCompare(b.warehouse);
//////////      });

//////////      setRows(result);
//////////    } catch (err) {
//////////      console.error(err);
//////////      setError(err.message || "Failed to load daily stock summary");
//////////    } finally {
//////////      setLoading(false);
//////////    }
//////////  }

//////////  useEffect(() => {
//////////    loadData(date);
//////////  }, [date]);

//////////  return (
//////////    <div className="daily-stock-summary">
//////////      {/* Header */}
//////////      <div className="daily-stock-summary-header-row">
//////////        <div className="daily-stock-summary-header">
//////////          <h2 className="daily-stock-summary-title">Daily Stock Summary</h2>
//////////          <p className="daily-stock-summary-subtitle">
//////////            Opening, movement &amp; balances by warehouse for the selected date
//////////          </p>
//////////        </div>

//////////        <div className="daily-stock-summary-controls">
//////////          <span className="daily-stock-summary-date-label">Date</span>
//////////          <input
//////////            type="date"
//////////            className="input daily-stock-summary-date-input"
//////////            value={date}
//////////            onChange={(e) => setDate(e.target.value)}
//////////          />
//////////          <button
//////////            type="button"
//////////            className="btn btn-primary btn-sm daily-stock-summary-refresh"
//////////            onClick={() => loadData(date)}
//////////          >
//////////            Refresh
//////////          </button>
//////////        </div>
//////////      </div>

//////////      {/* Meta */}
//////////      <div className="daily-stock-summary-meta-row">
//////////        <span className="daily-stock-summary-meta">
//////////          Showing {rows.length} line{rows.length !== 1 ? "s" : ""}
//////////        </span>
//////////      </div>

//////////      {/* States */}
//////////      {loading && (
//////////        <p className="daily-stock-summary-loading text-muted">
//////////          Loading stock summary...
//////////        </p>
//////////      )}
//////////      {error && (
//////////        <p className="daily-stock-summary-error alert alert-error">
//////////          {error}
//////////        </p>
//////////      )}
//////////      {!loading && !error && rows.length === 0 && (
//////////        <p className="daily-stock-summary-empty text-muted">
//////////          No stock movement found up to this date.
//////////        </p>
//////////      )}

//////////      {/* Table */}
//////////      {!loading && !error && rows.length > 0 && (
//////////        <div className="daily-stock-summary-table-wrapper">
//////////          <table className="daily-stock-summary-table">
//////////            <thead>
//////////              <tr>
//////////                <th>Warehouse</th>
//////////                <th>Item</th>
//////////                <th>Opening Stock</th>
//////////                <th>In Qty (on date)</th>
//////////                <th>Out Qty (on date)</th>
//////////                <th>Adjustment (Reconciliation)</th>
//////////                <th>Sold Qty (on date)</th>
//////////                <th>Return Qty (Good, on date)</th>
//////////                <th>Current Stock (now)</th>
//////////              </tr>
//////////            </thead>
//////////            <tbody>
//////////              {rows.map((r) => (
//////////                <tr key={`${r.warehouse}||${r.item_code}`}>
//////////                  <td className="daily-stock-summary-warehouse">
//////////                    {r.warehouse}
//////////                  </td>
//////////                  <td className="daily-stock-summary-item">
//////////                    <div className="daily-stock-summary-item-code">
//////////                      {r.item_code}
//////////                    </div>
//////////                    {r.item_name && (
//////////                      <div className="daily-stock-summary-item-name">
//////////                        {r.item_name}
//////////                      </div>
//////////                    )}
//////////                  </td>
//////////                  <td className="daily-stock-summary-opening">
//////////                    {r.opening_stock || 0}
//////////                  </td>
//////////                  <td className="daily-stock-summary-inqty">
//////////                    {r.in_qty || 0}
//////////                  </td>
//////////                  <td className="daily-stock-summary-outqty">
//////////                    {r.out_qty || 0}
//////////                  </td>
//////////                  <td className="daily-stock-summary-adjustment">
//////////                    {r.adjustment_qty || 0}
//////////                  </td>
//////////                  <td className="daily-stock-summary-sold">
//////////                    {r.sold_qty || 0}
//////////                  </td>
//////////                  <td className="daily-stock-summary-returns">
//////////                    {r.good_return_qty || 0}
//////////                  </td>
//////////                  <td className="daily-stock-summary-current">
//////////                    {r.current_stock || 0}
//////////                  </td>
//////////                </tr>
//////////              ))}
//////////            </tbody>
//////////          </table>
//////////        </div>
//////////      )}
//////////    </div>
//////////  );
//////////}

//////////export default DailyStockSummary;

////////// src/Components/DailyStockSummary.jsx
////////import React, { useEffect, useState } from "react";
////////import {
////////  getStockLedgerUpToDate,
////////  getAllItems,
////////  getDoctypeList,
////////  getDoc,
////////} from "./erpBackendApi";
////////import "../CSS/DailyStockSummary.css";

////////// Must match GOOD_RETURN_WH used in createSalesReturn
////////const GOOD_RETURN_WH = "Finished Goods - MF";

////////function DailyStockSummary() {
////////  const [date, setDate] = useState(
////////    new Date().toISOString().slice(0, 10) // today
////////  );
////////  const [rows, setRows] = useState([]);
////////  const [expandedGroups, setExpandedGroups] = useState({});
////////  const [loading, setLoading] = useState(false);
////////  const [error, setError] = useState("");

////////  function makeTs(entry) {
////////    // "YYYY-MM-DD HH:MM:SS"
////////    return `${entry.posting_date} ${entry.posting_time || "00:00:00"}`;
////////  }

////////  async function loadData(selectedDate) {
////////    setLoading(true);
////////    setError("");
////////    setRows([]);
////////    setExpandedGroups({});

////////    try {
////////      const todayStr = new Date().toISOString().slice(0, 10);

////////      // 1) SLE up to selected date (for opening + daily movement)
////////      // 2) SLE up to today (for current stock "now")
////////      // 3) Item master for item_name
////////      // 4) Stock Reconciliation docs ON selected date
////////      // 5) BOM list
////////      const [
////////        sleToSelected,
////////        sleToToday,
////////        items,
////////        reconDocs,
////////        bomList,
////////      ] = await Promise.all([
////////        getStockLedgerUpToDate(selectedDate),
////////        getStockLedgerUpToDate(todayStr),
////////        getAllItems(),
////////        getDoctypeList("Stock Reconciliation", {
////////          fields: JSON.stringify(["name", "posting_date", "docstatus"]),
////////          filters: JSON.stringify([
////////            ["Stock Reconciliation", "posting_date", "=", selectedDate],
////////            ["Stock Reconciliation", "docstatus", "=", 1],
////////          ]),
////////          limit_page_length: 500,
////////        }),
////////        getDoctypeList("BOM", {
////////          fields: JSON.stringify(["name", "item", "is_active", "docstatus"]),
////////          filters: JSON.stringify([
////////            ["BOM", "docstatus", "=", 1],
////////            ["BOM", "is_active", "=", 1],
////////          ]),
////////          limit_page_length: 500,
////////        }),
////////      ]);

////////      // item_code -> item_name
////////      const itemMap = {};
////////      items.forEach((it) => {
////////        itemMap[it.name] = it.item_name;
////////      });

////////      // set of reconciliation voucher_nos (so we can identify their SLEs)
////////      const reconNameSet = new Set(reconDocs.map((d) => d.name));

////////      // BOM maps
////////      const rawToFinishedMap = {}; // raw item_code -> Set of finished item_codes
////////      const finishedToRawMap = {}; // finished item_code -> Set of raw item_codes

////////      // Build BOM maps
////////      for (const bom of bomList) {
////////        try {
////////          const bomDoc = await getDoc("BOM", bom.name);
////////          const finishedItem = bom.item;
////////          if (!finishedItem) continue;

////////          (bomDoc.items || []).forEach((line) => {
////////            const rawItem = line.item_code;
////////            if (!rawItem) return;

////////            if (!rawToFinishedMap[rawItem]) {
////////              rawToFinishedMap[rawItem] = new Set();
////////            }
////////            rawToFinishedMap[rawItem].add(finishedItem);

////////            if (!finishedToRawMap[finishedItem]) {
////////              finishedToRawMap[finishedItem] = new Set();
////////            }
////////            finishedToRawMap[finishedItem].add(rawItem);
////////          });
////////        } catch (e) {
////////          console.error("Failed to load BOM", bom.name, e);
////////        }
////////      }

////////      // maps keyed by "item_code||warehouse"
////////      const openingMap = {}; // opening qty at start of selected day
////////      const inMap = {}; // normal IN qty on selected day
////////      const outMap = {}; // normal OUT qty on selected day
////////      const adjustmentMap = {}; // reconciliation delta on selected day
////////      const soldMap = {}; // sold qty (Sales Invoice OUT) on selected day
////////      const goodReturnMap = {}; // good return qty (Sales Invoice IN to GOOD_RETURN_WH) on selected day
////////      const currentMap = {}; // current qty "now" (end of today)

////////      // helper maps to track latest SLE for opening & current
////////      const lastBeforeDay = {}; // latest entry BEFORE selected date
////////      const lastTillToday = {}; // latest entry up to today

////////      // ---------- 1) Opening & daily movement from SLE ----------

////////      sleToSelected.forEach((entry) => {
////////        const itemCode = entry.item_code;
////////        const warehouse = entry.warehouse;
////////        if (!itemCode || !warehouse) return;

////////        const key = `${itemCode}||${warehouse}`;
////////        const qty = parseFloat(entry.actual_qty) || 0;
////////        const balance = parseFloat(entry.qty_after_transaction) || 0;
////////        const rawVtype = entry.voucher_type || "";
////////        const vtype =
////////          typeof rawVtype === "string" ? rawVtype.trim() : rawVtype;
////////        const entryDate = entry.posting_date;
////////        const ts = makeTs(entry);

////////        const isRecon = reconNameSet.has(entry.voucher_no);

////////        // Track latest entry BEFORE selected date for opening
////////        if (entryDate < selectedDate) {
////////          const existing = lastBeforeDay[key];
////////          if (!existing || ts > existing.ts) {
////////            lastBeforeDay[key] = { ts, balance };
////////          }
////////        }

////////        // Movement ON the selected date
////////        if (entryDate === selectedDate) {
////////          // Normal IN / OUT: we EXCLUDE entries that belong
////////          // to Stock Reconciliation vouchers (we'll compute their
////////          // effect from the Stock Reconciliation doc itself)
////////          if (!isRecon) {
////////            if (qty > 0) {
////////              inMap[key] = (inMap[key] || 0) + qty;
////////            } else if (qty < 0) {
////////              outMap[key] = (outMap[key] || 0) + Math.abs(qty);
////////            }
////////          }

////////          // Sales Invoice movements for Sold and Good Return
////////          if (vtype === "Sales Invoice") {
////////            // sold = stock going OUT
////////            if (qty < 0) {
////////              soldMap[key] = (soldMap[key] || 0) + Math.abs(qty);
////////            }
////////            // good return = positive qty into GOOD_RETURN_WH
////////            if (qty > 0 && warehouse === GOOD_RETURN_WH) {
////////              goodReturnMap[key] = (goodReturnMap[key] || 0) + qty;
////////            }
////////          }
////////        }
////////      });

////////      // Build openingMap from lastBeforeDay balances
////////      Object.keys(lastBeforeDay).forEach((key) => {
////////        openingMap[key] = lastBeforeDay[key].balance;
////////      });

////////      // ---------- 2) Adjustment from Stock Reconciliation docs ----------

////////      for (const recon of reconDocs) {
////////        const doc = await getDoc("Stock Reconciliation", recon.name);
////////        const items = doc.items || [];

////////        items.forEach((it) => {
////////          const itemCode = it.item_code;
////////          const warehouse = it.warehouse;
////////          if (!itemCode || !warehouse) return;

////////          const key = `${itemCode}||${warehouse}`;
////////          const currentQty = parseFloat(it.current_qty || 0); // before reconciliation
////////          const newQty = parseFloat(it.qty || 0); // after reconciliation
////////          const delta = newQty - currentQty; // +increase / -decrease

////////          adjustmentMap[key] = (adjustmentMap[key] || 0) + delta;
////////        });
////////      }

////////      // ---------- 3) Current stock "now" from SLE ----------

////////      sleToToday.forEach((entry) => {
////////        const itemCode = entry.item_code;
////////        const warehouse = entry.warehouse;
////////        if (!itemCode || !warehouse) return;

////////        const key = `${itemCode}||${warehouse}`;
////////        const balance = parseFloat(entry.qty_after_transaction) || 0;
////////        const ts = makeTs(entry);

////////        const existing = lastTillToday[key];
////////        if (!existing || ts > existing.ts) {
////////          lastTillToday[key] = { ts, balance };
////////        }
////////      });

////////      Object.keys(lastTillToday).forEach((key) => {
////////        currentMap[key] = lastTillToday[key].balance;
////////      });

////////      // ---------- 4) Build final row array (flat) ----------

////////      const keys = new Set([
////////        ...Object.keys(openingMap),
////////        ...Object.keys(inMap),
////////        ...Object.keys(outMap),
////////        ...Object.keys(adjustmentMap),
////////        ...Object.keys(soldMap),
////////        ...Object.keys(goodReturnMap),
////////        ...Object.keys(currentMap),
////////      ]);

////////      const result = Array.from(keys).map((key) => {
////////        const [item_code, warehouse] = key.split("||");
////////        const opening = openingMap[key] || 0;
////////        const inQty = inMap[key] || 0;
////////        const outQty = outMap[key] || 0;
////////        const adjQty = adjustmentMap[key] || 0;
////////        const soldQty = soldMap[key] || 0;
////////        const returnQty = goodReturnMap[key] || 0;
////////        const currentStock = currentMap[key] || 0;

////////        return {
////////          item_code,
////////          item_name: itemMap[item_code] || "",
////////          warehouse,
////////          opening_stock: opening,
////////          in_qty: inQty,
////////          out_qty: outQty,
////////          adjustment_qty: adjQty, // signed: +increase, -decrease
////////          sold_qty: soldQty,
////////          good_return_qty: returnQty,
////////          current_stock: currentStock, // live stock now
////////        };
////////      });

////////      // sort by warehouse then item (base order)
////////      result.sort((a, b) => {
////////        if (a.warehouse === b.warehouse) {
////////          return a.item_code.localeCompare(b.item_code);
////////        }
////////        return a.warehouse.localeCompare(b.warehouse);
////////      });

////////      // ---------- 5) Decide which raw component is the "parent" for each finished item ----------

////////      const chosenParentOfFinished = {}; // finished item -> chosen raw parent

////////      Object.keys(finishedToRawMap).forEach((finishedItem) => {
////////        const rawItems = Array.from(finishedToRawMap[finishedItem]);
////////        if (rawItems.length === 0) return;

////////        // Prefer items whose name looks like "Raw ..." (Raw Sattu) if present.
////////        let bestParent = rawItems[0];

////////        rawItems.forEach((rawCode) => {
////////          const name = (itemMap[rawCode] || rawCode).toLowerCase();
////////          const bestName = (itemMap[bestParent] || bestParent).toLowerCase();

////////          const isRawLike =
////////            name.startsWith("raw ") || name.includes(" raw ");
////////          const bestIsRawLike =
////////            bestName.startsWith("raw ") || bestName.includes(" raw ");

////////          if (isRawLike && !bestIsRawLike) {
////////            bestParent = rawCode;
////////          } else if (isRawLike === bestIsRawLike) {
////////            // tie-breaker: alphabetical by code
////////            if (rawCode < bestParent) bestParent = rawCode;
////////          }
////////        });

////////        chosenParentOfFinished[finishedItem] = bestParent;
////////      });

////////      const parentToChildren = {}; // chosen parent raw -> Set of finished items
////////      Object.entries(chosenParentOfFinished).forEach(
////////        ([finishedItem, parentRaw]) => {
////////          if (!parentToChildren[parentRaw]) {
////////            parentToChildren[parentRaw] = new Set();
////////          }
////////          parentToChildren[parentRaw].add(finishedItem);
////////        }
////////      );

////////      // ---------- 6) Build grouped rows with headers ----------

////////      const rowsByItemCode = {};
////////      result.forEach((row) => {
////////        if (!rowsByItemCode[row.item_code]) {
////////          rowsByItemCode[row.item_code] = [];
////////        }
////////        rowsByItemCode[row.item_code].push(row);
////////      });

////////      const makeRowKey = (row) => `${row.warehouse}||${row.item_code}`;
////////      const usedKeys = new Set();
////////      const finalRows = [];

////////      // Parents: union of "chosen parents" and all BOM raw items
////////      const parentCandidateSet = new Set([
////////        ...Object.keys(parentToChildren),
////////        ...Object.keys(rawToFinishedMap),
////////      ]);

////////      const parentCodes = Array.from(parentCandidateSet).sort((a, b) => {
////////        const nA = (itemMap[a] || a).toLowerCase();
////////        const nB = (itemMap[b] || b).toLowerCase();
////////        if (nA === nB) return a.localeCompare(b);
////////        return nA.localeCompare(nB);
////////      });

////////      parentCodes.forEach((parentCode) => {
////////        const parentRows = rowsByItemCode[parentCode] || [];

////////        // Only create a heading if this parent itself has stock rows
////////        if (parentRows.length === 0) {
////////          return;
////////        }

////////        const childItemCodes = Array.from(
////////          parentToChildren[parentCode] || []
////////        ).sort((a, b) => {
////////          const nA = (itemMap[a] || a).toLowerCase();
////////          const nB = (itemMap[b] || b).toLowerCase();
////////          if (nA === nB) return a.localeCompare(b);
////////          return nA.localeCompare(nB);
////////        });

////////        // Group header row for this parent
////////        finalRows.push({
////////          is_group_header: true,
////////          group_item_code: parentCode,
////////          group_label: itemMap[parentCode] || parentCode,
////////        });

////////        // Parent's own stock rows (raw material / pouch / sticker itself)
////////        parentRows.forEach((row) => {
////////          const key = makeRowKey(row);
////////          if (usedKeys.has(key)) return;
////////          usedKeys.add(key);

////////          finalRows.push({
////////            ...row,
////////            is_parent_item: true,
////////            parent_item_code: null,
////////            group_item_code: parentCode,
////////          });
////////        });

////////        // Child rows (finished goods made from this raw), only if child rows exist
////////        childItemCodes.forEach((fgCode) => {
////////          const childRows = rowsByItemCode[fgCode] || [];
////////          childRows.forEach((row) => {
////////            const key = makeRowKey(row);
////////            if (usedKeys.has(key)) return;
////////            usedKeys.add(key);

////////            finalRows.push({
////////              ...row,
////////              parent_item_code: parentCode,
////////              group_item_code: parentCode,
////////            });
////////          });
////////        });
////////      });

////////      // Any leftover rows that do not participate in this parent-child relationship
////////      result.forEach((row) => {
////////        const key = makeRowKey(row);
////////        if (usedKeys.has(key)) return;
////////        finalRows.push(row);
////////      });

////////      // Default: all groups expanded
////////      const newExpanded = {};
////////      finalRows.forEach((r) => {
////////        if (r.is_group_header) {
////////          newExpanded[r.group_item_code] = true;
////////        }
////////      });

////////      setRows(finalRows);
////////      setExpandedGroups(newExpanded);
////////    } catch (err) {
////////      console.error(err);
////////      setError(err.message || "Failed to load daily stock summary");
////////    } finally {
////////      setLoading(false);
////////    }
////////  }

////////  useEffect(() => {
////////    loadData(date);
////////    // eslint-disable-next-line react-hooks/exhaustive-deps
////////  }, [date]);

////////  // Count visible (non-header) rows, respecting collapsed groups
////////  const visibleRowCount = rows.reduce((count, r) => {
////////    if (r.is_group_header) return count;
////////    if (r.group_item_code && expandedGroups[r.group_item_code] === false) {
////////      return count;
////////    }
////////    return count + 1;
////////  }, 0);

////////  return (
////////    <div className="daily-stock-summary">
////////      {/* Header */}
////////      <div className="daily-stock-summary-header-row">
////////        <div className="daily-stock-summary-header">
////////          <h2 className="daily-stock-summary-title">Daily Stock Summary</h2>
////////          <p className="daily-stock-summary-subtitle">
////////            Opening, movement &amp; balances by warehouse for the selected date
////////          </p>
////////        </div>

////////        <div className="daily-stock-summary-controls">
////////          <span className="daily-stock-summary-date-label">Date</span>
////////          <input
////////            type="date"
////////            className="input daily-stock-summary-date-input"
////////            value={date}
////////            onChange={(e) => setDate(e.target.value)}
////////          />
////////          <button
////////            type="button"
////////            className="btn btn-primary btn-sm daily-stock-summary-refresh"
////////            onClick={() => loadData(date)}
////////          >
////////            Refresh
////////          </button>
////////        </div>
////////      </div>

////////      {/* Meta */}
////////      <div className="daily-stock-summary-meta-row">
////////        <span className="daily-stock-summary-meta">
////////          Showing {visibleRowCount} line{visibleRowCount !== 1 ? "s" : ""}
////////        </span>
////////      </div>

////////      {/* States */}
////////      {loading && (
////////        <p className="daily-stock-summary-loading text-muted">
////////          Loading stock summary...
////////        </p>
////////      )}
////////      {error && (
////////        <p className="daily-stock-summary-error alert alert-error">
////////          {error}
////////        </p>
////////      )}
////////      {!loading && !error && rows.length === 0 && (
////////        <p className="daily-stock-summary-empty text-muted">
////////          No stock movement found up to this date.
////////        </p>
////////      )}

////////      {/* Table */}
////////      {!loading && !error && rows.length > 0 && (
////////        <div className="daily-stock-summary-table-wrapper">
////////          <table className="daily-stock-summary-table">
////////            <thead>
////////              <tr>
////////                <th>Warehouse</th>
////////                <th>Item</th>
////////                <th>Opening Stock</th>
////////                <th>In Qty (on date)</th>
////////                <th>Out Qty (on date)</th>
////////                <th>Adjustment (Reconciliation)</th>
////////                <th>Sold Qty (on date)</th>
////////                <th>Return Qty (Good, on date)</th>
////////                <th>Current Stock (now)</th>
////////              </tr>
////////            </thead>
////////            <tbody>
////////              {rows.map((r, idx) => {
////////                // 📦 Group header row, clickable to expand/collapse
////////                if (r.is_group_header) {
////////                  const isOpen = expandedGroups[r.group_item_code] !== false;
////////                  return (
////////                    <tr
////////                      key={`group-${r.group_item_code}-${idx}`}
////////                      className="daily-stock-summary-group-row"
////////                      onClick={() =>
////////                        setExpandedGroups((prev) => ({
////////                          ...prev,
////////                          [r.group_item_code]: !isOpen,
////////                        }))
////////                      }
////////                    >
////////                      <td
////////                        className="daily-stock-summary-group-header"
////////                        colSpan={9}
////////                      >
////////                        <span className="daily-stock-summary-group-icon">
////////                          📦
////////                        </span>{" "}
////////                        {r.group_label}
////////                        <span className="daily-stock-summary-group-toggle">
////////                          {isOpen ? "▾" : "▸"}
////////                        </span>
////////                      </td>
////////                    </tr>
////////                  );
////////                }

////////                // Hide rows belonging to collapsed group
////////                if (
////////                  r.group_item_code &&
////////                  expandedGroups[r.group_item_code] === false
////////                ) {
////////                  return null;
////////                }

////////                const isParent = r.is_parent_item;
////////                const isChild =
////////                  !!r.parent_item_code && !r.is_parent_item;

////////                // Only show one line if code == name
////////                const hasName = !!r.item_name;
////////                const topLabel = hasName ? r.item_name : r.item_code;
////////                const showSecondLine =
////////                  hasName && r.item_name !== r.item_code;
////////                const secondLabel = showSecondLine ? r.item_code : "";

////////                return (
////////                  <tr
////////                    key={`${r.warehouse}||${r.item_code}||${
////////                      r.parent_item_code || ""
////////                    }`}
////////                    className={[
////////                      isParent ? "daily-stock-summary-row-parent" : "",
////////                      isChild ? "daily-stock-summary-row-child" : "",
////////                    ]
////////                      .join(" ")
////////                      .trim()}
////////                  >
////////                    <td className="daily-stock-summary-warehouse">
////////                      {r.warehouse}
////////                    </td>
////////                    <td className="daily-stock-summary-item">
////////                      <div className="daily-stock-summary-item-code">
////////                        {topLabel}
////////                      </div>
////////                      {secondLabel && (
////////                        <div className="daily-stock-summary-item-name">
////////                          {secondLabel}
////////                        </div>
////////                      )}
////////                    </td>
////////                    <td className="daily-stock-summary-opening">
////////                      {r.opening_stock || 0}
////////                    </td>
////////                    <td className="daily-stock-summary-inqty">
////////                      {r.in_qty || 0}
////////                    </td>
////////                    <td className="daily-stock-summary-outqty">
////////                      {r.out_qty || 0}
////////                    </td>
////////                    <td className="daily-stock-summary-adjustment">
////////                      {r.adjustment_qty || 0}
////////                    </td>
////////                    <td className="daily-stock-summary-sold">
////////                      {r.sold_qty || 0}
////////                    </td>
////////                    <td className="daily-stock-summary-returns">
////////                      {r.good_return_qty || 0}
////////                    </td>
////////                    <td className="daily-stock-summary-current">
////////                      {r.current_stock || 0}
////////                    </td>
////////                  </tr>
////////                );
////////              })}
////////            </tbody>
////////          </table>
////////        </div>
////////      )}
////////    </div>
////////  );
////////}

////////export default DailyStockSummary;


//////// src/Components/DailyStockSummary.jsx
//////import React, { useEffect, useState } from "react";
//////import {
//////  getStockLedgerUpToDate,
//////  getAllItems,
//////  getDoctypeList,
//////  getDoc,
//////} from "./erpBackendApi";
//////import "../CSS/DailyStockSummary.css";

//////// Must match GOOD_RETURN_WH used in createSalesReturn / stock-return logic
//////const GOOD_RETURN_WH = "Finished Goods - MF";

//////function DailyStockSummary() {
//////  const [date, setDate] = useState(
//////    new Date().toISOString().slice(0, 10) // today
//////  );
//////  const [rows, setRows] = useState([]);
//////  const [expandedGroups, setExpandedGroups] = useState({});
//////  const [loading, setLoading] = useState(false);
//////  const [error, setError] = useState("");

//////  function makeTs(entry) {
//////    // "YYYY-MM-DD HH:MM:SS"
//////    return `${entry.posting_date} ${entry.posting_time || "00:00:00"}`;
//////  }

//////  async function loadData(selectedDate) {
//////    setLoading(true);
//////    setError("");
//////    setRows([]);
//////    setExpandedGroups({});

//////    try {
//////      const todayStr = new Date().toISOString().slice(0, 10);

//////      // 1) SLE up to selected date (for opening + daily movement)
//////      // 2) SLE up to today (for current stock "now")
//////      // 3) Item master for item_name
//////      // 4) Stock Reconciliation docs ON selected date
//////      // 5) BOM list
//////      const [sleToSelected, sleToToday, items, reconDocs, bomList] =
//////        await Promise.all([
//////          getStockLedgerUpToDate(selectedDate),
//////          getStockLedgerUpToDate(todayStr),
//////          getAllItems(),
//////          getDoctypeList("Stock Reconciliation", {
//////            fields: JSON.stringify(["name", "posting_date", "docstatus"]),
//////            filters: JSON.stringify([
//////              ["Stock Reconciliation", "posting_date", "=", selectedDate],
//////              ["Stock Reconciliation", "docstatus", "=", 1],
//////            ]),
//////            limit_page_length: 500,
//////          }),
//////          getDoctypeList("BOM", {
//////            fields: JSON.stringify(["name", "item", "is_active", "docstatus"]),
//////            filters: JSON.stringify([
//////              ["BOM", "docstatus", "=", 1],
//////              ["BOM", "is_active", "=", 1],
//////            ]),
//////            limit_page_length: 500,
//////          }),
//////        ]);

//////      // item_code -> item_name
//////      const itemMap = {};
//////      items.forEach((it) => {
//////        itemMap[it.name] = it.item_name;
//////      });

//////      // set of reconciliation voucher_nos (so we can identify their SLEs)
//////      const reconNameSet = new Set(reconDocs.map((d) => d.name));

//////      // BOM maps
//////      const rawToFinishedMap = {}; // raw item_code -> Set of finished item_codes
//////      const finishedToRawMap = {}; // finished item_code -> Set of raw item_codes

//////      // Build BOM maps
//////      for (const bom of bomList) {
//////        try {
//////          const bomDoc = await getDoc("BOM", bom.name);
//////          const finishedItem = bom.item;
//////          if (!finishedItem) continue;

//////          (bomDoc.items || []).forEach((line) => {
//////            const rawItem = line.item_code;
//////            if (!rawItem) return;

//////            if (!rawToFinishedMap[rawItem]) {
//////              rawToFinishedMap[rawItem] = new Set();
//////            }
//////            rawToFinishedMap[rawItem].add(finishedItem);

//////            if (!finishedToRawMap[finishedItem]) {
//////              finishedToRawMap[finishedItem] = new Set();
//////            }
//////            finishedToRawMap[finishedItem].add(rawItem);
//////          });
//////        } catch (e) {
//////          console.error("Failed to load BOM", bom.name, e);
//////        }
//////      }

//////      // maps keyed by "item_code||warehouse"
//////      const openingMap = {}; // opening qty at start of selected day
//////      const inMap = {}; // normal IN qty on selected day
//////      const outMap = {}; // normal OUT qty on selected day
//////      const adjustmentMap = {}; // reconciliation delta on selected day
//////      const soldMap = {}; // sold qty (Sales Invoice OUT) on selected day
//////      const goodReturnMap = {}; // good return qty (Sales Invoice IN to GOOD_RETURN_WH) on selected day
//////      const currentMap = {}; // current qty "now" (end of today)

//////      // helper maps to track latest SLE for opening & current
//////      const lastBeforeDay = {}; // latest entry BEFORE selected date
//////      const lastTillToday = {}; // latest entry up to today

//////      // ---------- 1) Opening & daily movement from SLE ----------

//////      sleToSelected.forEach((entry) => {
//////        const itemCode = entry.item_code;
//////        const warehouse = entry.warehouse;
//////        if (!itemCode || !warehouse) return;

//////        const key = `${itemCode}||${warehouse}`;
//////        const qty = parseFloat(entry.actual_qty) || 0;
//////        const balance = parseFloat(entry.qty_after_transaction) || 0;
//////        const rawVtype = entry.voucher_type || "";
//////        const vtype =
//////          typeof rawVtype === "string" ? rawVtype.trim() : rawVtype;
//////        const entryDate = entry.posting_date;
//////        const ts = makeTs(entry);

//////        const isRecon = reconNameSet.has(entry.voucher_no);

//////        // Track latest entry BEFORE selected date for opening
//////        if (entryDate < selectedDate) {
//////          const existing = lastBeforeDay[key];
//////          if (!existing || ts > existing.ts) {
//////            lastBeforeDay[key] = { ts, balance };
//////          }
//////        }

//////        // Movement ON the selected date
//////        if (entryDate === selectedDate) {
//////          // Normal IN / OUT: we EXCLUDE Stock Reconciliation SLEs
//////          if (!isRecon) {
//////            if (qty > 0) {
//////              inMap[key] = (inMap[key] || 0) + qty;
//////            } else if (qty < 0) {
//////              outMap[key] = (outMap[key] || 0) + Math.abs(qty);
//////            }
//////          }

//////          // Sales Invoice movements for Sold and Good Return
//////          if (vtype === "Sales Invoice") {
//////            // sold = stock going OUT
//////            if (qty < 0) {
//////              soldMap[key] = (soldMap[key] || 0) + Math.abs(qty);
//////            }
//////            // good return = positive qty into GOOD_RETURN_WH
//////            if (qty > 0 && warehouse === GOOD_RETURN_WH) {
//////              goodReturnMap[key] = (goodReturnMap[key] || 0) + qty;
//////            }
//////          }
//////        }
//////      });

//////      // Build openingMap from lastBeforeDay balances
//////      Object.keys(lastBeforeDay).forEach((key) => {
//////        openingMap[key] = lastBeforeDay[key].balance;
//////      });

//////      // ---------- 2) Adjustment from Stock Reconciliation docs ----------

//////      for (const recon of reconDocs) {
//////        const doc = await getDoc("Stock Reconciliation", recon.name);
//////        const recItems = doc.items || [];

//////        recItems.forEach((it) => {
//////          const itemCode = it.item_code;
//////          const warehouse = it.warehouse;
//////          if (!itemCode || !warehouse) return;

//////          const key = `${itemCode}||${warehouse}`;
//////          const currentQty = parseFloat(it.current_qty || 0); // before reconciliation
//////          const newQty = parseFloat(it.qty || 0); // after reconciliation
//////          const delta = newQty - currentQty; // +increase / -decrease

//////          adjustmentMap[key] = (adjustmentMap[key] || 0) + delta;
//////        });
//////      }

//////      // ---------- 3) Current stock "now" from SLE ----------

//////      sleToToday.forEach((entry) => {
//////        const itemCode = entry.item_code;
//////        const warehouse = entry.warehouse;
//////        if (!itemCode || !warehouse) return;

//////        const key = `${itemCode}||${warehouse}`;
//////        const balance = parseFloat(entry.qty_after_transaction) || 0;
//////        const ts = makeTs(entry);

//////        const existing = lastTillToday[key];
//////        if (!existing || ts > existing.ts) {
//////          lastTillToday[key] = { ts, balance };
//////        }
//////      });

//////      Object.keys(lastTillToday).forEach((key) => {
//////        currentMap[key] = lastTillToday[key].balance;
//////      });

//////      // ---------- 4) Build base flat rows (no grouping yet) ----------

//////      const keys = new Set([
//////        ...Object.keys(openingMap),
//////        ...Object.keys(inMap),
//////        ...Object.keys(outMap),
//////        ...Object.keys(adjustmentMap),
//////        ...Object.keys(soldMap),
//////        ...Object.keys(goodReturnMap),
//////        ...Object.keys(currentMap),
//////      ]);

//////      const result = Array.from(keys).map((key) => {
//////        const [item_code, warehouse] = key.split("||");
//////        const opening = openingMap[key] || 0;
//////        const inQty = inMap[key] || 0;
//////        const outQty = outMap[key] || 0;
//////        const adjQty = adjustmentMap[key] || 0;
//////        const soldQty = soldMap[key] || 0;
//////        const returnQty = goodReturnMap[key] || 0;
//////        const currentStock = currentMap[key] || 0;

//////        return {
//////          item_code,
//////          item_name: itemMap[item_code] || "",
//////          warehouse,
//////          opening_stock: opening,
//////          in_qty: inQty,
//////          out_qty: outQty,
//////          adjustment_qty: adjQty, // signed: +increase, -decrease
//////          sold_qty: soldQty,
//////          good_return_qty: returnQty,
//////          current_stock: currentStock, // live stock now
//////        };
//////      });

//////      // sort by warehouse then item (base deterministic order)
//////      result.sort((a, b) => {
//////        if (a.warehouse === b.warehouse) {
//////          return a.item_code.localeCompare(b.item_code);
//////        }
//////        return a.warehouse.localeCompare(b.warehouse);
//////      });

//////      // ---------- 5) Decide which raw component is the parent for each finished item ----------

//////      const chosenParentOfFinished = {}; // finished item -> chosen raw parent

//////      Object.keys(finishedToRawMap).forEach((finishedItem) => {
//////        const rawItems = Array.from(finishedToRawMap[finishedItem]);
//////        if (rawItems.length === 0) return;

//////        // Prefer items whose name looks like "Raw ..." (Raw Sattu) if present.
//////        let bestParent = rawItems[0];

//////        rawItems.forEach((rawCode) => {
//////          const name = (itemMap[rawCode] || rawCode).toLowerCase();
//////          const bestName = (itemMap[bestParent] || bestParent).toLowerCase();

//////          const isRawLike =
//////            name.startsWith("raw ") || name.includes(" raw ");
//////          const bestIsRawLike =
//////            bestName.startsWith("raw ") || bestName.includes(" raw ");

//////          if (isRawLike && !bestIsRawLike) {
//////            bestParent = rawCode;
//////          } else if (isRawLike === bestIsRawLike) {
//////            // tie-breaker: alphabetical by code
//////            if (rawCode < bestParent) bestParent = rawCode;
//////          }
//////        });

//////        chosenParentOfFinished[finishedItem] = bestParent;
//////      });

//////      const parentToChildren = {}; // chosen parent raw -> Set of finished items
//////      Object.entries(chosenParentOfFinished).forEach(
//////        ([finishedItem, parentRaw]) => {
//////          if (!parentToChildren[parentRaw]) {
//////            parentToChildren[parentRaw] = new Set();
//////          }
//////          parentToChildren[parentRaw].add(finishedItem);
//////        }
//////      );

//////      // ---------- 6) Build grouped rows with headers ----------
//////      //  - same parent/child behaviour as before
//////      //  - BUT: if a BOM parent has *no* rows at all (no stock, no child rows),
//////      //    we still add a dummy detail row with zeros so it's not just a heading.
//////      //  - groups with movement today stay on top.

//////      const rowsByItemCode = {};
//////      result.forEach((row) => {
//////        if (!rowsByItemCode[row.item_code]) {
//////          rowsByItemCode[row.item_code] = [];
//////        }
//////        rowsByItemCode[row.item_code].push(row);
//////      });

//////      const makeRowKey = (row) => `${row.warehouse}||${row.item_code}`;

//////      // Map: finished item -> its parent raw (for movement grouping)
//////      const parentForItem = {};
//////      Object.entries(chosenParentOfFinished).forEach(
//////        ([finishedItem, parentRaw]) => {
//////          parentForItem[finishedItem] = parentRaw;
//////        }
//////      );

//////      // Which groups had any movement on the selected date?
//////      const groupMovement = {}; // group item_code -> boolean
//////      result.forEach((row) => {
//////        const groupCode = parentForItem[row.item_code] || row.item_code;
//////        const hasMovement =
//////          (row.in_qty || 0) !== 0 ||
//////          (row.out_qty || 0) !== 0 ||
//////          (row.adjustment_qty || 0) !== 0 ||
//////          (row.sold_qty || 0) !== 0 ||
//////          (row.good_return_qty || 0) !== 0;

//////        if (hasMovement) {
//////          groupMovement[groupCode] = true;
//////        }
//////      });

//////      const usedKeys = new Set();
//////      const finalRows = [];

//////      // Parents: union of "chosen parents" and all BOM raw items
//////      const parentCandidateSet = new Set([
//////        ...Object.keys(parentToChildren),
//////        ...Object.keys(rawToFinishedMap),
//////      ]);

//////      const parentCodes = Array.from(parentCandidateSet).sort((a, b) => {
//////        const aMove = !!groupMovement[a];
//////        const bMove = !!groupMovement[b];
//////        if (aMove !== bMove) return aMove ? -1 : 1; // groups with movement first

//////        const nA = (itemMap[a] || a).toLowerCase();
//////        const nB = (itemMap[b] || b).toLowerCase();
//////        if (nA === nB) return a.localeCompare(b);
//////        return nA.localeCompare(nB);
//////      });

//////      // 6a) BOM parent groups (Raw Sattu, pouches, stickers, etc.)
//////      parentCodes.forEach((parentCode) => {
//////        let parentRows = rowsByItemCode[parentCode] || [];

//////        const childItemCodes = Array.from(
//////          parentToChildren[parentCode] || []
//////        ).sort((a, b) => {
//////          const nA = (itemMap[a] || a).toLowerCase();
//////          const nB = (itemMap[b] || b).toLowerCase();
//////          if (nA === nB) return a.localeCompare(b);
//////          return nA.localeCompare(nB);
//////        });

//////        const hasChildRows = childItemCodes.some(
//////          (fgCode) =>
//////            rowsByItemCode[fgCode] && rowsByItemCode[fgCode].length > 0
//////        );

//////        // 👉 If this parent and all its children have *no* stock rows at all,
//////        // create a single dummy row so we don't show just the heading.
//////        if (parentRows.length === 0 && !hasChildRows) {
//////          parentRows = [
//////            {
//////              item_code: parentCode,
//////              item_name: itemMap[parentCode] || "",
//////              warehouse: "", // no specific warehouse yet
//////              opening_stock: 0,
//////              in_qty: 0,
//////              out_qty: 0,
//////              adjustment_qty: 0,
//////              sold_qty: 0,
//////              good_return_qty: 0,
//////              current_stock: 0,
//////            },
//////          ];
//////        }

//////        // Group header row for this parent – ALWAYS created
//////        finalRows.push({
//////          is_group_header: true,
//////          group_item_code: parentCode,
//////          group_label: itemMap[parentCode] || parentCode,
//////        });

//////        // Parent's own stock rows (raw / pouch / sticker etc.)
//////        parentRows.forEach((row) => {
//////          const key = makeRowKey(row);
//////          if (usedKeys.has(key)) return;
//////          usedKeys.add(key);

//////          finalRows.push({
//////            ...row,
//////            is_parent_item: true,
//////            parent_item_code: null,
//////            group_item_code: parentCode,
//////          });
//////        });

//////        // Child finished goods made from this raw (Products)
//////        childItemCodes.forEach((fgCode) => {
//////          const childRows = rowsByItemCode[fgCode] || [];
//////          childRows.forEach((row) => {
//////            const key = makeRowKey(row);
//////            if (usedKeys.has(key)) return;
//////            usedKeys.add(key);

//////            finalRows.push({
//////              ...row,
//////              parent_item_code: parentCode,
//////              group_item_code: parentCode,
//////            });
//////          });
//////        });
//////      });

//////      // 6b) Any leftover items that are not part of any BOM
//////      //     -> they get a self-header group.
//////      const remainingByItem = {};
//////      result.forEach((row) => {
//////        const key = makeRowKey(row);
//////        if (usedKeys.has(key)) return;

//////        if (!remainingByItem[row.item_code]) {
//////          remainingByItem[row.item_code] = [];
//////        }
//////        remainingByItem[row.item_code].push(row);
//////      });

//////      const remainingItemCodes = Object.keys(remainingByItem).sort((a, b) => {
//////        const aMove = !!groupMovement[a];
//////        const bMove = !!groupMovement[b];
//////        if (aMove !== bMove) return aMove ? -1 : 1; // movement first within this block

//////        const nA = (itemMap[a] || a).toLowerCase();
//////        const nB = (itemMap[b] || b).toLowerCase();
//////        if (nA === nB) return a.localeCompare(b);
//////        return nA.localeCompare(nB);
//////      });

//////      remainingItemCodes.forEach((code) => {
//////        const label = itemMap[code] || code;

//////        // self header
//////        finalRows.push({
//////          is_group_header: true,
//////          group_item_code: code,
//////          group_label: label,
//////        });

//////        // its own rows
//////        remainingByItem[code].forEach((row) => {
//////          const key = makeRowKey(row);
//////          usedKeys.add(key);

//////          finalRows.push({
//////            ...row,
//////            is_parent_item: true,
//////            parent_item_code: null,
//////            group_item_code: code,
//////          });
//////        });
//////      });

//////      // Default: all groups expanded
//////      const newExpanded = {};
//////      finalRows.forEach((r) => {
//////        if (r.is_group_header) {
//////          newExpanded[r.group_item_code] = true;
//////        }
//////      });

//////      setRows(finalRows);
//////      setExpandedGroups(newExpanded);
//////    } catch (err) {
//////      console.error(err);
//////      setError(err.message || "Failed to load daily stock summary");
//////    } finally {
//////      setLoading(false);
//////    }
//////  }

//////  useEffect(() => {
//////    loadData(date);
//////    // eslint-disable-next-line react-hooks/exhaustive-deps
//////  }, [date]);

//////  // Count visible (non-header) rows, respecting collapsed groups
//////  const visibleRowCount = rows.reduce((count, r) => {
//////    if (r.is_group_header) return count;
//////    if (r.group_item_code && expandedGroups[r.group_item_code] === false) {
//////      return count;
//////    }
//////    return count + 1;
//////  }, 0);

//////  return (
//////    <div className="daily-stock-summary">
//////      {/* Header */}
//////      <div className="daily-stock-summary-header-row">
//////        <div className="daily-stock-summary-header">
//////          <h2 className="daily-stock-summary-title">Daily Stock Summary</h2>
//////          <p className="daily-stock-summary-subtitle">
//////            Opening, movement &amp; balances by warehouse for the selected date
//////          </p>
//////        </div>

//////        <div className="daily-stock-summary-controls">
//////          <span className="daily-stock-summary-date-label">Date</span>
//////          <input
//////            type="date"
//////            className="input daily-stock-summary-date-input"
//////            value={date}
//////            onChange={(e) => setDate(e.target.value)}
//////          />
//////          <button
//////            type="button"
//////            className="btn btn-primary btn-sm daily-stock-summary-refresh"
//////            onClick={() => loadData(date)}
//////          >
//////            Refresh
//////          </button>
//////        </div>
//////      </div>

//////      {/* Meta */}
//////      <div className="daily-stock-summary-meta-row">
//////        <span className="daily-stock-summary-meta">
//////          Showing {visibleRowCount} line{visibleRowCount !== 1 ? "s" : ""}
//////        </span>
//////      </div>

//////      {/* States */}
//////      {loading && (
//////        <p className="daily-stock-summary-loading text-muted">
//////          Loading stock summary...
//////        </p>
//////      )}
//////      {error && (
//////        <p className="daily-stock-summary-error alert alert-error">
//////          {error}
//////        </p>
//////      )}
//////      {!loading && !error && rows.length === 0 && (
//////        <p className="daily-stock-summary-empty text-muted">
//////          No stock movement found up to this date.
//////        </p>
//////      )}

//////      {/* Table */}
//////      {!loading && !error && rows.length > 0 && (
//////        <div className="daily-stock-summary-table-wrapper">
//////          <table className="daily-stock-summary-table">
//////            <thead>
//////              <tr>
//////                <th>Warehouse</th>
//////                <th>Item</th>
//////                <th>Opening Stock</th>
//////                <th>In Qty (on date)</th>
//////                <th>Out Qty (on date)</th>
//////                <th>Adjustment (Reconciliation)</th>
//////                <th>Sold Qty (on date)</th>
//////                <th>Return Qty (Good, on date)</th>
//////                <th>Current Stock (now)</th>
//////              </tr>
//////            </thead>
//////            <tbody>
//////              {rows.map((r, idx) => {
//////                // 📦 Group header row, clickable to expand/collapse
//////                if (r.is_group_header) {
//////                  const isOpen = expandedGroups[r.group_item_code] !== false;
//////                  return (
//////                    <tr
//////                      key={`group-${r.group_item_code}-${idx}`}
//////                      className="daily-stock-summary-group-row"
//////                      onClick={() =>
//////                        setExpandedGroups((prev) => ({
//////                          ...prev,
//////                          [r.group_item_code]: !isOpen,
//////                        }))
//////                      }
//////                    >
//////                      <td
//////                        className="daily-stock-summary-group-header"
//////                        colSpan={9}
//////                      >
//////                        <span className="daily-stock-summary-group-icon">
//////                          📦
//////                        </span>{" "}
//////                        {r.group_label}
//////                        <span className="daily-stock-summary-group-toggle">
//////                          {isOpen ? "▾" : "▸"}
//////                        </span>
//////                      </td>
//////                    </tr>
//////                  );
//////                }

//////                // Hide rows belonging to collapsed group
//////                if (
//////                  r.group_item_code &&
//////                  expandedGroups[r.group_item_code] === false
//////                ) {
//////                  return null;
//////                }

//////                const isParent = r.is_parent_item;
//////                const isChild =
//////                  !!r.parent_item_code && !r.is_parent_item;

//////                // Only show one line if code == name
//////                const hasName = !!r.item_name;
//////                const topLabel = hasName ? r.item_name : r.item_code;
//////                const showSecondLine =
//////                  hasName && r.item_name !== r.item_code;
//////                const secondLabel = showSecondLine ? r.item_code : "";

//////                return (
//////                  <tr
//////                    key={`${r.warehouse}||${r.item_code}||${
//////                      r.parent_item_code || ""
//////                    }`}
//////                    className={[
//////                      isParent ? "daily-stock-summary-row-parent" : "",
//////                      isChild ? "daily-stock-summary-row-child" : "",
//////                    ]
//////                      .join(" ")
//////                      .trim()}
//////                  >
//////                    <td className="daily-stock-summary-warehouse">
//////                      {r.warehouse}
//////                    </td>
//////                    <td className="daily-stock-summary-item">
//////                      <div className="daily-stock-summary-item-code">
//////                        {topLabel}
//////                      </div>
//////                      {secondLabel && (
//////                        <div className="daily-stock-summary-item-name">
//////                          {secondLabel}
//////                        </div>
//////                      )}
//////                    </td>
//////                    <td className="daily-stock-summary-opening">
//////                      {r.opening_stock || 0}
//////                    </td>
//////                    <td className="daily-stock-summary-inqty">
//////                      {r.in_qty || 0}
//////                    </td>
//////                    <td className="daily-stock-summary-outqty">
//////                      {r.out_qty || 0}
//////                    </td>
//////                    <td className="daily-stock-summary-adjustment">
//////                      {r.adjustment_qty || 0}
//////                    </td>
//////                    <td className="daily-stock-summary-sold">
//////                      {r.sold_qty || 0}
//////                    </td>
//////                    <td className="daily-stock-summary-returns">
//////                      {r.good_return_qty || 0}
//////                    </td>
//////                    <td className="daily-stock-summary-current">
//////                      {r.current_stock || 0}
//////                    </td>
//////                  </tr>
//////                );
//////              })}
//////            </tbody>
//////          </table>
//////        </div>
//////      )}
//////    </div>
//////  );
//////}

//////export default DailyStockSummary;


////// src/Components/DailyStockSummary.jsx
////import React, { useEffect, useState } from "react";
////import {
////  getStockLedgerUpToDate,
////  getAllItems,
////  getDoctypeList,
////  getDoc,
////} from "./erpBackendApi";
////import "../CSS/DailyStockSummary.css";

////// Must match GOOD_RETURN_WH used in createSalesReturn / stock-return logic
////const GOOD_RETURN_WH = "Finished Goods - MF";

////function DailyStockSummary() {
////  const [date, setDate] = useState(
////    new Date().toISOString().slice(0, 10) // today
////  );
////  const [rows, setRows] = useState([]);
////  const [expandedGroups, setExpandedGroups] = useState({});
////  const [loading, setLoading] = useState(false);
////  const [error, setError] = useState("");

////  function makeTs(entry) {
////    // "YYYY-MM-DD HH:MM:SS"
////    return `${entry.posting_date} ${entry.posting_time || "00:00:00"}`;
////  }

////  async function loadData(selectedDate) {
////    setLoading(true);
////    setError("");
////    setRows([]);
////    setExpandedGroups({});

////    try {
////      const todayStr = new Date().toISOString().slice(0, 10);

////      // 1) SLE up to selected date (for opening + daily movement)
////      // 2) SLE up to today (for current stock "now")
////      // 3) Item master for item_name
////      // 4) Stock Reconciliation docs ON selected date
////      // 5) BOM list
////      const [sleToSelected, sleToToday, items, reconDocs, bomList] =
////        await Promise.all([
////          getStockLedgerUpToDate(selectedDate),
////          getStockLedgerUpToDate(todayStr),
////          getAllItems(),
////          getDoctypeList("Stock Reconciliation", {
////            fields: JSON.stringify(["name", "posting_date", "docstatus"]),
////            filters: JSON.stringify([
////              ["Stock Reconciliation", "posting_date", "=", selectedDate],
////              ["Stock Reconciliation", "docstatus", "=", 1],
////            ]),
////            limit_page_length: 500,
////          }),
////          getDoctypeList("BOM", {
////            fields: JSON.stringify(["name", "item", "is_active", "docstatus"]),
////            filters: JSON.stringify([
////              ["BOM", "docstatus", "=", 1],
////              ["BOM", "is_active", "=", 1],
////            ]),
////            limit_page_length: 500,
////          }),
////        ]);

////      // item_code -> item_name
////      const itemMap = {};
////      items.forEach((it) => {
////        itemMap[it.name] = it.item_name;
////      });

////      // set of reconciliation voucher_nos (so we can identify their SLEs)
////      const reconNameSet = new Set(reconDocs.map((d) => d.name));

////      // BOM maps
////      const rawToFinishedMap = {}; // raw item_code -> Set of finished item_codes
////      const finishedToRawMap = {}; // finished item_code -> Set of raw item_codes

////      // Build BOM maps
////      for (const bom of bomList) {
////        try {
////          const bomDoc = await getDoc("BOM", bom.name);
////          const finishedItem = bom.item;
////          if (!finishedItem) continue;

////          (bomDoc.items || []).forEach((line) => {
////            const rawItem = line.item_code;
////            if (!rawItem) return;

////            if (!rawToFinishedMap[rawItem]) {
////              rawToFinishedMap[rawItem] = new Set();
////            }
////            rawToFinishedMap[rawItem].add(finishedItem);

////            if (!finishedToRawMap[finishedItem]) {
////              finishedToRawMap[finishedItem] = new Set();
////            }
////            finishedToRawMap[finishedItem].add(rawItem);
////          });
////        } catch (e) {
////          console.error("Failed to load BOM", bom.name, e);
////        }
////      }

////      // maps keyed by "item_code||warehouse"
////      const openingMap = {}; // opening qty at start of selected day
////      const inMap = {}; // normal IN qty on selected day
////      const outMap = {}; // normal OUT qty on selected day
////      const adjustmentMap = {}; // reconciliation delta on selected day
////      const soldMap = {}; // sold qty (Sales Invoice OUT) on selected day
////      const goodReturnMap = {}; // good return qty (Sales Invoice IN to GOOD_RETURN_WH) on selected day
////      const currentMap = {}; // current qty "now" (end of today)

////      // helper maps to track latest SLE for opening & current
////      const lastBeforeDay = {}; // latest entry BEFORE selected date
////      const lastTillToday = {}; // latest entry up to today

////      // ---------- 1) Opening & daily movement from SLE ----------

////      sleToSelected.forEach((entry) => {
////        const itemCode = entry.item_code;
////        const warehouse = entry.warehouse;
////        if (!itemCode || !warehouse) return;

////        const key = `${itemCode}||${warehouse}`;
////        const qty = parseFloat(entry.actual_qty) || 0;
////        const balance = parseFloat(entry.qty_after_transaction) || 0;
////        const rawVtype = entry.voucher_type || "";
////        const vtype =
////          typeof rawVtype === "string" ? rawVtype.trim() : rawVtype;
////        const entryDate = entry.posting_date;
////        const ts = makeTs(entry);

////        const isRecon = reconNameSet.has(entry.voucher_no);

////        // Track latest entry BEFORE selected date for opening
////        if (entryDate < selectedDate) {
////          const existing = lastBeforeDay[key];
////          if (!existing || ts > existing.ts) {
////            lastBeforeDay[key] = { ts, balance };
////          }
////        }

////        // Movement ON the selected date
////        if (entryDate === selectedDate) {
////          // Normal IN / OUT: we EXCLUDE Stock Reconciliation SLEs
////          if (!isRecon) {
////            if (qty > 0) {
////              inMap[key] = (inMap[key] || 0) + qty;
////            } else if (qty < 0) {
////              outMap[key] = (outMap[key] || 0) + Math.abs(qty);
////            }
////          }

////          // Sales Invoice movements for Sold and Good Return
////          if (vtype === "Sales Invoice") {
////            // sold = stock going OUT
////            if (qty < 0) {
////              soldMap[key] = (soldMap[key] || 0) + Math.abs(qty);
////            }
////            // good return = positive qty into GOOD_RETURN_WH
////            if (qty > 0 && warehouse === GOOD_RETURN_WH) {
////              goodReturnMap[key] = (goodReturnMap[key] || 0) + qty;
////            }
////          }
////        }
////      });

////      // Build openingMap from lastBeforeDay balances
////      Object.keys(lastBeforeDay).forEach((key) => {
////        openingMap[key] = lastBeforeDay[key].balance;
////      });

////      // ---------- 2) Adjustment from Stock Reconciliation docs ----------

////      for (const recon of reconDocs) {
////        const doc = await getDoc("Stock Reconciliation", recon.name);
////        const recItems = doc.items || [];

////        recItems.forEach((it) => {
////          const itemCode = it.item_code;
////          const warehouse = it.warehouse;
////          if (!itemCode || !warehouse) return;

////          const key = `${itemCode}||${warehouse}`;
////          const currentQty = parseFloat(it.current_qty || 0); // before reconciliation
////          const newQty = parseFloat(it.qty || 0); // after reconciliation
////          const delta = newQty - currentQty; // +increase / -decrease

////          adjustmentMap[key] = (adjustmentMap[key] || 0) + delta;
////        });
////      }

////      // ---------- 3) Current stock "now" from SLE ----------

////      sleToToday.forEach((entry) => {
////        const itemCode = entry.item_code;
////        const warehouse = entry.warehouse;
////        if (!itemCode || !warehouse) return;

////        const key = `${itemCode}||${warehouse}`;
////        const balance = parseFloat(entry.qty_after_transaction) || 0;
////        const ts = makeTs(entry);

////        const existing = lastTillToday[key];
////        if (!existing || ts > existing.ts) {
////          lastTillToday[key] = { ts, balance };
////        }
////      });

////      Object.keys(lastTillToday).forEach((key) => {
////        currentMap[key] = lastTillToday[key].balance;
////      });

////      // ---------- 4) Build base flat rows (no grouping yet) ----------

////      const keys = new Set([
////        ...Object.keys(openingMap),
////        ...Object.keys(inMap),
////        ...Object.keys(outMap),
////        ...Object.keys(adjustmentMap),
////        ...Object.keys(soldMap),
////        ...Object.keys(goodReturnMap),
////        ...Object.keys(currentMap),
////      ]);

////      const result = Array.from(keys).map((key) => {
////        const [item_code, warehouse] = key.split("||");
////        const opening = openingMap[key] || 0;
////        const inQty = inMap[key] || 0;
////        const outQty = outMap[key] || 0;
////        const adjQty = adjustmentMap[key] || 0;
////        const soldQty = soldMap[key] || 0;
////        const returnQty = goodReturnMap[key] || 0;
////        const currentStock = currentMap[key] || 0;

////        return {
////          item_code,
////          item_name: itemMap[item_code] || "",
////          warehouse,
////          opening_stock: opening,
////          in_qty: inQty,
////          out_qty: outQty,
////          adjustment_qty: adjQty, // signed: +increase, -decrease
////          sold_qty: soldQty,
////          good_return_qty: returnQty,
////          current_stock: currentStock, // live stock now
////        };
////      });

////      // sort by warehouse then item (base deterministic order)
////      result.sort((a, b) => {
////        if (a.warehouse === b.warehouse) {
////          return a.item_code.localeCompare(b.item_code);
////        }
////        return a.warehouse.localeCompare(b.warehouse);
////      });

////      // ---------- 5) Decide which raw component is the parent for each finished item ----------

////      const chosenParentOfFinished = {}; // finished item -> chosen raw parent

////      Object.keys(finishedToRawMap).forEach((finishedItem) => {
////        const rawItems = Array.from(finishedToRawMap[finishedItem]);
////        if (rawItems.length === 0) return;

////        // Prefer items whose name looks like "Raw ..." (Raw Sattu) if present.
////        let bestParent = rawItems[0];

////        rawItems.forEach((rawCode) => {
////          const name = (itemMap[rawCode] || rawCode).toLowerCase();
////          const bestName = (itemMap[bestParent] || bestParent).toLowerCase();

////          const isRawLike =
////            name.startsWith("raw ") || name.includes(" raw ");
////          const bestIsRawLike =
////            bestName.startsWith("raw ") || bestName.includes(" raw ");

////          if (isRawLike && !bestIsRawLike) {
////            bestParent = rawCode;
////          } else if (isRawLike === bestIsRawLike) {
////            // tie-breaker: alphabetical by code
////            if (rawCode < bestParent) bestParent = rawCode;
////          }
////        });

////        chosenParentOfFinished[finishedItem] = bestParent;
////      });

////      const parentToChildren = {}; // chosen parent raw -> Set of finished items
////      Object.entries(chosenParentOfFinished).forEach(
////        ([finishedItem, parentRaw]) => {
////          if (!parentToChildren[parentRaw]) {
////            parentToChildren[parentRaw] = new Set();
////          }
////          parentToChildren[parentRaw].add(finishedItem);
////        }
////      );

////      // ---------- 6) Build grouped rows with headers ----------
////      //  - same parent/child behaviour as before
////      //  - PLUS: every BOM child product shows at least one row (zeros) even
////      //    if it has never had any stock movement.

////      const rowsByItemCode = {};
////      result.forEach((row) => {
////        if (!rowsByItemCode[row.item_code]) {
////          rowsByItemCode[row.item_code] = [];
////        }
////        rowsByItemCode[row.item_code].push(row);
////      });

////      const makeRowKey = (row) => `${row.warehouse}||${row.item_code}`;

////      // Map: finished item -> its parent raw (for movement grouping)
////      const parentForItem = {};
////      Object.entries(chosenParentOfFinished).forEach(
////        ([finishedItem, parentRaw]) => {
////          parentForItem[finishedItem] = parentRaw;
////        }
////      );

////      // Which groups had any movement on the selected date?
////      const groupMovement = {}; // group item_code -> boolean
////      result.forEach((row) => {
////        const groupCode = parentForItem[row.item_code] || row.item_code;
////        const hasMovement =
////          (row.in_qty || 0) !== 0 ||
////          (row.out_qty || 0) !== 0 ||
////          (row.adjustment_qty || 0) !== 0 ||
////          (row.sold_qty || 0) !== 0 ||
////          (row.good_return_qty || 0) !== 0;

////        if (hasMovement) {
////          groupMovement[groupCode] = true;
////        }
////      });

////      const usedKeys = new Set();
////      const finalRows = [];

////      // Parents: union of "chosen parents" and all BOM raw items
////      const parentCandidateSet = new Set([
////        ...Object.keys(parentToChildren),
////        ...Object.keys(rawToFinishedMap),
////      ]);

////      const parentCodes = Array.from(parentCandidateSet).sort((a, b) => {
////        const aMove = !!groupMovement[a];
////        const bMove = !!groupMovement[b];
////        if (aMove !== bMove) return aMove ? -1 : 1; // groups with movement first

////        const nA = (itemMap[a] || a).toLowerCase();
////        const nB = (itemMap[b] || b).toLowerCase();
////        if (nA === nB) return a.localeCompare(b);
////        return nA.localeCompare(nB);
////      });

////      // 6a) BOM parent groups (Raw Sattu, pouches, stickers, etc.)
////      parentCodes.forEach((parentCode) => {
////        let parentRows = rowsByItemCode[parentCode] || [];

////        const childItemCodes = Array.from(
////          parentToChildren[parentCode] || []
////        ).sort((a, b) => {
////          const nA = (itemMap[a] || a).toLowerCase();
////          const nB = (itemMap[b] || b).toLowerCase();
////          if (nA === nB) return a.localeCompare(b);
////          return nA.localeCompare(nB);
////        });

////        const hasChildRows = childItemCodes.some(
////          (fgCode) =>
////            rowsByItemCode[fgCode] && rowsByItemCode[fgCode].length > 0
////        );

////        // If this parent and all its children have no stock rows at all,
////        // create a single dummy parent row so we don't show just the heading.
////        if (parentRows.length === 0 && !hasChildRows) {
////          parentRows = [
////            {
////              item_code: parentCode,
////              item_name: itemMap[parentCode] || "",
////              warehouse: "",
////              opening_stock: 0,
////              in_qty: 0,
////              out_qty: 0,
////              adjustment_qty: 0,
////              sold_qty: 0,
////              good_return_qty: 0,
////              current_stock: 0,
////            },
////          ];
////        }

////        // Group header row for this parent – ALWAYS created
////        finalRows.push({
////          is_group_header: true,
////          group_item_code: parentCode,
////          group_label: itemMap[parentCode] || parentCode,
////        });

////        // Parent's own stock rows (raw / pouch / sticker etc.)
////        parentRows.forEach((row) => {
////          const key = makeRowKey(row);
////          if (usedKeys.has(key)) return;
////          usedKeys.add(key);

////          finalRows.push({
////            ...row,
////            is_parent_item: true,
////            parent_item_code: null,
////            group_item_code: parentCode,
////          });
////        });

////        // Child finished goods made from this raw (Products)
////        childItemCodes.forEach((fgCode) => {
////          let childRows = rowsByItemCode[fgCode] || [];

////          // 🔥 NEW: if this finished product has never had any stock movement,
////          // create a dummy zero row so it still appears under its parent.
////          if (childRows.length === 0) {
////            childRows = [
////              {
////                item_code: fgCode,
////                item_name: itemMap[fgCode] || "",
////                warehouse: "",
////                opening_stock: 0,
////                in_qty: 0,
////                out_qty: 0,
////                adjustment_qty: 0,
////                sold_qty: 0,
////                good_return_qty: 0,
////                current_stock: 0,
////              },
////            ];
////          }

////          childRows.forEach((row) => {
////            const key = makeRowKey(row);
////            if (usedKeys.has(key)) return;
////            usedKeys.add(key);

////            finalRows.push({
////              ...row,
////              parent_item_code: parentCode,
////              group_item_code: parentCode,
////            });
////          });
////        });
////      });

////      // 6b) Any leftover items that are not part of any BOM
////      //     -> they get a self-header group.
////      const remainingByItem = {};
////      result.forEach((row) => {
////        const key = makeRowKey(row);
////        if (usedKeys.has(key)) return;

////        if (!remainingByItem[row.item_code]) {
////          remainingByItem[row.item_code] = [];
////        }
////        remainingByItem[row.item_code].push(row);
////      });

////      const remainingItemCodes = Object.keys(remainingByItem).sort((a, b) => {
////        const aMove = !!groupMovement[a];
////        const bMove = !!groupMovement[b];
////        if (aMove !== bMove) return aMove ? -1 : 1; // movement first within this block

////        const nA = (itemMap[a] || a).toLowerCase();
////        const nB = (itemMap[b] || b).toLowerCase();
////        if (nA === nB) return a.localeCompare(b);
////        return nA.localeCompare(nB);
////      });

////      remainingItemCodes.forEach((code) => {
////        const label = itemMap[code] || code;

////        // self header
////        finalRows.push({
////          is_group_header: true,
////          group_item_code: code,
////          group_label: label,
////        });

////        // its own rows
////        remainingByItem[code].forEach((row) => {
////          const key = makeRowKey(row);
////          usedKeys.add(key);

////          finalRows.push({
////            ...row,
////            is_parent_item: true,
////            parent_item_code: null,
////            group_item_code: code,
////          });
////        });
////      });

////      // Default: all groups expanded
////      const newExpanded = {};
////      finalRows.forEach((r) => {
////        if (r.is_group_header) {
////          newExpanded[r.group_item_code] = true;
////        }
////      });

////      setRows(finalRows);
////      setExpandedGroups(newExpanded);
////    } catch (err) {
////      console.error(err);
////      setError(err.message || "Failed to load daily stock summary");
////    } finally {
////      setLoading(false);
////    }
////  }

////  useEffect(() => {
////    loadData(date);
////    // eslint-disable-next-line react-hooks/exhaustive-deps
////  }, [date]);

////  // Count visible (non-header) rows, respecting collapsed groups
////  const visibleRowCount = rows.reduce((count, r) => {
////    if (r.is_group_header) return count;
////    if (r.group_item_code && expandedGroups[r.group_item_code] === false) {
////      return count;
////    }
////    return count + 1;
////  }, 0);

////  return (
////    <div className="daily-stock-summary">
////      {/* Header */}
////      <div className="daily-stock-summary-header-row">
////        <div className="daily-stock-summary-header">
////          <h2 className="daily-stock-summary-title">Daily Stock Summary</h2>
////          <p className="daily-stock-summary-subtitle">
////            Opening, movement &amp; balances by warehouse for the selected date
////          </p>
////        </div>

////        <div className="daily-stock-summary-controls">
////          <span className="daily-stock-summary-date-label">Date</span>
////          <input
////            type="date"
////            className="input daily-stock-summary-date-input"
////            value={date}
////            onChange={(e) => setDate(e.target.value)}
////          />
////          <button
////            type="button"
////            className="btn btn-primary btn-sm daily-stock-summary-refresh"
////            onClick={() => loadData(date)}
////          >
////            Refresh
////          </button>
////        </div>
////      </div>

////      {/* Meta */}
////      <div className="daily-stock-summary-meta-row">
////        <span className="daily-stock-summary-meta">
////          Showing {visibleRowCount} line{visibleRowCount !== 1 ? "s" : ""}
////        </span>
////      </div>

////      {/* States */}
////      {loading && (
////        <p className="daily-stock-summary-loading text-muted">
////          Loading stock summary...
////        </p>
////      )}
////      {error && (
////        <p className="daily-stock-summary-error alert alert-error">
////          {error}
////        </p>
////      )}
////      {!loading && !error && rows.length === 0 && (
////        <p className="daily-stock-summary-empty text-muted">
////          No stock movement found up to this date.
////        </p>
////      )}

////      {/* Table */}
////      {!loading && !error && rows.length > 0 && (
////        <div className="daily-stock-summary-table-wrapper">
////          <table className="daily-stock-summary-table">
////            <thead>
////              <tr>
////                <th>Warehouse</th>
////                <th>Item</th>
////                <th>Opening Stock</th>
////                <th>In Qty (on date)</th>
////                <th>Out Qty (on date)</th>
////                <th>Adjustment (Reconciliation)</th>
////                <th>Sold Qty (on date)</th>
////                <th>Return Qty (Good, on date)</th>
////                <th>Current Stock (now)</th>
////              </tr>
////            </thead>
////            <tbody>
////              {rows.map((r, idx) => {
////                // 📦 Group header row, clickable to expand/collapse
////                if (r.is_group_header) {
////                  const isOpen = expandedGroups[r.group_item_code] !== false;
////                  return (
////                    <tr
////                      key={`group-${r.group_item_code}-${idx}`}
////                      className="daily-stock-summary-group-row"
////                      onClick={() =>
////                        setExpandedGroups((prev) => ({
////                          ...prev,
////                          [r.group_item_code]: !isOpen,
////                        }))
////                      }
////                    >
////                      <td
////                        className="daily-stock-summary-group-header"
////                        colSpan={9}
////                      >
////                        <span className="daily-stock-summary-group-icon">
////                          📦
////                        </span>{" "}
////                        {r.group_label}
////                        <span className="daily-stock-summary-group-toggle">
////                          {isOpen ? "▾" : "▸"}
////                        </span>
////                      </td>
////                    </tr>
////                  );
////                }

////                // Hide rows belonging to collapsed group
////                if (
////                  r.group_item_code &&
////                  expandedGroups[r.group_item_code] === false
////                ) {
////                  return null;
////                }

////                const isParent = r.is_parent_item;
////                const isChild =
////                  !!r.parent_item_code && !r.is_parent_item;

////                // Only show one line if code == name
////                const hasName = !!r.item_name;
////                const topLabel = hasName ? r.item_name : r.item_code;
////                const showSecondLine =
////                  hasName && r.item_name !== r.item_code;
////                const secondLabel = showSecondLine ? r.item_code : "";

////                return (
////                  <tr
////                    key={`${r.warehouse}||${r.item_code}||${
////                      r.parent_item_code || ""
////                    }`}
////                    className={[
////                      isParent ? "daily-stock-summary-row-parent" : "",
////                      isChild ? "daily-stock-summary-row-child" : "",
////                    ]
////                      .join(" ")
////                      .trim()}
////                  >
////                    <td className="daily-stock-summary-warehouse">
////                      {r.warehouse}
////                    </td>
////                    <td className="daily-stock-summary-item">
////                      <div className="daily-stock-summary-item-code">
////                        {topLabel}
////                      </div>
////                      {secondLabel && (
////                        <div className="daily-stock-summary-item-name">
////                          {secondLabel}
////                        </div>
////                      )}
////                    </td>
////                    <td className="daily-stock-summary-opening">
////                      {r.opening_stock || 0}
////                    </td>
////                    <td className="daily-stock-summary-inqty">
////                      {r.in_qty || 0}
////                    </td>
////                    <td className="daily-stock-summary-outqty">
////                      {r.out_qty || 0}
////                    </td>
////                    <td className="daily-stock-summary-adjustment">
////                      {r.adjustment_qty || 0}
////                    </td>
////                    <td className="daily-stock-summary-sold">
////                      {r.sold_qty || 0}
////                    </td>
////                    <td className="daily-stock-summary-returns">
////                      {r.good_return_qty || 0}
////                    </td>
////                    <td className="daily-stock-summary-current">
////                      {r.current_stock || 0}
////                    </td>
////                  </tr>
////                );
////              })}
////            </tbody>
////          </table>
////        </div>
////      )}
////    </div>
////  );
////}

////export default DailyStockSummary;


//// src/Components/DailyStockSummary.jsx
//import React, { useEffect, useState } from "react";
//import {
//  getStockLedgerUpToDate,
//  getAllItems,
//  getDoctypeList,
//  getDoc,
//} from "./erpBackendApi";
//import "../CSS/DailyStockSummary.css";

//// Must match GOOD_RETURN_WH used in createSalesReturn / stock-return logic
//const GOOD_RETURN_WH = "Finished Goods - MF";

//function DailyStockSummary() {
//  const [date, setDate] = useState(
//    new Date().toISOString().slice(0, 10) // today
//  );
//  const [rows, setRows] = useState([]);
//  const [expandedGroups, setExpandedGroups] = useState({});
//  const [loading, setLoading] = useState(false);
//  const [error, setError] = useState("");
//  const [searchTerm, setSearchTerm] = useState(""); // 🔍 search text

//  function makeTs(entry) {
//    // "YYYY-MM-DD HH:MM:SS"
//    return `${entry.posting_date} ${entry.posting_time || "00:00:00"}`;
//  }

//  async function loadData(selectedDate) {
//    setLoading(true);
//    setError("");
//    setRows([]);
//    setExpandedGroups({});

//    try {
//      const todayStr = new Date().toISOString().slice(0, 10);

//      // 1) SLE up to selected date (for opening + daily movement)
//      // 2) SLE up to today (for current stock "now")
//      // 3) Item master for item_name
//      // 4) Stock Reconciliation docs ON selected date
//      // 5) BOM list
//      const [sleToSelected, sleToToday, items, reconDocs, bomList] =
//        await Promise.all([
//          getStockLedgerUpToDate(selectedDate),
//          getStockLedgerUpToDate(todayStr),
//          getAllItems(),
//          getDoctypeList("Stock Reconciliation", {
//            fields: JSON.stringify(["name", "posting_date", "docstatus"]),
//            filters: JSON.stringify([
//              ["Stock Reconciliation", "posting_date", "=", selectedDate],
//              ["Stock Reconciliation", "docstatus", "=", 1],
//            ]),
//            limit_page_length: 500,
//          }),
//          getDoctypeList("BOM", {
//            fields: JSON.stringify(["name", "item", "is_active", "docstatus"]),
//            filters: JSON.stringify([
//              ["BOM", "docstatus", "=", 1],
//              ["BOM", "is_active", "=", 1],
//            ]),
//            limit_page_length: 500,
//          }),
//        ]);

//      // item_code -> item_name
//      const itemMap = {};
//      items.forEach((it) => {
//        itemMap[it.name] = it.item_name;
//      });

//      // set of reconciliation voucher_nos (so we can identify their SLEs)
//      const reconNameSet = new Set(reconDocs.map((d) => d.name));

//      // BOM maps
//      const rawToFinishedMap = {}; // raw item_code -> Set of finished item_codes
//      const finishedToRawMap = {}; // finished item_code -> Set of raw item_codes

//      // Build BOM maps
//      for (const bom of bomList) {
//        try {
//          const bomDoc = await getDoc("BOM", bom.name);
//          const finishedItem = bom.item;
//          if (!finishedItem) continue;

//          (bomDoc.items || []).forEach((line) => {
//            const rawItem = line.item_code;
//            if (!rawItem) return;

//            if (!rawToFinishedMap[rawItem]) {
//              rawToFinishedMap[rawItem] = new Set();
//            }
//            rawToFinishedMap[rawItem].add(finishedItem);

//            if (!finishedToRawMap[finishedItem]) {
//              finishedToRawMap[finishedItem] = new Set();
//            }
//            finishedToRawMap[finishedItem].add(rawItem);
//          });
//        } catch (e) {
//          console.error("Failed to load BOM", bom.name, e);
//        }
//      }

//      // maps keyed by "item_code||warehouse"
//      const openingMap = {}; // opening qty at start of selected day
//      const inMap = {}; // normal IN qty on selected day
//      const outMap = {}; // normal OUT qty on selected day
//      const adjustmentMap = {}; // reconciliation delta on selected day
//      const soldMap = {}; // sold qty (Sales Invoice OUT) on selected day
//      const goodReturnMap = {}; // good return qty (Sales Invoice IN to GOOD_RETURN_WH) on selected day
//      const currentMap = {}; // current qty "now" (end of today)

//      // helper maps to track latest SLE for opening & current
//      const lastBeforeDay = {}; // latest entry BEFORE selected date
//      const lastTillToday = {}; // latest entry up to today

//      // ---------- 1) Opening & daily movement from SLE ----------

//      sleToSelected.forEach((entry) => {
//        const itemCode = entry.item_code;
//        const warehouse = entry.warehouse;
//        if (!itemCode || !warehouse) return;

//        const key = `${itemCode}||${warehouse}`;
//        const qty = parseFloat(entry.actual_qty) || 0;
//        const balance = parseFloat(entry.qty_after_transaction) || 0;
//        const rawVtype = entry.voucher_type || "";
//        const vtype =
//          typeof rawVtype === "string" ? rawVtype.trim() : rawVtype;
//        const entryDate = entry.posting_date;
//        const ts = makeTs(entry);

//        const isRecon = reconNameSet.has(entry.voucher_no);

//        // Track latest entry BEFORE selected date for opening
//        if (entryDate < selectedDate) {
//          const existing = lastBeforeDay[key];
//          if (!existing || ts > existing.ts) {
//            lastBeforeDay[key] = { ts, balance };
//          }
//        }

//        // Movement ON the selected date
//        if (entryDate === selectedDate) {
//          // Normal IN / OUT: we EXCLUDE Stock Reconciliation SLEs
//          if (!isRecon) {
//            if (qty > 0) {
//              inMap[key] = (inMap[key] || 0) + qty;
//            } else if (qty < 0) {
//              outMap[key] = (outMap[key] || 0) + Math.abs(qty);
//            }
//          }

//          // Sales Invoice movements for Sold and Good Return
//          if (vtype === "Sales Invoice") {
//            // sold = stock going OUT
//            if (qty < 0) {
//              soldMap[key] = (soldMap[key] || 0) + Math.abs(qty);
//            }
//            // good return = positive qty into GOOD_RETURN_WH
//            if (qty > 0 && warehouse === GOOD_RETURN_WH) {
//              goodReturnMap[key] = (goodReturnMap[key] || 0) + qty;
//            }
//          }
//        }
//      });

//      // Build openingMap from lastBeforeDay balances
//      Object.keys(lastBeforeDay).forEach((key) => {
//        openingMap[key] = lastBeforeDay[key].balance;
//      });

//      // ---------- 2) Adjustment from Stock Reconciliation docs ----------

//      for (const recon of reconDocs) {
//        const doc = await getDoc("Stock Reconciliation", recon.name);
//        const recItems = doc.items || [];

//        recItems.forEach((it) => {
//          const itemCode = it.item_code;
//          const warehouse = it.warehouse;
//          if (!itemCode || !warehouse) return;

//          const key = `${itemCode}||${warehouse}`;
//          const currentQty = parseFloat(it.current_qty || 0); // before reconciliation
//          const newQty = parseFloat(it.qty || 0); // after reconciliation
//          const delta = newQty - currentQty; // +increase / -decrease

//          adjustmentMap[key] = (adjustmentMap[key] || 0) + delta;
//        });
//      }

//      // ---------- 3) Current stock "now" from SLE ----------

//      sleToToday.forEach((entry) => {
//        const itemCode = entry.item_code;
//        const warehouse = entry.warehouse;
//        if (!itemCode || !warehouse) return;

//        const key = `${itemCode}||${warehouse}`;
//        const balance = parseFloat(entry.qty_after_transaction) || 0;
//        const ts = makeTs(entry);

//        const existing = lastTillToday[key];
//        if (!existing || ts > existing.ts) {
//          lastTillToday[key] = { ts, balance };
//        }
//      });

//      Object.keys(lastTillToday).forEach((key) => {
//        currentMap[key] = lastTillToday[key].balance;
//      });

//      // ---------- 4) Build base flat rows (no grouping yet) ----------

//      const keys = new Set([
//        ...Object.keys(openingMap),
//        ...Object.keys(inMap),
//        ...Object.keys(outMap),
//        ...Object.keys(adjustmentMap),
//        ...Object.keys(soldMap),
//        ...Object.keys(goodReturnMap),
//        ...Object.keys(currentMap),
//      ]);

//      const result = Array.from(keys).map((key) => {
//        const [item_code, warehouse] = key.split("||");
//        const opening = openingMap[key] || 0;
//        const inQty = inMap[key] || 0;
//        const outQty = outMap[key] || 0;
//        const adjQty = adjustmentMap[key] || 0;
//        const soldQty = soldMap[key] || 0;
//        const returnQty = goodReturnMap[key] || 0;
//        const currentStock = currentMap[key] || 0;

//        return {
//          item_code,
//          item_name: itemMap[item_code] || "",
//          warehouse,
//          opening_stock: opening,
//          in_qty: inQty,
//          out_qty: outQty,
//          adjustment_qty: adjQty, // signed: +increase, -decrease
//          sold_qty: soldQty,
//          good_return_qty: returnQty,
//          current_stock: currentStock, // live stock now
//        };
//      });

//      // sort by warehouse then item (base deterministic order)
//      result.sort((a, b) => {
//        if (a.warehouse === b.warehouse) {
//          return a.item_code.localeCompare(b.item_code);
//        }
//        return a.warehouse.localeCompare(b.warehouse);
//      });

//      // ---------- 5) Decide which raw component is the parent for each finished item ----------

//      const chosenParentOfFinished = {}; // finished item -> chosen raw parent

//      Object.keys(finishedToRawMap).forEach((finishedItem) => {
//        const rawItems = Array.from(finishedToRawMap[finishedItem]);
//        if (rawItems.length === 0) return;

//        // Prefer items whose name looks like "Raw ..." (Raw Sattu) if present.
//        let bestParent = rawItems[0];

//        rawItems.forEach((rawCode) => {
//          const name = (itemMap[rawCode] || rawCode).toLowerCase();
//          const bestName = (itemMap[bestParent] || bestParent).toLowerCase();

//          const isRawLike =
//            name.startsWith("raw ") || name.includes(" raw ");
//          const bestIsRawLike =
//            bestName.startsWith("raw ") || bestName.includes(" raw ");

//          if (isRawLike && !bestIsRawLike) {
//            bestParent = rawCode;
//          } else if (isRawLike === bestIsRawLike) {
//            // tie-breaker: alphabetical by code
//            if (rawCode < bestParent) bestParent = rawCode;
//          }
//        });

//        chosenParentOfFinished[finishedItem] = bestParent;
//      });

//      const parentToChildren = {}; // chosen parent raw -> Set of finished items
//      Object.entries(chosenParentOfFinished).forEach(
//        ([finishedItem, parentRaw]) => {
//          if (!parentToChildren[parentRaw]) {
//            parentToChildren[parentRaw] = new Set();
//          }
//          parentToChildren[parentRaw].add(finishedItem);
//        }
//      );

//      // ---------- 6) Build grouped rows with headers ----------

//      const rowsByItemCode = {};
//      result.forEach((row) => {
//        if (!rowsByItemCode[row.item_code]) {
//          rowsByItemCode[row.item_code] = [];
//        }
//        rowsByItemCode[row.item_code].push(row);
//      });

//      const makeRowKey = (row) => `${row.warehouse}||${row.item_code}`;

//      // Map: finished item -> its parent raw (for movement grouping)
//      const parentForItem = {};
//      Object.entries(chosenParentOfFinished).forEach(
//        ([finishedItem, parentRaw]) => {
//          parentForItem[finishedItem] = parentRaw;
//        }
//      );

//      // Which groups had any movement on the selected date?
//      const groupMovement = {}; // group item_code -> boolean
//      result.forEach((row) => {
//        const groupCode = parentForItem[row.item_code] || row.item_code;
//        const hasMovement =
//          (row.in_qty || 0) !== 0 ||
//          (row.out_qty || 0) !== 0 ||
//          (row.adjustment_qty || 0) !== 0 ||
//          (row.sold_qty || 0) !== 0 ||
//          (row.good_return_qty || 0) !== 0;

//        if (hasMovement) {
//          groupMovement[groupCode] = true;
//        }
//      });

//      const usedKeys = new Set();
//      const finalRows = [];

//      // Parents: union of "chosen parents" and all BOM raw items
//      const parentCandidateSet = new Set([
//        ...Object.keys(parentToChildren),
//        ...Object.keys(rawToFinishedMap),
//      ]);

//      const parentCodes = Array.from(parentCandidateSet).sort((a, b) => {
//        const aMove = !!groupMovement[a];
//        const bMove = !!groupMovement[b];
//        if (aMove !== bMove) return aMove ? -1 : 1; // groups with movement first

//        const nA = (itemMap[a] || a).toLowerCase();
//        const nB = (itemMap[b] || b).toLowerCase();
//        if (nA === nB) return a.localeCompare(b);
//        return nA.localeCompare(nB);
//      });

//      // 6a) BOM parent groups (Raw Sattu, pouches, stickers, etc.)
//      parentCodes.forEach((parentCode) => {
//        let parentRows = rowsByItemCode[parentCode] || [];

//        const childItemCodes = Array.from(
//          parentToChildren[parentCode] || []
//        ).sort((a, b) => {
//          const nA = (itemMap[a] || a).toLowerCase();
//          const nB = (itemMap[b] || b).toLowerCase();
//          if (nA === nB) return a.localeCompare(b);
//          return nA.localeCompare(nB);
//        });

//        const hasChildRows = childItemCodes.some(
//          (fgCode) =>
//            rowsByItemCode[fgCode] && rowsByItemCode[fgCode].length > 0
//        );

//        // If this parent and all its children have no stock rows at all,
//        // create a single dummy parent row so we don't show just the heading.
//        if (parentRows.length === 0 && !hasChildRows) {
//          parentRows = [
//            {
//              item_code: parentCode,
//              item_name: itemMap[parentCode] || "",
//              warehouse: "",
//              opening_stock: 0,
//              in_qty: 0,
//              out_qty: 0,
//              adjustment_qty: 0,
//              sold_qty: 0,
//              good_return_qty: 0,
//              current_stock: 0,
//            },
//          ];
//        }

//        // Group header row for this parent – ALWAYS created
//        finalRows.push({
//          is_group_header: true,
//          group_item_code: parentCode,
//          group_label: itemMap[parentCode] || parentCode,
//        });

//        // Parent's own stock rows (raw / pouch / sticker etc.)
//        parentRows.forEach((row) => {
//          const key = makeRowKey(row);
//          if (usedKeys.has(key)) return;
//          usedKeys.add(key);

//          finalRows.push({
//            ...row,
//            is_parent_item: true,
//            parent_item_code: null,
//            group_item_code: parentCode,
//          });
//        });

//        // Child finished goods made from this raw (Products)
//        childItemCodes.forEach((fgCode) => {
//          let childRows = rowsByItemCode[fgCode] || [];

//          // if this finished product has never had any stock movement,
//          // create a dummy zero row so it still appears under its parent.
//          if (childRows.length === 0) {
//            childRows = [
//              {
//                item_code: fgCode,
//                item_name: itemMap[fgCode] || "",
//                warehouse: "",
//                opening_stock: 0,
//                in_qty: 0,
//                out_qty: 0,
//                adjustment_qty: 0,
//                sold_qty: 0,
//                good_return_qty: 0,
//                current_stock: 0,
//              },
//            ];
//          }

//          childRows.forEach((row) => {
//            const key = makeRowKey(row);
//            if (usedKeys.has(key)) return;
//            usedKeys.add(key);

//            finalRows.push({
//              ...row,
//              parent_item_code: parentCode,
//              group_item_code: parentCode,
//            });
//          });
//        });
//      });

//      // 6b) Any leftover items that are not part of any BOM
//      //     -> they get a self-header group.
//      const remainingByItem = {};
//      result.forEach((row) => {
//        const key = makeRowKey(row);
//        if (usedKeys.has(key)) return;

//        if (!remainingByItem[row.item_code]) {
//          remainingByItem[row.item_code] = [];
//        }
//        remainingByItem[row.item_code].push(row);
//      });

//      const remainingItemCodes = Object.keys(remainingByItem).sort((a, b) => {
//        const aMove = !!groupMovement[a];
//        const bMove = !!groupMovement[b];
//        if (aMove !== bMove) return aMove ? -1 : 1; // movement first within this block

//        const nA = (itemMap[a] || a).toLowerCase();
//        const nB = (itemMap[b] || b).toLowerCase();
//        if (nA === nB) return a.localeCompare(b);
//        return nA.localeCompare(nB);
//      });

//      remainingItemCodes.forEach((code) => {
//        const label = itemMap[code] || code;

//        // self header
//        finalRows.push({
//          is_group_header: true,
//          group_item_code: code,
//          group_label: label,
//        });

//        // its own rows
//        remainingByItem[code].forEach((row) => {
//          const key = makeRowKey(row);
//          usedKeys.add(key);

//          finalRows.push({
//            ...row,
//            is_parent_item: true,
//            parent_item_code: null,
//            group_item_code: code,
//          });
//        });
//      });

//      // Default: all groups expanded
//      const newExpanded = {};
//      finalRows.forEach((r) => {
//        if (r.is_group_header) {
//          newExpanded[r.group_item_code] = true;
//        }
//      });

//      setRows(finalRows);
//      setExpandedGroups(newExpanded);
//    } catch (err) {
//      console.error(err);
//      setError(err.message || "Failed to load daily stock summary");
//    } finally {
//      setLoading(false);
//    }
//  }

//  useEffect(() => {
//    loadData(date);
//    // eslint-disable-next-line react-hooks/exhaustive-deps
//  }, [date]);

//  // ---------- 🔍 FILTERED VIEW FOR SEARCH ----------

//  const lowerSearch = searchTerm.trim().toLowerCase();

//  let displayRows = rows;

//  if (lowerSearch) {
//    // group rows by group_item_code to keep headers + children together
//    const groups = {};

//    rows.forEach((r, idx) => {
//      if (r.is_group_header) {
//        const code = r.group_item_code || `__header_${idx}`;
//        if (!groups[code]) {
//          groups[code] = { header: r, details: [], firstIndex: idx };
//        } else {
//          groups[code].header = r;
//          groups[code].firstIndex = Math.min(groups[code].firstIndex, idx);
//        }
//      } else {
//        const code = r.group_item_code || r.item_code || `__row_${idx}`;
//        if (!groups[code]) {
//          groups[code] = { header: null, details: [], firstIndex: idx };
//        }
//        groups[code].details.push(r);
//      }
//    });

//    const orderedCodes = Object.keys(groups).sort(
//      (a, b) => groups[a].firstIndex - groups[b].firstIndex
//    );

//    const filtered = [];

//    orderedCodes.forEach((code) => {
//      const g = groups[code];
//      const header = g.header;
//      const details = g.details;

//      const headerMatches =
//        header &&
//        ((header.group_label || "").toLowerCase().includes(lowerSearch) ||
//          (header.group_item_code || "").toLowerCase().includes(lowerSearch));

//      const matchingDetails = details.filter((d) => {
//        const name = (d.item_name || "").toLowerCase();
//        const codeStr = (d.item_code || "").toLowerCase();
//        const wh = (d.warehouse || "").toLowerCase();
//        return (
//          name.includes(lowerSearch) ||
//          codeStr.includes(lowerSearch) ||
//          wh.includes(lowerSearch)
//        );
//      });

//      if (headerMatches || matchingDetails.length > 0) {
//        if (header) filtered.push(header);
//        matchingDetails.forEach((d) => filtered.push(d));
//      }
//    });

//    displayRows = filtered;
//  }

//  // Count visible (non-header) rows, respecting collapsed groups (only when no search)
//  const visibleRowCount = displayRows.reduce((count, r) => {
//    if (r.is_group_header) return count;
//    if (
//      !lowerSearch && // when searching, ignore collapse hiding
//      r.group_item_code &&
//      expandedGroups[r.group_item_code] === false
//    ) {
//      return count;
//    }
//    return count + 1;
//  }, 0);

//  return (
//    <div className="daily-stock-summary">
//      {/* Header */}
//      <div className="daily-stock-summary-header-row">
//        <div className="daily-stock-summary-header">
//          <h2 className="daily-stock-summary-title">Daily Stock Summary</h2>
//          <p className="daily-stock-summary-subtitle">
//            Opening, movement &amp; balances by warehouse for the selected date
//          </p>
//        </div>

//        <div className="daily-stock-summary-controls">
//          <span className="daily-stock-summary-date-label">Date</span>
//          <input
//            type="date"
//            className="input daily-stock-summary-date-input"
//            value={date}
//            onChange={(e) => setDate(e.target.value)}
//          />

//          {/* 🔍 Search box */}
//          <input
//            type="text"
//            className="input daily-stock-summary-search-input"
//            placeholder="Search item / code / warehouse"
//            value={searchTerm}
//            onChange={(e) => setSearchTerm(e.target.value)}
//          />

//          <button
//            type="button"
//            className="btn btn-primary btn-sm daily-stock-summary-refresh"
//            onClick={() => loadData(date)}
//          >
//            Refresh
//          </button>
//        </div>
//      </div>

//      {/* Meta */}
//      <div className="daily-stock-summary-meta-row">
//        <span className="daily-stock-summary-meta">
//          Showing {visibleRowCount} line{visibleRowCount !== 1 ? "s" : ""}
//        </span>
//      </div>

//      {/* States */}
//      {loading && (
//        <p className="daily-stock-summary-loading text-muted">
//          Loading stock summary...
//        </p>
//      )}
//      {error && (
//        <p className="daily-stock-summary-error alert alert-error">
//          {error}
//        </p>
//      )}
//      {!loading && !error && displayRows.length === 0 && (
//        <p className="daily-stock-summary-empty text-muted">
//          No rows match your filters.
//        </p>
//      )}

//      {/* Table */}
//      {!loading && !error && displayRows.length > 0 && (
//        <div className="daily-stock-summary-table-wrapper">
//          <table className="daily-stock-summary-table">
//            <thead>
//              <tr>
//                <th>Warehouse</th>
//                <th>Item</th>
//                <th>Opening Stock</th>
//                <th>In Qty (on date)</th>
//                <th>Out Qty (on date)</th>
//                <th>Adjustment (Reconciliation)</th>
//                <th>Sold Qty (on date)</th>
//                <th>Return Qty (Good, on date)</th>
//                <th>Current Stock (now)</th>
//              </tr>
//            </thead>
//            <tbody>
//              {displayRows.map((r, idx) => {
//                // 📦 Group header row, clickable to expand/collapse
//                if (r.is_group_header) {
//                  const isOpen = expandedGroups[r.group_item_code] !== false;
//                  return (
//                    <tr
//                      key={`group-${r.group_item_code}-${idx}`}
//                      className="daily-stock-summary-group-row"
//                      onClick={() =>
//                        setExpandedGroups((prev) => ({
//                          ...prev,
//                          [r.group_item_code]: !isOpen,
//                        }))
//                      }
//                    >
//                      <td
//                        className="daily-stock-summary-group-header"
//                        colSpan={9}
//                      >
//                        <span className="daily-stock-summary-group-icon">
//                          📦
//                        </span>{" "}
//                        {r.group_label}
//                        <span className="daily-stock-summary-group-toggle">
//                          {isOpen ? "▾" : "▸"}
//                        </span>
//                      </td>
//                    </tr>
//                  );
//                }

//                // Hide rows belonging to collapsed group (only when no search)
//                if (
//                  !lowerSearch &&
//                  r.group_item_code &&
//                  expandedGroups[r.group_item_code] === false
//                ) {
//                  return null;
//                }

//                const isParent = r.is_parent_item;
//                const isChild =
//                  !!r.parent_item_code && !r.is_parent_item;

//                // Only show one line if code == name
//                const hasName = !!r.item_name;
//                const topLabel = hasName ? r.item_name : r.item_code;
//                const showSecondLine =
//                  hasName && r.item_name !== r.item_code;
//                const secondLabel = showSecondLine ? r.item_code : "";

//                return (
//                  <tr
//                    key={`${r.warehouse}||${r.item_code}||${
//                      r.parent_item_code || ""
//                    }`}
//                    className={[
//                      isParent ? "daily-stock-summary-row-parent" : "",
//                      isChild ? "daily-stock-summary-row-child" : "",
//                    ]
//                      .join(" ")
//                      .trim()}
//                  >
//                    <td className="daily-stock-summary-warehouse">
//                      {r.warehouse}
//                    </td>
//                    <td className="daily-stock-summary-item">
//                      <div className="daily-stock-summary-item-code">
//                        {topLabel}
//                      </div>
//                      {secondLabel && (
//                        <div className="daily-stock-summary-item-name">
//                          {secondLabel}
//                        </div>
//                      )}
//                    </td>
//                    <td className="daily-stock-summary-opening">
//                      {r.opening_stock || 0}
//                    </td>
//                    <td className="daily-stock-summary-inqty">
//                      {r.in_qty || 0}
//                    </td>
//                    <td className="daily-stock-summary-outqty">
//                      {r.out_qty || 0}
//                    </td>
//                    <td className="daily-stock-summary-adjustment">
//                      {r.adjustment_qty || 0}
//                    </td>
//                    <td className="daily-stock-summary-sold">
//                      {r.sold_qty || 0}
//                    </td>
//                    <td className="daily-stock-summary-returns">
//                      {r.good_return_qty || 0}
//                    </td>
//                    <td className="daily-stock-summary-current">
//                      {r.current_stock || 0}
//                    </td>
//                  </tr>
//                );
//              })}
//            </tbody>
//          </table>
//        </div>
//      )}
//    </div>
//  );
//}

//export default DailyStockSummary;


// src/Components/DailyStockSummary.jsx
import React, { useEffect, useState } from "react";
import {
  getStockLedgerUpToDate,
  getAllItems,
  getDoctypeList,
  getDoc,
} from "./erpBackendApi";
import "../CSS/DailyStockSummary.css";

// Must match GOOD_RETURN_WH used in createSalesReturn / stock-return logic
const GOOD_RETURN_WH = "Finished Goods - MF";

function DailyStockSummary() {
  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10) // today
  );
  const [rows, setRows] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState(""); // 🔍 search text

  function makeTs(entry) {
    // "YYYY-MM-DD HH:MM:SS"
    return `${entry.posting_date} ${entry.posting_time || "00:00:00"}`;
  }

  async function loadData(selectedDate) {
    setLoading(true);
    setError("");
    setRows([]);
    setExpandedGroups({});

    try {
      const todayStr = new Date().toISOString().slice(0, 10);

      // 1) SLE up to selected date (for opening + daily movement)
      // 2) SLE up to today (for current stock "now")
      // 3) Item master for item_name
      // 4) Stock Reconciliation docs ON selected date
      // 5) BOM list
      const [sleToSelected, sleToToday, items, reconDocs, bomList] =
        await Promise.all([
          getStockLedgerUpToDate(selectedDate),
          getStockLedgerUpToDate(todayStr),
          getAllItems(),
          getDoctypeList("Stock Reconciliation", {
            fields: JSON.stringify(["name", "posting_date", "docstatus"]),
            filters: JSON.stringify([
              ["Stock Reconciliation", "posting_date", "=", selectedDate],
              ["Stock Reconciliation", "docstatus", "=", 1],
            ]),
            limit_page_length: 500,
          }),
          getDoctypeList("BOM", {
            fields: JSON.stringify(["name", "item", "is_active", "docstatus"]),
            filters: JSON.stringify([
              ["BOM", "docstatus", "=", 1],
              ["BOM", "is_active", "=", 1],
            ]),
            limit_page_length: 500,
          }),
        ]);

      // item_code -> item_name
      const itemMap = {};
      items.forEach((it) => {
        itemMap[it.name] = it.item_name;
      });

      // set of reconciliation voucher_nos (so we can identify their SLEs)
      const reconNameSet = new Set(reconDocs.map((d) => d.name));

      // BOM maps
      const rawToFinishedMap = {}; // raw item_code -> Set of finished item_codes
      const finishedToRawMap = {}; // finished item_code -> Set of raw item_codes

      // Build BOM maps
      for (const bom of bomList) {
        try {
          const bomDoc = await getDoc("BOM", bom.name);
          const finishedItem = bom.item;
          if (!finishedItem) continue;

          (bomDoc.items || []).forEach((line) => {
            const rawItem = line.item_code;
            if (!rawItem) return;

            if (!rawToFinishedMap[rawItem]) {
              rawToFinishedMap[rawItem] = new Set();
            }
            rawToFinishedMap[rawItem].add(finishedItem);

            if (!finishedToRawMap[finishedItem]) {
              finishedToRawMap[finishedItem] = new Set();
            }
            finishedToRawMap[finishedItem].add(rawItem);
          });
        } catch (e) {
          console.error("Failed to load BOM", bom.name, e);
        }
      }

      // maps keyed by "item_code||warehouse"
      const openingMap = {}; // opening qty at start of selected day
      const inMap = {}; // normal IN qty on selected day
      const outMap = {}; // normal OUT qty on selected day
      const adjustmentMap = {}; // reconciliation delta on selected day
      const soldMap = {}; // sold qty (Sales Invoice OUT) on selected day
      const goodReturnMap = {}; // good return qty (Sales Invoice IN to GOOD_RETURN_WH) on selected day
      const currentMap = {}; // current qty "now" (end of today)

      // helper maps to track latest SLE for opening & current
      const lastBeforeDay = {}; // latest entry BEFORE selected date
      const lastTillToday = {}; // latest entry up to today

      // ---------- 1) Opening & daily movement from SLE ----------

      sleToSelected.forEach((entry) => {
        const itemCode = entry.item_code;
        const warehouse = entry.warehouse;
        if (!itemCode || !warehouse) return;

        const key = `${itemCode}||${warehouse}`;
        const qty = parseFloat(entry.actual_qty) || 0;
        const balance = parseFloat(entry.qty_after_transaction) || 0;
        const rawVtype = entry.voucher_type || "";
        const vtype =
          typeof rawVtype === "string" ? rawVtype.trim() : rawVtype;
        const entryDate = entry.posting_date;
        const ts = makeTs(entry);

        const isRecon = reconNameSet.has(entry.voucher_no);

        // Track latest entry BEFORE selected date for opening
        if (entryDate < selectedDate) {
          const existing = lastBeforeDay[key];
          if (!existing || ts > existing.ts) {
            lastBeforeDay[key] = { ts, balance };
          }
        }

        // Movement ON the selected date
        if (entryDate === selectedDate) {
          // Normal IN / OUT: we EXCLUDE Stock Reconciliation SLEs
          if (!isRecon) {
            if (qty > 0) {
              inMap[key] = (inMap[key] || 0) + qty;
            } else if (qty < 0) {
              outMap[key] = (outMap[key] || 0) + Math.abs(qty);
            }
          }

          // Sales Invoice movements for Sold and Good Return
          if (vtype === "Sales Invoice") {
            // sold = stock going OUT
            if (qty < 0) {
              soldMap[key] = (soldMap[key] || 0) + Math.abs(qty);
            }
            // good return = positive qty into GOOD_RETURN_WH
            if (qty > 0 && warehouse === GOOD_RETURN_WH) {
              goodReturnMap[key] = (goodReturnMap[key] || 0) + qty;
            }
          }
        }
      });

      // Build openingMap from lastBeforeDay balances
      Object.keys(lastBeforeDay).forEach((key) => {
        openingMap[key] = lastBeforeDay[key].balance;
      });

      // ---------- 2) Adjustment from Stock Reconciliation docs ----------

      for (const recon of reconDocs) {
        const doc = await getDoc("Stock Reconciliation", recon.name);
        const recItems = doc.items || [];

        recItems.forEach((it) => {
          const itemCode = it.item_code;
          const warehouse = it.warehouse;
          if (!itemCode || !warehouse) return;

          const key = `${itemCode}||${warehouse}`;
          const currentQty = parseFloat(it.current_qty || 0); // before reconciliation
          const newQty = parseFloat(it.qty || 0); // after reconciliation
          const delta = newQty - currentQty; // +increase / -decrease

          adjustmentMap[key] = (adjustmentMap[key] || 0) + delta;
        });
      }

      // ---------- 3) Current stock "now" from SLE ----------

      sleToToday.forEach((entry) => {
        const itemCode = entry.item_code;
        const warehouse = entry.warehouse;
        if (!itemCode || !warehouse) return;

        const key = `${itemCode}||${warehouse}`;
        const balance = parseFloat(entry.qty_after_transaction) || 0;
        const ts = makeTs(entry);

        const existing = lastTillToday[key];
        if (!existing || ts > existing.ts) {
          lastTillToday[key] = { ts, balance };
        }
      });

      Object.keys(lastTillToday).forEach((key) => {
        currentMap[key] = lastTillToday[key].balance;
      });

      // ---------- 4) Build base flat rows (no grouping yet) ----------

      const keys = new Set([
        ...Object.keys(openingMap),
        ...Object.keys(inMap),
        ...Object.keys(outMap),
        ...Object.keys(adjustmentMap),
        ...Object.keys(soldMap),
        ...Object.keys(goodReturnMap),
        ...Object.keys(currentMap),
      ]);

      const result = Array.from(keys).map((key) => {
        const [item_code, warehouse] = key.split("||");
        const opening = openingMap[key] || 0;
        const inQty = inMap[key] || 0;
        const outQty = outMap[key] || 0;
        const adjQty = adjustmentMap[key] || 0;
        const soldQty = soldMap[key] || 0;
        const returnQty = goodReturnMap[key] || 0;
        const currentStock = currentMap[key] || 0;

        return {
          item_code,
          item_name: itemMap[item_code] || "",
          warehouse,
          opening_stock: opening,
          in_qty: inQty,
          out_qty: outQty,
          adjustment_qty: adjQty, // signed: +increase, -decrease
          sold_qty: soldQty,
          good_return_qty: returnQty,
          current_stock: currentStock, // live stock now
        };
      });

      // sort by warehouse then item (base deterministic order)
      result.sort((a, b) => {
        if (a.warehouse === b.warehouse) {
          return a.item_code.localeCompare(b.item_code);
        }
        return a.warehouse.localeCompare(b.warehouse);
      });

      // ---------- 5) Decide which raw component is the parent for each finished item ----------

      const chosenParentOfFinished = {}; // finished item -> chosen raw parent

      Object.keys(finishedToRawMap).forEach((finishedItem) => {
        const rawItems = Array.from(finishedToRawMap[finishedItem]);
        if (rawItems.length === 0) return;

        // Prefer items whose name looks like "Raw ..." (Raw Sattu) if present.
        let bestParent = rawItems[0];

        rawItems.forEach((rawCode) => {
          const name = (itemMap[rawCode] || rawCode).toLowerCase();
          const bestName = (itemMap[bestParent] || bestParent).toLowerCase();

          const isRawLike =
            name.startsWith("raw ") || name.includes(" raw ");
          const bestIsRawLike =
            bestName.startsWith("raw ") || bestName.includes(" raw ");

          if (isRawLike && !bestIsRawLike) {
            bestParent = rawCode;
          } else if (isRawLike === bestIsRawLike) {
            // tie-breaker: alphabetical by code
            if (rawCode < bestParent) bestParent = rawCode;
          }
        });

        chosenParentOfFinished[finishedItem] = bestParent;
      });

      const parentToChildren = {}; // chosen parent raw -> Set of finished items
      Object.entries(chosenParentOfFinished).forEach(
        ([finishedItem, parentRaw]) => {
          if (!parentToChildren[parentRaw]) {
            parentToChildren[parentRaw] = new Set();
          }
          parentToChildren[parentRaw].add(finishedItem);
        }
      );

      // ---------- 6) Build grouped rows with headers ----------

      const rowsByItemCode = {};
      result.forEach((row) => {
        if (!rowsByItemCode[row.item_code]) {
          rowsByItemCode[row.item_code] = [];
        }
        rowsByItemCode[row.item_code].push(row);
      });

      const makeRowKey = (row) => `${row.warehouse}||${row.item_code}`;

      // Map: finished item -> its parent raw (for movement grouping)
      const parentForItem = {};
      Object.entries(chosenParentOfFinished).forEach(
        ([finishedItem, parentRaw]) => {
          parentForItem[finishedItem] = parentRaw;
        }
      );

      // Which groups had any movement on the selected date?
      const groupMovement = {}; // group item_code -> boolean
      result.forEach((row) => {
        const groupCode = parentForItem[row.item_code] || row.item_code;
        const hasMovement =
          (row.in_qty || 0) !== 0 ||
          (row.out_qty || 0) !== 0 ||
          (row.adjustment_qty || 0) !== 0 ||
          (row.sold_qty || 0) !== 0 ||
          (row.good_return_qty || 0) !== 0;

        if (hasMovement) {
          groupMovement[groupCode] = true;
        }
      });

      const usedKeys = new Set();
      const finalRows = [];

      // Parents: union of "chosen parents" and all BOM raw items
      const parentCandidateSet = new Set([
        ...Object.keys(parentToChildren),
        ...Object.keys(rawToFinishedMap),
      ]);

      const parentCodes = Array.from(parentCandidateSet).sort((a, b) => {
        const aMove = !!groupMovement[a];
        const bMove = !!groupMovement[b];
        if (aMove !== bMove) return aMove ? -1 : 1; // groups with movement first

        const nA = (itemMap[a] || a).toLowerCase();
        const nB = (itemMap[b] || b).toLowerCase();
        if (nA === nB) return a.localeCompare(b);
        return nA.localeCompare(nB);
      });

      // 6a) BOM parent groups (Raw Sattu, pouches, stickers, etc.)
      parentCodes.forEach((parentCode) => {
        let parentRows = rowsByItemCode[parentCode] || [];

        const childItemCodes = Array.from(
          parentToChildren[parentCode] || []
        ).sort((a, b) => {
          const nA = (itemMap[a] || a).toLowerCase();
          const nB = (itemMap[b] || b).toLowerCase();
          if (nA === nB) return a.localeCompare(b);
          return nA.localeCompare(nB);
        });

        const hasChildRows = childItemCodes.some(
          (fgCode) =>
            rowsByItemCode[fgCode] && rowsByItemCode[fgCode].length > 0
        );

        // If this parent and all its children have no stock rows at all,
        // create a single dummy parent row so we don't show just the heading.
        if (parentRows.length === 0 && !hasChildRows) {
          parentRows = [
            {
              item_code: parentCode,
              item_name: itemMap[parentCode] || "",
              warehouse: "",
              opening_stock: 0,
              in_qty: 0,
              out_qty: 0,
              adjustment_qty: 0,
              sold_qty: 0,
              good_return_qty: 0,
              current_stock: 0,
            },
          ];
        }

        // Group header row for this parent – ALWAYS created
        finalRows.push({
          is_group_header: true,
          group_item_code: parentCode,
          group_label: itemMap[parentCode] || parentCode,
        });

        // Parent's own stock rows (raw / pouch / sticker etc.)
        parentRows.forEach((row) => {
          const key = makeRowKey(row);
          if (usedKeys.has(key)) return;
          usedKeys.add(key);

          finalRows.push({
            ...row,
            is_parent_item: true,
            parent_item_code: null,
            group_item_code: parentCode,
          });
        });

        // Child finished goods made from this raw (Products)
        childItemCodes.forEach((fgCode) => {
          let childRows = rowsByItemCode[fgCode] || [];

          // if this finished product has never had any stock movement,
          // create a dummy zero row so it still appears under its parent.
          if (childRows.length === 0) {
            childRows = [
              {
                item_code: fgCode,
                item_name: itemMap[fgCode] || "",
                warehouse: "",
                opening_stock: 0,
                in_qty: 0,
                out_qty: 0,
                adjustment_qty: 0,
                sold_qty: 0,
                good_return_qty: 0,
                current_stock: 0,
              },
            ];
          }

          childRows.forEach((row) => {
            const key = makeRowKey(row);
            if (usedKeys.has(key)) return;
            usedKeys.add(key);

            finalRows.push({
              ...row,
              parent_item_code: parentCode,
              group_item_code: parentCode,
            });
          });
        });
      });

      // 6b) Any leftover items that are not part of any BOM
      //     -> they get a self-header group.
      const remainingByItem = {};
      result.forEach((row) => {
        const key = makeRowKey(row);
        if (usedKeys.has(key)) return;

        if (!remainingByItem[row.item_code]) {
          remainingByItem[row.item_code] = [];
        }
        remainingByItem[row.item_code].push(row);
      });

      const remainingItemCodes = Object.keys(remainingByItem).sort((a, b) => {
        const aMove = !!groupMovement[a];
        const bMove = !!groupMovement[b];
        if (aMove !== bMove) return aMove ? -1 : 1; // movement first within this block

        const nA = (itemMap[a] || a).toLowerCase();
        const nB = (itemMap[b] || b).toLowerCase();
        if (nA === nB) return a.localeCompare(b);
        return nA.localeCompare(nB);
      });

      remainingItemCodes.forEach((code) => {
        const label = itemMap[code] || code;

        // self header
        finalRows.push({
          is_group_header: true,
          group_item_code: code,
          group_label: label,
        });

        // its own rows
        remainingByItem[code].forEach((row) => {
          const key = makeRowKey(row);
          usedKeys.add(key);

          finalRows.push({
            ...row,
            is_parent_item: true,
            parent_item_code: null,
            group_item_code: code,
          });
        });
      });

      // Default: all groups expanded
      const newExpanded = {};
      finalRows.forEach((r) => {
        if (r.is_group_header) {
          newExpanded[r.group_item_code] = true;
        }
      });

      setRows(finalRows);
      setExpandedGroups(newExpanded);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load daily stock summary");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // ---------- 🔍 FILTERED VIEW FOR SEARCH ----------

  const lowerSearch = searchTerm.trim().toLowerCase();

  let displayRows = rows;

  if (lowerSearch) {
    // group rows by group_item_code to keep headers + children together
    const groups = {};

    rows.forEach((r, idx) => {
      if (r.is_group_header) {
        const code = r.group_item_code || `__header_${idx}`;
        if (!groups[code]) {
          groups[code] = { header: r, details: [], firstIndex: idx };
        } else {
          groups[code].header = r;
          groups[code].firstIndex = Math.min(groups[code].firstIndex, idx);
        }
      } else {
        const code = r.group_item_code || r.item_code || `__row_${idx}`;
        if (!groups[code]) {
          groups[code] = { header: null, details: [], firstIndex: idx };
        }
        groups[code].details.push(r);
      }
    });

    const orderedCodes = Object.keys(groups).sort(
      (a, b) => groups[a].firstIndex - groups[b].firstIndex
    );

    const filtered = [];

    orderedCodes.forEach((code) => {
      const g = groups[code];
      const header = g.header;
      const details = g.details;

      const headerMatches =
        header &&
        ((header.group_label || "").toLowerCase().includes(lowerSearch) ||
          (header.group_item_code || "").toLowerCase().includes(lowerSearch));

      const matchingDetails = details.filter((d) => {
        const name = (d.item_name || "").toLowerCase();
        const codeStr = (d.item_code || "").toLowerCase();
        const wh = (d.warehouse || "").toLowerCase();
        return (
          name.includes(lowerSearch) ||
          codeStr.includes(lowerSearch) ||
          wh.includes(lowerSearch)
        );
      });

      if (headerMatches || matchingDetails.length > 0) {
        if (header) filtered.push(header);
        matchingDetails.forEach((d) => filtered.push(d));
      }
    });

    displayRows = filtered;
  }

  // Count visible (non-header) rows, respecting collapsed groups (only when no search)
  const visibleRowCount = displayRows.reduce((count, r) => {
    if (r.is_group_header) return count;
    if (
      !lowerSearch && // when searching, ignore collapse hiding
      r.group_item_code &&
      expandedGroups[r.group_item_code] === false
    ) {
      return count;
    }
    return count + 1;
  }, 0);

  // ---------- ⬇️ DOWNLOAD AS EXCEL/CSV (SKIP ALL-ZERO ROWS) ----------

  function isAllZeroRow(row) {
    const numericFields = [
      "opening_stock",
      "in_qty",
      "out_qty",
      "adjustment_qty",
      "sold_qty",
      "good_return_qty",
      "current_stock",
    ];

    return numericFields.every((field) => {
      const val = Number(row[field] || 0);
      return !val; // 0, NaN, null -> treated as zero
    });
  }

  function downloadSummaryAsCsv() {
  // Use what user is currently seeing (after search filter)
  const dataRows = [];

  displayRows.forEach((r) => {
    // Skip group headers
    if (r.is_group_header) return;

    // Skip rows where ALL numeric values are zero
    if (isAllZeroRow(r)) return;

    dataRows.push({
      Warehouse: r.warehouse || "",
      "Item Code": r.item_code || "",
      "Item Name": r.item_name || "",
      "Opening Stock": r.opening_stock || 0,
      "In Qty (on date)": r.in_qty || 0,
      "Out Qty (on date)": r.out_qty || 0,
      "Adjustment (Reconciliation)": r.adjustment_qty || 0,
      "Sold Qty (on date)": r.sold_qty || 0,
      "Return Qty (Good, on date)": r.good_return_qty || 0,
      "Current Stock (now)": r.current_stock || 0,
    });
  });

  if (dataRows.length === 0) {
    window.alert("Nothing to download (all rows are zero).");
    return;
  }

  const headers = Object.keys(dataRows[0]);

  const lines = [];

  // ✅ header row (now properly quoted so commas are safe)
  lines.push(
    headers
      .map((h) => {
        const str = String(h).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(",")
  );

  // data rows
  dataRows.forEach((row) => {
    const line = headers
      .map((h) => {
        const raw = row[h] ?? "";
        const str = String(raw).replace(/"/g, '""'); // escape quotes
        return `"${str}"`;
      })
      .join(",");
    lines.push(line);
  });

  const csv = lines.join("\n");
  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `daily-stock-summary-${date}.csv`; // opens in Excel
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

  return (
    <div className="daily-stock-summary">
      {/* Header */}
      <div className="daily-stock-summary-header-row">
        <div className="daily-stock-summary-header">
          <h2 className="daily-stock-summary-title">Daily Stock Summary</h2>
          <p className="daily-stock-summary-subtitle">
            Opening, movement &amp; balances by warehouse for the selected date
          </p>
        </div>

        <div className="daily-stock-summary-controls">
          <span className="daily-stock-summary-date-label">Date</span>
          <input
            type="date"
            className="input daily-stock-summary-date-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          {/* 🔍 Search box */}
          <input
            type="text"
            className="input daily-stock-summary-search-input"
            placeholder="Search item / code / warehouse"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {/* ⬇️ Download button */}
          <button
            type="button"
            className="btn btn-secondary btn-sm daily-stock-summary-download"
            onClick={downloadSummaryAsCsv}
          >
            Download Excel
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm daily-stock-summary-refresh"
            onClick={() => loadData(date)}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="daily-stock-summary-meta-row">
        <span className="daily-stock-summary-meta">
          Showing {visibleRowCount} line{visibleRowCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* States */}
      {loading && (
        <p className="daily-stock-summary-loading text-muted">
          Loading stock summary...
        </p>
      )}
      {error && (
        <p className="daily-stock-summary-error alert alert-error">
          {error}
        </p>
      )}
      {!loading && !error && displayRows.length === 0 && (
        <p className="daily-stock-summary-empty text-muted">
          No rows match your filters.
        </p>
      )}

      {/* Table */}
      {!loading && !error && displayRows.length > 0 && (
        <div className="daily-stock-summary-table-wrapper">
          <table className="daily-stock-summary-table">
            <thead>
              <tr>
                <th>Warehouse</th>
                <th>Item</th>
                <th>Opening Stock</th>
                <th>In Qty (on date)</th>
                <th>Out Qty (on date)</th>
                <th>Adjustment (Reconciliation)</th>
                <th>Sold Qty (on date)</th>
                <th>Return Qty (on date)</th>
                <th>Current Stock (now)</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r, idx) => {
                // 📦 Group header row, clickable to expand/collapse
                if (r.is_group_header) {
                  const isOpen = expandedGroups[r.group_item_code] !== false;
                  return (
                    <tr
                      key={`group-${r.group_item_code}-${idx}`}
                      className="daily-stock-summary-group-row"
                      onClick={() =>
                        setExpandedGroups((prev) => ({
                          ...prev,
                          [r.group_item_code]: !isOpen,
                        }))
                      }
                    >
                      <td
                        className="daily-stock-summary-group-header"
                        colSpan={9}
                      >
                        <span className="daily-stock-summary-group-icon">
                          📦
                        </span>{" "}
                        {r.group_label}
                        <span className="daily-stock-summary-group-toggle">
                          {isOpen ? "▾" : "▸"}
                        </span>
                      </td>
                    </tr>
                  );
                }

                // Hide rows belonging to collapsed group (only when no search)
                if (
                  !lowerSearch &&
                  r.group_item_code &&
                  expandedGroups[r.group_item_code] === false
                ) {
                  return null;
                }

                const isParent = r.is_parent_item;
                const isChild =
                  !!r.parent_item_code && !r.is_parent_item;

                // Only show one line if code == name
                const hasName = !!r.item_name;
                const topLabel = hasName ? r.item_name : r.item_code;
                const showSecondLine =
                  hasName && r.item_name !== r.item_code;
                const secondLabel = showSecondLine ? r.item_code : "";

                return (
                  <tr
                    key={`${r.warehouse}||${r.item_code}||${
                      r.parent_item_code || ""
                    }`}
                    className={[
                      isParent ? "daily-stock-summary-row-parent" : "",
                      isChild ? "daily-stock-summary-row-child" : "",
                    ]
                      .join(" ")
                      .trim()}
                  >
                    <td className="daily-stock-summary-warehouse">
                      {r.warehouse}
                    </td>
                    <td className="daily-stock-summary-item">
                      <div className="daily-stock-summary-item-code">
                        {topLabel}
                      </div>
                      {secondLabel && (
                        <div className="daily-stock-summary-item-name">
                          {secondLabel}
                        </div>
                      )}
                    </td>
                    <td className="daily-stock-summary-opening">
                      {r.opening_stock || 0}
                    </td>
                    <td className="daily-stock-summary-inqty">
                      {r.in_qty || 0}
                    </td>
                    <td className="daily-stock-summary-outqty">
                      {r.out_qty || 0}
                    </td>
                    <td className="daily-stock-summary-adjustment">
                      {r.adjustment_qty || 0}
                    </td>
                    <td className="daily-stock-summary-sold">
                      {r.sold_qty || 0}
                    </td>
                    <td className="daily-stock-summary-returns">
                      {r.good_return_qty || 0}
                    </td>
                    <td className="daily-stock-summary-current">
                      {r.current_stock || 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default DailyStockSummary;
