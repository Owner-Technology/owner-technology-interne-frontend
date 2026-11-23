// src/routes/ProtectedRoute.jsx - NOUVELLE VERSION POUR JWT
import { useState, useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { homeRouteFor } from '../navigation/home.js';

// Audit du 22/11/2026 :
// - Session vérifiée il y a moins d'une minute : la page s'ouvre sans nouvel aller-retour au serveur (avant, chaque
//   changement de page affichait « Chargement... » en plein écran, notamment en ouvrant une notification). Le serveur
//   reste juge de chaque appel de la page.
// - Page refusée à une personne connectée : retour à sa page d'arrivée, plus à l'écran de connexion (qui faisait croire
//   à une déconnexion).
const VERIFIED_FOR_MS = 60000;
const verified = { at: 0, token: null };

// Mapping des rôles vers les pages autorisées
const ROLE_PERMISSIONS = {
  admin: ['*'], // Accès à tout
  head_of_sales: ['/leads-management', '/tracking-sheet', '/', '/admin/leads'],
  commercial: ['/tracking-sheet', '/'],
  tech: ['/admin/leads', '/', '/monitoring-perf'],
  finance: ['/', '/reports'],
};

const roleAllowed = (user, allowedRoles) => !allowedRoles || allowedRoles.includes(user.role) || user.role === 'admin';
const recentlyVerified = () => {
  const token = apiClient.getToken();
  return !!token && verified.token === token && Date.now() - verified.at < VERIFIED_FOR_MS;
};

// Toutes les routes passent par ce composant au même endroit de l'arbre : React le garde d'une page à l'autre. Le rôle est
// donc relu à chaque rendu (jamais un état hérité de la page précédente), et la session revérifiée à chaque changement
// de page si la dernière vérification a plus d'une minute.
export default function ProtectedRoute({ children, allowedRoles = null }) {
  const { pathname, search } = useLocation();
  const token = apiClient.getToken();
  const user = apiClient.getUser();
  // checking | ok | error | out
  const [status, setStatus] = useState(() => (token && user && recentlyVerified() ? 'ok' : 'checking'));

  // Audit du 23/11/2026 : en passant d'une page à l'autre (statut déjà « ok »), la vérification se fait en arrière-plan.
  // Avant, après une minute sans vérification, la nouvelle page cédait la place à « Chargement... » plein écran puis se
  // montait une seconde fois. Seule une session refusée par le serveur (401/403) fait quitter la page.
  const statusRef = useRef(status);
  statusRef.current = status;
  const checkAuth = async () => {
    if (!apiClient.getToken() || !apiClient.getUser()) { setStatus('out'); return; }
    if (recentlyVerified()) { setStatus('ok'); return; }
    const background = statusRef.current === 'ok';
    if (!background) setStatus('checking');
    // getMe renouvelle la session si le jeton d'accès a expiré.
    try {
      await apiClient.getMe();
      verified.at = Date.now();
      verified.token = apiClient.getToken();
      setStatus('ok');
    } catch (e) {
      console.error("getMe failed:", e);
      // Une panne réseau/serveur n'est pas une déconnexion. Garder la session
      // et permettre de réessayer, sans afficher de page protégée non vérifiée.
      if (e.status === 401 || e.status === 403) setStatus('out');
      else if (!background) setStatus('error');
    }
  };

  useEffect(() => {
    checkAuth();
  }, [pathname]);

  if (!token || !user || status === 'out') {
    // La page demandée suit la connexion (dev 23/11/2026 : un lien ouvert sur téléphone ramène à sa page).
    return <Navigate to="/login" replace state={{ from: `${pathname}${search}` }} />;
  }

  if (!roleAllowed(user, allowedRoles)) {
    const home = homeRouteFor(user.role);
    if (home !== pathname) return <Navigate to={home} replace state={{ refusedFrom: pathname }} />;
    return (
      <div role="alert" style={{ padding: '3rem', textAlign: 'center' }}>
        <p>Cette page n’est pas ouverte à votre compte.</p>
        <a href="/login">Se reconnecter avec un autre compte</a>
      </div>
    );
  }

  if (status === 'checking') {
    const isDark = document.body.classList.contains('dark-mode') ||
                   document.documentElement.classList.contains('dark-mode');
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: isDark ? '#1a1a1e' : '#f5f5f7',
        color: isDark ? '#f5f5f7' : '#1d1d1f'
      }}>
        Chargement...
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div role="alert" style={{ padding: '3rem', textAlign: 'center' }}>
        <p>Connexion momentanément indisponible. Votre session est conservée.</p>
        <button type="button" onClick={checkAuth}>Réessayer</button>
      </div>
    );
  }

  return children;
}
