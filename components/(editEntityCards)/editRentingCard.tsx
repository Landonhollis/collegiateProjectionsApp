import EditEntityCard from "../editEntityCard";
import { useEntityCard } from "./useEntityCard";
import type { EditEntityCardProps } from "../../TypesAndVariables/types";
import { AgeWindowFields, NumberField } from "../formFields";
import { rentingForm } from "./entityForms";

// Edit card for the renting entity type (shown under Housing). Renters insurance is worked out by the engine.
export default function EditRentingCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "renting", rentingForm);
  const { text: t, set } = card;
  return (
    <EditEntityCard {...card.frame}>
      <NumberField label="Rent" hint="per month" kind="dollars" value={t.rent} onChange={set("rent")} />
      <NumberField label="Utilities" hint="per month, optional" kind="dollars" value={t.utilities} onChange={set("utilities")} />
      <NumberField label="Other fees" hint="parking, pet rent, trash…" kind="dollars" value={t.junkFees} onChange={set("junkFees")} />
      <AgeWindowFields start={t.startAge} end={t.endAge} onStart={set("startAge")} onEnd={set("endAge")} />
    </EditEntityCard>
  );
}
