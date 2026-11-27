import { pspLabel } from './constants.js';

// Ordre unique pour Owner, Opti’Lex et Global ; ne modifie pas la réponse API.
export function orderedReceipts(items, scope = 'global') {
  const seen = new Set();
  return (items || []).filter((r) => {
    if ((scope !== 'global' && r.entity !== scope) || seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  }).sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0)
    || String(b.id).localeCompare(String(a.id)));
}

// Deux PSP sur un encaissement Owner (facturation, 27/11/2026) : il se lit et
// se regroupe sous « Learnypay + IFX » ; son montant ne se partage pas.
export const receiptPspLabel = (r) => pspLabel([r?.psp, r?.psp_2]);
// Pastille verte quand chaque PSP de l'encaissement est connu de la liste.
export const receiptPspKnown = (r, colors) => !!r?.psp && [r.psp, r.psp_2].filter(Boolean).every((p) => !!colors[p]);
