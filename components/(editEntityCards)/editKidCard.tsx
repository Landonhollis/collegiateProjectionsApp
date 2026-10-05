import EditEntityCard from "../editEntityCard";
import { useEntityCard } from "./useEntityCard";
import type { EditEntityCardProps } from "../../TypesAndVariables/types";
import { AgeField, Note, NumberField } from "../formFields";
import { kidForm } from "./entityForms";
import { KIDS } from "../../TypesAndVariables/presetVars";

// Edit card for the kid entity type: one child per entity.
export default function EditKidCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "kid", kidForm);
  const { text: t, set } = card;
  return (
    <EditEntityCard {...card.frame}>
      <NumberField label="Cost per year" hint="often $10,000–$25,000" kind="dollars" value={t.annualCost} onChange={set("annualCost")} />
      <AgeField label="Your age when they're born" value={t.birthAge} onChange={set("birthAge")} />
      <Note>{`The cost runs from birth until the child turns ${KIDS.endAge}.`}</Note>
    </EditEntityCard>
  );
}
