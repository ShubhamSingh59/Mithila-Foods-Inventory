import React, { useState, useEffect } from "react";
import { getLogisticsByCity, getDoctypeFieldOptions } from "../erpBackendApi";
import { MapPin, Truck, Package, Phone, User, AlertCircle } from "lucide-react";
import "./CityLogisticsHub.css";

export default function CityLogisticsHub() {
  const [selectedCity, setSelectedCity] = useState("");
  const [cityOptions, setCityOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [data, setData] = useState({ suppliers: [], transporters: [] });
  const [loading, setLoading] = useState(false);

  // Load Cities from Metadata
  useEffect(() => {
    async function loadCities() {
      try {
        setOptionsLoading(true);
        // Note: Field name is inside the CHILD doctype, but here we query the list we pasted in Supplier.
        // Actually, for a Table field, the options come from the Child DocType field "city".
        // Let's try fetching options for the 'city' field in 'Transporter Service Area'.
        const opts = await getDoctypeFieldOptions("Transporter Service Area", "city");
        
        if (opts && opts.length > 0) {
          setCityOptions(opts.sort());
        } else {
          console.warn("No city options found in metadata.");
        }
      } catch (e) {
        console.error("Failed to load cities", e);
      } finally {
        setOptionsLoading(false);
      }
    }
    loadCities();
  }, []);

  // Fetch Data when City Changes
  useEffect(() => {
    if (!selectedCity) return;
    async function fetchData() {
      setLoading(true);
      try {
        const result = await getLogisticsByCity(selectedCity);
        setData(result);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedCity]);

  // Helper to extract city name for highlighting
  const currentCityKey = selectedCity ? selectedCity.split(',')[0].trim() : "";

  return (
    <div className="hub-container">
      {/* Header */}
      <div className="hub-header">
        <div className="hub-title-block">
          <h1>City Logistics Hub</h1>
          <p>Match material suppliers with logistics providers by location.</p>
        </div>
        <div className="hub-search-box">
          <MapPin size={20} className="hub-search-icon" />
          <select 
            value={selectedCity} 
            onChange={(e) => setSelectedCity(e.target.value)}
            className="hub-select"
            disabled={optionsLoading}
          >
            <option value="" disabled>
              {optionsLoading ? "Loading Cities..." : "Select a Target City..."}
            </option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="hub-content">
        {/* Left Column: Suppliers (Same as before) */}
        <div className="hub-column">
          <div className="hub-col-header source-header">
            <Package size={20} />
            <h2>Source: Suppliers in {currentCityKey || "City"}</h2>
            <span className="hub-count">{data.suppliers.length}</span>
          </div>
          <div className="hub-list">
            {loading ? <div className="hub-loading">Scanning...</div> : 
             !selectedCity ? <div className="hub-placeholder">Select a city...</div> :
             data.suppliers.length === 0 ? (
               <div className="hub-empty"><AlertCircle size={40}/><p>No suppliers found.</p></div>
             ) : (
               data.suppliers.map((sup) => (
                 <div key={sup.name} className="hub-card source-card">
                   <div className="hub-card-top">
                     <h3>{sup.supplier_name || sup.name}</h3>
                     <span className="hub-badge">{sup.supplier_group}</span>
                   </div>
                   <div className="hub-card-body">
                     {sup.mobile_no && <div className="hub-row"><Phone size={14}/> {sup.mobile_no}</div>}
                     {sup._address && <div className="hub-address-box">{sup._address.address_line1}, {sup._address.city}</div>}
                   </div>
                 </div>
               ))
             )}
          </div>
        </div>

        {/* Connector */}
        <div className="hub-connector">
          <div className="connector-line"></div>
          <div className="connector-icon">⇄</div>
          <div className="connector-line"></div>
        </div>

        {/* Right Column: Transporters */}
        <div className="hub-column">
          <div className="hub-col-header logistics-header">
            <Truck size={20} />
            <h2>Logistics: Service for {currentCityKey || "City"}</h2>
            <span className="hub-count">{data.transporters.length}</span>
          </div>

          <div className="hub-list">
            {loading ? <div className="hub-loading">Checking Routes...</div> : 
             !selectedCity ? <div className="hub-placeholder">Select a city...</div> :
             data.transporters.length === 0 ? (
               <div className="hub-empty"><AlertCircle size={40}/><p>No transporters found.</p></div>
             ) : (
               data.transporters.map((trans) => (
                 <div key={trans.name} className="hub-card logistics-card">
                   <div className="hub-card-top">
                     <h3>{trans.supplier_name || trans.name}</h3>
                     {trans.custom_vehicle_type && <span className="hub-badge vehicle-badge">{trans.custom_vehicle_type}</span>}
                   </div>

                   <div className="hub-card-body">
                     {trans.custom_contact_person && <div className="hub-row"><User size={14}/> {trans.custom_contact_person}</div>}
                     {trans.mobile_no && <div className="hub-row"><Phone size={14}/> {trans.mobile_no}</div>}
                     
                     <div className="hub-route-box">
                       <strong>Servicing:</strong>
                       <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                         {/* ✅ Rendering the Array of Objects */}
                         {Array.isArray(trans.custom_service_areas) && trans.custom_service_areas.length > 0 ? (
                           trans.custom_service_areas.map((row, i) => (
                             <span key={i} style={{ 
                               fontSize: '0.75rem', 
                               padding: '2px 6px', 
                               // Highlight matched city
                               background: row.city && row.city.includes(currentCityKey) ? '#bbf7d0' : '#e2e8f0', 
                               borderRadius: '4px',
                               color: row.city && row.city.includes(currentCityKey) ? '#166534' : 'inherit'
                             }}>
                               {row.city}
                             </span>
                           ))
                         ) : (
                           <span className="text-muted" style={{fontSize:'0.8rem'}}> No areas listed</span>
                         )}
                       </div>
                     </div>
                   </div>
                 </div>
               ))
             )}
          </div>
        </div>
      </div>
    </div>
  );
}