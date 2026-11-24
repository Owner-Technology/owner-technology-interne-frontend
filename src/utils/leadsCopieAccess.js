// src/utils/leadsCopieAccess.js
//
// Accès à la page « Leads » (copie, /ceo/leads-copie) : deux personnes seulement. Le dépôt est public : aucune adresse
// ici. La liste vient de `VITE_LEADS_COPIE_ACCESS` (adresses séparées par des virgules, dans `.env.local`, jamais
// commité). Variable absente (production, autre poste) : personne n'y accède et l'entrée du menu n'apparaît pas.
const USER_KEY = 'auth_user';

const allowed = () => String(import.meta.env?.VITE_LEADS_COPIE_ACCESS || '')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

function storedUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
}

export function canSeeLeadsCopie(user = storedUser()) {
  const mail = String(user?.email || '').trim().toLowerCase();
  return Boolean(mail) && allowed().includes(mail);
}
