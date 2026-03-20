import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../../api/core';

const FbaLocationStock = () => {
    const [fcData, setFcData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchLocationReport();
    }, []);

    const fetchLocationReport = async () => {
        setLoading(true);
        try {
            // Hitting your Node.js backend (which handles the Amazon API stuff)
            const response = await fetch(`${BACKEND_URL}/api/amazon/fba-locations`);
            const result = await response.json();

            if (result.status !== "Success") {
                throw new Error("Failed to parse Amazon Inventory Report.");
            }

            setFcData(result.data);
        } catch (err) {
            console.error("Report Fetch Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div style={{ padding: '20px', color: '#6b7280' }}>⏳ Requesting & Parsing Amazon CSV Report...</div>;
    if (error) return <div style={{ padding: '20px', color: '#dc2626', fontWeight: 'bold' }}>❌ Error: {error}</div>;

    // Group the flat CSV data by SKU so it's easy for the warehouse manager to read
    const groupedData = fcData.reduce((acc, row) => {
        if (!acc[row.sku]) acc[row.sku] = [];
        acc[row.sku].push(row);
        return acc;
    }, {});

    return (
        <div style={{ padding: '24px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#111827' }}>Stock by Fulfillment Center (FC)</h2>
                    <p style={{ margin: '5px 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>Live warehouse distribution for FBA</p>
                </div>
                <button 
                    onClick={fetchLocationReport} 
                    style={{ padding: '8px 16px', cursor: 'pointer', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', fontWeight: '500' }}
                >
                    ↻ Refresh Data
                </button>
            </div>

            {Object.keys(groupedData).map((sku) => (
                <div key={sku} style={{ marginBottom: '32px', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ backgroundColor: '#1f2937', color: 'white', padding: '12px 16px', fontWeight: '600', letterSpacing: '0.05em' }}>
                        SKU: {sku}
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                                <th style={{ padding: '12px 16px', color: '#4b5563' }}>FC Code</th>
                                <th style={{ padding: '12px 16px', color: '#4b5563' }}>Region</th>
                                <th style={{ padding: '12px 16px', color: '#059669' }}>Fulfillable</th>
                                <th style={{ padding: '12px 16px', color: '#d97706' }}>Reserved (Transfer)</th>
                                <th style={{ padding: '12px 16px', color: '#111827' }}>Total at FC</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedData[sku].map((row, index) => (
                                <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#111827' }}>{row.fc}</td>
                                    <td style={{ padding: '12px 16px', color: '#6b7280' }}>{row.location}</td>
                                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#059669' }}>{row.fulfillable}</td>
                                    <td style={{ padding: '12px 16px', color: '#d97706' }}>{row.reserved}</td>
                                    <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#111827' }}>
                                        {row.fulfillable + row.reserved}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}
        </div>
    );
};

export default FbaLocationStock;