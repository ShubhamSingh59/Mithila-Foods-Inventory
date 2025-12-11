//// src/SalesReturn.jsx
//import React, { useEffect, useState } from "react";
//import {
//  getCustomers,
//  getCompanies,
//  getFinishedItemsForSales,
//  createReturnDeliveryNote,
//  createStandaloneSalesReturnInvoice,
//  getRecentSalesReturns,
//  submitDoc,
//} from "./erpBackendApi";
//import "../CSS/SalesReturn.css";

//const DEFAULT_WH = "Finished Goods - MF";

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

//  // Line items for the return
//  const [rows, setRows] = useState([createEmptyRow(0)]);

//  // Recent returns
//  const [returns, setReturns] = useState([]);
//  const [loadingReturns, setLoadingReturns] = useState(false);

//  // Shared state
//  const [loadingMaster, setLoadingMaster] = useState(false);
//  const [creatingReturn, setCreatingReturn] = useState(false);
//  const [error, setError] = useState("");
//  const [message, setMessage] = useState("");

//  function createEmptyRow(id) {
//    return {
//      id,
//      item_code: "",
//      qty: "1.00",
//      rate: "0.00",
//      warehouse: DEFAULT_WH,
//    };
//  }

//  // Load dropdown data + recent returns
//  useEffect(() => {
//    async function load() {
//      setLoadingMaster(true);
//      setError("");
//      try {
//        const [custData, compData, itemData, recentReturns] = await Promise.all([
//          getCustomers(),
//          getCompanies(),
//          getFinishedItemsForSales(),
//          getRecentSalesReturns(50),
//        ]);

//        setCustomers(custData);
//        setCompanies(compData);
//        setItemsCatalog(itemData);
//        setReturns(recentReturns);

//        if (custData.length > 0) {
//          setCustomer(custData[0].name);
//        }
//        if (compData.length > 0) {
//          setCompany(compData[0].name);
//        }
//      } catch (err) {
//        console.error(err);
//        setError(err.message || "Failed to load data for Sales Returns");
//      } finally {
//        setLoadingMaster(false);
//      }
//    }

//    load();
//  }, []);

//  // ------- Row handlers --------

//  function handleRowChange(id, field, value) {
//    setRows((prev) =>
//      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
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
//      // never allow completely empty list – keep at least one blank row
//      return filtered.length ? filtered : [createEmptyRow(0)];
//    });
//  }

//  // ------- Create Return (DN + negative SI) --------

//  async function handleCreateReturn() {
//    setError("");
//    setMessage("");

//    if (!customer) {
//      setError("Please select a Customer.");
//      return;
//    }
//    if (!company) {
//      setError("Please select a Company.");
//      return;
//    }
//    if (!postingDate) {
//      setError("Please select a Posting Date.");
//      return;
//    }

//    const validRows = rows
//      .map((r) => ({
//        ...r,
//        qtyNum: parseFloat(r.qty),
//        rateNum: parseFloat(r.rate),
//      }))
//      .filter(
//        (r) =>
//          r.item_code &&
//          !isNaN(r.qtyNum) &&
//          r.qtyNum > 0 &&
//          r.warehouse
//      );

//    if (!validRows.length) {
//      setError("Add at least one line with item, positive qty and warehouse.");
//      return;
//    }

//    try {
//      setCreatingReturn(true);

//      // Prepare plain items array
//      const items = validRows.map((r) => ({
//        item_code: r.item_code,
//        qty: r.qtyNum,
//        rate: isNaN(r.rateNum) ? 0 : r.rateNum,
//        warehouse: r.warehouse,
//      }));

//      // 1) Return Delivery Note (stock in) - keep as DRAFT to avoid submit bug
//      const dnDoc = await createReturnDeliveryNote({
//        customer,
//        company,
//        posting_date: postingDate,
//        items,
//      });

//      const dnName =
//        dnDoc?.data?.name || dnDoc?.message?.name || dnDoc?.name || "";

//      // 2) Standalone Sales Return Invoice (credit note, no stock) – we DO submit this
//      const siDoc = await createStandaloneSalesReturnInvoice({
//        customer,
//        company,
//        posting_date: postingDate,
//        items,
//      });

//      const siName =
//        siDoc?.data?.name || siDoc?.message?.name || siDoc?.name || "";

//      if (siName) {
//        await submitDoc("Sales Invoice", siName);
//      }

//      setMessage(
//        `Sales Return created. Delivery Note (draft): ${
//          dnName || "not saved"
//        }, Sales Invoice (credit note): ${siName || "draft"}.`
//      );

//      // reset lines but keep customer/company/date as-is
//      setRows([createEmptyRow(0)]);

//      // reload recent returns list
//      await reloadReturns();
//    } catch (err) {
//      console.error(err);
//      setError(
//        err.response?.data?.error?.message ||
//          err.message ||
//          "Failed to create Sales Return"
//      );
//    } finally {
//      setCreatingReturn(false);
//    }
//  }

//  async function reloadReturns() {
//    try {
//      setLoadingReturns(true);
//      const rec = await getRecentSalesReturns(50);
//      setReturns(rec);
//    } catch (err) {
//      console.error(err);
//    } finally {
//      setLoadingReturns(false);
//    }
//  }

//  return (
//    <div className="sales-return">
//      {/* Header */}
//      <div className="sales-return-header">
//        <div className="sales-return-title-block">
//          <h2 className="sales-return-title">
//            Sales Returns (No Reference Invoice)
//          </h2>
//          <p className="sales-return-subtitle">
//            Create a Return Delivery Note and negative Sales Invoice directly.
//          </p>
//        </div>
//        <div className="sales-return-header-pill">
//          {returns.length} return{returns.length !== 1 ? "s" : ""}
//        </div>
//      </div>

//      {/* Messages */}
//      {loadingMaster && (
//        <div className="sales-return-loading text-muted">
//          Loading customers, companies & items...
//        </div>
//      )}
//      {error && (
//        <div className="alert alert-error sales-return-error">{error}</div>
//      )}
//      {message && (
//        <div className="alert alert-success sales-return-message">
//          {message}
//        </div>
//      )}

//      {/* -------- CREATE RETURN SECTION -------- */}
//      <div className="sales-return-card">
//        <div className="sales-return-card-header">
//          <h3 className="sales-return-card-title">Create Sales Return</h3>
//        </div>

//        {/* Header fields */}
//        <div className="sales-return-form-grid">
//          <div className="sales-return-field-group">
//            <label className="form-label sales-return-field-label">
//              Customer
//            </label>
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
//            <label className="form-label sales-return-field-label">
//              Company
//            </label>
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
//            <label className="form-label sales-return-field-label">
//              Posting Date
//            </label>
//            <input
//              type="date"
//              className="input"
//              value={postingDate}
//              onChange={(e) => setPostingDate(e.target.value)}
//            />
//          </div>
//        </div>

//        {/* Line items */}
//        <div className="sales-return-items-header">
//          <h4 className="sales-return-section-title">Items to Return</h4>
//          <button
//            type="button"
//            onClick={addRow}
//            className="btn btn-accent btn-sm"
//          >
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
//                {/* 🔥 Always show Remove; logic in removeRow keeps at least one row */}
//                <button
//                  type="button"
//                  onClick={() => removeRow(row.id)}
//                  className="btn btn-ghost btn-sm"
//                >
//                  Remove
//                </button>
//              </div>

//              <div className="sales-return-row-grid">
//                {/* Item (searchable) */}
//                <div className="sales-return-row-field">
//                  <label className="form-label">Item</label>
//                  <input
//                    list={`sales-return-item-list-${row.id}`}
//                    value={row.item_code}
//                    onChange={(e) =>
//                      handleRowChange(row.id, "item_code", e.target.value)
//                    }
//                    className="input"
//                    placeholder="Type or select item code"
//                  />
//                  <datalist id={`sales-return-item-list-${row.id}`}>
//                    {itemsCatalog.map((it) => (
//                      <option
//                        key={it.name}
//                        value={it.name}
//                        label={`${it.name} - ${it.item_name || ""}`}
//                      />
//                    ))}
//                  </datalist>
//                </div>

//                {/* Qty */}
//                <div className="sales-return-row-field">
//                  <label className="form-label">Qty</label>
//                  <input
//                    type="number"
//                    step="0.01"
//                    className="input"
//                    value={row.qty}
//                    onChange={(e) =>
//                      handleRowChange(row.id, "qty", e.target.value)
//                    }
//                  />
//                </div>

//                {/* Rate */}
//                <div className="sales-return-row-field">
//                  <label className="form-label">Rate</label>
//                  <input
//                    type="number"
//                    step="0.01"
//                    className="input"
//                    value={row.rate}
//                    onChange={(e) =>
//                      handleRowChange(row.id, "rate", e.target.value)
//                    }
//                  />
//                </div>

//                {/* Warehouse */}
//                <div className="sales-return-row-field">
//                  <label className="form-label">Warehouse</label>
//                  <input
//                    className="input"
//                    value={row.warehouse}
//                    onChange={(e) =>
//                      handleRowChange(row.id, "warehouse", e.target.value)
//                    }
//                    placeholder={DEFAULT_WH}
//                  />
//                </div>
//              </div>
//            </div>
//          ))}
//        </div>

//        <div className="sales-return-submit-row">
//          <button
//            type="button"
//            onClick={handleCreateReturn}
//            disabled={creatingReturn || loadingMaster}
//            className="btn btn-primary"
//          >
//            {creatingReturn
//              ? "Creating Return (DN + Invoice)..."
//              : "Create Sales Return"}
//          </button>
//        </div>
//      </div>

//      {/* -------- RECENT RETURNS LIST -------- */}
//      <div className="sales-return-list-section">
//        <div className="sales-return-list-header">
//          <h3 className="sales-return-list-title">Recent Sales Returns</h3>
//        </div>

//        {loadingReturns && (
//          <div className="sales-return-list-loading text-muted">
//            Loading recent returns...
//          </div>
//        )}

//        {!loadingReturns && returns.length === 0 && (
//          <div className="sales-return-list-empty text-muted">
//            No returns found.
//          </div>
//        )}

//        {!loadingReturns && returns.length > 0 && (
//          <div className="sales-return-table-wrapper table-container">
//            <table className="table sales-return-table">
//              <thead>
//                <tr>
//                  <th>Return Name</th>
//                  <th>Customer</th>
//                  <th>Company</th>
//                  <th>Date</th>
//                  <th>Grand Total</th>
//                  <th>Return Against</th>
//                </tr>
//              </thead>
//              <tbody>
//                {returns.map((r) => (
//                  <tr key={r.name}>
//                    <td className="sales-return-name-cell">{r.name}</td>
//                    <td className="sales-return-customer-cell">
//                      {r.customer}
//                    </td>
//                    <td className="sales-return-company-cell">
//                      {r.company}
//                    </td>
//                    <td className="sales-return-date-cell">
//                      {r.posting_date}
//                    </td>
//                    <td className="sales-return-amount-cell">
//                      ₹{" "}
//                      {r.grand_total != null
//                        ? Number(r.grand_total).toFixed(2)
//                        : "0.00"}
//                    </td>
//                    <td>{r.return_against || "-"}</td>
//                  </tr>
//                ))}
//              </tbody>
//            </table>
//          </div>
//        )}
//      </div>
//    </div>
//  );
//}

//export default SalesReturn;


// src/SalesReturn.jsx
import React, { useEffect, useState } from "react";
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
const DAMAGED_WH = "Damaged - MF"; // change if your damaged warehouse name is different

function createEmptyRow(id) {
  return {
    id,
    item_code: "",
    qty: "1.00",
    rate: "0.00",
    quality: "good", // "good" | "damaged"
    warehouse: GOOD_WH, // derived from quality, shown read-only
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

  // Load dropdown data + recent returns
  useEffect(() => {
    async function load() {
      setLoadingMaster(true);
      setError("");
      try {
        const [custData, compData, itemData, recentReturns] =
          await Promise.all([
            getCustomers(),
            getCompanies(),
            getFinishedItemsForSales(),
            getRecentSalesReturns(50),
          ]);

        setCustomers(custData);
        setCompanies(compData);
        setItemsCatalog(itemData);
        setReturns(recentReturns);

        if (custData.length > 0) {
          setCustomer(custData[0].name);
        }
        if (compData.length > 0) {
          setCompany(compData[0].name);
        }
      } catch (err) {
        console.error(err);
        setError(
          err.message || "Failed to load data for Sales Returns"
        );
      } finally {
        setLoadingMaster(false);
      }
    }

    load();
  }, []);

  // ------- Row handlers --------

  function handleRowChange(id, field, value) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;

        const updated = { ...r, [field]: value };

        // If quality changes, auto-set warehouse
        if (field === "quality") {
          updated.warehouse =
            value === "damaged" ? DAMAGED_WH : GOOD_WH;
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
      // Keep at least one blank row
      return filtered.length ? filtered : [createEmptyRow(0)];
    });
  }

  // ------- Create Return (Sales Invoice with stock) --------

  async function handleCreateReturn() {
    setError("");
    setMessage("");

    if (!customer) {
      setError("Please select a Customer.");
      return;
    }
    if (!company) {
      setError("Please select a Company.");
      return;
    }
    if (!postingDate) {
      setError("Please select a Posting Date.");
      return;
    }

    const validRows = rows
      .map((r) => ({
        ...r,
        qtyNum: parseFloat(r.qty),
        rateNum: parseFloat(r.rate),
      }))
      .filter(
        (r) => r.item_code && !isNaN(r.qtyNum) && r.qtyNum > 0
      );

    if (!validRows.length) {
      setError("Add at least one line with item and positive qty.");
      return;
    }

    try {
      setCreatingReturn(true);

      // Build Sales Invoice items
      // NOTE:
      //  - qty is NEGATIVE (credit note / return)
      //  - update_stock = 1, so ERPNext will post SLE
      //  - For returns, SLE actual_qty becomes POSITIVE,
      //    which your DailyStockSummary already interprets
      //    as "good return" when warehouse = Finished Goods - MF.
      const items = validRows.map((r) => {
        const targetWh =
          r.quality === "damaged" ? DAMAGED_WH : GOOD_WH;
        return {
          item_code: r.item_code,
          qty: -r.qtyNum, // negative qty for Sales Return
          rate: isNaN(r.rateNum) ? 0 : r.rateNum,
          warehouse: targetWh,
        };
      });

      const payload = {
        doctype: "Sales Invoice",
        is_return: 1,
        update_stock: 1,
        posting_date: postingDate,
        company,
        customer,
        items,
        remarks:
          "Sales return created from custom screen (good/damaged → respective warehouses).",
      };

      // 1) Create Sales Invoice (draft)
      const siDoc = await createDoc("Sales Invoice", payload);
      const siName =
        siDoc?.data?.name || siDoc?.message?.name || siDoc?.name || "";

      // 2) Submit so that stock ledger & GL entries are posted
      if (siName) {
        await submitDoc("Sales Invoice", siName);
      }

      setMessage(
        `Sales Return created as Sales Invoice: ${
          siName || "draft (no name returned)"
        }.`
      );

      // Reset lines, keep header fields
      setRows([createEmptyRow(0)]);

      // Reload recent returns
      await reloadReturns();
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          "Failed to create Sales Return"
      );
    } finally {
      setCreatingReturn(false);
    }
  }

  async function reloadReturns() {
    try {
      setLoadingReturns(true);
      const rec = await getRecentSalesReturns(50);
      setReturns(rec);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReturns(false);
    }
  }

  return (
    <div className="sales-return">
      {/* Header */}
      <div className="sales-return-header">
        <div className="sales-return-title-block">
          <h2 className="sales-return-title">
            Sales Returns (with Stock Update)
          </h2>
          <p className="sales-return-subtitle">
            Create a Sales Invoice Return that updates stock and classifies
            items as Good or Damaged.
          </p>
        </div>
        <div className="sales-return-header-pill">
          {returns.length} return{returns.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Messages */}
      {loadingMaster && (
        <div className="sales-return-loading text-muted">
          Loading customers, companies & items...
        </div>
      )}
      {error && (
        <div className="alert alert-error sales-return-error">
          {error}
        </div>
      )}
      {message && (
        <div className="alert alert-success sales-return-message">
          {message}
        </div>
      )}

      {/* -------- CREATE RETURN SECTION -------- */}
      <div className="sales-return-card">
        <div className="sales-return-card-header">
          <h3 className="sales-return-card-title">Create Sales Return</h3>
        </div>

        {/* Header fields */}
        <div className="sales-return-form-grid">
          <div className="sales-return-field-group">
            <label className="form-label sales-return-field-label">
              Customer
            </label>
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
            <label className="form-label sales-return-field-label">
              Company
            </label>
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
            <label className="form-label sales-return-field-label">
              Posting Date
            </label>
            <input
              type="date"
              className="input"
              value={postingDate}
              onChange={(e) => setPostingDate(e.target.value)}
            />
          </div>
        </div>

        {/* Line items */}
        <div className="sales-return-items-header">
          <h4 className="sales-return-section-title">Items to Return</h4>
          <button
            type="button"
            onClick={addRow}
            className="btn btn-accent btn-sm"
          >
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
                {/* Item (searchable) */}
                <div className="sales-return-row-field">
                  <label className="form-label">Item</label>
                  <input
                    list={`sales-return-item-list-${row.id}`}
                    value={row.item_code}
                    onChange={(e) =>
                      handleRowChange(row.id, "item_code", e.target.value)
                    }
                    className="input"
                    placeholder="Type or select item code"
                  />
                  <datalist id={`sales-return-item-list-${row.id}`}>
                    {itemsCatalog.map((it) => (
                      <option
                        key={it.name}
                        value={it.name}
                        label={`${it.name} - ${it.item_name || ""}`}
                      />
                    ))}
                  </datalist>
                </div>

                {/* Qty */}
                <div className="sales-return-row-field">
                  <label className="form-label">Qty</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={row.qty}
                    onChange={(e) =>
                      handleRowChange(row.id, "qty", e.target.value)
                    }
                  />
                </div>

                {/* Rate */}
                <div className="sales-return-row-field">
                  <label className="form-label">Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={row.rate}
                    onChange={(e) =>
                      handleRowChange(row.id, "rate", e.target.value)
                    }
                  />
                </div>

                {/* Quality: Good / Damaged */}
                <div className="sales-return-row-field">
                  <label className="form-label">Quality</label>
                  <select
                    className="select"
                    value={row.quality || "good"}
                    onChange={(e) =>
                      handleRowChange(row.id, "quality", e.target.value)
                    }
                  >
                    <option value="good">
                      Good (add to Finished Goods)
                    </option>
                    <option value="damaged">
                      Damaged (add to Damaged warehouse)
                    </option>
                  </select>
                </div>

                {/* Target Warehouse – read-only, derived from quality */}
                <div className="sales-return-row-field">
                  <label className="form-label">
                    Target Warehouse
                  </label>
                  <input
                    className="input"
                    value={row.warehouse}
                    readOnly
                  />
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
            {creatingReturn
              ? "Creating Sales Return..."
              : "Create Sales Return"}
          </button>
        </div>
      </div>

      {/* -------- RECENT RETURNS LIST -------- */}
      <div className="sales-return-list-section">
        <div className="sales-return-list-header">
          <h3 className="sales-return-list-title">
            Recent Sales Returns
          </h3>
        </div>

        {loadingReturns && (
          <div className="sales-return-list-loading text-muted">
            Loading recent returns...
          </div>
        )}

        {!loadingReturns && returns.length === 0 && (
          <div className="sales-return-list-empty text-muted">
            No returns found.
          </div>
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
                    <td className="sales-return-name-cell">
                      {r.name}
                    </td>
                    <td className="sales-return-customer-cell">
                      {r.customer}
                    </td>
                    <td className="sales-return-company-cell">
                      {r.company}
                    </td>
                    <td className="sales-return-date-cell">
                      {r.posting_date}
                    </td>
                    <td className="sales-return-amount-cell">
                      ₹{" "}
                      {r.grand_total != null
                        ? Number(r.grand_total).toFixed(2)
                        : "0.00"}
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

export default SalesReturn;
