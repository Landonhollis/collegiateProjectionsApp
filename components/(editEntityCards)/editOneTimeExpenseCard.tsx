import EditEntityCard from "../editEntityCard";
import { useEntityCard } from "./useEntityCard";
import type { EditEntityCardProps } from "../../TypesAndVariables/types";
import { AgeField, NumberField } from "../formFields";
import { oneTimeExpenseForm } from "./entityForms";

// Edit card for the oneTimeExpense entity type: one payment at one age.
export default function EditOneTimeExpenseCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "oneTimeExpense", oneTimeExpenseForm);
  const { text: t, set } = card;
  return (
    <EditEntityCard {...card.frame}>
      <NumberField label="Amount" kind="dollars" value={t.amount} onChange={set("amount")} />
      <AgeField label="Age it happens" value={t.age} onChange={set("age")} />
    </EditEntityCard>
  );
}
