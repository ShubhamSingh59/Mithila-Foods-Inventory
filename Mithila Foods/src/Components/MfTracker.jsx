import React, { useEffect, useMemo, useState } from "react";
import { getDoctypeList, getDoc } from "./erpBackendApi";
import "../CSS/mfWorkflowTheme.css";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function fmtUsedRaw(rawLines) {
  if (!rawLines.length) return "-";
  return (
    rawLines
      .slice(0, 8)
      .map((r) => `${r.item_code} (${Number(r.qty) || 0})`)
      .join(" | ") + (rawLines.length > 8 ? ` | +${rawLines.length - 8} more` : "")
  );
}

export default function MfTracker() {
  const [date, setDate] = useState(todayYmd());
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const list = await getDoctypeList("Stock Entry", {
        fields: JSON.stringify([
          "name",
          "posting_date",
          "posting_time",
          "stock_entry_type",
          "company",
          "docstatus",
          "modified",
        ]),
        filters: JSON.stringify([
          ["Stock Entry", "docstatus", "=", 1],
          ["Stock Entry", "stock_entry_type", "=", "Manufacture"],
          ["Stock Entry", "posting_date", "=", date],
        ]),
        order_by: "posting_time desc, modified desc",
        limit_page_length: 200,
      });

      const docs = [];
      for (const se of list || []) {
        const doc = await getDoc("Stock Entry", se.name);
        docs.push(doc);
      }

      const parsed = (docs || []).map((doc) => {
        const items = doc.items || [];

        const finished = items.filter((it) => Number(it.is_finished_item) === 1);
        const raw = items.filter(
          (it) => it.s_warehouse && Number(it.is_finished_item) !== 1
        );

        const finishedText =
          finished.length > 1
            ? finished
                .map((f) => `${f.item_code} (${Number(f.qty) || 0})`)
                .join(" | ")
            : finished[0]
            ? `${finished[0].item_code} (${Number(finished[0].qty) || 0})`
            : "-";

        return {
          name: doc.name,
          posting_date: doc.posting_date,
          posting_time: doc.posting_time,
          company: doc.company,
          finishedText,
          usedRawText: fmtUsedRaw(raw),
          rawCount: raw.length,
        };
      });

      setRows(parsed);
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to load tracker");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const filtered = useMemo(() => {
    const s = (q || "").trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      return (
        (r.name || "").toLowerCase().includes(s) ||
        (r.company || "").toLowerCase().includes(s) ||
        (r.finishedText || "").toLowerCase().includes(s) ||
        (r.usedRawText || "").toLowerCase().includes(s)
      );
    });
  }, [rows, q]);

  return (
    <div className="app-panel">
      <div>
        <div>
          <label className="form-label">Date</label>
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div>
          <label className="form-label">Search</label>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Stock Entry / item / raw..."
          />
        </div>

        <button className="btn btn-accent" type="button" onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Stock Entry</th>
              <th>Time</th>
              <th>Company</th>
              <th>Finished Item</th>
              <th>Used Raw (qty)</th>
              <th>#Raw Lines</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td>{r.posting_time || "-"}</td>
                <td>{r.company || "-"}</td>
                <td>{r.finishedText}</td>
                <td>{r.usedRawText}</td>
                <td>{r.rawCount}</td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={6} className="text-muted">
                  No manufacture entries for this day.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
