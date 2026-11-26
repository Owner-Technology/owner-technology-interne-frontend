import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Bandeau discret quand l'agrégateur répond `_partial: true` (une des jambes parallèles — leadScores, leads, stats —
 * a échoué). La page ne tombe pas : le reste se lit normalement, le bandeau dit seulement ce qui manque.
 * Étiquette jaune du kit Owner (refonte du 26/11/2026).
 */
export default function PartialDataBanner({ errors = [] }) {
  if (!errors || errors.length === 0) return null;
  return (
    <div className="wb-partial" role="status">
      <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
      <div>
        <b>Données partielles</b>
        <span>
          {errors.length === 1
            ? `Une jambe de l'agrégateur a échoué : ${errors[0]}.`
            : `${errors.length} jambes ont échoué : ${errors.join(', ')}.`}
          {' '}Le reste de la vue reste à jour.
        </span>
      </div>
    </div>
  );
}
