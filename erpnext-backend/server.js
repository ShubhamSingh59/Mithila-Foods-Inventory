// server.js (or index.js)
// This is a small Node + Express backend.
// It works as a proxy between your React app and ERPNext.
// React calls this backend, and this backend calls ERPNext using API key/secret.

// ------------------------------
// Imports
// ------------------------------
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const FormData = require("form-data");

// ------------------------------
// Load environment variables from .env
// ------------------------------
dotenv.config();

// ------------------------------
// Create Express app
// ------------------------------
const app = express();

// ------------------------------
// CORS: allow frontend URLs to call this backend
// ------------------------------
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://mithila-foods-inventory-1.onrender.com",
    ],
  })
);

// ------------------------------
// Parse JSON request bodies
// ------------------------------
app.use(express.json());

// ------------------------------
// Multer setup (file upload in memory)
// ------------------------------
// This keeps uploaded files in RAM (not saved on disk).
const upload = multer();

// ------------------------------
// Read ERPNext connection settings from .env
// ------------------------------
const {
  ERP_BASE_URL,
  ERP_API_KEY,
  ERP_API_SECRET,
  DEFAULT_PURCHASE_WAREHOUSE, // present but not used in this file
} = process.env;

// ------------------------------
// ERPNext axios client
// ------------------------------
// All calls go to: ERP_BASE_URL + "/api"
// Authorization uses ERPNext token: "token <api_key>:<api_secret>"
const erpClient = axios.create({
  baseURL: `${ERP_BASE_URL}/api`,
  headers: {
    Authorization: `token ${ERP_API_KEY}:${ERP_API_SECRET}`,
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

// ============================================================================
// 1) RESOURCE ROUTES (ERPNext /api/resource)
// ============================================================================

// List documents of a doctype.
// Frontend calls: GET /api/doctype/Item?fields=...&filters=...&limit_page_length=...
// Backend calls:  GET ERP /api/resource/Item
app.get("/api/doctype/:doctype", async (req, res) => {
  const { doctype } = req.params;

  try {
    const response = await erpClient.get(`/resource/${doctype}`, {
      // Pass through query params like fields, filters, order_by, limit_page_length, etc.
      params: req.query,
    });

    // ERPNext returns { data: [...] }
    res.json(response.data);
  } catch (err) {
    console.error(
      `GET /resource/${doctype} error:`,
      err.response?.data || err.message
    );
    res
      .status(err.response?.status || 500)
      .json({ error: err.response?.data || err.message });
  }
});

// Create a new document in a doctype.
// Frontend calls: POST /api/doctype/Purchase Order   body: {doctype:"Purchase Order", ...}
// Backend calls:  POST ERP /api/resource/Purchase Order
app.post("/api/doctype/:doctype", async (req, res) => {
  const { doctype } = req.params;
  const data = req.body;

  try {
    const response = await erpClient.post(`/resource/${doctype}`, data);

    // ERPNext returns created doc as { data: {...} }
    res.json(response.data);
  } catch (err) {
    console.error(
      `POST /resource/${doctype} error:`,
      err.response?.data || err.message
    );
    res
      .status(err.response?.status || 500)
      .json({ error: err.response?.data || err.message });
  }
});

// Submit a document by setting docstatus = 1.
// Frontend calls: POST /api/submit   body: {doctype, name}
// Backend calls:  PUT ERP /api/resource/:doctype/:name  body: {docstatus:1}
app.post("/api/submit", async (req, res) => {
  const { doctype, name } = req.body;

  // Basic validation
  if (!doctype || !name) {
    return res.status(400).json({ error: "doctype and name are required" });
  }

  try {
    const response = await erpClient.put(
      `/resource/${doctype}/${encodeURIComponent(name)}`,
      { docstatus: 1 }
    );

    res.json(response.data);
  } catch (err) {
    console.error(
      `submit ${doctype} ${name} error:`,
      err.response?.data || err.message
    );
    res
      .status(err.response?.status || 500)
      .json({ error: err.response?.data || err.message });
  }
});

// Get one ERPNext document (full doc with child tables).
// Frontend calls: GET /api/doc/BOM/BOM-0001
// Backend calls:  GET ERP /api/resource/BOM/BOM-0001
app.get("/api/doc/:doctype/:name", async (req, res) => {
  const { doctype, name } = req.params;

  try {
    const response = await erpClient.get(
      `/resource/${doctype}/${encodeURIComponent(name)}`
    );

    // ERPNext returns { data: { ...doc..., items: [...] } }
    res.json(response.data);
  } catch (err) {
    console.error(
      `GET /resource/${doctype}/${name} error:`,
      err.response?.data || err.message
    );
    res
      .status(err.response?.status || 500)
      .json({ error: err.response?.data || err.message });
  }
});

// Update a document (generic).
// Frontend calls: PUT /api/doc/Purchase%20Order/PO-0001   body: { status: "Completed" }
// Backend calls:  PUT ERP /api/resource/Purchase Order/PO-0001
app.put("/api/doc/:doctype/:name", async (req, res) => {
  const { doctype, name } = req.params;

  try {
    const response = await erpClient.put(
      `/resource/${doctype}/${encodeURIComponent(name)}`,
      // Body contains fields to update
      req.body
    );

    res.json(response.data);
  } catch (err) {
    console.error(
      `PUT /resource/${doctype}/${name} error:`,
      err.response?.data || err.message
    );
    res
      .status(err.response?.status || 500)
      .json({ error: err.response?.data || err.message });
  }
});

// ============================================================================
// 2) METHOD ROUTES (ERPNext /api/method)
// ============================================================================

// Generic POST proxy for ERPNext whitelisted methods.
// Frontend calls: POST /api/method/frappe.client.set_value   body: {...}
// Backend calls:  POST ERP /api/method/frappe.client.set_value
app.post("/api/method/:methodPath", async (req, res) => {
  const { methodPath } = req.params;

  try {
    const response = await erpClient.post(`/method/${methodPath}`, req.body);
    res.json(response.data);
  } catch (err) {
    console.error(
      `POST /method/${methodPath} error:`,
      err.response?.data || err.message
    );
    res
      .status(err.response?.status || 500)
      .json({ error: err.response?.data || err.message });
  }
});

// Generic GET proxy for ERPNext whitelisted methods.
// This is mainly used for PDF downloads because it supports binary response.
// Frontend calls: GET /api/method/frappe.utils.print_format.download_pdf?doctype=...&name=...
// Backend calls:  GET ERP /api/method/frappe.utils.print_format.download_pdf?...
app.get("/api/method/:methodPath", async (req, res) => {
  const { methodPath } = req.params;

  try {
    const response = await erpClient.get(`/method/${methodPath}`, {
      params: req.query,
      responseType: "arraybuffer",
    });

    // Forward ERPNext content-type if available
    res.setHeader(
      "Content-Type",
      response.headers["content-type"] || "application/octet-stream"
    );

    res.send(response.data);
  } catch (err) {
    console.error(
      `GET /method/${methodPath} error:`,
      err.response?.data || err.message
    );
    res
      .status(err.response?.status || 500)
      .json({ error: err.response?.data || err.message });
  }
});

// ============================================================================
// 3) CANCEL DOCUMENT
// ============================================================================

// Cancel a document using frappe.client.cancel
// Frontend calls: POST /api/cancel_doc  body: {doctype, name}
// Backend calls:  POST ERP /api/method/frappe.client.cancel
app.post("/api/cancel_doc", async (req, res) => {
  const { doctype, name } = req.body;

  try {
    const r = await erpClient.post("/method/frappe.client.cancel", {
      doctype,
      name,
    });

    res.json(r.data);
  } catch (e) {
    console.error("Cancel doc error:", e.response?.data || e.message);
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

// ============================================================================
// 4) REPORT PROXY (ERPNext Query Report)
// ============================================================================

// Run query report using GET.
// Frontend calls: GET /api/report/Stock%20Balance?company=...&from_date=...&to_date=...
// Backend calls:  GET ERP /api/method/frappe.desk.query_report.run
app.get("/api/report/:reportName", async (req, res) => {
  const { reportName } = req.params;

  try {
    const response = await erpClient.get("/method/frappe.desk.query_report.run", {
      params: {
        report_name: reportName,
        // ERPNext expects "filters" as JSON string
        filters: JSON.stringify(req.query || {}),
        ignore_prepared_report: 1,
      },
    });

    // ERPNext returns { message: { columns, result, ... } }
    // We return only that message object to frontend.
    res.json(response.data.message);
  } catch (err) {
    console.error(`Report ${reportName} error:`, err.response?.data || err.message);
    res
      .status(err.response?.status || 500)
      .json({ error: err.response?.data || err.message });
  }
});

// Run query report using POST.
// Frontend calls: POST /api/report/run  body: { report_name, filters }
// Backend calls:  POST ERP /api/method/frappe.desk.query_report.run
app.post("/api/report/run", async (req, res) => {
  try {
    const { report_name, filters } = req.body || {};

    if (!report_name) {
      return res.status(400).json({ error: "report_name is required" });
    }

    const response = await erpClient.post("/method/frappe.desk.query_report.run", {
      report_name,
      filters: JSON.stringify(filters || {}),
      ignore_prepared_report: 1,
    });

    res.json(response.data.message);
  } catch (err) {
    console.error("Run Report error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data || err.message,
    });
  }
});

// ============================================================================
// 5) FILE UPLOAD PROXY (ERPNext upload_file)
// ============================================================================

// Upload a file and attach it to a document in ERPNext.
// Frontend sends multipart/form-data with fields:
// - file (binary)
// - doctype
// - docname
// - is_private
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    // Make sure file is present
    if (!req.file) return res.status(400).json({ error: "file is required" });

    const { doctype, docname, is_private = "1" } = req.body;

    // Make sure document info is present
    if (!doctype || !docname) {
      return res.status(400).json({ error: "doctype and docname are required" });
    }

    // Create form-data payload exactly as ERPNext expects
    const form = new FormData();

    // ERPNext expects field name "file"
    form.append("file", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    // Attach to a document
    form.append("doctype", doctype);
    form.append("docname", docname);
    form.append("is_private", String(is_private));
    form.append("file_name", req.file.originalname);

    // Call ERPNext upload API directly (not using erpClient because it needs multipart headers)
    const url = `${ERP_BASE_URL}/api/method/upload_file`;

    const r = await axios.post(url, form, {
      headers: {
        Authorization: `token ${ERP_API_KEY}:${ERP_API_SECRET}`,
        ...form.getHeaders(),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    res.json(r.data);
  } catch (err) {
    console.error("Upload error:", err.response?.data || err.message);
    res
      .status(err.response?.status || 500)
      .json({ error: err.response?.data || err.message });
  }
});
// server.js (Updated /api/reports/reorder route)

app.get("/api/reports/reorder", async (req, res) => {
  const { warehouse } = req.query;
  if (!warehouse) return res.status(400).json({ error: "Warehouse required" });

  try {
    // 1. Fetch Items that have reorder levels configured
    // We query the PARENT 'Item' DocType and filter by the child table field 'reorder_levels'
    // NOTE: This fetches ALL items first. If you have 10k+ items, we might need a different strategy,
    // but for most setups, fetching the item master list is fast enough.
    
    // We fetch key fields plus the child table 'reorder_levels'
    const itemResponse = await erpClient.get(`/resource/Item`, {
      params: {
        fields: JSON.stringify(["name", "item_name", "item_group", "reorder_levels"]),
        filters: JSON.stringify([
           // Only items that are NOT disabled
           ["disabled", "=", 0] 
        ]),
        limit_page_length: 5000 // Adjust limit as needed
      }
    });

    const allItems = itemResponse.data.data || [];
    const reportData = [];

    // 2. Filter in Node.js for the specific warehouse
    // (It is harder to filter child tables inside the main parent query in ERPNext API)
    const relevantItems = [];
    const itemCodes = [];

    for (const item of allItems) {
      if (!item.reorder_levels || !Array.isArray(item.reorder_levels)) continue;

      // Find the rule for THIS warehouse
      const rule = item.reorder_levels.find(r => r.warehouse === warehouse);
      
      // If rule exists and level > 0
      if (rule && (rule.warehouse_reorder_level > 0 || rule.warehouse_reorder_qty > 0)) {
         relevantItems.push({
            item_code: item.name,
            item_name: item.item_name,
            item_group: item.item_group,
            reorder_level: rule.warehouse_reorder_level,
            reorder_qty: rule.warehouse_reorder_qty
         });
         itemCodes.push(item.name);
      }
    }

    if (itemCodes.length === 0) return res.json([]);

    // 3. Fetch Bin Levels (Current Stock) for these items
    // Since we filtered the list down to only items with reorder rules, this list is smaller.
    const bins = await erpClient.get(`/resource/Bin`, {
      params: {
        fields: JSON.stringify(["item_code", "actual_qty"]),
        filters: JSON.stringify([
          ["warehouse", "=", warehouse],
          ["item_code", "in", itemCodes]
        ]),
        limit_page_length: 5000
      }
    });

    const binMap = {};
    (bins.data.data || []).forEach(b => {
      binMap[b.item_code] = b.actual_qty;
    });

    // 4. Merge Data
    const finalReport = relevantItems.map(row => {
       const current = binMap[row.item_code] || 0;
       return {
         ...row,
         warehouse: warehouse,
         current_qty: current,
         difference: current - row.reorder_level
       };
    });

    res.json(finalReport);

  } catch (err) {
    console.error("Reorder Report Error:", err.response?.data || err.message);
    // Send detailed error to frontend for debugging
    res.status(500).json({ 
        error: "Failed to generate report",
        details: err.response?.data || err.message 
    });
  }
});
// ============================================================================
// 6) START SERVER
// ============================================================================

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend listening at http://localhost:${PORT}`);
});
