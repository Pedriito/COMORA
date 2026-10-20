export const permissionLabels: Record<string, string> = {
  super_admin: 'Super-admin',
  admin:  'Administrateur',
  editor: 'Éditeur',
  viewer: 'Lecture seule',
}

export const roleLabels: Record<string, string> = {
  leader: 'Responsable',
  member: 'Membre',
}

/** Statuts d'une affectation, vus par le bénévole. Source unique : le statut `declined`
 *  s'affichait « Refusé » dans StatusDot et « Décliné » dans l'historique, pour la même
 *  action — l'application ne propose pourtant que le verbe « Décliner ». */
export const assignmentStatusLabels: Record<string, string> = {
  confirmed: 'Confirmé',
  pending:   'En attente',
  declined:  'Décliné',
}

export const frequencyLabels: Record<string, string> = {
  as_needed:    'Selon les besoins',
  twice_month:  '2× par mois',
  every_6_weeks:'Toutes les 6 semaines',
  monthly:      '1× par mois',
  weekly:       'Chaque semaine',
}

export const statusLabels: Record<string, { label: string; color: string }> = {
  active:   { label: 'Actif',               color: 'bg-green-100 text-green-700' },
  invited:  { label: 'Invitation envoyée',   color: 'bg-amber-100 text-amber-700' },
  inactive: { label: 'Inactif',             color: 'bg-gray-100 text-gray-500' },
}
