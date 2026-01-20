// src/Components/mfFlowConfig.js

/**
 * MF FLOW CONFIG (single source of truth)
 * --------------------------------------
 * Keep warehouse names here so you change them only once.
 * Flow tag is used in Stock Entry remarks to link documents.
 */

export const MF_TAG_PREFIX = "MFLOW:";

// Warehouses (update names here if ERPNext warehouse names differ)
export const RAW_WH = "Raw Material - MF";
export const WIP_WH = "Work In Progress - MF";
export const FG_WH = "Finished Goods - MF";
export const WASTAGE_WH = "Wastage - MF";

// Unique flow id (stored in localStorage)
export function makeFlowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

// Tag stored in Stock Entry remarks
export function makeFlowTag(flowId) {
  return `${MF_TAG_PREFIX}${flowId}`;
}
