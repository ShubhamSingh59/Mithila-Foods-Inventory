// src/api/master.js
// This file has all those function or data which we do not chnage on the daily basis

import axios from "axios";
import { BACKEND_URL, getDoctypeList } from "./core.js";

// ------------------------------
// Supplier & Transporter Data
// ------------------------------


export async function getSuppliers() {
  return getDoctypeList("Supplier", {
    fields: JSON.stringify(["name", "supplier_name", "email_id"]),
    filters: JSON.stringify([
      ["Supplier", "disabled", "=", 0],
      ["Supplier", "is_transporter", "=", 0] // This filter out the transporters
    ]),
    limit_page_length: 1000,
    order_by: "supplier_name asc"
  });
}

export async function getSuppliersForList() {
  return getDoctypeList("Supplier", {
    fields: JSON.stringify([
      "name", "supplier_name", "supplier_group", "supplier_type", "disabled",
      "mobile_no", "email_id", "custom_contact_person", "custom_credit_limit",
      "custom_status", "custom_payment_qr", "pan", "gstin", "gst_category",
      "supplier_primary_address", "primary_address", "default_bank_account",
      "custom_fssai", "custom_msme", "custom_udyam",
    ]),
    filters: JSON.stringify([
      ["Supplier", "supplier_group", "!=", "Transporter"],
      ["Supplier", "is_transporter", "=", 0] // Both helps us to filter out the transporter type group
    ]),
    limit_page_length: 1000,
    order_by: "modified desc",
  });
}

export async function getSupplierStatusOptions() { // This wil helps us to make the groups of supplier by their status which we are making in supplier dashboard
  const res = await axios.get(
    `${BACKEND_URL}/api/method/frappe.desk.form.load.getdoctype`,
    { params: { doctype: "Supplier" } }
  );
  const docs = res.data.docs || [];
  if (!docs.length) return [];
  const fields = docs[0].fields || [];
  const statusField = fields.find((f) => f.fieldname === "custom_status");
  if (!statusField || !statusField.options) return [];
  return statusField.options.split("\n").map((o) => o.trim()).filter(Boolean);
}

export async function getTransporters() {
  return getDoctypeList("Supplier", {
    fields: JSON.stringify(["name", "supplier_name"]),
    filters: JSON.stringify([
      ["Supplier", "is_transporter", "=", 1], // this will fatch only the tranporter in supplier doc
      ["Supplier", "disabled", "=", 0]
    ]),
    limit_page_length: 1000,
    order_by: "supplier_name asc",
  });
}

export async function fetchTransporterServiceAreas(transporterIds) {
  if (!transporterIds || transporterIds.length === 0) return {};
  try {
    const rows = await getDoctypeList("Transporter Service Area", {
      parent: "Supplier",
      fields: JSON.stringify(["parent", "city"]),
      filters: JSON.stringify([["parent", "in", transporterIds]]),
      limit_page_length: 5000
    });
    const map = {};
    rows.forEach(row => {
      if (!map[row.parent]) map[row.parent] = [];
      map[row.parent].push(row);
    });
    return map;
  } catch (e) {
    console.error("Failed to fetch service areas:", e);
    return {};
  }
}

export async function getTransportersForList() {
  const transporters = await getDoctypeList("Supplier", {
    fields: JSON.stringify([
      "name", "supplier_name", "mobile_no", "email_id", "primary_address",
      "custom_contact_person", "custom_status", "custom_vehicle_type", "supplier_group"
    ]),
    filters: JSON.stringify([
      ["Supplier", "supplier_group", "=", "Transporter"],
      ["Supplier", "is_transporter", "=", 1]
    ]),
    limit_page_length: 1000,
    order_by: "modified desc",
  });

  if (!transporters.length) return [];
  const transporterIds = transporters.map(t => t.name);
  const serviceAreaMap = await fetchTransporterServiceAreas(transporterIds);

  return transporters.map(t => ({
    ...t,
    custom_service_areas: serviceAreaMap[t.name] || []
  }));
}


// ------------------------------
// Customers & Companies & Warehouses
// ------------------------------


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


// ------------------------------
// Items
// ------------------------------


export async function getAllItems() {
  return getDoctypeList("Item", {
    fields: JSON.stringify(["name", "item_name", "item_group"]),
    limit_page_length: 5000,
  });
}

export async function getItemsForPO() {
  return getDoctypeList("Item", {
    fields: JSON.stringify(["name", "item_name", "item_group", "stock_uom", "brand"]),
    filters: JSON.stringify([
      ["Item", "item_group", "in", ["Raw Material", "Pouch", "Sticker"]],
    ]),
    limit_page_length: 1000,
  });
}

export async function getItemsForBOM() {
  return getDoctypeList("Item", {
    fields: JSON.stringify([
      "name", "item_name", "stock_uom", "item_group", "valuation_rate",
      "last_purchase_rate", "brand"
    ]),
    limit_page_length: 1000,
  });
}

export async function getFinishedItems() {
  return getDoctypeList("Item", {
    fields: JSON.stringify(["name", "item_name", "stock_uom", "item_group", "brand"]),
    filters: JSON.stringify([["Item", "item_group", "=", "Products"]]),
    limit_page_length: 1000,
  });
}

export async function getFinishedItemsForSales() {
  return getDoctypeList("Item", {
    fields: JSON.stringify([
      "name", "item_name", "stock_uom", "item_group", "custom_asin",
      "custom_easy_ship_sku", "custom_fba_sku", "custom_fk_sku",
      "custom_blinkit_upc", "brand", "custom_courier_bag_packaging",
      "custom_shipping_label"
    ]),
    filters: JSON.stringify([["Item", "item_group", "=", "Products"]]),
    limit_page_length: 1000,
  });
}

export async function getItemSuppliers() {
  return getDoctypeList("Item Supplier", {
    parent: "Item", // WE are sending the parent doc because ERP do not allows us to directly access the child doc
    fields: JSON.stringify(["parent", "supplier"]),
    limit_page_length: 5000,
  });
}