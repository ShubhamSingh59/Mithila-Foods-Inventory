//// src/Components/SupplierAndTransporter/TransporterCreateForm.jsx
//import React, { useState } from "react";
//import { useNavigate } from "react-router-dom";
//import { createDoc } from "../erpBackendApi";
//import "./SupplierForm.css";

//export default function TransporterCreateForm() {
//  const navigate = useNavigate();
//  const [loading, setLoading] = useState(false);
//  const [error, setError] = useState("");

//  const [formData, setFormData] = useState({
//    supplier_name: "",
//    supplier_group: "Transporter", // Fixed
//    is_transporter: 1, // Fixed
//    supplier_type: "Company",
//    custom_status: "Active",
//    custom_contact_person: "",
//    mobile_no: "",
//    email_id: "",
    
//    // Transporter Specific
//    custom_vehicle_type: "",
    
//    // Financials
//    pan: "",
//    gstin: "",
//    gst_category: "Registered Regular",
    
//    country: "India"
//  });

//  // Service Areas Child Table
//  const [serviceAreas, setServiceAreas] = useState([{ city: "" }]);

//  const handleChange = (e) => {
//    const { name, value } = e.target;
//    setFormData(prev => ({ ...prev, [name]: value }));
//  };

//  const handleCityChange = (index, val) => {
//    const list = [...serviceAreas];
//    list[index].city = val;
//    setServiceAreas(list);
//  };

//  const addCity = () => {
//    setServiceAreas([...serviceAreas, { city: "" }]);
//  };

//  const removeCity = (index) => {
//    if (serviceAreas.length === 1) return; // keep at least one
//    const list = [...serviceAreas];
//    list.splice(index, 1);
//    setServiceAreas(list);
//  };

//  const handleSubmit = async (e) => {
//    e.preventDefault();
//    setError("");
//    setLoading(true);

//    try {
//      if (!formData.supplier_name) throw new Error("Transporter Name is required");

//      // Filter empty cities
//      const validCities = serviceAreas.filter(a => a.city.trim() !== "");

//      const payload = {
//        doctype: "Supplier",
//        ...formData,
//        // Map child table
//        custom_service_areas: validCities
//      };

//      await createDoc("Supplier", payload);
//      alert("Transporter created successfully!");
//      navigate("/suppliers/transporters");
//    } catch (err) {
//      console.error(err);
//      setError(err.response?.data?.exception || err.message || "Failed to create transporter");
//    } finally {
//      setLoading(false);
//    }
//  };

//  return (
//    <div className="sf-container">
//      <form onSubmit={handleSubmit} className="sf-card">
//        <div className="sf-header">
//          <h2 className="sf-title">Create New Transporter</h2>
//          <div className="sf-subtitle">Register a logistics provider & service areas</div>
//        </div>

//        {error && <div className="sf-error">{error}</div>}

//        <div className="sf-section-label">Basic Information</div>
//        <div className="sf-grid">
//          <div className="sf-field">
//            <label className="sf-label">Transporter Name *</label>
//            <input className="sf-input" name="supplier_name" value={formData.supplier_name} onChange={handleChange} required placeholder="e.g. Speed Logistics" />
//          </div>

//          <div className="sf-field">
//            <label className="sf-label">Status</label>
//            <select className="sf-select" name="custom_status" value={formData.custom_status} onChange={handleChange}>
//              <option value="Active">Active</option>
//              <option value="Inactive">Inactive</option>
//              <option value="Blacklisted">Blacklisted</option>
//            </select>
//          </div>
          
//           <div className="sf-field">
//            <label className="sf-label">Vehicle Types</label>
//            <input className="sf-input" name="custom_vehicle_type" value={formData.custom_vehicle_type} onChange={handleChange} placeholder="e.g. Tata Ace, 32ft Truck" />
//          </div>
//        </div>

//        <div className="sf-section-label" style={{marginTop: 30}}>Contact & Compliance</div>
//        <div className="sf-grid">
//          <div className="sf-field">
//            <label className="sf-label">Contact Person</label>
//            <input className="sf-input" name="custom_contact_person" value={formData.custom_contact_person} onChange={handleChange} />
//          </div>
//          <div className="sf-field">
//            <label className="sf-label">Mobile Number</label>
//            <input className="sf-input" name="mobile_no" value={formData.mobile_no} onChange={handleChange} />
//          </div>
//          <div className="sf-field">
//            <label className="sf-label">GSTIN</label>
//            <input className="sf-input" name="gstin" value={formData.gstin} onChange={handleChange} />
//          </div>
//           <div className="sf-field">
//            <label className="sf-label">PAN</label>
//            <input className="sf-input" name="pan" value={formData.pan} onChange={handleChange} />
//          </div>
//        </div>

//        <div className="sf-section-label" style={{marginTop: 30}}>Service Areas (Cities)</div>
//        <div className="sf-field">
//          <table className="sf-child-table">
//             <thead>
//                <tr>
//                   <th>City</th>
//                   <th style={{width: 60}}></th>
//                </tr>
//             </thead>
//             <tbody>
//                {serviceAreas.map((row, idx) => (
//                   <tr key={idx}>
//                      <td>
//                         <input 
//                           className="sf-input" 
//                           value={row.city} 
//                           onChange={e => handleCityChange(idx, e.target.value)} 
//                           placeholder="Enter city name..."
//                         />
//                      </td>
//                      <td>
//                         <button type="button" className="sf-row-btn" onClick={() => removeCity(idx)}>✕</button>
//                      </td>
//                   </tr>
//                ))}
//             </tbody>
//          </table>
//          <button type="button" className="sf-add-btn" onClick={addCity}>+ Add City</button>
//        </div>

//        <div className="sf-actions">
//          <button type="button" className="sf-btn sf-btn-outline" onClick={() => navigate(-1)}>Cancel</button>
//          <button type="submit" className="sf-btn sf-btn-primary" disabled={loading}>
//            {loading ? "Creating..." : "Create Transporter"}
//          </button>
//        </div>
//      </form>
//    </div>
//  );
//}

import React from "react";
import SupplierCreateForm from "./SupplierCreateForm";

export default function TransporterCreateForm() {
  return <SupplierCreateForm isTransporter={true} />;
}