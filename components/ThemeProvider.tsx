"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

interface ThemeContextValue {
  effective: "light" | "dark";
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  effective: "light",
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

const STORAGE_KEY = "theme-preference";

function getSystemDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getStored(): "light" | "dark" | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {}
  return null;
}

function apply(effective: "light" | "dark") {
  document.documentElement.classList.toggle("dark", effective === "dark");
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [effective, setEffective] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = getStored();
    const init = stored ?? (getSystemDark() ? "dark" : "light");
    setEffective(init);
    apply(init);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function handleChange() {
      if (getStored() === null) {
        const next = mq.matches ? "dark" : "light";
        setEffective(next);
        apply(next);
      }
    }
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  const toggle = useCallback(() => {
    setEffective((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
      apply(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ effective, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
