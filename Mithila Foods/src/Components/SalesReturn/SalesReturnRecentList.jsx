// src/SalesReturnRecentList.jsx
import React from "react";
import "./SalesReturnRecentList.css";

export default function SalesReturnRecentList({
  listLimit,
  customers = [],
  orgs = [],
  activeOrg,
  changeOrg,
  //listBrandFilter,
  //setListBrandFilter,

  invoiceCustomerFilter,
  setInvoiceCustomerFilter,

  postingDateSortLabel,
  setPostingDateSort,
  reloadReturns,
  loadingReturns,
  displayReturns,
  sortedDisplayReturns,
  visibleTotalQty,
  qtyByReturnName,
  submittingDraft,
  editDraftLoading,
  editingDraftName,
  handleEditDraft,
  handleSubmitDraftReturn,
}) {
  return (
    <div className="sales-return-list-section">
      <div className="sales-return-list-header">
        <div className="sales-return-list-header-left">
          <h3 className="sales-return-list-title">Recent Sales Returns</h3>
          <div className="sales-return-list-subtitle">
            Showing latest {listLimit} • Total Qty (visible):{" "}
            <b>{Number(visibleTotalQty || 0).toFixed(2)}</b>
          </div>
        </div>

        <div className="sales-return-list-header-right">
          <button
            type="button"
            className="btn btn-outline btn-xs"
            onClick={() => setPostingDateSort((p) => (p === "asc" ? "desc" : "asc"))}
            disabled={loadingReturns}
            title="Toggle sorting by posting date"
          >
            {postingDateSortLabel}
          </button>
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

      {/* FILTERS ROW */}
      <div className="sales-return-filter-row" style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "center" }}>

        <div className="sales-recent-filter">
          <label className="sales-recent-filter-label" style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "4px" }}>Customer</label>
          <select
            className="select"
            value={invoiceCustomerFilter}
            onChange={(e) => setInvoiceCustomerFilter(e.target.value)}
            disabled={loadingReturns}
          >
            <option value="">All Customers</option>
            {(customers || []).map((c) => (
              <option key={c.name} value={c.name}>
                {c.customer_name || c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sales-recent-filter">
          <label className="sales-recent-filter-label" style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "4px" }}>Brand</label>
          <select
            className="select"
            value={activeOrg || "F2D TECH PRIVATE LIMITED"}
            onChange={(e) => changeOrg(e.target.value)}
            disabled={loadingReturns}
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

      </div>

      {loadingReturns && (
        <div className="sales-return-list-loading text-muted">Loading recent returns...</div>
      )}

      {!loadingReturns && (displayReturns || []).length === 0 && (
        <div className="sales-return-list-empty text-muted">No returns found.</div>
      )}

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
                const isDraft = !!r.__isDraft;
                const isSubmitting = submittingDraft === r.name;
                const isEditingThis = editingDraftName === r.name;
                const isEditLoadingThis = editDraftLoading === r.name;

                const q = qtyByReturnName?.[r.name]?.totalQty;
                const uomLabel = qtyByReturnName?.[r.name]?.uomLabel;

                return (
                  <tr key={r.name}>
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
                    <td className="sales-return-amount-cell">
                      ₹ {r.grand_total != null ? Number(r.grand_total).toFixed(2) : "0.00"}
                    </td>
                    <td className="sales-return-action-cell">
                      {isDraft ? (
                        <div className="sales-return-actions">
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            disabled={isEditLoadingThis || isSubmitting}
                            onClick={() => handleEditDraft(r.name)}
                            title="Load this draft to edit"
                          >
                            {isEditLoadingThis ? "Loading..." : "Edit Draft"}
                          </button>
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