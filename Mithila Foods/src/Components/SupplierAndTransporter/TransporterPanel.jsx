//tansporterpanle.jsx
import React, { useEffect, useMemo, useState } from "react";
import { getTransportersForList } from "../api/master";
import "./TransporterPanel.css";
import TransporterTiles from "../SupplierAndTransporterDashoard/TransporterTiles";
import { useNavigate } from "react-router-dom";


function ListPanel({ config }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [highlightId, setHighlightId] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await config.getList();
        setItems(data || []);
      } catch (err) {
        console.error(err);
        setError(err.message || `Failed to load ${config.pluralLabel}`);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [config]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((it) => {
      if (!term) return true;
      const haystack = [
        it[config.idField],
        ...(config.searchFields || []).map((f) => it[f]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [items, search, config]);

  const handleRowClick = (row) => {
    setHighlightId(row[config.idField]);
    if (typeof config.onRowOpen === "function") {
      config.onRowOpen(row);
    }
  };

  return (
    <>
      <TransporterTiles />
      
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
      </form>

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
        <div className="supplier-loading text-muted">Loading {config.pluralLabel}…</div>
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
                    {config.columns.map((col) => (
                      <th key={col.header} className={col.className || ""}>
                        {col.header}
                      </th>
                    ))}
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
                        {config.columns.map((col) => (
                          <td key={col.header} className={col.className || ""}>
                            {col.render ? col.render(it) : it[col.key] || "—"}
                          </td>
                        ))}
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


const TRANSPORTER_CONFIG = {
  title: "Transporter List",
  pluralLabel: "transporters",
  getList: getTransportersForList,

  idField: "name", 
  showIdColumn: false,
  showFeatures: false,

  searchPlaceholder: "Search by name, contact, vehicle type...",
  searchFields: [
    "supplier_name",
    "custom_contact_person",
    "mobile_no",
    "primary_address",
    "custom_vehicle_type",
    "custom_service_areas", 
  ],

  columns: [
    {
      header: "Transporter Name",
      key: "supplier_name",
      render: (t) => t.supplier_name || t.name,
    },
    {
      header: "Point Of Contact",
      key: "custom_contact_person",
    },
    {
      header: "Contact",
      key: "mobile_no",
    },
    {
      header: "Vehicle Type",
      key: "custom_vehicle_type", 
    },
    { 
      header: "Service Areas", 
      key: "custom_service_areas",
      render: (t) => {
        const areas = t.custom_service_areas || [];
        if (!areas.length) return "—";
        
        // Show first 2 cities, then +X more
        const cityNames = areas.map(r => r.city).filter(Boolean);
        if (cityNames.length <= 2) return cityNames.join(", ");
        return `${cityNames.slice(0, 2).join(", ")} +${cityNames.length - 2}`;
      }
    },
    {
      header: "Status",
      key: "custom_status",
      render: (t) => (
        <span
          className={`tp-badge ${
            (t.custom_status || "").toLowerCase() === "active"
              ? "tp-badge--active"
              : "tp-badge--inactive"
          }`}
        >
          {t.custom_status || "—"}
        </span>
      ),
    },
  ],
};

export default function TransporterPanel() {
  const navigate = useNavigate();

  return (
    <ListPanel
      config={{
        ...TRANSPORTER_CONFIG,
        onRowOpen: (row) => {
          const name = row?.name;
          if (!name) return;
          navigate(`/suppliers/directory/transporters/${encodeURIComponent(row.name)}`);
        },
      }}
    />
  );
}