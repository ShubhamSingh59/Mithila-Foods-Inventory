import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../../api/core'; 

const FlipkartOrders = () => {
  const [groupedOrders, setGroupedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [syncTime, setSyncTime] = useState('');
  const [nextOffset, setNextOffset] = useState(1);
  
  const [activeTab, setActiveTab] = useState('All');
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  // Flipkart returns flat items. This helper groups them by Order ID so the UI matches Amazon.
  const groupFlipkartItems = (itemsArray) => {
    const grouped = {};
    itemsArray.forEach(item => {
      if (!grouped[item.orderId]) {
        grouped[item.orderId] = {
          orderId: item.orderId,
          orderDate: item.orderDate,
          status: item.status, // e.g., APPROVED, PACKED, CANCELLED
          paymentType: item.paymentType,
          totalValue: 0,
          fulfillmentType: item.fulfillmentType || 'NON_FA', // FA vs NON_FA
          items: []
        };
      }
      grouped[item.orderId].items.push(item);
      grouped[item.orderId].totalValue += item.priceComponents?.sellingPrice || 0;
    });
    return Object.values(grouped);
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/flipkart/orders?offset=0`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      const itemsArray = data.flipkartData?.Items || [];
      
      setGroupedOrders(groupFlipkartItems(itemsArray));
      setNextOffset(data.nextOffset);
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
      const response = await fetch(`${BACKEND_URL}/api/flipkart/orders?offset=${nextOffset}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      const newItemsArray = data.flipkartData?.Items || [];
      const newGrouped = groupFlipkartItems(newItemsArray);
      
      setGroupedOrders(prev => [...prev, ...newGrouped]);
      setNextOffset(data.nextOffset);
    } catch (err) {
      console.error("Load More Error:", err);
      alert("Failed to load older orders.");
    } finally {
      setLoadingMore(false);
    }
  };

  const filteredOrders = groupedOrders.filter(order => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Pending' && order.status === 'APPROVED') return true;
    if (activeTab === 'Shipped' && (order.status === 'DISPATCHED' || order.status === 'SHIPPED')) return true;
    if (activeTab === 'Canceled' && order.status === 'CANCELLED') return true;
    return false;
  });

  const getStatusClass = (status) => {
    if (status === 'DISPATCHED' || status === 'SHIPPED') return 'paid';
    if (status === 'APPROVED' || status === 'PACKED') return 'unpaid';
    if (status === 'CANCELLED') return 'draft';
    return 'unpaid';
  };

  const getFulfillmentLabel = (type) => {
    return type === 'FA' ? 'Flipkart FBA' : 'Easy Ship';
  };

  if (loading) {
    return (
      <div className="sales-order">
        <div className="sales-recent-loading text-muted text-center">
          <p>⏳ Syncing recent orders from Flipkart...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sales-order">
      <div className="sales-header">
        <div className="sales-title-block">
          <h2 className="sales-title" style={{ color: '#0284c7' }}>Flipkart Operations</h2>
          <p className="sales-subtitle">
            Last Sync: {syncTime} &nbsp;•&nbsp; 
            <span className="text-bold"> Loaded: {groupedOrders.length}</span> &nbsp;•&nbsp; 
            Showing {activeTab}: {filteredOrders.length}
          </p>
        </div>
        <div className="sales-recent-header-actions">
          <button className="btn btn-outline btn-sm" onClick={fetchOrders}>
            ↻ Refresh Sync
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">❌ Error: {error}</div>}

      <div className="theme-tabs">
        {['All', 'Pending', 'Shipped', 'Canceled'].map(tab => (
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
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <React.Fragment key={order.orderId}>
                  <tr>
                    <td className="sales-recent-name-cell">{order.orderId}</td>
                    <td>{new Date(order.orderDate).toLocaleString()}</td>
                    
                    <td>
                       <span className={`sales-status-pill ${order.fulfillmentType === 'FA' ? 'draft' : 'unpaid'}`}>
                          {getFulfillmentLabel(order.fulfillmentType)}
                       </span>
                    </td>
                    
                    <td className="text-bold">
                      {order.totalValue} INR
                    </td>
                    
                    <td>
                      <span className={`sales-status-pill ${getStatusClass(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    
                    <td className="text-right sales-actions-inline">
                      <button 
                        className="btn btn-outline btn-xs"
                        onClick={() => setExpandedOrderId(expandedOrderId === order.orderId ? null : order.orderId)}
                      >
                        {expandedOrderId === order.orderId ? "Hide SKUs" : "View SKUs"}
                      </button>
                    </td>
                  </tr>

                  {expandedOrderId === order.orderId && (
                    <tr>
                      <td colSpan="6" className="amazon-expanded-cell">
                        <div className="sales-panel amazon-expanded-panel">
                          <h4 className="sales-return-row-title" style={{ marginBottom: '10px' }}>Order Details & SKUs</h4>
                          
                          <p className="text-muted" style={{ marginBottom: '15px', fontSize: '0.85rem' }}>
                            <strong>Payment Method:</strong> {order.paymentType}
                          </p>

                          <div className="table-container">
                            <table className="table">
                              <thead>
                                <tr>
                                  <th>Item Title</th>
                                  <th>SKU Code</th>
                                  <th>Qty</th>
                                  <th>Unit Price</th>
                                </tr>
                              </thead>
                              <tbody>
                                {order.items.map((item, index) => (
                                  <tr key={item.orderItemId || index}>
                                    <td className="text-muted">{item.title}</td>
                                    <td className="text-bold">{item.sku}</td>
                                    <td>{item.quantity}</td>
                                    <td>{item.priceComponents?.sellingPrice} INR</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          
          <div style={{ padding: '15px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
            <button 
              className="btn btn-secondary" 
              onClick={fetchMoreOrders}
              disabled={loadingMore}
            >
              {loadingMore ? "⏳ Loading..." : "Load Previous Day ↓"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlipkartOrders;