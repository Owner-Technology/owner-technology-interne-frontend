// /optilex-board, la page de travail du cabinet et de la facturation (audit du 22/11/2026) : le board avec le menu
// partagé de la plateforme et sa cloche. Avant, la page s'ouvrait seule, sans menu ni notifications, alors qu'elle est la
// cible de leurs notifications. Le board intégré au tableau de bord (/ceo/optilex-board) ne change pas.
import { useState } from "react";
import PageWithSidebar from "../components/shared/Sidebar/PageWithSidebar.jsx";
import OptilexBoard from "./OptilexBoard.jsx";

export default function OptilexBoardPage() {
  const [darkMode, setDarkMode] = useState(() => { try { return localStorage.getItem("darkMode") === "true"; } catch { return false; } });
  return (
    <PageWithSidebar darkMode={darkMode} setDarkMode={setDarkMode}>
      <OptilexBoard />
    </PageWithSidebar>
  );
}
