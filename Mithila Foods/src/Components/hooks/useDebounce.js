import { useState, useEffect } from "react";

// This hook receives a value (like search text) and a delay (in ms)
// It only updates 'debouncedValue' after the delay has passed without changes
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Set a timer to update the value
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cancel the timer if the user types again (value changes)
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}