// src/SupplierList.jsx
import React, { useEffect, useMemo, useState } from "react";
import { getSuppliersForList, getSupplierStatusOptions } from "./erpBackendApi";
import "../CSS/SupplierList.css";

function SupplierList() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // maps to custom_status
  const [statusOptions, setStatusOptions] = useState([]);  // 👈 all statuses from ERP
  const [highlightId, setHighlightId] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [data, statusOpts] = await Promise.all([
          getSuppliersForList(),
          getSupplierStatusOptions(),   // 👈 read options from meta
        ]);

        setSuppliers(data || []);
        setStatusOptions(statusOpts || []);
      } catch (err) {
        console.error(err);
        setError(
          err.response?.data?.error?.message ||
            err.message ||
            "Failed to load suppliers"
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // derive distinct categories from data
  const categoryOptions = useMemo(() => {
    const set = new Set();
    suppliers.forEach((s) => {
      if (s.supplier_group) set.add(s.supplier_group);
    });
    return Array.from(set);
  }, [suppliers]);

  // filtered + searched data
  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return suppliers.filter((s) => {
      // status (using custom_status, but options come from meta)
      if (statusFilter !== "all") {
        if ((s.custom_status || "") !== statusFilter) return false;
      }

      // category
      if (categoryFilter !== "all") {
        if ((s.supplier_group || "") !== categoryFilter) return false;
      }

      // search
      if (term) {
        const haystack = [
          s.name,
          s.supplier_name,
          s.supplier_group,
          s.mobile_no,
          s.email_id,
          s.custom_contact_person,
          s.custom_status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      return true;
    });
  }, [suppliers, search, categoryFilter, statusFilter]);

  function handleSearchSubmit(e) {
    e.preventDefault();
  }

  function handleRowClick(row) {
    setHighlightId(row.name);
  }

  return (
    <div className="supplier-page">
      {/* SEARCH BAR */}
      <form className="supplier-search-row" onSubmit={handleSearchSubmit}>
        <div className="supplier-search-input-wrapper">
          <span className="supplier-search-icon">🔍</span>
          <input
            type="text"
            className="supplier-search-input"
            placeholder="Search by name, ID, phone or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="supplier-filter-select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All Categories</option>
          {categoryOptions.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {/* Status filter now based on *all* custom_status options from ERP meta */}
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

        <button type="submit" className="btn btn-primary supplier-search-btn">
          Search
        </button>
      </form>

      {/* HEADER ABOVE TABLE */}
      <div className="supplier-list-header">
        <div className="supplier-list-title-block">
          <h2 className="supplier-list-title">Supplier List</h2>
          <p className="supplier-list-subtitle">
            {filteredSuppliers.length} of {suppliers.length} supplier
            {suppliers.length !== 1 ? "s" : ""} shown
          </p>
        </div>

        <span className="supplier-count-pill">
          {suppliers.length} suppliers
        </span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && (
        <div className="supplier-loading text-muted">
          Loading suppliers…
        </div>
      )}

      {!loading && !error && (
        <>
          {filteredSuppliers.length === 0 ? (
            <div className="supplier-empty text-muted">
              No suppliers match your filters.
            </div>
          ) : (
            <div className="supplier-table-wrapper table-container">
              <table className="table supplier-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Supplier Name</th>
                    <th>Category</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Contact Person</th>
                    <th>Credit Limit</th>
                    <th>Custom Status</th>
                    <th>Features</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((s) => {
                    return (
                      <tr
                        key={s.name}
                        className={
                          "supplier-row" +
                          (s.name === highlightId ? " supplier-row-highlight" : "")
                        }
                        onClick={() => handleRowClick(s)}
                      >
                        <td className="supplier-cell-id">
                          <button
                            type="button"
                            className="linkish-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHighlightId(s.name);
                            }}
                          >
                            {s.name}
                          </button>
                        </td>
                        <td className="supplier-cell-name">
                          {s.supplier_name || s.name}
                        </td>
                        <td className="supplier-cell-category">
                          {s.supplier_group || s.supplier_type || "—"}
                        </td>

                        <td className="supplier-cell-phone">
                          {s.mobile_no || "—"}
                        </td>
                        <td className="supplier-cell-email">
                          {s.email_id ? (
                            <span className="supplier-email-pill">
                              <span className="supplier-email-icon">✉️</span>
                              {s.email_id}
                            </span>
                          ) : (
                            <span className="supplier-email-none">No Email</span>
                          )}
                        </td>

                        <td>
                          {s.custom_contact_person || "—"}
                        </td>

                        <td>
                          {s.custom_credit_limit != null
                            ? s.custom_credit_limit
                            : "—"}
                        </td>

                        <td>
                          {s.custom_status || "—"}
                        </td>

                        <td className="supplier-cell-features">
                          <span className="supplier-feature-pill">Basic</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SupplierList;
