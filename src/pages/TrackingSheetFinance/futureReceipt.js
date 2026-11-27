// futureReceipt.js — pas d'encaissement sur un mois futur (facturation, 27/11/2026).
//
// En novembre, on ne saisit pas un encaissement en décembre. Le serveur refuse
// aussi (règle tenue côté back) ; ici on évite seulement de proposer la saisie.
// Ne touche que le montant reçu et sa date de paiement : l'attendu, les reports,
// la pause et la modalité d'un mois futur restent libres. Effacer reste permis.

import { currentPeriod } from './constants.js';

const monthOf = (value) => String(value || '').slice(0, 7);

// Mois strictement après le mois courant.
export const isFutureMonth = (period, now = currentPeriod()) => {
  const month = monthOf(period);
  return /^\d{4}-\d{2}$/.test(month) && month > now;
};

// Dernier jour du mois courant, au format des champs date (« YYYY-MM-DD »).
export const lastPaymentDay = (now = currentPeriod()) => {
  const [y, m] = now.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${now}-${String(last).padStart(2, '0')}`;
};

// Le reçu d'un mois se saisit-il ? Un mois futur déjà saisi (erreur passée)
// reste ouvert pour être remis à zéro.
export const receiptEditable = (period, value, now = currentPeriod()) => (
  !isFutureMonth(period, now) || (Number(value) || 0) !== 0
);

// La date de paiement : jamais dans un mois futur, jamais sur un mois futur.
export const paymentDateEditable = (period, value, now = currentPeriod()) => (
  !isFutureMonth(period, now) || !!value
);

// Le motif à afficher, ou null si la valeur est permise.
export const futureReceiptError = ({ period, amount, paidOn } = {}, now = currentPeriod()) => {
  if (isFutureMonth(period, now) && (Number(amount) || 0) !== 0) {
    return 'Un encaissement ne se saisit pas sur un mois futur.';
  }
  if (paidOn && (isFutureMonth(paidOn, now) || isFutureMonth(period, now))) {
    return 'La date de paiement ne peut pas tomber dans un mois futur.';
  }
  return null;
};

export const FUTURE_RECEIPT_TITLE = 'Mois à venir : l’encaissement se saisit à partir de son mois';
// Montant tapé sur un mois à venir dans « Gérer les attendus » : non envoyé.
export const FUTURE_RECEIPT_MESSAGE = 'Mois à venir : seul 0 € est accepté pour le reçu.';
