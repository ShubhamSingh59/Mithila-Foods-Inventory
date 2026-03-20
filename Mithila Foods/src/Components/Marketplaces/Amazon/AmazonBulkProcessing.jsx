import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../../api/core';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
const AmazonBulkProcessing = ({ ordersToProcess, onDone }) => {
    const [results, setResults] = useState([]);
    const [isProcessing, setIsProcessing] = useState(true);

    useEffect(() => {
        processAllOrders();
    }, []);

    const processAllOrders = async () => {
        setIsProcessing(true);
        const processingResults = [];

        // Loop through every order the user configured in the previous step
        for (const order of ordersToProcess) {
            let orderStatus = {
                orderId: order.AmazonOrderId,
                status: "Processing...",
                tracking: null,
                labelBase64: null,
                error: null
            };

            // Push the initial "Processing..." state to the UI immediately
            processingResults.push(orderStatus);
            setResults([...processingResults]);

            try {
                // ==========================================================
                // 🛑 LIVE MODE: Commented out for safety during UI testing
                // ==========================================================
                /*
                const quoteRes = await fetch(`${BACKEND_URL}/api/amazon/shipping-quotes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderId: order.AmazonOrderId,
                        weightGrams: order.weight,
                        length: order.length, width: order.width, height: order.height,
                        items: order.items
                    })
                });
                const quoteData = await quoteRes.json();
                if (quoteData.status !== "Success" || !quoteData.quotes || quoteData.quotes.length === 0) {
                    throw new Error("No eligible shipping services found for these dimensions.");
                }
                const selectedServiceId = quoteData.quotes[0].ShippingServiceId;

                const shipRes = await fetch(`${BACKEND_URL}/api/amazon/create-shipment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderId: order.AmazonOrderId,
                        weightGrams: order.weight,
                        length: order.length, width: order.width, height: order.height,
                        items: order.items,
                        shippingServiceId: selectedServiceId
                    })
                });
                const shipData = await shipRes.json();
                if (shipData.status !== "Success") throw new Error(shipData.error || "Failed to buy label.");
                */

                // ==========================================================
                // 🛡️ SAFE MODE: Mock API Call
                // ==========================================================
                const safeRes = await fetch(`${BACKEND_URL}/api/amazon/test-bulk-shipment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: order.AmazonOrderId })
                });

                const safeData = await safeRes.json();

                if (safeData.status !== "Success") {
                    throw new Error("Safe Mode Test Failed.");
                }

                // Success! Save the safe test data.
                orderStatus.status = "Success";
                orderStatus.tracking = safeData.trackingNumber;
                orderStatus.labelBase64 = safeData.labelBase64;

            } catch (error) {
                orderStatus.status = "Failed";
                orderStatus.error = error.message;
            }

            // Update the UI with the final success/fail state for this row
            setResults([...processingResults]);
        }

        setIsProcessing(false);
    };
    const downloadMasterLabel = async () => {
        try {
            const masterPdf = await PDFDocument.create();
            // Load a standard font so the PDF doesn't crash when drawing text
            const helveticaFont = await masterPdf.embedFont(StandardFonts.Helvetica);

            for (const res of results) {
                if (res.status === 'Success' && res.labelBase64) {

                    // 💡 IF THIS IS OUR FAKE TEST LABEL: Skip the parser and draw it manually
                    if (res.tracking && res.tracking.includes('MOCK-TRK')) {
                        const page = masterPdf.addPage([400, 250]); // Standard shipping label size
                        page.drawText(`Amazon Label (Mock)`, { x: 20, y: 180, size: 24, font: helveticaFont, color: rgb(0, 0.5, 0) });
                        page.drawText(`Order ID: ${res.orderId}`, { x: 20, y: 140, size: 14, font: helveticaFont });
                        page.drawText(`Tracking: ${res.tracking}`, { x: 20, y: 100, size: 14, font: helveticaFont });
                    }
                    // 💡 IF THIS IS A REAL AMAZON LABEL: Merge it normally
                    else {
                        try {
                            const individualPdf = await PDFDocument.load(res.labelBase64);
                            const copiedPages = await masterPdf.copyPages(individualPdf, individualPdf.getPageIndices());
                            copiedPages.forEach((page) => masterPdf.addPage(page));
                        } catch (parseError) {
                            console.error(`Failed to parse real PDF for ${res.orderId}`, parseError);
                        }
                    }
                }
            }

            const mergedPdfBytes = await masterPdf.save();
            const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `Amazon_Master_Labels_${new Date().getTime()}.pdf`;
            link.click();
        } catch (error) {
            console.error("Error merging PDFs:", error);
            alert("Failed to generate the Master PDF.");
        }
    };
    // Helper to count how many successful labels we have
    const successfulLabelsCount = results.filter(r => r.status === 'Success' && r.labelBase64).length;
    const downloadLabel = (base64Data, orderId) => {
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${base64Data}`;
        link.download = `Amazon_Label_${orderId}.pdf`;
        link.click();
    };

    return (
        <div>
            <h2>Processing Shipments</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <p style={{ margin: 0, fontWeight: 'bold' }}>
                    {isProcessing
                        ? "⏳ Please wait, communicating with Amazon..."
                        : "✅ Batch processing complete!"}
                </p>

                {/* 💡 THE MASTER DOWNLOAD BUTTON */}
                {!isProcessing && successfulLabelsCount > 0 && (
                    <button
                        onClick={downloadMasterLabel}
                        style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        🖨️ Print Master PDF ({successfulLabelsCount} Labels)
                    </button>
                )}
            </div>

            <button onClick={onDone} disabled={isProcessing} style={{ marginBottom: '15px' }}>
                ← Return to Order List
            </button>

            <table border="1" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f4f4f4' }}>
                        <th align="left" style={{ padding: '10px' }}>Order ID</th>
                        <th align="left" style={{ padding: '10px' }}>Status</th>
                        <th align="left" style={{ padding: '10px' }}>Tracking Number</th>
                        <th align="left" style={{ padding: '10px' }}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {results.map((res, index) => (
                        <tr key={index} style={{ backgroundColor: res.status === 'Failed' ? '#fee2e2' : 'transparent' }}>
                            <td style={{ padding: '10px' }}><strong>{res.orderId}</strong></td>
                            <td style={{ padding: '10px' }}>
                                {res.status === 'Success' ? 'Success' : res.status === 'Failed' ? '❌ Failed' : '🔄 Processing'}
                                {res.error && <div style={{ color: 'red', fontSize: '0.8rem', marginTop: '5px' }}>{res.error}</div>}
                            </td>
                            <td style={{ padding: '10px' }}>{res.tracking || '-'}</td>
                            <td style={{ padding: '10px' }}>
                                {res.status === 'Success' && res.labelBase64 && (
                                    <button
                                        onClick={() => downloadLabel(res.labelBase64, res.orderId)}
                                        style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        Download Label
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default AmazonBulkProcessing;