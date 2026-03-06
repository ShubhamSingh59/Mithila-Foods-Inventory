// src/Components/Sidebar.jsx
import React from "react";
import { NavLink } from "react-router-dom";
import { useOrg } from "../Context/OrgContext";
import "./Sidebar.css";
import { // These are all the logos we are using in the sidebar
  Menu, ChevronLeft,
  BarChart2, Package, Layers,
  ShoppingCart, Truck, Briefcase,
  ClipboardList, Activity,
  Users, TrendingUp
} from "lucide-react";

export default function Sidebar({ isOpen, toggleSidebar }) {
  const { activeOrg, orgs, loading } = useOrg();

  // Find the label for the active org
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
        {isOpen && <div className="app-logo-circle">F2D</div>}

        {isOpen && (
          <div className="app-logo-text">
            <div className="app-logo-title">F2D Tracker</div>
            <div className="app-sidebar-active-context">
              {loading ? "Loading..." : activeOrgLabel}
            </div>
          </div>
        )}
        <button onClick={toggleSidebar} className="sidebar-toggle-btn">
          {isOpen ? <ChevronLeft size={18} /> : <Menu size={18} />}
        </button>
      </div>

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

        <div className="app-nav-group">
          <div className="app-nav-group-label">Supplier & Transporter</div>
          <NavItem to="/suppliers/directory" label="Lists" icon={Users} />
          <NavItem to="/suppliers/operations" label="Tracker" icon={Truck} />
          <NavItem to="/suppliers/intelligence" label="Reports" icon={TrendingUp} />
        </div>

        {/*<div className="app-nav-group">
          <div className="app-nav-group-label">General Analytics</div>
          <NavItem to="/analytics" label="Dashboard" icon={BarChart2} />
        </div>*/}

      </nav>

      {/*Footer
      <div className="app-sidebar-footer">
        <div className="app-sidebar-footer-label">Status</div>
        <div className="app-sidebar-footer-badge">
          Connected
        </div>
      </div>*/}

    </aside>
  );
}