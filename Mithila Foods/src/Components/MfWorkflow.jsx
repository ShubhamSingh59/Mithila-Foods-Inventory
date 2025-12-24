//// src/Components/MfWorkflow.jsx
//import React, { useEffect, useMemo, useRef, useState } from "react";
//import "../CSS/mfWorkflowTheme.css";
//import {
//  getCompanies,
//  getDoctypeList,
//  getDoc,
//  createDoc,
//  submitDoc,
//  getBinForItemWarehouse,
//  getBoms,
//  getBomDocWithItems,
//  getFinishedItems,
//  getItemsForBOM,
//  mapLimit,
//  listMfFlowStockEntries,
//  getMfFlowWipBalances,
//} from "./erpBackendApi";

//import { makeFlowId, makeFlowTag, RAW_WH, WIP_WH, FG_WH, WASTAGE_WH } from "./mfFlowConfig";

//const FLOW_KEY = "mf_flow_id_v1";

//// ------------------------------------------------------------
//// Small dropdown reused
//function SimpleSelect({ label, children }) {
//  return (
//    <div className="stock-mfg-field-group">
//      <label className="form-label stock-mfg-field-label">{label}</label>
//      {children}
//    </div>
//  );
//}

//// ---------- Tracker helpers: show "item (qty UOM)" (no totals) ----------
//function safeUom(x) {
//  const u = (x || "").trim();
//  return u || "UOM";
//}

//function aggLinesByItemUom(lines) {
//  const byItemUom = new Map(); // key: item||uom -> qty

//  (lines || []).forEach((l) => {
//    const item = (l.item_code || "").trim();
//    const uom = safeUom(l.uom || l.stock_uom);
//    const qty = Number(l.qty) || 0;
//    if (!item || !qty) return;

//    const k = `${item}||${uom}`;
//    byItemUom.set(k, (byItemUom.get(k) || 0) + qty);
//  });

//  return Array.from(byItemUom.entries())
//    .map(([k, qty]) => {
//      const [item_code, uom] = k.split("||");
//      return { item_code, uom, qty };
//    })
//    .sort((a, b) => (a.item_code + a.uom).localeCompare(b.item_code + b.uom));
//}

//function fmtUsed(lines, limit = 20) {
//  const rows = aggLinesByItemUom(lines);
//  if (!rows.length) return "-";

//  const head = rows
//    .slice(0, limit)
//    .map((r) => `${r.item_code} (${Number(r.qty).toFixed(3)} ${r.uom})`)
//    .join(" | ");

//  const more = rows.length > limit ? ` | +${rows.length - limit} more` : "";
//  return head + more;
//}

//function parseForMfg(remarks = "") {
//  const m = String(remarks).match(/\bFOR\s+([^\s|]+)/i);
//  return m?.[1] || "";
//}

//function onlyDateFromDoc(doc) {
//  const pd = (doc?.posting_date || "").trim();
//  if (pd) return pd;

//  const m = String(doc?.modified || doc?.creation || "").trim();
//  return m ? m.slice(0, 10) : "";
//}

//// ------------------------------------------------------------
//// Reusable searchable dropdown with ✕ clear (same file, no new file)
//function MfItemSearchDropdown({
//  items = [],
//  value = "",
//  onSelect,
//  placeholder = "Search...",
//  disabled = false,
//  maxResults = 80,
//}) {
//  const [open, setOpen] = useState(false);
//  const [q, setQ] = useState("");
//  const ref = useRef(null);

//  const selected = useMemo(() => {
//    return (items || []).find((x) => x?.name === value) || null;
//  }, [items, value]);

//  const filtered = useMemo(() => {
//    const s = (q || "").trim().toLowerCase();
//    const base = !s
//      ? (items || [])
//      : (items || []).filter((it) => {
//          const code = (it?.name || "").toLowerCase();
//          const nm = (it?.item_name || "").toLowerCase();
//          const uom = (it?.stock_uom || "").toLowerCase();
//          return code.includes(s) || nm.includes(s) || uom.includes(s);
//        });

//    return base.slice(0, maxResults);
//  }, [items, q, maxResults]);

//  useEffect(() => {
//    function onDown(e) {
//      if (!ref.current) return;
//      if (!ref.current.contains(e.target)) setOpen(false);
//    }
//    document.addEventListener("mousedown", onDown);
//    return () => document.removeEventListener("mousedown", onDown);
//  }, []);

//  const clearSelection = (e) => {
//    e?.stopPropagation?.();
//    if (disabled) return;
//    onSelect?.("");
//    setOpen(false);
//    setQ("");
//  };

//  return (
//    <div className="stdrop" ref={ref}>
//      <button
//        type="button"
//        className={`stdrop-control ${open ? "is-open" : ""}`}
//        onClick={() => !disabled && setOpen((v) => !v)}
//        disabled={disabled}
//      >
//        <div className="stdrop-value">
//          {selected ? (
//            <>
//              <div className="stdrop-title">{selected.name}</div>
//              <div className="stdrop-sub">
//                {(selected.item_name || "") +
//                  (selected.stock_uom ? ` · ${selected.stock_uom}` : "")}
//              </div>
//            </>
//          ) : (
//            <div className="stdrop-placeholder">{placeholder}</div>
//          )}
//        </div>

//        <div className="stdrop-actions">
//          {!!value && !disabled && (
//            <span
//              className="stdrop-clear"
//              role="button"
//              tabIndex={0}
//              title="Clear"
//              onClick={clearSelection}
//              onKeyDown={(e) =>
//                (e.key === "Enter" || e.key === " ") && clearSelection(e)
//              }
//            >
//              ✕
//            </span>
//          )}
//          <div className="stdrop-caret">▾</div>
//        </div>
//      </button>

//      {open && !disabled && (
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
//            {!!value && (
//              <button
//                type="button"
//                className="stdrop-item stdrop-item-clear"
//                onClick={() => {
//                  onSelect?.("");
//                  setOpen(false);
//                  setQ("");
//                }}
//              >
//                <div className="stdrop-item-title">Clear selection</div>
//              </button>
//            )}

//            {filtered.map((it) => (
//              <button
//                key={it.name}
//                type="button"
//                className="stdrop-item"
//                onClick={() => {
//                  onSelect?.(it.name);
//                  setOpen(false);
//                  setQ("");
//                }}
//              >
//                <div className="stdrop-item-title">{it.name}</div>
//                <div className="stdrop-item-sub">
//                  {(it.item_name || "") +
//                    (it.stock_uom ? ` · ${it.stock_uom}` : "")}
//                </div>
//              </button>
//            ))}

//            {!filtered.length ? (
//              <div className="stdrop-empty">No items found.</div>
//            ) : (
//              <div className="stdrop-hint">Showing up to {maxResults} results</div>
//            )}
//          </div>
//        </div>
//      )}
//    </div>
//  );
//}

//// ------------------------------------------------------------
//// TAB 1: Issue Material (Raw -> WIP)
//function IssueToWipTab({ company, flowTag, onCreated }) {
//  const [items, setItems] = useState([]);
//  const [rows, setRows] = useState([{ id: 0, item_code: "", uom: "", current_qty: "", qty: "" }]);
//  const [loading, setLoading] = useState(false);
//  const [saving, setSaving] = useState(false);
//  const [msg, setMsg] = useState("");
//  const [err, setErr] = useState("");

//  useEffect(() => {
//    (async () => {
//      setLoading(true);
//      setErr("");
//      try {
//        const data = await getDoctypeList("Item", {
//          fields: JSON.stringify(["name", "item_name", "stock_uom", "disabled"]),
//          filters: JSON.stringify([["Item", "disabled", "=", 0]]),
//          limit_page_length: 5000,
//          order_by: "modified desc",
//        });
//        setItems(data || []);
//      } catch (e) {
//        setErr(e?.message || "Failed to load items");
//      } finally {
//        setLoading(false);
//      }
//    })();
//  }, []);

//  const itemMap = useMemo(() => {
//    const m = new Map();
//    (items || []).forEach((it) => m.set(it.name, it));
//    return m;
//  }, [items]);

//  async function refreshAvailable(rowId, itemCode) {
//    if (!itemCode) return;
//    try {
//      const bin = await getBinForItemWarehouse(itemCode, RAW_WH);
//      const qty = bin?.actual_qty != null ? String(bin.actual_qty) : "0";
//      setRows((p) => p.map((r) => (r.id === rowId ? { ...r, current_qty: qty } : r)));
//    } catch {
//      setRows((p) => p.map((r) => (r.id === rowId ? { ...r, current_qty: "" } : r)));
//    }
//  }

//  function addRow() {
//    setRows((p) => [...p, { id: Date.now(), item_code: "", uom: "", current_qty: "", qty: "" }]);
//  }
//  function removeRow(id) {
//    setRows((p) => p.filter((r) => r.id !== id));
//  }
//  function setRow(id, patch) {
//    setRows((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));
//  }

//  async function submit(e) {
//    e.preventDefault();
//    setErr("");
//    setMsg("");

//    if (!company) return setErr("Company is required.");

//    const valid = rows
//      .map((r) => ({ ...r, qtyNum: Number(r.qty) }))
//      .filter((r) => r.item_code && !isNaN(r.qtyNum) && r.qtyNum > 0);

//    if (!valid.length) return setErr("Add at least one item with qty.");

//    for (const r of valid) {
//      const avail = Number(r.current_qty);
//      if (!isNaN(avail) && avail >= 0 && r.qtyNum > avail) {
//        return setErr(`Qty cannot exceed available for ${r.item_code} (available ${avail}).`);
//      }
//    }

//    const payload = {
//      doctype: "Stock Entry",
//      stock_entry_type: "Material Transfer",
//      company,
//      custom_mf_track: 1,
//      remarks: `${flowTag} | ISSUE RAW->WIP`,
//      items: valid.map((r) => ({
//        item_code: r.item_code,
//        qty: r.qtyNum,
//        s_warehouse: RAW_WH,
//        t_warehouse: WIP_WH,
//      })),
//    };

//    try {
//      setSaving(true);
//      const created = await createDoc("Stock Entry", payload);
//      const name = created?.data?.name;
//      if (!name) throw new Error("Stock Entry not created (missing name)");
//      await submitDoc("Stock Entry", name);
//      setMsg(`Issued to WIP: ${name}`);
//      onCreated?.(name);
//    } catch (e2) {
//      setErr(e2?.response?.data?.error?.message || e2?.message || "Failed to issue material");
//    } finally {
//      setSaving(false);
//    }
//  }

//  return (
//    <div>
//      <h3>1) Issue Material (Raw → WIP)</h3>
//      <div className="text-muted">
//        From <b>{RAW_WH}</b> to <b>{WIP_WH}</b>
//      </div>

//      {loading && <div className="text-muted">Loading items...</div>}
//      {err && <div className="alert alert-error">{err}</div>}
//      {msg && <div className="alert alert-success">{msg}</div>}

//      <form onSubmit={submit}>
//        <div className="stock-transfer-rows">
//          {rows.map((r, idx) => (
//            <div key={r.id} className="stock-transfer-row-card">
//              <div className="stock-transfer-row-header">
//                <span className="stock-transfer-row-title">Line #{idx + 1}</span>
//                {rows.length > 1 && (
//                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeRow(r.id)}>
//                    Remove
//                  </button>
//                )}
//              </div>

//              <div className="stock-transfer-row-grid">
//                <div className="stock-transfer-row-field">
//                  <label className="form-label">Item</label>
//                  <MfItemSearchDropdown
//                    items={items}
//                    value={r.item_code}
//                    placeholder="Search item..."
//                    disabled={loading}
//                    onSelect={(code) => {
//                      if (!code) {
//                        setRow(r.id, { item_code: "", uom: "", current_qty: "" });
//                        return;
//                      }
//                      const it = itemMap.get(code);
//                      setRow(r.id, { item_code: code, uom: it?.stock_uom || "" });
//                      refreshAvailable(r.id, code);
//                    }}
//                  />
//                </div>

//                <div className="stock-transfer-row-field">
//                  <label className="form-label">UOM</label>
//                  <input className="input input-readonly" value={r.uom} readOnly />
//                </div>

//                <div className="stock-transfer-row-field">
//                  <label className="form-label">Available in Raw</label>
//                  <input className="input input-readonly" value={r.current_qty} readOnly />
//                </div>

//                <div className="stock-transfer-row-field">
//                  <label className="form-label">Issue Qty</label>
//                  <input
//                    className="input"
//                    type="number"
//                    min="0"
//                    value={r.qty}
//                    onChange={(e) => setRow(r.id, { qty: e.target.value })}
//                  />
//                </div>
//              </div>
//            </div>
//          ))}
//        </div>

//        <datalist id="mf-raw-item-list">
//          {(items || []).slice(0, 5000).map((it) => (
//            <option key={it.name} value={it.name} label={`${it.name} - ${it.item_name || ""}`} />
//          ))}
//        </datalist>

//        <div>
//          <button type="button" className="btn btn-accent btn-sm" onClick={addRow}>
//            + Add Item
//          </button>

//          <button type="submit" className="btn btn-primary" disabled={saving}>
//            {saving ? "Saving..." : "Submit Issue to WIP"}
//          </button>
//        </div>
//      </form>
//    </div>
//  );
//}

//// ------------------------------------------------------------
//// TAB 2: Manufacture (consume from WIP, produce to FG)
//function ManufactureFromWipTab({ company, flowTag, onCreated, onGoWaste, onGoReturn }) {
//  const [boms, setBoms] = useState([]);
//  const [finishedItems, setFinishedItems] = useState([]);
//  const [rawItems, setRawItems] = useState([]);

//  const [finishedItem, setFinishedItem] = useState("");
//  const [selectedBomName, setSelectedBomName] = useState("");
//  const [fgQty, setFgQty] = useState("1");

//  const [bomItemsBase, setBomItemsBase] = useState([]);
//  const [rows, setRows] = useState([]);

//  const [loading, setLoading] = useState(false);
//  const [saving, setSaving] = useState(false);
//  const [err, setErr] = useState("");
//  const [msg, setMsg] = useState("");

//  useEffect(() => {
//    (async () => {
//      setLoading(true);
//      setErr("");
//      try {
//        const [bomData, finishedItemData, rawItemData] = await Promise.all([
//          getBoms(),
//          getFinishedItems(),
//          getItemsForBOM(),
//        ]);
//        setBoms(bomData || []);
//        setFinishedItems(finishedItemData || []);
//        setRawItems(rawItemData || []);
//      } catch (e) {
//        setErr(e?.message || "Failed to load BOM / items");
//      } finally {
//        setLoading(false);
//      }
//    })();
//  }, []);

//  const filteredBoms = finishedItem ? boms.filter((b) => b.item === finishedItem) : [];

//  function scaleRowsFromBom(items, finishedQty, bomQty, manualRows = []) {
//    const fg = parseFloat(finishedQty);
//    const bq = parseFloat(bomQty);
//    const ratio = !isNaN(fg) && fg > 0 && !isNaN(bq) && bq > 0 ? fg / bq : 1;

//    const bomRows = items.map((it, idx) => ({
//      id: it.name || `bom-${idx}`,
//      item_code: it.item_code,
//      item_name: it.item_name,
//      uom: it.uom,
//      qty: ((parseFloat(it.qty) || 0) * ratio).toString(),
//      fromBom: true,
//    }));

//    return [...bomRows, ...manualRows];
//  }

//  async function loadBomDocAndRows(bomName, finishedQty, bomQty) {
//    setErr("");
//    setMsg("");
//    const bomDoc = await getBomDocWithItems(bomName);
//    const items = bomDoc.items || [];
//    const manualRows = rows.filter((r) => !r.fromBom);
//    setBomItemsBase(items);
//    setRows(scaleRowsFromBom(items, finishedQty, bomQty, manualRows));
//  }

//  async function handleFinishedItemChange(code) {
//    setFinishedItem(code);
//    setErr("");
//    setMsg("");

//    if (!code) {
//      setSelectedBomName("");
//      setRows((p) => p.filter((r) => !r.fromBom));
//      return;
//    }

//    const bomForItem = boms.find((b) => b.item === code);
//    if (!bomForItem) {
//      setSelectedBomName("");
//      setRows((p) => p.filter((r) => !r.fromBom));
//      return;
//    }

//    setSelectedBomName(bomForItem.name);
//    await loadBomDocAndRows(bomForItem.name, fgQty, bomForItem.quantity);
//  }

//  async function handleBomChange(name) {
//    setSelectedBomName(name);
//    setErr("");
//    setMsg("");
//    if (!name) return;

//    const bom = boms.find((b) => b.name === name);
//    if (!bom) return;

//    if (bom.item && bom.item !== finishedItem) setFinishedItem(bom.item);
//    await loadBomDocAndRows(bom.name, fgQty, bom.quantity);
//  }

//  function handleFgQtyChange(v) {
//    setFgQty(v);
//    setErr("");
//    setMsg("");
//    const bom = boms.find((b) => b.name === selectedBomName);
//    if (!bom) return;
//    const manualRows = rows.filter((r) => !r.fromBom);
//    setRows(scaleRowsFromBom(bomItemsBase, v, bom.quantity, manualRows));
//  }

//  function addManualRow() {
//    setRows((p) => [
//      ...p,
//      { id: `manual-${Date.now()}-${Math.random()}`, item_code: "", item_name: "", uom: "", qty: "", fromBom: false },
//    ]);
//  }

//  function removeRow(id) {
//    setRows((p) => p.filter((r) => r.id !== id));
//  }

//  function changeRowQty(id, qty) {
//    setRows((p) => p.map((r) => (r.id === id ? { ...r, qty } : r)));
//  }

//  function changeRowItem(id, code) {
//    const it = rawItems.find((x) => x.name === code);
//    setRows((p) =>
//      p.map((r) =>
//        r.id === id
//          ? { ...r, item_code: code, item_name: it?.item_name || "", uom: it?.stock_uom || "" }
//          : r
//      )
//    );
//  }

//  async function submit(e) {
//    e.preventDefault();
//    setErr("");
//    setMsg("");

//    if (!company) return setErr("Company is required.");
//    const bom = boms.find((b) => b.name === selectedBomName);
//    if (!bom) return setErr("Select a BOM.");

//    const fg = parseFloat(fgQty);
//    if (isNaN(fg) || fg <= 0) return setErr("Enter valid finished qty.");

//    const validRows = rows.filter((r) => r.item_code && !isNaN(parseFloat(r.qty)) && parseFloat(r.qty) > 0);
//    if (!validRows.length) return setErr("No raw rows with qty.");

//    const payload = {
//      doctype: "Stock Entry",
//      stock_entry_type: "Manufacture",
//      company,
//      custom_mf_track: 1,
//      bom_no: bom.name,
//      fg_completed_qty: fg,
//      remarks: `${flowTag} | MFG WIP->FG`,
//      items: [
//        ...validRows.map((r) => ({
//          item_code: r.item_code,
//          qty: parseFloat(r.qty),
//          s_warehouse: WIP_WH,
//        })),
//        {
//          item_code: bom.item,
//          qty: fg,
//          t_warehouse: FG_WH,
//          is_finished_item: 1,
//        },
//      ],
//    };

//    try {
//      setSaving(true);
//      const created = await createDoc("Stock Entry", payload);
//      const name = created?.data?.name;
//      if (!name) throw new Error("Stock Entry not created (missing name)");
//      await submitDoc("Stock Entry", name);
//      setMsg(`Manufactured: ${name}`);
//      onCreated?.(name);
//    } catch (e2) {
//      setErr(e2?.response?.data?.error?.message || e2?.message || "Failed to manufacture");
//    } finally {
//      setSaving(false);
//    }
//  }

//  return (
//    <div>
//      <h3>2) Manufacture (WIP → Finished)</h3>
//      <div className="text-muted">
//        Consume from <b>{WIP_WH}</b> and produce into <b>{FG_WH}</b>
//      </div>

//      {loading && <div className="text-muted">Loading...</div>}
//      {err && <div className="alert alert-error">{err}</div>}
//      {msg && <div className="alert alert-success">{msg}</div>}

//      <form onSubmit={submit} className="stock-mfg-form">
//        <div className="stock-mfg-form-grid">
//          <SimpleSelect label="Finished Item">
//            <MfItemSearchDropdown
//              items={finishedItems}
//              value={finishedItem}
//              placeholder="Search finished item..."
//              disabled={loading}
//              onSelect={(code) => {
//                handleFinishedItemChange(code || "");
//              }}
//            />
//          </SimpleSelect>

//          <SimpleSelect label="BOM / Material List">
//            <select
//              className="select"
//              value={selectedBomName}
//              onChange={(e) => handleBomChange(e.target.value)}
//              disabled={!finishedItem}
//            >
//              <option value="">-- select BOM --</option>
//              {filteredBoms.map((b, idx) => (
//                <option key={b.name} value={b.name}>
//                  Option {idx + 1}
//                </option>
//              ))}
//            </select>
//          </SimpleSelect>

//          <SimpleSelect label="Finished Qty">
//            <input
//              className="input"
//              type="number"
//              min="0"
//              value={fgQty}
//              onChange={(e) => handleFgQtyChange(e.target.value)}
//            />
//          </SimpleSelect>
//        </div>

//        <div>
//          <h4>Raw Materials (from WIP)</h4>
//          <button type="button" className="btn btn-accent btn-sm" onClick={addManualRow}>
//            + Add Raw Item
//          </button>
//        </div>

//        <datalist id="mf-wip-item-list">
//          {rawItems.map((it) => (
//            <option key={it.name} value={it.name} label={`${it.name} - ${it.item_name || ""}`} />
//          ))}
//        </datalist>

//        <div className="table-container">
//          <table className="table">
//            <thead>
//              <tr>
//                <th>Item</th>
//                <th>Name</th>
//                <th>UOM</th>
//                <th>Qty</th>
//                <th>Source</th>
//                <th />
//              </tr>
//            </thead>
//            <tbody>
//              {rows.map((r) => (
//                <tr key={r.id}>
//                  <td>
//                    {r.fromBom ? (
//                      r.item_code
//                    ) : (
//                      <input
//                        className="input"
//                        list="mf-wip-item-list"
//                        value={r.item_code}
//                        onChange={(e) => changeRowItem(r.id, e.target.value)}
//                        placeholder="Item code"
//                      />
//                    )}
//                  </td>
//                  <td>{r.item_name}</td>
//                  <td>{r.uom}</td>
//                  <td>
//                    <input
//                      className="input"
//                      type="number"
//                      min="0"
//                      value={r.qty}
//                      onChange={(e) => changeRowQty(r.id, e.target.value)}
//                    />
//                  </td>
//                  <td>{WIP_WH}</td>
//                  <td>
//                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeRow(r.id)}>
//                      Remove
//                    </button>
//                  </td>
//                </tr>
//              ))}
//              {!rows.length ? (
//                <tr>
//                  <td colSpan={6} className="text-muted">
//                    Select BOM to load items.
//                  </td>
//                </tr>
//              ) : null}
//            </tbody>
//          </table>
//        </div>

//        <div>
//          <button type="submit" className="btn btn-primary" disabled={saving}>
//            {saving ? "Saving..." : "Submit Manufacture"}
//          </button>

//          <button type="button" className="btn btn-accent" onClick={onGoWaste}>
//            Wastage Material
//          </button>
//          <button type="button" className="btn btn-accent" onClick={onGoReturn}>
//            Return Raw
//          </button>
//        </div>
//      </form>
//    </div>
//  );
//}

//// ------------------------------------------------------------
//// TAB 3/4: Wastage or Return (from WIP) linked to a Manufacture SE
//function WasteReturnTab({ mode, company, flowTag, defaultMfgSeName }) {
//  const targetWh = mode === "WASTE" ? WASTAGE_WH : RAW_WH;
//  const title = mode === "WASTE" ? "3) Wastage Material (WIP → Wastage)" : "4) Return Raw (WIP → Raw)";

//  function todayKolkataYmd() {
//    const parts = new Intl.DateTimeFormat("en-CA", {
//      timeZone: "Asia/Kolkata",
//      year: "numeric",
//      month: "2-digit",
//      day: "2-digit",
//    }).formatToParts(new Date());
//    const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
//    return `${m.year}-${m.month}-${m.day}`;
//  }

//  const dayFilter = useMemo(() => todayKolkataYmd(), []);

//  const [mfgEntries, setMfgEntries] = useState([]);
//  const [mfgSeName, setMfgSeName] = useState(defaultMfgSeName || "");
//  const [mfgLabelMap, setMfgLabelMap] = useState({});
//  const [balances, setBalances] = useState([]);
//  const [qtyMap, setQtyMap] = useState({});
//  const [loading, setLoading] = useState(false);
//  const [saving, setSaving] = useState(false);
//  const [msg, setMsg] = useState("");
//  const [err, setErr] = useState("");

//  function onlyDate(pd, modified) {
//    if (pd) return String(pd).slice(0, 10);
//    return modified ? String(modified).slice(0, 10) : "";
//  }

//  function getFinishedLabel(doc) {
//    const items = doc?.items || [];
//    const fin = items.find((it) => Number(it.is_finished_item) === 1);
//    if (!fin) return "Manufacture";
//    return `${fin.item_code}`;
//  }

//  async function load() {
//    setLoading(true);
//    setErr("");
//    setMsg("");
//    try {
//      const [allSes, b] = await Promise.all([
//        listMfFlowStockEntries({ flowTag, limit: 300 }),
//        getMfFlowWipBalances({ flowTag, wipWarehouse: WIP_WH }),
//      ]);

//      const mfgsAll = (allSes || []).filter(
//        (x) => x.docstatus === 1 && x.stock_entry_type === "Manufacture"
//      );

//      const mfgs = (mfgsAll || []).filter((x) => (x.posting_date || "") === dayFilter);

//      setMfgEntries(mfgs || []);

//      const newestToday = (mfgs || [])[0]?.name || "";
//      setMfgSeName((prev) => {
//        if (prev && (mfgs || []).some((x) => x.name === prev)) return prev;
//        if (defaultMfgSeName && (mfgs || []).some((x) => x.name === defaultMfgSeName)) return defaultMfgSeName;
//        return newestToday;
//      });

//      const mfgNames = (mfgs || []).map((x) => x.name).filter(Boolean);
//      const docs = await mapLimit(mfgNames, 6, (nm) => getDoc("Stock Entry", nm));

//      const labelMap = {};
//      docs.forEach((d) => {
//        const date = onlyDate(d.posting_date, d.modified);
//        labelMap[d.name] = `${getFinishedLabel(d)} (${date || "-"})`;
//      });
//      setMfgLabelMap(labelMap);

//      setBalances(b || []);
//      const next = {};
//      (b || []).forEach((x) => {
//        next[x.item_code] = "";
//      });
//      setQtyMap(next);
//    } catch (e) {
//      setErr(e?.message || "Failed to load data");
//    } finally {
//      setLoading(false);
//    }
//  }

//  useEffect(() => {
//    load();
//    // eslint-disable-next-line react-hooks/exhaustive-deps
//  }, [flowTag]);

//  function setQty(item, v) {
//    setQtyMap((p) => ({ ...p, [item]: v }));
//  }

//  async function submit() {
//    setErr("");
//    setMsg("");

//    if (!company) return setErr("Company is required.");
//    if (!mfgSeName) return setErr("Select a Manufacture for today.");

//    const rows = (balances || [])
//      .map((b) => {
//        const q = Number(qtyMap[b.item_code]);
//        return { item_code: b.item_code, remaining: Number(b.remaining_qty), qty: q };
//      })
//      .filter((r) => !isNaN(r.qty) && r.qty > 0);

//    if (!rows.length) return setErr("Enter at least one qty.");

//    for (const r of rows) {
//      if (r.qty > r.remaining) {
//        return setErr(`Qty cannot exceed remaining in WIP for ${r.item_code} (remaining ${r.remaining}).`);
//      }
//    }

//    const remark =
//      mode === "WASTE"
//        ? `${flowTag} | WASTE FOR ${mfgSeName}`
//        : `${flowTag} | RETURN FOR ${mfgSeName}`;

//    const payload = {
//      doctype: "Stock Entry",
//      stock_entry_type: "Material Transfer",
//      company,
//      custom_mf_track: 1,
//      remarks: remark,
//      items: rows.map((r) => ({
//        item_code: r.item_code,
//        qty: r.qty,
//        s_warehouse: WIP_WH,
//        t_warehouse: targetWh,
//      })),
//    };

//    try {
//      setSaving(true);
//      const created = await createDoc("Stock Entry", payload);
//      const name = created?.data?.name;
//      if (!name) throw new Error("Stock Entry not created (missing name)");
//      await submitDoc("Stock Entry", name);
//      setMsg(`Created: ${name}`);
//      await load();
//    } catch (e2) {
//      setErr(e2?.response?.data?.error?.message || e2?.message || "Failed");
//    } finally {
//      setSaving(false);
//    }
//  }

//  return (
//    <div>
//      <h3>{title}</h3>
//      <div className="text-muted">
//        From <b>{WIP_WH}</b> to <b>{targetWh}</b> (qty must be ≤ remaining)
//      </div>

//      <div className="text-muted">
//        Showing Manufacture entries for: <b>{dayFilter}</b>
//      </div>

//      {loading && <div className="text-muted">Loading...</div>}
//      {err && <div className="alert alert-error">{err}</div>}
//      {msg && <div className="alert alert-success">{msg}</div>}

//      <div className="stock-mfg-form-grid">
//        <SimpleSelect label="Link to Manufacture Entry">
//          <select className="select" value={mfgSeName} onChange={(e) => setMfgSeName(e.target.value)}>
//            <option value="">-- select manufacture (today) --</option>
//            {(mfgEntries || []).map((x) => (
//              <option key={x.name} value={x.name}>
//                {mfgLabelMap[x.name] || `Manufacture (${x.posting_date || "-"})`}
//              </option>
//            ))}
//          </select>
//        </SimpleSelect>

//        <div>
//          <button type="button" className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
//            Refresh
//          </button>
//        </div>
//      </div>

//      <div className="table-container">
//        <table className="table">
//          <thead>
//            <tr>
//              <th>Item</th>
//              <th>Remaining in WIP (this flow)</th>
//              <th>Transfer Qty</th>
//            </tr>
//          </thead>
//          <tbody>
//            {(balances || []).map((b) => (
//              <tr key={b.item_code}>
//                <td>{b.item_code}</td>
//                <td>{Number(b.remaining_qty).toFixed(3)}</td>
//                <td>
//                  <input
//                    className="input"
//                    type="number"
//                    min="0"
//                    value={qtyMap[b.item_code] ?? ""}
//                    onChange={(e) => setQty(b.item_code, e.target.value)}
//                  />
//                </td>
//              </tr>
//            ))}
//            {!balances.length && !loading ? (
//              <tr>
//                <td colSpan={3} className="text-muted">
//                  No remaining items in WIP for this flow.
//                </td>
//              </tr>
//            ) : null}
//          </tbody>
//        </table>
//      </div>

//      <div>
//        <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
//          {saving ? "Saving..." : "Submit"}
//        </button>
//      </div>
//    </div>
//  );
//}

//// ------------------------------------------------------------
//// TAB 5: Tracker (only process entries where custom_mf_track = 1)
//function TrackerTab() {
//  const [rows, setRows] = useState([]);
//  const [loading, setLoading] = useState(false);

//  async function load() {
//    setLoading(true);
//    try {
//      const list = await getDoctypeList("Stock Entry", {
//        fields: JSON.stringify([
//          "name",
//          "stock_entry_type",
//          "posting_date",
//          "posting_time",
//          "docstatus",
//          "remarks",
//          "modified",
//          "custom_mf_track",
//        ]),
//        filters: JSON.stringify([
//          ["Stock Entry", "docstatus", "=", 1],
//          ["Stock Entry", "custom_mf_track", "=", 1],
//        ]),
//        order_by: "posting_date desc, posting_time desc, modified desc",
//        limit_page_length: 500,
//      });

//      const names = (list || []).map((x) => x.name).filter(Boolean);
//      const docs = await mapLimit(names, 6, (nm) => getDoc("Stock Entry", nm));

//      const mfgDocs = (docs || []).filter((d) => d.stock_entry_type === "Manufacture");

//      const wasteByMfg = new Map();

//      (docs || []).forEach((d) => {
//        if (d.stock_entry_type === "Manufacture") return;

//        const r = String(d.remarks || "");
//        const mfg = parseForMfg(r);
//        if (!mfg) return;

//        const lines = (d.items || []).map((it) => ({
//          item_code: it.item_code,
//          qty: it.qty,
//          uom: it.uom || it.stock_uom,
//        }));

//        if (r.includes("WASTE FOR")) {
//          wasteByMfg.set(mfg, [...(wasteByMfg.get(mfg) || []), ...lines]);
//        }
//      });

//      const out = (mfgDocs || []).map((doc) => {
//        const items = doc.items || [];

//        const finished = items.find((it) => Number(it.is_finished_item) === 1);
//        const finishedUom = safeUom(finished?.uom || finished?.stock_uom);
//        const finishedText = finished
//          ? `${finished.item_code} (${Number(finished.qty || 0).toFixed(3)} ${finishedUom})`
//          : "-";

//        const rawLines = items
//          .filter((it) => it.s_warehouse === WIP_WH && Number(it.is_finished_item) !== 1)
//          .map((it) => ({
//            item_code: it.item_code,
//            qty: it.qty,
//            uom: it.uom || it.stock_uom,
//          }));

//        const wasteLines = (wasteByMfg.get(doc.name) || []).map((x) => ({
//          item_code: x.item_code,
//          qty: x.qty,
//          uom: x.uom || x.stock_uom,
//        }));

//        return {
//          mfgSe: doc.name,
//          item: finishedText,
//          rawUsed: fmtUsed(rawLines, 20),
//          wasteUsed: fmtUsed(wasteLines, 20),
//          date: onlyDateFromDoc(doc),
//        };
//      });

//      out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
//      setRows(out);
//    } finally {
//      setLoading(false);
//    }
//  }

//  useEffect(() => {
//    load();
//  }, []);

//  return (
//    <div>
//      <h3>5) Stock Tracker</h3>
//      <div className="text-muted">
//        Showing only entries where <b>custom_mf_track = 1</b>
//      </div>

//      <button type="button" className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
//        {loading ? "Loading..." : "Refresh"}
//      </button>

//      <div className="table-container">
//        <table className="table">
//          <thead>
//            <tr>
//              <th>ITEM</th>
//              <th>RAW Used (Qty + UOM)</th>
//              <th>Wastage (Qty + UOM)</th>
//              <th>DATE</th>
//            </tr>
//          </thead>
//          <tbody>
//            {(rows || []).map((r) => (
//              <tr key={r.mfgSe}>
//                <td>{r.item}</td>
//                <td>{r.rawUsed}</td>
//                <td>{r.wasteUsed}</td>
//                <td>{r.date || "-"}</td>
//              </tr>
//            ))}
//            {!rows.length ? (
//              <tr>
//                <td colSpan={4} className="text-muted">
//                  No Manufacture entries yet.
//                </td>
//              </tr>
//            ) : null}
//          </tbody>
//        </table>
//      </div>
//    </div>
//  );
//}

//// ------------------------------------------------------------
//// MAIN
//export default function MfWorkflow() {
//  const [companies, setCompanies] = useState([]);
//  const [company, setCompany] = useState("");

//  const [flowId, setFlowId] = useState(() => {
//    const saved = localStorage.getItem(FLOW_KEY);
//    return saved || makeFlowId();
//  });

//  useEffect(() => {
//    localStorage.setItem(FLOW_KEY, flowId);
//  }, [flowId]);

//  const flowTag = useMemo(() => makeFlowTag(flowId), [flowId]);
//  const [lastMfgSe, setLastMfgSe] = useState("");

//  const TABS = {
//    ISSUE: "ISSUE",
//    MFG: "MFG",
//    WASTE: "WASTE",
//    RETURN: "RETURN",
//    TRACK: "TRACK",
//  };
//  const [tab, setTab] = useState(TABS.ISSUE);

//  useEffect(() => {
//    (async () => {
//      const cs = await getCompanies();
//      setCompanies(cs || []);
//      if ((cs || []).length) setCompany(cs[0].name);
//    })();
//  }, []);

//  function startNewFlow() {
//    const id = makeFlowId();
//    setFlowId(id);
//    setLastMfgSe("");
//    setTab(TABS.ISSUE);
//  }

//  return (
//    <div>
//      <div className="stock-mfg-header">
//        <div className="stock-mfg-title-block">
//          <h2 className="stock-mfg-title">MF Workflow (Raw → WIP → FG)</h2>
//          <p className="stock-mfg-subtitle">
//            Current flow tag: <b>{flowTag}</b> (custom_mf_track saved as <b>1</b>)
//          </p>
//        </div>

//        <div>
//          <button type="button" className="btn btn-ghost btn-sm" onClick={startNewFlow}>
//            Start New Flow
//          </button>
//        </div>
//      </div>

//      <div className="stock-mfg-form-grid">
//        <SimpleSelect label="Company">
//          <select className="select" value={company} onChange={(e) => setCompany(e.target.value)}>
//            <option value="">-- select company --</option>
//            {companies.map((c) => (
//              <option key={c.name} value={c.name}>
//                {c.company_name || c.name} {c.abbr ? `(${c.abbr})` : ""}
//              </option>
//            ))}
//          </select>
//        </SimpleSelect>
//      </div>

//      <div className="mfg-tabs">
//        <button type="button" className={`mfg-tab ${tab === TABS.ISSUE ? "active" : ""}`} onClick={() => setTab(TABS.ISSUE)}>
//          Issue Material
//        </button>
//        <button type="button" className={`mfg-tab ${tab === TABS.MFG ? "active" : ""}`} onClick={() => setTab(TABS.MFG)}>
//          Manufacture
//        </button>
//        <button type="button" className={`mfg-tab ${tab === TABS.WASTE ? "active" : ""}`} onClick={() => setTab(TABS.WASTE)}>
//          Wastage
//        </button>
//        <button type="button" className={`mfg-tab ${tab === TABS.RETURN ? "active" : ""}`} onClick={() => setTab(TABS.RETURN)}>
//          Return Raw
//        </button>
//        <button type="button" className={`mfg-tab ${tab === TABS.TRACK ? "active" : ""}`} onClick={() => setTab(TABS.TRACK)}>
//          Tracker
//        </button>
//      </div>

//      {tab === TABS.ISSUE && <IssueToWipTab company={company} flowTag={flowTag} onCreated={() => {}} />}

//      {tab === TABS.MFG && (
//        <ManufactureFromWipTab
//          company={company}
//          flowTag={flowTag}
//          onCreated={(seName) => setLastMfgSe(seName)}
//          onGoWaste={() => setTab(TABS.WASTE)}
//          onGoReturn={() => setTab(TABS.RETURN)}
//        />
//      )}

//      {tab === TABS.WASTE && (
//        <WasteReturnTab mode="WASTE" company={company} flowTag={flowTag} defaultMfgSeName={lastMfgSe} />
//      )}

//      {tab === TABS.RETURN && (
//        <WasteReturnTab mode="RETURN" company={company} flowTag={flowTag} defaultMfgSeName={lastMfgSe} />
//      )}

//      {tab === TABS.TRACK && <TrackerTab />}
//    </div>
//  );
//}
// src/Components/MfWorkflow.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "../CSS/mfWorkflowTheme.css";
import {
  getCompanies,
  getDoctypeList,
  getDoc,
  createDoc,
  submitDoc,
  getBinForItemWarehouse,
  getBoms,
  getBomDocWithItems,
  getFinishedItems,
  getItemsForBOM,
  mapLimit,
  listMfFlowStockEntries,
  getMfFlowWipBalances,
} from "./erpBackendApi";

import { makeFlowId, makeFlowTag, RAW_WH, WIP_WH, FG_WH, WASTAGE_WH } from "./mfFlowConfig";

const FLOW_KEY = "mf_flow_id_v1";

// ------------------------------------------------------------
// Small dropdown reused
function SimpleSelect({ label, children }) {
  return (
    <div className="stock-mfg-field-group">
      <label className="form-label stock-mfg-field-label">{label}</label>
      {children}
    </div>
  );
}

// ---------- Tracker helpers: show "item (qty UOM)" (no totals) ----------
function safeUom(x) {
  const u = (x || "").trim();
  return u || "UOM";
}

function aggLinesByItemUom(lines) {
  const byItemUom = new Map(); // key: item||uom -> qty

  (lines || []).forEach((l) => {
    const item = (l.item_code || "").trim();
    const uom = safeUom(l.uom || l.stock_uom);
    const qty = Number(l.qty) || 0;
    if (!item || !qty) return;

    const k = `${item}||${uom}`;
    byItemUom.set(k, (byItemUom.get(k) || 0) + qty);
  });

  return Array.from(byItemUom.entries())
    .map(([k, qty]) => {
      const [item_code, uom] = k.split("||");
      return { item_code, uom, qty };
    })
    .sort((a, b) => (a.item_code + a.uom).localeCompare(b.item_code + b.uom));
}

function fmtUsed(lines, limit = 20) {
  const rows = aggLinesByItemUom(lines);
  if (!rows.length) return "-";

  const head = rows
    .slice(0, limit)
    .map((r) => `${r.item_code} (${Number(r.qty).toFixed(3)} ${r.uom})`)
    .join(" | ");

  const more = rows.length > limit ? ` | +${rows.length - limit} more` : "";
  return head + more;
}

function parseForMfg(remarks = "") {
  const m = String(remarks).match(/\bFOR\s+([^\s|]+)/i);
  return m?.[1] || "";
}

function onlyDateFromDoc(doc) {
  const pd = (doc?.posting_date || "").trim();
  if (pd) return pd;

  const m = String(doc?.modified || doc?.creation || "").trim();
  return m ? m.slice(0, 10) : "";
}

// ------------------------------------------------------------
// Reusable searchable dropdown with ✕ clear (same file, no new file)
function MfItemSearchDropdown({
  items = [],
  value = "",
  onSelect,
  placeholder = "Search...",
  disabled = false,
  maxResults = 80,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  const selected = useMemo(() => {
    return (items || []).find((x) => x?.name === value) || null;
  }, [items, value]);

  const filtered = useMemo(() => {
    const s = (q || "").trim().toLowerCase();
    const base = !s
      ? (items || [])
      : (items || []).filter((it) => {
          const code = (it?.name || "").toLowerCase();
          const nm = (it?.item_name || "").toLowerCase();
          const uom = (it?.stock_uom || "").toLowerCase();
          return code.includes(s) || nm.includes(s) || uom.includes(s);
        });

    return base.slice(0, maxResults);
  }, [items, q, maxResults]);

  useEffect(() => {
    function onDown(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const clearSelection = (e) => {
    e?.stopPropagation?.();
    if (disabled) return;
    onSelect?.("");
    setOpen(false);
    setQ("");
  };

  return (
    <div className="stdrop" ref={ref}>
      <button
        type="button"
        className={`stdrop-control ${open ? "is-open" : ""}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
      >
        <div className="stdrop-value">
          {selected ? (
            <>
              <div className="stdrop-title">{selected.name}</div>
              <div className="stdrop-sub">
                {(selected.item_name || "") + (selected.stock_uom ? ` · ${selected.stock_uom}` : "")}
              </div>
            </>
          ) : (
            <div className="stdrop-placeholder">{placeholder}</div>
          )}
        </div>

        <div className="stdrop-actions">
          {!!value && !disabled && (
            <span
              className="stdrop-clear"
              role="button"
              tabIndex={0}
              title="Clear"
              onClick={clearSelection}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && clearSelection(e)}
            >
              ✕
            </span>
          )}
          <div className="stdrop-caret">▾</div>
        </div>
      </button>

      {open && !disabled && (
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
            {!!value && (
              <button
                type="button"
                className="stdrop-item stdrop-item-clear"
                onClick={() => {
                  onSelect?.("");
                  setOpen(false);
                  setQ("");
                }}
              >
                <div className="stdrop-item-title">Clear selection</div>
              </button>
            )}

            {filtered.map((it) => (
              <button
                key={it.name}
                type="button"
                className="stdrop-item"
                onClick={() => {
                  onSelect?.(it.name);
                  setOpen(false);
                  setQ("");
                }}
              >
                <div className="stdrop-item-title">{it.name}</div>
                <div className="stdrop-item-sub">
                  {(it.item_name || "") + (it.stock_uom ? ` · ${it.stock_uom}` : "")}
                </div>
              </button>
            ))}

            {!filtered.length ? (
              <div className="stdrop-empty">No items found.</div>
            ) : (
              <div className="stdrop-hint">Showing up to {maxResults} results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// TAB 0: WIP Warehouse Stock (Item + Qty in WIP warehouse)
function WipWarehouseStockTab() {
  const [rows, setRows] = useState([]); // { item_code, item_name, stock_uom, actual_qty }
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [hideZero, setHideZero] = useState(true);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      // 1) Load Bin rows for WIP warehouse
      const pageSize = 2000;
      let start = 0;
      const all = [];

      while (true) {
        const filters = [["Bin", "warehouse", "=", WIP_WH]];
        if (hideZero) filters.push(["Bin", "actual_qty", ">", 0]);

        const part = await getDoctypeList("Bin", {
          fields: JSON.stringify(["item_code", "warehouse", "actual_qty"]),
          filters: JSON.stringify(filters),
          limit_page_length: pageSize,
          limit_start: start,
          order_by: "actual_qty desc",
        });

        all.push(...(part || []));
        if (!part || part.length < pageSize) break;
        start += pageSize;
        if (start > 200000) break;
      }

      const bins = (all || [])
        .filter((b) => b?.item_code && String(b.warehouse || "") === WIP_WH)
        .map((b) => ({
          item_code: b.item_code,
          actual_qty: Number(b.actual_qty || 0),
        }))
        .sort((a, b) => (b.actual_qty || 0) - (a.actual_qty || 0) || a.item_code.localeCompare(b.item_code));

      // 2) Fetch Item name + uom only for items present in bins (chunked)
      const codes = Array.from(new Set(bins.map((b) => b.item_code))).filter(Boolean);

      const chunk = (arr, n) => {
        const out = [];
        for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
        return out;
      };

      const itemMap = new Map();
      const chunks = chunk(codes, 200);

      const itemLists = await mapLimit(chunks, 6, async (ck) => {
        const part = await getDoctypeList("Item", {
          fields: JSON.stringify(["name", "item_name", "stock_uom", "disabled"]),
          filters: JSON.stringify([
            ["Item", "name", "in", ck],
            ["Item", "disabled", "=", 0],
          ]),
          limit_page_length: 200,
        });
        return part || [];
      });

      (itemLists || []).flat().forEach((it) => {
        if (!it?.name) return;
        itemMap.set(it.name, { item_name: it.item_name || "", stock_uom: it.stock_uom || "" });
      });

      const merged = bins.map((b) => ({
        item_code: b.item_code,
        item_name: itemMap.get(b.item_code)?.item_name || "",
        stock_uom: itemMap.get(b.item_code)?.stock_uom || "",
        actual_qty: b.actual_qty,
      }));

      setRows(merged);
    } catch (e) {
      setErr(e?.message || "Failed to load WIP stock");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideZero]);

  const filtered = useMemo(() => {
    const s = (q || "").trim().toLowerCase();
    if (!s) return rows;
    return (rows || []).filter((r) => {
      const code = String(r.item_code || "").toLowerCase();
      const nm = String(r.item_name || "").toLowerCase();
      const u = String(r.stock_uom || "").toLowerCase();
      return code.includes(s) || nm.includes(s) || u.includes(s);
    });
  }, [rows, q]);

  const totalItems = filtered.length;
  const totalQty = filtered.reduce((sum, r) => sum + (Number(r.actual_qty) || 0), 0);

  return (
    <div>
      <h3>WIP Stock (Warehouse Balance)</h3>
      <div className="text-muted">
        Warehouse: <b>{WIP_WH}</b> (shows Bin.actual_qty)
      </div>

      {err && <div className="alert alert-error">{err}</div>}

      <div className="stock-mfg-form-grid" style={{ alignItems: "end" }}>
        <div className="stock-mfg-field-group">
          <label className="form-label stock-mfg-field-label">Search</label>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Item / name / UOM" />
        </div>

        <div className="stock-mfg-field-group">
          <label className="form-label stock-mfg-field-label">Options</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />
              Hide zero qty
            </label>

            <button type="button" className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      <div className="text-muted" style={{ marginTop: 6 }}>
        Items: <b>{totalItems}</b> · Total Qty: <b>{totalQty.toFixed(3)}</b>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Name</th>
              <th>Unit</th>
              <th>Qty in WIP</th>
            </tr>
          </thead>
          <tbody>
            {(filtered || []).map((r) => (
              <tr key={r.item_code}>
                <td>{r.item_code}</td>
                <td>{r.item_name || "-"}</td>
                <td>{r.stock_uom || "-"}</td>
                <td>{Number(r.actual_qty || 0).toFixed(3)}</td>
              </tr>
            ))}
            {!filtered.length && !loading ? (
              <tr>
                <td colSpan={4} className="text-muted">
                  No items found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// TAB 1: Issue Material (Raw -> WIP)
function IssueToWipTab({ company, flowTag, onCreated }) {
  const [items, setItems] = useState([]);
  const [rows, setRows] = useState([{ id: 0, item_code: "", uom: "", current_qty: "", qty: "" }]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const data = await getDoctypeList("Item", {
          fields: JSON.stringify(["name", "item_name", "stock_uom", "disabled"]),
          filters: JSON.stringify([["Item", "disabled", "=", 0]]),
          limit_page_length: 5000,
          order_by: "modified desc",
        });
        setItems(data || []);
      } catch (e) {
        setErr(e?.message || "Failed to load items");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const itemMap = useMemo(() => {
    const m = new Map();
    (items || []).forEach((it) => m.set(it.name, it));
    return m;
  }, [items]);

  async function refreshAvailable(rowId, itemCode) {
    if (!itemCode) return;
    try {
      const bin = await getBinForItemWarehouse(itemCode, RAW_WH);
      const qty = bin?.actual_qty != null ? String(bin.actual_qty) : "0";
      setRows((p) => p.map((r) => (r.id === rowId ? { ...r, current_qty: qty } : r)));
    } catch {
      setRows((p) => p.map((r) => (r.id === rowId ? { ...r, current_qty: "" } : r)));
    }
  }

  function addRow() {
    setRows((p) => [...p, { id: Date.now(), item_code: "", uom: "", current_qty: "", qty: "" }]);
  }
  function removeRow(id) {
    setRows((p) => p.filter((r) => r.id !== id));
  }
  function setRow(id, patch) {
    setRows((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!company) return setErr("Company is required.");

    const valid = rows
      .map((r) => ({ ...r, qtyNum: Number(r.qty) }))
      .filter((r) => r.item_code && !isNaN(r.qtyNum) && r.qtyNum > 0);

    if (!valid.length) return setErr("Add at least one item with qty.");

    for (const r of valid) {
      const avail = Number(r.current_qty);
      if (!isNaN(avail) && avail >= 0 && r.qtyNum > avail) {
        return setErr(`Qty cannot exceed available for ${r.item_code} (available ${avail}).`);
      }
    }

    const payload = {
      doctype: "Stock Entry",
      stock_entry_type: "Material Transfer",
      company,
      custom_mf_track: 1,
      remarks: `${flowTag} | ISSUE RAW->WIP`,
      items: valid.map((r) => ({
        item_code: r.item_code,
        qty: r.qtyNum,
        s_warehouse: RAW_WH,
        t_warehouse: WIP_WH,
      })),
    };

    try {
      setSaving(true);
      const created = await createDoc("Stock Entry", payload);
      const name = created?.data?.name;
      if (!name) throw new Error("Stock Entry not created (missing name)");
      await submitDoc("Stock Entry", name);
      setMsg(`Issued to WIP: ${name}`);
      onCreated?.(name);
    } catch (e2) {
      setErr(e2?.response?.data?.error?.message || e2?.message || "Failed to issue material");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h3>1) Issue Material (Raw → WIP)</h3>
      <div className="text-muted">
        From <b>{RAW_WH}</b> to <b>{WIP_WH}</b>
      </div>

      {loading && <div className="text-muted">Loading items...</div>}
      {err && <div className="alert alert-error">{err}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}

      <form onSubmit={submit}>
        <div className="stock-transfer-rows">
          {rows.map((r, idx) => (
            <div key={r.id} className="stock-transfer-row-card">
              <div className="stock-transfer-row-header">
                <span className="stock-transfer-row-title">Line #{idx + 1}</span>
                {rows.length > 1 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeRow(r.id)}>
                    Remove
                  </button>
                )}
              </div>

              <div className="stock-transfer-row-grid">
                <div className="stock-transfer-row-field">
                  <label className="form-label">Item</label>
                  <MfItemSearchDropdown
                    items={items}
                    value={r.item_code}
                    placeholder="Search item..."
                    disabled={loading}
                    onSelect={(code) => {
                      if (!code) {
                        setRow(r.id, { item_code: "", uom: "", current_qty: "" });
                        return;
                      }
                      const it = itemMap.get(code);
                      setRow(r.id, { item_code: code, uom: it?.stock_uom || "" });
                      refreshAvailable(r.id, code);
                    }}
                  />
                </div>

                <div className="stock-transfer-row-field">
                  <label className="form-label">Unit</label>
                  <input className="input input-readonly" value={r.uom} readOnly />
                </div>

                <div className="stock-transfer-row-field">
                  <label className="form-label">Available in Raw</label>
                  <input className="input input-readonly" value={r.current_qty} readOnly />
                </div>

                <div className="stock-transfer-row-field">
                  <label className="form-label">Issue Qty</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={r.qty}
                    onChange={(e) => setRow(r.id, { qty: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <datalist id="mf-raw-item-list">
          {(items || []).slice(0, 5000).map((it) => (
            <option key={it.name} value={it.name} label={`${it.name} - ${it.item_name || ""}`} />
          ))}
        </datalist>

        <div>
          <button type="button" className="btn btn-accent btn-sm" onClick={addRow}>
            + Add Item
          </button>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Submit Issue to WIP"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ------------------------------------------------------------
// TAB 2: Manufacture (consume from WIP, produce to FG)
function ManufactureFromWipTab({ company, flowTag, onCreated, onGoWaste, onGoReturn }) {
  const [boms, setBoms] = useState([]);
  const [finishedItems, setFinishedItems] = useState([]);
  const [rawItems, setRawItems] = useState([]);

  const [finishedItem, setFinishedItem] = useState("");
  const [selectedBomName, setSelectedBomName] = useState("");
  const [fgQty, setFgQty] = useState("1");

  const [bomItemsBase, setBomItemsBase] = useState([]);
  const [rows, setRows] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const [bomData, finishedItemData, rawItemData] = await Promise.all([
          getBoms(),
          getFinishedItems(),
          getItemsForBOM(),
        ]);
        setBoms(bomData || []);
        setFinishedItems(finishedItemData || []);
        setRawItems(rawItemData || []);
      } catch (e) {
        setErr(e?.message || "Failed to load BOM / items");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredBoms = finishedItem ? boms.filter((b) => b.item === finishedItem) : [];

  function scaleRowsFromBom(items, finishedQty, bomQty, manualRows = []) {
    const fg = parseFloat(finishedQty);
    const bq = parseFloat(bomQty);
    const ratio = !isNaN(fg) && fg > 0 && !isNaN(bq) && bq > 0 ? fg / bq : 1;

    const bomRows = items.map((it, idx) => ({
      id: it.name || `bom-${idx}`,
      item_code: it.item_code,
      item_name: it.item_name,
      uom: it.uom,
      qty: ((parseFloat(it.qty) || 0) * ratio).toString(),
      fromBom: true,
    }));

    return [...bomRows, ...manualRows];
  }

  async function loadBomDocAndRows(bomName, finishedQty, bomQty) {
    setErr("");
    setMsg("");
    const bomDoc = await getBomDocWithItems(bomName);
    const items = bomDoc.items || [];
    const manualRows = rows.filter((r) => !r.fromBom);
    setBomItemsBase(items);
    setRows(scaleRowsFromBom(items, finishedQty, bomQty, manualRows));
  }

  async function handleFinishedItemChange(code) {
    setFinishedItem(code);
    setErr("");
    setMsg("");

    if (!code) {
      setSelectedBomName("");
      setRows((p) => p.filter((r) => !r.fromBom));
      return;
    }

    const bomForItem = boms.find((b) => b.item === code);
    if (!bomForItem) {
      setSelectedBomName("");
      setRows((p) => p.filter((r) => !r.fromBom));
      return;
    }

    setSelectedBomName(bomForItem.name);
    await loadBomDocAndRows(bomForItem.name, fgQty, bomForItem.quantity);
  }

  async function handleBomChange(name) {
    setSelectedBomName(name);
    setErr("");
    setMsg("");
    if (!name) return;

    const bom = boms.find((b) => b.name === name);
    if (!bom) return;

    if (bom.item && bom.item !== finishedItem) setFinishedItem(bom.item);
    await loadBomDocAndRows(bom.name, fgQty, bom.quantity);
  }

  function handleFgQtyChange(v) {
    setFgQty(v);
    setErr("");
    setMsg("");
    const bom = boms.find((b) => b.name === selectedBomName);
    if (!bom) return;
    const manualRows = rows.filter((r) => !r.fromBom);
    setRows(scaleRowsFromBom(bomItemsBase, v, bom.quantity, manualRows));
  }

  function addManualRow() {
    setRows((p) => [
      ...p,
      { id: `manual-${Date.now()}-${Math.random()}`, item_code: "", item_name: "", uom: "", qty: "", fromBom: false },
    ]);
  }

  function removeRow(id) {
    setRows((p) => p.filter((r) => r.id !== id));
  }

  function changeRowQty(id, qty) {
    setRows((p) => p.map((r) => (r.id === id ? { ...r, qty } : r)));
  }

  function changeRowItem(id, code) {
    const it = rawItems.find((x) => x.name === code);
    setRows((p) =>
      p.map((r) =>
        r.id === id ? { ...r, item_code: code, item_name: it?.item_name || "", uom: it?.stock_uom || "" } : r
      )
    );
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!company) return setErr("Company is required.");
    const bom = boms.find((b) => b.name === selectedBomName);
    if (!bom) return setErr("Select a BOM.");

    const fg = parseFloat(fgQty);
    if (isNaN(fg) || fg <= 0) return setErr("Enter valid finished qty.");

    const validRows = rows.filter((r) => r.item_code && !isNaN(parseFloat(r.qty)) && parseFloat(r.qty) > 0);
    if (!validRows.length) return setErr("No raw rows with qty.");

    const payload = {
      doctype: "Stock Entry",
      stock_entry_type: "Manufacture",
      company,
      custom_mf_track: 1,
      bom_no: bom.name,
      fg_completed_qty: fg,
      remarks: `${flowTag} | MFG WIP->FG`,
      items: [
        ...validRows.map((r) => ({
          item_code: r.item_code,
          qty: parseFloat(r.qty),
          s_warehouse: WIP_WH,
        })),
        {
          item_code: bom.item,
          qty: fg,
          t_warehouse: FG_WH,
          is_finished_item: 1,
        },
      ],
    };

    try {
      setSaving(true);
      const created = await createDoc("Stock Entry", payload);
      const name = created?.data?.name;
      if (!name) throw new Error("Stock Entry not created (missing name)");
      await submitDoc("Stock Entry", name);
      setMsg(`Manufactured: ${name}`);
      onCreated?.(name);
    } catch (e2) {
      setErr(e2?.response?.data?.error?.message || e2?.message || "Failed to manufacture");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h3>2) Manufacture (WIP → Finished)</h3>
      <div className="text-muted">
        Consume from <b>{WIP_WH}</b> and produce into <b>{FG_WH}</b>
      </div>

      {loading && <div className="text-muted">Loading...</div>}
      {err && <div className="alert alert-error">{err}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}

      <form onSubmit={submit} className="stock-mfg-form">
        <div className="stock-mfg-form-grid">
          <SimpleSelect label="Finished Item">
            <MfItemSearchDropdown
              items={finishedItems}
              value={finishedItem}
              placeholder="Search finished item..."
              disabled={loading}
              onSelect={(code) => {
                handleFinishedItemChange(code || "");
              }}
            />
          </SimpleSelect>

          <SimpleSelect label="BOM / Material List">
            <select className="select" value={selectedBomName} onChange={(e) => handleBomChange(e.target.value)} disabled={!finishedItem}>
              <option value="">-- select BOM --</option>
              {filteredBoms.map((b, idx) => (
                <option key={b.name} value={b.name}>
                  Option {idx + 1}
                </option>
              ))}
            </select>
          </SimpleSelect>

          <SimpleSelect label="Finished Qty">
            <input className="input" type="number" min="0" value={fgQty} onChange={(e) => handleFgQtyChange(e.target.value)} />
          </SimpleSelect>
        </div>

        <div>
          <h4>Raw Materials (from WIP)</h4>
          <button type="button" className="btn btn-accent btn-sm" onClick={addManualRow}>
            + Add Raw Item
          </button>
        </div>

        <datalist id="mf-wip-item-list">
          {rawItems.map((it) => (
            <option key={it.name} value={it.name} label={`${it.name} - ${it.item_name || ""}`} />
          ))}
        </datalist>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Name</th>
                <th>Unit</th>
                <th>Qty</th>
                <th>Source</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.fromBom ? (
                      r.item_code
                    ) : (
                      <input
                        className="input"
                        list="mf-wip-item-list"
                        value={r.item_code}
                        onChange={(e) => changeRowItem(r.id, e.target.value)}
                        placeholder="Item code"
                      />
                    )}
                  </td>
                  <td>{r.item_name}</td>
                  <td>{r.uom}</td>
                  <td>
                    <input className="input" type="number" min="0" value={r.qty} onChange={(e) => changeRowQty(r.id, e.target.value)} />
                  </td>
                  <td>{WIP_WH}</td>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeRow(r.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={6} className="text-muted">
                    Select BOM to load items.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Submit Manufacture"}
          </button>

          <button type="button" className="btn btn-accent" onClick={onGoWaste}>
            Wastage Material
          </button>
          <button type="button" className="btn btn-accent" onClick={onGoReturn}>
            Return Raw
          </button>
        </div>
      </form>
    </div>
  );
}

// ------------------------------------------------------------
// TAB 3/4: Wastage or Return (from WIP) linked to a Manufacture SE
function WasteReturnTab({ mode, company, flowTag, defaultMfgSeName }) {
  const targetWh = mode === "WASTE" ? WASTAGE_WH : RAW_WH;
  const title = mode === "WASTE" ? "3) Wastage Material (WIP → Wastage)" : "4) Return Raw (WIP → Raw)";

  function todayKolkataYmd() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return `${m.year}-${m.month}-${m.day}`;
  }

  const dayFilter = useMemo(() => todayKolkataYmd(), []);

  const [mfgEntries, setMfgEntries] = useState([]);
  const [mfgSeName, setMfgSeName] = useState(defaultMfgSeName || "");
  const [mfgLabelMap, setMfgLabelMap] = useState({});
  const [balances, setBalances] = useState([]);
  const [qtyMap, setQtyMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  function onlyDate(pd, modified) {
    if (pd) return String(pd).slice(0, 10);
    return modified ? String(modified).slice(0, 10) : "";
  }

  function getFinishedLabel(doc) {
    const items = doc?.items || [];
    const fin = items.find((it) => Number(it.is_finished_item) === 1);
    if (!fin) return "Manufacture";
    return `${fin.item_code}`;
  }

  async function load() {
    setLoading(true);
    setErr("");
    setMsg("");
    try {
      const [allSes, b] = await Promise.all([
        listMfFlowStockEntries({ flowTag, limit: 300 }),
        getMfFlowWipBalances({ flowTag, wipWarehouse: WIP_WH }),
      ]);

      const mfgsAll = (allSes || []).filter((x) => x.docstatus === 1 && x.stock_entry_type === "Manufacture");

      const mfgs = (mfgsAll || []).filter((x) => (x.posting_date || "") === dayFilter);

      setMfgEntries(mfgs || []);

      const newestToday = (mfgs || [])[0]?.name || "";
      setMfgSeName((prev) => {
        if (prev && (mfgs || []).some((x) => x.name === prev)) return prev;
        if (defaultMfgSeName && (mfgs || []).some((x) => x.name === defaultMfgSeName)) return defaultMfgSeName;
        return newestToday;
      });

      const mfgNames = (mfgs || []).map((x) => x.name).filter(Boolean);
      const docs = await mapLimit(mfgNames, 6, (nm) => getDoc("Stock Entry", nm));

      const labelMap = {};
      docs.forEach((d) => {
        const date = onlyDate(d.posting_date, d.modified);
        labelMap[d.name] = `${getFinishedLabel(d)} (${date || "-"})`;
      });
      setMfgLabelMap(labelMap);

      setBalances(b || []);
      const next = {};
      (b || []).forEach((x) => {
        next[x.item_code] = "";
      });
      setQtyMap(next);
    } catch (e) {
      setErr(e?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowTag]);

  function setQty(item, v) {
    setQtyMap((p) => ({ ...p, [item]: v }));
  }

  async function submit() {
    setErr("");
    setMsg("");

    if (!company) return setErr("Company is required.");
    if (!mfgSeName) return setErr("Select a Manufacture for today.");

    const rows = (balances || [])
      .map((b) => {
        const q = Number(qtyMap[b.item_code]);
        return { item_code: b.item_code, remaining: Number(b.remaining_qty), qty: q };
      })
      .filter((r) => !isNaN(r.qty) && r.qty > 0);

    if (!rows.length) return setErr("Enter at least one qty.");

    for (const r of rows) {
      if (r.qty > r.remaining) {
        return setErr(`Qty cannot exceed remaining in WIP for ${r.item_code} (remaining ${r.remaining}).`);
      }
    }

    const remark = mode === "WASTE" ? `${flowTag} | WASTE FOR ${mfgSeName}` : `${flowTag} | RETURN FOR ${mfgSeName}`;

    const payload = {
      doctype: "Stock Entry",
      stock_entry_type: "Material Transfer",
      company,
      custom_mf_track: 1,
      remarks: remark,
      items: rows.map((r) => ({
        item_code: r.item_code,
        qty: r.qty,
        s_warehouse: WIP_WH,
        t_warehouse: targetWh,
      })),
    };

    try {
      setSaving(true);
      const created = await createDoc("Stock Entry", payload);
      const name = created?.data?.name;
      if (!name) throw new Error("Stock Entry not created (missing name)");
      await submitDoc("Stock Entry", name);
      setMsg(`Created: ${name}`);
      await load();
    } catch (e2) {
      setErr(e2?.response?.data?.error?.message || e2?.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h3>{title}</h3>
      <div className="text-muted">
        From <b>{WIP_WH}</b> to <b>{targetWh}</b> (qty must be ≤ remaining)
      </div>

      <div className="text-muted">
        Showing Manufacture entries for: <b>{dayFilter}</b>
      </div>

      {loading && <div className="text-muted">Loading...</div>}
      {err && <div className="alert alert-error">{err}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}

      <div className="stock-mfg-form-grid">
        <SimpleSelect label="Link to Manufacture Entry">
          <select className="select" value={mfgSeName} onChange={(e) => setMfgSeName(e.target.value)}>
            <option value="">-- select manufacture (today) --</option>
            {(mfgEntries || []).map((x) => (
              <option key={x.name} value={x.name}>
                {mfgLabelMap[x.name] || `Manufacture (${x.posting_date || "-"})`}
              </option>
            ))}
          </select>
        </SimpleSelect>

        <div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Remaining in WIP (this flow)</th>
              <th>Transfer Qty</th>
            </tr>
          </thead>
          <tbody>
            {(balances || []).map((b) => (
              <tr key={b.item_code}>
                <td>{b.item_code}</td>
                <td>{Number(b.remaining_qty).toFixed(3)}</td>
                <td>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={qtyMap[b.item_code] ?? ""}
                    onChange={(e) => setQty(b.item_code, e.target.value)}
                  />
                </td>
              </tr>
            ))}
            {!balances.length && !loading ? (
              <tr>
                <td colSpan={3} className="text-muted">
                  No remaining items in WIP for this flow.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
          {saving ? "Saving..." : "Submit"}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// TAB 5: Tracker (only process entries where custom_mf_track = 1)
function TrackerTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const list = await getDoctypeList("Stock Entry", {
        fields: JSON.stringify([
          "name",
          "stock_entry_type",
          "posting_date",
          "posting_time",
          "docstatus",
          "remarks",
          "modified",
          "custom_mf_track",
        ]),
        filters: JSON.stringify([
          ["Stock Entry", "docstatus", "=", 1],
          ["Stock Entry", "custom_mf_track", "=", 1],
        ]),
        order_by: "posting_date desc, posting_time desc, modified desc",
        limit_page_length: 500,
      });

      const names = (list || []).map((x) => x.name).filter(Boolean);
      const docs = await mapLimit(names, 6, (nm) => getDoc("Stock Entry", nm));

      const mfgDocs = (docs || []).filter((d) => d.stock_entry_type === "Manufacture");

      const wasteByMfg = new Map();

      (docs || []).forEach((d) => {
        if (d.stock_entry_type === "Manufacture") return;

        const r = String(d.remarks || "");
        const mfg = parseForMfg(r);
        if (!mfg) return;

        const lines = (d.items || []).map((it) => ({
          item_code: it.item_code,
          qty: it.qty,
          uom: it.uom || it.stock_uom,
        }));

        if (r.includes("WASTE FOR")) {
          wasteByMfg.set(mfg, [...(wasteByMfg.get(mfg) || []), ...lines]);
        }
      });

      const out = (mfgDocs || []).map((doc) => {
        const items = doc.items || [];

        const finished = items.find((it) => Number(it.is_finished_item) === 1);
        const finishedUom = safeUom(finished?.uom || finished?.stock_uom);
        const finishedText = finished
          ? `${finished.item_code} (${Number(finished.qty || 0).toFixed(3)} ${finishedUom})`
          : "-";

        const rawLines = items
          .filter((it) => it.s_warehouse === WIP_WH && Number(it.is_finished_item) !== 1)
          .map((it) => ({
            item_code: it.item_code,
            qty: it.qty,
            uom: it.uom || it.stock_uom,
          }));

        const wasteLines = (wasteByMfg.get(doc.name) || []).map((x) => ({
          item_code: x.item_code,
          qty: x.qty,
          uom: x.uom || x.stock_uom,
        }));

        return {
          mfgSe: doc.name,
          item: finishedText,
          rawUsed: fmtUsed(rawLines, 20),
          wasteUsed: fmtUsed(wasteLines, 20),
          date: onlyDateFromDoc(doc),
        };
      });

      out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      setRows(out);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h3>5) Stock Tracker</h3>
      <div className="text-muted">
        Showing only entries where <b>custom_mf_track = 1</b>
      </div>

      <button type="button" className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
        {loading ? "Loading..." : "Refresh"}
      </button>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>ITEM</th>
              <th>RAW Used (Qty + Unit)</th>
              <th>Wastage (Qty + Unit)</th>
              <th>DATE</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((r) => (
              <tr key={r.mfgSe}>
                <td>{r.item}</td>
                <td>{r.rawUsed}</td>
                <td>{r.wasteUsed}</td>
                <td>{r.date || "-"}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={4} className="text-muted">
                  No Manufacture entries yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// MAIN
export default function MfWorkflow() {
  const [companies, setCompanies] = useState([]);
  const [company, setCompany] = useState("");

  const [flowId, setFlowId] = useState(() => {
    const saved = localStorage.getItem(FLOW_KEY);
    return saved || makeFlowId();
  });

  useEffect(() => {
    localStorage.setItem(FLOW_KEY, flowId);
  }, [flowId]);

  const flowTag = useMemo(() => makeFlowTag(flowId), [flowId]);
  const [lastMfgSe, setLastMfgSe] = useState("");

  const TABS = {
    WIP_STOCK: "WIP_STOCK", // ✅ NEW TAB
    ISSUE: "ISSUE",
    MFG: "MFG",
    WASTE: "WASTE",
    RETURN: "RETURN",
    TRACK: "TRACK",
  };
  const [tab, setTab] = useState(TABS.ISSUE);

  useEffect(() => {
    (async () => {
      const cs = await getCompanies();
      setCompanies(cs || []);
      if ((cs || []).length) setCompany(cs[0].name);
    })();
  }, []);

  function startNewFlow() {
    const id = makeFlowId();
    setFlowId(id);
    setLastMfgSe("");
    setTab(TABS.ISSUE);
  }

  return (
    <div>
      <div className="stock-mfg-header">
        <div className="stock-mfg-title-block">
          <h2 className="stock-mfg-title">MF Workflow (Raw → WIP → FG)</h2>
          <p className="stock-mfg-subtitle">
            Current flow tag: <b>{flowTag}</b> (custom_mf_track saved as <b>1</b>)
          </p>
        </div>

        <div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={startNewFlow}>
            Start New Flow
          </button>
        </div>
      </div>

      <div className="stock-mfg-form-grid">
        <SimpleSelect label="Company">
          <select className="select" value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="">-- select company --</option>
            {companies.map((c) => (
              <option key={c.name} value={c.name}>
                {c.company_name || c.name} {c.abbr ? `(${c.abbr})` : ""}
              </option>
            ))}
          </select>
        </SimpleSelect>
      </div>

      <div className="mfg-tabs">
        <button type="button" className={`mfg-tab ${tab === TABS.ISSUE ? "active" : ""}`} onClick={() => setTab(TABS.ISSUE)}>
          Issue Material
        </button>
        <button type="button" className={`mfg-tab ${tab === TABS.MFG ? "active" : ""}`} onClick={() => setTab(TABS.MFG)}>
          Manufacture
        </button>

        {/* ✅ NEW TAB BUTTON */}
        <button
          type="button"
          className={`mfg-tab ${tab === TABS.WIP_STOCK ? "active" : ""}`}
          onClick={() => setTab(TABS.WIP_STOCK)}
        >
          WIP Stock
        </button>

        <button type="button" className={`mfg-tab ${tab === TABS.WASTE ? "active" : ""}`} onClick={() => setTab(TABS.WASTE)}>
          Wastage
        </button>
        <button type="button" className={`mfg-tab ${tab === TABS.RETURN ? "active" : ""}`} onClick={() => setTab(TABS.RETURN)}>
          Return Raw
        </button>
        <button type="button" className={`mfg-tab ${tab === TABS.TRACK ? "active" : ""}`} onClick={() => setTab(TABS.TRACK)}>
          Tracker
        </button>
      </div>

      {tab === TABS.ISSUE && <IssueToWipTab company={company} flowTag={flowTag} onCreated={() => {}} />}

      {tab === TABS.MFG && (
        <ManufactureFromWipTab
          company={company}
          flowTag={flowTag}
          onCreated={(seName) => setLastMfgSe(seName)}
          onGoWaste={() => setTab(TABS.WASTE)}
          onGoReturn={() => setTab(TABS.RETURN)}
        />
      )}

      {/* ✅ NEW TAB CONTENT */}
      {tab === TABS.WIP_STOCK && <WipWarehouseStockTab />}

      {tab === TABS.WASTE && <WasteReturnTab mode="WASTE" company={company} flowTag={flowTag} defaultMfgSeName={lastMfgSe} />}

      {tab === TABS.RETURN && <WasteReturnTab mode="RETURN" company={company} flowTag={flowTag} defaultMfgSeName={lastMfgSe} />}

      {tab === TABS.TRACK && <TrackerTab />}
    </div>
  );
}
