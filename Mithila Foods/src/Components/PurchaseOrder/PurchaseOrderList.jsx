// and provides actions to process them step-by-step (Draft → QC → Receipt → Invoice).
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  // List/Paging helper to fetch POs
  getDoctypeList,

  // Generic create/submit helpers for ERPNext doctypes
  createDoc,
  submitDoc,

  // Fetch PO with child items (needed for QC/Invoice)
  getPurchaseOrderWithItems,

  // Fetch full doc (used for Purchase Invoice after submit)
  getDoc,

  // Creates a Payment Entry for a Purchase Invoice (marks paid)
  createPaymentEntryForPurchaseInvoice,

  // Cancel/Close/Status helpers for Purchase Order
  cancelPurchaseOrder,
  setPurchaseOrderStatus,
  setPurchaseOrderMfStatus,

  // MF (custom) fields + options
  MF_PO_FIELDS,
  MF_STATUS_OPTIONS,

  // Upload PDF to ERPNext doc (used for Invoice PDF attach)
  uploadFileToDoc,

  // Close PO (custom helper: must exist in erpBackendApi.js)
  closePurchaseOrder,

  // Map with concurrency limit (avoid too many API calls at once)
  mapLimit,
} from "../erpBackendApi";

import "./PurchaseOrderList.css";

// -------------------- Constants --------------------
// Pagination: how many rows to show per page
const PAGE_SIZE = 20;

// Warehouses used during QC Receive process
const ACCEPTED_WAREHOUSE = "Raw Material - MF";
const REJECTED_WAREHOUSE = "Rejected Warehouse - MF";

// Simple helper to round a number to 2 decimals
function round2(n) {
  const x = Number(n);
  if (isNaN(x)) return 0;
  return Math.round(x * 100) / 100;
}

// Build a short readable string of items for the table "Items" column
// Example: "ITEM-1 (Name), ITEM-2 (Name) +2 more"
function buildItemSummary(items = []) {
  // show item_code + (item_name) if present
  const clean = (items || [])
    .map((it) => {
      const code = it.item_code || it.item_name || "";
      const name = it.item_name || "";
      if (!code) return "";
      return name && name !== code ? `${code} (${name})` : code;
    })
    .filter(Boolean);

  if (!clean.length) return "";

  // keep it readable (don’t flood table)
  const max = 3;
  if (clean.length <= max) return clean.join(", ");
  return `${clean.slice(0, max).join(", ")} +${clean.length - max} more`;
}

// Main component
// onEditPo is a callback provided by parent (PurchaseOrder.jsx) to open a draft for editing
function PurchaseOrderList({ onEditPo }) {
  // -------------------- List state --------------------
  const [orders, setOrders] = useState([]);        // current page orders
  const [page, setPage] = useState(0);             // current page index (0-based)
  const [hasMore, setHasMore] = useState(false);   // if next page exists
  const [loading, setLoading] = useState(false);   // list loading state

  // -------------------- Per-action loading flags --------------------
  // These hold PO name so we can show spinner only for that row
  const [qcPassLoading, setQcPassLoading] = useState("");
  const [qcFailLoading, setQcFailLoading] = useState("");
  const [invoiceLoading, setInvoiceLoading] = useState("");
  const [submitPoLoading, setSubmitPoLoading] = useState("");

  // ✅ MF filter (filters list by MF status)
  const [mfFilter, setMfFilter] = useState("");

  // -------------------- QC inline edit state (MULTI ITEM) --------------------
  // qcEdit is used when user clicks "QC Pass & Receive" and we show per-item inputs
  // Shape:
  // {
  //   poName,
  //   poDoc,
  //   rows: [
  //     { rowId, item_code, item_name, maxQty, goodQtyInput, poItem }
  //   ]
  // }
  const [qcEdit, setQcEdit] = useState(null);

  // per-PO info after PR: { [poName]: { prName, allGood, stockPercent } }
  // This is stored in UI state so later invoice can use PR reference and % info
  const [receivedPO, setReceivedPO] = useState({});

  // -------------------- Messages --------------------
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // MF status update loading (per row)
  const [mfUpdating, setMfUpdating] = useState("");

  // -------------------- Items shown in list --------------------
  // We hydrate item names per visible PO rows so the table shows item summary
  const [poItemsSummary, setPoItemsSummary] = useState({}); // { [poName]: "ITEM-1 (Name), ..." }

  // -------------------- Upload Invoice PDF state --------------------
  // Hidden file input ref (click triggered by "Upload Invoice" button)
  const uploadInputRef = useRef(null);

  // Which PO are we uploading invoice for (so we know where to attach)
  const [uploadTargetPo, setUploadTargetPo] = useState(null);

  // per-row upload loading
  const [uploadInvoiceLoading, setUploadInvoiceLoading] = useState("");

  // After upload, we create a DRAFT Purchase Invoice and attach the PDF.
  // Then we show only "Submit Invoice" for that PO.
  const [draftPiByPo, setDraftPiByPo] = useState({}); // { [poName]: piName }

  // loading for invoice submit step
  const [submitInvLoading, setSubmitInvLoading] = useState("");

  // -------------------- Sorting by creation date --------------------
  // asc = oldest → newest, desc = newest → oldest
  const [createdSort, setCreatedSort] = useState("asc");

  const createdSortLabel =
    createdSort === "asc"
      ? "Sort by Created: Oldest → Newest"
      : "Sort by Created: Newest → Oldest";

  // Convert ERP datetime string into a timestamp for sorting
  function toSortTs(v) {
    if (!v) return 0;
    const s = String(v).trim();
    if (!s) return 0;

    // ERP often returns "YYYY-MM-DD HH:MM:SS"
    // JS Date likes "YYYY-MM-DDTHH:MM:SS"
    const isoLike = s.includes(" ") ? s.replace(" ", "T") : s;

    const d = new Date(isoLike);
    const t = d.getTime();
    return Number.isFinite(t) ? t : 0;
  }

  // Orders sorted based on creation timestamp
  const sortedOrders = useMemo(() => {
    const dirMul = createdSort === "asc" ? 1 : -1;

    return [...orders].sort((a, b) => {
      const ta = toSortTs(a?.creation);
      const tb = toSortTs(b?.creation);

      if (ta !== tb) return (ta - tb) * dirMul;

      // stable tie-break if timestamps are equal
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });
  }, [orders, createdSort]);

  // Toggle between asc/desc sorting
  function toggleCreatedSort() {
    setCreatedSort((prev) => (prev === "asc" ? "desc" : "asc"));
  }

  // -------------------- MF status change (dropdown) --------------------
  // Updates MF status for a PO and reloads list
  async function handleMfStatusChange(po, newStatus) {
    if (!newStatus) return;
    setError("");
    setMessage("");
    setMfUpdating(po.name);

    try {
      await setPurchaseOrderMfStatus(po.name, newStatus);
      setMessage(`MF Status updated for ${po.name}: ${newStatus}`);
      await loadOrders(page, mfFilter);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || err.message || "MF status update failed");
    } finally {
      setMfUpdating("");
    }
  }

  // We fetch each PO details and build a small item summary string
  async function hydrateItemNames(rows) {
    try {
      const next = {};
      await mapLimit(rows, 5, async (po) => {
        try {
          const doc = await getPurchaseOrderWithItems(po.name);
          next[po.name] = buildItemSummary(doc.items || []);
        } catch (e) {
          next[po.name] = "";
        }
      });
      setPoItemsSummary((prev) => ({ ...prev, ...next }));
    } catch (e) {
      // ignore (we don't want list to break)
    }
  }

  // -------- LOAD POs --------
  // Loads one page of Purchase Orders from ERPNext with optional MF filter
  async function loadOrders(pageIndex = 0, mfStatus = "") {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      // Base filter: only "open" statuses we care about
      const baseFilters = [
        ["Purchase Order", "status", "in", ["Draft", "To Receive and Bill", "To Receive", "To Bill"]],
      ];

      // MF filter (server-side)
      if (mfStatus) {
        baseFilters.push(["Purchase Order", MF_PO_FIELDS.status, "=", mfStatus]);
      }

      // Fetch with stable ordering by creation (not modified)
      let data = await getDoctypeList("Purchase Order", {
        fields: JSON.stringify([
          "name",
          "supplier",
          "company",
          "transaction_date",
          "status",
          "grand_total",
          "per_received",
          "per_billed",
          "creation", // used for sorting / stable ordering
          MF_PO_FIELDS.status,
          MF_PO_FIELDS.updatedOn,
          MF_PO_FIELDS.stockPercent,
        ]),
        filters: JSON.stringify(baseFilters),
        // We fetch in creation desc, then reverse in UI so newest appears at END
        order_by: "creation desc",
        limit_page_length: PAGE_SIZE + 1, // +1 so we can detect "hasMore"
        limit_start: pageIndex * PAGE_SIZE,
      });

      // Hide fully completed (100% received & billed)
      data = data.filter((row) => {
        const r = Number(row.per_received || 0);
        const b = Number(row.per_billed || 0);
        return !(r >= 100 && b >= 100);
      });

      // Take only current page rows
      const pageRows = data.slice(0, PAGE_SIZE);

      // ✅ Reverse so "latest PO is at the end"
      const displayRows = [...pageRows].reverse();

      setHasMore(data.length > PAGE_SIZE);
      setOrders(displayRows);
      setPage(pageIndex);
      setQcEdit(null);

      // Load item summary for visible rows
      hydrateItemNames(displayRows);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load Purchase Orders");
    } finally {
      setLoading(false);
    }
  }

  // Initial load on mount
  useEffect(() => {
    loadOrders(0, mfFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  //  MF Filter change (reload from page 0)
  async function onMfFilterChange(v) {
    setMfFilter(v);
    await loadOrders(0, v);
  }

  // ---------------- QC PASS (MULTI ITEM) ----------------
  // Step 1: user clicks "QC Pass & Receive"
  // We load PO items and open the inline editor to enter "good qty" per item
  async function startQcPass(po) {
    setError("");
    setMessage("");
    setQcPassLoading(po.name);

    try {
      const poDoc = await getPurchaseOrderWithItems(po.name);
      const poItems = poDoc.items || [];
      if (!poItems.length) throw new Error("Purchase Order has no items to receive");

      // Create editable rows for only remaining qty
      const rows = poItems
        .map((it) => {
          const ordered = Number(it.qty || 0);
          const received = Number(it.received_qty || 0);
          const remaining = ordered - received;

          if (remaining <= 0) return null;

          return {
            rowId: it.name, // purchase_order_item id
            item_code: it.item_code,
            item_name: it.item_name,
            maxQty: remaining,                 // remaining qty allowed
            goodQtyInput: String(remaining),   // default: accept all as good
            poItem: it,
          };
        })
        .filter(Boolean);

      if (!rows.length) throw new Error("All quantities already received for this Purchase Order.");

      setQcEdit({
        poName: po.name,
        poDoc,
        rows,
      });

      setMessage(`Enter good quantity for each item in PO ${po.name}.`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || err.message || "Failed to load Purchase Order for QC");
    } finally {
      setQcPassLoading("");
    }
  }

  // Update a single QC input field by rowId
  function updateQcRowQty(rowId, value) {
    setQcEdit((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map((r) => (r.rowId === rowId ? { ...r, goodQtyInput: value } : r)),
      };
    });
  }

  // Step 2: user clicks "Receive"
  // We create Purchase Receipt with accepted + rejected quantities
  async function confirmQcPass() {
    if (!qcEdit) return;

    const { poName, poDoc, rows } = qcEdit;

    setError("");
    setMessage("");
    setQcPassLoading(poName);

    try {
      // validate + compute totals
      let totalRemaining = 0;
      let totalGood = 0;

      const prItems = [];

      for (const r of rows) {
        const goodQty = Number(r.goodQtyInput);
        const maxQty = Number(r.maxQty || 0);

        // validation: good must be between 0 and maxQty
        if (isNaN(goodQty) || goodQty < 0 || goodQty > maxQty) {
          throw new Error(
            `Invalid qty for ${r.item_code}. Enter 0 to ${maxQty}.`
          );
        }

        // badQty = remaining - goodQty
        const badQty = maxQty - goodQty;
        const receivedQty = goodQty + badQty; // equals maxQty

        totalRemaining += maxQty;
        totalGood += goodQty;

        // if nothing received for a line, skip
        if (receivedQty <= 0) continue;

        // Build Purchase Receipt item row
        prItems.push({
          item_code: r.poItem.item_code,

          qty: goodQty,               // accepted qty
          received_qty: receivedQty,  // accepted + rejected
          accepted_qty: goodQty,
          rejected_qty: badQty,

          warehouse: ACCEPTED_WAREHOUSE,
          ...(badQty > 0 ? { rejected_warehouse: REJECTED_WAREHOUSE } : {}),

          rate: r.poItem.rate,

          purchase_order: poDoc.name,
          purchase_order_item: r.poItem.name,
        });
      }

      if (!prItems.length) {
        setMessage("No quantity to receive.");
        setQcEdit(null);
        return;
      }

      // Calculate if everything in this receive step was good (no rejection)
      const allGoodThisRound = totalRemaining > 0 && totalGood === totalRemaining;

      // % stock in (good / total) for this receive step
      const percent = totalRemaining > 0 ? round2((totalGood / totalRemaining) * 100) : 0;

      const today = new Date().toISOString().slice(0, 10);

      // Purchase Receipt payload
      const prPayload = {
        doctype: "Purchase Receipt",
        supplier: poDoc.supplier,
        company: poDoc.company,
        posting_date: today,
        purchase_order: poDoc.name,
        items: prItems,
      };

      // Create and submit Purchase Receipt
      const prDoc = await createDoc("Purchase Receipt", prPayload);
      const prName = prDoc.data?.name;
      if (prName) await submitDoc("Purchase Receipt", prName);

      // Store PR reference + stock percent in local UI state
      setReceivedPO((prev) => ({
        ...prev,
        [poName]: { prName: prName || null, allGood: allGoodThisRound, stockPercent: percent },
      }));

      // Update MF status for PO
      await setPurchaseOrderMfStatus(poName, "QC In", { stockPercent: percent });

      setMessage(
        prName
          ? `QC PASS: PR ${prName} created from ${poName} (good ${round2(totalGood)}, total ${round2(totalRemaining)}).`
          : `QC PASS: PR created from ${poName}.`
      );

      // close QC editor + reload list
      setQcEdit(null);
      await loadOrders(page, mfFilter);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || err.message || "Failed to create Purchase Receipt");
    } finally {
      setQcPassLoading("");
    }
  }

  // Cancel QC inline editor
  function cancelQcPass() {
    setQcEdit(null);
    setMessage("");
  }

  // ---------------- QC FAIL ----------------
  // Marks MF status as Cancelled and cancels the Purchase Order
  async function handleQcFail(po) {
    setError("");
    setMessage("");
    setQcFailLoading(po.name);

    try {
      await setPurchaseOrderMfStatus(po.name, "Cancelled");
      await cancelPurchaseOrder(po.name);

      setMessage(`QC marked as FAIL. Purchase Order ${po.name} has been cancelled.`);
      await loadOrders(page, mfFilter);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || err.message || "Failed to cancel Purchase Order");
    } finally {
      setQcFailLoading("");
    }
  }

  // ---------------- Submit PO (Draft) ----------------
  // Used only when PO status is "Draft"
  async function handleSubmitPoFromList(po) {
    setError("");
    setMessage("");
    setSubmitPoLoading(po.name);

    try {
      await submitDoc("Purchase Order", po.name);
      setMessage(`Purchase Order submitted: ${po.name}`);
      await loadOrders(page, mfFilter);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || err.message || "Failed to submit Purchase Order");
    } finally {
      setSubmitPoLoading("");
    }
  }

  // ---------------- Create Invoice (Paid) ----------------
  // This creates Purchase Invoice, submits it, creates Payment Entry, and updates PO status
  async function handleCreateInvoice(po) {
    setError("");
    setMessage("");
    setInvoiceLoading(po.name);

    try {
      const poDoc = await getPurchaseOrderWithItems(po.name);
      const poItems = poDoc.items || [];
      if (!poItems.length) throw new Error("Purchase Order has no items for invoice");

      const today = new Date().toISOString().slice(0, 10);

      // Pull PR info from UI state (if available)
      const receivedInfo = receivedPO[po.name] || {};
      const sessionPrName = receivedInfo.prName || null;
      const allGood = receivedInfo.allGood !== undefined ? receivedInfo.allGood : true;

      // Purchase Invoice payload
      const piPayload = {
        doctype: "Purchase Invoice",
        supplier: poDoc.supplier,
        company: poDoc.company,
        posting_date: today,
        purchase_order: poDoc.name,
        items: poItems.map((it) => ({
          item_code: it.item_code,
          qty: it.qty,
          rate: it.rate,
          purchase_order: poDoc.name,
          po_detail: it.name,
          ...(sessionPrName ? { purchase_receipt: sessionPrName } : {}),
        })),
      };

      // Create PI
      const piDoc = await createDoc("Purchase Invoice", piPayload);
      const piName = piDoc.data?.name;

      if (piName) {
        // Submit PI
        await submitDoc("Purchase Invoice", piName);

        // Fetch full PI doc (needed for payment entry helper)
        const fullPi = await getDoc("Purchase Invoice", piName);

        // Create payment entry => marks invoice as paid
        await createPaymentEntryForPurchaseInvoice(fullPi);

        // Update PO status based on good/rejected
        const statusToSet = allGood ? "Completed" : "Closed";
        await setPurchaseOrderStatus(poDoc.name, statusToSet);

        // If not all good, try to close PO
        if (!allGood) {
          try {
            await closePurchaseOrder(poDoc.name);
          } catch (e) { }
        }

        // Stock percent stored in MF field (prefer ERP value, fallback to local state)
        const percent =
          po?.[MF_PO_FIELDS.stockPercent] != null && po?.[MF_PO_FIELDS.stockPercent] !== ""
            ? Number(po[MF_PO_FIELDS.stockPercent])
            : receivedPO?.[po.name]?.stockPercent;

        // Set MF status to Completed
        await setPurchaseOrderMfStatus(poDoc.name, "Completed", { stockPercent: percent });
      }

      setMessage(piName ? `Purchase Invoice created, submitted, PAID and PO updated: ${piName}.` : `Purchase Invoice created from ${po.name}`);
      await loadOrders(page, mfFilter);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || err.message || "Failed to create / pay Purchase Invoice");
    } finally {
      setInvoiceLoading("");
    }
  }

  // ---------------- Upload Invoice (Draft PI + attach PDF only) ----------------
  // Step 1: user clicks "Upload Invoice" → we trigger hidden file input
  function startUploadInvoice(po) {
    setError("");
    setMessage("");
    setUploadTargetPo(po);
    uploadInputRef.current?.click();
  }

  // When user selects a file from the file picker
  async function onInvoicePdfPicked(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset input so same file can be selected again
    if (!file || !uploadTargetPo) return;

    // Allow only PDFs
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("Please select a PDF file.");
      setUploadTargetPo(null);
      return;
    }

    await handleUploadInvoice(uploadTargetPo, file);
    setUploadTargetPo(null);
  }

  // Step 2: create DRAFT Purchase Invoice and attach PDF to it
  async function handleUploadInvoice(po, pdfFile) {
    setError("");
    setMessage("");
    setUploadInvoiceLoading(po.name);

    try {
      const poDoc = await getPurchaseOrderWithItems(po.name);
      const poItems = poDoc.items || [];
      if (!poItems.length) throw new Error("Purchase Order has no items for invoice");

      const today = new Date().toISOString().slice(0, 10);

      const receivedInfo = receivedPO[po.name] || {};
      const sessionPrName = receivedInfo.prName || null;

      // Create draft PI first
      const piPayload = {
        doctype: "Purchase Invoice",
        supplier: poDoc.supplier,
        company: poDoc.company,
        posting_date: today,
        purchase_order: poDoc.name,
        items: poItems.map((it) => ({
          item_code: it.item_code,
          qty: it.qty,
          rate: it.rate,
          purchase_order: poDoc.name,
          po_detail: it.name,
          ...(sessionPrName ? { purchase_receipt: sessionPrName } : {}),
        })),
      };

      const piDoc = await createDoc("Purchase Invoice", piPayload);
      const piName = piDoc.data?.name;
      if (!piName) throw new Error("Purchase Invoice not created (missing name).");

      // Upload PDF and attach to PI
      await uploadFileToDoc({
        doctype: "Purchase Invoice",
        docname: piName,
        file: pdfFile,
        is_private: 1,
      });

      // Store PI name so UI shows "Submit Invoice" for this PO
      setDraftPiByPo((prev) => ({ ...prev, [po.name]: piName }));

      setMessage(`Draft PI created and PDF uploaded: ${piName}. Now click "Submit Invoice".`);

      await loadOrders(page, mfFilter);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || err.message || "Failed to upload invoice PDF / create draft PI");
    } finally {
      setUploadInvoiceLoading("");
    }
  }

  // ---------------- Submit invoice AFTER upload ----------------
  // This submits the draft PI, pays it, and updates PO/MF status
  async function handleSubmitDraftInvoice(po) {
    const piName = draftPiByPo[po.name];
    if (!piName) return;

    setError("");
    setMessage("");
    setSubmitInvLoading(po.name);

    try {
      const poDoc = await getPurchaseOrderWithItems(po.name);

      // Submit PI
      await submitDoc("Purchase Invoice", piName);

      // Pay PI
      const fullPi = await getDoc("Purchase Invoice", piName);
      await createPaymentEntryForPurchaseInvoice(fullPi);

      // Determine "all good" using local state or MF % field
      const receivedInfo = receivedPO[po.name] || {};
      const percentFromErp =
        po?.[MF_PO_FIELDS.stockPercent] != null && po?.[MF_PO_FIELDS.stockPercent] !== ""
          ? Number(po[MF_PO_FIELDS.stockPercent])
          : undefined;

      const allGood =
        receivedInfo.allGood !== undefined
          ? receivedInfo.allGood
          : percentFromErp != null
            ? percentFromErp >= 99.999
            : true;

      // Update PO status
      const statusToSet = allGood ? "Completed" : "Closed";
      await setPurchaseOrderStatus(poDoc.name, statusToSet);

      // If not all good, try closing PO
      if (!allGood) {
        try {
          await closePurchaseOrder(poDoc.name);
        } catch (e) { }
      }

      // Stock percent (prefer ERP, fallback to UI state)
      const percent =
        po?.[MF_PO_FIELDS.stockPercent] != null && po?.[MF_PO_FIELDS.stockPercent] !== ""
          ? Number(po[MF_PO_FIELDS.stockPercent])
          : receivedPO?.[po.name]?.stockPercent;

      // Update MF status
      await setPurchaseOrderMfStatus(poDoc.name, "Completed", { stockPercent: percent });

      // Remove the draft PI mapping so UI goes back to normal buttons
      setDraftPiByPo((prev) => {
        const next = { ...prev };
        delete next[po.name];
        return next;
      });

      setMessage(`Invoice submitted & PAID: ${piName}`);
      await loadOrders(page, mfFilter);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || err.message || "Failed to submit/pay Purchase Invoice");
    } finally {
      setSubmitInvLoading("");
    }
  }

  // ---------------- Pagination handlers ----------------
  function handlePrevPage() {
    if (page === 0 || loading) return;
    loadOrders(page - 1, mfFilter);
  }

  function handleNextPage() {
    if (!hasMore || loading) return;
    loadOrders(page + 1, mfFilter);
  }

  // Reload current page
  async function reloadOrders() {
    await loadOrders(page, mfFilter);
  }

  return (
    <div className="po-list">
      {/* Hidden PDF input (used for Upload Invoice) */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: "none" }}
        onChange={onInvoicePdfPicked}
      />

      {/* Header section */}
      <div className="po-list-header">
        <div className="po-list-title-block">
          <h3 className="po-list-title">Recent Purchase Orders</h3>
          <p className="po-list-subtitle">Process: Draft → QC (good &amp; bad) → Receipt → Invoice (Paid)</p>
        </div>

        {/* Right side controls */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* ✅ MF Status Filter */}
          <div className="po-list-pill" style={{ padding: "6px 10px" }}>
            MF Filter:&nbsp;
            <select
              value={mfFilter}
              onChange={(e) => onMfFilterChange(e.target.value)}
              style={{ padding: "4px 6px" }}
            >
              <option value="">All</option>
              {MF_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Sort toggle */}
          <div className="po-list-pill" style={{ padding: "6px 10px" }}>
            <button
              type="button"
              className="btn btn-outline btn-xs"
              onClick={toggleCreatedSort}
              disabled={loading}
            >
              {createdSortLabel}
            </button>
          </div>

          {/* Refresh */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={reloadOrders}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          {/* Page indicator */}
          <div className="po-list-pill">
            Page {page + 1} · {orders.length} open PO{orders.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Loading / errors / messages */}
      {loading && <p className="po-list-loading text-muted">Loading purchase orders...</p>}
      {error && <p className="alert alert-error">{error}</p>}
      {message && <p className="alert alert-success">{message}</p>}

      {/* Table */}
      {!loading && !error && (
        <>
          {orders.length === 0 ? (
            <p className="po-list-empty text-muted">No Purchase Orders to process.</p>
          ) : (
            <div className="po-list-table-wrapper">
              <table className="po-list-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Supplier</th>
                    <th>Items</th>
                    <th>Company</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Grand Total</th>
                    <th>Actions</th>
                    <th>MF Status</th>
                    <th>% Stock In</th>
                  </tr>
                </thead>

                <tbody>
                  {sortedOrders.map((po) => {
                    // per_received from ERP (>=1 means receipt happened)
                    const perReceived = Number(po.per_received || 0);
                    const receivedFromErp = perReceived > 0;

                    // MF status "QC In" or "Completed" also counts as received
                    const mf = po[MF_PO_FIELDS.status];
                    const receivedFromMf = mf === "QC In" || mf === "Completed";
                    const isReceived = receivedFromErp || receivedFromMf;

                    // Loading flags for this row
                    const isQcPassing = qcPassLoading === po.name;
                    const isQcFailing = qcFailLoading === po.name;
                    const isInvoicing = invoiceLoading === po.name;
                    const isUploading = uploadInvoiceLoading === po.name;
                    const isSubmittingPo = submitPoLoading === po.name;

                    // Draft check
                    const isDraft = po.status === "Draft";

                    // If qcEdit is open for this PO, show inline receive UI
                    const isThisQcEdit = qcEdit && qcEdit.poName === po.name;

                    // If invoice PDF uploaded, we store draft PI name here
                    const draftPiName = draftPiByPo[po.name];
                    const isSubmittingInvoice = submitInvLoading === po.name;

                    return (
                      <tr key={po.name}>
                        <td className="po-cell-name">{po.name}</td>
                        <td>{po.supplier}</td>

                        {/* ✅ Items column (summary string) */}
                        <td style={{ maxWidth: 420 }}>
                          <span style={{ fontSize: 12, opacity: 0.9 }}>
                            {poItemsSummary[po.name] || "—"}
                          </span>
                        </td>

                        <td>{po.company}</td>
                        <td>{po.transaction_date}</td>
                        <td>{po.status}</td>
                        <td className="po-cell-money">{po.grand_total}</td>

                        {/* Actions column: depends on status */}
                        <td className="po-cell-actions">
                          {/* If Draft: allow edit + submit */}
                          {isDraft ? (
                            <div className="po-actions-stack">
                              <button
                                onClick={() => onEditPo && onEditPo(po.name)}
                                className="btn btn-outline btn-xs"
                              >
                                Edit Draft
                              </button>

                              <button
                                onClick={() => {
                                  const ok = window.confirm(
                                    `You are about to SUBMIT Purchase Order: ${po.name}\n\nSubmit now?`
                                  );
                                  if (!ok) return;

                                  window.alert(`Submitting Purchase Order: ${po.name}`);
                                  handleSubmitPoFromList(po);
                                }}
                                disabled={isSubmittingPo}
                                className="btn btn-primary btn-xs"
                              >
                                {isSubmittingPo ? "Submitting..." : "Submit"}
                              </button>
                            </div>
                          ) : !isReceived ? (
                            // If NOT received yet: show QC actions
                            <div className="po-actions-stack">
                              {isThisQcEdit ? (
                                // Inline QC input UI (per item)
                                <div className="qc-inline" style={{ minWidth: 320 }}>
                                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                                    Good Qty per item (remaining):
                                  </div>

                                  {/* MULTI ITEM inputs */}
                                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    {qcEdit.rows.map((r) => (
                                      <div
                                        key={r.rowId}
                                        style={{
                                          display: "flex",
                                          gap: 8,
                                          alignItems: "center",
                                          justifyContent: "space-between",
                                        }}
                                      >
                                        <div style={{ flex: 1, fontSize: 12 }}>
                                          <b>{r.item_code}</b>
                                          {r.item_name ? (
                                            <span style={{ opacity: 0.75 }}> · {r.item_name}</span>
                                          ) : null}
                                          <div style={{ opacity: 0.75 }}>
                                            Remaining: {round2(r.maxQty)}
                                          </div>
                                        </div>

                                        <input
                                          type="number"
                                          step="0.01"
                                          min={0}
                                          className="qc-inline-input"
                                          style={{ width: 110 }}
                                          value={r.goodQtyInput}
                                          onChange={(e) => updateQcRowQty(r.rowId, e.target.value)}
                                        />
                                      </div>
                                    ))}
                                  </div>

                                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                    <button
                                      onClick={confirmQcPass}
                                      disabled={isQcPassing}
                                      className="btn btn-outline btn-xs"
                                    >
                                      {isQcPassing ? "Receiving..." : "Receive"}
                                    </button>
                                    <button onClick={cancelQcPass} className="btn btn-ghost btn-xs">
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                // Normal QC buttons
                                <>
                                  <button
                                    onClick={() => startQcPass(po)}
                                    disabled={isQcPassing || isQcFailing}
                                    className="btn btn-outline btn-xs"
                                  >
                                    {isQcPassing ? "Loading QC..." : "QC Pass & Receive"}
                                  </button>
                                  <button
                                    onClick={() => handleQcFail(po)}
                                    disabled={isQcPassing || isQcFailing}
                                    className="btn btn-danger btn-xs"
                                  >
                                    {isQcFailing ? "Marking Fail..." : "QC Fail"}
                                  </button>
                                </>
                              )}
                            </div>
                          ) : (
                            // If received: allow invoice actions
                            <>
                              {draftPiName ? (
                                // If PDF upload created draft PI: show submit invoice button only
                                <button
                                  onClick={() => handleSubmitDraftInvoice(po)}
                                  disabled={isSubmittingInvoice}
                                  className="btn btn-accent btn-xs"
                                >
                                  {isSubmittingInvoice ? "Submitting..." : `Submit Invoice (${draftPiName})`}
                                </button>
                              ) : (
                                // Normal invoice options: create invoice (paid) or upload invoice
                                <div className="po-actions-stack">
                                  <button
                                    onClick={() => handleCreateInvoice(po)}
                                    disabled={isInvoicing || isUploading}
                                    className="btn btn-accent btn-xs"
                                  >
                                    {isInvoicing ? "Creating Invoice..." : "Create Invoice (Paid)"}
                                  </button>

                                  <button
                                    onClick={() => startUploadInvoice(po)}
                                    disabled={isInvoicing || isUploading}
                                    className="btn btn-outline btn-xs"
                                  >
                                    {isUploading ? "Uploading..." : "Upload Invoice"}
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </td>

                        {/* MF status dropdown */}
                        <td>
                          <select
                            value={po[MF_PO_FIELDS.status] || ""}
                            onChange={(e) => handleMfStatusChange(po, e.target.value)}
                            disabled={mfUpdating === po.name}
                          >
                            <option value="">--</option>
                            {MF_STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>

                          {/* MF updated date/time */}
                          <div style={{ fontSize: 12, opacity: 0.7 }}>
                            {po[MF_PO_FIELDS.updatedOn] || ""}
                          </div>
                        </td>

                        {/* % stock in (from MF field) */}
                        <td>
                          {po[MF_PO_FIELDS.stockPercent] != null && po[MF_PO_FIELDS.stockPercent] !== ""
                            ? `${Number(po[MF_PO_FIELDS.stockPercent]).toFixed(2)}%`
                            : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination buttons */}
          <div className="po-list-pagination">
            <button onClick={handlePrevPage} disabled={page === 0 || loading} className="page-btn">
              ◀ Previous
            </button>
            <span className="po-list-page-text">Page {page + 1}</span>
            <button onClick={handleNextPage} disabled={!hasMore || loading} className="page-btn">
              Next ▶
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default PurchaseOrderList;
