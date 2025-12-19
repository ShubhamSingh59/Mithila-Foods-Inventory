import { useEffect, useState } from "react";
import {
    getCompanies,
    getActiveFiscalYears,
    pickFiscalYearForDate,
    getProfitAndLoss,
    getSalesAnalytics,
    getPurchaseAnalytics,
    getStockBalance,
    getAccountsReceivable,
    getAccountsPayable,
} from "./erpBackendApi";
import ReportChart from "./ReportChart";
import "../CSS/Analytics.css";

function normalizeColumns(cols = []) {
    return cols.map((c) => (typeof c === "string" ? { label: c, fieldname: c } : c));
}

function ReportTable({ title, report }) {
    if (!report) return <p>Loading {title}...</p>;
    if (!report.columns || !report.result) return <p>No data for {title}</p>;

    const cols = normalizeColumns(report.columns);
    const rows = report.result || [];
    const isObj = rows[0] && typeof rows[0] === "object" && !Array.isArray(rows[0]);

    return (
        <div style={{ marginBottom: 24 }}>
            <h3>{title}</h3>
            <div style={{ overflow: "auto", border: "1px solid #ddd" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }} cellPadding="6">
                    <thead>
                        <tr>
                            {cols.map((c, i) => (
                                <th
                                    key={c.fieldname || i}
                                    style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}
                                >
                                    {c.label || c.fieldname}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, r) => (
                            <tr key={r}>
                                {cols.map((c, i) => (
                                    <td key={i} style={{ borderBottom: "1px solid #eee" }}>
                                        {String(isObj ? row[c.fieldname] ?? "" : row[i] ?? "")}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function Analytics() {
    const [company, setCompany] = useState("");
    const [fy, setFy] = useState(null);
    const [from_date, setFromDate] = useState("");
    const [to_date, setToDate] = useState("");

    const [data, setData] = useState({});
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    // load Company + Fiscal Years
    useEffect(() => {
        (async () => {
            try {
                const [companies, fiscalYears] = await Promise.all([
                    getCompanies(),
                    getActiveFiscalYears(),
                ]);

                const defaultCompany = companies?.[0]?.name || "";
                setCompany(defaultCompany);

                const today = new Date().toISOString().slice(0, 10);
                const chosenFY = pickFiscalYearForDate(fiscalYears, today);
                setFy(chosenFY);

                if (chosenFY) {
                    setFromDate(chosenFY.year_start_date);
                    setToDate(chosenFY.year_end_date);
                }
            } catch (e) {
                console.error(e);
                setErr("Failed to load Company / Fiscal Year");
            }
        })();
    }, []);

    async function loadAnalytics() {
        if (!company || !from_date || !to_date) return;

        setLoading(true);
        setErr("");

        try {
            const periodicity = "Monthly";
            const range = "Monthly";
            const value_quantity = "Value";

            const [pnl, sales, purchase, stock, ar, ap] = await Promise.all([
                getProfitAndLoss({ company, from_date, to_date, periodicity }),
                getSalesAnalytics({ company, from_date, to_date, range, value_quantity }),
                getPurchaseAnalytics({ company, from_date, to_date, range, value_quantity }),
                getStockBalance({ company }),
                getAccountsReceivable({ company, report_date: to_date }),
                getAccountsPayable({ company, report_date: to_date }),
            ]);

            setData({ pnl, sales, purchase, stock, ar, ap });
        } catch (e) {
            console.error(e);
            setErr(
                "Failed to load analytics. Check ERPNext Fiscal Year is ACTIVE for this Company and covers the selected dates."
            );
        } finally {
            setLoading(false);
        }
    }

    // load analytics once dates/company are ready
    useEffect(() => {
        if (company && from_date && to_date) loadAnalytics();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [company, from_date, to_date]);

    if (err) return <div style={{ color: "red" }}>{err}</div>;
    if (!company || !fy) return <div>Loading setup...</div>;

    return (
        <div className="analytics-page">
            <div className="analytics-header">
                <div>
                    <h2 className="analytics-title">Analytics</h2>
                    <div className="analytics-subtitle">Company performance & operations</div>
                </div>

                <div className="analytics-meta">
                    <div className="meta-chip"><b>Company:</b> {company}</div>
                    <div className="meta-chip"><b>Fiscal Year:</b> {fy?.name || "-"}</div>
                </div>
            </div>

            <div className="analytics-controls">
                <div className="control">
                    <label>From</label>
                    <input type="date" value={from_date} onChange={(e) => setFromDate(e.target.value)} />
                </div>

                <div className="control">
                    <label>To</label>
                    <input type="date" value={to_date} onChange={(e) => setToDate(e.target.value)} />
                </div>

                <button className="btn" onClick={loadAnalytics}>Reload</button>
            </div>

            {loading && <p className="loading-text">Loading analytics…</p>}

            <div className="grid">
                <div className="card span-6">
                    <div className="card-header"><h3 className="card-title">Sales Analytics</h3></div>
                    <div className="card-body">
                        <ReportChart title="Sales Analytics" report={data.sales} prefer="bar" />
                    </div>
                </div>

                <div className="card span-6">
                    <div className="card-header"><h3 className="card-title">Purchase Analytics</h3></div>
                    <div className="card-body">
                        <ReportChart title="Purchase Analytics" report={data.purchase} prefer="bar" />
                    </div>
                </div>

                <div className="card span-6">
                    <div className="card-header"><h3 className="card-title">Stock Balance</h3></div>
                    <div className="card-body">
                        <ReportChart title="Stock Balance" report={data.stock} prefer="bar" xFieldGuess="item_code" yFieldGuess="bal_qty" />
                    </div>
                </div>

                <div className="card span-6">
                    <div className="card-header"><h3 className="card-title">Accounts Receivable</h3></div>
                    <div className="card-body">
                        <ReportChart title="Accounts Receivable" report={data.ar} prefer="bar" xFieldGuess="party" yFieldGuess="outstanding" />
                    </div>
                </div>

                <div className="card span-6">
                    <div className="card-header"><h3 className="card-title">Accounts Payable</h3></div>
                    <div className="card-body">
                        <ReportChart title="Accounts Payable" report={data.ap} prefer="bar" xFieldGuess="party" yFieldGuess="outstanding" />
                    </div>
                </div>

                <div className="card">
                    <div className="card-header"><h3 className="card-title">Profit & Loss</h3></div>
                    <div className="card-body">
                        <div className="table-wrap">
                            <ReportTable title="" report={data.pnl} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

}
