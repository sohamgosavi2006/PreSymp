import { useEffect, useState } from 'react'
import type { Lang } from './phrases'

// the browser's own voices only. nothing is sent anywhere and no audio is faked
const LOCALE: Record<Lang, string> = { en: 'en-in', hi: 'hi-in', bn: 'bn-in' }

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'

export function voiceFor(lang: Lang): SpeechSynthesisVoice | undefined {
  if (!canSpeak()) return undefined
  const vs = window.speechSynthesis.getVoices()
  return vs.find((v) => v.lang.toLowerCase().replace('_', '-') === LOCALE[lang]) ?? vs.find((v) => v.lang.toLowerCase().startsWith(lang))
}

// voices load late in some browsers, so listen for the change
export function useVoice(lang: Lang) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | undefined>(() => voiceFor(lang))
  useEffect(() => {
    setVoice(voiceFor(lang))
    if (!canSpeak()) return
    const f = () => setVoice(voiceFor(lang))
    window.speechSynthesis.addEventListener?.('voiceschanged', f)
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', f)
  }, [lang])
  return voice
}

export function speak(text: string, lang: Lang, voice: SpeechSynthesisVoice, on: { end: () => void; fail: () => void }) {
  const u = new SpeechSynthesisUtterance(text)
  u.voice = voice
  u.lang = voice.lang
  u.onend = on.end
  u.onerror = on.fail
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
  return () => window.speechSynthesis.cancel()
}
