import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  DIAGRAM_SYSTEM_PROMPT,
  DiagramSchema,
  stripCodeFences,
  UI_SYSTEM_PROMPT,
  type CleanupResponse,
} from '../src/lib/cleanup'

export const config = { maxDuration: 60 }

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

interface ChatMessage {
  role: 'system' | 'user'
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >
}

async function callOpenAi(
  apiKey: string,
  messages: ChatMessage[],
  jsonMode: boolean,
): Promise<string> {
  const resp = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: 4096,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  })
  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`OpenAI ${resp.status}: ${body.slice(0, 300)}`)
  }
  const data = (await resp.json()) as {
    choices: { message: { content: string | null } }[]
  }
  const content = data.choices[0]?.message?.content
  if (!content) throw new Error('OpenAI returned an empty response')
  return content
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const send = (status: number, body: CleanupResponse) => res.status(status).json(body)

  if (req.method !== 'POST') {
    return send(405, { ok: false, error: 'POST only' })
  }
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return send(500, {
      ok: false,
      error: 'OPENAI_API_KEY ist nicht konfiguriert (Vercel-Projekt-Settings)',
    })
  }

  const { mode, image } = (req.body ?? {}) as { mode?: string; image?: string }
  if (mode !== 'diagram' && mode !== 'ui') {
    return send(400, { ok: false, error: 'mode muss "diagram" oder "ui" sein' })
  }
  if (
    typeof image !== 'string' ||
    !image.startsWith('data:image/png;base64,') ||
    image.length > MAX_IMAGE_BYTES
  ) {
    return send(400, { ok: false, error: 'image muss eine PNG-Data-URL (max 4 MB) sein' })
  }

  const userMessage: ChatMessage = {
    role: 'user',
    content: [
      { type: 'text', text: 'Here is the sketch:' },
      { type: 'image_url', image_url: { url: image } },
    ],
  }

  try {
    if (mode === 'ui') {
      const raw = await callOpenAi(
        apiKey,
        [{ role: 'system', content: UI_SYSTEM_PROMPT }, userMessage],
        false,
      )
      return send(200, { ok: true, mode: 'ui', html: stripCodeFences(raw) })
    }

    // diagram mode: JSON-validate, one retry with the validation error fed back
    let lastError = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      const messages: ChatMessage[] = [
        { role: 'system', content: DIAGRAM_SYSTEM_PROMPT },
        userMessage,
      ]
      if (attempt > 0) {
        messages.push({
          role: 'user',
          content: `Your previous response was invalid: ${lastError}. Respond again with ONLY the corrected JSON object.`,
        })
      }
      const raw = await callOpenAi(apiKey, messages, true)
      let parsed: unknown
      try {
        parsed = JSON.parse(stripCodeFences(raw))
      } catch {
        lastError = 'not parseable as JSON'
        continue
      }
      const result = DiagramSchema.safeParse(parsed)
      if (result.success) {
        return send(200, { ok: true, mode: 'diagram', diagram: result.data })
      }
      lastError = result.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')
    }
    return send(502, {
      ok: false,
      error: `KI-Antwort war zweimal ungültig (${lastError})`,
    })
  } catch (e) {
    return send(502, { ok: false, error: e instanceof Error ? e.message : String(e) })
  }
}
