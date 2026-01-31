import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getDoc } from "../erpBackendApi";
import "./TransporterDetailPage.css";

// --- Helper Functions ---
function notSpecified(v) {
  if (v === null || v === undefined || v === "") return "Not specified";
  return String(v);
}

function notProvided(v) {
  if (v === null || v === undefined || v === "") return "Not provided";
  return String(v);
}

function formatDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString();
}

function Field({ label, children }) {
  return (
    <div className="tp-field">
      <div className="tp-field__label">{label}</div>
      <div className="tp-field__value">{children}</div>
    </div>
  );
}

function statusBadgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("active")) return "tp-badge tp-badge--active";
  if (s.includes("inactive")) return "tp-badge tp-badge--inactive";
  if (s.includes("block") || s.includes("ban")) return "tp-badge tp-badge--blocked";
  return "tp-badge";
}

export default function TransporterDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const supplierId = useMemo(() => {
    try {
      return decodeURIComponent(id || "");
    } catch {
      return id || "";
    }
  }, [id]);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setErr("");
        setLoading(true);
        // ✅ Fetch from Supplier
        const d = await getDoc("Supplier", supplierId);
        if (!alive) return;
        setDoc(d);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setErr(e?.message || "Failed to load transporter details");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    if (supplierId) load();
    return () => {
      alive = false;
    };
  }, [supplierId]);

  // --- Data Mapping ---
  const displayName = doc?.supplier_name || doc?.name || supplierId;
  const contactPerson = doc?.custom_contact_person || "—";
  const status = doc?.custom_status || "—";

  // ✅ Mapped correct custom fields
  const vehicleType = doc?.custom_vehicle_type || ""; 
  
  // ✅ UPDATED: Handle Child Table Array
  const serviceAreas = doc?.custom_service_areas || []; 

  // Contact Info
  const phone = doc?.mobile_no || "";
  const email = doc?.email_id || "";
  const addressText = doc?.primary_address || "";

  // Business Info
  const gstin = doc?.gstin || "";
  const pan = doc?.pan || "";

  return (
    <div id="transporter-detail-page" className="transporter-detail-page">
      <div className="tp-topbar">
        <button className="tp-back-btn" type="button" onClick={() => navigate(-1)}>
          ← Back
        </button>

        <div className="tp-titleblock">
          <div className="tp-title">{loading ? "Loading..." : displayName}</div>
          <div className="tp-subtitle">{doc?.name || supplierId}</div>
        </div>
      </div>

      {err ? <div className="tp-error">{err}</div> : null}

      {/* 1. Basic Information */}
      <section className="tp-card tp-card--green">
        <div className="tp-card__header">
          <span className="tp-card__icon">ℹ️</span>
          Basic Information
        </div>

        <div className="tp-card__body tp-grid tp-grid--2">
          <Field label="Transporter Name">
            {loading ? "…" : displayName}
          </Field>

          <Field label="Contact Person">
            {loading ? "…" : notSpecified(contactPerson)}
          </Field>

          <Field label="Status">
            {loading ? "…" : <span className={statusBadgeClass(status)}>{status}</span>}
          </Field>

          <Field label="Type">
            {loading ? "…" : doc?.supplier_type || "Transporter"}
          </Field>
        </div>
      </section>

      {/* 2. Service Details (Custom Fields) */}
      <section className="tp-card tp-card--yellow">
        <div className="tp-card__header">
          <span className="tp-card__icon">🚚</span>
          Service Details
        </div>

        <div className="tp-card__body tp-grid tp-grid--2">
          <Field label="Vehicle Type">
            {loading ? "…" : notSpecified(vehicleType)}
          </Field>

          {/* ✅ UPDATED: Render Service Areas from Child Table */}
          <div className="tp-field">
            <div className="tp-field__label">Service Areas</div>
            <div className="tp-field__value">
              {loading ? "…" : serviceAreas.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {serviceAreas.map((row, idx) => (
                    <span key={idx} className="tp-badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.85rem' }}>
                      {row.city}
                    </span>
                  ))}
                </div>
              ) : (
                "Not specified"
              )}
            </div>
          </div>

        </div>
      </section>

      {/* 3. Contact Information */}
      <section className="tp-card tp-card--cyan">
        <div className="tp-card__header">
          <span className="tp-card__icon">👤</span>
          Contact Information
        </div>

        <div className="tp-card__body tp-grid tp-grid--2">
          <Field label="Phone">
            {loading ? (
              "…"
            ) : phone ? (
              <a className="tp-link" href={`tel:${phone}`}>
                {phone}
              </a>
            ) : (
              "Not provided"
            )}
          </Field>

          <Field label="Email">
            {loading ? (
              "…"
            ) : email ? (
              <a className="tp-link" href={`mailto:${email}`}>
                {email}
              </a>
            ) : (
              "Not provided"
            )}
          </Field>

          <Field label="Address">
            {loading ? (
              "…"
            ) : addressText ? (
              <pre className="tp-pre">{addressText}</pre>
            ) : (
              "Not provided"
            )}
          </Field>
        </div>
      </section>

      {/* 4. Business Information */}
      <section className="tp-card tp-card--blue">
        <div className="tp-card__header">
          <span className="tp-card__icon">💼</span>
          Business Information
        </div>

        <div className="tp-card__body tp-grid tp-grid--2">
          <Field label="GSTIN">{loading ? "…" : notProvided(gstin)}</Field>
          <Field label="PAN">{loading ? "…" : notProvided(pan)}</Field>
          
          <Field label="Created">
            {loading ? "…" : formatDate(doc?.creation)}
          </Field>

          <Field label="Last Updated">
            {loading ? "…" : formatDate(doc?.modified)}
          </Field>
        </div>
      </section>
    </div>
  );
}