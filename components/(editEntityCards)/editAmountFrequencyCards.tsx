import EditEntityCard from "../editEntityCard";
import { useEntityCard } from "./useEntityCard";
import type { EditEntityCardProps } from "../../TypesAndVariables/types";
import { AgeWindowFields, Field, Note, NumberField, Segmented } from "../formFields";
import { birthdayChristmasForm, recurringPaymentForm, type AmountFrequencyText } from "./entityForms";
import type { Frequency } from "../../TypesAndVariables/types";

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

// Edit cards for the birthdayChristmas and recurringPayment entity types.
// Both are an amount, how often it's paid, and the ages it runs between.

/** The boxes both cards share. */
function AmountFrequencyFields({
  text: t,
  set,
}: {
  text: AmountFrequencyText;
  set: <Key extends keyof AmountFrequencyText>(key: Key) => (value: AmountFrequencyText[Key]) => void;
}) {
  return (
    <>
      <NumberField label="Amount" kind="dollars" value={t.amount} onChange={set("amount")} />
      <Field label="How often">
        <Segmented options={FREQUENCY_OPTIONS} value={t.frequency} onChange={set("frequency")} />
      </Field>
      {t.frequency === "yearly" ? <Note>A yearly amount is spread evenly over the 12 months.</Note> : null}
      <AgeWindowFields start={t.startAge} end={t.endAge} onStart={set("startAge")} onEnd={set("endAge")} />
    </>
  );
}

export function EditBirthdayChristmasCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "birthdayChristmas", birthdayChristmasForm);
  return (
    <EditEntityCard {...card.frame}>
      <AmountFrequencyFields text={card.text} set={card.set} />
    </EditEntityCard>
  );
}

export function EditRecurringPaymentCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "recurringPayment", recurringPaymentForm);
  return (
    <EditEntityCard {...card.frame}>
      <AmountFrequencyFields text={card.text} set={card.set} />
    </EditEntityCard>
  );
}
