
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173",
    "https://mithila-foods-inventory-1.onrender.com",]
  })
);

app.use(express.json());

const {
  ERP_BASE_URL,
  ERP_API_KEY,
  ERP_API_SECRET,
  DEFAULT_PURCHASE_WAREHOUSE,
} = process.env;


const erpClient = axios.create({
  baseURL: `${ERP_BASE_URL}/api`,
  headers: {
    Authorization: `token ${ERP_API_KEY}:${ERP_API_SECRET}`,
    "Content-Type": "application/json",
  },
  timeout: 30000, // you can add this line to avoid very short default timeouts
});



app.get("/api/doctype/:doctype", async (req, res) => {
  const { doctype } = req.params;

  try {
    const response = await erpClient.get(`/resource/${doctype}`, {
      params: req.query, // fields, filters, limit_page_length, limit_start, etc.
    });
    res.json(response.data); // { data: [...] }
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


app.post("/api/doctype/:doctype", async (req, res) => {
  const { doctype } = req.params;
  const data = req.body;

  try {
    const response = await erpClient.post(`/resource/${doctype}`, data);
    res.json(response.data); // created doc
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

app.post("/api/submit", async (req, res) => {
  const { doctype, name } = req.body;

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

// get a single ERPNext doc: /api/doc/BOM/BOM-0001
app.get("/api/doc/:doctype/:name", async (req, res) => {
  const { doctype, name } = req.params;

  try {
    const response = await erpClient.get(
      `/resource/${doctype}/${encodeURIComponent(name)}`
    );
    // ERPNext responds: { data: { ...doc..., items: [...] } }
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

// Generic POST for ERPNext methods
// e.g. /api/method/frappe.core.doctype.communication.email.make
app.post("/api/method/:methodPath", async (req, res) => {
  const { methodPath } = req.params;

  try {
    const response = await erpClient.post(
      `/method/${methodPath}`,
      req.body
    );
    // ERPNext usually returns JSON here
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

// Generic GET for ERPNext methods (we'll use this for PDF)
app.get("/api/method/:methodPath", async (req, res) => {
  const { methodPath } = req.params;

  try {
    const response = await erpClient.get(`/method/${methodPath}`, {
      params: req.query,
      responseType: "arraybuffer", // works for PDF / binary responses
    });

    // Forward content type if present, fallback to octet-stream
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


//app.post("/api/cancel_doc", async (req, res) => {
//  const { doctype, name } = req.body;

//  if (!doctype || !name) {
//    return res.status(400).json({ error: "doctype and name are required" });
//  }

//  try {
//    // erpClient baseURL = `${ERP_BASE_URL}/api`
//    const r = await erpClient.post("/method/frappe.client.cancel", {
//      doctype,
//      name,
//    });
//    res.json(r.data); // usually { message: "ok" } or full doc
//  } catch (err) {
//    console.error(
//      "Cancel doc error:",
//      err.response?.data || err.message
//    );
//    res
//      .status(err.response?.status || 500)
//      .json({ error: err.response?.data || err.message });
//  }
//});

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

// Update a single ERPNext doc (generic)
app.put("/api/doc/:doctype/:name", async (req, res) => {
  const { doctype, name } = req.params;

  try {
    const response = await erpClient.put(
      `/resource/${doctype}/${encodeURIComponent(name)}`,
      req.body         // fields to update, e.g. { status: "Completed" }
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



// ===== GENERIC QUERY REPORT PROXY =====
app.get("/api/report/:reportName", async (req, res) => {
  const { reportName } = req.params;

  try {
    const response = await erpClient.get("/method/frappe.desk.query_report.run", {
      params: {
        report_name: reportName,
        filters: JSON.stringify(req.query || {}),
        ignore_prepared_report: 1,
      },
    });

    // ✅ send only message (contains columns/result)
    res.json(response.data.message);
  } catch (err) {
    console.error(`Report ${reportName} error:`, err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: err.response?.data || err.message });
  }
});

// ===== GENERIC QUERY REPORT PROXY (POST) =====
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

    res.json(response.data.message); // ✅ columns/result/etc
  } catch (err) {
    console.error("Run Report error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data || err.message,
    });
  }
});




const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend listening at http://localhost:${PORT}`);
});
