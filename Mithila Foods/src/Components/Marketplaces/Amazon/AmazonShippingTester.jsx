import React, { useState } from 'react';
import { BACKEND_URL } from '../../api/core'; 

const AmazonShippingTester = () => {
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState([]);

  const addLog = (message) => {
    setLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${message}`]);
  };

  const handleTestShipment = async () => {
    if (!orderId) {
      alert("Please enter a dummy Order ID first.");
      return;
    }

    setLoading(true);
    addLog(`Initiating SAFE shipment protocol for ${orderId}...`);

    try {
      // Calling our safe mock endpoint
      const response = await fetch(`${BACKEND_URL}/api/amazon/test-ship-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderId })
      });
      
      const data = await response.json();

      if (data.status === "Failed") {
        addLog(`❌ Error: ${data.error}`);
        return;
      }

      addLog("✅ Response received. Extracting PDF Base64...");

      // Extracting exactly how Amazon structures it
      const base64PDF = data.shippingData?.payload?.Shipment?.Label?.FileContents?.Contents;

      if (!base64PDF) {
        addLog("❌ No PDF found in response.");
        return;
      }

      addLog("📄 Base64 extracted. Converting to physical file...");

      // Convert Base64 to a physical PDF Blob
      const binaryString = window.atob(base64PDF);
      const binaryLen = binaryString.length;
      const bytes = new Uint8Array(binaryLen);
      for (let i = 0; i < binaryLen; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { type: "application/pdf" });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `SAFE_TEST_LABEL_${orderId}.pdf`;
      
      addLog("⬇️ Triggering browser download...");
      link.click();
      
      addLog("🎉 Process complete! Your live account is safe.");

    } catch (error) {
      console.error(error);
      addLog(`❌ Fatal Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-panel">
      <h2 className="sales-title" style={{ color: '#d97706' }}>
        🛡️ Isolated Shipping Sandbox
      </h2>
      <p className="text-muted" style={{ marginBottom: '20px' }}>
        This component tests the PDF generation and download logic without touching the live Amazon API. 100% safe.
      </p>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input 
          type="text" 
          className="input" 
          placeholder="Enter any dummy Order ID (e.g. 111-222-333)" 
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          style={{ maxWidth: '300px' }}
        />
        <button 
          className="btn btn-primary" 
          onClick={handleTestShipment}
          disabled={loading}
        >
          {loading ? "Processing..." : "Generate Test Label"}
        </button>
      </div>

      <div style={{ background: '#0f172a', color: '#10b981', padding: '15px', borderRadius: '8px', fontFamily: 'monospace', minHeight: '150px' }}>
        <p style={{ margin: '0 0 10px 0', color: '#94a3b8' }}>--- System Terminal ---</p>
        {log.map((entry, idx) => (
          <div key={idx} style={{ marginBottom: '5px' }}>{entry}</div>
        ))}
      </div>
    </div>
  );
};

export default AmazonShippingTester;