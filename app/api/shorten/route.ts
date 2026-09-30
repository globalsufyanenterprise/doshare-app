import { NextResponse } from 'next/server';

const MAX_CHARS = 12000;
const hits = new Map<string, number[]>();

// Best-effort limit per IP (resets when the serverless instance restarts)
function isLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 10;
}

const SYSTEM_PROMPT =
  'You are a code refactoring engine. Shorten and simplify the code while keeping its behavior identical. ' +
  'Fix obvious syntax errors, remove dead code and redundant logic. Do not rename exported or public identifiers, ' +
  'and keep the result readable. Return ONLY the raw code, with no markdown fences, explanations, or extra text.';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (isLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests. Wait a minute and try again.' }, { status: 429 });
  }
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'Server is missing GROQ_API_KEY.' }, { status: 500 });
  }

  let body: { code?: unknown; language?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const code = typeof body.code === 'string' ? body.code : '';
  const language = typeof body.language === 'string' ? body.language.slice(0, 30) : 'text';
  if (!code.trim()) return NextResponse.json({ error: 'There is no code to shorten.' }, { status: 400 });
  if (code.length > MAX_CHARS) {
    return NextResponse.json({ error: `Code is too long. Limit is ${MAX_CHARS} characters.` }, { status: 413 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Language: ${language}\nCode:\n${code}` },
        ],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'The AI service is busy or unavailable. Try again shortly.' }, { status: 502 });
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    let out = data.choices?.[0]?.message?.content?.trim();
    if (!out) return NextResponse.json({ error: 'The AI returned nothing. Your code is unchanged.' }, { status: 502 });

    // Strip markdown fences if the model added them anyway
    out = out.replace(/^```[a-zA-Z0-9]*\n/, '').replace(/\n```$/, '');
    return NextResponse.json({ shortenedCode: out });
  } catch {
    return NextResponse.json({ error: 'The AI request timed out. Try again.' }, { status: 504 });
  } finally {
    clearTimeout(timer);
  }
}