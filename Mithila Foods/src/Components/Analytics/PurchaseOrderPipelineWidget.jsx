import React, { useEffect, useMemo, useState } from "react";
import DonutChart from "../Charts/DonutChart";
import { getPurchaseOrderPipelineSummary } from "../erpBackendApi";

function formatINR(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

const PO_COLORS = [
  "#ef4444", // Pending Everything
  "#f59e0b", // Waiting for Goods
  "#3b82f6", // Waiting for Invoice
  "#8b5cf6", // Delivered (NEW)
  "#16a34a", // Finished
  "#111827", // Cancelled (NEW)
  "#94a3b8", // Other
];

// Pending Everything, Waiting Goods, Waiting Invoice, Finished, Other

export default function PurchaseOrderPipelineWidget({
  supplierName, // optional => if passed, per supplier
  title,        // optional
}) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setErr("");
        setLoading(true);

        const res = await getPurchaseOrderPipelineSummary(
          supplierName ? { supplier: supplierName } : {}
        );

        if (!alive) return;
        setSummary(res);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setErr(e?.message || "Failed to load PO pipeline");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => { alive = false; };
  }, [supplierName]);

  // Donut data (value-based: grand_total sum per bucket)
  const donutData = useMemo(() => {
    if (!summary) return [];
    return (summary.buckets || [])
      .filter((b) => (Number(b.value) || 0) > 0) // show only non-zero slices
      .map((b) => ({ name: b.name, value: b.value }));
  }, [summary]);

  const heading =
    title ||
    (supplierName
      ? "PO Pipeline (This Supplier)"
      : "PO Pipeline (Overall)");

  return (
    <section className="supplier-detail-card">
      <div className="supplier-detail-card__header">{heading}</div>

      <div className="supplier-detail-card__body">
        {err ? <div className="alert alert-error">{err}</div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <b>Total Orders:</b> {loading ? "…" : summary.totalOrdersCount}
          </div>
          <div>
            <b>Total Value:</b>{" "}
            {loading ? "…" : `₹${formatINR(summary.totalOrdersValue)}`}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {loading ? (
            <div className="text-muted">Loading chart…</div>
          ) : (
            <DonutChart
              data={donutData}
              colors={PO_COLORS}
              centerTop={`₹${formatINR(summary.totalOrdersValue)}`}
              centerBottom="Total PO Value"
            />
          )}
        </div>

        {/* Optional: show bucket breakdown below */}
        {!loading && summary?.buckets?.length ? (
          <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
            {summary.buckets.map((b) => (
              <div key={b.key} style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <b>{b.name}:</b> {b.count} orders
                </div>
                <div>₹{formatINR(b.value)}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
