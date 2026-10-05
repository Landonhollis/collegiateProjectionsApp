import type { ComponentProps, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";

// Pieces shared by the tab screens, so every screen's floating row and empty state look the same.

type IconName = ComponentProps<typeof Ionicons>["name"];

type EmptyStateProps = {
  icon: IconName;
  title: string;
  message: string;
  /** Optional button under the message (e.g. "Make a case"). */
  action?: { label: string; onPress: () => void };
};

/** Shown when a list has nothing in it: says why, and what to do next. */
export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  const { colors, lift } = useTheme();
  return (
    <View className="items-center px-8 pt-16">
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-inset">
        <Ionicons name={icon} size={28} color={colors.muted} />
      </View>
      <Text className="text-center font-inter-bold text-lg text-ink">{title}</Text>
      <Text className="mt-1.5 text-center font-inter text-[15px] leading-[22px] text-muted">{message}</Text>
      {action ? (
        <Pressable
          className="mt-5 h-12 flex-row items-center gap-1.5 rounded-2xl bg-surface px-5 active:opacity-70"
          style={lift}
          onPress={action.onPress}
          accessibilityRole="button"
        >
          <Text className="font-inter-semibold text-base text-ink">{action.label}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export const FLOATING_ROW_TOP = 12; // gap between the top bar and the floating row
export const FLOATING_ROW_HEIGHT = 44; // the plus is a 44 square, and the bar beside it is the same height
/** Top padding a list needs so its first cards start below the floating row. */
export const FLOATING_ROW_SPACE = FLOATING_ROW_TOP + FLOATING_ROW_HEIGHT + 12;
export const PROMINENT_ROW_HEIGHT = 54; // the taller, outlined row (Outcomes)
/** The same, for a prominent floating row. */
export const PROMINENT_ROW_SPACE = FLOATING_ROW_TOP + PROMINENT_ROW_HEIGHT + 12;

type FloatingRowProps = {
  /** The plus. Leave it out and there is no plus: the bar fills the whole row (Outcomes). */
  onAdd?: () => void;
  addDisabled?: boolean;
  addLabel?: string; // read by screen readers, e.g. "New case"
  /** Tapping the bar. */
  onPressBar: () => void;
  barLabel: string; // read by screen readers
  /** A taller bar with an outline, for a screen where the bar is the main control (Outcomes). */
  prominent?: boolean;
  /** What the bar shows: an icon, a name, a value, a chevron. */
  children: ReactNode;
};

/**
 * The row that floats over the top of a tab screen's list (the cards scroll under it):
 * a green plus on the left, then a bar filling the rest (the starting age on Cases, the entity type on Entities,
 * the outcome on Outcomes, which has no plus and is prominent).
 */
export function FloatingRow({ onAdd, addDisabled, addLabel, onPressBar, barLabel, prominent, children }: FloatingRowProps) {
  const { colors, lift, scheme } = useTheme();
  // The dark-mode lift is a top border, which would sit on top of the outline, so a prominent bar only lifts in light mode.
  const barStyle = prominent ? [scheme === "light" ? lift : null, { borderWidth: 1.5, borderColor: colors.edge }] : lift;
  return (
    <View
      pointerEvents="box-none"
      className="flex-row gap-2"
      style={{
        position: "absolute",
        top: FLOATING_ROW_TOP,
        left: 16,
        right: 16,
        height: prominent ? PROMINENT_ROW_HEIGHT : FLOATING_ROW_HEIGHT,
      }}
    >
      {onAdd ? (
        <Pressable
          className={`items-center justify-center rounded-2xl bg-green active:opacity-70 ${addDisabled ? "opacity-40" : ""}`}
          style={[addDisabled ? null : lift, { width: FLOATING_ROW_HEIGHT, height: FLOATING_ROW_HEIGHT }]}
          onPress={onAdd}
          disabled={addDisabled}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          accessibilityState={{ disabled: !!addDisabled }}
        >
          <Ionicons name="add" size={24} color={colors.onAccent} />
        </Pressable>
      ) : null}
      <Pressable
        className="flex-1 flex-row items-center rounded-2xl bg-surface px-3.5 active:opacity-70"
        style={barStyle}
        onPress={onPressBar}
        accessibilityRole="button"
        accessibilityLabel={barLabel}
      >
        {children}
      </Pressable>
    </View>
  );
}
