// src/Components/BomList.jsx
import React, { useEffect, useState } from "react";
import { getBoms } from "./erpBackendApi";
import "../CSS/BomList.css";

function BomList() {
  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await getBoms();
        setBoms(data);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load BOMs");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="bom-list">
      <div className="bom-list-header">
        <div className="bom-list-title-block">
          <h2 className="bom-list-title">Material List</h2>
          <p className="bom-list-subtitle">
            Recently created Material List and their costing
          </p>
        </div>

        <div className="bom-list-pill">
          {boms.length} BOM{boms.length !== 1 ? "s" : ""}
        </div>
      </div>

      {loading && (
        <div className="bom-list-loading text-muted">Loading BOMs...</div>
      )}
      {error && <div className="alert alert-error bom-list-error">{error}</div>}

      {!loading && !error && (
        <>
          {boms.length === 0 ? (
            <p className="bom-list-empty text-muted">No BOMs found.</p>
          ) : (
            <div className="bom-list-table-wrapper table-container">
              <table className="table bom-list-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Finished Item</th>
                    <th>Qty</th>
                    <th>Company</th>
                    <th>Active</th>
                    <th>Default</th>
                    <th>Raw Mat. Cost</th>
                    <th>Total Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {boms.map((bom) => (
                    <tr key={bom.name}>
                      <td className="bom-cell-name">{bom.name}</td>
                      <td className="bom-cell-item">{bom.item}</td>
                      <td className="bom-cell-qty">{bom.quantity}</td>
                      <td className="bom-cell-company">{bom.company}</td>
                      <td className="bom-cell-active">
                        <span
                          className={
                            "status-pill " +
                            (bom.is_active
                              ? "status-pill-green"
                              : "status-pill-gray")
                          }
                        >
                          <span className="status-dot" />
                          {bom.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="bom-cell-default">
                        <span
                          className={
                            "tag-pill " +
                            (bom.is_default
                              ? "tag-pill-primary"
                              : "tag-pill-muted")
                          }
                        >
                          {bom.is_default ? "Default" : "No"}
                        </span>
                      </td>
                      <td className="bom-cell-money">
                        ₹ {Number(bom.raw_material_cost || 0).toFixed(2)}
                      </td>
                      <td className="bom-cell-money">
                        ₹ {Number(bom.total_cost || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default BomList;
