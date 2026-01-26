import React, { useEffect, useMemo, useState } from "react";
import DonutChart from "../Charts/DonutChart";
import { getPurchaseInvoicePayablesSummary } from "../erpBackendApi";

function formatINR(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function PurchasePayablesWidget({
  supplierName, // optional -> if passed, per supplier. if not, overall.
  title,        // optional custom title
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

        const res = await getPurchaseInvoicePayablesSummary(
          supplierName ? { supplier: supplierName } : {}
        );

        if (!alive) return;
        setSummary(res);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setErr(e?.message || "Failed to load purchase payables");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [supplierName]);

  const donutData = useMemo(() => {
    if (!summary) return [];
    return [
      { name: "Paid", value: summary.totalPaid },
      { name: "Outstanding", value: summary.totalOutstanding },
    ];
  }, [summary]);

  const heading =
    title ||
    (supplierName ? "Purchase Payables (This Supplier)" : "Purchase Payables (Overall)");

  return (
    <section className="supplier-detail-card">
      <div className="supplier-detail-card__header">{heading}</div>

      <div className="supplier-detail-card__body">
        {err ? <div className="alert alert-error">{err}</div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <b>Total Invoice Value:</b>{" "}
            {loading ? "…" : `₹${formatINR(summary.totalInvoiceValue)}`}
          </div>
          <div>
            <b>Total Paid:</b> {loading ? "…" : `₹${formatINR(summary.totalPaid)}`}
          </div>
          <div>
            <b>Outstanding:</b>{" "}
            {loading ? "…" : `₹${formatINR(summary.totalOutstanding)}`}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {loading ? (
            <div className="text-muted">Loading chart…</div>
          ) : (
            <DonutChart
              data={donutData}
              centerTop={`₹${formatINR(summary.totalInvoiceValue)}`}
              centerBottom="Total"
            />
          )}
        </div>
      </div>
    </section>
  );
}
