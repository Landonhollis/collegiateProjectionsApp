import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { TOP_BAR_HEIGHT } from "./TopBar";
import { FLOATING_ROW_HEIGHT, FLOATING_ROW_TOP } from "./screenParts";

export type AddOption = { key: string; label: string };

type AddOptionsMenuProps = {
  options: AddOption[];
  onPick: (key: string) => void;
  onClose: () => void;
};

// The small list that drops down under the floating row's plus (top right) when there's more than one thing to add
// (e.g. Housing: Renting or Buying). Floats over the screen; tap outside to close it.
export default function AddOptionsMenu({ options, onPick, onClose }: AddOptionsMenuProps) {
  const { colors, lift, scheme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      {/* Tap anywhere outside the list to close it */}
      <Pressable className="absolute inset-0" onPress={onClose} accessibilityLabel="Close list" />
      {/* Outer view carries the shadow (light mode); the inner one clips the rows to the rounded corners. */}
      <View
        className="rounded-2xl bg-surface"
        style={[
          scheme === "light" ? lift : null,
          { position: "absolute", top: insets.top + TOP_BAR_HEIGHT + FLOATING_ROW_TOP + FLOATING_ROW_HEIGHT + 6, right: 16, width: 220 },
        ]}
      >
        <View className="overflow-hidden rounded-2xl border border-hairline">
          {options.map((o, i) => (
            <Pressable
              key={o.key}
              className={`h-12 flex-row items-center px-4 active:bg-inset ${i > 0 ? "border-t border-hairline" : ""}`}
              onPress={() => onPick(o.key)}
              accessibilityRole="button"
              accessibilityLabel={o.label}
            >
              <Text className="flex-1 font-inter-semibold text-base text-ink" numberOfLines={1}>
                {o.label}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}
