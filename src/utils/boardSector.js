// Secteur d'activité du client sur le board Opti'Lex (dev 24/11/2026) : la liste des secteurs, qui peut le préciser, et
// quel secteur afficher. Le secteur est déduit du NDA (code NAF) côté serveur et retombe sur « Générales » quand il est inconnu ;
// le Client Success peut le préciser à la main (colonne `secteur_ovr`, comme `tranche_ovr` ou `phone_ovr` : la valeur posée à la
// main prime, « Automatique » la retire). Sans React : testé par boardSector.test.js.

// La liste du NDA, dans l'ordre du serveur (BUSINESS_TYPES) ; « Générales » est le secteur par défaut, donc en dernier.
export const SECTOR_OPTIONS = [
  'Ambulance', 'Micro créche', 'Dentiste', 'Pharmacie',
  'Salle de sport', 'Esthétique', 'Tech', 'Hôtellerie',
  'Grande Distribution', 'Tertiaire', 'BTP', 'Boulangerie',
  'Immobilier', 'Restauration', 'Générales',
];
export const GENERIC_SECTOR = 'Générales';

// Le Client Success et la direction (mêmes rôles que la fiche de conservation et l'onboarding). Le serveur refuse les autres.
export const SECTOR_EDIT_ROLES = ['customer_success_manager', 'admin', 'ceo'];

// Seule l'orthographe de la valeur enregistrée « Micro créche » est corrigée à l'affichage.
export const secteurLabel = (v) => (v === 'Micro créche' ? 'Micro-crèche' : v);

// Un contrat pas encore client (sans numéro) n'a pas de fiche à modifier ; les rôles en lecture seule non plus.
export const canEditSector = (role, { readOnly = false, numero = null } = {}) => !readOnly && Boolean(numero) && SECTOR_EDIT_ROLES.includes(role);

// Ce que le serveur détecte : `secteur_auto` quand il le donne, sinon `secteur_activite` (ancien serveur : valeur détectée seule).
export const autoSector = (row) => (row?.secteur_auto ?? row?.secteur_activite) || '';
// Ce qu'on affiche : le secteur posé à la main, sinon le détecté.
export const effectiveSector = (row) => row?.secteur_ovr || autoSector(row);
// Posé à la main ?
export const isManualSector = (row) => Boolean(row?.secteur_ovr);

// Mode multi-sélection du board (appui long sur une ligne, puis on coche) : changer le secteur d'un client COCHÉ le change pour
// tous les clients cochés, d'un coup ; un client hors de la sélection ne change que lui. Pas pendant une attribution de CSM en
// cours (`idle` faux) : la sélection est alors figée, on ne mélange pas deux écritures.
export function sectorTargets(numero, picked = [], idle = true) {
  const list = [...new Set(picked)];
  return idle && list.length > 1 && list.includes(numero) ? list : [numero];
}
// Rappel affiché dans la fenêtre quand le choix vaut pour plusieurs clients.
export const sectorBulkLine = (count) => `S’applique aux ${count} clients sélectionnés`;
// Bandeau d'échec quand une partie seulement des clients a été mise à jour.
export const sectorBulkFailure = (failed, total) => (failed === total
  ? `Le secteur n’a pu être changé pour aucun des ${total} clients. Rien n’a changé : réessayez.`
  : `${failed} client${failed > 1 ? 's' : ''} sur ${total} n’${failed > 1 ? 'ont' : 'a'} pas pu être mis à jour : ${failed > 1 ? 'ils ont' : 'il a'} retrouvé son secteur d’avant. Les autres ont bien changé.`);
