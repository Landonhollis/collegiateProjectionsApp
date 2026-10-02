import { useRef, useState } from "react";
import { Animated, Text, View, type LayoutChangeEvent } from "react-native";
import { ActionWell, GripHandle } from "./cardControls";

type EntityCardProps = {
  entityName: string;
  entityType: string; // display label, e.g. "Existing Home"
  caseName: string;
  caseColor: string;
  isHidden: boolean;
  onDelete: () => void;
  onToggleHidden: () => void;
  onEdit: () => void;
};

// Square tile for one entity. Always square: it fills its parent's width and matches the height.
// Outlined (a tile, per the colors guide); its actions are filled wells. Everything scales with the card.
//   top 3/4:            name (up to 2 lines), type, case
//   bottom 1/4, left:   delete, hide, edit
//   bottom 1/4, right:  grip. Hold it to lift the card 10% (drag-to-reorder comes later).
export default function EntityCard(props: EntityCardProps) {
  const [size, setSize] = useState(0);
  const scale = useRef(new Animated.Value(1)).current;

  function onLayout(e: LayoutChangeEvent) {
    setSize(e.nativeEvent.layout.width);
  }

  function lift(to: number) {
    Animated.spring(scale, { toValue: to, useNativeDriver: true, friction: 7 }).start();
  }

  const pad = size * 0.08;
  const rowHeight = size * 0.25; // bottom quarter
  const textFade = props.isHidden ? 0.45 : 1; // hidden reads as faded

  return (
    // Animated.View gets plain styles (scale + square); the inner View carries the look.
    <Animated.View onLayout={onLayout} style={{ width: "100%", aspectRatio: 1, transform: [{ scale }] }}>
      <View
        className="flex-1 rounded-[20px] border-[1.5px] border-edge bg-surface"
        style={{ padding: pad }}
        accessibilityLabel={`${props.entityName}, ${props.entityType}, ${props.caseName}${props.isHidden ? ", hidden" : ""}`}
      >
        {size > 0 && (
          <>
            <View className="flex-1 overflow-hidden" style={{ opacity: textFade }}>
              <Text
                className="font-inter-bold tracking-tight text-ink"
                style={{ fontSize: size * 0.13, lineHeight: size * 0.165 }}
                numberOfLines={2} // wraps once, then clips
                ellipsizeMode="clip"
              >
                {props.entityName}
              </Text>
              <Text
                className="font-inter-semibold text-muted"
                style={{ fontSize: size * 0.075, lineHeight: size * 0.105 }}
                numberOfLines={1}
                ellipsizeMode="clip"
              >
                {props.entityType}
              </Text>
              <View className="flex-row items-center" style={{ gap: size * 0.03 }}>
                <View className="rounded-full" style={{ width: size * 0.065, height: size * 0.065, backgroundColor: props.caseColor }} />
                <Text
                  className="flex-1 font-inter text-muted"
                  style={{ fontSize: size * 0.075, lineHeight: size * 0.105 }}
                  numberOfLines={1}
                  ellipsizeMode="clip"
                >
                  {props.caseName}
                </Text>
              </View>
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
                <GripHandle barWidth={size * 0.11} onPickUp={() => lift(1.1)} onPutDown={() => lift(1)} />
              </View>
            </View>
          </>
        )}
      </View>
    </Animated.View>
  );
}
