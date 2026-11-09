import { useEffect, type ReactNode } from 'react'

export function Human({ children, className = '', label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div className={`human ${className}`} aria-label={label ?? 'A person decides here'}>
      <svg className="glyph" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <circle cx="8" cy="5" r="2.6" />
        <path d="M2.8 14c.4-2.8 2.5-4.4 5.2-4.4s4.8 1.6 5.2 4.4" />
      </svg>
      <div className="human-body">{children}</div>
    </div>
  )
}

// status by shape and weight, never colour
export function Status({ kind, children }: { kind: 'hollow' | 'dot' | 'sq' | 'pill'; children: ReactNode }) {
  return (
    <span className={`st st-${kind}`}>
      {kind !== 'pill' && <i className={`shp ${kind}`} aria-hidden="true" />}
      <span className="st-txt">{children}</span>
    </span>
  )
}

export function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: ReactNode }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onClose])
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn quiet" onClick={onClose} aria-label="Close">Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}
