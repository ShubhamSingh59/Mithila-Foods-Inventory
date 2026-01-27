// src/Components/SupplierAndTransporter/SupplierPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import { QrCode, X } from "lucide-react"; 
import { getSuppliersForList, getSupplierStatusOptions } from "../erpBackendApi"; 
import "./SupplierPanel.css";
import SupplierTiles from "../SupplierAndTransporterDashoard/SupplierTiles"; 
import { useNavigate } from "react-router-dom";

// ------------------------------
// Helper Components & Functions
// ------------------------------

function SupplierEmailCell({ value }) {
  if (!value) return <span className="supplier-email-none">No Email</span>;
  return (
    <span className="supplier-email-pill">
      <span className="supplier-email-icon">✉️</span>
      {value}
    </span>
  );
}

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

// ------------------------------
// Image Preview Modal
// ------------------------------
function ImageModal({ src, onClose }) {
  if (!src) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>
          <X size={20} />
        </button>
        <img 
          src={src} 
          alt="Payment QR" 
          className="modal-image" 
          onError={(e) => {
            e.target.onerror = null; 
            e.target.src = "https://via.placeholder.com/300?text=Image+Load+Failed";
          }}
        />
      </div>
    </div>
  );
}

// ------------------------------
// Generic List Panel
// ------------------------------
function ListPanel({ config }) {
  // Raw Data State
  const [items, setItems] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters State
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [highlightId, setHighlightId] = useState("");

  // QR Preview State
  const [previewImage, setPreviewImage] = useState(null);

  // Column Visibility State
  const defaultKeys = useMemo(() => 
    config.columns.filter(col => col.defaultVisible).map(col => col.key),
  [config.columns]);

  const allKeys = useMemo(() => 
    config.columns.map(col => col.key),
  [config.columns]);

  const [visibleKeys, setVisibleKeys] = useState(defaultKeys);
  const [isShowingAll, setIsShowingAll] = useState(false);

  // Toggle Logic
  const toggleViewMode = () => {
    if (isShowingAll) {
      setVisibleKeys(defaultKeys);
      setIsShowingAll(false);
    } else {
      setVisibleKeys(allKeys);
      setIsShowingAll(true);
    }
  };

  // Load Data Effect
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        if (config.useStatusFilter && config.getStatusOptions) {
          const [data, statusOpts] = await Promise.all([
            config.getList(),
            config.getStatusOptions(),
          ]);
          setItems(data || []);
          setStatusOptions(statusOpts || []);
        } else {
          const data = await config.getList();
          setItems(data || []);
          setStatusOptions([]);
        }
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load list");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtering Logic
  const categoryOptions = useMemo(() => {
    if (!config.useCategoryFilter || !config.categoryField) return [];
    const set = new Set();
    (items || []).forEach((it) => {
      if (it[config.categoryField]) set.add(it[config.categoryField]);
    });
    return Array.from(set);
  }, [items, config]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (items || []).filter((it) => {
      // Status
      if (config.useStatusFilter && config.statusField && statusFilter !== "all") {
        if ((it[config.statusField] || "") !== statusFilter) return false;
      }
      // Category
      if (config.useCategoryFilter && config.categoryField && categoryFilter !== "all") {
        if ((it[config.categoryField] || "") !== categoryFilter) return false;
      }
      // Search
      if (term) {
        const haystack = [it[config.idField], ...(config.searchFields || []).map((f) => it[f])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [items, search, categoryFilter, statusFilter, config]);

  const handleRowClick = (row) => {
    const id = row[config.idField];
    setHighlightId(id);
    if (typeof config.onRowOpen === "function") {
      config.onRowOpen(row);
    }
  };

  // ✅ PROXY LOGIC FOR QR CODES
  const handleQrClick = (e, url) => {
    e.stopPropagation(); 
    
    if (!url) return;

    // 1. Get your Node Backend URL (e.g., localhost:4000) from .env
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

    // 2. Construct the Proxy URL
    // Sends the ERP relative path (e.g. /files/qr.png) to your backend
    const proxyUrl = `${BACKEND_URL}/api/proxy-image?path=${encodeURIComponent(url)}`;

    console.log("Opening QR via Proxy:", proxyUrl);
    setPreviewImage(proxyUrl);
  };

  return (
    <>
      <SupplierTiles />
      
      {/* Modal Layer */}
      {previewImage && <ImageModal src={previewImage} onClose={() => setPreviewImage(null)} />}

      {/* Controls Row */}
      <form className="supplier-search-row" onSubmit={(e) => e.preventDefault()}>
        <div className="supplier-search-input-wrapper">
          <span className="supplier-search-icon">🔍</span>
          <input
            type="text"
            className="supplier-search-input"
            placeholder={config.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {config.useCategoryFilter && categoryOptions.length > 0 && (
          <select
            className="supplier-filter-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">{config.allCategoryLabel}</option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        )}

        {config.useStatusFilter && (
          <select
            className="supplier-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            {statusOptions.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        )}

        <div className="supplier-col-menu-wrapper">
           <button 
             type="button" 
             className={`btn ${isShowingAll ? "btn-primary" : "btn-secondary"}`}
             onClick={toggleViewMode}
             style={{ minWidth: '140px' }}
           >
             {isShowingAll ? "Show Basic View" : "Show All Details"} 
             <span style={{ marginLeft: '6px' }}>{isShowingAll ? "✕" : "👁️"}</span>
           </button>
        </div>
      </form>

      {/* Header */}
      <div className="supplier-list-header">
        <div className="supplier-list-title-block">
          <h2 className="supplier-list-title">{config.title}</h2>
          <p className="supplier-list-subtitle">
            {filteredItems.length} of {items.length} {config.pluralLabel} shown
          </p>
        </div>
        <span className="supplier-count-pill">
          {items.length} {config.pluralLabel}
        </span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <div className="supplier-loading text-muted">Loading {config.pluralLabel}…</div>}

      {/* Table Area */}
      {!loading && !error && (
        <>
          {filteredItems.length === 0 ? (
            <div className="supplier-empty text-muted">
              No {config.pluralLabel} match your filters.
            </div>
          ) : (
            <div className="supplier-table-wrapper table-container">
              <table className="table supplier-table">
                <thead>
                  <tr>
                    {/* Only show ID column if config is true (it is false now) */}
                    {config.showIdColumn && <th>ID</th>}

                    {/* Filter headers based on visibleKeys */}
                    {config.columns
                      .filter(col => visibleKeys.includes(col.key))
                      .map((col) => (
                        <th key={col.header} className={col.className || ""}>
                          {col.header}
                        </th>
                    ))}
                    
                    {config.showFeatures && <th>Features</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((it) => {
                    const rowId = it[config.idField];
                    return (
                      <tr
                        key={rowId}
                        className={"supplier-row" + (rowId === highlightId ? " supplier-row-highlight" : "")}
                        onClick={() => handleRowClick(it)}
                      >
                        {config.showIdColumn && (
                          <td className="supplier-cell-id col-id">
                            {rowId}
                          </td>
                        )}

                        {/* Filter cells based on visibleKeys */}
                        {config.columns
                          .filter(col => visibleKeys.includes(col.key))
                          .map((col) => (
                            <td key={col.header} className={col.className || ""}>
                              {col.key === "custom_payment_qr" ? (
                                 // Logic for QR Column
                                 it[col.key] ? (
                                    <button 
                                      className="qr-btn" 
                                      title="View Payment QR"
                                      onClick={(e) => handleQrClick(e, it[col.key])}
                                    >
                                      <QrCode size={18} />
                                    </button>
                                 ) : <span className="text-muted" style={{fontSize:'0.8em', color:'#cbd5e1'}}>—</span>
                              ) : (
                                 // Standard Cell Render
                                 col.render ? col.render(it) : it[col.key] || "—"
                              )}
                            </td>
                        ))}

                        {config.showFeatures && (
                          <td className="supplier-cell-features col-features">
                            <span className="supplier-feature-pill">Basic</span>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ------------------------------
// CONFIGURATION
// ------------------------------
const SUPPLIER_CONFIG = {
  title: "Supplier List",
  pluralLabel: "suppliers",
  getList: getSuppliersForList,

  useCategoryFilter: true,
  categoryField: "supplier_group",
  allCategoryLabel: "All Categories",

  useStatusFilter: true,
  statusField: "custom_status",
  getStatusOptions: getSupplierStatusOptions,

  idField: "name",
  showIdColumn: false, // ID Hidden
  showFeatures: false, 

  searchPlaceholder: "Search by name, ID, phone or email…",

  searchFields: [
    "supplier_name", "name", "supplier_group", "mobile_no", "email_id",
    "custom_contact_person", "custom_status", "pan", "gstin"
  ],

  // ✅ Column Config: "defaultVisible" controls what shows initially
  columns: [
    { 
      header: "Supplier Name", 
      key: "supplier_name", 
      className: "col-supplier-name", 
      defaultVisible: true, // 1. Visible
      render: (s) => s.supplier_name || s.name || "—" 
    },
    { 
      header: "Category", 
      key: "supplier_group", 
      className: "col-category", 
      defaultVisible: true, // 2. Visible
      render: (s) => s.supplier_group || s.supplier_type || "—" 
    },
    { 
      header: "Payment QR", 
      key: "custom_payment_qr", // ✅ NEW QR COLUMN
      className: "col-qr", 
      defaultVisible: true, // 3. Visible by default
    },
    { 
      header: "Contact Person", 
      key: "custom_contact_person", 
      className: "col-contact",
      defaultVisible: true // 4. Visible
    },
    { 
      header: "Phone", 
      key: "mobile_no", 
      className: "col-phone",
      defaultVisible: true // 5. Visible
    },
    {
      header: "Primary Address",
      key: "primary_address",
      className: "col-addr",
      defaultVisible: true, // 6. Visible
      render: (s) =>
        s.primary_address ? (
          <pre className="address-pre">{htmlToPlainTextPreserveLines(s.primary_address)}</pre>
        ) : (
          "—"
        ),
    },
    
    // --- Hidden by default (Shown when "Show All Details" is clicked) ---
    { header: "Email", key: "email_id", className: "col-email", defaultVisible: false, render: (s) => <SupplierEmailCell value={s.email_id} /> },
    { header: "PAN No", key: "pan", className: "col-pan", defaultVisible: false, render: (s) => s.pan || "—" },
    { header: "GST No", key: "gstin", className: "col-gst", defaultVisible: false, render: (s) => s.gstin || "—" },
    { header: "GST Category", key: "gst_category", className: "col-gstcat", defaultVisible: false, render: (s) => s.gst_category || "—" },
    { header: "FSSAI", key: "custom_fssai", className: "col-fssai", defaultVisible: false, render: (s) => s.custom_fssai || "—" },
    { header: "MSME", key: "custom_msme", className: "col-msme", defaultVisible: false, render: (s) => (s.custom_msme === 1 || s.custom_msme === true ? "Yes" : "No") },
    { header: "UDYAM", key: "custom_udyam", className: "col-udyam", defaultVisible: false, render: (s) => s.custom_udyam || "—" },
    { header: "Bank Account", key: "default_bank_account", className: "col-bank", defaultVisible: false, render: (s) => s.default_bank_account || "—" },
    { header: "Credit Limit", key: "custom_credit_limit", className: "col-credit", defaultVisible: false, render: (s) => (s.custom_credit_limit != null ? s.custom_credit_limit : "—") },
    { header: "Custom Status", key: "custom_status", className: "col-status", defaultVisible: false },
  ],
};

export default function SupplierPanel() {
  const navigate = useNavigate();

  return (
    <ListPanel
      config={{
        ...SUPPLIER_CONFIG,
        onRowOpen: (row) => {
          const name = row?.name;
          if (!name) return;
          navigate(`/suppliers/list/${encodeURIComponent(row.name)}`);
        },
      }}
    />
  );
}