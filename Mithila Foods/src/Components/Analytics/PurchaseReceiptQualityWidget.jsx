import React, { useEffect, useMemo, useState } from "react";
import DonutChart from "../Charts/DonutChart";
import { getPurchaseReceiptQualitySummary } from "../erpBackendApi";

function formatQty(n) {
  const num = Number(n) || 0;
  // show up to 2 decimals if needed
  return num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

const PR_COLORS = ["#16a34a", "#ef4444"]; // Accepted, Rejected

export default function PurchaseReceiptQualityWidget({
  supplierName, // optional => per supplier
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

        const res = await getPurchaseReceiptQualitySummary(
          supplierName ? { supplier: supplierName } : {}
        );

        if (!alive) return;
        setSummary(res);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setErr(e?.message || "Failed to load Purchase Receipt quality summary");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => { alive = false; };
  }, [supplierName]);

  const donutData = useMemo(() => {
    if (!summary) return [];
    return [
      { name: "Accepted", value: summary.totalAcceptedQty || 0 },
      { name: "Rejected", value: summary.totalRejectedQty || 0 },
    ];
  }, [summary]);

  const heading =
    title ||
    (supplierName
      ? "Purchase Receipt Qty (This Supplier)"
      : "Purchase Receipt Qty (Overall)");

  return (
    <section className="supplier-detail-card">
      <div className="supplier-detail-card__header">{heading}</div>

      <div className="supplier-detail-card__body">
        {err ? <div className="alert alert-error">{err}</div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <b>Receipts:</b> {loading ? "…" : summary.receiptCount}
          </div>
          <div>
            <b>Accepted Qty:</b> {loading ? "…" : formatQty(summary.totalAcceptedQty)}
          </div>
          <div>
            <b>Rejected Qty:</b> {loading ? "…" : formatQty(summary.totalRejectedQty)}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {loading ? (
            <div className="text-muted">Loading chart…</div>
          ) : (
            <DonutChart
              data={donutData}
              colors={PR_COLORS}
              centerTop={formatQty(summary.totalQty)}
              centerBottom="Total Qty"
            />
          )}
        </div>
      </div>
    </section>
  );
}
