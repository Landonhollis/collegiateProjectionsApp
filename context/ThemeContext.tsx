import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { View, useColorScheme, type ViewStyle } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { LIFTS, PALETTES, themeVars, type Palette, type Scheme } from "../components/theme";

// Light / dark mode for the whole app. The user's choice is saved on the phone (like cases and entities)
// and loaded on app start. "system" follows the phone's setting.

const THEME_MODE_KEY = "themeMode";
export type ThemeMode = "system" | "light" | "dark";
const THEME_MODES: ThemeMode[] = ["system", "light", "dark"];

type Theme = {
  mode: ThemeMode; // what the user picked
  scheme: Scheme; // what's actually showing
  setMode: (mode: ThemeMode) => void;
  colors: Palette; // hex values for icons / placeholders (classes switch on their own)
  lift: ViewStyle; // pressable lift for the current scheme
};

const ThemeContext = createContext<Theme | null>(null);

function parseThemeMode(value: string | null): ThemeMode {
  if (value === null) return "system"; // nothing saved yet
  const mode = THEME_MODES.find((m) => m === value);
  if (!mode) throw new Error(`Saved theme mode "${value}" is not one of ${THEME_MODES.join(", ")}`);
  return mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme(); // "light" | "dark" | null/undefined (unknown)
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(THEME_MODE_KEY)
      .then((value) => {
        setModeState(parseThemeMode(value));
        setIsLoaded(true);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  }, []);

  if (error) throw new Error(`Theme: ${error.message}`);
  if (!isLoaded) return null;

  function setMode(next: ThemeMode) {
    setModeState(next);
    AsyncStorage.setItem(THEME_MODE_KEY, next).catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  }

  const scheme: Scheme = mode === "system" ? (system === "dark" ? "dark" : "light") : mode;

  return (
    <ThemeContext.Provider value={{ mode, scheme, setMode, colors: PALETTES[scheme], lift: LIFTS[scheme] }}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <View style={[{ flex: 1 }, themeVars[scheme]]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme must be used inside ThemeProvider");
  return theme;
}
