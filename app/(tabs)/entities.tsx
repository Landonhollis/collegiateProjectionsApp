import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppData } from "../../context/AppDataContext";
import { bottomMenuSpace } from "../../components/TabButton";
import { useTheme } from "../../context/ThemeContext";
import { useEntityMenu } from "../../context/EntityMenuContext";
import { entityTypeOf } from "../../Engines/masterEngine";
import { ENTITY_TYPE_LABELS, entityGroupByKey } from "../../TypesAndVariables/entityTypeLabels";
import EntityCard from "../../components/entityCard";
import { entitySummary } from "../../components/entitySummary";
import ReorderableGrid from "../../components/reorderableGrid";
import AddOptionsMenu from "../../components/addOptionsMenu";
import ConfirmDialog from "../../components/confirmDialog";
import { EmptyState, FLOATING_ROW_SPACE, FloatingRow } from "../../components/screenParts";
import { EDIT_ENTITY_CARDS } from "../../components/(editEntityCards)";
import type { Entity, EntityTypeKey } from "../../TypesAndVariables/types";

const GUTTER = 16;
const GAP = 12;

/** What the edit card popup is showing, or null when it's closed. An add names the entity type to make. */
type Editor = { entityEditType: "add"; type: EntityTypeKey } | { entityEditType: "edit"; entity: Entity } | null;

// Entities tab: a grid of square entity cards for one entity group at a time. Drag a card by its grip to reorder.
// A group is one entity type, except Housing, which shows renting and buying together (each card says which it is).
// The side menu (floating picker, or pull its tab on the left edge) switches the group; the plus beside it / Edit open the
// entity type's edit card (the plus asks which type first when the group has more than one); Delete asks first.
export default function EntitiesScreen() {
  const { cases, entities, deleteEntity, toggleEntityHidden, reorderEntities } = useAppData();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Which group is showing. The side menu (drawn by the tabs layout) changes it.
  const { groupKey, setMenuOpen } = useEntityMenu();
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [editor, setEditor] = useState<Editor>(null);
  const [deleting, setDeleting] = useState<Entity | null>(null);

  const group = entityGroupByKey(groupKey);
  const label = group.label;
  const types = group.options.map((o) => o.type);
  const shown = entities.filter((e) => types.includes(entityTypeOf(e.entityId)));
  const editorType = editor ? (editor.entityEditType === "add" ? editor.type : entityTypeOf(editor.entity.entityId)) : null;
  const EditCard = editorType ? EDIT_ENTITY_CARDS[editorType] : null; // every entity type has an edit card

  /** The plus: one type → open its edit card; more than one → ask which. */
  function startAdd() {
    if (group.options.length > 1) setAddMenuOpen(true);
    else setEditor({ entityEditType: "add", type: group.options[0].type });
  }

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
    return (
      <EmptyState
        icon="grid-outline"
        title={`No ${label.toLowerCase()} yet`}
        message="Add one to include it in your cases."
        action={{ label: `Add ${label.toLowerCase()}`, onPress: startAdd }}
      />
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      {/* The list fills this whole area; the type picker floats over its top. */}
      <View className="flex-1">
        <ReorderableGrid
          data={shown}
          keyOf={(e) => e.entityId}
          columns={2}
          gap={GAP}
          square
          paddingTop={FLOATING_ROW_SPACE}
          paddingBottom={bottomMenuSpace(insets.bottom)}
          paddingHorizontal={GUTTER}
          onReorder={reorderEntities}
          renderItem={(item, drag) => {
            const c = caseOf(item);
            return (
              <EntityCard
                entityName={item.name}
                entityType={ENTITY_TYPE_LABELS[entityTypeOf(item.entityId)]}
                facts={entitySummary(entityTypeOf(item.entityId), item.inputs)}
                caseName={c.caseName}
                caseColor={c.caseColor}
                isHidden={item.isHidden}
                onDelete={() => setDeleting(item)}
                onToggleHidden={() => {
                  Haptics.selectionAsync();
                  toggleEntityHidden(item.entityId);
                }}
                onEdit={() => setEditor({ entityEditType: "edit", entity: item })}
                {...drag}
              />
            );
          }}
          empty={emptyState()}
        />

        {/* Floats so the cards scroll under it: the plus (add an entity), then the type picker (opens the type menu). */}
        <FloatingRow
          onAdd={startAdd}
          addDisabled={cases.length === 0}
          addLabel={`Add ${label.toLowerCase()}`}
          onPressBar={() => setMenuOpen(true)}
          barLabel={`Showing ${label}. Change`}
        >
          <Ionicons name="menu" size={20} color={colors.ink} />
          <Text className="ml-2.5 flex-1 font-inter-semibold text-base text-ink" numberOfLines={1}>
            {label}
          </Text>
          {shown.length > 0 ? <Text className="mr-1.5 font-inter-semibold text-sm text-muted">{shown.length}</Text> : null}
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </FloatingRow>
      </View>

      {addMenuOpen ? (
        <AddOptionsMenu
          options={group.options.map((o) => ({ key: o.type, label: o.label }))}
          onClose={() => setAddMenuOpen(false)}
          onPick={(key) => {
            const picked = group.options.find((o) => o.type === key);
            if (!picked) throw new Error(`Add menu: "${key}" is not an option of ${label}`);
            setAddMenuOpen(false);
            setEditor({ entityEditType: "add", type: picked.type });
          }}
        />
      ) : null}

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
