// src/Components/ItemTable.jsx
import React, { useEffect, useState } from "react";
import { getDoctypeList } from "./erpBackendApi";
import "../CSS/ItemTable.css";

const PAGE_SIZE = 20;

function ItemTable() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);

  async function loadItems({ pageIndex = 0, searchText = "" } = {}) {
    setLoading(true);
    setError("");

    const filters = [];
    if (searchText) {
      filters.push(["Item", "item_name", "like", `%${searchText}%`]);
    }

    try {
      const data = await getDoctypeList("Item", {
        fields: JSON.stringify([
          "name",
          "item_name",
          "item_group",
          "stock_uom",
          "standard_rate"
        ]),
        filters: filters.length ? JSON.stringify(filters) : undefined,
        limit_page_length: PAGE_SIZE + 1,
        limit_start: pageIndex * PAGE_SIZE,
      });

      setHasMore(data.length > PAGE_SIZE);
      setItems(data.slice(0, PAGE_SIZE));
      setPage(pageIndex);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load items");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems({ pageIndex: 0, searchText: "" });
  }, []);

  function handleSearchSubmit(e) {
    e.preventDefault();
    loadItems({ pageIndex: 0, searchText: search });
  }

  function handlePrevPage() {
    if (page === 0 || loading) return;
    loadItems({ pageIndex: page - 1, searchText: search });
  }

  function handleNextPage() {
    if (!hasMore || loading) return;
    loadItems({ pageIndex: page + 1, searchText: search });
  }

  return (
    <div className="item-table-container">
      {/* Header */}
      <div className="item-table-header-row">
        <div className="item-table-header">
          <h2 className="item-table-title">Items</h2>
          <p className="item-table-subtitle">
            Master list of items linked with ERPNext
          </p>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearchSubmit} className="search-bar">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by item name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div>
          <button type="submit" className="btn btn-primary search-btn">
            Search
          </button>
        </form>
      </div>

      {/* Meta row */}
      <div className="item-table-meta-row">
        <span className="item-table-meta">
          Page {page + 1} · Showing {items.length} item
          {items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Loading / Error */}
      {loading && (
        <p className="item-table-loading text-muted">Loading items...</p>
      )}
      {error && <p className="error-text">{error}</p>}

      {/* Table */}
      {!loading && !error && (
        <>
          {items.length === 0 ? (
            <p className="item-table-empty text-muted">No items found.</p>
          ) : (
            <div className="table-wrapper">
              <table className="item-table">
                <thead>
                  <tr>
                    <th>Code (name)</th>
                    <th>Item Name</th>
                    <th>Item Group</th>
                    <th>Unit</th>
                    <th>Standard Rate</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => (
                    <tr key={item.name}>
                      <td className="item-col-code">
                        <span className="item-code-main">{item.name}</span>
                      </td>
                      <td className="item-col-name">
                        <span className="item-name-main">
                          {item.item_name || "—"}
                        </span>
                      </td>
                      <td className="item-col-group">
                        <span className="item-group-pill">
                          {item.item_group || "—"}
                        </span>
                      </td>
                      <td className="item-col-uom">
                        <span className="item-uom-pill">
                          {item.stock_uom || "—"}
                        </span>
                      </td>
                      <td className="item-col-rate">
                        ₹ {Number(item.standard_rate || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="pagination">
            <button
              onClick={handlePrevPage}
              disabled={page === 0 || loading}
              className="page-btn"
            >
              ◀ Previous
            </button>

            <span className="pagination-text">
              Page {page + 1}
              {loading ? " (loading...)" : ""}
            </span>

            <button
              onClick={handleNextPage}
              disabled={!hasMore || loading}
              className="page-btn"
            >
              Next ▶
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default ItemTable;
