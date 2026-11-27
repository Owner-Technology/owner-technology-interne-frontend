// Facturation d'un onboarding (réunion du 27/11/2026) : qui la mène, et à qui la passer au dernier moment. Les noms
// viennent du serveur (`/optilex/board-onboarding-billing`) : aucune personne n'est écrite dans le front.

// Le nom à afficher, ou null quand le rendez-vous n'a pas de facturation à mener.
export function billingLeader(info) {
    if (!info || info.state === 'none') return null;
    return info.name || 'À attribuer';
}

// Les personnes à qui la passer : toutes sauf celle qui la mène, dans l'ordre du serveur, seulement si le serveur dit
// qu'elle peut encore changer de main. `offWeek` : la personne ne prend pas les onboardings de cette semaine (on peut
// quand même la choisir).
export function billingTargets(info) {
    if (!info?.can_change) return [];
    return (info.options || [])
        .filter((option) => option?.name && option.name !== info.name)
        .map((option) => ({ name: option.name, offWeek: option.this_week === false }));
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
