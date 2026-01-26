// src/PurchaseOrder.jsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  // ✅ Master lists from ERPNext
  getSuppliers,
  getItemsForPO,
  getItemSuppliers,

  // ✅ Purchase Order actions
  createPurchaseOrder,
  updatePurchaseOrder,
  submitDoc,
  deletePurchaseOrder,

  // ✅ Email + PDF helpers
  sendPurchaseOrderEmail,
  getPurchaseOrderPdfUrl,

  // ✅ Fetch full PO (for editing)
  getPurchaseOrderWithItems,

  // ✅ Rate helper (Standard Buying)
  getItemRateFromPriceList,

  getTransporters,
  setPurchaseOrderTransporter,
} from "../erpBackendApi";
import "./PurchaseOrder.css";

function PurchaseOrder() {
  // -------------------- Master data lists (from ERPNext) --------------------
  const [suppliers, setSuppliers] = useState([]); // all suppliers
  const [items, setItems] = useState([]); // all items for PO
  const [itemSuppliers, setItemSuppliers] = useState([]); // mapping table: which supplier supplies which item
  const [transporters, setTransporters] = useState([]);
  const [transporter, setTransporter] = useState(""); // stores transporter "name" (Link value)

  // -------------------- Supplier selection --------------------
  // supplier = what user sees (supplier_name), not the ERP ID
  const [supplier, setSupplier] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");

  // -------------------- Items inside the PO (multiple rows) --------------------
  // Each row has:
  // item_code: ERP item code
  // qty: quantity string (for typing)
  // rate: unit rate string
  // rateTouched: true if user manually edited rate (so auto-fill doesn't overwrite)
  const [poItems, setPoItems] = useState([
    { item_code: "", qty: "1.00", rate: "", rateTouched: false },
  ]);

  // -------------------- Other PO fields --------------------
  const [warehouse, setWarehouse] = useState("Raw Material - MF");
  const [notes, setNotes] = useState("");

  // ✅ Today's date string in YYYY-MM-DD (local timezone safe)
  const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

  // Purchase Order date + schedule/received date
  const [poDate, setPoDate] = useState(todayStr);
  const [receivedByDate, setReceivedByDate] = useState(todayStr);

  // -------------------- Draft / edit tracking --------------------
  const [lastPoName, setLastPoName] = useState("");     // last created draft PO name
  const [editingPoName, setEditingPoName] = useState(""); // if user is editing a draft PO

  // -------------------- Loading flags (buttons / data) --------------------
  const [loadingLists, setLoadingLists] = useState(false);
  const [submitting, setSubmitting] = useState(false);      // create/update draft
  const [submittingPo, setSubmittingPo] = useState(false);  // submit PO
  const [emailSending, setEmailSending] = useState(false);  // email supplier
  const [deletingDraft, setDeletingDraft] = useState(false);// delete draft PO

  // -------------------- Messages --------------------
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // -------------------- Query params (optional prefill) --------------------
  // Example: /purchase-order?itemCode=ITEM-001&warehouse=Raw%20Material%20-%20MF&qty=2
  const params = new URLSearchParams(window.location.search);
  const qpItemCode = params.get("itemCode");   // currently not used here, but kept for future
  const qpWarehouse = params.get("warehouse"); // warehouse prefill
  const qpQty = params.get("qty");             // qty prefill

  // -------------------- Extra fields (currently not used in UI) --------------------
  // Keeping these states for future enhancements / tracking.
  const [orderTime, setOrderTime] = useState("");
  const [draftWarningSent, setDraftWarningSent] = useState(false);
  const [draftWarningSentOn, setDraftWarningSentOn] = useState("");
  const [mfStatus, setMfStatus] = useState("");
  const [mfStatusUpdatedOn, setMfStatusUpdatedOn] = useState("");
  const [mfStockPercent, setMfStockPercent] = useState("");

  // ---------------- Load suppliers, items, and Item Supplier mapping -------------
  useEffect(() => {
    // ✅ This runs once when page loads:
    // 1) load suppliers, items, and mapping table
    // 2) reset form to clean state
    async function loadLists() {
      try {
        setLoadingLists(true);
        setError("");

        //const [suppliersData, itemsData, itemSupData] = await Promise.all([
        //  getSuppliers(),
        //  getItemsForPO(),
        //  getItemSuppliers(),
        //]);
        const [suppliersData, itemsData, itemSupData, transporterData] = await Promise.all([
          getSuppliers(),
          getItemsForPO(),
          getItemSuppliers(),
          getTransporters(),
        ]);

        setTransporters(transporterData || []);


        setSuppliers(suppliersData || []);
        setItems(itemsData || []);
        setItemSuppliers(itemSupData || []);

        // reset selections
        setSupplier("");
        setSupplierEmail("");
        setTransporter("");


        // prefill qty/warehouse if provided in URL
        const initQty = qpQty || "1.00";
        setPoItems([{ item_code: "", qty: initQty, rate: "", rateTouched: false }]);
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

  // -------------------- Rate auto-fill (Standard Buying) --------------------
  // Cache buying rate so we don't call API again and again for same item
  const buyingRateCacheRef = useRef(new Map()); // itemCode -> number|null

  // Token per row index so old requests don't overwrite new item selections
  const rateReqTokenRef = useRef({}); // idx -> token

  // ✅ Fetch Standard Buying rate for an item (returns number or null)
  async function fetchStandardBuyingRate(itemCode) {
    const code = String(itemCode || "").trim();
    if (!code) return null;

    // Use cache first
    if (buyingRateCacheRef.current.has(code)) {
      return buyingRateCacheRef.current.get(code);
    }

    try {
      const row = await getItemRateFromPriceList(code, "Standard Buying");
      const rate = row?.price_list_rate;

      const n = rate != null ? Number(rate) : NaN;
      const finalRate = Number.isFinite(n) ? n : null;

      buyingRateCacheRef.current.set(code, finalRate);
      return finalRate;
    } catch (e) {
      console.error("Standard Buying rate fetch failed:", e);
      buyingRateCacheRef.current.set(code, null);
      return null;
    }
  }

  // -------- Helper: currently selected supplier row & ERP ID ----------------
  // selectedSupplierRow: full supplier object from list
  // selectedSupplierId: ERP internal supplier "name" (used in mapping table)
  const selectedSupplierRow = useMemo(
    () =>
      suppliers.find(
        (s) => s.supplier_name === supplier || s.name === supplier
      ),
    [suppliers, supplier]
  );
  const selectedSupplierId = selectedSupplierRow?.name || "";

  // -------- Build mapping: supplier -> item_codes ----------------
  // Used to filter items dropdown when supplier is selected
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
  // Used to filter supplier dropdown based on selected items (intersection)
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
  // If supplier has mapping, only show items it supplies.
  // If supplier has no mapping, show all items (no restriction).
  const itemsForCurrentSupplier = useMemo(() => {
    if (!selectedSupplierId) return items;

    const allowedItemsSet = supplierToItemNames.get(selectedSupplierId);

    // ✅ If supplier has NO mapping (or empty), show ALL items
    if (!allowedItemsSet || !allowedItemsSet.size) return items;

    const filtered = items.filter((it) => allowedItemsSet.has(it.name));
    return filtered.length ? filtered : items;
  }, [items, supplierToItemNames, selectedSupplierId]);

  // ✅ Suppliers filtered by ALL selected items (intersection)
  // If an item has no mapping, we allow all suppliers (no restriction).
  const suppliersForSelectedItems = useMemo(() => {
    const codes = poItems.map((r) => r.item_code).filter(Boolean);
    if (!codes.length) return suppliers;

    let allowed = null;

    for (const code of codes) {
      const set = itemToSupplierNames.get(code);

      // ✅ If item has NO mapping -> show ALL suppliers
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
  // (Even if filtering changes and selected supplier is not in the new filtered list)
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

  // ✅ When supplier changes:
  // - store selected supplier display name
  // - fill supplier email
  // - if supplier has item-mapping, clear only items that supplier cannot supply
  function handleSupplierValueChange(displayValue, supplierObj = null) {
    setSupplier(displayValue);

    const s =
      supplierObj ||
      suppliers.find(
        (sup) => sup.supplier_name === displayValue || sup.name === displayValue
      );

    if (s) setSupplierEmail(s.supplier_email || s.email_id || "");
    else setSupplierEmail("");

    const supplierId = s?.name || "";
    if (!supplierId) return;

    const allowedItemsSet = supplierToItemNames.get(supplierId);

    // ✅ If supplier has NO mapping/empty -> don't clear anything
    if (!allowedItemsSet || !allowedItemsSet.size) return;

    setPoItems((prev) =>
      prev.map((row) => {
        if (!row.item_code) return row;
        if (allowedItemsSet.has(row.item_code)) return row;
        return { ...row, item_code: "" }; // clear only invalid item
      })
    );
  }

  // ✅ MULTI ITEMS helpers --------------------
  // update one row using small patch object
  function updatePoItem(idx, patch) {
    setPoItems((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    );
  }

  // add new empty row
  function addPoItem() {
    setPoItems((prev) => [
      ...prev,
      { item_code: "", qty: "1.00", rate: "", rateTouched: false },
    ]);
  }

  // remove row, but keep at least one row always
  function removePoItem(idx) {
    setPoItems((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? next : [{ item_code: "", qty: "1.00", rate: "", rateTouched: false }];
    });
  }

  // ✅ When item changes:
  // - set item_code
  // - auto-fill rate from "Standard Buying" (only if user hasn't edited rate)
  // - validate selected supplier vs selected items (clear supplier if not compatible)
  function handleItemValueChange(idx, code) {
    const prevCode = poItems[idx]?.item_code;

    const nextPoItems = poItems.map((r, i) => {
      if (i !== idx) return r;

      // ✅ if item changed -> clear rate and allow auto-fill again
      if (prevCode && prevCode !== code) {
        return { ...r, item_code: code, rate: "", rateTouched: false };
      }

      return { ...r, item_code: code };
    });

    setPoItems(nextPoItems);

    // ✅ Fetch rate safely (token prevents old responses overwriting new selection)
    const token = `${Date.now()}_${Math.random()}`;
    rateReqTokenRef.current[idx] = token;

    fetchStandardBuyingRate(code).then((rate) => {
      if (rate == null) return;
      if (rateReqTokenRef.current[idx] !== token) return;

      setPoItems((prev) =>
        prev.map((r, i) => {
          if (i !== idx) return r;
          if (r.item_code !== code) return r;

          // ✅ fill only if user has not touched rate
          if (r.rateTouched) return r;

          return { ...r, rate: String(rate) };
        })
      );
    });

    // ✅ If no supplier selected, nothing to validate
    if (!selectedSupplierId) return;

    // ✅ If supplier has NO mapping, do not clear supplier
    const selectedSupSet = supplierToItemNames.get(selectedSupplierId);
    if (!selectedSupSet || !selectedSupSet.size) return;

    // ✅ Validate that selected supplier can supply ALL selected items
    const codes = nextPoItems.map((r) => r.item_code).filter(Boolean);
    if (!codes.length) return;

    let allowed = null;

    for (const c of codes) {
      const set = itemToSupplierNames.get(c);

      // ✅ If item has no mapping -> do not clear supplier
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

  // Keep selected item visible even if supplier filtering changes
  function getItemOptionsIncludingSelected(selectedCode) {
    if (!selectedCode) return itemsForCurrentSupplier;
    if (itemsForCurrentSupplier.some((it) => it.name === selectedCode))
      return itemsForCurrentSupplier;
    const found = items.find((it) => it.name === selectedCode);
    return found ? [found, ...itemsForCurrentSupplier] : itemsForCurrentSupplier;
  }

  // -------------------- Load existing draft PO for editing --------------------
  // This fills the form with data from ERPNext draft PO.
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
        rate: it.rate != null ? String(it.rate) : "",
        rateTouched: it.rate != null, // keep existing rate as locked from auto-fill
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
      setTransporter(po.custom_transporter || "");
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
  // This only saves as DRAFT (not submitted).
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    // Convert rows into ERP payload format (and remove empty rows)
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

    // Basic validation
    if (!supplier || normalizedItems.length === 0) {
      setError(
        "Please select supplier and add at least one valid item with quantity."
      );
      return;
    }
    if (!poDate) return setError("Please select Purchase Order Date.");
    if (!receivedByDate) return setError("Please select Received By date.");

    // Convert selected supplier display -> ERP supplier ID
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

      // ✅ If editing a draft: update it with full items list
      if (editingPoName) {
        const payload = {
          supplier: supplierId,
          transaction_date: poDate,
          schedule_date: receivedByDate,
          notes: notes || "",
          custom_transporter: transporter || "",
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
        // ✅ If creating new: backend helper creates PO using first item
        // ✅ If creating new: backend helper creates PO using first item
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

        // ✅ ALWAYS update after creation (so transporter + all items are saved even for 1 item)
        if (poName) {
          const payload = {
            supplier: supplierId,
            transaction_date: poDate,
            schedule_date: receivedByDate,
            notes: notes || "",
            custom_transporter: transporter || "",   // ✅ ADD THIS
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
  // This converts DRAFT PO -> SUBMITTED PO in ERPNext.
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
  // Only works for draft POs (docstatus 0).
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
  // Sends PO email via backend helper.
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
      {/* ✅ Main card: form + actions */}
      <div className="po-card po-card-main">
        <div className="po-header">
          <div>
            <h1 className="po-title">Purchase Order (Raw Material)</h1>
            <p className="po-subtitle">
              Create ERPNext Purchase Orders for raw materials.
            </p>
          </div>

          {/* Show last PO / editing PO info */}
          {lastPoName && (
            <div className="po-header-chip">
              {editingPoName ? "Editing draft" : "Last PO"}:{" "}
              <span>{lastPoName}</span>
            </div>
          )}
        </div>

        {/* Page messages */}
        {loadingLists && (
          <p className="po-info-text">Loading suppliers/items...</p>
        )}
        {error && <p className="po-error-text">{error}</p>}
        {message && <p className="po-message-text">{message}</p>}

        {/* Main form */}
        <form onSubmit={handleSubmit} className="po-form-grid">
          {/* Left column: supplier + email + notes */}
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
                Transporter <span className="po-label-hint">(optional, before submit)</span>
              </label>

              <select
                className="po-input"
                value={transporter}
                onChange={async (e) => {
                  const t = e.target.value;
                  setTransporter(t);

                  // ✅ if editing an existing draft, save immediately so user can submit without pressing "Save Draft"
                  if (editingPoName) {
                    try {
                      await setPurchaseOrderTransporter(editingPoName, t);
                    } catch (err) {
                      console.error(err);
                      setError(err.message || "Failed to save transporter");
                    }
                  }
                }}
                disabled={loadingLists}
              >
                <option value="">-- None --</option>
                {transporters.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.transporter_name || t.name}
                  </option>
                ))}
              </select>
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

          {/* Right column: items + dates + buttons */}
          <div className="po-form-column">
            <div className="po-field">
              <label className="po-label">Items (multiple allowed)</label>

              {/* Item rows */}
              {poItems.map((row, idx) => (
                <div key={idx} style={{ marginBottom: 12 }}>
                  <POItemSearchDropdown
                    items={getItemOptionsIncludingSelected(row.item_code)}
                    value={row.item_code}
                    onSelect={(code) => handleItemValueChange(idx, code)}
                    placeholder={`Search item (row ${idx + 1})...`}
                    disabled={loadingLists || items.length === 0}
                  />

                  {/* Qty + Rate + Remove button */}
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

                          // block negative
                          if (num < 0) {
                            return;
                          }
                          updatePoItem(idx, { qty: e.target.value });
                        }}
                        className={`po-input ${row.qty < 0 ? "po-input-error" : ""
                          }`}
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

                          // rateTouched=true means user typed rate manually
                          updatePoItem(idx, { rate: value, rateTouched: true });
                        }}
                        className={`po-input ${Number(row.rate) < 0 ? "po-input-error" : ""
                          }`}
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

              {/* Add row button */}
              <button
                type="button"
                onClick={addPoItem}
                disabled={loadingLists}
                className="po-btn po-btn-outline"
              >
                + Add another item
              </button>
            </div>

            {/* Dates */}
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

            {/* Main actions */}
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

              {/* Submit PO with confirmation dialog */}
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

              {/* Delete draft only */}
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

        {/* After-actions shown only when a PO exists */}
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

            {/* Download PDF */}
            <a
              href={getPurchaseOrderPdfUrl(lastPoName, "MF Purchase Order")}
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
    </div>
  );
}

/** Supplier dropdown
 * Simple searchable dropdown with:
 * - open/close
 * - search
 * - click outside closes
 * - clear selection (✕)
 */
function SupplierSearchDropdown({
  suppliers,
  value,
  onSelect,
  placeholder,
  disabled,
}) {
  const [open, setOpen] = useState(false); // dropdown open/close
  const [q, setQ] = useState("");          // search text
  const ref = useRef(null);               // used to detect outside click

  // Find selected supplier object based on current value
  const selected = useMemo(() => {
    return suppliers.find((x) => (x.supplier_name || x.name) === value) || null;
  }, [suppliers, value]);

  // Filter supplier list by search
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

    return base.slice(0, 80); // limit list for performance
  }, [suppliers, q]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function onDown(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Clear supplier selection
  const clearSelection = (e) => {
    e?.stopPropagation?.();
    if (disabled) return;
    onSelect("", null);
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

        {/* Right side: clear icon + dropdown caret */}
        <div className="stdrop-actions">
          {!!value && !disabled && (
            <span
              className="stdrop-clear"
              role="button"
              tabIndex={0}
              title="Clear"
              onClick={clearSelection}
              onKeyDown={(e) =>
                (e.key === "Enter" || e.key === " ") && clearSelection(e)
              }
            >
              ✕
            </span>
          )}
          <div className="stdrop-caret">▾</div>
        </div>
      </button>

      {/* Dropdown list */}
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
            {/* Clear option inside list */}
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

            {/* Supplier results */}
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

/** Item dropdown
 * Same dropdown style as supplier dropdown:
 * - search items
 * - show item code + item name + uom
 * - clear selection (✕)
 */
function POItemSearchDropdown({ items, value, onSelect, placeholder, disabled }) {
  const [open, setOpen] = useState(false); // dropdown open/close
  const [q, setQ] = useState("");          // search text
  const ref = useRef(null);               // for outside click close

  // current selected item object
  const selected = useMemo(() => {
    return items.find((x) => x.name === value) || null;
  }, [items, value]);

  // filter items list based on search
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

  // close dropdown when clicking outside
  useEffect(() => {
    function onDown(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // clear item selection
  const clearSelection = (e) => {
    e?.stopPropagation?.();
    if (disabled) return;
    onSelect("");
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

        {/* right side icons */}
        <div className="stdrop-actions">
          {!!value && !disabled && (
            <span
              className="stdrop-clear"
              role="button"
              tabIndex={0}
              title="Clear"
              onClick={clearSelection}
              onKeyDown={(e) =>
                (e.key === "Enter" || e.key === " ") && clearSelection(e)
              }
            >
              ✕
            </span>
          )}
          <div className="stdrop-caret">▾</div>
        </div>
      </button>

      {/* dropdown list */}
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
            {/* clear option */}
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

            {/* item results */}
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
