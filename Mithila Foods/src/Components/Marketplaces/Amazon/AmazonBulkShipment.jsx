import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../../api/core';
import './AmazonBulkShipment.css'; 

const AmazonBulkShipment = ({ selectedOrders, onBack, onSchedule }) => {
    const [bulkData, setBulkData] = useState([]); 
    const [loading, setLoading] = useState(true);

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

    const updateRow = (orderId, field, value) => {
        setBulkData(prev => prev.map(row =>
            row.AmazonOrderId === orderId ? { ...row, [field]: value } : row
        ));
    };

    if (loading) return <div>⏳ Fetching order item details for bulk processing...</div>;

    return (
        <div className="bulk-shipment-container">
            <button className="btn-back" onClick={onBack}>← Back to List</button>
            
            <h2>Schedule pick-ups for {bulkData.length} orders</h2>

            <div className="bulk-table-wrapper">
                <table className="bulk-table">
                    <thead>
                        <tr>
                            <th className="order-details-col">Order details</th>
                            <th>Package Weight</th>
                            <th>Package Dimensions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bulkData.map((order) => (
                            <tr key={order.AmazonOrderId}>
                                {/* COLUMN 1: ORDER & SKU DETAILS */}
                                <td>
                                    <div className="bulk-order-id">{order.AmazonOrderId}</div>
                                    {order.items.map(item => (
                                        <div key={item.OrderItemId} className="bulk-item-row">
                                            <span className="bulk-item-title">{item.Title}</span> <br />
                                            SKU: {item.SellerSKU} | Qty: {item.QuantityOrdered}
                                        </div>
                                    ))}
                                </td>

                                {/* COLUMN 2: WEIGHT INPUT - UPGRADED UI */}
                                <td>
                                    <div className="weight-input-group">
                                        <input
                                            type="number"
                                            className="bulk-input-weight"
                                            value={order.weight}
                                            onChange={(e) => updateRow(order.AmazonOrderId, 'weight', e.target.value)}
                                        /> 
                                        <span className="weight-unit">g</span>
                                    </div>
                                </td>

                                {/* COLUMN 3: DIMENSION INPUTS - UPGRADED UI */}
                                <td>
                                    <select 
                                        className="bulk-select"
                                        onChange={(e) => {
                                            if (e.target.value === 'small') {
                                                updateRow(order.AmazonOrderId, 'length', 15);
                                                updateRow(order.AmazonOrderId, 'width', 10);
                                                updateRow(order.AmazonOrderId, 'height', 5);
                                            }
                                        }}
                                    >
                                        <option value="custom">Custom Dimensions</option>
                                        <option value="small">Default (15x10x5 cm)</option>
                                    </select>
                                    
                                    <div className="dim-input-group">
                                        <input 
                                            type="number" 
                                            className="bulk-input-dim"
                                            placeholder="L"
                                            value={order.length} 
                                            onChange={(e) => updateRow(order.AmazonOrderId, 'length', e.target.value)} 
                                        /> 
                                        <span className="dim-separator">×</span>
                                        <input 
                                            type="number" 
                                            className="bulk-input-dim"
                                            placeholder="W"
                                            value={order.width} 
                                            onChange={(e) => updateRow(order.AmazonOrderId, 'width', e.target.value)} 
                                        /> 
                                        <span className="dim-separator">×</span>
                                        <input 
                                            type="number" 
                                            className="bulk-input-dim"
                                            placeholder="H"
                                            value={order.height} 
                                            onChange={(e) => updateRow(order.AmazonOrderId, 'height', e.target.value)} 
                                        />
                                        <span className="dim-unit">cm</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="bulk-footer">
                <p className="bulk-warning-text">
                    Please schedule your orders by the cut-off time on the Estimated Ship Date (ESD).
                </p>
                <button
                    className="btn-schedule"
                    onClick={() => onSchedule(bulkData)} 
                >
                    Schedule Orders
                </button>
            </div>
        </div>
    );
};

export default AmazonBulkShipment;