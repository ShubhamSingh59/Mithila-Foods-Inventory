import { runReport } from "./core";

export function getProfitAndLoss({ company, from_date, to_date }) {
  return runReport("Profit and Loss Statement", {
    company,
    periodicity: "Monthly",
    period_start_date: from_date,
    period_end_date: to_date,
  });
}

export function getAccountsReceivable({ company, report_date }) {
  return runReport("Accounts Receivable", { company, report_date });
}

export function getAccountsPayable({ company, report_date }) {
  return runReport("Accounts Payable", { company, report_date });
}