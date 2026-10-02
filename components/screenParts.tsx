import type { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";

// Pieces shared by the tab screens, so every screen's toolbar and empty state look the same.

type IconName = ComponentProps<typeof Ionicons>["name"];

/** The accent "+ Add" button on the right of a screen's toolbar. */
export function AddButton({ onPress, disabled, label = "Add" }: { onPress: () => void; disabled?: boolean; label?: string }) {
  const { colors, lift } = useTheme();
  return (
    <Pressable
      className={`h-11 flex-row items-center gap-1 rounded-2xl bg-accent pl-3 pr-4 active:opacity-80 ${disabled ? "opacity-40" : ""}`}
      style={disabled ? undefined : lift}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Ionicons name="add" size={20} color={colors.onAccent} />
      <Text className="font-inter-bold text-base text-onAccent">{label}</Text>
    </Pressable>
  );
}

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
