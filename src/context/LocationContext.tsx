"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface Location {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

interface LocationContextValue {
  location: Location | null;
  setLocation: (loc: Location) => void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

const STORAGE_KEY = "skywatch-location";

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<Location | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setLocationState(JSON.parse(saved));
      } catch {
      }
    }
  }, []);

  const setLocation = (loc: Location) => {
    setLocationState(loc);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  };

  return (
    <LocationContext.Provider value={{ location, setLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
}
