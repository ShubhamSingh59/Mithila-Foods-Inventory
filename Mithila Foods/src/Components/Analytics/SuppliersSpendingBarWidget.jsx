import React, { useEffect, useMemo, useState } from "react";
import BarChart from "../Charts/BarChart";
import { getSuppliersByPurchaseOrderSpending } from "../erpBackendApi";

function formatINR(n) {
    const num = Number(n) || 0;
    return num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function SuppliersSpendingBarWidget({
    title = "Suppliers by Spending (Purchase Orders)",
    topN = 10,
    includeOthers = true,
}) {
    const [res, setRes] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    useEffect(() => {
        let alive = true;

        async function load() {
            try {
                setErr("");
                setLoading(true);

                const data = await getSuppliersByPurchaseOrderSpending({
                    topN,
                    includeOthers,
                });

                if (!alive) return;
                setRes(data);
            } catch (e) {
                console.error(e);
                if (!alive) return;
                setErr(e?.message || "Failed to load suppliers spending");
            } finally {
                if (!alive) return;
                setLoading(false);
            }
        }

        load();
        return () => { alive = false; };
    }, [topN, includeOthers]);

    const chartData = useMemo(() => {
        if (!res?.suppliers) return [];
        return res.suppliers.map((s) => ({
            supplier: s.supplier,               // ✅ this is display name now
            value: Number(s.totalValue) || 0,
        }));
    }, [res]);


    return (
        <section className="supplier-detail-card">
            <div className="supplier-detail-card__header">{title}</div>

            <div className="supplier-detail-card__body">
                {err ? <div className="alert alert-error">{err}</div> : null}

                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div><b>Top:</b> {topN} suppliers</div>
                    <div>
                        <b>Overall Total:</b>{" "}
                        {loading ? "…" : `₹${formatINR(res?.overallTotal || 0)}`}
                    </div>

                </div>

                <div style={{ marginTop: 12 }}>
                    {loading ? (
                        <div className="text-muted">Loading chart…</div>
                    ) : (
                        <BarChart
                            data={chartData}
                            xKey="supplier"
                            yKey="value"
                            height={340}
                            yTickFormatter={(v) => `₹${formatINR(v)}`}
                            xTickFormatter={(name) => {
                                const s = String(name || "");
                                return s.length > 14 ? s.slice(0, 14) + "…" : s;
                            }}
                            tooltipFormatter={(value) => [`₹${formatINR(value)}`, "PO Value"]}
                        />
                    )}
                </div>
            </div>
        </section>
    );
}
