import { useAppData } from "../context/AppDataContext";
import { entityTypeOf } from "../Engines/masterEngine";
import { ENTITY_GROUPS, entityGroupOf } from "../TypesAndVariables/entityTypeLabels";
import SideMenu, { type SideMenuRow } from "./sideMenu";

type EntityTypesMenuProps = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  selected: string; // group key
  onSelect: (groupKey: string) => void;
};

// Side menu for the entities screen: every entity group (one per entity type, except Housing = renting + buying),
// each with how many entities it holds. Picking one switches the screen to that group.
// How it looks and moves is all in SideMenu.
export default function EntityTypesMenu({ visible, onVisibleChange, selected, onSelect }: EntityTypesMenuProps) {
  const { entities } = useAppData();

  const counts = new Map<string, number>(); // group key → how many entities
  for (const e of entities) {
    const key = entityGroupOf(entityTypeOf(e.entityId)).key;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const rows: SideMenuRow[] = ENTITY_GROUPS.map((group) => ({ key: group.key, label: group.label, count: counts.get(group.key) ?? 0 }));

  // The first 8 groups are what you already have (type codes 01–08); the rest are plans and spending.
  // No headings: a line between the two sections marks the break.
  return (
    <SideMenu
      visible={visible}
      onVisibleChange={onVisibleChange}
      selected={selected}
      onSelect={onSelect}
      sections={[rows.slice(0, 8), rows.slice(8)]}
      name="entity types"
    />
  );
}
