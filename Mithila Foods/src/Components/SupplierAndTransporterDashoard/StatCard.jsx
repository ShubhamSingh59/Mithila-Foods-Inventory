import React from "react";
import "./StatCard.css";

export default function StatCard({ icon: Icon, value, label, accentClass = "accent-blue" }) {
  return (
    <div className={`stat-card ${accentClass}`}>
      <div className="stat-card__icon">
        <Icon size={20} />
      </div>

      <div className="stat-card__value">{value ?? "—"}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  );
}
