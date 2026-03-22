import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../../api/core';
import './FbaInventory.css'; 

const FbaInventory = () => {
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [nextToken, setNextToken] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchInventory();
    }, []);

    const fetchInventory = async (tokenToUse = null) => {
        if (!tokenToUse) setLoading(true);
        else setLoadingMore(true);

        try {
            let url = `${BACKEND_URL}/api/amazon/fba-inventory`;
            if (tokenToUse) {
                url += `?nextToken=${encodeURIComponent(tokenToUse)}`;
            }

            const response = await fetch(url);
            const data = await response.json();

            if (data.status !== "Success") {
                throw new Error(data.error || "Failed to fetch inventory");
            }

            if (tokenToUse) {
                setInventory(prev => [...prev, ...data.inventory]);
            } else {
                setInventory(data.inventory);
            }

            setNextToken(data.nextToken);

        } catch (err) {
            console.error("FBA Fetch Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    if (loading) return <div className="fba-status-message">⏳ Loading Live FBA Inventory...</div>;
    if (error) return <div className="fba-error-message">❌ Error: {error}</div>;

    return (
        <div className="fba-inventory-container">
            <div className="fba-header">
                <h2 className="fba-title">Amazon FBA Stock</h2>
                <button
                    className="btn-refresh"
                    onClick={() => fetchInventory()}
                >
                    ↻ Refresh
                </button>
            </div>

            <div className="fba-table-wrapper">
                <table className="fba-table">
                    <thead>
                        <tr>
                            <th>Product Details</th>
                            <th>Condition</th>
                            <th className="col-live">Fulfillable (Live)</th>
                            <th className="col-inbound">Inbound (On the way)</th>
                            <th className="col-reserved">Reserved (Transferring)</th>
                            <th className="col-damaged">Unfulfillable (Damaged)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {inventory.map((item) => {
                            const details = item.inventoryDetails || {};

                            // Amazon splits inbound into 3 categories; we sum them up for simplicity
                            const totalInbound =
                                (details.inboundWorkingQuantity || 0) +
                                (details.inboundShippedQuantity || 0) +
                                (details.inboundReceivingQuantity || 0);

                            return (
                                <tr key={item.sellerSku}>
                                    <td>
                                        <div className="sku-primary">{item.sellerSku}</div>
                                        <div className="asin-secondary">ASIN: {item.asin}</div>
                                    </td>
                                    <td>{item.condition}</td>
                                    <td className="col-live">
                                        {details.fulfillableQuantity || 0}
                                    </td>
                                    <td className="col-inbound">{totalInbound}</td>
                                    <td className="col-reserved">
                                        {details.reservedQuantity?.totalReservedQuantity || 0}
                                    </td>
                                    <td className="col-damaged">
                                        {details.unfulfillableQuantity?.totalUnfulfillableQuantity || 0}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {inventory.length === 0 && (
                <div className="fba-status-message">
                    No FBA inventory found.
                </div>
            )}

            {nextToken && (
                <div className="load-more-container">
                    <button
                        className="btn-load-more"
                        onClick={() => fetchInventory(nextToken)}
                        disabled={loadingMore}
                    >
                        {loadingMore ? "⏳ Loading..." : "Load More SKUs ↓"}
                    </button>
                </div>
            )}
        </div>
    );
};

export default FbaInventory;