import { useEffect, useRef } from "react";
import { Animated, Modal, PanResponder, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppData } from "../context/AppDataContext";
import { entityTypeOf } from "../Engines/masterEngine";
import { ENTITY_TYPES, ENTITY_TYPE_LABELS } from "../TypesAndVariables/entityTypeLabels";
import { useTheme } from "../context/ThemeContext";
import type { EntityTypeKey } from "../TypesAndVariables/types";

type EntityTypesMenuProps = {
  visible: boolean;
  selected: EntityTypeKey;
  onSelect: (type: EntityTypeKey) => void;
  onClose: () => void;
};

// Side menu on the entities screen: slides in from the left and lists all 23 entity types,
// each with how many entities of that type exist. Picking one switches the screen to that type.
// Close it with the X, a tap on the dimmed area, or a swipe to the left (the panel follows your finger).
export default function EntityTypesMenu({ visible, selected, onSelect, onClose }: EntityTypesMenuProps) {
  const { colors } = useTheme();
  const { entities } = useAppData();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(screenWidth * 0.8, 320);
  const x = useRef(new Animated.Value(-width)).current;

  useEffect(() => {
    if (visible) Animated.timing(x, { toValue: 0, duration: 220, useNativeDriver: true }).start();
  }, [visible, x]);

  /** Slide out, then tell the parent. */
  function close(then?: () => void) {
    Animated.timing(x, { toValue: -width, duration: 180, useNativeDriver: true }).start(() => {
      then?.();
      onClose();
    });
  }

  // Swipe left to close. Only claims clearly-horizontal leftward moves, so the list still scrolls.
  // The responder is made once, so it reads the latest close / width through a ref.
  const latest = useRef({ close, width });
  latest.current = { close, width };
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => g.dx < -8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => x.setValue(Math.min(0, g.dx)),
      onPanResponderRelease: (_, g) => {
        if (g.dx < -latest.current.width * 0.3 || g.vx < -0.5) latest.current.close();
        else Animated.spring(x, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
      },
      onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;

  const counts = new Map<EntityTypeKey, number>();
  for (const e of entities) {
    const type = entityTypeOf(e.entityId);
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  // The first 8 types are what you already have (codes 01–08); the rest are plans and spending.
  const groups: { title: string; types: EntityTypeKey[] }[] = [
    { title: "What you have now", types: ENTITY_TYPES.slice(0, 8) },
    { title: "Plans & spending", types: ENTITY_TYPES.slice(8) },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => close()}>
      <View className="flex-1 flex-row">
        <Animated.View {...swipe.panHandlers} style={{ width, transform: [{ translateX: x }] }}>
          <View className="flex-1 rounded-r-[28px] bg-surface" style={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom }}>
            <View className="mb-2 flex-row items-center pl-5 pr-3">
              <Text className="flex-1 font-inter-bold text-[22px] tracking-tight text-ink">Entity types</Text>
              <Pressable
                onPress={() => close()}
                hitSlop={8}
                className="h-10 w-10 items-center justify-center rounded-full bg-inset active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={18} color={colors.ink} />
              </Pressable>
            </View>
            <ScrollView contentContainerClassName="pb-4">
              {groups.map((group) => (
                <View key={group.title}>
                  <Text className="mb-1.5 mt-4 px-5 font-inter-semibold text-xs uppercase tracking-widest text-muted">{group.title}</Text>
                  {group.types.map((type) => {
                    const isSelected = type === selected;
                    const count = counts.get(type) ?? 0;
                    return (
                      <Pressable
                        key={type}
                        className={`mx-3 mb-0.5 h-12 flex-row items-center rounded-2xl px-3 active:bg-inset ${isSelected ? "bg-accent-tint" : ""}`}
                        onPress={() => close(() => onSelect(type))}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={`${ENTITY_TYPE_LABELS[type]}, ${count}`}
                      >
                        <Text
                          className={`flex-1 text-base ${isSelected ? "font-inter-semibold text-accent-ink" : "font-inter text-ink"}`}
                          numberOfLines={1}
                        >
                          {ENTITY_TYPE_LABELS[type]}
                        </Text>
                        {count > 0 ? (
                          <View className="mr-2 min-w-[24px] items-center rounded-full bg-inset px-2 py-0.5">
                            <Text className="font-inter-semibold text-xs text-muted">{count}</Text>
                          </View>
                        ) : null}
                        <Ionicons name="chevron-forward" size={16} color={isSelected ? colors.accentInk : colors.edge} />
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </View>
        </Animated.View>
        {/* Tap the dimmed area to close */}
        <Pressable className="flex-1 bg-black/40" onPress={() => close()} accessibilityLabel="Close menu" />
      </View>
    </Modal>
  );
}
