import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeName = "navy-trust" | "emerald-prestige" | "industrial-amber" | "ocean-deep";
export type ThemeMode = "light" | "dark";

export const THEMES: { id: ThemeName; label: string; swatch: string[] }[] = [
  { id: "navy-trust", label: "Navy Trust", swatch: ["#0f1b3d", "#1e3a5f", "#3b6fa0", "#e8a83a"] },
  { id: "emerald-prestige", label: "Emerald Prestige", swatch: ["#064e3b", "#0d7a5f", "#c9a84c", "#f5f0e0"] },
  { id: "industrial-amber", label: "Industrial Amber", swatch: ["#1a1f2e", "#2d3748", "#f59e0b", "#f8fafc"] },
  { id: "ocean-deep", label: "Ocean Deep", swatch: ["#0c2340", "#1a4a6e", "#2d8a9e", "#5cbdb9"] },
];

type ThemeCtx = {
  theme: ThemeName;
  mode: ThemeMode;
  setTheme: (t: ThemeName) => void;
  setMode: (m: ThemeMode) => void;
  toggleMode: () => void;
};

const Ctx = createContext<ThemeCtx | null>(null);
const STORAGE_KEY = "dlax.theme";

function readStored(): { theme: ThemeName; mode: ThemeMode } {
  if (typeof window === "undefined") return { theme: "navy-trust", mode: "light" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        theme: (parsed.theme as ThemeName) || "navy-trust",
        mode: (parsed.mode as ThemeMode) || "light",
      };
    }
  } catch {}
  return { theme: "navy-trust", mode: "light" };
}

function apply(theme: ThemeName, mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.classList.toggle("dark", mode === "dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>("navy-trust");
  const [mode, setModeState] = useState<ThemeMode>("light");

  // Hydrate from localStorage on mount (client-only)
  useEffect(() => {
    const stored = readStored();
    setThemeState(stored.theme);
    setModeState(stored.mode);
    apply(stored.theme, stored.mode);
  }, []);

  const persist = (t: ThemeName, m: ThemeMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: t, mode: m }));
    } catch {}
  };

  const setTheme = (t: ThemeName) => {
    setThemeState(t);
    apply(t, mode);
    persist(t, mode);
  };
  const setMode = (m: ThemeMode) => {
    setModeState(m);
    apply(theme, m);
    persist(theme, m);
  };
  const toggleMode = () => setMode(mode === "light" ? "dark" : "light");

  return (
    <Ctx.Provider value={{ theme, mode, setTheme, setMode, toggleMode }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used within ThemeProvider");
  return v;
}
