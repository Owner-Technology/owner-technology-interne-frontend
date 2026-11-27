// A review affects the installment's follow-up badge, never cash or debt totals.
export function reviewedInstallment(period, scope, reviews = [], extraDue = {}) {
  const entities = scope === 'global' ? ['owner', 'optilex'] : [scope];
  let confirmed = false;
  const settled = entities.every(entity => {
    const review = reviews.find(r => r.period_id === period.id && r.entity === entity && r.regularized);
    if (review) confirmed = true;
    const suffix = entity === 'owner' ? 'owner' : 'optilex_ttc';
    const due = Number(period[`expected_${suffix}`] || 0) + Number(extraDue[entity] || 0);
    return !!review || Number(period[`received_${suffix}`] || 0) >= due;
  });
  return confirmed && settled;
}

// Mois régularisé par des paiements des mois suivants (facturation, 27/11/2026).
// Lu dans le relevé du serveur (`timeline.statement`) : pour chaque entité de la
// vision, rien ne reste impayé ni n'a été effacé par une correction, et au moins
// une a vu son manque soldé plus tard. Le dernier règlement : son mois et sa date
// de paiement réelle (null si non saisie). null si le mois n'est pas régularisé.
// Même règle que le board (board_receivables.regularized_by_statement).
export function statementRegularization(statement, scope, month) {
  const entities = scope === 'global' ? ['owner', 'optilex'] : [scope];
  let last = null;
  for (const entity of entities) {
    const m = (statement?.[entity] || []).find((x) => String(x.period).slice(0, 7) === month);
    if (!m) return null;
    if (Number(m.unpaid || 0) > 0 || (m.written_off || []).some((l) => Number(l.amount || 0) > 0)) return null;
    const reg = m.regularized;
    if (reg && (!last || String(reg.period) > String(last.period))) {
      last = { period: String(reg.period).slice(0, 7), paidOn: reg.paid_on || null };
    }
  }
  return last;
}

// « régularisée le 15 novembre 2026 », sinon « régularisée en novembre 2026 ».
export function regularizationText(reg, { formatDay, formatMonth }) {
  if (!reg) return '';
  return reg.paidOn ? `régularisée le ${formatDay(reg.paidOn)}` : `régularisée en ${formatMonth(reg.period).toLowerCase()}`;
}
