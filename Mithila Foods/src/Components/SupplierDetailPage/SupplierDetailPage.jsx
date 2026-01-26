import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getDoc } from "../erpBackendApi";
import "./SupplierDetailPage.css";
import PurchasePayablesWidget from "../Analytics/PurchasePayablesWidget";
import PurchaseOrderPipelineWidget from "../Analytics/PurchaseOrderPipelineWidget";
import PurchaseReceiptQualityWidget from "../Analytics/PurchaseReceiptQualityWidget";

// (you already have similar in SupplierPanel)
function htmlToPlainTextPreserveLines(html) {
    if (!html) return "";
    const withLineBreaks = html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n");

    const temp = document.createElement("div");
    temp.innerHTML = withLineBreaks;

    return (temp.textContent || temp.innerText || "")
        .replace(/\n\s*\n/g, "\n")
        .trim();
}

function Field({ label, value, children }) {
    return (
        <div className="supplier-detail-field">
            <div className="supplier-detail-field__label">{label}</div>
            <div className="supplier-detail-field__value">{children ?? (value || "—")}</div>
        </div>
    );
}

export default function SupplierDetailPage() {
    //const { name } = useParams();
    //const navigate = useNavigate();

    //const supplierName = useMemo(() => {
    //    try {
    //        return decodeURIComponent(name || "");
    //    } catch {
    //        return name || "";
    //    }
    //}, [name]);

    //const [supplier, setSupplier] = useState(null);
    //const [addressDoc, setAddressDoc] = useState(null);
    //const [loading, setLoading] = useState(true);
    //const [err, setErr] = useState("");

    //useEffect(() => {
    //    let alive = true;

    //    async function load() {
    //        try {
    //            setErr("");
    //            setLoading(true);

    //            // existing API helper
    //            const sup = await getDoc("Supplier", supplierName);
    //            if (!alive) return;

    //            setSupplier(sup);

    //            // optional: load Address if supplier_primary_address exists
    //            const addrName = sup?.supplier_primary_address;
    //            if (addrName) {
    //                try {
    //                    const addr = await getDoc("Address", addrName);
    //                    if (!alive) return;
    //                    setAddressDoc(addr);
    //                } catch {
    //                    setAddressDoc(null);
    //                }
    //            } else {
    //                setAddressDoc(null);
    //            }
    //        } catch (e) {
    //            console.error(e);
    //            if (!alive) return;
    //            setErr(e?.message || "Failed to load supplier details");
    //        } finally {
    //            if (!alive) return;
    //            setLoading(false);
    //        }
    //    }

    //    if (supplierName) load();

    //    return () => {
    //        alive = false;
    //    };
    //}, [supplierName]);
    const { id } = useParams(); // ✅ was { name }
    const navigate = useNavigate();

    const supplierName = useMemo(() => {
        try {
            return decodeURIComponent(id || "");
        } catch {
            return id || "";
        }
    }, [id]);

    const [supplier, setSupplier] = useState(null);
    const [addressDoc, setAddressDoc] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    useEffect(() => {
        let alive = true;

        async function load() {
            try {
                setErr("");
                setLoading(true);

                const sup = await getDoc("Supplier", supplierName);
                if (!alive) return;

                setSupplier(sup);

                const addrName = sup?.supplier_primary_address;
                if (addrName) {
                    try {
                        const addr = await getDoc("Address", addrName);
                        if (!alive) return;
                        setAddressDoc(addr);
                    } catch {
                        setAddressDoc(null);
                    }
                } else {
                    setAddressDoc(null);
                }
            } catch (e) {
                console.error(e);
                if (!alive) return;
                setErr(e?.message || "Failed to load supplier details");
            } finally {
                if (!alive) return;
                setLoading(false);
            }
        }

        if (!supplierName) {
            setErr("Missing supplier id in URL");
            setLoading(false);
            return;
        }

        load();
        return () => {
            alive = false;
        };
    }, [supplierName]);
    const displayName = supplier?.supplier_name || supplier?.name || supplierName;

    const status = supplier?.custom_status || "—";
    const contactPerson = supplier?.custom_contact_person || "—";
    const category = supplier?.supplier_group || supplier?.supplier_type || "—";
    const creditLimit = supplier?.custom_credit_limit ?? "—";

    const phone = supplier?.mobile_no || "—";
    const email = supplier?.email_id || "—";

    const primaryAddressText = supplier?.primary_address
        ? htmlToPlainTextPreserveLines(supplier.primary_address)
        : "";

    const addressLines = useMemo(() => {
        if (!addressDoc) return [];
        const out = [];
        if (addressDoc.address_line1) out.push(addressDoc.address_line1);
        if (addressDoc.address_line2) out.push(addressDoc.address_line2);

        const cityStatePin = [addressDoc.city, addressDoc.state, addressDoc.pincode]
            .filter(Boolean)
            .join(", ");
        if (cityStatePin) out.push(cityStatePin);

        if (addressDoc.country) out.push(addressDoc.country);
        return out;
    }, [addressDoc]);

    return (
        <div id="supplier-detail-page" className="supplier-detail-page">
            <PurchasePayablesWidget supplierName={supplier?.name || supplierName} />
            <PurchaseOrderPipelineWidget supplierName={supplier?.name || supplierName}/>
            <PurchaseReceiptQualityWidget supplierName={supplier?.name || supplierName}/>
            <div className="supplier-detail-topbar">
                <button className="btn supplier-detail-back" onClick={() => navigate(-1)}>
                    ← Back
                </button>

                <div className="supplier-detail-topbar__title">
                    <div className="supplier-detail-title">{loading ? "Loading..." : displayName}</div>
                    <div className="supplier-detail-subtitle">{supplier?.name || supplierName}</div>
                </div>
            </div>

            {err ? <div className="alert alert-error">{err}</div> : null}

            {/* BASIC INFORMATION */}
            <section className="supplier-detail-card" id="supplier-basic-info">
                <div className="supplier-detail-card__header">Basic Information</div>

                <div className="supplier-detail-card__body supplier-detail-grid supplier-detail-grid--2">
                    <Field label="Supplier Name" value={loading ? "…" : displayName} />
                    <Field label="Rating" value={loading ? "…" : (supplier?.rating || supplier?.custom_rating || "—")} />

                    <Field label="Contact Person" value={loading ? "…" : contactPerson} />
                    <Field
                        label="Payment Terms"
                        value={loading ? "…" : (supplier?.payment_terms || supplier?.payment_terms_template || "—")}
                    />

                    <Field label="Category" value={loading ? "…" : category} />
                    <Field label="Credit Limit" value={loading ? "…" : String(creditLimit)} />

                    {/*<Field label="Status" value={loading ? "…" : status} />*/}
                    <Field label="Status">
                        {loading ? (
                            "…"
                        ) : (
                            <span
                                className={
                                    "supplier-detail-badge " +
                                    (String(status).toLowerCase().includes("active")
                                        ? "supplier-detail-badge--active"
                                        : String(status).toLowerCase().includes("inactive")
                                            ? "supplier-detail-badge--inactive"
                                            : String(status).toLowerCase().includes("black") ||
                                                String(status).toLowerCase().includes("block")
                                                ? "supplier-detail-badge--blocked"
                                                : "")
                                }
                            >
                                {status}
                            </span>
                        )}
                    </Field>

                </div>
            </section>

            {/* CONTACT INFORMATION */}
            <section className="supplier-detail-card" id="supplier-contact-info">
                <div className="supplier-detail-card__header">Contact Information</div>

                <div className="supplier-detail-card__body supplier-detail-grid supplier-detail-grid--2">
                    <Field label="Phone">
                        {loading ? (
                            "…"
                        ) : phone === "—" ? (
                            "—"
                        ) : (
                            <a className="supplier-detail-link" href={`tel:${phone}`}>
                                {phone}
                            </a>
                        )}
                    </Field>

                    <Field label="Address">
                        {loading ? (
                            "…"
                        ) : addressLines.length ? (
                            <div className="supplier-detail-address">
                                {addressLines.map((l, i) => (
                                    <div key={i} className="supplier-detail-address__line">
                                        {l}
                                    </div>
                                ))}
                            </div>
                        ) : primaryAddressText ? (
                            <pre className="supplier-detail-address-pre">{primaryAddressText}</pre>
                        ) : (
                            "—"
                        )}
                    </Field>

                    <Field label="Email">
                        {loading ? (
                            "…"
                        ) : email === "—" ? (
                            "—"
                        ) : (
                            <a className="supplier-detail-link" href={`mailto:${email}`}>
                                {email}
                            </a>
                        )}
                    </Field>
                </div>
            </section>

            {/* BUSINESS INFORMATION */}
            <section className="supplier-detail-card" id="supplier-business-info">
                <div className="supplier-detail-card__header">Business Information</div>

                <div className="supplier-detail-card__body supplier-detail-grid supplier-detail-grid--2">
                    <Field label="GSTIN" value={loading ? "…" : (supplier?.gstin || "Not provided")} />
                    <Field label="Created" value={loading ? "…" : (supplier?.creation || "—")} />

                    <Field label="PAN Number" value={loading ? "…" : (supplier?.pan || "Not provided")} />
                    <Field label="Last Updated" value={loading ? "…" : (supplier?.modified || "—")} />

                    <Field label="Created By" value={loading ? "…" : (supplier?.owner || "—")} />
                </div>
            </section>
        </div>
    );
}
