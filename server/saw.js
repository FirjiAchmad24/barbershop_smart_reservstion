export const SAW_WEIGHTS = Object.freeze({
  member: 0.40,
  service: 0.35,
  punctuality: 0.25,
})

export function memberRawValue(membership) {
  return ['Gold', 'Silver', 'Member'].includes(membership) ? 3 : 1
}

export function punctualityRawValue(scheduledTime, arrivalTime) {
  const minutes = (value) => {
    const [hours, minute] = value.split(':').map(Number)
    return hours * 60 + minute
  }
  const lateness = minutes(arrivalTime) - minutes(scheduledTime)
  if (lateness <= 0) return 3
  if (lateness <= 15) return 2
  return 1
}

export function normalizeSawAlternatives(alternatives) {
  if (!alternatives.length) return []
  const maximum = {
    member: Math.max(...alternatives.map((item) => Number(item.memberRaw) || 0), 1),
    service: Math.max(...alternatives.map((item) => Number(item.serviceRaw) || 0), 1),
    punctuality: Math.max(...alternatives.map((item) => Number(item.punctualityRaw) || 0), 1),
  }

  return alternatives.map((item) => {
    const normalized = {
      member: item.memberRaw / maximum.member,
      service: item.serviceRaw / maximum.service,
      punctuality: item.punctualityRaw / maximum.punctuality,
    }
    const score = (
      normalized.member * SAW_WEIGHTS.member
      + normalized.service * SAW_WEIGHTS.service
      + normalized.punctuality * SAW_WEIGHTS.punctuality
    )
    return { ...item, maximum, normalized, score: Number(score.toFixed(4)) }
  })
}

export function rankSawAlternatives(alternatives) {
  return normalizeSawAlternatives(alternatives).sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score
    return String(left.tieBreaker || '').localeCompare(String(right.tieBreaker || ''))
  })
}
