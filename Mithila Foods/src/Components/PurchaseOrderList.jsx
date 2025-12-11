////// src/Components/PurchaseOrderList.jsx
////import React, { useEffect, useState } from "react";
////import {
////  getDoctypeList,
////  createDoc,
////  submitDoc,
////  getPurchaseOrderWithItems,
////  getDoc,
////  createPaymentEntryForPurchaseInvoice,
////  cancelPurchaseOrder,
////} from "./erpBackendApi";

////import "../CSS/PurchaseOrderList.css";

////const PAGE_SIZE = 20;
////const DEFAULT_WAREHOUSE = "Raw Material - MF"; // good stock
////const DAMAGED_WAREHOUSE = "Damaged - MF";      // bad stock

////function PurchaseOrderList({ onEditPo }) {
////  const [orders, setOrders] = useState([]);
////  const [page, setPage] = useState(0);
////  const [hasMore, setHasMore] = useState(false);
////  const [loading, setLoading] = useState(false);

////  const [qcPassLoading, setQcPassLoading] = useState("");
////  const [qcFailLoading, setQcFailLoading] = useState("");
////  const [invoiceLoading, setInvoiceLoading] = useState("");
////  const [submitPoLoading, setSubmitPoLoading] = useState("");

////  // which PO is currently in “QC good qty” edit mode
////  // { poName, maxQty, qtyInput, poDoc, poItem }
////  const [qcEdit, setQcEdit] = useState(null);

////  const [receivedPO, setReceivedPO] = useState({});
////  const [error, setError] = useState("");
////  const [message, setMessage] = useState("");

////  // -------- LOAD POs --------
////  async function loadOrders(pageIndex = 0) {
////    setLoading(true);
////    setError("");
////    setMessage("");

////    try {
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
////        ]),
////        filters: JSON.stringify([
////          [
////            "Purchase Order",
////            "status",
////            "in",
////            ["Draft", "To Receive and Bill", "To Receive", "To Bill"],
////          ],
////        ]),
////        limit_page_length: PAGE_SIZE + 1,
////        limit_start: pageIndex * PAGE_SIZE,
////      });

////      // hide fully completed POs
////      data = data.filter((row) => {
////        const r = Number(row.per_received || 0);
////        const b = Number(row.per_billed || 0);
////        return !(r >= 100 && b >= 100);
////      });

////      setHasMore(data.length > PAGE_SIZE);
////      setOrders(data.slice(0, PAGE_SIZE));
////      setPage(pageIndex);
////      setQcEdit(null); // reset any QC inline edit when page reloads
////    } catch (err) {
////      console.error(err);
////      setError(err.message || "Failed to load Purchase Orders");
////    } finally {
////      setLoading(false);
////    }
////  }

////  useEffect(() => {
////    loadOrders(0);
////  }, []);

////  // ------------- QC PASS with inline good qty input -------------

////  // Step 1: user clicks “QC Pass & Receive” → load PO + open inline editor
////  async function startQcPass(po) {
////    setError("");
////    setMessage("");
////    setQcPassLoading(po.name);

////    try {
////      const poDoc = await getPurchaseOrderWithItems(po.name);
////      const poItems = poDoc.items || [];
////      if (!poItems.length) {
////        throw new Error("Purchase Order has no items to receive");
////      }

////      // 🧠 For now we handle single-line PO
////      const first = poItems[0];

////      // IMPORTANT: use remaining qty, not total ordered
////      const orderedQty = Number(first.qty || 0);
////      const alreadyReceived = Number(first.received_qty || 0);
////      const remainingQty = orderedQty - alreadyReceived;

////      if (remainingQty <= 0) {
////        throw new Error(
////          `All quantity already received for this Purchase Order item.`
////        );
////      }

////      setQcEdit({
////        poName: po.name,
////        poDoc,
////        poItem: first,
////        maxQty: remainingQty,             // remaining, not total
////        qtyInput: String(remainingQty),   // default to full remaining good
////      });
////      setMessage(`Enter good quantity for PO ${po.name} (remaining ${remainingQty}).`);
////    } catch (err) {
////      console.error(err);
////      setError(
////        err.response?.data?.error?.message ||
////          err.message ||
////          "Failed to load Purchase Order for QC"
////      );
////    } finally {
////      setQcPassLoading("");
////    }
////  }

////  // Step 2: user confirms “Receive” with good quantity
////  async function confirmQcPass() {
////    if (!qcEdit) return;

////    const { poName, poDoc, poItem, maxQty, qtyInput } = qcEdit;

////    setError("");
////    setMessage("");
////    setQcPassLoading(poName);

////    try {
////      const goodQty = Number(qtyInput);
////      if (isNaN(goodQty) || goodQty < 0 || goodQty > maxQty) {
////        throw new Error(
////          `Invalid quantity. Please enter a number between 0 and ${maxQty}.`
////        );
////      }

////      const badQty = maxQty - goodQty;
////      const totalThisReceipt = goodQty + badQty; // should equal maxQty

////      if (totalThisReceipt <= 0) {
////        setMessage("No quantity to receive.");
////        setQcEdit(null);
////        setQcPassLoading("");
////        return;
////      }

////      const today = new Date().toISOString().slice(0, 10);

////      // ✅ Single PR row, with proper received / accepted / rejected split
////      //    ERP rule: Received Qty = Accepted + Rejected
////      const items = [
////        {
////          item_code: poItem.item_code,

////          // These 3 must match the ERP validation:
////          qty: totalThisReceipt,              // stock / received qty
////          received_qty: totalThisReceipt,     // explicitly set "Received Qty"
////          accepted_qty: goodQty,
////          rejected_qty: badQty,

////          warehouse: DEFAULT_WAREHOUSE,       // good stock warehouse

////          // For any rejected quantity, ERP requires rejected_warehouse
////          ...(badQty > 0
////            ? { rejected_warehouse: DAMAGED_WAREHOUSE } // bad stock warehouse
////            : {}),

////          rate: poItem.rate,

////          // Link back to PO row
////          purchase_order: poDoc.name,
////          purchase_order_item: poItem.name,
////        },
////      ];

////      const prPayload = {
////        doctype: "Purchase Receipt",
////        supplier: poDoc.supplier,
////        company: poDoc.company,
////        posting_date: today,
////        purchase_order: poDoc.name,
////        items,
////      };

////      // Create & submit PR
////      const prDoc = await createDoc("Purchase Receipt", prPayload);
////      const prName = prDoc.data?.name;
////      if (prName) {
////        await submitDoc("Purchase Receipt", prName);
////      }

////      setReceivedPO((prev) => ({
////        ...prev,
////        [poName]: { prName: prName || null },
////      }));

////      setMessage(
////        prName
////          ? `QC PASS: PR ${prName} created from ${poName} (good ${goodQty}, bad ${badQty}).`
////          : `QC PASS: PR (draft) created from ${poName} (good ${goodQty}, bad ${badQty}).`
////      );

////      setQcEdit(null);
////      await loadOrders(page);
////    } catch (err) {
////      console.error(err);
////      setError(
////        err.response?.data?.error?.message ||
////          err.message ||
////          "Failed to create Purchase Receipt"
////      );
////    } finally {
////      setQcPassLoading("");
////    }
////  }

////  function cancelQcPass() {
////    setQcEdit(null);
////    setMessage("");
////  }

////  // ---------------------- QC FAIL ----------------------
////  async function handleQcFail(po) {
////    setError("");
////    setMessage("");
////    setQcFailLoading(po.name);

////    try {
////      await cancelPurchaseOrder(po.name);

////      setMessage(
////        `QC marked as FAIL. Purchase Order ${po.name} has been cancelled.`
////      );

////      await loadOrders(page);
////    } catch (err) {
////      console.error(err);
////      setError(
////        err.response?.data?.error?.message ||
////          err.message ||
////          "Failed to cancel Purchase Order"
////      );
////    } finally {
////      setQcFailLoading("");
////    }
////  }

////  // ----------------- Submit PO from list (Draft) -----------------
////  async function handleSubmitPoFromList(po) {
////    setError("");
////    setMessage("");
////    setSubmitPoLoading(po.name);

////    try {
////      await submitDoc("Purchase Order", po.name);
////      setMessage(`Purchase Order submitted: ${po.name}`);
////      await loadOrders(page);
////    } catch (err) {
////      console.error(err);
////      setError(
////        err.response?.data?.error?.message ||
////          err.message ||
////          "Failed to submit Purchase Order"
////      );
////    } finally {
////      setSubmitPoLoading("");
////    }
////  }

////  // ---------------------- Invoice creation ----------------------
////  async function handleCreateInvoice(po) {
////    setError("");
////    setMessage("");
////    setInvoiceLoading(po.name);

////    try {
////      const poDoc = await getPurchaseOrderWithItems(po.name);
////      const poItems = poDoc.items || [];
////      if (!poItems.length) {
////        throw new Error("Purchase Order has no items for invoice");
////      }

////      const today = new Date().toISOString().slice(0, 10);
////      const sessionPrName = receivedPO[po.name]?.prName || null;

////      const piPayload = {
////        doctype: "Purchase Invoice",
////        supplier: poDoc.supplier,
////        company: poDoc.company,
////        posting_date: today,
////        purchase_order: poDoc.name,
////        items: poItems.map((it) => ({
////          item_code: it.item_code,
////          qty: it.qty, // invoice for full ordered qty (your current requirement)
////          rate: it.rate,
////          purchase_order: poDoc.name,
////          po_detail: it.name,
////          ...(sessionPrName ? { purchase_receipt: sessionPrName } : {}),
////        })),
////      };

////      const piDoc = await createDoc("Purchase Invoice", piPayload);
////      const piName = piDoc.data?.name;

////      if (piName) {
////        await submitDoc("Purchase Invoice", piName);
////        const fullPi = await getDoc("Purchase Invoice", piName);
////        await createPaymentEntryForPurchaseInvoice(fullPi);
////      }

////      setMessage(
////        piName
////          ? `Purchase Invoice created, submitted and PAID from ${po.name}: ${piName}.`
////          : `Purchase Invoice created from ${po.name}`
////      );

////      await loadOrders(page);
////    } catch (err) {
////      console.error(err);
////      setError(
////        err.response?.data?.error?.message ||
////          err.message ||
////          "Failed to create / pay Purchase Invoice"
////      );
////    } finally {
////      setInvoiceLoading("");
////    }
////  }

////  function handlePrevPage() {
////    if (page === 0 || loading) return;
////    loadOrders(page - 1);
////  }

////  function handleNextPage() {
////    if (!hasMore || loading) return;
////    loadOrders(page + 1);
////  }

////  return (
////    <div className="po-list">
////      <div className="po-list-header">
////        <div className="po-list-title-block">
////          <h3 className="po-list-title">Recent Purchase Orders</h3>
////          <p className="po-list-subtitle">
////            Draft → QC (good & bad) → Receipt → Invoice (Paid)
////          </p>
////        </div>
////        <div className="po-list-pill">
////          Page {page + 1} · {orders.length} open PO
////          {orders.length !== 1 ? "s" : ""}
////        </div>
////      </div>

////      {loading && (
////        <p className="po-list-loading text-muted">
////          Loading purchase orders...
////        </p>
////      )}
////      {error && <p className="alert alert-error">{error}</p>}
////      {message && <p className="alert alert-success">{message}</p>}

////      {!loading && !error && (
////        <>
////          {orders.length === 0 ? (
////            <p className="po-list-empty text-muted">
////              No Purchase Orders to process.
////            </p>
////          ) : (
////            <div className="po-list-table-wrapper">
////              <table className="po-list-table">
////                <thead>
////                  <tr>
////                    <th>Name</th>
////                    <th>Supplier</th>
////                    <th>Company</th>
////                    <th>Date</th>
////                    <th>Status</th>
////                    <th>Grand Total</th>
////                    <th>Actions</th>
////                  </tr>
////                </thead>
////                <tbody>
////                  {orders.map((po) => {
////                    const receivedFromStatus = po.status === "To Bill";
////                    const receivedFromLocal = !!receivedPO[po.name];
////                    const isReceived = receivedFromStatus || receivedFromLocal;

////                    const isQcPassing = qcPassLoading === po.name;
////                    const isQcFailing = qcFailLoading === po.name;
////                    const isInvoicing = invoiceLoading === po.name;
////                    const isSubmittingPo = submitPoLoading === po.name;
////                    const isDraft = po.status === "Draft";

////                    const isThisQcEdit = qcEdit && qcEdit.poName === po.name;

////                    return (
////                      <tr key={po.name}>
////                        <td className="po-cell-name">{po.name}</td>
////                        <td>{po.supplier}</td>
////                        <td>{po.company}</td>
////                        <td>{po.transaction_date}</td>
////                        <td>{po.status}</td>
////                        <td className="po-cell-money">{po.grand_total}</td>
////                        <td className="po-cell-actions">
////                          {isDraft ? (
////                            <div className="po-actions-stack">
////                              <button
////                                onClick={() =>
////                                  onEditPo && onEditPo(po.name)
////                                }
////                                className="btn btn-outline btn-xs"
////                              >
////                                Edit Draft
////                              </button>
////                              <button
////                                onClick={() => handleSubmitPoFromList(po)}
////                                disabled={isSubmittingPo}
////                                className="btn btn-primary btn-xs"
////                              >
////                                {isSubmittingPo ? "Submitting..." : "Submit"}
////                              </button>
////                            </div>
////                          ) : !isReceived ? (
////                            <div className="po-actions-stack">
////                              {isThisQcEdit ? (
////                                <div className="qc-inline">
////                                  <span className="qc-inline-label">
////                                    Good Qty (of {qcEdit.maxQty}):
////                                  </span>
////                                  <input
////                                    type="number"
////                                    className="qc-inline-input"
////                                    value={qcEdit.qtyInput}
////                                    onChange={(e) =>
////                                      setQcEdit((prev) =>
////                                        prev
////                                          ? {
////                                              ...prev,
////                                              qtyInput: e.target.value,
////                                            }
////                                          : prev
////                                      )
////                                    }
////                                  />
////                                  <button
////                                    onClick={confirmQcPass}
////                                    disabled={isQcPassing}
////                                    className="btn btn-outline btn-xs"
////                                  >
////                                    {isQcPassing ? "Receiving..." : "Receive"}
////                                  </button>
////                                  <button
////                                    onClick={cancelQcPass}
////                                    className="btn btn-ghost btn-xs"
////                                  >
////                                    Cancel
////                                  </button>
////                                </div>
////                              ) : (
////                                <>
////                                  <button
////                                    onClick={() => startQcPass(po)}
////                                    disabled={isQcPassing || isQcFailing}
////                                    className="btn btn-outline btn-xs"
////                                  >
////                                    {isQcPassing
////                                      ? "Loading QC..."
////                                      : "QC Pass & Receive"}
////                                  </button>
////                                  <button
////                                    onClick={() => handleQcFail(po)}
////                                    disabled={isQcPassing || isQcFailing}
////                                    className="btn btn-danger btn-xs"
////                                  >
////                                    {isQcFailing ? "Marking Fail..." : "QC Fail"}
////                                  </button>
////                                </>
////                              )}
////                            </div>
////                          ) : (
////                            <button
////                              onClick={() => handleCreateInvoice(po)}
////                              disabled={isInvoicing}
////                              className="btn btn-accent btn-xs"
////                            >
////                              {isInvoicing
////                                ? "Creating Invoice..."
////                                : "Create Invoice (Paid)"}
////                            </button>
////                          )}
////                        </td>
////                      </tr>
////                    );
////                  })}
////                </tbody>
////              </table>
////            </div>
////          )}

////          <div className="po-list-pagination">
////            <button
////              onClick={handlePrevPage}
////              disabled={page === 0 || loading}
////              className="page-btn"
////            >
////              ◀ Previous
////            </button>
////            <span className="po-list-page-text">Page {page + 1}</span>
////            <button
////              onClick={handleNextPage}
////              disabled={!hasMore || loading}
////              className="page-btn"
////            >
////              Next ▶
////            </button>
////          </div>
////        </>
////      )}
////    </div>
////  );
////}

////export default PurchaseOrderList;


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
//  setPurchaseOrderStatus, // 👈 NEW import
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

//  const [receivedPO, setReceivedPO] = useState({});
//  const [error, setError] = useState("");
//  const [message, setMessage] = useState("");

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

//      // hide fully completed POs
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

//      // IMPORTANT: use remaining qty, not total ordered
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
//          err.message ||
//          "Failed to load Purchase Order for QC"
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

//      if (receivedQty <= 0) {
//        setMessage("No quantity to receive.");
//        setQcEdit(null);
//        setQcPassLoading("");
//        return;
//      }

//      const today = new Date().toISOString().slice(0, 10);

//      // 🔐 ERPNext rule (BuyingController.validate_accepted_rejected_qty):
//      //   received_qty  = qty + rejected_qty
//      // and amount is based on accepted (qty).
//      //
//      // So we set:
//      //   qty           = good (accepted) quantity
//      //   rejected_qty  = bad quantity
//      //   received_qty  = good + bad
//      //   accepted_qty  = good (for versions that use it)
//      const items = [
//        {
//          item_code: poItem.item_code,

//          qty: goodQty, // accepted into main warehouse
//          received_qty: receivedQty,
//          accepted_qty: goodQty,
//          rejected_qty: badQty,

//          warehouse: ACCEPTED_WAREHOUSE, // good stock warehouse

//          ...(badQty > 0
//            ? { rejected_warehouse: REJECTED_WAREHOUSE } // bad stock warehouse
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

//      setReceivedPO((prev) => ({
//        ...prev,
//        [poName]: { prName: prName || null },
//      }));

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
//          err.message ||
//          "Failed to create Purchase Receipt"
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
//      await cancelPurchaseOrder(po.name);

//      setMessage(
//        `QC marked as FAIL. Purchase Order ${po.name} has been cancelled.`
//      );

//      await loadOrders(page);
//    } catch (err) {
//      console.error(err);
//      setError(
//        err.response?.data?.error?.message ||
//          err.message ||
//          "Failed to cancel Purchase Order"
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
//          err.message ||
//          "Failed to submit Purchase Order"
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
//      const sessionPrName = receivedPO[po.name]?.prName || null;

//      const piPayload = {
//        doctype: "Purchase Invoice",
//        supplier: poDoc.supplier,
//        company: poDoc.company,
//        posting_date: today,
//        purchase_order: poDoc.name,
//        items: poItems.map((it) => ({
//          item_code: it.item_code,
//          qty: it.qty, // invoice for full ordered qty (your current requirement)
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

//        // 🔒 finally, CLOSE the Purchase Order so it disappears from the list
//        await setPurchaseOrderStatus(poDoc.name, "Closed");
//      }

//      setMessage(
//        piName
//          ? `Purchase Invoice created, submitted, PAID and PO closed: ${piName}.`
//          : `Purchase Invoice created from ${po.name}`
//      );

//      await loadOrders(page);
//    } catch (err) {
//      console.error(err);
//      setError(
//        err.response?.data?.error?.message ||
//          err.message ||
//          "Failed to create / pay Purchase Invoice"
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
//                  </tr>
//                </thead>
//                <tbody>
//                  {orders.map((po) => {
//                    const receivedFromStatus = po.status === "To Bill";
//                    const receivedFromLocal = !!receivedPO[po.name];
//                    const isReceived = receivedFromStatus || receivedFromLocal;

//                    const isQcPassing =
//                      qcPassLoading === po.name;
//                    const isQcFailing =
//                      qcFailLoading === po.name;
//                    const isInvoicing =
//                      invoiceLoading === po.name;
//                    const isSubmittingPo =
//                      submitPoLoading === po.name;
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
//                        <td className="po-cell-money">
//                          {po.grand_total}
//                        </td>
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
//                                              ...prev,
//                                              qtyInput:
//                                                e.target.value,
//                                            }
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

// src/Components/PurchaseOrderList.jsx
import React, { useEffect, useState } from "react";
import {
  getDoctypeList,
  createDoc,
  submitDoc,
  getPurchaseOrderWithItems,
  getDoc,
  createPaymentEntryForPurchaseInvoice,
  cancelPurchaseOrder,
  setPurchaseOrderStatus, // 👈 make sure this is exported from erpBackendApi.js
} from "./erpBackendApi";

import "../CSS/PurchaseOrderList.css";

const PAGE_SIZE = 20;
const ACCEPTED_WAREHOUSE = "Raw Material - MF";        // good stock
const REJECTED_WAREHOUSE = "Rejected Warehouse - MF";  // bad stock

function PurchaseOrderList({ onEditPo }) {
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const [qcPassLoading, setQcPassLoading] = useState("");
  const [qcFailLoading, setQcFailLoading] = useState("");
  const [invoiceLoading, setInvoiceLoading] = useState("");
  const [submitPoLoading, setSubmitPoLoading] = useState("");

  // which PO is currently in “QC good qty” edit mode
  // { poName, maxQty, qtyInput, poDoc, poItem }
  const [qcEdit, setQcEdit] = useState(null);

  // per-PO info after PR: { [poName]: { prName, allGood } }
  const [receivedPO, setReceivedPO] = useState({});

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // -------- LOAD POs --------
  async function loadOrders(pageIndex = 0) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
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
        ]),
        filters: JSON.stringify([
          [
            "Purchase Order",
            "status",
            "in",
            ["Draft", "To Receive and Bill", "To Receive", "To Bill"],
          ],
        ]),
        limit_page_length: PAGE_SIZE + 1,
        limit_start: pageIndex * PAGE_SIZE,
      });

      // hide fully completed POs (100% received & billed)
      data = data.filter((row) => {
        const r = Number(row.per_received || 0);
        const b = Number(row.per_billed || 0);
        return !(r >= 100 && b >= 100);
      });

      setHasMore(data.length > PAGE_SIZE);
      setOrders(data.slice(0, PAGE_SIZE));
      setPage(pageIndex);
      setQcEdit(null); // reset any QC inline edit when page reloads
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load Purchase Orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders(0);
  }, []);

  // ------------- QC PASS with inline good qty input -------------

  // Step 1: user clicks “QC Pass & Receive” → load PO + open inline editor
  async function startQcPass(po) {
    setError("");
    setMessage("");
    setQcPassLoading(po.name);

    try {
      const poDoc = await getPurchaseOrderWithItems(po.name);
      const poItems = poDoc.items || [];
      if (!poItems.length) {
        throw new Error("Purchase Order has no items to receive");
      }

      // For now we handle single-line PO
      const first = poItems[0];

      // Use remaining qty, not total ordered
      const orderedQty = Number(first.qty || 0);
      const alreadyReceived = Number(first.received_qty || 0);
      const remainingQty = orderedQty - alreadyReceived;

      if (remainingQty <= 0) {
        throw new Error(
          `All quantity already received for this Purchase Order item.`
        );
      }

      setQcEdit({
        poName: po.name,
        poDoc,
        poItem: first,
        maxQty: remainingQty, // remaining, not total
        qtyInput: String(remainingQty), // default: full remaining as good
      });
      setMessage(
        `Enter good quantity for PO ${po.name} (remaining ${remainingQty}).`
      );
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          "Failed to load Purchase Order for QC"
      );
    } finally {
      setQcPassLoading("");
    }
  }

  // Step 2: user confirms “Receive” with good quantity
  async function confirmQcPass() {
    if (!qcEdit) return;

    const { poName, poDoc, poItem, maxQty, qtyInput } = qcEdit;

    setError("");
    setMessage("");
    setQcPassLoading(poName);

    try {
      const goodQty = Number(qtyInput);

      if (isNaN(goodQty) || goodQty < 0 || goodQty > maxQty) {
        throw new Error(
          `Invalid quantity. Please enter a number between 0 and ${maxQty}.`
        );
      }

      const badQty = maxQty - goodQty;
      const receivedQty = goodQty + badQty; // total for this PR row

      // flag: did we accept the entire remaining quantity with zero reject?
      const allGoodThisRound = badQty === 0 && goodQty === maxQty;

      if (receivedQty <= 0) {
        setMessage("No quantity to receive.");
        setQcEdit(null);
        setQcPassLoading("");
        return;
      }

      const today = new Date().toISOString().slice(0, 10);

      // ERPNext rule: Received Qty must equal Accepted + Rejected.
      // Note: "qty" is the accepted quantity; amount is based on it.
      const items = [
        {
          item_code: poItem.item_code,

          qty: goodQty, // accepted into main warehouse
          received_qty: receivedQty,
          accepted_qty: goodQty,
          rejected_qty: badQty,

          warehouse: ACCEPTED_WAREHOUSE, // good stock warehouse

          ...(badQty > 0
            ? { rejected_warehouse: REJECTED_WAREHOUSE } // bad stock
            : {}),

          rate: poItem.rate,

          // Link back to PO row
          purchase_order: poDoc.name,
          purchase_order_item: poItem.name,
        },
      ];

      const prPayload = {
        doctype: "Purchase Receipt",
        supplier: poDoc.supplier,
        company: poDoc.company,
        posting_date: today,
        purchase_order: poDoc.name,
        items,
      };

      // Create & submit PR
      const prDoc = await createDoc("Purchase Receipt", prPayload);
      const prName = prDoc.data?.name;
      if (prName) {
        await submitDoc("Purchase Receipt", prName);
      }

      // store PR + whether everything was accepted as good
      setReceivedPO((prev) => ({
        ...prev,
        [poName]: { prName: prName || null, allGood: allGoodThisRound },
      }));

      setMessage(
        prName
          ? `QC PASS: PR ${prName} created from ${poName} (good ${goodQty}, bad ${badQty}).`
          : `QC PASS: PR (draft) created from ${poName} (good ${goodQty}, bad ${badQty}).`
      );

      setQcEdit(null);
      await loadOrders(page);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          "Failed to create Purchase Receipt"
      );
    } finally {
      setQcPassLoading("");
    }
  }

  function cancelQcPass() {
    setQcEdit(null);
    setMessage("");
  }

  // ---------------------- QC FAIL ----------------------
  async function handleQcFail(po) {
    setError("");
    setMessage("");
    setQcFailLoading(po.name);

    try {
      await cancelPurchaseOrder(po.name);

      setMessage(
        `QC marked as FAIL. Purchase Order ${po.name} has been cancelled.`
      );

      await loadOrders(page);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          "Failed to cancel Purchase Order"
      );
    } finally {
      setQcFailLoading("");
    }
  }

  // ----------------- Submit PO from list (Draft) -----------------
  async function handleSubmitPoFromList(po) {
    setError("");
    setMessage("");
    setSubmitPoLoading(po.name);

    try {
      await submitDoc("Purchase Order", po.name);
      setMessage(`Purchase Order submitted: ${po.name}`);
      await loadOrders(page);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          "Failed to submit Purchase Order"
      );
    } finally {
      setSubmitPoLoading("");
    }
  }

  // ---------------------- Invoice creation ----------------------
  async function handleCreateInvoice(po) {
    setError("");
    setMessage("");
    setInvoiceLoading(po.name);

    try {
      const poDoc = await getPurchaseOrderWithItems(po.name);
      const poItems = poDoc.items || [];
      if (!poItems.length) {
        throw new Error("Purchase Order has no items for invoice");
      }

      const today = new Date().toISOString().slice(0, 10);

      const receivedInfo = receivedPO[po.name] || {};
      const sessionPrName = receivedInfo.prName || null;
      // if we don't know (e.g. PR manually in ERP), assume all good
      const allGood = receivedInfo.allGood !== undefined
        ? receivedInfo.allGood
        : true;

      const piPayload = {
        doctype: "Purchase Invoice",
        supplier: poDoc.supplier,
        company: poDoc.company,
        posting_date: today,
        purchase_order: poDoc.name,
        items: poItems.map((it) => ({
          item_code: it.item_code,
          qty: it.qty, // still invoicing full ordered qty (your current behaviour)
          rate: it.rate,
          purchase_order: poDoc.name,
          po_detail: it.name,
          ...(sessionPrName ? { purchase_receipt: sessionPrName } : {}),
        })),
      };

      const piDoc = await createDoc("Purchase Invoice", piPayload);
      const piName = piDoc.data?.name;

      if (piName) {
        // submit PI
        await submitDoc("Purchase Invoice", piName);
        const fullPi = await getDoc("Purchase Invoice", piName);

        // create & submit Payment Entry
        await createPaymentEntryForPurchaseInvoice(fullPi);

        // 🎯 After payment, set PO status:
        // - if whole remaining qty received as good → "Completed"
        // - if partial good (some rejected)       → "Closed"
        const statusToSet = allGood ? "Completed" : "Closed";
        await setPurchaseOrderStatus(poDoc.name, statusToSet);
      }

      setMessage(
        piName
          ? `Purchase Invoice created, submitted, PAID and PO updated: ${piName}.`
          : `Purchase Invoice created from ${po.name}`
      );

      await loadOrders(page);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          "Failed to create / pay Purchase Invoice"
      );
    } finally {
      setInvoiceLoading("");
    }
  }

  function handlePrevPage() {
    if (page === 0 || loading) return;
    loadOrders(page - 1);
  }

  function handleNextPage() {
    if (!hasMore || loading) return;
    loadOrders(page + 1);
  }

  return (
    <div className="po-list">
      <div className="po-list-header">
        <div className="po-list-title-block">
          <h3 className="po-list-title">Recent Purchase Orders</h3>
          <p className="po-list-subtitle">
            Draft → QC (good &amp; bad) → Receipt → Invoice (Paid)
          </p>
        </div>
        <div className="po-list-pill">
          Page {page + 1} · {orders.length} open PO
          {orders.length !== 1 ? "s" : ""}
        </div>
      </div>

      {loading && (
        <p className="po-list-loading text-muted">
          Loading purchase orders...
        </p>
      )}
      {error && <p className="alert alert-error">{error}</p>}
      {message && <p className="alert alert-success">{message}</p>}

      {!loading && !error && (
        <>
          {orders.length === 0 ? (
            <p className="po-list-empty text-muted">
              No Purchase Orders to process.
            </p>
          ) : (
            <div className="po-list-table-wrapper">
              <table className="po-list-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Supplier</th>
                    <th>Company</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Grand Total</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((po) => {
                    const receivedFromStatus = po.status === "To Bill";
                    const receivedFromLocal = !!receivedPO[po.name];
                    const isReceived = receivedFromStatus || receivedFromLocal;

                    const isQcPassing = qcPassLoading === po.name;
                    const isQcFailing = qcFailLoading === po.name;
                    const isInvoicing = invoiceLoading === po.name;
                    const isSubmittingPo = submitPoLoading === po.name;
                    const isDraft = po.status === "Draft";

                    const isThisQcEdit =
                      qcEdit && qcEdit.poName === po.name;

                    return (
                      <tr key={po.name}>
                        <td className="po-cell-name">{po.name}</td>
                        <td>{po.supplier}</td>
                        <td>{po.company}</td>
                        <td>{po.transaction_date}</td>
                        <td>{po.status}</td>
                        <td className="po-cell-money">{po.grand_total}</td>
                        <td className="po-cell-actions">
                          {isDraft ? (
                            <div className="po-actions-stack">
                              <button
                                onClick={() =>
                                  onEditPo && onEditPo(po.name)
                                }
                                className="btn btn-outline btn-xs"
                              >
                                Edit Draft
                              </button>
                              <button
                                onClick={() =>
                                  handleSubmitPoFromList(po)
                                }
                                disabled={isSubmittingPo}
                                className="btn btn-primary btn-xs"
                              >
                                {isSubmittingPo
                                  ? "Submitting..."
                                  : "Submit"}
                              </button>
                            </div>
                          ) : !isReceived ? (
                            <div className="po-actions-stack">
                              {isThisQcEdit ? (
                                <div className="qc-inline">
                                  <span className="qc-inline-label">
                                    Good Qty (of {qcEdit.maxQty}):
                                  </span>
                                  <input
                                    type="number"
                                    className="qc-inline-input"
                                    value={qcEdit.qtyInput}
                                    onChange={(e) =>
                                      setQcEdit((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              qtyInput:
                                                e.target.value,
                                            }
                                          : prev
                                      )
                                    }
                                  />
                                  <button
                                    onClick={confirmQcPass}
                                    disabled={isQcPassing}
                                    className="btn btn-outline btn-xs"
                                  >
                                    {isQcPassing
                                      ? "Receiving..."
                                      : "Receive"}
                                  </button>
                                  <button
                                    onClick={cancelQcPass}
                                    className="btn btn-ghost btn-xs"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() =>
                                      startQcPass(po)
                                    }
                                    disabled={
                                      isQcPassing || isQcFailing
                                    }
                                    className="btn btn-outline btn-xs"
                                  >
                                    {isQcPassing
                                      ? "Loading QC..."
                                      : "QC Pass & Receive"}
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleQcFail(po)
                                    }
                                    disabled={
                                      isQcPassing || isQcFailing
                                    }
                                    className="btn btn-danger btn-xs"
                                  >
                                    {isQcFailing
                                      ? "Marking Fail..."
                                      : "QC Fail"}
                                  </button>
                                </>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                handleCreateInvoice(po)
                              }
                              disabled={isInvoicing}
                              className="btn btn-accent btn-xs"
                            >
                              {isInvoicing
                                ? "Creating Invoice..."
                                : "Create Invoice (Paid)"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="po-list-pagination">
            <button
              onClick={handlePrevPage}
              disabled={page === 0 || loading}
              className="page-btn"
            >
              ◀ Previous
            </button>
            <span className="po-list-page-text">
              Page {page + 1}
            </span>
            <button
              onClick={handleNextPage}
              disabled={!hasMore || loading}
              className="page-btn"
            >
              Next ▶
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default PurchaseOrderList;
