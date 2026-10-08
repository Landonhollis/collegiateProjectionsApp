import EditEntityCard from "../editEntityCard";
import { useEntityCard } from "./useEntityCard";
import type { EditEntityCardProps } from "../../TypesAndVariables/types";
import { AgeField, ERRORS, Field, NumberField, Segmented, isBefore } from "../formFields";
import { buyingHomeForm, type BuyingHomeText } from "./entityForms";
import { HOME } from "../../TypesAndVariables/presetVars";

const PAYMENT_OPTIONS: { value: BuyingHomeText["payment"]; label: string }[] = [
  { value: "mortgage", label: "Mortgage" },
  { value: "cash", label: "Cash" },
];

// Edit card for the buyingHome entity type (shown under Housing): a home you'll buy.
// "Mortgage" shows the down payment, term and rate; "Cash" hides them.
// Property tax, insurance and upkeep are worked out by the engine. Utilities start filled in with the average; change it (blank also means the average).
export default function EditBuyingHomeCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "buyingHome", buyingHomeForm);
  const { text: t, set } = card;
  return (
    <EditEntityCard {...card.frame}>
      <Field label="How you'll pay">
        <Segmented options={PAYMENT_OPTIONS} value={t.payment} onChange={set("payment")} />
      </Field>
      <AgeField label="Age you'll buy it" value={t.purchaseAge} onChange={set("purchaseAge")} />
      <NumberField label="Price" kind="dollars" value={t.price} onChange={set("price")} />
      {t.payment === "mortgage" ? (
        <>
          <NumberField label="Down payment" kind="percent" value={t.downPct} onChange={set("downPct")} />
          <NumberField label="Mortgage term" kind="years" value={t.termYears} onChange={set("termYears")} />
          <NumberField label="Interest rate" kind="percent" value={t.ratePct} onChange={set("ratePct")} />
        </>
      ) : null}
      <NumberField
        label="Utilities"
        hint="per month, blank = average"
        kind="dollars"
        placeholder={String(Math.round(HOME.utilitiesMonthly))}
        value={t.utilities}
        onChange={set("utilities")}
      />
      <AgeField
        label="Age you'll sell it"
        hint="optional"
        value={t.sellAge}
        onChange={set("sellAge")}
        error={isBefore(t.sellAge, t.purchaseAge) ? ERRORS.sellBeforeBuy : undefined}
      />
    </EditEntityCard>
  );
}
