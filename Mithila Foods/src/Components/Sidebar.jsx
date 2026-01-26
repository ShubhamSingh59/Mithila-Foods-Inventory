// src/Components/Sidebar.jsx
import React from "react";
import { NavLink } from "react-router-dom";
import { 
  Menu, ChevronLeft, 
  BarChart2, Package, Layers, 
  ShoppingCart, Truck, Briefcase, 
  ClipboardList, Activity 
} from "lucide-react";

export default function Sidebar({ isOpen, toggleSidebar }) {

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
          <div className="app-nav-group-label">Partners</div>
          <NavItem to="/suppliers" label="Suppliers & Transporters" icon={Truck} />
        </div>

        <div className="app-nav-group">
          <div className="app-nav-group-label">Analytics</div>
          <NavItem to="/analytics" label="Analytics" icon={BarChart2} />
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