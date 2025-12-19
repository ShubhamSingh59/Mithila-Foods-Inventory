// src/ReportChart.jsx
import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

const PALETTE = [
  "#7c3aed", // violet
  "#22c55e", // green
  "#38bdf8", // sky
  "#f97316", // orange
  "#ef4444", // red
  "#eab308", // yellow
  "#a855f7", // purple
  "#14b8a6", // teal
];

function buildFromErpChart(report) {
  const c = report?.chart;
  if (!c?.data?.labels || !c?.data?.datasets?.length) return null;

  const labels = c.data.labels;
  const datasets = c.data.datasets;

  const rows = labels.map((label, i) => {
    const obj = { label };
    datasets.forEach((ds) => {
      obj[ds.name || "Value"] = Array.isArray(ds.values) ? ds.values[i] : null;
    });
    return obj;
  });

  return {
    type: c.type || "line",
    rows,
    keys: datasets.map((ds) => ds.name || "Value"),
    xKey: "label",
  };
}

// Fallback: build a simple chart from columns/result
function buildFromTable(report, xFieldGuess, yFieldGuess) {
  const cols = report?.columns || [];
  const rows = report?.result || [];
  if (!cols.length || !rows.length) return null;

  const fieldnames = cols
    .map((c) => (typeof c === "string" ? c : c.fieldname))
    .filter(Boolean);

  const isObj = rows[0] && typeof rows[0] === "object" && !Array.isArray(rows[0]);

  const xKey =
    xFieldGuess && fieldnames.includes(xFieldGuess) ? xFieldGuess : fieldnames[0];

  const lower = (s) => (typeof s === "string" ? s.toLowerCase() : "");
  const yKey =
    (yFieldGuess && fieldnames.includes(yFieldGuess) && yFieldGuess) ||
    fieldnames.find((f) => lower(f).includes("outstanding")) ||
    fieldnames.find((f) => lower(f).includes("amount")) ||
    fieldnames.find((f) => lower(f).includes("value")) ||
    fieldnames[1];

  if (!xKey || !yKey) return null;

  const xi = fieldnames.indexOf(xKey);
  const yi = fieldnames.indexOf(yKey);

  const chartRows = rows.map((r) => {
    const obj = {};
    if (isObj) {
      obj[xKey] = r?.[xKey];
      obj[yKey] = Number(r?.[yKey]) || 0;
    } else {
      obj[xKey] = r?.[xi];
      obj[yKey] = Number(r?.[yi]) || 0;
    }
    return obj;
  });

  return { type: "bar", rows: chartRows, keys: [yKey], xKey };
}

export default function ReportChart({
  title,
  report,
  height = 320,
  prefer = "line", // "line" | "bar"
  xFieldGuess,
  yFieldGuess,
}) {
  const built = buildFromErpChart(report) || buildFromTable(report, xFieldGuess, yFieldGuess);
  if (!built) return null;

  const type = (built.type || prefer) === "bar" ? "bar" : "line";
  const rows = built.rows || [];
  const xKey = built.xKey;
  const keys = built.keys || [];

  if (!rows.length || !xKey || !keys.length) return null;

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-header">
        <h3 className="card-title">{title}</h3>
      </div>

      <div className="card-body">
        <div className="chart-wrap" style={{ height }}>
          <ResponsiveContainer>
            {type === "bar" ? (
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={xKey} />
                <YAxis />
                <Tooltip />
                <Legend />
                {keys.map((k, idx) => (
                  <Bar
                    key={k}
                    dataKey={k}
                    fill={PALETTE[idx % PALETTE.length]}
                    radius={[10, 10, 0, 0]}
                  />
                ))}
              </BarChart>
            ) : (
              <LineChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={xKey} />
                <YAxis />
                <Tooltip />
                <Legend />
                {keys.map((k, idx) => (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    dot={false}
                    strokeWidth={3}
                    stroke={PALETTE[idx % PALETTE.length]}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
