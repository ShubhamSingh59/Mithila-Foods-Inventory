//import React, { useEffect, useMemo, useState } from "react";
//import { getDoctypeList, getDoc, mapLimit } from "./erpBackendApi";

//function today() {
//  return new Date().toISOString().slice(0, 10);
//}

//function num(x) {
//  const n = Number(x);
//  return Number.isFinite(n) ? n : 0;
//}

//function Modal({ open, title, onClose, children }) {
//  if (!open) return null;
//  return (
//    <div
//      style={{
//        position: "fixed",
//        inset: 0,
//        background: "rgba(0,0,0,0.35)",
//        display: "grid",
//        placeItems: "center",
//        zIndex: 9999,
//      }}
//      onClick={onClose}
//    >
//      <div
//        className="app-panel"
//        style={{ width: "min(900px, 95vw)", maxHeight: "85vh", overflow: "auto" }}
//        onClick={(e) => e.stopPropagation()}
//      >
//        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
//          <h3 style={{ margin: 0 }}>{title}</h3>
//          <button onClick={onClose}>Close</button>
//        </div>
//        <div style={{ marginTop: 12 }}>{children}</div>
//      </div>
//    </div>
//  );
//}

//function formatBreakdown(consumedByItem) {
//  const entries = Object.entries(consumedByItem || {})
//    .map(([item_code, obj]) => ({
//      item_code,
//      qty: num(obj?.qty),
//      uom: (obj?.uom || "").trim(),
//    }))
//    .filter((x) => x.qty > 0)
//    .sort((a, b) => b.qty - a.qty);

//  return entries;
//}

//export default function WOTracking() {
//  const [fromDate, setFromDate] = useState(today());
//  const [toDate, setToDate] = useState(today());

//  const [wasteWh, setWasteWh] = useState("Wastage - MF");
//  const [damagedFgWh, setDamagedFgWh] = useState("Damaged - MF"); // kept for UI parity

//  const [loading, setLoading] = useState(false);
//  const [message, setMessage] = useState("");
//  const [error, setError] = useState("");

//  const [rows, setRows] = useState([]);

//  const [detailOpen, setDetailOpen] = useState(false);
//  const [detailWO, setDetailWO] = useState(null);

//  async function refresh() {
//    setLoading(true);
//    setError("");
//    setMessage("");

//    try {
//      const seList = await getDoctypeList("Stock Entry", {
//        fields: JSON.stringify([
//          "name",
//          "posting_date",
//          "work_order",
//          "purpose",
//          "stock_entry_type",
//          "docstatus",
//          "from_warehouse",
//          "to_warehouse",
//        ]),
//        filters: JSON.stringify([
//          ["Stock Entry", "docstatus", "=", 1],
//          ["Stock Entry", "posting_date", ">=", fromDate],
//          ["Stock Entry", "posting_date", "<=", toDate],
//          ["Stock Entry", "work_order", "is", "set"],
//        ]),
//        order_by: "posting_date desc, creation desc",
//        limit_page_length: 1000,
//      });

//      const byWO = new Map();
//      for (const se of seList || []) {
//        if (!se.work_order) continue;
//        if (!byWO.has(se.work_order)) byWO.set(se.work_order, { seNames: [] });
//        byWO.get(se.work_order).seNames.push(se.name);
//      }

//      const woNames = Array.from(byWO.keys());
//      if (!woNames.length) {
//        setRows([]);
//        setMessage("Loaded 0 Work Orders (from stock entries).");
//        return;
//      }

//      const woDocs = {};
//      await mapLimit(woNames, 6, async (woName) => {
//        woDocs[woName] = await getDoc("Work Order", woName);
//      });

//      const result = [];

//      await mapLimit(woNames, 4, async (woName) => {
//        const wo = woDocs[woName] || {};
//        const seNames = byWO.get(woName)?.seNames || [];

//        let consumedTotal = 0;

//        // item_code -> { qty, uom }
//        const consumedByItem = {};

//        let finishedQty = 0;
//        let wastageQty = 0;

//        await mapLimit(seNames, 6, async (seName) => {
//          const seDoc = await getDoc("Stock Entry", seName);
//          const seType = (seDoc.stock_entry_type || seDoc.purpose || "").trim();
//          const items = seDoc.items || [];

//          if (seType === "Manufacture") {
//            for (const it of items) {
//              const qty = num(it.qty);
//              const uom = (it.uom || it.stock_uom || "").trim();

//              // raw consumption rows: s_warehouse present, t_warehouse empty
//              if (it.s_warehouse && !it.t_warehouse) {
//                consumedTotal += qty;

//                if (!consumedByItem[it.item_code]) {
//                  consumedByItem[it.item_code] = { qty: 0, uom };
//                }
//                consumedByItem[it.item_code].qty =
//                  num(consumedByItem[it.item_code].qty) + qty;

//                // if uom was empty earlier but now present, keep it
//                if (!consumedByItem[it.item_code].uom && uom) {
//                  consumedByItem[it.item_code].uom = uom;
//                }
//              }

//              // finished rows: t_warehouse present, s_warehouse empty
//              if (it.t_warehouse && !it.s_warehouse) {
//                finishedQty += qty;
//              }
//            }
//          }

//          if (seType === "Material Transfer" && wasteWh) {
//            const headerTo = (seDoc.to_warehouse || "").trim();

//            for (const it of items) {
//              const qty = num(it.qty);
//              const itemTo = (it.t_warehouse || "").trim();

//              const isToWaste =
//                itemTo === wasteWh.trim() || (headerTo && headerTo === wasteWh.trim());

//              if (isToWaste) wastageQty += qty;
//            }
//          }
//        });

//        result.push({
//          wo: woName,
//          status: wo.status || "",
//          consumedTotal,
//          consumedByItem,
//          finishedQty,
//          wastageQty,
//        });
//      });

//      result.sort((a, b) => (a.wo < b.wo ? 1 : -1));

//      setRows(result);
//      setMessage(`Loaded ${result.length} Work Orders (from stock entries).`);
//    } catch (err) {
//      console.error(err);
//      setError(err?.response?.data?.error || err?.message || String(err));
//    } finally {
//      setLoading(false);
//    }
//  }

//  useEffect(() => {
//    refresh();
//    // eslint-disable-next-line react-hooks/exhaustive-deps
//  }, []);

//  const detailBreakdown = useMemo(() => {
//    if (!detailWO?.consumedByItem) return [];
//    return formatBreakdown(detailWO.consumedByItem);
//  }, [detailWO]);

//  return (
//    <div className="app-panel" style={{ display: "grid", gap: 12 }}>
//      <h2 style={{ margin: 0 }}>WO Tracking</h2>

//      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
//        <div>
//          <div style={{ fontSize: 12, opacity: 0.7 }}>From</div>
//          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
//        </div>

//        <div>
//          <div style={{ fontSize: 12, opacity: 0.7 }}>To</div>
//          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
//        </div>

//        <div>
//          <div style={{ fontSize: 12, opacity: 0.7 }}>Raw Wastage Warehouse (optional)</div>
//          <input
//            value={wasteWh}
//            onChange={(e) => setWasteWh(e.target.value)}
//            placeholder="e.g. Wastage - MF"
//            style={{ width: 220 }}
//          />
//        </div>

//        <div>
//          <div style={{ fontSize: 12, opacity: 0.7 }}>Damaged FG Warehouse (optional)</div>
//          <input
//            value={damagedFgWh}
//            onChange={(e) => setDamagedFgWh(e.target.value)}
//            placeholder="e.g. Damaged - MF"
//            style={{ width: 220 }}
//          />
//        </div>

//        <button onClick={refresh} disabled={loading}>
//          {loading ? "Loading..." : "Refresh"}
//        </button>
//      </div>

//      {message ? (
//        <div style={{ padding: 10, border: "1px solid #ddd", borderRadius: 10 }}>
//          {message}
//        </div>
//      ) : null}
//      {error ? (
//        <div style={{ padding: 10, border: "1px solid #f2b", borderRadius: 10 }}>
//          {error}
//        </div>
//      ) : null}

//      <div style={{ overflowX: "auto" }}>
//        <table className="table">
//          <thead>
//            <tr>
//              <th>WO</th>
//              <th>Status</th>
//              <th>Consumed Raw (from WIP)</th>
//              <th>Finished Qty</th>
//              <th>Wastage Qty</th>
//            </tr>
//          </thead>
//          <tbody>
//            {rows.map((r) => {
//              const breakdown = formatBreakdown(r.consumedByItem);
//              const preview = breakdown.slice(0, 2);
//              const remaining = Math.max(0, breakdown.length - preview.length);

//              return (
//                <tr key={r.wo}>
//                  <td>{r.wo}</td>
//                  <td>{r.status}</td>

//                  <td>
//                    <div style={{ fontWeight: 600 }}>{num(r.consumedTotal)}</div>

//                    {preview.length ? (
//                      <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4, lineHeight: 1.35 }}>
//                        {preview.map((x) => (
//                          <div key={x.item_code}>
//                            {x.item_code}: {num(x.qty)} {x.uom || ""}
//                          </div>
//                        ))}

//                        <button
//                          style={{
//                            marginTop: 6,
//                            padding: 0,
//                            border: "none",
//                            background: "transparent",
//                            color: "#1677ff",
//                            cursor: "pointer",
//                            fontSize: 12,
//                          }}
//                          onClick={() => {
//                            setDetailWO(r);
//                            setDetailOpen(true);
//                          }}
//                        >
//                          {remaining > 0 ? `+${remaining} more` : "Details"}
//                        </button>
//                      </div>
//                    ) : (
//                      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
//                        (no raw consumption found)
//                      </div>
//                    )}
//                  </td>

//                  <td>{num(r.finishedQty)}</td>
//                  <td>{num(r.wastageQty)}</td>
//                </tr>
//              );
//            })}

//            {!rows.length ? (
//              <tr>
//                <td colSpan={5} style={{ opacity: 0.7 }}>
//                  No Work Orders found.
//                </td>
//              </tr>
//            ) : null}
//          </tbody>
//        </table>
//      </div>

//      <Modal
//        open={detailOpen}
//        title={`Consumed Raw Details — ${detailWO?.wo || ""}`}
//        onClose={() => setDetailOpen(false)}
//      >
//        {!detailBreakdown.length ? (
//          <div style={{ opacity: 0.7 }}>No consumption rows found.</div>
//        ) : (
//          <div style={{ overflowX: "auto" }}>
//            <table className="table">
//              <thead>
//                <tr>
//                  <th>Item</th>
//                  <th style={{ width: 140 }}>Consumed Qty</th>
//                  <th style={{ width: 120 }}>UOM</th>
//                </tr>
//              </thead>
//              <tbody>
//                {detailBreakdown.map((x) => (
//                  <tr key={x.item_code}>
//                    <td>{x.item_code}</td>
//                    <td>{num(x.qty)}</td>
//                    <td>{x.uom || ""}</td>
//                  </tr>
//                ))}
//              </tbody>
//            </table>
//          </div>
//        )}
//      </Modal>
//    </div>
//  );
//}


import React, { useEffect, useMemo, useState } from "react";
import { getDoctypeList, getDoc, mapLimit } from "./erpBackendApi";
import "../CSS/WOTracking.css";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function formatErr(e) {
  const raw =
    e?.response?.data?.error?.message ||
    e?.response?.data?.error ||
    e?.message ||
    String(e);

  let text = typeof raw === "string" ? raw : JSON.stringify(raw);
  text = text.replace(/\s+/g, " ").trim();
  if (text.length > 260) text = text.slice(0, 260) + "…";
  return text || "Something went wrong.";
}

function helpfulHint(msg) {
  const m = (msg || "").toLowerCase();

  if (m.includes("not permitted") || m.includes("permission")) {
    return "Action: Check ERPNext permissions for Stock Entry + Work Order.";
  }
  if (m.includes("failed to fetch") || m.includes("network") || m.includes("cors")) {
    return "Action: Check internet/VPN and ERP backend URL.";
  }
  if (m.includes("timeout") || m.includes("time out")) {
    return "Action: Try a smaller date range and refresh.";
  }
  if (m.includes("404")) {
    return "Action: Check the API endpoint / DocType name.";
  }
  return "Action: Try Refresh. If it continues, verify date range and warehouse names.";
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;

  return (
    <div className="wot-modal-overlay" onClick={onClose}>
      <div className="app-panel wot-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="wot-modal-header">
          <h3 className="wot-modal-title">{title}</h3>
          <button type="button" className="wot-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="wot-modal-body">{children}</div>
      </div>
    </div>
  );
}

function formatBreakdown(consumedByItem) {
  const entries = Object.entries(consumedByItem || {})
    .map(([item_code, obj]) => ({
      item_code,
      qty: num(obj?.qty),
      uom: (obj?.uom || "").trim(),
    }))
    .filter((x) => x.qty > 0)
    .sort((a, b) => b.qty - a.qty);

  return entries;
}

export default function WOTracking() {
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());

  const [wasteWh, setWasteWh] = useState("Wastage - MF");
  const [damagedFgWh, setDamagedFgWh] = useState("Damaged - MF"); // kept for UI parity

  const [loading, setLoading] = useState(false);

  // ✅ unified alert
  const [uiMsg, setUiMsg] = useState(null); // { type: "error"|"success"|"info", text: string }

  const [rows, setRows] = useState([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailWO, setDetailWO] = useState(null);

  async function refresh() {
    setLoading(true);
    setUiMsg(null);

    try {
      const seList = await getDoctypeList("Stock Entry", {
        fields: JSON.stringify([
          "name",
          "posting_date",
          "work_order",
          "purpose",
          "stock_entry_type",
          "docstatus",
          "from_warehouse",
          "to_warehouse",
        ]),
        filters: JSON.stringify([
          ["Stock Entry", "docstatus", "=", 1],
          ["Stock Entry", "posting_date", ">=", fromDate],
          ["Stock Entry", "posting_date", "<=", toDate],
          ["Stock Entry", "work_order", "is", "set"],
        ]),
        order_by: "posting_date desc, creation desc",
        limit_page_length: 1000,
      });

      const byWO = new Map();
      for (const se of seList || []) {
        if (!se.work_order) continue;
        if (!byWO.has(se.work_order)) byWO.set(se.work_order, { seNames: [] });
        byWO.get(se.work_order).seNames.push(se.name);
      }

      const woNames = Array.from(byWO.keys());
      if (!woNames.length) {
        setRows([]);
        setUiMsg({ type: "info", text: "Loaded 0 Work Orders (from stock entries)." });
        return;
      }

      const woDocs = {};
      await mapLimit(woNames, 6, async (woName) => {
        woDocs[woName] = await getDoc("Work Order", woName);
      });

      const result = [];

      await mapLimit(woNames, 4, async (woName) => {
        const wo = woDocs[woName] || {};
        const seNames = byWO.get(woName)?.seNames || [];

        let consumedTotal = 0;
        const consumedByItem = {};
        let finishedQty = 0;
        let wastageQty = 0;

        await mapLimit(seNames, 6, async (seName) => {
          const seDoc = await getDoc("Stock Entry", seName);
          const seType = (seDoc.stock_entry_type || seDoc.purpose || "").trim();
          const items = seDoc.items || [];

          if (seType === "Manufacture") {
            for (const it of items) {
              const qty = num(it.qty);
              const uom = (it.uom || it.stock_uom || "").trim();

              // raw consumption: s_warehouse present, t_warehouse empty
              if (it.s_warehouse && !it.t_warehouse) {
                consumedTotal += qty;

                if (!consumedByItem[it.item_code]) {
                  consumedByItem[it.item_code] = { qty: 0, uom };
                }
                consumedByItem[it.item_code].qty = num(consumedByItem[it.item_code].qty) + qty;

                if (!consumedByItem[it.item_code].uom && uom) {
                  consumedByItem[it.item_code].uom = uom;
                }
              }

              // finished rows: t_warehouse present, s_warehouse empty
              if (it.t_warehouse && !it.s_warehouse) {
                finishedQty += qty;
              }
            }
          }

          if (seType === "Material Transfer" && wasteWh) {
            const headerTo = (seDoc.to_warehouse || "").trim();

            for (const it of items) {
              const qty = num(it.qty);
              const itemTo = (it.t_warehouse || "").trim();

              const isToWaste =
                itemTo === wasteWh.trim() || (headerTo && headerTo === wasteWh.trim());

              if (isToWaste) wastageQty += qty;
            }
          }
        });

        result.push({
          wo: woName,
          status: wo.status || "",
          consumedTotal,
          consumedByItem,
          finishedQty,
          wastageQty,
        });
      });

      result.sort((a, b) => (a.wo < b.wo ? 1 : -1));
      setRows(result);
      setUiMsg({ type: "success", text: `Loaded ${result.length} Work Orders (from stock entries).` });
    } catch (err) {
      const msg = formatErr(err);
      setUiMsg({ type: "error", text: `${msg} ${helpfulHint(msg)}` });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detailBreakdown = useMemo(() => {
    if (!detailWO?.consumedByItem) return [];
    return formatBreakdown(detailWO.consumedByItem);
  }, [detailWO]);

  return (
    <div className="wot-page">
      <div className="app-panel wot-card">
        <div className="wot-header">
          <h2 className="wot-title">WO Tracking</h2>
          <button type="button" className="wot-btn" onClick={refresh} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="wot-filters">
          <div className="wot-field wot-field-sm">
            <div className="wot-label">From</div>
            <input
              className="wot-control"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="wot-field wot-field-sm">
            <div className="wot-label">To</div>
            <input
              className="wot-control"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="wot-field">
            <div className="wot-label">Raw Wastage Warehouse (optional)</div>
            <input
              className="wot-control"
              value={wasteWh}
              onChange={(e) => setWasteWh(e.target.value)}
              placeholder="e.g. Wastage - MF"
            />
          </div>

          <div className="wot-field">
            <div className="wot-label">Damaged FG Warehouse (optional)</div>
            <input
              className="wot-control"
              value={damagedFgWh}
              onChange={(e) => setDamagedFgWh(e.target.value)}
              placeholder="e.g. Damaged - MF"
            />
          </div>
        </div>

        {uiMsg ? (
          <div
            className={
              "alert " +
              (uiMsg.type === "error"
                ? "alert-error"
                : uiMsg.type === "success"
                ? "alert-success"
                : "alert-info")
            }
          >
            {uiMsg.text}
          </div>
        ) : null}

        <div className="wot-table-wrapper">
          <table className="table wot-table">
            <thead>
              <tr>
                <th>WO</th>
                <th>Status</th>
                <th>Consumed Raw (from WIP)</th>
                <th>Finished Qty</th>
                <th>Wastage Qty</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => {
                const breakdown = formatBreakdown(r.consumedByItem);
                const preview = breakdown.slice(0, 2);
                const remaining = Math.max(0, breakdown.length - preview.length);

                return (
                  <tr key={r.wo}>
                    <td className="wot-wo">{r.wo}</td>
                    <td className="wot-status">{r.status}</td>

                    <td>
                      <div className="wot-consumed-total">{num(r.consumedTotal)}</div>

                      {preview.length ? (
                        <div className="wot-breakdown">
                          {preview.map((x) => (
                            <div key={x.item_code} className="wot-breakdown-row">
                              {x.item_code}: {num(x.qty)} {x.uom || ""}
                            </div>
                          ))}

                          <button
                            type="button"
                            className="wot-link-btn"
                            onClick={() => {
                              setDetailWO(r);
                              setDetailOpen(true);
                            }}
                          >
                            {remaining > 0 ? `+${remaining} more` : "Details"}
                          </button>
                        </div>
                      ) : (
                        <div className="wot-muted">(no raw consumption found)</div>
                      )}
                    </td>

                    <td className="wot-num">{num(r.finishedQty)}</td>
                    <td className="wot-num">{num(r.wastageQty)}</td>
                  </tr>
                );
              })}

              {!rows.length ? (
                <tr>
                  <td colSpan={5} className="wot-empty">
                    No Work Orders found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={detailOpen}
        title={`Consumed Raw Details — ${detailWO?.wo || ""}`}
        onClose={() => setDetailOpen(false)}
      >
        {!detailBreakdown.length ? (
          <div className="wot-muted">No consumption rows found.</div>
        ) : (
          <div className="wot-detail-table">
            <table className="table wot-subtable">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="wot-col-qty">Consumed Qty</th>
                  <th className="wot-col-uom">UOM</th>
                </tr>
              </thead>
              <tbody>
                {detailBreakdown.map((x) => (
                  <tr key={x.item_code}>
                    <td>{x.item_code}</td>
                    <td>{num(x.qty)}</td>
                    <td>{x.uom || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
