// src/TransporterPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import { getTransportersForList } from "../erpBackendApi";
import "./TransporterPanel.css";
import TransporterTiles from "../SupplierAndTransporterDashoard/TransporterTiles";
import { useNavigate } from "react-router-dom";


// ---------------------------------------------
// Generic ListPanel
// This renders a searchable table using a config object.
// We reuse the same structure as SupplierPanel, but with transporter fields.
// ---------------------------------------------
function ListPanel({ config }) {
  // Raw rows from backend
  const [items, setItems] = useState([]);

  // Status options are supported by this component,
  // but in transporter config we keep status filter disabled.
  const [statusOptions, setStatusOptions] = useState([]);

  // Loading and error UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Used to highlight a selected row (kept even if showIdColumn is false)
  const [highlightId, setHighlightId] = useState("");

  // ---------------------------------------------
  // Load list (and status options if enabled) on first mount
  // ---------------------------------------------
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        // If status filter is enabled, load list + status dropdown options together
        if (config.useStatusFilter && config.getStatusOptions) {
          const [data, statusOpts] = await Promise.all([
            config.getList(),
            config.getStatusOptions(),
          ]);
          setItems(data || []);
          setStatusOptions(statusOpts || []);
        } else {
          // Normal list load (transporters uses this path)
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

  // ---------------------------------------------
  // Build category dropdown values from items
  // Only used if category filter is enabled
  // ---------------------------------------------
  const categoryOptions = useMemo(() => {
    if (!config.useCategoryFilter || !config.categoryField) return [];
    const set = new Set();
    (items || []).forEach((it) => {
      if (it[config.categoryField]) set.add(it[config.categoryField]);
    });
    return Array.from(set);
  }, [items, config.useCategoryFilter, config.categoryField]);

  // ---------------------------------------------
  // Apply filters:
  // - status filter (optional)
  // - category filter (optional)
  // - search text across configured fields
  // ---------------------------------------------
  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    return (items || []).filter((it) => {
      // Status filter (disabled for transporters, but supported for reuse)
      if (config.useStatusFilter && config.statusField && statusFilter !== "all") {
        if ((it[config.statusField] || "") !== statusFilter) return false;
      }

      // Category filter (disabled for transporters, but supported for reuse)
      if (config.useCategoryFilter && config.categoryField && categoryFilter !== "all") {
        if ((it[config.categoryField] || "") !== categoryFilter) return false;
      }

      // Search filter across idField + searchFields
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

  // Prevent page refresh on form submit
  function handleSearchSubmit(e) {
    e.preventDefault();
  }

  // Highlight the row on click
  //function handleRowClick(row) {
  //  setHighlightId(row[config.idField]);
  //}
  function handleRowClick(row) {
    setHighlightId(row[config.idField]);

    if (typeof config.onRowOpen === "function") {
      config.onRowOpen(row);
    }
  }


  return (
    <>
      <TransporterTiles />
      {/* Search + filters row */}
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

        {/* Category dropdown (not used for transporters, but supported) */}
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

        {/* Status dropdown (not used for transporters, but supported) */}
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

      {/* Header with title + counts */}
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

      {/* Error and loading states */}
      {error && <div className="alert alert-error">{error}</div>}
      {loading && (
        <div className="supplier-loading text-muted">Loading {config.pluralLabel}…</div>
      )}

      {/* Table (only when not loading and no error) */}
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

                    {/* Data columns from config */}
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
                        {/* Optional ID cell (transporters disables this) */}
                        {config.showIdColumn && (
                          <td className="supplier-cell-id col-id">
                            <button
                              type="button"
                              className="linkish-btn"
                              onClick={(e) => {
                                // Prevent row click event, only highlight
                                e.stopPropagation();
                                setHighlightId(rowId);
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

                        {/* Optional features cell (transporters disables this) */}
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

// ---------------------------------------------
// Transporter configuration for ListPanel
// This decides:
// - what list to load
// - what columns to show
// - what filters are enabled
// ---------------------------------------------
const TRANSPORTER_CONFIG = {
  title: "Transporter List",
  pluralLabel: "transporters",
  getList: getTransportersForList,

  // Transporters do not need category/status filters right now
  useCategoryFilter: false,
  useStatusFilter: false,

  idField: "name",
  showIdColumn: false,
  showFeatures: false,

  searchPlaceholder: "Search transporter by name, contact, address…",
  searchFields: [
    "transporter_name",
    "point_of_contact",
    "contact",
    "address",
    "rating",
    "working_days",
  ],

  // Table columns and how to render each one
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

// ---------------------------------------------
// Exported page component
// Only job is to pass transporter config into ListPanel
// ---------------------------------------------
export default function TransporterPanel() {
  const navigate = useNavigate();

  return (
    <ListPanel
      config={{
        ...TRANSPORTER_CONFIG,
        onRowOpen: (row) => {
          const name = row?.name;
          if (!name) return;
          navigate(`/suppliers/transporters/${encodeURIComponent(row.name)}`);
        },
      }}
    />
  );
}
