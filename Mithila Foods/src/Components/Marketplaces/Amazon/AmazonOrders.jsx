import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../../api/core';
import './AmazonOrders.css';

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
            setAmazonNextToken(data.nextToken); 
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

            <div className="alert alert-warning">
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
                                                    <h4 className="sales-return-row-title">Order Details & Items to Pack</h4>

                                                    <p className="text-muted">
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
                                                                                <div>
                                                                                    IMG
                                                                                </div>
                                                                            </td>
                                                                            <td className="text-muted">
                                                                                {item.Title}
                                                                            </td>
                                                                            <td className="text-bold">{item.SellerSKU}</td>
                                                                            <td>
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

                    <div>
                        <button className="btn btn-secondary" onClick={fetchMoreOrders} disabled={loadingMore}>
                            {loadingMore
                                ? "⏳ Loading..."
                                : amazonNextToken
                                    ? "Load Next 100 Orders ↓"
                                    : "Load Previous Orders ↓"
                            }
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AmazonOrders;