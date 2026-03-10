// src/Components/PurchaseTracker/PurchaseRegisterList.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./PurchaseRegisterList.css";
import {getSuppliers} from "../api/master"
import { 
  getPurchaseRegisterList,
  MF_STATUS_OPTIONS, 
  createTransporterInvoice  
} from "../api/purchase";

function formatINR(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN");
  } catch {
    return d;
  }
}

function sortRows(rows, key, direction) {
    return [...rows].sort((a, b) => {
        const valA = a[key] || "";
        const valB = b[key] || "";
        if (valA < valB) return direction === "asc" ? -1 : 1;
        if (valA > valB) return direction === "asc" ? 1 : -1;
        return 0;
    });
}

const PO_STATUS_OPTIONS = ["", "To Receive and Bill", "To Receive", "To Bill", "Delivered", "Completed", "Closed", "Cancelled"];
const PI_STATUS_OPTIONS = ["", "Paid", "Unpaid", "Overdue", "Partly Paid"];

export default function PurchaseRegisterList({ title = "Purchase Register" }) {
  const [suppliers, setSuppliers] = useState([]);
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Sort State
  const [sortConfig, setSortConfig] = useState({ key: "po_name", direction: "desc" });

  // Filter State
  const [f, setF] = useState({
    supplier: "",
    po_from_date: "",
    po_to_date: "",
    mf_status: "",
    po_status: "",
    payment_status: "",
    transporter_q: "",
    item_q: "",
    invoice_q: "",
    includeUninvoiced: true,
    includeUnreceived: true,
    limit: 500,
  });

  const [transporterModal, setTransporterModal] = useState(null); // { poName, transporterName, company }
  const [transporterAmount, setTransporterAmount] = useState("");
  const [payingTransporter, setPayingTransporter] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await getSuppliers();
      if (alive) setSuppliers(s || []);
    })();
    return () => { alive = false; };
  }, []);

  const supplierOptions = useMemo(() => {
    return (suppliers || []).map((s) => ({ value: s.name, label: s.supplier_name || s.name })).sort((a, b) => a.label.localeCompare(b.label));
  }, [suppliers]);

  function onChange(name, value) { setF((p) => ({ ...p, [name]: value })); }
  function onToggle(name) { setF((p) => ({ ...p, [name]: !p[name] })); }

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const data = await getPurchaseRegisterList(f);
      setRes(data);
    } catch (e) {
      console.error(e);
      setRes(null);
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const handleSort = (key) => {
      setSortConfig(prev => ({
          key,
          direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
      }));
  };

  const displayRows = useMemo(() => {
      if(!res?.rows) return [];
      return sortRows(res.rows, sortConfig.key, sortConfig.direction);
  }, [res, sortConfig]);

  async function submitTransporterPayment(e) {
    e.preventDefault();
    if (!transporterModal || !transporterAmount) return;

    setPayingTransporter(true);
    try {
      await createTransporterInvoice({
        transporter: transporterModal.transporterName,
        amount: transporterAmount,
        poName: transporterModal.poName,
        company: "Mithila Foods", // Or fetch company dynamically from row if available
        posting_date: new Date().toISOString().slice(0, 10)
      });
      
      // Success
      setTransporterModal(null);
      setTransporterAmount("");
      alert("Transporter Invoice Created & Submitted Successfully!");
      
      load(); 
    } catch (error) {
      console.error(error);
      alert("Failed to pay transporter: " + (error.message || "Unknown error"));
    } finally {
      setPayingTransporter(false);
    }
  }

  return (
    <section className="supplier-detail-card prl-card">
      <div className="supplier-detail-card__header prl-header">
        <div className="prl-title">{title}</div>
        <div className="prl-actions">
          <button 
            className="btn prl-btn prl-btn-ghost" 
            onClick={() => handleSort("po_name")}
          >
            Sort PO {sortConfig.key === "po_name" ? (sortConfig.direction === "asc" ? "↑" : "↓") : ""}
          </button>

          <button className="btn prl-btn" onClick={load} disabled={loading}>
            {loading ? "Loading…" : "Apply"}
          </button>
        </div>
      </div>

      <div className="supplier-detail-card__body">
        {err ? <div className="alert alert-error">{err}</div> : null}

        {/* Filters Section */}
        <div className="prl-filters">
          <div className="prl-filter">
            <label className="prl-label">Supplier</label>
            <select className="prl-input" value={f.supplier} onChange={(e) => onChange("supplier", e.target.value)}>
              <option value="">All suppliers</option>
              {supplierOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="prl-filter double-col">
            <label className="prl-label">PO Date Range</label>
            <div style={{display:'flex', gap:5}}>
                <input className="prl-input" type="date" value={f.po_from_date} onChange={(e) => onChange("po_from_date", e.target.value)} />
                <input className="prl-input" type="date" value={f.po_to_date} onChange={(e) => onChange("po_to_date", e.target.value)} />
            </div>
          </div>
          <div className="prl-filter">
            <label className="prl-label">Order Status</label>
            <select className="prl-input" value={f.mf_status} onChange={(e) => onChange("mf_status", e.target.value)}>
              <option value="">All</option>
              {MF_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="prl-filter double-col">
            <label className="prl-label">Search</label>
            <div style={{display:'flex', gap:5}}>
                <input className="prl-input" value={f.invoice_q} onChange={(e) => onChange("invoice_q", e.target.value)} placeholder="Invoice..." />
                <input className="prl-input" value={f.item_q} onChange={(e) => onChange("item_q", e.target.value)} placeholder="Item..." />
            </div>
          </div>
          <div className="prl-filter prl-check">
            <label className="prl-check-row">
              <input type="checkbox" checked={!!f.includeUninvoiced} onChange={() => onToggle("includeUninvoiced")} />
              <span>Uninvoiced</span>
            </label>
            <label className="prl-check-row">
              <input type="checkbox" checked={!!f.includeUnreceived} onChange={() => onToggle("includeUnreceived")} />
              <span>Unreceived</span>
            </label>
          </div>
        </div>

        <div className="prl-summary">
          <div><b>Rows:</b> {loading ? "…" : (res?.totalRows ?? 0)}</div>
          <div><b>Total Value:</b> {loading ? "…" : `₹${formatINR(res?.totalValue ?? 0)}`}</div>
        </div>

        {/* Table Section */}
        <div className="prl-table-wrap">
          <table className="prl-table">
            <thead>
              <tr>
                <th>PO #</th>
                <th>PO Date</th>
                <th>Item</th>
                <th className="prl-num">Rate</th>
                <th className="prl-num">Row Amt</th>
                <th className="prl-num">PO Total</th>
                <th>PO Status</th>
                <th>Stat. Updated</th>
                <th>Delivered On</th>
                <th>PR #</th>
                <th>PR Date</th>
                <th>PI #</th>
                <th>PI Date</th>
                <th>Pay Status</th>
                <th className="prl-num">Adv Paid</th>
                <th className="prl-num">Outstanding</th>
                <th>Transporter</th>
                <th>Transp. Inv</th>
                <th className="prl-num">Transp. Paid</th>
                <th className="prl-num">Transp. Amt</th>
              </tr>
            </thead>

            <tbody>
              {!loading && !displayRows.length ? (
                <tr><td colSpan={20} className="prl-empty">No rows found.</td></tr>
              ) : null}

              {displayRows.map((r, idx) => (
                <tr key={`${r.po_name}-${r.item_code}-${idx}`}>
                  <td className="prl-bold">{r.po_name}</td>
                  <td>{fmtDate(r.po_date)}</td>
                  
                  <td>
                    <div className="prl-item">
                      <div className="prl-item-name">{r.item_name}</div>
                      {/*<div className="prl-item-code">{r.item_code}</div>*/}
                    </div>
                  </td>
                  <td className="prl-num">{formatINR(r.rate)}</td>
                  <td className="prl-num">{formatINR(r.value)}</td>
                  <td className="prl-num">{formatINR(r.po_grand_total)}</td>
                  
                  <td><span className={`prl-badge status-${(r.mf_status || "").toLowerCase().replace(/\s/g,'-')}`}>{r.mf_status || "—"}</span></td>
                  <td style={{fontSize:'0.8rem'}}>{fmtDate(r.mf_status_date)}</td>
                  <td style={{fontSize:'0.8rem', fontWeight:600}}>{fmtDate(r.goods_delivered_date)}</td>
                  
                  <td className="prl-muted">{r.goods_receipt_no || "—"}</td>
                  <td style={{fontSize:'0.8rem'}}>{fmtDate(r.pr_date)}</td>
                  
                  <td className="prl-muted">{r.erp_invoice_no || "—"}</td>
                  <td style={{fontSize:'0.8rem'}}>{fmtDate(r.invoice_date)}</td>
                  <td>{r.payment_status || "—"}</td>
                  <td className="prl-num">{r.advance_paid > 0 ? formatINR(r.advance_paid) : "—"}</td>
                  <td className="prl-num" style={{color: r.outstanding_amount > 0 ? 'red' : 'inherit'}}>
                    {formatINR(r.outstanding_amount)}
                  </td>
                  
                  <td>
                    <div className="prl-transporter-cell">
                      <span>{r.transporter_name || "—"}</span>
                      {r.transporter_name && !r.transporter_invoice_no && (
                         <button 
                           className="prl-btn-xs"
                           title="Pay Transporter"
                           onClick={() => {
                             setTransporterAmount(""); 
                             setTransporterModal({
                               poName: r.po_name,
                               transporterName: r.transporter_name
                             });
                           }}
                         >
                           Pay
                         </button>
                      )}
                    </div>
                  </td>

                  <td>
                    {r.transporter_invoice_no ? (
                        <span style={{color: 'var(--primary)', fontWeight: 600}}>
                          {r.transporter_invoice_no}
                        </span>
                    ) : "—"}
                  </td>
                  
                  <td className="prl-num">{formatINR(r.transporter_payment_paid)}</td>
                  <td className="prl-num">{formatINR(r.transporter_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {transporterModal && (
          <div className="prl-modal-overlay">
             <form className="prl-modal" onSubmit={submitTransporterPayment}>
                <h3>Pay Transporter</h3>
                
                <div style={{fontSize:'0.9rem', color:'#64748b'}}>
                   <div style={{marginBottom:4}}><strong>For PO:</strong> {transporterModal.poName}</div>
                   <div><strong>Transporter:</strong> {transporterModal.transporterName}</div>
                </div>

                <div className="prl-filter" style={{marginTop:10}}>
                   <label className="prl-label">Transport Charges (Amount)</label>
                   <input 
                     className="prl-input" 
                     type="number" 
                     autoFocus
                     required
                     placeholder="Enter Amount (₹)"
                     value={transporterAmount}
                     onChange={e => setTransporterAmount(e.target.value)}
                   />
                </div>

                <div className="prl-modal-actions">
                   <button 
                     type="button" 
                     className="btn prl-btn prl-btn-ghost"
                     onClick={() => setTransporterModal(null)}
                     disabled={payingTransporter}
                   >
                     Cancel
                   </button>
                   <button 
                     type="submit" 
                     className="btn prl-btn"
                     disabled={payingTransporter || !transporterAmount}
                   >
                     {payingTransporter ? "Submitting..." : "Confirm & Pay"}
                   </button>
                </div>
             </form>
          </div>
        )}

      </div>
    </section>
  );
}