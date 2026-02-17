import * as React from "react";

const STORAGE_KEY = "soctivcrm-theme-config";

export type ThemeColor = "slate" | "blue" | "emerald" | "amber" | "rose" | "classic";

export type ThemeConfig = {
  color: ThemeColor;
  radius: number;
};

const DEFAULT_CONFIG: ThemeConfig = {
  color: "slate",
  radius: 8,
};

type ThemeConfigContextValue = {
  config: ThemeConfig;
  setColor: (color: ThemeColor) => void;
  setRadius: (radius: number) => void;
  reset: () => void;
};

const ThemeConfigContext = React.createContext<ThemeConfigContextValue | null>(null);

const clampRadius = (value: number) => Math.min(20, Math.max(4, value));

const readStoredConfig = (): ThemeConfig => {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<ThemeConfig>;
    if (!parsed || typeof parsed !== "object") return DEFAULT_CONFIG;
    const color = (parsed.color as ThemeColor) || DEFAULT_CONFIG.color;
    const radius = typeof parsed.radius === "number" ? clampRadius(parsed.radius) : DEFAULT_CONFIG.radius;
    return {
      color,
      radius,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
};

const applyThemeConfig = (config: ThemeConfig) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = config.color;
  root.style.setProperty("--radius", `${config.radius}px`);
};

export function ThemeConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = React.useState<ThemeConfig>(() => readStoredConfig());

  React.useEffect(() => {
    applyThemeConfig(config);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignore storage errors (private mode, quota)
    }
  }, [config]);

  const value = React.useMemo<ThemeConfigContextValue>(
    () => ({
      config,
      setColor: (color) => setConfig((prev) => ({ ...prev, color })),
      setRadius: (radius) => setConfig((prev) => ({ ...prev, radius: clampRadius(radius) })),
      reset: () => setConfig(DEFAULT_CONFIG),
    }),
    [config],
  );

  return <ThemeConfigContext.Provider value={value}>{children}</ThemeConfigContext.Provider>;
}

export function useThemeConfig() {
  const context = React.useContext(ThemeConfigContext);
  if (!context) {
    throw new Error("useThemeConfig must be used within ThemeConfigProvider");
  }
  return context;
}
