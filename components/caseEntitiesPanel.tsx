import { Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { entityTypeOf } from "../Engines/masterEngine";
import { ENTITY_TYPE_LABELS } from "../TypesAndVariables/entityTypeLabels";
import { entitySummary } from "./entitySummary";
import type { Entity } from "../TypesAndVariables/types";

/** How much of the panel's top is tucked behind its case card (the card's corner radius, so no gap shows at the corners). */
export const CASE_PANEL_OVERLAP = 20;

type CaseEntitiesPanelProps = {
  caseColor: string; // hex
  /** The case's entities, in entities-array order. */
  entities: Entity[];
};

// What comes out from under a case card when it's tapped: that case's entities, in a rounded box outlined in the
// case color, 92% of the card's width. Its top sits behind the card, so it reads as part of that case.
// It's filled with `inset`, one step off the card's `surface` (lighter in dark mode), so the two don't run together.
// Each row shows what the entity's own card shows: name, type and its facts (faded when the entity is hidden).
// To read only: entities are edited on the entities tab.
export default function CaseEntitiesPanel({ caseColor, entities }: CaseEntitiesPanelProps) {
  const { caseBorderWidth } = useTheme();
  return (
    <View
      className="w-[92%] self-center rounded-[20px] bg-inset px-4 pb-1"
      style={{ borderWidth: caseBorderWidth, borderColor: caseColor, paddingTop: CASE_PANEL_OVERLAP }}
    >
      {entities.length === 0 ? (
        <Text className="py-3.5 font-inter text-[15px] text-muted">No entities in this case yet.</Text>
      ) : (
        entities.map((entity, index) => {
          const type = entityTypeOf(entity.entityId);
          const facts = entitySummary(type, entity.inputs);
          return (
            <View
              key={entity.entityId}
              className={`py-3 ${index > 0 ? "border-t border-edge" : ""}`}
              style={{ opacity: entity.isHidden ? 0.45 : 1 }} // hidden reads as faded, like on its own card
              accessible
              accessibilityLabel={`${[entity.name, ENTITY_TYPE_LABELS[type], ...facts].join(", ")}${entity.isHidden ? ", hidden" : ""}`}
            >
              <Text className="font-inter-bold text-base tracking-tight text-ink" numberOfLines={2}>
                {entity.name}
              </Text>
              <Text className="font-inter-semibold text-[13px] text-muted" numberOfLines={1}>
                {ENTITY_TYPE_LABELS[type]}
                {entity.isHidden ? "  ·  Hidden" : ""}
              </Text>
              {facts.map((fact) => (
                <Text key={fact} className="mt-0.5 font-inter-medium text-[13px] text-ink" numberOfLines={1}>
                  {fact}
                </Text>
              ))}
            </View>
          );
        })
      )}
    </View>
  );
}
