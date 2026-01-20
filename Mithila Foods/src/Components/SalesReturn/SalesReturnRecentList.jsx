// src/SalesReturnRecentList.jsx
import React from "react";
import "./SalesReturnRecentList.css";

/**
 * SalesReturnRecentList
 * ---------------------
 * This is a PURE UI component (no API calls inside).
 *
 * What it shows:
 * - A header with:
 *   - Total visible quantity
 *   - Sort toggle (posting date asc/desc)
 *   - Refresh button
 * - A table with recent Sales Return invoices
 * - For Draft returns:
 *   - "Edit Draft"
 *   - "Create Sales Return" (submit draft)
 *
 * All actions/data are passed from the parent via props.
 */

export default function SalesReturnRecentList({
  // how many rows we show (example: 30)
  listLimit,

  // label displayed on the sort toggle button
  postingDateSortLabel,

  // function from parent: toggles sort state (asc/desc)
  setPostingDateSort,

  // function from parent: re-fetches returns list
  reloadReturns,

  // parent loading state while fetching returns
  loadingReturns,

  // raw list used for "empty" checks (parent can pass filtered list)
  displayReturns,

  // list actually rendered in the table (already sorted by parent)
  sortedDisplayReturns,

  // total qty for visible rows (computed in parent)
  visibleTotalQty,

  // map: returnName -> { totalQty, uomLabel }
  qtyByReturnName,

  // when a draft is being submitted: equals return name
  submittingDraft,

  // when a draft is being loaded for editing: equals return name
  editDraftLoading,

  // currently opened/active draft in editor (name)
  editingDraftName,

  // parent handler: load draft into editor
  handleEditDraft,

  // parent handler: submit draft return (create final sales return)
  handleSubmitDraftReturn,
}) {
  return (
    <div className="sales-return-list-section">
      {/* =========================
          Header: title + controls
         ========================= */}
      <div className="sales-return-list-header">
        <div className="sales-return-list-header-left">
          <h3 className="sales-return-list-title">Recent Sales Returns</h3>

          {/* Helper line: list limit + visible totals */}
          <div className="sales-return-list-subtitle">
            Showing latest {listLimit} • Total Qty (visible):{" "}
            <b>{Number(visibleTotalQty || 0).toFixed(2)}</b>
          </div>
        </div>

        <div className="sales-return-list-header-right">
          {/* Toggle sort (asc/desc) */}
          <button
            type="button"
            className="btn btn-outline btn-xs"
            onClick={() => setPostingDateSort((p) => (p === "asc" ? "desc" : "asc"))}
            disabled={loadingReturns}
            title="Toggle sorting by posting date"
          >
            {postingDateSortLabel}
          </button>

          {/* Reload list from server */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={reloadReturns}
            disabled={loadingReturns}
            title="Reload recent returns"
          >
            {loadingReturns ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* =========================
          Loading / Empty states
         ========================= */}
      {loadingReturns && (
        <div className="sales-return-list-loading text-muted">Loading recent returns...</div>
      )}

      {!loadingReturns && (displayReturns || []).length === 0 && (
        <div className="sales-return-list-empty text-muted">No returns found.</div>
      )}

      {/* =========================
          Table (only when rows exist)
         ========================= */}
      {!loadingReturns && (displayReturns || []).length > 0 && (
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
              {(sortedDisplayReturns || []).map((r) => {
                // Draft flag (parent adds __isDraft)
                const isDraft = !!r.__isDraft;

                // For button loading states:
                const isSubmitting = submittingDraft === r.name;
                const isEditingThis = editingDraftName === r.name;
                const isEditLoadingThis = editDraftLoading === r.name;

                // Qty summary for the return (computed in parent)
                const q = qtyByReturnName?.[r.name]?.totalQty;
                const uomLabel = qtyByReturnName?.[r.name]?.uomLabel;

                return (
                  <tr key={r.name}>
                    {/* Return name column */}
                    <td className="sales-return-name-cell">
                      {r.name}{" "}
                      {isDraft ? <span className="sales-return-pill">(Draft)</span> : null}
                      {isEditingThis ? (
                        <span className="sales-return-pill sales-return-pill-muted">(Editing)</span>
                      ) : null}
                    </td>

                    <td className="sales-return-customer-cell">{r.customer}</td>
                    <td className="sales-return-company-cell">{r.company}</td>
                    <td className="sales-return-date-cell">{r.posting_date}</td>

                    {/* Total Qty column */}
                    <td className="sales-return-qty-cell">
                      {Number.isFinite(q) ? (
                        <>
                          {Number(q).toFixed(2)}{" "}
                          {uomLabel ? <span className="sales-return-qty-uom">({uomLabel})</span> : null}
                        </>
                      ) : (
                        "-"
                      )}
                    </td>

                    {/* Grand total column */}
                    <td className="sales-return-amount-cell">
                      ₹ {r.grand_total != null ? Number(r.grand_total).toFixed(2) : "0.00"}
                    </td>

                    {/* Action column */}
                    <td className="sales-return-action-cell">
                      {isDraft ? (
                        <div className="sales-return-actions">
                          {/* Edit draft: loads draft into form */}
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            disabled={isEditLoadingThis || isSubmitting}
                            onClick={() => handleEditDraft(r.name)}
                            title="Load this draft to edit"
                          >
                            {isEditLoadingThis ? "Loading..." : "Edit Draft"}
                          </button>

                          {/* Submit draft: creates final return */}
                          <button
                            type="button"
                            className="btn btn-accent btn-xs"
                            disabled={isSubmitting}
                            onClick={() => handleSubmitDraftReturn(r.name)}
                            title="Submit this draft return"
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
  );
}
