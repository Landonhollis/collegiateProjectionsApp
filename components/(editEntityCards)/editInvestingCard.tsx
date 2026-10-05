import EditEntityCard from "../editEntityCard";
import { useEntityCard } from "./useEntityCard";
import type { EditEntityCardProps } from "../../TypesAndVariables/types";
import { AgeWindowFields, NumberField, SectionLabel } from "../formFields";
import { investingForm } from "./entityForms";

// Edit card for the investing entity type: a new investment account you'll open.
// The account number (4–12) is given out by masterEngine, so it isn't asked for.
export default function EditInvestingCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "investing", investingForm);
  const { text: t, set } = card;
  return (
    <EditEntityCard {...card.frame}>
      <NumberField label="Starting amount" hint="paid in when you start" kind="dollars" value={t.initial} onChange={set("initial")} />
      <NumberField label="Yearly return" hint="after inflation" kind="signedPercent" value={t.returnPct} onChange={set("returnPct")} />

      <SectionLabel>Putting money in</SectionLabel>
      <NumberField label="Monthly deposit" hint="optional" kind="dollars" value={t.contribution} onChange={set("contribution")} />
      <AgeWindowFields
        start={t.contributionStartAge}
        end={t.contributionEndAge}
        onStart={set("contributionStartAge")}
        onEnd={set("contributionEndAge")}
        startLabel="Age you start"
        startHint=""
        endLabel="Age deposits stop"
        endHint="blank = never stop"
      />

      <SectionLabel>Taking money out</SectionLabel>
      <NumberField label="Monthly withdrawal" hint="optional" kind="dollars" value={t.withdrawal} onChange={set("withdrawal")} />
      <AgeWindowFields
        start={t.withdrawalStartAge}
        end={t.withdrawalEndAge}
        onStart={set("withdrawalStartAge")}
        onEnd={set("withdrawalEndAge")}
        startLabel="Age withdrawals start"
        startHint="blank = when you start"
        endLabel="Age withdrawals stop"
        endHint="blank = never stop"
      />
    </EditEntityCard>
  );
}
