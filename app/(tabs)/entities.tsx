import { useState } from "react";
import { FlatList, Pressable, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAppData } from "../../context/AppDataContext";
import { useTheme } from "../../context/ThemeContext";
import { entityTypeOf } from "../../Engines/masterEngine";
import { ENTITY_TYPE_LABELS } from "../../TypesAndVariables/entityTypeLabels";
import EntityCard from "../../components/entityCard";
import EntityTypesMenu from "../../components/entityTypesMenu";
import EdgePullTab from "../../components/edgePullTab";
import ConfirmDialog from "../../components/confirmDialog";
import { AddButton, EmptyState } from "../../components/screenParts";
import { EDIT_ENTITY_CARDS } from "../../components/(editEntityCards)";
import type { Entity, EntityTypeKey } from "../../TypesAndVariables/types";

const GUTTER = 16;
const GAP = 12;

/** What the edit card popup is showing, or null when it's closed. */
type Editor = { entityEditType: "add" } | { entityEditType: "edit"; entity: Entity } | null;

// Entities tab: a grid of square entity cards for one entity type at a time.
// The side menu (toolbar button, or pull from the left edge) switches the type; Add / Edit open that type's edit card; Delete asks first.
export default function EntitiesScreen() {
  const { cases, entities, deleteEntity, toggleEntityHidden } = useAppData();
  const { colors, lift } = useTheme();
  const { width } = useWindowDimensions();

  // Which entity type is showing. The side menu changes it.
  const [entityType, setEntityType] = useState<EntityTypeKey>("existingHome");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editor, setEditor] = useState<Editor>(null);
  const [deleting, setDeleting] = useState<Entity | null>(null);

  const shown = entities.filter((e) => entityTypeOf(e.entityId) === entityType);
  const EditCard = EDIT_ENTITY_CARDS[entityType]; // undefined until this type's card is built
  const cardWidth = (width - GUTTER * 2 - GAP) / 2;
  const label = ENTITY_TYPE_LABELS[entityType];

  function caseOf(entity: Entity) {
    const found = cases.find((c) => c.caseId === entity.caseId);
    if (!found) throw new Error(`Entity "${entity.entityId}" has caseId "${entity.caseId}", which matches no case`);
    return found;
  }

  function emptyState() {
    if (cases.length === 0) {
      return (
        <EmptyState
          icon="folder-open-outline"
          title="Make a case first"
          message="Every entity belongs to a case. Make one, then come back to add entities to it."
          action={{ label: "Go to cases", onPress: () => router.navigate("/cases") }}
        />
      );
    }
    if (!EditCard) {
      return <EmptyState icon="construct-outline" title="Coming soon" message={`${label} entities can't be added yet.`} />;
    }
    return (
      <EmptyState
        icon="grid-outline"
        title={`No ${label.toLowerCase()} yet`}
        message="Add one to include it in your cases."
        action={{ label: `Add ${label.toLowerCase()}`, onPress: () => setEditor({ entityEditType: "add" }) }}
      />
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      {/* Toolbar: type picker on the left, Add on the right */}
      <View className="flex-row items-center gap-3 px-4 pb-2 pt-4">
        <Pressable
          className="h-11 flex-1 flex-row items-center rounded-2xl bg-surface px-3.5 active:opacity-70"
          style={lift}
          onPress={() => setMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Entity type: ${label}. Change type`}
        >
          <Ionicons name="menu" size={20} color={colors.ink} />
          <Text className="ml-2.5 flex-1 font-inter-semibold text-base text-ink" numberOfLines={1}>
            {label}
          </Text>
          {shown.length > 0 ? <Text className="mr-1.5 font-inter-semibold text-sm text-muted">{shown.length}</Text> : null}
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
        <AddButton onPress={() => setEditor({ entityEditType: "add" })} disabled={!EditCard || cases.length === 0} />
      </View>

      <FlatList
        data={shown}
        keyExtractor={(e) => e.entityId}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 24, gap: GAP }}
        columnWrapperStyle={{ gap: GAP }}
        renderItem={({ item }) => {
          const c = caseOf(item);
          return (
            <View style={{ width: cardWidth }}>
              <EntityCard
                entityName={item.name}
                entityType={label}
                caseName={c.caseName}
                caseColor={c.caseColor}
                isHidden={item.isHidden}
                onDelete={() => setDeleting(item)}
                onToggleHidden={() => {
                  Haptics.selectionAsync();
                  toggleEntityHidden(item.entityId);
                }}
                onEdit={() => setEditor({ entityEditType: "edit", entity: item })}
              />
            </View>
          );
        }}
        ListEmptyComponent={emptyState()}
      />

      {/* Pull from the left edge to open the type menu */}
      {!menuOpen ? <EdgePullTab label="Open entity types" onOpen={() => setMenuOpen(true)} /> : null}

      <EntityTypesMenu visible={menuOpen} selected={entityType} onSelect={setEntityType} onClose={() => setMenuOpen(false)} />

      {editor && EditCard ? (
        editor.entityEditType === "add" ? (
          <EditCard entityEditType="add" onClose={() => setEditor(null)} />
        ) : (
          <EditCard entityEditType="edit" entity={editor.entity} onClose={() => setEditor(null)} />
        )
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title={`Delete “${deleting.name}”?`}
          message="This can't be undone."
          confirmLabel="Delete"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            deleteEntity(deleting.entityId);
            setDeleting(null);
          }}
        />
      ) : null}
    </View>
  );
}
