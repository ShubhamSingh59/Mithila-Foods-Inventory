// src/PurchaseOrder.jsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  getSuppliers,
  getItemsForPO,
  getItemSuppliers,
  getTransporters,
} from "../api/master"
import {
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrderWithItems,
  setPurchaseOrderTransporter,
  MF_PO_FIELDS,
  sendPurchaseOrderEmail,
  getPurchaseOrderPdfUrl,
} from "../api/purchase"
import {
  submitDoc, 
} from "../api/core";
import {
  getItemRateFromPriceList,
} from "../api/stock";

import "./PurchaseOrder.css";
import PurchaseOrderList from "./PurchaseOrderList";
import { useOrg } from "../Context/OrgContext";

function PurchaseOrder() {
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [itemSuppliers, setItemSuppliers] = useState([]);
  const [transporters, setTransporters] = useState([]);

  const [supplier, setSupplier] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");

  const [transporter, setTransporter] = useState("");
  const { activeOrg } = useOrg();

  const [poItems, setPoItems] = useState([
    { item_code: "", qty: "1.00", rate: "", rateTouched: false },
  ]);

  const [warehouse, setWarehouse] = useState("Raw Material - MF");
  const [notes, setNotes] = useState("");

  const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

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

  // -------------------- Initialization --------------------
  useEffect(() => {
    async function loadLists() {
      try {
        setLoadingLists(true);
        setError("");

        const [supData, itemData, mapData, transData] = await Promise.all([
          getSuppliers(),
          getItemsForPO(),
          getItemSuppliers(),
          getTransporters(),
        ]);

        setSuppliers(supData || []);
        setItems(itemData || []);
        setItemSuppliers(mapData || []);
        setTransporters(transData || []);

        const params = new URLSearchParams(window.location.search);
        const qpQty = params.get("qty");
        const qpWarehouse = params.get("warehouse");

        if (qpQty) setPoItems([{ item_code: "", qty: qpQty, rate: "", rateTouched: false }]);
        if (qpWarehouse) setWarehouse(qpWarehouse);

      } catch (err) {
        console.error(err);
        setError("Failed to load master data.");
      } finally {
        setLoadingLists(false);
      }
    }
    loadLists();
  }, []);

  // ... (Rate Cache logic: fetchStandardBuyingRate) ...
  const buyingRateCacheRef = useRef(new Map());
  const rateReqTokenRef = useRef({});

  async function fetchStandardBuyingRate(itemCode) {
    const code = String(itemCode || "").trim();
    if (!code) return null;
    if (buyingRateCacheRef.current.has(code)) return buyingRateCacheRef.current.get(code);

    try {
      const row = await getItemRateFromPriceList(code, "Standard Buying");
      const rate = row?.price_list_rate != null ? Number(row.price_list_rate) : null;
      buyingRateCacheRef.current.set(code, rate);
      return rate;
    } catch (e) {
      return null;
    }
  }

  // ... (Filtering Logic: selectedSupplierRow, etc.) ...
  const selectedSupplierRow = useMemo(() =>
    suppliers.find(s => s.supplier_name === supplier || s.name === supplier),
    [suppliers, supplier]);

  const selectedSupplierId = selectedSupplierRow?.name || "";

  const supplierToItemNames = useMemo(() => {
    const map = new Map();
    itemSuppliers.forEach(row => {
      if (row.supplier && row.parent) {
        if (!map.has(row.supplier)) map.set(row.supplier, new Set());
        map.get(row.supplier).add(row.parent);
      }
    });
    return map;
  }, [itemSuppliers]);

  const itemToSupplierNames = useMemo(() => {
    const map = new Map();
    itemSuppliers.forEach(row => {
      if (row.supplier && row.parent) {
        if (!map.has(row.parent)) map.set(row.parent, new Set());
        map.get(row.parent).add(row.supplier);
      }
    });
    return map;
  }, [itemSuppliers]);

  const itemsForCurrentSupplier = useMemo(() => {
    if (!selectedSupplierId) return items;
    const allowed = supplierToItemNames.get(selectedSupplierId);
    if (!allowed || !allowed.size) return items;
    return items.filter(it => allowed.has(it.name));
  }, [items, supplierToItemNames, selectedSupplierId]);

  const supplierOptions = useMemo(() => {
    const codes = poItems.map(r => r.item_code).filter(Boolean);
    if (!codes.length) return suppliers;

    let allowed = null;
    for (const code of codes) {
      const set = itemToSupplierNames.get(code);
      if (!set || !set.size) return suppliers;
      if (allowed === null) allowed = new Set(set);
      else allowed = new Set([...allowed].filter(x => set.has(x)));
    }

    if (!allowed || !allowed.size) return suppliers;

    const filtered = suppliers.filter(s => allowed.has(s.name));
    if (supplier && !filtered.some(s => (s.supplier_name || s.name) === supplier)) {
      if (selectedSupplierRow) return [selectedSupplierRow, ...filtered];
    }
    return filtered;
  }, [suppliers, itemToSupplierNames, poItems, supplier, selectedSupplierRow]);


  function handleSupplierValueChange(displayValue, supplierObj) {
    setSupplier(displayValue);
    const s = supplierObj || suppliers.find(sup => (sup.supplier_name === displayValue || sup.name === displayValue));
    setSupplierEmail(s?.supplier_email || s?.email_id || "");

    if (s?.name) {
      const allowed = supplierToItemNames.get(s.name);
      if (allowed && allowed.size) {
        setPoItems(prev => prev.map(row =>
          (row.item_code && !allowed.has(row.item_code)) ? { ...row, item_code: "" } : row
        ));
      }
    }
  }

  function updatePoItem(idx, patch) {
    setPoItems(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addPoItem() {
    setPoItems(prev => [...prev, { item_code: "", qty: "1.00", rate: "", rateTouched: false }]);
  }

  function removePoItem(idx) {
    setPoItems(prev => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? next : [{ item_code: "", qty: "1.00", rate: "", rateTouched: false }];
    });
  }

  function handleItemValueChange(idx, code) {
    const prevCode = poItems[idx]?.item_code;

    const newItem = {
      ...poItems[idx],
      item_code: code,
      ...(prevCode !== code ? { rate: "", rateTouched: false } : {})
    };

    const nextPoItems = [...poItems];
    nextPoItems[idx] = newItem;
    setPoItems(nextPoItems);

    const token = `${Date.now()}_${idx}`;
    rateReqTokenRef.current[idx] = token;

    fetchStandardBuyingRate(code).then(rate => {
      if (rate != null && rateReqTokenRef.current[idx] === token) {
        setPoItems(prev => prev.map((r, i) => {
          if (i === idx && r.item_code === code && !r.rateTouched) {
            return { ...r, rate: String(rate) };
          }
          return r;
        }));
      }
    });
  }

  function getItemOptionsIncludingSelected(selectedCode) {
    if (!selectedCode) return itemsForCurrentSupplier;
    if (itemsForCurrentSupplier.some(it => it.name === selectedCode)) return itemsForCurrentSupplier;
    const found = items.find(it => it.name === selectedCode);
    return found ? [found, ...itemsForCurrentSupplier] : itemsForCurrentSupplier;
  }

  async function handleEditPo(poName) {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setError("");
      setMessage(`Loading ${poName}...`);
      setLoadingLists(true);

      const po = await getPurchaseOrderWithItems(poName);

      const supRow = suppliers.find(s => s.name === po.supplier);
      setSupplier(supRow?.supplier_name || po.supplier);
      setSupplierEmail(supRow?.email_id || "");
      setTransporter(po.custom_transporter || "");

      const mappedItems = (po.items || []).map(it => ({
        item_code: it.item_code || "",
        qty: String(it.qty || "1.00"),
        rate: String(it.rate || ""),
        rateTouched: true
      }));

      setPoItems(mappedItems.length ? mappedItems : [{ item_code: "", qty: "1.00", rate: "", rateTouched: false }]);
      setWarehouse(po.items?.[0]?.warehouse || "Raw Material - MF");
      setNotes(po.notes || "");
      setPoDate(po.transaction_date || todayStr);
      setReceivedByDate(po.schedule_date || todayStr);

      setEditingPoName(po.name);
      setLastPoName(po.name);

      setMessage(`Editing Draft: ${po.name}`);

    } catch (err) {
      console.error(err);
      setError("Failed to load PO for editing.");
    } finally {
      setLoadingLists(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    const validItems = poItems.filter(r => r.item_code && Number(r.qty) > 0);
    if (!supplier || !validItems.length) {
      return setError("Please select a supplier and at least one item.");
    }

    const supplierId = selectedSupplierRow?.name;
    if (!supplierId) return setError("Invalid supplier selected.");

    setSubmitting(true);

    const payloadItems = validItems.map(it => ({
      item_code: it.item_code,
      qty: Number(it.qty),
      rate: Number(it.rate),
      schedule_date: receivedByDate,
      warehouse: warehouse
    }));

    try {
      if (editingPoName) {
        await updatePurchaseOrder(editingPoName, {
          supplier: supplierId,
          transaction_date: poDate,
          schedule_date: receivedByDate,
          notes: notes,
          custom_transporter: transporter,
          items: payloadItems
        });
        setMessage(`Updated Draft: ${editingPoName}`);
      } else {
        const first = payloadItems[0];
        const res = await createPurchaseOrder({
          supplier: supplierId,
          item_code: first.item_code,
          qty: first.qty,
          rate: first.rate,
          notes,
          warehouse,
          po_date: poDate,
          schedule_date: receivedByDate
        });

        const newName = res.data?.name;
        if (newName) {
          await updatePurchaseOrder(newName, {
            custom_transporter: transporter,
            items: payloadItems
          });

          setLastPoName(newName);
          setEditingPoName(newName);
          setMessage(`Created Draft: ${newName}`);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save PO.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitPo() {
    const target = editingPoName || lastPoName;
    if (!target) return;
    setSubmittingPo(true);
    try {
      await submitDoc("Purchase Order", target);
      setMessage(`PO Submitted Successfully: ${target}`);
      setEditingPoName("");
    } catch (err) {
      setError(err.message || "Failed to submit.");
    } finally {
      setSubmittingPo(false);
    }
  }

  async function handleDeleteDraft() {
    if (!editingPoName) return;
    setDeletingDraft(true);
    try {
      await deletePurchaseOrder(editingPoName);
      setMessage(`Deleted Draft: ${editingPoName}`);
      setEditingPoName("");
      setLastPoName("");
      setPoItems([{ item_code: "", qty: "1.00", rate: "", rateTouched: false }]);
      setSupplier("");
      setTransporter("");
    } catch (err) {
      setError(err.message || "Delete failed.");
    } finally {
      setDeletingDraft(false);
    }
  }

  async function handleEmail() {
    if (!lastPoName || !supplierEmail) return setError("Missing PO or Email.");
    setEmailSending(true);
    try {
      await sendPurchaseOrderEmail({ poName: lastPoName, recipients: supplierEmail });
      setMessage("Email sent successfully.");
    } catch (err) {
      setError("Failed to send email.");
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
            <p className="po-subtitle">Create & Manage Purchase Orders</p>
          </div>
          {lastPoName && (
            <div className="po-header-chip">
              {editingPoName ? "Editing Draft" : "Last Created"}: <span>{lastPoName}</span>
            </div>
          )}
          {/* WARNING BANNER FOR THE BRANDS BECAUSE ALL THE RAW MATERIAL ARE SAME FOR ALL THE BRANDS */}
          {activeOrg !== "F2D TECH PRIVATE LIMITED" && (
            <div style={{ backgroundColor: "#fff3cd", color: "#856404", padding: "10px", borderRadius: "4px", marginBottom: "15px", fontSize: "14px" }}>
              <strong>Centralized Purchasing:</strong> You currently have <b>{activeOrg}</b> selected, but all raw materials are purchased centrally under F2D (Parent) and sent to the shared warehouse.
            </div>
          )}
        </div>

        {loadingLists && <p className="po-info-text">Loading Data...</p>}
        {error && <p className="po-error-text">{error}</p>}
        {message && <p className="po-message-text">{message}</p>}

        <form onSubmit={handleSubmit} className="po-form-grid">
          {/* LEFT COLUMN */}
          <div className="po-form-column">
            <div className="po-field">
              <label className="po-label">Supplier</label>
              <SupplierSearchDropdown
                suppliers={supplierOptions}
                value={supplier}
                onSelect={handleSupplierValueChange}
                placeholder="Search Supplier..."
                disabled={loadingLists}
              />
            </div>

            <div className="po-field">
              <label className="po-label">Transporter <span className="po-label-hint">(optional)</span></label>
              <select className="po-input" value={transporter} onChange={e => setTransporter(e.target.value)} disabled={loadingLists}>
                <option value="">-- None --</option>
                {transporters.map(t => (
                  <option key={t.name} value={t.name}>{t.supplier_name || t.name}</option>
                ))}
              </select>
            </div>

            <div className="po-field">
              <label className="po-label">Email</label>
              <input type="email" className="po-input" value={supplierEmail} onChange={e => setSupplierEmail(e.target.value)} placeholder="supplier@example.com" />
            </div>

            <div className="po-field">
              <label className="po-label">Notes</label>
              <textarea className="po-input po-textarea" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="po-form-column">
            <div className="po-field">
              <label className="po-label">Items</label>
              {poItems.map((row, idx) => (
                <div key={idx} style={{ marginBottom: 12 }}>
                  <POItemSearchDropdown
                    items={getItemOptionsIncludingSelected(row.item_code)}
                    value={row.item_code}
                    onSelect={code => handleItemValueChange(idx, code)}
                    placeholder={`Item ${idx + 1}...`}
                    disabled={loadingLists}
                  />
                  <div className="po-field po-field-inline" style={{ marginTop: 8 }}>
                    <div>
                      <label className="po-label">Qty</label>
                      <input type="number" className="po-input" min="0" step="0.5" value={row.qty} onChange={e => updatePoItem(idx, { qty: e.target.value })} />
                    </div>
                    <div>
                      <label className="po-label">Rate</label>
                      <input type="number" className="po-input" min="0" step="0.01" value={row.rate} onChange={e => updatePoItem(idx, { rate: e.target.value, rateTouched: true })} />
                    </div>
                    <div className="po-modal-actions">
                      <button type="button" onClick={() => removePoItem(idx)} disabled={poItems.length === 1} className="po-btn po-btn-outline">Remove</button>
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addPoItem} className="po-btn po-btn-outline">+ Add Item</button>
            </div>

            <div className="po-field po-field-inline">
              <div>
                <label className="po-label">PO Date</label>
                <input type="date" className="po-input" value={poDate} onChange={e => setPoDate(e.target.value)} />
              </div>
              <div>
                <label className="po-label">Received By</label>
                <input type="date" className="po-input" value={receivedByDate} onChange={e => setReceivedByDate(e.target.value)} />
              </div>
            </div>

            <div className="po-actions-main">
              <button type="submit" disabled={submitting} className="po-btn po-btn-primary">
                {submitting ? "Saving..." : (editingPoName ? "Update Draft" : "Create Draft")}
              </button>

             <button 
                type="button" 
                onClick={() => { if (window.confirm("Submit PO?")) handleSubmitPo() }} 
                disabled={submittingPo || (!editingPoName && !lastPoName)} 
                className="po-btn po-btn-outline"
                title={(!editingPoName && !lastPoName) ? "Create a draft first" : "Submit PO permanently"}
              >
                {submittingPo ? "Submitting..." : "Submit PO"}
              </button>

              <button type="button" onClick={handleDeleteDraft} disabled={!editingPoName || deletingDraft} className="po-btn po-btn-outline po-btn-danger">
                {deletingDraft ? "Deleting..." : "Delete Draft"}
              </button>
            </div>
          </div>
        </form>

        {lastPoName && (
          <div className="po-after-actions">
            <button type="button" onClick={handleEmail} disabled={emailSending} className="po-btn po-btn-accent">
              {emailSending ? "Sending..." : "Email Supplier"}
            </button>
            <a href={getPurchaseOrderPdfUrl(lastPoName, "Standard")} target="_blank" rel="noreferrer">
              <button type="button" className="po-btn po-btn-outline">Download PDF</button>
            </a>
          </div>
        )}
      </div>

      <div className="po-list-section">
        <PurchaseOrderList onEditPo={handleEditPo} />
      </div>

    </div>
  );
}


function SupplierSearchDropdown({ suppliers, value, onSelect, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  const selected = useMemo(() => suppliers.find(x => (x.supplier_name || x.name) === value), [suppliers, value]);
  const filtered = useMemo(() => {
    if (!q) return suppliers.slice(0, 80);
    return suppliers.filter(s =>
      (s.name || "").toLowerCase().includes(q.toLowerCase()) ||
      (s.supplier_name || "").toLowerCase().includes(q.toLowerCase())
    ).slice(0, 80);
  }, [suppliers, q]);

  useEffect(() => {
    function clickOut(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", clickOut);
    return () => document.removeEventListener("mousedown", clickOut);
  }, []);

  return (
    <div className="stdrop" ref={ref}>
      <button type="button" className="stdrop-control" onClick={() => !disabled && setOpen(!open)} disabled={disabled}>
        <div className="stdrop-value">{selected ? (selected.supplier_name || selected.name) : placeholder}</div>
        <div className="stdrop-caret">▾</div>
      </button>
      {open && (
        <div className="stdrop-popover">
          <div className="stdrop-search"><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search..." className="po-input" /></div>
          <div className="stdrop-list">
            {filtered.map(s => (
              <div key={s.name} className="stdrop-item" onClick={() => { onSelect(s.supplier_name || s.name, s); setOpen(false); setQ(""); }}>
                <div className="stdrop-item-title">{s.supplier_name || s.name}</div>
                <div className="stdrop-item-sub">{s.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function POItemSearchDropdown({ items, value, onSelect, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(""); 
  const ref = useRef(null);               

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