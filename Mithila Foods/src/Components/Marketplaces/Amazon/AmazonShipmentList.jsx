import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../../api/core';
import './AmazonShipmentList.css'; 

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
        <div className="dispatch-queue-container">
            <h2>Amazon Dispatch Queue</h2>
            
            <div className="dispatch-header">
                <button 
                    className="btn-prepare"
                    disabled={selectedOrderIds.length === 0}
                    onClick={handleBulkPrepare}
                >
                    🚚 Prepare {selectedOrderIds.length} Selected Orders
                </button>
            </div>

            <div className="dispatch-table-wrapper">
                <table className="dispatch-table">
                    <thead>
                        <tr>
                            <th className="center-cell">
                                <input type="checkbox" onChange={handleSelectAll} checked={isAllSelected} />
                            </th>
                            <th>Order ID</th>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {unshippedOrders.map(order => {
                            const purchaseDate = new Date(order.PurchaseDate);
                            return (
                                <tr key={order.AmazonOrderId}>
                                    <td className="center-cell">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedOrderIds.includes(order.AmazonOrderId)}
                                            onChange={() => handleToggleSelect(order.AmazonOrderId)}
                                        />
                                    </td>
                                    <td><strong>{order.AmazonOrderId}</strong></td>
                                    <td>{purchaseDate.toLocaleDateString()}</td>
                                    <td className="time-cell">
                                        {purchaseDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                    </td>
                                    <td className="total-cell">
                                        {order.OrderTotal?.Amount} {order.OrderTotal?.CurrencyCode}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* THE NEW LOAD MORE BUTTON FOR THE SHIPPING LIST */}
            <div className="load-more-wrapper">
                <button 
                    className="btn-load-more"
                    onClick={fetchMoreUnshipped} 
                    disabled={loadingMore}
                >
                    {loadingMore 
                        ? "⏳ Scanning Amazon..." 
                        : amazonNextToken 
                            ? "Scan Next 100 Orders ↓" 
                            : "Scan Previous Oerders ↓"
                    }
                </button>
            </div>
        </div>
    );
};

export default AmazonShipmentList;