import EditEntityCard from "../editEntityCard";
import { useEntityCard } from "./useEntityCard";
import type { EditEntityCardProps } from "../../TypesAndVariables/types";
import { AgeWindowFields, NumberField } from "../formFields";
import { foodForm } from "./entityForms";
import { DINING_OUT_GUIDE, GROCERIES_GUIDE } from "../../TypesAndVariables/costGuides";

// Edit card for the food entity type. The "i" beside each box opens a guide to what households spend on it.
export default function EditFoodCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "food", foodForm);
  const { text: t, set } = card;
  return (
    <EditEntityCard {...card.frame}>
      <NumberField
        label="Groceries"
        hint="per month"
        kind="dollars"
        value={t.groceries}
        onChange={set("groceries")}
        guide={GROCERIES_GUIDE}
      />
      <NumberField
        label="Dining out"
        hint="per month"
        kind="dollars"
        value={t.diningOut}
        onChange={set("diningOut")}
        guide={DINING_OUT_GUIDE}
      />
      <AgeWindowFields start={t.startAge} end={t.endAge} onStart={set("startAge")} onEnd={set("endAge")} />
    </EditEntityCard>
  );
}
