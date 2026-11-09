import { useEffect, useMemo, useState } from 'react'
import { allItems, dueItems, itemsFor, visitsOf, type Item } from './logic/due'
import { ctxOf, useStore } from './store/store'

export type Route = { name: 'day' | 'due' | 'queue' | 'audit' | 'settings' | 'scope' } | { name: 'patient' | 'card' | 'sample'; id: string }

function parse(hash: string): Route {
  const [, name = 'day', id = ''] = hash.replace(/^#/, '').split('/')
  if ((name === 'patient' || name === 'card' || name === 'sample') && id) return { name, id }
  if (['due', 'queue', 'audit', 'settings', 'scope'].includes(name)) return { name } as Route
  return { name: 'day' }
}

export function useRoute() {
  const [r, set] = useState(() => parse(location.hash))
  useEffect(() => {
    const f = () => set(parse(location.hash))
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return r
}
export const go = (h: string) => {
  location.hash = h
}

// the pieces of state that the due logic reads
function useCtx() {
  const pts = useStore((s) => s.pts)
  const obs = useStore((s) => s.obs)
  const docs = useStore((s) => s.docs)
  const vers = useStore((s) => s.vers)
  const ovr = useStore((s) => s.ovr)
  const forced = useStore((s) => s.forced)
  const marks = useStore((s) => s.marks)
  return useMemo(() => ctxOf({ pts, obs, docs, vers, ovr, forced, marks }), [pts, obs, docs, vers, ovr, forced, marks])
}
export const useCtxState = useCtx
export const useAllItems = () => { const c = useCtx(); return useMemo(() => allItems(c), [c]) }
export const useDueItems = () => { const c = useCtx(); return useMemo(() => dueItems(c), [c]) }
export const useItemsFor = (pid: string): Item[] => { const c = useCtx(); return useMemo(() => itemsFor(c, pid), [c, pid]) }
export const useVisits = (pid: string) => { const c = useCtx(); return useMemo(() => visitsOf(c.obs, c.docs, pid), [c, pid]) }

// key for arrow-key moves between table rows
export function rowKeys(e: React.KeyboardEvent<HTMLElement>, open?: () => void) {
  if (e.target !== e.currentTarget) return
  if (e.key === 'Enter' && open) return open()
  const n = e.key === 'ArrowDown' ? e.currentTarget.nextElementSibling : e.key === 'ArrowUp' ? e.currentTarget.previousElementSibling : null
  if (n) {
    e.preventDefault()
    ;(n as HTMLElement).focus()
  }
}
