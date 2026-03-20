import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../../api/core';

const AmazonBulkShipment = ({ selectedOrders, onBack,  onSchedule}) => {
    const [bulkData, setBulkData] = useState([]); // This will hold [order + items + inputs]
    const [loading, setLoading] = useState(true);

    // 1. Fetch items for all selected orders as soon as the page loads
    useEffect(() => {
        const fetchAllItems = async () => {
            setLoading(true);
            const enrichedOrders = [];

            for (const order of selectedOrders) {
                try {
                    const res = await fetch(`${BACKEND_URL}/api/amazon/order-items/${order.AmazonOrderId}`);
                    const data = await res.json();

                    enrichedOrders.push({
                        ...order,
                        items: data.items || [],
                        // DEFAULT INPUTS for the warehouse worker
                        weight: 500,
                        length: 15,
                        width: 10,
                        height: 5
                    });
                } catch (e) { console.error("Error fetching items", e); }
            }
            setBulkData(enrichedOrders);
            setLoading(false);
        };
        fetchAllItems();
    }, [selectedOrders]);

    // Update specific row input
    const updateRow = (orderId, field, value) => {
        setBulkData(prev => prev.map(row =>
            row.AmazonOrderId === orderId ? { ...row, [field]: value } : row
        ));
    };

    if (loading) return <div>⏳ Fetching order item details for bulk processing...</div>;

    return (
        <div>
            <button onClick={onBack}>← Back to List</button>
            <h2>Schedule pick-ups for {bulkData.length} orders</h2>

            <table border="1" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
                <thead style={{ backgroundColor: '#f4f4f4' }}>
                    <tr>
                        <th align="left" style={{ width: '40%' }}>Order details</th>
                        <th align="left">Package Weight</th>
                        <th align="left">Package Dimensions</th>
                    </tr>
                </thead>
                <tbody>
                    {bulkData.map((order) => (
                        <tr key={order.AmazonOrderId}>
                            {/* COLUMN 1: ORDER & SKU DETAILS */}
                            <td valign="top">
                                <div style={{ marginBottom: '5px', color: '#0066c0' }}>{order.AmazonOrderId}</div>
                                {order.items.map(item => (
                                    <div key={item.OrderItemId} style={{ fontSize: '0.85rem', marginBottom: '10px' }}>
                                        <strong>{item.Title}</strong> <br />
                                        SKU: {item.SellerSKU} | Qty: {item.QuantityOrdered}
                                    </div>
                                ))}
                            </td>

                            {/* COLUMN 2: WEIGHT INPUT */}
                            <td valign="top">
                                <input
                                    type="number"
                                    value={order.weight}
                                    onChange={(e) => updateRow(order.AmazonOrderId, 'weight', e.target.value)}
                                    style={{ width: '80px' }}
                                /> g
                            </td>

                            {/* COLUMN 3: DIMENSION INPUTS */}
                            <td valign="top">
                                <select onChange={(e) => {
                                    // Simulating the "Package Settings" logic in the screenshot
                                    if (e.target.value === 'small') {
                                        updateRow(order.AmazonOrderId, 'length', 15);
                                        updateRow(order.AmazonOrderId, 'width', 10);
                                        updateRow(order.AmazonOrderId, 'height', 5);
                                    }
                                }}>
                                    <option value="custom">Custom Dimensions</option>
                                    <option value="small">Default (15x10x5 cm)</option>
                                </select>
                                <div style={{ marginTop: '10px' }}>
                                    <input type="number" value={order.length} onChange={(e) => updateRow(order.AmazonOrderId, 'length', e.target.value)} style={{ width: '40px' }} /> x
                                    <input type="number" value={order.width} onChange={(e) => updateRow(order.AmazonOrderId, 'width', e.target.value)} style={{ width: '40px' }} /> x
                                    <input type="number" value={order.height} onChange={(e) => updateRow(order.AmazonOrderId, 'height', e.target.value)} style={{ width: '40px' }} /> cm
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div style={{ marginTop: '30px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
                <p style={{ fontSize: '0.8rem' }}>
                    Please schedule your orders by the cut-off time on the Estimated Ship Date (ESD).
                </p>
                {/* This button will trigger the logic to loop through all bulkData rows 
                    and call /shipping-quotes and /create-shipment for each. 
                */}
                <button
                    style={{ backgroundColor: '#ffd814', border: '1px solid #fcd200', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}
                    onClick={() => onSchedule(bulkData)} // 💡 Pass the configured bulkData up!
                >
                    Schedule Orders
                </button>
            </div>
        </div>
    );
};

export default AmazonBulkShipment;