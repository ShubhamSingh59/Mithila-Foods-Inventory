// src/SalesReturnForm.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./SalesReturnForm.css";

export default function SalesReturnForm({
  editingDraftName,
  customers,
  companies,
  brandFilteredItems,
  orgs,
  activeOrg,
  changeOrg,
  getWarehouseForBrand,

  customer,
  setCustomer,
  company,
  setCompany,
  postingDate,
  setPostingDate,

  rows,
  addRow,
  removeRow,
  handleRowChange,

  savingDraft,
  loadingMaster,

  handleCreateOrUpdateDraft,
  cancelEditDraft,
}) {
  return (
    <div className="sales-return-card">
      <div className="sales-return-card-header">
        <div>
          <h3 className="sales-return-card-title">
            {editingDraftName ? `Edit Draft: ${editingDraftName}` : "Create Sales Return"}
          </h3>
          <div className="sales-return-card-subtitle">
            Warehouses are automatic based on Brand and Quality.
          </div>
        </div>
      </div>

      <div className="sales-return-form-grid">
        <div className="sales-return-field-group">
          <label className="form-label sales-return-field-label">Customer</label>
          <select
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="select"
            disabled={loadingMaster || (customers || []).length === 0}
          >
            {(customers || []).map((c) => (
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
            disabled={loadingMaster || (companies || []).length === 0}
          >
            {(companies || []).map((c) => (
              <option key={c.name} value={c.name}>
                {c.company_name || c.name} {c.abbr ? `(${c.abbr})` : ""}
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
            disabled={loadingMaster}
          />
        </div>

        {/* BRAND DROPDOWN */}
        <div className="sales-return-field-group">
          <label className="form-label sales-return-field-label">Brand</label>
          <select
            className="select"
            value={activeOrg}
            onChange={(e) => changeOrg(e.target.value)}
            disabled={loadingMaster}
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <div style={{ fontSize: "11px", marginTop: "4px", color: "#666" }}>
            Good returns route to: <b>{getWarehouseForBrand(activeOrg)}</b>
          </div>
        </div>
      </div>

      <div className="sales-return-items-header">
        <h4 className="sales-return-section-title">Items to Return</h4>
        <button
          type="button"
          onClick={addRow}
          className="btn btn-accent btn-sm"
          disabled={savingDraft || loadingMaster}
        >
          + Add Item
        </button>
      </div>

      <div className="sales-return-rows">
        {(rows || []).map((row, idx) => (
          <div key={row.id} className="sales-return-row-card">
            <div className="sales-return-row-header">
              <span className="sales-return-row-title">
                Line #{idx + 1}
                {row.item_code ? <span className="sales-return-row-code"> · {row.item_code}</span> : null}
              </span>
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="btn btn-ghost btn-sm"
                disabled={savingDraft || loadingMaster}
              >
                Remove
              </button>
            </div>

            <div className="sales-return-row-grid">
              <div className="sales-return-row-field">
                <label className="form-label">Item</label>
                <ItemSearchDropdown
                  items={brandFilteredItems || []}
                  value={row.item_code}
                  onSelect={(code) => handleRowChange(row.id, "item_code", code)}
placeholder={`Search ${activeOrg === "F2D TECH PRIVATE LIMITED" ? "all" : activeOrg} items...`}                  disabled={savingDraft || loadingMaster}
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
                  disabled={savingDraft || loadingMaster}
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
                  disabled={savingDraft || loadingMaster}
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
                  disabled={savingDraft || loadingMaster}
                  onChange={(e) => handleRowChange(row.id, "quality", e.target.value)}
                >
                  <option value="good">Good (Restock to {getWarehouseForBrand(activeOrg)})</option>
                  <option value="damaged">Damaged (Move to Damaged warehouse)</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="sales-return-submit-row">
        <button
          type="button"
          onClick={handleCreateOrUpdateDraft}
          disabled={savingDraft || loadingMaster}
          className="btn btn-primary"
        >
          {savingDraft ? editingDraftName ? "Updating Draft..." : "Creating Draft..." : editingDraftName ? "Update Draft" : "Create Return Draft"}
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
  );
}

function ItemSearchDropdown({ items, value, onSelect, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  const selected = useMemo(() => items.find((x) => x.name === value) || null, [items, value]);

  const filtered = useMemo(() => {
    const s = (q || "").trim().toLowerCase();
    const base = !s ? items : items.filter((it) => {
      const code = (it.name || "").toLowerCase();
      const name = (it.item_name || "").toLowerCase();
      const uom = (it.stock_uom || "").toLowerCase();
      return code.includes(s) || name.includes(s) || uom.includes(s);
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
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
      >
        <div className="stdrop-value">
          {selected ? (
            <>
              <div className="stdrop-title">{selected.name}</div>
              <div className="stdrop-sub">
                {(selected.item_name || "") + (selected.stock_uom ? ` · ${selected.stock_uom}` : "")}
              </div>
            </>
          ) : (
            <div className="stdrop-placeholder">{placeholder}</div>
          )}
        </div>
        <div className="stdrop-actions" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {!!value && !disabled && (
            <span
              className="stdrop-clear"
              role="button"
              tabIndex={0}
              title="Clear"
              onClick={(e) => {
                e.stopPropagation();
                onSelect("");
                setOpen(false);
                setQ("");
              }}
              style={{ fontSize: "14px", color: "#999", cursor: "pointer" }}
            >
              ✕
            </span>
          )}
          <div className="stdrop-caret">▾</div>
        </div>
      </button>

      {
        open && !disabled && (
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
                    {(it.item_name || "") + (it.stock_uom ? ` · ${it.stock_uom}` : "")}
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
        )
      }
    </div >
  );
}