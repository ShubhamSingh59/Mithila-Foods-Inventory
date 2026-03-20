import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../../api/core';

const AmazonPayoutWidget = () => {
    const [payoutData, setPayoutData] = useState(null);
    const [breakdown, setBreakdown] = useState(null);
    const [accountReserve, setAccountReserve] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchPayout();
    }, []);

    const fetchPayout = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${BACKEND_URL}/api/amazon/finances/next-payout`);
            const result = await response.json();
            console.log(result)
            if (result.status !== "Success") throw new Error("Failed to fetch financial data.");

            setPayoutData(result.payout);
            setBreakdown(result.breakdown);
            setAccountReserve(result.accountReserve || 0); // 💡 Save the new reserve data
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div style={{ padding: '20px', color: '#6b7280' }}>⏳ Securely fetching financial data...</div>;
    if (error || !payoutData) return <div style={{ color: '#b91c1c' }}>❌ Error loading finances</div>;

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency', currency: payoutData.OriginalTotal?.CurrencyCode || 'INR', minimumFractionDigits: 2
        }).format(amount);
    };

    const netAmount = formatCurrency(payoutData.OriginalTotal?.CurrencyAmount || 0);
    const reserveFormatted = formatCurrency(accountReserve);
    const expectedDate = payoutData.FundTransferDate
        ? new Date(payoutData.FundTransferDate).toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })
        : "Pending Amazon Schedule";

    return (
        // 💡 NEW: A Flex container to hold both cards side-by-side
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>

            {/* CARD 1: The Original Net Payout Card */}
            <div style={{
                padding: '24px', backgroundColor: '#ffffff', borderRadius: '12px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '1px solid #e5e7eb', width: '350px',
                fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#4b5563', fontWeight: '600' }}>Next Amazon Payout</h3>
                    <span style={{ backgroundColor: payoutData.ProcessingStatus === 'Open' ? '#dcfce7' : '#f3f4f6', color: payoutData.ProcessingStatus === 'Open' ? '#166534' : '#4b5563', padding: '4px 8px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {payoutData.ProcessingStatus === 'Open' ? '🟢 ACCUMULATING' : '⚪ CLOSED'}
                    </span>
                </div>
                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#111827', marginBottom: '5px' }}>{netAmount}</div>
                <div style={{ display: 'flex', alignItems: 'center', color: '#6b7280', fontSize: '0.875rem', marginBottom: '20px' }}>
                    🗓️ Expected: <strong>&nbsp;{expectedDate}</strong>
                </div>

                {breakdown && (
                    <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '15px', border: '1px solid #f3f4f6' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#6b7280', marginBottom: '10px', textTransform: 'uppercase' }}>Current Cycle Breakdown</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                            <span style={{ color: '#4b5563' }}>Product Sales</span>
                            <span style={{ color: '#059669', fontWeight: '600' }}>+{formatCurrency(breakdown.grossSales)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                            <span style={{ color: '#4b5563' }}>Amazon Fees</span>
                            <span style={{ color: '#dc2626', fontWeight: '600' }}>{formatCurrency(breakdown.amazonFees)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.9rem' }}>
                            <span style={{ color: '#4b5563' }}>Refunds</span>
                            <span style={{ color: '#dc2626', fontWeight: '600' }}>{formatCurrency(breakdown.refunds)}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* CARD 2: 💡 NEW - The Account Level Reserve Tracker */}
            <div style={{
                padding: '24px', backgroundColor: '#fff7ed', borderRadius: '12px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '1px solid #ffedd5', width: '350px',
                fontFamily: 'system-ui, -apple-system, sans-serif', height: 'fit-content'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#9a3412', fontWeight: '600' }}>Account Level Reserve</h3>
                    <span style={{ backgroundColor: '#ffedd5', color: '#9a3412', padding: '4px 8px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        🔒 LOCKED FUNDS
                    </span>
                </div>

                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#ea580c', marginBottom: '5px' }}>
                    {reserveFormatted}
                </div>

                <p style={{ color: '#9a3412', fontSize: '0.85rem', lineHeight: '1.4', marginTop: '15px', borderTop: '1px solid #fdba74', paddingTop: '15px' }}>
                    Amazon is temporarily holding these funds to cover potential A-to-z Guarantee claims, chargebacks, and customer returns. This amount will be released automatically in future cycles.
                </p>
            </div>

        </div>
    );
};

export default AmazonPayoutWidget;