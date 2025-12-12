import { useEffect } from "react";
import { onStockChanged } from "./erpBackendApi";
import { useLocation } from "react-router-dom";

export function useStockAutoRefresh(loadFn) {
  const location = useLocation();

  // 1) refresh when route changes (when you come back to this page)
  useEffect(() => {
    loadFn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // 2) refresh when any stock doc is submitted
  useEffect(() => {
    let t;
    const off = onStockChanged(() => {
      clearTimeout(t);
      t = setTimeout(() => loadFn(), 250); // small debounce
    });
    return () => {
      clearTimeout(t);
      off();
    };
  }, [loadFn]);

  // 3) refresh when browser tab focuses
  useEffect(() => {
    const onFocus = () => loadFn();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadFn]);
}
