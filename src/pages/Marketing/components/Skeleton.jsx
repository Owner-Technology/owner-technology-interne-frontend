import React from 'react';

/**
 * Squelette du premier chargement (aucune donnée en mémoire) : la lueur du kit Finance (`.fst-skel`, qui suit le mode
 * sombre de la page et s'arrête si l'utilisateur réduit les animations). L'appelant le dimensionne comme le contenu
 * réel, pour qu'aucun bloc ne saute à l'arrivée des chiffres.
 */
export default function Skeleton({ width = '100%', height = 16, radius = 8, style = {} }) {
  return <div aria-hidden="true" className="fst-skel" style={{ width, height, borderRadius: radius, ...style }} />;
}
