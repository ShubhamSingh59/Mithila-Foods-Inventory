//// src/Components/PurchaseOrderList.jsx
//import React, { useEffect, useState } from "react";
//import {
//  getDoctypeList,
//  createDoc,
//  submitDoc,
//  getPurchaseOrderWithItems,
//  getDoc,
//  createPaymentEntryForPurchaseInvoice,
//  cancelPurchaseOrder,
//  setPurchaseOrderStatus,
//  setPurchaseOrderMfStatus,
//  MF_PO_FIELDS,
//  MF_STATUS_OPTIONS,
//} from "./erpBackendApi";

//import "../CSS/PurchaseOrderList.css";

//const PAGE_SIZE = 20;
//const ACCEPTED_WAREHOUSE = "Raw Material - MF";        // good stock
//const REJECTED_WAREHOUSE = "Rejected Warehouse - MF";  // bad stock

//function PurchaseOrderList({ onEditPo }) {
//  const [orders, setOrders] = useState([]);
//  const [page, setPage] = useState(0);
//  const [hasMore, setHasMore] = useState(false);
//  const [loading, setLoading] = useState(false);

//  const [qcPassLoading, setQcPassLoading] = useState("");
//  const [qcFailLoading, setQcFailLoading] = useState("");
//  const [invoiceLoading, setInvoiceLoading] = useState("");
//  const [submitPoLoading, setSubmitPoLoading] = useState("");

//  // which PO is currently in “QC good qty” edit mode
//  // { poName, maxQty, qtyInput, poDoc, poItem }
//  const [qcEdit, setQcEdit] = useState(null);

//  // per-PO info after PR: { [poName]: { prName, allGood } }
//  const [receivedPO, setReceivedPO] = useState({});

//  const [error, setError] = useState("");
//  const [message, setMessage] = useState("");

//  const [mfUpdating, setMfUpdating] = useState("");

//  async function handleMfStatusChange(po, newStatus) {
//    if (!newStatus) return;
//    setError(""); setMessage("");
//    setMfUpdating(po.name);
//    try {
//      await setPurchaseOrderMfStatus(po.name, newStatus);
//      setMessage(`MF Status updated for ${po.name}: ${newStatus}`);
//      await loadOrders(page);
//    } catch (err) {
//      console.error(err);
//      setError(err.response?.data?.error?.message || err.message || "MF status update failed");
//    } finally {
//      setMfUpdating("");
//    }
//  }

//  // -------- LOAD POs --------
//  async function loadOrders(pageIndex = 0) {
//    setLoading(true);
//    setError("");
//    setMessage("");

//    try {
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
//          MF_PO_FIELDS.status,
//          MF_PO_FIELDS.updatedOn,
//          MF_PO_FIELDS.stockPercent,

//        ]),
//        filters: JSON.stringify([
//          [
//            "Purchase Order",
//            "status",
//            "in",
//            ["Draft", "To Receive and Bill", "To Receive", "To Bill"],
//          ],
//        ]),
//        limit_page_length: PAGE_SIZE + 1,
//        limit_start: pageIndex * PAGE_SIZE,
//      });

//      // hide fully completed POs (100% received & billed)
//      data = data.filter((row) => {
//        const r = Number(row.per_received || 0);
//        const b = Number(row.per_billed || 0);
//        return !(r >= 100 && b >= 100);
//      });

//      setHasMore(data.length > PAGE_SIZE);
//      setOrders(data.slice(0, PAGE_SIZE));
//      setPage(pageIndex);
//      setQcEdit(null); // reset any QC inline edit when page reloads
//    } catch (err) {
//      console.error(err);
//      setError(err.message || "Failed to load Purchase Orders");
//    } finally {
//      setLoading(false);
//    }
//  }

//  useEffect(() => {
//    loadOrders(0);
//  }, []);

//  // ------------- QC PASS with inline good qty input -------------

//  // Step 1: user clicks “QC Pass & Receive” → load PO + open inline editor
//  async function startQcPass(po) {
//    setError("");
//    setMessage("");
//    setQcPassLoading(po.name);

//    try {
//      const poDoc = await getPurchaseOrderWithItems(po.name);
//      const poItems = poDoc.items || [];
//      if (!poItems.length) {
//        throw new Error("Purchase Order has no items to receive");
//      }

//      // For now we handle single-line PO
//      const first = poItems[0];

//      // Use remaining qty, not total ordered
//      const orderedQty = Number(first.qty || 0);
//      const alreadyReceived = Number(first.received_qty || 0);
//      const remainingQty = orderedQty - alreadyReceived;

//      if (remainingQty <= 0) {
//        throw new Error(
//          `All quantity already received for this Purchase Order item.`
//        );
//      }

//      setQcEdit({
//        poName: po.name,
//        poDoc,
//        poItem: first,
//        maxQty: remainingQty, // remaining, not total
//        qtyInput: String(remainingQty), // default: full remaining as good
//      });
//      setMessage(
//        `Enter good quantity for PO ${po.name} (remaining ${remainingQty}).`
//      );
//    } catch (err) {
//      console.error(err);
//      setError(
//        err.response?.data?.error?.message ||
//        err.message ||
//        "Failed to load Purchase Order for QC"
//      );
//    } finally {
//      setQcPassLoading("");
//    }
//  }

//  // Step 2: user confirms “Receive” with good quantity
//  async function confirmQcPass() {
//    if (!qcEdit) return;

//    const { poName, poDoc, poItem, maxQty, qtyInput } = qcEdit;

//    setError("");
//    setMessage("");
//    setQcPassLoading(poName);

//    try {
//      const goodQty = Number(qtyInput);

//      if (isNaN(goodQty) || goodQty < 0 || goodQty > maxQty) {
//        throw new Error(
//          `Invalid quantity. Please enter a number between 0 and ${maxQty}.`
//        );
//      }

//      const badQty = maxQty - goodQty;
//      const receivedQty = goodQty + badQty; // total for this PR row

//      // flag: did we accept the entire remaining quantity with zero reject?
//      const allGoodThisRound = badQty === 0 && goodQty === maxQty;

//      if (receivedQty <= 0) {
//        setMessage("No quantity to receive.");
//        setQcEdit(null);
//        setQcPassLoading("");
//        return;
//      }

//      const today = new Date().toISOString().slice(0, 10);

//      // ERPNext rule: Received Qty must equal Accepted + Rejected.
//      // Note: "qty" is the accepted quantity; amount is based on it.
//      const items = [
//        {
//          item_code: poItem.item_code,

//          qty: goodQty, // accepted into main warehouse
//          received_qty: receivedQty,
//          accepted_qty: goodQty,
//          rejected_qty: badQty,

//          warehouse: ACCEPTED_WAREHOUSE, // good stock warehouse

//          ...(badQty > 0
//            ? { rejected_warehouse: REJECTED_WAREHOUSE } // bad stock
//            : {}),

//          rate: poItem.rate,

//          // Link back to PO row
//          purchase_order: poDoc.name,
//          purchase_order_item: poItem.name,
//        },
//      ];

//      const prPayload = {
//        doctype: "Purchase Receipt",
//        supplier: poDoc.supplier,
//        company: poDoc.company,
//        posting_date: today,
//        purchase_order: poDoc.name,
//        items,
//      };

//      // Create & submit PR
//      const prDoc = await createDoc("Purchase Receipt", prPayload);
//      const prName = prDoc.data?.name;
//      if (prName) {
//        await submitDoc("Purchase Receipt", prName);
//      }

//      const percent = maxQty > 0 ? Math.round((goodQty / maxQty) * 10000) / 100 : 0;
//      // store PR + whether everything was accepted as good
//      setReceivedPO((prev) => ({
//        ...prev,
//        [poName]: { prName: prName || null, allGood: allGoodThisRound, stockPercent: percent },
//      }));

//      await setPurchaseOrderMfStatus(poName, "QC In", { stockPercent: percent });

//      setMessage(
//        prName
//          ? `QC PASS: PR ${prName} created from ${poName} (good ${goodQty}, bad ${badQty}).`
//          : `QC PASS: PR (draft) created from ${poName} (good ${goodQty}, bad ${badQty}).`
//      );

//      setQcEdit(null);
//      await loadOrders(page);
//    } catch (err) {
//      console.error(err);
//      setError(
//        err.response?.data?.error?.message ||
//        err.message ||
//        "Failed to create Purchase Receipt"
//      );
//    } finally {
//      setQcPassLoading("");
//    }
//  }

//  function cancelQcPass() {
//    setQcEdit(null);
//    setMessage("");
//  }

//  // ---------------------- QC FAIL ----------------------
//  async function handleQcFail(po) {
//    setError("");
//    setMessage("");
//    setQcFailLoading(po.name);

//    try {
//      await setPurchaseOrderMfStatus(po.name, "Cancelled");
//      await cancelPurchaseOrder(po.name);

//      setMessage(
//        `QC marked as FAIL. Purchase Order ${po.name} has been cancelled.`
//      );

//      await loadOrders(page);
//    } catch (err) {
//      console.error(err);
//      setError(
//        err.response?.data?.error?.message ||
//        err.message ||
//        "Failed to cancel Purchase Order"
//      );
//    } finally {
//      setQcFailLoading("");
//    }
//  }

//  // ----------------- Submit PO from list (Draft) -----------------
//  async function handleSubmitPoFromList(po) {
//    setError("");
//    setMessage("");
//    setSubmitPoLoading(po.name);

//    try {
//      await submitDoc("Purchase Order", po.name);
//      setMessage(`Purchase Order submitted: ${po.name}`);
//      await loadOrders(page);
//    } catch (err) {
//      console.error(err);
//      setError(
//        err.response?.data?.error?.message ||
//        err.message ||
//        "Failed to submit Purchase Order"
//      );
//    } finally {
//      setSubmitPoLoading("");
//    }
//  }

//  // ---------------------- Invoice creation ----------------------
//  async function handleCreateInvoice(po) {
//    setError("");
//    setMessage("");
//    setInvoiceLoading(po.name);

//    try {
//      const poDoc = await getPurchaseOrderWithItems(po.name);
//      const poItems = poDoc.items || [];
//      if (!poItems.length) {
//        throw new Error("Purchase Order has no items for invoice");
//      }

//      const today = new Date().toISOString().slice(0, 10);

//      const receivedInfo = receivedPO[po.name] || {};
//      const sessionPrName = receivedInfo.prName || null;
//      // if we don't know (e.g. PR manually in ERP), assume all good
//      const allGood = receivedInfo.allGood !== undefined
//        ? receivedInfo.allGood
//        : true;

//      const piPayload = {
//        doctype: "Purchase Invoice",
//        supplier: poDoc.supplier,
//        company: poDoc.company,
//        posting_date: today,
//        purchase_order: poDoc.name,
//        items: poItems.map((it) => ({
//          item_code: it.item_code,
//          qty: it.qty, // still invoicing full ordered qty (your current behaviour)
//          rate: it.rate,
//          purchase_order: poDoc.name,
//          po_detail: it.name,
//          ...(sessionPrName ? { purchase_receipt: sessionPrName } : {}),
//        })),
//      };

//      const piDoc = await createDoc("Purchase Invoice", piPayload);
//      const piName = piDoc.data?.name;

//      if (piName) {
//        // submit PI
//        await submitDoc("Purchase Invoice", piName);
//        const fullPi = await getDoc("Purchase Invoice", piName);

//        // create & submit Payment Entry
//        await createPaymentEntryForPurchaseInvoice(fullPi);

//        // 🎯 After payment, set PO status:
//        // - if whole remaining qty received as good → "Completed"
//        // - if partial good (some rejected)       → "Closed"
//        const statusToSet = allGood ? "Completed" : "Closed";
//        await setPurchaseOrderStatus(poDoc.name, statusToSet);
//        // ✅ Always mark MF as Completed after invoice is paid (no matter partial/complete)
//        const percent =
//          po?.[MF_PO_FIELDS.stockPercent] != null && po?.[MF_PO_FIELDS.stockPercent] !== ""
//            ? Number(po[MF_PO_FIELDS.stockPercent])              // from ERP (works after refresh)
//            : receivedPO?.[po.name]?.stockPercent;               // fallback (same session)

//        await setPurchaseOrderMfStatus(poDoc.name, "Completed", { stockPercent: percent });


//      }

//      setMessage(
//        piName
//          ? `Purchase Invoice created, submitted, PAID and PO updated: ${piName}.`
//          : `Purchase Invoice created from ${po.name}`
//      );

//      await loadOrders(page);
//    } catch (err) {
//      console.error(err);
//      setError(
//        err.response?.data?.error?.message ||
//        err.message ||
//        "Failed to create / pay Purchase Invoice"
//      );
//    } finally {
//      setInvoiceLoading("");
//    }
//  }

//  function handlePrevPage() {
//    if (page === 0 || loading) return;
//    loadOrders(page - 1);
//  }

//  function handleNextPage() {
//    if (!hasMore || loading) return;
//    loadOrders(page + 1);
//  }

//  return (
//    <div className="po-list">
//      <div className="po-list-header">
//        <div className="po-list-title-block">
//          <h3 className="po-list-title">Recent Purchase Orders</h3>
//          <p className="po-list-subtitle">
//            Draft → QC (good &amp; bad) → Receipt → Invoice (Paid)
//          </p>
//        </div>
//        <div className="po-list-pill">
//          Page {page + 1} · {orders.length} open PO
//          {orders.length !== 1 ? "s" : ""}
//        </div>
//      </div>

//      {loading && (
//        <p className="po-list-loading text-muted">
//          Loading purchase orders...
//        </p>
//      )}
//      {error && <p className="alert alert-error">{error}</p>}
//      {message && <p className="alert alert-success">{message}</p>}

//      {!loading && !error && (
//        <>
//          {orders.length === 0 ? (
//            <p className="po-list-empty text-muted">
//              No Purchase Orders to process.
//            </p>
//          ) : (
//            <div className="po-list-table-wrapper">
//              <table className="po-list-table">
//                <thead>
//                  <tr>
//                    <th>Name</th>
//                    <th>Supplier</th>
//                    <th>Company</th>
//                    <th>Date</th>
//                    <th>Status</th>
//                    <th>Grand Total</th>
//                    <th>Actions</th>
//                    <th>MF Status</th>
//                    <th>% Stock In</th>

//                  </tr>
//                </thead>
//                <tbody>
//                  {orders.map((po) => {
//                    const perReceived = Number(po.per_received || 0);

//                    // if anything received, invoice should be available (even after refresh)
//                    const receivedFromErp = perReceived > 0;

//                    // extra safety: if MF already says QC In / Completed
//                    const mf = po[MF_PO_FIELDS.status];
//                    const receivedFromMf = mf === "QC In" || mf === "Completed";

//                    const isReceived = receivedFromErp || receivedFromMf;


//                    const isQcPassing = qcPassLoading === po.name;
//                    const isQcFailing = qcFailLoading === po.name;
//                    const isInvoicing = invoiceLoading === po.name;
//                    const isSubmittingPo = submitPoLoading === po.name;
//                    const isDraft = po.status === "Draft";

//                    const isThisQcEdit =
//                      qcEdit && qcEdit.poName === po.name;

//                    return (
//                      <tr key={po.name}>
//                        <td className="po-cell-name">{po.name}</td>
//                        <td>{po.supplier}</td>
//                        <td>{po.company}</td>
//                        <td>{po.transaction_date}</td>
//                        <td>{po.status}</td>
//                        <td className="po-cell-money">{po.grand_total}</td>
//                        <td className="po-cell-actions">
//                          {isDraft ? (
//                            <div className="po-actions-stack">
//                              <button
//                                onClick={() =>
//                                  onEditPo && onEditPo(po.name)
//                                }
//                                className="btn btn-outline btn-xs"
//                              >
//                                Edit Draft
//                              </button>
//                              <button
//                                onClick={() =>
//                                  handleSubmitPoFromList(po)
//                                }
//                                disabled={isSubmittingPo}
//                                className="btn btn-primary btn-xs"
//                              >
//                                {isSubmittingPo
//                                  ? "Submitting..."
//                                  : "Submit"}
//                              </button>
//                            </div>
//                          ) : !isReceived ? (
//                            <div className="po-actions-stack">
//                              {isThisQcEdit ? (
//                                <div className="qc-inline">
//                                  <span className="qc-inline-label">
//                                    Good Qty (of {qcEdit.maxQty}):
//                                  </span>
//                                  <input
//                                    type="number"
//                                    className="qc-inline-input"
//                                    value={qcEdit.qtyInput}
//                                    onChange={(e) =>
//                                      setQcEdit((prev) =>
//                                        prev
//                                          ? {
//                                            ...prev,
//                                            qtyInput:
//                                              e.target.value,
//                                          }
//                                          : prev
//                                      )
//                                    }
//                                  />
//                                  <button
//                                    onClick={confirmQcPass}
//                                    disabled={isQcPassing}
//                                    className="btn btn-outline btn-xs"
//                                  >
//                                    {isQcPassing
//                                      ? "Receiving..."
//                                      : "Receive"}
//                                  </button>
//                                  <button
//                                    onClick={cancelQcPass}
//                                    className="btn btn-ghost btn-xs"
//                                  >
//                                    Cancel
//                                  </button>
//                                </div>
//                              ) : (
//                                <>
//                                  <button
//                                    onClick={() =>
//                                      startQcPass(po)
//                                    }
//                                    disabled={
//                                      isQcPassing || isQcFailing
//                                    }
//                                    className="btn btn-outline btn-xs"
//                                  >
//                                    {isQcPassing
//                                      ? "Loading QC..."
//                                      : "QC Pass & Receive"}
//                                  </button>
//                                  <button
//                                    onClick={() =>
//                                      handleQcFail(po)
//                                    }
//                                    disabled={
//                                      isQcPassing || isQcFailing
//                                    }
//                                    className="btn btn-danger btn-xs"
//                                  >
//                                    {isQcFailing
//                                      ? "Marking Fail..."
//                                      : "QC Fail"}
//                                  </button>
//                                </>
//                              )}
//                            </div>
//                          ) : (
//                            <button
//                              onClick={() =>
//                                handleCreateInvoice(po)
//                              }
//                              disabled={isInvoicing}
//                              className="btn btn-accent btn-xs"
//                            >
//                              {isInvoicing
//                                ? "Creating Invoice..."
//                                : "Create Invoice (Paid)"}
//                            </button>
//                          )}
//                        </td>
//                        <td>
//                          <select
//                            value={po[MF_PO_FIELDS.status] || ""}
//                            onChange={(e) => handleMfStatusChange(po, e.target.value)}
//                            disabled={mfUpdating === po.name}
//                          >
//                            <option value="">--</option>
//                            {MF_STATUS_OPTIONS.map((s) => (
//                              <option key={s} value={s}>{s}</option>
//                            ))}
//                          </select>

//                          <div style={{ fontSize: 12, opacity: 0.7 }}>
//                            {po[MF_PO_FIELDS.updatedOn] || ""}
//                          </div>
//                        </td>

//                        <td>
//                          {po[MF_PO_FIELDS.stockPercent] != null && po[MF_PO_FIELDS.stockPercent] !== ""
//                            ? `${Number(po[MF_PO_FIELDS.stockPercent]).toFixed(2)}%`
//                            : ""}
//                        </td>

//                      </tr>
//                    );
//                  })}
//                </tbody>
//              </table>
//            </div>
//          )}

//          <div className="po-list-pagination">
//            <button
//              onClick={handlePrevPage}
//              disabled={page === 0 || loading}
//              className="page-btn"
//            >
//              ◀ Previous
//            </button>
//            <span className="po-list-page-text">
//              Page {page + 1}
//            </span>
//            <button
//              onClick={handleNextPage}
//              disabled={!hasMore || loading}
//              className="page-btn"
//            >
//              Next ▶
//            </button>
//          </div>
//        </>
//      )}
//    </div>
//  );
//}

//export default PurchaseOrderList;

// ✅ src/Components/PurchaseOrderList.jsx  (FULL UPDATED FILE)
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getDoctypeList,
  createDoc,
  submitDoc,
  getPurchaseOrderWithItems,
  getDoc,
  createPaymentEntryForPurchaseInvoice,
  cancelPurchaseOrder,
  setPurchaseOrderStatus,
  setPurchaseOrderMfStatus,
  MF_PO_FIELDS,
  MF_STATUS_OPTIONS,
  uploadFileToDoc,
  closePurchaseOrder, // ✅ make sure this export exists in erpBackendApi.js (we added earlier)
  mapLimit, // ✅ already in your erpBackendApi.js at bottom
} from "./erpBackendApi";

import "../CSS/PurchaseOrderList.css";

const PAGE_SIZE = 20;
const ACCEPTED_WAREHOUSE = "Raw Material - MF";
const REJECTED_WAREHOUSE = "Rejected Warehouse - MF";

function round2(n) {
  const x = Number(n);
  if (isNaN(x)) return 0;
  return Math.round(x * 100) / 100;
}

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

function PurchaseOrderList({ onEditPo }) {
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const [qcPassLoading, setQcPassLoading] = useState("");
  const [qcFailLoading, setQcFailLoading] = useState("");
  const [invoiceLoading, setInvoiceLoading] = useState("");
  const [submitPoLoading, setSubmitPoLoading] = useState("");

  // ✅ MF filter
  const [mfFilter, setMfFilter] = useState("");

  // QC edit state (MULTI ITEM)
  // { poName, poDoc, rows:[{rowId, item_code, item_name, maxQty, goodQtyInput}] }
  const [qcEdit, setQcEdit] = useState(null);

  // per-PO info after PR: { [poName]: { prName, allGood, stockPercent } }
  const [receivedPO, setReceivedPO] = useState({});

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [mfUpdating, setMfUpdating] = useState("");

  // ✅ Items shown in list
  const [poItemsSummary, setPoItemsSummary] = useState({}); // { [poName]: "ITEM-1 (Name), ..." }

  // ✅ Upload Invoice states
  const uploadInputRef = useRef(null);
  const [uploadTargetPo, setUploadTargetPo] = useState(null);
  const [uploadInvoiceLoading, setUploadInvoiceLoading] = useState("");

  // After upload, show ONLY "Submit Invoice"
  const [draftPiByPo, setDraftPiByPo] = useState({}); // { [poName]: piName }
  const [submitInvLoading, setSubmitInvLoading] = useState("");

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

  // ✅ Hydrate items for list display (per-page only)
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
      // ignore
    }
  }

  // -------- LOAD POs --------
  async function loadOrders(pageIndex = 0, mfStatus = "") {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const baseFilters = [
        ["Purchase Order", "status", "in", ["Draft", "To Receive and Bill", "To Receive", "To Bill"]],
      ];

      // ✅ MF filter (server-side)
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
          "per_received",
          "per_billed",
          "creation", // ✅ for stable ordering
          MF_PO_FIELDS.status,
          MF_PO_FIELDS.updatedOn,
          MF_PO_FIELDS.stockPercent,
        ]),
        filters: JSON.stringify(baseFilters),
        // ✅ IMPORTANT:
        // - order by creation desc (stable; does not change on actions like modified would)
        // - then we reverse in UI so latest appears at the END as you want
        order_by: "creation desc",
        limit_page_length: PAGE_SIZE + 1,
        limit_start: pageIndex * PAGE_SIZE,
      });

      // hide fully completed (100% received & billed)
      data = data.filter((row) => {
        const r = Number(row.per_received || 0);
        const b = Number(row.per_billed || 0);
        return !(r >= 100 && b >= 100);
      });

      const pageRows = data.slice(0, PAGE_SIZE);

      // ✅ reverse so "latest PO is at the end"
      const displayRows = [...pageRows].reverse();

      setHasMore(data.length > PAGE_SIZE);
      setOrders(displayRows);
      setPage(pageIndex);
      setQcEdit(null);

      // ✅ load item names for visible rows
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ MF Filter change
  async function onMfFilterChange(v) {
    setMfFilter(v);
    await loadOrders(0, v);
  }

  // ---------------- QC PASS (MULTI ITEM) ----------------
  async function startQcPass(po) {
    setError("");
    setMessage("");
    setQcPassLoading(po.name);

    try {
      const poDoc = await getPurchaseOrderWithItems(po.name);
      const poItems = poDoc.items || [];
      if (!poItems.length) throw new Error("Purchase Order has no items to receive");

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
            maxQty: remaining,
            goodQtyInput: String(remaining), // default accept all remaining as good
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

  function updateQcRowQty(rowId, value) {
    setQcEdit((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map((r) => (r.rowId === rowId ? { ...r, goodQtyInput: value } : r)),
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
      // validate + compute totals
      let totalRemaining = 0;
      let totalGood = 0;

      const prItems = [];

      for (const r of rows) {
        const goodQty = Number(r.goodQtyInput);
        const maxQty = Number(r.maxQty || 0);

        if (isNaN(goodQty) || goodQty < 0 || goodQty > maxQty) {
          throw new Error(
            `Invalid qty for ${r.item_code}. Enter 0 to ${maxQty}.`
          );
        }

        const badQty = maxQty - goodQty;
        const receivedQty = goodQty + badQty; // should equal maxQty

        totalRemaining += maxQty;
        totalGood += goodQty;

        // if nothing received for a line, skip
        if (receivedQty <= 0) continue;

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

      const allGoodThisRound = totalRemaining > 0 && totalGood === totalRemaining;
      const percent = totalRemaining > 0 ? round2((totalGood / totalRemaining) * 100) : 0;

      const today = new Date().toISOString().slice(0, 10);

      const prPayload = {
        doctype: "Purchase Receipt",
        supplier: poDoc.supplier,
        company: poDoc.company,
        posting_date: today,
        purchase_order: poDoc.name,
        items: prItems,
      };

      const prDoc = await createDoc("Purchase Receipt", prPayload);
      const prName = prDoc.data?.name;
      if (prName) await submitDoc("Purchase Receipt", prName);

      setReceivedPO((prev) => ({
        ...prev,
        [poName]: { prName: prName || null, allGood: allGoodThisRound, stockPercent: percent },
      }));

      await setPurchaseOrderMfStatus(poName, "QC In", { stockPercent: percent });

      setMessage(
        prName
          ? `QC PASS: PR ${prName} created from ${poName} (good ${round2(totalGood)}, total ${round2(totalRemaining)}).`
          : `QC PASS: PR created from ${poName}.`
      );

      setQcEdit(null);
      await loadOrders(page, mfFilter);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || err.message || "Failed to create Purchase Receipt");
    } finally {
      setQcPassLoading("");
    }
  }

  function cancelQcPass() {
    setQcEdit(null);
    setMessage("");
  }

  // ---------------- QC FAIL ----------------
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
  async function handleCreateInvoice(po) {
    setError("");
    setMessage("");
    setInvoiceLoading(po.name);

    try {
      const poDoc = await getPurchaseOrderWithItems(po.name);
      const poItems = poDoc.items || [];
      if (!poItems.length) throw new Error("Purchase Order has no items for invoice");

      const today = new Date().toISOString().slice(0, 10);

      const receivedInfo = receivedPO[po.name] || {};
      const sessionPrName = receivedInfo.prName || null;
      const allGood = receivedInfo.allGood !== undefined ? receivedInfo.allGood : true;

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

      if (piName) {
        await submitDoc("Purchase Invoice", piName);
        const fullPi = await getDoc("Purchase Invoice", piName);

        await createPaymentEntryForPurchaseInvoice(fullPi);

        const statusToSet = allGood ? "Completed" : "Closed";
        await setPurchaseOrderStatus(poDoc.name, statusToSet);

        if (!allGood) {
          try {
            await closePurchaseOrder(poDoc.name);
          } catch (e) { }
        }

        const percent =
          po?.[MF_PO_FIELDS.stockPercent] != null && po?.[MF_PO_FIELDS.stockPercent] !== ""
            ? Number(po[MF_PO_FIELDS.stockPercent])
            : receivedPO?.[po.name]?.stockPercent;

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
  function startUploadInvoice(po) {
    setError("");
    setMessage("");
    setUploadTargetPo(po);
    uploadInputRef.current?.click();
  }

  async function onInvoicePdfPicked(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !uploadTargetPo) return;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("Please select a PDF file.");
      setUploadTargetPo(null);
      return;
    }

    await handleUploadInvoice(uploadTargetPo, file);
    setUploadTargetPo(null);
  }

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

      await uploadFileToDoc({
        doctype: "Purchase Invoice",
        docname: piName,
        file: pdfFile,
        is_private: 1,
      });

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
  async function handleSubmitDraftInvoice(po) {
    const piName = draftPiByPo[po.name];
    if (!piName) return;

    setError("");
    setMessage("");
    setSubmitInvLoading(po.name);

    try {
      const poDoc = await getPurchaseOrderWithItems(po.name);

      await submitDoc("Purchase Invoice", piName);

      const fullPi = await getDoc("Purchase Invoice", piName);
      await createPaymentEntryForPurchaseInvoice(fullPi);

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

      const statusToSet = allGood ? "Completed" : "Closed";
      await setPurchaseOrderStatus(poDoc.name, statusToSet);

      if (!allGood) {
        try {
          await closePurchaseOrder(poDoc.name);
        } catch (e) { }
      }

      const percent =
        po?.[MF_PO_FIELDS.stockPercent] != null && po?.[MF_PO_FIELDS.stockPercent] !== ""
          ? Number(po[MF_PO_FIELDS.stockPercent])
          : receivedPO?.[po.name]?.stockPercent;

      await setPurchaseOrderMfStatus(poDoc.name, "Completed", { stockPercent: percent });

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

  function handlePrevPage() {
    if (page === 0 || loading) return;
    loadOrders(page - 1, mfFilter);
  }

  function handleNextPage() {
    if (!hasMore || loading) return;
    loadOrders(page + 1, mfFilter);
  }

  return (
    <div className="po-list">
      {/* Hidden PDF input */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: "none" }}
        onChange={onInvoicePdfPicked}
      />

      <div className="po-list-header">
        <div className="po-list-title-block">
          <h3 className="po-list-title">Recent Purchase Orders</h3>
          <p className="po-list-subtitle">Process: Draft → QC (good &amp; bad) → Receipt → Invoice (Paid)</p>
        </div>

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

          <div className="po-list-pill">
            Page {page + 1} · {orders.length} open PO{orders.length !== 1 ? "s" : ""}
          </div>
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
                    <th>Items</th> {/* ✅ NEW */}
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
                  {orders.map((po) => {
                    const perReceived = Number(po.per_received || 0);
                    const receivedFromErp = perReceived > 0;

                    const mf = po[MF_PO_FIELDS.status];
                    const receivedFromMf = mf === "QC In" || mf === "Completed";
                    const isReceived = receivedFromErp || receivedFromMf;

                    const isQcPassing = qcPassLoading === po.name;
                    const isQcFailing = qcFailLoading === po.name;
                    const isInvoicing = invoiceLoading === po.name;
                    const isUploading = uploadInvoiceLoading === po.name;
                    const isSubmittingPo = submitPoLoading === po.name;

                    const isDraft = po.status === "Draft";
                    const isThisQcEdit = qcEdit && qcEdit.poName === po.name;

                    const draftPiName = draftPiByPo[po.name];
                    const isSubmittingInvoice = submitInvLoading === po.name;

                    return (
                      <tr key={po.name}>
                        <td className="po-cell-name">{po.name}</td>
                        <td>{po.supplier}</td>

                        {/* ✅ Items column */}
                        <td style={{ maxWidth: 420 }}>
                          <span style={{ fontSize: 12, opacity: 0.9 }}>
                            {poItemsSummary[po.name] || "—"}
                          </span>
                        </td>

                        <td>{po.company}</td>
                        <td>{po.transaction_date}</td>
                        <td>{po.status}</td>
                        <td className="po-cell-money">{po.grand_total}</td>

                        <td className="po-cell-actions">
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
                            <div className="po-actions-stack">
                              {isThisQcEdit ? (
                                <div className="qc-inline" style={{ minWidth: 320 }}>
                                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                                    Good Qty per item (remaining):
                                  </div>

                                  {/* ✅ MULTI ITEM inputs */}
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
                            <>
                              {draftPiName ? (
                                <button
                                  onClick={() => handleSubmitDraftInvoice(po)}
                                  disabled={isSubmittingInvoice}
                                  className="btn btn-accent btn-xs"
                                >
                                  {isSubmittingInvoice ? "Submitting..." : `Submit Invoice (${draftPiName})`}
                                </button>
                              ) : (
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

                          <div style={{ fontSize: 12, opacity: 0.7 }}>
                            {po[MF_PO_FIELDS.updatedOn] || ""}
                          </div>
                        </td>

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
