import { describe, expect, it } from 'vitest'
import { matchPatient } from './matchPatient'
import { PTS } from '../../store/seed'
import type { Pt, Read } from '../../store/types'

const r = (o: Partial<Read>): Read => ({ hits: {}, ...o })

describe('matching: saved', () => {
  it('exact ID is saved, whatever the case', () => {
    expect(matchPatient(r({ id: 'P-0533', name: 'Kabita Banerjee' }), PTS)).toMatchObject({ how: 'id', pid: 'P-0533', on: 'ID' })
    expect(matchPatient(r({ id: 'p-0533' }), PTS)).toMatchObject({ how: 'id', pid: 'P-0533' })
  })
  it('exact ID is saved when the name is only an initial of the same person', () => {
    expect(matchPatient(r({ id: 'P-0288', name: 'R. Das' }), PTS)).toMatchObject({ how: 'id', pid: 'P-0288' })
  })
  it('full name, age and sex are saved', () => {
    expect(matchPatient(r({ name: 'Kabita Banerjee', age: 52, sex: 'F' }), PTS)).toMatchObject({ how: 'name', pid: 'P-0533', on: 'full name, age and sex' })
  })
  it('age may differ by one year, either way', () => {
    expect(matchPatient(r({ name: 'Kabita Banerjee', age: 53, sex: 'F' }), PTS).how).toBe('name')
    expect(matchPatient(r({ name: 'Kabita Banerjee', age: 51, sex: 'F' }), PTS).how).toBe('name')
  })
  it('a middle name does not stop a match', () => {
    expect(matchPatient(r({ name: 'Kabita Devi Banerjee', age: 52, sex: 'F' }), PTS).how).toBe('name')
  })
})

describe('matching: a person decides', () => {
  it('age two years off is not saved, and says so', () => {
    const m = matchPatient(r({ name: 'Kabita Banerjee', age: 54, sex: 'F' }), PTS)
    expect(m.how).toBe('weak')
    expect(m.cands[0]).toMatchObject({ pid: 'P-0533', why: 'Same name, age differs by 2 years' })
  })
  it('names the gap in years', () => {
    expect(matchPatient(r({ name: 'Kabita Banerjee', age: 58, sex: 'F' }), PTS).cands[0].why).toBe('Same name, age differs by 6 years')
    expect(matchPatient(r({ name: 'Kabita Banerjee', age: 51, sex: 'M' }), PTS).cands[0].why).toBe('Same name, age matches, sex differs')
  })
  it('a different sex is not saved', () => {
    expect(matchPatient(r({ name: 'Kabita Banerjee', age: 52, sex: 'M' }), PTS).how).toBe('weak')
  })
  it('a name with no age is not saved', () => {
    const m = matchPatient(r({ name: 'Kabita Banerjee' }), PTS)
    expect(m.how).toBe('weak')
    expect(m.cands[0].why).toBe('Same name, age not on report')
  })
  it('an initial and a surname list every patient with that surname, each with a reason', () => {
    const m = matchPatient(r({ name: 'R. Das' }), PTS)
    expect(m.how).toBe('weak')
    expect(m.cands.map((c) => c.pid).sort()).toEqual(['P-0288', 'P-0299'])
    expect(m.cands.every((c) => c.why === 'Same surname, age not on report')).toBe(true)
    expect(m.on).toBe('name only (several possible patients)')
  })
  it('an initial with the right age and sex is still not a full name', () => {
    expect(matchPatient(r({ name: 'R. Das', age: 63, sex: 'M' }), PTS).how).toBe('weak')
  })
  it('the better fit comes first, and every confidence is between 0 and 1', () => {
    const m = matchPatient(r({ name: 'R. Das', age: 63, sex: 'M' }), PTS)
    expect(m.cands[0].pid).toBe('P-0288')
    expect(m.cands[0].why).toBe('Same surname, age matches')
    for (const c of m.cands) {
      expect(c.conf).toBeGreaterThan(0)
      expect(c.conf).toBeLessThanOrEqual(1)
    }
    expect(m.cands[0].conf).toBeGreaterThan(m.cands[1].conf)
  })
  it('an ID whose owner has another name is not saved', () => {
    const m = matchPatient(r({ id: 'P-0533', name: 'Arif Khan', age: 47, sex: 'M' }), PTS)
    expect(m.how).toBe('weak')
    expect(m.cands[0]).toMatchObject({ pid: 'P-0533', why: 'ID matches, name does not' })
    expect(m.cands.map((c) => c.pid)).toContain('P-0932') // the printed name belongs to someone else on file
  })
  it('two patients with the same name, age and sex are never saved', () => {
    const twins: Pt[] = [PTS[4], { ...PTS[4], id: 'P-9999' }]
    const m = matchPatient(r({ name: 'Kabita Banerjee', age: 52, sex: 'F' }), twins)
    expect(m.how).toBe('weak')
    expect(m.cands).toHaveLength(2)
  })
  it('an ID that is not on file falls back to the name rules', () => {
    expect(matchPatient(r({ id: 'X-1', name: 'Kabita Banerjee', age: 52, sex: 'F' }), PTS).how).toBe('name')
    const m = matchPatient(r({ id: 'X-1', name: 'R. Das' }), PTS)
    expect(m.how).toBe('weak')
    expect(m.cands).toHaveLength(2)
  })
  it('no name and no ID gives an empty list', () => {
    const m = matchPatient(r({}), PTS)
    expect(m.how).toBe('weak')
    expect(m.cands).toEqual([])
  })
})
