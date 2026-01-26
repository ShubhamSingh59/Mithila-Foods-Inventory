import React, { useEffect, useMemo, useState } from "react";
import "./PurchaseRegisterList.css";
import { getPurchaseRegisterList, getSuppliers, MF_STATUS_OPTIONS } from "../erpBackendApi";

function formatINR(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN");
  } catch {
    return d;
  }
}

const PO_STATUS_OPTIONS = [
  "",
  "To Receive and Bill",
  "To Receive",
  "To Bill",
  "Delivered",
  "Completed",
  "Closed",
  "Cancelled",
];

const PI_STATUS_OPTIONS = [
  "",
  "Paid",
  "Unpaid",
  "Overdue",
  "Partly Paid",
];

export default function PurchaseRegisterList({ title = "Purchase Register" }) {
  const [suppliers, setSuppliers] = useState([]);
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [f, setF] = useState({
    supplier: "",
    po_from_date: "",
    po_to_date: "",
    goods_from_date: "",
    goods_to_date: "",
    mf_status: "",
    po_status: "",
    payment_status: "",
    transporter_q: "",
    item_q: "",
    invoice_q: "",
    min_value: "",
    max_value: "",
    includeUninvoiced: true,
    includeUnreceived: true,
    limit: 500,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getSuppliers();
        if (!alive) return;
        setSuppliers(s || []);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const supplierOptions = useMemo(() => {
    return (suppliers || [])
      .map((s) => ({ value: s.name, label: s.supplier_name || s.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [suppliers]);

  function onChange(name, value) {
    setF((p) => ({ ...p, [name]: value }));
  }
  function onToggle(name) {
    setF((p) => ({ ...p, [name]: !p[name] }));
  }

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const data = await getPurchaseRegisterList({
        ...f,
        supplier: f.supplier || undefined,
        po_from_date: f.po_from_date || undefined,
        po_to_date: f.po_to_date || undefined,
        goods_from_date: f.goods_from_date || undefined,
        goods_to_date: f.goods_to_date || undefined,
        mf_status: f.mf_status || undefined,
        po_status: f.po_status || undefined,
        payment_status: f.payment_status || undefined,
        transporter_q: f.transporter_q || undefined,
        item_q: f.item_q || undefined,
        invoice_q: f.invoice_q || undefined,
        min_value: f.min_value || undefined,
        max_value: f.max_value || undefined,
        limit: Number(f.limit) || 500,
      });
      setRes(data);
    } catch (e) {
      console.error(e);
      setRes(null);
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetFilters() {
    setF({
      supplier: "",
      po_from_date: "",
      po_to_date: "",
      goods_from_date: "",
      goods_to_date: "",
      mf_status: "",
      po_status: "",
      payment_status: "",
      transporter_q: "",
      item_q: "",
      invoice_q: "",
      min_value: "",
      max_value: "",
      includeUninvoiced: true,
      includeUnreceived: true,
      limit: 500,
    });
  }

  const rows = res?.rows || [];

  return (
    <section className="supplier-detail-card prl-card">
      <div className="supplier-detail-card__header prl-header">
        <div className="prl-title">{title}</div>

        <div className="prl-actions">
          <button className="btn prl-btn" onClick={load} disabled={loading}>
            {loading ? "Loading…" : "Apply"}
          </button>
          <button className="btn prl-btn prl-btn-ghost" onClick={resetFilters} disabled={loading}>
            Reset
          </button>
        </div>
      </div>

      <div className="supplier-detail-card__body">
        {err ? <div className="alert alert-error">{err}</div> : null}

        <div className="prl-filters">
          <div className="prl-filter">
            <label className="prl-label">Supplier</label>
            <select className="prl-input" value={f.supplier} onChange={(e) => onChange("supplier", e.target.value)}>
              <option value="">All suppliers</option>
              {supplierOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="prl-filter">
            <label className="prl-label">PO Date From</label>
            <input className="prl-input" type="date" value={f.po_from_date} onChange={(e) => onChange("po_from_date", e.target.value)} />
          </div>

          <div className="prl-filter">
            <label className="prl-label">PO Date To</label>
            <input className="prl-input" type="date" value={f.po_to_date} onChange={(e) => onChange("po_to_date", e.target.value)} />
          </div>

          <div className="prl-filter">
            <label className="prl-label">Goods Received From</label>
            <input className="prl-input" type="date" value={f.goods_from_date} onChange={(e) => onChange("goods_from_date", e.target.value)} />
          </div>

          <div className="prl-filter">
            <label className="prl-label">Goods Received To</label>
            <input className="prl-input" type="date" value={f.goods_to_date} onChange={(e) => onChange("goods_to_date", e.target.value)} />
          </div>

          <div className="prl-filter">
            <label className="prl-label">MF Status</label>
            <select className="prl-input" value={f.mf_status} onChange={(e) => onChange("mf_status", e.target.value)}>
              <option value="">All</option>
              {(MF_STATUS_OPTIONS || []).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="prl-filter">
            <label className="prl-label">PO Status</label>
            <select className="prl-input" value={f.po_status} onChange={(e) => onChange("po_status", e.target.value)}>
              {PO_STATUS_OPTIONS.map((s) => <option key={s || "ALL"} value={s}>{s || "All"}</option>)}
            </select>
          </div>

          <div className="prl-filter">
            <label className="prl-label">Payment Status</label>
            <select className="prl-input" value={f.payment_status} onChange={(e) => onChange("payment_status", e.target.value)}>
              {PI_STATUS_OPTIONS.map((s) => <option key={s || "ALL"} value={s}>{s || "All"}</option>)}
            </select>
          </div>

          <div className="prl-filter">
            <label className="prl-label">Invoice No (contains)</label>
            <input className="prl-input" value={f.invoice_q} onChange={(e) => onChange("invoice_q", e.target.value)} placeholder="ex: INV-123" />
          </div>

          <div className="prl-filter">
            <label className="prl-label">Item Search</label>
            <input className="prl-input" value={f.item_q} onChange={(e) => onChange("item_q", e.target.value)} placeholder="item code or name" />
          </div>

          <div className="prl-filter">
            <label className="prl-label">Transporter (contains)</label>
            <input className="prl-input" value={f.transporter_q} onChange={(e) => onChange("transporter_q", e.target.value)} placeholder="name" />
          </div>

          <div className="prl-filter">
            <label className="prl-label">Min Value (₹)</label>
            <input className="prl-input" type="number" value={f.min_value} onChange={(e) => onChange("min_value", e.target.value)} />
          </div>

          <div className="prl-filter">
            <label className="prl-label">Max Value (₹)</label>
            <input className="prl-input" type="number" value={f.max_value} onChange={(e) => onChange("max_value", e.target.value)} />
          </div>

          <div className="prl-filter">
            <label className="prl-label">Limit</label>
            <input className="prl-input" type="number" value={f.limit} onChange={(e) => onChange("limit", e.target.value)} min={50} step={50} />
          </div>

          <div className="prl-filter prl-check">
            <label className="prl-check-row">
              <input type="checkbox" checked={!!f.includeUninvoiced} onChange={() => onToggle("includeUninvoiced")} />
              <span>Include Uninvoiced</span>
            </label>

            <label className="prl-check-row">
              <input type="checkbox" checked={!!f.includeUnreceived} onChange={() => onToggle("includeUnreceived")} />
              <span>Include Unreceived</span>
            </label>
          </div>
        </div>

        <div className="prl-summary">
          <div><b>Rows:</b> {loading ? "…" : (res?.totalRows ?? 0)}</div>
          <div><b>Total Value:</b> {loading ? "…" : `₹${formatINR(res?.totalValue ?? 0)}`}</div>
        </div>

        <div className="prl-table-wrap">
          <table className="prl-table">
            <thead>
              <tr>
                <th>Goods Received Date</th>
                <th>Source</th>
                <th>Vendor Name</th>
                <th>Invoice No.</th>
                <th>Description of Goods</th>
                <th className="prl-num">Quantity</th>
                <th className="prl-num">Value (₹)</th>
                <th>Payment Status</th>
                <th className="prl-num">Amount Paid (₹)</th>
                <th>Transporter Name</th>
                <th>PO</th>
                <th>MF Status</th>
              </tr>
            </thead>

            <tbody>
              {!loading && !rows.length ? (
                <tr>
                  <td colSpan={12} className="prl-empty">No rows found.</td>
                </tr>
              ) : null}

              {rows.map((r, idx) => (
                <tr key={`${r.po_name}-${r.item_code}-${idx}`}>
                  <td>{fmtDate(r.goods_received_date)}</td>
                  <td className="prl-muted">{r.goods_received_source || "—"}</td>
                  <td>{r.vendor_name || "—"}</td>
                  <td>{r.invoice_name || "—"}</td>
                  <td>
                    <div className="prl-item">
                      <div className="prl-item-name">{r.item_name || "—"}</div>
                      <div className="prl-item-code">{r.item_code || ""}</div>
                    </div>
                  </td>
                  <td className="prl-num">{(Number(r.quantity) || 0).toLocaleString("en-IN")}</td>
                  <td className="prl-num">₹{formatINR(r.value)}</td>
                  <td>{r.payment_status || "—"}</td>
                  <td className="prl-num">₹{formatINR(r.amount_paid)}</td>
                  <td>{r.transporter_name || "—"}</td>
                  <td className="prl-muted">{r.po_name}</td>
                  <td className="prl-muted">{r.mf_status || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="prl-footnote">
          <span className="prl-muted">
            Goods Received Date priority: <b>MF Delivered date</b> → else <b>Purchase Receipt posting_date</b>.
          </span>
        </div>
      </div>
    </section>
  );
}
