// src/SalesReturn.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  getCustomers,
  getCompanies,
  getFinishedItemsForSales,
  getRecentSalesReturns,
  getDoctypeList,
  createDoc,
  submitDoc,
  getDoc,
  updateDoc,
  mapLimit,
  getItemRateFromPriceList,
} from "../erpBackendApi";

import SalesReturnForm from "./SalesReturnForm";
import SalesReturnRecentList from "./SalesReturnRecentList";

/**
 * Sales Return warehouses
 * -----------------------
 * We auto-route items based on Quality selection in the UI.
 * - good    -> Finished Goods warehouse
 * - damaged -> Damaged warehouse
 */
const GOOD_WH = "Finished Goods - MF";
const DAMAGED_WH = "Damaged - MF";

/**
 * Default selling price list used to auto-fill Rate when user selects an Item.
 * (If API fails, user can still manually type the rate.)
 */
const DEFAULT_SELLING_PRICE_LIST = "Standard Selling";

/** How many recent drafts + submitted returns we show in the list area */
const LIST_LIMIT = 10;

function getWarehouseForQuality(quality) {
  return quality === "damaged" ? DAMAGED_WH : GOOD_WH;
}

/**
 * Convert a date string into a sortable timestamp.
 * Handles ERPNext "YYYY-MM-DD HH:mm:ss" by converting space -> "T".
 */
function toSortTs(v) {
  if (!v) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  const isoLike = s.includes(" ") ? s.replace(" ", "T") : s;
  const d = new Date(isoLike);
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Normalize various date inputs into YYYY-MM-DD
 * - Accepts Date objects, "YYYY-MM-DD", "DD/MM/YYYY", "DD-MM-YYYY", and "DDMMYYYY"
 */
function toYMD(input) {
  if (input == null) return "";
  if (input instanceof Date && !isNaN(input.getTime())) return input.toISOString().slice(0, 10);

  const s = String(input).trim();
  if (!s) return "";

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[t\s].*)?$/i);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  if (/^\d{8}$/.test(s)) {
    const dd = s.slice(0, 2);
    const mm = s.slice(2, 4);
    const yyyy = s.slice(4, 8);
    return `${yyyy}-${mm}-${dd}`;
  }

  return "";
}

/**
 * Create an empty line row used by the UI form.
 * - _rowName: ERPNext child row name (used when editing existing draft lines)
 * - qty/rate stored as strings so inputs behave nicely
 */
function createEmptyRow(id) {
  return {
    id,
    _rowName: "",
    item_code: "",
    qty: "1.00",
    rate: "0.00",
    quality: "good",
  };
}

/**
 * Get recent draft Sales Returns (Sales Invoice where is_return=1 and docstatus=0).
 * This is separate from getRecentSalesReturns() which fetches submitted ones.
 */
async function getRecentDraftSalesReturns(limit = LIST_LIMIT) {
  const rows = await getDoctypeList("Sales Invoice", {
    fields: JSON.stringify([
      "name",
      "customer",
      "company",
      "posting_date",
      "grand_total",
      "docstatus",
      "modified",
      "is_return",
    ]),
    filters: JSON.stringify([
      ["Sales Invoice", "is_return", "=", 1],
      ["Sales Invoice", "docstatus", "=", 0],
    ]),
    order_by: "modified desc",
    limit_page_length: limit,
  });

  return rows || [];
}

export default function SalesReturn() {
  /**
   * Local "today" in YYYY-MM-DD (timezone-safe) for date input defaults.
   */
  const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

  // =========================================================
  // Master data (dropdowns)
  // =========================================================
  const [customers, setCustomers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [itemsCatalog, setItemsCatalog] = useState([]);

  // =========================================================
  // Header / top-level form values
  // =========================================================
  const [customer, setCustomer] = useState("");
  const [company, setCompany] = useState("");
  const [postingDate, setPostingDate] = useState(todayStr);

  // =========================================================
  // Draft line items (UI rows)
  // =========================================================
  const [rows, setRows] = useState([createEmptyRow(0)]);

  // =========================================================
  // Draft editing state
  // =========================================================
  const [editingDraftName, setEditingDraftName] = useState("");
  const [editDraftLoading, setEditDraftLoading] = useState("");

  // =========================================================
  // Recent list state (draft + submitted)
  // =========================================================
  const [returns, setReturns] = useState([]); // submitted returns
  const [draftReturns, setDraftReturns] = useState([]); // draft returns
  const [loadingReturns, setLoadingReturns] = useState(false);

  // =========================================================
  // Shared UI status
  // =========================================================
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submittingDraft, setSubmittingDraft] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // =========================================================
  // List sorting controls
  // =========================================================
  const [postingDateSort, setPostingDateSort] = useState("desc");
  const postingDateSortLabel =
    postingDateSort === "asc" ? "Posting Date: Oldest → Newest" : "Posting Date: Newest → Oldest";

  // =========================================================
  // Qty enrichment for list rows (computed by reading each doc)
  // =========================================================
  const [qtyByReturnName, setQtyByReturnName] = useState({});

  /**
   * Combine drafts + submitted into a single display list
   * - Drafts appear first (because we build it that way)
   * - Limit to LIST_LIMIT
   */
  const displayReturns = useMemo(() => {
    const drafts = (draftReturns || []).map((d) => ({ ...d, __isDraft: true }));
    const submitted = (returns || []).map((r) => ({ ...r, __isDraft: false }));
    return [...drafts, ...submitted].slice(0, LIST_LIMIT);
  }, [draftReturns, returns]);

  /**
   * Sort display list by posting_date (asc/desc), then name
   */
  const sortedDisplayReturns = useMemo(() => {
    const dirMul = postingDateSort === "asc" ? 1 : -1;

    return [...(displayReturns || [])].sort((a, b) => {
      const ta = toSortTs(a?.posting_date);
      const tb = toSortTs(b?.posting_date);
      if (ta !== tb) return (ta - tb) * dirMul;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });
  }, [displayReturns, postingDateSort]);

  /**
   * Total qty for only the rows currently visible in the list.
   * (Uses qtyByReturnName which is enriched after docs are fetched.)
   */
  const visibleTotalQty = useMemo(() => {
    let sum = 0;
    sortedDisplayReturns.forEach((r) => {
      const q = qtyByReturnName?.[r.name]?.totalQty;
      if (Number.isFinite(q)) sum += q;
    });
    return sum;
  }, [sortedDisplayReturns, qtyByReturnName]);

  // =========================================================
  // Load master data + recent returns (run once)
  // =========================================================
  useEffect(() => {
    async function load() {
      setLoadingMaster(true);
      setError("");

      try {
        const [custData, compData, itemData, recentSubmitted, recentDrafts] = await Promise.all([
          getCustomers(),
          getCompanies(),
          getFinishedItemsForSales(),
          getRecentSalesReturns(LIST_LIMIT),
          getRecentDraftSalesReturns(LIST_LIMIT),
        ]);

        setCustomers(custData || []);
        setCompanies(compData || []);
        setItemsCatalog(itemData || []);
        setReturns(recentSubmitted || []);
        setDraftReturns(recentDrafts || []);

        // If user hasn't selected anything yet, choose the first entries
        if (!customer && (custData || []).length > 0) setCustomer(custData[0].name);
        if (!company && (compData || []).length > 0) setCompany(compData[0].name);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load data for Sales Returns");
      } finally {
        setLoadingMaster(false);
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================================================
  // Row change + auto-rate fetch from price list
  // =========================================================

  /**
   * When user selects an item, fetch its price_list_rate and set Rate.
   * - Uses DEFAULT_SELLING_PRICE_LIST
   * - Ignores errors (user can type rate manually)
   * - Checks if item didn't change while request was in-flight
   */
  async function fetchAndSetSellingRate(rowId, itemCode) {
    if (!itemCode) return;

    try {
      const pr = await getItemRateFromPriceList(itemCode, DEFAULT_SELLING_PRICE_LIST);
      const rateNum =
        pr?.price_list_rate != null && !isNaN(Number(pr.price_list_rate))
          ? Number(pr.price_list_rate)
          : null;

      if (rateNum == null) return;

      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== rowId) return r;
          // If user changed item again before API returned, don't overwrite
          if (r.item_code !== itemCode) return r;
          return { ...r, rate: String(rateNum) };
        })
      );
    } catch {
      // ignore; user can still type rate manually
    }
  }

  /**
   * Updates a row field in state.
   * Special logic:
   * - When item_code changes, clear rate so it refreshes for the new item
   * - Then trigger fetchAndSetSellingRate()
   */
  function handleRowChange(id, field, value) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;

        // When item changes:
        // 1) update item_code
        // 2) clear rate so it's obvious that rate is reloading / needs new value
        if (field === "item_code") {
          const changed = r.item_code !== value;
          return { ...r, item_code: value, ...(changed ? { rate: "" } : {}) };
        }

        return { ...r, [field]: value };
      })
    );

    // After state update, trigger rate fetch for new item
    if (field === "item_code") {
      fetchAndSetSellingRate(id, value);
    }
  }

  // =========================================================
  // Add / remove rows
  // =========================================================
  function addRow() {
    setRows((prev) => [...prev, createEmptyRow(prev.length ? prev[prev.length - 1].id + 1 : 0)]);
  }

  function removeRow(id) {
    setRows((prev) => {
      const filtered = prev.filter((r) => r.id !== id);
      return filtered.length ? filtered : [createEmptyRow(0)];
    });
  }

  // =========================================================
  // Reload recent returns list (draft + submitted)
  // =========================================================
  async function reloadReturns() {
    try {
      setLoadingReturns(true);
      const [rec, drafts] = await Promise.all([
        getRecentSalesReturns(LIST_LIMIT),
        getRecentDraftSalesReturns(LIST_LIMIT),
      ]);
      setReturns(rec || []);
      setDraftReturns(drafts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReturns(false);
    }
  }

  // =========================================================
  // Draft edit helpers
  // =========================================================
  function resetFormToNewDraft() {
    setEditingDraftName("");
    setPostingDate(todayStr);
    setRows([createEmptyRow(0)]);
  }

  /**
   * Load a draft Sales Invoice (return) and map its items to UI rows.
   */
  async function handleEditDraft(name) {
    if (!name) return;

    setError("");
    setMessage("");
    setEditDraftLoading(name);

    try {
      const doc = await getDoc("Sales Invoice", name);

      setEditingDraftName(name);
      setCustomer(doc.customer || customer);
      setCompany(doc.company || company);
      setPostingDate(toYMD(doc.posting_date) || todayStr);

      const its = Array.isArray(doc.items) ? doc.items : [];
      const mapped =
        its.length > 0
          ? its.map((it, idx) => {
              const wh = it.warehouse || GOOD_WH;
              const quality = wh === DAMAGED_WH ? "damaged" : "good";

              const qtyNum = Number(it.qty || 0);
              const rateNum = Number(it.rate || 0);

              return {
                id: idx,
                _rowName: it.name || "",
                item_code: it.item_code || "",
                qty: String(Math.abs(qtyNum) || 1),
                rate: String(isNaN(rateNum) ? 0 : rateNum),
                quality,
              };
            })
          : [createEmptyRow(0)];

      setRows(mapped);
      setMessage(`Editing draft: ${name}. Update and click "Update Draft".`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to load draft for edit"
      );
    } finally {
      setEditDraftLoading("");
    }
  }

  function cancelEditDraft() {
    setMessage("");
    resetFormToNewDraft();
  }

  // =========================================================
  // Create / update draft
  // =========================================================
  async function handleCreateOrUpdateDraft() {
    setError("");
    setMessage("");

    // Basic validation
    if (!customer) return setError("Please select a Customer.");
    if (!company) return setError("Please select a Company.");

    const posting = toYMD(postingDate) || todayStr;
    const due = posting;

    // Convert qty/rate to numbers for validation
    const normalizedRows = rows.map((r) => ({
      ...r,
      qtyNum: r.qty === "" ? NaN : Number(r.qty),
      rateNum: r.rate === "" ? NaN : Number(r.rate),
    }));

    const hasNegative = normalizedRows.some(
      (r) => (!isNaN(r.qtyNum) && r.qtyNum < 0) || (!isNaN(r.rateNum) && r.rateNum < 0)
    );
    if (hasNegative) return setError("Qty/Rate cannot be negative.");

    const validRows = normalizedRows.filter((r) => r.item_code && !isNaN(r.qtyNum) && r.qtyNum > 0);
    if (!validRows.length) return setError("Add at least one line with item and positive qty.");

    try {
      setSavingDraft(true);

      // Build Sales Invoice Items (negative qty because it's a return)
      const items = validRows.map((r) => {
        const targetWh = getWarehouseForQuality(r.quality);

        const base = {
          item_code: r.item_code,
          qty: -Math.abs(r.qtyNum),
          rate: isNaN(r.rateNum) ? 0 : r.rateNum,
          warehouse: targetWh,
        };

        // When editing, include child row 'name' so ERP updates that row instead of creating new
        if (editingDraftName && r._rowName) return { ...base, name: r._rowName };
        return base;
      });

      const baseFields = {
        is_return: 1,
        update_stock: 1,
        posting_date: posting,
        due_date: due,
        company,
        customer,
        items,
        remarks: "Sales return created from custom screen (good/damaged → fixed warehouses).",
      };

      if (editingDraftName) {
        // When updating, we also need to delete removed child rows (ERPNext pattern)
        let old;
        try {
          old = await getDoc("Sales Invoice", editingDraftName);
        } catch {
          old = null;
        }

        const oldNames = new Set((old?.items || []).map((x) => x.name).filter(Boolean));
        const newNames = new Set(items.map((x) => x.name).filter(Boolean));

        const deletes = [];
        oldNames.forEach((nm) => {
          if (!newNames.has(nm)) deletes.push({ doctype: "Sales Invoice Item", name: nm, __delete: 1 });
        });

        await updateDoc("Sales Invoice", editingDraftName, {
          ...baseFields,
          items: [...items, ...deletes],
        });

        setMessage(
          `Draft updated: ${editingDraftName}. Now use "Create Sales Return" in the list to submit.`
        );
      } else {
        // Create a new draft Sales Invoice Return
        const siDoc = await createDoc("Sales Invoice", { doctype: "Sales Invoice", ...baseFields });
        const siName = siDoc?.data?.name || siDoc?.message?.name || siDoc?.name || "";

        setMessage(
          `Draft Sales Return created: ${siName || "(name not returned)"}.
           Scroll down and click "Create Sales Return" in the list to submit.`
        );
      }

      resetFormToNewDraft();
      await reloadReturns();
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to save draft"
      );
    } finally {
      setSavingDraft(false);
    }
  }

  // =========================================================
  // Submit a draft (docstatus -> 1)
  // =========================================================
  async function handleSubmitDraftReturn(name) {
    if (!name) return;

    setError("");
    setMessage("");
    setSubmittingDraft(name);

    try {
      await submitDoc("Sales Invoice", name);
      setMessage(`Sales Return submitted: ${name}`);
      await reloadReturns();

      // If user was editing this same draft, reset the form
      if (editingDraftName === name) resetFormToNewDraft();
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to submit Sales Return"
      );
    } finally {
      setSubmittingDraft("");
    }
  }

  // =========================================================
  // Enrich list rows with total qty + good/damaged breakdown
  // =========================================================
  useEffect(() => {
    const names = (sortedDisplayReturns || []).map((x) => x.name).filter(Boolean);
    if (!names.length) return;

    // Only fetch docs we haven't summarized yet
    const need = names.filter((nm) => !qtyByReturnName[nm]);
    if (!need.length) return;

    (async () => {
      const next = { ...qtyByReturnName };

      // Summarize a Sales Invoice return doc into qty totals
      const summarizeDoc = (doc) => {
        let totalQty = 0;
        let goodQty = 0;
        let damagedQty = 0;
        const uoms = new Set();

        const its = Array.isArray(doc?.items) ? doc.items : [];
        its.forEach((it) => {
          const q = Math.abs(Number(it.qty || 0)) || 0;
          totalQty += q;

          const wh = it.warehouse || GOOD_WH;
          if (wh === DAMAGED_WH) damagedQty += q;
          else goodQty += q;

          const u = (it.uom || it.stock_uom || "").trim();
          if (u) uoms.add(u);
        });

        // If multiple UOMs present, show "Mixed"
        const uomLabel = uoms.size === 1 ? Array.from(uoms)[0] : uoms.size > 1 ? "Mixed" : "";
        return { totalQty, goodQty, damagedQty, uomLabel };
      };

      // Fetch docs in parallel with a concurrency limit
      await mapLimit(need, 5, async (nm) => {
        try {
          const doc = await getDoc("Sales Invoice", nm);
          next[nm] = summarizeDoc(doc);
        } catch {
          next[nm] = { totalQty: 0, goodQty: 0, damagedQty: 0, uomLabel: "" };
        }
      });

      setQtyByReturnName(next);
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedDisplayReturns]);

  // =========================================================
  // Render
  // =========================================================
  return (
    <div className="sales-return">
      {/* Page header */}
      <div className="sales-return-header">
        <div className="sales-return-title-block">
          <h2 className="sales-return-title" style={{fontSize: "1.08rem" ,
    fontWeight: 650}}>Sales Returns (with Stock Update)</h2>
        </div>

        {/*<div className="sales-return-header-pill">
          {displayReturns.length} return{displayReturns.length !== 1 ? "s" : ""}
        </div>*/}
      </div>

      {/* Status messages */}
      {loadingMaster && (
        <div className="sales-return-loading text-muted">Loading customers, companies & items...</div>
      )}
      {error && <div className="alert alert-error sales-return-error">{error}</div>}
      {message && <div className="alert alert-success sales-return-message">{message}</div>}

      {/* Create/edit form */}
      <SalesReturnForm
        editingDraftName={editingDraftName}
        customers={customers}
        companies={companies}
        itemsCatalog={itemsCatalog}
        customer={customer}
        setCustomer={setCustomer}
        company={company}
        setCompany={setCompany}
        postingDate={postingDate}
        setPostingDate={setPostingDate}
        rows={rows}
        addRow={addRow}
        removeRow={removeRow}
        handleRowChange={handleRowChange}
        savingDraft={savingDraft}
        loadingMaster={loadingMaster}
        handleCreateOrUpdateDraft={handleCreateOrUpdateDraft}
        cancelEditDraft={cancelEditDraft}
      />

      {/* Recent returns list */}
      <SalesReturnRecentList
        listLimit={LIST_LIMIT}
        postingDateSortLabel={postingDateSortLabel}
        setPostingDateSort={setPostingDateSort}
        reloadReturns={reloadReturns}
        loadingReturns={loadingReturns}
        displayReturns={displayReturns}
        sortedDisplayReturns={sortedDisplayReturns}
        visibleTotalQty={visibleTotalQty}
        qtyByReturnName={qtyByReturnName}
        submittingDraft={submittingDraft}
        editDraftLoading={editDraftLoading}
        editingDraftName={editingDraftName}
        handleEditDraft={handleEditDraft}
        handleSubmitDraftReturn={handleSubmitDraftReturn}
      />
    </div>
  );
}
