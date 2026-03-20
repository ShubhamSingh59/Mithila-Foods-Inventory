import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../../api/core';

const AmazonShipmentList = ({ onProceedToBulk }) => {
    const [unshippedOrders, setUnshippedOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    
    // Pagination State
    const [amazonNextToken, setAmazonNextToken] = useState(null);
    const [nextOffset, setNextOffset] = useState(1);

    // Selection State
    const [selectedOrderIds, setSelectedOrderIds] = useState([]);

    useEffect(() => {
        fetchInitialUnshipped();
    }, []);

    // 1. Fetch the first 100 orders
    const fetchInitialUnshipped = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${BACKEND_URL}/api/amazon/orders?offset=0`);
            const data = await response.json();
            const allOrders = data.amazonData?.Orders || [];
            
            const toShip = allOrders.filter(order => 
                order.OrderStatus === 'Unshipped' && order.FulfillmentChannel === 'MFN'
            );
            
            setUnshippedOrders(toShip);
            setAmazonNextToken(data.nextToken);
            setNextOffset(data.nextOffset);
        } catch (err) {
            console.error("❌ Error fetching unshipped orders:", err);
        } finally {
            setLoading(false);
        }
    };

    // 2. Fetch the next 100 orders (using Token or Offset)
    const fetchMoreUnshipped = async () => {
        setLoadingMore(true);
        try {
            let url = `${BACKEND_URL}/api/amazon/orders?`;
            if (amazonNextToken) {
                url += `nextToken=${encodeURIComponent(amazonNextToken)}`;
            } else {
                url += `offset=${nextOffset}`;
            }

            const response = await fetch(url);
            const data = await response.json();
            const newOrders = data.amazonData?.Orders || [];

            const moreToShip = newOrders.filter(order => 
                order.OrderStatus === 'Unshipped' && order.FulfillmentChannel === 'MFN'
            );

            setUnshippedOrders(prev => [...prev, ...moreToShip]);
            
            setAmazonNextToken(data.nextToken); 
            if (!data.nextToken) setNextOffset(data.nextOffset); 
        } catch (err) {
            console.error("Load More Error:", err);
        } finally {
            setLoadingMore(false);
        }
    };

    // --- BULK SELECTION LOGIC ---
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const allIds = unshippedOrders.map(order => order.AmazonOrderId);
            setSelectedOrderIds(allIds);
        } else {
            setSelectedOrderIds([]);
        }
    };

    const handleToggleSelect = (orderId) => {
        setSelectedOrderIds(prev => 
            prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
        );
    };

    const handleBulkPrepare = () => {
        const selectedOrders = unshippedOrders.filter(o => selectedOrderIds.includes(o.AmazonOrderId));
        onProceedToBulk(selectedOrders);
    };

    if (loading) return <div>⏳ Loading Dispatch Queue...</div>;

    const isAllSelected = unshippedOrders.length > 0 && selectedOrderIds.length === unshippedOrders.length;

    return (
        <div>
            <h2>Amazon Dispatch Queue</h2>
            
            <div style={{ marginBottom: '15px' }}>
                <button 
                    disabled={selectedOrderIds.length === 0}
                    onClick={handleBulkPrepare}
                    style={{ 
                        padding: '10px 20px', 
                        backgroundColor: selectedOrderIds.length > 0 ? '#2563eb' : '#e5e7eb',
                        color: selectedOrderIds.length > 0 ? 'white' : '#9ca3af',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: selectedOrderIds.length > 0 ? 'pointer' : 'not-allowed',
                        fontWeight: 'bold'
                    }}
                >
                    🚚 Prepare {selectedOrderIds.length} Selected Orders
                </button>
            </div>

            <table border="1" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f9fafb' }}>
                        <th style={{ padding: '12px' }}>
                            <input type="checkbox" onChange={handleSelectAll} checked={isAllSelected} />
                        </th>
                        <th align="left" style={{ padding: '12px' }}>Order ID</th>
                        <th align="left" style={{ padding: '12px' }}>Date</th>
                        <th align="left" style={{ padding: '12px' }}>Time</th>
                        <th align="left" style={{ padding: '12px' }}>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {unshippedOrders.map(order => {
                        const purchaseDate = new Date(order.PurchaseDate);
                        return (
                            <tr key={order.AmazonOrderId}>
                                <td align="center" style={{ padding: '10px' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedOrderIds.includes(order.AmazonOrderId)}
                                        onChange={() => handleToggleSelect(order.AmazonOrderId)}
                                    />
                                </td>
                                <td style={{ padding: '10px' }}><strong>{order.AmazonOrderId}</strong></td>
                                <td style={{ padding: '10px' }}>{purchaseDate.toLocaleDateString()}</td>
                                <td style={{ padding: '10px', color: '#4b5563' }}>
                                    {purchaseDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                </td>
                                <td style={{ padding: '10px', fontWeight: 'bold' }}>
                                    {order.OrderTotal?.Amount} {order.OrderTotal?.CurrencyCode}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* 💡 THE NEW LOAD MORE BUTTON FOR THE SHIPPING LIST */}
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <button 
                    onClick={fetchMoreUnshipped} 
                    disabled={loadingMore}
                    style={{ padding: '8px 16px', cursor: 'pointer' }}
                >
                    {loadingMore 
                        ? "⏳ Scanning Amazon..." 
                        : amazonNextToken 
                            ? "Scan Next 100 Orders ↓" 
                            : "Scan Previous Day ↓"
                    }
                </button>
            </div>
        </div>
    );
};

export default AmazonShipmentList;