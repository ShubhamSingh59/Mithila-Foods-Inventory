//////// src/SalesReturn.jsx
//////import React, { useEffect, useMemo, useRef, useState } from "react";
//////import {
//////  getCustomers,
//////  getCompanies,
//////  getFinishedItemsForSales,
//////  getRecentSalesReturns,
//////  createDoc,
//////  submitDoc,
//////} from "./erpBackendApi";
//////import "../CSS/SalesReturn.css";

//////const GOOD_WH = "Finished Goods - MF";
//////const DAMAGED_WH = "Damaged - MF"; // change if needed

//////function toYMD(input) {
//////  if (input == null) return "";
//////  if (input instanceof Date && !isNaN(input.getTime())) return input.toISOString().slice(0, 10);

//////  const s = String(input).trim();
//////  if (!s) return "";

//////  // YYYY-MM-DD or YYYY-MM-DDTHH:MM...
//////  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[t\s].*)?$/i);
//////  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

//////  // DD-MM-YYYY or DD/MM/YYYY
//////  const dmy = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
//////  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

//////  // DDMMYYYY
//////  if (/^\d{8}$/.test(s)) {
//////    const dd = s.slice(0, 2);
//////    const mm = s.slice(2, 4);
//////    const yyyy = s.slice(4, 8);
//////    return `${yyyy}-${mm}-${dd}`;
//////  }

//////  return "";
//////}

//////function createEmptyRow(id) {
//////  return {
//////    id,
//////    item_code: "",
//////    qty: "1.00",
//////    rate: "0.00",
//////    quality: "good",
//////    warehouse: GOOD_WH,
//////  };
//////}

//////function SalesReturn() {
//////  // Master data
//////  const [customers, setCustomers] = useState([]);
//////  const [companies, setCompanies] = useState([]);
//////  const [itemsCatalog, setItemsCatalog] = useState([]);

//////  // Header fields
//////  const todayStr = new Date().toISOString().slice(0, 10);
//////  const [customer, setCustomer] = useState("");
//////  const [company, setCompany] = useState("");
//////  const [postingDate, setPostingDate] = useState(todayStr);

//////  // Line items
//////  const [rows, setRows] = useState([createEmptyRow(0)]);

//////  // Recent returns
//////  const [returns, setReturns] = useState([]);
//////  const [loadingReturns, setLoadingReturns] = useState(false);

//////  // Shared state
//////  const [loadingMaster, setLoadingMaster] = useState(false);
//////  const [creatingReturn, setCreatingReturn] = useState(false);
//////  const [error, setError] = useState("");
//////  const [message, setMessage] = useState("");

//////  useEffect(() => {
//////    async function load() {
//////      setLoadingMaster(true);
//////      setError("");
//////      try {
//////        const [custData, compData, itemData, recentReturns] = await Promise.all([
//////          getCustomers(),
//////          getCompanies(),
//////          getFinishedItemsForSales(),
//////          getRecentSalesReturns(50),
//////        ]);

//////        setCustomers(custData || []);
//////        setCompanies(compData || []);
//////        setItemsCatalog(itemData || []);
//////        setReturns(recentReturns || []);

//////        if ((custData || []).length > 0) setCustomer(custData[0].name);
//////        if ((compData || []).length > 0) setCompany(compData[0].name);
//////      } catch (err) {
//////        console.error(err);
//////        setError(err.message || "Failed to load data for Sales Returns");
//////      } finally {
//////        setLoadingMaster(false);
//////      }
//////    }

//////    load();
//////  }, []);

//////  function handleRowChange(id, field, value) {
//////    setRows((prev) =>
//////      prev.map((r) => {
//////        if (r.id !== id) return r;

//////        const updated = { ...r, [field]: value };

//////        if (field === "quality") {
//////          updated.warehouse = value === "damaged" ? DAMAGED_WH : GOOD_WH;
//////        }

//////        return updated;
//////      })
//////    );
//////  }

//////  function addRow() {
//////    setRows((prev) => [
//////      ...prev,
//////      createEmptyRow(prev.length ? prev[prev.length - 1].id + 1 : 0),
//////    ]);
//////  }

//////  function removeRow(id) {
//////    setRows((prev) => {
//////      const filtered = prev.filter((r) => r.id !== id);
//////      return filtered.length ? filtered : [createEmptyRow(0)];
//////    });
//////  }

//////  async function reloadReturns() {
//////    try {
//////      setLoadingReturns(true);
//////      const rec = await getRecentSalesReturns(50);
//////      setReturns(rec || []);
//////    } catch (err) {
//////      console.error(err);
//////    } finally {
//////      setLoadingReturns(false);
//////    }
//////  }

//////  async function handleCreateReturn() {
//////    setError("");
//////    setMessage("");

//////    if (!customer) return setError("Please select a Customer.");
//////    if (!company) return setError("Please select a Company.");

//////    // ✅ force safe date (never let ERP defaults kick in)
//////    const posting = toYMD(postingDate) || todayStr;
//////    const due = posting; // ✅ always valid date (fixes 'posting_date' string issue)

//////    const validRows = rows
//////      .map((r) => ({
//////        ...r,
//////        qtyNum: parseFloat(r.qty),
//////        rateNum: parseFloat(r.rate),
//////      }))
//////      .filter((r) => r.item_code && !isNaN(r.qtyNum) && r.qtyNum > 0);

//////    if (!validRows.length) return setError("Add at least one line with item and positive qty.");

//////    try {
//////      setCreatingReturn(true);

//////      const items = validRows.map((r) => {
//////        const targetWh = r.quality === "damaged" ? DAMAGED_WH : GOOD_WH;
//////        return {
//////          item_code: r.item_code,
//////          qty: -Math.abs(r.qtyNum), // ✅ negative qty for return
//////          rate: isNaN(r.rateNum) ? 0 : r.rateNum,
//////          warehouse: targetWh,
//////        };
//////      });

//////      const payload = {
//////        doctype: "Sales Invoice",
//////        is_return: 1,
//////        update_stock: 1,
//////        posting_date: posting,
//////        due_date: due, // ✅ IMPORTANT: prevents DB error "due_date = 'posting_date'"
//////        company,
//////        customer,
//////        items,
//////        remarks:
//////          "Sales return created from custom screen (good/damaged → respective warehouses).",
//////      };

//////      const siDoc = await createDoc("Sales Invoice", payload);
//////      const siName = siDoc?.data?.name || siDoc?.message?.name || siDoc?.name || "";

//////      if (siName) await submitDoc("Sales Invoice", siName);

//////      setMessage(`Sales Return created as Sales Invoice: ${siName || "draft (no name returned)"}.`);

//////      setRows([createEmptyRow(0)]);
//////      await reloadReturns();
//////    } catch (err) {
//////      console.error(err);
//////      setError(
//////        err.response?.data?.error?.message ||
//////          err.response?.data?.error ||
//////          err.message ||
//////          "Failed to create Sales Return"
//////      );
//////    } finally {
//////      setCreatingReturn(false);
//////    }
//////  }

//////  return (
//////    <div className="sales-return">
//////      <div className="sales-return-header">
//////        <div className="sales-return-title-block">
//////          <h2 className="sales-return-title">Sales Returns (with Stock Update)</h2>
//////          <p className="sales-return-subtitle">
//////            Create a Sales Invoice Return that updates stock and classifies items as Good or Damaged.
//////          </p>
//////        </div>
//////        <div className="sales-return-header-pill">
//////          {returns.length} return{returns.length !== 1 ? "s" : ""}
//////        </div>
//////      </div>

//////      {loadingMaster && (
//////        <div className="sales-return-loading text-muted">
//////          Loading customers, companies & items...
//////        </div>
//////      )}
//////      {error && <div className="alert alert-error sales-return-error">{error}</div>}
//////      {message && <div className="alert alert-success sales-return-message">{message}</div>}

//////      <div className="sales-return-card">
//////        <div className="sales-return-card-header">
//////          <h3 className="sales-return-card-title">Create Sales Return</h3>
//////        </div>

//////        <div className="sales-return-form-grid">
//////          <div className="sales-return-field-group">
//////            <label className="form-label sales-return-field-label">Customer</label>
//////            <select
//////              value={customer}
//////              onChange={(e) => setCustomer(e.target.value)}
//////              className="select"
//////              disabled={loadingMaster || customers.length === 0}
//////            >
//////              {customers.map((c) => (
//////                <option key={c.name} value={c.name}>
//////                  {c.customer_name || c.name}
//////                </option>
//////              ))}
//////            </select>
//////          </div>

//////          <div className="sales-return-field-group">
//////            <label className="form-label sales-return-field-label">Company</label>
//////            <select
//////              value={company}
//////              onChange={(e) => setCompany(e.target.value)}
//////              className="select"
//////              disabled={loadingMaster || companies.length === 0}
//////            >
//////              {companies.map((c) => (
//////                <option key={c.name} value={c.name}>
//////                  {c.company_name || c.name} ({c.abbr})
//////                </option>
//////              ))}
//////            </select>
//////          </div>

//////          <div className="sales-return-field-group">
//////            <label className="form-label sales-return-field-label">Posting Date</label>
//////            <input
//////              type="date"
//////              className="input"
//////              value={postingDate}
//////              onChange={(e) => setPostingDate(e.target.value)}
//////            />
//////          </div>
//////        </div>

//////        <div className="sales-return-items-header">
//////          <h4 className="sales-return-section-title">Items to Return</h4>
//////          <button type="button" onClick={addRow} className="btn btn-accent btn-sm">
//////            + Add Item
//////          </button>
//////        </div>

//////        <div className="sales-return-rows">
//////          {rows.map((row, idx) => (
//////            <div key={row.id} className="sales-return-row-card">
//////              <div className="sales-return-row-header">
//////                <span className="sales-return-row-title">
//////                  Line #{idx + 1}
//////                  {row.item_code ? ` · ${row.item_code}` : ""}
//////                </span>
//////                <button
//////                  type="button"
//////                  onClick={() => removeRow(row.id)}
//////                  className="btn btn-ghost btn-sm"
//////                >
//////                  Remove
//////                </button>
//////              </div>

//////              <div className="sales-return-row-grid">
//////                <div className="sales-return-row-field">
//////                  <label className="form-label">Item</label>
//////                  <ItemSearchDropdown
//////                    items={itemsCatalog}
//////                    value={row.item_code}
//////                    onSelect={(code) => handleRowChange(row.id, "item_code", code)}
//////                    placeholder="Search item name / code..."
//////                  />
//////                </div>

//////                <div className="sales-return-row-field">
//////                  <label className="form-label">Qty</label>
//////                  <input
//////                    type="number"
//////                    step="0.01"
//////                    className="input"
//////                    value={row.qty}
//////                    onChange={(e) => handleRowChange(row.id, "qty", e.target.value)}
//////                  />
//////                </div>

//////                <div className="sales-return-row-field">
//////                  <label className="form-label">Rate</label>
//////                  <input
//////                    type="number"
//////                    step="0.01"
//////                    className="input"
//////                    value={row.rate}
//////                    onChange={(e) => handleRowChange(row.id, "rate", e.target.value)}
//////                  />
//////                </div>

//////                <div className="sales-return-row-field">
//////                  <label className="form-label">Quality</label>
//////                  <select
//////                    className="select"
//////                    value={row.quality || "good"}
//////                    onChange={(e) => handleRowChange(row.id, "quality", e.target.value)}
//////                  >
//////                    <option value="good">Good (add to Finished Goods)</option>
//////                    <option value="damaged">Damaged (add to Damaged warehouse)</option>
//////                  </select>
//////                </div>

//////                <div className="sales-return-row-field">
//////                  <label className="form-label">Target Warehouse</label>
//////                  <input className="input" value={row.warehouse} readOnly />
//////                </div>
//////              </div>
//////            </div>
//////          ))}
//////        </div>

//////        <div className="sales-return-submit-row">
//////          <button
//////            type="button"
//////            onClick={handleCreateReturn}
//////            disabled={creatingReturn || loadingMaster}
//////            className="btn btn-primary"
//////          >
//////            {creatingReturn ? "Creating Sales Return..." : "Create Sales Return"}
//////          </button>
//////        </div>
//////      </div>

//////      <div className="sales-return-list-section">
//////        <div className="sales-return-list-header">
//////          <h3 className="sales-return-list-title">Recent Sales Returns</h3>
//////        </div>

//////        {loadingReturns && (
//////          <div className="sales-return-list-loading text-muted">
//////            Loading recent returns...
//////          </div>
//////        )}

//////        {!loadingReturns && returns.length === 0 && (
//////          <div className="sales-return-list-empty text-muted">No returns found.</div>
//////        )}

//////        {!loadingReturns && returns.length > 0 && (
//////          <div className="sales-return-table-wrapper table-container">
//////            <table className="table sales-return-table">
//////              <thead>
//////                <tr>
//////                  <th>Return Name</th>
//////                  <th>Customer</th>
//////                  <th>Company</th>
//////                  <th>Date</th>
//////                  <th>Grand Total</th>
//////                  <th>Return Against</th>
//////                </tr>
//////              </thead>
//////              <tbody>
//////                {returns.map((r) => (
//////                  <tr key={r.name}>
//////                    <td className="sales-return-name-cell">{r.name}</td>
//////                    <td className="sales-return-customer-cell">{r.customer}</td>
//////                    <td className="sales-return-company-cell">{r.company}</td>
//////                    <td className="sales-return-date-cell">{r.posting_date}</td>
//////                    <td className="sales-return-amount-cell">
//////                      ₹ {r.grand_total != null ? Number(r.grand_total).toFixed(2) : "0.00"}
//////                    </td>
//////                    <td>{r.return_against || "-"}</td>
//////                  </tr>
//////                ))}
//////              </tbody>
//////            </table>
//////          </div>
//////        )}
//////      </div>
//////    </div>
//////  );
//////}

///////* ✅ Same dropdown component used in StockTransfer */
//////function ItemSearchDropdown({ items, value, onSelect, placeholder }) {
//////  const [open, setOpen] = useState(false);
//////  const [q, setQ] = useState("");
//////  const ref = useRef(null);

//////  const selected = useMemo(() => items.find((x) => x.name === value) || null, [items, value]);

//////  const filtered = useMemo(() => {
//////    const s = (q || "").trim().toLowerCase();
//////    const base = !s
//////      ? items
//////      : items.filter((it) => {
//////          const code = (it.name || "").toLowerCase();
//////          const name = (it.item_name || "").toLowerCase();
//////          return code.includes(s) || name.includes(s);
//////        });
//////    return base.slice(0, 80);
//////  }, [items, q]);

//////  useEffect(() => {
//////    function onDown(e) {
//////      if (!ref.current) return;
//////      if (!ref.current.contains(e.target)) setOpen(false);
//////    }
//////    document.addEventListener("mousedown", onDown);
//////    return () => document.removeEventListener("mousedown", onDown);
//////  }, []);

//////  return (
//////    <div className="stdrop" ref={ref}>
//////      <button
//////        type="button"
//////        className={`stdrop-control ${open ? "is-open" : ""}`}
//////        onClick={() => setOpen((v) => !v)}
//////      >
//////        <div className="stdrop-value">
//////          {selected ? (
//////            <>
//////              <div className="stdrop-title">{selected.name}</div>
//////              <div className="stdrop-sub">
//////                {selected.item_name || ""} {selected.stock_uom ? `· ${selected.stock_uom}` : ""}
//////              </div>
//////            </>
//////          ) : (
//////            <div className="stdrop-placeholder">{placeholder}</div>
//////          )}
//////        </div>
//////        <div className="stdrop-caret">▾</div>
//////      </button>

//////      {open && (
//////        <div className="stdrop-popover">
//////          <div className="stdrop-search">
//////            <input
//////              autoFocus
//////              className="input"
//////              value={q}
//////              onChange={(e) => setQ(e.target.value)}
//////              placeholder="Type to search..."
//////            />
//////          </div>

//////          <div className="stdrop-list">
//////            {filtered.map((it) => (
//////              <button
//////                key={it.name}
//////                type="button"
//////                className="stdrop-item"
//////                onClick={() => {
//////                  onSelect(it.name);
//////                  setOpen(false);
//////                  setQ("");
//////                }}
//////              >
//////                <div className="stdrop-item-title">{it.name}</div>
//////                <div className="stdrop-item-sub">
//////                  {it.item_name || ""} {it.stock_uom ? `· ${it.stock_uom}` : ""}
//////                </div>
//////              </button>
//////            ))}

//////            {!filtered.length ? (
//////              <div className="stdrop-empty">No items found.</div>
//////            ) : (
//////              <div className="stdrop-hint">Showing up to 80 results</div>
//////            )}
//////          </div>
//////        </div>
//////      )}
//////    </div>
//////  );
//////}

//////export default SalesReturn;


////// src/SalesReturn.jsx
////import React, { useEffect, useMemo, useRef, useState } from "react";
////import {
////  getCustomers,
////  getCompanies,
////  getFinishedItemsForSales,
////  getRecentSalesReturns,
////  getDoctypeList, // ✅ fetch Draft Sales Returns
////  createDoc,
////  submitDoc,
////  getDoc, // ✅ Edit Draft
////  updateDoc, // ✅ Update Draft
////} from "./erpBackendApi";
////import "../CSS/SalesReturn.css";

////const GOOD_WH = "Finished Goods - MF";
////const DAMAGED_WH = "Damaged - MF"; // change if needed
////const LIST_LIMIT = 10; // ✅ show only last recent 10 in list

////function toYMD(input) {
////  if (input == null) return "";
////  if (input instanceof Date && !isNaN(input.getTime()))
////    return input.toISOString().slice(0, 10);

////  const s = String(input).trim();
////  if (!s) return "";

////  // YYYY-MM-DD or YYYY-MM-DDTHH:MM...
////  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[t\s].*)?$/i);
////  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

////  // DD-MM-YYYY or DD/MM/YYYY
////  const dmy = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
////  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

////  // DDMMYYYY
////  if (/^\d{8}$/.test(s)) {
////    const dd = s.slice(0, 2);
////    const mm = s.slice(2, 4);
////    const yyyy = s.slice(4, 8);
////    return `${yyyy}-${mm}-${dd}`;
////  }

////  return "";
////}

////function createEmptyRow(id) {
////  return {
////    id,
////    _rowName: "", // ✅ keeps ERP child row name for updating drafts
////    item_code: "",
////    qty: "1.00",
////    rate: "0.00",
////    quality: "good",
////    warehouse: GOOD_WH,
////  };
////}

////async function getRecentDraftSalesReturns(limit = LIST_LIMIT) {
////  // ✅ Draft sales returns = Sales Invoice, is_return=1, docstatus=0
////  const rows = await getDoctypeList("Sales Invoice", {
////    fields: JSON.stringify([
////      "name",
////      "customer",
////      "company",
////      "posting_date",
////      "grand_total",
////      "docstatus",
////      "modified",
////    ]),
////    filters: JSON.stringify([
////      ["Sales Invoice", "is_return", "=", 1],
////      ["Sales Invoice", "docstatus", "=", 0],
////    ]),
////    order_by: "modified desc",
////    limit_page_length: limit,
////  });

////  return rows || [];
////}

////function SalesReturn() {
////  // Master data
////  const [customers, setCustomers] = useState([]);
////  const [companies, setCompanies] = useState([]);
////  const [itemsCatalog, setItemsCatalog] = useState([]);

////  // Header fields
////  const todayStr = new Date().toISOString().slice(0, 10);
////  const [customer, setCustomer] = useState("");
////  const [company, setCompany] = useState("");
////  const [postingDate, setPostingDate] = useState(todayStr);

////  // Line items
////  const [rows, setRows] = useState([createEmptyRow(0)]);

////  // Draft editing state
////  const [editingDraftName, setEditingDraftName] = useState("");
////  const [editDraftLoading, setEditDraftLoading] = useState("");

////  // Recent returns
////  const [returns, setReturns] = useState([]); // submitted (docstatus=1)
////  const [draftReturns, setDraftReturns] = useState([]); // drafts (docstatus=0)
////  const [loadingReturns, setLoadingReturns] = useState(false);

////  // Shared state
////  const [loadingMaster, setLoadingMaster] = useState(false);
////  const [creatingReturn, setCreatingReturn] = useState(false); // create/update DRAFT
////  const [submittingDraft, setSubmittingDraft] = useState(""); // submit from list
////  const [error, setError] = useState("");
////  const [message, setMessage] = useState("");

////  useEffect(() => {
////    async function load() {
////      setLoadingMaster(true);
////      setError("");
////      try {
////        const [custData, compData, itemData, recentReturns, recentDrafts] =
////          await Promise.all([
////            getCustomers(),
////            getCompanies(),
////            getFinishedItemsForSales(),
////            getRecentSalesReturns(LIST_LIMIT), // ✅ last 10 submitted
////            getRecentDraftSalesReturns(LIST_LIMIT), // ✅ last 10 drafts
////          ]);

////        setCustomers(custData || []);
////        setCompanies(compData || []);
////        setItemsCatalog(itemData || []);
////        setReturns(recentReturns || []);
////        setDraftReturns(recentDrafts || []);

////        if ((custData || []).length > 0) setCustomer(custData[0].name);
////        if ((compData || []).length > 0) setCompany(compData[0].name);
////      } catch (err) {
////        console.error(err);
////        setError(err.message || "Failed to load data for Sales Returns");
////      } finally {
////        setLoadingMaster(false);
////      }
////    }

////    load();
////  }, []);

////  function handleRowChange(id, field, value) {
////    setRows((prev) =>
////      prev.map((r) => {
////        if (r.id !== id) return r;

////        const updated = { ...r, [field]: value };

////        if (field === "quality") {
////          updated.warehouse = value === "damaged" ? DAMAGED_WH : GOOD_WH;
////        }

////        return updated;
////      })
////    );
////  }

////  function addRow() {
////    setRows((prev) => [
////      ...prev,
////      createEmptyRow(prev.length ? prev[prev.length - 1].id + 1 : 0),
////    ]);
////  }

////  function removeRow(id) {
////    setRows((prev) => {
////      const filtered = prev.filter((r) => r.id !== id);
////      return filtered.length ? filtered : [createEmptyRow(0)];
////    });
////  }

////  async function reloadReturns() {
////    try {
////      setLoadingReturns(true);
////      const [rec, drafts] = await Promise.all([
////        getRecentSalesReturns(LIST_LIMIT),
////        getRecentDraftSalesReturns(LIST_LIMIT),
////      ]);
////      setReturns(rec || []);
////      setDraftReturns(drafts || []);
////    } catch (err) {
////      console.error(err);
////    } finally {
////      setLoadingReturns(false);
////    }
////  }

////  function resetFormToNewDraft() {
////    setEditingDraftName("");
////    setPostingDate(todayStr);
////    setRows([createEmptyRow(0)]);
////  }

////  // ✅ Edit Draft: load draft Sales Invoice into the same form
////  async function handleEditDraft(name) {
////    if (!name) return;

////    setError("");
////    setMessage("");
////    setEditDraftLoading(name);

////    try {
////      const doc = await getDoc("Sales Invoice", name);

////      setEditingDraftName(name);
////      setCustomer(doc.customer || customer);
////      setCompany(doc.company || company);
////      setPostingDate(toYMD(doc.posting_date) || todayStr);

////      const its = Array.isArray(doc.items) ? doc.items : [];
////      const mapped =
////        its.length > 0
////          ? its.map((it, idx) => {
////            const wh = it.warehouse || GOOD_WH;
////            const quality = wh === DAMAGED_WH ? "damaged" : "good";
////            const qtyNum = Number(it.qty || 0);
////            const rateNum = Number(it.rate || 0);

////            return {
////              id: idx,
////              _rowName: it.name || "",
////              item_code: it.item_code || "",
////              qty: String(Math.abs(qtyNum || 0) || "1.00"),
////              rate: String(isNaN(rateNum) ? "0.00" : rateNum),
////              quality,
////              warehouse: quality === "damaged" ? DAMAGED_WH : GOOD_WH,
////            };
////          })
////          : [createEmptyRow(0)];

////      setRows(mapped);

////      setMessage(`Editing draft: ${name}. Update and click "Update Draft".`);
////      window.scrollTo({ top: 0, behavior: "smooth" });
////    } catch (err) {
////      console.error(err);
////      setError(
////        err.response?.data?.error?.message ||
////        err.response?.data?.error ||
////        err.message ||
////        "Failed to load draft for edit"
////      );
////    } finally {
////      setEditDraftLoading("");
////    }
////  }

////  function cancelEditDraft() {
////    setMessage("");
////    resetFormToNewDraft();
////  }

////  // ✅ Create or Update Draft (top button)
////  async function handleCreateOrUpdateDraft() {
////    setError("");
////    setMessage("");

////    if (!customer) return setError("Please select a Customer.");
////    if (!company) return setError("Please select a Company.");

////    const posting = toYMD(postingDate) || todayStr;
////    const due = posting;

////    const validRows = rows
////      .map((r) => ({
////        ...r,
////        qtyNum: parseFloat(r.qty),
////        rateNum: parseFloat(r.rate),
////      }))
////      .filter((r) => r.item_code && !isNaN(r.qtyNum) && r.qtyNum > 0);

////    if (!validRows.length)
////      return setError("Add at least one line with item and positive qty.");

////    try {
////      setCreatingReturn(true);

////      const items = validRows.map((r) => {
////        const targetWh = r.quality === "damaged" ? DAMAGED_WH : GOOD_WH;
////        const base = {
////          item_code: r.item_code,
////          qty: -Math.abs(r.qtyNum),
////          rate: isNaN(r.rateNum) ? 0 : r.rateNum,
////          warehouse: targetWh,
////        };

////        if (editingDraftName && r._rowName) return { ...base, name: r._rowName };
////        return base;
////      });

////      const payload = {
////        doctype: "Sales Invoice",
////        is_return: 1,
////        update_stock: 1,
////        posting_date: posting,
////        due_date: due,
////        company,
////        customer,
////        items,
////        remarks:
////          "Sales return created from custom screen (good/damaged → respective warehouses).",
////      };

////      if (editingDraftName) {
////        await updateDoc("Sales Invoice", editingDraftName, payload);
////        setMessage(
////          `Draft updated: ${editingDraftName}. Now use the list button "Create Sales Return" to submit.`
////        );
////      } else {
////        const siDoc = await createDoc("Sales Invoice", payload);
////        const siName = siDoc?.data?.name || siDoc?.message?.name || siDoc?.name || "";

////        setMessage(
////          `Draft Sales Return created: ${siName || "(name not returned)"
////          }. Scroll down and click "Create Sales Return" in the list to submit.`
////        );
////      }

////      resetFormToNewDraft();
////      await reloadReturns();
////    } catch (err) {
////      console.error(err);
////      setError(
////        err.response?.data?.error?.message ||
////        err.response?.data?.error ||
////        err.message ||
////        "Failed to save draft"
////      );
////    } finally {
////      setCreatingReturn(false);
////    }
////  }

////  // ✅ Submit draft from the list
////  async function handleSubmitDraftReturn(name) {
////    if (!name) return;

////    setError("");
////    setMessage("");
////    setSubmittingDraft(name);

////    try {
////      await submitDoc("Sales Invoice", name);
////      setMessage(`Sales Return submitted: ${name}`);
////      await reloadReturns();

////      if (editingDraftName === name) resetFormToNewDraft();
////    } catch (err) {
////      console.error(err);
////      setError(
////        err.response?.data?.error?.message ||
////        err.response?.data?.error ||
////        err.message ||
////        "Failed to submit Sales Return"
////      );
////    } finally {
////      setSubmittingDraft("");
////    }
////  }

////  // ✅ drafts first, then submitted; ✅ only last 10 total in UI
////  const displayReturns = useMemo(() => {
////    const drafts = (draftReturns || []).map((d) => ({ ...d, __isDraft: true }));
////    const submitted = (returns || []).map((r) => ({ ...r, __isDraft: false }));
////    return [...drafts, ...submitted].slice(0, LIST_LIMIT);
////  }, [draftReturns, returns]);

////  return (
////    <div className="sales-return">
////      <div className="sales-return-header">
////        <div className="sales-return-title-block">
////          <h2 className="sales-return-title">Sales Returns (with Stock Update)</h2>
////          <p className="sales-return-subtitle">
////            Create a Sales Invoice Return that updates stock and classifies items as Good or Damaged.
////          </p>
////        </div>
////        <div className="sales-return-header-pill">
////          {displayReturns.length} return{displayReturns.length !== 1 ? "s" : ""}
////        </div>
////      </div>

////      {loadingMaster && (
////        <div className="sales-return-loading text-muted">
////          Loading customers, companies & items...
////        </div>
////      )}
////      {error && <div className="alert alert-error sales-return-error">{error}</div>}
////      {message && <div className="alert alert-success sales-return-message">{message}</div>}

////      <div className="sales-return-card">
////        <div className="sales-return-card-header">
////          <h3 className="sales-return-card-title">
////            {editingDraftName ? `Edit Draft: ${editingDraftName}` : "Create Sales Return"}
////          </h3>
////        </div>

////        <div className="sales-return-form-grid">
////          <div className="sales-return-field-group">
////            <label className="form-label sales-return-field-label">Customer</label>
////            <select
////              value={customer}
////              onChange={(e) => setCustomer(e.target.value)}
////              className="select"
////              disabled={loadingMaster || customers.length === 0}
////            >
////              {customers.map((c) => (
////                <option key={c.name} value={c.name}>
////                  {c.customer_name || c.name}
////                </option>
////              ))}
////            </select>
////          </div>

////          <div className="sales-return-field-group">
////            <label className="form-label sales-return-field-label">Company</label>
////            <select
////              value={company}
////              onChange={(e) => setCompany(e.target.value)}
////              className="select"
////              disabled={loadingMaster || companies.length === 0}
////            >
////              {companies.map((c) => (
////                <option key={c.name} value={c.name}>
////                  {c.company_name || c.name} ({c.abbr})
////                </option>
////              ))}
////            </select>
////          </div>

////          <div className="sales-return-field-group">
////            <label className="form-label sales-return-field-label">Posting Date</label>
////            <input
////              type="date"
////              className="input"
////              value={postingDate}
////              onChange={(e) => setPostingDate(e.target.value)}
////            />
////          </div>
////        </div>

////        <div className="sales-return-items-header">
////          <h4 className="sales-return-section-title">Items to Return</h4>
////          <button type="button" onClick={addRow} className="btn btn-accent btn-sm">
////            + Add Item
////          </button>
////        </div>

////        <div className="sales-return-rows">
////          {rows.map((row, idx) => (
////            <div key={row.id} className="sales-return-row-card">
////              <div className="sales-return-row-header">
////                <span className="sales-return-row-title">
////                  Line #{idx + 1}
////                  {row.item_code ? ` · ${row.item_code}` : ""}
////                </span>
////                <button
////                  type="button"
////                  onClick={() => removeRow(row.id)}
////                  className="btn btn-ghost btn-sm"
////                >
////                  Remove
////                </button>
////              </div>

////              <div className="sales-return-row-grid">
////                <div className="sales-return-row-field">
////                  <label className="form-label">Item</label>
////                  <ItemSearchDropdown
////                    items={itemsCatalog}
////                    value={row.item_code}
////                    onSelect={(code) => handleRowChange(row.id, "item_code", code)}
////                    placeholder="Search item name / code..."
////                  />
////                </div>

////                <div className="sales-return-row-field">
////                  <label className="form-label">Qty</label>
////                  <input
////                    type="number"
////                    step="1"
////                    min="0"
////                    className={`input ${row.qty < 0 ? "input-error" : ""}`}
////                    value={row.qty}
////                    onChange={(e) => {
////                      const value = e.target.value;

////                      // allow empty while typing
////                      if (value === "") {
////                        handleRowChange(row.id, "qty", "");
////                        return;
////                      }

////                      const num = Number(value);

////                      // ❌ block negative values
////                      if (num < 0) return;

////                      handleRowChange(row.id, "qty", num);
////                    }}
////                  />
////                </div>


////                <div className="sales-return-row-field">
////                  <label className="form-label">Rate</label>
////                  <input
////                    type="number"
////                    step="1"
////                    min="0"
////                    className={`input ${row.rate < 0 ? "input-error" : ""}`}
////                    value={row.rate}
////                    onChange={(e) => {
////                      const value = e.target.value;

////                      // allow empty while typing
////                      if (value === "") {
////                        handleRowChange(row.id, "rate", "");
////                        return;
////                      }

////                      const num = Number(value);

////                      // ❌ block negative values
////                      if (num < 0) return;

////                      handleRowChange(row.id, "rate", num);
////                    }}
////                  />
////                </div>


////                <div className="sales-return-row-field">
////                  <label className="form-label">Quality</label>
////                  <select
////                    className="select"
////                    value={row.quality || "good"}
////                    onChange={(e) => handleRowChange(row.id, "quality", e.target.value)}
////                  >
////                    <option value="good">Good (add to Finished Goods)</option>
////                    <option value="damaged">Damaged (add to Damaged warehouse)</option>
////                  </select>
////                </div>

////                <div className="sales-return-row-field">
////                  <label className="form-label">Target Warehouse</label>
////                  <input className="input" value={row.warehouse} readOnly />
////                </div>
////              </div>
////            </div>
////          ))}
////        </div>

////        <div className="sales-return-submit-row" style={{ display: "flex", gap: 10 }}>
////          <button
////            type="button"
////            onClick={handleCreateOrUpdateDraft}
////            disabled={creatingReturn || loadingMaster}
////            className="btn btn-primary"
////          >
////            {creatingReturn
////              ? editingDraftName
////                ? "Updating Draft..."
////                : "Creating Draft..."
////              : editingDraftName
////                ? "Update Draft"
////                : "Create Return Draft"}
////          </button>

////          {editingDraftName ? (
////            <button
////              type="button"
////              onClick={cancelEditDraft}
////              disabled={creatingReturn || loadingMaster}
////              className="btn btn-ghost"
////            >
////              Cancel Edit
////            </button>
////          ) : null}
////        </div>
////      </div>

////      <div className="sales-return-list-section">
////        <div className="sales-return-list-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
////          <div>
////            <h3 className="sales-return-list-title" style={{ marginBottom: 2 }}>Recent Sales Returns</h3>
////            <div style={{ fontSize: 12, opacity: 0.7 }}>Showing latest {LIST_LIMIT}</div>
////          </div>

////          {/* ✅ NEW: Refresh button for the list */}
////          <button
////            type="button"
////            className="btn btn-secondary btn-sm"
////            onClick={reloadReturns}
////            disabled={loadingReturns}
////          >
////            {loadingReturns ? "Refreshing..." : "Refresh"}
////          </button>
////        </div>

////        {loadingReturns && (
////          <div className="sales-return-list-loading text-muted">Loading recent returns...</div>
////        )}

////        {!loadingReturns && displayReturns.length === 0 && (
////          <div className="sales-return-list-empty text-muted">No returns found.</div>
////        )}

////        {!loadingReturns && displayReturns.length > 0 && (
////          <div className="sales-return-table-wrapper table-container">
////            <table className="table sales-return-table">
////              <thead>
////                <tr>
////                  <th>Return Name</th>
////                  <th>Customer</th>
////                  <th>Company</th>
////                  <th>Date</th>
////                  <th>Grand Total</th>
////                  <th>Action</th>
////                </tr>
////              </thead>

////              <tbody>
////                {displayReturns.map((r) => {
////                  const isDraft = !!r.__isDraft;
////                  const isSubmitting = submittingDraft === r.name;
////                  const isEditingThis = editingDraftName === r.name;
////                  const isEditLoadingThis = editDraftLoading === r.name;

////                  return (
////                    <tr key={r.name}>
////                      <td className="sales-return-name-cell">
////                        {r.name}{" "}
////                        {isDraft ? <span style={{ opacity: 0.7 }}>(Draft)</span> : null}
////                        {isEditingThis ? (
////                          <span style={{ marginLeft: 8, opacity: 0.7 }}>(Editing)</span>
////                        ) : null}
////                      </td>
////                      <td className="sales-return-customer-cell">{r.customer}</td>
////                      <td className="sales-return-company-cell">{r.company}</td>
////                      <td className="sales-return-date-cell">{r.posting_date}</td>
////                      <td className="sales-return-amount-cell">
////                        ₹ {r.grand_total != null ? Number(r.grand_total).toFixed(2) : "0.00"}
////                      </td>

////                      <td>
////                        {isDraft ? (
////                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
////                            <button
////                              type="button"
////                              className="btn btn-outline btn-xs"
////                              disabled={isEditLoadingThis || isSubmitting}
////                              onClick={() => handleEditDraft(r.name)}
////                            >
////                              {isEditLoadingThis ? "Loading..." : "Edit Draft"}
////                            </button>

////                            <button
////                              type="button"
////                              className="btn btn-accent btn-xs"
////                              disabled={isSubmitting}
////                              onClick={() => handleSubmitDraftReturn(r.name)}
////                            >
////                              {isSubmitting ? "Submitting..." : "Create Sales Return"}
////                            </button>
////                          </div>
////                        ) : (
////                          "-"
////                        )}
////                      </td>
////                    </tr>
////                  );
////                })}
////              </tbody>
////            </table>
////          </div>
////        )}
////      </div>
////    </div>
////  );
////}

/////* ✅ Same dropdown component used in StockTransfer */
////function ItemSearchDropdown({ items, value, onSelect, placeholder }) {
////  const [open, setOpen] = useState(false);
////  const [q, setQ] = useState("");
////  const ref = useRef(null);

////  const selected = useMemo(
////    () => items.find((x) => x.name === value) || null,
////    [items, value]
////  );

////  const filtered = useMemo(() => {
////    const s = (q || "").trim().toLowerCase();
////    const base = !s
////      ? items
////      : items.filter((it) => {
////        const code = (it.name || "").toLowerCase();
////        const name = (it.item_name || "").toLowerCase();
////        return code.includes(s) || name.includes(s);
////      });
////    return base.slice(0, 80);
////  }, [items, q]);

////  useEffect(() => {
////    function onDown(e) {
////      if (!ref.current) return;
////      if (!ref.current.contains(e.target)) setOpen(false);
////    }
////    document.addEventListener("mousedown", onDown);
////    return () => document.removeEventListener("mousedown", onDown);
////  }, []);

////  return (
////    <div className="stdrop" ref={ref}>
////      <button
////        type="button"
////        className={`stdrop-control ${open ? "is-open" : ""}`}
////        onClick={() => setOpen((v) => !v)}
////      >
////        <div className="stdrop-value">
////          {selected ? (
////            <>
////              <div className="stdrop-title">{selected.name}</div>
////              <div className="stdrop-sub">
////                {selected.item_name || ""} {selected.stock_uom ? `· ${selected.stock_uom}` : ""}
////              </div>
////            </>
////          ) : (
////            <div className="stdrop-placeholder">{placeholder}</div>
////          )}
////        </div>
////        <div className="stdrop-caret">▾</div>
////      </button>

////      {open && (
////        <div className="stdrop-popover">
////          <div className="stdrop-search">
////            <input
////              autoFocus
////              className="input"
////              value={q}
////              onChange={(e) => setQ(e.target.value)}
////              placeholder="Type to search..."
////            />
////          </div>

////          <div className="stdrop-list">
////            {filtered.map((it) => (
////              <button
////                key={it.name}
////                type="button"
////                className="stdrop-item"
////                onClick={() => {
////                  onSelect(it.name);
////                  setOpen(false);
////                  setQ("");
////                }}
////              >
////                <div className="stdrop-item-title">{it.name}</div>
////                <div className="stdrop-item-sub">
////                  {it.item_name || ""} {it.stock_uom ? `· ${it.stock_uom}` : ""}
////                </div>
////              </button>
////            ))}

////            {!filtered.length ? (
////              <div className="stdrop-empty">No items found.</div>
////            ) : (
////              <div className="stdrop-hint">Showing up to 80 results</div>
////            )}
////          </div>
////        </div>
////      )}
////    </div>
////  );
////}

////export default SalesReturn;


////// src/SalesReturn.jsx
////import React, { useEffect, useMemo, useRef, useState } from "react";
////import {
////  getCustomers,
////  getCompanies,
////  getFinishedItemsForSales,
////  getRecentSalesReturns,
////  getDoctypeList, // ✅ fetch Draft Sales Returns
////  createDoc, // ✅ create DRAFT
////  submitDoc, // ✅ submit from list
////  getDoc, // ✅ Edit Draft / diff items for delete
////  updateDoc, // ✅ Update Draft
////} from "./erpBackendApi";
////import "../CSS/SalesReturn.css";

////// ✅ Warehouses are FIXED (not selectable in frontend)
////const GOOD_WH = "Finished Goods - MF";
////const DAMAGED_WH = "Damaged - MF";

////const LIST_LIMIT = 10; // ✅ show only last 10 total (drafts + submitted)

////function getWarehouseForQuality(quality) {
////  return quality === "damaged" ? DAMAGED_WH : GOOD_WH;
////}

////function toSortTs(v) {
////  if (!v) return 0;
////  const s = String(v).trim();
////  if (!s) return 0;

////  const isoLike = s.includes(" ") ? s.replace(" ", "T") : s;
////  const d = new Date(isoLike);
////  const t = d.getTime();
////  return Number.isFinite(t) ? t : 0;
////}

////function toYMD(input) {
////  if (input == null) return "";
////  if (input instanceof Date && !isNaN(input.getTime())) return input.toISOString().slice(0, 10);

////  const s = String(input).trim();
////  if (!s) return "";

////  // YYYY-MM-DD or YYYY-MM-DDTHH:MM...
////  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[t\s].*)?$/i);
////  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

////  // DD-MM-YYYY or DD/MM/YYYY
////  const dmy = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
////  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

////  // DDMMYYYY
////  if (/^\d{8}$/.test(s)) {
////    const dd = s.slice(0, 2);
////    const mm = s.slice(2, 4);
////    const yyyy = s.slice(4, 8);
////    return `${yyyy}-${mm}-${dd}`;
////  }

////  return "";
////}

////function createEmptyRow(id) {
////  return {
////    id,
////    _rowName: "", // ✅ child row name used when updating drafts
////    item_code: "",
////    qty: "1.00", // ✅ positive in UI, we convert to negative in payload
////    rate: "0.00",
////    quality: "good", // "good" | "damaged"
////  };
////}

////async function getRecentDraftSalesReturns(limit = LIST_LIMIT) {
////  // ✅ Draft Sales Returns = Sales Invoice, is_return=1, docstatus=0
////  const rows = await getDoctypeList("Sales Invoice", {
////    fields: JSON.stringify([
////      "name",
////      "customer",
////      "company",
////      "posting_date",
////      "grand_total",
////      "docstatus",
////      "modified",
////      "is_return",
////    ]),
////    filters: JSON.stringify([
////      ["Sales Invoice", "is_return", "=", 1],
////      ["Sales Invoice", "docstatus", "=", 0],
////    ]),
////    order_by: "modified desc",
////    limit_page_length: limit,
////  });

////  return rows || [];
////}

////function SalesReturn() {
////  // Master data
////  const [customers, setCustomers] = useState([]);
////  const [companies, setCompanies] = useState([]);
////  const [itemsCatalog, setItemsCatalog] = useState([]);

////  // Header fields
////  const todayStr = new Date().toISOString().slice(0, 10);
////  const [customer, setCustomer] = useState("");
////  const [company, setCompany] = useState("");
////  const [postingDate, setPostingDate] = useState(todayStr);

////  // Line items
////  const [rows, setRows] = useState([createEmptyRow(0)]);

////  // Draft editing state
////  const [editingDraftName, setEditingDraftName] = useState("");
////  const [editDraftLoading, setEditDraftLoading] = useState("");

////  // Recent returns
////  const [returns, setReturns] = useState([]); // submitted
////  const [draftReturns, setDraftReturns] = useState([]); // drafts
////  const [loadingReturns, setLoadingReturns] = useState(false);

////  // Shared state
////  const [loadingMaster, setLoadingMaster] = useState(false);
////  const [savingDraft, setSavingDraft] = useState(false); // create/update DRAFT
////  const [submittingDraft, setSubmittingDraft] = useState(""); // submit from list
////  const [error, setError] = useState("");
////  const [message, setMessage] = useState("");
////  // ✅ Sorting (Posting Date)
////  const [postingDateSort, setPostingDateSort] = useState("desc"); // desc = Newest → Oldest

////  const postingDateSortLabel =
////    postingDateSort === "asc"
////      ? "Posting Date: Oldest → Newest"
////      : "Posting Date: Newest → Oldest";

////  // ✅ drafts first, then submitted; ✅ only last 10 total
////  const displayReturns = useMemo(() => {
////    const drafts = (draftReturns || []).map((d) => ({ ...d, __isDraft: true }));
////    const submitted = (returns || []).map((r) => ({ ...r, __isDraft: false }));
////    return [...drafts, ...submitted].slice(0, LIST_LIMIT);
////  }, [draftReturns, returns]);

////  // ✅ Apply sorting to the combined list (drafts + submitted)
////  const sortedDisplayReturns = useMemo(() => {
////    const dirMul = postingDateSort === "asc" ? 1 : -1;

////    return [...(displayReturns || [])].sort((a, b) => {
////      const ta = toSortTs(a?.posting_date);
////      const tb = toSortTs(b?.posting_date);

////      if (ta !== tb) return (ta - tb) * dirMul;
////      return String(a?.name || "").localeCompare(String(b?.name || ""));
////    });
////  }, [displayReturns, postingDateSort]);

////  useEffect(() => {
////    async function load() {
////      setLoadingMaster(true);
////      setError("");

////      try {
////        const [custData, compData, itemData, recentSubmitted, recentDrafts] = await Promise.all([
////          getCustomers(),
////          getCompanies(),
////          getFinishedItemsForSales(),
////          getRecentSalesReturns(LIST_LIMIT), // ✅ last 10 submitted returns
////          getRecentDraftSalesReturns(LIST_LIMIT), // ✅ last 10 draft returns
////        ]);

////        setCustomers(custData || []);
////        setCompanies(compData || []);
////        setItemsCatalog(itemData || []);
////        setReturns(recentSubmitted || []);
////        setDraftReturns(recentDrafts || []);

////        if (!customer && (custData || []).length > 0) setCustomer(custData[0].name);
////        if (!company && (compData || []).length > 0) setCompany(compData[0].name);
////      } catch (err) {
////        console.error(err);
////        setError(err.message || "Failed to load data for Sales Returns");
////      } finally {
////        setLoadingMaster(false);
////      }
////    }

////    load();
////    // eslint-disable-next-line react-hooks/exhaustive-deps
////  }, []);

////  function handleRowChange(id, field, value) {
////    setRows((prev) =>
////      prev.map((r) => {
////        if (r.id !== id) return r;
////        return { ...r, [field]: value };
////      })
////    );
////  }

////  function addRow() {
////    setRows((prev) => [
////      ...prev,
////      createEmptyRow(prev.length ? prev[prev.length - 1].id + 1 : 0),
////    ]);
////  }

////  function removeRow(id) {
////    setRows((prev) => {
////      const filtered = prev.filter((r) => r.id !== id);
////      return filtered.length ? filtered : [createEmptyRow(0)];
////    });
////  }

////  async function reloadReturns() {
////    try {
////      setLoadingReturns(true);
////      const [rec, drafts] = await Promise.all([
////        getRecentSalesReturns(LIST_LIMIT),
////        getRecentDraftSalesReturns(LIST_LIMIT),
////      ]);
////      setReturns(rec || []);
////      setDraftReturns(drafts || []);
////    } catch (err) {
////      console.error(err);
////    } finally {
////      setLoadingReturns(false);
////    }
////  }

////  function resetFormToNewDraft() {
////    setEditingDraftName("");
////    setPostingDate(todayStr);
////    setRows([createEmptyRow(0)]);
////  }

////  // ✅ Edit Draft: load draft Sales Invoice Return into the same form
////  async function handleEditDraft(name) {
////    if (!name) return;

////    setError("");
////    setMessage("");
////    setEditDraftLoading(name);

////    try {
////      const doc = await getDoc("Sales Invoice", name);

////      setEditingDraftName(name);
////      setCustomer(doc.customer || customer);
////      setCompany(doc.company || company);
////      setPostingDate(toYMD(doc.posting_date) || todayStr);

////      const its = Array.isArray(doc.items) ? doc.items : [];
////      const mapped =
////        its.length > 0
////          ? its.map((it, idx) => {
////            const wh = it.warehouse || GOOD_WH;
////            const quality = wh === DAMAGED_WH ? "damaged" : "good";

////            // returns have negative qty, show absolute qty in UI
////            const qtyNum = Number(it.qty || 0);
////            const rateNum = Number(it.rate || 0);

////            return {
////              id: idx,
////              _rowName: it.name || "",
////              item_code: it.item_code || "",
////              qty: String(Math.abs(qtyNum) || 1),
////              rate: String(isNaN(rateNum) ? 0 : rateNum),
////              quality,
////            };
////          })
////          : [createEmptyRow(0)];

////      setRows(mapped);

////      setMessage(`Editing draft: ${name}. Update and click "Update Draft".`);
////      window.scrollTo({ top: 0, behavior: "smooth" });
////    } catch (err) {
////      console.error(err);
////      setError(
////        err?.response?.data?.error?.message ||
////        err?.response?.data?.error ||
////        err?.message ||
////        "Failed to load draft for edit"
////      );
////    } finally {
////      setEditDraftLoading("");
////    }
////  }

////  function cancelEditDraft() {
////    setMessage("");
////    resetFormToNewDraft();
////  }

////  // ✅ Create or Update Draft (NO warehouse on frontend; computed from quality)
////  async function handleCreateOrUpdateDraft() {
////    setError("");
////    setMessage("");

////    if (!customer) return setError("Please select a Customer.");
////    if (!company) return setError("Please select a Company.");

////    // ✅ force safe dates
////    const posting = toYMD(postingDate) || todayStr;
////    const due = posting;

////    const normalizedRows = rows.map((r) => ({
////      ...r,
////      qtyNum: r.qty === "" ? NaN : Number(r.qty),
////      rateNum: r.rate === "" ? NaN : Number(r.rate),
////    }));

////    // block negative input (extra safety)
////    const hasNegative = normalizedRows.some(
////      (r) => (!isNaN(r.qtyNum) && r.qtyNum < 0) || (!isNaN(r.rateNum) && r.rateNum < 0)
////    );
////    if (hasNegative) return setError("Qty/Rate cannot be negative.");

////    const validRows = normalizedRows.filter((r) => r.item_code && !isNaN(r.qtyNum) && r.qtyNum > 0);
////    if (!validRows.length) return setError("Add at least one line with item and positive qty.");

////    try {
////      setSavingDraft(true);

////      const items = validRows.map((r) => {
////        const targetWh = getWarehouseForQuality(r.quality);
////        const base = {
////          item_code: r.item_code,
////          qty: -Math.abs(r.qtyNum), // ✅ negative qty for return
////          rate: isNaN(r.rateNum) ? 0 : r.rateNum,
////          warehouse: targetWh, // ✅ FIXED by quality
////        };

////        // keep child name when updating draft
////        if (editingDraftName && r._rowName) return { ...base, name: r._rowName };
////        return base;
////      });

////      const baseFields = {
////        is_return: 1,
////        update_stock: 1,
////        posting_date: posting,
////        due_date: due,
////        company,
////        customer,
////        items,
////        remarks:
////          "Sales return created from custom screen (good/damaged → fixed warehouses).",
////      };

////      if (editingDraftName) {
////        // ✅ delete removed child rows (important)
////        let old;
////        try {
////          old = await getDoc("Sales Invoice", editingDraftName);
////        } catch {
////          old = null;
////        }

////        const oldNames = new Set((old?.items || []).map((x) => x.name).filter(Boolean));
////        const newNames = new Set(items.map((x) => x.name).filter(Boolean));

////        const deletes = [];
////        oldNames.forEach((nm) => {
////          if (!newNames.has(nm)) {
////            deletes.push({ doctype: "Sales Invoice Item", name: nm, __delete: 1 });
////          }
////        });

////        await updateDoc("Sales Invoice", editingDraftName, {
////          ...baseFields,
////          items: [...items, ...deletes],
////        });

////        setMessage(
////          `Draft updated: ${editingDraftName}. Now use the list button "Create Sales Return" to submit.`
////        );
////      } else {
////        const siDoc = await createDoc("Sales Invoice", {
////          doctype: "Sales Invoice",
////          ...baseFields,
////        });

////        const siName = siDoc?.data?.name || siDoc?.message?.name || siDoc?.name || "";
////        setMessage(
////          `Draft Sales Return created: ${siName || "(name not returned)"
////          }. Scroll down and click "Create Sales Return" in the list to submit.`
////        );
////      }

////      resetFormToNewDraft();
////      await reloadReturns();
////    } catch (err) {
////      console.error(err);
////      setError(
////        err?.response?.data?.error?.message ||
////        err?.response?.data?.error ||
////        err?.message ||
////        "Failed to save draft"
////      );
////    } finally {
////      setSavingDraft(false);
////    }
////  }

////  // ✅ Submit draft from the list
////  async function handleSubmitDraftReturn(name) {
////    if (!name) return;

////    setError("");
////    setMessage("");
////    setSubmittingDraft(name);

////    try {
////      await submitDoc("Sales Invoice", name);
////      setMessage(`Sales Return submitted: ${name}`);
////      await reloadReturns();

////      if (editingDraftName === name) resetFormToNewDraft();
////    } catch (err) {
////      console.error(err);
////      setError(
////        err?.response?.data?.error?.message ||
////        err?.response?.data?.error ||
////        err?.message ||
////        "Failed to submit Sales Return"
////      );
////    } finally {
////      setSubmittingDraft("");
////    }
////  }


////  return (
////    <div className="sales-return">
////      <div className="sales-return-header">
////        <div className="sales-return-title-block">
////          <h2 className="sales-return-title">Sales Returns (with Stock Update)</h2>
////          <p className="sales-return-subtitle">
////            Create a Sales Invoice Return that updates stock and classifies items as Good or Damaged.
////          </p>
////        </div>

////        <div className="sales-return-header-pill">
////          {displayReturns.length} return{displayReturns.length !== 1 ? "s" : ""}
////        </div>
////      </div>

////      {loadingMaster && (
////        <div className="sales-return-loading text-muted">
////          Loading customers, companies & items...
////        </div>
////      )}

////      {error && <div className="alert alert-error sales-return-error">{error}</div>}
////      {message && <div className="alert alert-success sales-return-message">{message}</div>}

////      <div className="sales-return-card">
////        <div className="sales-return-card-header">
////          <h3 className="sales-return-card-title">
////            {editingDraftName ? `Edit Draft: ${editingDraftName}` : "Create Sales Return"}
////          </h3>

////          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
////            Warehouses are automatic (not selectable).
////          </div>
////        </div>

////        <div className="sales-return-form-grid">
////          <div className="sales-return-field-group">
////            <label className="form-label sales-return-field-label">Customer</label>
////            <select
////              value={customer}
////              onChange={(e) => setCustomer(e.target.value)}
////              className="select"
////              disabled={loadingMaster || customers.length === 0}
////            >
////              {customers.map((c) => (
////                <option key={c.name} value={c.name}>
////                  {c.customer_name || c.name}
////                </option>
////              ))}
////            </select>
////          </div>

////          <div className="sales-return-field-group">
////            <label className="form-label sales-return-field-label">Company</label>
////            <select
////              value={company}
////              onChange={(e) => setCompany(e.target.value)}
////              className="select"
////              disabled={loadingMaster || companies.length === 0}
////            >
////              {companies.map((c) => (
////                <option key={c.name} value={c.name}>
////                  {c.company_name || c.name} ({c.abbr})
////                </option>
////              ))}
////            </select>
////          </div>

////          <div className="sales-return-field-group">
////            <label className="form-label sales-return-field-label">Posting Date</label>
////            <input
////              type="date"
////              className="input"
////              value={postingDate}
////              onChange={(e) => setPostingDate(e.target.value)}
////            />
////          </div>
////        </div>

////        <div className="sales-return-items-header">
////          <h4 className="sales-return-section-title">Items to Return</h4>
////          <button type="button" onClick={addRow} className="btn btn-accent btn-sm">
////            + Add Item
////          </button>
////        </div>

////        <div className="sales-return-rows">
////          {rows.map((row, idx) => (
////            <div key={row.id} className="sales-return-row-card">
////              <div className="sales-return-row-header">
////                <span className="sales-return-row-title">
////                  Line #{idx + 1}
////                  {row.item_code ? ` · ${row.item_code}` : ""}
////                </span>

////                <button
////                  type="button"
////                  onClick={() => removeRow(row.id)}
////                  className="btn btn-ghost btn-sm"
////                >
////                  Remove
////                </button>
////              </div>

////              <div className="sales-return-row-grid">
////                <div className="sales-return-row-field">
////                  <label className="form-label">Item</label>
////                  <ItemSearchDropdown
////                    items={itemsCatalog}
////                    value={row.item_code}
////                    onSelect={(code) => handleRowChange(row.id, "item_code", code)}
////                    placeholder="Search item name / code..."
////                  />
////                </div>

////                <div className="sales-return-row-field">
////                  <label className="form-label">Qty</label>
////                  <input
////                    type="number"
////                    step="1"
////                    min="0"
////                    className="input"
////                    value={row.qty}
////                    onChange={(e) => {
////                      const v = e.target.value;
////                      if (v === "") return handleRowChange(row.id, "qty", "");
////                      const n = Number(v);
////                      if (Number.isNaN(n) || n < 0) return; // ❌ block negative
////                      handleRowChange(row.id, "qty", v);
////                    }}
////                  />
////                </div>

////                <div className="sales-return-row-field">
////                  <label className="form-label">Rate</label>
////                  <input
////                    type="number"
////                    step="1"
////                    min="0"
////                    className="input"
////                    value={row.rate}
////                    onChange={(e) => {
////                      const v = e.target.value;
////                      if (v === "") return handleRowChange(row.id, "rate", "");
////                      const n = Number(v);
////                      if (Number.isNaN(n) || n < 0) return; // ❌ block negative
////                      handleRowChange(row.id, "rate", v);
////                    }}
////                  />
////                </div>

////                <div className="sales-return-row-field">
////                  <label className="form-label">Quality</label>
////                  <select
////                    className="select"
////                    value={row.quality || "good"}
////                    onChange={(e) => handleRowChange(row.id, "quality", e.target.value)}
////                  >
////                    <option value="good">Good (add to Finished Goods)</option>
////                    <option value="damaged">Damaged (add to Damaged warehouse)</option>
////                  </select>
////                </div>

////                {/* ✅ Warehouse removed from frontend */}
////              </div>
////            </div>
////          ))}
////        </div>

////        <div className="sales-return-submit-row" style={{ display: "flex", gap: 10 }}>
////          <button
////            type="button"
////            onClick={handleCreateOrUpdateDraft}
////            disabled={savingDraft || loadingMaster}
////            className="btn btn-primary"
////          >
////            {savingDraft
////              ? editingDraftName
////                ? "Updating Draft..."
////                : "Creating Draft..."
////              : editingDraftName
////                ? "Update Draft"
////                : "Create Return Draft"}
////          </button>

////          {editingDraftName ? (
////            <button
////              type="button"
////              onClick={cancelEditDraft}
////              disabled={savingDraft || loadingMaster}
////              className="btn btn-ghost"
////            >
////              Cancel Edit
////            </button>
////          ) : null}
////        </div>
////      </div>

////      <div className="sales-return-list-section">
////        <div
////          className="sales-return-list-header"
////          style={{
////            display: "flex",
////            justifyContent: "space-between",
////            alignItems: "center",
////            gap: 12,
////          }}
////        >
////          <div>
////            <h3 className="sales-return-list-title" style={{ marginBottom: 2 }}>
////              Recent Sales Returns
////            </h3>
////            <div style={{ fontSize: 12, opacity: 0.7 }}>Showing latest {LIST_LIMIT}</div>
////          </div>
////        </div>
////        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
////          <button
////            type="button"
////            className="btn btn-outline btn-xs"
////            onClick={() => setPostingDateSort((p) => (p === "asc" ? "desc" : "asc"))}
////            disabled={loadingReturns}
////          >
////            {postingDateSortLabel}
////          </button>

////          <button
////            type="button"
////            className="btn btn-secondary btn-sm"
////            onClick={reloadReturns}
////            disabled={loadingReturns}
////          >
////            {loadingReturns ? "Refreshing..." : "Refresh"}
////          </button>
////        </div>

////        {loadingReturns && (
////          <div className="sales-return-list-loading text-muted">Loading recent returns...</div>
////        )}

////        {!loadingReturns && displayReturns.length === 0 && (
////          <div className="sales-return-list-empty text-muted">No returns found.</div>
////        )}

////        {!loadingReturns && displayReturns.length > 0 && (
////          <div className="sales-return-table-wrapper table-container">
////            <table className="table sales-return-table">
////              <thead>
////                <tr>
////                  <th>Return Name</th>
////                  <th>Customer</th>
////                  <th>Company</th>
////                  <th>Date</th>
////                  <th>Grand Total</th>
////                  <th>Action</th>
////                </tr>
////              </thead>

////              <tbody>
////                {sortedDisplayReturns.map((r) => {
////                  const isDraft = !!r.__isDraft;
////                  const isSubmitting = submittingDraft === r.name;
////                  const isEditingThis = editingDraftName === r.name;
////                  const isEditLoadingThis = editDraftLoading === r.name;

////                  return (
////                    <tr key={r.name}>
////                      <td className="sales-return-name-cell">
////                        {r.name}{" "}
////                        {isDraft ? <span style={{ opacity: 0.7 }}>(Draft)</span> : null}
////                        {isEditingThis ? (
////                          <span style={{ marginLeft: 8, opacity: 0.7 }}>(Editing)</span>
////                        ) : null}
////                      </td>

////                      <td className="sales-return-customer-cell">{r.customer}</td>
////                      <td className="sales-return-company-cell">{r.company}</td>
////                      <td className="sales-return-date-cell">{r.posting_date}</td>
////                      <td className="sales-return-amount-cell">
////                        ₹ {r.grand_total != null ? Number(r.grand_total).toFixed(2) : "0.00"}
////                      </td>

////                      <td>
////                        {isDraft ? (
////                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
////                            <button
////                              type="button"
////                              className="btn btn-outline btn-xs"
////                              disabled={isEditLoadingThis || isSubmitting}
////                              onClick={() => handleEditDraft(r.name)}
////                            >
////                              {isEditLoadingThis ? "Loading..." : "Edit Draft"}
////                            </button>

////                            <button
////                              type="button"
////                              className="btn btn-accent btn-xs"
////                              disabled={isSubmitting}
////                              onClick={() => handleSubmitDraftReturn(r.name)}
////                            >
////                              {isSubmitting ? "Submitting..." : "Create Sales Return"}
////                            </button>
////                          </div>
////                        ) : (
////                          "-"
////                        )}
////                      </td>
////                    </tr>
////                  );
////                })}
////              </tbody>
////            </table>
////          </div>
////        )}
////      </div>
////    </div>
////  );
////}

/////* ✅ Same dropdown component used in StockTransfer */
////function ItemSearchDropdown({ items, value, onSelect, placeholder }) {
////  const [open, setOpen] = useState(false);
////  const [q, setQ] = useState("");
////  const ref = useRef(null);

////  const selected = useMemo(() => items.find((x) => x.name === value) || null, [items, value]);

////  const filtered = useMemo(() => {
////    const s = (q || "").trim().toLowerCase();
////    const base = !s
////      ? items
////      : items.filter((it) => {
////        const code = (it.name || "").toLowerCase();
////        const name = (it.item_name || "").toLowerCase();
////        return code.includes(s) || name.includes(s);
////      });
////    return base.slice(0, 80);
////  }, [items, q]);

////  useEffect(() => {
////    function onDown(e) {
////      if (!ref.current) return;
////      if (!ref.current.contains(e.target)) setOpen(false);
////    }
////    document.addEventListener("mousedown", onDown);
////    return () => document.removeEventListener("mousedown", onDown);
////  }, []);

////  return (
////    <div className="stdrop" ref={ref}>
////      <button
////        type="button"
////        className={`stdrop-control ${open ? "is-open" : ""}`}
////        onClick={() => setOpen((v) => !v)}
////      >
////        <div className="stdrop-value">
////          {selected ? (
////            <>
////              <div className="stdrop-title">{selected.name}</div>
////              <div className="stdrop-sub">
////                {selected.item_name || ""} {selected.stock_uom ? `· ${selected.stock_uom}` : ""}
////              </div>
////            </>
////          ) : (
////            <div className="stdrop-placeholder">{placeholder}</div>
////          )}
////        </div>
////        <div className="stdrop-caret">▾</div>
////      </button>

////      {open && (
////        <div className="stdrop-popover">
////          <div className="stdrop-search">
////            <input
////              autoFocus
////              className="input"
////              value={q}
////              onChange={(e) => setQ(e.target.value)}
////              placeholder="Type to search..."
////            />
////          </div>

////          <div className="stdrop-list">
////            {filtered.map((it) => (
////              <button
////                key={it.name}
////                type="button"
////                className="stdrop-item"
////                onClick={() => {
////                  onSelect(it.name);
////                  setOpen(false);
////                  setQ("");
////                }}
////              >
////                <div className="stdrop-item-title">{it.name}</div>
////                <div className="stdrop-item-sub">
////                  {it.item_name || ""} {it.stock_uom ? `· ${it.stock_uom}` : ""}
////                </div>
////              </button>
////            ))}

////            {!filtered.length ? (
////              <div className="stdrop-empty">No items found.</div>
////            ) : (
////              <div className="stdrop-hint">Showing up to 80 results</div>
////            )}
////          </div>
////        </div>
////      )}
////    </div>
////  );
////}

////export default SalesReturn;

//// src/SalesReturn.jsx
//import React, { useEffect, useMemo, useRef, useState } from "react";
//import {
//  getCustomers,
//  getCompanies,
//  getFinishedItemsForSales,
//  getRecentSalesReturns,
//  getDoctypeList, // ✅ fetch Draft Sales Returns + summary headers
//  createDoc, // ✅ create DRAFT
//  submitDoc, // ✅ submit from list
//  getDoc, // ✅ Edit Draft / summary doc fetch
//  updateDoc, // ✅ Update Draft
//  mapLimit, // ✅ (optional but recommended) concurrency limiter
//} from "./erpBackendApi";
//import "../CSS/SalesReturn.css";

//// ✅ Warehouses are FIXED (not selectable in frontend)
//const GOOD_WH = "Finished Goods - MF";
//const DAMAGED_WH = "Damaged - MF";

//const LIST_LIMIT = 10; // ✅ show only last 10 total (drafts + submitted)

//// ✅ summary config
//const SUMMARY_FETCH_LIMIT = 300; // headers to consider for finding last N dates
//const SUMMARY_DATE_OPTIONS = [5, 10, 15, 30];

//function getWarehouseForQuality(quality) {
//  return quality === "damaged" ? DAMAGED_WH : GOOD_WH;
//}

//function toSortTs(v) {
//  if (!v) return 0;
//  const s = String(v).trim();
//  if (!s) return 0;

//  const isoLike = s.includes(" ") ? s.replace(" ", "T") : s;
//  const d = new Date(isoLike);
//  const t = d.getTime();
//  return Number.isFinite(t) ? t : 0;
//}

//function toYMD(input) {
//  if (input == null) return "";
//  if (input instanceof Date && !isNaN(input.getTime())) return input.toISOString().slice(0, 10);

//  const s = String(input).trim();
//  if (!s) return "";

//  // YYYY-MM-DD or YYYY-MM-DDTHH:MM...
//  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[t\s].*)?$/i);
//  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

//  // DD-MM-YYYY or DD/MM/YYYY
//  const dmy = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
//  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

//  // DDMMYYYY
//  if (/^\d{8}$/.test(s)) {
//    const dd = s.slice(0, 2);
//    const mm = s.slice(2, 4);
//    const yyyy = s.slice(4, 8);
//    return `${yyyy}-${mm}-${dd}`;
//  }

//  return "";
//}

//function createEmptyRow(id) {
//  return {
//    id,
//    _rowName: "", // ✅ child row name used when updating drafts
//    item_code: "",
//    qty: "1.00", // ✅ positive in UI, we convert to negative in payload
//    rate: "0.00",
//    quality: "good", // "good" | "damaged"
//  };
//}

//async function getRecentDraftSalesReturns(limit = LIST_LIMIT) {
//  // ✅ Draft Sales Returns = Sales Invoice, is_return=1, docstatus=0
//  const rows = await getDoctypeList("Sales Invoice", {
//    fields: JSON.stringify([
//      "name",
//      "customer",
//      "company",
//      "posting_date",
//      "grand_total",
//      "docstatus",
//      "modified",
//      "is_return",
//    ]),
//    filters: JSON.stringify([
//      ["Sales Invoice", "is_return", "=", 1],
//      ["Sales Invoice", "docstatus", "=", 0],
//    ]),
//    order_by: "modified desc",
//    limit_page_length: limit,
//  });

//  return rows || [];
//}

//// ✅ Summary headers (draft + submitted)
//async function getReturnHeadersForSummary(limit = SUMMARY_FETCH_LIMIT) {
//  const rows = await getDoctypeList("Sales Invoice", {
//    fields: JSON.stringify(["name", "posting_date", "docstatus", "modified", "is_return"]),
//    filters: JSON.stringify([
//      ["Sales Invoice", "is_return", "=", 1],
//      ["Sales Invoice", "docstatus", "in", [0, 1]],
//    ]),
//    order_by: "posting_date desc, modified desc",
//    limit_page_length: limit,
//  });

//  return rows || [];
//}

//function SalesReturn() {
//  // Master data
//  const [customers, setCustomers] = useState([]);
//  const [companies, setCompanies] = useState([]);
//  const [itemsCatalog, setItemsCatalog] = useState([]);

//  // Header fields
//  const todayStr = new Date().toISOString().slice(0, 10);
//  const [customer, setCustomer] = useState("");
//  const [company, setCompany] = useState("");
//  const [postingDate, setPostingDate] = useState(todayStr);

//  // Line items
//  const [rows, setRows] = useState([createEmptyRow(0)]);

//  // Draft editing state
//  const [editingDraftName, setEditingDraftName] = useState("");
//  const [editDraftLoading, setEditDraftLoading] = useState("");

//  // Recent returns
//  const [returns, setReturns] = useState([]); // submitted
//  const [draftReturns, setDraftReturns] = useState([]); // drafts
//  const [loadingReturns, setLoadingReturns] = useState(false);

//  // Shared state
//  const [loadingMaster, setLoadingMaster] = useState(false);
//  const [savingDraft, setSavingDraft] = useState(false); // create/update DRAFT
//  const [submittingDraft, setSubmittingDraft] = useState(""); // submit from list
//  const [error, setError] = useState("");
//  const [message, setMessage] = useState("");

//  // ✅ Sorting (Posting Date)
//  const [postingDateSort, setPostingDateSort] = useState("desc"); // desc = Newest → Oldest
//  const postingDateSortLabel =
//    postingDateSort === "asc" ? "Posting Date: Oldest → Newest" : "Posting Date: Newest → Oldest";

//  // ✅ Summary UI state (button near refresh)
//  const [summaryOpen, setSummaryOpen] = useState(false);
//  const [summaryDatesCount, setSummaryDatesCount] = useState(10);
//  const [summaryLoading, setSummaryLoading] = useState(false);
//  const [summaryError, setSummaryError] = useState("");
//  const [dailySummaryRows, setDailySummaryRows] = useState([]); // [{date, docs, goodQty, damagedQty, totalQty}]
//  const [docCache, setDocCache] = useState({}); // { [name]: fullDoc }

//  // ✅ drafts first, then submitted; ✅ only last 10 total
//  const displayReturns = useMemo(() => {
//    const drafts = (draftReturns || []).map((d) => ({ ...d, __isDraft: true }));
//    const submitted = (returns || []).map((r) => ({ ...r, __isDraft: false }));
//    return [...drafts, ...submitted].slice(0, LIST_LIMIT);
//  }, [draftReturns, returns]);

//  // ✅ Apply sorting to the combined list (drafts + submitted)
//  const sortedDisplayReturns = useMemo(() => {
//    const dirMul = postingDateSort === "asc" ? 1 : -1;

//    return [...(displayReturns || [])].sort((a, b) => {
//      const ta = toSortTs(a?.posting_date);
//      const tb = toSortTs(b?.posting_date);

//      if (ta !== tb) return (ta - tb) * dirMul;
//      return String(a?.name || "").localeCompare(String(b?.name || ""));
//    });
//  }, [displayReturns, postingDateSort]);

//  useEffect(() => {
//    async function load() {
//      setLoadingMaster(true);
//      setError("");

//      try {
//        const [custData, compData, itemData, recentSubmitted, recentDrafts] = await Promise.all([
//          getCustomers(),
//          getCompanies(),
//          getFinishedItemsForSales(),
//          getRecentSalesReturns(LIST_LIMIT), // ✅ last 10 submitted returns
//          getRecentDraftSalesReturns(LIST_LIMIT), // ✅ last 10 draft returns
//        ]);

//        setCustomers(custData || []);
//        setCompanies(compData || []);
//        setItemsCatalog(itemData || []);
//        setReturns(recentSubmitted || []);
//        setDraftReturns(recentDrafts || []);

//        if (!customer && (custData || []).length > 0) setCustomer(custData[0].name);
//        if (!company && (compData || []).length > 0) setCompany(compData[0].name);
//      } catch (err) {
//        console.error(err);
//        setError(err.message || "Failed to load data for Sales Returns");
//      } finally {
//        setLoadingMaster(false);
//      }
//    }

//    load();
//    // eslint-disable-next-line react-hooks/exhaustive-deps
//  }, []);

//  function handleRowChange(id, field, value) {
//    setRows((prev) =>
//      prev.map((r) => {
//        if (r.id !== id) return r;
//        return { ...r, [field]: value };
//      })
//    );
//  }

//  function addRow() {
//    setRows((prev) => [
//      ...prev,
//      createEmptyRow(prev.length ? prev[prev.length - 1].id + 1 : 0),
//    ]);
//  }

//  function removeRow(id) {
//    setRows((prev) => {
//      const filtered = prev.filter((r) => r.id !== id);
//      return filtered.length ? filtered : [createEmptyRow(0)];
//    });
//  }

//  async function reloadReturns() {
//    try {
//      setLoadingReturns(true);
//      const [rec, drafts] = await Promise.all([
//        getRecentSalesReturns(LIST_LIMIT),
//        getRecentDraftSalesReturns(LIST_LIMIT),
//      ]);
//      setReturns(rec || []);
//      setDraftReturns(drafts || []);
//    } catch (err) {
//      console.error(err);
//    } finally {
//      setLoadingReturns(false);
//    }
//  }

//  function resetFormToNewDraft() {
//    setEditingDraftName("");
//    setPostingDate(todayStr);
//    setRows([createEmptyRow(0)]);
//  }

//  // ✅ Edit Draft: load draft Sales Invoice Return into the same form
//  async function handleEditDraft(name) {
//    if (!name) return;

//    setError("");
//    setMessage("");
//    setEditDraftLoading(name);

//    try {
//      const doc = await getDoc("Sales Invoice", name);

//      setEditingDraftName(name);
//      setCustomer(doc.customer || customer);
//      setCompany(doc.company || company);
//      setPostingDate(toYMD(doc.posting_date) || todayStr);

//      const its = Array.isArray(doc.items) ? doc.items : [];
//      const mapped =
//        its.length > 0
//          ? its.map((it, idx) => {
//              const wh = it.warehouse || GOOD_WH;
//              const quality = wh === DAMAGED_WH ? "damaged" : "good";

//              // returns have negative qty, show absolute qty in UI
//              const qtyNum = Number(it.qty || 0);
//              const rateNum = Number(it.rate || 0);

//              return {
//                id: idx,
//                _rowName: it.name || "",
//                item_code: it.item_code || "",
//                qty: String(Math.abs(qtyNum) || 1),
//                rate: String(isNaN(rateNum) ? 0 : rateNum),
//                quality,
//              };
//            })
//          : [createEmptyRow(0)];

//      setRows(mapped);

//      setMessage(`Editing draft: ${name}. Update and click "Update Draft".`);
//      window.scrollTo({ top: 0, behavior: "smooth" });
//    } catch (err) {
//      console.error(err);
//      setError(
//        err?.response?.data?.error?.message ||
//          err?.response?.data?.error ||
//          err?.message ||
//          "Failed to load draft for edit"
//      );
//    } finally {
//      setEditDraftLoading("");
//    }
//  }

//  function cancelEditDraft() {
//    setMessage("");
//    resetFormToNewDraft();
//  }

//  // ✅ Create or Update Draft (NO warehouse on frontend; computed from quality)
//  async function handleCreateOrUpdateDraft() {
//    setError("");
//    setMessage("");

//    if (!customer) return setError("Please select a Customer.");
//    if (!company) return setError("Please select a Company.");

//    // ✅ force safe dates
//    const posting = toYMD(postingDate) || todayStr;
//    const due = posting;

//    const normalizedRows = rows.map((r) => ({
//      ...r,
//      qtyNum: r.qty === "" ? NaN : Number(r.qty),
//      rateNum: r.rate === "" ? NaN : Number(r.rate),
//    }));

//    // block negative input (extra safety)
//    const hasNegative = normalizedRows.some(
//      (r) => (!isNaN(r.qtyNum) && r.qtyNum < 0) || (!isNaN(r.rateNum) && r.rateNum < 0)
//    );
//    if (hasNegative) return setError("Qty/Rate cannot be negative.");

//    const validRows = normalizedRows.filter((r) => r.item_code && !isNaN(r.qtyNum) && r.qtyNum > 0);
//    if (!validRows.length) return setError("Add at least one line with item and positive qty.");

//    try {
//      setSavingDraft(true);

//      const items = validRows.map((r) => {
//        const targetWh = getWarehouseForQuality(r.quality);
//        const base = {
//          item_code: r.item_code,
//          qty: -Math.abs(r.qtyNum), // ✅ negative qty for return
//          rate: isNaN(r.rateNum) ? 0 : r.rateNum,
//          warehouse: targetWh, // ✅ FIXED by quality
//        };

//        // keep child name when updating draft
//        if (editingDraftName && r._rowName) return { ...base, name: r._rowName };
//        return base;
//      });

//      const baseFields = {
//        is_return: 1,
//        update_stock: 1,
//        posting_date: posting,
//        due_date: due,
//        company,
//        customer,
//        items,
//        remarks: "Sales return created from custom screen (good/damaged → fixed warehouses).",
//      };

//      if (editingDraftName) {
//        // ✅ delete removed child rows (important)
//        let old;
//        try {
//          old = await getDoc("Sales Invoice", editingDraftName);
//        } catch {
//          old = null;
//        }

//        const oldNames = new Set((old?.items || []).map((x) => x.name).filter(Boolean));
//        const newNames = new Set(items.map((x) => x.name).filter(Boolean));

//        const deletes = [];
//        oldNames.forEach((nm) => {
//          if (!newNames.has(nm)) {
//            deletes.push({ doctype: "Sales Invoice Item", name: nm, __delete: 1 });
//          }
//        });

//        await updateDoc("Sales Invoice", editingDraftName, {
//          ...baseFields,
//          items: [...items, ...deletes],
//        });

//        setMessage(
//          `Draft updated: ${editingDraftName}. Now use the list button "Create Sales Return" to submit.`
//        );
//      } else {
//        const siDoc = await createDoc("Sales Invoice", {
//          doctype: "Sales Invoice",
//          ...baseFields,
//        });

//        const siName = siDoc?.data?.name || siDoc?.message?.name || siDoc?.name || "";
//        setMessage(
//          `Draft Sales Return created: ${
//            siName || "(name not returned)"
//          }. Scroll down and click "Create Sales Return" in the list to submit.`
//        );
//      }

//      resetFormToNewDraft();
//      await reloadReturns();
//    } catch (err) {
//      console.error(err);
//      setError(
//        err?.response?.data?.error?.message ||
//          err?.response?.data?.error ||
//          err?.message ||
//          "Failed to save draft"
//      );
//    } finally {
//      setSavingDraft(false);
//    }
//  }

//  // ✅ Submit draft from the list
//  async function handleSubmitDraftReturn(name) {
//    if (!name) return;

//    setError("");
//    setMessage("");
//    setSubmittingDraft(name);

//    try {
//      await submitDoc("Sales Invoice", name);
//      setMessage(`Sales Return submitted: ${name}`);
//      await reloadReturns();

//      if (editingDraftName === name) resetFormToNewDraft();
//    } catch (err) {
//      console.error(err);
//      setError(
//        err?.response?.data?.error?.message ||
//          err?.response?.data?.error ||
//          err?.message ||
//          "Failed to submit Sales Return"
//      );
//    } finally {
//      setSubmittingDraft("");
//    }
//  }

//  // ✅ Build daily summary (last N dates)
//  async function loadDailySummary(nDates = summaryDatesCount) {
//    setSummaryError("");
//    setSummaryLoading(true);

//    try {
//      const headers = await getReturnHeadersForSummary(SUMMARY_FETCH_LIMIT);

//      // normalize date + sort desc
//      const normalized = (headers || [])
//        .map((h) => ({
//          name: h.name,
//          posting_date: toYMD(h.posting_date) || "",
//          docstatus: h.docstatus,
//          modified: h.modified,
//        }))
//        .filter((h) => h.name && h.posting_date)
//        .sort((a, b) => {
//          const ta = toSortTs(a.posting_date);
//          const tb = toSortTs(b.posting_date);
//          if (ta !== tb) return tb - ta;
//          return String(b.modified || "").localeCompare(String(a.modified || ""));
//        });

//      // pick last N unique dates
//      const dateSet = new Set();
//      const pickedDates = [];
//      for (const h of normalized) {
//        if (!dateSet.has(h.posting_date)) {
//          dateSet.add(h.posting_date);
//          pickedDates.push(h.posting_date);
//          if (pickedDates.length >= nDates) break;
//        }
//      }

//      if (!pickedDates.length) {
//        setDailySummaryRows([]);
//        setSummaryLoading(false);
//        return;
//      }

//      // only returns inside those dates
//      const names = normalized
//        .filter((h) => pickedDates.includes(h.posting_date))
//        .map((h) => h.name);

//      // load docs (cache-aware)
//      const nextCache = { ...docCache };
//      const need = names.filter((nm) => !nextCache[nm]);

//      // if mapLimit not available, fallback sequential
//      if (need.length) {
//        if (typeof mapLimit === "function") {
//          await mapLimit(need, 5, async (nm) => {
//            const d = await getDoc("Sales Invoice", nm);
//            nextCache[nm] = d;
//          });
//        } else {
//          for (const nm of need) {
//            // eslint-disable-next-line no-await-in-loop
//            const d = await getDoc("Sales Invoice", nm);
//            nextCache[nm] = d;
//          }
//        }
//      }

//      setDocCache(nextCache);

//      // aggregate by date
//      const agg = new Map(); // date -> { docs, goodQty, damagedQty }
//      for (const nm of names) {
//        const doc = nextCache[nm];
//        const date = toYMD(doc?.posting_date) || "";
//        if (!date) continue;

//        if (!agg.has(date)) agg.set(date, { docs: 0, goodQty: 0, damagedQty: 0 });
//        const a = agg.get(date);
//        a.docs += 1;

//        const its = Array.isArray(doc?.items) ? doc.items : [];
//        for (const it of its) {
//          const qty = Math.abs(Number(it.qty || 0)) || 0;
//          const wh = it.warehouse || GOOD_WH;
//          if (wh === DAMAGED_WH) a.damagedQty += qty;
//          else a.goodQty += qty;
//        }
//      }

//      const rowsOut = pickedDates
//        .map((d) => {
//          const a = agg.get(d) || { docs: 0, goodQty: 0, damagedQty: 0 };
//          const totalQty = (a.goodQty || 0) + (a.damagedQty || 0);
//          return {
//            date: d,
//            docs: a.docs || 0,
//            goodQty: a.goodQty || 0,
//            damagedQty: a.damagedQty || 0,
//            totalQty,
//          };
//        })
//        .sort((a, b) => (postingDateSort === "asc" ? 1 : -1) * (toSortTs(a.date) - toSortTs(b.date)));

//      setDailySummaryRows(rowsOut);
//    } catch (err) {
//      console.error(err);
//      setSummaryError(
//        err?.response?.data?.error?.message || err?.message || "Failed to build daily summary"
//      );
//      setDailySummaryRows([]);
//    } finally {
//      setSummaryLoading(false);
//    }
//  }

//  // when summary opens, load it
//  useEffect(() => {
//    if (!summaryOpen) return;
//    loadDailySummary(summaryDatesCount);
//    // eslint-disable-next-line react-hooks/exhaustive-deps
//  }, [summaryOpen]);

//  return (
//    <div className="sales-return">
//      <div className="sales-return-header">
//        <div className="sales-return-title-block">
//          <h2 className="sales-return-title">Sales Returns (with Stock Update)</h2>
//          <p className="sales-return-subtitle">
//            Create a Sales Invoice Return that updates stock and classifies items as Good or Damaged.
//          </p>
//        </div>

//        <div className="sales-return-header-pill">
//          {displayReturns.length} return{displayReturns.length !== 1 ? "s" : ""}
//        </div>
//      </div>

//      {loadingMaster && (
//        <div className="sales-return-loading text-muted">
//          Loading customers, companies & items...
//        </div>
//      )}

//      {error && <div className="alert alert-error sales-return-error">{error}</div>}
//      {message && <div className="alert alert-success sales-return-message">{message}</div>}

//      <div className="sales-return-card">
//        <div className="sales-return-card-header">
//          <h3 className="sales-return-card-title">
//            {editingDraftName ? `Edit Draft: ${editingDraftName}` : "Create Sales Return"}
//          </h3>

//          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
//            Warehouses are automatic (not selectable).
//          </div>
//        </div>

//        <div className="sales-return-form-grid">
//          <div className="sales-return-field-group">
//            <label className="form-label sales-return-field-label">Customer</label>
//            <select
//              value={customer}
//              onChange={(e) => setCustomer(e.target.value)}
//              className="select"
//              disabled={loadingMaster || customers.length === 0}
//            >
//              {customers.map((c) => (
//                <option key={c.name} value={c.name}>
//                  {c.customer_name || c.name}
//                </option>
//              ))}
//            </select>
//          </div>

//          <div className="sales-return-field-group">
//            <label className="form-label sales-return-field-label">Company</label>
//            <select
//              value={company}
//              onChange={(e) => setCompany(e.target.value)}
//              className="select"
//              disabled={loadingMaster || companies.length === 0}
//            >
//              {companies.map((c) => (
//                <option key={c.name} value={c.name}>
//                  {c.company_name || c.name} ({c.abbr})
//                </option>
//              ))}
//            </select>
//          </div>

//          <div className="sales-return-field-group">
//            <label className="form-label sales-return-field-label">Posting Date</label>
//            <input
//              type="date"
//              className="input"
//              value={postingDate}
//              onChange={(e) => setPostingDate(e.target.value)}
//            />
//          </div>
//        </div>

//        <div className="sales-return-items-header">
//          <h4 className="sales-return-section-title">Items to Return</h4>
//          <button type="button" onClick={addRow} className="btn btn-accent btn-sm">
//            + Add Item
//          </button>
//        </div>

//        <div className="sales-return-rows">
//          {rows.map((row, idx) => (
//            <div key={row.id} className="sales-return-row-card">
//              <div className="sales-return-row-header">
//                <span className="sales-return-row-title">
//                  Line #{idx + 1}
//                  {row.item_code ? ` · ${row.item_code}` : ""}
//                </span>

//                <button
//                  type="button"
//                  onClick={() => removeRow(row.id)}
//                  className="btn btn-ghost btn-sm"
//                >
//                  Remove
//                </button>
//              </div>

//              <div className="sales-return-row-grid">
//                <div className="sales-return-row-field">
//                  <label className="form-label">Item</label>
//                  <ItemSearchDropdown
//                    items={itemsCatalog}
//                    value={row.item_code}
//                    onSelect={(code) => handleRowChange(row.id, "item_code", code)}
//                    placeholder="Search item name / code..."
//                  />
//                </div>

//                <div className="sales-return-row-field">
//                  <label className="form-label">Qty</label>
//                  <input
//                    type="number"
//                    step="1"
//                    min="0"
//                    className="input"
//                    value={row.qty}
//                    onChange={(e) => {
//                      const v = e.target.value;
//                      if (v === "") return handleRowChange(row.id, "qty", "");
//                      const n = Number(v);
//                      if (Number.isNaN(n) || n < 0) return; // ❌ block negative
//                      handleRowChange(row.id, "qty", v);
//                    }}
//                  />
//                </div>

//                <div className="sales-return-row-field">
//                  <label className="form-label">Rate</label>
//                  <input
//                    type="number"
//                    step="1"
//                    min="0"
//                    className="input"
//                    value={row.rate}
//                    onChange={(e) => {
//                      const v = e.target.value;
//                      if (v === "") return handleRowChange(row.id, "rate", "");
//                      const n = Number(v);
//                      if (Number.isNaN(n) || n < 0) return; // ❌ block negative
//                      handleRowChange(row.id, "rate", v);
//                    }}
//                  />
//                </div>

//                <div className="sales-return-row-field">
//                  <label className="form-label">Quality</label>
//                  <select
//                    className="select"
//                    value={row.quality || "good"}
//                    onChange={(e) => handleRowChange(row.id, "quality", e.target.value)}
//                  >
//                    <option value="good">Good (add to Finished Goods)</option>
//                    <option value="damaged">Damaged (add to Damaged warehouse)</option>
//                  </select>
//                </div>

//                {/* ✅ Warehouse removed from frontend */}
//              </div>
//            </div>
//          ))}
//        </div>

//        <div className="sales-return-submit-row" style={{ display: "flex", gap: 10 }}>
//          <button
//            type="button"
//            onClick={handleCreateOrUpdateDraft}
//            disabled={savingDraft || loadingMaster}
//            className="btn btn-primary"
//          >
//            {savingDraft
//              ? editingDraftName
//                ? "Updating Draft..."
//                : "Creating Draft..."
//              : editingDraftName
//              ? "Update Draft"
//              : "Create Return Draft"}
//          </button>

//          {editingDraftName ? (
//            <button
//              type="button"
//              onClick={cancelEditDraft}
//              disabled={savingDraft || loadingMaster}
//              className="btn btn-ghost"
//            >
//              Cancel Edit
//            </button>
//          ) : null}
//        </div>
//      </div>

//      <div className="sales-return-list-section">
//        <div
//          className="sales-return-list-header"
//          style={{
//            display: "flex",
//            justifyContent: "space-between",
//            alignItems: "center",
//            gap: 12,
//          }}
//        >
//          <div>
//            <h3 className="sales-return-list-title" style={{ marginBottom: 2 }}>
//              Recent Sales Returns
//            </h3>
//            <div style={{ fontSize: 12, opacity: 0.7 }}>Showing latest {LIST_LIMIT}</div>
//          </div>

//          {/* ✅ right corner controls */}
//          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
//            <button
//              type="button"
//              className="btn btn-outline btn-xs"
//              onClick={() => setPostingDateSort((p) => (p === "asc" ? "desc" : "asc"))}
//              disabled={loadingReturns}
//            >
//              {postingDateSortLabel}
//            </button>

//            <button
//              type="button"
//              className="btn btn-secondary btn-sm"
//              onClick={reloadReturns}
//              disabled={loadingReturns}
//            >
//              {loadingReturns ? "Refreshing..." : "Refresh"}
//            </button>

//            {/* ✅ NEW: Daily Summary tab/button */}
//            <button
//              type="button"
//              className="btn btn-outline btn-sm"
//              onClick={() => setSummaryOpen((v) => !v)}
//              disabled={loadingReturns}
//              title="Show day-wise Good/Damaged totals"
//            >
//              {summaryOpen ? "Hide Summary" : "Daily Summary"}
//            </button>
//          </div>
//        </div>

//        {/* ✅ Summary panel */}
//        {summaryOpen && (
//          <div
//            className="sales-return-card"
//            style={{ marginTop: 12, padding: 12 }}
//          >
//            <div
//              style={{
//                display: "flex",
//                justifyContent: "space-between",
//                gap: 12,
//                alignItems: "center",
//                flexWrap: "wrap",
//              }}
//            >
//              <div>
//                <div style={{ fontWeight: 700 }}>Daily Return Summary</div>
//                <div style={{ fontSize: 12, opacity: 0.75 }}>
//                  Good vs Damaged totals (by posting date)
//                </div>
//              </div>

//              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
//                <div style={{ fontSize: 12, opacity: 0.8 }}>Dates:</div>
//                <select
//                  className="select"
//                  value={summaryDatesCount}
//                  onChange={(e) => {
//                    const n = Number(e.target.value) || 10;
//                    setSummaryDatesCount(n);
//                    loadDailySummary(n);
//                  }}
//                  style={{ padding: "6px 8px" }}
//                >
//                  {SUMMARY_DATE_OPTIONS.map((n) => (
//                    <option key={n} value={n}>
//                      Last {n} dates
//                    </option>
//                  ))}
//                </select>

//                <button
//                  type="button"
//                  className="btn btn-secondary btn-sm"
//                  onClick={() => loadDailySummary(summaryDatesCount)}
//                  disabled={summaryLoading}
//                >
//                  {summaryLoading ? "Loading..." : "Refresh Summary"}
//                </button>
//              </div>
//            </div>

//            {summaryError ? (
//              <div className="alert alert-error" style={{ marginTop: 10 }}>
//                {summaryError}
//              </div>
//            ) : null}

//            {summaryLoading ? (
//              <div className="text-muted" style={{ marginTop: 10 }}>
//                Building summary...
//              </div>
//            ) : dailySummaryRows.length === 0 ? (
//              <div className="text-muted" style={{ marginTop: 10 }}>
//                No summary data found.
//              </div>
//            ) : (
//              <div className="table-container" style={{ marginTop: 10 }}>
//                <table className="table sales-return-table">
//                  <thead>
//                    <tr>
//                      <th>Date</th>
//                      <th>Returns</th>
//                      <th>Good Qty</th>
//                      <th>Damaged Qty</th>
//                      <th>Total Qty</th>
//                    </tr>
//                  </thead>
//                  <tbody>
//                    {dailySummaryRows.map((r) => (
//                      <tr key={r.date}>
//                        <td>{r.date}</td>
//                        <td>{r.docs}</td>
//                        <td>{Number(r.goodQty || 0).toFixed(2)}</td>
//                        <td>{Number(r.damagedQty || 0).toFixed(2)}</td>
//                        <td>{Number(r.totalQty || 0).toFixed(2)}</td>
//                      </tr>
//                    ))}
//                  </tbody>
//                </table>
//              </div>
//            )}
//          </div>
//        )}

//        {loadingReturns && (
//          <div className="sales-return-list-loading text-muted">Loading recent returns...</div>
//        )}

//        {!loadingReturns && displayReturns.length === 0 && (
//          <div className="sales-return-list-empty text-muted">No returns found.</div>
//        )}

//        {!loadingReturns && displayReturns.length > 0 && (
//          <div className="sales-return-table-wrapper table-container">
//            <table className="table sales-return-table">
//              <thead>
//                <tr>
//                  <th>Return Name</th>
//                  <th>Customer</th>
//                  <th>Company</th>
//                  <th>Date</th>
//                  <th>Grand Total</th>
//                  <th>Action</th>
//                </tr>
//              </thead>

//              <tbody>
//                {sortedDisplayReturns.map((r) => {
//                  const isDraft = !!r.__isDraft;
//                  const isSubmitting = submittingDraft === r.name;
//                  const isEditingThis = editingDraftName === r.name;
//                  const isEditLoadingThis = editDraftLoading === r.name;

//                  return (
//                    <tr key={r.name}>
//                      <td className="sales-return-name-cell">
//                        {r.name} {isDraft ? <span style={{ opacity: 0.7 }}>(Draft)</span> : null}
//                        {isEditingThis ? (
//                          <span style={{ marginLeft: 8, opacity: 0.7 }}>(Editing)</span>
//                        ) : null}
//                      </td>

//                      <td className="sales-return-customer-cell">{r.customer}</td>
//                      <td className="sales-return-company-cell">{r.company}</td>
//                      <td className="sales-return-date-cell">{r.posting_date}</td>
//                      <td className="sales-return-amount-cell">
//                        ₹ {r.grand_total != null ? Number(r.grand_total).toFixed(2) : "0.00"}
//                      </td>

//                      <td>
//                        {isDraft ? (
//                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
//                            <button
//                              type="button"
//                              className="btn btn-outline btn-xs"
//                              disabled={isEditLoadingThis || isSubmitting}
//                              onClick={() => handleEditDraft(r.name)}
//                            >
//                              {isEditLoadingThis ? "Loading..." : "Edit Draft"}
//                            </button>

//                            <button
//                              type="button"
//                              className="btn btn-accent btn-xs"
//                              disabled={isSubmitting}
//                              onClick={() => handleSubmitDraftReturn(r.name)}
//                            >
//                              {isSubmitting ? "Submitting..." : "Create Sales Return"}
//                            </button>
//                          </div>
//                        ) : (
//                          "-"
//                        )}
//                      </td>
//                    </tr>
//                  );
//                })}
//              </tbody>
//            </table>
//          </div>
//        )}
//      </div>
//    </div>
//  );
//}

///* ✅ Same dropdown component used in StockTransfer */
//function ItemSearchDropdown({ items, value, onSelect, placeholder }) {
//  const [open, setOpen] = useState(false);
//  const [q, setQ] = useState("");
//  const ref = useRef(null);

//  const selected = useMemo(() => items.find((x) => x.name === value) || null, [items, value]);

//  const filtered = useMemo(() => {
//    const s = (q || "").trim().toLowerCase();
//    const base = !s
//      ? items
//      : items.filter((it) => {
//          const code = (it.name || "").toLowerCase();
//          const name = (it.item_name || "").toLowerCase();
//          return code.includes(s) || name.includes(s);
//        });
//    return base.slice(0, 80);
//  }, [items, q]);

//  useEffect(() => {
//    function onDown(e) {
//      if (!ref.current) return;
//      if (!ref.current.contains(e.target)) setOpen(false);
//    }
//    document.addEventListener("mousedown", onDown);
//    return () => document.removeEventListener("mousedown", onDown);
//  }, []);

//  return (
//    <div className="stdrop" ref={ref}>
//      <button
//        type="button"
//        className={`stdrop-control ${open ? "is-open" : ""}`}
//        onClick={() => setOpen((v) => !v)}
//      >
//        <div className="stdrop-value">
//          {selected ? (
//            <>
//              <div className="stdrop-title">{selected.name}</div>
//              <div className="stdrop-sub">
//                {selected.item_name || ""} {selected.stock_uom ? `· ${selected.stock_uom}` : ""}
//              </div>
//            </>
//          ) : (
//            <div className="stdrop-placeholder">{placeholder}</div>
//          )}
//        </div>
//        <div className="stdrop-caret">▾</div>
//      </button>

//      {open && (
//        <div className="stdrop-popover">
//          <div className="stdrop-search">
//            <input
//              autoFocus
//              className="input"
//              value={q}
//              onChange={(e) => setQ(e.target.value)}
//              placeholder="Type to search..."
//            />
//          </div>

//          <div className="stdrop-list">
//            {filtered.map((it) => (
//              <button
//                key={it.name}
//                type="button"
//                className="stdrop-item"
//                onClick={() => {
//                  onSelect(it.name);
//                  setOpen(false);
//                  setQ("");
//                }}
//              >
//                <div className="stdrop-item-title">{it.name}</div>
//                <div className="stdrop-item-sub">
//                  {it.item_name || ""} {it.stock_uom ? `· ${it.stock_uom}` : ""}
//                </div>
//              </button>
//            ))}

//            {!filtered.length ? (
//              <div className="stdrop-empty">No items found.</div>
//            ) : (
//              <div className="stdrop-hint">Showing up to 80 results</div>
//            )}
//          </div>
//        </div>
//      )}
//    </div>
//  );
//}

//export default SalesReturn;



// src/SalesReturn.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getCustomers,
  getCompanies,
  getFinishedItemsForSales,
  getRecentSalesReturns,
  getDoctypeList, // draft returns
  createDoc,
  submitDoc,
  getDoc,
  updateDoc,
  mapLimit,
} from "./erpBackendApi";
import "../CSS/SalesReturn.css";

// Warehouses FIXED
const GOOD_WH = "Finished Goods - MF";
const DAMAGED_WH = "Damaged - MF";

const LIST_LIMIT = 10;

function getWarehouseForQuality(quality) {
  return quality === "damaged" ? DAMAGED_WH : GOOD_WH;
}

function toSortTs(v) {
  if (!v) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  const isoLike = s.includes(" ") ? s.replace(" ", "T") : s;
  const d = new Date(isoLike);
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
}

function toYMD(input) {
  if (input == null) return "";
  if (input instanceof Date && !isNaN(input.getTime())) return input.toISOString().slice(0, 10);

  const s = String(input).trim();
  if (!s) return "";

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[t\s].*)?$/i);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

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
    _rowName: "",
    item_code: "",
    qty: "1.00",
    rate: "0.00",
    quality: "good",
  };
}

async function getRecentDraftSalesReturns(limit = LIST_LIMIT) {
  const rows = await getDoctypeList("Sales Invoice", {
    fields: JSON.stringify([
      "name",
      "customer",
      "company",
      "posting_date",
      "grand_total",
      "docstatus",
      "modified",
      "is_return",
    ]),
    filters: JSON.stringify([
      ["Sales Invoice", "is_return", "=", 1],
      ["Sales Invoice", "docstatus", "=", 0],
    ]),
    order_by: "modified desc",
    limit_page_length: limit,
  });

  return rows || [];
}

export default function SalesReturn() {
  // Master
  const [customers, setCustomers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [itemsCatalog, setItemsCatalog] = useState([]);

  // Header
  const todayStr = new Date().toISOString().slice(0, 10);
  const [customer, setCustomer] = useState("");
  const [company, setCompany] = useState("");
  const [postingDate, setPostingDate] = useState(todayStr);

  // Lines
  const [rows, setRows] = useState([createEmptyRow(0)]);

  // Draft edit
  const [editingDraftName, setEditingDraftName] = useState("");
  const [editDraftLoading, setEditDraftLoading] = useState("");

  // Recent
  const [returns, setReturns] = useState([]); // submitted
  const [draftReturns, setDraftReturns] = useState([]); // drafts
  const [loadingReturns, setLoadingReturns] = useState(false);

  // Shared
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submittingDraft, setSubmittingDraft] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Sorting (Posting Date)
  const [postingDateSort, setPostingDateSort] = useState("desc");
  const postingDateSortLabel =
    postingDateSort === "asc" ? "Posting Date: Oldest → Newest" : "Posting Date: Newest → Oldest";

  // Qty enrichment (for list totals + per-row total qty)
  const [qtyByReturnName, setQtyByReturnName] = useState({}); // { [name]: {totalQty, goodQty, damagedQty, uomLabel} }

  const displayReturns = useMemo(() => {
    const drafts = (draftReturns || []).map((d) => ({ ...d, __isDraft: true }));
    const submitted = (returns || []).map((r) => ({ ...r, __isDraft: false }));
    return [...drafts, ...submitted].slice(0, LIST_LIMIT);
  }, [draftReturns, returns]);

  const sortedDisplayReturns = useMemo(() => {
    const dirMul = postingDateSort === "asc" ? 1 : -1;

    return [...(displayReturns || [])].sort((a, b) => {
      const ta = toSortTs(a?.posting_date);
      const tb = toSortTs(b?.posting_date);
      if (ta !== tb) return (ta - tb) * dirMul;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });
  }, [displayReturns, postingDateSort]);

  const visibleTotalQty = useMemo(() => {
    let sum = 0;
    sortedDisplayReturns.forEach((r) => {
      const q = qtyByReturnName?.[r.name]?.totalQty;
      if (Number.isFinite(q)) sum += q;
    });
    return sum;
  }, [sortedDisplayReturns, qtyByReturnName]);

  // Load master + recent
  useEffect(() => {
    async function load() {
      setLoadingMaster(true);
      setError("");

      try {
        const [custData, compData, itemData, recentSubmitted, recentDrafts] = await Promise.all([
          getCustomers(),
          getCompanies(),
          getFinishedItemsForSales(),
          getRecentSalesReturns(LIST_LIMIT),
          getRecentDraftSalesReturns(LIST_LIMIT),
        ]);

        setCustomers(custData || []);
        setCompanies(compData || []);
        setItemsCatalog(itemData || []);
        setReturns(recentSubmitted || []);
        setDraftReturns(recentDrafts || []);

        if (!customer && (custData || []).length > 0) setCustomer(custData[0].name);
        if (!company && (compData || []).length > 0) setCompany(compData[0].name);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load data for Sales Returns");
      } finally {
        setLoadingMaster(false);
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRowChange(id, field, value) {
    setRows((prev) => prev.map((r) => (r.id !== id ? r : { ...r, [field]: value })));
  }

  function addRow() {
    setRows((prev) => [...prev, createEmptyRow(prev.length ? prev[prev.length - 1].id + 1 : 0)]);
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
      const [rec, drafts] = await Promise.all([
        getRecentSalesReturns(LIST_LIMIT),
        getRecentDraftSalesReturns(LIST_LIMIT),
      ]);
      setReturns(rec || []);
      setDraftReturns(drafts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReturns(false);
    }
  }

  function resetFormToNewDraft() {
    setEditingDraftName("");
    setPostingDate(todayStr);
    setRows([createEmptyRow(0)]);
  }

  async function handleEditDraft(name) {
    if (!name) return;

    setError("");
    setMessage("");
    setEditDraftLoading(name);

    try {
      const doc = await getDoc("Sales Invoice", name);

      setEditingDraftName(name);
      setCustomer(doc.customer || customer);
      setCompany(doc.company || company);
      setPostingDate(toYMD(doc.posting_date) || todayStr);

      const its = Array.isArray(doc.items) ? doc.items : [];
      const mapped =
        its.length > 0
          ? its.map((it, idx) => {
              const wh = it.warehouse || GOOD_WH;
              const quality = wh === DAMAGED_WH ? "damaged" : "good";

              const qtyNum = Number(it.qty || 0);
              const rateNum = Number(it.rate || 0);

              return {
                id: idx,
                _rowName: it.name || "",
                item_code: it.item_code || "",
                qty: String(Math.abs(qtyNum) || 1),
                rate: String(isNaN(rateNum) ? 0 : rateNum),
                quality,
              };
            })
          : [createEmptyRow(0)];

      setRows(mapped);
      setMessage(`Editing draft: ${name}. Update and click "Update Draft".`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to load draft for edit"
      );
    } finally {
      setEditDraftLoading("");
    }
  }

  function cancelEditDraft() {
    setMessage("");
    resetFormToNewDraft();
  }

  async function handleCreateOrUpdateDraft() {
    setError("");
    setMessage("");

    if (!customer) return setError("Please select a Customer.");
    if (!company) return setError("Please select a Company.");

    const posting = toYMD(postingDate) || todayStr;
    const due = posting;

    const normalizedRows = rows.map((r) => ({
      ...r,
      qtyNum: r.qty === "" ? NaN : Number(r.qty),
      rateNum: r.rate === "" ? NaN : Number(r.rate),
    }));

    const hasNegative = normalizedRows.some(
      (r) => (!isNaN(r.qtyNum) && r.qtyNum < 0) || (!isNaN(r.rateNum) && r.rateNum < 0)
    );
    if (hasNegative) return setError("Qty/Rate cannot be negative.");

    const validRows = normalizedRows.filter((r) => r.item_code && !isNaN(r.qtyNum) && r.qtyNum > 0);
    if (!validRows.length) return setError("Add at least one line with item and positive qty.");

    try {
      setSavingDraft(true);

      const items = validRows.map((r) => {
        const targetWh = getWarehouseForQuality(r.quality);
        const base = {
          item_code: r.item_code,
          qty: -Math.abs(r.qtyNum),
          rate: isNaN(r.rateNum) ? 0 : r.rateNum,
          warehouse: targetWh,
        };

        if (editingDraftName && r._rowName) return { ...base, name: r._rowName };
        return base;
      });

      const baseFields = {
        is_return: 1,
        update_stock: 1,
        posting_date: posting,
        due_date: due,
        company,
        customer,
        items,
        remarks: "Sales return created from custom screen (good/damaged → fixed warehouses).",
      };

      if (editingDraftName) {
        let old;
        try {
          old = await getDoc("Sales Invoice", editingDraftName);
        } catch {
          old = null;
        }

        const oldNames = new Set((old?.items || []).map((x) => x.name).filter(Boolean));
        const newNames = new Set(items.map((x) => x.name).filter(Boolean));

        const deletes = [];
        oldNames.forEach((nm) => {
          if (!newNames.has(nm)) deletes.push({ doctype: "Sales Invoice Item", name: nm, __delete: 1 });
        });

        await updateDoc("Sales Invoice", editingDraftName, {
          ...baseFields,
          items: [...items, ...deletes],
        });

        setMessage(`Draft updated: ${editingDraftName}. Now use "Create Sales Return" in the list to submit.`);
      } else {
        const siDoc = await createDoc("Sales Invoice", { doctype: "Sales Invoice", ...baseFields });
        const siName = siDoc?.data?.name || siDoc?.message?.name || siDoc?.name || "";
        setMessage(
          `Draft Sales Return created: ${siName || "(name not returned)"}. Scroll down and click "Create Sales Return" in the list to submit.`
        );
      }

      resetFormToNewDraft();
      await reloadReturns();
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to save draft"
      );
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSubmitDraftReturn(name) {
    if (!name) return;

    setError("");
    setMessage("");
    setSubmittingDraft(name);

    try {
      await submitDoc("Sales Invoice", name);
      setMessage(`Sales Return submitted: ${name}`);
      await reloadReturns();
      if (editingDraftName === name) resetFormToNewDraft();
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to submit Sales Return"
      );
    } finally {
      setSubmittingDraft("");
    }
  }

  // ---- Enrich list with total qty per return (visible list only) ----
  useEffect(() => {
    const names = (sortedDisplayReturns || []).map((x) => x.name).filter(Boolean);
    if (!names.length) return;

    const need = names.filter((nm) => !qtyByReturnName[nm]);

    if (!need.length) return;

    (async () => {
      const next = { ...qtyByReturnName };

      const summarizeDoc = (doc) => {
        let totalQty = 0;
        let goodQty = 0;
        let damagedQty = 0;
        const uoms = new Set();

        const its = Array.isArray(doc?.items) ? doc.items : [];
        its.forEach((it) => {
          const q = Math.abs(Number(it.qty || 0)) || 0;
          totalQty += q;

          const wh = it.warehouse || GOOD_WH;
          if (wh === DAMAGED_WH) damagedQty += q;
          else goodQty += q;

          const u = (it.uom || it.stock_uom || "").trim();
          if (u) uoms.add(u);
        });

        const uomLabel = uoms.size === 1 ? Array.from(uoms)[0] : uoms.size > 1 ? "Mixed" : "";

        return { totalQty, goodQty, damagedQty, uomLabel };
      };

      await mapLimit(need, 5, async (nm) => {
        try {
          const doc = await getDoc("Sales Invoice", nm);
          next[nm] = summarizeDoc(doc);
        } catch {
          next[nm] = { totalQty: 0, goodQty: 0, damagedQty: 0, uomLabel: "" };
        }
      });

      setQtyByReturnName(next);
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedDisplayReturns]);

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
          {displayReturns.length} return{displayReturns.length !== 1 ? "s" : ""}
        </div>
      </div>

      {loadingMaster && <div className="sales-return-loading text-muted">Loading customers, companies & items...</div>}
      {error && <div className="alert alert-error sales-return-error">{error}</div>}
      {message && <div className="alert alert-success sales-return-message">{message}</div>}

      {/* FORM */}
      <div className="sales-return-card">
        <div className="sales-return-card-header">
          <h3 className="sales-return-card-title">
            {editingDraftName ? `Edit Draft: ${editingDraftName}` : "Create Sales Return"}
          </h3>

          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
            Warehouses are automatic (not selectable).
          </div>
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

                <button type="button" onClick={() => removeRow(row.id)} className="btn btn-ghost btn-sm">
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
                    step="1"
                    min="0"
                    className="input"
                    value={row.qty}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") return handleRowChange(row.id, "qty", "");
                      const n = Number(v);
                      if (Number.isNaN(n) || n < 0) return;
                      handleRowChange(row.id, "qty", v);
                    }}
                  />
                </div>

                <div className="sales-return-row-field">
                  <label className="form-label">Rate</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    className="input"
                    value={row.rate}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") return handleRowChange(row.id, "rate", "");
                      const n = Number(v);
                      if (Number.isNaN(n) || n < 0) return;
                      handleRowChange(row.id, "rate", v);
                    }}
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
              </div>
            </div>
          ))}
        </div>

        <div className="sales-return-submit-row" style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={handleCreateOrUpdateDraft}
            disabled={savingDraft || loadingMaster}
            className="btn btn-primary"
          >
            {savingDraft
              ? editingDraftName
                ? "Updating Draft..."
                : "Creating Draft..."
              : editingDraftName
              ? "Update Draft"
              : "Create Return Draft"}
          </button>

          {editingDraftName ? (
            <button
              type="button"
              onClick={cancelEditDraft}
              disabled={savingDraft || loadingMaster}
              className="btn btn-ghost"
            >
              Cancel Edit
            </button>
          ) : null}
        </div>
      </div>

      {/* LIST */}
      <div className="sales-return-list-section">
        <div
          className="sales-return-list-header"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
        >
          <div>
            <h3 className="sales-return-list-title" style={{ marginBottom: 2 }}>
              Recent Sales Returns
            </h3>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Showing latest {LIST_LIMIT} • Total Qty (visible): <b>{Number(visibleTotalQty || 0).toFixed(2)}</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-outline btn-xs"
              onClick={() => setPostingDateSort((p) => (p === "asc" ? "desc" : "asc"))}
              disabled={loadingReturns}
            >
              {postingDateSortLabel}
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={reloadReturns}
              disabled={loadingReturns}
            >
              {loadingReturns ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {loadingReturns && <div className="sales-return-list-loading text-muted">Loading recent returns...</div>}
        {!loadingReturns && displayReturns.length === 0 && (
          <div className="sales-return-list-empty text-muted">No returns found.</div>
        )}

        {!loadingReturns && displayReturns.length > 0 && (
          <div className="sales-return-table-wrapper table-container">
            <table className="table sales-return-table">
              <thead>
                <tr>
                  <th>Return Name</th>
                  <th>Customer</th>
                  <th>Company</th>
                  <th>Date</th>
                  <th>Total Qty</th>
                  <th>Grand Total</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {sortedDisplayReturns.map((r) => {
                  const isDraft = !!r.__isDraft;
                  const isSubmitting = submittingDraft === r.name;
                  const isEditingThis = editingDraftName === r.name;
                  const isEditLoadingThis = editDraftLoading === r.name;

                  const q = qtyByReturnName?.[r.name]?.totalQty;
                  const uomLabel = qtyByReturnName?.[r.name]?.uomLabel;

                  return (
                    <tr key={r.name}>
                      <td className="sales-return-name-cell">
                        {r.name} {isDraft ? <span style={{ opacity: 0.7 }}>(Draft)</span> : null}
                        {isEditingThis ? <span style={{ marginLeft: 8, opacity: 0.7 }}>(Editing)</span> : null}
                      </td>

                      <td className="sales-return-customer-cell">{r.customer}</td>
                      <td className="sales-return-company-cell">{r.company}</td>
                      <td className="sales-return-date-cell">{r.posting_date}</td>

                      <td>
                        {Number.isFinite(q) ? (
                          <>
                            {Number(q).toFixed(2)} {uomLabel ? <span style={{ opacity: 0.7 }}>({uomLabel})</span> : null}
                          </>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="sales-return-amount-cell">
                        ₹ {r.grand_total != null ? Number(r.grand_total).toFixed(2) : "0.00"}
                      </td>

                      <td>
                        {isDraft ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              className="btn btn-outline btn-xs"
                              disabled={isEditLoadingThis || isSubmitting}
                              onClick={() => handleEditDraft(r.name)}
                            >
                              {isEditLoadingThis ? "Loading..." : "Edit Draft"}
                            </button>

                            <button
                              type="button"
                              className="btn btn-accent btn-xs"
                              disabled={isSubmitting}
                              onClick={() => handleSubmitDraftReturn(r.name)}
                            >
                              {isSubmitting ? "Submitting..." : "Create Sales Return"}
                            </button>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* Dropdown (same as before) */
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

