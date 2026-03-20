//import React, { useState, useEffect } from 'react';
//import { BACKEND_URL } from '../../api/core';

//const AmazonOrders = () => {
//    const [orders, setOrders] = useState([]);
//    const [loading, setLoading] = useState(true);
//    const [loadingMore, setLoadingMore] = useState(false);
//    const [error, setError] = useState(null);
//    const [syncTime, setSyncTime] = useState('');

//    // Custom Pagination State
//    const [nextOffset, setNextOffset] = useState(1);

//    // Filtering & UI State
//    const [activeTab, setActiveTab] = useState('All');
//    const [expandedOrderId, setExpandedOrderId] = useState(null);
//    const [orderItems, setOrderItems] = useState({});
//    const [loadingItems, setLoadingItems] = useState(false);

//    useEffect(() => {
//        fetchOrders(); // Initial fetch (Last 3 days)
//    }, []);

//    // Fetch initial batch (Offset 0)
//    const fetchOrders = async () => {
//        setLoading(true);
//        try {
//            const response = await fetch(`${BACKEND_URL}/api/amazon/orders?offset=0`);
//            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

//            const data = await response.json();
//            const orderArray = data.amazonData?.Orders || [];

//            setOrders(orderArray);
//            setNextOffset(data.nextOffset); // Prepares the button for offset 3
//            setSyncTime(new Date().toLocaleString());
//        } catch (err) {
//            console.error("Fetch Error:", err);
//            setError(err.message);
//        } finally {
//            setLoading(false);
//        }
//    };

//    // Fetch older records (Previous 3 days)
//    const fetchMoreOrders = async () => {
//        setLoadingMore(true);
//        try {
//            const response = await fetch(`${BACKEND_URL}/api/amazon/orders?offset=${nextOffset}`);
//            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

//            const data = await response.json();
//            const newOrders = data.amazonData?.Orders || [];

//            // Stack older orders underneath the newer ones
//            setOrders(prevOrders => [...prevOrders, ...newOrders]);
//            setNextOffset(data.nextOffset); // Increments by 3 for the next click
//        } catch (err) {
//            console.error("Load More Error:", err);
//            alert("Failed to load older orders.");
//        } finally {
//            setLoadingMore(false);
//        }
//    };

//    const handleToggleItems = async (orderId) => {
//        if (expandedOrderId === orderId) {
//            setExpandedOrderId(null);
//            return;
//        }

//        setExpandedOrderId(orderId);

//        if (!orderItems[orderId]) {
//            setLoadingItems(true);
//            try {
//                const response = await fetch(`${BACKEND_URL}/api/amazon/order-items/${orderId}`);
//                const data = await response.json();

//                const itemsArray = data.items?.payload?.OrderItems || data.items?.OrderItems || [];
//                setOrderItems(prev => ({ ...prev, [orderId]: itemsArray }));
//            } catch (err) {
//                console.error("Failed to fetch items:", err);
//            } finally {
//                setLoadingItems(false);
//            }
//        }
//    };

//    const filteredOrders = orders.filter(order => {
//        if (activeTab === 'All') return true;
//        return order.OrderStatus === activeTab;
//    });

//    const getStatusClass = (status) => {
//        if (status === 'Shipped') return 'paid';
//        if (status === 'Unshipped' || status === 'Pending') return 'unpaid';
//        if (status === 'Canceled') return 'draft';
//        return 'draft';
//    };

//    const getFulfillmentLabel = (channel) => {
//        return channel === 'AFN' ? 'Amazon FBA' : 'Easy Ship';
//    };

//    if (loading) {
//        return (
//            <div className="sales-order">
//                <div className="sales-recent-loading text-muted text-center">
//                    <p>⏳ Syncing recent orders from Amazon...</p>
//                </div>
//            </div>
//        );
//    }

//    return (
//        <div className="sales-order">

//            <div className="sales-header">
//                <div className="sales-title-block">
//                    <h2 className="sales-title">Amazon Operations</h2>
//                    <p className="sales-subtitle">
//                        Last Sync: {syncTime} &nbsp;•&nbsp;
//                        <span className="text-bold"> Loaded: {orders.length}</span> &nbsp;•&nbsp;
//                        Showing {activeTab}: {filteredOrders.length}
//                    </p>
//                </div>
//                <div className="sales-recent-header-actions">
//                    <button className="btn btn-outline btn-sm" onClick={fetchOrders}>
//                        ↻ Refresh Sync
//                    </button>
//                </div>
//            </div>

//            {error && (
//                <div className="alert alert-error">
//                    ❌ Error: {error}
//                </div>
//            )}

//            <div className="theme-tabs">
//                {['All', 'Pending', 'Unshipped', 'Shipped', 'Canceled'].map(tab => (
//                    <button
//                        key={tab}
//                        className={`theme-tab-btn ${activeTab === tab ? 'active' : ''}`}
//                        onClick={() => setActiveTab(tab)}
//                    >
//                        {tab}
//                    </button>
//                ))}
//            </div>

//            {filteredOrders.length === 0 ? (
//                <div className="sales-recent-empty text-center text-muted">
//                    <p>No {activeTab} orders found in this timeframe.</p>
//                </div>
//            ) : (
//                <div className="table-container">
//                    <table className="table">
//                        <thead>
//                            <tr>
//                                <th>Order ID</th>
//                                <th>Date</th>
//                                <th>Fulfillment</th>
//                                <th>Total Value</th>
//                                <th>Status</th>
//                                <th className="text-right">Items</th>
//                            </tr>
//                        </thead>
//                        <tbody>
//                            {filteredOrders.map((order) => (
//                                <React.Fragment key={order.AmazonOrderId}>
//                                    <tr>
//                                        <td className="sales-recent-name-cell">{order.AmazonOrderId}</td>
//                                        <td>{new Date(order.PurchaseDate).toLocaleString()}</td>

//                                        <td>
//                                            <span className={`sales-status-pill ${order.FulfillmentChannel === 'AFN' ? 'draft' : 'unpaid'}`}>
//                                                {getFulfillmentLabel(order.FulfillmentChannel)}
//                                            </span>
//                                        </td>

//                                        <td className="text-bold">
//                                            {order.OrderTotal?.Amount || '0.00'} {order.OrderTotal?.CurrencyCode || 'INR'}
//                                        </td>

//                                        <td>
//                                            <span className={`sales-status-pill ${getStatusClass(order.OrderStatus)}`}>
//                                                {order.OrderStatus}
//                                            </span>
//                                        </td>

//                                        <td className="text-right sales-actions-inline">
//                                            <button
//                                                className="btn btn-outline btn-xs"
//                                                onClick={() => handleToggleItems(order.AmazonOrderId)}
//                                            >
//                                                {expandedOrderId === order.AmazonOrderId ? "Hide SKUs" : "View SKUs"}
//                                            </button>
//                                        </td>
//                                    </tr>

//                                    {expandedOrderId === order.AmazonOrderId && (
//                                        <tr>
//                                            <td colSpan="6" className="amazon-expanded-cell">
//                                                <div className="sales-panel amazon-expanded-panel">
//                                                    <h4 className="sales-return-row-title" style={{ marginBottom: '10px' }}>Order Details & SKUs</h4>

//                                                    <p className="text-muted" style={{ marginBottom: '15px', fontSize: '0.85rem' }}>
//                                                        <strong>Customer Name:</strong> {order.BuyerInfo?.BuyerName || 'Amazon Customer (PII Hidden)'} |
//                                                        <strong> Payment Method:</strong> {order.PaymentMethod || 'Standard'}
//                                                    </p>

//                                                    {loadingItems && !orderItems[order.AmazonOrderId] ? (
//                                                        <p className="text-muted">Loading SKUs...</p>
//                                                    ) : (
//                                                        <div className="table-container">
//                                                            <table className="table">
//                                                                <thead>
//                                                                    <tr>
//                                                                        <th>Item Title</th>
//                                                                        <th>SKU Code</th>
//                                                                        <th>Qty</th>
//                                                                        <th>Unit Price</th>
//                                                                    </tr>
//                                                                </thead>
//                                                                <tbody>
//                                                                    {(orderItems[order.AmazonOrderId] || []).map((item, index) => (
//                                                                        <tr key={item.OrderItemId || index}>
//                                                                            <td className="text-muted">{item.Title}</td>
//                                                                            <td className="text-bold">{item.SellerSKU}</td>
//                                                                            <td>{item.QuantityOrdered}</td>
//                                                                            <td>{item.ItemPrice?.Amount || '0.00'} {item.ItemPrice?.CurrencyCode}</td>
//                                                                        </tr>
//                                                                    ))}
//                                                                </tbody>
//                                                            </table>
//                                                        </div>
//                                                    )}
//                                                </div>
//                                            </td>
//                                        </tr>
//                                    )}
//                                </React.Fragment>
//                            ))}
//                        </tbody>
//                    </table>

//                    <div style={{ padding: '15px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
//                        <button
//                            className="btn btn-secondary"
//                            onClick={fetchMoreOrders}
//                            disabled={loadingMore}
//                        >
//                            {loadingMore ? "⏳ Loading..." : "Load Previous Day ↓"}
//                        </button>
//                    </div>

//                </div>
//            )}
//        </div>
//    );
//};

//export default AmazonOrders;

import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../../api/core';

const AmazonOrders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [syncTime, setSyncTime] = useState('');

    const [nextOffset, setNextOffset] = useState(1);
    const [activeTab, setActiveTab] = useState('All');
    const [expandedOrderId, setExpandedOrderId] = useState(null);
    const [orderItems, setOrderItems] = useState({});
    const [loadingItems, setLoadingItems] = useState(false);

    useEffect(() => {
        fetchOrders();
    }, []);

    // Add this new state variable at the top with the others
    const [amazonNextToken, setAmazonNextToken] = useState(null);

    // ...

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${BACKEND_URL}/api/amazon/orders?offset=0`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            const orderArray = data.amazonData?.Orders || [];

            setOrders(orderArray);
            setNextOffset(data.nextOffset);
            setAmazonNextToken(data.nextToken); // 💡 Save the token!
            setSyncTime(new Date().toLocaleString());
        } catch (err) {
            console.error("Fetch Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchMoreOrders = async () => {
        setLoadingMore(true);
        try {
            // 💡 Smart Logic: If we have a token, fetch the rest of today's orders.
            // If the token is null (today is done), we fetch yesterday's orders using offset.
            let url = `${BACKEND_URL}/api/amazon/orders?`;
            if (amazonNextToken) {
                url += `nextToken=${encodeURIComponent(amazonNextToken)}`;
            } else {
                url += `offset=${nextOffset}`;
            }

            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            const newOrders = data.amazonData?.Orders || [];

            setOrders(prevOrders => [...prevOrders, ...newOrders]);

            // 💡 Update both variables for the next click
            setAmazonNextToken(data.nextToken);
            if (!data.nextToken) setNextOffset(data.nextOffset);

        } catch (err) {
            console.error("Load More Error:", err);
            alert("Failed to load older orders.");
        } finally {
            setLoadingMore(false);
        }
    };

    const handleToggleItems = async (orderId) => {
        if (expandedOrderId === orderId) {
            setExpandedOrderId(null);
            return;
        }

        setExpandedOrderId(orderId);

        if (!orderItems[orderId]) {
            setLoadingItems(true);
            try {
                const response = await fetch(`${BACKEND_URL}/api/amazon/order-items/${orderId}`);
                const data = await response.json();

                // 💡 UPDATED: Since our backend now sends a clean array, we just grab `data.items`
                const itemsArray = data.items || [];
                setOrderItems(prev => ({ ...prev, [orderId]: itemsArray }));
            } catch (err) {
                console.error("Failed to fetch items:", err);
            } finally {
                setLoadingItems(false);
            }
        }
    };

    const filteredOrders = orders.filter(order => {
        if (activeTab === 'All') return true;
        return order.OrderStatus === activeTab;
    });

    const getStatusClass = (status) => {
        if (status === 'Shipped') return 'paid';
        if (status === 'Unshipped' || status === 'Pending') return 'unpaid';
        if (status === 'Canceled') return 'draft';
        return 'draft';
    };

    if (loading) {
        return (
            <div className="sales-order">
                <div className="sales-recent-loading text-muted text-center">
                    <p>⏳ Syncing recent orders from Amazon...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="sales-order">

            <div className="sales-header">
                <div className="sales-title-block">
                    <h2 className="sales-title">Amazon Operations</h2>
                    <p className="sales-subtitle">
                        Last Sync: {syncTime} &nbsp;•&nbsp;
                        <span className="text-bold"> Loaded: {orders.length}</span> &nbsp;•&nbsp;
                        Showing {activeTab}: {filteredOrders.length}
                    </p>
                </div>
                <div className="sales-recent-header-actions">
                    <button className="btn btn-outline btn-sm" onClick={fetchOrders}>
                        ↻ Refresh Sync
                    </button>
                </div>
            </div>

            {/* 💡 THE COMPLIANCE BANNER: Straight from your screenshot */}
            <div className="alert alert-warning" style={{ backgroundColor: '#fffbeb', color: '#b45309', padding: '15px', borderRadius: '8px', marginBottom: '20px', borderLeft: '4px solid #f59e0b', fontSize: '0.9rem' }}>
                <strong>⚠️ Amazon Easy Ship Compliance:</strong> Please schedule your orders latest by <strong>1:45 PM IST</strong> on ESD and hand over timely to avoid cancellation fees. As required by Govt mandate, do not use plastic packaging for orders shipping from/to Maharashtra.
            </div>

            {error && <div className="alert alert-error">❌ Error: {error}</div>}

            <div className="theme-tabs">
                {['All', 'Pending', 'Unshipped', 'Shipped', 'Canceled'].map(tab => (
                    <button
                        key={tab}
                        className={`theme-tab-btn ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {filteredOrders.length === 0 ? (
                <div className="sales-recent-empty text-center text-muted">
                    <p>No {activeTab} orders found in this timeframe.</p>
                </div>
            ) : (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>Date</th>
                                <th>Fulfillment</th>
                                <th>Total Value</th>
                                <th>Status</th>
                                <th className="text-right">Items</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.map((order) => (
                                <React.Fragment key={order.AmazonOrderId}>
                                    <tr>
                                        <td className="sales-recent-name-cell">{order.AmazonOrderId}</td>
                                        <td>{new Date(order.PurchaseDate).toLocaleString()}</td>

                                        <td>
                                            <span className={`sales-status-pill ${order.FulfillmentChannel === 'AFN' ? 'draft' : 'unpaid'}`}>
                                                {order.FulfillmentChannel === 'AFN' ? 'Amazon FBA' : 'Easy Ship'}
                                            </span>
                                        </td>

                                        <td className="text-bold">
                                            {order.OrderTotal?.Amount || '0.00'} {order.OrderTotal?.CurrencyCode || 'INR'}
                                        </td>

                                        <td>
                                            <span className={`sales-status-pill ${getStatusClass(order.OrderStatus)}`}>
                                                {order.OrderStatus}
                                            </span>
                                        </td>

                                        <td className="text-right sales-actions-inline">
                                            <button
                                                className="btn btn-outline btn-xs"
                                                onClick={() => handleToggleItems(order.AmazonOrderId)}
                                            >
                                                {expandedOrderId === order.AmazonOrderId ? "Hide SKUs" : "View SKUs"}
                                            </button>
                                        </td>
                                    </tr>

                                    {/* EXPANDED SKU VIEW */}
                                    {expandedOrderId === order.AmazonOrderId && (
                                        <tr>
                                            <td colSpan="6" className="amazon-expanded-cell">
                                                <div className="sales-panel amazon-expanded-panel">
                                                    <h4 className="sales-return-row-title" style={{ marginBottom: '10px' }}>Order Details & Items to Pack</h4>

                                                    <p className="text-muted" style={{ marginBottom: '15px', fontSize: '0.85rem' }}>
                                                        <strong>Customer:</strong> {order.BuyerInfo?.BuyerName || 'Amazon Customer'} |
                                                        <strong> Ship By:</strong> {new Date(order.LatestShipDate).toLocaleDateString()}
                                                    </p>

                                                    {loadingItems && !orderItems[order.AmazonOrderId] ? (
                                                        <p className="text-muted">Loading SKUs from Amazon...</p>
                                                    ) : (
                                                        <div className="table-container">
                                                            <table className="table">
                                                                <thead>
                                                                    <tr>
                                                                        <th>Image</th>
                                                                        <th>Item Title</th>
                                                                        <th>SKU Code</th>
                                                                        <th>Qty to Pack</th>
                                                                        <th>Unit Price</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {(orderItems[order.AmazonOrderId] || []).map((item, index) => (
                                                                        <tr key={item.OrderItemId || index}>
                                                                            {/* Placeholder for Image */}
                                                                            <td>
                                                                                <div style={{ width: '40px', height: '40px', backgroundColor: '#e2e8f0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#64748b' }}>
                                                                                    IMG
                                                                                </div>
                                                                            </td>
                                                                            <td className="text-muted" style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                                {item.Title}
                                                                            </td>
                                                                            <td className="text-bold">{item.SellerSKU}</td>
                                                                            <td style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                                                                                {item.QuantityOrdered}
                                                                            </td>
                                                                            <td>{item.ItemPrice?.Amount || '0.00'} INR</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>

                    <div style={{ padding: '15px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                        <button className="btn btn-secondary" onClick={fetchMoreOrders} disabled={loadingMore}>
                            {loadingMore
                                ? "⏳ Loading..."
                                : amazonNextToken
                                    ? "Load Next 100 Orders ↓"
                                    : "Load Previous Day ↓"
                            }
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AmazonOrders;