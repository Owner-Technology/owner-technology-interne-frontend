import React from 'react';
import { Segmented } from '../../TrackingSheetFinance/statistics/parts.jsx';

/**
 * Filtre de source des prospects (toutes / landing / meta / broad) : petite bascule à pouce blanc du kit Finance
 * (refonte du 26/11/2026). Le changement relance le chargement côté parent (la liste vient déjà filtrée du back).
 */
const SOURCES = [
  { key: 'all', label: 'Toutes' },
  { key: 'landing', label: 'Landing' },
  { key: 'meta', label: 'Meta' },
  { key: 'broad', label: 'Broad' },
];

export default function SourceFilter({ value, onChange }) {
  return <Segmented small options={SOURCES} value={value} onChange={onChange} label="Source des prospects" />;
}
