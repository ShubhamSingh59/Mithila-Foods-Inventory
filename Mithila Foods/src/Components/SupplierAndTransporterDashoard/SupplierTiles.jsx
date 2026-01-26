import React, { useEffect, useMemo, useState } from "react";
import { Building2, Tags, BadgeCheck, Ban, PauseCircle } from "lucide-react";
import StatCard from "./StatCard";
import "./SupplierTiles.css";

import { getSupplierDashboardStatsByStatus } from "../erpBackendApi";

const ACCENT_ROTATION = ["accent-0", "accent-1", "accent-2", "accent-3", "accent-4", "accent-5"];

// optional: map common statuses to specific icons (else fallback)
function pickStatusIcon(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("active")) return BadgeCheck;
  if (s.includes("inactive")) return PauseCircle;
  if (s.includes("black") || s.includes("block") || s.includes("ban")) return Ban;
  return Building2;
}

export default function SupplierTiles() {
  const [data, setData] = useState({ total: null, categories: null, statuses: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setErr("");
      setLoading(true);
      const res = await getSupplierDashboardStatsByStatus();
      setData(res);
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Failed to load supplier tiles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const statusTiles = useMemo(() => {
    return (data.statuses || []).map((row, idx) => {
      const Icon = pickStatusIcon(row.status);
      return {
        label: row.status,
        value: row.count,
        icon: Icon,
        accentClass: ACCENT_ROTATION[idx % ACCENT_ROTATION.length],
      };
    });
  }, [data.statuses]);

  return (
    <div id="supplier-tiles-page">
      <div className="supplier-tiles__header">
        <h2 className="supplier-tiles__title">Suppliers Overview</h2>
        <button className="supplier-tiles__btn" onClick={load}>
          Refresh
        </button>
      </div>

      {err ? <div className="supplier-tiles__error">{err}</div> : null}

      <div className="supplier-tiles__grid">
        <StatCard
          icon={Building2}
          label="Total Suppliers"
          value={loading ? "…" : data.total}
          accentClass="accent-blue"
        />

        <StatCard
          icon={Tags}
          label="Categories"
          value={loading ? "…" : data.categories}
          accentClass="accent-sky"
        />

        {statusTiles.map((t) => (
          <StatCard
            key={t.label}
            icon={t.icon}
            label={t.label}
            value={loading ? "…" : t.value}
            accentClass={t.accentClass}
          />
        ))}
      </div>
    </div>
  );
}
