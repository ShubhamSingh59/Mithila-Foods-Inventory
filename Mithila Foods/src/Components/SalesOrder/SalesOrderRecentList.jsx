// src/SalesOrderRecentList.jsx
import React from "react";
import "./SalesOrderRecentList.css";

/**
 * SalesOrderRecentList
 * --------------------
 * This component shows the "Recent Sales" table (Submitted + Draft invoices).
 *
 * What it does:
 * 1) Shows a header with a Refresh button
 * 2) Lets user filter the list by Customer
 * 3) Lets user sort by Posting Date (oldest/newest)
 * 4) Shows a table with invoice details
 * 5) Shows actions:
 *    - Draft invoice: "Edit Draft" + "Create Sale Invoice" (submit)
 *    - Submitted invoice: "Mark Paid"
 */
export default function SalesOrderRecentList(props) {
  const {
    // Dropdown data
    customers = [],

    // How many invoices we *intend* to show (your parent decides this)
    listLimit = 10,

    // Loading + reload handler
    loadingInvoices = false,
    reloadRecentInvoices = () => {},

    // Customer filter (value + setter)
    invoiceCustomerFilter = "",
    setInvoiceCustomerFilter = () => {},

    // Invoice lists
    // - recentInvoices: all recent invoices returned by API (before filter)
    // - filteredRecentInvoices: after applying customer filter (before sort)
    filteredRecentInvoices = [],
    recentInvoices = [],

    // Sort label + setter (parent holds "asc/desc")
    postingDateSortLabel = "",
    setPostingDateSort = () => {},

    // Final list to render (already sorted in parent)
    sortedRecentInvoices = [],

    // Row-action state
    payingInvoice = "", // invoice name that is currently being marked paid
    submittingDraft = "", // draft invoice name currently being submitted
    editDraftLoading = "", // draft invoice name currently being loaded for edit
    editingDraftName = "", // which draft is currently open in the form

    // Actions passed from parent
    handleEditDraft = () => {},
    handleSubmitDraft = () => {},
    handleMarkPaid = () => {},
  } = props || {};

  return (
    <div className="sales-panel sales-panel-right">
      {/* ---------------------------
          Header
          --------------------------- */}
      <div className="sales-recent-header">
        <div>
          <h3 className="sales-recent-title">Recent Sales (Last {listLimit})</h3>
          <div className="sales-recent-subtitle">
            Filter by customer • Sort by posting date • Quick actions
          </div>
        </div>

        <div className="sales-recent-header-actions">
          <button
            type="button"
            onClick={() => setPostingDateSort((p) => (p === "asc" ? "desc" : "asc"))}
            disabled={loadingInvoices}
            className="btn btn-outline btn-xs"
            title="Toggle posting date sort"
          >
            {postingDateSortLabel}
          </button>

          <button
            type="button"
            onClick={reloadRecentInvoices}
            disabled={loadingInvoices}
            className="btn btn-secondary btn-sm"
          >
            {loadingInvoices ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* ---------------------------
          Filter row
          --------------------------- */}
      <div className="sales-recent-filter-row">
        <div className="sales-recent-filter">
          <label className="sales-recent-filter-label">Customer</label>
          <select
            className="select"
            value={invoiceCustomerFilter}
            onChange={(e) => setInvoiceCustomerFilter(e.target.value)}
            disabled={loadingInvoices}
          >
            <option value="">All Customers</option>
            {(customers || []).map((c) => (
              <option key={c.name} value={c.name}>
                {c.customer_name || c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sales-recent-count text-muted">
          Showing <b>{(filteredRecentInvoices || []).length}</b> /{" "}
          <b>{(recentInvoices || []).length}</b>
        </div>
      </div>

      {/* ---------------------------
          Empty / Loading states
          --------------------------- */}
      {loadingInvoices && (
        <div className="sales-recent-loading text-muted">Loading recent invoices...</div>
      )}

      {!loadingInvoices && (filteredRecentInvoices || []).length === 0 && (
        <div className="sales-recent-empty text-muted">No recent invoices found.</div>
      )}

      {/* ---------------------------
          Table
          --------------------------- */}
      {!loadingInvoices && (filteredRecentInvoices || []).length > 0 && (
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
              {(sortedRecentInvoices || []).map((inv) => {
                // "Draft" rows are created in parent by adding inv.__isDraft = true
                const isDraft = !!inv.__isDraft;

                // For submitted invoices:
                // - consider paid if status says Paid, OR outstanding is <= 0
                const isPaid =
                  !isDraft && (inv.status === "Paid" || (inv.outstanding_amount || 0) <= 0);

                // Row-level action state
                const isMarking = payingInvoice === inv.name;
                const isSubmitting = submittingDraft === inv.name;
                const isLoadingDraft = editDraftLoading === inv.name;
                const isEditingThis = editingDraftName === inv.name;

                return (
                  <tr key={inv.name}>
                    {/* Invoice name */}
                    <td className="sales-recent-name-cell">
                      {inv.name}{" "}
                      
                    </td>

                    {/* Customer */}
                    <td className="sales-recent-customer-cell">{inv.customer}</td>

                    {/* Date */}
                    <td className="sales-recent-date-cell">{inv.posting_date}</td>

                    {/* Status badge */}
                    <td>
                      <span
                        className={
                          "sales-status-pill " + (isDraft ? "draft" : isPaid ? "paid" : "unpaid")
                        }
                      >
                        {isDraft ? "Draft" : inv.status}
                        {isEditingThis ? <span className="muted-inline">(Editing)</span> : null}
                      </span>
                    </td>

                    {/* Grand total */}
                    <td className="sales-recent-amount-cell">
                      ₹ {inv.grand_total != null ? Number(inv.grand_total).toFixed(2) : "0.00"}
                    </td>

                    {/* Outstanding */}
                    <td className="sales-recent-amount-cell">
                      ₹{" "}
                      {inv.outstanding_amount != null
                        ? Number(inv.outstanding_amount).toFixed(2)
                        : "0.00"}
                    </td>

                    {/* Total qty */}
                    <td className="sales-recent-qty-cell">
                      {inv.total_qty != null ? `${inv.total_qty} ${inv.uom || ""}` : "-"}
                    </td>

                    {/* Actions */}
                    <td className="sales-recent-actions-cell" style={{ textAlign: "right" }}>
                      {isDraft ? (
                        <div className="sales-actions-inline">
                          <button
                            type="button"
                            onClick={() => handleEditDraft(inv.name)}
                            disabled={isLoadingDraft || isSubmitting}
                            className="btn btn-secondary btn-sm"
                          >
                            {isLoadingDraft ? "Loading..." : "Edit Draft"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSubmitDraft(inv.name)}
                            disabled={isSubmitting}
                            className="btn btn-primary btn-sm"
                          >
                            {isSubmitting ? "Submitting..." : "Create Sale Invoice"}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMarkPaid(inv)}
                          disabled={isPaid || isMarking}
                          className="btn btn-secondary btn-sm"
                        >
                          {isPaid ? "Paid" : isMarking ? "Marking..." : "Mark Paid"}
                        </button>
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
  );
}
