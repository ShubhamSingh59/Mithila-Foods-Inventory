import React, { useEffect, useMemo, useState } from "react";
import { getStockReconciliationEntriesWithSummary } from "../api/stock";
import "./StockReconciliationList.css";


function ymd(date) {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}


function defaultFromDate() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return ymd(d);
}

/*
  Convert ERPNext docstatus number into readable label.
  0 = Draft, 1 = Submitted, 2 = Cancelled
*/
function docstatusLabel(ds) {
  if (ds === 1) return "Submitted";
  if (ds === 0) return "Draft";
  return "Cancelled";
}

/*
  Show only date part from a datetime string like:
  "2026-01-17 12:34:56" -> "2026-01-17"
*/
function dateOnly(dt) {
  if (!dt) return "—";
  return String(dt).split(" ")[0];
}


function fmtSigned(n) {
  const v = Number(n) || 0;
  if (v > 0) return `+${v}`;
  return `${v}`;
}

export default function StockReconciliationList() {
  const [rows, setRows] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [fromDate, setFromDate] = useState(defaultFromDate());
  const [toDate, setToDate] = useState(ymd(new Date()));
  const [includeDrafts, setIncludeDrafts] = useState(true);


  async function load() {
    setLoading(true);
    setError("");

    try {
      const data = await getStockReconciliationEntriesWithSummary({
        from_date: fromDate,
        to_date: toDate,
        includeDrafts,
        limit: 300,
      });
      setRows(data || []);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          "Failed to load Stock Reconciliation entries"
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const total = rows.length;
    const opening = rows.filter((r) => r.purpose === "Opening Stock").length;
    const adjust = rows.filter((r) => r.purpose === "Stock Reconciliation").length;
    return { total, opening, adjust };
  }, [rows]);

  return (
    <div className="sr-page">
      <div className="sr-header">
        <div>
          <h2 className="sr-title">Stock Reconciliation</h2>
          <p className="sr-subtitle">
            {counts.total} entries (Opening: {counts.opening}, Adjustments: {counts.adjust})
          </p>
        </div>
      </div>

      <div className="sr-filters">
        <div className="sr-filter">
          <label className="sr-label">From</label>
          <input
            type="date"
            className="sr-input"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div className="sr-filter">
          <label className="sr-label">To</label>
          <input
            type="date"
            className="sr-input"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        <label className="sr-checkbox">
          <input
            type="checkbox"
            checked={includeDrafts}
            onChange={(e) => setIncludeDrafts(e.target.checked)}
          />
          Include Drafts
        </label>

        <button className="btn btn-primary sr-apply-btn" onClick={load} disabled={loading}>
          {loading ? "Loading…" : "Apply"}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && rows.length === 0 && (
        <div className="sr-empty text-muted">No entries found in this date range.</div>
      )}

      {!error && rows.length > 0 && (
        <div className="sr-table-wrapper table-container">
          <table className="table sr-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Warehouse</th>
                <th>Qty Change</th>
                <th>Company</th>
                <th>Status</th>
                <th>Modified</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td>{r._itemDisplay || "—"}</td>
                  <td>{r._warehouseDisplay || "—"}</td>

                  <td>{r._itemsCount ? fmtSigned(r._qtyChange) : "—"}</td>

                  <td>{r.company || "—"}</td>
                  <td>{docstatusLabel(r.docstatus)}</td>
                  <td>{dateOnly(r.modified)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
