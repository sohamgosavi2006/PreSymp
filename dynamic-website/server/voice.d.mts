import type { IncomingMessage, ServerResponse } from 'node:http'
export function createVoiceHandler(options?: { apiKey?: string | (() => string | undefined); fetchImpl?: typeof fetch }): (req: IncomingMessage, res: ServerResponse, next?: () => void) => Promise<void>
