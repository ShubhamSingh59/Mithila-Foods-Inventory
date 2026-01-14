//// src/SalesEasyShip.jsx
//import React, { useEffect, useMemo, useRef, useState } from "react";
//import {
//  getCustomers,
//  getFinishedItemsForSales,
//  createSalesInvoice, // creates DRAFT (we don't submit here)
//  submitDoc, // submit from list
//  getRecentSalesInvoices, // your existing "recent submitted" list API
//  createPaymentEntryForInvoice,
//  getSalesInvoiceWithItems,
//  getCompanies,

//  // Draft list + edit draft
//  getDoctypeList,
//  getDoc,
//  updateDoc,
//} from "./erpBackendApi";

//import { getBinForItemWarehouse } from "./erpBackendApi"; // ✅ add at top
//import "../CSS/SalesOrder.css";

//const DEFAULT_COMPANY = "Mithila Foods";
//const DEFAULT_WAREHOUSE = "Finished Goods - MF"; // ✅ FIXED
//const DEFAULT_CUSTOMER = "Test Customer";
//const TRY_SINGLE_LINE_FALLBACK = true;

//const LIST_LIMIT = 10; // show only last 10 (draft + submitted)



//function toSortTs(v) {
//  if (!v) return 0;
//  const s = String(v).trim();
//  if (!s) return 0;

//  const isoLike = s.includes(" ") ? s.replace(" ", "T") : s;
//  const d = new Date(isoLike);
//  const t = d.getTime();
//  return Number.isFinite(t) ? t : 0;
//}



///**
// * ISO datetime OR DD-MM-YYYY OR YYYY-MM-DD -> YYYY-MM-DD
// */
//function toErpDate(input) {
//  const s = String(input ?? "").trim();
//  if (!s) return "";

//  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
//  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

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

///**
// * Customer-based mapping config:
// * - easyship/fba: SKU field first, ASIN allowed fallback
// * - flipkart/blinkit: SKU field only, ASIN not allowed
// */
//function getCustomerMapConfig(customerName) {
//  const s = String(customerName || "").toLowerCase();

//  if (s.includes("easyship")) return { skuField: "custom_easy_ship_sku", allowAsin: true };
//  if (s.includes("fba")) return { skuField: "custom_fba_sku", allowAsin: true };
//  if (s.includes("flipkart")) return { skuField: "custom_fnsku", allowAsin: false };
//  if (s.includes("blinkit")) return { skuField: "custom_blinkit_upc", allowAsin: false };

//  // fallback: old behavior (asin allowed)
//  return { skuField: "", allowAsin: true };
//}

//// Draft list helper (ONLY normal Sales Invoices, NOT returns)
//async function getRecentDraftSalesInvoices(limit = LIST_LIMIT) {
//  const rows = await getDoctypeList("Sales Invoice", {
//    fields: JSON.stringify([
//      "name",
//      "customer",
//      "company",
//      "posting_date",
//      "grand_total",
//      "outstanding_amount",
//      "docstatus",
//      "status",
//      "modified",
//      "is_return",
//    ]),
//    filters: JSON.stringify([
//      ["Sales Invoice", "docstatus", "=", 0],
//      ["Sales Invoice", "is_return", "=", 0],
//    ]),
//    order_by: "modified desc",
//    limit_page_length: limit,
//  });

//  return rows || [];
//}

//export default function SalesEasyShip() {
//  const FIXED_WAREHOUSE = DEFAULT_WAREHOUSE;
//  const [createdSort, setCreatedSort] = useState("desc");
//  const [customers, setCustomers] = useState([]);
//  const [items, setItems] = useState([]); // MUST include custom_asin/custom_* fields
//  const [companies, setCompanies] = useState([]);

//  const [company, setCompany] = useState("");
//  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10));
//  const [customer, setCustomer] = useState("");

//  const [bulkPostingDate, setBulkPostingDate] = useState(new Date().toISOString().slice(0, 10));

//  const [availMap, setAvailMap] = useState({});

//  function createEmptyRow(id) {
//    return {
//      id,
//      _rowName: "", // ERP child row name (when editing draft)
//      item_code: "",
//      qty: "",
//      rate: "",
//      qtyError: "",
//      rateError: "",
//      rowError: "",
//    };
//  }

//  const [rows, setRows] = useState([createEmptyRow(0)]);

//  // Draft/edit state
//  const [editingDraftName, setEditingDraftName] = useState("");
//  const [editDraftLoading, setEditDraftLoading] = useState("");
//  const [submittingDraft, setSubmittingDraft] = useState("");
//  const [savingDraft, setSavingDraft] = useState(false);

//  // Recent list (draft + submitted)
//  const [recentInvoices, setRecentInvoices] = useState([]);
//  const [loadingInit, setLoadingInit] = useState(false);
//  const [loadingInvoices, setLoadingInvoices] = useState(false);
//  const [payingInvoice, setPayingInvoice] = useState("");

//  const [error, setError] = useState("");
//  const [message, setMessage] = useState("");

//  // add this state with the others
//  const [invoiceCustomerFilter, setInvoiceCustomerFilter] = useState(""); // "" = All

//  // add this memo (near itemIndexes useMemo is fine)
//  const filteredRecentInvoices = useMemo(() => {
//    if (!invoiceCustomerFilter) return recentInvoices;
//    return (recentInvoices || []).filter((inv) => inv.customer === invoiceCustomerFilter);
//  }, [recentInvoices, invoiceCustomerFilter]);

//  const [postingDateSort, setPostingDateSort] = useState("desc"); // desc = Newest → Oldest

//  const postingDateSortLabel =
//    postingDateSort === "asc"
//      ? "Posting Date: Oldest → Newest"
//      : "Posting Date: Newest → Oldest";

//  const sortedRecentInvoices = useMemo(() => {
//    const dirMul = postingDateSort === "asc" ? 1 : -1;

//    return [...(filteredRecentInvoices || [])].sort((a, b) => {
//      const ta = toSortTs(a?.posting_date);
//      const tb = toSortTs(b?.posting_date);

//      if (ta !== tb) return (ta - tb) * dirMul;
//      return String(a?.name || "").localeCompare(String(b?.name || ""));
//    });
//  }, [filteredRecentInvoices, postingDateSort]);

//  // Bulk state
//  const fileRef = useRef(null);
//  const [bulkParsing, setBulkParsing] = useState(false);
//  const [bulkCreating, setBulkCreating] = useState(false);
//  const [bulkParseError, setBulkParseError] = useState("");
//  const [bulkLines, setBulkLines] = useState([]); // parsed raw lines (sku/asin), mapping happens at create time
//  const [bulkResults, setBulkResults] = useState([]);
//  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

//  // UI tab
//  const [activeTab, setActiveTab] = useState("manual"); // "manual" | "bulk"

//  function extractErrMsg(err) {
//    return (
//      err?.response?.data?.error?.message ||
//      err?.response?.data?.error ||
//      err?.message ||
//      "Unknown error"
//    );
//  }

//  function normKey(v) {
//    return String(v ?? "").trim().toUpperCase();
//  }

//  // Build indexes from items list
//  const itemIndexes = useMemo(() => {
//    const idx = {
//      custom_asin: new Map(),
//      custom_easy_ship_sku: new Map(),
//      custom_fba_sku: new Map(),
//      custom_fnsku: new Map(),
//      custom_blinkit_upc: new Map(),
//    };

//    (items || []).forEach((it) => {
//      const code = it?.name;
//      if (!code) return;

//      const asin = normKey(it.custom_asin);
//      if (asin) idx.custom_asin.set(asin, code);

//      const esSku = normKey(it.custom_easy_ship_sku);
//      if (esSku) idx.custom_easy_ship_sku.set(esSku, code);

//      const fbaSku = normKey(it.custom_fba_sku);
//      if (fbaSku) idx.custom_fba_sku.set(fbaSku, code);

//      const fnsku = normKey(it.custom_fnsku);
//      if (fnsku) idx.custom_fnsku.set(fnsku, code);

//      const upc = normKey(it.custom_blinkit_upc);
//      if (upc) idx.custom_blinkit_upc.set(upc, code);
//    });

//    return idx;
//  }, [items]);

//  function resolveItemCodeForCustomer({ customerName, sku, asin }) {
//    const { skuField, allowAsin } = getCustomerMapConfig(customerName);

//    const skuKey = normKey(sku);
//    const asinKey = normKey(asin);

//    // 1) customer-specific SKU field
//    if (skuField && skuKey) {
//      const bySku = itemIndexes?.[skuField]?.get(skuKey);
//      if (bySku) return bySku;
//    }

//    // 2) ASIN fallback only when allowed
//    if (allowAsin && asinKey) {
//      const byAsin = itemIndexes.custom_asin.get(asinKey);
//      if (byAsin) return byAsin;
//    }

//    return "";
//  }

//  function resetManualForm() {
//    setEditingDraftName("");
//    setPostingDate(new Date().toISOString().slice(0, 10));
//    setRows([createEmptyRow(0)]);
//  }

//  // Load recent list (draft + submitted) and keep only last 10
//  async function loadInvoices() {
//    setLoadingInvoices(true);
//    try {
//      const [submittedBase, draftsBase] = await Promise.all([
//        getRecentSalesInvoices(LIST_LIMIT),
//        getRecentDraftSalesInvoices(LIST_LIMIT),
//      ]);

//      const drafts = (draftsBase || []).map((d) => ({ ...d, __isDraft: true }));
//      const submitted = (submittedBase || []).map((s) => ({ ...s, __isDraft: false }));

//      // drafts first then submitted, only 10 total
//      const baseList = [...drafts, ...submitted].slice(0, LIST_LIMIT);

//      const enriched = [];
//      for (const inv of baseList) {
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

//          enriched.push({
//            ...inv,
//            customer: inv.customer || doc.customer,
//            posting_date: inv.posting_date || doc.posting_date,
//            status: inv.__isDraft ? "Draft" : inv.status || doc.status,
//            grand_total: inv.grand_total ?? doc.grand_total,
//            outstanding_amount: inv.outstanding_amount ?? doc.outstanding_amount,
//            total_qty: totalQty,
//            uom,
//          });
//        } catch (e) {
//          enriched.push({
//            ...inv,
//            status: inv.__isDraft ? "Draft" : inv.status,
//            total_qty: null,
//            uom: "",
//          });
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
//        const [custData, itemData, companyData] = await Promise.all([
//          getCustomers(),
//          getFinishedItemsForSales(),
//          getCompanies(),
//        ]);

//        setCustomers(custData || []);
//        setItems(itemData || []);
//        setCompanies(companyData || []);

//        if (!company) {
//          const ok = (companyData || []).some((c) => c.name === DEFAULT_COMPANY);
//          setCompany(ok ? DEFAULT_COMPANY : companyData?.[0]?.name || "");
//        }
//        if (!customer) {
//          const ok = (custData || []).some((c) => c.name === DEFAULT_CUSTOMER);
//          setCustomer(ok ? DEFAULT_CUSTOMER : custData?.[0]?.name || "");
//        }
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
//  // Manual flow (draft + edit)
//  // =========================
//  function handleRowChange(rowId, field, value) {
//    setRows((prev) =>
//      prev.map((r) => {
//        if (r.id !== rowId) return r;

//        const next = { ...r, [field]: value, rowError: "" };

//        if (field === "qty") {
//          if (value === "") next.qtyError = "";
//          else if (!isNaN(Number(value)) && Number(value) < 0) next.qtyError = "Qty cannot be negative";
//          else next.qtyError = "";
//        }

//        if (field === "rate") {
//          if (value === "") next.rateError = "";
//          else if (!isNaN(Number(value)) && Number(value) < 0) next.rateError = "Rate cannot be negative";
//          else next.rateError = "";
//        }

//        return next;
//      })
//    );
//  }



//  async function handleItemChange(rowId, itemCode) {
//    setRows((prev) =>
//      prev.map((r) => (r.id === rowId ? { ...r, item_code: itemCode, rowError: "" } : r))
//    );

//    if (!itemCode) return;

//    try {
//      const bin = await getBinForItemWarehouse(itemCode, FIXED_WAREHOUSE);
//      const qty = Number(bin?.actual_qty) || 0;

//      setAvailMap((m) => ({ ...m, [itemCode]: qty }));
//    } catch (e) {
//      setAvailMap((m) => ({ ...m, [itemCode]: null }));
//    }
//  }


//  function addRow() {
//    setRows((prev) => [...prev, createEmptyRow(prev.length ? prev[prev.length - 1].id + 1 : 0)]);
//  }

//  function removeRow(rowId) {
//    setRows((prev) => prev.filter((r) => r.id !== rowId));
//  }

//  // Create/Update draft only (no submit)
//  async function handleSubmit(e) {
//    e.preventDefault();
//    setError("");
//    setMessage("");

//    if (!company) return setError("Company is required (same as in ERPNext).");
//    if (!postingDate) return setError("Posting date is required.");
//    if (!customer) return setError("Select a customer.");

//    const hasNeg = rows.some((r) => r.qtyError || r.rateError);
//    if (hasNeg) return setError("Fix negative Qty/Rate (red fields) before saving.");

//    const validRows = rows.filter(
//      (r) => r.item_code && !isNaN(parseFloat(r.qty)) && parseFloat(r.qty) > 0
//    );
//    if (!validRows.length) return setError("Add at least one item with quantity > 0.");

//    const itemsPayload = validRows.map((r) => ({
//      ...(editingDraftName && r._rowName ? { name: r._rowName } : {}),
//      item_code: r.item_code,
//      qty: parseFloat(r.qty),
//      rate: r.rate === "" || r.rate == null ? undefined : parseFloat(r.rate),
//      warehouse: FIXED_WAREHOUSE,
//    }));

//    try {
//      setSavingDraft(true);

//      if (!editingDraftName) {
//        const doc = await createSalesInvoice({
//          customer,
//          company,
//          posting_date: postingDate,
//          warehouse: FIXED_WAREHOUSE,
//          items: itemsPayload.map(({ name, ...rest }) => rest), // no child "name" on create
//        });

//        const name = doc?.data?.name;
//        setMessage(
//          `Draft Sale created: ${name || "(no name returned)"}. Use right list → "Create Sale Invoice" to submit.`
//        );
//      } else {
//        let old = null;
//        try {
//          old = await getDoc("Sales Invoice", editingDraftName);
//        } catch {
//          old = null;
//        }

//        const oldNames = new Set((old?.items || []).map((x) => x.name).filter(Boolean));
//        const newNames = new Set(itemsPayload.map((x) => x.name).filter(Boolean));

//        const deletes = [];
//        oldNames.forEach((nm) => {
//          if (!newNames.has(nm)) deletes.push({ doctype: "Sales Invoice Item", name: nm, __delete: 1 });
//        });

//        await updateDoc("Sales Invoice", editingDraftName, {
//          customer,
//          company,
//          posting_date: postingDate,
//          set_warehouse: FIXED_WAREHOUSE,
//          items: [...itemsPayload, ...deletes],
//        });

//        setMessage(
//          `Draft updated: ${editingDraftName}. Now use right list → "Create Sale Invoice" to submit.`
//        );
//      }

//      resetManualForm();
//      await reloadRecentInvoices();
//    } catch (err) {
//      console.error(err);
//      setError(extractErrMsg(err) || "Failed to create / update draft Sales Invoice");
//    } finally {
//      setSavingDraft(false);
//    }
//  }

//  async function handleEditDraft(invName) {
//    if (!invName) return;

//    setError("");
//    setMessage("");
//    setEditDraftLoading(invName);

//    try {
//      const doc = await getSalesInvoiceWithItems(invName);

//      setActiveTab("manual");
//      setEditingDraftName(invName);

//      setCompany(doc.company || company);
//      setCustomer(doc.customer || customer);

//      setPostingDate(String(doc.posting_date || "").slice(0, 10) || postingDate);

//      const its = Array.isArray(doc.items) ? doc.items : [];
//      const mapped =
//        its.length > 0
//          ? its.map((it, idx) => ({
//            id: idx,
//            _rowName: it.name || "",
//            item_code: it.item_code || "",
//            qty: it.qty != null ? String(it.qty) : "",
//            rate: it.rate != null ? String(it.rate) : "",
//            qtyError: "",
//            rateError: "",
//            rowError: "",
//          }))
//          : [createEmptyRow(0)];

//      setRows(mapped);

//      setMessage(`Editing draft: ${invName}. Make changes and click "Update Draft".`);
//      window.scrollTo({ top: 0, behavior: "smooth" });
//    } catch (err) {
//      console.error(err);
//      setError(extractErrMsg(err) || "Failed to load draft");
//    } finally {
//      setEditDraftLoading("");
//    }
//  }

//  function handleCancelEdit() {
//    setMessage("");
//    resetManualForm();
//  }

//  async function handleSubmitDraft(invName) {
//    if (!invName) return;

//    setError("");
//    setMessage("");
//    setSubmittingDraft(invName);

//    try {
//      await submitDoc("Sales Invoice", invName);
//      setMessage(`Sale Is submitted: ${invName}`);

//      if (editingDraftName === invName) resetManualForm();
//      await reloadRecentInvoices();
//    } catch (err) {
//      console.error(err);
//      setError(extractErrMsg(err) || "Failed to submit draft invoice");
//    } finally {
//      setSubmittingDraft("");
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
//  // Bulk upload
//  // =========================
//  async function parseAnyFile(file) {
//    const name = String(file?.name || "").toLowerCase();

//    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
//      let mod;
//      try {
//        mod = await import("xlsx");
//      } catch (e) {
//        throw new Error('To import .xlsx, run: npm i xlsx (then restart dev server).');
//      }

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
//        const asin = String(r["asin"] || "").trim(); // can be empty
//        const sku = String(r["sku"] || "").trim(); // can be empty
//        const qty = parseFloat(r["quantity-purchased"]);
//        const purchaseDate = toErpDate(r["purchase-date"]);

//        // rate options
//        const rateRaw = r["rate"] ?? r["item-price"] ?? r["price"] ?? "";
//        const rate =
//          String(rateRaw).trim() !== "" && !isNaN(parseFloat(rateRaw))
//            ? parseFloat(rateRaw)
//            : undefined;

//        const hasAnyKey = !!asin || !!sku;

//        if (!invoiceId || !qty || qty <= 0 || !purchaseDate || !hasAnyKey) {
//          errs.push(
//            `Row ${idx + 2}: missing/invalid invoice-id, quantity-purchased, purchase-date, and (sku or asin)`
//          );
//          return;
//        }

//        lines.push({
//          rowNo: idx + 2,
//          invoice_id: invoiceId,
//          asin,
//          sku,
//          purchase_date: purchaseDate,
//          qty,
//          rate,
//          product_name: String(r["product-name"] || "").trim(),
//        });
//      });

//      if (errs.length) {
//        setBulkParseError(
//          errs.slice(0, 5).join(" | ") + (errs.length > 5 ? ` (+${errs.length - 5} more)` : "")
//        );
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
//    if (!bulkLines.length) return setError("No parsed lines. Upload a file first.");
//    if (!bulkPostingDate) return setError("Select a Bulk Posting Date.");

//    const { allowAsin } = getCustomerMapConfig(customer);

//    // Resolve mapping at create time (so changing Customer after upload works)
//    const resolvedLines = bulkLines.map((l) => {
//      let item_code = resolveItemCodeForCustomer({
//        customerName: customer,
//        sku: l.sku,
//        asin: l.asin,
//      });

//      // optional fallback: SKU is actually Item Code
//      if (!item_code && l.sku && (items || []).some((it) => it.name === l.sku)) {
//        item_code = l.sku;
//      }

//      return { ...l, item_code };
//    });

//    // Separate failed mapping lines
//    const preResults = [];
//    const usableLines = [];

//    for (const l of resolvedLines) {
//      const missingSkuButRequired = !allowAsin && !l.sku;

//      if (!l.item_code) {
//        preResults.push({
//          invoice_id: l.invoice_id,
//          sku: l.sku,
//          asin: l.asin,
//          qty: l.qty,
//          item_code: "",
//          status: "FAILED",
//          si_name: "",
//          message: missingSkuButRequired
//            ? "Customer requires SKU mapping but SKU is missing in this row."
//            : "No Item match for this Customer (SKU/ASIN mapping failed).",
//        });
//      } else {
//        usableLines.push(l);
//      }
//    }

//    if (!usableLines.length) {
//      setBulkResults(preResults);
//      setError("All rows failed (item mapping missing). Fix SKU/ASIN mapping fields in Item and re-upload.");
//      return;
//    }

//    // Group by invoice-id
//    const groupsMap = new Map();
//    for (const l of usableLines) {
//      const key = l.invoice_id;
//      const g = groupsMap.get(key) || { invoice_id: l.invoice_id, lines: [] };
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
//          const posting = bulkPostingDate;
//          const due = posting;

//          const poDate =
//            (g.lines || [])
//              .map((x) => x.purchase_date)
//              .filter(Boolean)
//              .sort()[0] || "";

//          const itemsPayload = g.lines.map((l) => ({
//            item_code: l.item_code,
//            qty: l.qty,
//            rate: l.rate,
//            warehouse: FIXED_WAREHOUSE,
//          }));

//          const markAll = (status, msg, siName = "") => {
//            g.lines.forEach((l) => {
//              allResults.push({
//                invoice_id: g.invoice_id,
//                sku: l.sku,
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
//            const created = await createSalesInvoice({
//              customer,
//              company,
//              posting_date: posting,
//              due_date: due,
//              warehouse: FIXED_WAREHOUSE,
//              items: itemsPayload,
//              po_no: g.invoice_id,
//              po_date: poDate,
//              remarks: `Imported from sheet. invoice-id=${g.invoice_id}`,
//            });

//            const siName = created?.data?.name || "";

//            try {
//              if (siName) await submitDoc("Sales Invoice", siName);
//            } catch (subErr) {
//              markAll("PARTIAL", `Created but submit failed: ${extractErrMsg(subErr)}`, siName);
//              return;
//            }

//            markAll("OK", "Created & submitted", siName);
//          } catch (err) {
//            const msg = extractErrMsg(err);

//            if (TRY_SINGLE_LINE_FALLBACK) {
//              for (const l of g.lines) {
//                try {
//                  const created1 = await createSalesInvoice({
//                    customer,
//                    company,
//                    posting_date: posting,
//                    due_date: due,
//                    warehouse: FIXED_WAREHOUSE,
//                    items: [
//                      {
//                        item_code: l.item_code,
//                        qty: l.qty,
//                        rate: l.rate,
//                        warehouse: FIXED_WAREHOUSE,
//                      },
//                    ],
//                    po_no: g.invoice_id,
//                    po_date: l.purchase_date,
//                    remarks: `Fallback single-line import. invoice-id=${g.invoice_id} sku=${l.sku} asin=${l.asin}`,
//                  });

//                  const si1 = created1?.data?.name || "";

//                  try {
//                    if (si1) await submitDoc("Sales Invoice", si1);
//                  } catch (subErr) {
//                    allResults.push({
//                      invoice_id: g.invoice_id,
//                      sku: l.sku,
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
//                    sku: l.sku,
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
//                    sku: l.sku,
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
//              markAll("FAILED", msg, "");
//            }
//          }
//        },
//        (done) => setBulkProgress((p) => ({ ...p, done }))
//      );

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
//          <h2 className="sales-title">All Plateform Sales (ERPNext)</h2>
//          <p className="sales-subtitle">Manual + Bulk Upload</p>
//          {/*<div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
//            Warehouse is fixed: <b>{FIXED_WAREHOUSE}</b>
//          </div>*/}
//        </div>
//        <div className="sales-header-pill">
//          {rows.length} line item{rows.length !== 1 ? "s" : ""}
//        </div>
//      </div>

//      {loadingInit && <div className="sales-loading text-muted">Loading customers / items...</div>}
//      {error && <div className="alert alert-error sales-error">{error}</div>}
//      {message && <div className="alert alert-success sales-message">{message}</div>}

//      <div className="sales-layout">
//        {/* LEFT: Tabs + Manual/Bulk */}
//        <div className="sales-panel sales-panel-left">
//          <div className="sales-tabs">
//            <button
//              type="button"
//              className={`sales-tab ${activeTab === "manual" ? "is-active" : ""}`}
//              onClick={() => setActiveTab("manual")}
//            >
//              Manual Entry
//            </button>

//            <button
//              type="button"
//              className={`sales-tab ${activeTab === "bulk" ? "is-active" : ""}`}
//              onClick={() => setActiveTab("bulk")}
//            >
//              Bulk Upload
//            </button>
//          </div>

//          {/* BULK TAB */}
//          {activeTab === "bulk" && (
//            <div className="sales-tab-body">
//              <div className="sales-recent-header">
//                <h3 className="sales-recent-title">Bulk Upload (Sheet)</h3>
//                <button type="button" onClick={resetBulk} className="btn btn-secondary btn-sm">
//                  Clear
//                </button>
//              </div>

//              <div className="sales-form-grid" style={{ marginTop: 12 }}>
//                <div className="sales-field-group">
//                  <label className="form-label sales-field-label">
//                    Upload file (.tsv/.csv/.txt/.xlsx)
//                  </label>
//                  <input
//                    ref={fileRef}
//                    type="file"
//                    accept=".csv,.tsv,.txt,.xlsx,.xls"
//                    className="input"
//                    onChange={handleFilePicked}
//                    disabled={bulkParsing || bulkCreating}
//                  />
//                  <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
//                    Required columns: <b>invoice-id</b>, <b>quantity-purchased</b>,{" "}
//                    <b>purchase-date</b>, and <b>sku or asin</b> (depends on customer)
//                  </div>
//                </div>

//                <div className="sales-field-group">
//                  <label className="form-label sales-field-label">Posting Date (Bulk)</label>
//                  <input
//                    type="date"
//                    className="input"
//                    value={bulkPostingDate}
//                    onChange={(e) => setBulkPostingDate(e.target.value)}
//                    disabled={bulkParsing || bulkCreating}
//                  />
//                </div>

//                <div className="sales-field-group">
//                  <label className="form-label sales-field-label">Company (Default)</label>
//                  <select
//                    value={company}
//                    onChange={(e) => setCompany(e.target.value)}
//                    className="select"
//                    disabled={bulkParsing || bulkCreating}
//                  >
//                    <option value="">-- select company --</option>
//                    {companies.map((c) => (
//                      <option key={c.name} value={c.name}>
//                        {c.company_name || c.name}
//                        {c.abbr ? ` (${c.abbr})` : ""}
//                      </option>
//                    ))}
//                  </select>
//                </div>

//                <div className="sales-field-group">
//                  <label className="form-label sales-field-label">Customer (Default)</label>
//                  <select
//                    value={customer}
//                    onChange={(e) => setCustomer(e.target.value)}
//                    className="select"
//                    disabled={bulkParsing || bulkCreating}
//                  >
//                    <option value="">-- select customer --</option>
//                    {customers.map((c) => (
//                      <option key={c.name} value={c.name}>
//                        {c.customer_name || c.name}
//                      </option>
//                    ))}
//                  </select>
//                </div>
//              </div>

//              {bulkParseError && (
//                <div className="alert alert-error sales-error" style={{ marginTop: 12 }}>
//                  {bulkParseError}
//                </div>
//              )}

//              <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
//                <button
//                  type="button"
//                  onClick={handleBulkCreate}
//                  disabled={bulkCreating || bulkParsing || !bulkLines.length}
//                  className="btn btn-primary"
//                >
//                  {bulkCreating ? "Creating..." : "Create Invoices from File"}
//                </button>

//                <div className="text-muted" style={{ fontSize: 12 }}>
//                  Parsed lines: <b>{bulkLines.length}</b> | Invoices:{" "}
//                  <b>{new Set(bulkLines.map((x) => x.invoice_id)).size}</b>
//                  {bulkCreating ? (
//                    <>
//                      {" "}
//                      | Progress: <b>{bulkProgress.done}/{bulkProgress.total}</b>
//                    </>
//                  ) : null}
//                </div>
//              </div>

//              {bulkResults.length > 0 && (
//                <div className="sales-recent-table-wrapper table-container" style={{ marginTop: 14 }}>
//                  <table className="table sales-recent-table">
//                    <thead>
//                      <tr>
//                        <th>Invoice-ID</th>
//                        <th>SKU</th>
//                        <th>ASIN</th>
//                        <th>Item Code</th>
//                        <th>Qty</th>
//                        <th>Status</th>
//                        <th>ERPNext Invoice</th>
//                        <th>Error / Message</th>
//                      </tr>
//                    </thead>
//                    <tbody>
//                      {bulkResults.map((r, idx) => (
//                        <tr key={`${r.invoice_id}-${r.sku}-${r.asin}-${idx}`}>
//                          <td>{r.invoice_id}</td>
//                          <td>{r.sku || "-"}</td>
//                          <td>{r.asin || "-"}</td>
//                          <td>{r.item_code}</td>
//                          <td>{r.qty}</td>
//                          <td>
//                            <span className={"sales-status-pill " + (r.status === "OK" ? "paid" : "unpaid")}>
//                              {r.status}
//                            </span>
//                          </td>
//                          <td>{r.si_name || "-"}</td>
//                          <td style={{ maxWidth: 520, whiteSpace: "pre-wrap" }}>{r.message}</td>
//                        </tr>
//                      ))}
//                    </tbody>
//                  </table>
//                </div>
//              )}
//            </div>
//          )}

//          {/* MANUAL TAB */}
//          {activeTab === "manual" && (
//            <div className="sales-tab-body">
//              {editingDraftName ? (
//                <div className="text-muted" style={{ marginBottom: 10 }}>
//                  Editing Draft: <b>{editingDraftName}</b>
//                </div>
//              ) : null}

//              <form onSubmit={handleSubmit} className="sales-form">
//                <div className="sales-form-grid">
//                  <div className="sales-field-group">
//                    <label htmlFor="sales-company" className="form-label sales-field-label">
//                      Company
//                    </label>
//                    <select
//                      id="sales-company"
//                      value={company}
//                      onChange={(e) => setCompany(e.target.value)}
//                      className="select"
//                    >
//                      <option value="">-- select company --</option>
//                      {companies.map((c) => (
//                        <option key={c.name} value={c.name}>
//                          {c.company_name || c.name}
//                          {c.abbr ? ` (${c.abbr})` : ""}
//                        </option>
//                      ))}
//                    </select>
//                  </div>

//                  <div className="sales-field-group">
//                    <label htmlFor="sales-posting-date" className="form-label sales-field-label">
//                      Posting Date
//                    </label>
//                    <input
//                      id="sales-posting-date"
//                      type="date"
//                      value={postingDate}
//                      onChange={(e) => setPostingDate(e.target.value)}
//                      className="input"
//                    />
//                  </div>

//                  <div className="sales-field-group">
//                    <label htmlFor="sales-customer" className="form-label sales-field-label">
//                      Customer
//                    </label>
//                    <select
//                      id="sales-customer"
//                      value={customer}
//                      onChange={(e) => setCustomer(e.target.value)}
//                      className="select"
//                    >
//                      <option value="">-- select customer --</option>
//                      {customers.map((c) => (
//                        <option key={c.name} value={c.name}>
//                          {c.customer_name || c.name}
//                        </option>
//                      ))}
//                    </select>
//                  </div>

//                  <div className="sales-field-group">
//                    <label className="form-label sales-field-label">Warehouse</label>
//                    <input className="input" value={FIXED_WAREHOUSE} disabled />
//                  </div>
//                </div>

//                <div className="sales-items-header">
//                  <h3 className="sales-items-title">Items (Finished Goods / Products)</h3>
//                  <button type="button" onClick={addRow} className="btn btn-accent btn-sm">
//                    + Add Item
//                  </button>
//                </div>

//                <div className="sales-items-rows">
//                  {rows.map((row, index) => (
//                    <div key={row.id} className="sales-item-row-card">
//                      <div className="sales-item-row-header">
//                        <span className="sales-item-row-title">
//                          Line #{index + 1}
//                          {row.item_code ? ` · ${row.item_code}` : ""}
//                        </span>
//                        <button
//                          type="button"
//                          onClick={() => removeRow(row.id)}
//                          className="btn btn-ghost btn-sm"
//                        >
//                          Remove
//                        </button>
//                      </div>

//                      <div className="sales-item-row-grid">
//                        <div className="sales-item-field">
//                          <label className="form-label">Item</label>
//                          <ItemSearchDropdown
//                            items={items}
//                            value={row.item_code}
//                            onSelect={(code) => handleItemChange(row.id, code)}
//                            placeholder="Search item name / code..."
//                          />
//                        </div>

//                        <div className="sales-item-field">
//                          <label className="form-label">Qty</label>
//                          <input
//                            type="number"
//                            value={row.qty}
//                            onChange={(e) => handleRowChange(row.id, "qty", e.target.value)}
//                            className={`input ${row.qtyError ? "is-error" : ""}`}
//                            min={0}
//                          />
//                        </div>

//                        {/* ✅ Available Qty field */}
//                        <div className="sales-item-field">
//                          <label className="form-label">Available Qty</label>
//                          <input
//                            className="input sales-readonly-input"
//                            value={availMap[row.item_code] ?? "-"}
//                            readOnly
//                            tabIndex={-1}
//                          />
//                        </div>

//                        <div className="sales-item-field">
//                          <label className="form-label">Rate</label>
//                          <input
//                            type="number"
//                            value={row.rate}
//                            onChange={(e) => handleRowChange(row.id, "rate", e.target.value)}
//                            className={`input ${row.rateError ? "is-error" : ""}`}
//                            min={0}
//                          />
//                        </div>
//                      </div>

//                      {row.rowError ? <div className="sales-row-error">{row.rowError}</div> : null}
//                    </div>
//                  ))}
//                </div>

//                <div className="sales-submit-row" style={{ display: "flex", gap: 10 }}>
//                  <button type="submit" disabled={savingDraft || loadingInit} className="btn btn-primary">
//                    {savingDraft
//                      ? editingDraftName
//                        ? "Updating Draft..."
//                        : "Creating Draft..."
//                      : editingDraftName
//                        ? "Update Draft"
//                        : "Create Draft Sale"}
//                  </button>

//                  {editingDraftName ? (
//                    <button
//                      type="button"
//                      onClick={handleCancelEdit}
//                      className="btn btn-ghost"
//                      disabled={savingDraft}
//                    >
//                      Cancel Edit
//                    </button>
//                  ) : null}
//                </div>
//              </form>
//            </div>
//          )}
//        </div>

//        {/* RIGHT: Recent list */}
//        <div className="sales-panel sales-panel-right">
//          <div className="sales-recent-header">
//            <h3 className="sales-recent-title">Recent Sales (Last {LIST_LIMIT})</h3>
//            <button
//              type="button"
//              onClick={reloadRecentInvoices}
//              disabled={loadingInvoices}
//              className="btn btn-secondary btn-sm"
//            >
//              {loadingInvoices ? "Refreshing..." : "Refresh"}
//            </button>
//          </div>

//          <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
//            <label className="text-muted" style={{ fontSize: 12 }}>
//              Filter by Customer:
//            </label>

//            <select
//              className="select"
//              value={invoiceCustomerFilter}
//              onChange={(e) => setInvoiceCustomerFilter(e.target.value)}
//              style={{ minWidth: 240 }}
//            >
//              <option value="">All Customers</option>
//              {customers.map((c) => (
//                <option key={c.name} value={c.name}>
//                  {c.customer_name || c.name}
//                </option>
//              ))}
//            </select>

//            <div className="text-muted" style={{ fontSize: 12 }}>
//              Showing <b>{filteredRecentInvoices.length}</b> / <b>{recentInvoices.length}</b>
//            </div>
//          </div>
//          <button
//            type="button"
//            className="btn btn-outline btn-xs"
//            onClick={() => setPostingDateSort((p) => (p === "asc" ? "desc" : "asc"))}
//            disabled={loadingInvoices}
//          >
//            {postingDateSortLabel}
//          </button>


//          {loadingInvoices && <div className="sales-recent-loading text-muted">Loading recent invoices...</div>}

//          {!loadingInvoices && filteredRecentInvoices.length === 0 && (
//            <div className="sales-recent-empty text-muted">No recent invoices found.</div>
//          )}

//          {!loadingInvoices && filteredRecentInvoices.length > 0 && (
//            <div className="sales-recent-table-wrapper table-container">
//              <table className="table sales-recent-table">
//                <thead>
//                  <tr>
//                    <th>Invoice</th>
//                    <th>Customer</th>
//                    <th>Date</th>
//                    <th>Status</th>
//                    <th>Grand Total</th>
//                    <th>Outstanding</th>
//                    <th>Total Qty (Unit)</th>
//                    <th style={{ textAlign: "right" }}>Actions</th>
//                  </tr>
//                </thead>
//                <tbody>
//                  {sortedRecentInvoices.map((inv) => {
//                    const isDraft = !!inv.__isDraft;
//                    const isPaid = !isDraft && (inv.status === "Paid" || (inv.outstanding_amount || 0) <= 0);

//                    const isMarking = payingInvoice === inv.name;
//                    const isSubmitting = submittingDraft === inv.name;
//                    const isLoadingDraft = editDraftLoading === inv.name;
//                    const isEditingThis = editingDraftName === inv.name;

//                    return (
//                      <tr key={inv.name}>
//                        <td className="sales-recent-name-cell">
//                          {inv.name} {isDraft ? <span style={{ opacity: 0.7 }}>(Draft)</span> : null}
//                          {isEditingThis ? <span style={{ marginLeft: 8, opacity: 0.7 }}>(Editing)</span> : null}
//                        </td>
//                        <td className="sales-recent-customer-cell">{inv.customer}</td>
//                        <td className="sales-recent-date-cell">{inv.posting_date}</td>
//                        <td>
//                          <span className={"sales-status-pill " + (isDraft ? "unpaid" : isPaid ? "paid" : "unpaid")}>
//                            {isDraft ? "Draft" : inv.status}
//                          </span>
//                        </td>
//                        <td className="sales-recent-amount-cell">
//                          ₹ {inv.grand_total != null ? Number(inv.grand_total).toFixed(2) : "0.00"}
//                        </td>
//                        <td className="sales-recent-amount-cell">
//                          ₹ {inv.outstanding_amount != null ? Number(inv.outstanding_amount).toFixed(2) : "0.00"}
//                        </td>
//                        <td className="sales-recent-qty-cell">
//                          {inv.total_qty != null ? `${inv.total_qty} ${inv.uom || ""}` : "-"}
//                        </td>

//                        <td className="sales-recent-actions-cell" style={{ textAlign: "right" }}>
//                          {isDraft ? (
//                            <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
//                              <button
//                                type="button"
//                                onClick={() => handleEditDraft(inv.name)}
//                                disabled={isLoadingDraft || isSubmitting}
//                                className="btn btn-secondary btn-sm"
//                              >
//                                {isLoadingDraft ? "Loading..." : "Edit Draft"}
//                              </button>

//                              <button
//                                type="button"
//                                onClick={() => handleSubmitDraft(inv.name)}
//                                disabled={isSubmitting}
//                                className="btn btn-primary btn-sm"
//                              >
//                                {isSubmitting ? "Submitting..." : "Create Sale Invoice"}
//                              </button>
//                            </div>
//                          ) : (
//                            <button
//                              type="button"
//                              onClick={() => handleMarkPaid(inv)}
//                              disabled={isPaid || isMarking}
//                              className="btn btn-secondary btn-sm"
//                            >
//                              {isPaid ? "Paid" : isMarking ? "Marking..." : "Mark Paid"}
//                            </button>
//                          )}
//                        </td>
//                      </tr>
//                    );
//                  })}
//                </tbody>
//              </table>
//            </div>
//          )}
//        </div>
//      </div>
//    </div>
//  );
//}

///* Dropdown logic */
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
//        const code = (it.name || "").toLowerCase();
//        const name = (it.item_name || "").toLowerCase();
//        return code.includes(s) || name.includes(s);
//      });
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

// src/SalesEasyShip.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getCustomers,
  getFinishedItemsForSales,
  createSalesInvoice, // creates DRAFT (we don't submit here)
  submitDoc, // submit from list
  getRecentSalesInvoices, // your existing "recent submitted" list API
  createPaymentEntryForInvoice,
  getSalesInvoiceWithItems,
  getCompanies,

  // Draft list + edit draft
  getDoctypeList,
  getDoc,
  updateDoc,
} from "./erpBackendApi";

import { getBinForItemWarehouse } from "./erpBackendApi"; // ✅ add at top
import "../CSS/SalesOrder.css";

const DEFAULT_COMPANY = "Mithila Foods";
const DEFAULT_WAREHOUSE = "Finished Goods - MF"; // ✅ FIXED
const DEFAULT_CUSTOMER = "Test Customer";
const TRY_SINGLE_LINE_FALLBACK = true;

const LIST_LIMIT = 10; // show only last 10 (draft + submitted)

function toSortTs(v) {
  if (!v) return 0;
  const s = String(v).trim();
  if (!s) return 0;

  const isoLike = s.includes(" ") ? s.replace(" ", "T") : s;
  const d = new Date(isoLike);
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toYMDFromDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * ISO datetime OR many common sheet formats -> YYYY-MM-DD
 */
function toErpDate(input) {
  const s0 = String(input ?? "").trim();
  if (!s0) return "";

  const s = s0.replace(/\s+/g, " ").trim();

  // ISO datetime
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // YYYY/MM/DD or YYYY-M-D etc
  let m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) {
    const [, yyyy, mm, dd] = m;
    return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
  }

  // DD-MM-YYYY
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
  }

  // DD/MM/YYYY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
  }

  // MM/DD/YYYY or MM/DD/YY (common)
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) {
    const [, mm, dd, yy] = m;
    const yyyy = yy.length === 2 ? `20${yy}` : yy;
    return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
  }

  // Month-name formats: "Dec 08, 2025" / "Dec 08, 2025 20:31:01"
  m = s.match(/^([A-Za-z]{3,})\s+(\d{1,2}),\s*(\d{4})/);
  if (m) {
    const monRaw = String(m[1] || "").toLowerCase();
    const dd = Number(m[2]);
    const yyyy = Number(m[3]);

    const monMap = {
      jan: 1, january: 1,
      feb: 2, february: 2,
      mar: 3, march: 3,
      apr: 4, april: 4,
      may: 5,
      jun: 6, june: 6,
      jul: 7, july: 7,
      aug: 8, august: 8,
      sep: 9, sept: 9, september: 9,
      oct: 10, october: 10,
      nov: 11, november: 11,
      dec: 12, december: 12,
    };

    const mm = monMap[monRaw];
    if (mm && yyyy && dd) {
      return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
    }
  }

  // Last fallback: JS Date parser (works for many formats)
  const d = new Date(s);
  if (Number.isFinite(d.getTime())) return toYMDFromDate(d);

  return "";
}

function normalizeKey(k) {
  return String(k ?? "")
    .replace(/\uFEFF/g, "")
    .trim()
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

// ✅ BASE aliases to support multiple header variations (normalized keys)
const BULK_COL = {
  // REQUIRED
  invoiceId: [
    "invoice-id",
    "invoice",
    "invoice-no",
    "invoice-number",
    "invoiceid",
    "inv-id",
    "inv-no",
    "order-id",
    "order",
    "order-no",
    "order-number",
    "po-no",
    "po-number",
    "only-invoice",
    "invoice-no.",
    "invoice-no", // common
    "invoice-no.", // common
    "invoice-no", // common
    "invoice-no.", // common
    "invoice-no", // common
    "invoice-no.", // common
    "invoice-no", // common
    "invoice-no.", // common
    "invoice-no", // common
    "invoice-no.", // common
  ],

  qty: [
    "quantity-purchased",
    "quantity",
    "qty",
    "order-qty",
    "order-quantity",
    "units",
    "unit",
    "no-of-units",
    "no-of-items",
  ],

  purchaseDate: [
    "purchase-date",
    "order-date",
    "invoice-date",
    "date",
    "created-date",
    "transaction-date",
    "ordered-on",
    "order-on",
    "order-created-on",
  ],

  // OPTIONAL (but you validate at least one key: sku/asin)
  sku: [
    "sku",
    "seller-sku",
    "item-sku",
    "product-sku",
    "merchant-sku",
    "msku",
    "fnsku",
    "upc",
    "barcode",
    "fsn",
  ],

  asin: ["asin", "amazon-asin", "asin-1"],

  // OPTIONAL
  rate: [
    "rate",
    "item-price",
    "price",
    "unit-price",
    "selling-price",
    "item-rate",
    "selling-price-per-item",
    "selling-price-per-item-(inr)",
  ],

  // OPTIONAL
  productName: [
    "product-name",
    "item-name",
    "product",
    "title",
    "product-title",
  ],
};

function looseKey(k) {
  return String(k || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pickFirstSmart(row, aliases) {
  if (!row) return "";

  // 1) direct key match (best case)
  for (const k of aliases || []) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }

  // 2) loose match + prefix match (handles headers like: "invoice-date-(mm/dd/yy)")
  const entries = Object.keys(row).map((k) => ({ k, lk: looseKey(k) }));

  for (const a of aliases || []) {
    const la = looseKey(a);

    // exact loose match
    const exact = entries.find((e) => e.lk === la);
    if (exact) {
      const v = row[exact.k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }

    // prefix loose match
    const pref = entries.find((e) => e.lk.startsWith(la) || la.startsWith(e.lk));
    if (pref) {
      const v = row[pref.k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
  }

  return "";
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

/**
 * Customer-based mapping config:
 * - easyship/fba: SKU field first, ASIN allowed fallback
 * - flipkart/blinkit: SKU field only, ASIN not allowed
 */
function getCustomerMapConfig(customerName) {
  const s = String(customerName || "").toLowerCase();

  if (s.includes("easyship")) return { skuField: "custom_easy_ship_sku", allowAsin: true };
  if (s.includes("fba")) return { skuField: "custom_fba_sku", allowAsin: true };
  if (s.includes("flipkart")) return { skuField: "custom_fnsku", allowAsin: false };
  if (s.includes("blinkit")) return { skuField: "custom_blinkit_upc", allowAsin: false };

  // fallback: old behavior (asin allowed)
  return { skuField: "", allowAsin: true };
}

// Draft list helper (ONLY normal Sales Invoices, NOT returns)
async function getRecentDraftSalesInvoices(limit = LIST_LIMIT) {
  const rows = await getDoctypeList("Sales Invoice", {
    fields: JSON.stringify([
      "name",
      "customer",
      "company",
      "posting_date",
      "grand_total",
      "outstanding_amount",
      "docstatus",
      "status",
      "modified",
      "is_return",
    ]),
    filters: JSON.stringify([
      ["Sales Invoice", "docstatus", "=", 0],
      ["Sales Invoice", "is_return", "=", 0],
    ]),
    order_by: "modified desc",
    limit_page_length: limit,
  });

  return rows || [];
}

export default function SalesEasyShip() {
  const FIXED_WAREHOUSE = DEFAULT_WAREHOUSE;
  const [createdSort, setCreatedSort] = useState("desc");
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]); // MUST include custom_asin/custom_* fields
  const [companies, setCompanies] = useState([]);

  const [company, setCompany] = useState("");
  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10));
  const [customer, setCustomer] = useState("");

  const [bulkPostingDate, setBulkPostingDate] = useState(new Date().toISOString().slice(0, 10));

  const [availMap, setAvailMap] = useState({});

  function createEmptyRow(id) {
    return {
      id,
      _rowName: "", // ERP child row name (when editing draft)
      item_code: "",
      qty: "",
      rate: "",
      qtyError: "",
      rateError: "",
      rowError: "",
    };
  }

  const [rows, setRows] = useState([createEmptyRow(0)]);

  // Draft/edit state
  const [editingDraftName, setEditingDraftName] = useState("");
  const [editDraftLoading, setEditDraftLoading] = useState("");
  const [submittingDraft, setSubmittingDraft] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);

  // Recent list (draft + submitted)
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loadingInit, setLoadingInit] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // add this state with the others
  const [invoiceCustomerFilter, setInvoiceCustomerFilter] = useState(""); // "" = All

  // add this memo (near itemIndexes useMemo is fine)
  const filteredRecentInvoices = useMemo(() => {
    if (!invoiceCustomerFilter) return recentInvoices;
    return (recentInvoices || []).filter((inv) => inv.customer === invoiceCustomerFilter);
  }, [recentInvoices, invoiceCustomerFilter]);

  const [postingDateSort, setPostingDateSort] = useState("desc"); // desc = Newest → Oldest

  const postingDateSortLabel =
    postingDateSort === "asc"
      ? "Posting Date: Oldest → Newest"
      : "Posting Date: Newest → Oldest";

  const sortedRecentInvoices = useMemo(() => {
    const dirMul = postingDateSort === "asc" ? 1 : -1;

    return [...(filteredRecentInvoices || [])].sort((a, b) => {
      const ta = toSortTs(a?.posting_date);
      const tb = toSortTs(b?.posting_date);

      if (ta !== tb) return (ta - tb) * dirMul;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });
  }, [filteredRecentInvoices, postingDateSort]);

  // Bulk state
  const fileRef = useRef(null);
  const [bulkParsing, setBulkParsing] = useState(false);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkParseError, setBulkParseError] = useState("");
  const [bulkLines, setBulkLines] = useState([]); // parsed raw lines (sku/asin), mapping happens at create time
  const [bulkResults, setBulkResults] = useState([]);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  // UI tab
  const [activeTab, setActiveTab] = useState("manual"); // "manual" | "bulk"

  function extractErrMsg(err) {
    return (
      err?.response?.data?.error?.message ||
      err?.response?.data?.error ||
      err?.message ||
      "Unknown error"
    );
  }

  function normKey(v) {
    return String(v ?? "").trim().toUpperCase();
  }

  // Build indexes from items list
  const itemIndexes = useMemo(() => {
    const idx = {
      custom_asin: new Map(),
      custom_easy_ship_sku: new Map(),
      custom_fba_sku: new Map(),
      custom_fnsku: new Map(),
      custom_blinkit_upc: new Map(),
    };

    (items || []).forEach((it) => {
      const code = it?.name;
      if (!code) return;

      const asin = normKey(it.custom_asin);
      if (asin) idx.custom_asin.set(asin, code);

      const esSku = normKey(it.custom_easy_ship_sku);
      if (esSku) idx.custom_easy_ship_sku.set(esSku, code);

      const fbaSku = normKey(it.custom_fba_sku);
      if (fbaSku) idx.custom_fba_sku.set(fbaSku, code);

      const fnsku = normKey(it.custom_fnsku);
      if (fnsku) idx.custom_fnsku.set(fnsku, code);

      const upc = normKey(it.custom_blinkit_upc);
      if (upc) idx.custom_blinkit_upc.set(upc, code);
    });

    return idx;
  }, [items]);

  function resolveItemCodeForCustomer({ customerName, sku, asin }) {
    const { skuField, allowAsin } = getCustomerMapConfig(customerName);

    const skuKey = normKey(sku);
    const asinKey = normKey(asin);

    // 1) customer-specific SKU field
    if (skuField && skuKey) {
      const bySku = itemIndexes?.[skuField]?.get(skuKey);
      if (bySku) return bySku;
    }

    // 2) ASIN fallback only when allowed
    if (allowAsin && asinKey) {
      const byAsin = itemIndexes.custom_asin.get(asinKey);
      if (byAsin) return byAsin;
    }

    return "";
  }

  function resetManualForm() {
    setEditingDraftName("");
    setPostingDate(new Date().toISOString().slice(0, 10));
    setRows([createEmptyRow(0)]);
  }

  // Load recent list (draft + submitted) and keep only last 10
  async function loadInvoices() {
    setLoadingInvoices(true);
    try {
      const [submittedBase, draftsBase] = await Promise.all([
        getRecentSalesInvoices(LIST_LIMIT),
        getRecentDraftSalesInvoices(LIST_LIMIT),
      ]);

      const drafts = (draftsBase || []).map((d) => ({ ...d, __isDraft: true }));
      const submitted = (submittedBase || []).map((s) => ({ ...s, __isDraft: false }));

      // drafts first then submitted, only 10 total
      const baseList = [...drafts, ...submitted].slice(0, LIST_LIMIT);

      const enriched = [];
      for (const inv of baseList) {
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

          enriched.push({
            ...inv,
            customer: inv.customer || doc.customer,
            posting_date: inv.posting_date || doc.posting_date,
            status: inv.__isDraft ? "Draft" : inv.status || doc.status,
            grand_total: inv.grand_total ?? doc.grand_total,
            outstanding_amount: inv.outstanding_amount ?? doc.outstanding_amount,
            total_qty: totalQty,
            uom,
          });
        } catch (e) {
          enriched.push({
            ...inv,
            status: inv.__isDraft ? "Draft" : inv.status,
            total_qty: null,
            uom: "",
          });
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
        const [custData, itemData, companyData] = await Promise.all([
          getCustomers(),
          getFinishedItemsForSales(),
          getCompanies(),
        ]);

        setCustomers(custData || []);
        setItems(itemData || []);
        setCompanies(companyData || []);

        if (!company) {
          const ok = (companyData || []).some((c) => c.name === DEFAULT_COMPANY);
          setCompany(ok ? DEFAULT_COMPANY : companyData?.[0]?.name || "");
        }
        if (!customer) {
          const ok = (custData || []).some((c) => c.name === DEFAULT_CUSTOMER);
          setCustomer(ok ? DEFAULT_CUSTOMER : custData?.[0]?.name || "");
        }
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
  // Manual flow (draft + edit)
  // =========================
  function handleRowChange(rowId, field, value) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;

        const next = { ...r, [field]: value, rowError: "" };

        if (field === "qty") {
          if (value === "") next.qtyError = "";
          else if (!isNaN(Number(value)) && Number(value) < 0) next.qtyError = "Qty cannot be negative";
          else next.qtyError = "";
        }

        if (field === "rate") {
          if (value === "") next.rateError = "";
          else if (!isNaN(Number(value)) && Number(value) < 0) next.rateError = "Rate cannot be negative";
          else next.rateError = "";
        }

        return next;
      })
    );
  }

  async function handleItemChange(rowId, itemCode) {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, item_code: itemCode, rowError: "" } : r))
    );

    if (!itemCode) return;

    try {
      const bin = await getBinForItemWarehouse(itemCode, FIXED_WAREHOUSE);
      const qty = Number(bin?.actual_qty) || 0;

      setAvailMap((m) => ({ ...m, [itemCode]: qty }));
    } catch (e) {
      setAvailMap((m) => ({ ...m, [itemCode]: null }));
    }
  }

  function addRow() {
    setRows((prev) => [...prev, createEmptyRow(prev.length ? prev[prev.length - 1].id + 1 : 0)]);
  }

  function removeRow(rowId) {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  }

  // Create/Update draft only (no submit)
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!company) return setError("Company is required (same as in ERPNext).");
    if (!postingDate) return setError("Posting date is required.");
    if (!customer) return setError("Select a customer.");

    const hasNeg = rows.some((r) => r.qtyError || r.rateError);
    if (hasNeg) return setError("Fix negative Qty/Rate (red fields) before saving.");

    const validRows = rows.filter(
      (r) => r.item_code && !isNaN(parseFloat(r.qty)) && parseFloat(r.qty) > 0
    );
    if (!validRows.length) return setError("Add at least one item with quantity > 0.");

    const itemsPayload = validRows.map((r) => ({
      ...(editingDraftName && r._rowName ? { name: r._rowName } : {}),
      item_code: r.item_code,
      qty: parseFloat(r.qty),
      rate: r.rate === "" || r.rate == null ? undefined : parseFloat(r.rate),
      warehouse: FIXED_WAREHOUSE,
    }));

    try {
      setSavingDraft(true);

      if (!editingDraftName) {
        const doc = await createSalesInvoice({
          customer,
          company,
          posting_date: postingDate,
          warehouse: FIXED_WAREHOUSE,
          items: itemsPayload.map(({ name, ...rest }) => rest), // no child "name" on create
        });

        const name = doc?.data?.name;
        setMessage(
          `Draft Sale created: ${name || "(no name returned)"}. Use right list → "Create Sale Invoice" to submit.`
        );
      } else {
        let old = null;
        try {
          old = await getDoc("Sales Invoice", editingDraftName);
        } catch {
          old = null;
        }

        const oldNames = new Set((old?.items || []).map((x) => x.name).filter(Boolean));
        const newNames = new Set(itemsPayload.map((x) => x.name).filter(Boolean));

        const deletes = [];
        oldNames.forEach((nm) => {
          if (!newNames.has(nm)) deletes.push({ doctype: "Sales Invoice Item", name: nm, __delete: 1 });
        });

        await updateDoc("Sales Invoice", editingDraftName, {
          customer,
          company,
          posting_date: postingDate,
          set_warehouse: FIXED_WAREHOUSE,
          items: [...itemsPayload, ...deletes],
        });

        setMessage(
          `Draft updated: ${editingDraftName}. Now use right list → "Create Sale Invoice" to submit.`
        );
      }

      resetManualForm();
      await reloadRecentInvoices();
    } catch (err) {
      console.error(err);
      setError(extractErrMsg(err) || "Failed to create / update draft Sales Invoice");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleEditDraft(invName) {
    if (!invName) return;

    setError("");
    setMessage("");
    setEditDraftLoading(invName);

    try {
      const doc = await getSalesInvoiceWithItems(invName);

      setActiveTab("manual");
      setEditingDraftName(invName);

      setCompany(doc.company || company);
      setCustomer(doc.customer || customer);

      setPostingDate(String(doc.posting_date || "").slice(0, 10) || postingDate);

      const its = Array.isArray(doc.items) ? doc.items : [];
      const mapped =
        its.length > 0
          ? its.map((it, idx) => ({
              id: idx,
              _rowName: it.name || "",
              item_code: it.item_code || "",
              qty: it.qty != null ? String(it.qty) : "",
              rate: it.rate != null ? String(it.rate) : "",
              qtyError: "",
              rateError: "",
              rowError: "",
            }))
          : [createEmptyRow(0)];

      setRows(mapped);

      setMessage(`Editing draft: ${invName}. Make changes and click "Update Draft".`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      setError(extractErrMsg(err) || "Failed to load draft");
    } finally {
      setEditDraftLoading("");
    }
  }

  function handleCancelEdit() {
    setMessage("");
    resetManualForm();
  }

  async function handleSubmitDraft(invName) {
    if (!invName) return;

    setError("");
    setMessage("");
    setSubmittingDraft(invName);

    try {
      await submitDoc("Sales Invoice", invName);
      setMessage(`Sale Is submitted: ${invName}`);

      if (editingDraftName === invName) resetManualForm();
      await reloadRecentInvoices();
    } catch (err) {
      console.error(err);
      setError(extractErrMsg(err) || "Failed to submit draft invoice");
    } finally {
      setSubmittingDraft("");
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
  // Bulk upload
  // =========================
  async function parseAnyFile(file) {
    const name = String(file?.name || "").toLowerCase();

    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      let mod;
      try {
        mod = await import("xlsx");
      } catch (e) {
        throw new Error('To import .xlsx, run: npm i xlsx (then restart dev server).');
      }

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
        // ✅ pick values using base aliases (supports multiple header variations)
        const invoiceId = String(pickFirstSmart(r, BULK_COL.invoiceId) || "").trim();
        const asin = String(pickFirstSmart(r, BULK_COL.asin) || "").trim(); // can be empty
        const sku = String(pickFirstSmart(r, BULK_COL.sku) || "").trim(); // can be empty
        const qty = parseFloat(pickFirstSmart(r, BULK_COL.qty));
        const purchaseDate = toErpDate(pickFirstSmart(r, BULK_COL.purchaseDate));

        // rate options (optional)
        const rateRaw = pickFirstSmart(r, BULK_COL.rate);
        const rate =
          String(rateRaw).trim() !== "" && !isNaN(parseFloat(rateRaw))
            ? parseFloat(rateRaw)
            : undefined;

        const hasAnyKey = !!asin || !!sku;

        // optional product name (optional)
        const product_name = String(pickFirstSmart(r, BULK_COL.productName) || "").trim();

        if (!invoiceId || !qty || qty <= 0 || !purchaseDate || !hasAnyKey) {
          errs.push(
            `Row ${idx + 2}: missing/invalid invoice-id, quantity-purchased, purchase-date, and (sku or asin)`
          );
          return;
        }

        lines.push({
          rowNo: idx + 2,
          invoice_id: invoiceId,
          asin,
          sku,
          purchase_date: purchaseDate,
          qty,
          rate,
          product_name,
        });
      });

      if (errs.length) {
        setBulkParseError(
          errs.slice(0, 5).join(" | ") + (errs.length > 5 ? ` (+${errs.length - 5} more)` : "")
        );
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
    if (!bulkLines.length) return setError("No parsed lines. Upload a file first.");
    if (!bulkPostingDate) return setError("Select a Bulk Posting Date.");

    const { allowAsin } = getCustomerMapConfig(customer);

    // Resolve mapping at create time (so changing Customer after upload works)
    const resolvedLines = bulkLines.map((l) => {
      let item_code = resolveItemCodeForCustomer({
        customerName: customer,
        sku: l.sku,
        asin: l.asin,
      });

      // optional fallback: SKU is actually Item Code
      if (!item_code && l.sku && (items || []).some((it) => it.name === l.sku)) {
        item_code = l.sku;
      }

      return { ...l, item_code };
    });

    // Separate failed mapping lines
    const preResults = [];
    const usableLines = [];

    for (const l of resolvedLines) {
      const missingSkuButRequired = !allowAsin && !l.sku;

      if (!l.item_code) {
        preResults.push({
          invoice_id: l.invoice_id,
          sku: l.sku,
          asin: l.asin,
          qty: l.qty,
          item_code: "",
          status: "FAILED",
          si_name: "",
          message: missingSkuButRequired
            ? "Customer requires SKU mapping but SKU is missing in this row."
            : "No Item match for this Customer (SKU/ASIN mapping failed).",
        });
      } else {
        usableLines.push(l);
      }
    }

    if (!usableLines.length) {
      setBulkResults(preResults);
      setError("All rows failed (item mapping missing). Fix SKU/ASIN mapping fields in Item and re-upload.");
      return;
    }

    // Group by invoice-id
    const groupsMap = new Map();
    for (const l of usableLines) {
      const key = l.invoice_id;
      const g = groupsMap.get(key) || { invoice_id: l.invoice_id, lines: [] };
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
          const posting = bulkPostingDate;
          const due = posting;

          const poDate =
            (g.lines || [])
              .map((x) => x.purchase_date)
              .filter(Boolean)
              .sort()[0] || "";

          const itemsPayload = g.lines.map((l) => ({
            item_code: l.item_code,
            qty: l.qty,
            rate: l.rate,
            warehouse: FIXED_WAREHOUSE,
          }));

          const markAll = (status, msg, siName = "") => {
            g.lines.forEach((l) => {
              allResults.push({
                invoice_id: g.invoice_id,
                sku: l.sku,
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
            const created = await createSalesInvoice({
              customer,
              company,
              posting_date: posting,
              due_date: due,
              warehouse: FIXED_WAREHOUSE,
              items: itemsPayload,
              po_no: g.invoice_id,
              po_date: poDate,
              remarks: `Imported from sheet. invoice-id=${g.invoice_id}`,
            });

            const siName = created?.data?.name || "";

            try {
              if (siName) await submitDoc("Sales Invoice", siName);
            } catch (subErr) {
              markAll("PARTIAL", `Created but submit failed: ${extractErrMsg(subErr)}`, siName);
              return;
            }

            markAll("OK", "Created & submitted", siName);
          } catch (err) {
            const msg = extractErrMsg(err);

            if (TRY_SINGLE_LINE_FALLBACK) {
              for (const l of g.lines) {
                try {
                  const created1 = await createSalesInvoice({
                    customer,
                    company,
                    posting_date: posting,
                    due_date: due,
                    warehouse: FIXED_WAREHOUSE,
                    items: [
                      {
                        item_code: l.item_code,
                        qty: l.qty,
                        rate: l.rate,
                        warehouse: FIXED_WAREHOUSE,
                      },
                    ],
                    po_no: g.invoice_id,
                    po_date: l.purchase_date,
                    remarks: `Fallback single-line import. invoice-id=${g.invoice_id} sku=${l.sku} asin=${l.asin}`,
                  });

                  const si1 = created1?.data?.name || "";

                  try {
                    if (si1) await submitDoc("Sales Invoice", si1);
                  } catch (subErr) {
                    allResults.push({
                      invoice_id: g.invoice_id,
                      sku: l.sku,
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
                    sku: l.sku,
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
                    sku: l.sku,
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
              markAll("FAILED", msg, "");
            }
          }
        },
        (done) => setBulkProgress((p) => ({ ...p, done }))
      );

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
          <h2 className="sales-title">All Plateform Sales (ERPNext)</h2>
          <p className="sales-subtitle">Manual + Bulk Upload</p>
          {/*<div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            Warehouse is fixed: <b>{FIXED_WAREHOUSE}</b>
          </div>*/}
        </div>
        <div className="sales-header-pill">
          {rows.length} line item{rows.length !== 1 ? "s" : ""}
        </div>
      </div>

      {loadingInit && <div className="sales-loading text-muted">Loading customers / items...</div>}
      {error && <div className="alert alert-error sales-error">{error}</div>}
      {message && <div className="alert alert-success sales-message">{message}</div>}

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

          {/* BULK TAB */}
          {activeTab === "bulk" && (
            <div className="sales-tab-body">
              <div className="sales-recent-header">
                <h3 className="sales-recent-title">Bulk Upload (Sheet)</h3>
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
                    Required columns: <b>invoice-id</b>, <b>quantity-purchased</b>,{" "}
                    <b>purchase-date</b>, and <b>sku or asin</b> (depends on customer)
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
              </div>

              {bulkParseError && (
                <div className="alert alert-error sales-error" style={{ marginTop: 12 }}>
                  {bulkParseError}
                </div>
              )}

              <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
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

              {bulkResults.length > 0 && (
                <div className="sales-recent-table-wrapper table-container" style={{ marginTop: 14 }}>
                  <table className="table sales-recent-table">
                    <thead>
                      <tr>
                        <th>Invoice-ID</th>
                        <th>SKU</th>
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
                        <tr key={`${r.invoice_id}-${r.sku}-${r.asin}-${idx}`}>
                          <td>{r.invoice_id}</td>
                          <td>{r.sku || "-"}</td>
                          <td>{r.asin || "-"}</td>
                          <td>{r.item_code}</td>
                          <td>{r.qty}</td>
                          <td>
                            <span className={"sales-status-pill " + (r.status === "OK" ? "paid" : "unpaid")}>
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

          {/* MANUAL TAB */}
          {activeTab === "manual" && (
            <div className="sales-tab-body">
              {editingDraftName ? (
                <div className="text-muted" style={{ marginBottom: 10 }}>
                  Editing Draft: <b>{editingDraftName}</b>
                </div>
              ) : null}

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
                    <label className="form-label sales-field-label">Warehouse</label>
                    <input className="input" value={FIXED_WAREHOUSE} disabled />
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
                            className={`input ${row.qtyError ? "is-error" : ""}`}
                            min={0}
                          />
                        </div>

                        {/* ✅ Available Qty field */}
                        <div className="sales-item-field">
                          <label className="form-label">Available Qty</label>
                          <input
                            className="input sales-readonly-input"
                            value={availMap[row.item_code] ?? "-"}
                            readOnly
                            tabIndex={-1}
                          />
                        </div>

                        <div className="sales-item-field">
                          <label className="form-label">Rate</label>
                          <input
                            type="number"
                            value={row.rate}
                            onChange={(e) => handleRowChange(row.id, "rate", e.target.value)}
                            className={`input ${row.rateError ? "is-error" : ""}`}
                            min={0}
                          />
                        </div>
                      </div>

                      {row.rowError ? <div className="sales-row-error">{row.rowError}</div> : null}
                    </div>
                  ))}
                </div>

                <div className="sales-submit-row" style={{ display: "flex", gap: 10 }}>
                  <button type="submit" disabled={savingDraft || loadingInit} className="btn btn-primary">
                    {savingDraft
                      ? editingDraftName
                        ? "Updating Draft..."
                        : "Creating Draft..."
                      : editingDraftName
                        ? "Update Draft"
                        : "Create Draft Sale"}
                  </button>

                  {editingDraftName ? (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="btn btn-ghost"
                      disabled={savingDraft}
                    >
                      Cancel Edit
                    </button>
                  ) : null}
                </div>
              </form>
            </div>
          )}
        </div>

        {/* RIGHT: Recent list */}
        <div className="sales-panel sales-panel-right">
          <div className="sales-recent-header">
            <h3 className="sales-recent-title">Recent Sales (Last {LIST_LIMIT})</h3>
            <button
              type="button"
              onClick={reloadRecentInvoices}
              disabled={loadingInvoices}
              className="btn btn-secondary btn-sm"
            >
              {loadingInvoices ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
            <label className="text-muted" style={{ fontSize: 12 }}>
              Filter by Customer:
            </label>

            <select
              className="select"
              value={invoiceCustomerFilter}
              onChange={(e) => setInvoiceCustomerFilter(e.target.value)}
              style={{ minWidth: 240 }}
            >
              <option value="">All Customers</option>
              {customers.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.customer_name || c.name}
                </option>
              ))}
            </select>

            <div className="text-muted" style={{ fontSize: 12 }}>
              Showing <b>{filteredRecentInvoices.length}</b> / <b>{recentInvoices.length}</b>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-xs"
            onClick={() => setPostingDateSort((p) => (p === "asc" ? "desc" : "asc"))}
            disabled={loadingInvoices}
          >
            {postingDateSortLabel}
          </button>

          {loadingInvoices && <div className="sales-recent-loading text-muted">Loading recent invoices...</div>}

          {!loadingInvoices && filteredRecentInvoices.length === 0 && (
            <div className="sales-recent-empty text-muted">No recent invoices found.</div>
          )}

          {!loadingInvoices && filteredRecentInvoices.length > 0 && (
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
                  {sortedRecentInvoices.map((inv) => {
                    const isDraft = !!inv.__isDraft;
                    const isPaid = !isDraft && (inv.status === "Paid" || (inv.outstanding_amount || 0) <= 0);

                    const isMarking = payingInvoice === inv.name;
                    const isSubmitting = submittingDraft === inv.name;
                    const isLoadingDraft = editDraftLoading === inv.name;
                    const isEditingThis = editingDraftName === inv.name;

                    return (
                      <tr key={inv.name}>
                        <td className="sales-recent-name-cell">
                          {inv.name} {isDraft ? <span style={{ opacity: 0.7 }}>(Draft)</span> : null}
                          {isEditingThis ? <span style={{ marginLeft: 8, opacity: 0.7 }}>(Editing)</span> : null}
                        </td>
                        <td className="sales-recent-customer-cell">{inv.customer}</td>
                        <td className="sales-recent-date-cell">{inv.posting_date}</td>
                        <td>
                          <span className={"sales-status-pill " + (isDraft ? "unpaid" : isPaid ? "paid" : "unpaid")}>
                            {isDraft ? "Draft" : inv.status}
                          </span>
                        </td>
                        <td className="sales-recent-amount-cell">
                          ₹ {inv.grand_total != null ? Number(inv.grand_total).toFixed(2) : "0.00"}
                        </td>
                        <td className="sales-recent-amount-cell">
                          ₹ {inv.outstanding_amount != null ? Number(inv.outstanding_amount).toFixed(2) : "0.00"}
                        </td>
                        <td className="sales-recent-qty-cell">
                          {inv.total_qty != null ? `${inv.total_qty} ${inv.uom || ""}` : "-"}
                        </td>

                        <td className="sales-recent-actions-cell" style={{ textAlign: "right" }}>
                          {isDraft ? (
                            <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                onClick={() => handleEditDraft(inv.name)}
                                disabled={isLoadingDraft || isSubmitting}
                                className="btn btn-secondary btn-sm"
                              >
                                {isLoadingDraft ? "Loading..." : "Edit Draft"}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSubmitDraft(inv.name)}
                                disabled={isSubmitting}
                                className="btn btn-primary btn-sm"
                              >
                                {isSubmitting ? "Submitting..." : "Create Sale Invoice"}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleMarkPaid(inv)}
                              disabled={isPaid || isMarking}
                              className="btn btn-secondary btn-sm"
                            >
                              {isPaid ? "Paid" : isMarking ? "Marking..." : "Mark Paid"}
                            </button>
                          )}
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

/* Dropdown logic */
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
