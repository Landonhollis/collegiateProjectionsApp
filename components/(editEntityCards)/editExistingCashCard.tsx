import EditEntityCard from "../editEntityCard";
import { useEntityCard } from "./useEntityCard";
import type { EditEntityCardProps } from "../../TypesAndVariables/types";
import { NumberField } from "../formFields";
import { openingCashForm } from "./entityForms";

// Edit card for the openingCash entity type ("Existing Cash"): the cash you have today.
export default function EditExistingCashCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "openingCash", openingCashForm);
  const { text: t, set } = card;
  return (
    <EditEntityCard {...card.frame}>
      <NumberField label="Cash today" hint="checking + savings" kind="dollars" value={t.amount} onChange={set("amount")} />
    </EditEntityCard>
  );
}
