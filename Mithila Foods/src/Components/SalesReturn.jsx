// src/SalesReturn.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getCustomers,
  getCompanies,
  getFinishedItemsForSales,
  getRecentSalesReturns,
  createDoc,
  submitDoc,
} from "./erpBackendApi";
import "../CSS/SalesReturn.css";

const GOOD_WH = "Finished Goods - MF";
const DAMAGED_WH = "Damaged - MF"; // change if needed

function toYMD(input) {
  if (input == null) return "";
  if (input instanceof Date && !isNaN(input.getTime())) return input.toISOString().slice(0, 10);

  const s = String(input).trim();
  if (!s) return "";

  // YYYY-MM-DD or YYYY-MM-DDTHH:MM...
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[t\s].*)?$/i);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  // DDMMYYYY
  if (/^\d{8}$/.test(s)) {
    const dd = s.slice(0, 2);
    const mm = s.slice(2, 4);
    const yyyy = s.slice(4, 8);
    return `${yyyy}-${mm}-${dd}`;
  }

  return "";
}

function createEmptyRow(id) {
  return {
    id,
    item_code: "",
    qty: "1.00",
    rate: "0.00",
    quality: "good",
    warehouse: GOOD_WH,
  };
}

function SalesReturn() {
  // Master data
  const [customers, setCustomers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [itemsCatalog, setItemsCatalog] = useState([]);

  // Header fields
  const todayStr = new Date().toISOString().slice(0, 10);
  const [customer, setCustomer] = useState("");
  const [company, setCompany] = useState("");
  const [postingDate, setPostingDate] = useState(todayStr);

  // Line items
  const [rows, setRows] = useState([createEmptyRow(0)]);

  // Recent returns
  const [returns, setReturns] = useState([]);
  const [loadingReturns, setLoadingReturns] = useState(false);

  // Shared state
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [creatingReturn, setCreatingReturn] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      setLoadingMaster(true);
      setError("");
      try {
        const [custData, compData, itemData, recentReturns] = await Promise.all([
          getCustomers(),
          getCompanies(),
          getFinishedItemsForSales(),
          getRecentSalesReturns(50),
        ]);

        setCustomers(custData || []);
        setCompanies(compData || []);
        setItemsCatalog(itemData || []);
        setReturns(recentReturns || []);

        if ((custData || []).length > 0) setCustomer(custData[0].name);
        if ((compData || []).length > 0) setCompany(compData[0].name);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load data for Sales Returns");
      } finally {
        setLoadingMaster(false);
      }
    }

    load();
  }, []);

  function handleRowChange(id, field, value) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;

        const updated = { ...r, [field]: value };

        if (field === "quality") {
          updated.warehouse = value === "damaged" ? DAMAGED_WH : GOOD_WH;
        }

        return updated;
      })
    );
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      createEmptyRow(prev.length ? prev[prev.length - 1].id + 1 : 0),
    ]);
  }

  function removeRow(id) {
    setRows((prev) => {
      const filtered = prev.filter((r) => r.id !== id);
      return filtered.length ? filtered : [createEmptyRow(0)];
    });
  }

  async function reloadReturns() {
    try {
      setLoadingReturns(true);
      const rec = await getRecentSalesReturns(50);
      setReturns(rec || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReturns(false);
    }
  }

  async function handleCreateReturn() {
    setError("");
    setMessage("");

    if (!customer) return setError("Please select a Customer.");
    if (!company) return setError("Please select a Company.");

    // ✅ force safe date (never let ERP defaults kick in)
    const posting = toYMD(postingDate) || todayStr;
    const due = posting; // ✅ always valid date (fixes 'posting_date' string issue)

    const validRows = rows
      .map((r) => ({
        ...r,
        qtyNum: parseFloat(r.qty),
        rateNum: parseFloat(r.rate),
      }))
      .filter((r) => r.item_code && !isNaN(r.qtyNum) && r.qtyNum > 0);

    if (!validRows.length) return setError("Add at least one line with item and positive qty.");

    try {
      setCreatingReturn(true);

      const items = validRows.map((r) => {
        const targetWh = r.quality === "damaged" ? DAMAGED_WH : GOOD_WH;
        return {
          item_code: r.item_code,
          qty: -Math.abs(r.qtyNum), // ✅ negative qty for return
          rate: isNaN(r.rateNum) ? 0 : r.rateNum,
          warehouse: targetWh,
        };
      });

      const payload = {
        doctype: "Sales Invoice",
        is_return: 1,
        update_stock: 1,
        posting_date: posting,
        due_date: due, // ✅ IMPORTANT: prevents DB error "due_date = 'posting_date'"
        company,
        customer,
        items,
        remarks:
          "Sales return created from custom screen (good/damaged → respective warehouses).",
      };

      const siDoc = await createDoc("Sales Invoice", payload);
      const siName = siDoc?.data?.name || siDoc?.message?.name || siDoc?.name || "";

      if (siName) await submitDoc("Sales Invoice", siName);

      setMessage(`Sales Return created as Sales Invoice: ${siName || "draft (no name returned)"}.`);

      setRows([createEmptyRow(0)]);
      await reloadReturns();
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.error ||
          err.message ||
          "Failed to create Sales Return"
      );
    } finally {
      setCreatingReturn(false);
    }
  }

  return (
    <div className="sales-return">
      <div className="sales-return-header">
        <div className="sales-return-title-block">
          <h2 className="sales-return-title">Sales Returns (with Stock Update)</h2>
          <p className="sales-return-subtitle">
            Create a Sales Invoice Return that updates stock and classifies items as Good or Damaged.
          </p>
        </div>
        <div className="sales-return-header-pill">
          {returns.length} return{returns.length !== 1 ? "s" : ""}
        </div>
      </div>

      {loadingMaster && (
        <div className="sales-return-loading text-muted">
          Loading customers, companies & items...
        </div>
      )}
      {error && <div className="alert alert-error sales-return-error">{error}</div>}
      {message && <div className="alert alert-success sales-return-message">{message}</div>}

      <div className="sales-return-card">
        <div className="sales-return-card-header">
          <h3 className="sales-return-card-title">Create Sales Return</h3>
        </div>

        <div className="sales-return-form-grid">
          <div className="sales-return-field-group">
            <label className="form-label sales-return-field-label">Customer</label>
            <select
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              className="select"
              disabled={loadingMaster || customers.length === 0}
            >
              {customers.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.customer_name || c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sales-return-field-group">
            <label className="form-label sales-return-field-label">Company</label>
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="select"
              disabled={loadingMaster || companies.length === 0}
            >
              {companies.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.company_name || c.name} ({c.abbr})
                </option>
              ))}
            </select>
          </div>

          <div className="sales-return-field-group">
            <label className="form-label sales-return-field-label">Posting Date</label>
            <input
              type="date"
              className="input"
              value={postingDate}
              onChange={(e) => setPostingDate(e.target.value)}
            />
          </div>
        </div>

        <div className="sales-return-items-header">
          <h4 className="sales-return-section-title">Items to Return</h4>
          <button type="button" onClick={addRow} className="btn btn-accent btn-sm">
            + Add Item
          </button>
        </div>

        <div className="sales-return-rows">
          {rows.map((row, idx) => (
            <div key={row.id} className="sales-return-row-card">
              <div className="sales-return-row-header">
                <span className="sales-return-row-title">
                  Line #{idx + 1}
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

              <div className="sales-return-row-grid">
                <div className="sales-return-row-field">
                  <label className="form-label">Item</label>
                  <ItemSearchDropdown
                    items={itemsCatalog}
                    value={row.item_code}
                    onSelect={(code) => handleRowChange(row.id, "item_code", code)}
                    placeholder="Search item name / code..."
                  />
                </div>

                <div className="sales-return-row-field">
                  <label className="form-label">Qty</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={row.qty}
                    onChange={(e) => handleRowChange(row.id, "qty", e.target.value)}
                  />
                </div>

                <div className="sales-return-row-field">
                  <label className="form-label">Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={row.rate}
                    onChange={(e) => handleRowChange(row.id, "rate", e.target.value)}
                  />
                </div>

                <div className="sales-return-row-field">
                  <label className="form-label">Quality</label>
                  <select
                    className="select"
                    value={row.quality || "good"}
                    onChange={(e) => handleRowChange(row.id, "quality", e.target.value)}
                  >
                    <option value="good">Good (add to Finished Goods)</option>
                    <option value="damaged">Damaged (add to Damaged warehouse)</option>
                  </select>
                </div>

                <div className="sales-return-row-field">
                  <label className="form-label">Target Warehouse</label>
                  <input className="input" value={row.warehouse} readOnly />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="sales-return-submit-row">
          <button
            type="button"
            onClick={handleCreateReturn}
            disabled={creatingReturn || loadingMaster}
            className="btn btn-primary"
          >
            {creatingReturn ? "Creating Sales Return..." : "Create Sales Return"}
          </button>
        </div>
      </div>

      <div className="sales-return-list-section">
        <div className="sales-return-list-header">
          <h3 className="sales-return-list-title">Recent Sales Returns</h3>
        </div>

        {loadingReturns && (
          <div className="sales-return-list-loading text-muted">
            Loading recent returns...
          </div>
        )}

        {!loadingReturns && returns.length === 0 && (
          <div className="sales-return-list-empty text-muted">No returns found.</div>
        )}

        {!loadingReturns && returns.length > 0 && (
          <div className="sales-return-table-wrapper table-container">
            <table className="table sales-return-table">
              <thead>
                <tr>
                  <th>Return Name</th>
                  <th>Customer</th>
                  <th>Company</th>
                  <th>Date</th>
                  <th>Grand Total</th>
                  <th>Return Against</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((r) => (
                  <tr key={r.name}>
                    <td className="sales-return-name-cell">{r.name}</td>
                    <td className="sales-return-customer-cell">{r.customer}</td>
                    <td className="sales-return-company-cell">{r.company}</td>
                    <td className="sales-return-date-cell">{r.posting_date}</td>
                    <td className="sales-return-amount-cell">
                      ₹ {r.grand_total != null ? Number(r.grand_total).toFixed(2) : "0.00"}
                    </td>
                    <td>{r.return_against || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ✅ Same dropdown component used in StockTransfer */
function ItemSearchDropdown({ items, value, onSelect, placeholder }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  const selected = useMemo(() => items.find((x) => x.name === value) || null, [items, value]);

  const filtered = useMemo(() => {
    const s = (q || "").trim().toLowerCase();
    const base = !s
      ? items
      : items.filter((it) => {
          const code = (it.name || "").toLowerCase();
          const name = (it.item_name || "").toLowerCase();
          return code.includes(s) || name.includes(s);
        });
    return base.slice(0, 80);
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

export default SalesReturn;
