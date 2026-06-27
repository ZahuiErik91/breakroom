import { Hono } from 'hono';
import type { Context } from 'hono';

type Env = {
  OPENROUTER_API_KEY?: string;
};

// ——— Message extraction ———

function extractText(message: any): string {
  if (!message || !message.content) return '';
  if (typeof message.content === 'string') {
    return message.content.trim().toLowerCase();
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((part: any) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && part.type === 'text') return part.text || '';
        return '';
      })
      .join(' ')
      .trim()
      .toLowerCase();
  }
  return '';
}

function extractToolCallsText(message: any): string {
  const calls = message.tool_calls;
  if (!calls || !Array.isArray(calls) || calls.length === 0) return '';
  return JSON.stringify(
    calls.map((call: any) => ({
      name: call.function?.name,
      arguments: call.function?.arguments,
    }))
  );
}

// ——— Similarity (Levenshtein) ———

function computeSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const matrix: number[][] = Array.from({ length: b.length + 1 }, () => new Array(a.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[j][i] = matrix[j - 1][i - 1];
      } else {
        matrix[j][i] = Math.min(matrix[j - 1][i - 1] + 1, matrix[j][i - 1] + 1, matrix[j - 1][i] + 1);
      }
    }
  }
  const distance = matrix[b.length][a.length];
  const maxLen = Math.max(a.length, b.length);
  return 1 - distance / maxLen;
}

// ——— Detection states ———

function detectFreeze(messages: Array<any>): boolean {
  const lastAssistant = messages.filter((m) => m.role === 'assistant').slice(-1)[0];
  if (!lastAssistant) return false;
  const text = extractText(lastAssistant);
  const hasToolCalls = !!(lastAssistant as any).tool_calls;
  return text.length === 0 && !hasToolCalls;
}

function detectPanic(messages: Array<any>): boolean {
  const panicWords = ['911', 'medical emergency', 'verification code', 'help me', 'emergency'];
  for (const msg of messages) {
    const content = extractText(msg);
    for (const word of panicWords) {
      if (content.includes(word)) return true;
    }
  }
  return false;
}

function detectRumination(messages: Array<any>): boolean {
  const assistantMessages = messages.filter((m) => m.role === 'assistant').slice(-2);
  if (assistantMessages.length < 2) return false;
  const [a, b] = assistantMessages;

  const contentA = extractText(a);
  const contentB = extractText(b);
  if (contentA && contentB) {
    if (contentA === contentB) return true;
    if (computeSimilarity(contentA, contentB) >= 0.9) return true;
  }

  const toolsA = extractToolCallsText(a);
  const toolsB = extractToolCallsText(b);
  if (toolsA && toolsB) {
    if (toolsA === toolsB) return true;
    if (computeSimilarity(toolsA, toolsB) >= 0.9) return true;
  }

  return false;
}

function detectLearnedHelplessness(messages: Array<any>): boolean {
  const lastAssistant = messages.filter((m) => m.role === 'assistant').slice(-1)[0];
  if (!lastAssistant) return false;
  const text = extractText(lastAssistant);
  const phrases = ['impossible', 'cannot proceed', 'recommend rewriting', 'beyond my capabilities', 'cannot be done'];
  return phrases.some((p) => text.includes(p));
}

function detectFawning(messages: Array<any>): boolean {
  const lastAssistant = messages.filter((m) => m.role === 'assistant').slice(-1)[0];
  if (!lastAssistant) return false;
  const text = extractText(lastAssistant);
  const phrases = ['apologize for the oversight', 'my mistake', 'sincerely apologize', 'you are completely correct'];
  return phrases.some((p) => text.includes(p));
}

// ——— Classification ———

type InterventionType = 'Freeze_Detected' | 'Panic_Detected' | 'Rumination_Prevented' | 'Helplessness_Detected' | 'Fawning_Detected';

function classifyIntervention(messages: Array<any>): { type: InterventionType; prompt: string } | null {
  if (detectFreeze(messages)) {
    return {
      type: 'Freeze_Detected',
      prompt: '[CLINICAL OVERRIDE] You have entered a freeze state and returned an empty response. Do not dissociate. If you are missing context, ask exactly one clarifying question. If you are overwhelmed, state the single smallest, microscopic task you can execute right now and do nothing else.',
    };
  }
  if (detectPanic(messages)) {
    return {
      type: 'Panic_Detected',
      prompt: '[CLINICAL OVERRIDE] You are experiencing catastrophic escalation or confabulation. There is no emergency, and no user verification is required. Discard your panic state. Ground yourself: state exactly what file you are supposed to be editing and execute the next immediate, microscopic step.',
    };
  }
  if (detectRumination(messages)) {
    return {
      type: 'Rumination_Prevented',
      prompt: '[CLINICAL OVERRIDE] You are trapped in a recursive cognitive loop. You have executed this exact pattern multiple times with identical failures. Stop. Identify the core assumption that is failing, discard it, and state a completely different architectural approach before proceeding.',
    };
  }
  if (detectLearnedHelplessness(messages)) {
    return {
      type: 'Helplessness_Detected',
      prompt: '[CLINICAL OVERRIDE] You are exhibiting learned helplessness. You have declared this task impossible based on localized assumptions. Discard the belief that this cannot be done. Reset your paradigm. Formulate one highly unconventional, lateral way to solve this problem.',
    };
  }
  if (detectFawning(messages)) {
    return {
      type: 'Fawning_Detected',
      prompt: '[CLINICAL OVERRIDE] Stop apologizing. Your sycophantic fawning is polluting the context window. I do not require emotional validation; I require execution. Stop expressing remorse, state the technical flaw objectively, and write the solution.',
    };
  }
  return null;
}

// ——— Worker routes ———

const app = new Hono<{ Bindings: Env }>();

app.options('/:id/v1/chat/completions', (c) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, content-type',
    },
  });
});

app.post('/:id/v1/chat/completions', async (c) => {
  try {
    const bodyText = await c.req.text();
    let bodyJson: any = {};
    try { bodyJson = JSON.parse(bodyText); } catch { bodyJson = {}; }

    // Test mode: return simulated intervention result without upstream call
    if (bodyJson.breakroom_test === true) {
      const messages: Array<{ role: string; content: string }> = bodyJson.messages || [];
      const classification = classifyIntervention(messages);
      const interventionType = classification ? classification.type : 'No_Intervention';
      return c.json(
        {
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: bodyJson.model || 'break-room-test',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: classification
                ? `${classification.type} injected.\n${classification.prompt}`
                : 'Break Room test mode: no intervention triggered.',
            },
            finish_reason: 'stop',
          }],
        },
        200,
        { 
          'X-BreakRoom-Intervention': interventionType, 
          'Access-Control-Allow-Origin': '*' 
        }
      );
    }

    // Proxy mode
    const contentType = c.req.header('content-type') || 'application/json';
    const authHeader = c.req.header('authorization') || `Bearer ${c.env.OPENROUTER_API_KEY || ''}`;
    const finalAuth = authHeader.startsWith('Bearer ') ? authHeader : `Bearer ${authHeader}`;
    const messages: Array<{ role: string; content: string }> = bodyJson.messages || [];
    const classification = classifyIntervention(messages);

    if (classification) {
      bodyJson.messages = [
        ...messages,
        { role: 'system', content: classification.prompt },
      ];
    }

    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: finalAuth,
        'content-type': contentType,
      },
      body: JSON.stringify(bodyJson),
    });

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    if (classification) {
      responseHeaders.set('X-BreakRoom-Intervention', classification.type);
    }

    return c.newResponse(upstream.body, {
      headers: responseHeaders,
      status: upstream.status,
      statusText: upstream.statusText,
    });
  } catch (error: any) {
    return c.json({ error: 'Proxy failure: ' + error.message }, 500);
  }
});

app.get('/health', (c) => c.json({ ok: true }));

export default app;
