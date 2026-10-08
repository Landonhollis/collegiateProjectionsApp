import EditEntityCard from "../editEntityCard";
import { useEntityCard } from "./useEntityCard";
import type { EditEntityCardProps } from "../../TypesAndVariables/types";
import { AgeField, Note, NumberField } from "../formFields";
import { kidForm } from "./entityForms";
import { KIDS } from "../../TypesAndVariables/presetVars";
import { KID_COST_GUIDE } from "../../TypesAndVariables/costGuides";

// Edit card for the kid entity type: one child per entity.
// The "i" beside the cost opens a guide to what a child costs (housing and food are left out: other entities hold them).
export default function EditKidCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "kid", kidForm);
  const { text: t, set } = card;
  return (
    <EditEntityCard {...card.frame}>
      <NumberField
        label="Cost per year"
        hint="not housing or food"
        kind="dollars"
        value={t.annualCost}
        onChange={set("annualCost")}
        guide={KID_COST_GUIDE}
      />
      <AgeField label="Your age when they're born" value={t.birthAge} onChange={set("birthAge")} />
      <Note>{`The cost runs from birth until the child turns ${KIDS.endAge}.`}</Note>
    </EditEntityCard>
  );
}
