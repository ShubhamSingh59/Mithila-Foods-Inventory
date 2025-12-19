//import React, { useEffect, useMemo, useRef, useState } from "react";
//import {
//  getCustomers,
//  getFinishedItemsForSales,
//  createSalesInvoice,
//  submitDoc,
//  getRecentSalesInvoices,
//  createPaymentEntryForInvoice,
//  getSalesInvoiceWithItems,
//  getCompanies,
//  getWarehouses,
//} from "./erpBackendApi";

//import "../CSS/SalesEasyShip.css";

//const DEFAULT_COMPANY = "Mithila Foods";
//const DEFAULT_WAREHOUSE = "Finished Goods - MF";
//const DEFAULT_CUSTOMER = "Test Customer";
//const TRY_SINGLE_LINE_FALLBACK = true;

///**
// * ✅ One date helper only:
// * ISO datetime OR DD-MM-YYYY OR YYYY-MM-DD -> YYYY-MM-DD
// */
//function toErpDate(input) {
//  const s = String(input ?? "").trim();
//  if (!s) return "";

//  // ISO datetime: 2025-12-09T01:06:41+00:00 -> 2025-12-09
//  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);

//  // Already OK
//  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

//  // DD-MM-YYYY -> YYYY-MM-DD
//  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
//  if (m) {
//    const [, dd, mm, yyyy] = m;
//    return `${yyyy}-${mm}-${dd}`;
//  }

//  return "";
//}

//function normalizeKey(k) {
//  return String(k ?? "")
//    .replace(/\uFEFF/g, "")
//    .trim()
//    // if header like "order-idA1:U2" -> remove trailing "A1:U2"
//    .replace(/[A-Z]+\d+:\w+\d+$/i, "")
//    .trim()
//    .toLowerCase()
//    .replace(/\s+/g, "-")
//    .replace(/_+/g, "-");
//}

//// Small CSV/TSV parser (handles quotes)
//function parseDelimited(text) {
//  const rawLines = String(text || "")
//    .replace(/\r\n/g, "\n")
//    .replace(/\r/g, "\n")
//    .split("\n")
//    .filter((l) => l.trim().length > 0);

//  if (!rawLines.length) return [];

//  const first = rawLines[0];
//  const tabCount = (first.match(/\t/g) || []).length;
//  const commaCount = (first.match(/,/g) || []).length;
//  const delim = tabCount >= commaCount ? "\t" : ",";

//  const splitLine = (line) => {
//    const out = [];
//    let cur = "";
//    let inQ = false;

//    for (let i = 0; i < line.length; i++) {
//      const ch = line[i];

//      if (ch === '"') {
//        if (inQ && line[i + 1] === '"') {
//          cur += '"';
//          i++;
//        } else {
//          inQ = !inQ;
//        }
//        continue;
//      }

//      if (!inQ && ch === delim) {
//        out.push(cur);
//        cur = "";
//        continue;
//      }

//      cur += ch;
//    }

//    out.push(cur);
//    return out.map((x) => String(x ?? "").trim());
//  };

//  const headers = splitLine(rawLines[0]).map(normalizeKey);
//  const rows = [];

//  for (let i = 1; i < rawLines.length; i++) {
//    const cols = splitLine(rawLines[i]);
//    const obj = {};
//    headers.forEach((h, idx) => {
//      obj[h] = cols[idx] ?? "";
//    });
//    rows.push(obj);
//  }

//  return rows;
//}

//// Concurrency limiter
//async function runWithLimit(items, limit, workerFn, onProgress) {
//  const out = new Array(items.length);
//  let i = 0;

//  const workers = new Array(limit).fill(0).map(async () => {
//    while (i < items.length) {
//      const idx = i++;
//      out[idx] = await workerFn(items[idx], idx);
//      onProgress?.(idx + 1);
//    }
//  });

//  await Promise.all(workers);
//  return out;
//}

//function SalesEasyShip() {
//  const [customers, setCustomers] = useState([]);
//  const [items, setItems] = useState([]); // MUST include custom_asin from API
//  const [companies, setCompanies] = useState([]);
//  const [warehouses, setWarehouses] = useState([]);

//  const [company, setCompany] = useState("");
//  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10)); // manual
//  const [customer, setCustomer] = useState("");
//  const [warehouse, setWarehouse] = useState(DEFAULT_WAREHOUSE);

//  // ✅ Bulk posting date selectable (default today)
//  const [bulkPostingDate, setBulkPostingDate] = useState(new Date().toISOString().slice(0, 10));

//  const [rows, setRows] = useState([createEmptyRow(0)]);

//  const [recentInvoices, setRecentInvoices] = useState([]);
//  const [loadingInit, setLoadingInit] = useState(false);
//  const [loadingInvoices, setLoadingInvoices] = useState(false);
//  const [saving, setSaving] = useState(false);
//  const [payingInvoice, setPayingInvoice] = useState("");

//  const [error, setError] = useState("");
//  const [message, setMessage] = useState("");

//  // ✅ Bulk upload state
//  const fileRef = useRef(null);
//  const [bulkParsing, setBulkParsing] = useState(false);
//  const [bulkCreating, setBulkCreating] = useState(false);
//  const [bulkParseError, setBulkParseError] = useState("");
//  const [bulkLines, setBulkLines] = useState([]);
//  const [bulkResults, setBulkResults] = useState([]);
//  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

//  function createEmptyRow(id) {
//    return { id, item_code: "", qty: "", rate: "", rowError: "" };
//  }

//  function extractErrMsg(err) {
//    return (
//      err?.response?.data?.error?.message ||
//      err?.response?.data?.error ||
//      err?.message ||
//      "Unknown error"
//    );
//  }

//  // ✅ ASIN -> item_code map (Item.custom_asin)
//  const asinToItemCode = useMemo(() => {
//    const m = new Map();
//    (items || []).forEach((it) => {
//      const asin = String(it.custom_asin || "").trim().toUpperCase();
//      if (asin) m.set(asin, it.name);
//    });
//    return m;
//  }, [items]);

//  async function loadInvoices() {
//    setLoadingInvoices(true);
//    try {
//      const base = await getRecentSalesInvoices(20);

//      const enriched = [];
//      for (const inv of base) {
//        try {
//          const doc = await getSalesInvoiceWithItems(inv.name);
//          const invItems = doc.items || [];
//          let totalQty = 0;
//          let uom = "";

//          invItems.forEach((it) => {
//            const q = parseFloat(it.qty) || 0;
//            totalQty += q;
//            if (!uom && it.uom) uom = it.uom;
//          });

//          enriched.push({ ...inv, total_qty: totalQty, uom });
//        } catch (err) {
//          console.error("Failed to load items for invoice", inv.name, err);
//          enriched.push({ ...inv, total_qty: null, uom: "" });
//        }
//      }

//      setRecentInvoices(enriched);
//    } catch (err) {
//      console.error(err);
//    } finally {
//      setLoadingInvoices(false);
//    }
//  }

//  async function reloadRecentInvoices() {
//    await loadInvoices();
//  }

//  useEffect(() => {
//    async function loadInit() {
//      setLoadingInit(true);
//      setError("");
//      try {
//        const [custData, itemData, companyData, whData] = await Promise.all([
//          getCustomers(),
//          getFinishedItemsForSales(),
//          getCompanies(),
//          getWarehouses(),
//        ]);

//        setCustomers(custData || []);
//        setItems(itemData || []);
//        setCompanies(companyData || []);
//        setWarehouses(whData || []);

//        // defaults (still editable)
//        if (!company) {
//          const ok = (companyData || []).some((c) => c.name === DEFAULT_COMPANY);
//          setCompany(ok ? DEFAULT_COMPANY : (companyData?.[0]?.name || ""));
//        }
//        if (!customer) {
//          const ok = (custData || []).some((c) => c.name === DEFAULT_CUSTOMER);
//          setCustomer(ok ? DEFAULT_CUSTOMER : (custData?.[0]?.name || ""));
//        }
//        if (!warehouse) setWarehouse(DEFAULT_WAREHOUSE);
//      } catch (err) {
//        console.error(err);
//        setError(err.message || "Failed to load customers / items / companies");
//      } finally {
//        setLoadingInit(false);
//      }
//    }

//    loadInit();
//    loadInvoices();
//    // eslint-disable-next-line react-hooks/exhaustive-deps
//  }, []);

//  // =========================
//  // ✅ Manual flow (UNCHANGED)
//  // =========================
//  function handleRowChange(rowId, field, value) {
//    setRows((prev) =>
//      prev.map((r) => (r.id === rowId ? { ...r, [field]: value, rowError: "" } : r))
//    );
//  }

//  function handleItemChange(rowId, itemCode) {
//    setRows((prev) =>
//      prev.map((r) => (r.id === rowId ? { ...r, item_code: itemCode, rowError: "" } : r))
//    );
//  }

//  function addRow() {
//    setRows((prev) => [
//      ...prev,
//      createEmptyRow(prev.length ? prev[prev.length - 1].id + 1 : 0),
//    ]);
//  }

//  function removeRow(rowId) {
//    setRows((prev) => prev.filter((r) => r.id !== rowId));
//  }

//  async function handleSubmit(e) {
//    e.preventDefault();
//    setError("");
//    setMessage("");

//    if (!company) return setError("Company is required (same as in ERPNext).");
//    if (!postingDate) return setError("Posting date is required.");
//    if (!customer) return setError("Select a customer.");
//    if (!warehouse) return setError("Warehouse is required.");

//    const validRows = rows.filter(
//      (r) => r.item_code && !isNaN(parseFloat(r.qty)) && parseFloat(r.qty) > 0
//    );
//    if (!validRows.length) return setError("Add at least one item with quantity.");

//    const itemsPayload = validRows.map((r) => ({
//      item_code: r.item_code,
//      qty: parseFloat(r.qty),
//      rate: r.rate ? parseFloat(r.rate) : undefined,
//    }));

//    try {
//      setSaving(true);

//      // ✅ same manual workflow (create -> submit)
//      const doc = await createSalesInvoice({
//        customer,
//        company,
//        posting_date: postingDate,
//        warehouse,
//        items: itemsPayload,
//        // due_date handled in API (safe)
//      });

//      const name = doc?.data?.name;

//      if (name) {
//        await submitDoc("Sales Invoice", name);
//        setMessage(`Sales Invoice (EasyShip) created and submitted: ${name}`);
//      } else {
//        setMessage("Sales Invoice created (no name returned).");
//      }

//      setRows([createEmptyRow(0)]);
//      await reloadRecentInvoices();
//    } catch (err) {
//      console.error(err);
//      setError(extractErrMsg(err) || "Failed to create / submit Sales Invoice");
//    } finally {
//      setSaving(false);
//    }
//  }

//  async function handleMarkPaid(inv) {
//    setError("");
//    setMessage("");
//    setPayingInvoice(inv.name);

//    try {
//      await createPaymentEntryForInvoice(inv);
//      setMessage(`Marked as Paid via Payment Entry: ${inv.name}`);
//      await reloadRecentInvoices();
//    } catch (err) {
//      console.error(err);
//      setError(extractErrMsg(err) || "Failed to mark invoice as paid");
//    } finally {
//      setPayingInvoice("");
//    }
//  }

//  // =========================
//  // ✅ Bulk upload
//  // =========================
//  async function parseAnyFile(file) {
//    const name = String(file?.name || "").toLowerCase();

//    // XLSX / XLS
//    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
//      let mod;
//      try {
//        mod = await import("xlsx");
//      } catch (e) {
//        throw new Error('To import .xlsx, run: npm i xlsx (then restart dev server).');
//      }

//      // ✅ Fix for Vite: sometimes module has no default
//      const XLSX = mod?.default || mod;
//      if (!XLSX?.read || !XLSX?.utils) {
//        throw new Error("xlsx library not loaded correctly. Restart dev server.");
//      }

//      const buf = await file.arrayBuffer();
//      const wb = XLSX.read(buf, { type: "array" });
//      const sheetName = wb.SheetNames[0];
//      const ws = wb.Sheets[sheetName];

//      const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

//      return json.map((row) => {
//        const out = {};
//        Object.keys(row || {}).forEach((k) => {
//          out[normalizeKey(k)] = row[k];
//        });
//        return out;
//      });
//    }

//    // CSV/TSV/TXT
//    const text = await file.text();
//    return parseDelimited(text);
//  }

//  function clearFile() {
//    if (fileRef.current) fileRef.current.value = "";
//  }

//  function resetBulk() {
//    setBulkParseError("");
//    setBulkLines([]);
//    setBulkResults([]);
//    setBulkProgress({ done: 0, total: 0 });
//    clearFile();
//  }

//  async function handleFilePicked(e) {
//    setBulkParseError("");
//    setBulkLines([]);
//    setBulkResults([]);
//    setBulkProgress({ done: 0, total: 0 });

//    const file = e.target.files?.[0];
//    if (!file) return;

//    try {
//      setBulkParsing(true);

//      const raw = await parseAnyFile(file);

//      const lines = [];
//      const errs = [];

//      raw.forEach((r, idx) => {
//        const invoiceId = String(r["invoice-id"] || "").trim();
//        const asin = String(r["asin"] || "").trim().toUpperCase();
//        const qty = parseFloat(r["quantity-purchased"]);

//        // ✅ purchase-date is used for po_date now
//        const purchaseDate = toErpDate(r["purchase-date"]); // YYYY-MM-DD

//        const sku = String(r["sku"] || "").trim();
//        const rateRaw = r["rate"] ?? r["item-price"] ?? r["price"] ?? "";

//        if (!invoiceId || !asin || !qty || qty <= 0 || !purchaseDate) {
//          errs.push(
//            `Row ${idx + 2}: missing/invalid invoice-id, asin, quantity-purchased, or purchase-date`
//          );
//          return;
//        }

//        // ✅ map ASIN -> item_code
//        let item_code = asinToItemCode.get(asin) || "";

//        // fallback: if sku matches item code
//        if (!item_code && sku && (items || []).some((it) => it.name === sku)) {
//          item_code = sku;
//        }

//        lines.push({
//          rowNo: idx + 2,
//          invoice_id: invoiceId,
//          asin,
//          sku,
//          purchase_date: purchaseDate, // ✅ keep separately for po_date
//          qty,
//          rate: rateRaw !== "" && !isNaN(parseFloat(rateRaw)) ? parseFloat(rateRaw) : undefined,
//          item_code,
//          product_name: String(r["product-name"] || "").trim(),
//        });
//      });

//      if (errs.length) {
//        setBulkParseError(
//          errs.slice(0, 5).join(" | ") + (errs.length > 5 ? ` (+${errs.length - 5} more)` : "")
//        );
//      }

//      const missing = lines.filter((x) => !x.item_code);
//      if (missing.length) {
//        setBulkParseError((prev) => {
//          const extra = `ASIN not mapped to Item.custom_asin for ${missing.length} line(s).`;
//          return prev ? `${prev} | ${extra}` : extra;
//        });
//      }

//      setBulkLines(lines);
//    } catch (err) {
//      console.error(err);
//      setBulkParseError(err.message || "Failed to parse file");
//    } finally {
//      setBulkParsing(false);
//    }
//  }

//  async function handleBulkCreate() {
//    setError("");
//    setMessage("");
//    setBulkResults([]);

//    if (!company) return setError("Company is required.");
//    if (!customer) return setError("Customer is required.");
//    if (!warehouse) return setError("Warehouse is required.");
//    if (!bulkLines.length) return setError("No parsed lines. Upload a file first.");
//    if (!bulkPostingDate) return setError("Select a Bulk Posting Date.");

//    // 1) Split: unmapped lines -> FAILED, mapped lines -> continue
//    const preResults = [];
//    const usableLines = [];

//    for (const l of bulkLines) {
//      if (!l.item_code) {
//        preResults.push({
//          invoice_id: l.invoice_id,
//          asin: l.asin,
//          qty: l.qty,
//          item_code: "",
//          status: "FAILED",
//          si_name: "",
//          message: "ASIN not found in Item.custom_asin (or SKU fallback).",
//        });
//      } else {
//        usableLines.push(l);
//      }
//    }

//    // If everything unmapped, show results and stop
//    if (!usableLines.length) {
//      setBulkResults(preResults);
//      setError("All rows failed (ASIN mapping missing). Fix Item.custom_asin and re-upload.");
//      return;
//    }

//    // 2) Group by invoice-id
//    const groupsMap = new Map();
//    for (const l of usableLines) {
//      const key = l.invoice_id;
//      const g = groupsMap.get(key) || {
//        invoice_id: l.invoice_id,
//        lines: [],
//      };

//      g.lines.push(l);
//      groupsMap.set(key, g);
//    }

//    const groups = Array.from(groupsMap.values()).sort((a, b) =>
//      a.invoice_id.localeCompare(b.invoice_id)
//    );

//    setBulkCreating(true);
//    setBulkProgress({ done: 0, total: groups.length });

//    const allResults = [];

//    try {
//      await runWithLimit(
//        groups,
//        2,
//        async (g) => {
//          // ✅ posting_date for invoice is selected by user (bulkPostingDate)
//          const posting = bulkPostingDate; // YYYY-MM-DD
//          const due = posting; // safe

//          // ✅ po_date should be from purchase-date in sheet (earliest in that invoice-id)
//          const poDate =
//            (g.lines || [])
//              .map((x) => x.purchase_date)
//              .filter(Boolean)
//              .sort()[0] || "";

//          const itemsPayload = g.lines.map((l) => ({
//            item_code: l.item_code,
//            qty: l.qty,
//            rate: l.rate,
//          }));

//          // helper: mark all lines with same status/message
//          const markAll = (status, msg, siName = "") => {
//            g.lines.forEach((l) => {
//              allResults.push({
//                invoice_id: g.invoice_id,
//                asin: l.asin,
//                qty: l.qty,
//                item_code: l.item_code,
//                status,
//                si_name: siName,
//                message: msg,
//              });
//            });
//          };

//          try {
//            // 1) create normal (one invoice per invoice-id)
//            const created = await createSalesInvoice({
//              customer,
//              company,
//              posting_date: posting,
//              due_date: due,
//              warehouse,
//              items: itemsPayload,
//              po_no: g.invoice_id,
//              po_date: poDate, // ✅ NEW FIELD
//              remarks: `Imported from sheet. invoice-id=${g.invoice_id}`,
//            });

//            const siName = created?.data?.name || "";

//            // 2) submit
//            try {
//              if (siName) await submitDoc("Sales Invoice", siName);
//            } catch (subErr) {
//              const subMsg = `Created but submit failed: ${extractErrMsg(subErr)}`;
//              markAll("PARTIAL", subMsg, siName);
//              return;
//            }

//            markAll("OK", "Created & submitted", siName);
//          } catch (err) {
//            const msg = extractErrMsg(err);

//            // ✅ fallback: try one-line invoices so some can still pass
//            if (TRY_SINGLE_LINE_FALLBACK) {
//              for (const l of g.lines) {
//                try {
//                  const created1 = await createSalesInvoice({
//                    customer,
//                    company,
//                    posting_date: posting,
//                    due_date: due,
//                    warehouse,
//                    items: [{ item_code: l.item_code, qty: l.qty, rate: l.rate }],
//                    po_no: g.invoice_id,
//                    po_date: l.purchase_date, // ✅ per-line po_date
//                    remarks: `Fallback single-line import. invoice-id=${g.invoice_id} asin=${l.asin}`,
//                  });

//                  const si1 = created1?.data?.name || "";

//                  try {
//                    if (si1) await submitDoc("Sales Invoice", si1);
//                  } catch (subErr) {
//                    allResults.push({
//                      invoice_id: g.invoice_id,
//                      asin: l.asin,
//                      qty: l.qty,
//                      item_code: l.item_code,
//                      status: "PARTIAL",
//                      si_name: si1,
//                      message: `Created but submit failed: ${extractErrMsg(subErr)}`,
//                    });
//                    continue;
//                  }

//                  allResults.push({
//                    invoice_id: g.invoice_id,
//                    asin: l.asin,
//                    qty: l.qty,
//                    item_code: l.item_code,
//                    status: "OK",
//                    si_name: si1,
//                    message: "Created & submitted (fallback single-line)",
//                  });
//                } catch (lineErr) {
//                  allResults.push({
//                    invoice_id: g.invoice_id,
//                    asin: l.asin,
//                    qty: l.qty,
//                    item_code: l.item_code,
//                    status: "FAILED",
//                    si_name: "",
//                    message: extractErrMsg(lineErr),
//                  });
//                }
//              }
//            } else {
//              // fail all lines in that invoice-id only (but continues other invoice-ids)
//              markAll("FAILED", msg, "");
//            }
//          }
//        },
//        (done) => setBulkProgress((p) => ({ ...p, done }))
//      );

//      // combine unmapped + processed
//      const finalResults = [...preResults, ...allResults];
//      setBulkResults(finalResults);

//      const ok = finalResults.filter((x) => x.status === "OK").length;
//      const partial = finalResults.filter((x) => x.status === "PARTIAL").length;
//      const failed = finalResults.filter((x) => x.status === "FAILED").length;

//      setMessage(`Bulk import finished. OK: ${ok}, PARTIAL: ${partial}, FAILED: ${failed}.`);

//      if (failed > 0) setError("Some lines failed. Check the results table.");

//      await reloadRecentInvoices();
//      clearFile();
//    } finally {
//      setBulkCreating(false);
//    }
//  }

//  // -------- render --------
//  return (
//    <div className="sales-easyship">
//      <div className="sales-header">
//        <div className="sales-title-block">
//          <h2 className="sales-title">EasyShip Sales (ERPNext)</h2>
//          <p className="sales-subtitle">Manual + Bulk Upload</p>
//        </div>
//        <div className="sales-header-pill">
//          {rows.length} line item{rows.length !== 1 ? "s" : ""}
//        </div>
//      </div>

//      {loadingInit && <div className="sales-loading text-muted">Loading customers / items...</div>}
//      {error && <div className="alert alert-error sales-error">{error}</div>}
//      {message && <div className="alert alert-success sales-message">{message}</div>}

//      {/* ✅ BULK UPLOAD */}
//      <div className="sales-recent-section" style={{ marginBottom: 16 }}>
//        <div className="sales-recent-header">
//          <h3 className="sales-recent-title">Bulk Upload (Amazon Sheet)</h3>
//          <button type="button" onClick={resetBulk} className="btn btn-secondary btn-sm">
//            Clear
//          </button>
//        </div>

//        <div className="sales-form-grid" style={{ marginTop: 12 }}>
//          <div className="sales-field-group">
//            <label className="form-label sales-field-label">Upload file (.tsv/.csv/.txt/.xlsx)</label>
//            <input
//              ref={fileRef}
//              type="file"
//              accept=".csv,.tsv,.txt,.xlsx,.xls"
//              className="input"
//              onChange={handleFilePicked}
//              disabled={bulkParsing || bulkCreating}
//            />
//            <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
//              Required columns: <b>invoice-id</b>, <b>asin</b>, <b>quantity-purchased</b>, <b>purchase-date</b>
//            </div>
//          </div>

//          {/* ✅ Bulk Posting Date */}
//          <div className="sales-field-group">
//            <label className="form-label sales-field-label">Posting Date (Bulk)</label>
//            <input
//              type="date"
//              className="input"
//              value={bulkPostingDate}
//              onChange={(e) => setBulkPostingDate(e.target.value)}
//              disabled={bulkParsing || bulkCreating}
//            />
//            <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
//              This will be the <b>Sales Invoice posting_date</b> for all invoices created from the file.
//            </div>
//          </div>

//          {/* ✅ Defaults as dropdowns */}
//          <div className="sales-field-group">
//            <label className="form-label sales-field-label">Company (Default)</label>
//            <select
//              value={company}
//              onChange={(e) => setCompany(e.target.value)}
//              className="select"
//              disabled={bulkParsing || bulkCreating}
//            >
//              <option value="">-- select company --</option>
//              {companies.map((c) => (
//                <option key={c.name} value={c.name}>
//                  {c.company_name || c.name}
//                  {c.abbr ? ` (${c.abbr})` : ""}
//                </option>
//              ))}
//            </select>
//          </div>

//          <div className="sales-field-group">
//            <label className="form-label sales-field-label">Customer (Default)</label>
//            <select
//              value={customer}
//              onChange={(e) => setCustomer(e.target.value)}
//              className="select"
//              disabled={bulkParsing || bulkCreating}
//            >
//              <option value="">-- select customer --</option>
//              {customers.map((c) => (
//                <option key={c.name} value={c.name}>
//                  {c.customer_name || c.name}
//                </option>
//              ))}
//            </select>
//          </div>

//          <div className="sales-field-group">
//            <label className="form-label sales-field-label">Warehouse (Default)</label>
//            {warehouses.length ? (
//              <select
//                value={warehouse}
//                onChange={(e) => setWarehouse(e.target.value)}
//                className="select"
//                disabled={bulkParsing || bulkCreating}
//              >
//                <option value="">-- select warehouse --</option>
//                {warehouses.map((w) => (
//                  <option key={w.name} value={w.name}>
//                    {w.warehouse_name || w.name}
//                  </option>
//                ))}
//              </select>
//            ) : (
//              <input
//                value={warehouse}
//                onChange={(e) => setWarehouse(e.target.value)}
//                className="input"
//                placeholder="e.g. Finished Goods - MF"
//                disabled={bulkParsing || bulkCreating}
//              />
//            )}
//          </div>
//        </div>

//        {bulkParseError && (
//          <div className="alert alert-error sales-error" style={{ marginTop: 12 }}>
//            {bulkParseError}
//          </div>
//        )}

//        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
//          <button
//            type="button"
//            onClick={handleBulkCreate}
//            disabled={bulkCreating || bulkParsing || !bulkLines.length}
//            className="btn btn-primary"
//          >
//            {bulkCreating ? "Creating..." : "Create Invoices from File"}
//          </button>

//          <div className="text-muted" style={{ fontSize: 12 }}>
//            Parsed lines: <b>{bulkLines.length}</b> | Invoices:{" "}
//            <b>{new Set(bulkLines.map((x) => x.invoice_id)).size}</b>
//            {bulkCreating ? (
//              <>
//                {" "}
//                | Progress: <b>{bulkProgress.done}/{bulkProgress.total}</b>
//              </>
//            ) : null}
//          </div>
//        </div>

//        {/* ✅ Per-line results */}
//        {bulkResults.length > 0 && (
//          <div className="sales-recent-table-wrapper table-container" style={{ marginTop: 14 }}>
//            <table className="table sales-recent-table">
//              <thead>
//                <tr>
//                  <th>Invoice-ID</th>
//                  <th>ASIN</th>
//                  <th>Item Code</th>
//                  <th>Qty</th>
//                  <th>Status</th>
//                  <th>ERPNext Invoice</th>
//                  <th>Error / Message</th>
//                </tr>
//              </thead>
//              <tbody>
//                {bulkResults.map((r, idx) => (
//                  <tr key={`${r.invoice_id}-${r.asin}-${idx}`}>
//                    <td>{r.invoice_id}</td>
//                    <td>{r.asin}</td>
//                    <td>{r.item_code}</td>
//                    <td>{r.qty}</td>
//                    <td>
//                      <span className={"sales-status-pill " + (r.status === "OK" ? "paid" : "unpaid")}>
//                        {r.status}
//                      </span>
//                    </td>
//                    <td>{r.si_name || "-"}</td>
//                    <td style={{ maxWidth: 520, whiteSpace: "pre-wrap" }}>{r.message}</td>
//                  </tr>
//                ))}
//              </tbody>
//            </table>
//          </div>
//        )}
//      </div>

//      {/* ✅ MANUAL FLOW (same as your existing) */}
//      <form onSubmit={handleSubmit} className="sales-form">
//        <div className="sales-form-grid">
//          <div className="sales-field-group">
//            <label htmlFor="sales-company" className="form-label sales-field-label">
//              Company
//            </label>
//            <select
//              id="sales-company"
//              value={company}
//              onChange={(e) => setCompany(e.target.value)}
//              className="select"
//            >
//              <option value="">-- select company --</option>
//              {companies.map((c) => (
//                <option key={c.name} value={c.name}>
//                  {c.company_name || c.name}
//                  {c.abbr ? ` (${c.abbr})` : ""}
//                </option>
//              ))}
//            </select>
//          </div>

//          <div className="sales-field-group">
//            <label htmlFor="sales-posting-date" className="form-label sales-field-label">
//              Posting Date
//            </label>
//            <input
//              id="sales-posting-date"
//              type="date"
//              value={postingDate}
//              onChange={(e) => setPostingDate(e.target.value)}
//              className="input"
//            />
//          </div>

//          <div className="sales-field-group">
//            <label htmlFor="sales-customer" className="form-label sales-field-label">
//              Customer
//            </label>
//            <select
//              id="sales-customer"
//              value={customer}
//              onChange={(e) => setCustomer(e.target.value)}
//              className="select"
//            >
//              <option value="">-- select customer --</option>
//              {customers.map((c) => (
//                <option key={c.name} value={c.name}>
//                  {c.customer_name || c.name}
//                </option>
//              ))}
//            </select>
//          </div>

//          <div className="sales-field-group">
//            <label htmlFor="sales-warehouse" className="form-label sales-field-label">
//              Warehouse (stock goes out from)
//            </label>
//            {warehouses.length ? (
//              <select
//                id="sales-warehouse"
//                value={warehouse}
//                onChange={(e) => setWarehouse(e.target.value)}
//                className="select"
//              >
//                <option value="">-- select warehouse --</option>
//                {warehouses.map((w) => (
//                  <option key={w.name} value={w.name}>
//                    {w.warehouse_name || w.name}
//                  </option>
//                ))}
//              </select>
//            ) : (
//              <input
//                id="sales-warehouse"
//                value={warehouse}
//                onChange={(e) => setWarehouse(e.target.value)}
//                placeholder="e.g. Finished Goods - MF"
//                className="input"
//              />
//            )}
//          </div>
//        </div>

//        <div className="sales-items-header">
//          <h3 className="sales-items-title">Items (Finished Goods / Products)</h3>
//          <button type="button" onClick={addRow} className="btn btn-accent btn-sm">
//            + Add Item
//          </button>
//        </div>

//        <div className="sales-items-rows">
//          {rows.map((row, index) => (
//            <div key={row.id} className="sales-item-row-card">
//              <div className="sales-item-row-header">
//                <span className="sales-item-row-title">
//                  Line #{index + 1}
//                  {row.item_code ? ` · ${row.item_code}` : ""}
//                </span>
//                <button type="button" onClick={() => removeRow(row.id)} className="btn btn-ghost btn-sm">
//                  Remove
//                </button>
//              </div>

//              <div className="sales-item-row-grid">
//                <div className="sales-item-field">
//                  <label className="form-label">Item</label>
//                  <ItemSearchDropdown
//                    items={items}
//                    value={row.item_code}
//                    onSelect={(code) => handleItemChange(row.id, code)}
//                    placeholder="Search item name / code..."
//                  />
//                </div>

//                <div className="sales-item-field">
//                  <label className="form-label">Qty</label>
//                  <input
//                    type="number"
//                    value={row.qty}
//                    onChange={(e) => handleRowChange(row.id, "qty", e.target.value)}
//                    className="input"
//                  />
//                </div>

//                <div className="sales-item-field">
//                  <label className="form-label">Rate</label>
//                  <input
//                    type="number"
//                    value={row.rate}
//                    onChange={(e) => handleRowChange(row.id, "rate", e.target.value)}
//                    className="input"
//                    placeholder="Leave empty to use default logic / price list"
//                  />
//                </div>
//              </div>

//              {row.rowError && <div className="sales-row-error">{row.rowError}</div>}
//            </div>
//          ))}
//        </div>

//        <div className="sales-submit-row">
//          <button type="submit" disabled={saving || loadingInit} className="btn btn-primary">
//            {saving ? "Creating..." : "Create EasyShip Sale"}
//          </button>
//        </div>
//      </form>

//      {/* RECENT SALES LIST */}
//      <div className="sales-recent-section">
//        <div className="sales-recent-header">
//          <h3 className="sales-recent-title">Recent Sales (Submitted Sales Invoices)</h3>
//          <button
//            type="button"
//            onClick={reloadRecentInvoices}
//            disabled={loadingInvoices}
//            className="btn btn-secondary btn-sm"
//          >
//            {loadingInvoices ? "Refreshing..." : "Refresh"}
//          </button>
//        </div>

//        {loadingInvoices && <div className="sales-recent-loading text-muted">Loading recent invoices...</div>}

//        {!loadingInvoices && recentInvoices.length === 0 && (
//          <div className="sales-recent-empty text-muted">No recent invoices found.</div>
//        )}

//        {!loadingInvoices && recentInvoices.length > 0 && (
//          <div className="sales-recent-table-wrapper table-container">
//            <table className="table sales-recent-table">
//              <thead>
//                <tr>
//                  <th>Invoice</th>
//                  <th>Customer</th>
//                  <th>Date</th>
//                  <th>Status</th>
//                  <th>Grand Total</th>
//                  <th>Outstanding</th>
//                  <th>Total Qty (Unit)</th>
//                  <th style={{ textAlign: "right" }}>Actions</th>
//                </tr>
//              </thead>
//              <tbody>
//                {recentInvoices.map((inv) => {
//                  const isPaid = inv.status === "Paid" || (inv.outstanding_amount || 0) <= 0;
//                  const isMarking = payingInvoice === inv.name;

//                  return (
//                    <tr key={inv.name}>
//                      <td className="sales-recent-name-cell">{inv.name}</td>
//                      <td className="sales-recent-customer-cell">{inv.customer}</td>
//                      <td className="sales-recent-date-cell">{inv.posting_date}</td>
//                      <td>
//                        <span className={"sales-status-pill " + (isPaid ? "paid" : "unpaid")}>
//                          {inv.status}
//                        </span>
//                      </td>
//                      <td className="sales-recent-amount-cell">
//                        ₹ {inv.grand_total != null ? Number(inv.grand_total).toFixed(2) : "0.00"}
//                      </td>
//                      <td className="sales-recent-amount-cell">
//                        ₹ {inv.outstanding_amount != null ? Number(inv.outstanding_amount).toFixed(2) : "0.00"}
//                      </td>
//                      <td className="sales-recent-qty-cell">
//                        {inv.total_qty != null ? `${inv.total_qty} ${inv.uom || ""}` : "-"}
//                      </td>
//                      <td className="sales-recent-actions-cell">
//                        <button
//                          type="button"
//                          onClick={() => handleMarkPaid(inv)}
//                          disabled={isPaid || isMarking}
//                          className="btn btn-secondary btn-sm"
//                        >
//                          {isPaid ? "Paid" : isMarking ? "Marking..." : "Mark Paid"}
//                        </button>
//                      </td>
//                    </tr>
//                  );
//                })}
//              </tbody>
//            </table>
//          </div>
//        )}
//      </div>
//    </div>
//  );
//}

///* ✅ Same dropdown logic as StockTransfer */
//function ItemSearchDropdown({ items, value, onSelect, placeholder }) {
//  const [open, setOpen] = useState(false);
//  const [q, setQ] = useState("");
//  const ref = useRef(null);

//  const selected = useMemo(() => items.find((x) => x.name === value) || null, [items, value]);

//  const filtered = useMemo(() => {
//    const s = (q || "").trim().toLowerCase();
//    const base = !s
//      ? items
//      : items.filter((it) => {
//          const code = (it.name || "").toLowerCase();
//          const name = (it.item_name || "").toLowerCase();
//          return code.includes(s) || name.includes(s);
//        });
//    return base.slice(0, 80);
//  }, [items, q]);

//  useEffect(() => {
//    function onDown(e) {
//      if (!ref.current) return;
//      if (!ref.current.contains(e.target)) setOpen(false);
//    }
//    document.addEventListener("mousedown", onDown);
//    return () => document.removeEventListener("mousedown", onDown);
//  }, []);

//  return (
//    <div className="stdrop" ref={ref}>
//      <button
//        type="button"
//        className={`stdrop-control ${open ? "is-open" : ""}`}
//        onClick={() => setOpen((v) => !v)}
//      >
//        <div className="stdrop-value">
//          {selected ? (
//            <>
//              <div className="stdrop-title">{selected.name}</div>
//              <div className="stdrop-sub">
//                {selected.item_name || ""} {selected.stock_uom ? `· ${selected.stock_uom}` : ""}
//              </div>
//            </>
//          ) : (
//            <div className="stdrop-placeholder">{placeholder}</div>
//          )}
//        </div>
//        <div className="stdrop-caret">▾</div>
//      </button>

//      {open && (
//        <div className="stdrop-popover">
//          <div className="stdrop-search">
//            <input
//              autoFocus
//              className="input"
//              value={q}
//              onChange={(e) => setQ(e.target.value)}
//              placeholder="Type to search..."
//            />
//          </div>

//          <div className="stdrop-list">
//            {filtered.map((it) => (
//              <button
//                key={it.name}
//                type="button"
//                className="stdrop-item"
//                onClick={() => {
//                  onSelect(it.name);
//                  setOpen(false);
//                  setQ("");
//                }}
//              >
//                <div className="stdrop-item-title">{it.name}</div>
//                <div className="stdrop-item-sub">
//                  {it.item_name || ""} {it.stock_uom ? `· ${it.stock_uom}` : ""}
//                </div>
//              </button>
//            ))}

//            {!filtered.length ? (
//              <div className="stdrop-empty">No items found.</div>
//            ) : (
//              <div className="stdrop-hint">Showing up to 80 results</div>
//            )}
//          </div>
//        </div>
//      )}
//    </div>
//  );
//}

//export default SalesEasyShip;


// src/SalesEasyShip.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getCustomers,
  getFinishedItemsForSales,
  createSalesInvoice,
  submitDoc,
  getRecentSalesInvoices,
  createPaymentEntryForInvoice,
  getSalesInvoiceWithItems,
  getCompanies,
  getWarehouses,
} from "./erpBackendApi";

import "../CSS/SalesEasyShip.css";

const DEFAULT_COMPANY = "Mithila Foods";
const DEFAULT_WAREHOUSE = "Finished Goods - MF";
const DEFAULT_CUSTOMER = "Test Customer";
const TRY_SINGLE_LINE_FALLBACK = true;

/**
 * ✅ One date helper only:
 * ISO datetime OR DD-MM-YYYY OR YYYY-MM-DD -> YYYY-MM-DD
 */
function toErpDate(input) {
  const s = String(input ?? "").trim();
  if (!s) return "";

  // ISO datetime: 2025-12-09T01:06:41+00:00 -> 2025-12-09
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);

  // Already OK
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD-MM-YYYY -> YYYY-MM-DD
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm}-${dd}`;
  }

  return "";
}

function normalizeKey(k) {
  return String(k ?? "")
    .replace(/\uFEFF/g, "")
    .trim()
    // if header like "order-idA1:U2" -> remove trailing "A1:U2"
    .replace(/[A-Z]+\d+:\w+\d+$/i, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/_+/g, "-");
}

// Small CSV/TSV parser (handles quotes)
function parseDelimited(text) {
  const rawLines = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (!rawLines.length) return [];

  const first = rawLines[0];
  const tabCount = (first.match(/\t/g) || []).length;
  const commaCount = (first.match(/,/g) || []).length;
  const delim = tabCount >= commaCount ? "\t" : ",";

  const splitLine = (line) => {
    const out = [];
    let cur = "";
    let inQ = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
        continue;
      }

      if (!inQ && ch === delim) {
        out.push(cur);
        cur = "";
        continue;
      }

      cur += ch;
    }

    out.push(cur);
    return out.map((x) => String(x ?? "").trim());
  };

  const headers = splitLine(rawLines[0]).map(normalizeKey);
  const rows = [];

  for (let i = 1; i < rawLines.length; i++) {
    const cols = splitLine(rawLines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? "";
    });
    rows.push(obj);
  }

  return rows;
}

// Concurrency limiter
async function runWithLimit(items, limit, workerFn, onProgress) {
  const out = new Array(items.length);
  let i = 0;

  const workers = new Array(limit).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await workerFn(items[idx], idx);
      onProgress?.(idx + 1);
    }
  });

  await Promise.all(workers);
  return out;
}

function SalesEasyShip() {
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]); // MUST include custom_asin from API
  const [companies, setCompanies] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const [company, setCompany] = useState("");
  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10)); // manual
  const [customer, setCustomer] = useState("");
  const [warehouse, setWarehouse] = useState(DEFAULT_WAREHOUSE);

  // ✅ Bulk posting date selectable (default today)
  const [bulkPostingDate, setBulkPostingDate] = useState(new Date().toISOString().slice(0, 10));

  const [rows, setRows] = useState([createEmptyRow(0)]);

  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loadingInit, setLoadingInit] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ✅ Bulk upload state
  const fileRef = useRef(null);
  const [bulkParsing, setBulkParsing] = useState(false);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkParseError, setBulkParseError] = useState("");
  const [bulkLines, setBulkLines] = useState([]);
  const [bulkResults, setBulkResults] = useState([]);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  // ✅ UI tab (layout only, NO workflow changes)
  const [activeTab, setActiveTab] = useState("manual"); // "manual" | "bulk"

  function createEmptyRow(id) {
    return { id, item_code: "", qty: "", rate: "", rowError: "" };
  }

  function extractErrMsg(err) {
    return (
      err?.response?.data?.error?.message ||
      err?.response?.data?.error ||
      err?.message ||
      "Unknown error"
    );
  }

  // ✅ ASIN -> item_code map (Item.custom_asin)
  const asinToItemCode = useMemo(() => {
    const m = new Map();
    (items || []).forEach((it) => {
      const asin = String(it.custom_asin || "").trim().toUpperCase();
      if (asin) m.set(asin, it.name);
    });
    return m;
  }, [items]);

  async function loadInvoices() {
    setLoadingInvoices(true);
    try {
      const base = await getRecentSalesInvoices(20);

      const enriched = [];
      for (const inv of base) {
        try {
          const doc = await getSalesInvoiceWithItems(inv.name);
          const invItems = doc.items || [];
          let totalQty = 0;
          let uom = "";

          invItems.forEach((it) => {
            const q = parseFloat(it.qty) || 0;
            totalQty += q;
            if (!uom && it.uom) uom = it.uom;
          });

          enriched.push({ ...inv, total_qty: totalQty, uom });
        } catch (err) {
          console.error("Failed to load items for invoice", inv.name, err);
          enriched.push({ ...inv, total_qty: null, uom: "" });
        }
      }

      setRecentInvoices(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInvoices(false);
    }
  }

  async function reloadRecentInvoices() {
    await loadInvoices();
  }

  useEffect(() => {
    async function loadInit() {
      setLoadingInit(true);
      setError("");
      try {
        const [custData, itemData, companyData, whData] = await Promise.all([
          getCustomers(),
          getFinishedItemsForSales(),
          getCompanies(),
          getWarehouses(),
        ]);

        setCustomers(custData || []);
        setItems(itemData || []);
        setCompanies(companyData || []);
        setWarehouses(whData || []);

        // defaults (still editable)
        if (!company) {
          const ok = (companyData || []).some((c) => c.name === DEFAULT_COMPANY);
          setCompany(ok ? DEFAULT_COMPANY : (companyData?.[0]?.name || ""));
        }
        if (!customer) {
          const ok = (custData || []).some((c) => c.name === DEFAULT_CUSTOMER);
          setCustomer(ok ? DEFAULT_CUSTOMER : (custData?.[0]?.name || ""));
        }
        if (!warehouse) setWarehouse(DEFAULT_WAREHOUSE);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load customers / items / companies");
      } finally {
        setLoadingInit(false);
      }
    }

    loadInit();
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================
  // ✅ Manual flow (UNCHANGED)
  // =========================
  function handleRowChange(rowId, field, value) {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, [field]: value, rowError: "" } : r))
    );
  }

  function handleItemChange(rowId, itemCode) {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, item_code: itemCode, rowError: "" } : r))
    );
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      createEmptyRow(prev.length ? prev[prev.length - 1].id + 1 : 0),
    ]);
  }

  function removeRow(rowId) {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!company) return setError("Company is required (same as in ERPNext).");
    if (!postingDate) return setError("Posting date is required.");
    if (!customer) return setError("Select a customer.");
    if (!warehouse) return setError("Warehouse is required.");

    const validRows = rows.filter(
      (r) => r.item_code && !isNaN(parseFloat(r.qty)) && parseFloat(r.qty) > 0
    );
    if (!validRows.length) return setError("Add at least one item with quantity.");

    const itemsPayload = validRows.map((r) => ({
      item_code: r.item_code,
      qty: parseFloat(r.qty),
      rate: r.rate ? parseFloat(r.rate) : undefined,
    }));

    try {
      setSaving(true);

      // ✅ same manual workflow (create -> submit)
      const doc = await createSalesInvoice({
        customer,
        company,
        posting_date: postingDate,
        warehouse,
        items: itemsPayload,
        // due_date handled in API (safe)
      });

      const name = doc?.data?.name;

      if (name) {
        await submitDoc("Sales Invoice", name);
        setMessage(`Sales Invoice (EasyShip) created and submitted: ${name}`);
      } else {
        setMessage("Sales Invoice created (no name returned).");
      }

      setRows([createEmptyRow(0)]);
      await reloadRecentInvoices();
    } catch (err) {
      console.error(err);
      setError(extractErrMsg(err) || "Failed to create / submit Sales Invoice");
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkPaid(inv) {
    setError("");
    setMessage("");
    setPayingInvoice(inv.name);

    try {
      await createPaymentEntryForInvoice(inv);
      setMessage(`Marked as Paid via Payment Entry: ${inv.name}`);
      await reloadRecentInvoices();
    } catch (err) {
      console.error(err);
      setError(extractErrMsg(err) || "Failed to mark invoice as paid");
    } finally {
      setPayingInvoice("");
    }
  }

  // =========================
  // ✅ Bulk upload (UNCHANGED)
  // =========================
  async function parseAnyFile(file) {
    const name = String(file?.name || "").toLowerCase();

    // XLSX / XLS
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      let mod;
      try {
        mod = await import("xlsx");
      } catch (e) {
        throw new Error('To import .xlsx, run: npm i xlsx (then restart dev server).');
      }

      // ✅ Fix for Vite: sometimes module has no default
      const XLSX = mod?.default || mod;
      if (!XLSX?.read || !XLSX?.utils) {
        throw new Error("xlsx library not loaded correctly. Restart dev server.");
      }

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];

      const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

      return json.map((row) => {
        const out = {};
        Object.keys(row || {}).forEach((k) => {
          out[normalizeKey(k)] = row[k];
        });
        return out;
      });
    }

    // CSV/TSV/TXT
    const text = await file.text();
    return parseDelimited(text);
  }

  function clearFile() {
    if (fileRef.current) fileRef.current.value = "";
  }

  function resetBulk() {
    setBulkParseError("");
    setBulkLines([]);
    setBulkResults([]);
    setBulkProgress({ done: 0, total: 0 });
    clearFile();
  }

  async function handleFilePicked(e) {
    setBulkParseError("");
    setBulkLines([]);
    setBulkResults([]);
    setBulkProgress({ done: 0, total: 0 });

    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setBulkParsing(true);

      const raw = await parseAnyFile(file);

      const lines = [];
      const errs = [];

      raw.forEach((r, idx) => {
        const invoiceId = String(r["invoice-id"] || "").trim();
        const asin = String(r["asin"] || "").trim().toUpperCase();
        const qty = parseFloat(r["quantity-purchased"]);

        // ✅ purchase-date is used for po_date now
        const purchaseDate = toErpDate(r["purchase-date"]); // YYYY-MM-DD

        const sku = String(r["sku"] || "").trim();
        const rateRaw = r["rate"] ?? r["item-price"] ?? r["price"] ?? "";

        if (!invoiceId || !asin || !qty || qty <= 0 || !purchaseDate) {
          errs.push(
            `Row ${idx + 2}: missing/invalid invoice-id, asin, quantity-purchased, or purchase-date`
          );
          return;
        }

        // ✅ map ASIN -> item_code
        let item_code = asinToItemCode.get(asin) || "";

        // fallback: if sku matches item code
        if (!item_code && sku && (items || []).some((it) => it.name === sku)) {
          item_code = sku;
        }

        lines.push({
          rowNo: idx + 2,
          invoice_id: invoiceId,
          asin,
          sku,
          purchase_date: purchaseDate, // ✅ keep separately for po_date
          qty,
          rate:
            rateRaw !== "" && !isNaN(parseFloat(rateRaw)) ? parseFloat(rateRaw) : undefined,
          item_code,
          product_name: String(r["product-name"] || "").trim(),
        });
      });

      if (errs.length) {
        setBulkParseError(
          errs.slice(0, 5).join(" | ") + (errs.length > 5 ? ` (+${errs.length - 5} more)` : "")
        );
      }

      const missing = lines.filter((x) => !x.item_code);
      if (missing.length) {
        setBulkParseError((prev) => {
          const extra = `ASIN not mapped to Item.custom_asin for ${missing.length} line(s).`;
          return prev ? `${prev} | ${extra}` : extra;
        });
      }

      setBulkLines(lines);
    } catch (err) {
      console.error(err);
      setBulkParseError(err.message || "Failed to parse file");
    } finally {
      setBulkParsing(false);
    }
  }

  async function handleBulkCreate() {
    setError("");
    setMessage("");
    setBulkResults([]);

    if (!company) return setError("Company is required.");
    if (!customer) return setError("Customer is required.");
    if (!warehouse) return setError("Warehouse is required.");
    if (!bulkLines.length) return setError("No parsed lines. Upload a file first.");
    if (!bulkPostingDate) return setError("Select a Bulk Posting Date.");

    // 1) Split: unmapped lines -> FAILED, mapped lines -> continue
    const preResults = [];
    const usableLines = [];

    for (const l of bulkLines) {
      if (!l.item_code) {
        preResults.push({
          invoice_id: l.invoice_id,
          asin: l.asin,
          qty: l.qty,
          item_code: "",
          status: "FAILED",
          si_name: "",
          message: "ASIN not found in Item.custom_asin (or SKU fallback).",
        });
      } else {
        usableLines.push(l);
      }
    }

    // If everything unmapped, show results and stop
    if (!usableLines.length) {
      setBulkResults(preResults);
      setError("All rows failed (ASIN mapping missing). Fix Item.custom_asin and re-upload.");
      return;
    }

    // 2) Group by invoice-id
    const groupsMap = new Map();
    for (const l of usableLines) {
      const key = l.invoice_id;
      const g = groupsMap.get(key) || {
        invoice_id: l.invoice_id,
        lines: [],
      };

      g.lines.push(l);
      groupsMap.set(key, g);
    }

    const groups = Array.from(groupsMap.values()).sort((a, b) =>
      a.invoice_id.localeCompare(b.invoice_id)
    );

    setBulkCreating(true);
    setBulkProgress({ done: 0, total: groups.length });

    const allResults = [];

    try {
      await runWithLimit(
        groups,
        2,
        async (g) => {
          // ✅ posting_date for invoice is selected by user (bulkPostingDate)
          const posting = bulkPostingDate; // YYYY-MM-DD
          const due = posting; // safe

          // ✅ po_date should be from purchase-date in sheet (earliest in that invoice-id)
          const poDate =
            (g.lines || [])
              .map((x) => x.purchase_date)
              .filter(Boolean)
              .sort()[0] || "";

          const itemsPayload = g.lines.map((l) => ({
            item_code: l.item_code,
            qty: l.qty,
            rate: l.rate,
          }));

          // helper: mark all lines with same status/message
          const markAll = (status, msg, siName = "") => {
            g.lines.forEach((l) => {
              allResults.push({
                invoice_id: g.invoice_id,
                asin: l.asin,
                qty: l.qty,
                item_code: l.item_code,
                status,
                si_name: siName,
                message: msg,
              });
            });
          };

          try {
            // 1) create normal (one invoice per invoice-id)
            const created = await createSalesInvoice({
              customer,
              company,
              posting_date: posting,
              due_date: due,
              warehouse,
              items: itemsPayload,
              po_no: g.invoice_id,
              po_date: poDate, // ✅ NEW FIELD
              remarks: `Imported from sheet. invoice-id=${g.invoice_id}`,
            });

            const siName = created?.data?.name || "";

            // 2) submit
            try {
              if (siName) await submitDoc("Sales Invoice", siName);
            } catch (subErr) {
              const subMsg = `Created but submit failed: ${extractErrMsg(subErr)}`;
              markAll("PARTIAL", subMsg, siName);
              return;
            }

            markAll("OK", "Created & submitted", siName);
          } catch (err) {
            const msg = extractErrMsg(err);

            // ✅ fallback: try one-line invoices so some can still pass
            if (TRY_SINGLE_LINE_FALLBACK) {
              for (const l of g.lines) {
                try {
                  const created1 = await createSalesInvoice({
                    customer,
                    company,
                    posting_date: posting,
                    due_date: due,
                    warehouse,
                    items: [{ item_code: l.item_code, qty: l.qty, rate: l.rate }],
                    po_no: g.invoice_id,
                    po_date: l.purchase_date, // ✅ per-line po_date
                    remarks: `Fallback single-line import. invoice-id=${g.invoice_id} asin=${l.asin}`,
                  });

                  const si1 = created1?.data?.name || "";

                  try {
                    if (si1) await submitDoc("Sales Invoice", si1);
                  } catch (subErr) {
                    allResults.push({
                      invoice_id: g.invoice_id,
                      asin: l.asin,
                      qty: l.qty,
                      item_code: l.item_code,
                      status: "PARTIAL",
                      si_name: si1,
                      message: `Created but submit failed: ${extractErrMsg(subErr)}`,
                    });
                    continue;
                  }

                  allResults.push({
                    invoice_id: g.invoice_id,
                    asin: l.asin,
                    qty: l.qty,
                    item_code: l.item_code,
                    status: "OK",
                    si_name: si1,
                    message: "Created & submitted (fallback single-line)",
                  });
                } catch (lineErr) {
                  allResults.push({
                    invoice_id: g.invoice_id,
                    asin: l.asin,
                    qty: l.qty,
                    item_code: l.item_code,
                    status: "FAILED",
                    si_name: "",
                    message: extractErrMsg(lineErr),
                  });
                }
              }
            } else {
              // fail all lines in that invoice-id only (but continues other invoice-ids)
              markAll("FAILED", msg, "");
            }
          }
        },
        (done) => setBulkProgress((p) => ({ ...p, done }))
      );

      // combine unmapped + processed
      const finalResults = [...preResults, ...allResults];
      setBulkResults(finalResults);

      const ok = finalResults.filter((x) => x.status === "OK").length;
      const partial = finalResults.filter((x) => x.status === "PARTIAL").length;
      const failed = finalResults.filter((x) => x.status === "FAILED").length;

      setMessage(`Bulk import finished. OK: ${ok}, PARTIAL: ${partial}, FAILED: ${failed}.`);

      if (failed > 0) setError("Some lines failed. Check the results table.");

      await reloadRecentInvoices();
      clearFile();
    } finally {
      setBulkCreating(false);
    }
  }

  // -------- render --------
  return (
    <div className="sales-easyship">
      <div className="sales-header">
        <div className="sales-title-block">
          <h2 className="sales-title">EasyShip Sales (ERPNext)</h2>
          <p className="sales-subtitle">Manual + Bulk Upload</p>
        </div>
        <div className="sales-header-pill">
          {rows.length} line item{rows.length !== 1 ? "s" : ""}
        </div>
      </div>

      {loadingInit && <div className="sales-loading text-muted">Loading customers / items...</div>}
      {error && <div className="alert alert-error sales-error">{error}</div>}
      {message && <div className="alert alert-success sales-message">{message}</div>}

      {/* ✅ TWO-PART UI (layout only) */}
      <div className="sales-layout">
        {/* LEFT: Tabs + Manual/Bulk */}
        <div className="sales-panel sales-panel-left">
          <div className="sales-tabs">
            <button
              type="button"
              className={`sales-tab ${activeTab === "manual" ? "is-active" : ""}`}
              onClick={() => setActiveTab("manual")}
            >
              Manual Entry
            </button>

            <button
              type="button"
              className={`sales-tab ${activeTab === "bulk" ? "is-active" : ""}`}
              onClick={() => setActiveTab("bulk")}
            >
              Bulk Upload
            </button>
          </div>

          {/* ✅ BULK TAB (workflow unchanged) */}
          {activeTab === "bulk" && (
            <div className="sales-tab-body">
              <div className="sales-recent-header">
                <h3 className="sales-recent-title">Bulk Upload (Amazon Sheet)</h3>
                <button type="button" onClick={resetBulk} className="btn btn-secondary btn-sm">
                  Clear
                </button>
              </div>

              <div className="sales-form-grid" style={{ marginTop: 12 }}>
                <div className="sales-field-group">
                  <label className="form-label sales-field-label">
                    Upload file (.tsv/.csv/.txt/.xlsx)
                  </label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.tsv,.txt,.xlsx,.xls"
                    className="input"
                    onChange={handleFilePicked}
                    disabled={bulkParsing || bulkCreating}
                  />
                  <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Required columns: <b>invoice-id</b>, <b>asin</b>,{" "}
                    <b>quantity-purchased</b>, <b>purchase-date</b>
                  </div>
                </div>

                <div className="sales-field-group">
                  <label className="form-label sales-field-label">Posting Date (Bulk)</label>
                  <input
                    type="date"
                    className="input"
                    value={bulkPostingDate}
                    onChange={(e) => setBulkPostingDate(e.target.value)}
                    disabled={bulkParsing || bulkCreating}
                  />
                  <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
                    This will be the <b>Sales Invoice posting_date</b> for all invoices created
                    from the file.
                  </div>
                </div>

                <div className="sales-field-group">
                  <label className="form-label sales-field-label">Company (Default)</label>
                  <select
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="select"
                    disabled={bulkParsing || bulkCreating}
                  >
                    <option value="">-- select company --</option>
                    {companies.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.company_name || c.name}
                        {c.abbr ? ` (${c.abbr})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sales-field-group">
                  <label className="form-label sales-field-label">Customer (Default)</label>
                  <select
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    className="select"
                    disabled={bulkParsing || bulkCreating}
                  >
                    <option value="">-- select customer --</option>
                    {customers.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.customer_name || c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sales-field-group">
                  <label className="form-label sales-field-label">Warehouse (Default)</label>
                  {warehouses.length ? (
                    <select
                      value={warehouse}
                      onChange={(e) => setWarehouse(e.target.value)}
                      className="select"
                      disabled={bulkParsing || bulkCreating}
                    >
                      <option value="">-- select warehouse --</option>
                      {warehouses.map((w) => (
                        <option key={w.name} value={w.name}>
                          {w.warehouse_name || w.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={warehouse}
                      onChange={(e) => setWarehouse(e.target.value)}
                      className="input"
                      placeholder="e.g. Finished Goods - MF"
                      disabled={bulkParsing || bulkCreating}
                    />
                  )}
                </div>
              </div>

              {bulkParseError && (
                <div className="alert alert-error sales-error" style={{ marginTop: 12 }}>
                  {bulkParseError}
                </div>
              )}

              <div className="sales-bulk-actions">
                <button
                  type="button"
                  onClick={handleBulkCreate}
                  disabled={bulkCreating || bulkParsing || !bulkLines.length}
                  className="btn btn-primary"
                >
                  {bulkCreating ? "Creating..." : "Create Invoices from File"}
                </button>

                <div className="text-muted" style={{ fontSize: 12 }}>
                  Parsed lines: <b>{bulkLines.length}</b> | Invoices:{" "}
                  <b>{new Set(bulkLines.map((x) => x.invoice_id)).size}</b>
                  {bulkCreating ? (
                    <>
                      {" "}
                      | Progress: <b>{bulkProgress.done}/{bulkProgress.total}</b>
                    </>
                  ) : null}
                </div>
              </div>

              {/* ✅ Per-line results */}
              {bulkResults.length > 0 && (
                <div className="sales-recent-table-wrapper table-container" style={{ marginTop: 14 }}>
                  <table className="table sales-recent-table">
                    <thead>
                      <tr>
                        <th>Invoice-ID</th>
                        <th>ASIN</th>
                        <th>Item Code</th>
                        <th>Qty</th>
                        <th>Status</th>
                        <th>ERPNext Invoice</th>
                        <th>Error / Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkResults.map((r, idx) => (
                        <tr key={`${r.invoice_id}-${r.asin}-${idx}`}>
                          <td>{r.invoice_id}</td>
                          <td>{r.asin}</td>
                          <td>{r.item_code}</td>
                          <td>{r.qty}</td>
                          <td>
                            <span
                              className={
                                "sales-status-pill " + (r.status === "OK" ? "paid" : "unpaid")
                              }
                            >
                              {r.status}
                            </span>
                          </td>
                          <td>{r.si_name || "-"}</td>
                          <td style={{ maxWidth: 520, whiteSpace: "pre-wrap" }}>{r.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ✅ MANUAL TAB (workflow unchanged) */}
          {activeTab === "manual" && (
            <div className="sales-tab-body">
              <form onSubmit={handleSubmit} className="sales-form">
                <div className="sales-form-grid">
                  <div className="sales-field-group">
                    <label htmlFor="sales-company" className="form-label sales-field-label">
                      Company
                    </label>
                    <select
                      id="sales-company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="select"
                    >
                      <option value="">-- select company --</option>
                      {companies.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.company_name || c.name}
                          {c.abbr ? ` (${c.abbr})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sales-field-group">
                    <label htmlFor="sales-posting-date" className="form-label sales-field-label">
                      Posting Date
                    </label>
                    <input
                      id="sales-posting-date"
                      type="date"
                      value={postingDate}
                      onChange={(e) => setPostingDate(e.target.value)}
                      className="input"
                    />
                  </div>

                  <div className="sales-field-group">
                    <label htmlFor="sales-customer" className="form-label sales-field-label">
                      Customer
                    </label>
                    <select
                      id="sales-customer"
                      value={customer}
                      onChange={(e) => setCustomer(e.target.value)}
                      className="select"
                    >
                      <option value="">-- select customer --</option>
                      {customers.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.customer_name || c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sales-field-group">
                    <label htmlFor="sales-warehouse" className="form-label sales-field-label">
                      Warehouse (stock goes out from)
                    </label>
                    {warehouses.length ? (
                      <select
                        id="sales-warehouse"
                        value={warehouse}
                        onChange={(e) => setWarehouse(e.target.value)}
                        className="select"
                      >
                        <option value="">-- select warehouse --</option>
                        {warehouses.map((w) => (
                          <option key={w.name} value={w.name}>
                            {w.warehouse_name || w.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id="sales-warehouse"
                        value={warehouse}
                        onChange={(e) => setWarehouse(e.target.value)}
                        placeholder="e.g. Finished Goods - MF"
                        className="input"
                      />
                    )}
                  </div>
                </div>

                <div className="sales-items-header">
                  <h3 className="sales-items-title">Items (Finished Goods / Products)</h3>
                  <button type="button" onClick={addRow} className="btn btn-accent btn-sm">
                    + Add Item
                  </button>
                </div>

                <div className="sales-items-rows">
                  {rows.map((row, index) => (
                    <div key={row.id} className="sales-item-row-card">
                      <div className="sales-item-row-header">
                        <span className="sales-item-row-title">
                          Line #{index + 1}
                          {row.item_code ? ` · ${row.item_code}` : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="btn btn-ghost btn-sm"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="sales-item-row-grid">
                        <div className="sales-item-field">
                          <label className="form-label">Item</label>
                          <ItemSearchDropdown
                            items={items}
                            value={row.item_code}
                            onSelect={(code) => handleItemChange(row.id, code)}
                            placeholder="Search item name / code..."
                          />
                        </div>

                        <div className="sales-item-field">
                          <label className="form-label">Qty</label>
                          <input
                            type="number"
                            value={row.qty}
                            onChange={(e) => handleRowChange(row.id, "qty", e.target.value)}
                            className="input"
                          />
                        </div>

                        <div className="sales-item-field">
                          <label className="form-label">Rate</label>
                          <input
                            type="number"
                            value={row.rate}
                            onChange={(e) => handleRowChange(row.id, "rate", e.target.value)}
                            className="input"
                            placeholder="Leave empty to use default logic / price list"
                          />
                        </div>
                      </div>

                      {row.rowError && <div className="sales-row-error">{row.rowError}</div>}
                    </div>
                  ))}
                </div>

                <div className="sales-submit-row">
                  <button
                    type="submit"
                    disabled={saving || loadingInit}
                    className="btn btn-primary"
                  >
                    {saving ? "Creating..." : "Create EasyShip Sale"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* RIGHT: Recent sales always visible as separate section */}
        <div className="sales-panel sales-panel-right">
          <div className="sales-recent-header">
            <h3 className="sales-recent-title">Recent Sales (Submitted Sales Invoices)</h3>
            <button
              type="button"
              onClick={reloadRecentInvoices}
              disabled={loadingInvoices}
              className="btn btn-secondary btn-sm"
            >
              {loadingInvoices ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {loadingInvoices && (
            <div className="sales-recent-loading text-muted">Loading recent invoices...</div>
          )}

          {!loadingInvoices && recentInvoices.length === 0 && (
            <div className="sales-recent-empty text-muted">No recent invoices found.</div>
          )}

          {!loadingInvoices && recentInvoices.length > 0 && (
            <div className="sales-recent-table-wrapper table-container">
              <table className="table sales-recent-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Grand Total</th>
                    <th>Outstanding</th>
                    <th>Total Qty (Unit)</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((inv) => {
                    const isPaid =
                      inv.status === "Paid" || (inv.outstanding_amount || 0) <= 0;
                    const isMarking = payingInvoice === inv.name;

                    return (
                      <tr key={inv.name}>
                        <td className="sales-recent-name-cell">{inv.name}</td>
                        <td className="sales-recent-customer-cell">{inv.customer}</td>
                        <td className="sales-recent-date-cell">{inv.posting_date}</td>
                        <td>
                          <span className={"sales-status-pill " + (isPaid ? "paid" : "unpaid")}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="sales-recent-amount-cell">
                          ₹{" "}
                          {inv.grand_total != null ? Number(inv.grand_total).toFixed(2) : "0.00"}
                        </td>
                        <td className="sales-recent-amount-cell">
                          ₹{" "}
                          {inv.outstanding_amount != null
                            ? Number(inv.outstanding_amount).toFixed(2)
                            : "0.00"}
                        </td>
                        <td className="sales-recent-qty-cell">
                          {inv.total_qty != null ? `${inv.total_qty} ${inv.uom || ""}` : "-"}
                        </td>
                        <td className="sales-recent-actions-cell">
                          <button
                            type="button"
                            onClick={() => handleMarkPaid(inv)}
                            disabled={isPaid || isMarking}
                            className="btn btn-secondary btn-sm"
                          >
                            {isPaid ? "Paid" : isMarking ? "Marking..." : "Mark Paid"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ✅ Same dropdown logic as StockTransfer */
function ItemSearchDropdown({ items, value, onSelect, placeholder }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  const selected = useMemo(() => items.find((x) => x.name === value) || null, [items, value]);

  const filtered = useMemo(() => {
    const s = (q || "").trim().toLowerCase();
    const base = !s
      ? items
      : items.filter((it) => {
          const code = (it.name || "").toLowerCase();
          const name = (it.item_name || "").toLowerCase();
          return code.includes(s) || name.includes(s);
        });
    return base.slice(0, 80);
  }, [items, q]);

  useEffect(() => {
    function onDown(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="stdrop" ref={ref}>
      <button
        type="button"
        className={`stdrop-control ${open ? "is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="stdrop-value">
          {selected ? (
            <>
              <div className="stdrop-title">{selected.name}</div>
              <div className="stdrop-sub">
                {selected.item_name || ""} {selected.stock_uom ? `· ${selected.stock_uom}` : ""}
              </div>
            </>
          ) : (
            <div className="stdrop-placeholder">{placeholder}</div>
          )}
        </div>
        <div className="stdrop-caret">▾</div>
      </button>

      {open && (
        <div className="stdrop-popover">
          <div className="stdrop-search">
            <input
              autoFocus
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type to search..."
            />
          </div>

          <div className="stdrop-list">
            {filtered.map((it) => (
              <button
                key={it.name}
                type="button"
                className="stdrop-item"
                onClick={() => {
                  onSelect(it.name);
                  setOpen(false);
                  setQ("");
                }}
              >
                <div className="stdrop-item-title">{it.name}</div>
                <div className="stdrop-item-sub">
                  {it.item_name || ""} {it.stock_uom ? `· ${it.stock_uom}` : ""}
                </div>
              </button>
            ))}

            {!filtered.length ? (
              <div className="stdrop-empty">No items found.</div>
            ) : (
              <div className="stdrop-hint">Showing up to 80 results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SalesEasyShip;
