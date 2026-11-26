import React from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { Segmented } from '../../TrackingSheetFinance/statistics/parts.jsx';
import { EASE } from '../../../components/perfSales/motion.jsx';

/**
 * Période de la page Webinar : bascule à pouce blanc du kit Finance (refonte du 26/11/2026), et deux dates qui se
 * déplient en douceur quand « Personnalisé » est choisi. Contrôlé par le parent (preset, customFrom, customTo).
 */
// Presets restreints à la fenêtre d'analyse d'un webinaire post-événement. On retire `12mo` (pas pertinent : il y a
// 12 mois le webinaire n'existait pas). Le preset par défaut « Webinaire complet » couvre toute la période d'activité
// (ouverture inscriptions → aujourd'hui).
const PRESETS = [
  { key: 'all', label: 'Webinaire complet' },
  { key: 'day', label: 'Jour' },
  { key: '7d', label: '7 jours' },
  { key: '30d', label: '30 jours' },
  { key: 'month', label: 'Ce mois' },
  { key: 'custom', label: 'Personnalisé' },
];

export default function DateRangePicker({ preset, customFrom, customTo, onChange }) {
  return (
    <div className="wb-period">
      <Segmented options={PRESETS} value={preset} label="Période" onChange={(key) => onChange({ preset: key, customFrom, customTo })} />
      <AnimatePresence initial={false}>
        {preset === 'custom' && (
          <Motion.div key="dates" className="wb-dates" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.25, ease: EASE }}>
            <input
              type="date"
              className="fst-pp-date"
              aria-label="Premier jour"
              value={customFrom}
              max={customTo}
              onChange={(e) => onChange({ preset, customFrom: e.target.value, customTo })}
            />
            <span aria-hidden="true">→</span>
            <input
              type="date"
              className="fst-pp-date"
              aria-label="Dernier jour"
              value={customTo}
              min={customFrom}
              onChange={(e) => onChange({ preset, customFrom, customTo: e.target.value })}
            />
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
