// src/Components/Sidebar.jsx
import React from "react";
import { NavLink } from "react-router-dom";
import { useOrg } from "../Context/OrgContext";
import "./Sidebar.css";
import {
  Menu, ChevronLeft,
  BarChart2, Package, Layers,
  ShoppingCart, Truck, Briefcase,
  ClipboardList, Activity,
  Users, TrendingUp
} from "lucide-react";

export default function Sidebar({ isOpen, toggleSidebar }) {
  // Hook into the org context
  // Hook into the org context
  const { activeOrg, orgs, loading } = useOrg();
  
  // Find the human-readable label for the active org
  const activeOrgLabel = orgs.find(o => o.id === activeOrg)?.label || activeOrg;

  // Helper for links
  const NavItem = ({ to, label, icon: Icon }) => (
    <NavLink
      to={to}
      className={({ isActive }) => `app-nav-link ${isActive ? "active" : ""}`}
      title={!isOpen ? label : ""} // Show tooltip if collapsed
    >
      <Icon size={20} className="app-nav-icon" />
      <span>{label}</span>
    </NavLink>
  );

  return (
    <aside className={`app-sidebar ${!isOpen ? "collapsed" : ""}`}>

      {/* Header */}
      <div className="app-sidebar-header">
        {/* Only show logo circle if sidebar is OPEN. 
            If closed, we only show the toggle button to keep it clean. */}
        {isOpen && <div className="app-logo-circle">S</div>}

        {isOpen && (
          <div className="app-logo-text">
            <div className="app-logo-title">Stock & Supplier</div>
            <div className="app-logo-subtitle">ERPNext Console</div>
          </div>
        )}

        <button onClick={toggleSidebar} className="sidebar-toggle-btn">
          {isOpen ? <ChevronLeft size={18} /> : <Menu size={18} />}
        </button>
      </div>

     {/* ACTIVE ORGANIZATION DISPLAY */}
      {isOpen && (
        <div className="app-sidebar-switcher" style={{ padding: "0 20px", marginBottom: "20px" }}>
          <label 
            className="app-sidebar-switcher-label" 
            style={{ fontSize: "11px", textTransform: "uppercase", color: "#888", display: "block" }}
          >
            Active Context
          </label>
          <div 
            className="app-sidebar-active-org" 
            style={{ fontWeight: "bold", color: "var(--text-color, #333)", marginTop: "4px", fontSize: "14px" }}
          >
            {loading ? "Loading..." : activeOrgLabel}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="app-nav">

        <div className="app-nav-group">
          <div className="app-nav-group-label">Stock tracker</div>
          <NavItem to="/stock/daily" label="Daily Stock Summary" icon={BarChart2} />
          <NavItem to="/stock/reorder" label="Stock Reorder" icon={Package} />
        </div>

        <div className="app-nav-group">
          <div className="app-nav-group-label">Purchase</div>
          <NavItem to="/purchase" label="Purchase Orders" icon={ShoppingCart} />
        </div>

        <div className="app-nav-group">
          <div className="app-nav-group-label">Sales</div>
          <NavItem to="/sales/orders" label="Sales" icon={Briefcase} />
          <NavItem to="/sales/return" label="Sales Return" icon={Layers} />
        </div>

        <div className="app-nav-group">
          <div className="app-nav-group-label">Manufacturing & Adjustments</div>
          <NavItem to="/mfg/transfer" label="Packing & Transfer" icon={ClipboardList} />
          <NavItem to="/mfg/workflow" label="MF Workflow" icon={Activity} />
        </div>

        {/* Supplier Hub (Split into 3 Main Views) */}
        <div className="app-nav-group">
          <div className="app-nav-group-label">Supplier & Transporter</div>

          {/* View 1: Directory (Lists & Details) */}
          <NavItem to="/suppliers/list" label="Lists" icon={Users} />

          {/* View 2: Operations (Tracker & Logistics) */}
          <NavItem to="/suppliers/purchase-tracker" label="Tracker" icon={Truck} />

          {/* View 3: Intelligence (Scorecards & Trends) */}
          <NavItem to="/suppliers/analytics" label="Reports" icon={TrendingUp} />
        </div>

        <div className="app-nav-group">
          <div className="app-nav-group-label">General Analytics</div>
          <NavItem to="/analytics" label="Dashboard" icon={BarChart2} />
        </div>

      </nav>

      {/* Footer */}
      <div className="app-sidebar-footer">
        <div className="app-sidebar-footer-label">Status</div>
        <div className="app-sidebar-footer-badge">
          Connected
        </div>
      </div>

    </aside>
  );
}