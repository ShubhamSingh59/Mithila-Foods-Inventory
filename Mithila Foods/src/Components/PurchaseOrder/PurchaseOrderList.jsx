//////// and provides actions to process them step-by-step (Draft → QC → Receipt → Invoice).
//////import React, { useEffect, useMemo, useRef, useState } from "react";
//////import {
//////  // List/Paging helper to fetch POs
//////  getDoctypeList,

//////  // Generic create/submit helpers for ERPNext doctypes
//////  createDoc,
//////  submitDoc,

//////  // Fetch PO with child items (needed for QC/Invoice)
//////  getPurchaseOrderWithItems,

//////  // Fetch full doc (used for Purchase Invoice after submit)
//////  getDoc,

//////  // Creates a Payment Entry for a Purchase Invoice (marks paid)
//////  createPaymentEntryForPurchaseInvoice,

//////  // Cancel/Close/Status helpers for Purchase Order
//////  cancelPurchaseOrder,
//////  setPurchaseOrderStatus,
//////  setPurchaseOrderMfStatus,

//////  // MF (custom) fields + options
//////  MF_PO_FIELDS,
//////  MF_STATUS_OPTIONS,

//////  // Upload PDF to ERPNext doc (used for Invoice PDF attach)
//////  uploadFileToDoc,

//////  // Close PO (custom helper: must exist in erpBackendApi.js)
//////  closePurchaseOrder,

//////  // Map with concurrency limit (avoid too many API calls at once)
//////  mapLimit,

//////  getTransporters,
//////  setPurchaseOrderTransporter,
//////} from "../erpBackendApi";

//////import "./PurchaseOrderList.css";

//////// -------------------- Constants --------------------
//////// Pagination: how many rows to show per page
//////const PAGE_SIZE = 20;

//////// Warehouses used during QC Receive process
//////const ACCEPTED_WAREHOUSE = "Raw Material - MF";
//////const REJECTED_WAREHOUSE = "Rejected Warehouse - MF";

//////// Simple helper to round a number to 2 decimals
//////function round2(n) {
//////  const x = Number(n);
//////  if (isNaN(x)) return 0;
//////  return Math.round(x * 100) / 100;
//////}

//////// Build a short readable string of items for the table "Items" column
//////// Example: "ITEM-1 (Name), ITEM-2 (Name) +2 more"
//////function buildItemSummary(items = []) {
//////  // show item_code + (item_name) if present
//////  const clean = (items || [])
//////    .map((it) => {
//////      const code = it.item_code || it.item_name || "";
//////      const name = it.item_name || "";
//////      if (!code) return "";
//////      return name && name !== code ? `${code} (${name})` : code;
//////    })
//////    .filter(Boolean);

//////  if (!clean.length) return "";

//////  // keep it readable (don’t flood table)
//////  const max = 3;
//////  if (clean.length <= max) return clean.join(", ");
//////  return `${clean.slice(0, max).join(", ")} +${clean.length - max} more`;
//////}

//////// Main component
//////// onEditPo is a callback provided by parent (PurchaseOrder.jsx) to open a draft for editing
//////function PurchaseOrderList({ onEditPo }) {
//////  // -------------------- List state --------------------
//////  const [orders, setOrders] = useState([]);        // current page orders
//////  const [page, setPage] = useState(0);             // current page index (0-based)
//////  const [hasMore, setHasMore] = useState(false);   // if next page exists
//////  const [loading, setLoading] = useState(false);   // list loading state
//////  const [transporters, setTransporters] = useState([]);
//////  const [transporterUpdating, setTransporterUpdating] = useState("");

//////  // Map: transporter docname -> transporter_name (for display)
//////  const transporterNameMap = useMemo(() => {
//////    const m = new Map();
//////    (transporters || []).forEach((t) => {
//////      m.set(t.name, t.transporter_name || t.name);
//////    });
//////    return m;
//////  }, [transporters]);


//////  // -------------------- Per-action loading flags --------------------
//////  // These hold PO name so we can show spinner only for that row
//////  const [qcPassLoading, setQcPassLoading] = useState("");
//////  const [qcFailLoading, setQcFailLoading] = useState("");
//////  const [invoiceLoading, setInvoiceLoading] = useState("");
//////  const [submitPoLoading, setSubmitPoLoading] = useState("");

//////  // ✅ MF filter (filters list by MF status)
//////  const [mfFilter, setMfFilter] = useState("");

//////  // -------------------- QC inline edit state (MULTI ITEM) --------------------
//////  // qcEdit is used when user clicks "QC Pass & Receive" and we show per-item inputs
//////  // Shape:
//////  // {
//////  //   poName,
//////  //   poDoc,
//////  //   rows: [
//////  //     { rowId, item_code, item_name, maxQty, goodQtyInput, poItem }
//////  //   ]
//////  // }
//////  const [qcEdit, setQcEdit] = useState(null);

//////  // per-PO info after PR: { [poName]: { prName, allGood, stockPercent } }
//////  // This is stored in UI state so later invoice can use PR reference and % info
//////  const [receivedPO, setReceivedPO] = useState({});

//////  // -------------------- Messages --------------------
//////  const [error, setError] = useState("");
//////  const [message, setMessage] = useState("");

//////  // MF status update loading (per row)
//////  const [mfUpdating, setMfUpdating] = useState("");

//////  // -------------------- Items shown in list --------------------
//////  // We hydrate item names per visible PO rows so the table shows item summary
//////  const [poItemsSummary, setPoItemsSummary] = useState({}); // { [poName]: "ITEM-1 (Name), ..." }

//////  // -------------------- Upload Invoice PDF state --------------------
//////  // Hidden file input ref (click triggered by "Upload Invoice" button)
//////  const uploadInputRef = useRef(null);

//////  // Which PO are we uploading invoice for (so we know where to attach)
//////  const [uploadTargetPo, setUploadTargetPo] = useState(null);

//////  // per-row upload loading
//////  const [uploadInvoiceLoading, setUploadInvoiceLoading] = useState("");

//////  // After upload, we create a DRAFT Purchase Invoice and attach the PDF.
//////  // Then we show only "Submit Invoice" for that PO.
//////  const [draftPiByPo, setDraftPiByPo] = useState({}); // { [poName]: piName }

//////  // loading for invoice submit step
//////  const [submitInvLoading, setSubmitInvLoading] = useState("");

//////  // -------------------- Sorting by creation date --------------------
//////  // asc = oldest → newest, desc = newest → oldest
//////  const [createdSort, setCreatedSort] = useState("asc");

//////  const createdSortLabel =
//////    createdSort === "asc"
//////      ? "Sort by Created: Oldest → Newest"
//////      : "Sort by Created: Newest → Oldest";

//////  // Convert ERP datetime string into a timestamp for sorting
//////  function toSortTs(v) {
//////    if (!v) return 0;
//////    const s = String(v).trim();
//////    if (!s) return 0;

//////    // ERP often returns "YYYY-MM-DD HH:MM:SS"
//////    // JS Date likes "YYYY-MM-DDTHH:MM:SS"
//////    const isoLike = s.includes(" ") ? s.replace(" ", "T") : s;

//////    const d = new Date(isoLike);
//////    const t = d.getTime();
//////    return Number.isFinite(t) ? t : 0;
//////  }

//////  // Orders sorted based on creation timestamp
//////  const sortedOrders = useMemo(() => {
//////    const dirMul = createdSort === "asc" ? 1 : -1;

//////    return [...orders].sort((a, b) => {
//////      const ta = toSortTs(a?.creation);
//////      const tb = toSortTs(b?.creation);

//////      if (ta !== tb) return (ta - tb) * dirMul;

//////      // stable tie-break if timestamps are equal
//////      return String(a?.name || "").localeCompare(String(b?.name || ""));
//////    });
//////  }, [orders, createdSort]);

//////  // Toggle between asc/desc sorting
//////  function toggleCreatedSort() {
//////    setCreatedSort((prev) => (prev === "asc" ? "desc" : "asc"));
//////  }

//////  // -------------------- MF status change (dropdown) --------------------
//////  // Updates MF status for a PO and reloads list
//////  async function handleMfStatusChange(po, newStatus) {
//////    if (!newStatus) return;
//////    setError("");
//////    setMessage("");
//////    setMfUpdating(po.name);

//////    try {
//////      await setPurchaseOrderMfStatus(po.name, newStatus);
//////      setMessage(`MF Status updated for ${po.name}: ${newStatus}`);
//////      await loadOrders(page, mfFilter);
//////    } catch (err) {
//////      console.error(err);
//////      setError(err.response?.data?.error?.message || err.message || "MF status update failed");
//////    } finally {
//////      setMfUpdating("");
//////    }
//////  }

//////  // We fetch each PO details and build a small item summary string
//////  async function hydrateItemNames(rows) {
//////    try {
//////      const next = {};
//////      await mapLimit(rows, 5, async (po) => {
//////        try {
//////          const doc = await getPurchaseOrderWithItems(po.name);
//////          next[po.name] = buildItemSummary(doc.items || []);
//////        } catch (e) {
//////          next[po.name] = "";
//////        }
//////      });
//////      setPoItemsSummary((prev) => ({ ...prev, ...next }));
//////    } catch (e) {
//////      // ignore (we don't want list to break)
//////    }
//////  }

//////  // -------- LOAD POs --------
//////  // Loads one page of Purchase Orders from ERPNext with optional MF filter
//////  async function loadOrders(pageIndex = 0, mfStatus = "") {
//////    setLoading(true);
//////    setError("");
//////    setMessage("");

//////    try {
//////      // Base filter: only "open" statuses we care about
//////      const baseFilters = [
//////        ["Purchase Order", "status", "in", ["Draft", "To Receive and Bill", "To Receive", "To Bill"]],
//////      ];

//////      // MF filter (server-side)
//////      if (mfStatus) {
//////        baseFilters.push(["Purchase Order", MF_PO_FIELDS.status, "=", mfStatus]);
//////      }

//////      // Fetch with stable ordering by creation (not modified)
//////      let data = await getDoctypeList("Purchase Order", {
//////        fields: JSON.stringify([
//////          "name",
//////          "supplier",
//////          "company",
//////          "transaction_date",
//////          "status",
//////          "grand_total",
//////          "per_received",
//////          "per_billed",
//////          "creation",
//////          "custom_transporter",// used for sorting / stable ordering
//////          MF_PO_FIELDS.status,
//////          MF_PO_FIELDS.updatedOn,
//////          MF_PO_FIELDS.stockPercent,
//////        ]),
//////        filters: JSON.stringify(baseFilters),
//////        // We fetch in creation desc, then reverse in UI so newest appears at END
//////        order_by: "creation desc",
//////        limit_page_length: PAGE_SIZE + 1, // +1 so we can detect "hasMore"
//////        limit_start: pageIndex * PAGE_SIZE,
//////      });

//////      // Hide fully completed (100% received & billed)
//////      data = data.filter((row) => {
//////        const r = Number(row.per_received || 0);
//////        const b = Number(row.per_billed || 0);
//////        return !(r >= 100 && b >= 100);
//////      });

//////      // Take only current page rows
//////      const pageRows = data.slice(0, PAGE_SIZE);

//////      // ✅ Reverse so "latest PO is at the end"
//////      const displayRows = [...pageRows].reverse();

//////      setHasMore(data.length > PAGE_SIZE);
//////      setOrders(displayRows);
//////      setPage(pageIndex);
//////      setQcEdit(null);

//////      // Load item summary for visible rows
//////      hydrateItemNames(displayRows);
//////    } catch (err) {
//////      console.error(err);
//////      setError(err.message || "Failed to load Purchase Orders");
//////    } finally {
//////      setLoading(false);
//////    }
//////  }

//////  // Initial load on mount
//////  useEffect(() => {
//////    loadOrders(0, mfFilter);
//////    // eslint-disable-next-line react-hooks/exhaustive-deps
//////    getTransporters()
//////      .then((rows) => setTransporters(rows || []))
//////      .catch((e) => console.error("Transporters load failed", e));
//////  }, []);

//////  //  MF Filter change (reload from page 0)
//////  async function onMfFilterChange(v) {
//////    setMfFilter(v);
//////    await loadOrders(0, v);
//////  }

//////  // ---------------- QC PASS (MULTI ITEM) ----------------
//////  // Step 1: user clicks "QC Pass & Receive"
//////  // We load PO items and open the inline editor to enter "good qty" per item
//////  async function startQcPass(po) {
//////    setError("");
//////    setMessage("");
//////    setQcPassLoading(po.name);

//////    try {
//////      const poDoc = await getPurchaseOrderWithItems(po.name);
//////      const poItems = poDoc.items || [];
//////      if (!poItems.length) throw new Error("Purchase Order has no items to receive");

//////      // Create editable rows for only remaining qty
//////      const rows = poItems
//////        .map((it) => {
//////          const ordered = Number(it.qty || 0);
//////          const received = Number(it.received_qty || 0);
//////          const remaining = ordered - received;

//////          if (remaining <= 0) return null;

//////          return {
//////            rowId: it.name, // purchase_order_item id
//////            item_code: it.item_code,
//////            item_name: it.item_name,
//////            maxQty: remaining,                 // remaining qty allowed
//////            goodQtyInput: String(remaining),   // default: accept all as good
//////            poItem: it,
//////          };
//////        })
//////        .filter(Boolean);

//////      if (!rows.length) throw new Error("All quantities already received for this Purchase Order.");

//////      setQcEdit({
//////        poName: po.name,
//////        poDoc,
//////        rows,
//////      });

//////      setMessage(`Enter good quantity for each item in PO ${po.name}.`);
//////    } catch (err) {
//////      console.error(err);
//////      setError(err.response?.data?.error?.message || err.message || "Failed to load Purchase Order for QC");
//////    } finally {
//////      setQcPassLoading("");
//////    }
//////  }

//////  // Update a single QC input field by rowId
//////  function updateQcRowQty(rowId, value) {
//////    setQcEdit((prev) => {
//////      if (!prev) return prev;
//////      return {
//////        ...prev,
//////        rows: prev.rows.map((r) => (r.rowId === rowId ? { ...r, goodQtyInput: value } : r)),
//////      };
//////    });
//////  }

//////  // Step 2: user clicks "Receive"
//////  // We create Purchase Receipt with accepted + rejected quantities
//////  async function confirmQcPass() {
//////    if (!qcEdit) return;

//////    const { poName, poDoc, rows } = qcEdit;

//////    setError("");
//////    setMessage("");
//////    setQcPassLoading(poName);

//////    try {
//////      // validate + compute totals
//////      let totalRemaining = 0;
//////      let totalGood = 0;

//////      const prItems = [];

//////      for (const r of rows) {
//////        const goodQty = Number(r.goodQtyInput);
//////        const maxQty = Number(r.maxQty || 0);

//////        // validation: good must be between 0 and maxQty
//////        if (isNaN(goodQty) || goodQty < 0 || goodQty > maxQty) {
//////          throw new Error(
//////            `Invalid qty for ${r.item_code}. Enter 0 to ${maxQty}.`
//////          );
//////        }

//////        // badQty = remaining - goodQty
//////        const badQty = maxQty - goodQty;
//////        const receivedQty = goodQty + badQty; // equals maxQty

//////        totalRemaining += maxQty;
//////        totalGood += goodQty;

//////        // if nothing received for a line, skip
//////        if (receivedQty <= 0) continue;

//////        // Build Purchase Receipt item row
//////        prItems.push({
//////          item_code: r.poItem.item_code,

//////          qty: goodQty,               // accepted qty
//////          received_qty: receivedQty,  // accepted + rejected
//////          accepted_qty: goodQty,
//////          rejected_qty: badQty,

//////          warehouse: ACCEPTED_WAREHOUSE,
//////          ...(badQty > 0 ? { rejected_warehouse: REJECTED_WAREHOUSE } : {}),

//////          rate: r.poItem.rate,

//////          purchase_order: poDoc.name,
//////          purchase_order_item: r.poItem.name,
//////        });
//////      }

//////      if (!prItems.length) {
//////        setMessage("No quantity to receive.");
//////        setQcEdit(null);
//////        return;
//////      }

//////      // Calculate if everything in this receive step was good (no rejection)
//////      const allGoodThisRound = totalRemaining > 0 && totalGood === totalRemaining;

//////      // % stock in (good / total) for this receive step
//////      const percent = totalRemaining > 0 ? round2((totalGood / totalRemaining) * 100) : 0;

//////      const today = new Date().toISOString().slice(0, 10);

//////      // Purchase Receipt payload
//////      const prPayload = {
//////        doctype: "Purchase Receipt",
//////        supplier: poDoc.supplier,
//////        company: poDoc.company,
//////        posting_date: today,
//////        purchase_order: poDoc.name,
//////        items: prItems,
//////      };

//////      // Create and submit Purchase Receipt
//////      const prDoc = await createDoc("Purchase Receipt", prPayload);
//////      const prName = prDoc.data?.name;
//////      if (prName) await submitDoc("Purchase Receipt", prName);

//////      // Store PR reference + stock percent in local UI state
//////      setReceivedPO((prev) => ({
//////        ...prev,
//////        [poName]: { prName: prName || null, allGood: allGoodThisRound, stockPercent: percent },
//////      }));

//////      // Update MF status for PO
//////      await setPurchaseOrderMfStatus(poName, "QC In", { stockPercent: percent });

//////      setMessage(
//////        prName
//////          ? `QC PASS: PR ${prName} created from ${poName} (good ${round2(totalGood)}, total ${round2(totalRemaining)}).`
//////          : `QC PASS: PR created from ${poName}.`
//////      );

//////      // close QC editor + reload list
//////      setQcEdit(null);
//////      await loadOrders(page, mfFilter);
//////    } catch (err) {
//////      console.error(err);
//////      setError(err.response?.data?.error?.message || err.message || "Failed to create Purchase Receipt");
//////    } finally {
//////      setQcPassLoading("");
//////    }
//////  }

//////  // Cancel QC inline editor
//////  function cancelQcPass() {
//////    setQcEdit(null);
//////    setMessage("");
//////  }

//////  // ---------------- QC FAIL ----------------
//////  // Marks MF status as Cancelled and cancels the Purchase Order
//////  async function handleQcFail(po) {
//////    setError("");
//////    setMessage("");
//////    setQcFailLoading(po.name);

//////    try {
//////      await setPurchaseOrderMfStatus(po.name, "Cancelled");
//////      await cancelPurchaseOrder(po.name);

//////      setMessage(`QC marked as FAIL. Purchase Order ${po.name} has been cancelled.`);
//////      await loadOrders(page, mfFilter);
//////    } catch (err) {
//////      console.error(err);
//////      setError(err.response?.data?.error?.message || err.message || "Failed to cancel Purchase Order");
//////    } finally {
//////      setQcFailLoading("");
//////    }
//////  }

//////  // ---------------- Submit PO (Draft) ----------------
//////  // Used only when PO status is "Draft"
//////  async function handleSubmitPoFromList(po) {
//////    setError("");
//////    setMessage("");
//////    setSubmitPoLoading(po.name);

//////    try {
//////      await submitDoc("Purchase Order", po.name);
//////      setMessage(`Purchase Order submitted: ${po.name}`);
//////      await loadOrders(page, mfFilter);
//////    } catch (err) {
//////      console.error(err);
//////      setError(err.response?.data?.error?.message || err.message || "Failed to submit Purchase Order");
//////    } finally {
//////      setSubmitPoLoading("");
//////    }
//////  }

//////  // ---------------- Create Invoice (Paid) ----------------
//////  // This creates Purchase Invoice, submits it, creates Payment Entry, and updates PO status
//////  async function handleCreateInvoice(po) {
//////    setError("");
//////    setMessage("");
//////    setInvoiceLoading(po.name);

//////    try {
//////      const poDoc = await getPurchaseOrderWithItems(po.name);
//////      const poItems = poDoc.items || [];
//////      if (!poItems.length) throw new Error("Purchase Order has no items for invoice");

//////      const today = new Date().toISOString().slice(0, 10);

//////      // Pull PR info from UI state (if available)
//////      const receivedInfo = receivedPO[po.name] || {};
//////      const sessionPrName = receivedInfo.prName || null;
//////      const allGood = receivedInfo.allGood !== undefined ? receivedInfo.allGood : true;

//////      // Purchase Invoice payload
//////      const piPayload = {
//////        doctype: "Purchase Invoice",
//////        supplier: poDoc.supplier,
//////        company: poDoc.company,
//////        posting_date: today,
//////        purchase_order: poDoc.name,
//////        items: poItems.map((it) => ({
//////          item_code: it.item_code,
//////          qty: it.qty,
//////          rate: it.rate,
//////          purchase_order: poDoc.name,
//////          po_detail: it.name,
//////          ...(sessionPrName ? { purchase_receipt: sessionPrName } : {}),
//////        })),
//////      };

//////      // Create PI
//////      const piDoc = await createDoc("Purchase Invoice", piPayload);
//////      const piName = piDoc.data?.name;

//////      if (piName) {
//////        // Submit PI
//////        await submitDoc("Purchase Invoice", piName);

//////        // Fetch full PI doc (needed for payment entry helper)
//////        const fullPi = await getDoc("Purchase Invoice", piName);

//////        // Create payment entry => marks invoice as paid
//////        await createPaymentEntryForPurchaseInvoice(fullPi);

//////        // Update PO status based on good/rejected
//////        const statusToSet = allGood ? "Completed" : "Closed";
//////        await setPurchaseOrderStatus(poDoc.name, statusToSet);

//////        // If not all good, try to close PO
//////        if (!allGood) {
//////          try {
//////            await closePurchaseOrder(poDoc.name);
//////          } catch (e) { }
//////        }

//////        // Stock percent stored in MF field (prefer ERP value, fallback to local state)
//////        const percent =
//////          po?.[MF_PO_FIELDS.stockPercent] != null && po?.[MF_PO_FIELDS.stockPercent] !== ""
//////            ? Number(po[MF_PO_FIELDS.stockPercent])
//////            : receivedPO?.[po.name]?.stockPercent;

//////        // Set MF status to Completed
//////        await setPurchaseOrderMfStatus(poDoc.name, "Completed", { stockPercent: percent });
//////      }

//////      setMessage(piName ? `Purchase Invoice created, submitted, PAID and PO updated: ${piName}.` : `Purchase Invoice created from ${po.name}`);
//////      await loadOrders(page, mfFilter);
//////    } catch (err) {
//////      console.error(err);
//////      setError(err.response?.data?.error?.message || err.message || "Failed to create / pay Purchase Invoice");
//////    } finally {
//////      setInvoiceLoading("");
//////    }
//////  }

//////  // ---------------- Upload Invoice (Draft PI + attach PDF only) ----------------
//////  // Step 1: user clicks "Upload Invoice" → we trigger hidden file input
//////  function startUploadInvoice(po) {
//////    setError("");
//////    setMessage("");
//////    setUploadTargetPo(po);
//////    uploadInputRef.current?.click();
//////  }

//////  // When user selects a file from the file picker
//////  async function onInvoicePdfPicked(e) {
//////    const file = e.target.files?.[0];
//////    e.target.value = ""; // reset input so same file can be selected again
//////    if (!file || !uploadTargetPo) return;

//////    // Allow only PDFs
//////    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
//////    if (!isPdf) {
//////      setError("Please select a PDF file.");
//////      setUploadTargetPo(null);
//////      return;
//////    }

//////    await handleUploadInvoice(uploadTargetPo, file);
//////    setUploadTargetPo(null);
//////  }

//////  // Step 2: create DRAFT Purchase Invoice and attach PDF to it
//////  async function handleUploadInvoice(po, pdfFile) {
//////    setError("");
//////    setMessage("");
//////    setUploadInvoiceLoading(po.name);

//////    try {
//////      const poDoc = await getPurchaseOrderWithItems(po.name);
//////      const poItems = poDoc.items || [];
//////      if (!poItems.length) throw new Error("Purchase Order has no items for invoice");

//////      const today = new Date().toISOString().slice(0, 10);

//////      const receivedInfo = receivedPO[po.name] || {};
//////      const sessionPrName = receivedInfo.prName || null;

//////      // Create draft PI first
//////      const piPayload = {
//////        doctype: "Purchase Invoice",
//////        supplier: poDoc.supplier,
//////        company: poDoc.company,
//////        posting_date: today,
//////        purchase_order: poDoc.name,
//////        items: poItems.map((it) => ({
//////          item_code: it.item_code,
//////          qty: it.qty,
//////          rate: it.rate,
//////          purchase_order: poDoc.name,
//////          po_detail: it.name,
//////          ...(sessionPrName ? { purchase_receipt: sessionPrName } : {}),
//////        })),
//////      };

//////      const piDoc = await createDoc("Purchase Invoice", piPayload);
//////      const piName = piDoc.data?.name;
//////      if (!piName) throw new Error("Purchase Invoice not created (missing name).");

//////      // Upload PDF and attach to PI
//////      await uploadFileToDoc({
//////        doctype: "Purchase Invoice",
//////        docname: piName,
//////        file: pdfFile,
//////        is_private: 1,
//////      });

//////      // Store PI name so UI shows "Submit Invoice" for this PO
//////      setDraftPiByPo((prev) => ({ ...prev, [po.name]: piName }));

//////      setMessage(`Draft PI created and PDF uploaded: ${piName}. Now click "Submit Invoice".`);

//////      await loadOrders(page, mfFilter);
//////    } catch (err) {
//////      console.error(err);
//////      setError(err.response?.data?.error?.message || err.message || "Failed to upload invoice PDF / create draft PI");
//////    } finally {
//////      setUploadInvoiceLoading("");
//////    }
//////  }

//////  // ---------------- Submit invoice AFTER upload ----------------
//////  // This submits the draft PI, pays it, and updates PO/MF status
//////  async function handleSubmitDraftInvoice(po) {
//////    const piName = draftPiByPo[po.name];
//////    if (!piName) return;

//////    setError("");
//////    setMessage("");
//////    setSubmitInvLoading(po.name);

//////    try {
//////      const poDoc = await getPurchaseOrderWithItems(po.name);

//////      // Submit PI
//////      await submitDoc("Purchase Invoice", piName);

//////      // Pay PI
//////      const fullPi = await getDoc("Purchase Invoice", piName);
//////      await createPaymentEntryForPurchaseInvoice(fullPi);

//////      // Determine "all good" using local state or MF % field
//////      const receivedInfo = receivedPO[po.name] || {};
//////      const percentFromErp =
//////        po?.[MF_PO_FIELDS.stockPercent] != null && po?.[MF_PO_FIELDS.stockPercent] !== ""
//////          ? Number(po[MF_PO_FIELDS.stockPercent])
//////          : undefined;

//////      const allGood =
//////        receivedInfo.allGood !== undefined
//////          ? receivedInfo.allGood
//////          : percentFromErp != null
//////            ? percentFromErp >= 99.999
//////            : true;

//////      // Update PO status
//////      const statusToSet = allGood ? "Completed" : "Closed";
//////      await setPurchaseOrderStatus(poDoc.name, statusToSet);

//////      // If not all good, try closing PO
//////      if (!allGood) {
//////        try {
//////          await closePurchaseOrder(poDoc.name);
//////        } catch (e) { }
//////      }

//////      // Stock percent (prefer ERP, fallback to UI state)
//////      const percent =
//////        po?.[MF_PO_FIELDS.stockPercent] != null && po?.[MF_PO_FIELDS.stockPercent] !== ""
//////          ? Number(po[MF_PO_FIELDS.stockPercent])
//////          : receivedPO?.[po.name]?.stockPercent;

//////      // Update MF status
//////      await setPurchaseOrderMfStatus(poDoc.name, "Completed", { stockPercent: percent });

//////      // Remove the draft PI mapping so UI goes back to normal buttons
//////      setDraftPiByPo((prev) => {
//////        const next = { ...prev };
//////        delete next[po.name];
//////        return next;
//////      });

//////      setMessage(`Invoice submitted & PAID: ${piName}`);
//////      await loadOrders(page, mfFilter);
//////    } catch (err) {
//////      console.error(err);
//////      setError(err.response?.data?.error?.message || err.message || "Failed to submit/pay Purchase Invoice");
//////    } finally {
//////      setSubmitInvLoading("");
//////    }
//////  }

//////  // ---------------- Pagination handlers ----------------
//////  function handlePrevPage() {
//////    if (page === 0 || loading) return;
//////    loadOrders(page - 1, mfFilter);
//////  }

//////  function handleNextPage() {
//////    if (!hasMore || loading) return;
//////    loadOrders(page + 1, mfFilter);
//////  }

//////  // Reload current page
//////  async function reloadOrders() {
//////    await loadOrders(page, mfFilter);
//////  }

//////  return (
//////    <div className="po-list">
//////      {/* Hidden PDF input (used for Upload Invoice) */}
//////      <input
//////        ref={uploadInputRef}
//////        type="file"
//////        accept="application/pdf,.pdf"
//////        style={{ display: "none" }}
//////        onChange={onInvoicePdfPicked}
//////      />

//////      {/* Header section */}
//////      <div className="po-list-header">
//////        <div className="po-list-title-block">
//////          <h3 className="po-list-title">Recent Purchase Orders</h3>
//////          <p className="po-list-subtitle">Process: Draft → QC (good &amp; bad) → Receipt → Invoice (Paid)</p>
//////        </div>

//////        {/* Right side controls */}
//////        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
//////          {/* ✅ MF Status Filter */}
//////          <div className="po-list-pill" style={{ padding: "6px 10px" }}>
//////            MF Filter:&nbsp;
//////            <select
//////              value={mfFilter}
//////              onChange={(e) => onMfFilterChange(e.target.value)}
//////              style={{ padding: "4px 6px" }}
//////            >
//////              <option value="">All</option>
//////              {MF_STATUS_OPTIONS.map((s) => (
//////                <option key={s} value={s}>{s}</option>
//////              ))}
//////            </select>
//////          </div>

//////          {/* Sort toggle */}
//////          <div className="po-list-pill" style={{ padding: "6px 10px" }}>
//////            <button
//////              type="button"
//////              className="btn btn-outline btn-xs"
//////              onClick={toggleCreatedSort}
//////              disabled={loading}
//////            >
//////              {createdSortLabel}
//////            </button>
//////          </div>

//////          {/* Refresh */}
//////          <button
//////            type="button"
//////            className="btn btn-secondary btn-sm"
//////            onClick={reloadOrders}
//////            disabled={loading}
//////          >
//////            {loading ? "Refreshing..." : "Refresh"}
//////          </button>

//////          {/* Page indicator */}
//////          <div className="po-list-pill">
//////            Page {page + 1} · {orders.length} open PO{orders.length !== 1 ? "s" : ""}
//////          </div>
//////        </div>
//////      </div>

//////      {/* Loading / errors / messages */}
//////      {loading && <p className="po-list-loading text-muted">Loading purchase orders...</p>}
//////      {error && <p className="alert alert-error">{error}</p>}
//////      {message && <p className="alert alert-success">{message}</p>}

//////      {/* Table */}
//////      {!loading && !error && (
//////        <>
//////          {orders.length === 0 ? (
//////            <p className="po-list-empty text-muted">No Purchase Orders to process.</p>
//////          ) : (
//////            <div className="po-list-table-wrapper">
//////              <table className="po-list-table">
//////                <thead>
//////                  <tr>
//////                    <th>Name</th>
//////                    <th>Supplier</th>
//////                    <th>Items</th>
//////                    <th>Company</th>
//////                    <th>Date</th>
//////                    <th>Status</th>
//////                    <th>Grand Total</th>
//////                    <th>Actions</th>
//////                    <th>Transporter</th>
//////                    <th>MF Status</th>
//////                    <th>% Stock In</th>
//////                  </tr>
//////                </thead>

//////                <tbody>
//////                  {sortedOrders.map((po) => {
//////                    // per_received from ERP (>=1 means receipt happened)
//////                    const perReceived = Number(po.per_received || 0);
//////                    const receivedFromErp = perReceived > 0;

//////                    // MF status "QC In" or "Completed" also counts as received
//////                    const mf = po[MF_PO_FIELDS.status];
//////                    const receivedFromMf = mf === "QC In" || mf === "Completed";
//////                    const isReceived = receivedFromErp || receivedFromMf;

//////                    // Loading flags for this row
//////                    const isQcPassing = qcPassLoading === po.name;
//////                    const isQcFailing = qcFailLoading === po.name;
//////                    const isInvoicing = invoiceLoading === po.name;
//////                    const isUploading = uploadInvoiceLoading === po.name;
//////                    const isSubmittingPo = submitPoLoading === po.name;

//////                    // Draft check
//////                    const isDraft = po.status === "Draft";

//////                    // If qcEdit is open for this PO, show inline receive UI
//////                    const isThisQcEdit = qcEdit && qcEdit.poName === po.name;

//////                    // If invoice PDF uploaded, we store draft PI name here
//////                    const draftPiName = draftPiByPo[po.name];
//////                    const isSubmittingInvoice = submitInvLoading === po.name;

//////                    return (
//////                      <tr key={po.name}>
//////                        <td className="po-cell-name">{po.name}</td>
//////                        <td>{po.supplier}</td>

//////                        {/* ✅ Items column (summary string) */}
//////                        <td style={{ maxWidth: 420 }}>
//////                          <span style={{ fontSize: 12, opacity: 0.9 }}>
//////                            {poItemsSummary[po.name] || "—"}
//////                          </span>
//////                        </td>

//////                        <td>{po.company}</td>
//////                        <td>{po.transaction_date}</td>
//////                        <td>{po.status}</td>
//////                        <td className="po-cell-money">{po.grand_total}</td>

//////                        {/* Actions column: depends on status */}
//////                        <td className="po-cell-actions">
//////                          {/* If Draft: allow edit + submit */}
//////                          {isDraft ? (
//////                            <div className="po-actions-stack">
//////                              <button
//////                                onClick={() => onEditPo && onEditPo(po.name)}
//////                                className="btn btn-outline btn-xs"
//////                              >
//////                                Edit Draft
//////                              </button>

//////                              <button
//////                                onClick={() => {
//////                                  const ok = window.confirm(
//////                                    `You are about to SUBMIT Purchase Order: ${po.name}\n\nSubmit now?`
//////                                  );
//////                                  if (!ok) return;

//////                                  window.alert(`Submitting Purchase Order: ${po.name}`);
//////                                  handleSubmitPoFromList(po);
//////                                }}
//////                                disabled={isSubmittingPo}
//////                                className="btn btn-primary btn-xs"
//////                              >
//////                                {isSubmittingPo ? "Submitting..." : "Submit"}
//////                              </button>
//////                            </div>
//////                          ) : !isReceived ? (
//////                            // If NOT received yet: show QC actions
//////                            <div className="po-actions-stack">
//////                              {isThisQcEdit ? (
//////                                // Inline QC input UI (per item)
//////                                <div className="qc-inline" style={{ minWidth: 320 }}>
//////                                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
//////                                    Good Qty per item (remaining):
//////                                  </div>

//////                                  {/* MULTI ITEM inputs */}
//////                                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//////                                    {qcEdit.rows.map((r) => (
//////                                      <div
//////                                        key={r.rowId}
//////                                        style={{
//////                                          display: "flex",
//////                                          gap: 8,
//////                                          alignItems: "center",
//////                                          justifyContent: "space-between",
//////                                        }}
//////                                      >
//////                                        <div style={{ flex: 1, fontSize: 12 }}>
//////                                          <b>{r.item_code}</b>
//////                                          {r.item_name ? (
//////                                            <span style={{ opacity: 0.75 }}> · {r.item_name}</span>
//////                                          ) : null}
//////                                          <div style={{ opacity: 0.75 }}>
//////                                            Remaining: {round2(r.maxQty)}
//////                                          </div>
//////                                        </div>

//////                                        <input
//////                                          type="number"
//////                                          step="0.01"
//////                                          min={0}
//////                                          className="qc-inline-input"
//////                                          style={{ width: 110 }}
//////                                          value={r.goodQtyInput}
//////                                          onChange={(e) => updateQcRowQty(r.rowId, e.target.value)}
//////                                        />
//////                                      </div>
//////                                    ))}
//////                                  </div>

//////                                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
//////                                    <button
//////                                      onClick={confirmQcPass}
//////                                      disabled={isQcPassing}
//////                                      className="btn btn-outline btn-xs"
//////                                    >
//////                                      {isQcPassing ? "Receiving..." : "Receive"}
//////                                    </button>
//////                                    <button onClick={cancelQcPass} className="btn btn-ghost btn-xs">
//////                                      Cancel
//////                                    </button>
//////                                  </div>
//////                                </div>
//////                              ) : (
//////                                // Normal QC buttons
//////                                <>
//////                                  <button
//////                                    onClick={() => startQcPass(po)}
//////                                    disabled={isQcPassing || isQcFailing}
//////                                    className="btn btn-outline btn-xs"
//////                                  >
//////                                    {isQcPassing ? "Loading QC..." : "QC Pass & Receive"}
//////                                  </button>
//////                                  <button
//////                                    onClick={() => handleQcFail(po)}
//////                                    disabled={isQcPassing || isQcFailing}
//////                                    className="btn btn-danger btn-xs"
//////                                  >
//////                                    {isQcFailing ? "Marking Fail..." : "QC Fail"}
//////                                  </button>
//////                                </>
//////                              )}
//////                            </div>
//////                          ) : (
//////                            // If received: allow invoice actions
//////                            <>
//////                              {draftPiName ? (
//////                                // If PDF upload created draft PI: show submit invoice button only
//////                                <button
//////                                  onClick={() => handleSubmitDraftInvoice(po)}
//////                                  disabled={isSubmittingInvoice}
//////                                  className="btn btn-accent btn-xs"
//////                                >
//////                                  {isSubmittingInvoice ? "Submitting..." : `Submit Invoice (${draftPiName})`}
//////                                </button>
//////                              ) : (
//////                                // Normal invoice options: create invoice (paid) or upload invoice
//////                                <div className="po-actions-stack">
//////                                  <button
//////                                    onClick={() => handleCreateInvoice(po)}
//////                                    disabled={isInvoicing || isUploading}
//////                                    className="btn btn-accent btn-xs"
//////                                  >
//////                                    {isInvoicing ? "Creating Invoice..." : "Create Invoice (Paid)"}
//////                                  </button>

//////                                  <button
//////                                    onClick={() => startUploadInvoice(po)}
//////                                    disabled={isInvoicing || isUploading}
//////                                    className="btn btn-outline btn-xs"
//////                                  >
//////                                    {isUploading ? "Uploading..." : "Upload Invoice"}
//////                                  </button>
//////                                </div>
//////                              )}
//////                            </>
//////                          )}
//////                        </td>
//////                        <td>
//////                          {isDraft ? (
//////                            <select
//////                              value={po.custom_transporter || ""}
//////                              disabled={transporterUpdating === po.name}
//////                              onChange={async (e) => {
//////                                const t = e.target.value;
//////                                setTransporterUpdating(po.name);
//////                                setError("");
//////                                setMessage("");
//////                                try {
//////                                  await setPurchaseOrderTransporter(po.name, t);
//////                                  setMessage(`Transporter updated for ${po.name}`);
//////                                  await loadOrders(page, mfFilter);
//////                                } catch (err) {
//////                                  console.error(err);
//////                                  setError(err.message || "Failed to update transporter");
//////                                } finally {
//////                                  setTransporterUpdating("");
//////                                }
//////                              }}
//////                            >
//////                              <option value="">-- None --</option>
//////                              {transporters.map((t) => (
//////                                <option key={t.name} value={t.name}>
//////                                  {t.transporter_name || t.name}
//////                                </option>
//////                              ))}
//////                            </select>
//////                          ) : (
//////                            <span>
//////                              {po.custom_transporter
//////                                ? (transporterNameMap.get(po.custom_transporter) || po.custom_transporter)
//////                                : "—"}
//////                            </span>

//////                          )}
//////                        </td>

//////                        {/* MF status dropdown */}
//////                        <td>
//////                          <select
//////                            value={po[MF_PO_FIELDS.status] || ""}
//////                            onChange={(e) => handleMfStatusChange(po, e.target.value)}
//////                            disabled={mfUpdating === po.name}
//////                          >
//////                            <option value="">--</option>
//////                            {MF_STATUS_OPTIONS.map((s) => (
//////                              <option key={s} value={s}>{s}</option>
//////                            ))}
//////                          </select>

//////                          {/* MF updated date/time */}
//////                          <div style={{ fontSize: 12, opacity: 0.7 }}>
//////                            {po[MF_PO_FIELDS.updatedOn] || ""}
//////                          </div>
//////                        </td>

//////                        {/* % stock in (from MF field) */}
//////                        <td>
//////                          {po[MF_PO_FIELDS.stockPercent] != null && po[MF_PO_FIELDS.stockPercent] !== ""
//////                            ? `${Number(po[MF_PO_FIELDS.stockPercent]).toFixed(2)}%`
//////                            : ""}
//////                        </td>
//////                      </tr>
//////                    );
//////                  })}
//////                </tbody>
//////              </table>
//////            </div>
//////          )}

//////          {/* Pagination buttons */}
//////          <div className="po-list-pagination">
//////            <button onClick={handlePrevPage} disabled={page === 0 || loading} className="page-btn">
//////              ◀ Previous
//////            </button>
//////            <span className="po-list-page-text">Page {page + 1}</span>
//////            <button onClick={handleNextPage} disabled={!hasMore || loading} className="page-btn">
//////              Next ▶
//////            </button>
//////          </div>
//////        </>
//////      )}
//////    </div>
//////  );
//////}

//////export default PurchaseOrderList;


////// src/PurchaseOrderList.jsx
////import React, { useEffect, useMemo, useRef, useState } from "react";
////import {
////  getDoctypeList,
////  submitDoc,
////  getPurchaseOrderWithItems,
////  getDoc,
////  createPaymentEntryForPurchaseInvoice,
////  cancelPurchaseOrder,
////  setPurchaseOrderStatus,
////  setPurchaseOrderMfStatus, // ✅ Updated logic uses this
////  MF_PO_FIELDS,
////  MF_STATUS_OPTIONS, // ✅ Used for sequential logic
////  createDoc,
////  uploadFileToDoc,
////  closePurchaseOrder,
////  mapLimit,
////  getTransporters,
////  setPurchaseOrderTransporter,
////} from "../erpBackendApi";

////import "./PurchaseOrderList.css";

////// ... (Keep existing constants: PAGE_SIZE, Warehouses, helper functions like round2, buildItemSummary) ...
////const PAGE_SIZE = 20;
////const ACCEPTED_WAREHOUSE = "Raw Material - MF";
////const REJECTED_WAREHOUSE = "Rejected Warehouse - MF";

////function round2(n) {
////  const x = Number(n);
////  if (isNaN(x)) return 0;
////  return Math.round(x * 100) / 100;
////}

////function buildItemSummary(items = []) {
////  const clean = (items || [])
////    .map((it) => {
////      const code = it.item_code || it.item_name || "";
////      const name = it.item_name || "";
////      if (!code) return "";
////      return name && name !== code ? `${code} (${name})` : code;
////    })
////    .filter(Boolean);

////  if (!clean.length) return "";
////  const max = 3;
////  if (clean.length <= max) return clean.join(", ");
////  return `${clean.slice(0, max).join(", ")} +${clean.length - max} more`;
////}

////// ✅ UPDATED HELPER: Sequential Status + Conditional Cancel
////function getSequentialStatusOptions(currentStatus) {
////  // 1. Find where we are in the list
////  const currentIndex = MF_STATUS_OPTIONS.indexOf(currentStatus);
////  const deliveredIndex = MF_STATUS_OPTIONS.indexOf("Delivered");

////  // If status is unknown/empty, start at the beginning
////  if (currentIndex === -1) {
////    return [MF_STATUS_OPTIONS[0]]; 
////  }

////  // 2. Base options: [Current Status]
////  const options = [currentStatus];

////  // 3. Add Next Status (if not at the end)
////  // We ignore "Cancelled" in the sequential flow here because we handle it specifically below
////  if (currentIndex < MF_STATUS_OPTIONS.length - 1) {
////    const nextStatus = MF_STATUS_OPTIONS[currentIndex + 1];
////    if (nextStatus !== "Cancelled") { 
////       options.push(nextStatus);
////    }
////  }

////  // 4. ✅ CONDITIONAL CANCEL
////  // Show "Cancelled" if we are at "Delivered" stage or earlier
////  // AND the current status itself isn't already "Cancelled"
////  if (currentIndex < deliveredIndex && currentStatus !== "Cancelled") {
////    options.push("Cancelled");
////  }

////  return options;
////}

////function PurchaseOrderList({ onEditPo }) {
////  // ... (Keep all existing state: orders, page, loading, qcEdit, etc.) ...
////  const [orders, setOrders] = useState([]);
////  const [page, setPage] = useState(0);
////  const [hasMore, setHasMore] = useState(false);
////  const [loading, setLoading] = useState(false);
////  const [transporters, setTransporters] = useState([]);
////  const [transporterUpdating, setTransporterUpdating] = useState("");

////  const transporterNameMap = useMemo(() => {
////    const m = new Map();
////    (transporters || []).forEach((t) => {
////      m.set(t.name, t.transporter_name || t.name);
////    });
////    return m;
////  }, [transporters]);

////  const [qcPassLoading, setQcPassLoading] = useState("");
////  const [qcFailLoading, setQcFailLoading] = useState("");
////  const [invoiceLoading, setInvoiceLoading] = useState("");
////  const [submitPoLoading, setSubmitPoLoading] = useState("");
////  const [mfFilter, setMfFilter] = useState("");
////  const [qcEdit, setQcEdit] = useState(null);
////  const [receivedPO, setReceivedPO] = useState({});
////  const [error, setError] = useState("");
////  const [message, setMessage] = useState("");
////  const [mfUpdating, setMfUpdating] = useState("");
////  const [poItemsSummary, setPoItemsSummary] = useState({});
////  const uploadInputRef = useRef(null);
////  const [uploadTargetPo, setUploadTargetPo] = useState(null);
////  const [uploadInvoiceLoading, setUploadInvoiceLoading] = useState("");
////  const [draftPiByPo, setDraftPiByPo] = useState({});
////  const [submitInvLoading, setSubmitInvLoading] = useState("");
////  const [createdSort, setCreatedSort] = useState("asc");

////  const createdSortLabel =
////    createdSort === "asc"
////      ? "Sort by Created: Oldest → Newest"
////      : "Sort by Created: Newest → Oldest";

////  function toSortTs(v) {
////    if (!v) return 0;
////    const s = String(v).trim();
////    if (!s) return 0;
////    const isoLike = s.includes(" ") ? s.replace(" ", "T") : s;
////    const d = new Date(isoLike);
////    const t = d.getTime();
////    return Number.isFinite(t) ? t : 0;
////  }

////  const sortedOrders = useMemo(() => {
////    const dirMul = createdSort === "asc" ? 1 : -1;
////    return [...orders].sort((a, b) => {
////      const ta = toSortTs(a?.creation);
////      const tb = toSortTs(b?.creation);
////      if (ta !== tb) return (ta - tb) * dirMul;
////      return String(a?.name || "").localeCompare(String(b?.name || ""));
////    });
////  }, [orders, createdSort]);

////  function toggleCreatedSort() {
////    setCreatedSort((prev) => (prev === "asc" ? "desc" : "asc"));
////  }

////  // ... (Keep existing handleMfStatusChange, hydrateItemNames, loadOrders, etc.) ...

////  async function handleMfStatusChange(po, newStatus) {
////    if (!newStatus) return;
////    setError("");
////    setMessage("");
////    setMfUpdating(po.name);

////    try {
////      // Logic handles the date update in erpBackendApi
////      await setPurchaseOrderMfStatus(po.name, newStatus);
////      setMessage(`MF Status updated for ${po.name}: ${newStatus}`);
////      await loadOrders(page, mfFilter);
////    } catch (err) {
////      console.error(err);
////      setError(err.response?.data?.error?.message || err.message || "MF status update failed");
////    } finally {
////      setMfUpdating("");
////    }
////  }

////  async function hydrateItemNames(rows) {
////    try {
////      const next = {};
////      await mapLimit(rows, 5, async (po) => {
////        try {
////          const doc = await getPurchaseOrderWithItems(po.name);
////          next[po.name] = buildItemSummary(doc.items || []);
////        } catch (e) {
////          next[po.name] = "";
////        }
////      });
////      setPoItemsSummary((prev) => ({ ...prev, ...next }));
////    } catch (e) { }
////  }

////  async function loadOrders(pageIndex = 0, mfStatus = "") {
////    setLoading(true);
////    setError("");
////    setMessage("");

////    try {
////      const baseFilters = [
////        ["Purchase Order", "status", "in", ["Draft", "To Receive and Bill", "To Receive", "To Bill"]],
////      ];

////      if (mfStatus) {
////        baseFilters.push(["Purchase Order", MF_PO_FIELDS.status, "=", mfStatus]);
////      }

////      let data = await getDoctypeList("Purchase Order", {
////        fields: JSON.stringify([
////          "name",
////          "supplier",
////          "company",
////          "transaction_date",
////          "status",
////          "grand_total",
////          "per_received",
////          "per_billed",
////          "creation",
////          "custom_transporter",
////          MF_PO_FIELDS.status,
////          MF_PO_FIELDS.updatedOn,
////          MF_PO_FIELDS.stockPercent,
////        ]),
////        filters: JSON.stringify(baseFilters),
////        order_by: "creation desc",
////        limit_page_length: PAGE_SIZE + 1,
////        limit_start: pageIndex * PAGE_SIZE,
////      });

////      data = data.filter((row) => {
////        const r = Number(row.per_received || 0);
////        const b = Number(row.per_billed || 0);
////        return !(r >= 100 && b >= 100);
////      });

////      const pageRows = data.slice(0, PAGE_SIZE);
////      const displayRows = [...pageRows].reverse();

////      setHasMore(data.length > PAGE_SIZE);
////      setOrders(displayRows);
////      setPage(pageIndex);
////      setQcEdit(null);
////      hydrateItemNames(displayRows);
////    } catch (err) {
////      console.error(err);
////      setError(err.message || "Failed to load Purchase Orders");
////    } finally {
////      setLoading(false);
////    }
////  }

////  useEffect(() => {
////    loadOrders(0, mfFilter);
////    getTransporters()
////      .then((rows) => setTransporters(rows || []))
////      .catch((e) => console.error("Transporters load failed", e));
////  }, []);

////  async function onMfFilterChange(v) {
////    setMfFilter(v);
////    await loadOrders(0, v);
////  }

////  // ... (Keep existing QC Pass/Fail functions exactly as is) ...
////  async function startQcPass(po) { /* ... code ... */  setError(""); setMessage(""); setQcPassLoading(po.name); try { const poDoc = await getPurchaseOrderWithItems(po.name); const poItems = poDoc.items || []; if (!poItems.length) throw new Error("Purchase Order has no items to receive"); const rows = poItems.map((it) => { const ordered = Number(it.qty || 0); const received = Number(it.received_qty || 0); const remaining = ordered - received; if (remaining <= 0) return null; return { rowId: it.name, item_code: it.item_code, item_name: it.item_name, maxQty: remaining, goodQtyInput: String(remaining), poItem: it, }; }).filter(Boolean); if (!rows.length) throw new Error("All quantities already received for this Purchase Order."); setQcEdit({ poName: po.name, poDoc, rows, }); setMessage(`Enter good quantity for each item in PO ${po.name}.`); } catch (err) { console.error(err); setError(err.response?.data?.error?.message || err.message || "Failed to load Purchase Order for QC"); } finally { setQcPassLoading(""); } }
////  function updateQcRowQty(rowId, value) { setQcEdit((prev) => { if (!prev) return prev; return { ...prev, rows: prev.rows.map((r) => (r.rowId === rowId ? { ...r, goodQtyInput: value } : r)), }; }); }
////  async function confirmQcPass() { if (!qcEdit) return; const { poName, poDoc, rows } = qcEdit; setError(""); setMessage(""); setQcPassLoading(poName); try { let totalRemaining = 0; let totalGood = 0; const prItems = []; for (const r of rows) { const goodQty = Number(r.goodQtyInput); const maxQty = Number(r.maxQty || 0); if (isNaN(goodQty) || goodQty < 0 || goodQty > maxQty) { throw new Error(`Invalid qty for ${r.item_code}. Enter 0 to ${maxQty}.`); } const badQty = maxQty - goodQty; const receivedQty = goodQty + badQty; totalRemaining += maxQty; totalGood += goodQty; if (receivedQty <= 0) continue; prItems.push({ item_code: r.poItem.item_code, qty: goodQty, received_qty: receivedQty, accepted_qty: goodQty, rejected_qty: badQty, warehouse: ACCEPTED_WAREHOUSE, ...(badQty > 0 ? { rejected_warehouse: REJECTED_WAREHOUSE } : {}), rate: r.poItem.rate, purchase_order: poDoc.name, purchase_order_item: r.poItem.name, }); } if (!prItems.length) { setMessage("No quantity to receive."); setQcEdit(null); return; } const allGoodThisRound = totalRemaining > 0 && totalGood === totalRemaining; const percent = totalRemaining > 0 ? round2((totalGood / totalRemaining) * 100) : 0; const today = new Date().toISOString().slice(0, 10); const prPayload = { doctype: "Purchase Receipt", supplier: poDoc.supplier, company: poDoc.company, posting_date: today, purchase_order: poDoc.name, items: prItems, }; const prDoc = await createDoc("Purchase Receipt", prPayload); const prName = prDoc.data?.name; if (prName) await submitDoc("Purchase Receipt", prName); setReceivedPO((prev) => ({ ...prev, [poName]: { prName: prName || null, allGood: allGoodThisRound, stockPercent: percent }, })); await setPurchaseOrderMfStatus(poName, "QC In", { stockPercent: percent }); setMessage(prName ? `QC PASS: PR ${prName} created from ${poName} (good ${round2(totalGood)}, total ${round2(totalRemaining)}).` : `QC PASS: PR created from ${poName}.`); setQcEdit(null); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.response?.data?.error?.message || err.message || "Failed to create Purchase Receipt"); } finally { setQcPassLoading(""); } }
////  function cancelQcPass() { setQcEdit(null); setMessage(""); }
////  async function handleQcFail(po) { setError(""); setMessage(""); setQcFailLoading(po.name); try { await setPurchaseOrderMfStatus(po.name, "Cancelled"); await cancelPurchaseOrder(po.name); setMessage(`QC marked as FAIL. Purchase Order ${po.name} has been cancelled.`); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.response?.data?.error?.message || err.message || "Failed to cancel Purchase Order"); } finally { setQcFailLoading(""); } }

////  // ... (Keep Submit/Invoice functions exactly as is) ...
////  async function handleSubmitPoFromList(po) { setError(""); setMessage(""); setSubmitPoLoading(po.name); try { await submitDoc("Purchase Order", po.name); setMessage(`Purchase Order submitted: ${po.name}`); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.response?.data?.error?.message || err.message || "Failed to submit Purchase Order"); } finally { setSubmitPoLoading(""); } }
////  async function handleCreateInvoice(po) { setError(""); setMessage(""); setInvoiceLoading(po.name); try { const poDoc = await getPurchaseOrderWithItems(po.name); const poItems = poDoc.items || []; if (!poItems.length) throw new Error("Purchase Order has no items for invoice"); const today = new Date().toISOString().slice(0, 10); const receivedInfo = receivedPO[po.name] || {}; const sessionPrName = receivedInfo.prName || null; const allGood = receivedInfo.allGood !== undefined ? receivedInfo.allGood : true; const piPayload = { doctype: "Purchase Invoice", supplier: poDoc.supplier, company: poDoc.company, posting_date: today, purchase_order: poDoc.name, items: poItems.map((it) => ({ item_code: it.item_code, qty: it.qty, rate: it.rate, purchase_order: poDoc.name, po_detail: it.name, ...(sessionPrName ? { purchase_receipt: sessionPrName } : {}), })), }; const piDoc = await createDoc("Purchase Invoice", piPayload); const piName = piDoc.data?.name; if (piName) { await submitDoc("Purchase Invoice", piName); const fullPi = await getDoc("Purchase Invoice", piName); await createPaymentEntryForPurchaseInvoice(fullPi); const statusToSet = allGood ? "Completed" : "Closed"; await setPurchaseOrderStatus(poDoc.name, statusToSet); if (!allGood) { try { await closePurchaseOrder(poDoc.name); } catch (e) { } } const percent = po?.[MF_PO_FIELDS.stockPercent] != null && po?.[MF_PO_FIELDS.stockPercent] !== "" ? Number(po[MF_PO_FIELDS.stockPercent]) : receivedPO?.[po.name]?.stockPercent; await setPurchaseOrderMfStatus(poDoc.name, "Completed", { stockPercent: percent }); } setMessage(piName ? `Purchase Invoice created, submitted, PAID and PO updated: ${piName}.` : `Purchase Invoice created from ${po.name}`); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.response?.data?.error?.message || err.message || "Failed to create / pay Purchase Invoice"); } finally { setInvoiceLoading(""); } }
////  function startUploadInvoice(po) { setError(""); setMessage(""); setUploadTargetPo(po); uploadInputRef.current?.click(); }
////  async function onInvoicePdfPicked(e) { const file = e.target.files?.[0]; e.target.value = ""; if (!file || !uploadTargetPo) return; const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"); if (!isPdf) { setError("Please select a PDF file."); setUploadTargetPo(null); return; } await handleUploadInvoice(uploadTargetPo, file); setUploadTargetPo(null); }
////  async function handleUploadInvoice(po, pdfFile) { setError(""); setMessage(""); setUploadInvoiceLoading(po.name); try { const poDoc = await getPurchaseOrderWithItems(po.name); const poItems = poDoc.items || []; if (!poItems.length) throw new Error("Purchase Order has no items for invoice"); const today = new Date().toISOString().slice(0, 10); const receivedInfo = receivedPO[po.name] || {}; const sessionPrName = receivedInfo.prName || null; const piPayload = { doctype: "Purchase Invoice", supplier: poDoc.supplier, company: poDoc.company, posting_date: today, purchase_order: poDoc.name, items: poItems.map((it) => ({ item_code: it.item_code, qty: it.qty, rate: it.rate, purchase_order: poDoc.name, po_detail: it.name, ...(sessionPrName ? { purchase_receipt: sessionPrName } : {}), })), }; const piDoc = await createDoc("Purchase Invoice", piPayload); const piName = piDoc.data?.name; if (!piName) throw new Error("Purchase Invoice not created (missing name)."); await uploadFileToDoc({ doctype: "Purchase Invoice", docname: piName, file: pdfFile, is_private: 1, }); setDraftPiByPo((prev) => ({ ...prev, [po.name]: piName })); setMessage(`Draft PI created and PDF uploaded: ${piName}. Now click "Submit Invoice".`); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.response?.data?.error?.message || err.message || "Failed to upload invoice PDF / create draft PI"); } finally { setUploadInvoiceLoading(""); } }
////  async function handleSubmitDraftInvoice(po) { const piName = draftPiByPo[po.name]; if (!piName) return; setError(""); setMessage(""); setSubmitInvLoading(po.name); try { const poDoc = await getPurchaseOrderWithItems(po.name); await submitDoc("Purchase Invoice", piName); const fullPi = await getDoc("Purchase Invoice", piName); await createPaymentEntryForPurchaseInvoice(fullPi); const receivedInfo = receivedPO[po.name] || {}; const percentFromErp = po?.[MF_PO_FIELDS.stockPercent] != null && po?.[MF_PO_FIELDS.stockPercent] !== "" ? Number(po[MF_PO_FIELDS.stockPercent]) : undefined; const allGood = receivedInfo.allGood !== undefined ? receivedInfo.allGood : percentFromErp != null ? percentFromErp >= 99.999 : true; const statusToSet = allGood ? "Completed" : "Closed"; await setPurchaseOrderStatus(poDoc.name, statusToSet); if (!allGood) { try { await closePurchaseOrder(poDoc.name); } catch (e) { } } const percent = po?.[MF_PO_FIELDS.stockPercent] != null && po?.[MF_PO_FIELDS.stockPercent] !== "" ? Number(po[MF_PO_FIELDS.stockPercent]) : receivedPO?.[po.name]?.stockPercent; await setPurchaseOrderMfStatus(poDoc.name, "Completed", { stockPercent: percent }); setDraftPiByPo((prev) => { const next = { ...prev }; delete next[po.name]; return next; }); setMessage(`Invoice submitted & PAID: ${piName}`); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.response?.data?.error?.message || err.message || "Failed to submit/pay Purchase Invoice"); } finally { setSubmitInvLoading(""); } }

////  function handlePrevPage() { if (page === 0 || loading) return; loadOrders(page - 1, mfFilter); }
////  function handleNextPage() { if (!hasMore || loading) return; loadOrders(page + 1, mfFilter); }
////  async function reloadOrders() { await loadOrders(page, mfFilter); }

////  return (
////    <div className="po-list">
////      <input ref={uploadInputRef} type="file" accept="application/pdf,.pdf" style={{ display: "none" }} onChange={onInvoicePdfPicked} />

////      <div className="po-list-header">
////        <div className="po-list-title-block">
////          <h3 className="po-list-title">Recent Purchase Orders</h3>
////          <p className="po-list-subtitle">Process: Draft → QC (good &amp; bad) → Receipt → Invoice (Paid)</p>
////        </div>
////        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
////          <div className="po-list-pill" style={{ padding: "6px 10px" }}>
////            MF Filter:&nbsp;
////            <select value={mfFilter} onChange={(e) => onMfFilterChange(e.target.value)} style={{ padding: "4px 6px" }}>
////              <option value="">All</option>
////              {MF_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
////            </select>
////          </div>
////          <div className="po-list-pill" style={{ padding: "6px 10px" }}>
////            <button type="button" className="btn btn-outline btn-xs" onClick={toggleCreatedSort} disabled={loading}>
////              {createdSortLabel}
////            </button>
////          </div>
////          <button type="button" className="btn btn-secondary btn-sm" onClick={reloadOrders} disabled={loading}>
////            {loading ? "Refreshing..." : "Refresh"}
////          </button>
////          <div className="po-list-pill">Page {page + 1} · {orders.length} open PO{orders.length !== 1 ? "s" : ""}</div>
////        </div>
////      </div>

////      {loading && <p className="po-list-loading text-muted">Loading purchase orders...</p>}
////      {error && <p className="alert alert-error">{error}</p>}
////      {message && <p className="alert alert-success">{message}</p>}

////      {!loading && !error && (
////        <>
////          {orders.length === 0 ? (
////            <p className="po-list-empty text-muted">No Purchase Orders to process.</p>
////          ) : (
////            <div className="po-list-table-wrapper">
////              <table className="po-list-table">
////                <thead>
////                  <tr>
////                    <th>Name</th>
////                    <th>Supplier</th>
////                    <th>Items</th>
////                    <th>Company</th>
////                    <th>Date</th>
////                    <th>Status</th>
////                    <th>Grand Total</th>
////                    <th>Actions</th>
////                    <th>Transporter</th>
////                    <th>MF Status</th>
////                    <th>% Stock In</th>
////                  </tr>
////                </thead>
////                <tbody>
////                  {sortedOrders.map((po) => {
////                    const perReceived = Number(po.per_received || 0);
////                    const receivedFromErp = perReceived > 0;
////                    const mf = po[MF_PO_FIELDS.status];
////                    const receivedFromMf = mf === "QC In" || mf === "Completed";
////                    const isReceived = receivedFromErp || receivedFromMf;
////                    const isQcPassing = qcPassLoading === po.name;
////                    const isQcFailing = qcFailLoading === po.name;
////                    const isInvoicing = invoiceLoading === po.name;
////                    const isUploading = uploadInvoiceLoading === po.name;
////                    const isSubmittingPo = submitPoLoading === po.name;
////                    const isDraft = po.status === "Draft";
////                    const isThisQcEdit = qcEdit && qcEdit.poName === po.name;
////                    const draftPiName = draftPiByPo[po.name];
////                    const isSubmittingInvoice = submitInvLoading === po.name;

////                    // ✅ Calculate allowed dropdown options based on current status
////                    const statusOptions = getSequentialStatusOptions(po[MF_PO_FIELDS.status]);

////                    return (
////                      <tr key={po.name}>
////                        <td className="po-cell-name">{po.name}</td>
////                        <td>{po.supplier}</td>
////                        <td style={{ maxWidth: 420 }}>
////                          <span style={{ fontSize: 12, opacity: 0.9 }}>
////                            {poItemsSummary[po.name] || "—"}
////                          </span>
////                        </td>
////                        <td>{po.company}</td>
////                        <td>{po.transaction_date}</td>
////                        <td>{po.status}</td>
////                        <td className="po-cell-money">{po.grand_total}</td>
////                        <td className="po-cell-actions">
////                          {isDraft ? (
////                            <div className="po-actions-stack">
////                              <button onClick={() => onEditPo && onEditPo(po.name)} className="btn btn-outline btn-xs">Edit Draft</button>
////                              <button onClick={() => { const ok = window.confirm(`You are about to SUBMIT Purchase Order: ${po.name}\n\nSubmit now?`); if (!ok) return; handleSubmitPoFromList(po); }} disabled={isSubmittingPo} className="btn btn-primary btn-xs">{isSubmittingPo ? "Submitting..." : "Submit"}</button>
////                            </div>
////                          ) : !isReceived ? (
////                            <div className="po-actions-stack">
////                              {isThisQcEdit ? (
////                                <div className="qc-inline" style={{ minWidth: 320 }}>
////                                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Good Qty per item (remaining):</div>
////                                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
////                                    {qcEdit.rows.map((r) => (
////                                      <div key={r.rowId} style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
////                                        <div style={{ flex: 1, fontSize: 12 }}><b>{r.item_code}</b>{r.item_name ? <span style={{ opacity: 0.75 }}> · {r.item_name}</span> : null}<div style={{ opacity: 0.75 }}>Remaining: {round2(r.maxQty)}</div></div>
////                                        <input type="number" step="0.01" min={0} className="qc-inline-input" style={{ width: 110 }} value={r.goodQtyInput} onChange={(e) => updateQcRowQty(r.rowId, e.target.value)} />
////                                      </div>
////                                    ))}
////                                  </div>
////                                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
////                                    <button onClick={confirmQcPass} disabled={isQcPassing} className="btn btn-outline btn-xs">{isQcPassing ? "Receiving..." : "Receive"}</button>
////                                    <button onClick={cancelQcPass} className="btn btn-ghost btn-xs">Cancel</button>
////                                  </div>
////                                </div>
////                              ) : (
////                                <>
////                                  <button onClick={() => startQcPass(po)} disabled={isQcPassing || isQcFailing} className="btn btn-outline btn-xs">{isQcPassing ? "Loading QC..." : "QC Pass & Receive"}</button>
////                                  <button onClick={() => handleQcFail(po)} disabled={isQcPassing || isQcFailing} className="btn btn-danger btn-xs">{isQcFailing ? "Marking Fail..." : "QC Fail"}</button>
////                                </>
////                              )}
////                            </div>
////                          ) : (
////                            <>
////                              {draftPiName ? (
////                                <button onClick={() => handleSubmitDraftInvoice(po)} disabled={isSubmittingInvoice} className="btn btn-accent btn-xs">{isSubmittingInvoice ? "Submitting..." : `Submit Invoice (${draftPiName})`}</button>
////                              ) : (
////                                <div className="po-actions-stack">
////                                  <button onClick={() => handleCreateInvoice(po)} disabled={isInvoicing || isUploading} className="btn btn-accent btn-xs">{isInvoicing ? "Creating Invoice..." : "Create Invoice (Paid)"}</button>
////                                  <button onClick={() => startUploadInvoice(po)} disabled={isInvoicing || isUploading} className="btn btn-outline btn-xs">{isUploading ? "Uploading..." : "Upload Invoice"}</button>
////                                </div>
////                              )}
////                            </>
////                          )}
////                        </td>
////                        <td>
////                          {isDraft ? (
////                            <select value={po.custom_transporter || ""} disabled={transporterUpdating === po.name} onChange={async (e) => { const t = e.target.value; setTransporterUpdating(po.name); setError(""); setMessage(""); try { await setPurchaseOrderTransporter(po.name, t); setMessage(`Transporter updated for ${po.name}`); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.message || "Failed to update transporter"); } finally { setTransporterUpdating(""); } }}>
////                              <option value="">-- None --</option>
////                              {transporters.map((t) => (
////                                <option key={t.name} value={t.name}>{t.transporter_name || t.name}</option>
////                              ))}
////                            </select>
////                          ) : (
////                            <span>{po.custom_transporter ? (transporterNameMap.get(po.custom_transporter) || po.custom_transporter) : "—"}</span>
////                          )}
////                        </td>
////                        <td>
////                          {/* ✅ MF STATUS DROPDOWN with SEQUENTIAL LOGIC */}
////                          <select
////                            value={po[MF_PO_FIELDS.status] || ""}
////                            onChange={(e) => handleMfStatusChange(po, e.target.value)}
////                            disabled={mfUpdating === po.name}
////                          >
////                            {/* Map over the allowed sequential options only */}
////                            {statusOptions.map((s) => (
////                              <option key={s} value={s}>{s}</option>
////                            ))}
////                          </select>
////                          <div style={{ fontSize: 12, opacity: 0.7 }}>{po[MF_PO_FIELDS.updatedOn] || ""}</div>
////                        </td>
////                        <td>{po[MF_PO_FIELDS.stockPercent] != null && po[MF_PO_FIELDS.stockPercent] !== "" ? `${Number(po[MF_PO_FIELDS.stockPercent]).toFixed(2)}%` : ""}</td>
////                      </tr>
////                    );
////                  })}
////                </tbody>
////              </table>
////            </div>
////          )}
////        </>
////      )}
////    </div>
////  );
////}

////export default PurchaseOrderList;

////import React, { useEffect, useMemo, useRef, useState } from "react";
////import {
////  getDoctypeList,
////  submitDoc,
////  getPurchaseOrderWithItems,
////  getDoc,
////  createPaymentEntryForPurchaseInvoice,
////  cancelPurchaseOrder,
////  setPurchaseOrderStatus,
////  setPurchaseOrderMfStatus, // backend handles the date update logic
////  MF_PO_FIELDS,
////  MF_STATUS_OPTIONS, 
////  createDoc,
////  uploadFileToDoc,
////  closePurchaseOrder,
////  mapLimit,
////  getTransporters,
////  setPurchaseOrderTransporter,
////} from "../erpBackendApi";

////import "./PurchaseOrderList.css";

////// -------------------- Constants --------------------
////const PAGE_SIZE = 20;
////const ACCEPTED_WAREHOUSE = "Raw Material - MF";
////const REJECTED_WAREHOUSE = "Rejected Warehouse - MF";

////function round2(n) {
////  const x = Number(n);
////  if (isNaN(x)) return 0;
////  return Math.round(x * 100) / 100;
////}

////function buildItemSummary(items = []) {
////  const clean = (items || [])
////    .map((it) => {
////      const code = it.item_code || it.item_name || "";
////      const name = it.item_name || "";
////      if (!code) return "";
////      return name && name !== code ? `${code} (${name})` : code;
////    })
////    .filter(Boolean);

////  if (!clean.length) return "";
////  const max = 3;
////  if (clean.length <= max) return clean.join(", ");
////  return `${clean.slice(0, max).join(", ")} +${clean.length - max} more`;
////}

////// ✅ HELPER: Sequential Status + Conditional Cancel
////// Shows [Current, Next]. Adds "Cancelled" only if status is <= Delivered.
////function getSequentialStatusOptions(currentStatus) {
////  // 1. Find where we are in the list
////  const currentIndex = MF_STATUS_OPTIONS.indexOf(currentStatus);
////  const deliveredIndex = MF_STATUS_OPTIONS.indexOf("Delivered");

////  // If status is unknown/empty, start at the beginning
////  if (currentIndex === -1) {
////    return [MF_STATUS_OPTIONS[0]]; 
////  }

////  // 2. Base options: [Current Status]
////  const options = [currentStatus];

////  // 3. Add Next Status (if not at the end)
////  // We ignore "Cancelled" in the sequential flow here because we handle it specifically below
////  if (currentIndex < MF_STATUS_OPTIONS.length - 1) {
////    const nextStatus = MF_STATUS_OPTIONS[currentIndex + 1];
////    if (nextStatus !== "Cancelled") { 
////       options.push(nextStatus);
////    }
////  }

////  // 4. ✅ CONDITIONAL CANCEL
////  // Show "Cancelled" ONLY if we are at "Delivered" stage or earlier
////  // AND the current status itself isn't already "Cancelled"
////  if (currentIndex <= deliveredIndex && currentStatus !== "Cancelled") {
////    options.push("Cancelled");
////  }

////  return options;
////}

////function PurchaseOrderList({ onEditPo }) {
////  // -------------------- State --------------------
////  const [orders, setOrders] = useState([]);
////  const [page, setPage] = useState(0);
////  const [hasMore, setHasMore] = useState(false);
////  const [loading, setLoading] = useState(false);
////  const [transporters, setTransporters] = useState([]);
////  const [transporterUpdating, setTransporterUpdating] = useState("");

////  const transporterNameMap = useMemo(() => {
////    const m = new Map();
////    (transporters || []).forEach((t) => {
////      m.set(t.name, t.transporter_name || t.name);
////    });
////    return m;
////  }, [transporters]);

////  const [qcPassLoading, setQcPassLoading] = useState("");
////  const [qcFailLoading, setQcFailLoading] = useState("");
////  const [invoiceLoading, setInvoiceLoading] = useState("");
////  const [submitPoLoading, setSubmitPoLoading] = useState("");
////  const [mfFilter, setMfFilter] = useState("");
////  const [qcEdit, setQcEdit] = useState(null);
////  const [receivedPO, setReceivedPO] = useState({});
////  const [error, setError] = useState("");
////  const [message, setMessage] = useState("");
////  const [mfUpdating, setMfUpdating] = useState("");
////  const [poItemsSummary, setPoItemsSummary] = useState({});
////  const uploadInputRef = useRef(null);
////  const [uploadTargetPo, setUploadTargetPo] = useState(null);
////  const [uploadInvoiceLoading, setUploadInvoiceLoading] = useState("");
////  const [draftPiByPo, setDraftPiByPo] = useState({});
////  const [submitInvLoading, setSubmitInvLoading] = useState("");
////  const [createdSort, setCreatedSort] = useState("asc");

////  const createdSortLabel =
////    createdSort === "asc"
////      ? "Sort by Created: Oldest → Newest"
////      : "Sort by Created: Newest → Oldest";

////  function toSortTs(v) {
////    if (!v) return 0;
////    const s = String(v).trim();
////    if (!s) return 0;
////    const isoLike = s.includes(" ") ? s.replace(" ", "T") : s;
////    const d = new Date(isoLike);
////    const t = d.getTime();
////    return Number.isFinite(t) ? t : 0;
////  }

////  const sortedOrders = useMemo(() => {
////    const dirMul = createdSort === "asc" ? 1 : -1;
////    return [...orders].sort((a, b) => {
////      const ta = toSortTs(a?.creation);
////      const tb = toSortTs(b?.creation);
////      if (ta !== tb) return (ta - tb) * dirMul;
////      return String(a?.name || "").localeCompare(String(b?.name || ""));
////    });
////  }, [orders, createdSort]);

////  function toggleCreatedSort() {
////    setCreatedSort((prev) => (prev === "asc" ? "desc" : "asc"));
////  }

////  // -------------------- MF Status Logic --------------------
////  async function handleMfStatusChange(po, newStatus) {
////    if (!newStatus) return;
////    setError("");
////    setMessage("");
////    setMfUpdating(po.name);

////    try {
////      // Calls backend API which handles date update if status is 'Delivered'
////      await setPurchaseOrderMfStatus(po.name, newStatus);
////      setMessage(`MF Status updated for ${po.name}: ${newStatus}`);
////      await loadOrders(page, mfFilter);
////    } catch (err) {
////      console.error(err);
////      setError(err.response?.data?.error?.message || err.message || "MF status update failed");
////    } finally {
////      setMfUpdating("");
////    }
////  }

////  async function hydrateItemNames(rows) {
////    try {
////      const next = {};
////      await mapLimit(rows, 5, async (po) => {
////        try {
////          const doc = await getPurchaseOrderWithItems(po.name);
////          next[po.name] = buildItemSummary(doc.items || []);
////        } catch (e) {
////          next[po.name] = "";
////        }
////      });
////      setPoItemsSummary((prev) => ({ ...prev, ...next }));
////    } catch (e) { }
////  }

////  async function loadOrders(pageIndex = 0, mfStatus = "") {
////    setLoading(true);
////    setError("");
////    setMessage("");

////    try {
////      const baseFilters = [
////        ["Purchase Order", "status", "in", ["Draft", "To Receive and Bill", "To Receive", "To Bill"]],
////      ];

////      if (mfStatus) {
////        baseFilters.push(["Purchase Order", MF_PO_FIELDS.status, "=", mfStatus]);
////      }

////      let data = await getDoctypeList("Purchase Order", {
////        fields: JSON.stringify([
////          "name",
////          "supplier",
////          "company",
////          "transaction_date",
////          "status",
////          "grand_total",
////          "per_received",
////          "per_billed",
////          "creation",
////          "custom_transporter",
////          MF_PO_FIELDS.status,
////          MF_PO_FIELDS.updatedOn,
////          MF_PO_FIELDS.stockPercent,
////        ]),
////        filters: JSON.stringify(baseFilters),
////        order_by: "creation desc",
////        limit_page_length: PAGE_SIZE + 1,
////        limit_start: pageIndex * PAGE_SIZE,
////      });

////      data = data.filter((row) => {
////        const r = Number(row.per_received || 0);
////        const b = Number(row.per_billed || 0);
////        return !(r >= 100 && b >= 100);
////      });

////      const pageRows = data.slice(0, PAGE_SIZE);
////      const displayRows = [...pageRows].reverse();

////      setHasMore(data.length > PAGE_SIZE);
////      setOrders(displayRows);
////      setPage(pageIndex);
////      setQcEdit(null);
////      hydrateItemNames(displayRows);
////    } catch (err) {
////      console.error(err);
////      setError(err.message || "Failed to load Purchase Orders");
////    } finally {
////      setLoading(false);
////    }
////  }

////  useEffect(() => {
////    loadOrders(0, mfFilter);
////    getTransporters()
////      .then((rows) => setTransporters(rows || []))
////      .catch((e) => console.error("Transporters load failed", e));
////  }, []);

////  async function onMfFilterChange(v) {
////    setMfFilter(v);
////    await loadOrders(0, v);
////  }

////  // -------------------- QC & Actions --------------------
////  async function startQcPass(po) { setError(""); setMessage(""); setQcPassLoading(po.name); try { const poDoc = await getPurchaseOrderWithItems(po.name); const poItems = poDoc.items || []; if (!poItems.length) throw new Error("Purchase Order has no items to receive"); const rows = poItems.map((it) => { const ordered = Number(it.qty || 0); const received = Number(it.received_qty || 0); const remaining = ordered - received; if (remaining <= 0) return null; return { rowId: it.name, item_code: it.item_code, item_name: it.item_name, maxQty: remaining, goodQtyInput: String(remaining), poItem: it, }; }).filter(Boolean); if (!rows.length) throw new Error("All quantities already received for this Purchase Order."); setQcEdit({ poName: po.name, poDoc, rows, }); setMessage(`Enter good quantity for each item in PO ${po.name}.`); } catch (err) { console.error(err); setError(err.response?.data?.error?.message || err.message || "Failed to load Purchase Order for QC"); } finally { setQcPassLoading(""); } }
////  function updateQcRowQty(rowId, value) { setQcEdit((prev) => { if (!prev) return prev; return { ...prev, rows: prev.rows.map((r) => (r.rowId === rowId ? { ...r, goodQtyInput: value } : r)), }; }); }
////  async function confirmQcPass() { if (!qcEdit) return; const { poName, poDoc, rows } = qcEdit; setError(""); setMessage(""); setQcPassLoading(poName); try { let totalRemaining = 0; let totalGood = 0; const prItems = []; for (const r of rows) { const goodQty = Number(r.goodQtyInput); const maxQty = Number(r.maxQty || 0); if (isNaN(goodQty) || goodQty < 0 || goodQty > maxQty) { throw new Error(`Invalid qty for ${r.item_code}. Enter 0 to ${maxQty}.`); } const badQty = maxQty - goodQty; const receivedQty = goodQty + badQty; totalRemaining += maxQty; totalGood += goodQty; if (receivedQty <= 0) continue; prItems.push({ item_code: r.poItem.item_code, qty: goodQty, received_qty: receivedQty, accepted_qty: goodQty, rejected_qty: badQty, warehouse: ACCEPTED_WAREHOUSE, ...(badQty > 0 ? { rejected_warehouse: REJECTED_WAREHOUSE } : {}), rate: r.poItem.rate, purchase_order: poDoc.name, purchase_order_item: r.poItem.name, }); } if (!prItems.length) { setMessage("No quantity to receive."); setQcEdit(null); return; } const allGoodThisRound = totalRemaining > 0 && totalGood === totalRemaining; const percent = totalRemaining > 0 ? round2((totalGood / totalRemaining) * 100) : 0; const today = new Date().toISOString().slice(0, 10); const prPayload = { doctype: "Purchase Receipt", supplier: poDoc.supplier, company: poDoc.company, posting_date: today, purchase_order: poDoc.name, items: prItems, }; const prDoc = await createDoc("Purchase Receipt", prPayload); const prName = prDoc.data?.name; if (prName) await submitDoc("Purchase Receipt", prName); setReceivedPO((prev) => ({ ...prev, [poName]: { prName: prName || null, allGood: allGoodThisRound, stockPercent: percent }, })); await setPurchaseOrderMfStatus(poName, "QC In", { stockPercent: percent }); setMessage(prName ? `QC PASS: PR ${prName} created from ${poName} (good ${round2(totalGood)}, total ${round2(totalRemaining)}).` : `QC PASS: PR created from ${poName}.`); setQcEdit(null); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.response?.data?.error?.message || err.message || "Failed to create Purchase Receipt"); } finally { setQcPassLoading(""); } }
////  function cancelQcPass() { setQcEdit(null); setMessage(""); }
////  async function handleQcFail(po) { setError(""); setMessage(""); setQcFailLoading(po.name); try { await setPurchaseOrderMfStatus(po.name, "Cancelled"); await cancelPurchaseOrder(po.name); setMessage(`QC marked as FAIL. Purchase Order ${po.name} has been cancelled.`); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.response?.data?.error?.message || err.message || "Failed to cancel Purchase Order"); } finally { setQcFailLoading(""); } }
////  async function handleSubmitPoFromList(po) { setError(""); setMessage(""); setSubmitPoLoading(po.name); try { await submitDoc("Purchase Order", po.name); setMessage(`Purchase Order submitted: ${po.name}`); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.response?.data?.error?.message || err.message || "Failed to submit Purchase Order"); } finally { setSubmitPoLoading(""); } }
////  async function handleCreateInvoice(po) { setError(""); setMessage(""); setInvoiceLoading(po.name); try { const poDoc = await getPurchaseOrderWithItems(po.name); const poItems = poDoc.items || []; if (!poItems.length) throw new Error("Purchase Order has no items for invoice"); const today = new Date().toISOString().slice(0, 10); const receivedInfo = receivedPO[po.name] || {}; const sessionPrName = receivedInfo.prName || null; const allGood = receivedInfo.allGood !== undefined ? receivedInfo.allGood : true; const piPayload = { doctype: "Purchase Invoice", supplier: poDoc.supplier, company: poDoc.company, posting_date: today, purchase_order: poDoc.name, items: poItems.map((it) => ({ item_code: it.item_code, qty: it.qty, rate: it.rate, purchase_order: poDoc.name, po_detail: it.name, ...(sessionPrName ? { purchase_receipt: sessionPrName } : {}), })), }; const piDoc = await createDoc("Purchase Invoice", piPayload); const piName = piDoc.data?.name; if (piName) { await submitDoc("Purchase Invoice", piName); const fullPi = await getDoc("Purchase Invoice", piName); await createPaymentEntryForPurchaseInvoice(fullPi); const statusToSet = allGood ? "Completed" : "Closed"; await setPurchaseOrderStatus(poDoc.name, statusToSet); if (!allGood) { try { await closePurchaseOrder(poDoc.name); } catch (e) { } } const percent = po?.[MF_PO_FIELDS.stockPercent] != null && po?.[MF_PO_FIELDS.stockPercent] !== "" ? Number(po[MF_PO_FIELDS.stockPercent]) : receivedPO?.[po.name]?.stockPercent; await setPurchaseOrderMfStatus(poDoc.name, "Completed", { stockPercent: percent }); } setMessage(piName ? `Purchase Invoice created, submitted, PAID and PO updated: ${piName}.` : `Purchase Invoice created from ${po.name}`); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.response?.data?.error?.message || err.message || "Failed to create / pay Purchase Invoice"); } finally { setInvoiceLoading(""); } }
////  function startUploadInvoice(po) { setError(""); setMessage(""); setUploadTargetPo(po); uploadInputRef.current?.click(); }
////  async function onInvoicePdfPicked(e) { const file = e.target.files?.[0]; e.target.value = ""; if (!file || !uploadTargetPo) return; const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"); if (!isPdf) { setError("Please select a PDF file."); setUploadTargetPo(null); return; } await handleUploadInvoice(uploadTargetPo, file); setUploadTargetPo(null); }
////  async function handleUploadInvoice(po, pdfFile) { setError(""); setMessage(""); setUploadInvoiceLoading(po.name); try { const poDoc = await getPurchaseOrderWithItems(po.name); const poItems = poDoc.items || []; if (!poItems.length) throw new Error("Purchase Order has no items for invoice"); const today = new Date().toISOString().slice(0, 10); const receivedInfo = receivedPO[po.name] || {}; const sessionPrName = receivedInfo.prName || null; const piPayload = { doctype: "Purchase Invoice", supplier: poDoc.supplier, company: poDoc.company, posting_date: today, purchase_order: poDoc.name, items: poItems.map((it) => ({ item_code: it.item_code, qty: it.qty, rate: it.rate, purchase_order: poDoc.name, po_detail: it.name, ...(sessionPrName ? { purchase_receipt: sessionPrName } : {}), })), }; const piDoc = await createDoc("Purchase Invoice", piPayload); const piName = piDoc.data?.name; if (!piName) throw new Error("Purchase Invoice not created (missing name)."); await uploadFileToDoc({ doctype: "Purchase Invoice", docname: piName, file: pdfFile, is_private: 1, }); setDraftPiByPo((prev) => ({ ...prev, [po.name]: piName })); setMessage(`Draft PI created and PDF uploaded: ${piName}. Now click "Submit Invoice".`); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.response?.data?.error?.message || err.message || "Failed to upload invoice PDF / create draft PI"); } finally { setUploadInvoiceLoading(""); } }
////  async function handleSubmitDraftInvoice(po) { const piName = draftPiByPo[po.name]; if (!piName) return; setError(""); setMessage(""); setSubmitInvLoading(po.name); try { const poDoc = await getPurchaseOrderWithItems(po.name); await submitDoc("Purchase Invoice", piName); const fullPi = await getDoc("Purchase Invoice", piName); await createPaymentEntryForPurchaseInvoice(fullPi); const receivedInfo = receivedPO[po.name] || {}; const percentFromErp = po?.[MF_PO_FIELDS.stockPercent] != null && po?.[MF_PO_FIELDS.stockPercent] !== "" ? Number(po[MF_PO_FIELDS.stockPercent]) : undefined; const allGood = receivedInfo.allGood !== undefined ? receivedInfo.allGood : percentFromErp != null ? percentFromErp >= 99.999 : true; const statusToSet = allGood ? "Completed" : "Closed"; await setPurchaseOrderStatus(poDoc.name, statusToSet); if (!allGood) { try { await closePurchaseOrder(poDoc.name); } catch (e) { } } const percent = po?.[MF_PO_FIELDS.stockPercent] != null && po?.[MF_PO_FIELDS.stockPercent] !== "" ? Number(po[MF_PO_FIELDS.stockPercent]) : receivedPO?.[po.name]?.stockPercent; await setPurchaseOrderMfStatus(poDoc.name, "Completed", { stockPercent: percent }); setDraftPiByPo((prev) => { const next = { ...prev }; delete next[po.name]; return next; }); setMessage(`Invoice submitted & PAID: ${piName}`); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.response?.data?.error?.message || err.message || "Failed to submit/pay Purchase Invoice"); } finally { setSubmitInvLoading(""); } }

////  function handlePrevPage() { if (page === 0 || loading) return; loadOrders(page - 1, mfFilter); }
////  function handleNextPage() { if (!hasMore || loading) return; loadOrders(page + 1, mfFilter); }
////  async function reloadOrders() { await loadOrders(page, mfFilter); }

////  return (
////    <div className="po-list">
////      <input ref={uploadInputRef} type="file" accept="application/pdf,.pdf" style={{ display: "none" }} onChange={onInvoicePdfPicked} />

////      <div className="po-list-header">
////        <div className="po-list-title-block">
////          <h3 className="po-list-title">Recent Purchase Orders</h3>
////          <p className="po-list-subtitle">Process: Draft → QC (good &amp; bad) → Receipt → Invoice (Paid)</p>
////        </div>
////        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
////          <div className="po-list-pill" style={{ padding: "6px 10px" }}>
////            MF Filter:&nbsp;
////            <select value={mfFilter} onChange={(e) => onMfFilterChange(e.target.value)} style={{ padding: "4px 6px" }}>
////              <option value="">All</option>
////              {MF_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
////            </select>
////          </div>
////          <div className="po-list-pill" style={{ padding: "6px 10px" }}>
////            <button type="button" className="btn btn-outline btn-xs" onClick={toggleCreatedSort} disabled={loading}>
////              {createdSortLabel}
////            </button>
////          </div>
////          <button type="button" className="btn btn-secondary btn-sm" onClick={reloadOrders} disabled={loading}>
////            {loading ? "Refreshing..." : "Refresh"}
////          </button>
////          <div className="po-list-pill">Page {page + 1} · {orders.length} open PO{orders.length !== 1 ? "s" : ""}</div>
////        </div>
////      </div>

////      {loading && <p className="po-list-loading text-muted">Loading purchase orders...</p>}
////      {error && <p className="alert alert-error">{error}</p>}
////      {message && <p className="alert alert-success">{message}</p>}

////      {!loading && !error && (
////        <>
////          {orders.length === 0 ? (
////            <p className="po-list-empty text-muted">No Purchase Orders to process.</p>
////          ) : (
////            <div className="po-list-table-wrapper">
////              <table className="po-list-table">
////                <thead>
////                  <tr>
////                    <th>Name</th>
////                    <th>Supplier</th>
////                    <th>Items</th>
////                    <th>Company</th>
////                    <th>Date</th>
////                    <th>Status</th>
////                    <th>Grand Total</th>
////                    <th>Actions</th>
////                    <th>Transporter</th>
////                    <th>MF Status</th>
////                    <th>% Stock In</th>
////                  </tr>
////                </thead>
////                <tbody>
////                  {sortedOrders.map((po) => {
////                    const perReceived = Number(po.per_received || 0);
////                    const receivedFromErp = perReceived > 0;
////                    const mf = po[MF_PO_FIELDS.status];
////                    const receivedFromMf = mf === "QC In" || mf === "Completed";
////                    const isReceived = receivedFromErp || receivedFromMf;

////                    // Flags
////                    const isQcPassing = qcPassLoading === po.name;
////                    const isQcFailing = qcFailLoading === po.name;
////                    const isInvoicing = invoiceLoading === po.name;
////                    const isUploading = uploadInvoiceLoading === po.name;
////                    const isSubmittingPo = submitPoLoading === po.name;
////                    const isDraft = po.status === "Draft";
////                    const isThisQcEdit = qcEdit && qcEdit.poName === po.name;
////                    const draftPiName = draftPiByPo[po.name];
////                    const isSubmittingInvoice = submitInvLoading === po.name;

////                    // ✅ Use updated helper
////                    const statusOptions = getSequentialStatusOptions(po[MF_PO_FIELDS.status]);

////                    return (
////                      <tr key={po.name}>
////                        <td className="po-cell-name">{po.name}</td>
////                        <td>{po.supplier}</td>
////                        <td style={{ maxWidth: 420 }}>
////                          <span style={{ fontSize: 12, opacity: 0.9 }}>
////                            {poItemsSummary[po.name] || "—"}
////                          </span>
////                        </td>
////                        <td>{po.company}</td>
////                        <td>{po.transaction_date}</td>
////                        <td>{po.status}</td>
////                        <td className="po-cell-money">{po.grand_total}</td>
////                        <td className="po-cell-actions">
////                          {isDraft ? (
////                            <div className="po-actions-stack">
////                              <button onClick={() => onEditPo && onEditPo(po.name)} className="btn btn-outline btn-xs">Edit Draft</button>
////                              <button onClick={() => { const ok = window.confirm(`You are about to SUBMIT Purchase Order: ${po.name}\n\nSubmit now?`); if (!ok) return; handleSubmitPoFromList(po); }} disabled={isSubmittingPo} className="btn btn-primary btn-xs">{isSubmittingPo ? "Submitting..." : "Submit"}</button>
////                            </div>
////                          ) : !isReceived ? (
////                            <div className="po-actions-stack">
////                              {isThisQcEdit ? (
////                                <div className="qc-inline" style={{ minWidth: 320 }}>
////                                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Good Qty per item (remaining):</div>
////                                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
////                                    {qcEdit.rows.map((r) => (
////                                      <div key={r.rowId} style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
////                                        <div style={{ flex: 1, fontSize: 12 }}><b>{r.item_code}</b>{r.item_name ? <span style={{ opacity: 0.75 }}> · {r.item_name}</span> : null}<div style={{ opacity: 0.75 }}>Remaining: {round2(r.maxQty)}</div></div>
////                                        <input type="number" step="0.01" min={0} className="qc-inline-input" style={{ width: 110 }} value={r.goodQtyInput} onChange={(e) => updateQcRowQty(r.rowId, e.target.value)} />
////                                      </div>
////                                    ))}
////                                  </div>
////                                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
////                                    <button onClick={confirmQcPass} disabled={isQcPassing} className="btn btn-outline btn-xs">{isQcPassing ? "Receiving..." : "Receive"}</button>
////                                    <button onClick={cancelQcPass} className="btn btn-ghost btn-xs">Cancel</button>
////                                  </div>
////                                </div>
////                              ) : (
////                                <>
////                                  <button onClick={() => startQcPass(po)} disabled={isQcPassing || isQcFailing} className="btn btn-outline btn-xs">{isQcPassing ? "Loading QC..." : "QC Pass & Receive"}</button>
////                                  <button onClick={() => handleQcFail(po)} disabled={isQcPassing || isQcFailing} className="btn btn-danger btn-xs">{isQcFailing ? "Marking Fail..." : "QC Fail"}</button>
////                                </>
////                              )}
////                            </div>
////                          ) : (
////                            <>
////                              {draftPiName ? (
////                                <button onClick={() => handleSubmitDraftInvoice(po)} disabled={isSubmittingInvoice} className="btn btn-accent btn-xs">{isSubmittingInvoice ? "Submitting..." : `Submit Invoice (${draftPiName})`}</button>
////                              ) : (
////                                <div className="po-actions-stack">
////                                  <button onClick={() => handleCreateInvoice(po)} disabled={isInvoicing || isUploading} className="btn btn-accent btn-xs">{isInvoicing ? "Creating Invoice..." : "Create Invoice (Paid)"}</button>
////                                  <button onClick={() => startUploadInvoice(po)} disabled={isInvoicing || isUploading} className="btn btn-outline btn-xs">{isUploading ? "Uploading..." : "Upload Invoice"}</button>
////                                </div>
////                              )}
////                            </>
////                          )}
////                        </td>
////                        <td>
////                          {isDraft ? (
////                            <select value={po.custom_transporter || ""} disabled={transporterUpdating === po.name} onChange={async (e) => { const t = e.target.value; setTransporterUpdating(po.name); setError(""); setMessage(""); try { await setPurchaseOrderTransporter(po.name, t); setMessage(`Transporter updated for ${po.name}`); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.message || "Failed to update transporter"); } finally { setTransporterUpdating(""); } }}>
////                              <option value="">-- None --</option>
////                              {transporters.map((t) => (
////                                <option key={t.name} value={t.name}>{t.transporter_name || t.name}</option>
////                              ))}
////                            </select>
////                          ) : (
////                            <span>{po.custom_transporter ? (transporterNameMap.get(po.custom_transporter) || po.custom_transporter) : "—"}</span>
////                          )}
////                        </td>
////                        <td>
////                          {/* ✅ MF STATUS DROPDOWN */}
////                          <select
////                            value={po[MF_PO_FIELDS.status] || ""}
////                            onChange={(e) => handleMfStatusChange(po, e.target.value)}
////                            disabled={mfUpdating === po.name}
////                          >
////                            {statusOptions.map((s) => (
////                              <option key={s} value={s}>{s}</option>
////                            ))}
////                          </select>
////                          <div style={{ fontSize: 12, opacity: 0.7 }}>{po[MF_PO_FIELDS.updatedOn] || ""}</div>
////                        </td>
////                        <td>{po[MF_PO_FIELDS.stockPercent] != null && po[MF_PO_FIELDS.stockPercent] !== "" ? `${Number(po[MF_PO_FIELDS.stockPercent]).toFixed(2)}%` : ""}</td>
////                      </tr>
////                    );
////                  })}
////                </tbody>
////              </table>
////            </div>
////          )}
////        </>
////      )}
////    </div>
////  );
////}

////export default PurchaseOrderList;

//import React, { useEffect, useMemo, useRef, useState } from "react";
//import {
//  getDoctypeList,
//  submitDoc,
//  getPurchaseOrderWithItems,
//  getDoc,
//  createPaymentEntryForPurchaseInvoice,
//  cancelPurchaseOrder,
//  setPurchaseOrderStatus,
//  setPurchaseOrderMfStatus,
//  MF_PO_FIELDS,
//  MF_STATUS_OPTIONS,
//  createDoc,
//  uploadFileToDoc,
//  closePurchaseOrder,
//  mapLimit,
//  getTransporters,
//  setPurchaseOrderTransporter,
//} from "../erpBackendApi";

//import "./PurchaseOrderList.css";

//// -------------------- Constants --------------------
//const PAGE_SIZE = 20;
//const ACCEPTED_WAREHOUSE = "Raw Material - MF";
//const REJECTED_WAREHOUSE = "Rejected Warehouse - MF";

//function round2(n) {
//  const x = Number(n);
//  if (isNaN(x)) return 0;
//  return Math.round(x * 100) / 100;
//}

//function buildItemSummary(items = []) {
//  const clean = (items || [])
//    .map((it) => {
//      const code = it.item_code || it.item_name || "";
//      const name = it.item_name || "";
//      if (!code) return "";
//      return name && name !== code ? `${code} (${name})` : code;
//    })
//    .filter(Boolean);

//  if (!clean.length) return "";
//  const max = 3;
//  if (clean.length <= max) return clean.join(", ");
//  return `${clean.slice(0, max).join(", ")} +${clean.length - max} more`;
//}

//function getSequentialStatusOptions(currentStatus) {
//  const currentIndex = MF_STATUS_OPTIONS.indexOf(currentStatus);
//  const deliveredIndex = MF_STATUS_OPTIONS.indexOf("Delivered");

//  if (currentIndex === -1) {
//    return [MF_STATUS_OPTIONS[0]];
//  }

//  const options = [currentStatus];

//  if (currentIndex < MF_STATUS_OPTIONS.length - 1) {
//    const nextStatus = MF_STATUS_OPTIONS[currentIndex + 1];
//    if (nextStatus !== "Cancelled") {
//      options.push(nextStatus);
//    }
//  }

//  if (currentIndex <= deliveredIndex && currentStatus !== "Cancelled") {
//    options.push("Cancelled");
//  }

//  return options;
//}

//function PurchaseOrderList({ onEditPo }) {
//  // -------------------- State --------------------
//  const [orders, setOrders] = useState([]);
//  const [page, setPage] = useState(0);
//  const [hasMore, setHasMore] = useState(false);
//  const [loading, setLoading] = useState(false);
//  const [transporters, setTransporters] = useState([]);
//  const [transporterUpdating, setTransporterUpdating] = useState("");

//  const transporterNameMap = useMemo(() => {
//    const m = new Map();
//    (transporters || []).forEach((t) => {
//      m.set(t.name, t.transporter_name || t.name);
//    });
//    return m;
//  }, [transporters]);

//  const [qcPassLoading, setQcPassLoading] = useState("");
//  const [qcFailLoading, setQcFailLoading] = useState("");

//  // Loaders for Invoice Actions
//  const [invoiceLoading, setInvoiceLoading] = useState("");
//  const [submitPoLoading, setSubmitPoLoading] = useState("");
//  const [payLoading, setPayLoading] = useState("");

//  const [mfFilter, setMfFilter] = useState("");
//  const [qcEdit, setQcEdit] = useState(null);
//  const [receivedPO, setReceivedPO] = useState({});
//  const [error, setError] = useState("");
//  const [message, setMessage] = useState("");
//  const [mfUpdating, setMfUpdating] = useState("");
//  const [poItemsSummary, setPoItemsSummary] = useState({});
//  const uploadInputRef = useRef(null);
//  const [uploadTargetPo, setUploadTargetPo] = useState(null);
//  const [uploadInvoiceLoading, setUploadInvoiceLoading] = useState("");
//  const [draftPiByPo, setDraftPiByPo] = useState({});
//  const [submitInvLoading, setSubmitInvLoading] = useState("");
//  const [createdSort, setCreatedSort] = useState("asc");

//  const createdSortLabel =
//    createdSort === "asc"
//      ? "Sort by Created: Oldest → Newest"
//      : "Sort by Created: Newest → Oldest";

//  function toSortTs(v) {
//    if (!v) return 0;
//    const s = String(v).trim();
//    if (!s) return 0;
//    const isoLike = s.includes(" ") ? s.replace(" ", "T") : s;
//    const d = new Date(isoLike);
//    const t = d.getTime();
//    return Number.isFinite(t) ? t : 0;
//  }

//  const sortedOrders = useMemo(() => {
//    const dirMul = createdSort === "asc" ? 1 : -1;
//    return [...orders].sort((a, b) => {
//      const ta = toSortTs(a?.creation);
//      const tb = toSortTs(b?.creation);
//      if (ta !== tb) return (ta - tb) * dirMul;
//      return String(a?.name || "").localeCompare(String(b?.name || ""));
//    });
//  }, [orders, createdSort]);

//  function toggleCreatedSort() {
//    setCreatedSort((prev) => (prev === "asc" ? "desc" : "asc"));
//  }

//  // -------------------- MF Status Logic --------------------
//  async function handleMfStatusChange(po, newStatus) {
//    if (!newStatus) return;
//    setError("");
//    setMessage("");
//    setMfUpdating(po.name);

//    try {
//      await setPurchaseOrderMfStatus(po.name, newStatus);
//      setMessage(`MF Status updated for ${po.name}: ${newStatus}`);
//      await loadOrders(page, mfFilter);
//    } catch (err) {
//      console.error(err);
//      setError(err.response?.data?.error?.message || err.message || "MF status update failed");
//    } finally {
//      setMfUpdating("");
//    }
//  }

//  async function hydrateItemNames(rows) {
//    try {
//      const next = {};
//      await mapLimit(rows, 5, async (po) => {
//        try {
//          const doc = await getPurchaseOrderWithItems(po.name);
//          next[po.name] = buildItemSummary(doc.items || []);
//        } catch (e) {
//          next[po.name] = "";
//        }
//      });
//      setPoItemsSummary((prev) => ({ ...prev, ...next }));
//    } catch (e) { }
//  }

//  async function loadOrders(pageIndex = 0, mfStatus = "") {
//    setLoading(true);
//    setError("");
//    setMessage("");

//    try {
//      const baseFilters = [
//        ["Purchase Order", "status", "in", ["Draft", "To Receive and Bill", "To Receive", "To Bill", "Completed"]],
//      ];

//      if (mfStatus) {
//        baseFilters.push(["Purchase Order", MF_PO_FIELDS.status, "=", mfStatus]);
//      }

//      let data = await getDoctypeList("Purchase Order", {
//        fields: JSON.stringify([
//          "name",
//          "supplier",
//          "company",
//          "transaction_date",
//          "status",
//          "grand_total",
//          "per_received",
//          "per_billed",
//          "creation",
//          "custom_transporter",
//          MF_PO_FIELDS.status,
//          MF_PO_FIELDS.updatedOn,
//          MF_PO_FIELDS.stockPercent,
//        ]),
//        filters: JSON.stringify(baseFilters),
//        order_by: "creation desc",
//        limit_page_length: PAGE_SIZE + 1,
//        limit_start: pageIndex * PAGE_SIZE,
//      });

//      // ✅ LOGIC UPDATE: Keep visible until explicitly "Completed" in MF Workflow
//      data = data.filter((row) => {
//        const mfSt = row[MF_PO_FIELDS.status];
//        if (mfSt === "Completed") return false; // Hide only if marked Completed
//        if (row.status === "Closed" || row.status === "Cancelled") return false; // Hide if killed in ERP
//        return true;
//      });

//      const pageRows = data.slice(0, PAGE_SIZE);
//      const displayRows = [...pageRows].reverse();

//      setHasMore(data.length > PAGE_SIZE);
//      setOrders(displayRows);
//      setPage(pageIndex);
//      setQcEdit(null);
//      hydrateItemNames(displayRows);
//    } catch (err) {
//      console.error(err);
//      setError(err.message || "Failed to load Purchase Orders");
//    } finally {
//      setLoading(false);
//    }
//  }

//  useEffect(() => {
//    loadOrders(0, mfFilter);
//    getTransporters()
//      .then((rows) => setTransporters(rows || []))
//      .catch((e) => console.error("Transporters load failed", e));
//  }, []);

//  async function onMfFilterChange(v) {
//    setMfFilter(v);
//    await loadOrders(0, v);
//  }

//  // -------------------- QC & Actions --------------------

//  // ✅ 1. START QC: Initialize Good AND Rejected inputs
//  async function startQcPass(po) {
//    setError("");
//    setMessage("");
//    setQcPassLoading(po.name);
//    try {
//      const poDoc = await getPurchaseOrderWithItems(po.name);
//      const poItems = poDoc.items || [];
//      if (!poItems.length) throw new Error("Purchase Order has no items to receive");

//      const rows = poItems.map((it) => {
//        const ordered = Number(it.qty || 0);
//        const received = Number(it.received_qty || 0);
//        const remaining = ordered - received;

//        return {
//          rowId: it.name,
//          item_code: it.item_code,
//          item_name: it.item_name,
//          orderedQty: ordered,
//          receivedQty: received,
//          maxQty: remaining > 0 ? remaining : 0,

//          // Initialize both inputs
//          goodQtyInput: remaining > 0 ? String(remaining) : "0",
//          rejectedQtyInput: "0",

//          poItem: it,
//        };
//      }).filter(Boolean);

//      setQcEdit({ poName: po.name, poDoc, rows });
//      setMessage(`Enter Good AND Rejected quantity for PO ${po.name}.`);
//    } catch (err) {
//      console.error(err);
//      setError(err.response?.data?.error?.message || err.message || "Failed to load QC");
//    } finally {
//      setQcPassLoading("");
//    }
//  }

//  function updateQcRowQty(rowId, value) {
//    setQcEdit((prev) => {
//      if (!prev) return prev;
//      return { ...prev, rows: prev.rows.map((r) => (r.rowId === rowId ? { ...r, goodQtyInput: value } : r)), };
//    });
//  }

//  // ✅ New Helper for Rejected Qty
//  function updateQcRowRejected(rowId, value) {
//    setQcEdit((prev) => {
//      if (!prev) return prev;
//      return {
//        ...prev,
//        rows: prev.rows.map((r) => (r.rowId === rowId ? { ...r, rejectedQtyInput: value } : r)),
//      };
//    });
//  }

//  // ✅ 2. CONFIRM QC: Handle Summing & Over-Delivery
//  async function confirmQcPass() {
//    if (!qcEdit) return;
//    const { poName, poDoc, rows } = qcEdit;
//    setError("");
//    setMessage("");
//    setQcPassLoading(poName);

//    try {
//      // ✅ FIX 1: Initialize counters for both Good and Rejected
//      let totalGood = 0;
//      let totalRejected = 0;
//      const prItems = [];

//      for (const r of rows) {
//        const goodQty = Number(r.goodQtyInput || 0);
//        const rejectedQty = Number(r.rejectedQtyInput || 0);

//        if (goodQty < 0 || rejectedQty < 0) throw new Error(`Quantities cannot be negative.`);

//        const rowTotal = goodQty + rejectedQty;

//        // Skip if nothing entered
//        if (rowTotal <= 0) continue;

//        // ✅ FIX 2: Accumulate totals
//        totalGood += goodQty;
//        totalRejected += rejectedQty;

//        prItems.push({
//          item_code: r.poItem.item_code,
//          qty: goodQty,                 // Accepted Qty
//          received_qty: rowTotal,       // Total (Good + Bad)
//          accepted_qty: goodQty,
//          rejected_qty: rejectedQty,
//          warehouse: ACCEPTED_WAREHOUSE,
//          rejected_warehouse: rejectedQty > 0 ? REJECTED_WAREHOUSE : undefined,
//          rate: r.poItem.rate,
//          purchase_order: poDoc.name,
//          purchase_order_item: r.poItem.name,
//        });
//      }

//      if (!prItems.length) {
//        setMessage("No quantity to receive.");
//        setQcEdit(null);
//        return;
//      }

//      const today = new Date().toISOString().slice(0, 10);
//      const prPayload = {
//        doctype: "Purchase Receipt",
//        supplier: poDoc.supplier,
//        company: poDoc.company,
//        posting_date: today,
//        purchase_order: poDoc.name,
//        items: prItems,
//      };

//      const prDoc = await createDoc("Purchase Receipt", prPayload);
//      const prName = prDoc.data?.name;
//      if (prName) await submitDoc("Purchase Receipt", prName);

//      const percent = round2((totalGood / (rows.reduce((a, b) => a + b.orderedQty, 0) || 1)) * 100);

//      setReceivedPO((prev) => ({
//        ...prev,
//        [poName]: { prName: prName || null, allGood: true, stockPercent: percent },
//      }));

//      await setPurchaseOrderMfStatus(poName, "QC In", { stockPercent: percent });

//      // ✅ FIX 3: Use the accumulated variables in the message
//      setMessage(`QC PASS: PR ${prName} created (Good: ${totalGood}, Rejected: ${totalRejected}).`);
//      setQcEdit(null);
//      await loadOrders(page, mfFilter);
//    } catch (err) {
//      console.error(err);
//      setError(err.response?.data?.error?.message || err.message || "Failed to create Purchase Receipt");
//    } finally {
//      setQcPassLoading("");
//    }
//  }
//  function cancelQcPass() { setQcEdit(null); setMessage(""); }

//  async function handleQcFail(po) { setError(""); setMessage(""); setQcFailLoading(po.name); try { await setPurchaseOrderMfStatus(po.name, "Cancelled"); await cancelPurchaseOrder(po.name); setMessage(`QC marked as FAIL. Purchase Order ${po.name} has been cancelled.`); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.response?.data?.error?.message || err.message || "Failed to cancel Purchase Order"); } finally { setQcFailLoading(""); } }

//  async function handleSubmitPoFromList(po) { setError(""); setMessage(""); setSubmitPoLoading(po.name); try { await submitDoc("Purchase Order", po.name); setMessage(`Purchase Order submitted: ${po.name}`); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.response?.data?.error?.message || err.message || "Failed to submit Purchase Order"); } finally { setSubmitPoLoading(""); } }

//  // -------------------- INVOICE HANDLERS --------------------
//  // ✅ 2. CONFIRM QC: Updates Status to "QC Pass"
//  // ✅ 2. CONFIRM QC: Handles Over-Delivery + Transporter Mapping
//  async function confirmQcPass() {
//    if (!qcEdit) return;
//    const { poName, poDoc, rows } = qcEdit;
//    setError("");
//    setMessage("");
//    setQcPassLoading(poName);

//    try {
//      let totalGood = 0;
//      let totalRejected = 0;
//      const prItems = [];

//      for (const r of rows) {
//        const goodQty = Number(r.goodQtyInput || 0);
//        const rejectedQty = Number(r.rejectedQtyInput || 0);

//        if (goodQty < 0 || rejectedQty < 0) throw new Error(`Quantities cannot be negative.`);

//        const rowTotal = goodQty + rejectedQty;

//        // Skip if nothing entered
//        if (rowTotal <= 0) continue;

//        totalGood += goodQty;
//        totalRejected += rejectedQty;

//        prItems.push({
//          item_code: r.poItem.item_code,
//          qty: goodQty,                 // Accepted Qty
//          received_qty: rowTotal,       // Total (Good + Bad)
//          accepted_qty: goodQty,
//          rejected_qty: rejectedQty,
//          warehouse: ACCEPTED_WAREHOUSE,
//          rejected_warehouse: rejectedQty > 0 ? REJECTED_WAREHOUSE : undefined,
//          rate: r.poItem.rate,
//          purchase_order: poDoc.name,
//          purchase_order_item: r.poItem.name,
//        });
//      }

//      if (!prItems.length) {
//        setMessage("No quantity to receive.");
//        setQcEdit(null);
//        return;
//      }

//      const today = new Date().toISOString().slice(0, 10);

//      const prPayload = {
//        doctype: "Purchase Receipt",
//        supplier: poDoc.supplier,
//        company: poDoc.company,
//        posting_date: today,
//        purchase_order: poDoc.name,

//        // ✅ NEW: Auto-fill Transporter from PO
//        transporter_name: poDoc.custom_transporter || undefined,

//        items: prItems,
//      };

//      const prDoc = await createDoc("Purchase Receipt", prPayload);
//      const prName = prDoc.data?.name;
//      if (prName) await submitDoc("Purchase Receipt", prName);

//      const percent = round2((totalGood / (rows.reduce((a, b) => a + b.orderedQty, 0) || 1)) * 100);

//      setReceivedPO((prev) => ({
//        ...prev,
//        [poName]: { prName: prName || null, allGood: true, stockPercent: percent },
//      }));

//      await setPurchaseOrderMfStatus(poName, "QC Pass", { stockPercent: percent });

//      setMessage(`QC PASS: PR ${prName} created (Good: ${totalGood}, Rejected: ${totalRejected}).`);
//      setQcEdit(null);
//      await loadOrders(page, mfFilter);
//    } catch (err) {
//      console.error(err);
//      setError(err.response?.data?.error?.message || err.message || "Failed to create Purchase Receipt");
//    } finally {
//      setQcPassLoading("");
//    }
//  }

//  function startUploadInvoice(po) { setError(""); setMessage(""); setUploadTargetPo(po); uploadInputRef.current?.click(); }

//  async function onInvoicePdfPicked(e) { const file = e.target.files?.[0]; e.target.value = ""; if (!file || !uploadTargetPo) return; const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"); if (!isPdf) { setError("Please select a PDF file."); setUploadTargetPo(null); return; } await handleUploadInvoice(uploadTargetPo, file); setUploadTargetPo(null); }
//  async function handleUploadInvoice(po, pdfFile) {
//    setError("");
//    setMessage("");
//    setUploadInvoiceLoading(po.name);

//    try {
//      const poDoc = await getPurchaseOrderWithItems(po.name);
//      const poItems = poDoc.items || [];
//      if (!poItems.length) throw new Error("Purchase Order has no items for invoice");

//      const today = new Date().toISOString().slice(0, 10);
//      const receivedInfo = receivedPO[po.name] || {};
//      const sessionPrName = receivedInfo.prName || null;

//      const piPayload = {
//        doctype: "Purchase Invoice",
//        supplier: poDoc.supplier,
//        company: poDoc.company,
//        posting_date: today,
//        purchase_order: poDoc.name,

//        // ✅ ADDED: Auto-fill Transporter Name here too
//        transporter_name: poDoc.custom_transporter || undefined,

//        items: poItems.map((it) => ({
//          item_code: it.item_code,
//          qty: it.qty,
//          rate: it.rate,
//          purchase_order: poDoc.name,
//          po_detail: it.name,
//          ...(sessionPrName ? { purchase_receipt: sessionPrName } : {}),
//        })),
//      };

//      const piDoc = await createDoc("Purchase Invoice", piPayload);
//      const piName = piDoc.data?.name;
//      if (!piName) throw new Error("Purchase Invoice not created (missing name).");

//      await uploadFileToDoc({
//        doctype: "Purchase Invoice",
//        docname: piName,
//        file: pdfFile,
//        is_private: 1,
//      });

//      setDraftPiByPo((prev) => ({ ...prev, [po.name]: piName }));
//      setMessage(`Draft PI created: ${piName}. Click "Submit Invoice".`);
//      await loadOrders(page, mfFilter);
//    } catch (err) {
//      console.error(err);
//      setError(err.response?.data?.error?.message || err.message || "Failed to upload invoice");
//    } finally {
//      setUploadInvoiceLoading("");
//    }
//  }
//  // -------------------- INVOICE HANDLERS --------------------
//  async function handleCreateInvoice(po) {
//    setError("");
//    setMessage("");
//    setInvoiceLoading(po.name);
//    try {
//      const poDoc = await getPurchaseOrderWithItems(po.name);
//      const poItems = poDoc.items || [];
//      if (!poItems.length) throw new Error("Purchase Order has no items for invoice");

//      const today = new Date().toISOString().slice(0, 10);
//      const receivedInfo = receivedPO[po.name] || {};
//      const sessionPrName = receivedInfo.prName || null;

//      const piPayload = {
//        doctype: "Purchase Invoice",
//        supplier: poDoc.supplier,
//        company: poDoc.company,
//        posting_date: today,
//        purchase_order: poDoc.name,

//        // ✅ ADDED: Auto-fill Transporter Name
//        transporter_name: poDoc.custom_transporter || undefined,

//        items: poItems.map((it) => ({
//          item_code: it.item_code,
//          qty: it.qty,
//          rate: it.rate,
//          purchase_order: poDoc.name,
//          po_detail: it.name,
//          ...(sessionPrName ? { purchase_receipt: sessionPrName } : {}),
//        })),
//      };

//      const piDoc = await createDoc("Purchase Invoice", piPayload);
//      const piName = piDoc.data?.name;
//      if (piName) { await submitDoc("Purchase Invoice", piName); }

//      setMessage(piName ? `Invoice Created & Submitted: ${piName}. Click 'Pay & Close' to finish.` : `Invoice Created.`);
//      await loadOrders(page, mfFilter);
//    } catch (err) {
//      console.error(err);
//      setError(err.response?.data?.error?.message || err.message || "Failed to create Purchase Invoice");
//    } finally {
//      setInvoiceLoading("");
//    }
//  }
//  async function handleSubmitDraftInvoice(po) {
//    const piName = draftPiByPo[po.name];
//    if (!piName) return;
//    setError("");
//    setMessage("");
//    setSubmitInvLoading(po.name);
//    try {
//      await submitDoc("Purchase Invoice", piName);
//      setDraftPiByPo((prev) => { const next = { ...prev }; delete next[po.name]; return next; });
//      setMessage(`Invoice submitted: ${piName}. Click 'Pay & Close' to finish.`);
//      await loadOrders(page, mfFilter);
//    } catch (err) {
//      console.error(err);
//      setError(err.response?.data?.error?.message || err.message || "Failed to submit Purchase Invoice");
//    } finally {
//      setSubmitInvLoading("");
//    }
//  }

//  // ✅ 3. PAY & CLOSE: Robust Version (Fixes Permission Error)
//  async function handlePayAndClose(po) {
//    setError("");
//    setMessage("");
//    setPayLoading(po.name);

//    try {
//      // Fetch PI Items with Parent permission context
//      const piItems = await getDoctypeList("Purchase Invoice Item", {
//        parent: "Purchase Invoice",
//        fields: JSON.stringify(["parent"]),
//        filters: JSON.stringify([
//          ["purchase_order", "=", po.name],
//          ["docstatus", "=", 1]
//        ]),
//        limit_page_length: 50
//      });

//      const piNames = [...new Set((piItems || []).map((i) => i.parent))];
//      if (piNames.length === 0) {
//        throw new Error("No submitted invoice found. Please create/submit invoice first.");
//      }

//      const invoices = await getDoctypeList("Purchase Invoice", {
//        fields: JSON.stringify(["name", "grand_total", "outstanding_amount", "company", "supplier"]),
//        filters: JSON.stringify([["name", "in", piNames]]),
//      });

//      const unpaidInvoices = invoices.filter((inv) => Number(inv.outstanding_amount) > 0);

//      if (unpaidInvoices.length > 0) {
//        for (const pi of unpaidInvoices) {
//          await createPaymentEntryForPurchaseInvoice(pi);
//        }
//        setMessage(`Payment created for ${unpaidInvoices.map((i) => i.name).join(", ")}.`);
//      } else {
//        setMessage("Invoice was already paid.");
//      }

//      const receivedInfo = receivedPO[po.name] || {};
//      const percentFromErp = po?.[MF_PO_FIELDS.stockPercent] != null && po?.[MF_PO_FIELDS.stockPercent] !== "" ? Number(po[MF_PO_FIELDS.stockPercent]) : undefined;
//      const allGood = receivedInfo.allGood !== undefined ? receivedInfo.allGood : percentFromErp != null ? percentFromErp >= 99.999 : true;

//      const statusToSet = allGood ? "Completed" : "Closed";
//      await setPurchaseOrderStatus(po.name, statusToSet);

//      if (!allGood) {
//        try { await closePurchaseOrder(po.name); } catch (e) { }
//      }

//      const percent = po?.[MF_PO_FIELDS.stockPercent] != null && po?.[MF_PO_FIELDS.stockPercent] !== "" ? Number(po[MF_PO_FIELDS.stockPercent]) : receivedPO?.[po.name]?.stockPercent;
//      await setPurchaseOrderMfStatus(po.name, "Completed", { stockPercent: percent });

//      setMessage((prev) => `${prev} PO ${po.name} marked as Completed.`);
//      await loadOrders(page, mfFilter);
//    } catch (err) {
//      console.error(err);
//      setError(err.response?.data?.error?.message || err.message || "Failed to Pay & Close");
//    } finally {
//      setPayLoading("");
//    }
//  }

//  function handlePrevPage() { if (page === 0 || loading) return; loadOrders(page - 1, mfFilter); }
//  function handleNextPage() { if (!hasMore || loading) return; loadOrders(page + 1, mfFilter); }
//  async function reloadOrders() { await loadOrders(page, mfFilter); }

//  return (
//    <div className="po-list">
//      <input ref={uploadInputRef} type="file" accept="application/pdf,.pdf" style={{ display: "none" }} onChange={onInvoicePdfPicked} />

//      <div className="po-list-header">
//        <div className="po-list-title-block">
//          <h3 className="po-list-title">Recent Purchase Orders</h3>
//          <p className="po-list-subtitle">Process: Draft → QC (good &amp; bad) → Receipt → Invoice → Pay & Close</p>
//        </div>
//        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
//          <div className="po-list-pill" style={{ padding: "6px 10px" }}>
//            MF Filter:&nbsp;
//            <select value={mfFilter} onChange={(e) => onMfFilterChange(e.target.value)} style={{ padding: "4px 6px" }}>
//              <option value="">All</option>
//              {MF_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
//            </select>
//          </div>
//          <div className="po-list-pill" style={{ padding: "6px 10px" }}>
//            <button type="button" className="btn btn-outline btn-xs" onClick={toggleCreatedSort} disabled={loading}>
//              {createdSortLabel}
//            </button>
//          </div>
//          <button type="button" className="btn btn-secondary btn-sm" onClick={reloadOrders} disabled={loading}>
//            {loading ? "Refreshing..." : "Refresh"}
//          </button>
//          <div className="po-list-pill">Page {page + 1} · {orders.length} open PO{orders.length !== 1 ? "s" : ""}</div>
//        </div>
//      </div>

//      {loading && <p className="po-list-loading text-muted">Loading purchase orders...</p>}
//      {error && <p className="alert alert-error">{error}</p>}
//      {message && <p className="alert alert-success">{message}</p>}

//      {!loading && !error && (
//        <>
//          {orders.length === 0 ? (
//            <p className="po-list-empty text-muted">No Purchase Orders to process.</p>
//          ) : (
//            <div className="po-list-table-wrapper">
//              <table className="po-list-table">
//                <thead>
//                  <tr>
//                    <th>Name</th>
//                    <th>Supplier</th>
//                    <th>Items</th>
//                    <th>Company</th>
//                    <th>Date</th>
//                    <th>Status</th>
//                    <th>Grand Total</th>
//                    <th>Actions</th>
//                    <th>Transporter</th>
//                    <th>MF Status</th>
//                    <th>% Stock In</th>
//                  </tr>
//                </thead>
//                <tbody>
//                  {sortedOrders.map((po) => {
//                    const perReceived = Number(po.per_received || 0);
//                    const perBilled = Number(po.per_billed || 0);

//                    const receivedFromErp = perReceived > 0;
//                    const mf = po[MF_PO_FIELDS.status];
//                    const receivedFromMf = mf === "QC In" || mf === "Completed";
//                    const isReceived = receivedFromErp || receivedFromMf;

//                    const isFullyBilled = perBilled >= 100;

//                    const isQcPassing = qcPassLoading === po.name;
//                    const isQcFailing = qcFailLoading === po.name;
//                    const isInvoicing = invoiceLoading === po.name;
//                    const isUploading = uploadInvoiceLoading === po.name;
//                    const isSubmittingPo = submitPoLoading === po.name;
//                    const isDraft = po.status === "Draft";
//                    const isThisQcEdit = qcEdit && qcEdit.poName === po.name;
//                    const draftPiName = draftPiByPo[po.name];
//                    const isSubmittingInvoice = submitInvLoading === po.name;
//                    const isPaying = payLoading === po.name;

//                    const statusOptions = getSequentialStatusOptions(po[MF_PO_FIELDS.status]);

//                    return (
//                      <tr key={po.name}>
//                        <td className="po-cell-name">{po.name}</td>
//                        <td>{po.supplier}</td>
//                        <td style={{ maxWidth: 420 }}>
//                          <span style={{ fontSize: 12, opacity: 0.9 }}>
//                            {poItemsSummary[po.name] || "—"}
//                          </span>
//                        </td>
//                        <td>{po.company}</td>
//                        <td>{po.transaction_date}</td>
//                        <td>{po.status}</td>
//                        <td className="po-cell-money">{po.grand_total}</td>
//                        <td className="po-cell-actions">
//                          {isDraft ? (
//                            <div className="po-actions-stack">
//                              <button onClick={() => onEditPo && onEditPo(po.name)} className="btn btn-outline btn-xs">Edit Draft</button>
//                              <button onClick={() => { const ok = window.confirm(`You are about to SUBMIT Purchase Order: ${po.name}\n\nSubmit now?`); if (!ok) return; handleSubmitPoFromList(po); }} disabled={isSubmittingPo} className="btn btn-primary btn-xs">{isSubmittingPo ? "Submitting..." : "Submit"}</button>
//                            </div>
//                          ) : !isReceived ? (
//                            <div className="po-actions-stack">
//                              {isThisQcEdit ? (
//                                <div className="qc-inline" style={{ minWidth: 320 }}>
//                                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Enter Good & Rejected Qty:</div>
//                                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>

//                                    {/* ✅ UPDATED QC UI: Good + Rejected Inputs */}
//                                    {qcEdit.rows.map((r) => {
//                                      const good = Number(r.goodQtyInput || 0);
//                                      const bad = Number(r.rejectedQtyInput || 0);
//                                      const total = good + bad;
//                                      const isOverDelivery = total > r.maxQty;

//                                      return (
//                                        <div key={r.rowId} style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
//                                          <div style={{ flex: 1, fontSize: 12 }}>
//                                            <b>{r.item_code}</b>
//                                            <div style={{ opacity: 0.75 }}>Ord: {r.orderedQty}</div>
//                                          </div>

//                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
//                                            <label style={{ fontSize: 9, opacity: 0.7 }}>Good</label>
//                                            <input
//                                              type="number"
//                                              className="qc-inline-input"
//                                              style={{ width: 70, borderColor: "green" }}
//                                              value={r.goodQtyInput}
//                                              onChange={(e) => updateQcRowQty(r.rowId, e.target.value)}
//                                            />
//                                          </div>

//                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
//                                            <label style={{ fontSize: 9, opacity: 0.7 }}>Rejected</label>
//                                            <input
//                                              type="number"
//                                              className="qc-inline-input"
//                                              style={{ width: 70, borderColor: "red", backgroundColor: "#fff0f0" }}
//                                              value={r.rejectedQtyInput}
//                                              onChange={(e) => updateQcRowRejected(r.rowId, e.target.value)}
//                                            />
//                                          </div>

//                                          <div style={{ fontSize: 11, width: 40, textAlign: 'right', color: isOverDelivery ? 'orange' : 'inherit' }}>
//                                            = {total}
//                                          </div>
//                                        </div>
//                                      );
//                                    })}

//                                  </div>
//                                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
//                                    <button onClick={confirmQcPass} disabled={isQcPassing} className="btn btn-outline btn-xs">{isQcPassing ? "Receiving..." : "Receive"}</button>
//                                    <button onClick={cancelQcPass} className="btn btn-ghost btn-xs">Cancel</button>
//                                  </div>
//                                </div>
//                              ) : (
//                                <>
//                                  <button onClick={() => startQcPass(po)} disabled={isQcPassing || isQcFailing} className="btn btn-outline btn-xs">{isQcPassing ? "Loading QC..." : "QC Pass & Receive"}</button>
//                                  <button onClick={() => handleQcFail(po)} disabled={isQcPassing || isQcFailing} className="btn btn-danger btn-xs">{isQcFailing ? "Marking Fail..." : "QC Fail"}</button>
//                                </>
//                              )}
//                            </div>
//                          ) : (
//                            <>
//                              {isFullyBilled ? (
//                                <button
//                                  onClick={() => handlePayAndClose(po)}
//                                  disabled={isPaying}
//                                  className="btn btn-success btn-xs"
//                                >
//                                  {isPaying ? "Processing..." : "Pay & Close"}
//                                </button>
//                              ) : (
//                                <>
//                                  {draftPiName ? (
//                                    <button onClick={() => handleSubmitDraftInvoice(po)} disabled={isSubmittingInvoice} className="btn btn-accent btn-xs">{isSubmittingInvoice ? "Submitting..." : `Submit Invoice (${draftPiName})`}</button>
//                                  ) : (
//                                    <div className="po-actions-stack">
//                                      <button onClick={() => handleCreateInvoice(po)} disabled={isInvoicing || isUploading} className="btn btn-accent btn-xs">{isInvoicing ? "Creating..." : "Create Invoice"}</button>
//                                      <button onClick={() => startUploadInvoice(po)} disabled={isInvoicing || isUploading} className="btn btn-outline btn-xs">{isUploading ? "Uploading..." : "Upload Invoice"}</button>
//                                    </div>
//                                  )}
//                                </>
//                              )}
//                            </>
//                          )}
//                        </td>
//                        <td>
//                          {isDraft ? (
//                            <select value={po.custom_transporter || ""} disabled={transporterUpdating === po.name} onChange={async (e) => { const t = e.target.value; setTransporterUpdating(po.name); setError(""); setMessage(""); try { await setPurchaseOrderTransporter(po.name, t); setMessage(`Transporter updated for ${po.name}`); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.message || "Failed to update transporter"); } finally { setTransporterUpdating(""); } }}>
//                              <option value="">-- None --</option>
//                              {transporters.map((t) => (
//                                <option key={t.name} value={t.name}>{t.transporter_name || t.name}</option>
//                              ))}
//                            </select>
//                          ) : (
//                            <span>{po.custom_transporter ? (transporterNameMap.get(po.custom_transporter) || po.custom_transporter) : "—"}</span>
//                          )}
//                        </td>
//                        <td>
//                          <select
//                            value={po[MF_PO_FIELDS.status] || ""}
//                            onChange={(e) => handleMfStatusChange(po, e.target.value)}
//                            disabled={mfUpdating === po.name}
//                          >
//                            {statusOptions.map((s) => (
//                              <option key={s} value={s}>{s}</option>
//                            ))}
//                          </select>
//                          <div style={{ fontSize: 12, opacity: 0.7 }}>{po[MF_PO_FIELDS.updatedOn] || ""}</div>
//                        </td>
//                        <td>{po[MF_PO_FIELDS.stockPercent] != null && po[MF_PO_FIELDS.stockPercent] !== "" ? `${Number(po[MF_PO_FIELDS.stockPercent]).toFixed(2)}%` : ""}</td>
//                      </tr>
//                    );
//                  })}
//                </tbody>
//              </table>
//            </div>
//          )}
//        </>
//      )}
//    </div>
//  );
//}

//export default PurchaseOrderList;

//import React, { useEffect, useMemo, useRef, useState } from "react";
//import {
//  getDoctypeList,
//  submitDoc,
//  getPurchaseOrderWithItems,
//  getDoc,
//  createPaymentEntryForPurchaseInvoice,
//  cancelPurchaseOrder,
//  setPurchaseOrderStatus,
//  setPurchaseOrderMfStatus,
//  MF_PO_FIELDS,
//  MF_STATUS_OPTIONS,
//  createDoc,
//  uploadFileToDoc,
//  closePurchaseOrder,
//  mapLimit,
//  getTransporters,
//  setPurchaseOrderTransporter,
//} from "../erpBackendApi";

//import "./PurchaseOrderList.css";

//// -------------------- Constants --------------------
//const PAGE_SIZE = 20;
//const ACCEPTED_WAREHOUSE = "Raw Material - MF";
//const REJECTED_WAREHOUSE = "Rejected Warehouse - MF";

//function round2(n) {
//  const x = Number(n);
//  if (isNaN(x)) return 0;
//  return Math.round(x * 100) / 100;
//}

//function buildItemSummary(items = []) {
//  const clean = (items || [])
//    .map((it) => {
//      const code = it.item_code || it.item_name || "";
//      const name = it.item_name || "";
//      if (!code) return "";
//      return name && name !== code ? `${code} (${name})` : code;
//    })
//    .filter(Boolean);

//  if (!clean.length) return "";
//  const max = 3;
//  if (clean.length <= max) return clean.join(", ");
//  return `${clean.slice(0, max).join(", ")} +${clean.length - max} more`;
//}

//function getSequentialStatusOptions(currentStatus) {
//  const currentIndex = MF_STATUS_OPTIONS.indexOf(currentStatus);
//  const deliveredIndex = MF_STATUS_OPTIONS.indexOf("Delivered");

//  if (currentIndex === -1) {
//    return [MF_STATUS_OPTIONS[0]];
//  }

//  const options = [currentStatus];

//  if (currentIndex < MF_STATUS_OPTIONS.length - 1) {
//    const nextStatus = MF_STATUS_OPTIONS[currentIndex + 1];
//    if (nextStatus !== "Cancelled") {
//      options.push(nextStatus);
//    }
//  }

//  if (currentIndex <= deliveredIndex && currentStatus !== "Cancelled") {
//    options.push("Cancelled");
//  }

//  return options;
//}

//function PurchaseOrderList({ onEditPo }) {
//  // -------------------- State --------------------
//  const [orders, setOrders] = useState([]);
//  const [page, setPage] = useState(0);
//  const [hasMore, setHasMore] = useState(false);
//  const [loading, setLoading] = useState(false);
//  const [transporters, setTransporters] = useState([]);
//  const [transporterUpdating, setTransporterUpdating] = useState("");

//  const transporterNameMap = useMemo(() => {
//    const m = new Map();
//    (transporters || []).forEach((t) => {
//      m.set(t.name, t.transporter_name || t.name);
//    });
//    return m;
//  }, [transporters]);

//  const [qcPassLoading, setQcPassLoading] = useState("");
//  const [qcFailLoading, setQcFailLoading] = useState("");

//  // Loaders for Invoice Actions
//  const [invoiceLoading, setInvoiceLoading] = useState("");
//  const [submitPoLoading, setSubmitPoLoading] = useState("");
//  const [payLoading, setPayLoading] = useState(""); 
//  const [advancePayLoading, setAdvancePayLoading] = useState(""); 

//  const [mfFilter, setMfFilter] = useState("");
//  const [qcEdit, setQcEdit] = useState(null);
  
//  // ✅ Advance Pay Modal State
//  const [advancePayModal, setAdvancePayModal] = useState(null); 

//  const [receivedPO, setReceivedPO] = useState({});
//  const [error, setError] = useState("");
//  const [message, setMessage] = useState("");
//  const [mfUpdating, setMfUpdating] = useState("");
//  const [poItemsSummary, setPoItemsSummary] = useState({});
//  const uploadInputRef = useRef(null);
//  const [uploadTargetPo, setUploadTargetPo] = useState(null);
//  const [uploadInvoiceLoading, setUploadInvoiceLoading] = useState("");
//  const [draftPiByPo, setDraftPiByPo] = useState({});
//  const [submitInvLoading, setSubmitInvLoading] = useState("");
//  const [createdSort, setCreatedSort] = useState("asc");

//  const createdSortLabel =
//    createdSort === "asc"
//      ? "Sort by Created: Oldest → Newest"
//      : "Sort by Created: Newest → Oldest";

//  function toSortTs(v) {
//    if (!v) return 0;
//    const s = String(v).trim();
//    if (!s) return 0;
//    const isoLike = s.includes(" ") ? s.replace(" ", "T") : s;
//    const d = new Date(isoLike);
//    const t = d.getTime();
//    return Number.isFinite(t) ? t : 0;
//  }

//  const sortedOrders = useMemo(() => {
//    const dirMul = createdSort === "asc" ? 1 : -1;
//    return [...orders].sort((a, b) => {
//      const ta = toSortTs(a?.creation);
//      const tb = toSortTs(b?.creation);
//      if (ta !== tb) return (ta - tb) * dirMul;
//      return String(a?.name || "").localeCompare(String(b?.name || ""));
//    });
//  }, [orders, createdSort]);

//  function toggleCreatedSort() {
//    setCreatedSort((prev) => (prev === "asc" ? "desc" : "asc"));
//  }

//  // -------------------- MF Status Logic --------------------
//  async function handleMfStatusChange(po, newStatus) {
//    if (!newStatus) return;
//    setError("");
//    setMessage("");
//    setMfUpdating(po.name);

//    try {
//      await setPurchaseOrderMfStatus(po.name, newStatus);
//      setMessage(`MF Status updated for ${po.name}: ${newStatus}`);
//      await loadOrders(page, mfFilter);
//    } catch (err) {
//      console.error(err);
//      setError(err.response?.data?.error?.message || err.message || "MF status update failed");
//    } finally {
//      setMfUpdating("");
//    }
//  }

//  async function hydrateItemNames(rows) {
//    try {
//      const next = {};
//      await mapLimit(rows, 5, async (po) => {
//        try {
//          const doc = await getPurchaseOrderWithItems(po.name);
//          next[po.name] = buildItemSummary(doc.items || []);
//        } catch (e) {
//          next[po.name] = "";
//        }
//      });
//      setPoItemsSummary((prev) => ({ ...prev, ...next }));
//    } catch (e) { }
//  }

//  async function loadOrders(pageIndex = 0, mfStatus = "") {
//    setLoading(true);
//    setError("");
//    setMessage("");

//    try {
//      const baseFilters = [
//        ["Purchase Order", "status", "in", ["Draft", "To Receive and Bill", "To Receive", "To Bill", "Completed"]],
//      ];

//      if (mfStatus) {
//        baseFilters.push(["Purchase Order", MF_PO_FIELDS.status, "=", mfStatus]);
//      }

//      let data = await getDoctypeList("Purchase Order", {
//        fields: JSON.stringify([
//          "name",
//          "supplier",
//          "company",
//          "transaction_date",
//          "status",
//          "grand_total",
//          "advance_paid", 
//          "per_received",
//          "per_billed",
//          "creation",
//          "custom_transporter",
//          MF_PO_FIELDS.status,
//          MF_PO_FIELDS.updatedOn,
//          MF_PO_FIELDS.stockPercent,
//        ]),
//        filters: JSON.stringify(baseFilters),
//        order_by: "creation desc",
//        limit_page_length: PAGE_SIZE + 1,
//        limit_start: pageIndex * PAGE_SIZE,
//      });

//      data = data.filter((row) => {
//        const mfSt = row[MF_PO_FIELDS.status];
//        if (mfSt === "Completed") return false;
//        if (row.status === "Closed" || row.status === "Cancelled") return false;
//        return true;
//      });

//      const pageRows = data.slice(0, PAGE_SIZE);
//      const displayRows = [...pageRows].reverse();

//      setHasMore(data.length > PAGE_SIZE);
//      setOrders(displayRows);
//      setPage(pageIndex);
//      setQcEdit(null);
//      hydrateItemNames(displayRows);
//    } catch (err) {
//      console.error(err);
//      setError(err.message || "Failed to load Purchase Orders");
//    } finally {
//      setLoading(false);
//    }
//  }

//  useEffect(() => {
//    loadOrders(0, mfFilter);
//    getTransporters()
//      .then((rows) => setTransporters(rows || []))
//      .catch((e) => console.error("Transporters load failed", e));
//  }, []);

//  async function onMfFilterChange(v) {
//    setMfFilter(v);
//    await loadOrders(0, v);
//  }

//  // -------------------- QC & Actions --------------------
//  async function startQcPass(po) {
//    setError("");
//    setMessage("");
//    setQcPassLoading(po.name);
//    try {
//      const poDoc = await getPurchaseOrderWithItems(po.name);
//      const poItems = poDoc.items || [];
//      if (!poItems.length) throw new Error("Purchase Order has no items to receive");

//      const rows = poItems.map((it) => {
//        const ordered = Number(it.qty || 0);
//        const received = Number(it.received_qty || 0);
//        const remaining = ordered - received;

//        return {
//          rowId: it.name,
//          item_code: it.item_code,
//          item_name: it.item_name,
//          orderedQty: ordered,
//          receivedQty: received,
//          maxQty: remaining > 0 ? remaining : 0, 
//          goodQtyInput: remaining > 0 ? String(remaining) : "0", 
//          rejectedQtyInput: "0", 
//          poItem: it,
//        };
//      }).filter(Boolean);

//      setQcEdit({ poName: po.name, poDoc, rows });
//      setMessage(`Enter Good AND Rejected quantity for PO ${po.name}.`);
//    } catch (err) {
//      console.error(err);
//      setError(err.response?.data?.error?.message || err.message || "Failed to load QC");
//    } finally {
//      setQcPassLoading("");
//    }
//  }

//  function updateQcRowQty(rowId, value) { 
//    setQcEdit((prev) => { 
//        if (!prev) return prev; 
//        return { ...prev, rows: prev.rows.map((r) => (r.rowId === rowId ? { ...r, goodQtyInput: value } : r)), }; 
//    }); 
//  }

//  function updateQcRowRejected(rowId, value) {
//    setQcEdit((prev) => {
//      if (!prev) return prev;
//      return {
//        ...prev,
//        rows: prev.rows.map((r) => (r.rowId === rowId ? { ...r, rejectedQtyInput: value } : r)),
//      };
//    });
//  }

//  async function confirmQcPass() {
//    if (!qcEdit) return;
//    const { poName, poDoc, rows } = qcEdit;
//    setError("");
//    setMessage("");
//    setQcPassLoading(poName);

//    try {
//      let totalGood = 0;
//      let totalRejected = 0;
//      const prItems = [];

//      for (const r of rows) {
//        const goodQty = Number(r.goodQtyInput || 0);
//        const rejectedQty = Number(r.rejectedQtyInput || 0);

//        if (goodQty < 0 || rejectedQty < 0) throw new Error(`Quantities cannot be negative.`);

//        const rowTotal = goodQty + rejectedQty; 

//        if (rowTotal <= 0) continue;

//        totalGood += goodQty;
//        totalRejected += rejectedQty;

//        prItems.push({
//          item_code: r.poItem.item_code,
//          qty: goodQty,           
//          received_qty: rowTotal, 
//          accepted_qty: goodQty,        
//          rejected_qty: rejectedQty,    
//          warehouse: ACCEPTED_WAREHOUSE, 
//          rejected_warehouse: rejectedQty > 0 ? REJECTED_WAREHOUSE : undefined,
//          rate: r.poItem.rate,
//          purchase_order: poDoc.name,
//          purchase_order_item: r.poItem.name,
//        });
//      }

//      if (!prItems.length) {
//        setMessage("No quantity to receive.");
//        setQcEdit(null);
//        return;
//      }

//      const today = new Date().toISOString().slice(0, 10);
//      const prPayload = {
//        doctype: "Purchase Receipt",
//        supplier: poDoc.supplier,
//        company: poDoc.company,
//        posting_date: today,
//        purchase_order: poDoc.name,
//        transporter_name: poDoc.custom_transporter || undefined,
//        items: prItems,
//      };

//      const prDoc = await createDoc("Purchase Receipt", prPayload);
//      const prName = prDoc.data?.name;
//      if (prName) await submitDoc("Purchase Receipt", prName);

//      const percent = round2((totalGood / (rows.reduce((a,b)=>a+b.orderedQty,0) || 1)) * 100);

//      setReceivedPO((prev) => ({
//        ...prev,
//        [poName]: { prName: prName || null, allGood: true, stockPercent: percent },
//      }));

//      await setPurchaseOrderMfStatus(poName, "QC Pass", { stockPercent: percent });

//      setMessage(`QC PASS: PR ${prName} created (Good: ${totalGood}, Rejected: ${totalRejected}).`);
//      setQcEdit(null);
//      await loadOrders(page, mfFilter);
//    } catch (err) {
//      console.error(err);
//      setError(err.response?.data?.error?.message || err.message || "Failed to create Purchase Receipt");
//    } finally {
//      setQcPassLoading("");
//    }
//  }

//  function cancelQcPass() { setQcEdit(null); setMessage(""); }

//  async function handleQcFail(po) { setError(""); setMessage(""); setQcFailLoading(po.name); try { await setPurchaseOrderMfStatus(po.name, "Cancelled"); await cancelPurchaseOrder(po.name); setMessage(`QC marked as FAIL. Purchase Order ${po.name} has been cancelled.`); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.response?.data?.error?.message || err.message || "Failed to cancel Purchase Order"); } finally { setQcFailLoading(""); } }
  
//  async function handleSubmitPoFromList(po) { setError(""); setMessage(""); setSubmitPoLoading(po.name); try { await submitDoc("Purchase Order", po.name); setMessage(`Purchase Order submitted: ${po.name}`); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.response?.data?.error?.message || err.message || "Failed to submit Purchase Order"); } finally { setSubmitPoLoading(""); } }

//  // -------------------- INVOICE HANDLERS --------------------
//  async function handleCreateInvoice(po) {
//    setError("");
//    setMessage("");
//    setInvoiceLoading(po.name);
//    try {
//      const poDoc = await getPurchaseOrderWithItems(po.name);
//      const poItems = poDoc.items || [];
//      if (!poItems.length) throw new Error("Purchase Order has no items for invoice");

//      const today = new Date().toISOString().slice(0, 10);
//      const receivedInfo = receivedPO[po.name] || {};
//      const sessionPrName = receivedInfo.prName || null;

//      const piPayload = {
//        doctype: "Purchase Invoice",
//        supplier: poDoc.supplier,
//        company: poDoc.company,
//        posting_date: today,
//        purchase_order: poDoc.name,
//        transporter_name: poDoc.custom_transporter || undefined,
//        items: poItems.map((it) => ({
//          item_code: it.item_code,
//          qty: it.qty,
//          rate: it.rate,
//          purchase_order: poDoc.name,
//          po_detail: it.name,
//          ...(sessionPrName ? { purchase_receipt: sessionPrName } : {}),
//        })),
//      };

//      const piDoc = await createDoc("Purchase Invoice", piPayload);
//      const piName = piDoc.data?.name;
//      if (piName) { await submitDoc("Purchase Invoice", piName); }

//      setMessage(piName ? `Invoice Created & Submitted: ${piName}. Click 'Pay & Close' to finish.` : `Invoice Created.`);
//      await loadOrders(page, mfFilter);
//    } catch (err) {
//      console.error(err);
//      setError(err.response?.data?.error?.message || err.message || "Failed to create Purchase Invoice");
//    } finally {
//      setInvoiceLoading("");
//    }
//  }

//  function startUploadInvoice(po) { setError(""); setMessage(""); setUploadTargetPo(po); uploadInputRef.current?.click(); }
  
//  async function onInvoicePdfPicked(e) { const file = e.target.files?.[0]; e.target.value = ""; if (!file || !uploadTargetPo) return; const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"); if (!isPdf) { setError("Please select a PDF file."); setUploadTargetPo(null); return; } await handleUploadInvoice(uploadTargetPo, file); setUploadTargetPo(null); }
  
//  async function handleUploadInvoice(po, pdfFile) { setError(""); setMessage(""); setUploadInvoiceLoading(po.name); try { const poDoc = await getPurchaseOrderWithItems(po.name); const poItems = poDoc.items || []; if (!poItems.length) throw new Error("Purchase Order has no items for invoice"); const today = new Date().toISOString().slice(0, 10); const receivedInfo = receivedPO[po.name] || {}; const sessionPrName = receivedInfo.prName || null; const piPayload = { doctype: "Purchase Invoice", supplier: poDoc.supplier, company: poDoc.company, posting_date: today, purchase_order: poDoc.name, transporter_name: poDoc.custom_transporter || undefined, items: poItems.map((it) => ({ item_code: it.item_code, qty: it.qty, rate: it.rate, purchase_order: poDoc.name, po_detail: it.name, ...(sessionPrName ? { purchase_receipt: sessionPrName } : {}), })), }; const piDoc = await createDoc("Purchase Invoice", piPayload); const piName = piDoc.data?.name; if (!piName) throw new Error("Purchase Invoice not created (missing name)."); await uploadFileToDoc({ doctype: "Purchase Invoice", docname: piName, file: pdfFile, is_private: 1, }); setDraftPiByPo((prev) => ({ ...prev, [po.name]: piName })); setMessage(`Draft PI created: ${piName}. Click "Submit Invoice".`); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.response?.data?.error?.message || err.message || "Failed to upload invoice"); } finally { setUploadInvoiceLoading(""); } }

//  async function handleSubmitDraftInvoice(po) {
//    const piName = draftPiByPo[po.name];
//    if (!piName) return;
//    setError("");
//    setMessage("");
//    setSubmitInvLoading(po.name);
//    try {
//      await submitDoc("Purchase Invoice", piName);
//      setDraftPiByPo((prev) => { const next = { ...prev }; delete next[po.name]; return next; });
//      setMessage(`Invoice submitted: ${piName}. Click 'Pay & Close' to finish.`);
//      await loadOrders(page, mfFilter);
//    } catch (err) {
//      console.error(err);
//      setError(err.response?.data?.error?.message || err.message || "Failed to submit Purchase Invoice");
//    } finally {
//      setSubmitInvLoading("");
//    }
//  }

//  // -------------------- PAYMENT ACTIONS --------------------

//  // ✅ FIXED: Handle Advance Payment (Removed incorrect 'paid_to' field)
//  async function handleAdvancePayment() {
//    if (!advancePayModal) return;
//    const { po, amount, mode } = advancePayModal;
    
//    if (!amount || Number(amount) <= 0) {
//      alert("Please enter a valid amount.");
//      return;
//    }

//    setAdvancePayLoading(po.name);
//    setError("");
//    setMessage("");
//    setAdvancePayModal(null); // Close modal immediately

//    try {
//      // Create Payment Entry type 'Pay' linked to PO (Party Type: Supplier)
//      // ERPNext infers the 'paid_to' (Creditors) account from the Supplier automatically.
//      const payload = {
//        doctype: "Payment Entry",
//        payment_type: "Pay",
//        party_type: "Supplier",
//        party: po.supplier,
//        paid_amount: Number(amount),
//        received_amount: Number(amount),
//        target_exchange_rate: 1,
        
//        // ✅ Corrected: Do NOT set paid_to. Only set paid_from (Asset).
//        paid_from: mode === "Cash" ? "Cash - MF" : "Bank - MF", 
        
//        reference_no: po.name,
//        reference_date: new Date().toISOString().slice(0, 10),
//        custom_remarks: `Advance payment for PO ${po.name}`,
//        references: [
//          {
//            reference_doctype: "Purchase Order",
//            reference_name: po.name,
//            total_amount: po.grand_total,
//            allocated_amount: Number(amount)
//          }
//        ]
//      };
      
//      const doc = await createDoc("Payment Entry", payload);
//      if (doc?.data?.name) {
//        await submitDoc("Payment Entry", doc.data.name);
//        setMessage(`Advance Payment of ${amount} recorded for ${po.name}.`);
//        await loadOrders(page, mfFilter);
//      }
//    } catch (err) {
//      console.error(err);
//      setError("Failed to record advance payment. Check Account settings.");
//    } finally {
//      setAdvancePayLoading("");
//    }
//  }

//  // Existing Pay & Close Logic
//  async function handlePayAndClose(po) {
//    setError("");
//    setMessage("");
//    setPayLoading(po.name);

//    try {
//      const piItems = await getDoctypeList("Purchase Invoice Item", {
//        parent: "Purchase Invoice", 
//        fields: JSON.stringify(["parent"]),
//        filters: JSON.stringify([
//          ["purchase_order", "=", po.name],
//          ["docstatus", "=", 1] 
//        ]),
//        limit_page_length: 50
//      });

//      const piNames = [...new Set((piItems || []).map((i) => i.parent))];
//      if (piNames.length === 0) {
//        throw new Error("No submitted invoice found. Please create/submit invoice first.");
//      }

//      const invoices = await getDoctypeList("Purchase Invoice", {
//        fields: JSON.stringify(["name", "grand_total", "outstanding_amount", "company", "supplier"]),
//        filters: JSON.stringify([["name", "in", piNames]]),
//      });

//      const unpaidInvoices = invoices.filter((inv) => Number(inv.outstanding_amount) > 0);

//      if (unpaidInvoices.length > 0) {
//        for (const pi of unpaidInvoices) {
//          await createPaymentEntryForPurchaseInvoice(pi);
//        }
//        setMessage(`Payment created for ${unpaidInvoices.map((i) => i.name).join(", ")}.`);
//      } else {
//        setMessage("Invoice was already paid (or adjusted via Advance).");
//      }

//      const receivedInfo = receivedPO[po.name] || {};
//      const percentFromErp = po?.[MF_PO_FIELDS.stockPercent] != null && po?.[MF_PO_FIELDS.stockPercent] !== "" ? Number(po[MF_PO_FIELDS.stockPercent]) : undefined;
//      const allGood = receivedInfo.allGood !== undefined ? receivedInfo.allGood : percentFromErp != null ? percentFromErp >= 99.999 : true;

//      const statusToSet = allGood ? "Completed" : "Closed";
//      await setPurchaseOrderStatus(po.name, statusToSet);

//      if (!allGood) {
//        try { await closePurchaseOrder(po.name); } catch (e) { }
//      }

//      const percent = po?.[MF_PO_FIELDS.stockPercent] != null && po?.[MF_PO_FIELDS.stockPercent] !== "" ? Number(po[MF_PO_FIELDS.stockPercent]) : receivedPO?.[po.name]?.stockPercent;
//      await setPurchaseOrderMfStatus(po.name, "Completed", { stockPercent: percent });

//      setMessage((prev) => `${prev} PO ${po.name} marked as Completed.`);
//      await loadOrders(page, mfFilter);
//    } catch (err) {
//      console.error(err);
//      setError(err.response?.data?.error?.message || err.message || "Failed to Pay & Close");
//    } finally {
//      setPayLoading("");
//    }
//  }

//  function handlePrevPage() { if (page === 0 || loading) return; loadOrders(page - 1, mfFilter); }
//  function handleNextPage() { if (!hasMore || loading) return; loadOrders(page + 1, mfFilter); }
//  async function reloadOrders() { await loadOrders(page, mfFilter); }

//  return (
//    <div className="po-list">
//      <input ref={uploadInputRef} type="file" accept="application/pdf,.pdf" style={{ display: "none" }} onChange={onInvoicePdfPicked} />

//      <div className="po-list-header">
//        <div className="po-list-title-block">
//          <h3 className="po-list-title">Recent Purchase Orders</h3>
//          <p className="po-list-subtitle">Process: Draft → QC (good &amp; bad) → Receipt → Invoice → Pay & Close</p>
//        </div>
//        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
//          <div className="po-list-pill" style={{ padding: "6px 10px" }}>
//            MF Filter:&nbsp;
//            <select value={mfFilter} onChange={(e) => onMfFilterChange(e.target.value)} style={{ padding: "4px 6px" }}>
//              <option value="">All</option>
//              {MF_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
//            </select>
//          </div>
//          <div className="po-list-pill" style={{ padding: "6px 10px" }}>
//            <button type="button" className="btn btn-outline btn-xs" onClick={toggleCreatedSort} disabled={loading}>
//              {createdSortLabel}
//            </button>
//          </div>
//          <button type="button" className="btn btn-secondary btn-sm" onClick={reloadOrders} disabled={loading}>
//            {loading ? "Refreshing..." : "Refresh"}
//          </button>
//          <div className="po-list-pill">Page {page + 1} · {orders.length} open PO{orders.length !== 1 ? "s" : ""}</div>
//        </div>
//      </div>

//      {loading && <p className="po-list-loading text-muted">Loading purchase orders...</p>}
//      {error && <p className="alert alert-error">{error}</p>}
//      {message && <p className="alert alert-success">{message}</p>}

//      {!loading && !error && (
//        <>
//          {orders.length === 0 ? (
//            <p className="po-list-empty text-muted">No Purchase Orders to process.</p>
//          ) : (
//            <div className="po-list-table-wrapper">
//              <table className="po-list-table">
//                <thead>
//                  <tr>
//                    <th>Name</th>
//                    <th>Supplier</th>
//                    <th>Items</th>
//                    <th>Company</th>
//                    <th>Date</th>
//                    <th>Status</th>
//                    <th>Grand Total</th>
//                    <th>Actions</th>
//                    <th>Transporter</th>
//                    <th>MF Status</th>
//                    <th>% Stock In</th>
//                  </tr>
//                </thead>
//                <tbody>
//                  {sortedOrders.map((po) => {
//                    const perReceived = Number(po.per_received || 0);
//                    const perBilled = Number(po.per_billed || 0);

//                    const receivedFromErp = perReceived > 0;
//                    const mf = po[MF_PO_FIELDS.status];
//                    const receivedFromMf = mf === "QC In" || mf === "Completed";
//                    const isReceived = receivedFromErp || receivedFromMf;
                    
//                    const isFullyBilled = perBilled >= 100;
//                    const advancePaid = Number(po.advance_paid || 0);
                    
//                    const isQcPassing = qcPassLoading === po.name;
//                    const isQcFailing = qcFailLoading === po.name;
//                    const isInvoicing = invoiceLoading === po.name;
//                    const isUploading = uploadInvoiceLoading === po.name;
//                    const isSubmittingPo = submitPoLoading === po.name;
//                    const isDraft = po.status === "Draft";
//                    const isThisQcEdit = qcEdit && qcEdit.poName === po.name;
//                    const draftPiName = draftPiByPo[po.name];
//                    const isSubmittingInvoice = submitInvLoading === po.name;
//                    const isPaying = payLoading === po.name;
//                    const isAdvancePaying = advancePayLoading === po.name;

//                    const statusOptions = getSequentialStatusOptions(po[MF_PO_FIELDS.status]);

//                    return (
//                      <tr key={po.name}>
//                        <td className="po-cell-name">{po.name}</td>
//                        <td>{po.supplier}</td>
//                        <td style={{ maxWidth: 420 }}>
//                          <span style={{ fontSize: 12, opacity: 0.9 }}>
//                            {poItemsSummary[po.name] || "—"}
//                          </span>
//                        </td>
//                        <td>{po.company}</td>
//                        <td>{po.transaction_date}</td>
//                        <td>{po.status}</td>
//                        <td className="po-cell-money">
//                          {po.grand_total}
//                          {advancePaid > 0 && (
//                            <div style={{ fontSize: 10, color: "green", marginTop: 2 }}>
//                              Adv: {advancePaid}
//                            </div>
//                          )}
//                        </td>
//                        <td className="po-cell-actions">
//                          {isDraft ? (
//                            <div className="po-actions-stack">
//                              <button onClick={() => onEditPo && onEditPo(po.name)} className="btn btn-outline btn-xs">Edit Draft</button>
//                              <button onClick={() => { const ok = window.confirm(`You are about to SUBMIT Purchase Order: ${po.name}\n\nSubmit now?`); if (!ok) return; handleSubmitPoFromList(po); }} disabled={isSubmittingPo} className="btn btn-primary btn-xs">{isSubmittingPo ? "Submitting..." : "Submit"}</button>
//                            </div>
//                          ) : !isReceived ? (
//                            <div className="po-actions-stack">
//                              {!isFullyBilled && (
//                                <button 
//                                  onClick={() => setAdvancePayModal({ po, amount: "", mode: "Bank" })}
//                                  className="btn btn-ghost btn-xs"
//                                  style={{marginBottom: 4, color: "#007bff"}}
//                                  disabled={isAdvancePaying}
//                                >
//                                  {isAdvancePaying ? "Paying..." : "+ Advance Pay"}
//                                </button>
//                              )}

//                              {isThisQcEdit ? (
//                                <div className="qc-inline" style={{ minWidth: 320 }}>
//                                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Enter Good & Rejected Qty:</div>
//                                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//                                    {qcEdit.rows.map((r) => {
//                                      const good = Number(r.goodQtyInput || 0);
//                                      const bad = Number(r.rejectedQtyInput || 0);
//                                      const total = good + bad;
//                                      const isOverDelivery = total > r.maxQty;

//                                      return (
//                                        <div key={r.rowId} style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
//                                          <div style={{ flex: 1, fontSize: 12 }}>
//                                            <b>{r.item_code}</b>
//                                            <div style={{ opacity: 0.75 }}>Ord: {r.orderedQty}</div>
//                                          </div>
                                          
//                                          <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
//                                            <label style={{fontSize:9, opacity:0.7}}>Good</label>
//                                            <input
//                                              type="number"
//                                              className="qc-inline-input"
//                                              style={{ width: 70, borderColor: "green" }}
//                                              value={r.goodQtyInput}
//                                              onChange={(e) => updateQcRowQty(r.rowId, e.target.value)}
//                                            />
//                                          </div>

//                                          <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
//                                            <label style={{fontSize:9, opacity:0.7}}>Rejected</label>
//                                            <input
//                                              type="number"
//                                              className="qc-inline-input"
//                                              style={{ width: 70, borderColor: "red", backgroundColor: "#fff0f0" }}
//                                              value={r.rejectedQtyInput}
//                                              onChange={(e) => updateQcRowRejected(r.rowId, e.target.value)}
//                                            />
//                                          </div>

//                                          <div style={{fontSize: 11, width: 40, textAlign:'right', color: isOverDelivery ? 'orange' : 'inherit'}}>
//                                            = {total}
//                                          </div>
//                                        </div>
//                                      );
//                                    })}

//                                  </div>
//                                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
//                                    <button onClick={confirmQcPass} disabled={isQcPassing} className="btn btn-outline btn-xs">{isQcPassing ? "Receiving..." : "Receive"}</button>
//                                    <button onClick={cancelQcPass} className="btn btn-ghost btn-xs">Cancel</button>
//                                  </div>
//                                </div>
//                              ) : (
//                                <>
//                                  <button onClick={() => startQcPass(po)} disabled={isQcPassing || isQcFailing} className="btn btn-outline btn-xs">{isQcPassing ? "Loading QC..." : "QC Pass & Receive"}</button>
//                                  <button onClick={() => handleQcFail(po)} disabled={isQcPassing || isQcFailing} className="btn btn-danger btn-xs">{isQcFailing ? "Marking Fail..." : "QC Fail"}</button>
//                                </>
//                              )}
//                            </div>
//                          ) : (
//                            <div className="po-actions-stack">
//                              {!isFullyBilled && (
//                                <button 
//                                  onClick={() => setAdvancePayModal({ po, amount: "", mode: "Bank" })}
//                                  className="btn btn-ghost btn-xs"
//                                  style={{marginBottom: 4, color: "#007bff"}}
//                                  disabled={isAdvancePaying}
//                                >
//                                  {isAdvancePaying ? "Paying..." : "+ Advance Pay"}
//                                </button>
//                              )}

//                              {isFullyBilled ? (
//                                 <button 
//                                    onClick={() => handlePayAndClose(po)} 
//                                    disabled={isPaying} 
//                                    className="btn btn-success btn-xs"
//                                 >
//                                    {isPaying ? "Processing..." : "Pay & Close"}
//                                 </button>
//                              ) : (
//                                <>
//                                  {draftPiName ? (
//                                    <button onClick={() => handleSubmitDraftInvoice(po)} disabled={isSubmittingInvoice} className="btn btn-accent btn-xs">{isSubmittingInvoice ? "Submitting..." : `Submit Invoice (${draftPiName})`}</button>
//                                  ) : (
//                                    <div className="po-actions-stack">
//                                      <button onClick={() => handleCreateInvoice(po)} disabled={isInvoicing || isUploading} className="btn btn-accent btn-xs">{isInvoicing ? "Creating..." : "Create Invoice"}</button>
//                                      <button onClick={() => startUploadInvoice(po)} disabled={isInvoicing || isUploading} className="btn btn-outline btn-xs">{isUploading ? "Uploading..." : "Upload Invoice"}</button>
//                                    </div>
//                                  )}
//                                </>
//                              )}
//                            </div>
//                          )}
//                        </td>
//                        <td>
//                          {isDraft ? (
//                            <select value={po.custom_transporter || ""} disabled={transporterUpdating === po.name} onChange={async (e) => { const t = e.target.value; setTransporterUpdating(po.name); setError(""); setMessage(""); try { await setPurchaseOrderTransporter(po.name, t); setMessage(`Transporter updated for ${po.name}`); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.message || "Failed to update transporter"); } finally { setTransporterUpdating(""); } }}>
//                              <option value="">-- None --</option>
//                              {transporters.map((t) => (
//                                <option key={t.name} value={t.name}>{t.transporter_name || t.name}</option>
//                              ))}
//                            </select>
//                          ) : (
//                            <span>{po.custom_transporter ? (transporterNameMap.get(po.custom_transporter) || po.custom_transporter) : "—"}</span>
//                          )}
//                        </td>
//                        <td>
//                          <select
//                            value={po[MF_PO_FIELDS.status] || ""}
//                            onChange={(e) => handleMfStatusChange(po, e.target.value)}
//                            disabled={mfUpdating === po.name}
//                          >
//                            {statusOptions.map((s) => (
//                              <option key={s} value={s}>{s}</option>
//                            ))}
//                          </select>
//                          <div style={{ fontSize: 12, opacity: 0.7 }}>{po[MF_PO_FIELDS.updatedOn] || ""}</div>
//                        </td>
//                        <td>{po[MF_PO_FIELDS.stockPercent] != null && po[MF_PO_FIELDS.stockPercent] !== "" ? `${Number(po[MF_PO_FIELDS.stockPercent]).toFixed(2)}%` : ""}</td>
//                      </tr>
//                    );
//                  })}
//                </tbody>
//              </table>
//            </div>
//          )}
//        </>
//      )}

//      {/* ✅ ADVANCE PAYMENT MODAL */}
//      {advancePayModal && (
//        <div className="modal-overlay">
//          <div className="modal-content" style={{ maxWidth: 400 }}>
//            <h3>Record Advance Payment</h3>
//            <p className="text-muted" style={{ fontSize: 13, marginBottom: 15 }}>
//              For PO: <b>{advancePayModal.po.name}</b><br/>
//              Supplier: {advancePayModal.po.supplier}<br/>
//              Grand Total: {advancePayModal.po.grand_total}
//            </p>

//            <div className="po-field">
//              <label className="po-label">Amount</label>
//              <input 
//                type="number" 
//                className="po-input" 
//                value={advancePayModal.amount} 
//                onChange={(e) => setAdvancePayModal({...advancePayModal, amount: e.target.value})} 
//                placeholder="Enter amount"
//                autoFocus
//              />
//            </div>

//            <div className="po-field">
//              <label className="po-label">Mode</label>
//              <select 
//                className="po-input" 
//                value={advancePayModal.mode} 
//                onChange={(e) => setAdvancePayModal({...advancePayModal, mode: e.target.value})}
//              >
//                <option value="Bank">Bank Transfer / UPI</option>
//                <option value="Cash">Cash</option>
//              </select>
//            </div>

//            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
//              <button 
//                className="btn btn-secondary" 
//                onClick={() => setAdvancePayModal(null)}
//              >
//                Cancel
//              </button>
//              <button 
//                className="btn btn-primary" 
//                onClick={handleAdvancePayment}
//              >
//                Record Payment
//              </button>
//            </div>
//          </div>
//        </div>
//      )}

//    </div>
//  );
//}

//export default PurchaseOrderList;

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getDoctypeList,
  submitDoc,
  getPurchaseOrderWithItems,
  getDoc,
  createPaymentEntryForPurchaseInvoice,
  cancelPurchaseOrder,
  setPurchaseOrderStatus,
  setPurchaseOrderMfStatus,
  MF_PO_FIELDS,
  MF_STATUS_OPTIONS,
  createDoc,
  uploadFileToDoc,
  closePurchaseOrder,
  mapLimit,
  getTransporters,
  setPurchaseOrderTransporter,
} from "../erpBackendApi";

import "./PurchaseOrderList.css";

// -------------------- Constants --------------------
const PAGE_SIZE = 20;
const ACCEPTED_WAREHOUSE = "Raw Material - MF";
const REJECTED_WAREHOUSE = "Rejected Warehouse - MF";

function round2(n) {
  const x = Number(n);
  if (isNaN(x)) return 0;
  return Math.round(x * 100) / 100;
}

function buildItemSummary(items = []) {
  const clean = (items || [])
    .map((it) => {
      const code = it.item_code || it.item_name || "";
      const name = it.item_name || "";
      if (!code) return "";
      return name && name !== code ? `${code} (${name})` : code;
    })
    .filter(Boolean);

  if (!clean.length) return "";
  const max = 3;
  if (clean.length <= max) return clean.join(", ");
  return `${clean.slice(0, max).join(", ")} +${clean.length - max} more`;
}

function getSequentialStatusOptions(currentStatus) {
  const currentIndex = MF_STATUS_OPTIONS.indexOf(currentStatus);
  const deliveredIndex = MF_STATUS_OPTIONS.indexOf("Delivered");

  if (currentIndex === -1) {
    return [MF_STATUS_OPTIONS[0]];
  }

  const options = [currentStatus];

  if (currentIndex < MF_STATUS_OPTIONS.length - 1) {
    const nextStatus = MF_STATUS_OPTIONS[currentIndex + 1];
    if (nextStatus !== "Cancelled") {
      options.push(nextStatus);
    }
  }

  if (currentIndex <= deliveredIndex && currentStatus !== "Cancelled") {
    options.push("Cancelled");
  }

  return options;
}

function PurchaseOrderList({ onEditPo }) {
  // -------------------- State --------------------
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transporters, setTransporters] = useState([]);
  const [transporterUpdating, setTransporterUpdating] = useState("");

  const transporterNameMap = useMemo(() => {
    const m = new Map();
    (transporters || []).forEach((t) => {
      m.set(t.name, t.transporter_name || t.name);
    });
    return m;
  }, [transporters]);

  const [qcPassLoading, setQcPassLoading] = useState("");
  const [qcFailLoading, setQcFailLoading] = useState("");

  // Loaders for Invoice Actions
  const [invoiceLoading, setInvoiceLoading] = useState("");
  const [submitPoLoading, setSubmitPoLoading] = useState("");
  const [payLoading, setPayLoading] = useState(""); 
  const [advancePayLoading, setAdvancePayLoading] = useState(""); 

  const [mfFilter, setMfFilter] = useState("");
  const [qcEdit, setQcEdit] = useState(null);
  
  // Advance Pay Modal
  const [advancePayModal, setAdvancePayModal] = useState(null); 

  const [receivedPO, setReceivedPO] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [mfUpdating, setMfUpdating] = useState("");
  const [poItemsSummary, setPoItemsSummary] = useState({});
  const uploadInputRef = useRef(null);
  const [uploadTargetPo, setUploadTargetPo] = useState(null);
  const [uploadInvoiceLoading, setUploadInvoiceLoading] = useState("");
  const [draftPiByPo, setDraftPiByPo] = useState({});
  const [submitInvLoading, setSubmitInvLoading] = useState("");
  const [createdSort, setCreatedSort] = useState("asc");

  const createdSortLabel =
    createdSort === "asc"
      ? "Sort by Created: Oldest → Newest"
      : "Sort by Created: Newest → Oldest";

  function toSortTs(v) {
    if (!v) return 0;
    const s = String(v).trim();
    if (!s) return 0;
    const isoLike = s.includes(" ") ? s.replace(" ", "T") : s;
    const d = new Date(isoLike);
    const t = d.getTime();
    return Number.isFinite(t) ? t : 0;
  }

  const sortedOrders = useMemo(() => {
    const dirMul = createdSort === "asc" ? 1 : -1;
    return [...orders].sort((a, b) => {
      const ta = toSortTs(a?.creation);
      const tb = toSortTs(b?.creation);
      if (ta !== tb) return (ta - tb) * dirMul;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });
  }, [orders, createdSort]);

  function toggleCreatedSort() {
    setCreatedSort((prev) => (prev === "asc" ? "desc" : "asc"));
  }

  // -------------------- MF Status Logic --------------------
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
    } catch (e) { }
  }

  async function loadOrders(pageIndex = 0, mfStatus = "") {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const baseFilters = [
        ["Purchase Order", "status", "in", ["Draft", "To Receive and Bill", "To Receive", "To Bill", "Completed"]],
      ];

      if (mfStatus) {
        baseFilters.push(["Purchase Order", MF_PO_FIELDS.status, "=", mfStatus]);
      }

      let data = await getDoctypeList("Purchase Order", {
        fields: JSON.stringify([
          "name",
          "supplier",
          "company",
          "transaction_date",
          "status",
          "grand_total",
          "advance_paid", // ✅ Important: We need this to calculate remaining balance
          "per_received",
          "per_billed",
          "creation",
          "custom_transporter",
          MF_PO_FIELDS.status,
          MF_PO_FIELDS.updatedOn,
          MF_PO_FIELDS.stockPercent,
        ]),
        filters: JSON.stringify(baseFilters),
        order_by: "creation desc",
        limit_page_length: PAGE_SIZE + 1,
        limit_start: pageIndex * PAGE_SIZE,
      });

      data = data.filter((row) => {
        const mfSt = row[MF_PO_FIELDS.status];
        if (mfSt === "Completed") return false;
        if (row.status === "Closed" || row.status === "Cancelled") return false;
        return true;
      });

      const pageRows = data.slice(0, PAGE_SIZE);
      const displayRows = [...pageRows].reverse();

      setHasMore(data.length > PAGE_SIZE);
      setOrders(displayRows);
      setPage(pageIndex);
      setQcEdit(null);
      hydrateItemNames(displayRows);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load Purchase Orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders(0, mfFilter);
    getTransporters()
      .then((rows) => setTransporters(rows || []))
      .catch((e) => console.error("Transporters load failed", e));
  }, []);

  async function onMfFilterChange(v) {
    setMfFilter(v);
    await loadOrders(0, v);
  }

  // -------------------- QC & Actions --------------------
  async function startQcPass(po) {
    setError("");
    setMessage("");
    setQcPassLoading(po.name);
    try {
      const poDoc = await getPurchaseOrderWithItems(po.name);
      const poItems = poDoc.items || [];
      if (!poItems.length) throw new Error("Purchase Order has no items to receive");

      const rows = poItems.map((it) => {
        const ordered = Number(it.qty || 0);
        const received = Number(it.received_qty || 0);
        const remaining = ordered - received;

        return {
          rowId: it.name,
          item_code: it.item_code,
          item_name: it.item_name,
          orderedQty: ordered,
          receivedQty: received,
          maxQty: remaining > 0 ? remaining : 0, 
          goodQtyInput: remaining > 0 ? String(remaining) : "0", 
          rejectedQtyInput: "0", 
          poItem: it,
        };
      }).filter(Boolean);

      setQcEdit({ poName: po.name, poDoc, rows });
      setMessage(`Enter Good AND Rejected quantity for PO ${po.name}.`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || err.message || "Failed to load QC");
    } finally {
      setQcPassLoading("");
    }
  }

  function updateQcRowQty(rowId, value) { 
    setQcEdit((prev) => { 
        if (!prev) return prev; 
        return { ...prev, rows: prev.rows.map((r) => (r.rowId === rowId ? { ...r, goodQtyInput: value } : r)), }; 
    }); 
  }

  function updateQcRowRejected(rowId, value) {
    setQcEdit((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map((r) => (r.rowId === rowId ? { ...r, rejectedQtyInput: value } : r)),
      };
    });
  }

  async function confirmQcPass() {
    if (!qcEdit) return;
    const { poName, poDoc, rows } = qcEdit;
    setError("");
    setMessage("");
    setQcPassLoading(poName);

    try {
      let totalGood = 0;
      let totalRejected = 0;
      const prItems = [];

      for (const r of rows) {
        const goodQty = Number(r.goodQtyInput || 0);
        const rejectedQty = Number(r.rejectedQtyInput || 0);

        if (goodQty < 0 || rejectedQty < 0) throw new Error(`Quantities cannot be negative.`);

        const rowTotal = goodQty + rejectedQty; 

        if (rowTotal <= 0) continue;

        totalGood += goodQty;
        totalRejected += rejectedQty;

        prItems.push({
          item_code: r.poItem.item_code,
          qty: goodQty,           
          received_qty: rowTotal, 
          accepted_qty: goodQty,        
          rejected_qty: rejectedQty,    
          warehouse: ACCEPTED_WAREHOUSE, 
          rejected_warehouse: rejectedQty > 0 ? REJECTED_WAREHOUSE : undefined,
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

      const today = new Date().toISOString().slice(0, 10);
      const prPayload = {
        doctype: "Purchase Receipt",
        supplier: poDoc.supplier,
        company: poDoc.company,
        posting_date: today,
        purchase_order: poDoc.name,
        transporter_name: poDoc.custom_transporter || undefined,
        items: prItems,
      };

      const prDoc = await createDoc("Purchase Receipt", prPayload);
      const prName = prDoc.data?.name;
      if (prName) await submitDoc("Purchase Receipt", prName);

      const percent = round2((totalGood / (rows.reduce((a,b)=>a+b.orderedQty,0) || 1)) * 100);

      setReceivedPO((prev) => ({
        ...prev,
        [poName]: { prName: prName || null, allGood: true, stockPercent: percent },
      }));

      await setPurchaseOrderMfStatus(poName, "QC Pass", { stockPercent: percent });

      setMessage(`QC PASS: PR ${prName} created (Good: ${totalGood}, Rejected: ${totalRejected}).`);
      setQcEdit(null);
      await loadOrders(page, mfFilter);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || err.message || "Failed to create Purchase Receipt");
    } finally {
      setQcPassLoading("");
    }
  }

  function cancelQcPass() { setQcEdit(null); setMessage(""); }

  async function handleQcFail(po) { setError(""); setMessage(""); setQcFailLoading(po.name); try { await setPurchaseOrderMfStatus(po.name, "Cancelled"); await cancelPurchaseOrder(po.name); setMessage(`QC marked as FAIL. Purchase Order ${po.name} has been cancelled.`); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.response?.data?.error?.message || err.message || "Failed to cancel Purchase Order"); } finally { setQcFailLoading(""); } }
  
  async function handleSubmitPoFromList(po) { setError(""); setMessage(""); setSubmitPoLoading(po.name); try { await submitDoc("Purchase Order", po.name); setMessage(`Purchase Order submitted: ${po.name}`); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.response?.data?.error?.message || err.message || "Failed to submit Purchase Order"); } finally { setSubmitPoLoading(""); } }

  // -------------------- INVOICE HANDLERS --------------------
  
  // ✅ FIX 1: Handle Create Invoice with correct "Accepted Quantity"
  async function handleCreateInvoice(po) {
    setError("");
    setMessage("");
    setInvoiceLoading(po.name);
    try {
      const today = new Date().toISOString().slice(0, 10);
      
      // Attempt to find the Receipt logic
      let prName = receivedPO[po.name]?.prName;
      if (!prName) {
        // Fallback: search API for PR linked to this PO
        const linkedPrs = await getDoctypeList("Purchase Receipt", {
            filters: JSON.stringify([["purchase_order", "=", po.name], ["docstatus", "=", 1]]),
            fields: JSON.stringify(["name"]),
            order_by: "creation desc",
            limit_page_length: 1
        });
        if (linkedPrs.length > 0) prName = linkedPrs[0].name;
      }

      let invoiceItems = [];

      if (prName) {
        // ✅ CASE A: Create Invoice from Purchase Receipt
        // This ensures we get the Accepted Qty (it.qty), NOT the Total Received.
        const prDoc = await getDoc("Purchase Receipt", prName);
        invoiceItems = (prDoc.items || []).map((it) => ({
          item_code: it.item_code,
          qty: it.qty, // ✅ This is "Accepted Quantity" in PR
          rate: it.rate,
          purchase_order: po.name,
          purchase_receipt: prName,
          po_detail: it.purchase_order_item,
          pr_detail: it.name,
        }));
      } else {
        // CASE B: Direct Invoice from PO
        const poDoc = await getPurchaseOrderWithItems(po.name);
        invoiceItems = (poDoc.items || []).map((it) => ({
          item_code: it.item_code,
          qty: it.qty, // Fallback to Ordered Qty
          rate: it.rate,
          purchase_order: po.name,
          po_detail: it.name,
        }));
      }

      const piPayload = {
        doctype: "Purchase Invoice",
        supplier: po.supplier,
        company: po.company,
        posting_date: today,
        purchase_order: po.name,
        transporter_name: po.custom_transporter || undefined,
        items: invoiceItems,
      };

      const piDoc = await createDoc("Purchase Invoice", piPayload);
      const piName = piDoc.data?.name;
      if (piName) { await submitDoc("Purchase Invoice", piName); }

      setMessage(piName ? `Invoice Created & Submitted: ${piName} (Based on ${prName ? "Receipt" : "Order"}). Click 'Pay & Close'.` : `Invoice Created.`);
      await loadOrders(page, mfFilter);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || err.message || "Failed to create Purchase Invoice");
    } finally {
      setInvoiceLoading("");
    }
  }

  function startUploadInvoice(po) { setError(""); setMessage(""); setUploadTargetPo(po); uploadInputRef.current?.click(); }
  
  async function onInvoicePdfPicked(e) { const file = e.target.files?.[0]; e.target.value = ""; if (!file || !uploadTargetPo) return; const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"); if (!isPdf) { setError("Please select a PDF file."); setUploadTargetPo(null); return; } await handleUploadInvoice(uploadTargetPo, file); setUploadTargetPo(null); }
  
  async function handleUploadInvoice(po, pdfFile) { setError(""); setMessage(""); setUploadInvoiceLoading(po.name); try { const poDoc = await getPurchaseOrderWithItems(po.name); const poItems = poDoc.items || []; if (!poItems.length) throw new Error("Purchase Order has no items for invoice"); const today = new Date().toISOString().slice(0, 10); const receivedInfo = receivedPO[po.name] || {}; const sessionPrName = receivedInfo.prName || null; const piPayload = { doctype: "Purchase Invoice", supplier: poDoc.supplier, company: poDoc.company, posting_date: today, purchase_order: poDoc.name, transporter_name: poDoc.custom_transporter || undefined, items: poItems.map((it) => ({ item_code: it.item_code, qty: it.qty, rate: it.rate, purchase_order: poDoc.name, po_detail: it.name, ...(sessionPrName ? { purchase_receipt: sessionPrName } : {}), })), }; const piDoc = await createDoc("Purchase Invoice", piPayload); const piName = piDoc.data?.name; if (!piName) throw new Error("Purchase Invoice not created (missing name)."); await uploadFileToDoc({ doctype: "Purchase Invoice", docname: piName, file: pdfFile, is_private: 1, }); setDraftPiByPo((prev) => ({ ...prev, [po.name]: piName })); setMessage(`Draft PI created: ${piName}. Click "Submit Invoice".`); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.response?.data?.error?.message || err.message || "Failed to upload invoice"); } finally { setUploadInvoiceLoading(""); } }

  async function handleSubmitDraftInvoice(po) {
    const piName = draftPiByPo[po.name];
    if (!piName) return;
    setError("");
    setMessage("");
    setSubmitInvLoading(po.name);
    try {
      await submitDoc("Purchase Invoice", piName);
      setDraftPiByPo((prev) => { const next = { ...prev }; delete next[po.name]; return next; });
      setMessage(`Invoice submitted: ${piName}. Click 'Pay & Close' to finish.`);
      await loadOrders(page, mfFilter);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || err.message || "Failed to submit Purchase Invoice");
    } finally {
      setSubmitInvLoading("");
    }
  }

  // -------------------- PAYMENT ACTIONS --------------------

  async function handleAdvancePayment() {
    if (!advancePayModal) return;
    const { po, amount, mode } = advancePayModal;
    
    if (!amount || Number(amount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    setAdvancePayLoading(po.name);
    setError("");
    setMessage("");
    setAdvancePayModal(null); 

    try {
      const payload = {
        doctype: "Payment Entry",
        payment_type: "Pay",
        party_type: "Supplier",
        party: po.supplier,
        paid_amount: Number(amount),
        received_amount: Number(amount),
        target_exchange_rate: 1,
        paid_from: mode === "Cash" ? "Cash - MF" : "Bank - MF", 
        reference_no: po.name,
        reference_date: new Date().toISOString().slice(0, 10),
        custom_remarks: `Advance payment for PO ${po.name}`,
        references: [
          {
            reference_doctype: "Purchase Order",
            reference_name: po.name,
            total_amount: po.grand_total,
            allocated_amount: Number(amount)
          }
        ]
      };
      
      const doc = await createDoc("Payment Entry", payload);
      if (doc?.data?.name) {
        await submitDoc("Payment Entry", doc.data.name);
        setMessage(`Advance Payment of ${amount} recorded for ${po.name}.`);
        await loadOrders(page, mfFilter);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to record advance payment.");
    } finally {
      setAdvancePayLoading("");
    }
  }

  // ✅ FIX 2: Handle Pay & Close (Subtract Advance)
  async function handlePayAndClose(po) {
    setError("");
    setMessage("");
    setPayLoading(po.name);

    try {
      const piItems = await getDoctypeList("Purchase Invoice Item", {
        parent: "Purchase Invoice", 
        fields: JSON.stringify(["parent"]),
        filters: JSON.stringify([
          ["purchase_order", "=", po.name],
          ["docstatus", "=", 1] 
        ]),
        limit_page_length: 50
      });

      const piNames = [...new Set((piItems || []).map((i) => i.parent))];
      if (piNames.length === 0) {
        throw new Error("No submitted invoice found. Please create/submit invoice first.");
      }

      const invoices = await getDoctypeList("Purchase Invoice", {
        fields: JSON.stringify(["name", "grand_total", "outstanding_amount", "company", "supplier"]),
        filters: JSON.stringify([["name", "in", piNames]]),
      });

      const unpaidInvoices = invoices.filter((inv) => Number(inv.outstanding_amount) > 0);

      // ✅ LOGIC UPDATE: Calculate what needs to be paid (Net of Advances)
      const advanceAlreadyPaid = Number(po.advance_paid || 0);
      let totalToPayNow = 0;

      if (unpaidInvoices.length > 0) {
        for (const pi of unpaidInvoices) {
          
          let amountForThisInvoice = Number(pi.outstanding_amount);
          
          // Deduct Advance Logic
          if (advanceAlreadyPaid > 0 && amountForThisInvoice > 0) {
             const deduction = Math.min(amountForThisInvoice, advanceAlreadyPaid);
             amountForThisInvoice -= deduction;
             // reduce our local tracker for multiple invoice scenarios
             // advanceAlreadyPaid -= deduction; 
          }

          if (amountForThisInvoice > 0) {
             // Create payment for the REMAINING balance only
             await createPaymentEntryForPurchaseInvoice({
                 ...pi,
                 outstanding_amount: amountForThisInvoice 
             });
             totalToPayNow += amountForThisInvoice;
          }
        }
        
        if (totalToPayNow > 0) {
            setMessage(`Payment created for remaining balance: ${totalToPayNow.toFixed(2)}.`);
        } else {
            setMessage(`Invoice marked paid (covered by Advance).`);
        }
        
      } else {
        setMessage("Invoice was already paid.");
      }

      // Close Logic remains same
      const receivedInfo = receivedPO[po.name] || {};
      const percentFromErp = po?.[MF_PO_FIELDS.stockPercent] != null && po?.[MF_PO_FIELDS.stockPercent] !== "" ? Number(po[MF_PO_FIELDS.stockPercent]) : undefined;
      const allGood = receivedInfo.allGood !== undefined ? receivedInfo.allGood : percentFromErp != null ? percentFromErp >= 99.999 : true;

      const statusToSet = allGood ? "Completed" : "Closed";
      await setPurchaseOrderStatus(po.name, statusToSet);

      if (!allGood) {
        try { await closePurchaseOrder(po.name); } catch (e) { }
      }

      const percent = po?.[MF_PO_FIELDS.stockPercent] != null && po?.[MF_PO_FIELDS.stockPercent] !== "" ? Number(po[MF_PO_FIELDS.stockPercent]) : receivedPO?.[po.name]?.stockPercent;
      await setPurchaseOrderMfStatus(po.name, "Completed", { stockPercent: percent });

      setMessage((prev) => `${prev} PO ${po.name} marked as Completed.`);
      await loadOrders(page, mfFilter);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || err.message || "Failed to Pay & Close");
    } finally {
      setPayLoading("");
    }
  }

  function handlePrevPage() { if (page === 0 || loading) return; loadOrders(page - 1, mfFilter); }
  function handleNextPage() { if (!hasMore || loading) return; loadOrders(page + 1, mfFilter); }
  async function reloadOrders() { await loadOrders(page, mfFilter); }

  return (
    <div className="po-list">
      <input ref={uploadInputRef} type="file" accept="application/pdf,.pdf" style={{ display: "none" }} onChange={onInvoicePdfPicked} />

      <div className="po-list-header">
        <div className="po-list-title-block">
          <h3 className="po-list-title">Recent Purchase Orders</h3>
          <p className="po-list-subtitle">Process: Draft → QC (good &amp; bad) → Receipt → Invoice → Pay & Close</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div className="po-list-pill" style={{ padding: "6px 10px" }}>
            MF Filter:&nbsp;
            <select value={mfFilter} onChange={(e) => onMfFilterChange(e.target.value)} style={{ padding: "4px 6px" }}>
              <option value="">All</option>
              {MF_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="po-list-pill" style={{ padding: "6px 10px" }}>
            <button type="button" className="btn btn-outline btn-xs" onClick={toggleCreatedSort} disabled={loading}>
              {createdSortLabel}
            </button>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={reloadOrders} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <div className="po-list-pill">Page {page + 1} · {orders.length} open PO{orders.length !== 1 ? "s" : ""}</div>
        </div>
      </div>

      {loading && <p className="po-list-loading text-muted">Loading purchase orders...</p>}
      {error && <p className="alert alert-error">{error}</p>}
      {message && <p className="alert alert-success">{message}</p>}

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
                    <th>Transporter</th>
                    <th>MF Status</th>
                    <th>% Stock In</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOrders.map((po) => {
                    const perReceived = Number(po.per_received || 0);
                    const perBilled = Number(po.per_billed || 0);

                    const receivedFromErp = perReceived > 0;
                    const mf = po[MF_PO_FIELDS.status];
                    const receivedFromMf = mf === "QC In" || mf === "Completed";
                    const isReceived = receivedFromErp || receivedFromMf;
                    
                    const isFullyBilled = perBilled >= 100;
                    const advancePaid = Number(po.advance_paid || 0);
                    
                    const isQcPassing = qcPassLoading === po.name;
                    const isQcFailing = qcFailLoading === po.name;
                    const isInvoicing = invoiceLoading === po.name;
                    const isUploading = uploadInvoiceLoading === po.name;
                    const isSubmittingPo = submitPoLoading === po.name;
                    const isDraft = po.status === "Draft";
                    const isThisQcEdit = qcEdit && qcEdit.poName === po.name;
                    const draftPiName = draftPiByPo[po.name];
                    const isSubmittingInvoice = submitInvLoading === po.name;
                    const isPaying = payLoading === po.name;
                    const isAdvancePaying = advancePayLoading === po.name;

                    const statusOptions = getSequentialStatusOptions(po[MF_PO_FIELDS.status]);

                    return (
                      <tr key={po.name}>
                        <td className="po-cell-name">{po.name}</td>
                        <td>{po.supplier}</td>
                        <td style={{ maxWidth: 420 }}>
                          <span style={{ fontSize: 12, opacity: 0.9 }}>
                            {poItemsSummary[po.name] || "—"}
                          </span>
                        </td>
                        <td>{po.company}</td>
                        <td>{po.transaction_date}</td>
                        <td>{po.status}</td>
                        <td className="po-cell-money">
                          {po.grand_total}
                          {advancePaid > 0 && (
                            <div style={{ fontSize: 10, color: "green", marginTop: 2 }}>
                              Adv: {advancePaid}
                            </div>
                          )}
                        </td>
                        <td className="po-cell-actions">
                          {isDraft ? (
                            <div className="po-actions-stack">
                              <button onClick={() => onEditPo && onEditPo(po.name)} className="btn btn-outline btn-xs">Edit Draft</button>
                              <button onClick={() => { const ok = window.confirm(`You are about to SUBMIT Purchase Order: ${po.name}\n\nSubmit now?`); if (!ok) return; handleSubmitPoFromList(po); }} disabled={isSubmittingPo} className="btn btn-primary btn-xs">{isSubmittingPo ? "Submitting..." : "Submit"}</button>
                            </div>
                          ) : !isReceived ? (
                            <div className="po-actions-stack">
                              {!isFullyBilled && (
                                <button 
                                  onClick={() => setAdvancePayModal({ po, amount: "", mode: "Bank" })}
                                  className="btn btn-ghost btn-xs"
                                  style={{marginBottom: 4, color: "#007bff"}}
                                  disabled={isAdvancePaying}
                                >
                                  {isAdvancePaying ? "Paying..." : "+ Advance Pay"}
                                </button>
                              )}

                              {isThisQcEdit ? (
                                <div className="qc-inline" style={{ minWidth: 320 }}>
                                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Enter Good & Rejected Qty:</div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    {qcEdit.rows.map((r) => {
                                      const good = Number(r.goodQtyInput || 0);
                                      const bad = Number(r.rejectedQtyInput || 0);
                                      const total = good + bad;
                                      const isOverDelivery = total > r.maxQty;

                                      return (
                                        <div key={r.rowId} style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                          <div style={{ flex: 1, fontSize: 12 }}>
                                            <b>{r.item_code}</b>
                                            <div style={{ opacity: 0.75 }}>Ord: {r.orderedQty}</div>
                                          </div>
                                          
                                          <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                                            <label style={{fontSize:9, opacity:0.7}}>Good</label>
                                            <input
                                              type="number"
                                              className="qc-inline-input"
                                              style={{ width: 70, borderColor: "green" }}
                                              value={r.goodQtyInput}
                                              onChange={(e) => updateQcRowQty(r.rowId, e.target.value)}
                                            />
                                          </div>

                                          <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                                            <label style={{fontSize:9, opacity:0.7}}>Rejected</label>
                                            <input
                                              type="number"
                                              className="qc-inline-input"
                                              style={{ width: 70, borderColor: "red", backgroundColor: "#fff0f0" }}
                                              value={r.rejectedQtyInput}
                                              onChange={(e) => updateQcRowRejected(r.rowId, e.target.value)}
                                            />
                                          </div>

                                          <div style={{fontSize: 11, width: 40, textAlign:'right', color: isOverDelivery ? 'orange' : 'inherit'}}>
                                            = {total}
                                          </div>
                                        </div>
                                      );
                                    })}

                                  </div>
                                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                    <button onClick={confirmQcPass} disabled={isQcPassing} className="btn btn-outline btn-xs">{isQcPassing ? "Receiving..." : "Receive"}</button>
                                    <button onClick={cancelQcPass} className="btn btn-ghost btn-xs">Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <button onClick={() => startQcPass(po)} disabled={isQcPassing || isQcFailing} className="btn btn-outline btn-xs">{isQcPassing ? "Loading QC..." : "QC Pass & Receive"}</button>
                                  <button onClick={() => handleQcFail(po)} disabled={isQcPassing || isQcFailing} className="btn btn-danger btn-xs">{isQcFailing ? "Marking Fail..." : "QC Fail"}</button>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="po-actions-stack">
                              {!isFullyBilled && (
                                <button 
                                  onClick={() => setAdvancePayModal({ po, amount: "", mode: "Bank" })}
                                  className="btn btn-ghost btn-xs"
                                  style={{marginBottom: 4, color: "#007bff"}}
                                  disabled={isAdvancePaying}
                                >
                                  {isAdvancePaying ? "Paying..." : "+ Advance Pay"}
                                </button>
                              )}

                              {isFullyBilled ? (
                                 <button 
                                    onClick={() => handlePayAndClose(po)} 
                                    disabled={isPaying} 
                                    className="btn btn-success btn-xs"
                                 >
                                    {isPaying ? "Processing..." : "Pay & Close"}
                                 </button>
                              ) : (
                                <>
                                  {draftPiName ? (
                                    <button onClick={() => handleSubmitDraftInvoice(po)} disabled={isSubmittingInvoice} className="btn btn-accent btn-xs">{isSubmittingInvoice ? "Submitting..." : `Submit Invoice (${draftPiName})`}</button>
                                  ) : (
                                    <div className="po-actions-stack">
                                      <button onClick={() => handleCreateInvoice(po)} disabled={isInvoicing || isUploading} className="btn btn-accent btn-xs">{isInvoicing ? "Creating..." : "Create Invoice"}</button>
                                      <button onClick={() => startUploadInvoice(po)} disabled={isInvoicing || isUploading} className="btn btn-outline btn-xs">{isUploading ? "Uploading..." : "Upload Invoice"}</button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          {isDraft ? (
                            <select value={po.custom_transporter || ""} disabled={transporterUpdating === po.name} onChange={async (e) => { const t = e.target.value; setTransporterUpdating(po.name); setError(""); setMessage(""); try { await setPurchaseOrderTransporter(po.name, t); setMessage(`Transporter updated for ${po.name}`); await loadOrders(page, mfFilter); } catch (err) { console.error(err); setError(err.message || "Failed to update transporter"); } finally { setTransporterUpdating(""); } }}>
                              <option value="">-- None --</option>
                              {transporters.map((t) => (
                                <option key={t.name} value={t.name}>{t.transporter_name || t.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span>{po.custom_transporter ? (transporterNameMap.get(po.custom_transporter) || po.custom_transporter) : "—"}</span>
                          )}
                        </td>
                        <td>
                          <select
                            value={po[MF_PO_FIELDS.status] || ""}
                            onChange={(e) => handleMfStatusChange(po, e.target.value)}
                            disabled={mfUpdating === po.name}
                          >
                            {statusOptions.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>{po[MF_PO_FIELDS.updatedOn] || ""}</div>
                        </td>
                        <td>{po[MF_PO_FIELDS.stockPercent] != null && po[MF_PO_FIELDS.stockPercent] !== "" ? `${Number(po[MF_PO_FIELDS.stockPercent]).toFixed(2)}%` : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ✅ ADVANCE PAYMENT MODAL */}
      {advancePayModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 400 }}>
            <h3>Record Advance Payment</h3>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 15 }}>
              For PO: <b>{advancePayModal.po.name}</b><br/>
              Supplier: {advancePayModal.po.supplier}<br/>
              Grand Total: {advancePayModal.po.grand_total}
            </p>

            <div className="po-field">
              <label className="po-label">Amount</label>
              <input 
                type="number" 
                className="po-input" 
                value={advancePayModal.amount} 
                onChange={(e) => setAdvancePayModal({...advancePayModal, amount: e.target.value})} 
                placeholder="Enter amount"
                autoFocus
              />
            </div>

            <div className="po-field">
              <label className="po-label">Mode</label>
              <select 
                className="po-input" 
                value={advancePayModal.mode} 
                onChange={(e) => setAdvancePayModal({...advancePayModal, mode: e.target.value})}
              >
                <option value="Bank">Bank Transfer / UPI</option>
                <option value="Cash">Cash</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setAdvancePayModal(null)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleAdvancePayment}
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default PurchaseOrderList;