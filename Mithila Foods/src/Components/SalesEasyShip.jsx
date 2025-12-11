// src/SalesEasyShip.jsx
import React, { useEffect, useState } from "react";
import {
  getCustomers,
  getFinishedItemsForSales,
  createSalesInvoice,
  submitDoc,
  getRecentSalesInvoices,
  createPaymentEntryForInvoice,
  getSalesInvoiceWithItems,
  getCompanies, // 👈 NEW
} from "./erpBackendApi";
import "../CSS/SalesEasyShip.css";

function SalesEasyShip() {
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [companies, setCompanies] = useState([]); // 👈 NEW

  const [company, setCompany] = useState("");
  const [postingDate, setPostingDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [customer, setCustomer] = useState("");
  const [warehouse, setWarehouse] = useState("Finished Goods - MF"); // default FG warehouse

  const [rows, setRows] = useState([createEmptyRow(0)]);

  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loadingInit, setLoadingInit] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function createEmptyRow(id) {
    return {
      id,
      item_code: "",
      qty: "",
      rate: "",
      rowError: "",
    };
  }

  // -------- load helpers --------

  async function loadInvoices() {
    setLoadingInvoices(true);
    try {
      // get base list of non-return invoices
      const base = await getRecentSalesInvoices(20);

      // enrich each invoice with total_qty + uom from items
      const enriched = [];
      for (const inv of base) {
        try {
          const doc = await getSalesInvoiceWithItems(inv.name);
          const items = doc.items || [];
          let totalQty = 0;
          let uom = "";

          items.forEach((it) => {
            const q = parseFloat(it.qty) || 0;
            totalQty += q;
            if (!uom && it.uom) {
              uom = it.uom;
            }
          });

          enriched.push({
            ...inv,
            total_qty: totalQty,
            uom,
          });
        } catch (err) {
          console.error("Failed to load items for invoice", inv.name, err);
          enriched.push({
            ...inv,
            total_qty: null,
            uom: "",
          });
        }
      }

      setRecentInvoices(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInvoices(false);
    }
  }

  async function reloadRecentInvoices() {
    await loadInvoices();
  }

  // load customers/items/companies + recent invoices once
  useEffect(() => {
    async function loadInit() {
      setLoadingInit(true);
      setError("");
      try {
        const [custData, itemData, companyData] = await Promise.all([
          getCustomers(),
          getFinishedItemsForSales(),
          getCompanies(), // 👈 NEW
        ]);
        setCustomers(custData);
        setItems(itemData);
        setCompanies(companyData || []);

        if (custData.length > 0 && !customer) {
          setCustomer(custData[0].name);
        }

        if (companyData && companyData.length > 0 && !company) {
          setCompany(companyData[0].name); // default company
        }
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load customers / items / companies");
      } finally {
        setLoadingInit(false);
      }
    }

    loadInit();
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------- form handlers --------

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
      setError("Company is required (same as in ERPNext).");
      return;
    }
    if (!postingDate) {
      setError("Posting date is required.");
      return;
    }
    if (!customer) {
      setError("Select a customer.");
      return;
    }
    if (!warehouse) {
      setError("Warehouse is required.");
      return;
    }

    const validRows = rows.filter(
      (r) =>
        r.item_code &&
        !isNaN(parseFloat(r.qty)) &&
        parseFloat(r.qty) > 0
    );

    if (!validRows.length) {
      setError("Add at least one item with quantity.");
      return;
    }

    const itemsPayload = validRows.map((r) => ({
      item_code: r.item_code,
      qty: parseFloat(r.qty),
      rate: r.rate ? parseFloat(r.rate) : undefined,
    }));

    try {
      setSaving(true);

      // 1) create Sales Invoice (draft)
      const doc = await createSalesInvoice({
        customer,
        company,
        posting_date: postingDate,
        warehouse,
        items: itemsPayload,
      });

      const name = doc.data?.name;

      // 2) submit Sales Invoice
      if (name) {
        await submitDoc("Sales Invoice", name);
        setMessage(`Sales Invoice (EasyShip) created and submitted: ${name}`);
      } else {
        setMessage("Sales Invoice created (no name returned).");
      }

      // reset items
      setRows([createEmptyRow(0)]);

      // reload recent invoices
      await reloadRecentInvoices();
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          "Failed to create / submit Sales Invoice"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkPaid(inv) {
    setError("");
    setMessage("");
    setPayingInvoice(inv.name);

    try {
      await createPaymentEntryForInvoice(inv);
      setMessage(`Marked as Paid via Payment Entry: ${inv.name}`);
      await reloadRecentInvoices();
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          "Failed to mark invoice as paid"
      );
    } finally {
      setPayingInvoice("");
    }
  }

  // -------- render --------

  return (
    <div className="sales-easyship">
      {/* Header */}
      <div className="sales-header">
        <div className="sales-title-block">
          <h2 className="sales-title">EasyShip Sales (ERPNext)</h2>
          <p className="sales-subtitle">
            Fast sales invoicing + quick payment marking
          </p>
        </div>
        <div className="sales-header-pill">
          {rows.length} line item{rows.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Messages */}
      {loadingInit && (
        <div className="sales-loading text-muted">
          Loading customers / items...
        </div>
      )}
      {error && (
        <div className="alert alert-error sales-error">
          {error}
        </div>
      )}
      {message && (
        <div className="alert alert-success sales-message">
          {message}
        </div>
      )}

      {/* CREATE SALES INVOICE FORM */}
      <form onSubmit={handleSubmit} className="sales-form">
        {/* Top info grid */}
        <div className="sales-form-grid">
          {/* Company dropdown */}
          <div className="sales-field-group">
            <label
              htmlFor="sales-company"
              className="form-label sales-field-label"
            >
              Company
            </label>
            <select
              id="sales-company"
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

          <div className="sales-field-group">
            <label
              htmlFor="sales-posting-date"
              className="form-label sales-field-label"
            >
              Posting Date
            </label>
            <input
              id="sales-posting-date"
              type="date"
              value={postingDate}
              onChange={(e) => setPostingDate(e.target.value)}
              className="input"
            />
          </div>

          <div className="sales-field-group">
            <label
              htmlFor="sales-customer"
              className="form-label sales-field-label"
            >
              Customer
            </label>
            <select
              id="sales-customer"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              className="select"
            >
              <option value="">-- select customer --</option>
              {customers.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.customer_name || c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sales-field-group">
            <label
              htmlFor="sales-warehouse"
              className="form-label sales-field-label"
            >
              Warehouse (stock goes out from)
            </label>
            <input
              id="sales-warehouse"
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
              placeholder="e.g. Finished Goods - S"
              className="input"
            />
          </div>
        </div>

        {/* Items section */}
        <div className="sales-items-header">
          <h3 className="sales-items-title">
            Items (Finished Goods / Products)
          </h3>
          <button
            type="button"
            onClick={addRow}
            className="btn btn-accent btn-sm"
          >
            + Add Item
          </button>
        </div>

        <div className="sales-items-rows">
          {rows.map((row, index) => {
            const listId = `sales-item-list-${row.id}`; // 👈 unique datalist per row
            return (
              <div key={row.id} className="sales-item-row-card">
                <div className="sales-item-row-header">
                  <span className="sales-item-row-title">
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

                <div className="sales-item-row-grid">
                  <div className="sales-item-field">
                    <label className="form-label">Item</label>
                    {/* Searchable input + datalist */}
                    <input
                      list={listId}
                      value={row.item_code}
                      onChange={(e) =>
                        handleItemChange(row.id, e.target.value)
                      }
                      className="input"
                      placeholder="Type or select item code"
                    />
                    <datalist id={listId}>
                      {items.map((it) => (
                        <option
                          key={it.name}
                          value={it.name}
                          label={`${it.name} - ${it.item_name}`}
                        />
                      ))}
                    </datalist>
                  </div>

                  <div className="sales-item-field">
                    <label className="form-label">Qty</label>
                    <input
                      type="number"
                      value={row.qty}
                      onChange={(e) =>
                        handleRowChange(row.id, "qty", e.target.value)
                      }
                      className="input"
                    />
                  </div>

                  <div className="sales-item-field">
                    <label className="form-label">Rate</label>
                    <input
                      type="number"
                      value={row.rate}
                      onChange={(e) =>
                        handleRowChange(row.id, "rate", e.target.value)
                      }
                      className="input"
                      placeholder="Leave empty to use default logic / price list"
                    />
                  </div>
                </div>

                {row.rowError && (
                  <div className="sales-row-error">
                    {row.rowError}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="sales-submit-row">
          <button
            type="submit"
            disabled={saving || loadingInit}
            className="btn btn-primary"
          >
            {saving ? "Creating..." : "Create EasyShip Sale"}
          </button>
        </div>
      </form>

      {/* RECENT SALES LIST */}
      <div className="sales-recent-section">
        <div className="sales-recent-header">
          <h3 className="sales-recent-title">
            Recent Sales (Submitted Sales Invoices)
          </h3>
          <button
            type="button"
            onClick={reloadRecentInvoices}
            disabled={loadingInvoices}
            className="btn btn-secondary btn-sm"
          >
            {loadingInvoices ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loadingInvoices && (
          <div className="sales-recent-loading text-muted">
            Loading recent invoices...
          </div>
        )}

        {!loadingInvoices && recentInvoices.length === 0 && (
          <div className="sales-recent-empty text-muted">
            No recent invoices found.
          </div>
        )}

        {!loadingInvoices && recentInvoices.length > 0 && (
          <div className="sales-recent-table-wrapper table-container">
            <table className="table sales-recent-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Grand Total</th>
                  <th>Outstanding</th>
                  <th>Total Qty (Unit)</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((inv) => {
                  const isPaid =
                    inv.status === "Paid" ||
                    (inv.outstanding_amount || 0) <= 0;
                  const isMarking = payingInvoice === inv.name;
                  return (
                    <tr key={inv.name}>
                      <td className="sales-recent-name-cell">{inv.name}</td>
                      <td className="sales-recent-customer-cell">
                        {inv.customer}
                      </td>
                      <td className="sales-recent-date-cell">
                        {inv.posting_date}
                      </td>
                      <td>
                        <span
                          className={
                            "sales-status-pill " +
                            (isPaid ? "paid" : "unpaid")
                          }
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="sales-recent-amount-cell">
                        ₹{" "}
                        {inv.grand_total != null
                          ? Number(inv.grand_total).toFixed(2)
                          : "0.00"}
                      </td>
                      <td className="sales-recent-amount-cell">
                        ₹{" "}
                        {inv.outstanding_amount != null
                          ? Number(inv.outstanding_amount).toFixed(2)
                          : "0.00"}
                      </td>
                      <td className="sales-recent-qty-cell">
                        {inv.total_qty != null
                          ? `${inv.total_qty} ${inv.uom || ""}`
                          : "-"}
                      </td>
                      <td className="sales-recent-actions-cell">
                        <button
                          type="button"
                          onClick={() => handleMarkPaid(inv)}
                          disabled={isPaid || isMarking}
                          className="btn btn-secondary btn-sm"
                        >
                          {isPaid
                            ? "Paid"
                            : isMarking
                            ? "Marking..."
                            : "Mark Paid"}
                        </button>
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

export default SalesEasyShip;
