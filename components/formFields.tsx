import { useRef, useState, type ReactNode } from "react";
import { Keyboard, Modal, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import CostGuidePopup from "./costGuidePopup";
import { SETTLE_AFTER_KEYBOARD_MS } from "./popupLayer";
import { CASE_COLORS, caseColorName } from "./theme";
import type { Case } from "../TypesAndVariables/types";
import type { CostGuide } from "../TypesAndVariables/costGuides";
import {
  ERRORS,
  fieldError,
  formatDollars,
  ageInMonths,
  parseDecimal,
  parseDollars,
  parseOptionalAge,
  parsePercent,
  parsePositiveDecimal,
  parseSignedPercent,
  parseWhole,
  parseWholeFrom1,
  type AgeText,
  type LoanText,
} from "./formParsing";

// Building blocks for the edit entity cards: the boxes, pickers and labels.
// The text ↔ number helpers live in formParsing.ts (re-exported here, so cards import from one place).
export * from "./formParsing";

// ── fields ───────────────────────────────────────────────────────────────────
// Look (from the design reference): filled inset boxes, 56px tall, 16px corners. A box outlines in the
// accent while focused and in danger when its text doesn't parse; the error text says why in plain words.

type FieldProps = {
  label: string;
  hint?: string;
  error?: string | null;
  /** Adds an "i" button beside the label that opens this guide to what people typically spend (see costGuides.ts). */
  guide?: CostGuide;
  children: ReactNode;
};

/** Label above any input (+ optional "i" guide button, hint on the right, error text below). Keep labels to one or two words. */
export function Field({ label, hint, error, guide, children }: FieldProps) {
  const { colors } = useTheme();
  const [guideOpen, setGuideOpen] = useState(false);
  return (
    <View className="mb-5">
      <View className="mb-2 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Text className="font-inter-semibold text-[13px] text-muted">{label}</Text>
          {guide ? (
            <Pressable
              className="ml-1.5 active:opacity-60"
              onPress={() => {
                Keyboard.dismiss(); // the guide opens over the whole screen; the keyboard would sit on top of it
                setGuideOpen(true);
              }}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`${label}: how much people spend`}
            >
              <Ionicons name="information-circle-outline" size={19} color={colors.accentInk} />
            </Pressable>
          ) : null}
        </View>
        {hint ? <Text className="font-inter text-xs text-muted">{hint}</Text> : null}
      </View>
      {children}
      {error ? <Text className="mt-1.5 font-inter-medium text-xs text-danger">{error}</Text> : null}
      {guide && guideOpen ? <CostGuidePopup guide={guide} onClose={() => setGuideOpen(false)} /> : null}
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
  keyboardType?: "default" | "decimal-pad" | "number-pad" | "numbers-and-punctuation";
  prefix?: string;
  suffix?: string;
  invalid?: boolean;
  autoCapitalize?: "none" | "words" | "sentences";
  onBlur?: () => void;
  /** Tapping into the box selects all of its text, so typing replaces it. */
  selectOnFocus?: boolean;
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
        selectTextOnFocus={props.selectOnFocus}
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
  selectOnFocus,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  /** Tapping into the box selects all of its text, so typing replaces it (for a filled-in default). */
  selectOnFocus?: boolean;
}) {
  return (
    <Field label={label}>
      <InputBox
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoCapitalize="words"
        selectOnFocus={selectOnFocus}
        accessibilityLabel={label}
      />
    </Field>
  );
}

type NumberKind =
  "dollars" | "percent" | "signedPercent" | "returnPercent" | "years" | "months" | "whole" | "decimal" | "positive" | "number";

/** How each kind of number box checks its text, what it says when the text is wrong, and what it shows around it. */
const NUMBER_KINDS: Record<NumberKind, { parse: (text: string) => number | null; error: string; prefix?: string; suffix?: string }> = {
  dollars: { parse: parseDollars, error: ERRORS.dollars, prefix: "$" },
  percent: { parse: parsePercent, error: ERRORS.percent, suffix: "%" },
  signedPercent: { parse: parseSignedPercent, error: ERRORS.signedPercent, suffix: "%" }, // may be negative
  // A yearly return. Checked like signedPercent, but typed on the number pad, which has no minus key (the user's call):
  // a negative return can't be typed here, though a saved one still shows and saves.
  returnPercent: { parse: parseSignedPercent, error: ERRORS.signedPercent, suffix: "%" },
  years: { parse: parseWholeFrom1, error: ERRORS.years, suffix: "yrs" },
  months: { parse: parseWholeFrom1, error: ERRORS.months, suffix: "mos" },
  whole: { parse: parseWholeFrom1, error: ERRORS.whole },
  decimal: { parse: parseDecimal, error: ERRORS.decimal },
  positive: { parse: parsePositiveDecimal, error: ERRORS.positive },
  number: { parse: (text) => parseWhole(text), error: ERRORS.number },
};

type NumberFieldProps = {
  label: string;
  value: string;
  onChange: (text: string) => void;
  /** Picks the check, the error text and the $ / % / yrs / mos around the box. "dollars" also adds commas when you leave the box. */
  kind?: NumberKind;
  hint?: string;
  /** Grey text shown while the box is empty. For an optional box, the value the engine uses when it's left blank. */
  placeholder?: string;
  prefix?: string; // replaces the kind's own
  suffix?: string; // replaces the kind's own
  /** Replaces the box's own error (it checks its text by kind once something is typed). */
  error?: string | null;
  /** Adds an "i" button beside the label that opens this spending guide. */
  guide?: CostGuide;
};

export function NumberField({
  label,
  value,
  onChange,
  kind = "number",
  hint,
  placeholder = "0",
  prefix,
  suffix,
  error,
  guide,
}: NumberFieldProps) {
  const rules = NUMBER_KINDS[kind];
  const shownError = error !== undefined ? error : fieldError(value, rules.parse(value), rules.error);
  const wholeOnly = kind === "dollars" || kind === "years" || kind === "months" || kind === "whole" || kind === "number";
  function onBlur() {
    if (kind !== "dollars") return;
    const n = parseDollars(value);
    if (n !== null) onChange(formatDollars(n));
  }
  return (
    <Field label={label} hint={hint} error={shownError} guide={guide}>
      <InputBox
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        // A signed percent needs a minus key, which the number pads don't have.
        keyboardType={kind === "signedPercent" ? "numbers-and-punctuation" : wholeOnly ? "number-pad" : "decimal-pad"}
        prefix={prefix ?? rules.prefix}
        suffix={suffix ?? rules.suffix}
        invalid={!!shownError}
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
  /** Replaces the box's own error (it checks years / months once something is typed). */
  error?: string | null;
}) {
  const shownError = error !== undefined ? error : parseOptionalAge(value) === undefined ? ERRORS.age : null;
  return (
    <Field label={label} hint={hint} error={shownError}>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <InputBox
            value={value.years}
            onChange={(years) => onChange({ ...value, years })}
            placeholder="—"
            keyboardType="number-pad"
            suffix="yrs"
            invalid={!!shownError}
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
            invalid={!!shownError}
            accessibilityLabel={`${label}, months`}
          />
        </View>
      </View>
    </Field>
  );
}

/**
 * A start age and an end age, both optional. The end box says so when it isn't after the start.
 * Blank start = now; blank end = never ends.
 */
export function AgeWindowFields({
  start,
  end,
  onStart,
  onEnd,
  startLabel = "Start age",
  endLabel = "End age",
  startHint = "blank = now",
  endHint = "blank = never ends",
}: {
  start: AgeText;
  end: AgeText;
  onStart: (age: AgeText) => void;
  onEnd: (age: AgeText) => void;
  startLabel?: string;
  endLabel?: string;
  startHint?: string;
  endHint?: string;
}) {
  const startAge = parseOptionalAge(start);
  const endAge = parseOptionalAge(end);
  const endTooEarly = !!startAge && !!endAge && ageInMonths(endAge) <= ageInMonths(startAge);
  return (
    <>
      <AgeField label={startLabel} hint={startHint} value={start} onChange={onStart} />
      <AgeField label={endLabel} hint={endHint} value={end} onChange={onEnd} error={endTooEarly ? ERRORS.endBeforeStart : undefined} />
    </>
  );
}

/**
 * The four boxes of an existing loan. Any three describe it; the engine works out the fourth.
 * Leave one blank (or fill in all four).
 */
export function LoanAny3Fields({ value, onChange }: { value: LoanText; onChange: (loan: LoanText) => void }) {
  return (
    <>
      <Note>Fill in any 3 of these 4. The one you leave blank is worked out for you.</Note>
      <NumberField label="Remaining balance" kind="dollars" value={value.balance} onChange={(balance) => onChange({ ...value, balance })} />
      <NumberField label="Interest rate" kind="percent" value={value.ratePct} onChange={(ratePct) => onChange({ ...value, ratePct })} />
      <NumberField label="Time left" kind="months" value={value.termMonths} onChange={(termMonths) => onChange({ ...value, termMonths })} />
      <NumberField label="Monthly payment" kind="dollars" value={value.payment} onChange={(payment) => onChange({ ...value, payment })} />
    </>
  );
}

/** A divider with a small heading, to split a long card into parts (same look as the frame's "Details"). */
export function SectionLabel({ children }: { children: string }) {
  return (
    <View className="mb-5 mt-1 flex-row items-center gap-3">
      <Text className="font-inter-semibold text-xs uppercase tracking-widest text-muted">{children}</Text>
      <View className="h-px flex-1 bg-hairline" />
    </View>
  );
}

/** A plain sentence of help between boxes. */
export function Note({ children }: { children: string }) {
  return <Text className="-mt-1 mb-5 font-inter text-[13px] leading-[19px] text-muted">{children}</Text>;
}

// ── pickers ──────────────────────────────────────────────────────────────────
type Option = { key: string; label: string; dotColor?: string };

const ROW_HEIGHT = 48;
const LIST_MAX_HEIGHT = 208;
const LIST_GAP = 8; // between the box and its list

/** Where the dropdown's box is on the screen, so the floating list can line up with it. */
type Anchor = { x: number; y: number; width: number; height: number };

/**
 * A filled box that opens a floating list. Shared by CaseDropdown and ColorDropdown.
 * The list is drawn in its own transparent Modal, lined up with the box, so it lays over whatever is
 * around it instead of pushing the form taller (and it can't be clipped by the popup it's in).
 * It opens under the box, or above it when there's no room below. Tap outside the list to close it.
 */
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
  const { colors, lift, scheme } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const boxRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null); // null = closed
  const open = anchor !== null;
  const selected = options.find((o) => o.key === selectedKey) ?? null;
  const empty = options.length === 0;

  function measureAndOpen() {
    boxRef.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
  }

  function openList() {
    // The keyboard moves the form when it closes, so close it first and measure the box where it lands
    // (a moment after the keyboard is gone, so the popup has finished sliding back down).
    if (Keyboard.isVisible()) {
      const sub = Keyboard.addListener("keyboardDidHide", () => {
        sub.remove();
        setTimeout(measureAndOpen, SETTLE_AFTER_KEYBOARD_MS);
      });
      Keyboard.dismiss();
    } else {
      measureAndOpen();
    }
  }

  function listPosition(a: Anchor): ViewStyle {
    const listHeight = Math.min(options.length * ROW_HEIGHT, LIST_MAX_HEIGHT) + 2; // + its border
    const fitsBelow = a.y + a.height + LIST_GAP + listHeight <= screenHeight - 16;
    const vertical = fitsBelow ? { top: a.y + a.height + LIST_GAP } : { bottom: screenHeight - a.y + LIST_GAP };
    return { position: "absolute", left: a.x, width: a.width, ...vertical };
  }

  return (
    <Field label={label}>
      <Pressable
        ref={boxRef}
        className={`h-14 flex-row items-center rounded-2xl border-[1.5px] bg-inset px-4 active:opacity-70 ${open ? "border-accent" : "border-transparent"} ${empty ? "opacity-60" : ""}`}
        style={empty ? undefined : lift}
        onPress={openList}
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

      {anchor ? (
        <Modal transparent animationType="fade" onRequestClose={() => setAnchor(null)}>
          {/* Tap anywhere outside the list to close it */}
          <Pressable className="absolute inset-0" onPress={() => setAnchor(null)} accessibilityLabel="Close list" />
          {/* Outer view carries the shadow (light mode); the inner one clips the rows to the rounded corners. */}
          <View className="rounded-2xl bg-surface" style={[scheme === "light" ? lift : null, listPosition(anchor)]}>
            <View className="overflow-hidden rounded-2xl border border-hairline">
              <ScrollView style={{ maxHeight: LIST_MAX_HEIGHT }}>
                {options.map((o, i) => {
                  const isSelected = o.key === selectedKey;
                  return (
                    <Pressable
                      key={o.key}
                      className={`flex-row items-center px-4 active:bg-inset ${i > 0 ? "border-t border-hairline" : ""} ${isSelected ? "bg-accent-tint" : ""}`}
                      style={{ height: ROW_HEIGHT }}
                      onPress={() => {
                        onChange(o.key);
                        setAnchor(null);
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
          </View>
        </Modal>
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

/** Pick one of a fixed list of choices. Use it when there are too many for Segmented (more than four). */
export function ChoiceDropdown<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <Dropdown
      label={label}
      options={options.map((o) => ({ key: o.value, label: o.label }))}
      selectedKey={value}
      onChange={(key) => {
        const picked = options.find((o) => o.value === key);
        if (!picked) throw new Error(`ChoiceDropdown "${label}": "${key}" is not one of its options`);
        onChange(picked.value);
      }}
      placeholder=""
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
