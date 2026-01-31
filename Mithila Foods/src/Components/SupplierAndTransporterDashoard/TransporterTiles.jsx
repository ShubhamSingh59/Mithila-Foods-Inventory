//import React, { useEffect, useMemo, useState } from "react";
//import { Truck, BadgeCheck, PauseCircle, Ban, HelpCircle } from "lucide-react";
//import StatCard from "./StatCard";
//import "./TransporterTiles.css";

//import { getTransporterDashboardStatsByStatus } from "../erpBackendApi";

//const ACCENT_ROTATION = ["accent-0", "accent-1", "accent-2", "accent-3", "accent-4", "accent-5"];

//function pickTransporterStatusIcon(status) {
//  const s = String(status || "").toLowerCase();
//  if (s.includes("active")) return BadgeCheck;
//  if (s.includes("inactive")) return PauseCircle;
//  if (s.includes("black") || s.includes("block") || s.includes("ban")) return Ban;
//  return HelpCircle;
//}

//export default function TransporterTiles() {
//  const [data, setData] = useState({ total: null, active: null, statuses: [] });
//  const [loading, setLoading] = useState(true);
//  const [err, setErr] = useState("");

//  async function load() {
//    try {
//      setErr("");
//      setLoading(true);
//      const res = await getTransporterDashboardStatsByStatus();
//      setData(res);
//    } catch (e) {
//      console.error(e);
//      setErr(e?.message || "Failed to load transporter tiles");
//    } finally {
//      setLoading(false);
//    }
//  }

//  useEffect(() => {
//    load();
//  }, []);

//  const statusTiles = useMemo(() => {
//    return (data.statuses || []).map((row, idx) => ({
//      label: row.status,
//      value: row.count,
//      icon: pickTransporterStatusIcon(row.status),
//      accentClass: ACCENT_ROTATION[idx % ACCENT_ROTATION.length],
//    }));
//  }, [data.statuses]);

//  return (
//    <div id="transporter-tiles-page">
//      <div className="transporter-tiles__header">
//        <h2 className="transporter-tiles__title">Transporters Overview</h2>
//        <button className="transporter-tiles__btn" onClick={load}>
//          Refresh
//        </button>
//      </div>

//      {err ? <div className="transporter-tiles__error">{err}</div> : null}

//      <div className="transporter-tiles__grid">
//        <StatCard
//          icon={Truck}
//          label="Total Transporters"
//          value={loading ? "…" : data.total}
//          accentClass="accent-green"
//        />

//        <StatCard
//          icon={BadgeCheck}
//          label="Active Transporters"
//          value={loading ? "…" : data.active}
//          accentClass="accent-blue"
//        />

//        {/* Status cards (Active/Inactive/Blacklisted/...) */}
//        {statusTiles.map((t) => (
//          <StatCard
//            key={t.label}
//            icon={t.icon}
//            label={t.label}
//            value={loading ? "…" : t.value}
//            accentClass={t.accentClass}
//          />
//        ))}
//      </div>
//    </div>
//  );
//}
import React, { useEffect, useMemo, useState } from "react";
import { Truck, BadgeCheck, PauseCircle, Ban, HelpCircle } from "lucide-react";
import StatCard from "./StatCard";
import "./TransporterTiles.css";

// ✅ Import the Transporter-specific stats API
import { getTransporterDashboardStatsByStatus } from "../erpBackendApi";

const ACCENT_ROTATION = ["accent-0", "accent-1", "accent-2", "accent-3", "accent-4", "accent-5"];

function pickTransporterStatusIcon(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("active")) return BadgeCheck;
  if (s.includes("inactive")) return PauseCircle;
  if (s.includes("black") || s.includes("block") || s.includes("ban")) return Ban;
  return HelpCircle;
}

export default function TransporterTiles() {
  const [data, setData] = useState({ total: null, active: null, statuses: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setErr("");
      setLoading(true);
      const res = await getTransporterDashboardStatsByStatus();
      setData(res);
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Failed to load transporter tiles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const statusTiles = useMemo(() => {
    return (data.statuses || [])
      // ✅ Filter OUT "Active" here because we show it manually below.
      // This prevents seeing two "Active" cards.
      .filter((row) => row.status !== "Active")
      .map((row, idx) => ({
        label: row.status,
        value: row.count,
        icon: pickTransporterStatusIcon(row.status),
        accentClass: ACCENT_ROTATION[idx % ACCENT_ROTATION.length],
      }));
  }, [data.statuses]);

  return (
    <div id="transporter-tiles-page">
      <div className="transporter-tiles__header">
        <h2 className="transporter-tiles__title">Transporters Overview</h2>
        <button className="transporter-tiles__btn" onClick={load}>
          Refresh
        </button>
      </div>

      {err ? <div className="transporter-tiles__error">{err}</div> : null}

      <div className="transporter-tiles__grid">
        {/* 1. Total Card */}
        <StatCard
          icon={Truck}
          label="Total Transporters"
          value={loading ? "…" : data.total}
          accentClass="accent-green"
        />

        {/* 2. Active Card (Always visible, even if 0) */}
        <StatCard
          icon={BadgeCheck}
          label="Active Transporters"
          value={loading ? "…" : data.active}
          accentClass="accent-blue"
        />

        {/* 3. Other Dynamic Status Cards (Inactive, Blacklisted, etc.) */}
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