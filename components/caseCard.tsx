import { useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../context/ThemeContext";
import { ActionWell, GripHandle } from "./cardControls";
import type { DragHandlers } from "./reorderableGrid";
import { caseColorName, withAlpha } from "./theme";

type CaseCardProps = {
  caseName: string;
  caseColor: string; // hex
  isHidden: boolean;
  entityCount: number;
  /** Its entities are showing under it (see CaseEntitiesPanel). */
  isExpanded: boolean;
  /** Tapping the card (not a button or the grip): show / put away its entities. */
  onToggleExpanded: () => void;
  onDelete: () => void;
  onToggleHidden: () => void;
  onEdit: () => void;
} & DragHandlers; // the grip drags the card to a new place (see ReorderableGrid)

// Full-width card for one case, outlined in its case color (fainter when hidden).
//   middle:     case name, color + entity count, then delete / hide / edit
//   right:      grip. Hold it to lift the card, then drag to reorder.
// Tapping the card anywhere else (not on a button or the grip) shows or puts away its entities under it;
// the small arrow after the entity count says which. Holding it there opens the edit popup, same as Edit.
export default function CaseCard(props: CaseCardProps) {
  const { lift: liftStyle, scheme, caseBorderWidth, colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  function lift(to: number) {
    Animated.spring(scale, { toValue: to, useNativeDriver: true, friction: 7 }).start();
  }

  const textFade = props.isHidden ? 0.45 : 1; // hidden reads as faded

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      {/* The dark-mode lift is a top border, which would cover the case-color border, so only light mode gets the lift. */}
      <Pressable
        className="flex-row rounded-[20px] border bg-surface"
        style={[scheme === "light" ? liftStyle : null, { borderWidth: caseBorderWidth, borderColor: withAlpha(props.caseColor, textFade) }]}
        onPress={() => {
          Haptics.selectionAsync();
          props.onToggleExpanded();
        }}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          props.onEdit();
        }}
        accessible={false} // screen readers use the buttons inside; this keeps them reachable
        accessibilityLabel={`${props.caseName}, ${caseColorName(props.caseColor)}${props.isHidden ? ", hidden" : ""}`}
      >
        <View className="flex-1 py-4 pl-4">
          <View style={{ opacity: textFade }}>
            <Text className="font-inter-bold text-[20px] leading-[26px] tracking-tight text-ink" numberOfLines={1} ellipsizeMode="clip">
              {props.caseName}
            </Text>
            <View className="mt-1 flex-row items-center gap-2">
              <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: props.caseColor }} />
              <Text className="font-inter-semibold text-[13px] text-muted" numberOfLines={1}>
                {caseColorName(props.caseColor)}
                {"  ·  "}
                {props.entityCount} {props.entityCount === 1 ? "entity" : "entities"}
                {props.isHidden ? "  ·  Hidden" : ""}
              </Text>
              <Ionicons name={props.isExpanded ? "chevron-up" : "chevron-down"} size={14} color={colors.muted} />
            </View>
          </View>

          <View className="mt-3.5 flex-row gap-2">
            <ActionWell icon="trash-outline" label="Delete" iconSize={18} size={44} onPress={props.onDelete} />
            <ActionWell
              icon={props.isHidden ? "eye-off-outline" : "eye-outline"}
              label={props.isHidden ? "Show" : "Hide"}
              iconSize={18}
              size={44}
              onPress={props.onToggleHidden}
              activeColor={props.isHidden ? props.caseColor : undefined}
            />
            <ActionWell icon="create-outline" label="Edit" iconSize={18} size={44} onPress={props.onEdit} opensCard emphasis />
          </View>
        </View>

        {/* Full lift (10%) like the entity card would push a full-width card off-screen, so 3% here. */}
        <View className="w-16 items-center justify-center">
          <GripHandle
            barWidth={22}
            align="center"
            onPickUp={() => {
              lift(1.03);
              props.onDragStart();
            }}
            onMove={props.onDragMove}
            onPutDown={() => {
              lift(1);
              props.onDragEnd();
            }}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}
