export const VOICE_LANGUAGES = [
  ['en-IN', 'English'], ['hi-IN', 'हिन्दी · Hindi'], ['bn-IN', 'বাংলা · Bengali'],
  ['ta-IN', 'தமிழ் · Tamil'], ['te-IN', 'తెలుగు · Telugu'], ['mr-IN', 'मराठी · Marathi'],
  ['gu-IN', 'ગુજરાતી · Gujarati'], ['kn-IN', 'ಕನ್ನಡ · Kannada'], ['ml-IN', 'മലയാളം · Malayalam'],
  ['pa-IN', 'ਪੰਜਾਬੀ · Punjabi'], ['od-IN', 'ଓଡ଼ିଆ · Odia'],
] as const

export async function voiceRequest(path: string, body: FormData | object, signal?: AbortSignal) {
  const multipart = body instanceof FormData
  const res = await fetch(`/api/voice/${path}`, {
    method: 'POST', headers: multipart ? undefined : { 'Content-Type': 'application/json' },
    body: multipart ? body : JSON.stringify(body), signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Voice needs the app server. Run npm start or npm run dev, then try again.')
  return data
}

export function audioBlob(base64: string): Blob {
  return new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], { type: 'audio/wav' })
}

export function downloadVoice(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export type VoiceMessage = {
  id: string; pid: string; kind: 'patient' | 'card'; createdAt: string
  language: string; transcript: string; audio: Blob
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('presymp-voice', 1)
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('messages', { keyPath: 'id' })
      store.createIndex('pid', 'pid')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('Device storage is unavailable. Download the recording to keep it.'))
  })
}

export async function listVoiceMessages(pid: string): Promise<VoiceMessage[]> {
  const db = await database()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('messages').objectStore('messages').index('pid').getAll(pid)
      request.onsuccess = () => resolve((request.result as VoiceMessage[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      request.onerror = () => reject(new Error('Saved recordings could not be opened.'))
    })
  } finally { db.close() }
}

export async function changeVoiceMessage(message: VoiceMessage | string) {
  const db = await database()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite')
      const store = tx.objectStore('messages')
      if (typeof message === 'string') store.delete(message)
      else store.put(message)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(new Error('Could not save on this device. Download the recording to keep it.'))
      tx.onabort = () => reject(new Error('Device storage is full or unavailable. Download the recording to keep it.'))
    })
    window.dispatchEvent(new Event('presymp-voice-change'))
  } finally { db.close() }
}
