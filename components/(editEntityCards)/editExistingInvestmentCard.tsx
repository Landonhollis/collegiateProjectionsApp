import EditEntityCard from "../editEntityCard";
import { useEntityCard } from "./useEntityCard";
import type { EditEntityCardProps } from "../../TypesAndVariables/types";
import { AgeWindowFields, NumberField, SectionLabel } from "../formFields";
import { existingInvestmentForm } from "./entityForms";

// Edit card for the existingInvestment entity type: an investment account you already have.
// The account number (4–12) is given out by masterEngine, so it isn't asked for.
export default function EditExistingInvestmentCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "existingInvestment", existingInvestmentForm);
  const { text: t, set } = card;
  return (
    <EditEntityCard {...card.frame}>
      <NumberField label="Invested today" kind="dollars" value={t.invested} onChange={set("invested")} />
      <NumberField label="Yearly return" hint="after inflation" kind="signedPercent" value={t.returnPct} onChange={set("returnPct")} />

      <SectionLabel>Putting money in</SectionLabel>
      <NumberField label="Monthly deposit" hint="optional" kind="dollars" value={t.contribution} onChange={set("contribution")} />
      <AgeWindowFields
        start={t.contributionStartAge}
        end={t.contributionEndAge}
        onStart={set("contributionStartAge")}
        onEnd={set("contributionEndAge")}
        startLabel="Age deposits start"
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
        endLabel="Age withdrawals stop"
        endHint="blank = never stop"
      />
    </EditEntityCard>
  );
}
