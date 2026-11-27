import { onboardingPhaseOf, onboardingDayKey, dayKey } from './constants.js';
import { businessDaysAfter } from '../../utils/frenchBusinessDays.js';
export function matchesLateOnboarding(row, choice, today = new Date()) {
  if (choice === 'all') return true;
  const past = onboardingPhaseOf(row, today) === 'past';
  return choice === 'past' ? past : !past;
}
export function matchesAnnualRenewal(row, scope, renewals) {
  const entities = renewals.get(row.client_id) || [];
  return scope === 'global' ? entities.length > 0 : entities.includes(scope);
}
// Clients rétractés (actés ou en cours) : ils ne doivent rien et ne seront pas
// onboardés, donc ni « Retard du mois » ni « Onboarding » (dev 17/11/2026).
const RETRACTED_ETATS = new Set(['Rétractation', 'En cours de rétractation']);
export function isRetractedEtat(displayedState) {
  return RETRACTED_ETATS.has(displayedState);
}

// Délai J+5 après l'onboarding (réunion du 27/11/2026) : le premier prélèvement (Owner Pay, Qonto) n'est pas encore
// arrivé ni saisi. Un client onboardé il y a moins de 5 jours ouvrés sort du « Retard du mois » ; au 5e jour ouvré
// après l'onboarding, il y revient. Filtre d'affichage : le reste dû calculé par le serveur ne change pas.
export const ONBOARDING_GRACE_BUSINESS_DAYS = 5;
export function inOnboardingGrace(row, today = new Date()) {
  const onboarding = onboardingDayKey(row);
  const todayKey = dayKey(today);
  if (!onboarding || onboarding > todayKey) return false;
  return businessDaysAfter(onboarding, todayKey) < ONBOARDING_GRACE_BUSINESS_DAYS;
}
