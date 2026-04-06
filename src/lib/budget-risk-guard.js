import { toNumber } from "./estimate";

const SHARE_FIELDS = {
  heightCoef: "heightWorkSharePercent",
  nightWorkCoef: "nightWorkSharePercent",
  weekendWorkCoef: "weekendWorkSharePercent",
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getCoefficientSharePercent(budget = {}, fieldKey) {
  const shareKey = SHARE_FIELDS[fieldKey];
  if (!shareKey) return 100;
  return clamp(toNumber(budget?.[shareKey], 100), 0, 100);
}

export function getCoefficientShareLabel(budget = {}, fieldKey) {
  const shareKey = SHARE_FIELDS[fieldKey];
  if (!shareKey) return "";
  return `${getCoefficientSharePercent(budget, fieldKey).toFixed(0)}% работ`;
}

export function buildRiskGuardInsight({ fieldKey, budget, recommendation, coefficientRub = 0 }) {
  if (!recommendation) return null;

  const currentValue = toNumber(budget?.[fieldKey], 1);
  const targetValue = toNumber(recommendation?.value, currentValue);
  const delta = Number((currentValue - targetValue).toFixed(2));
  const absDelta = Math.abs(delta);
  const sharePercent = getCoefficientSharePercent(budget, fieldKey);
  const hasPartialShare = sharePercent < 100 && SHARE_FIELDS[fieldKey];
  const overBudget = delta > 0.03;
  const underBudget = delta < -0.03;
  const shouldExplain = absDelta >= 0.04 || hasPartialShare;

  if (!shouldExplain) return null;

  const direction = overBudget ? "выше" : underBudget ? "ниже" : "рядом";
  const shortHint = overBudget
    ? "Risk Guard AI: коэффициент выглядит завышенным относительно объекта."
    : underBudget
      ? "Risk Guard AI: коэффициент выглядит заниженным относительно объекта."
      : "Risk Guard AI: проверьте долю применения коэффициента.";

  const reasonLines = [
    recommendation?.reason || "",
    hasPartialShare ? `Сейчас коэффициент действует только на ${sharePercent.toFixed(0)}% объема работ.` : "",
    `Текущее значение x${currentValue.toFixed(2)} ${direction} рекомендуемого x${targetValue.toFixed(2)}.`,
    coefficientRub > 0 ? `В текущем расчете этот коэффициент влияет примерно на ${Math.round(coefficientRub).toLocaleString("ru-RU")} ₽.` : "",
    overBudget
      ? "Чтобы сбалансировать бюджет, стоит проверить, не завышен ли коэффициент или процент его применения."
      : underBudget
        ? "Чтобы сбалансировать бюджет, стоит проверить, не требуется ли усилить коэффициент или увеличить процент его применения."
        : "Базовый коэффициент близок к рекомендации, но доля применения может требовать уточнения.",
  ].filter(Boolean);

  return {
    shortHint,
    detailsTitle: "Пояснение Risk Guard AI",
    details: reasonLines,
  };
}
