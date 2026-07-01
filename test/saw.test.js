import test from 'node:test'
import assert from 'node:assert/strict'
import { memberRawValue, normalizeSawAlternatives, punctualityRawValue, rankSawAlternatives, SAW_WEIGHTS } from '../server/saw.js'

const reportAlternatives = [
  { id: 'A1', memberRaw: 3, serviceRaw: 3, punctualityRaw: 3, tieBreaker: '09:00' },
  { id: 'A2', memberRaw: 1, serviceRaw: 2, punctualityRaw: 3, tieBreaker: '09:10' },
  { id: 'A3', memberRaw: 3, serviceRaw: 1, punctualityRaw: 1, tieBreaker: '09:20' },
  { id: 'A4', memberRaw: 1, serviceRaw: 3, punctualityRaw: 2, tieBreaker: '09:30' },
]

test('bobot SAW sesuai Tabel 3.3 laporan', () => {
  assert.deepEqual(SAW_WEIGHTS, { member: 0.40, service: 0.35, punctuality: 0.25 })
})

test('normalisasi dan preferensi sesuai contoh manual A1–A4', () => {
  const result = normalizeSawAlternatives(reportAlternatives)
  assert.deepEqual(result[0].normalized, { member: 1, service: 1, punctuality: 1 })
  assert.equal(result[0].score, 1)
  assert.equal(Number(result[1].score.toFixed(2)), 0.62)
  assert.equal(Number(result[2].score.toFixed(2)), 0.60)
  assert.equal(Number(result[3].score.toFixed(2)), 0.65)
})

test('peringkat laporan adalah A1, A4, A2, A3', () => {
  assert.deepEqual(rankSawAlternatives(reportAlternatives).map((item) => item.id), ['A1', 'A4', 'A2', 'A3'])
})

test('nilai sama memakai waktu reservasi sebagai tie-breaker', () => {
  const tied = [
    { id: 'B', memberRaw: 3, serviceRaw: 2, punctualityRaw: 3, tieBreaker: '10:15' },
    { id: 'A', memberRaw: 3, serviceRaw: 2, punctualityRaw: 3, tieBreaker: '10:00' },
  ]
  assert.deepEqual(rankSawAlternatives(tied).map((item) => item.id), ['A', 'B'])
})

test('konversi status member sesuai aturan C1', () => {
  assert.equal(memberRawValue('Gold'), 3)
  assert.equal(memberRawValue('Silver'), 3)
  assert.equal(memberRawValue('Member'), 3)
  assert.equal(memberRawValue('Regular'), 1)
})

test('ketepatan waktu C3 mengikuti batas 0 dan 15 menit', () => {
  assert.equal(punctualityRawValue('10:00', '09:55'), 3)
  assert.equal(punctualityRawValue('10:00', '10:00'), 3)
  assert.equal(punctualityRawValue('10:00', '10:15'), 2)
  assert.equal(punctualityRawValue('10:00', '10:16'), 1)
})
