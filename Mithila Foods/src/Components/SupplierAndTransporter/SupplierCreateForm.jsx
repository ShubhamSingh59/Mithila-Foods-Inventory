import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  createDoc, 
  getDoctypeList, 
  uploadFileToDoc, 
  updateDoc 
} from "../api/core";
import "./SupplierForm.css";

export default function SupplierCreateForm({ isTransporter = false }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [supplierGroups, setSupplierGroups] = useState([]);

  const [formData, setFormData] = useState({
    supplier_name: "",
    supplier_group: isTransporter ? "Transporter" : "",
    supplier_type: "Company",
    custom_status: "Active",
    custom_contact_person: "",
    mobile_no: "",
    email_id: "",
    
    // Financials
    pan: "",
    gstin: "",
    gst_category: "Registered Regular",
    custom_msme: "",
    custom_udyam: "",
    custom_fssai: "",
    custom_credit_limit: "",
    payment_terms: "",
    
    custom_vehicle_type: "",
    
    country: "India"
  });

  const [serviceAreas, setServiceAreas] = useState([{ city: "" }]);

  const [files, setFiles] = useState({
    custom_payment_qr: null,
    custom_gst_attach: null,
    custom_msme_attach: null,
    custom_pancard_attach: null,
    custom_fssai_attach: null
  });

  useEffect(() => {
    async function loadMasterData() {
      try {
        if (!isTransporter) {
          const groups = await getDoctypeList("Supplier Group");
          setSupplierGroups(groups || []);
          if (groups.length > 0 && !formData.supplier_group) {
             const def = groups.find(g => g.name === "Raw Material") ? "Raw Material" : groups[0].name;
             setFormData(prev => ({ ...prev, supplier_group: def }));
          }
        }
      } catch (e) {
        console.error("Failed to load supplier groups", e);
      }
    }
    loadMasterData();
  }, [isTransporter]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const { name, files: selectedFiles } = e.target;
    if (selectedFiles && selectedFiles[0]) {
      setFiles(prev => ({ ...prev, [name]: selectedFiles[0] }));
    }
  };

  const handleCityChange = (index, val) => {
    const list = [...serviceAreas];
    list[index].city = val;
    setServiceAreas(list);
  };
  const addCity = () => setServiceAreas([...serviceAreas, { city: "" }]);
  const removeCity = (index) => {
    if (serviceAreas.length === 1) return;
    const list = [...serviceAreas];
    list.splice(index, 1);
    setServiceAreas(list);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!formData.supplier_name) throw new Error(`${isTransporter ? 'Transporter' : 'Supplier'} Name is required`);

      const payload = {
        doctype: "Supplier",
        ...formData,
        is_transporter: isTransporter ? 1 : 0
      };

      if (isTransporter) {
        payload.custom_service_areas = serviceAreas.filter(a => a.city.trim() !== "");
      }

      const res = await createDoc("Supplier", payload);
      const newName = res.data.name;

      const fileKeys = Object.keys(files);
      const updates = {};
      let hasUpdates = false;

      for (const key of fileKeys) {
        if (files[key]) {
          try {
            const uploadRes = await uploadFileToDoc({
              doctype: "Supplier",
              docname: newName,
              file: files[key],
              is_private: 0 // Public so it can be viewed easily
            });
            
            const fileUrl = uploadRes.data.message.file_url;
            updates[key] = fileUrl;
            hasUpdates = true;
          } catch (uploadErr) {
            console.error(`Failed to upload ${key}`, uploadErr);
          }
        }
      }

      if (hasUpdates) {
        await updateDoc("Supplier", newName, updates);
      }

      alert(`${isTransporter ? 'Transporter' : 'Supplier'} Created Successfully!`);
      navigate(isTransporter ? "/suppliers/transporters" : "/suppliers/list");

    } catch (err) {
      console.error(err);
      setError(err.response?.data?.exception || err.message || "Failed to create entry");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sf-container">
      <form onSubmit={handleSubmit} className="sf-card">
        <div className="sf-header">
          <h2 className="sf-title">{isTransporter ? "Register New Transporter" : "Register New Supplier"}</h2>
          <div className="sf-subtitle">Fill in details and attach documents</div>
        </div>

        {error && <div className="sf-error">{error}</div>}

        {/* --- SECTION 1: BASIC INFO --- */}
        <div className="sf-section-label">Basic Information</div>
        <div className="sf-grid">
          <div className="sf-field">
            <label className="sf-label">Name *</label>
            <input className="sf-input" name="supplier_name" value={formData.supplier_name} onChange={handleChange} required placeholder={isTransporter ? "e.g. Speed Logistics" : "e.g. ABC Pvt Ltd"} />
          </div>

          <div className="sf-field">
            <label className="sf-label">Supplier Group</label>
            {isTransporter ? (
              <input className="sf-input" value="Transporter" disabled style={{ background: '#f9fafb', color: '#64748b' }} />
            ) : (
              <select className="sf-select" name="supplier_group" value={formData.supplier_group} onChange={handleChange}>
                <option value="" disabled>-- Select Group --</option>
                {supplierGroups.map(g => (
                  <option key={g.name} value={g.name}>{g.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="sf-field">
            <label className="sf-label">Supplier Type</label>
            <select className="sf-select" name="supplier_type" value={formData.supplier_type} onChange={handleChange}>
              <option value="Company">Company</option>
              <option value="Individual">Individual</option>
              <option value="Partnership">Partnership</option>
            </select>
          </div>

          <div className="sf-field">
            <label className="sf-label">Status</label>
            <select className="sf-select" name="custom_status" value={formData.custom_status} onChange={handleChange}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Blacklisted">Blacklisted</option>
            </select>
          </div>

          {isTransporter && (
             <div className="sf-field">
              <label className="sf-label">Vehicle Types</label>
              <input className="sf-input" name="custom_vehicle_type" value={formData.custom_vehicle_type} onChange={handleChange} placeholder="e.g. Tata Ace, 32ft Truck" />
            </div>
          )}
        </div>

        {/* --- SECTION 2: CONTACT --- */}
        <div className="sf-section-label" style={{marginTop: 30}}>Contact Details</div>
        <div className="sf-grid">
          <div className="sf-field">
            <label className="sf-label">Contact Person</label>
            <input className="sf-input" name="custom_contact_person" value={formData.custom_contact_person} onChange={handleChange} />
          </div>
          <div className="sf-field">
            <label className="sf-label">Mobile Number</label>
            <input className="sf-input" name="mobile_no" value={formData.mobile_no} onChange={handleChange} />
          </div>
          <div className="sf-field">
            <label className="sf-label">Email Address</label>
            <input className="sf-input" type="email" name="email_id" value={formData.email_id} onChange={handleChange} />
          </div>
        </div>

        {/* --- SECTION 3: FINANCIALS & UPLOADS --- */}
        <div className="sf-section-label" style={{marginTop: 30}}>Financials & Compliance</div>
        <div className="sf-grid">
          <div className="sf-field">
            <label className="sf-label">GSTIN</label>
            <input className="sf-input" name="gstin" value={formData.gstin} onChange={handleChange} />
          </div>
          <div className="sf-field">
            <label className="sf-label">PAN</label>
            <input className="sf-input" name="pan" value={formData.pan} onChange={handleChange} />
          </div>
          <div className="sf-field">
            <label className="sf-label">GST Category</label>
            <select className="sf-select" name="gst_category" value={formData.gst_category} onChange={handleChange}>
              <option value="Registered Regular">Registered Regular</option>
              <option value="Registered Composition">Registered Composition</option>
              <option value="Unregistered">Unregistered</option>
              <option value="Overseas">Overseas</option>
            </select>
          </div>
           <div className="sf-field">
            <label className="sf-label">Credit Limit (₹)</label>
            <input className="sf-input" type="number" name="custom_credit_limit" value={formData.custom_credit_limit} onChange={handleChange} />
          </div>
          <div className="sf-field">
             <label className="sf-label">Payment Terms</label>
             <input className="sf-input" name="payment_terms" value={formData.payment_terms} onChange={handleChange} placeholder="e.g. Net 30" />
          </div>
          <div className="sf-field">
            <label className="sf-label">FSSAI License No.</label>
            <input className="sf-input" name="custom_fssai" value={formData.custom_fssai} onChange={handleChange} />
          </div>
        </div>

        {/* --- ATTACHMENTS GRID --- */}
        <div className="sf-section-label" style={{marginTop: 30}}>Attachments</div>
        <div className="sf-grid">
          
          <div className="sf-field">
            <label className="sf-label">Payment QR Code (Image)</label>
            <input className="sf-file-input" type="file" accept="image/*" name="custom_payment_qr" onChange={handleFileChange} />
            <div className="sf-file-hint">Upload UPI QR code</div>
          </div>

          <div className="sf-field">
            <label className="sf-label">GST Certificate</label>
            <input className="sf-file-input" type="file" name="custom_gst_attach" onChange={handleFileChange} />
          </div>

          <div className="sf-field">
            <label className="sf-label">PAN Card</label>
            <input className="sf-file-input" type="file" name="custom_pancard_attach" onChange={handleFileChange} />
          </div>

          <div className="sf-field">
            <label className="sf-label">MSME Certificate</label>
            <input className="sf-file-input" type="file" name="custom_msme_attach" onChange={handleFileChange} />
          </div>

           <div className="sf-field">
            <label className="sf-label">FSSAI Certificate</label>
            <input className="sf-file-input" type="file" name="custom_fssai_attach" onChange={handleFileChange} />
          </div>
        </div>

        {/* --- SECTION 4: SERVICE AREAS (Transporter Only) --- */}
        {isTransporter && (
          <>
            <div className="sf-section-label" style={{marginTop: 30}}>Service Areas (Cities)</div>
            <div className="sf-field">
              <table className="sf-child-table">
                 <thead>
                    <tr>
                       <th>City</th>
                       <th style={{width: 60}}></th>
                    </tr>
                 </thead>
                 <tbody>
                    {serviceAreas.map((row, idx) => (
                       <tr key={idx}>
                          <td>
                             <input 
                               className="sf-input" 
                               value={row.city} 
                               onChange={e => handleCityChange(idx, e.target.value)} 
                               placeholder="Enter city name..."
                             />
                          </td>
                          <td>
                             <button type="button" className="sf-row-btn" onClick={() => removeCity(idx)}>✕</button>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
              <button type="button" className="sf-add-btn" onClick={addCity}>+ Add City</button>
            </div>
          </>
        )}

        <div className="sf-actions">
          <button type="button" className="sf-btn sf-btn-outline" onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" className="sf-btn sf-btn-primary" disabled={loading}>
            {loading ? "Creating..." : `Create ${isTransporter ? 'Transporter' : 'Supplier'}`}
          </button>
        </div>
      </form>
    </div>
  );
}