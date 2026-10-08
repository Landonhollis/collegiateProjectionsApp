import { useRef, useState } from "react";
import { Animated, Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../context/ThemeContext";
import { ActionWell, GripHandle } from "./cardControls";
import type { DragHandlers } from "./reorderableGrid";
import { withAlpha } from "./theme";

type EntityCardProps = {
  entityName: string;
  entityType: string; // display label, e.g. "Existing Home"
  /** Up to 2 short lines of the entity's main values (see entitySummary), e.g. "$320,000 at age 30". */
  facts: string[];
  caseName: string;
  caseColor: string;
  isHidden: boolean;
  onDelete: () => void;
  onToggleHidden: () => void;
  onEdit: () => void;
} & DragHandlers; // the grip drags the card to a new place (see ReorderableGrid)

// Square tile for one entity. Always square: it fills its parent's width and matches the height.
// Outlined in its case color (fainter when hidden); its actions are filled wells. Everything scales with the card.
//   top 3/4:            name (up to 2 lines), type, "Case:" + its color dot and name, then up to 2 facts
//   bottom 1/4, left:   delete, hide, edit
//   bottom 1/4, right:  grip. Hold it to lift the card 10%, then drag to reorder.
// Holding the card anywhere else (not on a button or the grip) opens the edit popup, same as Edit.
export default function EntityCard(props: EntityCardProps) {
  const { caseBorderWidth } = useTheme();
  const [size, setSize] = useState(0);
  const scale = useRef(new Animated.Value(1)).current;

  function onLayout(e: LayoutChangeEvent) {
    setSize(e.nativeEvent.layout.width);
  }

  function lift(to: number) {
    Animated.spring(scale, { toValue: to, useNativeDriver: true, friction: 7 }).start();
  }

  const pad = size * 0.07;
  // The small lines under the name (type, case, facts), with a little air between them (the user's call).
  // The space above the buttons is 61% of the card's width (100 − 7 − 7 padding − 25 buttons), and these add up to exactly that:
  //   a 2-line name (2 × 13) + the gap under it (2.5) + four small lines (4 × 7) + three gaps between them (3 × 1.5).
  // Adding a line, or making anything bigger, means shrinking something else.
  const smallText = { fontSize: size * 0.063, lineHeight: size * 0.07 };
  const underName = size * 0.025; // between the name and the type
  const between = size * 0.015; // between the small lines
  const rowHeight = size * 0.25; // bottom quarter
  const textFade = props.isHidden ? 0.45 : 1; // hidden reads as faded

  return (
    // Animated.View gets plain styles (scale + square); the inner View carries the look.
    <Animated.View onLayout={onLayout} style={{ width: "100%", aspectRatio: 1, transform: [{ scale }] }}>
      <Pressable
        className="flex-1 rounded-[20px] border bg-surface"
        style={{ padding: pad, borderWidth: caseBorderWidth, borderColor: withAlpha(props.caseColor, textFade) }}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          props.onEdit();
        }}
        accessible={false} // screen readers use the Edit button; this keeps the buttons inside reachable
        accessibilityLabel={`${[props.entityName, props.entityType, `case ${props.caseName}`, ...props.facts].join(", ")}${props.isHidden ? ", hidden" : ""}`}
      >
        {size > 0 && (
          <>
            <View className="flex-1 overflow-hidden" style={{ opacity: textFade }}>
              <Text
                className="font-inter-bold tracking-tight text-ink"
                style={{ fontSize: size * 0.115, lineHeight: size * 0.13 }}
                numberOfLines={2} // wraps once, then clips
                ellipsizeMode="clip"
              >
                {props.entityName}
              </Text>
              <Text
                className="font-inter-semibold text-muted"
                style={[smallText, { marginTop: underName }]}
                numberOfLines={1}
                ellipsizeMode="clip"
              >
                {props.entityType}
              </Text>
              <View className="flex-row items-center" style={{ gap: size * 0.025, marginTop: between }}>
                <Text className="font-inter text-muted" style={smallText}>
                  Case:
                </Text>
                <View className="rounded-full" style={{ width: size * 0.055, height: size * 0.055, backgroundColor: props.caseColor }} />
                <Text className="flex-1 font-inter text-muted" style={smallText} numberOfLines={1} ellipsizeMode="clip">
                  {props.caseName}
                </Text>
              </View>
              {/* The entity's main values, so it can be told apart without opening it. */}
              {props.facts.map((fact) => (
                <Text
                  key={fact}
                  className="font-inter-medium text-ink"
                  style={[smallText, { marginTop: between }]}
                  numberOfLines={1}
                  ellipsizeMode="clip"
                >
                  {fact}
                </Text>
              ))}
            </View>

            <View className="flex-row items-end" style={{ height: rowHeight }}>
              <View className="flex-row" style={{ width: "75%", gap: size * 0.035 }}>
                <ActionWell icon="trash-outline" label="Delete" iconSize={rowHeight * 0.4} onPress={props.onDelete} />
                <ActionWell
                  icon={props.isHidden ? "eye-off-outline" : "eye-outline"}
                  label={props.isHidden ? "Show" : "Hide"}
                  iconSize={rowHeight * 0.4}
                  onPress={props.onToggleHidden}
                  activeColor={props.isHidden ? props.caseColor : undefined}
                />
                <ActionWell icon="create-outline" label="Edit" iconSize={rowHeight * 0.4} onPress={props.onEdit} emphasis />
              </View>
              <View className="flex-1 items-end justify-end" style={{ height: "100%", paddingBottom: rowHeight * 0.12 }}>
                <GripHandle
                  barWidth={size * 0.11}
                  onPickUp={() => {
                    lift(1.1);
                    props.onDragStart();
                  }}
                  onMove={props.onDragMove}
                  onPutDown={() => {
                    lift(1);
                    props.onDragEnd();
                  }}
                />
              </View>
            </View>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
