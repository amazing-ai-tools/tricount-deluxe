import { afterEach, describe, expect, it } from 'vitest';
import { createAppServer } from './http.mjs';
import { createEmptyState } from './core.mjs';

const servers = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve) => {
          server.close(resolve);
        }),
    ),
  );
});

describe('Tricount HTTP API', () => {
  it('supports signup, budget collaboration, and authenticated dashboard reads', async () => {
    const server = createAppServer({
      state: createEmptyState(),
      save: async () => {},
      allowedOrigins: ['http://localhost:5173'],
    });
    servers.push(server);
    await listen(server);
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    const maya = await post(baseUrl, '/api/auth/signup', { username: 'maya', password: 'secret123' });
    const alex = await post(baseUrl, '/api/auth/signup', { username: 'alex', password: 'secret456' });
    const budget = await post(baseUrl, '/api/budgets', { name: 'Paris Weekend' }, maya.token);
    await post(baseUrl, `/api/budgets/${budget.budget.id}/members`, { username: 'alex' }, maya.token);
    await post(
      baseUrl,
      `/api/budgets/${budget.budget.id}/expenses`,
      {
        description: 'Dinner',
        amountCents: 8000,
        paidByUserId: maya.user.id,
        participantUserIds: [maya.user.id, alex.user.id],
      },
      maya.token,
    );

    const alexDashboard = await get(baseUrl, '/api/dashboard', alex.token);

    expect(alexDashboard.currentUser.username).toBe('alex');
    expect(alexDashboard.budgets[0].name).toBe('Paris Weekend');
    expect(alexDashboard.settlement.settlements).toEqual([
      {
        fromIdentityId: `person:person:${budget.budget.id}:${alex.user.id}`,
        fromLabel: 'alex',
        toIdentityId: `person:person:${budget.budget.id}:${maya.user.id}`,
        toLabel: 'maya',
        amountCents: 4000,
      },
    ]);
  });
});

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
}

async function post(baseUrl, path, body, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  expect(response.status).toBeLessThan(300);
  return response.json();
}

async function get(baseUrl, path, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  expect(response.status).toBeLessThan(300);
  return response.json();
}
