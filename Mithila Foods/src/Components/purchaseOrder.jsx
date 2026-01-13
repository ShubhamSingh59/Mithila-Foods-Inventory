// src/PurchaseOrder.jsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  getSuppliers,
  getItemsForPO,
  createPurchaseOrder,
  submitDoc,
  sendPurchaseOrderEmail,
  getPurchaseOrderPdfUrl,
  getPurchaseOrderWithItems,
  updatePurchaseOrder,
  getItemSuppliers,
  deletePurchaseOrder,
} from "./erpBackendApi";
import PurchaseOrderList from "./PurchaseOrderList";
import "../CSS/PurchaseOrder.css";

function PurchaseOrder() {
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [itemSuppliers, setItemSuppliers] = useState([]);

  // supplier = what user sees (supplier_name), not the ID
  const [supplier, setSupplier] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");

  // ✅ MULTI ITEMS
  const [poItems, setPoItems] = useState([
    { item_code: "", qty: "1.00", rate: "0.00" },
  ]);

  const [warehouse, setWarehouse] = useState("Raw Material - MF");
  const [notes, setNotes] = useState("");

  const todayStr = new Date().toISOString().slice(0, 10);
  const [poDate, setPoDate] = useState(todayStr);
  const [receivedByDate, setReceivedByDate] = useState(todayStr);

  const [lastPoName, setLastPoName] = useState("");
  const [editingPoName, setEditingPoName] = useState("");

  const [loadingLists, setLoadingLists] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittingPo, setSubmittingPo] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [deletingDraft, setDeletingDraft] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const params = new URLSearchParams(window.location.search);
  const qpItemCode = params.get("itemCode");
  const qpWarehouse = params.get("warehouse");
  const qpQty = params.get("qty");

  const [orderTime, setOrderTime] = useState("");
  const [draftWarningSent, setDraftWarningSent] = useState(false);
  const [draftWarningSentOn, setDraftWarningSentOn] = useState("");
  const [mfStatus, setMfStatus] = useState("");
  const [mfStatusUpdatedOn, setMfStatusUpdatedOn] = useState("");
  const [mfStockPercent, setMfStockPercent] = useState("");

  // ---------------- Load suppliers, items, and Item Supplier mapping -------------
  useEffect(() => {
    async function loadLists() {
      try {
        setLoadingLists(true);
        setError("");

        const [suppliersData, itemsData, itemSupData] = await Promise.all([
          getSuppliers(),
          getItemsForPO(),
          getItemSuppliers(),
        ]);

        setSuppliers(suppliersData || []);
        setItems(itemsData || []);
        setItemSuppliers(itemSupData || []);

        setSupplier("");
        setSupplierEmail("");

        const initQty = qpQty || "1.00";
        setPoItems([{ item_code: "", qty: initQty, rate: "0.00" }]);

        if (qpWarehouse) setWarehouse(qpWarehouse);
      } catch (err) {
        console.error(err);
        setError("Failed to load suppliers/items");
      } finally {
        setLoadingLists(false);
      }
    }

    loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------- Helper: currently selected supplier row & ID ----------------
  const selectedSupplierRow = useMemo(
    () =>
      suppliers.find(
        (s) => s.supplier_name === supplier || s.name === supplier
      ),
    [suppliers, supplier]
  );
  const selectedSupplierId = selectedSupplierRow?.name || "";

  // -------- Build mapping: supplier -> item_codes ----------------
  const supplierToItemNames = useMemo(() => {
    const map = new Map();
    for (const row of itemSuppliers) {
      const sup = row.supplier;
      const item = row.parent;
      if (!sup || !item) continue;
      if (!map.has(sup)) map.set(sup, new Set());
      map.get(sup).add(item);
    }
    return map;
  }, [itemSuppliers]);

  // -------- Build mapping: item_code -> supplierIds ----------------
  const itemToSupplierNames = useMemo(() => {
    const map = new Map();
    for (const row of itemSuppliers) {
      const sup = row.supplier;
      const item = row.parent;
      if (!sup || !item) continue;
      if (!map.has(item)) map.set(item, new Set());
      map.get(item).add(sup);
    }
    return map;
  }, [itemSuppliers]);

  // -------- Items filtered by currently selected supplier -----------
  const itemsForCurrentSupplier = useMemo(() => {
    if (!selectedSupplierId) return items;

    const allowedItemsSet = supplierToItemNames.get(selectedSupplierId);
    if (!allowedItemsSet || !allowedItemsSet.size) return items;

    const filtered = items.filter((it) => allowedItemsSet.has(it.name));
    return filtered.length ? filtered : items;
  }, [items, supplierToItemNames, selectedSupplierId]);

  // ✅ Suppliers filtered by ALL selected items (intersection)
  const suppliersForSelectedItems = useMemo(() => {
    const codes = poItems.map((r) => r.item_code).filter(Boolean);
    if (!codes.length) return suppliers;

    let allowed = null;

    for (const code of codes) {
      const set = itemToSupplierNames.get(code);

      // if no mapping for an item, don't restrict
      if (!set || !set.size) return suppliers;

      if (allowed === null) {
        allowed = new Set(set);
      } else {
        allowed = new Set([...allowed].filter((x) => set.has(x)));
        if (!allowed.size) break;
      }
    }

    if (!allowed || !allowed.size) return suppliers;

    const filtered = suppliers.filter((s) => allowed.has(s.name));
    return filtered.length ? filtered : suppliers;
  }, [suppliers, itemToSupplierNames, poItems]);

  // ✅ Ensure currently selected supplier remains visible in dropdown
  const supplierOptions = useMemo(() => {
    if (!supplier) return suppliersForSelectedItems;

    const hasSelected = suppliersForSelectedItems.some(
      (s) => (s.supplier_name || s.name) === supplier || s.name === supplier
    );
    if (hasSelected) return suppliersForSelectedItems;

    const selectedRow = suppliers.find(
      (s) => (s.supplier_name || s.name) === supplier || s.name === supplier
    );
    return selectedRow
      ? [selectedRow, ...suppliersForSelectedItems]
      : suppliersForSelectedItems;
  }, [suppliersForSelectedItems, suppliers, supplier]);

  // ✅ Supplier select
  //function handleSupplierValueChange(displayValue, supplierObj = null) {
  //  setSupplier(displayValue);

  //  const s =
  //    supplierObj ||
  //    suppliers.find(
  //      (sup) => sup.supplier_name === displayValue || sup.name === displayValue
  //    );

  //  if (s) setSupplierEmail(s.supplier_email || s.email_id || "");
  //  else setSupplierEmail("");
  //}

  function handleSupplierValueChange(displayValue, supplierObj = null) {
    setSupplier(displayValue);

    const s =
      supplierObj ||
      suppliers.find(
        (sup) => sup.supplier_name === displayValue || sup.name === displayValue
      );

    if (s) setSupplierEmail(s.supplier_email || s.email_id || "");
    else setSupplierEmail("");

    // ✅ If supplier selected, clear ONLY those item rows that are not supplied by this supplier
    const supplierId = s?.name || "";
    if (!supplierId) return;

    const allowedItemsSet = supplierToItemNames.get(supplierId);

    // If mapping missing/empty -> don't force-clear (same behavior as your filtering logic)
    if (!allowedItemsSet || !allowedItemsSet.size) return;

    setPoItems((prev) =>
      prev.map((row) => {
        if (!row.item_code) return row;
        if (allowedItemsSet.has(row.item_code)) return row;
        return { ...row, item_code: "" }; // ✅ clear only invalid item
      })
    );
  }


  // ✅ MULTI ITEMS helpers
  function updatePoItem(idx, patch) {
    setPoItems((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    );
  }

  function addPoItem() {
    setPoItems((prev) => [
      ...prev,
      { item_code: "", qty: "1.00", rate: "0.00" },
    ]);
  }

  function removePoItem(idx) {
    setPoItems((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? next : [{ item_code: "", qty: "1.00", rate: "0.00" }];
    });
  }

  //function handleItemValueChange(idx, code) {
  //  updatePoItem(idx, { item_code: code });
  //}

  function handleItemValueChange(idx, code) {
    // compute next items list (so we can validate with latest selection)
    const nextPoItems = poItems.map((r, i) =>
      i === idx ? { ...r, item_code: code } : r
    );

    setPoItems(nextPoItems);

    // ✅ If supplier is selected, verify it still supplies ALL selected items.
    if (!selectedSupplierId) return;

    const codes = nextPoItems.map((r) => r.item_code).filter(Boolean);
    if (!codes.length) return;

    let allowed = null;

    for (const c of codes) {
      const set = itemToSupplierNames.get(c);

      // If item has no mapping -> do NOT restrict / do NOT clear supplier (matches your existing logic)
      if (!set || !set.size) return;

      if (allowed === null) allowed = new Set(set);
      else allowed = new Set([...allowed].filter((x) => set.has(x)));
    }

    // if selected supplier is not in allowed intersection -> clear supplier
    if (!allowed || !allowed.has(selectedSupplierId)) {
      setSupplier("");
      setSupplierEmail("");
    }
  }

  // keep selected item visible even if supplier filtering changes
  function getItemOptionsIncludingSelected(selectedCode) {
    if (!selectedCode) return itemsForCurrentSupplier;
    if (itemsForCurrentSupplier.some((it) => it.name === selectedCode))
      return itemsForCurrentSupplier;
    const found = items.find((it) => it.name === selectedCode);
    return found ? [found, ...itemsForCurrentSupplier] : itemsForCurrentSupplier;
  }

  // -------------------- Load existing draft PO for editing --------------------
  async function handleEditPo(poName) {
    try {
      setError("");
      setMessage(`Loading draft Purchase Order ${poName} for editing...`);
      const po = await getPurchaseOrderWithItems(poName);

      const firstItem = (po.items || [])[0] || {};

      const supRow = suppliers.find((s) => s.name === po.supplier);
      const displaySupplier = supRow?.supplier_name || po.supplier;

      setSupplier(displaySupplier);
      setSupplierEmail(supRow?.supplier_email || supRow?.email_id || "");

      const mapped = (po.items || []).map((it) => ({
        item_code: it.item_code || "",
        qty: it.qty != null ? String(it.qty) : "1.00",
        rate: it.rate != null ? String(it.rate) : "0.00",
      }));
      setPoItems(
        mapped.length ? mapped : [{ item_code: "", qty: "1.00", rate: "0.00" }]
      );

      setWarehouse(firstItem.warehouse || "Raw Material - MF");
      setNotes(po.notes || "");

      setPoDate(po.transaction_date || todayStr);
      setReceivedByDate(
        firstItem.schedule_date ||
        po.schedule_date ||
        po.transaction_date ||
        todayStr
      );

      setEditingPoName(po.name);
      setLastPoName(po.name);
      setMessage(`Editing draft Purchase Order ${poName}.`);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error?.message ||
        err.message ||
        "Failed to load Purchase Order for editing"
      );
    }
  }

  // -------------------- Create / save draft --------------------
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    const normalizedItems = poItems
      .map((row) => {
        const code = (row.item_code || "").trim();
        const q = parseFloat(row.qty);
        const r = parseFloat(row.rate);

        return {
          item_code: code,
          qty: isNaN(q) ? 0 : q,
          rate: isNaN(r) ? 0 : r,
        };
      })
      .filter((x) => x.item_code && x.qty > 0);

    if (!supplier || normalizedItems.length === 0) {
      setError(
        "Please select supplier and add at least one valid item with quantity."
      );
      return;
    }
    if (!poDate) return setError("Please select Purchase Order Date.");
    if (!receivedByDate) return setError("Please select Received By date.");

    const selectedSupplier = suppliers.find(
      (s) => s.supplier_name === supplier || s.name === supplier
    );
    if (!selectedSupplier) {
      setError("Please select a valid supplier from the list.");
      return;
    }
    const supplierId = selectedSupplier.name;

    try {
      setSubmitting(true);

      if (editingPoName) {
        const payload = {
          supplier: supplierId,
          transaction_date: poDate,
          schedule_date: receivedByDate,
          notes: notes || "",
          items: normalizedItems.map((it) => ({
            item_code: it.item_code,
            qty: it.qty,
            rate: it.rate,
            schedule_date: receivedByDate,
            warehouse: warehouse || undefined,
          })),
        };

        await updatePurchaseOrder(editingPoName, payload);
        setLastPoName(editingPoName);
        setMessage(
          `Purchase Order ${editingPoName} saved as draft. (${normalizedItems.length} items)`
        );
      } else {
        // create with first item (backend helper currently supports single item)
        const first = normalizedItems[0];

        const po = await createPurchaseOrder({
          supplier: supplierId,
          item_code: first.item_code,
          qty: first.qty,
          rate: first.rate,
          notes,
          warehouse,
          po_date: poDate,
          schedule_date: receivedByDate,
        });

        const poName = po.data?.name;

        // if more items, update draft with full items list
        if (poName && normalizedItems.length > 1) {
          const payload = {
            supplier: supplierId,
            transaction_date: poDate,
            schedule_date: receivedByDate,
            notes: notes || "",
            items: normalizedItems.map((it) => ({
              item_code: it.item_code,
              qty: it.qty,
              rate: it.rate,
              schedule_date: receivedByDate,
              warehouse: warehouse || undefined,
            })),
          };

          await updatePurchaseOrder(poName, payload);
        }

        setLastPoName(poName || "");
        setEditingPoName(poName || "");
        setMessage(
          poName
            ? `Purchase Order created as draft: ${poName} (${normalizedItems.length} items)`
            : "Purchase Order created (draft)"
        );
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error?.message ||
        err.message ||
        "Failed to create/update Purchase Order"
      );
    } finally {
      setSubmitting(false);
    }
  }

  // -------------------- Submit PO --------------------
  async function handleSubmitPo() {
    setError("");
    setMessage("");

    const poName = editingPoName || lastPoName;
    if (!poName) return setError("No draft Purchase Order selected to submit.");

    try {
      setSubmittingPo(true);
      await submitDoc("Purchase Order", poName);
      setMessage(`Purchase Order submitted: ${poName}`);
      setEditingPoName("");
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error?.message ||
        err.message ||
        "Failed to submit Purchase Order"
      );
    } finally {
      setSubmittingPo(false);
    }
  }

  // -------------------- Delete draft PO --------------------
  async function handleDeleteDraftPo() {
    setError("");
    setMessage("");

    const poName = editingPoName;
    if (!poName) return setError("No draft Purchase Order selected to delete.");

    try {
      setDeletingDraft(true);
      await deletePurchaseOrder(poName);
      setMessage(`Draft Purchase Order deleted: ${poName}`);
      setEditingPoName("");
      setLastPoName("");
    } catch (err) {
      console.error("Delete draft PO error:", err);
      setError(
        err.response?.data?.error?.message ||
        err.message ||
        "Failed to delete draft Purchase Order"
      );
    } finally {
      setDeletingDraft(false);
    }
  }

  // -------------------- Email supplier --------------------
  async function handleEmailSupplier() {
    if (!lastPoName) return setError("No Purchase Order to email yet.");
    if (!supplierEmail)
      return setError("Please enter supplier email address first.");

    setError("");
    setMessage("");
    setEmailSending(true);

    try {
      await sendPurchaseOrderEmail({
        poName: lastPoName,
        recipients: supplierEmail,
      });
      setMessage(`Email sent to ${supplierEmail} for PO ${lastPoName}.`);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error?.message ||
        err.message ||
        "Failed to send email"
      );
    } finally {
      setEmailSending(false);
    }
  }

  return (
    <div className="po-page">
      <div className="po-card po-card-main">
        <div className="po-header">
          <div>
            <h1 className="po-title">Purchase Order (Raw Material)</h1>
            <p className="po-subtitle">
              Create ERPNext Purchase Orders for raw materials.
            </p>
          </div>
          {lastPoName && (
            <div className="po-header-chip">
              {editingPoName ? "Editing draft" : "Last PO"}:{" "}
              <span>{lastPoName}</span>
            </div>
          )}
        </div>

        {loadingLists && (
          <p className="po-info-text">Loading suppliers/items...</p>
        )}
        {error && <p className="po-error-text">{error}</p>}
        {message && <p className="po-message-text">{message}</p>}

        <form onSubmit={handleSubmit} className="po-form-grid">
          {/* Left column */}
          <div className="po-form-column">
            <div className="po-field">
              <label className="po-label">Supplier</label>

              <SupplierSearchDropdown
                suppliers={supplierOptions}
                value={supplier}
                onSelect={(displayValue, obj) =>
                  handleSupplierValueChange(displayValue, obj)
                }
                placeholder="Search supplier..."
                disabled={loadingLists || suppliers.length === 0}
              />
            </div>

            <div className="po-field">
              <label className="po-label">
                Supplier Email <span className="po-label-hint">(optional)</span>
              </label>
              <input
                type="email"
                value={supplierEmail}
                onChange={(e) => setSupplierEmail(e.target.value)}
                placeholder="supplier@example.com"
                className="po-input"
              />
            </div>

            <div className="po-field">
              <label className="po-label">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="po-input po-textarea"
              />
            </div>
          </div>

          {/* Right column */}
          <div className="po-form-column">
            <div className="po-field">
              <label className="po-label">Items (multiple allowed)</label>

              {poItems.map((row, idx) => (
                <div key={idx} style={{ marginBottom: 12 }}>
                  <POItemSearchDropdown
                    items={getItemOptionsIncludingSelected(row.item_code)}
                    value={row.item_code}
                    onSelect={(code) => handleItemValueChange(idx, code)}
                    placeholder={`Search item (row ${idx + 1})...`}
                    disabled={loadingLists || items.length === 0}
                  />

                  <div
                    className="po-field po-field-inline"
                    style={{ marginTop: 8 }}
                  >
                    <div>
                      <label className="po-label">Quantity</label>
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        value={row.qty}
                        onChange={(e) => {
                          const value = e.target.value;

                          // allow empty while typing
                          if (value === "") {
                            updatePoItem(idx, { qty: "" });
                            return;
                          }

                          const num = Number(value);

                          if (num < 0) {
                            // ❌ do not update value if negative
                            return;
                          }
                          updatePoItem(idx, { qty: e.target.value })

                        }
                        }
                        className={`po-input ${row.qty < 0 ? "po-input-error" : ""}`}
                      />
                    </div>

                    <div>
                      <label className="po-label">Rate (per unit)</label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={row.rate}
                        onChange={(e) => {
                          const value = e.target.value;

                          // allow empty while typing
                          if (value === "") {
                            updatePoItem(idx, { rate: "" });
                            return;
                          }

                          const num = Number(value);

                          // block negative values
                          if (num < 0) {
                            return;
                          }

                          updatePoItem(idx, { rate: num });
                        }}
                        className={`po-input ${Number(row.rate) < 0 ? "po-input-error" : ""}`}
                      />
                    </div>


                    <div style={{ display: "flex", alignItems: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => removePoItem(idx)}
                        disabled={loadingLists || poItems.length === 1}
                        className="po-btn po-btn-outline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addPoItem}
                disabled={loadingLists}
                className="po-btn po-btn-outline"
              >
                + Add another item
              </button>
            </div>

            <div className="po-field po-field-inline">
              <div>
                <label className="po-label">Purchase Order Date</label>
                <input
                  type="date"
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                  className="po-input"
                />
              </div>
              <div>
                <label className="po-label">Received By (Schedule Date)</label>
                <input
                  type="date"
                  value={receivedByDate}
                  onChange={(e) => setReceivedByDate(e.target.value)}
                  className="po-input"
                />
              </div>
            </div>

            {/*<div className="po-field">
              <label className="po-label">Warehouse</label>
              <input
                type="text"
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
                placeholder="Raw Material - MF"
                className="po-input"
              />
            </div>*/}

            <div className="po-actions-main">
              <button
                type="submit"
                disabled={submitting || loadingLists}
                className="po-btn po-btn-primary"
              >
                {submitting
                  ? editingPoName
                    ? "Saving Draft..."
                    : "Creating Draft..."
                  : editingPoName
                    ? "Save Draft"
                    : "Create Draft"}
              </button>

              <button
                type="button"
                onClick={() => {
                  const poName = editingPoName || lastPoName;
                  if (!poName) {
                    setError("No draft Purchase Order selected to submit.");
                    return;
                  }

                  const ok = window.confirm(
                    `You are about to SUBMIT Purchase Order: ${poName}.\n\nOnce submitted, you may not be able to edit it as a draft.\n\nSubmit now?`
                  );
                  if (!ok) return;

                  handleSubmitPo();
                }}
                disabled={submittingPo || loadingLists}
                className="po-btn po-btn-outline"
              >
                {submittingPo ? "Submitting..." : "Submit Purchase Order"}
              </button>


              <button
                type="button"
                onClick={handleDeleteDraftPo}
                disabled={deletingDraft || loadingLists || !editingPoName}
                className="po-btn po-btn-outline po-btn-danger"
              >
                {deletingDraft ? "Deleting..." : "Delete Draft PO"}
              </button>

            </div>
          </div>
        </form>

        {lastPoName && (
          <div className="po-after-actions">
            <button
              type="button"
              onClick={handleEmailSupplier}
              disabled={emailSending || !supplierEmail}
              className="po-btn po-btn-accent"
            >
              {emailSending ? "Sending email..." : "Email Supplier"}
            </button>

            <a
              href={getPurchaseOrderPdfUrl(lastPoName)}
              target="_blank"
              rel="noreferrer"
            >
              <button type="button" className="po-btn po-btn-outline">
                Download PDF
              </button>
            </a>
          </div>
        )}
      </div>

      <div className="po-card po-card-list">
        <PurchaseOrderList onEditPo={handleEditPo} />
      </div>
    </div>
  );
}

/** Supplier dropdown */
function SupplierSearchDropdown({
  suppliers,
  value,
  onSelect,
  placeholder,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  const selected = useMemo(() => {
    return suppliers.find((x) => (x.supplier_name || x.name) === value) || null;
  }, [suppliers, value]);

  const filtered = useMemo(() => {
    const s = (q || "").trim().toLowerCase();
    const base = !s
      ? suppliers
      : suppliers.filter((sup) => {
        const code = (sup.name || "").toLowerCase();
        const display = (sup.supplier_name || "").toLowerCase();
        const email = (sup.supplier_email || sup.email_id || "").toLowerCase();
        return code.includes(s) || display.includes(s) || email.includes(s);
      });

    return base.slice(0, 80);
  }, [suppliers, q]);

  useEffect(() => {
    function onDown(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const clearSelection = (e) => {
    e?.stopPropagation?.();
    if (disabled) return;
    onSelect("", null);     // ✅ clear supplier
    setOpen(false);
    setQ("");
  };

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
              <div className="stdrop-title">
                {selected.supplier_name || selected.name}
              </div>
              <div className="stdrop-sub">
                {selected.name}
                {selected.supplier_email || selected.email_id
                  ? ` · ${selected.supplier_email || selected.email_id}`
                  : ""}
              </div>
            </>
          ) : (
            <div className="stdrop-placeholder">{placeholder}</div>
          )}
        </div>

        {/* ✅ Right-side actions: clear + caret (no nested buttons) */}
        <div className="stdrop-actions">
          {!!value && !disabled && (
            <span
              className="stdrop-clear"
              role="button"
              tabIndex={0}
              title="Clear"
              onClick={clearSelection}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && clearSelection(e)}
            >
              ✕
            </span>
          )}
          <div className="stdrop-caret">▾</div>
        </div>
      </button>

      {open && !disabled && (
        <div className="stdrop-popover">
          <div className="stdrop-search">
            <input
              autoFocus
              className="po-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type to search..."
            />
          </div>

          <div className="stdrop-list">
            {/* ✅ Clear option in list */}
            {!!value && (
              <button
                type="button"
                className="stdrop-item stdrop-item-clear"
                onClick={() => {
                  onSelect("", null);
                  setOpen(false);
                  setQ("");
                }}
              >
                <div className="stdrop-item-title">Clear selection</div>
              </button>
            )}

            {filtered.map((sup) => {
              const display = sup.supplier_name || sup.name;
              const sub = `${sup.name}${sup.supplier_email || sup.email_id
                ? ` · ${sup.supplier_email || sup.email_id}`
                : ""
                }`;

              return (
                <button
                  key={sup.name}
                  type="button"
                  className="stdrop-item"
                  onClick={() => {
                    onSelect(display, sup);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <div className="stdrop-item-title">{display}</div>
                  <div className="stdrop-item-sub">{sub}</div>
                </button>
              );
            })}

            {!filtered.length ? (
              <div className="stdrop-empty">No suppliers found.</div>
            ) : (
              <div className="stdrop-hint">Showing up to 80 results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


/** Item dropdown */
function POItemSearchDropdown({ items, value, onSelect, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  const selected = useMemo(() => {
    return items.find((x) => x.name === value) || null;
  }, [items, value]);

  const filtered = useMemo(() => {
    const s = (q || "").trim().toLowerCase();
    const base = !s
      ? items
      : items.filter((it) => {
        const code = (it.name || "").toLowerCase();
        const name = (it.item_name || "").toLowerCase();
        const grp = (it.item_group || "").toLowerCase();
        return code.includes(s) || name.includes(s) || grp.includes(s);
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

  const clearSelection = (e) => {
    e?.stopPropagation?.();
    if (disabled) return;
    onSelect("");          // ✅ clear item
    setOpen(false);
    setQ("");
  };

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
                {selected.item_name || ""}
                {selected.stock_uom ? ` · ${selected.stock_uom}` : ""}
              </div>
            </>
          ) : (
            <div className="stdrop-placeholder">{placeholder}</div>
          )}
        </div>

        <div className="stdrop-actions">
          {!!value && !disabled && (
            <span
              className="stdrop-clear"
              role="button"
              tabIndex={0}
              title="Clear"
              onClick={clearSelection}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && clearSelection(e)}
            >
              ✕
            </span>
          )}
          <div className="stdrop-caret">▾</div>
        </div>
      </button>

      {open && !disabled && (
        <div className="stdrop-popover">
          <div className="stdrop-search">
            <input
              autoFocus
              className="po-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type to search..."
            />
          </div>

          <div className="stdrop-list">
            {!!value && (
              <button
                type="button"
                className="stdrop-item stdrop-item-clear"
                onClick={() => {
                  onSelect("");
                  setOpen(false);
                  setQ("");
                }}
              >
                <div className="stdrop-item-title">Clear selection</div>
              </button>
            )}

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
                  {it.item_name || ""}
                  {it.stock_uom ? ` · ${it.stock_uom}` : ""}
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

export default PurchaseOrder;
