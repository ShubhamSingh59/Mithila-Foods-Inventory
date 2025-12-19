//import React, { useEffect, useMemo, useState } from "react";
//import {
//  getBoms,
//  getBomDocWithItems,
//  getCompanies,
//  getWarehouses,
//  getDoc,
//  getRecentWorkOrders,
//  createAndSubmitWorkOrder,
//  createAndSubmitStockEntry,
//} from "./erpBackendApi";

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
//        style={{ width: "min(1100px, 95vw)", maxHeight: "90vh", overflow: "auto" }}
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

//export default function WorkOrderFlow() {
//  // --- master data ---
//  const [boms, setBoms] = useState([]);
//  const [companies, setCompanies] = useState([]);
//  const [warehouses, setWarehouses] = useState([]);

//  // --- create WO form ---
//  const [bomNo, setBomNo] = useState("");
//  const [company, setCompany] = useState("");
//  const [woQty, setWoQty] = useState(1);

//  const [sourceWh, setSourceWh] = useState(""); // RM store
//  const [wipWh, setWipWh] = useState("");
//  const [fgWh, setFgWh] = useState("");
//  const [wasteWh, setWasteWh] = useState(""); // raw wastage WH
//  const [damagedWh, setDamagedWh] = useState(""); // damaged FG WH

//  const [creating, setCreating] = useState(false);
//  const [msg, setMsg] = useState("");

//  // --- list ---
//  const [workOrders, setWorkOrders] = useState([]);
//  const [loadingWOs, setLoadingWOs] = useState(false);

//  // --- finish modal ---
//  const [finishOpen, setFinishOpen] = useState(false);
//  const [finishWOName, setFinishWOName] = useState("");
//  const [finishPostingDate, setFinishPostingDate] = useState(today());
//  const [finishGoodQty, setFinishGoodQty] = useState(0);
//  const [finishDamagedQty, setFinishDamagedQty] = useState(0);

//  const [consumeRows, setConsumeRows] = useState([]); // raw consumed from WIP
//  const [wasteRows, setWasteRows] = useState([]); // raw wastage WIP->wastage
//  const [finishing, setFinishing] = useState(false);

//  // load master data
//  useEffect(() => {
//    (async () => {
//      try {
//        const [b, c, w] = await Promise.all([getBoms(), getCompanies(), getWarehouses()]);
//        setBoms(b || []);
//        setCompanies(c || []);
//        setWarehouses(w || []);

//        // set defaults
//        if (c?.length && !company) setCompany(c[0].name);
//        if (b?.length && !bomNo) setBomNo(b[0].name);
//      } catch (e) {
//        setMsg(e?.message || String(e));
//      }
//    })();
//    // eslint-disable-next-line react-hooks/exhaustive-deps
//  }, []);

//  async function refreshWOs() {
//    setLoadingWOs(true);
//    try {
//      const rows = await getRecentWorkOrders(25);
//      setWorkOrders(rows || []);
//    } catch (e) {
//      setMsg(e?.message || String(e));
//    } finally {
//      setLoadingWOs(false);
//    }
//  }

//  useEffect(() => {
//    refreshWOs();
//  }, []);

//  const selectedBom = useMemo(() => boms.find((x) => x.name === bomNo), [boms, bomNo]);

//  async function createWO() {
//    setMsg("");
//    if (!bomNo) return setMsg("Please select a BOM.");
//    if (!company) return setMsg("Please select a Company.");
//    if (!wipWh || !sourceWh || !fgWh)
//      return setMsg("Please select Source, WIP and Finished warehouses.");

//    setCreating(true);
//    try {
//      // BOM has the finished item in `item`
//      const bomDoc = await getDoc("BOM", bomNo);
//      const productionItem = bomDoc?.item || selectedBom?.item;

//      if (!productionItem) throw new Error("BOM has no finished item.");

//      const payload = {
//        doctype: "Work Order",
//        company,
//        bom_no: bomNo,
//        production_item: productionItem,
//        qty: num(woQty),
//        planned_start_date: today(),
//        planned_end_date: today(),
//        source_warehouse: sourceWh,
//        wip_warehouse: wipWh,
//        fg_warehouse: fgWh,
//      };

//      const woName = await createAndSubmitWorkOrder(payload);
//      setMsg(`Created & submitted Work Order: ${woName}`);
//      await refreshWOs();
//    } catch (e) {
//      setMsg(e?.response?.data?.error || e?.message || String(e));
//    } finally {
//      setCreating(false);
//    }
//  }

//  // STEP 4: Start = Transfer raw to WIP (and submit)
//  async function startWO(woName) {
//    setMsg("");
//    try {
//      const wo = await getDoc("Work Order", woName);

//      const wip = wo.wip_warehouse || wipWh;
//      const srcDefault = wo.source_warehouse || sourceWh;

//      if (!wip || !srcDefault) throw new Error("Work Order must have WIP + Source warehouse.");
//      if (!wo.bom_no) throw new Error("Work Order has no BOM (bom_no).");

//      // ✅ IMPORTANT:
//      // ERPNext uses Stock Entry.fg_completed_qty (shown as "For Quantity") to update
//      // work_order.material_transferred_for_manufacturing. If this is missing/0,
//      // WO status won't change.
//      const totalWoQty = num(wo.qty);
//      const alreadyForQty = num(wo.material_transferred_for_manufacturing);
//      const forQty = Math.max(0, totalWoQty - alreadyForQty);

//      if (forQty <= 0) {
//        setMsg(`WO ${woName}: transfer already completed (For Qty is already fully transferred).`);
//        return;
//      }

//      const req = wo.required_items || [];

//      // ---------- Branch A: fallback (no required_items) ----------
//      if (!req.length) {
//        const bomDoc = await getBomDocWithItems(wo.bom_no);
//        const bomItems = bomDoc.items || [];
//        const scale = (forQty || 1) / (num(bomDoc.quantity) || 1);

//        const items = bomItems
//          .map((it) => ({
//            item_code: it.item_code,
//            qty: num(it.qty) * scale,
//            s_warehouse: srcDefault,
//            t_warehouse: wip,
//          }))
//          .filter((x) => x.qty > 0);

//        if (!items.length) {
//          setMsg(`WO ${woName}: nothing to transfer (BOM has no raw items).`);
//          return;
//        }

//        const seName = await createAndSubmitStockEntry({
//          doctype: "Stock Entry",
//          purpose: "Material Transfer for Manufacture",
//          stock_entry_type: "Material Transfer for Manufacture",
//          posting_date: today(),
//          company: wo.company,

//          // ✅ link to WO + BOM
//          work_order: wo.name,
//          bom_no: wo.bom_no,

//          // ✅ REQUIRED by ERPNext when work_order is set
//          from_bom: 1,
//          fg_completed_qty: forQty, // "For Quantity"

//          from_warehouse: srcDefault,
//          to_warehouse: wip,
//          items,
//        });

//        await refreshWOs();

//        const woAfter = await getDoc("Work Order", woName);
//        setMsg(
//          `Started WO ${woName}: Transfer submitted ${seName}. ` +
//            `WO status: ${woAfter.status}, transferred_for_qty: ${woAfter.material_transferred_for_manufacturing}`
//        );
//        return;
//      }

//      // ---------- Branch B: normal (required_items exists) ----------
//      const items = req
//        .map((r) => {
//          const required = num(r.required_qty);
//          const transferred = num(r.transferred_qty);
//          const remaining = Math.max(0, required - transferred);
//          return {
//            item_code: r.item_code,
//            qty: remaining,
//            s_warehouse: r.source_warehouse || srcDefault,
//            t_warehouse: wip,
//          };
//        })
//        .filter((x) => x.qty > 0);

//      if (!items.length) {
//        setMsg(`WO ${woName}: nothing remaining to transfer.`);
//        return;
//      }

//      const seName = await createAndSubmitStockEntry({
//        doctype: "Stock Entry",
//        purpose: "Material Transfer for Manufacture",
//        stock_entry_type: "Material Transfer for Manufacture",
//        posting_date: today(),
//        company: wo.company,

//        // ✅ link to WO + BOM
//        work_order: wo.name,
//        bom_no: wo.bom_no,

//        // ✅ REQUIRED by ERPNext when work_order is set
//        from_bom: 1,
//        fg_completed_qty: forQty, // "For Quantity"

//        from_warehouse: srcDefault,
//        to_warehouse: wip,
//        items,
//      });

//      await refreshWOs();

//      const woAfter = await getDoc("Work Order", woName);
//      setMsg(
//        `Started WO ${woName}: Transfer submitted ${seName}. ` +
//          `WO status: ${woAfter.status}, transferred_for_qty: ${woAfter.material_transferred_for_manufacturing}`
//      );
//    } catch (e) {
//      setMsg(e?.response?.data?.error || e?.message || String(e));
//    }
//  }

//  // STEP 3: open finish form
//  async function openFinish(woName) {
//    setMsg("");
//    try {
//      const wo = await getDoc("Work Order", woName);
//      setFinishWOName(woName);
//      setFinishPostingDate(today());
//      setFinishGoodQty(0);
//      setFinishDamagedQty(0);

//      const req = wo.required_items || [];
//      // defaults: consume remaining transferred - consumed (from WIP)
//      const consumeDefaults = req.map((r) => {
//        const transferred = num(r.transferred_qty);
//        const consumed = num(r.consumed_qty);
//        const remainingInWip = Math.max(0, transferred - consumed);
//        return {
//          item_code: r.item_code,
//          uom: r.stock_uom || r.uom || "",
//          qty: remainingInWip,
//        };
//      });

//      setConsumeRows(consumeDefaults);
//      setWasteRows(req.map((r) => ({ item_code: r.item_code, uom: r.stock_uom || r.uom || "", qty: 0 })));

//      setFinishOpen(true);
//    } catch (e) {
//      setMsg(e?.response?.data?.error || e?.message || String(e));
//    }
//  }

//  function updateRow(setter, idx, key, val) {
//    setter((prev) => {
//      const copy = [...prev];
//      copy[idx] = { ...copy[idx], [key]: val };
//      return copy;
//    });
//  }

//  // STEP 5: submit finish => Manufacture + WIP->Wastage transfer (optional)
//  async function submitFinish() {
//    setMsg("");
//    setFinishing(true);
//    try {
//      const wo = await getDoc("Work Order", finishWOName);

//      const wip = wo.wip_warehouse || wipWh;
//      const fgWarehouse = wo.fg_warehouse || fgWh;
//      const wasteWarehouse = wasteWh;
//      const damagedWarehouse = damagedWh;

//      if (!wip) throw new Error("Work Order has no WIP warehouse.");
//      if (!fgWarehouse) throw new Error("Select Finished Goods warehouse (fg_warehouse).");
//      if (!wo.bom_no) throw new Error("Work Order has no BOM (bom_no).");

//      const fgItem = wo.production_item;
//      if (!fgItem) throw new Error("Work Order has no production_item.");

//      const goodQty = num(finishGoodQty);
//      const dmgQty = num(finishDamagedQty);

//      if (goodQty <= 0 && dmgQty <= 0) {
//        throw new Error("Enter finished quantity (good or damaged).");
//      }

//      if (dmgQty > 0 && !damagedWarehouse) {
//        throw new Error("Select Damaged FG Warehouse (or set damaged qty to 0).");
//      }

//      const consumedItems = (consumeRows || [])
//        .map((r) => ({
//          item_code: r.item_code,
//          qty: num(r.qty),
//          s_warehouse: wip,
//        }))
//        .filter((r) => r.qty > 0);

//      // ✅ Manufacture items: raw consumed + FG good (+ FG damaged optional)
//      // Mark finished items explicitly to satisfy ERP validations.
//      const finishedRows = [
//        ...(goodQty > 0
//          ? [{ item_code: fgItem, qty: goodQty, t_warehouse: fgWarehouse, is_finished_item: 1 }]
//          : []),
//        ...(dmgQty > 0
//          ? [{ item_code: fgItem, qty: dmgQty, t_warehouse: damagedWarehouse, is_finished_item: 1 }]
//          : []),
//      ];

//      const mfgItems = [...consumedItems, ...finishedRows];

//      const totalFinished = goodQty + dmgQty;

//      const mfgSeName = await createAndSubmitStockEntry({
//        doctype: "Stock Entry",
//        purpose: "Manufacture",
//        stock_entry_type: "Manufacture",
//        posting_date: finishPostingDate,
//        company: wo.company,

//        // ✅ link to WO + BOM
//        work_order: wo.name,
//        bom_no: wo.bom_no,

//        // ✅ REQUIRED by ERPNext so fg_completed_qty is not reset to 0
//        from_bom: 1,
//        fg_completed_qty: totalFinished,

//        from_warehouse: wip,
//        to_warehouse: fgWarehouse,
//        items: mfgItems,
//      });

//      // Optional: raw wastage transfer WIP -> Wastage WH
//      const wasteItems = (wasteRows || [])
//        .map((r) => ({
//          item_code: r.item_code,
//          qty: num(r.qty),
//          s_warehouse: wip,
//          t_warehouse: wasteWarehouse,
//        }))
//        .filter((r) => r.qty > 0);

//      let wasteSeName = null;
//      if (wasteItems.length) {
//        if (!wasteWarehouse) throw new Error("Select Wastage warehouse for raw wastage.");
//        wasteSeName = await createAndSubmitStockEntry({
//          doctype: "Stock Entry",
//          purpose: "Material Transfer",
//          stock_entry_type: "Material Transfer",
//          posting_date: finishPostingDate,
//          company: wo.company,
//          work_order: wo.name,
//          from_warehouse: wip,
//          to_warehouse: wasteWarehouse,
//          items: wasteItems,
//        });
//      }

//      setMsg(
//        `Finished WO ${finishWOName}: Manufacture ${mfgSeName}` +
//          (wasteSeName ? ` + Wastage Transfer ${wasteSeName}` : "")
//      );

//      setFinishOpen(false);
//      await refreshWOs();

//      const woAfter = await getDoc("Work Order", finishWOName);
//      setMsg(
//        `Finished WO ${finishWOName}: Manufacture ${mfgSeName}` +
//          (wasteSeName ? ` + Wastage Transfer ${wasteSeName}` : "") +
//          `. WO status: ${woAfter.status}, produced_qty: ${woAfter.produced_qty}`
//      );
//    } catch (e) {
//      setMsg(e?.response?.data?.error || e?.message || String(e));
//    } finally {
//      setFinishing(false);
//    }
//  }

//  return (
//    <div style={{ display: "grid", gap: 14 }}>
//      <div className="app-panel">
//        <h2 style={{ marginTop: 0 }}>Work Order Flow</h2>

//        {msg ? (
//          <div style={{ padding: 10, border: "1px solid #ddd", borderRadius: 10, marginBottom: 10 }}>
//            {msg}
//          </div>
//        ) : null}

//        {/* STEP 1: WO form */}
//        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
//          <div>
//            <div style={{ fontSize: 12, opacity: 0.7 }}>Company</div>
//            <select value={company} onChange={(e) => setCompany(e.target.value)}>
//              <option value="">Select…</option>
//              {companies.map((c) => (
//                <option key={c.name} value={c.name}>
//                  {c.company_name || c.name}
//                </option>
//              ))}
//            </select>
//          </div>

//          <div>
//            <div style={{ fontSize: 12, opacity: 0.7 }}>BOM</div>
//            <select value={bomNo} onChange={(e) => setBomNo(e.target.value)}>
//              <option value="">Select…</option>
//              {boms.map((b) => (
//                <option key={b.name} value={b.name}>
//                  {b.name} — {b.item}
//                </option>
//              ))}
//            </select>
//          </div>

//          <div>
//            <div style={{ fontSize: 12, opacity: 0.7 }}>WO Qty</div>
//            <input
//              type="number"
//              value={woQty}
//              onChange={(e) => setWoQty(e.target.value)}
//              style={{ width: 100 }}
//            />
//          </div>

//          <div>
//            <div style={{ fontSize: 12, opacity: 0.7 }}>Source (RM) Warehouse</div>
//            <select value={sourceWh} onChange={(e) => setSourceWh(e.target.value)}>
//              <option value="">Select…</option>
//              {warehouses.map((w) => (
//                <option key={w.name} value={w.name}>
//                  {w.name}
//                </option>
//              ))}
//            </select>
//          </div>

//          <div>
//            <div style={{ fontSize: 12, opacity: 0.7 }}>WIP Warehouse</div>
//            <select value={wipWh} onChange={(e) => setWipWh(e.target.value)}>
//              <option value="">Select…</option>
//              {warehouses.map((w) => (
//                <option key={w.name} value={w.name}>
//                  {w.name}
//                </option>
//              ))}
//            </select>
//          </div>

//          <div>
//            <div style={{ fontSize: 12, opacity: 0.7 }}>Finished Goods Warehouse</div>
//            <select value={fgWh} onChange={(e) => setFgWh(e.target.value)}>
//              <option value="">Select…</option>
//              {warehouses.map((w) => (
//                <option key={w.name} value={w.name}>
//                  {w.name}
//                </option>
//              ))}
//            </select>
//          </div>

//          <div>
//            <div style={{ fontSize: 12, opacity: 0.7 }}>Raw Wastage Warehouse (optional)</div>
//            <select value={wasteWh} onChange={(e) => setWasteWh(e.target.value)}>
//              <option value="">(none)</option>
//              {warehouses.map((w) => (
//                <option key={w.name} value={w.name}>
//                  {w.name}
//                </option>
//              ))}
//            </select>
//          </div>

//          <div>
//            <div style={{ fontSize: 12, opacity: 0.7 }}>Damaged FG Warehouse (optional)</div>
//            <select value={damagedWh} onChange={(e) => setDamagedWh(e.target.value)}>
//              <option value="">(none)</option>
//              {warehouses.map((w) => (
//                <option key={w.name} value={w.name}>
//                  {w.name}
//                </option>
//              ))}
//            </select>
//          </div>

//          <button onClick={createWO} disabled={creating}>
//            {creating ? "Creating..." : "Create + Submit Work Order"}
//          </button>
//        </div>
//      </div>

//      {/* STEP 2: recent WO list with Start/Finish */}
//      <div className="app-panel">
//        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
//          <h3 style={{ margin: 0 }}>Recent Work Orders</h3>
//          <button onClick={refreshWOs} disabled={loadingWOs}>
//            {loadingWOs ? "Loading..." : "Refresh"}
//          </button>
//        </div>

//        <div style={{ overflowX: "auto", marginTop: 10 }}>
//          <table className="table">
//            <thead>
//              <tr>
//                <th>WO</th>
//                <th>Item</th>
//                <th>Qty</th>
//                <th>Produced</th>
//                <th>Status</th>
//                <th>Actions</th>
//              </tr>
//            </thead>
//            <tbody>
//              {workOrders.map((wo) => (
//                <tr key={wo.name}>
//                  <td>{wo.name}</td>
//                  <td>{wo.production_item}</td>
//                  <td>{wo.qty}</td>
//                  <td>{wo.produced_qty}</td>
//                  <td>{wo.status}</td>
//                  <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
//                    <button onClick={() => startWO(wo.name)}>Start (Transfer → WIP)</button>
//                    <button onClick={() => openFinish(wo.name)}>Finish</button>
//                  </td>
//                </tr>
//              ))}
//              {!workOrders.length ? (
//                <tr>
//                  <td colSpan={6} style={{ opacity: 0.7 }}>
//                    No Work Orders found.
//                  </td>
//                </tr>
//              ) : null}
//            </tbody>
//          </table>
//        </div>
//      </div>

//      {/* STEP 3 + 5: finish form modal */}
//      <Modal open={finishOpen} title={`Finish Work Order — ${finishWOName}`} onClose={() => setFinishOpen(false)}>
//        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
//          <div>
//            <div style={{ fontSize: 12, opacity: 0.7 }}>Posting Date</div>
//            <input type="date" value={finishPostingDate} onChange={(e) => setFinishPostingDate(e.target.value)} />
//          </div>

//          <div>
//            <div style={{ fontSize: 12, opacity: 0.7 }}>Finished Qty (Good)</div>
//            <input
//              type="number"
//              value={finishGoodQty}
//              onChange={(e) => setFinishGoodQty(e.target.value)}
//              style={{ width: 140 }}
//            />
//          </div>

//          <div>
//            <div style={{ fontSize: 12, opacity: 0.7 }}>Finished Qty (Damaged)</div>
//            <input
//              type="number"
//              value={finishDamagedQty}
//              onChange={(e) => setFinishDamagedQty(e.target.value)}
//              style={{ width: 160 }}
//            />
//          </div>
//        </div>

//        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
//          <div className="app-panel">
//            <h4 style={{ marginTop: 0 }}>Raw Consumed (from WIP)</h4>
//            <div style={{ overflowX: "auto" }}>
//              <table className="table">
//                <thead>
//                  <tr>
//                    <th>Item</th>
//                    <th>Qty</th>
//                    <th>UOM</th>
//                  </tr>
//                </thead>
//                <tbody>
//                  {consumeRows.map((r, idx) => (
//                    <tr key={r.item_code}>
//                      <td>{r.item_code}</td>
//                      <td style={{ width: 140 }}>
//                        <input
//                          type="number"
//                          value={r.qty}
//                          onChange={(e) => updateRow(setConsumeRows, idx, "qty", e.target.value)}
//                          style={{ width: 120 }}
//                        />
//                      </td>
//                      <td>{r.uom}</td>
//                    </tr>
//                  ))}
//                  {!consumeRows.length ? (
//                    <tr>
//                      <td colSpan={3} style={{ opacity: 0.7 }}>
//                        No raw items.
//                      </td>
//                    </tr>
//                  ) : null}
//                </tbody>
//              </table>
//            </div>
//          </div>

//          <div className="app-panel">
//            <h4 style={{ marginTop: 0 }}>Raw Wastage (WIP → Wastage WH)</h4>
//            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
//              (Optional) This creates a separate Stock Entry: Material Transfer
//            </div>
//            <div style={{ overflowX: "auto" }}>
//              <table className="table">
//                <thead>
//                  <tr>
//                    <th>Item</th>
//                    <th>Qty</th>
//                    <th>UOM</th>
//                  </tr>
//                </thead>
//                <tbody>
//                  {wasteRows.map((r, idx) => (
//                    <tr key={r.item_code}>
//                      <td>{r.item_code}</td>
//                      <td style={{ width: 140 }}>
//                        <input
//                          type="number"
//                          value={r.qty}
//                          onChange={(e) => updateRow(setWasteRows, idx, "qty", e.target.value)}
//                          style={{ width: 120 }}
//                        />
//                      </td>
//                      <td>{r.uom}</td>
//                    </tr>
//                  ))}
//                  {!wasteRows.length ? (
//                    <tr>
//                      <td colSpan={3} style={{ opacity: 0.7 }}>
//                        No raw items.
//                      </td>
//                    </tr>
//                  ) : null}
//                </tbody>
//              </table>
//            </div>
//          </div>
//        </div>

//        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
//          <button onClick={submitFinish} disabled={finishing}>
//            {finishing ? "Submitting..." : "Submit Finish (Manufacture + Wastage)"}
//          </button>
//        </div>
//      </Modal>
//    </div>
//  );
//}


import React, { useEffect, useMemo, useState } from "react";
import {
  getBoms,
  getBomDocWithItems,
  getCompanies,
  getWarehouses,
  getDoc,
  getRecentWorkOrders,
  createAndSubmitWorkOrder,
  createAndSubmitStockEntry,
} from "./erpBackendApi";

import "../CSS/WorkOrderFlow.css";

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

  // keep it readable, no giant dumps
  text = text.replace(/\s+/g, " ").trim();
  if (text.length > 260) text = text.slice(0, 260) + "…";

  return text || "Something went wrong.";
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;

  return (
    <div className="wo-modal-overlay" onClick={onClose}>
      <div
        className="app-panel wo-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="wo-modal-header">
          <h3 className="wo-modal-title">{title}</h3>
          <button type="button" className="wo-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="wo-modal-body">{children}</div>
      </div>
    </div>
  );
}

export default function WorkOrderFlow() {
  // --- master data ---
  const [boms, setBoms] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  // --- create WO form ---
  const [bomNo, setBomNo] = useState("");
  const [company, setCompany] = useState("");
  const [woQty, setWoQty] = useState(1);

  const [sourceWh, setSourceWh] = useState(""); // RM store
  const [wipWh, setWipWh] = useState("");
  const [fgWh, setFgWh] = useState("");
  const [wasteWh, setWasteWh] = useState(""); // raw wastage WH
  const [damagedWh, setDamagedWh] = useState(""); // damaged FG WH

  const [creating, setCreating] = useState(false);

  // ✅ message in alert
  const [uiMsg, setUiMsg] = useState(null); // { type: "error"|"success"|"info", text: string }

  // --- list ---
  const [workOrders, setWorkOrders] = useState([]);
  const [loadingWOs, setLoadingWOs] = useState(false);

  // --- finish modal ---
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishWOName, setFinishWOName] = useState("");
  const [finishPostingDate, setFinishPostingDate] = useState(today());
  const [finishGoodQty, setFinishGoodQty] = useState(0);
  const [finishDamagedQty, setFinishDamagedQty] = useState(0);

  const [consumeRows, setConsumeRows] = useState([]); // raw consumed from WIP
  const [wasteRows, setWasteRows] = useState([]); // raw wastage WIP->wastage
  const [finishing, setFinishing] = useState(false);

  // load master data
  useEffect(() => {
    (async () => {
      try {
        const [b, c, w] = await Promise.all([
          getBoms(),
          getCompanies(),
          getWarehouses(),
        ]);
        setBoms(b || []);
        setCompanies(c || []);
        setWarehouses(w || []);

        if (c?.length && !company) setCompany(c[0].name);
        if (b?.length && !bomNo) setBomNo(b[0].name);
      } catch (e) {
        setUiMsg({ type: "error", text: formatErr(e) });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshWOs() {
    setLoadingWOs(true);
    try {
      const rows = await getRecentWorkOrders(25);
      setWorkOrders(rows || []);
    } catch (e) {
      setUiMsg({ type: "error", text: formatErr(e) });
    } finally {
      setLoadingWOs(false);
    }
  }

  useEffect(() => {
    refreshWOs();
  }, []);

  const selectedBom = useMemo(
    () => boms.find((x) => x.name === bomNo),
    [boms, bomNo]
  );

  async function createWO() {
    setUiMsg(null);

    if (!bomNo) return setUiMsg({ type: "error", text: "Please select a BOM." });
    if (!company)
      return setUiMsg({ type: "error", text: "Please select a Company." });
    if (!wipWh || !sourceWh || !fgWh) {
      return setUiMsg({
        type: "error",
        text: "Please select Source (RM), WIP and Finished Goods warehouses.",
      });
    }

    setCreating(true);
    try {
      const bomDoc = await getDoc("BOM", bomNo);
      const productionItem = bomDoc?.item || selectedBom?.item;
      if (!productionItem) throw new Error("BOM has no finished item.");

      const payload = {
        doctype: "Work Order",
        company,
        bom_no: bomNo,
        production_item: productionItem,
        qty: num(woQty),
        planned_start_date: today(),
        planned_end_date: today(),
        source_warehouse: sourceWh,
        wip_warehouse: wipWh,
        fg_warehouse: fgWh,
      };

      const woName = await createAndSubmitWorkOrder(payload);
      setUiMsg({
        type: "success",
        text: `Created & submitted Work Order: ${woName}`,
      });
      await refreshWOs();
    } catch (e) {
      setUiMsg({ type: "error", text: formatErr(e) });
    } finally {
      setCreating(false);
    }
  }

  async function startWO(woName) {
    setUiMsg(null);

    try {
      const wo = await getDoc("Work Order", woName);

      const wip = wo.wip_warehouse || wipWh;
      const srcDefault = wo.source_warehouse || sourceWh;

      if (!wip || !srcDefault)
        throw new Error("Work Order must have WIP + Source warehouse.");
      if (!wo.bom_no) throw new Error("Work Order has no BOM (bom_no).");

      const totalWoQty = num(wo.qty);
      const alreadyForQty = num(wo.material_transferred_for_manufacturing);
      const forQty = Math.max(0, totalWoQty - alreadyForQty);

      if (forQty <= 0) {
        setUiMsg({
          type: "info",
          text: `WO ${woName}: transfer already completed.`,
        });
        return;
      }

      const req = wo.required_items || [];

      // fallback if required_items not present
      if (!req.length) {
        const bomDoc = await getBomDocWithItems(wo.bom_no);
        const bomItems = bomDoc.items || [];
        const scale = (forQty || 1) / (num(bomDoc.quantity) || 1);

        const items = bomItems
          .map((it) => ({
            item_code: it.item_code,
            qty: num(it.qty) * scale,
            s_warehouse: srcDefault,
            t_warehouse: wip,
          }))
          .filter((x) => x.qty > 0);

        if (!items.length) {
          setUiMsg({
            type: "info",
            text: `WO ${woName}: nothing to transfer (BOM has no raw items).`,
          });
          return;
        }

        const seName = await createAndSubmitStockEntry({
          doctype: "Stock Entry",
          purpose: "Material Transfer for Manufacture",
          stock_entry_type: "Material Transfer for Manufacture",
          posting_date: today(),
          company: wo.company,
          work_order: wo.name,
          bom_no: wo.bom_no,
          from_bom: 1,
          fg_completed_qty: forQty,
          from_warehouse: srcDefault,
          to_warehouse: wip,
          items,
        });

        await refreshWOs();
        const woAfter = await getDoc("Work Order", woName);

        setUiMsg({
          type: "success",
          text:
            `Started WO ${woName}: Transfer submitted ${seName}. ` +
            `Status: ${woAfter.status}`,
        });
        return;
      }

      const items = req
        .map((r) => {
          const required = num(r.required_qty);
          const transferred = num(r.transferred_qty);
          const remaining = Math.max(0, required - transferred);
          return {
            item_code: r.item_code,
            qty: remaining,
            s_warehouse: r.source_warehouse || srcDefault,
            t_warehouse: wip,
          };
        })
        .filter((x) => x.qty > 0);

      if (!items.length) {
        setUiMsg({
          type: "info",
          text: `WO ${woName}: nothing remaining to transfer.`,
        });
        return;
      }

      const seName = await createAndSubmitStockEntry({
        doctype: "Stock Entry",
        purpose: "Material Transfer for Manufacture",
        stock_entry_type: "Material Transfer for Manufacture",
        posting_date: today(),
        company: wo.company,
        work_order: wo.name,
        bom_no: wo.bom_no,
        from_bom: 1,
        fg_completed_qty: forQty,
        from_warehouse: srcDefault,
        to_warehouse: wip,
        items,
      });

      await refreshWOs();
      const woAfter = await getDoc("Work Order", woName);

      setUiMsg({
        type: "success",
        text:
          `Started WO ${woName}: Transfer submitted ${seName}. ` +
          `Status: ${woAfter.status}`,
      });
    } catch (e) {
      setUiMsg({ type: "error", text: formatErr(e) });
    }
  }

  async function openFinish(woName) {
    setUiMsg(null);

    try {
      const wo = await getDoc("Work Order", woName);
      setFinishWOName(woName);
      setFinishPostingDate(today());
      setFinishGoodQty(0);
      setFinishDamagedQty(0);

      const req = wo.required_items || [];
      const consumeDefaults = req.map((r) => {
        const transferred = num(r.transferred_qty);
        const consumed = num(r.consumed_qty);
        const remainingInWip = Math.max(0, transferred - consumed);
        return {
          item_code: r.item_code,
          uom: r.stock_uom || r.uom || "",
          qty: remainingInWip,
        };
      });

      setConsumeRows(consumeDefaults);
      setWasteRows(
        req.map((r) => ({
          item_code: r.item_code,
          uom: r.stock_uom || r.uom || "",
          qty: 0,
        }))
      );

      setFinishOpen(true);
    } catch (e) {
      setUiMsg({ type: "error", text: formatErr(e) });
    }
  }

  function updateRow(setter, idx, key, val) {
    setter((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [key]: val };
      return copy;
    });
  }

  async function submitFinish() {
    setUiMsg(null);
    setFinishing(true);

    try {
      const wo = await getDoc("Work Order", finishWOName);

      const wip = wo.wip_warehouse || wipWh;
      const fgWarehouse = wo.fg_warehouse || fgWh;
      const wasteWarehouse = wasteWh;
      const damagedWarehouse = damagedWh;

      if (!wip) throw new Error("Work Order has no WIP warehouse.");
      if (!fgWarehouse)
        throw new Error("Select Finished Goods warehouse (fg_warehouse).");
      if (!wo.bom_no) throw new Error("Work Order has no BOM (bom_no).");

      const fgItem = wo.production_item;
      if (!fgItem) throw new Error("Work Order has no production_item.");

      const goodQty = num(finishGoodQty);
      const dmgQty = num(finishDamagedQty);

      if (goodQty <= 0 && dmgQty <= 0) {
        throw new Error("Enter finished quantity (good or damaged).");
      }

      if (dmgQty > 0 && !damagedWarehouse) {
        throw new Error(
          "Select Damaged FG Warehouse (or set damaged qty to 0)."
        );
      }

      const consumedItems = (consumeRows || [])
        .map((r) => ({
          item_code: r.item_code,
          qty: num(r.qty),
          s_warehouse: wip,
        }))
        .filter((r) => r.qty > 0);

      const finishedRows = [
        ...(goodQty > 0
          ? [
              {
                item_code: fgItem,
                qty: goodQty,
                t_warehouse: fgWarehouse,
                is_finished_item: 1,
              },
            ]
          : []),
        ...(dmgQty > 0
          ? [
              {
                item_code: fgItem,
                qty: dmgQty,
                t_warehouse: damagedWarehouse,
                is_finished_item: 1,
              },
            ]
          : []),
      ];

      const totalFinished = goodQty + dmgQty;

      const mfgSeName = await createAndSubmitStockEntry({
        doctype: "Stock Entry",
        purpose: "Manufacture",
        stock_entry_type: "Manufacture",
        posting_date: finishPostingDate,
        company: wo.company,
        work_order: wo.name,
        bom_no: wo.bom_no,
        from_bom: 1,
        fg_completed_qty: totalFinished,
        from_warehouse: wip,
        to_warehouse: fgWarehouse,
        items: [...consumedItems, ...finishedRows],
      });

      const wasteItems = (wasteRows || [])
        .map((r) => ({
          item_code: r.item_code,
          qty: num(r.qty),
          s_warehouse: wip,
          t_warehouse: wasteWarehouse,
        }))
        .filter((r) => r.qty > 0);

      let wasteSeName = null;
      if (wasteItems.length) {
        if (!wasteWarehouse)
          throw new Error("Select Wastage warehouse for raw wastage.");
        wasteSeName = await createAndSubmitStockEntry({
          doctype: "Stock Entry",
          purpose: "Material Transfer",
          stock_entry_type: "Material Transfer",
          posting_date: finishPostingDate,
          company: wo.company,
          work_order: wo.name,
          from_warehouse: wip,
          to_warehouse: wasteWarehouse,
          items: wasteItems,
        });
      }

      setFinishOpen(false);
      await refreshWOs();
      const woAfter = await getDoc("Work Order", finishWOName);

      setUiMsg({
        type: "success",
        text:
          `Finished WO ${finishWOName}: Manufacture ${mfgSeName}` +
          (wasteSeName ? ` + Wastage Transfer ${wasteSeName}` : "") +
          `. Status: ${woAfter.status}`,
      });
    } catch (e) {
      setUiMsg({ type: "error", text: formatErr(e) });
    } finally {
      setFinishing(false);
    }
  }

  return (
    <div className="wo-flow">
      <div className="app-panel">
        <div className="wo-header">
          <h2 className="wo-title">Work Order Flow</h2>
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

        <div className="wo-form-row">
          <div className="wo-field">
            <div className="wo-label">Company</div>
            <select
              className="wo-control"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            >
              <option value="">Select…</option>
              {companies.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.company_name || c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="wo-field">
            <div className="wo-label">BOM</div>
            <select
              className="wo-control"
              value={bomNo}
              onChange={(e) => setBomNo(e.target.value)}
            >
              <option value="">Select…</option>
              {boms.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name} — {b.item}
                </option>
              ))}
            </select>
          </div>

          <div className="wo-field wo-field-sm">
            <div className="wo-label">WO Qty</div>
            <input
              className="wo-control"
              type="number"
              value={woQty}
              onChange={(e) => setWoQty(e.target.value)}
            />
          </div>

          <div className="wo-field">
            <div className="wo-label">Source (RM) Warehouse</div>
            <select
              className="wo-control"
              value={sourceWh}
              onChange={(e) => setSourceWh(e.target.value)}
            >
              <option value="">Select…</option>
              {warehouses.map((w) => (
                <option key={w.name} value={w.name}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="wo-field">
            <div className="wo-label">WIP Warehouse</div>
            <select
              className="wo-control"
              value={wipWh}
              onChange={(e) => setWipWh(e.target.value)}
            >
              <option value="">Select…</option>
              {warehouses.map((w) => (
                <option key={w.name} value={w.name}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="wo-field">
            <div className="wo-label">Finished Goods Warehouse</div>
            <select
              className="wo-control"
              value={fgWh}
              onChange={(e) => setFgWh(e.target.value)}
            >
              <option value="">Select…</option>
              {warehouses.map((w) => (
                <option key={w.name} value={w.name}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="wo-field">
            <div className="wo-label">Raw Wastage Warehouse (optional)</div>
            <select
              className="wo-control"
              value={wasteWh}
              onChange={(e) => setWasteWh(e.target.value)}
            >
              <option value="">(none)</option>
              {warehouses.map((w) => (
                <option key={w.name} value={w.name}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="wo-field">
            <div className="wo-label">Damaged FG Warehouse (optional)</div>
            <select
              className="wo-control"
              value={damagedWh}
              onChange={(e) => setDamagedWh(e.target.value)}
            >
              <option value="">(none)</option>
              {warehouses.map((w) => (
                <option key={w.name} value={w.name}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="wo-btn wo-btn-primary"
            onClick={createWO}
            disabled={creating}
          >
            {creating ? "Creating..." : "Create + Submit Work Order"}
          </button>
        </div>
      </div>

      <div className="app-panel">
        <div className="wo-list-header">
          <h3 className="wo-list-title">Recent Work Orders</h3>
          <button
            type="button"
            className="wo-btn"
            onClick={refreshWOs}
            disabled={loadingWOs}
          >
            {loadingWOs ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="wo-table-wrap">
          <table className="table wo-table">
            <thead>
              <tr>
                <th>WO</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Produced</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map((wo) => (
                <tr key={wo.name}>
                  <td>{wo.name}</td>
                  <td>{wo.production_item}</td>
                  <td>{wo.qty}</td>
                  <td>{wo.produced_qty}</td>
                  <td>{wo.status}</td>
                  <td>
                    <div className="wo-row-actions">
                      <button
                        type="button"
                        className="wo-btn"
                        onClick={() => startWO(wo.name)}
                      >
                        Start
                      </button>
                      <button
                        type="button"
                        className="wo-btn wo-btn-primary"
                        onClick={() => openFinish(wo.name)}
                      >
                        Finish
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!workOrders.length ? (
                <tr>
                  <td colSpan={6} className="wo-empty-cell">
                    No Work Orders found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={finishOpen}
        title={`Finish Work Order — ${finishWOName}`}
        onClose={() => setFinishOpen(false)}
      >
        <div className="wo-finish-top">
          <div className="wo-field wo-field-sm">
            <div className="wo-label">Posting Date</div>
            <input
              className="wo-control"
              type="date"
              value={finishPostingDate}
              onChange={(e) => setFinishPostingDate(e.target.value)}
            />
          </div>

          <div className="wo-field wo-field-sm">
            <div className="wo-label">Finished Qty (Good)</div>
            <input
              className="wo-control"
              type="number"
              value={finishGoodQty}
              onChange={(e) => setFinishGoodQty(e.target.value)}
            />
          </div>

          <div className="wo-field wo-field-sm">
            <div className="wo-label">Finished Qty (Damaged)</div>
            <input
              className="wo-control"
              type="number"
              value={finishDamagedQty}
              onChange={(e) => setFinishDamagedQty(e.target.value)}
            />
          </div>
        </div>

        <div className="wo-finish-grid">
          <div className="app-panel wo-subpanel">
            <h4 className="wo-subtitle">Raw Consumed (from WIP)</h4>

            <div className="wo-table-wrap wo-table-wrap-tight">
              <table className="table wo-subtable">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="wo-col-qty">Qty</th>
                    <th className="wo-col-uom">UOM</th>
                  </tr>
                </thead>
                <tbody>
                  {consumeRows.map((r, idx) => (
                    <tr key={r.item_code}>
                      <td>{r.item_code}</td>
                      <td className="wo-qty-cell">
                        <input
                          className="wo-control wo-qty-input"
                          type="number"
                          value={r.qty}
                          onChange={(e) =>
                            updateRow(setConsumeRows, idx, "qty", e.target.value)
                          }
                        />
                      </td>
                      <td>{r.uom}</td>
                    </tr>
                  ))}

                  {!consumeRows.length ? (
                    <tr>
                      <td colSpan={3} className="wo-empty-cell">
                        No raw items.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="app-panel wo-subpanel">
            <h4 className="wo-subtitle">Raw Wastage (WIP → Wastage WH)</h4>
            <div className="wo-hint text-muted">
              Optional: creates a separate Stock Entry (Material Transfer)
            </div>

            <div className="wo-table-wrap wo-table-wrap-tight">
              <table className="table wo-subtable">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="wo-col-qty">Qty</th>
                    <th className="wo-col-uom">UOM</th>
                  </tr>
                </thead>
                <tbody>
                  {wasteRows.map((r, idx) => (
                    <tr key={r.item_code}>
                      <td>{r.item_code}</td>
                      <td className="wo-qty-cell">
                        <input
                          className="wo-control wo-qty-input"
                          type="number"
                          value={r.qty}
                          onChange={(e) =>
                            updateRow(setWasteRows, idx, "qty", e.target.value)
                          }
                        />
                      </td>
                      <td>{r.uom}</td>
                    </tr>
                  ))}

                  {!wasteRows.length ? (
                    <tr>
                      <td colSpan={3} className="wo-empty-cell">
                        No raw items.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="wo-finish-actions">
          <button
            type="button"
            className="wo-btn wo-btn-primary"
            onClick={submitFinish}
            disabled={finishing}
          >
            {finishing ? "Submitting..." : "Submit Finish"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

