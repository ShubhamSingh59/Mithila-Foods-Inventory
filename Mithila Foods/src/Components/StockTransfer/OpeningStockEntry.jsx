// src/Components/OpeningStockEntry.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  // ✅ Must include: name, item_name, stock_uom, item_group, valuation_rate (if you want the fallback)
  getItemsForBOM,
  getPriceLists,
  getItemRateFromPriceList,
  getItemWarehouseValuationRate,
  getCompanies,
  createDoc,
  submitDoc,
} from "../erpBackendApi";
import "./OpeningStockEntry.css";

/**
 * Opening Stock Entry
 * -------------------
 * This screen creates Opening Stock using a single Stock Reconciliation document.
 *
 * There are 2 ways:
 * 1) Manual Entry (table rows)  -> select item, auto-picks warehouse + price list, auto-fills rate
 * 2) Bulk Upload (CSV/TSV/XLSX) -> parse file, validate items, auto-pick warehouse & rate if missing
 *
 * Final output:
 * - Creates "Stock Reconciliation" with purpose = "Opening Stock"
 * - Submits it
 */

const RAW_WH = "Raw Material - MF";
const FINISHED_WH = "Finished Goods - MF";

// ✅ Use a NON-group child account here in ERPNext
const DEFAULT_DIFFERENCE_ACCOUNT = "Temporary Opening - MF";

// Price List display names you want to use
const PL_SELLING = "Standard Selling";
const PL_BUYING = "Standard Buying";

/** Create one empty manual row */
function createEmptyRow(id) {
  return {
    id,
    item_code: "",
    item_group: "",
    warehouse: RAW_WH, // auto switches to Finished for Product items
    uom: "",
    qty: "",
    price_list: "", // auto switches Selling/Buying
    rate: "",
    loadingRate: false,
    rowError: "",
  };
}

/** Decide if item_group belongs to finished goods */
function isFinishedGroup(itemGroup) {
  const g = String(itemGroup || "").trim().toLowerCase();
  return g === "product" || g === "products" || g.includes("finished") || g.includes("product");
}

/**
 * Find the exact Price List name from master list.
 * - User gives "Standard Selling" (display), ERP may have name variations.
 * - We match by `name` OR `price_list_name` (both are common in ERPNext responses).
 */
function pickPriceListName(target, priceLists) {
  const t = String(target || "").trim().toLowerCase();
  const found = (priceLists || []).find(
    (pl) =>
      String(pl.name || "").toLowerCase() === t ||
      String(pl.price_list_name || "").toLowerCase() === t
  );
  return found?.name || target || "";
}

/* ============================================================
   BULK HELPERS (CSV/TSV/XLSX)
   ============================================================ */

/** normalize a header to stable keys like "item-code", "valuation-rate", etc. */
function normalizeKey(k) {
  return String(k ?? "")
    .replace(/\uFEFF/g, "") // remove BOM marker
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/_+/g, "-");
}

/** looser compare: remove everything except [a-z0-9] */
function looseKey(k) {
  return String(k || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * pickFirstSmart
 * - tries alias keys directly
 * - then tries "loose match" (ignores punctuation/spaces/underscores)
 */
function pickFirstSmart(row, aliases) {
  if (!row) return "";

  // 1) direct match
  for (const k of aliases || []) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }

  // 2) loose match
  const map = new Map();
  Object.keys(row).forEach((k) => map.set(looseKey(k), k));

  for (const k of aliases || []) {
    const realKey = map.get(looseKey(k));
    if (!realKey) continue;
    const v = row[realKey];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }

  return "";
}

/**
 * Minimal CSV/TSV parser (supports quotes).
 * - auto-detects delimiter by comparing comma vs tab count on first line.
 */
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

/** Accept multiple header spellings in bulk files */
const BULK_COL = {
  itemCode: ["item-code", "item_code", "item", "item-id", "itemid", "item-name", "itemname", "code"],
  qty: ["qty", "quantity", "opening-qty", "opening-stock", "stock", "count"],
  warehouse: ["warehouse", "wh", "location", "store", "godown"],
  rate: ["rate", "valuation-rate", "valuation_rate", "valuation", "unit-rate", "unit-price", "price"],
};

/**
 * parseAnyFile(file)
 * - .xlsx/.xls -> uses xlsx library (dynamic import)
 * - else -> reads as text and parses CSV/TSV
 */
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

  const text = await file.text();
  return parseDelimited(text);
}

/**
 * runWithLimit
 * Concurrency limiter for bulk auto-rate fetch.
 * Prevents spamming ERPNext with hundreds of parallel calls.
 */
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

/* ============================================================
   SEARCHABLE ITEM DROPDOWN (same style as other screens)
   ============================================================ */
function ItemSearchDropdown({ items, value, onSelect, placeholder, className = "" }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  const selected = useMemo(
    () => items.find((x) => x.name === value) || null,
    [items, value]
  );

  const filtered = useMemo(() => {
    const s = (q || "").trim().toLowerCase();
    const base = !s
      ? items
      : items.filter((it) => {
          const code = (it.name || "").toLowerCase();
          const name = (it.item_name || "").toLowerCase();
          return code.includes(s) || name.includes(s);
        });

    return base.slice(0, 80); // keep it snappy
  }, [items, q]);

  // Close on outside click
  useEffect(() => {
    function onDown(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className={`stdrop ${className}`} ref={ref}>
      <button
        type="button"
        className={`stdrop-control ${open ? "is-open" : ""} opening-stock-item-input`}
        onClick={() =>
          setOpen((v) => {
            const next = !v;
            if (next) setQ(""); // ✅ show ALL on open
            return next;
          })
        }
      >
        <div className="stdrop-value">
          {selected ? (
            <>
              <div className="stdrop-title">{selected.name}</div>
              <div className="stdrop-sub">
                {selected.item_name || ""}{" "}
                {selected.stock_uom ? `· ${selected.stock_uom}` : ""}
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
                  {it.item_name || ""}{" "}
                  {it.stock_uom ? `· ${it.stock_uom}` : ""}
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

function OpeningStockEntry() {
  // Master data
  const [items, setItems] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [companies, setCompanies] = useState([]);

  // Header fields
  const [company, setCompany] = useState("");
  const [postingDate, setPostingDate] = useState(
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10)
  );

  // Manual rows
  const [rows, setRows] = useState([createEmptyRow(0)]);

  // UI status
  const [loadingInit, setLoadingInit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Tabs: Manual / Bulk
  const [activeTab, setActiveTab] = useState("manual"); // "manual" | "bulk"

  // Bulk state
  const fileRef = useRef(null);
  const [bulkParsing, setBulkParsing] = useState(false);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkParseError, setBulkParseError] = useState("");
  const [bulkLines, setBulkLines] = useState([]); // parsed lines (validated)
  const [bulkResults, setBulkResults] = useState([]); // results after create
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  /** Quick lookup: item_code -> item object */
  const itemByCode = useMemo(() => {
    const m = new Map();
    (items || []).forEach((it) => {
      if (it?.name) m.set(it.name, it);
    });
    return m;
  }, [items]);

  /* ---------------------------
     Initial load of master data
     --------------------------- */
  useEffect(() => {
    async function init() {
      setLoadingInit(true);
      setError("");
      try {
        const [itemData, plData, companyData] = await Promise.all([
          getItemsForBOM(),
          getPriceLists(),
          getCompanies(),
        ]);

        setItems(itemData || []);
        setPriceLists(plData || []);
        setCompanies(companyData || []);

        if (companyData && companyData.length > 0) setCompany(companyData[0].name);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load items / price lists / companies");
      } finally {
        setLoadingInit(false);
      }
    }
    init();
  }, []);

  /* ============================================================
     MANUAL MODE HELPERS
     ============================================================ */

  function addRow() {
    setRows((prev) => [
      ...prev,
      createEmptyRow(prev.length ? prev[prev.length - 1].id + 1 : 0),
    ]);
  }

  function removeRow(rowId) {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== rowId);
      // Keep at least one empty row
      return next.length ? next : [createEmptyRow(0)];
    });
  }

  function handleRowFieldChange(rowId, field, value) {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, [field]: value, rowError: "" } : r))
    );
  }

  /**
   * fetchRateForRow
   * Rate auto-fill order:
   * 1) Price List rate (Item Price)
   * 2) Item valuation_rate (if present)
   * 3) Bin valuation_rate per warehouse (fallback)
   */
  async function fetchRateForRow(row) {
    if (!row.item_code) return row;

    const item = items.find((it) => it.name === row.item_code);
    const updated = { ...row, loadingRate: true, rowError: "" };

    try {
      const finished = isFinishedGroup(item?.item_group || row.item_group);
      const targetPL = finished ? PL_SELLING : PL_BUYING;
      const pl = pickPriceListName(updated.price_list || targetPL, priceLists);

      updated.price_list = pl;

      // 1) Price List rate
      if (pl) {
        const priceRow = await getItemRateFromPriceList(updated.item_code, pl);
        const pr = Number(priceRow?.price_list_rate);

        if (Number.isFinite(pr) && pr > 0) {
          updated.rate = String(pr);
        } else {
          // 2) Item valuation_rate
          const vr = Number(item?.valuation_rate);
          if (Number.isFinite(vr) && vr > 0) {
            updated.rate = String(vr);
          } else {
            // 3) Bin valuation_rate by warehouse
            const wh = updated.warehouse || RAW_WH;
            const bin = await getItemWarehouseValuationRate(updated.item_code, wh);
            const br = Number(bin?.valuation_rate);
            if (Number.isFinite(br) && br > 0) updated.rate = String(br);
            else updated.rowError = "No rate in price list / valuation / bin";
          }
        }
      } else {
        updated.rowError = "Price list not found";
      }
    } catch (err) {
      console.error(err);
      updated.rowError = err.message || "Failed to fetch rate";
    }

    updated.loadingRate = false;
    return updated;
  }

  /**
   * handleRowItemChange
   * When user selects an item:
   * - sets UOM
   * - detects item_group -> picks warehouse (Raw/Finished)
   * - picks price list (Buying/Selling)
   * - fetches rate automatically
   */
  async function handleRowItemChange(rowId, itemCode) {
    const item = items.find((it) => it.name === itemCode);
    const uom = item?.stock_uom || item?.uom || item?.default_uom || "";
    const group = item?.item_group || "";

    const finished = isFinishedGroup(group);
    const nextWarehouse = finished ? FINISHED_WH : RAW_WH;
    const nextPL = pickPriceListName(finished ? PL_SELLING : PL_BUYING, priceLists);

    let targetRow = null;

    // Update row quickly (UI), then fetch rate
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;

        const updated = {
          ...r,
          item_code: itemCode,
          item_group: group,
          uom,
          warehouse: nextWarehouse,
          price_list: nextPL,
          rate: "", // reset (we will refetch)
          rowError: "",
        };

        targetRow = updated;
        return updated;
      })
    );

    if (!targetRow) return;

    const updated = await fetchRateForRow(targetRow);
    setRows((prev) => prev.map((r) => (r.id === rowId ? updated : r)));
  }

  async function handleRefreshRate(rowId) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const updated = await fetchRateForRow(row);
    setRows((prev) => prev.map((r) => (r.id === rowId ? updated : r)));
  }

  /**
   * Manual submit:
   * - Builds Stock Reconciliation (Opening Stock)
   * - Submits it
   */
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!company) return setError("Company is required.");
    if (!postingDate) return setError("Posting date is required.");

    const validRows = rows.filter(
      (r) =>
        r.item_code &&
        r.warehouse &&
        !isNaN(parseFloat(r.qty)) &&
        parseFloat(r.qty) >= 0
    );

    if (!validRows.length) return setError("Add at least one row with item and quantity.");

    const itemsPayload = validRows.map((r) => ({
      item_code: r.item_code,
      warehouse: r.warehouse,
      qty: parseFloat(r.qty),
      valuation_rate: r.rate ? parseFloat(r.rate) : undefined,
    }));

    const payload = {
      doctype: "Stock Reconciliation",
      purpose: "Opening Stock",
      company,
      posting_date: postingDate,
      expense_account: DEFAULT_DIFFERENCE_ACCOUNT,
      is_opening: "Yes",
      items: itemsPayload,
    };

    try {
      setSaving(true);
      const doc = await createDoc("Stock Reconciliation", payload);
      const name = doc.data?.name;

      if (name) {
        await submitDoc("Stock Reconciliation", name);
        setMessage(`Opening Stock created via Stock Reconciliation: ${name}`);
      } else {
        setMessage("Stock Reconciliation created (no name returned).");
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          "Failed to create/submit Stock Reconciliation"
      );
    } finally {
      setSaving(false);
    }
  }

  /* ============================================================
     BULK MODE HELPERS
     ============================================================ */

  function clearBulkFile() {
    if (fileRef.current) fileRef.current.value = "";
  }

  function resetBulk() {
    setBulkParseError("");
    setBulkLines([]);
    setBulkResults([]);
    setBulkProgress({ done: 0, total: 0 });
    clearBulkFile();
  }

  /**
   * Bulk file upload flow:
   * - Parse file to JSON rows
   * - Validate (item exists + qty valid)
   * - Auto-pick warehouse if missing (Finished for product items else Raw)
   * - Store parsed lines into bulkLines
   */
  async function handleBulkFilePicked(e) {
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
        const rowNo = idx + 2; // row 1 is header in CSV

        const item_code = String(pickFirstSmart(r, BULK_COL.itemCode) || "").trim();
        const qtyRaw = pickFirstSmart(r, BULK_COL.qty);
        const whRaw = String(pickFirstSmart(r, BULK_COL.warehouse) || "").trim();
        const rateRaw = pickFirstSmart(r, BULK_COL.rate);

        const qty = qtyRaw === "" || qtyRaw == null ? NaN : parseFloat(qtyRaw);
        const rateNum =
          String(rateRaw ?? "").trim() !== "" && !isNaN(parseFloat(rateRaw))
            ? parseFloat(rateRaw)
            : undefined;

        if (!item_code) {
          errs.push(`Row ${rowNo}: missing item_code`);
          return;
        }

        const item = itemByCode.get(item_code);
        if (!item) {
          errs.push(
            `Row ${rowNo}: invalid item_code (not found in Item master): ${item_code}`
          );
          return;
        }

        if (!Number.isFinite(qty) || qty < 0) {
          errs.push(`Row ${rowNo}: missing/invalid qty (must be number >= 0)`);
          return;
        }

        // Warehouse = file value OR auto from item_group
        let warehouse = whRaw;
        if (!warehouse) {
          const finished = isFinishedGroup(item?.item_group);
          warehouse = finished ? FINISHED_WH : RAW_WH;
        }

        lines.push({
          rowNo,
          item_code,
          item_group: item?.item_group || "",
          warehouse,
          qty,
          rate: rateNum, // optional
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

  /**
   * Bulk create:
   * - auto-fill missing rates using same logic as manual (price list -> item valuation -> bin)
   * - build ONE Stock Reconciliation document for all lines
   * - submit
   * - show per-line results table
   */
  async function handleBulkCreateOpeningStock() {
    setError("");
    setMessage("");
    setBulkResults([]);

    if (!company) return setError("Company is required.");
    if (!postingDate) return setError("Posting date is required.");
    if (!bulkLines.length) return setError("No parsed lines. Upload a file first.");

    setBulkCreating(true);

    try {
      // We only show progress for lines missing rate
      const needRateTotal = bulkLines.filter(
        (l) => !(Number.isFinite(l.rate) && l.rate > 0)
      ).length;

      setBulkProgress({ done: 0, total: needRateTotal || 0 });

      const enriched = await runWithLimit(
        bulkLines,
        4,
        async (l) => {
          // If file gave rate, keep it
          if (Number.isFinite(l.rate) && l.rate > 0) return { ...l, _rateNote: "" };

          const finished = isFinishedGroup(l.item_group);
          const targetPL = finished ? PL_SELLING : PL_BUYING;
          const pl = pickPriceListName(targetPL, priceLists);

          // "fake row" so we can reuse fetchRateForRow()
          const tmp = {
            item_code: l.item_code,
            item_group: l.item_group,
            warehouse: l.warehouse,
            price_list: pl,
            rate: "",
            loadingRate: false,
            rowError: "",
          };

          const updated = await fetchRateForRow(tmp);
          const rnum = parseFloat(updated.rate);
          const ok = Number.isFinite(rnum) && rnum > 0;

          return {
            ...l,
            rate: ok ? rnum : undefined,
            _rateNote: ok ? "" : updated.rowError || "Rate not found",
          };
        },
        (done) => {
          if (needRateTotal > 0) setBulkProgress({ done, total: needRateTotal });
        }
      );

      // Build Stock Reconciliation payload
      const itemsPayload = enriched.map((r) => ({
        item_code: r.item_code,
        warehouse: r.warehouse,
        qty: Number(r.qty),
        valuation_rate: Number.isFinite(r.rate) && r.rate > 0 ? Number(r.rate) : undefined,
      }));

      const payload = {
        doctype: "Stock Reconciliation",
        purpose: "Opening Stock",
        company,
        posting_date: postingDate,
        expense_account: DEFAULT_DIFFERENCE_ACCOUNT,
        is_opening: "Yes",
        items: itemsPayload,
      };

      const created = await createDoc("Stock Reconciliation", payload);
      const name = created?.data?.name;
      if (!name) throw new Error("Stock Reconciliation created but name not returned.");

      await submitDoc("Stock Reconciliation", name);

      // Build per-line results for UI
      const results = enriched.map((r) => ({
        rowNo: r.rowNo,
        item_code: r.item_code,
        warehouse: r.warehouse,
        qty: r.qty,
        rate: r.rate,
        status: "OK",
        sr_name: name,
        message: r._rateNote ? `Created (but rate missing: ${r._rateNote})` : "Created & submitted",
      }));

      setBulkResults(results);
      setMessage(`Bulk Opening Stock created via Stock Reconciliation: ${name}`);
      clearBulkFile();
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.error ||
        err.message ||
        "Bulk create failed";

      setError(msg);

      // Show failed results (so user can see what got attempted)
      if (bulkLines.length) {
        setBulkResults(
          bulkLines.map((r) => ({
            rowNo: r.rowNo,
            item_code: r.item_code,
            warehouse: r.warehouse,
            qty: r.qty,
            rate: r.rate,
            status: "FAILED",
            sr_name: "",
            message: msg,
          }))
        );
      }
    } finally {
      setBulkCreating(false);
      setBulkProgress({ done: 0, total: 0 });
    }
  }

  /* ============================================================
     UI
     ============================================================ */
  return (
    <div className="opening-stock">
      {/* Page header */}
      <div className="opening-stock-header-row">
        <div className="opening-stock-header">
          <h2 className="opening-stock-title">Opening Stock Entry</h2>
          <p className="opening-stock-subtitle">
            Create opening stock using Stock Reconciliation (per item)
          </p>
        </div>

        <div className="opening-stock-pill">
          {activeTab === "manual" ? "Manual" : "Bulk"} • {company || "No company"}
        </div>
      </div>

      {/* Tabs */}
      <div className="opening-stock-tabs">
        <button
          type="button"
          className={`opening-stock-tab ${activeTab === "manual" ? "is-active" : ""}`}
          onClick={() => setActiveTab("manual")}
        >
          Manual Entry
        </button>

        <button
          type="button"
          className={`opening-stock-tab ${activeTab === "bulk" ? "is-active" : ""}`}
          onClick={() => setActiveTab("bulk")}
        >
          Bulk Upload
        </button>
      </div>

      {/* Top-level messages */}
      {loadingInit && (
        <p className="text-muted opening-stock-loading">Loading items, price lists...</p>
      )}
      {error && <p className="alert alert-error">{error}</p>}
      {message && <p className="alert alert-success">{message}</p>}

      {/* ============================================================
         MANUAL TAB
         ============================================================ */}
      {activeTab === "manual" && (
        <form onSubmit={handleSubmit} className="opening-stock-form">
          {/* Company + Posting Date */}
          <div className="opening-stock-top-grid">
            <div className="field-group">
              <label className="form-label">Company</label>
              <select
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="select"
                disabled={saving || loadingInit}
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

            <div className="field-group">
              <label className="form-label">Posting Date</label>
              <input
                type="date"
                value={postingDate}
                onChange={(e) => setPostingDate(e.target.value)}
                className="input"
                disabled={saving || loadingInit}
              />
            </div>
          </div>

          {/* Rows header */}
          <div className="opening-stock-rows-header">
            <h3 className="opening-stock-rows-title">Items</h3>
            <button
              type="button"
              onClick={addRow}
              className="btn btn-accent btn-sm"
              disabled={saving || loadingInit}
            >
              + Add Item
            </button>
          </div>

          {/* Manual table */}
          <div className="table-container opening-stock-table-wrapper">
            <table className="table opening-stock-table opening-stock-table-manual">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Warehouse</th>
                  <th>Unit</th>
                  <th>Qty</th>
                  <th>Price List</th>
                  <th>Rate</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    {/* Item dropdown */}
                    <td>
                      <ItemSearchDropdown
                        items={items}
                        value={row.item_code}
                        onSelect={(code) => handleRowItemChange(row.id, code)}
                        placeholder="Search item name / code..."
                      />
                    </td>

                    {/* Warehouse is auto-picked (read-only) */}
                    <td>
                      <span className="text-muted">{row.warehouse || RAW_WH}</span>
                    </td>

                    {/* UOM from item */}
                    <td>{row.uom || "—"}</td>

                    {/* Qty */}
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={row.qty}
                        onChange={(e) => handleRowFieldChange(row.id, "qty", e.target.value)}
                        className="input"
                        disabled={saving || loadingInit}
                      />
                    </td>

                    {/* Price list auto-picked */}
                    <td>
                      <span className="text-muted">{row.price_list || "—"}</span>
                    </td>

                    {/* Rate + Auto button */}
                    <td>
                      <div className="opening-stock-rate-cell">
                        <input
                          value={row.loadingRate ? "Loading..." : row.rate}
                          onChange={(e) => handleRowFieldChange(row.id, "rate", e.target.value)}
                          className="input"
                          disabled={saving || loadingInit}
                        />
                        <button
                          type="button"
                          className="btn btn-outline btn-sm opening-stock-rate-btn"
                          onClick={() => handleRefreshRate(row.id)}
                          disabled={!row.item_code || row.loadingRate || saving || loadingInit}
                        >
                          Auto
                        </button>
                      </div>

                      {row.rowError && <div className="opening-stock-row-error">{row.rowError}</div>}
                    </td>

                    {/* Remove row */}
                    <td>
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="btn btn-ghost btn-sm"
                        disabled={saving || loadingInit}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Submit */}
          <div className="opening-stock-submit-row">
            <button type="submit" disabled={saving || loadingInit} className="btn btn-primary">
              {saving ? "Saving..." : "Create Opening Stock"}
            </button>
          </div>
        </form>
      )}

      {/* ============================================================
         BULK TAB
         ============================================================ */}
      {activeTab === "bulk" && (
        <div className="opening-stock-bulk">
          {/* Bulk: same company/date controls */}
          <div className="opening-stock-top-grid" style={{ marginTop: 10 }}>
            <div className="field-group">
              <label className="form-label">Company</label>
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

            <div className="field-group">
              <label className="form-label">Posting Date</label>
              <input
                type="date"
                value={postingDate}
                onChange={(e) => setPostingDate(e.target.value)}
                className="input"
                disabled={bulkParsing || bulkCreating}
              />
            </div>
          </div>

          {/* Bulk header */}
          <div className="opening-stock-bulk-head">
            <h3 className="opening-stock-rows-title">Bulk Upload (Opening Stock)</h3>
            <button type="button" onClick={resetBulk} className="btn btn-secondary btn-sm">
              Clear
            </button>
          </div>

          {/* Bulk upload + actions */}
          <div className="opening-stock-bulk-grid">
            <div className="field-group">
              <label className="form-label">Upload file (.xlsx / .csv / .tsv)</label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.xls"
                className="input"
                onChange={handleBulkFilePicked}
                disabled={bulkParsing || bulkCreating}
              />

              <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
                Required columns: <b>item_code</b> and <b>qty</b>. Optional: <b>warehouse</b>,{" "}
                <b>rate</b>.
                <br />
                If warehouse is missing, it auto-picks: <b>{FINISHED_WH}</b> for Products, else{" "}
                <b>{RAW_WH}</b>.
              </div>
            </div>

            <div className="opening-stock-bulk-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleBulkCreateOpeningStock}
                disabled={bulkCreating || bulkParsing || !bulkLines.length}
              >
                {bulkCreating ? "Creating..." : "Create Opening Stock from File"}
              </button>

              <div className="text-muted" style={{ fontSize: 12 }}>
                Parsed lines: <b>{bulkLines.length}</b>
                {bulkCreating && bulkProgress.total > 0 ? (
                  <>
                    {" "}
                    | Rate Auto Progress: <b>{bulkProgress.done}/{bulkProgress.total}</b>
                  </>
                ) : null}
              </div>

              {bulkParseError ? (
                <div className="alert alert-error" style={{ marginTop: 10 }}>
                  {bulkParseError}
                </div>
              ) : null}
            </div>
          </div>

          {/* Bulk results table */}
          {bulkResults.length > 0 && (
            <div className="table-container opening-stock-table-wrapper" style={{ marginTop: 14 }}>
              <table className="table opening-stock-table opening-stock-table-bulk">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Item</th>
                    <th>Warehouse</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>Status</th>
                    <th>Stock Reco</th>
                    <th>Message</th>
                  </tr>
                </thead>

                <tbody>
                  {bulkResults.map((r, idx) => (
                    <tr key={`${r.rowNo}-${r.item_code}-${idx}`}>
                      <td>{r.rowNo}</td>
                      <td>{r.item_code}</td>
                      <td>{r.warehouse}</td>
                      <td>{r.qty}</td>
                      <td>{Number.isFinite(r.rate) ? r.rate : "-"}</td>
                      <td>
                        <span
                          className={
                            "opening-stock-status-pill " + (r.status === "OK" ? "ok" : "fail")
                          }
                        >
                          {r.status}
                        </span>
                      </td>
                      <td>{r.sr_name || "-"}</td>
                      <td style={{ maxWidth: 520, whiteSpace: "pre-wrap" }}>{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default OpeningStockEntry;
