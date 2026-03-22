import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../../api/core';
import './AmazonPayoutWidget.css'; 

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
            console.log(result);
            if (result.status !== "Success") throw new Error("Failed to fetch financial data.");

            setPayoutData(result.payout);
            setBreakdown(result.breakdown);
            setAccountReserve(result.accountReserve || 0); 
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="payout-loading-msg">⏳ Securely fetching financial data...</div>;
    if (error || !payoutData) return <div className="payout-error-msg">❌ Error loading finances</div>;

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

    // Dynamic class for the status badge
    const badgeClass = payoutData.ProcessingStatus === 'Open' ? 'badge-open' : 'badge-closed';

    return (
        <div className="payout-widget-container">

            {/* CARD 1: The Original Net Payout Card */}
            <div className="payout-card">
                <div className="card-header">
                    <h3 className="payout-title">Next Amazon Payout</h3>
                    <span className={`status-badge ${badgeClass}`}>
                        {payoutData.ProcessingStatus === 'Open' ? '🟢 ACCUMULATING' : '⚪ CLOSED'}
                    </span>
                </div>
                
                <div className="amount-main amount-payout-text">{netAmount}</div>
                
                <div className="expected-date">
                     Expected: <strong>&nbsp;{expectedDate}</strong>
                </div>

                {breakdown && (
                    <div className="breakdown-box">
                        <div className="breakdown-title">Current Cycle Breakdown</div>
                        
                        <div className="breakdown-row breakdown-row-mb8">
                            <span className="breakdown-label">Product Sales</span>
                            <span className="breakdown-val-positive">+{formatCurrency(breakdown.grossSales)}</span>
                        </div>
                        
                        <div className="breakdown-row breakdown-row-mb8">
                            <span className="breakdown-label">Amazon Fees</span>
                            <span className="breakdown-val-negative">{formatCurrency(breakdown.amazonFees)}</span>
                        </div>
                        
                        <div className="breakdown-row breakdown-row-mb12">
                            <span className="breakdown-label">Refunds</span>
                            <span className="breakdown-val-negative">{formatCurrency(breakdown.refunds)}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* CARD 2: The Account Level Reserve Tracker */}
            <div className="reserve-card">
                <div className="card-header">
                    <h3 className="reserve-title">Account Level Reserve</h3>
                    <span className="status-badge badge-locked">
                        🔒 LOCKED FUNDS
                    </span>
                </div>

                <div className="amount-main amount-reserve-text">
                    {reserveFormatted}
                </div>

                <p className="reserve-footer">
                    Amazon is temporarily holding these funds to cover potential A-to-z Guarantee claims, chargebacks, and customer returns. This amount will be released automatically in future cycles.
                </p>
            </div>

        </div>
    );
};

export default AmazonPayoutWidget;