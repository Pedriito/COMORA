import { minGapDays, daysBetween } from './frequency'

export type BuildPlan = {
  id: string
  title: string
  service_date: string
  team_ids: string[] | null
  excluded_position_ids: string[] | null
}
export type BuildPosition = { id: string; name: string; allow_multiple: boolean | null }
export type BuildTeam = { id: string; name: string; positions: BuildPosition[] }
export type BuildProfile = { id: string; first_name: string; last_name: string; desired_frequency: string | null }
export type BuildAssignment = { userId: string; positionId: string | null; planId: string; date: string }
export type BuildBlockout = { userId: string; startDate: string; endDate: string }

export type AutoFillProposal = {
  planId: string
  planTitle: string
  serviceDate: string
  teamId: string
  teamName: string
  positionId: string
  positionName: string
  allowMultiple: boolean
  userId: string
  userName: string
  alternatives: { id: string; name: string }[]
}

export type AutoFillSkipped = {
  planId: string
  planTitle: string
  serviceDate: string
  teamName: string
  positionName: string
  reason: 'no_eligible' | 'none_within_frequency'
}

export type BuildAutoFillInput = {
  /** Uniquement les plans de la plage cible, triés par `service_date` croissant. */
  plans: BuildPlan[]
  teams: BuildTeam[]
  /** `member_positions`, regroupé par poste. */
  qualifiedUserIdsByPosition: Record<string, string[]>
  profiles: BuildProfile[]
  blockouts: BuildBlockout[]
  /** Affectations existantes, historique ET dans la plage cible, non déclinées, hors invités
   *  externes — `date` est la date du plan concerné (déjà résolue par l'appelant). */
  existingAssignments: BuildAssignment[]
}

/** Cœur pur (sans accès base de données) de l'algorithme d'auto-remplissage — testable
 *  unitairement. Ne cible que les postes NOMMÉS (éligibilité via `member_positions`) ; si aucun
 *  bénévole éligible ne respecte son rythme souhaité pour un créneau, il est laissé vide plutôt
 *  que de forcer un dépassement. */
export function buildAutoFillProposal(input: BuildAutoFillInput): { proposals: AutoFillProposal[]; skipped: AutoFillSkipped[] } {
  const { plans, teams, qualifiedUserIdsByPosition, profiles, blockouts, existingAssignments } = input

  const targetPlanIds = new Set(plans.map(p => p.id))

  const knownDatesByUser = new Map<string, string[]>()
  function addKnownDate(userId: string, date: string) {
    const arr = knownDatesByUser.get(userId) ?? []
    arr.push(date)
    knownDatesByUser.set(userId, arr)
  }
  for (const a of existingAssignments) addKnownDate(a.userId, a.date)

  function respectsFrequency(userId: string, freq: string | null, date: string): boolean {
    const gap = minGapDays(freq)
    if (gap === 0) return true
    const dates = knownDatesByUser.get(userId) ?? []
    return dates.every(d => daysBetween(d, date) >= gap)
  }

  // Déjà affecté à CE plan (poste confondu) — évite de cumuler la même personne sur deux
  // postes différents pendant l'auto-remplissage. Postes déjà pourvus, par plan.
  const assignedUsersByPlan = new Map<string, Set<string>>()
  const filledPositionsByPlan = new Map<string, Set<string>>()
  for (const a of existingAssignments) {
    if (!targetPlanIds.has(a.planId)) continue // historique seulement, hors plage cible
    const set = assignedUsersByPlan.get(a.planId) ?? new Set<string>()
    set.add(a.userId)
    assignedUsersByPlan.set(a.planId, set)
    if (a.positionId) {
      const pset = filledPositionsByPlan.get(a.planId) ?? new Set<string>()
      pset.add(a.positionId)
      filledPositionsByPlan.set(a.planId, pset)
    }
  }

  const profileById = new Map(profiles.map(p => [p.id, p]))
  const unavailableOn = (userId: string, date: string) =>
    blockouts.some(b => b.userId === userId && b.startDate <= date && b.endDate >= date)

  const proposals: AutoFillProposal[] = []
  const skipped: AutoFillSkipped[] = []
  // Positions déjà proposées cette exécution, pour plafonner à +1 par poste `allow_multiple`.
  const proposedCountByPosition = new Map<string, number>()

  for (const plan of plans) {
    const date = plan.service_date.split('T')[0]
    const excludedIds = new Set(plan.excluded_position_ids ?? [])
    const planTeamIds = plan.team_ids
    const relevantTeams = teams.filter(t => !planTeamIds || planTeamIds.length === 0 || planTeamIds.includes(t.id))
    const filledHere = filledPositionsByPlan.get(plan.id) ?? new Set<string>()
    const assignedHere = assignedUsersByPlan.get(plan.id) ?? new Set<string>()

    for (const team of relevantTeams) {
      for (const pos of team.positions) {
        if (excludedIds.has(pos.id)) continue

        const isFilled = filledHere.has(pos.id)
        const proposedSoFar = proposedCountByPosition.get(pos.id) ?? 0
        if (isFilled && !(pos.allow_multiple && proposedSoFar === 0)) continue

        const qualifiedIds = qualifiedUserIdsByPosition[pos.id] ?? []
        if (qualifiedIds.length === 0) {
          skipped.push({ planId: plan.id, planTitle: plan.title, serviceDate: plan.service_date, teamName: team.name, positionName: pos.name, reason: 'no_eligible' })
          continue
        }

        const pool = qualifiedIds
          .filter(uid => !assignedHere.has(uid))
          .filter(uid => !unavailableOn(uid, date))
          .map(uid => profileById.get(uid))
          .filter((p): p is BuildProfile => !!p)
          .filter(p => respectsFrequency(p.id, p.desired_frequency, date))

        if (pool.length === 0) {
          skipped.push({ planId: plan.id, planTitle: plan.title, serviceDate: plan.service_date, teamName: team.name, positionName: pos.name, reason: 'none_within_frequency' })
          continue
        }

        // Priorité à qui a servi le moins récemment (jamais servi = priorité absolue).
        // Comparaison par égalité/inégalité plutôt que soustraction : `-Infinity - -Infinity`
        // vaut NaN, ce qui rendrait le tri indéterministe quand personne n'a encore servi.
        pool.sort((a, b) => {
          const da = knownDatesByUser.get(a.id) ?? []
          const db = knownDatesByUser.get(b.id) ?? []
          const lastA = da.length ? Math.max(...da.map(d => new Date(d).getTime())) : -Infinity
          const lastB = db.length ? Math.max(...db.map(d => new Date(d).getTime())) : -Infinity
          if (lastA === lastB) return 0
          return lastA < lastB ? -1 : 1
        })

        const chosen = pool[0]
        const alternatives = pool.slice(1, 6).map(p => ({ id: p.id, name: `${p.first_name} ${p.last_name}` }))

        proposals.push({
          planId: plan.id,
          planTitle: plan.title,
          serviceDate: plan.service_date,
          teamId: team.id,
          teamName: team.name,
          positionId: pos.id,
          positionName: pos.name,
          allowMultiple: !!pos.allow_multiple,
          userId: chosen.id,
          userName: `${chosen.first_name} ${chosen.last_name}`,
          alternatives,
        })

        assignedHere.add(chosen.id)
        assignedUsersByPlan.set(plan.id, assignedHere)
        addKnownDate(chosen.id, date)
        proposedCountByPosition.set(pos.id, proposedSoFar + 1)
      }
    }
  }

  return { proposals, skipped }
}
