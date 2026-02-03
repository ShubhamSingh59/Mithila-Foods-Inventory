// src/Components/SupplierAnalytics/ItemAnalyticsDashboard.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import "./ItemAnalytics.css";
import { getItemAnalyticsData, getAllItems } from "../erpBackendApi";

const fmtMoney = (n) => `₹ ${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDate = (d) => {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: '2-digit' });
};

// --- CHART 1: Price Trends (Line Chart) ---
const SimpleLineChart = ({ buyData, sellData }) => {
  const [hover, setHover] = useState(null);
  const width = 800; const height = 300; const padding = 50;

  const allPoints = [...buyData, ...sellData];
  if (allPoints.length === 0) return <div className="ia-no-data">No history to chart.</div>;

  const maxRate = Math.max(...allPoints.map(d => d.rate)) * 1.1;
  const minRate = 0;

  const getX = (index, total) => padding + (index / (total - 1 || 1)) * (width - padding * 2);
  const getY = (rate) => height - padding - ((rate - minRate) / (maxRate - minRate)) * (height - padding * 2);

  const makePath = (data) => {
    if (!data.length) return "";
    return "M" + data.map((d, i) => `${getX(i, data.length)},${getY(d.rate)}`).join(" L");
  };

  return (
    <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" strokeWidth="1" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#cbd5e1" strokeWidth="1" />

        {/* Y Axis - Bigger Font */}
        <text x={0} y={padding} fontSize="12" fill="#64748b" fontWeight="600">₹{Math.round(maxRate)}</text>
        <text x={0} y={height - padding} fontSize="12" fill="#64748b" fontWeight="600">₹0</text>

        {/* Lines */}
        {buyData.length > 1 && <path d={makePath(buyData)} fill="none" stroke="#f59e0b" strokeWidth="3" />}
        {sellData.length > 1 && <path d={makePath(sellData)} fill="none" stroke="#10b981" strokeWidth="3" />}

        {/* Points */}
        {buyData.map((d, i) => (
          <circle key={`b-${i}`} cx={getX(i, buyData.length)} cy={getY(d.rate)} r="5" fill="#f59e0b"
            onMouseEnter={(e) => setHover({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, data: { ...d, type: 'Buy' } })}
            onMouseLeave={() => setHover(null)} />
        ))}
        {sellData.map((d, i) => (
          <circle key={`s-${i}`} cx={getX(i, sellData.length)} cy={getY(d.rate)} r="5" fill="#10b981"
            onMouseEnter={(e) => setHover({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, data: { ...d, type: 'Sell' } })}
            onMouseLeave={() => setHover(null)} />
        ))}
      </svg>
      {hover && (
        <div style={{
          position: 'absolute', left: hover.x + 10, top: hover.y - 50,
          background: 'rgba(15, 23, 42, 0.9)', color: '#fff',
          padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem', pointerEvents: 'none', zIndex: 10
        }}>
          <strong>{hover.data.date}</strong><br />{hover.data.type}: ₹{hover.data.rate} ({hover.data.party})
        </div>
      )}
      <div style={{ display: 'flex', gap: 15, justifyContent: 'center', marginTop: 15, fontSize: '0.9rem', fontWeight: 500 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, background: '#10b981', borderRadius: '50%' }}></span> Selling Rate</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, background: '#f59e0b', borderRadius: '50%' }}></span> Buying Rate</div>
      </div>
    </div>
  );
};

// --- CHART 2 & 3: Generic Volume Chart (Reused for Supplier & Customer) ---
const VolumeBarChart = ({ data, color = "#3b82f6" }) => {
  if (!data || !data.length) return <div className="ia-no-data">No volume data available.</div>;
  const maxVal = Math.max(...data.map(d => d.totalQty));

  return (
    <div className="ia-vol-chart">
      {data.map(d => (
        <div key={d.name} className="ia-vol-row">
          <div className="ia-vol-label" title={d.name}>{d.name}</div>
          <div className="ia-vol-bar-track">
            <div
              className="ia-vol-bar"
              style={{ width: `${maxVal > 0 ? (d.totalQty / maxVal) * 100 : 0}%`, background: color }}
            ></div>
          </div>
          <div className="ia-vol-value">
            {d.totalQty.toLocaleString("en-IN")} <span style={{ fontSize: '0.75em', color: '#64748b', fontWeight: 400 }}>Units</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// --- MAIN DASHBOARD ---
export default function ItemAnalyticsDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [allItems, setAllItems] = useState([]);

  useEffect(() => {
    getAllItems().then(res => setAllItems(res || []));
  }, []);

  async function handleSearch() {
    if (!selectedItem) return;
    setLoading(true);
    try {
      const result = await getItemAnalyticsData(selectedItem);
      setData(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    if (!searchTerm) return [];
    const lower = searchTerm.toLowerCase();
    return allItems.filter(i => i.name.toLowerCase().includes(lower) || (i.item_name && i.item_name.toLowerCase().includes(lower))).slice(0, 10);
  }, [searchTerm, allItems]);

  const processed = useMemo(() => {
    if (!data) return null;
    const { purchaseHistory, salesHistory, item, itemPrices } = data;

    // --- 1. Buying Metrics ---
    const lastPurchase = purchaseHistory[0] || {};
    const lastBuyRate = lastPurchase.rate || 0;
    const stdBuyRate = item.standard_rate || 0;

    let totalBuyQty = 0;
    let totalBuyVal = 0;

    const supplierMap = {};

    purchaseHistory.forEach(h => {
      const qty = h.received_qty || h.qty || 0;
      const rate = h.rate || 0;

      if (rate > 0) {
        totalBuyVal += (qty * rate);
        totalBuyQty += qty;
      }

      if (!supplierMap[h.supplier]) {
        supplierMap[h.supplier] = { name: h.supplier, totalQty: 0, badQty: 0, rates: [] };
      }
      const s = supplierMap[h.supplier];
      s.totalQty += qty;
      s.badQty += (h.rejected_qty || 0);
      s.rates.push(rate);
    });

    const avgBuyRate = totalBuyQty > 0 ? (totalBuyVal / totalBuyQty) : 0;

    // --- 2. Selling Metrics & Customer Volume ---
    const lastSale = salesHistory[0] || {};
    const lastSellRate = lastSale.rate || 0;
    const sellPriceObj = itemPrices?.find(p => p.selling === 1) || itemPrices?.find(p => p.buying === 0);
    const stdSellRate = sellPriceObj?.price_list_rate || 0;

    let totalSellQty = 0;
    let totalSellVal = 0;

    // ✅ Customer Aggregation Logic
    const customerMap = {};

    salesHistory.forEach(x => {
      const qty = x.qty || 0; // Can be negative for returns
      const rate = x.rate || 0;

      // Avg Rate Calculation (Only positive sales usually)
      if (rate > 0 && qty > 0) {
        totalSellVal += (qty * rate);
        totalSellQty += qty;
      }

      // Volume Calculation (Net Volume: Sales - Returns)
      if (!customerMap[x.customer]) {
        customerMap[x.customer] = { name: x.customer, totalQty: 0 };
      }
      customerMap[x.customer].totalQty += qty;
    });

    const avgSellRate = totalSellQty > 0 ? (totalSellVal / totalSellQty) : 0;

    // --- 3. Leaderboards ---
    // Suppliers (Cheapest Avg Rate)
    const supplierLeaderboard = Object.values(supplierMap).map(s => {
      const validRates = s.rates.filter(r => r > 0);
      const avg = validRates.length > 0 ? validRates.reduce((a, b) => a + b, 0) / validRates.length : 0;
      return {
        ...s,
        avgRate: avg,
        rejectPercent: s.totalQty > 0 ? (s.badQty / s.totalQty) * 100 : 0,
        lastRate: s.rates[0]
      };
    }).sort((a, b) => a.avgRate - b.avgRate);

    // Supplier Volume Data (Top 5)
    const supplierVolumeData = [...supplierLeaderboard].sort((a, b) => b.totalQty - a.totalQty).slice(0, 5);

    // ✅ Customer Volume Data (Top 5)
    const customerVolumeData = Object.values(customerMap)
      .filter(c => c.totalQty > 0) // Filter out pure return customers or zero vol
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 5);

    // --- 4. Charts Data ---
    const buyGraph = [...purchaseHistory].reverse().map(x => ({ date: fmtDate(x.posting_date), rate: x.rate, party: x.supplier }));
    const sellGraph = [...salesHistory].reverse().map(x => ({ date: fmtDate(x.posting_date), rate: x.rate, party: x.customer }));

    return {
      lastBuyRate, avgBuyRate, stdBuyRate,
      lastSellRate, avgSellRate, stdSellRate,
      supplierLeaderboard, supplierVolumeData,
      customerVolumeData, // ✅ New Data
      buyGraph, sellGraph, salesHistory
    };
  }, [data]);

  return (
    <div className="ia-container">
      {/* Search Header */}
      <div className="ia-search-box">
        <div style={{ flex: 1 }}>
          <DashboardItemSearchDropdown
            items={allItems}
            value={selectedItem}
            onSelect={(code) => setSelectedItem(code)}
            placeholder="Select or Search Item to Analyze..."
            disabled={loading}
          />
        </div>
        <button
          className="ia-btn"
          onClick={handleSearch}
          disabled={!selectedItem || loading}
        >
          {loading ? "Loading..." : "Analyze Item"}
        </button>
      </div>
      {processed && (
        <>
          {/* Buying Metrics */}
          <div className="ia-section-label">📉 Buying Metrics (Inflow)</div>
          <div className="ia-stats-grid">
            <div className="ia-card">
              <div className="ia-card-label">Avg Buying Rate</div>
              <div className="ia-card-value">{fmtMoney(processed.avgBuyRate)}</div>
              <div className="ia-card-sub">Weighted Avg</div>
            </div>
            <div className="ia-card">
              <div className="ia-card-label">Standard Buying Rate</div>
              <div className="ia-card-value">{fmtMoney(processed.stdBuyRate)}</div>
              <div className="ia-card-sub ia-neutral">Master Data</div>
            </div>
            <div className="ia-card">
              <div className="ia-card-label">Last Buying Rate</div>
              <div className="ia-card-value">{fmtMoney(processed.lastBuyRate)}</div>
              <div className="ia-card-sub">Most Recent</div>
            </div>
          </div>

          {/* Selling Metrics */}
          <div className="ia-section-label" style={{ marginTop: 20 }}>📈 Selling Metrics (Outflow)</div>
          <div className="ia-stats-grid">
            <div className="ia-card">
              <div className="ia-card-label">Avg Selling Rate</div>
              <div className="ia-card-value">{fmtMoney(processed.avgSellRate)}</div>
              <div className="ia-card-sub">Weighted Avg</div>
            </div>
            <div className="ia-card">
              <div className="ia-card-label">Standard Selling Rate</div>
              <div className="ia-card-value">{fmtMoney(processed.stdSellRate)}</div>
              <div className="ia-card-sub ia-neutral">Master Data</div>
            </div>
            <div className="ia-card">
              <div className="ia-card-label">Last Selling Rate</div>
              <div className="ia-card-value">{fmtMoney(processed.lastSellRate)}</div>
              <div className="ia-card-sub">Most Recent</div>
            </div>
          </div>

          {/* --- CHARTS SECTION --- */}

          {/* 1. Price Trend (Full Width) */}
          <div className="ia-chart-section" style={{ marginTop: 20 }}>
            <div className="ia-section-title">📊 Price Trends (Buy vs Sell)</div>
            <SimpleLineChart buyData={processed.buyGraph} sellData={processed.sellGraph} />
          </div>

          {/* 2. Volume Charts (Side by Side) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Left: Suppliers */}
            <div className="ia-chart-section">
              <div className="ia-section-title">📦 Top Suppliers by Volume</div>
              {/* Blue Bars for Buying */}
              <VolumeBarChart data={processed.supplierVolumeData} color="#3b82f6" />
            </div>

            {/* Right: Customers */}
            <div className="ia-chart-section">
              <div className="ia-section-title">🛍️ Top Customers by Volume</div>
              {/* Green Bars for Selling */}
              <VolumeBarChart data={processed.customerVolumeData} color="#10b981" />
            </div>
          </div>

          {/* Buying Table */}
          <div className="ia-chart-section">
            <div className="ia-section-title">🏆 Supplier Negotiation Data (Cheapest & Quality)</div>
            <div className="ia-table-wrapper">
              <table className="ia-table">
                <thead><tr><th>Rank</th><th>Supplier</th><th>Last Rate</th><th>Avg Rate</th><th>Total Qty</th><th>Bad Qty</th><th>Quality %</th></tr></thead>
                <tbody>
                  {processed.supplierLeaderboard.map((s, idx) => (
                    <tr key={s.name}>
                      <td><span className={`ia-rank-badge ia-rank-${idx + 1}`}>{idx + 1}</span></td>
                      <td style={{ fontWeight: 500 }}>{s.name}</td>
                      <td>{fmtMoney(s.lastRate)}</td>
                      <td>{fmtMoney(s.avgRate)}</td>
                      <td>{s.totalQty.toLocaleString()}</td>
                      <td className={s.badQty > 0 ? "ia-quality-bad" : "ia-quality-good"}>{s.badQty}</td>
                      <td>{s.rejectPercent > 0 ? <span className="ia-bad">{s.rejectPercent.toFixed(1)}% Rej</span> : <span className="ia-good">100%</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Selling Table */}
          <div className="ia-chart-section">
            <div className="ia-section-title">🏷️ Selling Price History (All)</div>
            <div className="ia-table-wrapper" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="ia-table">
                <thead><tr><th>Date</th><th>Customer</th><th>Rate Sold</th><th>Qty Sold</th><th>Amount</th></tr></thead>
                <tbody>
                  {processed.salesHistory.map((s, idx) => (
                    <tr key={idx}>
                      <td>{fmtDate(s.posting_date)}</td>
                      <td>{s.customer}</td>
                      <td>{fmtMoney(s.rate)}</td>
                      <td>{s.qty.toLocaleString()}</td>
                      <td>{fmtMoney(s.amount)}</td>
                    </tr>
                  ))}
                  {processed.salesHistory.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#64748b' }}>No recent sales found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
function DashboardItemSearchDropdown({ items, value, onSelect, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  const selected = useMemo(() => items.find(x => x.name === value), [items, value]);

  const filtered = useMemo(() => {
    if (!q) return items.slice(0, 80);
    const searchLower = q.toLowerCase();
    return items.filter(i => 
        (i.name || "").toLowerCase().includes(searchLower) || 
        (i.item_name || "").toLowerCase().includes(searchLower)
    ).slice(0, 80);
  }, [items, q]);

  useEffect(() => {
    function clickOut(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", clickOut);
    return () => document.removeEventListener("mousedown", clickOut);
  }, []);

  return (
    <div className="stdrop" ref={ref}>
      <button 
        type="button" 
        className={`stdrop-control ${open ? "is-open" : ""}`} 
        onClick={() => !disabled && setOpen(!open)} 
        disabled={disabled}
      >
        <div className="stdrop-value">
          {selected ? (
            <>
              <div className="stdrop-title">{selected.name}</div>
              <div className="stdrop-sub">{selected.item_name}</div>
            </>
          ) : (
            <span className="stdrop-placeholder">{placeholder}</span>
          )}
        </div>
        <div className="stdrop-caret">▾</div>
      </button>

      {open && (
        <div className="stdrop-popover">
          <div className="stdrop-search">
            <input 
              autoFocus 
              value={q} 
              onChange={e => setQ(e.target.value)} 
              placeholder="Type to filter..." 
              className="ia-input" 
              style={{ marginBottom: 0 }}
            />
          </div>
          <div className="stdrop-list">
            {filtered.map(i => (
              <div key={i.name} className="stdrop-item" onClick={() => { onSelect(i.name); setOpen(false); setQ(""); }}>
                <div className="stdrop-item-title">{i.name}</div>
                <div className="stdrop-item-sub">{i.item_name}</div>
              </div>
            ))}
            {filtered.length === 0 && <div className="stdrop-empty">No matching items found.</div>}
          </div>
        </div>
      )}
    </div>
  );
}