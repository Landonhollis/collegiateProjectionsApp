import EditEntityCard from "../editEntityCard";
import { useEntityCard } from "./useEntityCard";
import type { EditEntityCardProps } from "../../TypesAndVariables/types";
import { AgeField, NumberField } from "../formFields";
import { existingCreditCardForm } from "./entityForms";

// Edit card for the existingCreditCard entity type: credit card debt you have today.
// Interest is added every month; payments start at the age given (or now).
export default function EditExistingCreditCardCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "existingCreditCard", existingCreditCardForm);
  const { text: t, set } = card;
  return (
    <EditEntityCard {...card.frame}>
      <NumberField label="Balance" hint="what you owe" kind="dollars" value={t.balance} onChange={set("balance")} />
      <NumberField label="APR" hint="yearly interest" kind="percent" value={t.aprPct} onChange={set("aprPct")} />
      <NumberField label="Monthly payment" kind="dollars" value={t.payment} onChange={set("payment")} />
      <AgeField label="Age payments start" hint="blank = now" value={t.paymentStartAge} onChange={set("paymentStartAge")} />
    </EditEntityCard>
  );
}
