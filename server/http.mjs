import { createServer } from 'node:http';
import { addExpense, addMember, createBudget, getDashboard, getUserIdForToken, login, signup } from './core.mjs';

export function createAppServer({ state, save, allowedOrigins }) {
  return createServer(async (request, response) => {
    const origin = request.headers.origin;
    writeCorsHeaders(response, origin, allowedOrigins);

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const route = `${request.method ?? 'GET'} ${url.pathname}`;

      if (route === 'GET /healthz') {
        sendJson(response, 200, { ok: true });
        return;
      }

      if (route === 'POST /api/auth/signup') {
        const result = await signup(state, await readJson(request));
        await save(state);
        sendJson(response, 201, result);
        return;
      }

      if (route === 'POST /api/auth/login') {
        sendJson(response, 200, await login(state, await readJson(request)));
        return;
      }

      const actorUserId = requireUserId(state, request);

      if (route === 'GET /api/dashboard') {
        sendJson(response, 200, getDashboard(state, actorUserId));
        return;
      }

      if (route === 'POST /api/budgets') {
        const budget = createBudget(state, actorUserId, await readJson(request));
        await save(state);
        sendJson(response, 201, { budget });
        return;
      }

      const memberMatch = url.pathname.match(/^\/api\/budgets\/([^/]+)\/members$/);
      if (request.method === 'POST' && memberMatch) {
        const budget = addMember(state, actorUserId, memberMatch[1], await readJson(request));
        await save(state);
        sendJson(response, 200, { budget });
        return;
      }

      const expenseMatch = url.pathname.match(/^\/api\/budgets\/([^/]+)\/expenses$/);
      if (request.method === 'POST' && expenseMatch) {
        const expense = addExpense(state, actorUserId, expenseMatch[1], await readJson(request));
        await save(state);
        sendJson(response, 201, { expense });
        return;
      }

      sendJson(response, 404, { error: 'Not found' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      const status = message === 'Unauthorized' ? 401 : message === 'Not found' ? 404 : 400;
      sendJson(response, status, { error: message });
    }
  });
}

function requireUserId(state, request) {
  const authorization = request.headers.authorization ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';
  const userId = getUserIdForToken(state, token);

  if (!userId) {
    throw new Error('Unauthorized');
  }

  return userId;
}

function writeCorsHeaders(response, origin, allowedOrigins) {
  const fallbackOrigin = allowedOrigins[0] ?? '*';
  const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : fallbackOrigin;

  response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Vary', 'Origin');
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}
