// src/api/analytics.js
import axios from "axios";
import { BACKEND_URL, getDoctypeList } from "./core.js";

// ------------------------------
// Report Runner
// ------------------------------

export async function runReport(report_name, filters = {}) {
  const res = await axios.post(`${BACKEND_URL}/api/report/run`, {
    report_name,
    filters,
  });
  return res.data;
}


// ------------------------------
// Fiscal Year Helpers
// ------------------------------


export async function getActiveFiscalYears() {
  const rows = await getDoctypeList("Fiscal Year", {
    fields: JSON.stringify(["name", "year_start_date", "year_end_date", "disabled"]),
    filters: JSON.stringify([["Fiscal Year", "disabled", "=", 0]]),
    order_by: "year_start_date desc",
    limit_page_length: 1000,
  });
  return rows || [];
}

export function pickFiscalYearForDate(fys, dateStr) {
  return fys.find((fy) => fy.year_start_date <= dateStr && dateStr <= fy.year_end_date) || fys[0] || null;
}


// ------------------------------
// Standard ERPNext Reports
// ------------------------------


export function getProfitAndLoss({ company, from_date, to_date, periodicity = "Monthly" }) {
  return runReport("Profit and Loss Statement", {
    company, periodicity, period_start_date: from_date, period_end_date: to_date,
  });
}

export function getSalesAnalytics({ company, from_date, to_date, range = "Monthly", value_quantity = "Value", tree_type = "Item Group", doc_type = "Sales Invoice" }) {
  return runReport("Sales Analytics", {
    company, from_date, to_date, range, value_quantity, tree_type, doc_type,
  });
}

export function getPurchaseAnalytics({ company, from_date, to_date, range = "Monthly", value_quantity = "Value", tree_type = "Item Group", doc_type = "Purchase Invoice" }) {
  return runReport("Purchase Analytics", {
    company, from_date, to_date, range, value_quantity, tree_type, doc_type,
  });
}

export function getStockBalance({ company }) {
  return runReport("Stock Balance", { company });
}

export function getAccountsReceivable({ company, report_date }) {
  return runReport("Accounts Receivable", { company, report_date });
}

export function getAccountsPayable({ company, report_date }) {
  return runReport("Accounts Payable", { company, report_date });
}