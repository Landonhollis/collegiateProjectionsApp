import EditEntityCard from "../editEntityCard";
import { useEntityCard } from "./useEntityCard";
import type { EditEntityCardProps } from "../../TypesAndVariables/types";
import { AgeWindowFields, Note, NumberField } from "../formFields";
import { PERSONAL_KEYS, personalForm, type PersonalKey } from "./entityForms";

const LABELS: Record<PersonalKey, string> = {
  clothing: "Clothing",
  otherPersonalCare: "Personal care",
  entertainment: "Entertainment",
  gym: "Gym",
  phonePlan: "Phone plan",
  books: "Books",
  courses: "Courses",
  events: "Events",
};

// Edit card for the personal entity type: everyday personal spending, each a monthly amount.
export default function EditPersonalCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "personal", personalForm);
  const { text: t, set } = card;
  return (
    <EditEntityCard {...card.frame}>
      <Note>All per month. Fill in only the ones you spend on.</Note>
      {PERSONAL_KEYS.map((key) => (
        <NumberField key={key} label={LABELS[key]} kind="dollars" value={t[key]} onChange={set(key)} />
      ))}
      <AgeWindowFields start={t.startAge} end={t.endAge} onStart={set("startAge")} onEnd={set("endAge")} />
    </EditEntityCard>
  );
}
