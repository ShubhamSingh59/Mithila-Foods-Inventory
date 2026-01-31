// src/Components/SupplierAnalytics/SupplierTracker.jsx
import React, { useState, useEffect, useMemo } from "react";
import "./SupplierTracker.css";
import { getSupplierTrackerData, getSuppliers } from "../erpBackendApi";

const fmtMoney = (n) => `₹ ${Number(n || 0).toLocaleString("en-IN")}`;
const fmtPct = (n) => `${Number(n || 0).toFixed(1)}%`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN") : "—";

export default function SupplierTracker() {
  const [suppliersList, setSuppliersList] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSuppliers().then(res => setSuppliersList(res || []));
  }, []);

  async function handleLoad() {
    if (!selectedSupplier) return;
    setLoading(true);
    try {
      const res = await getSupplierTrackerData(selectedSupplier);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const metrics = useMemo(() => {
    if (!data) return null;
    const { orders, receipts, invoices, validReceiptItems, supplier, supplyHistory, approvedItems } = data;

    // --- 1. Operational (Orders) ---
    const totalOrders = orders.length;
    const openOrders = orders.filter(o => !["Completed", "Closed", "Cancelled"].includes(o.status)).length;
    
    // --- 2. Financial (Bills) ---
    const totalInvoices = invoices.length;
    const totalSpend = invoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
    const outstanding = invoices.reduce((sum, inv) => sum + (inv.outstanding_amount || 0), 0);
    const paidPct = totalSpend > 0 ? ((totalSpend - outstanding) / totalSpend) * 100 : 0;

    // --- NEW: Bill Payment Habits (Simple Naming) ---
    const today = new Date();
    let overdueCount = 0;
    let totalDelayDays = 0;
    let lateBillsCount = 0;
    
    invoices.forEach(inv => {
        const dueDate = new Date(inv.due_date);
        const isUnpaid = inv.outstanding_amount > 0;
        
        // 1. Check if currently overdue (Unpaid & Late)
        if (isUnpaid && dueDate < today) {
            overdueCount++;
        }

        // 2. Calculate Average Delay (For historical health)
        // If it's unpaid and late, we count days until today.
        // If it was paid (we don't have paid date here easily without more API calls), 
        // we can at least check currently overdue items for "Current Delay".
        // To keep it simple and accurate with available data:
        if (dueDate < today) {
            const diffTime = Math.abs(today - dueDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            totalDelayDays += diffDays;
            lateBillsCount++;
        }
    });

    // "Avg Days Late" (Only for bills that are actually late)
    const avgDelayDays = lateBillsCount > 0 ? Math.round(totalDelayDays / lateBillsCount) : 0;

    // --- 3. Quality ---
    const totalQtyRecv = validReceiptItems.reduce((sum, i) => sum + (i.qty + i.rejected_qty), 0);
    const totalRejected = validReceiptItems.reduce((sum, i) => sum + i.rejected_qty, 0);
    const rejectionRate = totalQtyRecv > 0 ? (totalRejected / totalQtyRecv) * 100 : 0;

    // --- 4. Fulfillment ---
    const totalGoodQty = validReceiptItems.reduce((sum, i) => sum + i.qty, 0);
    const fulfillmentRate = totalQtyRecv > 0 ? (totalGoodQty / totalQtyRecv) * 100 : 100;

    return {
      supplierName: supplier?.supplier_name || selectedSupplier,
      contact: supplier?.mobile_no || "N/A",
      email: supplier?.email_id || "N/A",
      gst: supplier?.gstin || "N/A",
      
      totalOrders,
      openOrders,
      
      totalInvoices,
      totalSpend,
      outstanding,
      paidPct,
      overdueCount,
      avgDelayDays, // New Metric

      rejectionRate,
      fulfillmentRate,
      
      supplyHistory, 
      approvedItems,
      orderHistory: orders, 
      receiptHistory: receipts 
    };
  }, [data, selectedSupplier]);

  return (
    <div className="st-container">
      <div className="st-header">
        <div className="st-title-group">
          <h2>Supplier Tracker</h2>
          <div className="st-subtitle">360° Supplier Performance & History</div>
        </div>
        <div className="st-search-bar">
          <select 
            className="st-input" 
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
          >
            <option value="">Select Supplier...</option>
            {suppliersList.map(s => (
              <option key={s.name} value={s.name}>{s.supplier_name || s.name}</option>
            ))}
          </select>
          <button className="st-btn" onClick={handleLoad} disabled={loading || !selectedSupplier}>
            {loading ? "Loading..." : "Track"}
          </button>
        </div>
      </div>

      {metrics && (
        <>
          {/* Top Cards - Performance */}
          <div className="st-section-title">Health & Performance</div>
          <div className="st-grid">
            <div className="st-card">
              <div className="st-card-title">Rejection Rate</div>
              <div className={`st-card-value ${metrics.rejectionRate > 2 ? 'st-text-red' : 'st-text-green'}`}>
                {fmtPct(metrics.rejectionRate)}
              </div>
              <div className="st-card-sub">Target: &lt; 2%</div>
            </div>
            <div className="st-card">
              <div className="st-card-title">Good Items Received</div>
              <div className="st-card-value st-text-green">{fmtPct(metrics.fulfillmentRate)}</div>
              <div className="st-card-sub">Based on Quality Check</div>
            </div>
            <div className="st-card">
              <div className="st-card-title">Pending Payment</div>
              <div className="st-card-value st-text-red">{fmtMoney(metrics.outstanding)}</div>
              <div className="st-card-sub">{fmtPct(metrics.paidPct)} Paid</div>
            </div>
            <div className="st-card">
              <div className="st-card-title">Total Money Spent</div>
              <div className="st-card-value">{fmtMoney(metrics.totalSpend)}</div>
            </div>
          </div>

          {/* New Section: Bill Payment Habits (Simple English) */}
          <div className="st-section-title">💰 Bill Payment Habits</div>
          <div className="st-grid" style={{gridTemplateColumns: 'repeat(4, 1fr)'}}>
             <div className="st-card">
                <div className="st-card-title">Total Bills</div>
                <div className="st-card-value">{metrics.totalInvoices}</div>
                <div className="st-card-sub">Lifetime Count</div>
             </div>
             <div className="st-card">
                <div className="st-card-title">Late Bills (Unpaid)</div>
                <div className={`st-card-value ${metrics.overdueCount > 0 ? 'st-text-red' : 'st-text-green'}`}>
                    {metrics.overdueCount}
                </div>
                <div className="st-card-sub">Past Due Date</div>
             </div>
             <div className="st-card">
                <div className="st-card-title">Avg Payment Delay</div>
                <div className={`st-card-value ${metrics.avgDelayDays > 7 ? 'st-text-red' : 'st-text-green'}`}>
                    {metrics.avgDelayDays} Days
                </div>
                <div className="st-card-sub">After Due Date</div>
             </div>
             <div className="st-card">
                <div className="st-card-title">Avg Bill Value</div>
                <div className="st-card-value">
                    {metrics.totalInvoices > 0 ? fmtMoney(metrics.totalSpend / metrics.totalInvoices) : "₹0"}
                </div>
             </div>
          </div>

          {/* Middle Row: Full History Tables (Scrollable) */}
          <div className="st-flex-row" style={{marginBottom: 20}}>
            
            {/* Full Order History */}
            <div className="st-section st-flex-col">
              <div className="st-section-title">📜 Order History (All)</div>
              <div style={{maxHeight: '350px', overflowY: 'auto'}}>
                <table className="st-table">
                  <thead>
                    <tr>
                      <th style={{position:'sticky', top:0}}>Date</th>
                      <th style={{position:'sticky', top:0}}>Amount</th>
                      <th style={{position:'sticky', top:0}}>Recv %</th>
                      <th style={{position:'sticky', top:0}}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.orderHistory.map(o => (
                      <tr key={o.name}>
                        <td>{fmtDate(o.transaction_date)}</td>
                        <td>{fmtMoney(o.grand_total)}</td>
                        <td>
                           <div style={{display:'flex', alignItems:'center', gap:5}}>
                             <div style={{width:50, height:6, background:'#e2e8f0', borderRadius:3}}>
                               <div style={{width:`${o.per_received}%`, height:'100%', background: o.per_received >= 100 ? '#166534' : '#f59e0b', borderRadius:3}}></div>
                             </div>
                             <span style={{fontSize:'0.75rem'}}>{o.per_received.toFixed(0)}%</span>
                           </div>
                        </td>
                        <td>
                          <span style={{
                            padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem',
                            background: o.status === 'Completed' ? '#dcfce7' : '#f1f5f9',
                            color: o.status === 'Completed' ? '#166534' : '#475569'
                          }}>
                            {o.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {metrics.orderHistory.length === 0 && <tr><td colSpan={4} style={{textAlign:'center'}}>No orders found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Full Delivery History */}
            <div className="st-section st-flex-col">
              <div className="st-section-title">🚚 Delivery History (All)</div>
              <div style={{maxHeight: '350px', overflowY: 'auto'}}>
                <table className="st-table">
                  <thead>
                    <tr>
                      <th style={{position:'sticky', top:0}}>Date</th>
                      <th style={{position:'sticky', top:0}}>Receipt #</th>
                      <th style={{position:'sticky', top:0}}>Billed %</th>
                      <th style={{position:'sticky', top:0}}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.receiptHistory.map(r => (
                      <tr key={r.name}>
                        <td>{fmtDate(r.posting_date)}</td>
                        <td style={{fontWeight:500}}>{r.name}</td>
                        <td>{r.per_billed.toFixed(0)}%</td>
                        <td>{r.status}</td>
                      </tr>
                    ))}
                    {metrics.receiptHistory.length === 0 && <tr><td colSpan={4} style={{textAlign:'center'}}>No deliveries found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Main Supply History (No Item Code) */}
          <div className="st-section">
            <div className="st-section-title">📦 Supply Performance by Item (All History)</div>
            <div style={{maxHeight: '400px', overflowY: 'auto'}}>
              <table className="st-table">
                <thead>
                  <tr>
                    <th style={{position:'sticky', top:0}}>Item Name</th>
                    <th style={{position:'sticky', top:0, textAlign:'right'}}>Total Spend</th>
                    <th style={{position:'sticky', top:0, textAlign:'right'}}>Total Qty</th>
                    <th style={{position:'sticky', top:0, textAlign:'right'}}>Last Rate</th>
                    <th style={{position:'sticky', top:0, textAlign:'right'}}>Avg Rate</th>
                    <th style={{position:'sticky', top:0, textAlign:'right'}}>Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.supplyHistory.map(item => (
                    <tr key={item.code}>
                      <td style={{fontWeight:500}}>{item.name}</td>
                      <td style={{textAlign:'right', fontWeight:600}}>{fmtMoney(item.totalValue)}</td>
                      <td style={{textAlign:'right'}}>{item.totalQty.toLocaleString()} <span style={{fontSize:'0.75rem'}}>{item.uom}</span></td>
                      <td style={{textAlign:'right'}}>{fmtMoney(item.lastRate)}</td>
                      <td style={{textAlign:'right'}}>{fmtMoney(item.avgRate)}</td>
                      <td style={{textAlign:'right'}}>
                        {item.qualityPct < 98 ? 
                          <span className="st-bg-red">{item.qualityPct.toFixed(1)}% Good</span> : 
                          <span className="st-text-green">100% Good</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="st-flex-row">
            <div className="st-section st-flex-col" style={{flex: 2}}>
              <div className="st-section-title">📋 Approved Item Portfolio</div>
              <div style={{maxHeight: '300px', overflowY: 'auto'}}>
                <table className="st-table">
                  <thead><tr><th style={{position:'sticky', top:0}}>Item Name</th></tr></thead>
                  <tbody>
                    {metrics.approvedItems.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{fontWeight:500}}>{item.item_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="st-section st-flex-col" style={{flex: 1}}>
              <div className="st-section-title">Supplier Profile</div>
              <div style={{display:'grid', gap:15, fontSize:'0.95rem'}}>
                <div><div className="st-card-title">Name</div><div style={{fontWeight:600}}>{metrics.supplierName}</div></div>
                <div><div className="st-card-title">Contact</div><div>{metrics.contact}</div></div>
                <div><div className="st-card-title">Email</div><div>{metrics.email}</div></div>
                <div><div className="st-card-title">GSTIN</div><div>{metrics.gst}</div></div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}