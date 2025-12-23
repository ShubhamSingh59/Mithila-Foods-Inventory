// src/Components/mfFlowConfig.js

export const MF_TAG_PREFIX = "MFLOW:";

// ✅ warehouses (change names only here if your ERP warehouse names differ)
export const RAW_WH = "Raw Material - MF";
export const WIP_WH = "Work In Progress - MF";
export const FG_WH = "Finished Goods - MF";
export const WASTAGE_WH = "Wastage - MF";

export function makeFlowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function makeFlowTag(flowId) {
  return `${MF_TAG_PREFIX}${flowId}`;
}
