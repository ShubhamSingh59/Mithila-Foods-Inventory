// src/Components/SupplierAndTransporter/SupplierDetailPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Paperclip, ExternalLink, QrCode } from "lucide-react";
import { 
  getDoc, 
  getItemsBySupplier,      // ✅ Imported New Function
  getRecentPOsBySupplier   // ✅ Imported New Function
} from "../erpBackendApi"; 
import "./SupplierDetailPage.css";

// Analytics Widgets
import PurchasePayablesWidget from "../../Components/Analytics/PurchasePayablesWidget";
import PurchaseOrderPipelineWidget from "../../Components/Analytics/PurchaseOrderPipelineWidget";
import PurchaseReceiptQualityWidget from "../../Components/Analytics/PurchaseReceiptQualityWidget";

// --- Helpers ---

// Secure Image Proxy URL generator
const getProxyUrl = (path) => {
  if (!path) return "";
  const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";
  return `${BACKEND}/api/proxy-image?path=${encodeURIComponent(path)}`;
};

function htmlToPlainTextPreserveLines(html) {
  if (!html) return "";
  const temp = document.createElement("div");
  temp.innerHTML = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n");
  return (temp.textContent || temp.innerText || "").replace(/\n\s*\n/g, "\n").trim();
}

function Field({ label, value, children, fullWidth }) {
  return (
    <div className="supplier-detail-field" style={fullWidth ? { gridColumn: "1 / -1" } : {}}>
      <div className="supplier-detail-field__label">{label}</div>
      <div className="supplier-detail-field__value">{children ?? (value || "—")}</div>
    </div>
  );
}

function AttachmentField({ label, fileUrl }) {
  if (!fileUrl) return <Field label={label} value="Not Attached" />;
  const proxyLink = getProxyUrl(fileUrl);
  return (
    <Field label={label}>
      <div className="attachment-row">
        <div className="attachment-name">
          <Paperclip size={16} />
          <span>Document Attached</span>
        </div>
        <a href={proxyLink} target="_blank" rel="noopener noreferrer" className="attachment-btn">
          View <ExternalLink size={12} style={{ marginLeft: 4 }}/>
        </a>
      </div>
    </Field>
  );
}

export default function SupplierDetailPage() {
  const { id } = useParams(); 
  const navigate = useNavigate();
  const supplierName = useMemo(() => decodeURIComponent(id || ""), [id]);

  // --- State ---
  const [supplier, setSupplier] = useState(null);
  const [items, setItems] = useState([]);        // ✅ State for Items
  const [recentPOs, setRecentPOs] = useState([]); // ✅ State for Recent POs
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setErr("");
        setLoading(true);

        // 1. Fetch Main Supplier Doc
        const sup = await getDoc("Supplier", supplierName);
        if (!alive) return;
        setSupplier(sup);

        // 2. Fetch Items Supplied (Using our new helper)
        try {
          const fetchedItems = await getItemsBySupplier(supplierName);
          if (alive) setItems(fetchedItems || []);
        } catch (e) {
          console.warn("Failed to fetch supplier items", e);
        }

        // 3. Fetch Recent POs (Using our new helper)
        try {
          const pos = await getRecentPOsBySupplier(supplierName);
          if (alive) setRecentPOs(pos || []);
        } catch (e) {
          console.warn("Failed to fetch recent POs", e);
        }

      } catch (e) {
        console.error(e);
        if (alive) setErr(e?.message || "Failed to load supplier details");
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (supplierName) load();
    return () => { alive = false; };
  }, [supplierName]);

  const displayName = supplier?.supplier_name || supplier?.name || supplierName;
  const status = supplier?.custom_status || "—";
  const primaryAddress = supplier?.primary_address ? htmlToPlainTextPreserveLines(supplier.primary_address) : "—";

  return (
    <div className="supplier-detail-page">
      
      {/* --- ANALYTICS --- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
         <PurchasePayablesWidget supplierName={supplierName} />
         <PurchaseOrderPipelineWidget supplierName={supplierName} />
         <PurchaseReceiptQualityWidget supplierName={supplierName} />
      </div>

      {/* --- HEADER --- */}
      <div className="supplier-detail-topbar">
        <button className="btn supplier-detail-back" onClick={() => navigate(-1)}>← Back</button>
        <div className="supplier-detail-topbar__title">
          <div className="supplier-detail-title">{loading ? "Loading..." : displayName}</div>
          <div className="supplier-detail-subtitle">{supplierName}</div>
        </div>
      </div>

      {err && <div className="alert alert-error">{err}</div>}

      {/* --- INFO SECTIONS --- */}
      <div className="supplier-detail-grid supplier-detail-grid--2">
        {/* Left: General */}
        <section className="supplier-detail-card">
          <div className="supplier-detail-card__header">Identity & Contact</div>
          <div className="supplier-detail-card__body supplier-detail-grid supplier-detail-grid--2">
             <Field label="Supplier Name" value={displayName} fullWidth />
             <Field label="Supplier ID" value={supplier?.name} />
             <Field label="Type" value={supplier?.supplier_type} />
             <Field label="Status">
                <span className={`supplier-detail-badge ${
                   String(status).toLowerCase().includes('active') ? 'supplier-detail-badge--active' : 
                   String(status).toLowerCase().includes('inactive') ? 'supplier-detail-badge--inactive' : 'supplier-detail-badge--blocked'
                }`}>{status}</span>
             </Field>
             <Field label="Rating" value={supplier?.custom_rating || supplier?.rating} />
             <Field label="Contact Person" value={supplier?.custom_contact_person} />
             <Field label="Phone" value={supplier?.mobile_no} />
             <Field label="Email" value={supplier?.email_id} fullWidth />
             <Field label="Address" value={primaryAddress} fullWidth />
             <Field label="Country" value={supplier?.country} />
          </div>
        </section>

        {/* Right: Financials */}
        <section className="supplier-detail-card">
          <div className="supplier-detail-card__header">Financials & Compliance</div>
          <div className="supplier-detail-card__body supplier-detail-grid supplier-detail-grid--2">
             <Field label="GSTIN" value={supplier?.gstin} />
             <Field label="PAN Number" value={supplier?.pan} />
             <Field label="GST Category" value={supplier?.gst_category} />
             <Field label="Tax ID" value={supplier?.tax_id} />
             <Field label="MSME Reg." value={supplier?.custom_msme} />
             <Field label="Udyam Reg." value={supplier?.custom_udyam} />
             <Field label="FSSAI Lic." value={supplier?.custom_fssai} />
             <Field label="Payment Terms" value={supplier?.payment_terms} />
             <Field label="Credit Limit" value={supplier?.custom_credit_limit} />
             <Field label="Default Bank" value={supplier?.default_bank_account} />
          </div>
        </section>
      </div>

      {/* --- ATTACHMENTS & QR --- */}
      <section className="supplier-detail-card">
         <div className="supplier-detail-card__header">Documents & Payment QR</div>
         <div className="supplier-detail-card__body supplier-detail-grid supplier-detail-grid--3">
            <div style={{ gridColumn: 'span 1' }}>
               <Field label="Payment QR Code">
                  {supplier?.custom_payment_qr ? (
                     <div className="qr-preview-container">
                        <img 
                           src={getProxyUrl(supplier.custom_payment_qr)} 
                           alt="QR Code" 
                           className="qr-thumbnail"
                           onClick={() => window.open(getProxyUrl(supplier.custom_payment_qr), "_blank")}
                        />
                        <div style={{fontSize:'0.8rem', color:'#64748b', marginTop:8}}>Click to enlarge</div>
                     </div>
                  ) : "No QR Code"}
               </Field>
            </div>
            <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
               <AttachmentField label="GST Certificate" fileUrl={supplier?.custom_gst_attach} />
               <AttachmentField label="PAN Card" fileUrl={supplier?.custom_pancard_attach} />
               <AttachmentField label="MSME Certificate" fileUrl={supplier?.custom_msme_attach} />
               <AttachmentField label="FSSAI License" fileUrl={supplier?.custom_fssai_attach} />
            </div>
         </div>
      </section>

      {/* --- ✅ NEW SECTION: ITEMS & RECENT ORDERS --- */}
      <div className="supplier-detail-grid supplier-detail-grid--2">
         
         {/* 1. Items Supplied Table */}
         <section className="supplier-detail-card">
            <div className="supplier-detail-card__header">Items Supplied ({items.length})</div>
            <div className="supplier-detail-card__body" style={{padding:0}}>
               <table className="simple-table">
                  <thead>
                     <tr>
                        {/*<th>Item Code</th>*/}
                        <th>Item Name</th>
                        <th>UOM</th>
                     </tr>
                  </thead>
                  <tbody>
                     {items.length > 0 ? items.map(item => (
                        <tr key={item.name}>
                           {/*<td style={{fontFamily:'monospace', fontWeight:500, color:'#2563eb'}}>{item.name}</td>*/}
                           <td>{item.item_name}</td>
                           <td>{item.stock_uom}</td>
                        </tr>
                     )) : (
                        <tr><td colSpan={3} style={{textAlign:'center', padding:20, color:'#94a3b8'}}>No items linked in purchasing tab</td></tr>
                     )}
                  </tbody>
               </table>
            </div>
         </section>

         {/* 2. Recent Purchase Orders Table */}
         <section className="supplier-detail-card">
            <div className="supplier-detail-card__header">Recent Orders</div>
            <div className="supplier-detail-card__body" style={{padding:0}}>
               <table className="simple-table">
                  <thead>
                     <tr>
                        <th>PO #</th>
                        <th>Date</th>
                        <th style={{width: '35%'}}>Items</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>MF Status</th>
                     </tr>
                  </thead>
                  <tbody>
                     {recentPOs.length > 0 ? recentPOs.map(po => (
                        <tr key={po.name}>
                           <td style={{color:'#2563eb', cursor:'pointer', fontWeight:500}} onClick={() => navigate(`/purchase-order/${po.name}`)}>
                              {po.name}
                           </td>
                           <td>{po.transaction_date}</td>
                           <td style={{fontSize:'0.85rem', color:'#475569'}}>
                              {po._items_display}
                           </td>
                           <td style={{fontWeight:600}}>{Number(po.grand_total).toLocaleString()}</td>
                           <td>
                              <span style={{
                                 fontSize:'0.75rem', padding:'2px 6px', borderRadius:4,
                                 background: po.status === 'Completed' ? '#dcfce7' : '#f1f5f9',
                                 color: po.status === 'Completed' ? '#166534' : '#475569'
                              }}>
                                 {po.status}
                              </span>
                           </td>
                           <td style={{fontSize:'0.85rem'}}>{po.custom_mf_status || "—"}</td>
                        </tr>
                     )) : (
                        <tr><td colSpan={5} style={{textAlign:'center', padding:20, color:'#94a3b8'}}>No recent orders</td></tr>
                     )}
                  </tbody>
               </table>
            </div>
         </section>

      </div>
    </div>
  );
}