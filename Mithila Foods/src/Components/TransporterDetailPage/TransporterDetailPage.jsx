import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getDoc } from "../erpBackendApi";
import "./TransporterDetailPage.css";

const TRANSPORTER_DOCTYPE = "Transporter";

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

function splitChipsFromString(s) {
  return String(s)
    .split(/[\n,]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Extract a list of "chips" from doc.
 * Supports:
 * - string: "Bangalore, Chennai"
 * - array of strings: ["Bangalore", "Chennai"]
 * - array of objects: [{location:"Bangalore"}] / [{supplier:"ABC"}] etc
 */
function extractChips(doc, candidateFields) {
  for (const key of candidateFields) {
    const v = doc?.[key];
    if (!v) continue;

    // string
    if (typeof v === "string") return splitChipsFromString(v);

    // array
    if (Array.isArray(v)) {
      // array of strings
      if (v.every((x) => typeof x === "string")) {
        return v.map((x) => x.trim()).filter(Boolean);
      }

      // array of objects (child table)
      if (v.every((x) => x && typeof x === "object")) {
        const pickKeys = ["location", "city", "name", "supplier", "supplier_name", "value", "label"];
        const out = [];
        for (const row of v) {
          let found = "";
          for (const pk of pickKeys) {
            if (row?.[pk]) {
              found = String(row[pk]).trim();
              break;
            }
          }
          if (found) out.push(found);
        }
        return out;
      }
    }
  }
  return [];
}

function Field({ label, children }) {
  return (
    <div className="tp-field">
      <div className="tp-field__label">{label}</div>
      <div className="tp-field__value">{children}</div>
    </div>
  );
}

function Chips({ items, emptyText = "—" }) {
  if (!items || items.length === 0) return <div className="tp-empty">{emptyText}</div>;
  return (
    <div className="tp-chips">
      {items.map((x) => (
        <span key={x} className="tp-chip">
          {x}
        </span>
      ))}
    </div>
  );
}

function statusBadgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("active")) return "tp-badge tp-badge--active";
  if (s.includes("pending")) return "tp-badge tp-badge--pending";
  if (s.includes("inactive")) return "tp-badge tp-badge--inactive";
  if (s.includes("black") || s.includes("block") || s.includes("ban")) return "tp-badge tp-badge--blocked";
  return "tp-badge";
}

export default function TransporterDetailPage() {
  //const { name } = useParams();
  //const navigate = useNavigate();

  //const transporterName = useMemo(() => {
  //  try {
  //    return decodeURIComponent(name || "");
  //  } catch {
  //    return name || "";
  //  }
  //}, [name]);

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  //useEffect(() => {
  //  let alive = true;

  //  async function load() {
  //    try {
  //      setErr("");
  //      setLoading(true);
  //      const d = await getDoc(TRANSPORTER_DOCTYPE, transporterName);
  //      if (!alive) return;
  //      setDoc(d);
  //    } catch (e) {
  //      console.error(e);
  //      if (!alive) return;
  //      setErr(e?.message || "Failed to load transporter details");
  //    } finally {
  //      if (!alive) return;
  //      setLoading(false);
  //    }
  //  }

  //  if (transporterName) load();
  //  return () => {
  //    alive = false;
  //  };
  //}, [transporterName]);
  const { id } = useParams(); // ✅ was { name }
  const navigate = useNavigate();

  const transporterName = useMemo(() => {
    try {
      return decodeURIComponent(id || "");
    } catch {
      return id || "";
    }
  }, [id]);

  // keep rest same...

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setErr("");
        setLoading(true);

        const d = await getDoc("Transporter", transporterName);
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

    if (!transporterName) {
      setErr("Missing transporter id in URL");
      setLoading(false);
      return;
    }

    load();
    return () => (alive = false);
  }, [transporterName]);
  const displayName = doc?.transporter_name || doc?.name || transporterName;

  // Basic fields (based on your list + screenshot)
  const contactPerson = doc?.point_of_contact || doc?.contact_person || "—";
  const status = doc?.status || "—";
  const rating = doc?.rating || "Not Rated";

  // Vehicle/service fields (unknown exact fieldnames → safe fallbacks)
  const vehicleType =
    doc?.primary_vehicle_type || doc?.vehicle_type || doc?.custom_vehicle_type || "";
  const fleetSize =
    doc?.fleet_size || doc?.custom_fleet_size || doc?.fleet || "";
  const rateType =
    doc?.rate_type || doc?.custom_rate_type || "";

  // Contact fields
  const phone = doc?.contact || doc?.phone || doc?.mobile_no || "";
  const email = doc?.email || doc?.email_id || "";
  const addressText = doc?.address || "";

  // Chips sections (try multiple possible fieldnames)
  const serviceableLocations = useMemo(
    () =>
      extractChips(doc, [
        "serviceable_locations",
        "serviceable_location",
        "locations",
        "cities",
        "service_locations",
        "serviceable_area",
      ]),
    [doc]
  );

  const preferredSuppliers = useMemo(
    () =>
      extractChips(doc, [
        "preferred_suppliers",
        "preferred_supplier",
        "suppliers",
        "supplier_list",
      ]),
    [doc]
  );

  // Business fields (guessable)
  const licenseNo = doc?.license_number || doc?.license_no || doc?.custom_license_number || "";
  const regNo = doc?.registration_number || doc?.registration_no || doc?.custom_registration_number || "";
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
          <div className="tp-subtitle">{doc?.name || transporterName}</div>
        </div>
      </div>

      {err ? <div className="tp-error">{err}</div> : null}

      {/* Basic Information */}
      <section className="tp-card tp-card--green">
        <div className="tp-card__header">
          <span className="tp-card__icon">ℹ️</span>
          Basic Information
        </div>

        <div className="tp-card__body tp-grid tp-grid--2">
          <Field label="Transporter Name">
            {loading ? "…" : displayName}
          </Field>

          <Field label="Vehicle Type">
            {loading ? "…" : notSpecified(vehicleType)}
          </Field>

          <Field label="Contact Person">
            {loading ? "…" : notSpecified(contactPerson)}
          </Field>

          <Field label="Fleet Size">
            {loading ? "…" : notSpecified(fleetSize)}
          </Field>

          <Field label="Status">
            {loading ? "…" : <span className={statusBadgeClass(status)}>{status}</span>}
          </Field>

          <Field label="Rate Type">
            {loading ? "…" : notSpecified(rateType)}
          </Field>

          <Field label="Rating">
            {loading ? "…" : <span className="tp-badge tp-badge--pending">{rating}</span>}
          </Field>
        </div>
      </section>

      {/* Contact Information */}
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

          <Field label="Address">
            {loading ? (
              "…"
            ) : addressText ? (
              <pre className="tp-pre">{addressText}</pre>
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
        </div>
      </section>

      {/* Serviceable Locations */}
      <section className="tp-card tp-card--yellow">
        <div className="tp-card__header">
          <span className="tp-card__icon">📍</span>
          Serviceable Locations
        </div>

        <div className="tp-card__body">
          {loading ? "…" : <Chips items={serviceableLocations} emptyText="No locations" />}
        </div>
      </section>

      {/* Preferred Suppliers */}
      <section className="tp-card tp-card--darkgreen">
        <div className="tp-card__header">
          <span className="tp-card__icon">🧾</span>
          Preferred Suppliers
        </div>

        <div className="tp-card__body">
          {loading ? "…" : <Chips items={preferredSuppliers} emptyText="No preferred suppliers" />}
        </div>
      </section>

      {/* Vehicle & Service Details */}
      <section className="tp-card tp-card--gray">
        <div className="tp-card__header">
          <span className="tp-card__icon">🚚</span>
          Vehicle &amp; Service Details
        </div>

        <div className="tp-card__body tp-grid tp-grid--2">
          <Field label="Primary Vehicle Type">{loading ? "…" : notSpecified(vehicleType)}</Field>
          <Field label="Rate Type">{loading ? "…" : notSpecified(rateType)}</Field>
          <Field label="Fleet Size">{loading ? "…" : notSpecified(fleetSize)}</Field>
        </div>
      </section>

      {/* Business Information */}
      <section className="tp-card tp-card--blue">
        <div className="tp-card__header">
          <span className="tp-card__icon">💼</span>
          Business Information
        </div>

        <div className="tp-card__body tp-grid tp-grid--2">
          <Field label="License Number">{loading ? "…" : notProvided(licenseNo)}</Field>
          <Field label="Created">{loading ? "…" : formatDate(doc?.creation)}</Field>

          <Field label="Registration Number">{loading ? "…" : notProvided(regNo)}</Field>
          <Field label="Last Updated">{loading ? "…" : formatDate(doc?.modified)}</Field>

          <Field label="GSTIN">{loading ? "…" : notProvided(gstin)}</Field>
          <Field label="Created By">{loading ? "…" : (doc?.owner || "—")}</Field>

          <Field label="PAN Number">{loading ? "…" : notProvided(pan)}</Field>
        </div>
      </section>
    </div>
  );
}
