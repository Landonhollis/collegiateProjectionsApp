import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { OUTCOME_KEYS, OUTCOME_LABELS } from "../TypesAndVariables/outcomeLabels";
import type { OutcomeKey } from "../TypesAndVariables/types";
import { TOP_BAR_HEIGHT } from "./TopBar";
import { FLOATING_ROW_TOP, PROMINENT_ROW_HEIGHT } from "./screenParts";

type OutcomesDropdownProps = {
  selected: OutcomeKey;
  onPick: (outcomeKey: OutcomeKey) => void;
  onClose: () => void;
};

// The list of outcomes (net worth, expenses per month, …) that drops down under the outcomes screen's
// floating bar, as wide as the bar. The one that's showing is tinted and checked.
// Floats over the screen; tap outside to close it.
// It's outlined (1px edge, like the entity types menu) and, in dark mode, one step lighter than the cards
// (inset instead of surface), so it stands out from the screen behind it. In light mode surface is already the lightest.
export default function OutcomesDropdown({ selected, onPick, onClose }: OutcomesDropdownProps) {
  const { colors, lift, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const fill = scheme === "dark" ? "bg-inset" : "bg-surface";

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      {/* Tap anywhere outside the list to close it */}
      <Pressable className="absolute inset-0" onPress={onClose} accessibilityLabel="Close list" />
      {/* Outer view carries the shadow (light mode); the inner one clips the rows to the rounded corners. */}
      <View
        className={`rounded-2xl ${fill}`}
        style={[
          scheme === "light" ? lift : null,
          { position: "absolute", top: insets.top + TOP_BAR_HEIGHT + FLOATING_ROW_TOP + PROMINENT_ROW_HEIGHT + 6, left: 16, right: 16 },
        ]}
      >
        <View className="overflow-hidden rounded-2xl border border-edge">
          {OUTCOME_KEYS.map((key, i) => {
            const isSelected = key === selected;
            return (
              <Pressable
                key={key}
                className={`h-12 flex-row items-center px-4 active:opacity-60 ${i > 0 ? "border-t border-hairline" : ""} ${isSelected ? "bg-accent-tint" : ""}`}
                onPress={() => onPick(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={OUTCOME_LABELS[key]}
              >
                <Text className={`flex-1 text-base text-ink ${isSelected ? "font-inter-semibold" : "font-inter"}`} numberOfLines={1}>
                  {OUTCOME_LABELS[key]}
                </Text>
                {isSelected ? <Ionicons name="checkmark" size={18} color={colors.accentInk} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}
