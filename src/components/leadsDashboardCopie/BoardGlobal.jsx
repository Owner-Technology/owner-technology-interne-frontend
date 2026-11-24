// src/components/leadsDashboardCopie/BoardGlobal.jsx
//
// Onglet « Board global » de la page Leads (copie) : une feuille de calcul d'UN mois (lettres de colonnes, numéros de lignes,
// grille complète), libellés colorés à gauche, nom du groupe en vertical, valeurs à droite. Les valeurs ne sont pas branchées :
// un chiffre inconnu s'affiche « — » ; les colonnes suivantes sont des cellules libres. La carte va jusqu'au bord droit de la carte
// « Ads Meta » de l'onglet Canaux et ads (toute la largeur de la page). Au-dessus de la feuille, deux outils : le filtre (quels groupes
// afficher), la période (le sélecteur de la page Finance : périodes proposées + calendrier) et des raccourcis (cette semaine, ce
// mois-ci…). La période n'est pas écrite dans la feuille : une fois choisie, elle apparaît à côté des outils, de la gauche vers la
// droite. Deux tableaux : le choix se fait près des onglets de la page (BOARDS), le second est une feuille vide.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Filter } from 'lucide-react';
import { PeriodPicker } from '../../pages/TrackingSheetFinance/statistics/PeriodPicker.jsx';
import { DAY_PRESETS, dayRangeLabel, presetDays } from '../../pages/TrackingSheetFinance/statistics/period.js';
import { parisToday } from '../../utils/parisDates.js';
import { BOARDS } from './model.js';

// `strong` : une ligne de total ou de résultat, mise en avant.
const GROUPS = [
  { key: 'couts', name: 'Coûts', tint: 'blue', rows: [
    { label: 'Coût fixe (sales)' }, { label: 'Cold calling (variables)' }, { label: 'ADS (budgets ads)' }, { label: 'ADS (coûts variables)' },
    { label: 'ADS (coûts production / gestion)' }, { label: 'Challenge (budgets ads)' }, { label: 'Challenge (coûts variables)' },
    { label: "Coût d'acquisition total", strong: true },
  ] },
  { key: 'clients', name: 'Clients', tint: 'sand', rows: [
    { label: 'Clients cold call' }, { label: 'Clients ADS' }, { label: 'Clients challenge' }, { label: 'Clients recommandation' },
    { label: 'Clients acquis / mois', strong: true }, { label: 'Rétractations' }, { label: 'Clients nets / mois', strong: true },
  ] },
  { key: 'ventes', name: 'Ventes', tint: 'sage', rows: [
    { label: 'Nombre de sales' }, { label: "Coût d'acquisition moyen / client" }, { label: 'CA annuel généré' }, { label: 'Rentabilité (CA)' },
    { label: 'Rentabilité générale (%)', strong: true }, { label: "Coût d'acquisition total (% du CA)" },
  ] },
  { key: 'canaux', name: 'Par canal', tint: 'lilac', rows: [
    { label: 'CA annuel cold call généré' }, { label: 'Rentabilité cold call (CA)' }, { label: 'Rentabilité cold call (%)', strong: true },
    { label: 'CA annuel ADS généré' }, { label: 'Rentabilité ADS (CA)' }, { label: 'Rentabilité ADS (%)', strong: true },
    { label: 'CA annuel challenge généré' }, { label: 'Rentabilité challenge (CA)' }, { label: 'Rentabilité challenge (%)', strong: true },
  ] },
  { key: 'poids', name: 'Poids', tint: 'blue', rows: [
    { label: 'Poids cold call / CA' }, { label: 'Poids ADS / CA' }, { label: 'Poids challenge / CA' },
  ] },
  { key: 'volumes', name: 'Volumes', tint: 'sand', rows: [{ label: 'Cold calls' }, { label: 'Leads' }] },
];

const QUICK = ['this-week', 'this-month', 'last-month'];   // raccourcis à côté du sélecteur
const COLS = ['C', 'D', 'E', 'F', 'G', 'H'];   // C = le mois ; D à H = cellules libres
const presetName = (value) => (value.preset === 'custom' ? 'Personnalisée' : DAY_PRESETS.find((p) => p.key === value.preset)?.label || 'Personnalisée');

// Filtre : quels groupes du tableau sont affichés. Le dernier groupe affiché ne se décoche pas (un tableau vide ne sert à rien).
function FilterMenu({ hidden, onToggle, onReset, disabled = false }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const escape = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const shown = GROUPS.length - hidden.size;
  return (
    <div className="bgl-filter" ref={box}>
      <button type="button" className="bgl-tool" aria-haspopup="true" aria-expanded={open && !disabled} aria-label="Filtrer les groupes" disabled={disabled}
        title={disabled ? 'Ce tableau n’a pas de groupes à filtrer' : 'Filtrer'} data-active={hidden.size ? 'true' : undefined} onClick={() => setOpen(!open)}>
        <Filter size={17} strokeWidth={2} aria-hidden="true" />
        {hidden.size > 0 && <span className="bgl-badge">{shown}</span>}
      </button>
      {open && !disabled && (
        <div className="bgl-menu" role="group" aria-label="Groupes affichés">
          <div className="bgl-menu-title">Groupes affichés</div>
          {GROUPS.map((g) => {
            const on = !hidden.has(g.key);
            return (
              <button key={g.key} type="button" role="checkbox" aria-checked={on} className="bgl-opt" data-tint={g.tint}
                disabled={on && shown === 1} onClick={() => onToggle(g.key)}>
                <i className="bgl-dot" /><span>{g.name}</span>{on && <Check size={14} strokeWidth={2.4} aria-hidden="true" />}
              </button>
            );
          })}
          <button type="button" className="bgl-reset" disabled={!hidden.size} onClick={onReset}>Tout afficher</button>
        </div>
      )}
    </div>
  );
}

// Tableau 2 : une feuille vide (lettres, numéros, cellules), rien d'écrit.
const BLANK_COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
function BlankSheet() {
  return (
    <table className="bgl-sheet bgl-blank">
      <colgroup><col className="bgl-c-num" />{BLANK_COLS.map((c) => <col key={c} className="bgl-c-val" />)}</colgroup>
      <thead><tr className="bgl-letters" aria-hidden="true"><th />{BLANK_COLS.map((c) => <th key={c}>{c}</th>)}</tr></thead>
      <tbody>
        {Array.from({ length: 30 }, (_, i) => (
          <tr key={i}><td className="bgl-n" aria-hidden="true">{i + 1}</td>{BLANK_COLS.map((c) => <td key={c} className="bgl-x" aria-hidden="true" />)}</tr>
        ))}
      </tbody>
    </table>
  );
}

export default function BoardGlobal({ board = BOARDS[0].key }) {
  const [period, setPeriod] = useState(null);   // rien de choisi au départ : la date n'apparaît qu'une fois sélectionnée
  const [hidden, setHidden] = useState(() => new Set());
  const toggle = (key) => setHidden((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const quick = (key) => setPeriod((now) => (now?.preset === key ? null : { ...presetDays(key, parisToday()), preset: key }));   // un second clic retire la période
  const first = board === BOARDS[0].key;

  // Numéro de ligne : les groupes sont séparés par une ligne vide, comme dans la feuille d'origine.
  const sheet = useMemo(() => {
    let n = 0;
    return GROUPS.filter((g) => !hidden.has(g.key)).map((g, gi) => {
      if (gi > 0) n += 1;
      const spacer = gi > 0 ? n : null;
      const rows = g.rows.map((row) => { n += 1; return { ...row, n }; });
      return { ...g, rows, spacer };
    });
  }, [hidden]);

  return (
    <section className="bgl" aria-label="Board global">
      <div className="bgl-main">
        <div className="bgl-bar">
          <div className="bgl-tools" role="toolbar" aria-label="Outils du tableau">
            <FilterMenu hidden={hidden} onToggle={toggle} onReset={() => setHidden(new Set())} disabled={!first} />
            <PeriodPicker value={period} onChange={setPeriod} label="Période du tableau" align="left" />
          </div>
          <div className="bgl-quick" role="group" aria-label="Périodes rapides">
            {QUICK.map((key) => (
              <button key={key} type="button" className="bgl-chip" aria-pressed={period?.preset === key} onClick={() => quick(key)}>
                {DAY_PRESETS.find((p) => p.key === key).short}
              </button>
            ))}
          </div>
          {period && (
            <span key={`${period.from}/${period.to}/${period.preset}`} className="bgl-date" role="status">
              <b>{presetName(period)}</b><span>{dayRangeLabel(period)}</span>
            </span>
          )}
        </div>
        <div className="bgl-scroll" key={board}>
          {!first ? <BlankSheet /> : (
            <table className="bgl-sheet">
              <colgroup><col className="bgl-c-num" /><col className="bgl-c-band" /><col className="bgl-c-label" />{COLS.map((c, i) => <col key={c} className={i === 0 ? 'bgl-c-month' : 'bgl-c-val'} />)}</colgroup>
              <thead>
                <tr className="bgl-letters" aria-hidden="true">
                  <th /><th>A</th><th>B</th>{COLS.map((c) => <th key={c}>{c}</th>)}
                </tr>
              </thead>
              {sheet.map((g) => (
                <tbody key={g.key} data-tint={g.tint}>
                  {g.spacer && (
                    <tr className="bgl-gap" aria-hidden="true">
                      <td className="bgl-n">{g.spacer}</td><td /><td />{COLS.map((c) => <td key={c} />)}
                    </tr>
                  )}
                  {g.rows.map((row, i) => (
                    <tr key={row.label} data-strong={row.strong || undefined}>
                      <td className="bgl-n" aria-hidden="true">{row.n}</td>
                      {i === 0 && <th scope="rowgroup" rowSpan={g.rows.length} className="bgl-band"><span>{g.name}</span></th>}
                      <th scope="row" className="bgl-label">{row.label}</th>
                      <td className="bgl-val" aria-label="Valeur non renseignée">—</td>
                      {COLS.slice(1).map((c) => <td key={c} className="bgl-x" aria-hidden="true" />)}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
