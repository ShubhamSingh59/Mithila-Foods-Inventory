import { getDoctypeList, api } from "./core";

// --- Suppliers ---
export async function getSuppliers() {
  return getDoctypeList("Supplier", {
    fields: JSON.stringify(["name", "supplier_name", "email_id"]),
    filters: JSON.stringify([["Supplier", "disabled", "=", 0]]),
    limit_page_length: 500,
  });
}

export async function getSuppliersForList() {
  return getDoctypeList("Supplier", {
    fields: JSON.stringify([
      "name", "supplier_name", "supplier_group", "supplier_type", "disabled",
      "mobile_no", "email_id", "custom_contact_person", "custom_credit_limit",
      "custom_status", "pan", "gstin", "gst_category", "supplier_primary_address",
      "primary_address", "default_bank_account", "custom_fssai", "custom_msme", "custom_udyam",
    ]),
    limit_page_length: 1000,
    order_by: "modified desc",
  });
}

export async function getSupplierStatusOptions() {
  return getDoctypeFieldOptions("Supplier", "custom_status");
}

export async function getSupplierDashboardStatsByStatus() {
  const STATUS_FIELD = "custom_status";
  const statusOptions = await getSupplierStatusOptions();
  
  // Fetch all suppliers (minified)
  let all = []; 
  let start = 0;
  while(true) {
      const rows = await getDoctypeList("Supplier", {
          fields: JSON.stringify(["name", "supplier_group", STATUS_FIELD]),
          limit_page_length: 1000,
          limit_start: start,
      });
      all = all.concat(rows || []);
      if(!rows || rows.length < 1000) break;
      start += 1000;
  }

  // Aggregate
  const groups = new Set();
  const statusCounts = new Map();
  (statusOptions || []).forEach((s) => statusCounts.set(s, 0));

  for (const s of all) {
    if (s.supplier_group) groups.add(s.supplier_group);
    const val = s?.[STATUS_FIELD] || "Unspecified";
    statusCounts.set(val, (statusCounts.get(val) || 0) + 1);
  }

  return {
    total: all.length,
    categories: groups.size,
    statuses: Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count })),
  };
}

// --- Transporters ---
const TRANSPORTER_DOCTYPE = "Transporter";

export async function getTransporters() {
  return getDoctypeList(TRANSPORTER_DOCTYPE, {
    fields: JSON.stringify(["name", "transporter_name"]),
    limit_page_length: 1000,
    order_by: "modified desc",
  });
}

export async function getTransportersForList() {
  return getDoctypeList(TRANSPORTER_DOCTYPE, {
    fields: JSON.stringify(["name", "transporter_name", "point_of_contact", "contact", "address", "rating", "working_days"]),
    limit_page_length: 1000,
    order_by: "modified desc",
  });
}

export async function getTransporterDashboardStatsByStatus() {
    // Reusing the generic logic logic conceptually
    const statusOptions = await getDoctypeFieldOptions(TRANSPORTER_DOCTYPE, "status");
    let all = []; 
    let start = 0;
    while(true) {
        const rows = await getDoctypeList(TRANSPORTER_DOCTYPE, {
            fields: JSON.stringify(["name", "status"]),
            limit_page_length: 1000,
            limit_start: start
        });
        all = all.concat(rows || []);
        if(!rows || rows.length < 1000) break;
        start += 1000;
    }
    
    const statusCounts = new Map();
    (statusOptions || []).forEach((s) => statusCounts.set(s, 0));
    let active = 0;

    for (const t of all) {
        const val = t.status || "Unspecified";
        statusCounts.set(val, (statusCounts.get(val) || 0) + 1);
        if(String(val).toLowerCase() === 'active') active++;
    }

    return {
        total: all.length,
        active,
        statuses: Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count }))
    };
}

// --- Common ---
export async function getCustomers() {
  return getDoctypeList("Customer", {
    fields: JSON.stringify(["name", "customer_name"]),
    filters: JSON.stringify([["Customer", "disabled", "=", 0]]),
    limit_page_length: 1000,
  });
}

export async function getCompanies() {
  return getDoctypeList("Company", {
    fields: JSON.stringify(["name", "company_name", "abbr"]),
    limit_page_length: 1000,
  });
}

export async function getWarehouses() {
  return getDoctypeList("Warehouse", {
    fields: JSON.stringify(["name", "warehouse_name", "company", "is_group"]),
    filters: JSON.stringify([["Warehouse", "is_group", "=", 0]]),
    limit_page_length: 500,
  });
}

export async function getAllItems() {
  return getDoctypeList("Item", {
    fields: JSON.stringify(["name", "item_name", "item_group"]),
    limit_page_length: 5000,
  });
}

// Read Select options from meta
export async function getDoctypeFieldOptions(doctype, fieldname) {
  const res = await api.get(`/api/method/frappe.desk.form.load.getdoctype`, { params: { doctype } });
  const fields = res.data.docs?.[0]?.fields || [];
  const f = fields.find((x) => x.fieldname === fieldname);
  return f?.options ? f.options.split("\n").map(o => o.trim()).filter(Boolean) : [];
}