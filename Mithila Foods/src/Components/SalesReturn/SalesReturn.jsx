// src/SalesReturn.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  getFinishedItemsForSales,
  getCustomers,
  getCompanies,
} from "../api/master";
import {
  getDoctypeList,
  createDoc,
  submitDoc,
  getDoc,
  updateDoc,
  mapLimit,
} from "../api/core";
import {
  getRecentSalesReturns,
} from "../api/sales";
import {
  getItemRateFromPriceList,
} from "../api/stock";
import { useOrg } from "../Context/OrgContext";

import SalesReturnForm from "./SalesReturnForm";
import SalesReturnRecentList from "./SalesReturnRecentList";

function getWarehouseForBrand(brandName) {
  const b = String(brandName || "").trim().toLowerCase();
  if (b.includes("prepto")) return "Finished Goods Prepto - MF";
  if (b.includes("howrah")) return "Finished Goods Howrah - MF";
  if (b.includes("mithila")) return "Finished Goods Mithila - MF";
  return "Finished Goods - MF"; // default fallback
}

const DAMAGED_WH = "Damaged - MF";
const DEFAULT_SELLING_PRICE_LIST = "Standard Selling";
const LIST_LIMIT = 10;
const DEFAULT_COMPANY = "F2D TECH PRIVATE LIMITED";

function toSortTs(v) {
  if (!v) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  const isoLike = s.includes(" ") ? s.replace(" ", "T") : s;
  const d = new Date(isoLike);
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
}

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
  const { orgs, activeOrg, changeOrg } = useOrg();

  const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

  const [customers, setCustomers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [itemsCatalog, setItemsCatalog] = useState([]);

  const [customer, setCustomer] = useState("");
  const [company, setCompany] = useState("");
  const [postingDate, setPostingDate] = useState(todayStr);

  const [manualBrand, setManualBrand] = useState(activeOrg === "F2D TECH PRIVATE LIMITED" ? "Prepto" : activeOrg);
  const [invoiceCustomerFilter, setInvoiceCustomerFilter] = useState("");
  const [rows, setRows] = useState([createEmptyRow(0)]);

  const [editingDraftName, setEditingDraftName] = useState("");
  const [editDraftLoading, setEditDraftLoading] = useState("");

  const [returns, setReturns] = useState([]);
  const [draftReturns, setDraftReturns] = useState([]);
  const [loadingReturns, setLoadingReturns] = useState(false);

  const [loadingMaster, setLoadingMaster] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submittingDraft, setSubmittingDraft] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [postingDateSort, setPostingDateSort] = useState("desc");
  const postingDateSortLabel =
    postingDateSort === "asc" ? "Posting Date: Oldest → Newest" : "Posting Date: Newest → Oldest";

  const [qtyByReturnName, setQtyByReturnName] = useState({});

  const brandFilteredItems = useMemo(() => {
    if (!activeOrg || activeOrg === "F2D TECH PRIVATE LIMITED") return itemsCatalog;
    return itemsCatalog.filter(it => it.brand === activeOrg);
  }, [itemsCatalog, activeOrg]);

  const displayReturns = useMemo(() => {
    let drafts = (draftReturns || []).map((d) => ({ ...d, __isDraft: true }));
    let submitted = (returns || []).map((r) => ({ ...r, __isDraft: false }));
    let combined = [...drafts, ...submitted];

    // Apply customer filter
    if (invoiceCustomerFilter) {
      combined = combined.filter((r) => r.customer === invoiceCustomerFilter);
    }

    if (activeOrg && activeOrg !== "F2D TECH PRIVATE LIMITED") {
      combined = combined.filter((r) => {
        const meta = qtyByReturnName[r.name];
        if (!meta) return true; // keep visible while it's still loading the details
        return meta.brands && meta.brands.has(activeOrg);
      });
    }

    return combined.slice(0, LIST_LIMIT);
  }, [draftReturns, returns, invoiceCustomerFilter, activeOrg, qtyByReturnName]);
  const sortedDisplayReturns = useMemo(() => {
    const dirMul = postingDateSort === "asc" ? 1 : -1;

    return [...(displayReturns || [])].sort((a, b) => {
      const ta = toSortTs(a?.posting_date);
      const tb = toSortTs(b?.posting_date);
      if (ta !== tb) return (ta - tb) * dirMul;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });
  }, [displayReturns, postingDateSort]);

  const visibleTotalQty = useMemo(() => {
    let sum = 0;
    sortedDisplayReturns.forEach((r) => {
      const q = qtyByReturnName?.[r.name]?.totalQty;
      if (Number.isFinite(q)) sum += q;
    });
    return sum;
  }, [sortedDisplayReturns, qtyByReturnName]);

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

        if (!company) {
          const ok = (compData || []).some((c) => c.name === DEFAULT_COMPANY);
          setCompany(ok ? DEFAULT_COMPANY : compData?.[0]?.name || "");
        }
        if (!customer && (custData || []).length > 0) setCustomer(custData[0].name);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load data for Sales Returns");
      } finally {
        setLoadingMaster(false);
      }
    }

    load();
  }, []);

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
          if (r.item_code !== itemCode) return r;
          return { ...r, rate: String(rateNum) };
        })
      );
    } catch {
    }
  }

  function handleRowChange(id, field, value) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (field === "item_code") {
          const changed = r.item_code !== value;
          return { ...r, item_code: value, ...(changed ? { rate: "" } : {}) };
        }
        return { ...r, [field]: value };
      })
    );

    if (field === "item_code") {
      fetchAndSetSellingRate(id, value);
    }
  }

  function addRow() {
    setRows((prev) => [...prev, createEmptyRow(prev.length ? prev[prev.length - 1].id + 1 : 0)]);
  }

  function removeRow(id) {
    setRows((prev) => {
      const filtered = prev.filter((r) => r.id !== id);
      return filtered.length ? filtered : [createEmptyRow(0)];
    });
  }

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

  function resetFormToNewDraft() {
    setEditingDraftName("");
    setPostingDate(todayStr);
    setRows([createEmptyRow(0)]);
  }

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

      if (its.length > 0) {
        const matchedItem = itemsCatalog.find(i => i.name === its[0].item_code);
        if (matchedItem && matchedItem.brand) {
          setManualBrand(matchedItem.brand);
        }
      }

      const mapped =
        its.length > 0
          ? its.map((it, idx) => {
            const quality = it.warehouse === DAMAGED_WH ? "damaged" : "good";
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

  async function handleCreateOrUpdateDraft() {
    setError("");
    setMessage("");

    if (!customer) return setError("Please select a Customer.");
    if (!company) return setError("Please select a Company.");

    const posting = toYMD(postingDate) || todayStr;
    const due = posting;

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

      const items = validRows.map((r) => {
        const targetWh = r.quality === "damaged" ? DAMAGED_WH : getWarehouseForBrand(activeOrg);
        const base = {
          item_code: r.item_code,
          qty: -Math.abs(r.qtyNum),
          rate: isNaN(r.rateNum) ? 0 : r.rateNum,
          warehouse: targetWh,
        };

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
        remarks: "Sales return created from custom screen.",
      };

      if (editingDraftName) {
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

        setMessage(`Draft updated: ${editingDraftName}. Now use "Create Sales Return" in the list to submit.`);
      } else {
        const siDoc = await createDoc("Sales Invoice", { doctype: "Sales Invoice", ...baseFields });
        const siName = siDoc?.data?.name || siDoc?.message?.name || siDoc?.name || "";

        setMessage(`Draft Sales Return created: ${siName || "(name not returned)"}. Scroll down and click "Create Sales Return" in the list to submit.`);
      }

      resetFormToNewDraft();
      await reloadReturns();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.error?.message || err?.response?.data?.error || err?.message || "Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSubmitDraftReturn(name) {
    if (!name) return;
    setError("");
    setMessage("");
    setSubmittingDraft(name);

    try {
      await submitDoc("Sales Invoice", name);
      setMessage(`Sales Return submitted: ${name}`);
      await reloadReturns();
      if (editingDraftName === name) resetFormToNewDraft();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.error?.message || err?.response?.data?.error || err?.message || "Failed to submit Sales Return");
    } finally {
      setSubmittingDraft("");
    }
  }

  // ENRICH WITH BRANDS
  useEffect(() => {
    const names = (sortedDisplayReturns || []).map((x) => x.name).filter(Boolean);
    if (!names.length) return;

    const need = names.filter((nm) => !qtyByReturnName[nm]);
    if (!need.length) return;

    (async () => {
      const next = { ...qtyByReturnName };

      const summarizeDoc = (doc) => {
        let totalQty = 0;
        let goodQty = 0;
        let damagedQty = 0;
        const uoms = new Set();
        const docBrands = new Set();

        const its = Array.isArray(doc?.items) ? doc.items : [];
        its.forEach((it) => {
          const q = Math.abs(Number(it.qty || 0)) || 0;
          totalQty += q;

          const wh = it.warehouse || getWarehouseForBrand(activeOrg); if (wh === DAMAGED_WH) damagedQty += q;
          else goodQty += q;

          const u = (it.uom || it.stock_uom || "").trim();
          if (u) uoms.add(u);

          // Get brand from item catalog
          const matchedItem = itemsCatalog.find(c => c.name === it.item_code);
          if (matchedItem && matchedItem.brand) docBrands.add(matchedItem.brand);
        });

        const uomLabel = uoms.size === 1 ? Array.from(uoms)[0] : uoms.size > 1 ? "Mixed" : "";
        return { totalQty, goodQty, damagedQty, uomLabel, brands: docBrands };
      };

      await mapLimit(need, 5, async (nm) => {
        try {
          const doc = await getDoc("Sales Invoice", nm);
          next[nm] = summarizeDoc(doc);
        } catch {
          next[nm] = { totalQty: 0, goodQty: 0, damagedQty: 0, uomLabel: "", brands: new Set() };
        }
      });

      setQtyByReturnName(next);
    })();
  }, [sortedDisplayReturns, itemsCatalog]);

  return (
    <div className="sales-return">
      <div className="sales-return-header">
        <div className="sales-return-title-block">
          <h2 className="sales-return-title" style={{ fontSize: "1.08rem", fontWeight: 650 }}>
            Sales Returns (with Stock Update)
          </h2>
        </div>
      </div>

      {loadingMaster && <div className="sales-return-loading text-muted">Loading customers, companies & items...</div>}
      {error && <div className="alert alert-error sales-return-error">{error}</div>}
      {message && <div className="alert alert-success sales-return-message">{message}</div>}

      <SalesReturnForm
        editingDraftName={editingDraftName}
        customers={customers}
        companies={companies}
        brandFilteredItems={brandFilteredItems}
        orgs={orgs}
        activeOrg={activeOrg}
        changeOrg={changeOrg}
        getWarehouseForBrand={getWarehouseForBrand}
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

      <SalesReturnRecentList
        listLimit={LIST_LIMIT}
        customers={customers}
        orgs={orgs}
        activeOrg={activeOrg}
        changeOrg={changeOrg}
        invoiceCustomerFilter={invoiceCustomerFilter}
        setInvoiceCustomerFilter={setInvoiceCustomerFilter}
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