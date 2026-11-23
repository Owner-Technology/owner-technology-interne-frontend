// Calendrier des modalités renvoyé par GET /finance-periods/client/{id}/payment-mode-schedule.
//
// Dev 2026-11-23 : la puce « Modalité » lisait la ligne du mois affiché. Un mois que le recalcul ne touche pas
// (réglé, attendu fixé à la main) gardait l'ancien rythme : la puce disait « Mensuel » juste après un passage
// en annuel, et le geste était refait. Quand le rythme a été daté, c'est le calendrier qui fait foi.

/** Le rythme a-t-il été daté par la finance (au moins un changement après l'origine) ? */
export function hasDatedMode(schedule, entity) {
  const key = entity === 'optilex' && schedule?.follows_owner ? 'owner' : entity;
  return (schedule?.entities?.[key]?.timeline || []).some((t) => t.effective_from);
}

/** Rythme en vigueur le mois `month` ('YYYY-MM'), ou null sans calendrier daté. */
export function modeAtMonth(schedule, entity, month) {
  if (!hasDatedMode(schedule, entity)) return null;
  const key = entity === 'optilex' && schedule.follows_owner ? 'owner' : entity;
  let mode = null;
  for (const t of schedule.entities[key].timeline) {
    const from = t.effective_from ? String(t.effective_from).slice(0, 7) : null;
    if (from && month && from > month) break;
    mode = t.mode;
  }
  return mode;
}

/**
 * Passage d'Owner à un autre rythme alors qu'Opti'Lex suit Owner : Opti'Lex change aussi, sauf si on le garde.
 * Renvoie le rythme actuel d'Opti'Lex à proposer de garder, ou null quand la question ne se pose pas.
 */
export function optilexKeptMode(schedule, field, newMode) {
  if (field !== 'payment_mode' || !schedule?.follows_owner) return null;
  const current = schedule.entities?.optilex?.in_force || schedule.entities?.owner?.in_force || null;
  return current && current !== newMode ? current : null;
}
