// Facturation d'un onboarding (réunion du 27/11/2026) : qui la mène, et à qui la passer au dernier moment. Les noms
// viennent du serveur (`/optilex/board-onboarding-billing`) : aucune personne n'est écrite dans le front.

// Le nom à afficher, « À attribuer » quand personne n'est libre, ou null : pas de facturation à mener ('none'), dossier
// réservé avant la répartition ('unmanaged'), onboarding à recaler ou événement absent ('inactive'). Rien de faux à l'écran.
export function billingLeader(info) {
    if (info?.state === 'assigned') return info.name || null;
    if (info?.state === 'unassigned') return 'À attribuer';
    return null;
}

// Les personnes à qui la passer : toutes sauf celle qui la mène, dans l'ordre du serveur, seulement si le serveur dit
// qu'elle peut encore changer de main. `offWeek` : la personne ne prend pas les onboardings de cette semaine ;
// `sameTime` : elle a déjà un onboarding du CRM sur ces 15 minutes. Deux avertissements : on peut quand même la choisir.
export function billingTargets(info) {
    if (!info?.can_change) return [];
    return (info.options || [])
        .filter((option) => option?.name && option.name !== info.name)
        .map((option) => ({ name: option.name, offWeek: option.this_week === false, sameTime: option.same_time === true }));
}

// Lundi (AAAA-MM-JJ) de la semaine d'un jour AAAA-MM-JJ, sans fuseau.
export function mondayOf(iso) {
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    const day = new Date(Date.UTC(y, m - 1, d));
    day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
    return day.toISOString().slice(0, 10);
}

// Réglage d'une semaine après un clic sur une personne : la liste des noms à envoyer (vide = l'existant, tout le monde).
// On ne peut pas retirer la dernière personne : une semaine sans personne n'existe pas.
export function toggleWeekPerson(week, people, name) {
    const current = new Set(week?.set ? week.names : people);
    if (current.has(name)) {
        if (current.size === 1) return null;
        current.delete(name);
    } else {
        current.add(name);
    }
    const names = people.filter((person) => current.has(person));
    return names.length === people.length ? [] : names;
}

// Réponse d'un passage à une collègue : la décision est enregistrée, mais Google n'a pas tout fait (copie pas encore
// posée, ancienne copie pas retirée, ou synchronisation en erreur). Le serveur reprend au passage suivant du cron ;
// l'écran le dit en une ligne.
export function transferLeftCalendarsPending(result) {
    return !!result && (result.sync === 'error' || result.calendars_done === false);
}

// Les personnes proposées pour un onboarding listé dans une semaine réglée : la même forme que la fiche
// (`/board-onboarding-billing`), à partir de la semaine elle-même.
export function weekMoveInfo(move, week, people, canTransfer) {
    const canChange = !!canTransfer && !!move?.numero_client;
    return {
        state: 'assigned', name: move?.name || null, can_change: canChange,
        options: canChange ? people.map((name) => ({ name, this_week: (week?.names || []).includes(name) })) : [],
    };
}
