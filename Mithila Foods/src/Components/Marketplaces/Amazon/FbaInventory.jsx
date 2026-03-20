import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../../api/core';

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

    if (loading) return <div style={{ padding: '20px' }}>⏳ Loading Live FBA Inventory...</div>;
    if (error) return <div style={{ padding: '20px', color: 'red' }}>❌ Error: {error}</div>;

    return (
        <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>Amazon FBA Stock</h2>
                <button
                    onClick={() => fetchInventory()}
                    style={{ padding: '8px 16px', cursor: 'pointer', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px' }}
                >
                    ↻ Refresh
                </button>
            </div>

            <table border="1" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f9fafb', textAlign: 'left' }}>
                        <th style={{ padding: '12px' }}>Product Details</th>
                        <th style={{ padding: '12px' }}>Condition</th>
                        <th style={{ padding: '12px', color: '#10b981' }}>Fulfillable (Live)</th>
                        <th style={{ padding: '12px', color: '#3b82f6' }}>Inbound (On the way)</th>
                        <th style={{ padding: '12px', color: '#f59e0b' }}>Reserved (Transferring)</th>
                        <th style={{ padding: '12px', color: '#ef4444' }}>Unfulfillable (Damaged)</th>
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
                            <tr key={item.sellerSku} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '12px' }}>
                                    <div style={{ fontWeight: 'bold' }}>{item.sellerSku}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>ASIN: {item.asin}</div>
                                </td>
                                <td style={{ padding: '12px' }}>{item.condition}</td>
                                <td style={{ padding: '12px', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                    {details.fulfillableQuantity || 0}
                                </td>
                                <td style={{ padding: '12px' }}>{totalInbound}</td>
                                <td style={{ padding: '12px' }}>
                                    {details.reservedQuantity?.totalReservedQuantity || 0}
                                </td>
                                <td style={{ padding: '12px' }}>
                                    {details.unfulfillableQuantity?.totalUnfulfillableQuantity || 0}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {inventory.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                    No FBA inventory found.
                </div>
            )}

            {nextToken && (
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <button
                        onClick={() => fetchInventory(nextToken)}
                        disabled={loadingMore}
                        style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px' }}
                    >
                        {loadingMore ? "⏳ Loading..." : "Load More SKUs ↓"}
                    </button>
                </div>
            )}
        </div>
    );
};

export default FbaInventory;