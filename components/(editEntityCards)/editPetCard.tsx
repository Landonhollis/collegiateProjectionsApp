import EditEntityCard from "../editEntityCard";
import { useEntityCard } from "./useEntityCard";
import type { EditEntityCardProps } from "../../TypesAndVariables/types";
import { AgeField, NumberField } from "../formFields";
import { petForm } from "./entityForms";

// Edit card for the pet entity type: one pet per entity.
// A pet you already have (an age in the past) has no adoption cost charged.
export default function EditPetCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "pet", petForm);
  const { text: t, set } = card;
  return (
    <EditEntityCard {...card.frame}>
      <AgeField label="Your age when you get it" value={t.startAge} onChange={set("startAge")} />
      <NumberField label="Years it lives" kind="years" value={t.lifespanYears} onChange={set("lifespanYears")} />
      <NumberField label="Adoption cost" hint="0 if none" kind="dollars" value={t.adoptionCost} onChange={set("adoptionCost")} />
      <NumberField label="Food" hint="per month" kind="dollars" value={t.foodPerMonth} onChange={set("foodPerMonth")} />
      <NumberField label="Vet" hint="per year" kind="dollars" value={t.vetPerYear} onChange={set("vetPerYear")} />
    </EditEntityCard>
  );
}
