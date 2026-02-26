import React, { createContext, useState, useEffect, useContext } from "react";

const OrgContext = createContext();

export function OrgProvider({ children }) {
  const [orgs, setOrgs] = useState([
    { id: "F2D TECH PRIVATE LIMITED", label: "F2D (Parent)" },
    { id: "Mithila Foods", label: "Mithila Foods" },
    { id: "Prepto", label: "Prepto" },
    { id: "Howrah Foods", label: "Howrah Foods" }
  ]);
  
  const [activeOrg, setActiveOrg] = useState("Mithila Foods");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if the user previously selected an organization
    const savedOrg = localStorage.getItem("activeOrg");
    if (savedOrg && orgs.some(o => o.id === savedOrg)) {
      setActiveOrg(savedOrg);
    }
  }, [orgs]);

  const changeOrg = (orgId) => {
    setActiveOrg(orgId);
    localStorage.setItem("activeOrg", orgId);
  };

  return (
    <OrgContext.Provider value={{ activeOrg, orgs, changeOrg, loading }}>
      {children}
    </OrgContext.Provider>
  );
}

// Custom hook to use the context easily in any file
export const useOrg = () => useContext(OrgContext);