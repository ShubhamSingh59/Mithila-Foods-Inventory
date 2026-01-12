//// src/SupplierList.jsx
//import React, { useEffect, useMemo, useState } from "react";
//import { getSuppliersForList, getSupplierStatusOptions } from "./erpBackendApi";
//import "../CSS/SupplierList.css";

//function SupplierList() {
//  const [suppliers, setSuppliers] = useState([]);
//  const [loading, setLoading] = useState(false);
//  const [error, setError] = useState("");

//  // filters
//  const [search, setSearch] = useState("");
//  const [categoryFilter, setCategoryFilter] = useState("all");
//  const [statusFilter, setStatusFilter] = useState("all"); // maps to custom_status
//  const [statusOptions, setStatusOptions] = useState([]);  // 👈 all statuses from ERP
//  const [highlightId, setHighlightId] = useState("");

//  useEffect(() => {
//    async function load() {
//      setLoading(true);
//      setError("");
//      try {
//        const [data, statusOpts] = await Promise.all([
//          getSuppliersForList(),
//          getSupplierStatusOptions(),   // 👈 read options from meta
//        ]);

//        setSuppliers(data || []);
//        setStatusOptions(statusOpts || []);
//      } catch (err) {
//        console.error(err);
//        setError(
//          err.response?.data?.error?.message ||
//            err.message ||
//            "Failed to load suppliers"
//        );
//      } finally {
//        setLoading(false);
//      }
//    }
//    load();
//  }, []);

//  // derive distinct categories from data
//  const categoryOptions = useMemo(() => {
//    const set = new Set();
//    suppliers.forEach((s) => {
//      if (s.supplier_group) set.add(s.supplier_group);
//    });
//    return Array.from(set);
//  }, [suppliers]);

//  // filtered + searched data
//  const filteredSuppliers = useMemo(() => {
//    const term = search.trim().toLowerCase();
//    return suppliers.filter((s) => {
//      // status (using custom_status, but options come from meta)
//      if (statusFilter !== "all") {
//        if ((s.custom_status || "") !== statusFilter) return false;
//      }

//      // category
//      if (categoryFilter !== "all") {
//        if ((s.supplier_group || "") !== categoryFilter) return false;
//      }

//      // search
//      if (term) {
//        const haystack = [
//          s.name,
//          s.supplier_name,
//          s.supplier_group,
//          s.mobile_no,
//          s.email_id,
//          s.custom_contact_person,
//          s.custom_status,
//        ]
//          .filter(Boolean)
//          .join(" ")
//          .toLowerCase();
//        if (!haystack.includes(term)) return false;
//      }

//      return true;
//    });
//  }, [suppliers, search, categoryFilter, statusFilter]);

//  function handleSearchSubmit(e) {
//    e.preventDefault();
//  }

//  function handleRowClick(row) {
//    setHighlightId(row.name);
//  }

//  return (
//    <div className="supplier-page">
//      {/* SEARCH BAR */}
//      <form className="supplier-search-row" onSubmit={handleSearchSubmit}>
//        <div className="supplier-search-input-wrapper">
//          <span className="supplier-search-icon">🔍</span>
//          <input
//            type="text"
//            className="supplier-search-input"
//            placeholder="Search by name, ID, phone or email…"
//            value={search}
//            onChange={(e) => setSearch(e.target.value)}
//          />
//        </div>

//        <select
//          className="supplier-filter-select"
//          value={categoryFilter}
//          onChange={(e) => setCategoryFilter(e.target.value)}
//        >
//          <option value="all">All Categories</option>
//          {categoryOptions.map((cat) => (
//            <option key={cat} value={cat}>
//              {cat}
//            </option>
//          ))}
//        </select>

//        {/* Status filter now based on *all* custom_status options from ERP meta */}
//        <select
//          className="supplier-filter-select"
//          value={statusFilter}
//          onChange={(e) => setStatusFilter(e.target.value)}
//        >
//          <option value="all">All Status</option>
//          {statusOptions.map((st) => (
//            <option key={st} value={st}>
//              {st}
//            </option>
//          ))}
//        </select>

//        <button type="submit" className="btn btn-primary supplier-search-btn">
//          Search
//        </button>
//      </form>

//      {/* HEADER ABOVE TABLE */}
//      <div className="supplier-list-header">
//        <div className="supplier-list-title-block">
//          <h2 className="supplier-list-title">Supplier List</h2>
//          <p className="supplier-list-subtitle">
//            {filteredSuppliers.length} of {suppliers.length} supplier
//            {suppliers.length !== 1 ? "s" : ""} shown
//          </p>
//        </div>

//        <span className="supplier-count-pill">
//          {suppliers.length} suppliers
//        </span>
//      </div>

//      {error && <div className="alert alert-error">{error}</div>}
//      {loading && (
//        <div className="supplier-loading text-muted">
//          Loading suppliers…
//        </div>
//      )}

//      {!loading && !error && (
//        <>
//          {filteredSuppliers.length === 0 ? (
//            <div className="supplier-empty text-muted">
//              No suppliers match your filters.
//            </div>
//          ) : (
//            <div className="supplier-table-wrapper table-container">
//              <table className="table supplier-table">
//                <thead>
//                  <tr>
//                    <th>ID</th>
//                    <th>Supplier Name</th>
//                    <th>Category</th>
//                    <th>Phone</th>
//                    <th>Email</th>
//                    <th>Contact Person</th>
//                    <th>Credit Limit</th>
//                    <th>Custom Status</th>
//                    <th>Features</th>
//                  </tr>
//                </thead>
//                <tbody>
//                  {filteredSuppliers.map((s) => {
//                    return (
//                      <tr
//                        key={s.name}
//                        className={
//                          "supplier-row" +
//                          (s.name === highlightId ? " supplier-row-highlight" : "")
//                        }
//                        onClick={() => handleRowClick(s)}
//                      >
//                        <td className="supplier-cell-id">
//                          <button
//                            type="button"
//                            className="linkish-btn"
//                            onClick={(e) => {
//                              e.stopPropagation();
//                              setHighlightId(s.name);
//                            }}
//                          >
//                            {s.name}
//                          </button>
//                        </td>
//                        <td className="supplier-cell-name">
//                          {s.supplier_name || s.name}
//                        </td>
//                        <td className="supplier-cell-category">
//                          {s.supplier_group || s.supplier_type || "—"}
//                        </td>

//                        <td className="supplier-cell-phone">
//                          {s.mobile_no || "—"}
//                        </td>
//                        <td className="supplier-cell-email">
//                          {s.email_id ? (
//                            <span className="supplier-email-pill">
//                              <span className="supplier-email-icon">✉️</span>
//                              {s.email_id}
//                            </span>
//                          ) : (
//                            <span className="supplier-email-none">No Email</span>
//                          )}
//                        </td>

//                        <td>
//                          {s.custom_contact_person || "—"}
//                        </td>

//                        <td>
//                          {s.custom_credit_limit != null
//                            ? s.custom_credit_limit
//                            : "—"}
//                        </td>

//                        <td>
//                          {s.custom_status || "—"}
//                        </td>

//                        <td className="supplier-cell-features">
//                          <span className="supplier-feature-pill">Basic</span>
//                        </td>
//                      </tr>
//                    );
//                  })}
//                </tbody>
//              </table>
//            </div>
//          )}
//        </>
//      )}
//    </div>
//  );
//}

//export default SupplierList;


// src/SupplierList.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  getSuppliersForList,
  getSupplierStatusOptions,
  getTransportersForList, // ✅ add/update in erpBackendApi.js (section 2)
} from "./erpBackendApi";
import "../CSS/SupplierList.css";

function SupplierEmailCell({ value }) {
  if (!value) return <span className="supplier-email-none">No Email</span>;
  return (
    <span className="supplier-email-pill">
      <span className="supplier-email-icon">✉️</span>
      {value}
    </span>
  );
}
// 🔧 Helper: remove HTML but keep spaces + line breaks (ERPNext address)
function htmlToPlainTextPreserveLines(html) {
  if (!html) return "";

  // Convert <br> and </p> to new lines
  const withLineBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n");

  // Strip remaining HTML safely
  const temp = document.createElement("div");
  temp.innerHTML = withLineBreaks;

  return (temp.textContent || temp.innerText || "")
    .replace(/\n\s*\n/g, "\n") // clean extra blank lines
    .trim();
}

function ListPanel({ config }) {
  const [items, setItems] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [highlightId, setHighlightId] = useState("");

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

  // category options (only if enabled)
  const categoryOptions = useMemo(() => {
    if (!config.useCategoryFilter || !config.categoryField) return [];
    const set = new Set();
    (items || []).forEach((it) => {
      if (it[config.categoryField]) set.add(it[config.categoryField]);
    });
    return Array.from(set);
  }, [items, config.useCategoryFilter, config.categoryField]);

  // filtered + searched
  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    return (items || []).filter((it) => {
      // status filter
      if (config.useStatusFilter && config.statusField && statusFilter !== "all") {
        if ((it[config.statusField] || "") !== statusFilter) return false;
      }

      // category filter
      if (config.useCategoryFilter && config.categoryField && categoryFilter !== "all") {
        if ((it[config.categoryField] || "") !== categoryFilter) return false;
      }

      // search across configured fields
      if (term) {
        const haystack = [
          it[config.idField],
          ...(config.searchFields || []).map((f) => it[f]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(term)) return false;
      }

      return true;
    });
  }, [
    items,
    search,
    categoryFilter,
    statusFilter,
    config,
  ]);

  function handleSearchSubmit(e) {
    e.preventDefault();
  }

  function handleRowClick(row) {
    setHighlightId(row[config.idField]);
  }

  return (
    <>
      {/* SEARCH / FILTERS ROW */}
      <form className="supplier-search-row" onSubmit={handleSearchSubmit}>
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

        {/* Category filter (Supplier only) */}
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

        {/* Status filter (Supplier only) */}
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

        <button type="submit" className="btn btn-primary supplier-search-btn">
          Search
        </button>
      </form>

      {/* HEADER */}
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
      {loading && (
        <div className="supplier-loading text-muted">
          Loading {config.pluralLabel}…
        </div>
      )}

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
                    {/* ID column only if enabled */}
                    {config.showIdColumn && <th>ID</th>}

                    {config.columns.map((col) => (
                      <th key={col.header} className={col.className || ""}>
                        {col.header}
                      </th>
                    ))}

                    {/* Features only if enabled */}
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
                          "supplier-row" +
                          (rowId === highlightId ? " supplier-row-highlight" : "")
                        }
                        onClick={() => handleRowClick(it)}
                      >
                        {/* ID cell */}
                        {config.showIdColumn && (
                          <td className="supplier-cell-id col-id">
                            <button
                              type="button"
                              className="linkish-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setHighlightId(rowId);
                              }}
                            >
                              {rowId}
                            </button>
                          </td>
                        )}

                        {/* Dynamic columns */}
                        {config.columns.map((col) => (
                          <td key={col.header} className={col.className || ""}>
                            {col.render ? col.render(it) : it[col.key] || "—"}
                          </td>
                        ))}

                        {/* Features */}
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

/** ✅ Supplier config (same as your current table, just structured) */
const SUPPLIER_CONFIG = {
  title: "Supplier List",
  pluralLabel: "suppliers",
  getList: getSuppliersForList,

  // Filters enabled for supplier
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
    { header: "GST Category", key: "gst_category", className: "col-gstcat", render: (s) => s.gst_category || "—" },
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

    { header: "Supplier Primary Address", key: "supplier_primary_address", className: "col-addr", render: (s) => s.supplier_primary_address || "—" },
    {
      header: "Primary Address", key: "primary_address", className: "col-addr", render: (s) =>
        s.primary_address ? (
          <pre className="address-pre">
            {htmlToPlainTextPreserveLines(s.primary_address)}
          </pre>
        ) : (
          "—"
        ),
    },

    { header: "Default Bank Account", key: "default_bank_account", className: "col-bank", render: (s) => s.default_bank_account || "—" },

    { header: "Phone", key: "mobile_no", className: "col-phone" },
    { header: "Email", key: "email_id", className: "col-email", render: (s) => <SupplierEmailCell value={s.email_id} /> },
    { header: "Contact Person", key: "custom_contact_person", className: "col-contact" },
    { header: "Credit Limit", key: "custom_credit_limit", className: "col-credit", render: (s) => (s.custom_credit_limit != null ? s.custom_credit_limit : "—") },
    { header: "Custom Status", key: "custom_status", className: "col-status" },
  ],

};

/** ✅ Transporter config (ONLY your 6 fields) */
const TRANSPORTER_CONFIG = {
  title: "Transporter List",
  pluralLabel: "transporters",
  getList: getTransportersForList,

  // No category/status filters for transporter (as per your requirement)
  useCategoryFilter: false,
  useStatusFilter: false,

  idField: "name",
  showIdColumn: false,   // ✅ hide ID (not in your field list)
  showFeatures: false,   // ✅ hide features (not in your field list)

  searchPlaceholder: "Search transporter by name, contact, address…",
  // Make search work across your 6 fields
  searchFields: [
    "transporter_name",
    "point_of_contact",
    "contact",
    "address",
    "rating",
    "working_days",
  ],

  columns: [
    { header: "Transporter Name", key: "transporter_name" },
    { header: "Point Of Contact", key: "point_of_contact" },
    { header: "Contact", key: "contact" },
    { header: "Address", key: "address" },
    { header: "Rating", key: "rating" },
    {
      header: "Working Days",
      key: "working_days",
      render: (t) => {
        const v = t.working_days;
        if (Array.isArray(v)) return v.join(", ");
        return v || "—";
      },
    },
  ],
};

function SupplierList() {
  const [activeTab, setActiveTab] = useState("suppliers");

  return (
    <div className={"supplier-page " + (activeTab === "suppliers" ? "is-suppliers" : "is-transporters")}>
      {/* Tabs */}
      <div className="theme-tabs">
        <button
          type="button"
          className={"theme-tab-btn" + (activeTab === "suppliers" ? " active" : "")}
          onClick={() => setActiveTab("suppliers")}
        >
          Suppliers
        </button>

        <button
          type="button"
          className={"theme-tab-btn" + (activeTab === "transporters" ? " active" : "")}
          onClick={() => setActiveTab("transporters")}
        >
          Transporters
        </button>
      </div>


      {/* Keep mounted so state stays when switching tabs */}
      <div style={{ display: activeTab === "suppliers" ? "block" : "none" }}>
        <ListPanel config={SUPPLIER_CONFIG} />
      </div>

      <div style={{ display: activeTab === "transporters" ? "block" : "none" }}>
        <ListPanel config={TRANSPORTER_CONFIG} />
      </div>
    </div>
  );
}

export default SupplierList;
