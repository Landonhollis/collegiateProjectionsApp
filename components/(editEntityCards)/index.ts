import type { ComponentType } from "react";
import EditExistingCashCard from "./editExistingCashCard";
import EditExistingHomeCard from "./editExistingHomeCard";
import type { EditEntityCardProps, EntityTypeKey } from "../../TypesAndVariables/types";

// Entity type → its edit card. Add each new card here as it's built (23 in total).
export const EDIT_ENTITY_CARDS: Partial<Record<EntityTypeKey, ComponentType<EditEntityCardProps>>> = {
  openingCash: EditExistingCashCard,
  existingHome: EditExistingHomeCard,
};
