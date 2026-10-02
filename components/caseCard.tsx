import { useRef } from "react";
import { Animated, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { ActionWell, GripHandle } from "./cardControls";
import { caseColorName } from "./theme";

type CaseCardProps = {
  caseName: string;
  caseColor: string; // hex
  isHidden: boolean;
  entityCount: number;
  onDelete: () => void;
  onToggleHidden: () => void;
  onEdit: () => void;
};

const BAR_WIDTH = 10;
const RADIUS = 20;

// Full-width card for one case. Filled (a list card, per the colors guide) where entity tiles are
// outlined, so the two read as different things.
//   left edge:  thick bar in the case color, top to bottom
//   middle:     case name, color + entity count, then delete / hide / edit
//   right:      grip. Hold it to lift the card (drag-to-reorder by caseIndex comes later).
export default function CaseCard(props: CaseCardProps) {
  const { lift: liftStyle } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  function lift(to: number) {
    Animated.spring(scale, { toValue: to, useNativeDriver: true, friction: 7 }).start();
  }

  const textFade = props.isHidden ? 0.45 : 1; // hidden reads as faded

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      {/* No overflow-hidden here: it would clip the lift shadow. The bar rounds its own corners instead. */}
      <View
        className="flex-row rounded-[20px] bg-surface"
        style={liftStyle}
        accessibilityLabel={`${props.caseName}, ${caseColorName(props.caseColor)}${props.isHidden ? ", hidden" : ""}`}
      >
        <View
          style={{
            width: BAR_WIDTH,
            backgroundColor: props.caseColor,
            opacity: props.isHidden ? 0.45 : 1,
            borderTopLeftRadius: RADIUS,
            borderBottomLeftRadius: RADIUS,
          }}
        />

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
          <GripHandle barWidth={22} align="center" onPickUp={() => lift(1.03)} onPutDown={() => lift(1)} />
        </View>
      </View>
    </Animated.View>
  );
}
