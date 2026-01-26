// src/SupplierPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import { getSuppliersForList, getSupplierStatusOptions } from "../erpBackendApi";
import "./SupplierPanel.css";
import SupplierTiles from "../SupplierAndTransporterDashoard/SupplierTiles";
import { useNavigate } from "react-router-dom";
import PurchasePayablesWidget from "../Analytics/PurchasePayablesWidget";
import PurchaseOrderPipelineWidget from "../Analytics/PurchaseOrderPipelineWidget";
import PurchaseReceiptQualityWidget from "../Analytics/PurchaseReceiptQualityWidget";
import SuppliersSpendingBarWidget from "../Analytics/SuppliersSpendingBarWidget";

// ------------------------------
// Small cell component to display supplier email in a clean way
// If email is missing, show "No Email"
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

// ------------------------------
// Helper: ERPNext address fields sometimes contain HTML
// This function converts HTML into plain text while keeping line breaks
// Example: <br> or </p> becomes a new line
// ------------------------------
function htmlToPlainTextPreserveLines(html) {
  if (!html) return "";

  // Convert common HTML line breaks into "\n"
  const withLineBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n");

  // Use a temporary DOM element to strip remaining HTML tags safely
  const temp = document.createElement("div");
  temp.innerHTML = withLineBreaks;

  // Cleanup extra empty lines and trim spaces
  return (temp.textContent || temp.innerText || "")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}

// ------------------------------
// Generic list panel that can render a table using a config object
// This same component can be reused for suppliers, transporters, etc.
// ------------------------------
function ListPanel({ config }) {
  // Raw list from backend
  const [items, setItems] = useState([]);

  // Dropdown options for status filter (only used when enabled)
  const [statusOptions, setStatusOptions] = useState([]);

  // Loading/error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // UI filter states
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Track which row was clicked last (for highlight)
  const [highlightId, setHighlightId] = useState("");

  // ------------------------------
  // Load data once when component mounts
  // If status filter is enabled, load list + status options together
  // ------------------------------
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
        setError(
          err.response?.data?.error?.message ||
          err.message ||
          `Failed to load ${config.pluralLabel}`
        );
      } finally {
        setLoading(false);
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------
  // Build category dropdown options from loaded items
  // Only runs when category filtering is enabled
  // ------------------------------
  const categoryOptions = useMemo(() => {
    if (!config.useCategoryFilter || !config.categoryField) return [];
    const set = new Set();
    (items || []).forEach((it) => {
      if (it[config.categoryField]) set.add(it[config.categoryField]);
    });
    return Array.from(set);
  }, [items, config.useCategoryFilter, config.categoryField]);

  // ------------------------------
  // Apply filters:
  // - status filter (optional)
  // - category filter (optional)
  // - search text across configured fields
  // ------------------------------
  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    return (items || []).filter((it) => {
      // Status filter
      if (config.useStatusFilter && config.statusField && statusFilter !== "all") {
        if ((it[config.statusField] || "") !== statusFilter) return false;
      }

      // Category filter
      if (config.useCategoryFilter && config.categoryField && categoryFilter !== "all") {
        if ((it[config.categoryField] || "") !== categoryFilter) return false;
      }

      // Search filter
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

  // Search submit is kept mainly to prevent full page refresh
  function handleSearchSubmit(e) {
    e.preventDefault();
  }

  // When a row is clicked, highlight it
  //function handleRowClick(row) {
  //  setHighlightId(row[config.idField]);
  //}
  function handleRowClick(row) {
    const id = row[config.idField];
    setHighlightId(id);

    if (typeof config.onRowOpen === "function") {
      config.onRowOpen(row);
    }
  }

  return (
    <>
      <SupplierTiles />
      {/* ==============================
          SEARCH + FILTERS ROW
         ============================== */}
      <form className="supplier-search-row" onSubmit={handleSearchSubmit}>
        {/* Search input */}
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

        {/* Category filter dropdown (enabled only if config says so) */}
        {config.useCategoryFilter && categoryOptions.length > 0 && (
          <select
            className="supplier-filter-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">{config.allCategoryLabel}</option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        )}

        {/* Status filter dropdown (enabled only if config says so) */}
        {config.useStatusFilter && (
          <select
            className="supplier-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            {statusOptions.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        )}

        {/* Search button (optional, because search is live anyway) */}
        <button type="submit" className="btn btn-primary supplier-search-btn">
          Search
        </button>
      </form>

      {/* ==============================
          HEADER (title + counts)
         ============================== */}
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

      {/* Error message */}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Loading message */}
      {loading && <div className="supplier-loading text-muted">Loading {config.pluralLabel}…</div>}

      {/* Table / Empty state */}
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
                    {/* Optional ID column */}
                    {config.showIdColumn && <th>ID</th>}

                    {/* Data columns configured in SUPPLIER_CONFIG */}
                    {config.columns.map((col) => (
                      <th key={col.header} className={col.className || ""}>
                        {col.header}
                      </th>
                    ))}

                    {/* Optional features column */}
                    {config.showFeatures && <th>Features</th>}
                  </tr>
                </thead>

                <tbody>
                  {filteredItems.map((it) => {
                    const rowId = it[config.idField];

                    return (
                      <tr
                        key={rowId}
                        className={
                          "supplier-row" + (rowId === highlightId ? " supplier-row-highlight" : "")
                        }
                        onClick={() => handleRowClick(it)}
                      >
                        {/* Optional ID cell */}
                        {config.showIdColumn && (
                          <td className="supplier-cell-id col-id">
                            <button
                              type="button"
                              className="linkish-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setHighlightId(rowId);

                                if (typeof config.onRowOpen === "function") {
                                  config.onRowOpen(it);
                                }
                              }}

                            >
                              {rowId}
                            </button>
                          </td>
                        )}

                        {/* Render each configured column */}
                        {config.columns.map((col) => (
                          <td key={col.header} className={col.className || ""}>
                            {col.render ? col.render(it) : it[col.key] || "—"}
                          </td>
                        ))}

                        {/* Optional features cell */}
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
// Supplier screen configuration
// This tells ListPanel what to load, what columns to show, and what filters to enable
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
  showIdColumn: true,
  showFeatures: true,

  searchPlaceholder: "Search by name, ID, phone or email…",

  // Fields used for search (combined into one searchable text)
  searchFields: [
    "supplier_name",
    "name",
    "supplier_group",
    "mobile_no",
    "email_id",
    "custom_contact_person",
    "custom_status",
    "pan",
    "gstin",
    "gst_category",
    "supplier_primary_address",
    "primary_address",
    "default_bank_account",
    "custom_fssai",
    "custom_msme",
    "custom_udyam",
  ],

  // Table columns and how each column is displayed
  columns: [
    {
      header: "Supplier Name",
      key: "supplier_name",
      className: "col-supplier-name",
      render: (s) => s.supplier_name || s.name || "—",
    },
    {
      header: "Category",
      key: "supplier_group",
      className: "col-category",
      render: (s) => s.supplier_group || s.supplier_type || "—",
    },

    { header: "PAN No", key: "pan", className: "col-pan", render: (s) => s.pan || "—" },
    { header: "GST No", key: "gstin", className: "col-gst", render: (s) => s.gstin || "—" },
    {
      header: "GST Category",
      key: "gst_category",
      className: "col-gstcat",
      render: (s) => s.gst_category || "—",
    },
    { header: "FSSAI", key: "custom_fssai", className: "col-fssai", render: (s) => s.custom_fssai || "—" },
    {
      header: "MSME",
      key: "custom_msme",
      className: "col-msme",
      render: (s) => {
        const v = s.custom_msme;
        return v === 1 || v === true || v === "1" ? "Yes" : "No";
      },
    },
    { header: "UDYAM", key: "custom_udyam", className: "col-udyam", render: (s) => s.custom_udyam || "—" },

    {
      header: "Supplier Primary Address",
      key: "supplier_primary_address",
      className: "col-addr",
      render: (s) => s.supplier_primary_address || "—",
    },
    {
      header: "Primary Address",
      key: "primary_address",
      className: "col-addr",
      render: (s) =>
        s.primary_address ? (
          <pre className="address-pre">{htmlToPlainTextPreserveLines(s.primary_address)}</pre>
        ) : (
          "—"
        ),
    },

    {
      header: "Default Bank Account",
      key: "default_bank_account",
      className: "col-bank",
      render: (s) => s.default_bank_account || "—",
    },

    { header: "Phone", key: "mobile_no", className: "col-phone" },
    {
      header: "Email",
      key: "email_id",
      className: "col-email",
      render: (s) => <SupplierEmailCell value={s.email_id} />,
    },
    { header: "Contact Person", key: "custom_contact_person", className: "col-contact" },
    {
      header: "Credit Limit",
      key: "custom_credit_limit",
      className: "col-credit",
      render: (s) => (s.custom_credit_limit != null ? s.custom_credit_limit : "—"),
    },
    { header: "Custom Status", key: "custom_status", className: "col-status" },
  ],
};

// ------------------------------
// Exported screen component
// Only job is to pass supplier config into the generic ListPanel
// ------------------------------
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
