////////// src/PurchaseOrder.jsx
////////import React, { useEffect, useState } from "react";
////////import {
////////  getSuppliers,
////////  getItemsForPO,
////////  createPurchaseOrder,
////////  submitDoc,
////////  sendPurchaseOrderEmail,
////////  getPurchaseOrderPdfUrl,
////////  getPurchaseOrderWithItems,
////////  updatePurchaseOrder,
////////} from "./erpBackendApi";
////////import PurchaseOrderList from "./PurchaseOrderList";
////////import "../CSS/PurchaseOrder.css";

////////function PurchaseOrder() {
////////  const [suppliers, setSuppliers] = useState([]);
////////  const [items, setItems] = useState([]);

////////  // supplier = what user sees (supplier_name), not the ID
////////  const [supplier, setSupplier] = useState("");
////////  const [supplierEmail, setSupplierEmail] = useState("");
////////  const [itemCode, setItemCode] = useState("");
////////  const [qty, setQty] = useState("1.00");
////////  const [rate, setRate] = useState("0.00");
////////  const [warehouse, setWarehouse] = useState("Raw Material - MF"); // default warehouse
////////  const [notes, setNotes] = useState("");

////////  const todayStr = new Date().toISOString().slice(0, 10);
////////  const [poDate, setPoDate] = useState(todayStr); // transaction_date
////////  const [receivedByDate, setReceivedByDate] = useState(todayStr); // schedule_date

////////  const [lastPoName, setLastPoName] = useState("");
////////  const [editingPoName, setEditingPoName] = useState(""); // ⭐ which draft is being edited

////////  const [loadingLists, setLoadingLists] = useState(false);
////////  const [submitting, setSubmitting] = useState(false);
////////  const [submittingPo, setSubmittingPo] = useState(false);
////////  const [emailSending, setEmailSending] = useState(false);

////////  const [error, setError] = useState("");
////////  const [message, setMessage] = useState("");

////////  useEffect(() => {
////////    async function loadLists() {
////////      try {
////////        setLoadingLists(true);
////////        setError("");

////////        const [suppliersData, itemsData] = await Promise.all([
////////          getSuppliers(),
////////          getItemsForPO(),
////////        ]);

////////        setSuppliers(suppliersData);
////////        setItems(itemsData);

////////        if (suppliersData.length > 0) {
////////          const s0 = suppliersData[0];
////////          setSupplier(s0.supplier_name || s0.name);
////////          setSupplierEmail(s0.supplier_email || s0.email_id || "");
////////        }

////////        if (itemsData.length > 0) {
////////          setItemCode(itemsData[0].name);
////////        }
////////      } catch (err) {
////////        console.error(err);
////////        setError("Failed to load suppliers/items");
////////      } finally {
////////        setLoadingLists(false);
////////      }
////////    }

////////    loadLists();
////////  }, []);

////////  function handleSupplierChange(e) {
////////    const value = e.target.value;
////////    setSupplier(value);

////////    const s = suppliers.find(
////////      (sup) => sup.supplier_name === value || sup.name === value
////////    );
////////    if (s) {
////////      // ✅ always overwrite email; do not keep old value
////////      setSupplierEmail(s.supplier_email || s.email_id || "");
////////    } else {
////////      setSupplierEmail("");
////////    }
////////  }

////////  // 🔁 Load an existing draft PO into the form for editing
////////  async function handleEditPo(poName) {
////////    try {
////////      setError("");
////////      setMessage(`Loading draft Purchase Order ${poName} for editing...`);
////////      const po = await getPurchaseOrderWithItems(poName);

////////      const firstItem = (po.items || [])[0] || {};

////////      const supRow = suppliers.find((s) => s.name === po.supplier);
////////      const displaySupplier = supRow?.supplier_name || po.supplier;

////////      setSupplier(displaySupplier);
////////      setSupplierEmail(
////////        supRow?.supplier_email || supRow?.email_id || ""
////////      ); // ✅ no stale email

////////      setItemCode(firstItem.item_code || "");
////////      setQty(firstItem.qty != null ? String(firstItem.qty) : "1.00");
////////      setRate(firstItem.rate != null ? String(firstItem.rate) : "0.00");
////////      setWarehouse(firstItem.warehouse || "Raw Material - MF");
////////      setNotes(po.notes || "");

////////      setPoDate(po.transaction_date || todayStr);
////////      setReceivedByDate(
////////        firstItem.schedule_date ||
////////          po.schedule_date ||
////////          po.transaction_date ||
////////          todayStr
////////      );

////////      setEditingPoName(po.name);
////////      setLastPoName(po.name);
////////      setMessage(`Editing draft Purchase Order ${poName}.`);
////////    } catch (err) {
////////      console.error(err);
////////      setError(
////////        err.response?.data?.error?.message ||
////////          err.message ||
////////          "Failed to load Purchase Order for editing"
////////      );
////////    }
////////  }

////////  async function handleSubmit(e) {
////////    e.preventDefault();
////////    setError("");
////////    setMessage("");

////////    const q = parseFloat(qty);
////////    const r = parseFloat(rate);

////////    if (!supplier || !itemCode || isNaN(q) || q <= 0) {
////////      setError("Please select supplier, item and enter valid quantity.");
////////      return;
////////    }

////////    if (!poDate) {
////////      setError("Please select Purchase Order Date.");
////////      return;
////////    }

////////    if (!receivedByDate) {
////////      setError("Please select Received By date.");
////////      return;
////////    }

////////    const selectedSupplier = suppliers.find(
////////      (s) => s.supplier_name === supplier || s.name === supplier
////////    );
////////    if (!selectedSupplier) {
////////      setError("Please select a valid supplier from the list.");
////////      return;
////////    }
////////    const supplierId = selectedSupplier.name;

////////    try {
////////      setSubmitting(true);

////////      if (editingPoName) {
////////        // ✏️ UPDATE EXISTING DRAFT
////////        const payload = {
////////          supplier: supplierId,
////////          transaction_date: poDate,
////////          schedule_date: receivedByDate,
////////          notes: notes || "",
////////          items: [
////////            {
////////              item_code: itemCode,
////////              qty: q,
////////              rate: isNaN(r) ? 0 : r,
////////              schedule_date: receivedByDate,
////////              warehouse: warehouse || undefined,
////////            },
////////          ],
////////        };

////////        await updatePurchaseOrder(editingPoName, payload);

////////        setLastPoName(editingPoName);
////////        setMessage(`Purchase Order ${editingPoName} saved as draft.`);
////////      } else {
////////        // 🆕 CREATE NEW DRAFT
////////        const po = await createPurchaseOrder({
////////          supplier: supplierId,
////////          item_code: itemCode,
////////          qty: q,
////////          rate: isNaN(r) ? 0 : r,
////////          notes,
////////          warehouse,
////////          po_date: poDate,
////////          schedule_date: receivedByDate,
////////        });

////////        const poName = po.data?.name;

////////        setLastPoName(poName || "");
////////        setEditingPoName(poName || "");
////////        setMessage(
////////          poName
////////            ? `Purchase Order created as draft: ${poName}`
////////            : `Purchase Order created (draft)`
////////        );
////////      }
////////    } catch (err) {
////////      console.error(err);
////////      setError(
////////        err.response?.data?.error?.message ||
////////          err.message ||
////////          "Failed to create/update Purchase Order"
////////      );
////////    } finally {
////////      setSubmitting(false);
////////    }
////////  }

////////  async function handleSubmitPo() {
////////    setError("");
////////    setMessage("");

////////    const poName = editingPoName || lastPoName;
////////    if (!poName) {
////////      setError("No draft Purchase Order selected to submit.");
////////      return;
////////    }

////////    try {
////////      setSubmittingPo(true);
////////      await submitDoc("Purchase Order", poName);
////////      setMessage(`Purchase Order submitted: ${poName}`);
////////      setEditingPoName("");
////////    } catch (err) {
////////      console.error(err);
////////      setError(
////////        err.response?.data?.error?.message ||
////////          err.message ||
////////          "Failed to submit Purchase Order"
////////      );
////////    } finally {
////////      setSubmittingPo(false);
////////    }
////////  }

////////  async function handleEmailSupplier() {
////////    if (!lastPoName) {
////////      setError("No Purchase Order to email yet.");
////////      return;
////////    }
////////    if (!supplierEmail) {
////////      setError("Please enter supplier email address first.");
////////      return;
////////    }

////////    setError("");
////////    setMessage("");
////////    setEmailSending(true);

////////    try {
////////      await sendPurchaseOrderEmail({
////////        poName: lastPoName,
////////        recipients: supplierEmail,
////////      });
////////      setMessage(`Email sent to ${supplierEmail} for PO ${lastPoName}.`);
////////    } catch (err) {
////////      console.error(err);
////////      setError(
////////        err.response?.data?.error?.message ||
////////          err.message ||
////////          "Failed to send email"
////////      );
////////    } finally {
////////      setEmailSending(false);
////////    }
////////  }

////////  return (
////////    <div className="po-page">
////////      <div className="po-card po-card-main">
////////        <div className="po-header">
////////          <div>
////////            <h1 className="po-title">ERPNext Purchase Order (Raw Material)</h1>
////////            <p className="po-subtitle">
////////              Create ERPNext Purchase Orders for raw materials and send to
////////              suppliers.
////////            </p>
////////          </div>
////////          {lastPoName && (
////////            <div className="po-header-chip">
////////              {editingPoName ? "Editing draft" : "Last PO"}:{" "}
////////              <span>{lastPoName}</span>
////////            </div>
////////          )}
////////        </div>

////////        {loadingLists && (
////////          <p className="po-info-text">Loading suppliers/items...</p>
////////        )}
////////        {error && <p className="po-error-text">{error}</p>}
////////        {message && <p className="po-message-text">{message}</p>}

////////        <form onSubmit={handleSubmit} className="po-form-grid">
////////          {/* Left column */}
////////          <div className="po-form-column">
////////            <div className="po-field">
////////              <label className="po-label">Supplier</label>
////////              <input
////////                list="po-supplier-list"
////////                value={supplier}
////////                onChange={handleSupplierChange}
////////                disabled={loadingLists || suppliers.length === 0}
////////                className="po-input"
////////                placeholder="Type or select supplier"
////////              />
////////              <datalist id="po-supplier-list">
////////                {suppliers.map((s) => (
////////                  <option
////////                    key={s.name}
////////                    value={s.supplier_name || s.name}
////////                    label={s.name}
////////                  />
////////                ))}
////////              </datalist>
////////            </div>

////////            <div className="po-field">
////////              <label className="po-label">
////////                Supplier Email{" "}
////////                <span className="po-label-hint">(optional)</span>
////////              </label>
////////              <input
////////                type="email"
////////                value={supplierEmail}
////////                onChange={(e) => setSupplierEmail(e.target.value)}
////////                placeholder="supplier@example.com"
////////                className="po-input"
////////              />
////////            </div>

////////            <div className="po-field">
////////              <label className="po-label">Notes (optional)</label>
////////              <textarea
////////                value={notes}
////////                onChange={(e) => setNotes(e.target.value)}
////////                rows={3}
////////                className="po-input po-textarea"
////////              />
////////            </div>
////////          </div>

////////          {/* Right column */}
////////          <div className="po-form-column">
////////            <div className="po-field">
////////              <label className="po-label">
////////                Item (Raw Material / Pouch / Sticker)
////////              </label>
////////              <input
////////                list="po-item-list"
////////                value={itemCode}
////////                onChange={(e) => setItemCode(e.target.value)}
////////                disabled={loadingLists || items.length === 0}
////////                className="po-input"
////////                placeholder="Type or select item code"
////////              />
////////              <datalist id="po-item-list">
////////                {items.map((item) => (
////////                  <option
////////                    key={item.name}
////////                    value={item.name}
////////                    label={`${item.name} - ${item.item_name || ""}${
////////                      item.item_group ? " (" + item.item_group + ")" : ""
////////                    }`}
////////                  />
////////                ))}
////////              </datalist>
////////            </div>

////////            <div className="po-field po-field-inline">
////////              <div>
////////                <label className="po-label">Quantity</label>
////////                <input
////////                  type="number"
////////                  step="0.01"
////////                  value={qty}
////////                  onChange={(e) => setQty(e.target.value)}
////////                  className="po-input"
////////                />
////////              </div>
////////              <div>
////////                <label className="po-label">Rate (per unit)</label>
////////                <input
////////                  type="number"
////////                  step="0.01"
////////                  value={rate}
////////                  onChange={(e) => setRate(e.target.value)}
////////                  className="po-input"
////////                />
////////              </div>
////////            </div>

////////            <div className="po-field po-field-inline">
////////              <div>
////////                <label className="po-label">Purchase Order Date</label>
////////                <input
////////                  type="date"
////////                  value={poDate}
////////                  onChange={(e) => setPoDate(e.target.value)}
////////                  className="po-input"
////////                />
////////              </div>
////////              <div>
////////                <label className="po-label">Received By (Schedule Date)</label>
////////                <input
////////                  type="date"
////////                  value={receivedByDate}
////////                  onChange={(e) => setReceivedByDate(e.target.value)}
////////                  className="po-input"
////////                />
////////              </div>
////////            </div>

////////            <div className="po-field">
////////              <label className="po-label">Warehouse</label>
////////              <input
////////                type="text"
////////                value={warehouse}
////////                onChange={(e) => setWarehouse(e.target.value)}
////////                placeholder="Raw Material - MF"
////////                className="po-input"
////////              />
////////            </div>

////////            <div className="po-actions-main">
////////              <button
////////                type="submit"
////////                disabled={submitting || loadingLists}
////////                className="po-btn po-btn-primary"
////////              >
////////                {submitting
////////                  ? editingPoName
////////                    ? "Saving Draft..."
////////                    : "Creating Draft..."
////////                  : editingPoName
////////                  ? "Save Draft"
////////                  : "Create Draft"}
////////              </button>

////////              <button
////////                type="button"
////////                onClick={handleSubmitPo}
////////                disabled={submittingPo || loadingLists}
////////                className="po-btn po-btn-outline"
////////              >
////////                {submittingPo ? "Submitting..." : "Submit Purchase Order"}
////////              </button>
////////            </div>
////////          </div>
////////        </form>

////////        {lastPoName && (
////////          <div className="po-after-actions">
////////            <button
////////              type="button"
////////              onClick={handleEmailSupplier}
////////              disabled={emailSending || !supplierEmail}
////////              className="po-btn po-btn-accent"
////////            >
////////              {emailSending ? "Sending email..." : "Email Supplier"}
////////            </button>

////////            <a
////////              href={getPurchaseOrderPdfUrl(lastPoName)}
////////              target="_blank"
////////              rel="noreferrer"
////////            >
////////              <button type="button" className="po-btn po-btn-outline">
////////                Download PDF
////////              </button>
////////            </a>
////////          </div>
////////        )}
////////      </div>

////////      <div className="po-card po-card-list">
////////        <PurchaseOrderList onEditPo={handleEditPo} />
////////      </div>
////////    </div>
////////  );
////////}

////////export default PurchaseOrder;


//////// src/PurchaseOrder.jsx
//////import React, { useEffect, useState, useMemo } from "react";
//////import {
//////  getSuppliers,
//////  getItemsForPO,
//////  createPurchaseOrder,
//////  submitDoc,
//////  sendPurchaseOrderEmail,
//////  getPurchaseOrderPdfUrl,
//////  getPurchaseOrderWithItems,
//////  updatePurchaseOrder,
//////  getItemSuppliers,          // 👈 NEW
//////} from "./erpBackendApi";
//////import PurchaseOrderList from "./PurchaseOrderList";
//////import "../CSS/PurchaseOrder.css";

//////function PurchaseOrder() {
//////  const [suppliers, setSuppliers] = useState([]);
//////  const [items, setItems] = useState([]);
//////  const [itemSuppliers, setItemSuppliers] = useState([]); // 👈 mapping rows

//////  // supplier = what user sees (supplier_name), not the ID
//////  const [supplier, setSupplier] = useState("");
//////  const [supplierEmail, setSupplierEmail] = useState("");
//////  const [itemCode, setItemCode] = useState("");
//////  const [qty, setQty] = useState("1.00");
//////  const [rate, setRate] = useState("0.00");
//////  const [warehouse, setWarehouse] = useState("Raw Material - MF"); // default warehouse
//////  const [notes, setNotes] = useState("");

//////  const todayStr = new Date().toISOString().slice(0, 10);
//////  const [poDate, setPoDate] = useState(todayStr); // transaction_date
//////  const [receivedByDate, setReceivedByDate] = useState(todayStr); // schedule_date

//////  const [lastPoName, setLastPoName] = useState("");
//////  const [editingPoName, setEditingPoName] = useState(""); // which draft is being edited

//////  const [loadingLists, setLoadingLists] = useState(false);
//////  const [submitting, setSubmitting] = useState(false);
//////  const [submittingPo, setSubmittingPo] = useState(false);
//////  const [emailSending, setEmailSending] = useState(false);

//////  const [error, setError] = useState("");
//////  const [message, setMessage] = useState("");

//////  // ---- Load suppliers, items, and Item Supplier mapping ----
//////  useEffect(() => {
//////    async function loadLists() {
//////      try {
//////        setLoadingLists(true);
//////        setError("");

//////        const [suppliersData, itemsData, itemSupData] = await Promise.all([
//////          getSuppliers(),
//////          getItemsForPO(),
//////          getItemSuppliers(),  // 👈 fetch mapping from Item Purchase section
//////        ]);

//////        setSuppliers(suppliersData);
//////        setItems(itemsData);
//////        setItemSuppliers(itemSupData || []);

//////        if (suppliersData.length > 0) {
//////          const s0 = suppliersData[0];
//////          setSupplier(s0.supplier_name || s0.name);
//////          setSupplierEmail(s0.supplier_email || s0.email_id || "");
//////        }

//////        if (itemsData.length > 0) {
//////          setItemCode(itemsData[0].name);
//////        }
//////      } catch (err) {
//////        console.error(err);
//////        setError("Failed to load suppliers/items");
//////      } finally {
//////        setLoadingLists(false);
//////      }
//////    }

//////    loadLists();
//////  }, []);

//////  // Helper: current selected supplier row & ID
//////  const selectedSupplierRow = useMemo(
//////    () =>
//////      suppliers.find(
//////        (s) => s.supplier_name === supplier || s.name === supplier
//////      ),
//////    [suppliers, supplier]
//////  );
//////  const selectedSupplierId = selectedSupplierRow?.name || "";

//////  // Build quick lookup maps from Item Supplier rows
//////  const supplierToItemNames = useMemo(() => {
//////    const map = new Map(); // supplierId -> Set(itemCode)
//////    for (const row of itemSuppliers) {
//////      const sup = row.supplier;
//////      const item = row.parent;
//////      if (!sup || !item) continue;
//////      if (!map.has(sup)) map.set(sup, new Set());
//////      map.get(sup).add(item);
//////    }
//////    return map;
//////  }, [itemSuppliers]);

//////  const itemToSupplierNames = useMemo(() => {
//////    const map = new Map(); // itemCode -> Set(supplierId)
//////    for (const row of itemSuppliers) {
//////      const sup = row.supplier;
//////      const item = row.parent;
//////      if (!sup || !item) continue;
//////      if (!map.has(item)) map.set(item, new Set());
//////      map.get(item).add(sup);
//////    }
//////    return map;
//////  }, [itemSuppliers]);

//////  // Items filtered by currently selected supplier
//////  const itemsForCurrentSupplier = useMemo(() => {
//////    if (!selectedSupplierId) return items;

//////    const allowedItemsSet = supplierToItemNames.get(selectedSupplierId);
//////    if (!allowedItemsSet || !allowedItemsSet.size) {
//////      // if no mapping, show all to avoid confusion
//////      return items;
//////    }
//////    const filtered = items.filter((it) => allowedItemsSet.has(it.name));
//////    return filtered.length ? filtered : items;
//////  }, [items, supplierToItemNames, selectedSupplierId]);

//////  // Suppliers filtered by currently selected item
//////  const suppliersForCurrentItem = useMemo(() => {
//////    if (!itemCode) return suppliers;

//////    const allowedSupSet = itemToSupplierNames.get(itemCode);
//////    if (!allowedSupSet || !allowedSupSet.size) {
//////      return suppliers;
//////    }
//////    const filtered = suppliers.filter((s) => allowedSupSet.has(s.name));
//////    return filtered.length ? filtered : suppliers;
//////  }, [suppliers, itemToSupplierNames, itemCode]);

//////  // ---- Supplier change ----
//////  function handleSupplierChange(e) {
//////    const value = e.target.value;
//////    setSupplier(value);

//////    const s = suppliers.find(
//////      (sup) => sup.supplier_name === value || sup.name === value
//////    );

//////    if (s) {
//////      // always overwrite email; do not keep old value
//////      setSupplierEmail(s.supplier_email || s.email_id || "");
//////    } else {
//////      setSupplierEmail("");
//////    }

//////    // Auto-adjust item if current item is not supplied by this supplier
//////    const supplierId = s?.name;
//////    if (supplierId && items.length) {
//////      const allowedItemsSet = supplierToItemNames.get(supplierId);
//////      if (allowedItemsSet && allowedItemsSet.size) {
//////        const currentItemAllowed = itemCode && allowedItemsSet.has(itemCode);
//////        if (!currentItemAllowed) {
//////          // pick first allowed item
//////          const firstAllowedItem = items.find((it) =>
//////            allowedItemsSet.has(it.name)
//////          );
//////          if (firstAllowedItem) {
//////            setItemCode(firstAllowedItem.name);
//////          }
//////        }
//////      }
//////    }
//////  }

//////  // ---- Item change ----
//////  function handleItemChange(e) {
//////    const value = e.target.value;
//////    setItemCode(value);

//////    if (!value) return;

//////    // If item has specific suppliers, auto-pick one if needed
//////    const allowedSupSet = itemToSupplierNames.get(value);
//////    if (allowedSupSet && allowedSupSet.size) {
//////      const currentSupplierOk =
//////        selectedSupplierId && allowedSupSet.has(selectedSupplierId);

//////      if (!currentSupplierOk) {
//////        // pick the first allowed supplier
//////        const firstAllowedSupId = Array.from(allowedSupSet)[0];
//////        const supRow = suppliers.find((s) => s.name === firstAllowedSupId);
//////        if (supRow) {
//////          const displaySupplier = supRow.supplier_name || supRow.name;
//////          setSupplier(displaySupplier);
//////          setSupplierEmail(supRow.supplier_email || supRow.email_id || "");
//////        }
//////      }
//////    }
//////  }

//////  // ---- Load existing draft PO for editing ----
//////  async function handleEditPo(poName) {
//////    try {
//////      setError("");
//////      setMessage(`Loading draft Purchase Order ${poName} for editing...`);
//////      const po = await getPurchaseOrderWithItems(poName);

//////      const firstItem = (po.items || [])[0] || {};

//////      const supRow = suppliers.find((s) => s.name === po.supplier);
//////      const displaySupplier = supRow?.supplier_name || po.supplier;

//////      setSupplier(displaySupplier);
//////      setSupplierEmail(supRow?.supplier_email || supRow?.email_id || "");

//////      setItemCode(firstItem.item_code || "");
//////      setQty(firstItem.qty != null ? String(firstItem.qty) : "1.00");
//////      setRate(firstItem.rate != null ? String(firstItem.rate) : "0.00");
//////      setWarehouse(firstItem.warehouse || "Raw Material - MF");
//////      setNotes(po.notes || "");

//////      setPoDate(po.transaction_date || todayStr);
//////      setReceivedByDate(
//////        firstItem.schedule_date ||
//////          po.schedule_date ||
//////          po.transaction_date ||
//////          todayStr
//////      );

//////      setEditingPoName(po.name);
//////      setLastPoName(po.name);
//////      setMessage(`Editing draft Purchase Order ${poName}.`);
//////    } catch (err) {
//////      console.error(err);
//////      setError(
//////        err.response?.data?.error?.message ||
//////          err.message ||
//////          "Failed to load Purchase Order for editing"
//////      );
//////    }
//////  }

//////  // ---- Create / save draft ----
//////  async function handleSubmit(e) {
//////    e.preventDefault();
//////    setError("");
//////    setMessage("");

//////    const q = parseFloat(qty);
//////    const r = parseFloat(rate);

//////    if (!supplier || !itemCode || isNaN(q) || q <= 0) {
//////      setError("Please select supplier, item and enter valid quantity.");
//////      return;
//////    }

//////    if (!poDate) {
//////      setError("Please select Purchase Order Date.");
//////      return;
//////    }

//////    if (!receivedByDate) {
//////      setError("Please select Received By date.");
//////      return;
//////    }

//////    const selectedSupplier = suppliers.find(
//////      (s) => s.supplier_name === supplier || s.name === supplier
//////    );
//////    if (!selectedSupplier) {
//////      setError("Please select a valid supplier from the list.");
//////      return;
//////    }
//////    const supplierId = selectedSupplier.name;

//////    // ✅ Validate supplier–item mapping: if there is a mapping for this item,
//////    // require that the chosen supplier is one of them.
//////    const allowedSupSet = itemToSupplierNames.get(itemCode);
//////    if (allowedSupSet && allowedSupSet.size && !allowedSupSet.has(supplierId)) {
//////      setError(
//////        `This item is linked to different supplier(s) in the Item Purchase section. Please select one of those suppliers or update the Item.`
//////      );
//////      return;
//////    }

//////    try {
//////      setSubmitting(true);

//////      if (editingPoName) {
//////        // UPDATE EXISTING DRAFT
//////        const payload = {
//////          supplier: supplierId,
//////          transaction_date: poDate,
//////          schedule_date: receivedByDate,
//////          notes: notes || "",
//////          items: [
//////            {
//////              item_code: itemCode,
//////              qty: q,
//////              rate: isNaN(r) ? 0 : r,
//////              schedule_date: receivedByDate,
//////              warehouse: warehouse || undefined,
//////            },
//////          ],
//////        };

//////        await updatePurchaseOrder(editingPoName, payload);

//////        setLastPoName(editingPoName);
//////        setMessage(`Purchase Order ${editingPoName} saved as draft.`);
//////      } else {
//////        // CREATE NEW DRAFT
//////        const po = await createPurchaseOrder({
//////          supplier: supplierId,
//////          item_code: itemCode,
//////          qty: q,
//////          rate: isNaN(r) ? 0 : r,
//////          notes,
//////          warehouse,
//////          po_date: poDate,
//////          schedule_date: receivedByDate,
//////        });

//////        const poName = po.data?.name;

//////        setLastPoName(poName || "");
//////        setEditingPoName(poName || "");
//////        setMessage(
//////          poName
//////            ? `Purchase Order created as draft: ${poName}`
//////            : `Purchase Order created (draft)`
//////        );
//////      }
//////    } catch (err) {
//////      console.error(err);
//////      setError(
//////        err.response?.data?.error?.message ||
//////          err.message ||
//////          "Failed to create/update Purchase Order"
//////      );
//////    } finally {
//////      setSubmitting(false);
//////    }
//////  }

//////  // ---- Submit PO ----
//////  async function handleSubmitPo() {
//////    setError("");
//////    setMessage("");

//////    const poName = editingPoName || lastPoName;
//////    if (!poName) {
//////      setError("No draft Purchase Order selected to submit.");
//////      return;
//////    }

//////    try {
//////      setSubmittingPo(true);
//////      await submitDoc("Purchase Order", poName);
//////      setMessage(`Purchase Order submitted: ${poName}`);
//////      setEditingPoName("");
//////    } catch (err) {
//////      console.error(err);
//////      setError(
//////        err.response?.data?.error?.message ||
//////          err.message ||
//////          "Failed to submit Purchase Order"
//////      );
//////    } finally {
//////      setSubmittingPo(false);
//////    }
//////  }

//////  // ---- Email supplier ----
//////  async function handleEmailSupplier() {
//////    if (!lastPoName) {
//////      setError("No Purchase Order to email yet.");
//////      return;
//////    }
//////    if (!supplierEmail) {
//////      setError("Please enter supplier email address first.");
//////      return;
//////    }

//////    setError("");
//////    setMessage("");
//////    setEmailSending(true);

//////    try {
//////      await sendPurchaseOrderEmail({
//////        poName: lastPoName,
//////        recipients: supplierEmail,
//////      });
//////      setMessage(`Email sent to ${supplierEmail} for PO ${lastPoName}.`);
//////    } catch (err) {
//////      console.error(err);
//////      setError(
//////        err.response?.data?.error?.message ||
//////          err.message ||
//////          "Failed to send email"
//////      );
//////    } finally {
//////      setEmailSending(false);
//////    }
//////  }

//////  return (
//////    <div className="po-page">
//////      <div className="po-card po-card-main">
//////        <div className="po-header">
//////          <div>
//////            <h1 className="po-title">ERPNext Purchase Order (Raw Material)</h1>
//////            <p className="po-subtitle">
//////              Create ERPNext Purchase Orders for raw materials and send to
//////              suppliers.
//////            </p>
//////          </div>
//////          {lastPoName && (
//////            <div className="po-header-chip">
//////              {editingPoName ? "Editing draft" : "Last PO"}:{" "}
//////              <span>{lastPoName}</span>
//////            </div>
//////          )}
//////        </div>

//////        {loadingLists && (
//////          <p className="po-info-text">Loading suppliers/items...</p>
//////        )}
//////        {error && <p className="po-error-text">{error}</p>}
//////        {message && <p className="po-message-text">{message}</p>}

//////        <form onSubmit={handleSubmit} className="po-form-grid">
//////          {/* Left column */}
//////          <div className="po-form-column">
//////            <div className="po-field">
//////              <label className="po-label">Supplier</label>
//////              <input
//////                list="po-supplier-list"
//////                value={supplier}
//////                onChange={handleSupplierChange}
//////                disabled={loadingLists || suppliers.length === 0}
//////                className="po-input"
//////                placeholder="Type or select supplier"
//////              />
//////              <datalist id="po-supplier-list">
//////                {suppliersForCurrentItem.map((s) => (
//////                  <option
//////                    key={s.name}
//////                    value={s.supplier_name || s.name}
//////                    label={s.name}
//////                  />
//////                ))}
//////              </datalist>
//////            </div>

//////            <div className="po-field">
//////              <label className="po-label">
//////                Supplier Email{" "}
//////                <span className="po-label-hint">(optional)</span>
//////              </label>
//////              <input
//////                type="email"
//////                value={supplierEmail}
//////                onChange={(e) => setSupplierEmail(e.target.value)}
//////                placeholder="supplier@example.com"
//////                className="po-input"
//////              />
//////            </div>

//////            <div className="po-field">
//////              <label className="po-label">Notes (optional)</label>
//////              <textarea
//////                value={notes}
//////                onChange={(e) => setNotes(e.target.value)}
//////                rows={3}
//////                className="po-input po-textarea"
//////              />
//////            </div>
//////          </div>

//////          {/* Right column */}
//////          <div className="po-form-column">
//////            <div className="po-field">
//////              <label className="po-label">
//////                Item (Raw Material / Pouch / Sticker)
//////              </label>
//////              <input
//////                list="po-item-list"
//////                value={itemCode}
//////                onChange={handleItemChange}
//////                disabled={loadingLists || items.length === 0}
//////                className="po-input"
//////                placeholder="Type or select item code"
//////              />
//////              <datalist id="po-item-list">
//////                {itemsForCurrentSupplier.map((item) => (
//////                  <option
//////                    key={item.name}
//////                    value={item.name}
//////                    label={`${item.name} - ${item.item_name || ""}${
//////                      item.item_group ? " (" + item.item_group + ")" : ""
//////                    }`}
//////                  />
//////                ))}
//////              </datalist>
//////            </div>

//////            <div className="po-field po-field-inline">
//////              <div>
//////                <label className="po-label">Quantity</label>
//////                <input
//////                  type="number"
//////                  step="0.01"
//////                  value={qty}
//////                  onChange={(e) => setQty(e.target.value)}
//////                  className="po-input"
//////                />
//////              </div>
//////              <div>
//////                <label className="po-label">Rate (per unit)</label>
//////                <input
//////                  type="number"
//////                  step="0.01"
//////                  value={rate}
//////                  onChange={(e) => setRate(e.target.value)}
//////                  className="po-input"
//////                />
//////              </div>
//////            </div>

//////            <div className="po-field po-field-inline">
//////              <div>
//////                <label className="po-label">Purchase Order Date</label>
//////                <input
//////                  type="date"
//////                  value={poDate}
//////                  onChange={(e) => setPoDate(e.target.value)}
//////                  className="po-input"
//////                />
//////              </div>
//////              <div>
//////                <label className="po-label">Received By (Schedule Date)</label>
//////                <input
//////                  type="date"
//////                  value={receivedByDate}
//////                  onChange={(e) => setReceivedByDate(e.target.value)}
//////                  className="po-input"
//////                />
//////              </div>
//////            </div>

//////            <div className="po-field">
//////              <label className="po-label">Warehouse</label>
//////              <input
//////                type="text"
//////                value={warehouse}
//////                onChange={(e) => setWarehouse(e.target.value)}
//////                placeholder="Raw Material - MF"
//////                className="po-input"
//////              />
//////            </div>

//////            <div className="po-actions-main">
//////              <button
//////                type="submit"
//////                disabled={submitting || loadingLists}
//////                className="po-btn po-btn-primary"
//////              >
//////                {submitting
//////                  ? editingPoName
//////                    ? "Saving Draft..."
//////                    : "Creating Draft..."
//////                  : editingPoName
//////                  ? "Save Draft"
//////                  : "Create Draft"}
//////              </button>

//////              <button
//////                type="button"
//////                onClick={handleSubmitPo}
//////                disabled={submittingPo || loadingLists}
//////                className="po-btn po-btn-outline"
//////              >
//////                {submittingPo ? "Submitting..." : "Submit Purchase Order"}
//////              </button>
//////            </div>
//////          </div>
//////        </form>

//////        {lastPoName && (
//////          <div className="po-after-actions">
//////            <button
//////              type="button"
//////              onClick={handleEmailSupplier}
//////              disabled={emailSending || !supplierEmail}
//////              className="po-btn po-btn-accent"
//////            >
//////              {emailSending ? "Sending email..." : "Email Supplier"}
//////            </button>

//////            <a
//////              href={getPurchaseOrderPdfUrl(lastPoName)}
//////              target="_blank"
//////              rel="noreferrer"
//////            >
//////              <button type="button" className="po-btn po-btn-outline">
//////                Download PDF
//////              </button>
//////            </a>
//////          </div>
//////        )}
//////      </div>

//////      <div className="po-card po-card-list">
//////        <PurchaseOrderList onEditPo={handleEditPo} />
//////      </div>
//////    </div>
//////  );
//////}

//////export default PurchaseOrder;


////// src/PurchaseOrder.jsx
////import React, { useEffect, useState, useMemo } from "react";
////import {
////  getSuppliers,
////  getItemsForPO,
////  createPurchaseOrder,
////  submitDoc,
////  sendPurchaseOrderEmail,
////  getPurchaseOrderPdfUrl,
////  getPurchaseOrderWithItems,
////  updatePurchaseOrder,
////  getItemSuppliers, // 👈 mapping from Item "Supplier Items" child table
////} from "./erpBackendApi";
////import PurchaseOrderList from "./PurchaseOrderList";
////import "../CSS/PurchaseOrder.css";

////function PurchaseOrder() {
////  const [suppliers, setSuppliers] = useState([]);
////  const [items, setItems] = useState([]);
////  const [itemSuppliers, setItemSuppliers] = useState([]); // rows from Item Supplier child table

////  // supplier = what user sees (supplier_name), not the ID
////  const [supplier, setSupplier] = useState("");
////  const [supplierEmail, setSupplierEmail] = useState("");
////  const [itemCode, setItemCode] = useState("");

////  const [qty, setQty] = useState("1.00");
////  const [rate, setRate] = useState("0.00");
////  const [warehouse, setWarehouse] = useState("Raw Material - MF"); // default warehouse
////  const [notes, setNotes] = useState("");

////  const todayStr = new Date().toISOString().slice(0, 10);
////  const [poDate, setPoDate] = useState(todayStr); // transaction_date
////  const [receivedByDate, setReceivedByDate] = useState(todayStr); // schedule_date

////  const [lastPoName, setLastPoName] = useState("");
////  const [editingPoName, setEditingPoName] = useState(""); // which draft is being edited

////  const [loadingLists, setLoadingLists] = useState(false);
////  const [submitting, setSubmitting] = useState(false);
////  const [submittingPo, setSubmittingPo] = useState(false);
////  const [emailSending, setEmailSending] = useState(false);

////  const [error, setError] = useState("");
////  const [message, setMessage] = useState("");

////  // ---------------- Load suppliers, items, and Item Supplier mapping -------------
////  useEffect(() => {
////    async function loadLists() {
////      try {
////        setLoadingLists(true);
////        setError("");

////        const [suppliersData, itemsData, itemSupData] = await Promise.all([
////          getSuppliers(),
////          getItemsForPO(),
////          getItemSuppliers(), // Item Supplier child rows
////        ]);

////        setSuppliers(suppliersData || []);
////        setItems(itemsData || []);
////        setItemSuppliers(itemSupData || []);

////        // default supplier + email
////        if (suppliersData && suppliersData.length > 0) {
////          const s0 = suppliersData[0];
////          setSupplier(s0.supplier_name || s0.name);
////          setSupplierEmail(s0.supplier_email || s0.email_id || "");
////        }

////        // default item
////        if (itemsData && itemsData.length > 0) {
////          setItemCode(itemsData[0].name);
////        }
////      } catch (err) {
////        console.error(err);
////        setError("Failed to load suppliers/items");
////      } finally {
////        setLoadingLists(false);
////      }
////    }

////    loadLists();
////  }, []);

////  // -------- Helper: currently selected supplier row & ID ----------------
////  const selectedSupplierRow = useMemo(
////    () =>
////      suppliers.find(
////        (s) => s.supplier_name === supplier || s.name === supplier
////      ),
////    [suppliers, supplier]
////  );
////  const selectedSupplierId = selectedSupplierRow?.name || "";

////  // -------- Build mapping: supplier -> item_codes ----------------
////  const supplierToItemNames = useMemo(() => {
////    const map = new Map(); // supplierId -> Set(itemCode)
////    for (const row of itemSuppliers) {
////      const sup = row.supplier;
////      const item = row.parent; // parent = Item code
////      if (!sup || !item) continue;
////      if (!map.has(sup)) map.set(sup, new Set());
////      map.get(sup).add(item);
////    }
////    return map;
////  }, [itemSuppliers]);

////  // -------- Build mapping: item_code -> supplierIds ----------------
////  const itemToSupplierNames = useMemo(() => {
////    const map = new Map(); // itemCode -> Set(supplierId)
////    for (const row of itemSuppliers) {
////      const sup = row.supplier;
////      const item = row.parent;
////      if (!sup || !item) continue;
////      if (!map.has(item)) map.set(item, new Set());
////      map.get(item).add(sup);
////    }
////    return map;
////  }, [itemSuppliers]);

////  // -------- Items filtered by currently selected supplier -----------
////  const itemsForCurrentSupplier = useMemo(() => {
////    if (!selectedSupplierId) return items;

////    const allowedItemsSet = supplierToItemNames.get(selectedSupplierId);
////    if (!allowedItemsSet || !allowedItemsSet.size) {
////      // supplier not linked to any items → show all
////      return items;
////    }
////    const filtered = items.filter((it) => allowedItemsSet.has(it.name));
////    return filtered.length ? filtered : items;
////  }, [items, supplierToItemNames, selectedSupplierId]);

////  // -------- Suppliers filtered by currently selected item ---------
////  const suppliersForCurrentItem = useMemo(() => {
////    if (!itemCode) return suppliers;

////    const allowedSupSet = itemToSupplierNames.get(itemCode);
////    if (!allowedSupSet || !allowedSupSet.size) {
////      // item not linked to any suppliers → show all
////      return suppliers;
////    }
////    const filtered = suppliers.filter((s) => allowedSupSet.has(s.name));
////    return filtered.length ? filtered : suppliers;
////  }, [suppliers, itemToSupplierNames, itemCode]);

////  // -------------------- Supplier change --------------------
////  function handleSupplierChange(e) {
////    const value = e.target.value;
////    setSupplier(value);

////    const s = suppliers.find(
////      (sup) => sup.supplier_name === value || sup.name === value
////    );

////    if (s) {
////      setSupplierEmail(s.supplier_email || s.email_id || "");
////    } else {
////      setSupplierEmail("");
////    }

////    // Auto-adjust item if current item is not supplied by this supplier
////    const supplierId = s?.name;
////    if (supplierId && items.length) {
////      const allowedItemsSet = supplierToItemNames.get(supplierId);
////      if (allowedItemsSet && allowedItemsSet.size) {
////        const currentItemAllowed = itemCode && allowedItemsSet.has(itemCode);
////        if (!currentItemAllowed) {
////          const firstAllowedItem = items.find((it) =>
////            allowedItemsSet.has(it.name)
////          );
////          if (firstAllowedItem) {
////            setItemCode(firstAllowedItem.name);
////          }
////        }
////      }
////    }
////  }

////  // -------------------- Item change --------------------
////  function handleItemChange(e) {
////    const value = e.target.value;
////    setItemCode(value);

////    if (!value) return;

////    // If item has specific suppliers, auto-pick one if current supplier not allowed
////    const allowedSupSet = itemToSupplierNames.get(value);
////    if (allowedSupSet && allowedSupSet.size) {
////      const currentSupplierOk =
////        selectedSupplierId && allowedSupSet.has(selectedSupplierId);

////      if (!currentSupplierOk) {
////        const firstAllowedSupId = Array.from(allowedSupSet)[0];
////        const supRow = suppliers.find((s) => s.name === firstAllowedSupId);
////        if (supRow) {
////          const displaySupplier = supRow.supplier_name || supRow.name;
////          setSupplier(displaySupplier);
////          setSupplierEmail(supRow.supplier_email || supRow.email_id || "");
////        }
////      }
////    }
////  }

////  // -------------------- Load existing draft PO for editing --------------------
////  async function handleEditPo(poName) {
////    try {
////      setError("");
////      setMessage(`Loading draft Purchase Order ${poName} for editing...`);
////      const po = await getPurchaseOrderWithItems(poName);

////      const firstItem = (po.items || [])[0] || {};

////      const supRow = suppliers.find((s) => s.name === po.supplier);
////      const displaySupplier = supRow?.supplier_name || po.supplier;

////      setSupplier(displaySupplier);
////      setSupplierEmail(supRow?.supplier_email || supRow?.email_id || "");

////      setItemCode(firstItem.item_code || "");
////      setQty(firstItem.qty != null ? String(firstItem.qty) : "1.00");
////      setRate(firstItem.rate != null ? String(firstItem.rate) : "0.00");
////      setWarehouse(firstItem.warehouse || "Raw Material - MF");
////      setNotes(po.notes || "");

////      setPoDate(po.transaction_date || todayStr);
////      setReceivedByDate(
////        firstItem.schedule_date ||
////          po.schedule_date ||
////          po.transaction_date ||
////          todayStr
////      );

////      setEditingPoName(po.name);
////      setLastPoName(po.name);
////      setMessage(`Editing draft Purchase Order ${poName}.`);
////    } catch (err) {
////      console.error(err);
////      setError(
////        err.response?.data?.error?.message ||
////          err.message ||
////          "Failed to load Purchase Order for editing"
////      );
////    }
////  }

////  // -------------------- Create / save draft --------------------
////  async function handleSubmit(e) {
////    e.preventDefault();
////    setError("");
////    setMessage("");

////    const q = parseFloat(qty);
////    const r = parseFloat(rate);

////    if (!supplier || !itemCode || isNaN(q) || q <= 0) {
////      setError("Please select supplier, item and enter valid quantity.");
////      return;
////    }

////    if (!poDate) {
////      setError("Please select Purchase Order Date.");
////      return;
////    }

////    if (!receivedByDate) {
////      setError("Please select Received By date.");
////      return;
////    }

////    const selectedSupplier = suppliers.find(
////      (s) => s.supplier_name === supplier || s.name === supplier
////    );
////    if (!selectedSupplier) {
////      setError("Please select a valid supplier from the list.");
////      return;
////    }
////    const supplierId = selectedSupplier.name;

////    // Validate: if item is linked to specific suppliers, chosen supplier must be one of them
////    const allowedSupSet = itemToSupplierNames.get(itemCode);
////    if (allowedSupSet && allowedSupSet.size && !allowedSupSet.has(supplierId)) {
////      setError(
////        "This item is linked to different supplier(s) in the Item form. Please select one of those suppliers or update the Item."
////      );
////      return;
////    }

////    try {
////      setSubmitting(true);

////      if (editingPoName) {
////        // UPDATE EXISTING DRAFT
////        const payload = {
////          supplier: supplierId,
////          transaction_date: poDate,
////          schedule_date: receivedByDate,
////          notes: notes || "",
////          items: [
////            {
////              item_code: itemCode,
////              qty: q,
////              rate: isNaN(r) ? 0 : r,
////              schedule_date: receivedByDate,
////              warehouse: warehouse || undefined,
////            },
////          ],
////        };

////        await updatePurchaseOrder(editingPoName, payload);

////        setLastPoName(editingPoName);
////        setMessage(`Purchase Order ${editingPoName} saved as draft.`);
////      } else {
////        // CREATE NEW DRAFT
////        const po = await createPurchaseOrder({
////          supplier: supplierId,
////          item_code: itemCode,
////          qty: q,
////          rate: isNaN(r) ? 0 : r,
////          notes,
////          warehouse,
////          po_date: poDate,
////          schedule_date: receivedByDate,
////        });

////        const poName = po.data?.name;

////        setLastPoName(poName || "");
////        setEditingPoName(poName || "");
////        setMessage(
////          poName
////            ? `Purchase Order created as draft: ${poName}`
////            : "Purchase Order created (draft)"
////        );
////      }
////    } catch (err) {
////      console.error(err);
////      setError(
////        err.response?.data?.error?.message ||
////          err.message ||
////          "Failed to create/update Purchase Order"
////      );
////    } finally {
////      setSubmitting(false);
////    }
////  }

////  // -------------------- Submit PO --------------------
////  async function handleSubmitPo() {
////    setError("");
////    setMessage("");

////    const poName = editingPoName || lastPoName;
////    if (!poName) {
////      setError("No draft Purchase Order selected to submit.");
////      return;
////    }

////    try {
////      setSubmittingPo(true);
////      await submitDoc("Purchase Order", poName);
////      setMessage(`Purchase Order submitted: ${poName}`);
////      setEditingPoName("");
////    } catch (err) {
////      console.error(err);
////      setError(
////        err.response?.data?.error?.message ||
////          err.message ||
////          "Failed to submit Purchase Order"
////      );
////    } finally {
////      setSubmittingPo(false);
////    }
////  }

////  // -------------------- Email supplier --------------------
////  async function handleEmailSupplier() {
////    if (!lastPoName) {
////      setError("No Purchase Order to email yet.");
////      return;
////    }
////    if (!supplierEmail) {
////      setError("Please enter supplier email address first.");
////      return;
////    }

////    setError("");
////    setMessage("");
////    setEmailSending(true);

////    try {
////      await sendPurchaseOrderEmail({
////        poName: lastPoName,
////        recipients: supplierEmail,
////      });
////      setMessage(`Email sent to ${supplierEmail} for PO ${lastPoName}.`);
////    } catch (err) {
////      console.error(err);
////      setError(
////        err.response?.data?.error?.message ||
////          err.message ||
////          "Failed to send email"
////      );
////    } finally {
////      setEmailSending(false);
////    }
////  }

////  // -------------------- JSX --------------------
////  return (
////    <div className="po-page">
////      <div className="po-card po-card-main">
////        <div className="po-header">
////          <div>
////            <h1 className="po-title">ERPNext Purchase Order (Raw Material)</h1>
////            <p className="po-subtitle">
////              Create ERPNext Purchase Orders for raw materials and send to
////              suppliers.
////            </p>
////          </div>
////          {lastPoName && (
////            <div className="po-header-chip">
////              {editingPoName ? "Editing draft" : "Last PO"}:{" "}
////              <span>{lastPoName}</span>
////            </div>
////          )}
////        </div>

////        {loadingLists && (
////          <p className="po-info-text">Loading suppliers/items...</p>
////        )}
////        {error && <p className="po-error-text">{error}</p>}
////        {message && <p className="po-message-text">{message}</p>}

////        <form onSubmit={handleSubmit} className="po-form-grid">
////          {/* Left column */}
////          <div className="po-form-column">
////            <div className="po-field">
////              <label className="po-label">Supplier</label>
////              <input
////                list="po-supplier-list"
////                value={supplier}
////                onChange={handleSupplierChange}
////                disabled={loadingLists || suppliers.length === 0}
////                className="po-input"
////                placeholder="Type or select supplier"
////              />
////              <datalist id="po-supplier-list">
////                {suppliersForCurrentItem.map((s) => (
////                  <option
////                    key={s.name}
////                    value={s.supplier_name || s.name}
////                    label={s.name}
////                  />
////                ))}
////              </datalist>
////            </div>

////            <div className="po-field">
////              <label className="po-label">
////                Supplier Email{" "}
////                <span className="po-label-hint">(optional)</span>
////              </label>
////              <input
////                type="email"
////                value={supplierEmail}
////                onChange={(e) => setSupplierEmail(e.target.value)}
////                placeholder="supplier@example.com"
////                className="po-input"
////              />
////            </div>

////            <div className="po-field">
////              <label className="po-label">Notes (optional)</label>
////              <textarea
////                value={notes}
////                onChange={(e) => setNotes(e.target.value)}
////                rows={3}
////                className="po-input po-textarea"
////              />
////            </div>
////          </div>

////          {/* Right column */}
////          <div className="po-form-column">
////            <div className="po-field">
////              <label className="po-label">
////                Item (Raw Material / Pouch / Sticker)
////              </label>
////              <input
////                list="po-item-list"
////                value={itemCode}
////                onChange={handleItemChange}
////                disabled={loadingLists || items.length === 0}
////                className="po-input"
////                placeholder="Type or select item code"
////              />
////              <datalist id="po-item-list">
////                {itemsForCurrentSupplier.map((item) => (
////                  <option
////                    key={item.name}
////                    value={item.name}
////                    label={`${item.name} - ${item.item_name || ""}${
////                      item.item_group ? " (" + item.item_group + ")" : ""
////                    }`}
////                  />
////                ))}
////              </datalist>
////            </div>

////            <div className="po-field po-field-inline">
////              <div>
////                <label className="po-label">Quantity</label>
////                <input
////                  type="number"
////                  step="0.01"
////                  value={qty}
////                  onChange={(e) => setQty(e.target.value)}
////                  className="po-input"
////                />
////              </div>
////              <div>
////                <label className="po-label">Rate (per unit)</label>
////                <input
////                  type="number"
////                  step="0.01"
////                  value={rate}
////                  onChange={(e) => setRate(e.target.value)}
////                  className="po-input"
////                />
////              </div>
////            </div>

////            <div className="po-field po-field-inline">
////              <div>
////                <label className="po-label">Purchase Order Date</label>
////                <input
////                  type="date"
////                  value={poDate}
////                  onChange={(e) => setPoDate(e.target.value)}
////                  className="po-input"
////                />
////              </div>
////              <div>
////                <label className="po-label">Received By (Schedule Date)</label>
////                <input
////                  type="date"
////                  value={receivedByDate}
////                  onChange={(e) => setReceivedByDate(e.target.value)}
////                  className="po-input"
////                />
////              </div>
////            </div>

////            <div className="po-field">
////              <label className="po-label">Warehouse</label>
////              <input
////                type="text"
////                value={warehouse}
////                onChange={(e) => setWarehouse(e.target.value)}
////                placeholder="Raw Material - MF"
////                className="po-input"
////              />
////            </div>

////            <div className="po-actions-main">
////              <button
////                type="submit"
////                disabled={submitting || loadingLists}
////                className="po-btn po-btn-primary"
////              >
////                {submitting
////                  ? editingPoName
////                    ? "Saving Draft..."
////                    : "Creating Draft..."
////                  : editingPoName
////                  ? "Save Draft"
////                  : "Create Draft"}
////              </button>

////              <button
////                type="button"
////                onClick={handleSubmitPo}
////                disabled={submittingPo || loadingLists}
////                className="po-btn po-btn-outline"
////              >
////                {submittingPo ? "Submitting..." : "Submit Purchase Order"}
////              </button>
////            </div>
////          </div>
////        </form>

////        {lastPoName && (
////          <div className="po-after-actions">
////            <button
////              type="button"
////              onClick={handleEmailSupplier}
////              disabled={emailSending || !supplierEmail}
////              className="po-btn po-btn-accent"
////            >
////              {emailSending ? "Sending email..." : "Email Supplier"}
////            </button>

////            <a
////              href={getPurchaseOrderPdfUrl(lastPoName)}
////              target="_blank"
////              rel="noreferrer"
////            >
////              <button type="button" className="po-btn po-btn-outline">
////                Download PDF
////              </button>
////            </a>
////          </div>
////        )}
////      </div>

////      <div className="po-card po-card-list">
////        <PurchaseOrderList onEditPo={handleEditPo} />
////      </div>
////    </div>
////  );
////}

////export default PurchaseOrder;


//// src/PurchaseOrder.jsx
//import React, { useEffect, useState, useMemo } from "react";
//import {
//  getSuppliers,
//  getItemsForPO,
//  createPurchaseOrder,
//  submitDoc,
//  sendPurchaseOrderEmail,
//  getPurchaseOrderPdfUrl,
//  getPurchaseOrderWithItems,
//  updatePurchaseOrder,
//  deletePurchaseOrder,
//  getItemSuppliers, // mapping from Item "Supplier Items" child table
//} from "./erpBackendApi";
//import PurchaseOrderList from "./PurchaseOrderList";
//import "../CSS/PurchaseOrder.css";

//function PurchaseOrder() {
//  const [suppliers, setSuppliers] = useState([]);
//  const [items, setItems] = useState([]);
//  const [itemSuppliers, setItemSuppliers] = useState([]); // rows from Item Supplier child table

//  // supplier = what user sees (supplier_name), not the ID
//  const [supplier, setSupplier] = useState("");
//  const [supplierEmail, setSupplierEmail] = useState("");
//  const [itemCode, setItemCode] = useState("");

//  const [qty, setQty] = useState("1.00");
//  const [rate, setRate] = useState("0.00");
//  const [warehouse, setWarehouse] = useState("Raw Material - MF"); // default warehouse
//  const [notes, setNotes] = useState("");

//  const todayStr = new Date().toISOString().slice(0, 10);
//  const [poDate, setPoDate] = useState(todayStr); // transaction_date
//  const [receivedByDate, setReceivedByDate] = useState(todayStr); // schedule_date

//  const [lastPoName, setLastPoName] = useState("");
//  const [editingPoName, setEditingPoName] = useState(""); // which draft is being edited

//  const [loadingLists, setLoadingLists] = useState(false);
//  const [submitting, setSubmitting] = useState(false);
//  const [submittingPo, setSubmittingPo] = useState(false);
//  const [emailSending, setEmailSending] = useState(false);

//  const [error, setError] = useState("");
//  const [message, setMessage] = useState("");

//  // ---------------- Load suppliers, items, and Item Supplier mapping -------------
//  useEffect(() => {
//    async function loadLists() {
//      try {
//        setLoadingLists(true);
//        setError("");

//        const [suppliersData, itemsData, itemSupData] = await Promise.all([
//          getSuppliers(),
//          getItemsForPO(),
//          getItemSuppliers(), // Item Supplier child rows
//        ]);

//        setSuppliers(suppliersData || []);
//        setItems(itemsData || []);
//        setItemSuppliers(itemSupData || []);

//        // ---- INITIAL DEFAULTS (fixed logic) ----
//        if (suppliersData && suppliersData.length > 0) {
//          const s0 = suppliersData[0];
//          const displayName = s0.supplier_name || s0.name;
//          const email = s0.supplier_email || s0.email_id || "";

//          let initialItemCode = "";

//          if (itemsData && itemsData.length > 0) {
//            // find items that this supplier actually supplies
//            const rowsForS0 = (itemSupData || []).filter(
//              (row) => row.supplier === s0.name
//            );
//            const allowedSet = new Set(rowsForS0.map((row) => row.parent));

//            if (allowedSet.size) {
//              const firstAllowedItem = itemsData.find((it) =>
//                allowedSet.has(it.name)
//              );
//              if (firstAllowedItem) {
//                initialItemCode = firstAllowedItem.name; // ✅ item really from this supplier
//              }
//            }

//            // if supplier has no mapped items, or no match found → fall back to first item
//            if (!initialItemCode) {
//              initialItemCode = itemsData[0].name;
//            }
//          }

//          setSupplier(displayName);
//          setSupplierEmail(email);
//          if (initialItemCode) setItemCode(initialItemCode);
//        } else if (itemsData && itemsData.length > 0) {
//          // no suppliers but we do have items
//          setItemCode(itemsData[0].name);
//        }
//      } catch (err) {
//        console.error(err);
//        setError("Failed to load suppliers/items");
//      } finally {
//        setLoadingLists(false);
//      }
//    }

//    loadLists();
//  }, []);

//  // -------- Helper: currently selected supplier row & ID ----------------
//  const selectedSupplierRow = useMemo(
//    () =>
//      suppliers.find(
//        (s) => s.supplier_name === supplier || s.name === supplier
//      ),
//    [suppliers, supplier]
//  );
//  const selectedSupplierId = selectedSupplierRow?.name || "";

//  // -------- Build mapping: supplier -> item_codes ----------------
//  const supplierToItemNames = useMemo(() => {
//    const map = new Map(); // supplierId -> Set(itemCode)
//    for (const row of itemSuppliers) {
//      const sup = row.supplier;
//      const item = row.parent; // parent = Item code
//      if (!sup || !item) continue;
//      if (!map.has(sup)) map.set(sup, new Set());
//      map.get(sup).add(item);
//    }
//    return map;
//  }, [itemSuppliers]);

//  // -------- Build mapping: item_code -> supplierIds ----------------
//  const itemToSupplierNames = useMemo(() => {
//    const map = new Map(); // itemCode -> Set(supplierId)
//    for (const row of itemSuppliers) {
//      const sup = row.supplier;
//      const item = row.parent;
//      if (!sup || !item) continue;
//      if (!map.has(item)) map.set(item, new Set());
//      map.get(item).add(sup);
//    }
//    return map;
//  }, [itemSuppliers]);

//  // -------- Items filtered by currently selected supplier -----------
//  const itemsForCurrentSupplier = useMemo(() => {
//    if (!selectedSupplierId) return items;

//    const allowedItemsSet = supplierToItemNames.get(selectedSupplierId);
//    if (!allowedItemsSet || !allowedItemsSet.size) {
//      // supplier not linked to any items → show all
//      return items;
//    }
//    const filtered = items.filter((it) => allowedItemsSet.has(it.name));
//    return filtered.length ? filtered : items;
//  }, [items, supplierToItemNames, selectedSupplierId]);

//  // -------- Suppliers filtered by currently selected item ---------
//  const suppliersForCurrentItem = useMemo(() => {
//    if (!itemCode) return suppliers;

//    const allowedSupSet = itemToSupplierNames.get(itemCode);
//    if (!allowedSupSet || !allowedSupSet.size) {
//      // item not linked to any suppliers → show all
//      return suppliers;
//    }
//    const filtered = suppliers.filter((s) => allowedSupSet.has(s.name));
//    return filtered.length ? filtered : suppliers;
//  }, [suppliers, itemToSupplierNames, itemCode]);

//  // -------------------- Supplier change --------------------
//  function handleSupplierChange(e) {
//    const value = e.target.value;
//    setSupplier(value);

//    const s = suppliers.find(
//      (sup) => sup.supplier_name === value || sup.name === value
//    );

//    if (s) {
//      setSupplierEmail(s.supplier_email || s.email_id || "");
//    } else {
//      setSupplierEmail("");
//    }

//    // Auto-adjust item if current item is not supplied by this supplier
//    const supplierId = s?.name;
//    if (supplierId && items.length) {
//      const allowedItemsSet = supplierToItemNames.get(supplierId);
//      if (allowedItemsSet && allowedItemsSet.size) {
//        const currentItemAllowed = itemCode && allowedItemsSet.has(itemCode);
//        if (!currentItemAllowed) {
//          const firstAllowedItem = items.find((it) =>
//            allowedItemsSet.has(it.name)
//          );
//          if (firstAllowedItem) {
//            setItemCode(firstAllowedItem.name);
//          }
//        }
//      }
//    }
//  }

//  // -------------------- Item change --------------------
//  function handleItemChange(e) {
//    const value = e.target.value;
//    setItemCode(value);

//    if (!value) return;

//    // If item has specific suppliers, auto-pick one if current supplier not allowed
//    const allowedSupSet = itemToSupplierNames.get(value);
//    if (allowedSupSet && allowedSupSet.size) {
//      const currentSupplierOk =
//        selectedSupplierId && allowedSupSet.has(selectedSupplierId);

//      if (!currentSupplierOk) {
//        const firstAllowedSupId = Array.from(allowedSupSet)[0];
//        const supRow = suppliers.find((s) => s.name === firstAllowedSupId);
//        if (supRow) {
//          const displaySupplier = supRow.supplier_name || supRow.name;
//          setSupplier(displaySupplier);
//          setSupplierEmail(supRow.supplier_email || supRow.email_id || "");
//        }
//      }
//    }
//  }

//  // -------------------- Load existing draft PO for editing --------------------
//  async function handleEditPo(poName) {
//    try {
//      setError("");
//      setMessage(`Loading draft Purchase Order ${poName} for editing...`);
//      const po = await getPurchaseOrderWithItems(poName);

//      const firstItem = (po.items || [])[0] || {};

//      const supRow = suppliers.find((s) => s.name === po.supplier);
//      const displaySupplier = supRow?.supplier_name || po.supplier;

//      setSupplier(displaySupplier);
//      setSupplierEmail(supRow?.supplier_email || supRow?.email_id || "");

//      setItemCode(firstItem.item_code || "");
//      setQty(firstItem.qty != null ? String(firstItem.qty) : "1.00");
//      setRate(firstItem.rate != null ? String(firstItem.rate) : "0.00");
//      setWarehouse(firstItem.warehouse || "Raw Material - MF");
//      setNotes(po.notes || "");

//      setPoDate(po.transaction_date || todayStr);
//      setReceivedByDate(
//        firstItem.schedule_date ||
//          po.schedule_date ||
//          po.transaction_date ||
//          todayStr
//      );

//      setEditingPoName(po.name);
//      setLastPoName(po.name);
//      setMessage(`Editing draft Purchase Order ${poName}.`);
//    } catch (err) {
//      console.error(err);
//      setError(
//        err.response?.data?.error?.message ||
//          err.message ||
//          "Failed to load Purchase Order for editing"
//      );
//    }
//  }

//  // -------------------- Create / save draft --------------------
//  async function handleSubmit(e) {
//    e.preventDefault();
//    setError("");
//    setMessage("");

//    const q = parseFloat(qty);
//    const r = parseFloat(rate);

//    if (!supplier || !itemCode || isNaN(q) || q <= 0) {
//      setError("Please select supplier, item and enter valid quantity.");
//      return;
//    }

//    if (!poDate) {
//      setError("Please select Purchase Order Date.");
//      return;
//    }

//    if (!receivedByDate) {
//      setError("Please select Received By date.");
//      return;
//    }

//    const selectedSupplier = suppliers.find(
//      (s) => s.supplier_name === supplier || s.name === supplier
//    );
//    if (!selectedSupplier) {
//      setError("Please select a valid supplier from the list.");
//      return;
//    }
//    const supplierId = selectedSupplier.name;

//    // Validate: if item is linked to specific suppliers, chosen supplier must be one of them
//    const allowedSupSet = itemToSupplierNames.get(itemCode);
//    if (allowedSupSet && allowedSupSet.size && !allowedSupSet.has(supplierId)) {
//      setError(
//        "This item is linked to different supplier(s) in the Item form. Please select one of those suppliers or update the Item."
//      );
//      return;
//    }

//    try {
//      setSubmitting(true);

//      if (editingPoName) {
//        // UPDATE EXISTING DRAFT
//        const payload = {
//          supplier: supplierId,
//          transaction_date: poDate,
//          schedule_date: receivedByDate,
//          notes: notes || "",
//          items: [
//            {
//              item_code: itemCode,
//              qty: q,
//              rate: isNaN(r) ? 0 : r,
//              schedule_date: receivedByDate,
//              warehouse: warehouse || undefined,
//            },
//          ],
//        };

//        await updatePurchaseOrder(editingPoName, payload);

//        setLastPoName(editingPoName);
//        setMessage(`Purchase Order ${editingPoName} saved as draft.`);
//      } else {
//        // CREATE NEW DRAFT
//        const po = await createPurchaseOrder({
//          supplier: supplierId,
//          item_code: itemCode,
//          qty: q,
//          rate: isNaN(r) ? 0 : r,
//          notes,
//          warehouse,
//          po_date: poDate,
//          schedule_date: receivedByDate,
//        });

//        const poName = po.data?.name;

//        setLastPoName(poName || "");
//        setEditingPoName(poName || "");
//        setMessage(
//          poName
//            ? `Purchase Order created as draft: ${poName}`
//            : "Purchase Order created (draft)"
//        );
//      }
//    } catch (err) {
//      console.error(err);
//      setError(
//        err.response?.data?.error?.message ||
//          err.message ||
//          "Failed to create/update Purchase Order"
//      );
//    } finally {
//      setSubmitting(false);
//    }
//  }

//  // -------------------- Submit PO --------------------
//  async function handleSubmitPo() {
//    setError("");
//    setMessage("");

//    const poName = editingPoName || lastPoName;
//    if (!poName) {
//      setError("No draft Purchase Order selected to submit.");
//      return;
//    }

//    try {
//      setSubmittingPo(true);
//      await submitDoc("Purchase Order", poName);
//      setMessage(`Purchase Order submitted: ${poName}`);
//      setEditingPoName("");
//    } catch (err) {
//      console.error(err);
//      setError(
//        err.response?.data?.error?.message ||
//          err.message ||
//          "Failed to submit Purchase Order"
//      );
//    } finally {
//      setSubmittingPo(false);
//    }
//  }

//  // -------------------- Email supplier --------------------
//  async function handleEmailSupplier() {
//    if (!lastPoName) {
//      setError("No Purchase Order to email yet.");
//      return;
//    }
//    if (!supplierEmail) {
//      setError("Please enter supplier email address first.");
//      return;
//    }

//    setError("");
//    setMessage("");
//    setEmailSending(true);

//    try {
//      await sendPurchaseOrderEmail({
//        poName: lastPoName,
//        recipients: supplierEmail,
//      });
//      setMessage(`Email sent to ${supplierEmail} for PO ${lastPoName}.`);
//    } catch (err) {
//      console.error(err);
//      setError(
//        err.response?.data?.error?.message ||
//          err.message ||
//          "Failed to send email"
//      );
//    } finally {
//      setEmailSending(false);
//    }
//  }
//  async function handleDeleteDraftPo() {
//    setError("");
//    setMessage("");

//    const poName = editingPoName || lastPoName;
//    if (!poName) {
//      setError("No draft Purchase Order selected to delete.");
//      return;
//    }

//    const ok = window.confirm(
//      `Delete draft Purchase Order ${poName}? This cannot be undone.`
//    );
//    if (!ok) return;

//    try {
//      setDeletingPo(true);
//      await deletePurchaseOrder(poName);
//      setMessage(`Draft Purchase Order deleted: ${poName}`);

//      // reset form state after deletion
//      setEditingPoName("");
//      setLastPoName("");
//      setQty("1.00");
//      setRate("0.00");
//      setNotes("");
//    } catch (err) {
//      console.error(err);
//      setError(
//        err.response?.data?.error?.message ||
//          err.message ||
//          "Failed to delete draft Purchase Order"
//      );
//    } finally {
//      setDeletingPo(false);
//    }
//  }
//  return (
//    <div className="po-page">
//      <div className="po-card po-card-main">
//        <div className="po-header">
//          <div>
//            <h1 className="po-title">Purchase Order (Raw Material)</h1>
//            <p className="po-subtitle">
//              Create ERPNext Purchase Orders for raw materials and send to
//              suppliers.
//            </p>
//          </div>
//          {lastPoName && (
//            <div className="po-header-chip">
//              {editingPoName ? "Editing draft" : "Last PO"}:{" "}
//              <span>{lastPoName}</span>
//            </div>
//          )}
//        </div>

//        {loadingLists && (
//          <p className="po-info-text">Loading suppliers/items...</p>
//        )}
//        {error && <p className="po-error-text">{error}</p>}
//        {message && <p className="po-message-text">{message}</p>}

//        <form onSubmit={handleSubmit} className="po-form-grid">
//          {/* Left column */}
//          <div className="po-form-column">
//            <div className="po-field">
//              <label className="po-label">Supplier</label>
//              <input
//                list="po-supplier-list"
//                value={supplier}
//                onChange={handleSupplierChange}
//                disabled={loadingLists || suppliers.length === 0}
//                className="po-input"
//                placeholder="Type or select supplier"
//              />
//              <datalist id="po-supplier-list">
//                {suppliersForCurrentItem.map((s) => (
//                  <option
//                    key={s.name}
//                    value={s.supplier_name || s.name}
//                    label={s.name}
//                  />
//                ))}
//              </datalist>
//            </div>

//            <div className="po-field">
//              <label className="po-label">
//                Supplier Email{" "}
//                <span className="po-label-hint">(optional)</span>
//              </label>
//              <input
//                type="email"
//                value={supplierEmail}
//                onChange={(e) => setSupplierEmail(e.target.value)}
//                placeholder="supplier@example.com"
//                className="po-input"
//              />
//            </div>

//            <div className="po-field">
//              <label className="po-label">Notes (optional)</label>
//              <textarea
//                value={notes}
//                onChange={(e) => setNotes(e.target.value)}
//                rows={3}
//                className="po-input po-textarea"
//              />
//            </div>
//          </div>

//          {/* Right column */}
//          <div className="po-form-column">
//            <div className="po-field">
//              <label className="po-label">
//                Item (Raw Material / Pouch / Sticker)
//              </label>
//              <input
//                list="po-item-list"
//                value={itemCode}
//                onChange={handleItemChange}
//                disabled={loadingLists || items.length === 0}
//                className="po-input"
//                placeholder="Type or select item code"
//              />
//            <datalist id="po-item-list">
//              {itemsForCurrentSupplier.map((item) => (
//                <option
//                  key={item.name}
//                  value={item.name}
//                  label={`${item.name} - ${item.item_name || ""}${
//                    item.item_group ? " (" + item.item_group + ")" : ""
//                  }`}
//                />
//              ))}
//            </datalist>
//            </div>

//            <div className="po-field po-field-inline">
//              <div>
//                <label className="po-label">Quantity</label>
//                <input
//                  type="number"
//                  step="0.01"
//                  value={qty}
//                  onChange={(e) => setQty(e.target.value)}
//                  className="po-input"
//                />
//              </div>
//              <div>
//                <label className="po-label">Rate (per unit)</label>
//                <input
//                  type="number"
//                  step="0.01"
//                  value={rate}
//                  onChange={(e) => setRate(e.target.value)}
//                  className="po-input"
//                />
//              </div>
//            </div>

//            <div className="po-field po-field-inline">
//              <div>
//                <label className="po-label">Purchase Order Date</label>
//                <input
//                  type="date"
//                  value={poDate}
//                  onChange={(e) => setPoDate(e.target.value)}
//                  className="po-input"
//                />
//              </div>
//              <div>
//                <label className="po-label">Received By (Schedule Date)</label>
//                <input
//                  type="date"
//                  value={receivedByDate}
//                  onChange={(e) => setReceivedByDate(e.target.value)}
//                  className="po-input"
//                />
//              </div>
//            </div>

//            <div className="po-field">
//              <label className="po-label">Warehouse</label>
//              <input
//                type="text"
//                value={warehouse}
//                onChange={(e) => setWarehouse(e.target.value)}
//                placeholder="Raw Material - MF"
//                className="po-input"
//              />
//            </div>

//            <div className="po-actions-main">
//              <button
//                type="submit"
//                disabled={submitting || loadingLists}
//                className="po-btn po-btn-primary"
//              >
//                {submitting
//                  ? editingPoName
//                    ? "Saving Draft..."
//                    : "Creating Draft..."
//                  : editingPoName
//                  ? "Save Draft"
//                  : "Create Draft"}
//              </button>

//              <button
//                type="button"
//                onClick={handleSubmitPo}
//                disabled={submittingPo || loadingLists}
//                className="po-btn po-btn-outline"
//              >
//                {submittingPo ? "Submitting..." : "Submit Purchase Order"}
//              </button>
//              {editingPoName && (
//                <button
//                  type="button"
//                  onClick={handleDeleteDraftPo}
//                  disabled={deletingPo || loadingLists}
//                  className="po-btn po-btn-danger"
//                >
//                  {deletingPo ? "Deleting..." : "Delete Draft PO"}
//                </button>
//              )}
//            </div>
//          </div>
//        </form>

//        {lastPoName && (
//          <div className="po-after-actions">
//            <button
//              type="button"
//              onClick={handleEmailSupplier}
//              disabled={emailSending || !supplierEmail}
//              className="po-btn po-btn-accent"
//            >
//              {emailSending ? "Sending email..." : "Email Supplier"}
//            </button>

//            <a
//              href={getPurchaseOrderPdfUrl(lastPoName)}
//              target="_blank"
//              rel="noreferrer"
//            >
//              <button type="button" className="po-btn po-btn-outline">
//                Download PDF
//              </button>
//            </a>
//          </div>
//        )}
//      </div>

//      <div className="po-card po-card-list">
//        <PurchaseOrderList onEditPo={handleEditPo} />
//      </div>
//    </div>
//  );
//}

//export default PurchaseOrder;

// src/PurchaseOrder.jsx
import React, { useEffect, useState, useMemo } from "react";
import {
  getSuppliers,
  getItemsForPO,
  createPurchaseOrder,
  submitDoc,
  sendPurchaseOrderEmail,
  getPurchaseOrderPdfUrl,
  getPurchaseOrderWithItems,
  updatePurchaseOrder,
  getItemSuppliers,     // mapping from Item "Supplier Items" child table
  deletePurchaseOrder,  // ⬅️ NEW: delete helper
} from "./erpBackendApi";
import PurchaseOrderList from "./PurchaseOrderList";
import "../CSS/PurchaseOrder.css";

function PurchaseOrder() {
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [itemSuppliers, setItemSuppliers] = useState([]); // rows from Item Supplier child table

  // supplier = what user sees (supplier_name), not the ID
  const [supplier, setSupplier] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [itemCode, setItemCode] = useState("");

  const [qty, setQty] = useState("1.00");
  const [rate, setRate] = useState("0.00");
  const [warehouse, setWarehouse] = useState("Raw Material - MF"); // default warehouse
  const [notes, setNotes] = useState("");

  const todayStr = new Date().toISOString().slice(0, 10);
  const [poDate, setPoDate] = useState(todayStr); // transaction_date
  const [receivedByDate, setReceivedByDate] = useState(todayStr); // schedule_date

  const [lastPoName, setLastPoName] = useState("");
  const [editingPoName, setEditingPoName] = useState(""); // which draft is being edited

  const [loadingLists, setLoadingLists] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittingPo, setSubmittingPo] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [deletingDraft, setDeletingDraft] = useState(false); // ⬅️ NEW

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ---------------- Load suppliers, items, and Item Supplier mapping -------------
  useEffect(() => {
    async function loadLists() {
      try {
        setLoadingLists(true);
        setError("");

        const [suppliersData, itemsData, itemSupData] = await Promise.all([
          getSuppliers(),
          getItemsForPO(),
          getItemSuppliers(), // Item Supplier child rows
        ]);

        setSuppliers(suppliersData || []);
        setItems(itemsData || []);
        setItemSuppliers(itemSupData || []);

        // ---- INITIAL DEFAULTS ----
        if (suppliersData && suppliersData.length > 0) {
          const s0 = suppliersData[0];
          const displayName = s0.supplier_name || s0.name;
          const email = s0.supplier_email || s0.email_id || "";

          let initialItemCode = "";

          if (itemsData && itemsData.length > 0) {
            // items that this supplier actually supplies
            const rowsForS0 = (itemSupData || []).filter(
              (row) => row.supplier === s0.name
            );
            const allowedSet = new Set(rowsForS0.map((row) => row.parent));

            if (allowedSet.size) {
              const firstAllowedItem = itemsData.find((it) =>
                allowedSet.has(it.name)
              );
              if (firstAllowedItem) {
                initialItemCode = firstAllowedItem.name; // item really from this supplier
              }
            }

            // if supplier has no mapped items, or no match found → fall back to first item
            if (!initialItemCode) {
              initialItemCode = itemsData[0].name;
            }
          }

          setSupplier(displayName);
          setSupplierEmail(email);
          if (initialItemCode) setItemCode(initialItemCode);
        } else if (itemsData && itemsData.length > 0) {
          // no suppliers but we do have items
          setItemCode(itemsData[0].name);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load suppliers/items");
      } finally {
        setLoadingLists(false);
      }
    }

    loadLists();
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
    const map = new Map(); // supplierId -> Set(itemCode)
    for (const row of itemSuppliers) {
      const sup = row.supplier;
      const item = row.parent; // parent = Item code
      if (!sup || !item) continue;
      if (!map.has(sup)) map.set(sup, new Set());
      map.get(sup).add(item);
    }
    return map;
  }, [itemSuppliers]);

  // -------- Build mapping: item_code -> supplierIds ----------------
  const itemToSupplierNames = useMemo(() => {
    const map = new Map(); // itemCode -> Set(supplierId)
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
    if (!allowedItemsSet || !allowedItemsSet.size) {
      // supplier not linked to any items → show all
      return items;
    }
    const filtered = items.filter((it) => allowedItemsSet.has(it.name));
    return filtered.length ? filtered : items;
  }, [items, supplierToItemNames, selectedSupplierId]);

  // -------- Suppliers filtered by currently selected item ---------
  const suppliersForCurrentItem = useMemo(() => {
    if (!itemCode) return suppliers;

    const allowedSupSet = itemToSupplierNames.get(itemCode);
    if (!allowedSupSet || !allowedSupSet.size) {
      // item not linked to any suppliers → show all
      return suppliers;
    }
    const filtered = suppliers.filter((s) => allowedSupSet.has(s.name));
    return filtered.length ? filtered : suppliers;
  }, [suppliers, itemToSupplierNames, itemCode]);

  // -------------------- Supplier change --------------------
  function handleSupplierChange(e) {
    const value = e.target.value;
    setSupplier(value);

    const s = suppliers.find(
      (sup) => sup.supplier_name === value || sup.name === value
    );

    if (s) {
      setSupplierEmail(s.supplier_email || s.email_id || "");
    } else {
      setSupplierEmail("");
    }

    // ❌ No auto-change of item. Only the suggestion list is filtered.
  }

  // -------------------- Item change --------------------
  function handleItemChange(e) {
    const value = e.target.value;
    setItemCode(value);

    // ❌ No auto-change of supplier. Only the suggestion list is filtered.
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

      setItemCode(firstItem.item_code || "");
      setQty(firstItem.qty != null ? String(firstItem.qty) : "1.00");
      setRate(firstItem.rate != null ? String(firstItem.rate) : "0.00");
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

    const q = parseFloat(qty);
    const r = parseFloat(rate);

    if (!supplier || !itemCode || isNaN(q) || q <= 0) {
      setError("Please select supplier, item and enter valid quantity.");
      return;
    }

    if (!poDate) {
      setError("Please select Purchase Order Date.");
      return;
    }

    if (!receivedByDate) {
      setError("Please select Received By date.");
      return;
    }

    const selectedSupplier = suppliers.find(
      (s) => s.supplier_name === supplier || s.name === supplier
    );
    if (!selectedSupplier) {
      setError("Please select a valid supplier from the list.");
      return;
    }
    const supplierId = selectedSupplier.name;
    // ✅ No hard validation against Item Supplier mapping.
    // The mapping only filters suggestions; any combination is allowed.

    try {
      setSubmitting(true);

      if (editingPoName) {
        // UPDATE EXISTING DRAFT
        const payload = {
          supplier: supplierId,
          transaction_date: poDate,
          schedule_date: receivedByDate,
          notes: notes || "",
          items: [
            {
              item_code: itemCode,
              qty: q,
              rate: isNaN(r) ? 0 : r,
              schedule_date: receivedByDate,
              warehouse: warehouse || undefined,
            },
          ],
        };

        await updatePurchaseOrder(editingPoName, payload);

        setLastPoName(editingPoName);
        setMessage(`Purchase Order ${editingPoName} saved as draft.`);
      } else {
        // CREATE NEW DRAFT
        const po = await createPurchaseOrder({
          supplier: supplierId,
          item_code: itemCode,
          qty: q,
          rate: isNaN(r) ? 0 : r,
          notes,
          warehouse,
          po_date: poDate,
          schedule_date: receivedByDate,
        });

        const poName = po.data?.name;

        setLastPoName(poName || "");
        setEditingPoName(poName || "");
        setMessage(
          poName
            ? `Purchase Order created as draft: ${poName}`
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
    if (!poName) {
      setError("No draft Purchase Order selected to submit.");
      return;
    }

    try {
      setSubmittingPo(true);
      await submitDoc("Purchase Order", poName);
      setMessage(`Purchase Order submitted: ${poName}`);
      setEditingPoName(""); // after submit, no more draft
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

  // -------------------- Delete draft PO (new) --------------------
  async function handleDeleteDraftPo() {
    setError("");
    setMessage("");

    const poName = editingPoName; // only drafts are deletable
    if (!poName) {
      setError("No draft Purchase Order selected to delete.");
      return;
    }

    try {
      setDeletingDraft(true);
      await deletePurchaseOrder(poName);
      setMessage(`Draft Purchase Order deleted: ${poName}`);

      // Clear draft context
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
    if (!lastPoName) {
      setError("No Purchase Order to email yet.");
      return;
    }
    if (!supplierEmail) {
      setError("Please enter supplier email address first.");
      return;
    }

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
              Create ERPNext Purchase Orders for raw materials and send to
              suppliers.
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
              <input
                list="po-supplier-list"
                value={supplier}
                onChange={handleSupplierChange}
                disabled={loadingLists || suppliers.length === 0}
                className="po-input"
                placeholder="Type or select supplier"
              />
              <datalist id="po-supplier-list">
                {suppliersForCurrentItem.map((s) => (
                  <option
                    key={s.name}
                    value={s.supplier_name || s.name}
                    label={s.name}
                  />
                ))}
              </datalist>
            </div>

            <div className="po-field">
              <label className="po-label">
                Supplier Email{" "}
                <span className="po-label-hint">(optional)</span>
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
              <label className="po-label">
                Item (Raw Material / Pouch / Sticker)
              </label>
              <input
                list="po-item-list"
                value={itemCode}
                onChange={handleItemChange}
                disabled={loadingLists || items.length === 0}
                className="po-input"
                placeholder="Type or select item code"
              />
              <datalist id="po-item-list">
                {itemsForCurrentSupplier.map((item) => (
                  <option
                    key={item.name}
                    value={item.name}
                    label={`${item.name} - ${item.item_name || ""}${
                      item.item_group ? " (" + item.item_group + ")" : ""
                    }`}
                  />
                ))}
              </datalist>
            </div>

            <div className="po-field po-field-inline">
              <div>
                <label className="po-label">Quantity</label>
                <input
                  type="number"
                  step="0.01"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="po-input"
                />
              </div>
              <div>
                <label className="po-label">Rate (per unit)</label>
                <input
                  type="number"
                  step="0.01"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="po-input"
                />
              </div>
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

            <div className="po-field">
              <label className="po-label">Warehouse</label>
              <input
                type="text"
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
                placeholder="Raw Material - MF"
                className="po-input"
              />
            </div>

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
                onClick={handleSubmitPo}
                disabled={submittingPo || loadingLists}
                className="po-btn po-btn-outline"
              >
                {submittingPo ? "Submitting..." : "Submit Purchase Order"}
              </button>

              <button
                type="button"
                onClick={handleDeleteDraftPo}
                disabled={deletingDraft || loadingLists || !editingPoName}
                className="po-btn po-btn-outline"
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

export default PurchaseOrder;
