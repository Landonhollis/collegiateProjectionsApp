import { vars } from "nativewind";
import type { ViewStyle } from "react-native";

// Light and dark palettes from ../ColorsGuide.md. The one place color values live.
// tailwind.config.js maps each class (bg-surface, text-ink, …) to a CSS variable; themeVars below
// sets those variables for the current scheme, so every NativeWind class switches automatically.
// Use `colors` from useTheme() only where a class can't reach (icon colors, placeholder text).

export type Scheme = "light" | "dark";

const light = {
  canvas: "#F4F5F6",
  surface: "#FFFFFF",
  bar: "#FFFFFF", // the top bar and bottom menu (same as surface in light mode)
  inset: "#EBEBEC",
  hairline: "#E2E5E8",
  edge: "#96A0AB",
  rowEdge: "#96A0AB", // the outline of the floating row's bar at the top of each tab screen (same as edge in light mode)
  slate: "#4A5A6E",
  charcoal: "#333A41",
  ink: "#27313C",
  muted: "#4A5A6E",
  onDark: "#F2F3F5",
  onAccent: "#1F2731",
  danger: "#B93939", // cherry ink
  accent: "#4FA8DD", // sky
  accentTint: "#E5F2FA",
  accentInk: "#377297",
  green: "#3DB86A", // the add button (its own green, not one of the guide accents)
};
export type Palette = typeof light;

const dark: Palette = {
  canvas: "#16191E",
  surface: "#242930",
  bar: "#2B3037", // a step lighter than surface, so the bars stand off the cards
  inset: "#31373E",
  hairline: "#373E46",
  edge: "#5A646F",
  rowEdge: "#F2F3F5", // the same as ink, the text color (the user's call), so the three bars are easy to notice
  slate: "#4A5A6E",
  charcoal: "#242930", // light mode only in the guide; dark falls back to surface
  ink: "#F2F3F5",
  muted: "#9A9CA0",
  onDark: "#F2F3F5",
  onAccent: "#1F2731",
  danger: "#E47979", // cherry ink, dark
  accent: "#4FA8DD",
  accentTint: "#334D60",
  accentInk: "#4FA8DD",
  green: "#3DB86A",
};

export const PALETTES: Record<Scheme, Palette> = { light, dark };

/** "#4FA8DD" → "79 168 221" (the format tailwind's rgb(var(--x) / <alpha-value>) needs). */
function rgbTriplet(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Palette key → CSS variable name used in tailwind.config.js, e.g. accentTint → --accent-tint. */
function varName(key: string): string {
  return `--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

function toVars(palette: Palette) {
  const out: Record<string, string> = {};
  for (const [key, hex] of Object.entries(palette)) out[varName(key)] = rgbTriplet(hex);
  return vars(out);
}

/** Style that sets every color variable; put it on the root View. */
export const themeVars: Record<Scheme, ReturnType<typeof vars>> = { light: toVars(light), dark: toVars(dark) };

/**
 * "Every pressable carries a lift" (ColorsGuide).
 * Light: soft shadow. Dark: shadows vanish, so a 1px lit top edge instead (the chevron carries the rest).
 */
export const LIFTS: Record<Scheme, ViewStyle> = {
  light: { shadowColor: "#101820", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  dark: { borderTopWidth: 1, borderTopColor: "rgba(255, 255, 255, 0.10)" },
};

/**
 * How thick an outline in a case color is (entity and case cards, edit popups, outcome rows).
 * Light mode is 1.5x thicker: a thin colored line gets lost on the white cards.
 */
export const CASE_BORDER_WIDTHS: Record<Scheme, number> = { light: 1.5, dark: 1 };

/** "#4FA8DD", 0.12 → "#4FA8DD1F" (hex with alpha), for tints of a dynamic color like a case color. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

/** Text color on a filled accent / case color. Plum and brick take light text; everything else takes dark (ColorsGuide). */
export function textOnColor(hex: string): string {
  const light = ["#A05A8F", "#B4532E"].includes(hex.toUpperCase());
  return light ? PALETTES.light.onDark : PALETTES.light.onAccent;
}

/** Colors a user can give a case: the accent bases from ColorsGuide.md. */
export const CASE_COLORS: { name: string; hex: string }[] = [
  { name: "Coral", hex: "#E8735A" },
  { name: "Tangerine", hex: "#F2862A" },
  { name: "Gold", hex: "#D9A441" },
  { name: "Lime", hex: "#A9C23F" },
  { name: "Seafoam", hex: "#6FC7B0" },
  { name: "Sky", hex: "#4FA8DD" },
  { name: "Lilac", hex: "#9A84D6" },
  { name: "Plum", hex: "#A05A8F" },
  { name: "Rose", hex: "#DB6680" },
  { name: "Cherry", hex: "#D8403F" },
  { name: "Brick", hex: "#B4532E" },
];

/** "#4FA8DD" → "Sky". A color not in the list shows as its hex. */
export function caseColorName(hex: string): string {
  return CASE_COLORS.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex;
}
