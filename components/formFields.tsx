import { useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { CASE_COLORS, caseColorName } from "./theme";
import type { Age, Case } from "../TypesAndVariables/types";

// Building blocks for the edit entity cards. Inputs hold text; the parse functions turn it into
// numbers (null = not valid yet), so a card can disable its Add/Done button until everything parses.

// ── parsing ──────────────────────────────────────────────────────────────────
/** Whole dollars ≥ 0, e.g. "350000" or "350,000". */
export function parseDollars(text: string): number | null {
  const clean = text.replace(/,/g, "").trim();
  return /^\d+$/.test(clean) ? Number(clean) : null;
}

/** Percent 0–100, decimals allowed, e.g. "6.5". */
export function parsePercent(text: string): number | null {
  const clean = text.trim();
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const n = Number(clean);
  return n <= 100 ? n : null;
}

/** Whole number ≥ min, e.g. a loan term in years. */
export function parseWhole(text: string, min = 0): number | null {
  const clean = text.trim();
  if (!/^\d+$/.test(clean)) return null;
  const n = Number(clean);
  return n >= min ? n : null;
}

export type AgeText = { years: string; months: string };
export const EMPTY_AGE: AgeText = { years: "", months: "" };

export function ageToText(age: Age | null | undefined): AgeText {
  return age ? { years: String(age.years), months: String(age.months) } : EMPTY_AGE;
}

/** Saved age (from entity.inputs, typed unknown) → text boxes. Anything that isn't an age → blank. */
export function readAgeText(value: unknown): AgeText {
  if (typeof value !== "object" || value === null) return EMPTY_AGE;
  const { years, months } = value as Record<string, unknown>;
  return typeof years === "number" && typeof months === "number" ? ageToText({ years, months }) : EMPTY_AGE;
}

/** Saved number (from entity.inputs, typed unknown) → text box. */
export function readNumberText(value: unknown): string {
  return typeof value === "number" ? String(value) : "";
}

/** Saved dollars → text box with thousands commas, e.g. 350000 → "350,000". */
export function readDollarsText(value: unknown): string {
  return typeof value === "number" ? formatDollars(value) : "";
}

/** 350000 → "350,000". */
export function formatDollars(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Optional age: both blank → null (not given). undefined = invalid. Blank months = 0. */
export function parseOptionalAge(text: AgeText): Age | null | undefined {
  if (text.years.trim() === "" && text.months.trim() === "") return null;
  const years = parseWhole(text.years);
  const months = text.months.trim() === "" ? 0 : parseWhole(text.months);
  if (years === null || months === null || months > 11) return undefined;
  return { years, months };
}

// ── fields ───────────────────────────────────────────────────────────────────
// Look (from the design reference): filled inset boxes, 56px tall, 16px corners. A box outlines in the
// accent while focused and in danger when its text doesn't parse; the error text says why in plain words.

/** Label above any input (+ optional hint on the right, error text below). Keep labels to one or two words. */
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <View className="mb-5">
      <View className="mb-2 flex-row items-baseline justify-between">
        <Text className="font-inter-semibold text-[13px] text-muted">{label}</Text>
        {hint ? <Text className="font-inter text-xs text-muted">{hint}</Text> : null}
      </View>
      {children}
      {error ? <Text className="mt-1.5 font-inter-medium text-xs text-danger">{error}</Text> : null}
    </View>
  );
}

/** Border color for an input box: danger if invalid, accent while focused, otherwise none. */
function boxBorder(focused: boolean, invalid: boolean): string {
  return invalid ? "border-danger" : focused ? "border-accent" : "border-transparent";
}

type InputBoxProps = {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad" | "number-pad";
  prefix?: string;
  suffix?: string;
  invalid?: boolean;
  autoCapitalize?: "none" | "words" | "sentences";
  onBlur?: () => void;
  accessibilityLabel: string;
};

/** One filled input box. Tapping anywhere on it (prefix / suffix too) focuses the input. */
function InputBox(props: InputBoxProps) {
  const { colors } = useTheme();
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      onPress={() => input.current?.focus()}
      className={`h-14 flex-row items-center rounded-2xl border-[1.5px] bg-inset px-4 ${boxBorder(focused, props.invalid ?? false)}`}
      accessible={false}
    >
      {props.prefix ? <Text className="mr-1.5 font-inter-semibold text-base text-muted">{props.prefix}</Text> : null}
      <TextInput
        ref={input}
        className="h-full flex-1 font-inter text-base text-ink"
        value={props.value}
        onChangeText={props.onChange}
        placeholder={props.placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={props.keyboardType ?? "default"}
        autoCapitalize={props.autoCapitalize ?? "sentences"}
        returnKeyType="done"
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          props.onBlur?.();
        }}
        selectionColor={colors.accent}
        accessibilityLabel={props.accessibilityLabel}
      />
      {props.suffix ? <Text className="ml-1.5 font-inter-semibold text-base text-muted">{props.suffix}</Text> : null}
    </Pressable>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <InputBox value={value} onChange={onChange} placeholder={placeholder} autoCapitalize="words" accessibilityLabel={label} />
    </Field>
  );
}

type NumberFieldProps = {
  label: string;
  value: string;
  onChange: (text: string) => void;
  /** "dollars" adds the $ and formats with commas when you leave the box (350000 → 350,000). */
  kind?: "dollars" | "percent" | "years" | "number";
  hint?: string;
  error?: string | null; // shown under the box; also outlines it in danger
};

export function NumberField({ label, value, onChange, kind = "number", hint, error }: NumberFieldProps) {
  function onBlur() {
    if (kind !== "dollars") return;
    const n = parseDollars(value);
    if (n !== null) onChange(formatDollars(n));
  }
  return (
    <Field label={label} hint={hint} error={error}>
      <InputBox
        value={value}
        onChange={onChange}
        placeholder="0"
        keyboardType={kind === "percent" ? "decimal-pad" : "number-pad"}
        prefix={kind === "dollars" ? "$" : undefined}
        suffix={kind === "percent" ? "%" : kind === "years" ? "yrs" : undefined}
        invalid={!!error}
        onBlur={onBlur}
        accessibilityLabel={label}
      />
    </Field>
  );
}

/** Two boxes, years and months. Leave both blank for "not given". */
export function AgeField({
  label,
  value,
  onChange,
  hint,
  error,
}: {
  label: string;
  value: AgeText;
  onChange: (age: AgeText) => void;
  hint?: string;
  error?: string | null;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <InputBox
            value={value.years}
            onChange={(years) => onChange({ ...value, years })}
            placeholder="—"
            keyboardType="number-pad"
            suffix="yrs"
            invalid={!!error}
            accessibilityLabel={`${label}, years`}
          />
        </View>
        <View className="flex-1">
          <InputBox
            value={value.months}
            onChange={(months) => onChange({ ...value, months })}
            placeholder="0"
            keyboardType="number-pad"
            suffix="mos"
            invalid={!!error}
            accessibilityLabel={`${label}, months`}
          />
        </View>
      </View>
    </Field>
  );
}

// ── pickers ──────────────────────────────────────────────────────────────────
type Option = { key: string; label: string; dotColor?: string };

/** A filled box that opens a list under it. Shared by CaseDropdown and ColorDropdown. */
function Dropdown({
  label,
  options,
  selectedKey,
  onChange,
  placeholder,
  emptyText,
}: {
  label: string;
  options: Option[];
  selectedKey: string | null;
  onChange: (key: string) => void;
  placeholder: string;
  emptyText: string;
}) {
  const { colors, lift } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.key === selectedKey) ?? null;
  const empty = options.length === 0;

  return (
    <Field label={label}>
      <Pressable
        className={`h-14 flex-row items-center rounded-2xl border-[1.5px] bg-inset px-4 active:opacity-70 ${open ? "border-accent" : "border-transparent"} ${empty ? "opacity-60" : ""}`}
        style={empty ? undefined : lift}
        onPress={() => setOpen(!open)}
        disabled={empty}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected ? selected.label : empty ? emptyText : placeholder}`}
      >
        {selected?.dotColor ? <View className="mr-2.5 h-3.5 w-3.5 rounded-full" style={{ backgroundColor: selected.dotColor }} /> : null}
        <Text className={`flex-1 font-inter text-base ${selected ? "text-ink" : "text-muted"}`} numberOfLines={1}>
          {empty ? emptyText : selected ? selected.label : placeholder}
        </Text>
        {!empty ? <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} /> : null}
      </Pressable>

      {open ? (
        <View className="mt-2 rounded-2xl border border-hairline bg-surface" style={lift}>
          <ScrollView className="max-h-52" nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {options.map((o, i) => {
              const isSelected = o.key === selectedKey;
              return (
                <Pressable
                  key={o.key}
                  className={`h-12 flex-row items-center px-4 active:bg-inset ${i > 0 ? "border-t border-hairline" : ""} ${isSelected ? "bg-accent-tint" : ""}`}
                  onPress={() => {
                    onChange(o.key);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  {o.dotColor ? <View className="mr-2.5 h-3.5 w-3.5 rounded-full" style={{ backgroundColor: o.dotColor }} /> : null}
                  <Text className={`flex-1 text-base text-ink ${isSelected ? "font-inter-semibold" : "font-inter"}`} numberOfLines={1}>
                    {o.label}
                  </Text>
                  {isSelected ? <Ionicons name="checkmark" size={18} color={colors.accentInk} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </Field>
  );
}

/** Pick one of the user's cases (in caseIndex order). Each row shows the case's color dot. */
export function CaseDropdown({ cases, caseId, onChange }: { cases: Case[]; caseId: string | null; onChange: (caseId: string) => void }) {
  const options = [...cases]
    .sort((a, b) => a.caseIndex - b.caseIndex)
    .map((c) => ({ key: c.caseId, label: c.caseName, dotColor: c.caseColor }));
  return (
    <Dropdown
      label="Case"
      options={options}
      selectedKey={caseId}
      onChange={onChange}
      placeholder="Choose a case"
      emptyText="No cases to choose from"
    />
  );
}

/** Pick a case color from CASE_COLORS. */
export function ColorDropdown({ value, onChange }: { value: string | null; onChange: (hex: string) => void }) {
  const options = CASE_COLORS.map((c) => ({ key: c.hex, label: c.name, dotColor: c.hex }));
  return (
    <Dropdown
      label="Color"
      options={options}
      selectedKey={value}
      onChange={onChange}
      placeholder={value ? caseColorName(value) : "Choose a color"}
      emptyText=""
    />
  );
}

/** Two to four choices, one selected. The selected one takes the accent. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View className="flex-row gap-1 rounded-2xl bg-inset p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            className={`h-11 flex-1 items-center justify-center rounded-[11px] active:opacity-70 ${active ? "bg-accent" : ""}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text className={`font-inter-semibold text-sm ${active ? "text-onAccent" : "text-muted"}`}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── error text ───────────────────────────────────────────────────────────────
/** Error to show under a box: only once something is typed and it doesn't parse (null). */
export function fieldError(text: string, parsed: number | null, message: string): string | null {
  return text.trim() !== "" && parsed === null ? message : null;
}

export const ERRORS = {
  dollars: "Enter a whole dollar amount",
  percent: "Enter a percent from 0 to 100",
  years: "Enter whole years, 1 or more",
  age: "Whole years; months 0–11",
};
