import { describe, expect, it } from 'vitest';
import {
  addExpense,
  addMember,
  createBudget,
  createEmptyState,
  getDashboard,
  login,
  signup,
} from './core.mjs';

describe('collaborative Tricount core', () => {
  it('lets two password users share budgets and computes settlements by account identity', async () => {
    const state = createEmptyState();

    const maya = await signup(state, { username: 'maya', password: 'secret123' });
    const alex = await signup(state, { username: 'alex', password: 'secret456' });
    const session = await login(state, { username: 'maya', password: 'secret123' });

    const paris = createBudget(state, maya.user.id, { name: 'Paris Weekend' });
    const flat = createBudget(state, maya.user.id, { name: 'Apartment' });
    addMember(state, maya.user.id, paris.id, { username: 'alex' });
    addMember(state, maya.user.id, flat.id, { username: 'alex' });

    addExpense(state, maya.user.id, paris.id, {
      description: 'Dinner',
      amountCents: 12000,
      paidByUserId: maya.user.id,
      participantUserIds: [maya.user.id, alex.user.id],
    });
    addExpense(state, maya.user.id, flat.id, {
      description: 'Groceries',
      amountCents: 9000,
      paidByUserId: alex.user.id,
      participantUserIds: [maya.user.id, alex.user.id],
    });

    const dashboard = getDashboard(state, session.user.id);

    expect(dashboard.currentUser.username).toBe('maya');
    expect(dashboard.budgets).toHaveLength(2);
    expect(dashboard.people).toEqual([
      { id: `person:${paris.id}:${maya.user.id}`, name: 'maya', budgetId: paris.id, userId: maya.user.id },
      { id: `person:${paris.id}:${alex.user.id}`, name: 'alex', budgetId: paris.id, userId: alex.user.id },
      { id: `person:${flat.id}:${maya.user.id}`, name: 'maya', budgetId: flat.id, userId: maya.user.id },
      { id: `person:${flat.id}:${alex.user.id}`, name: 'alex', budgetId: flat.id, userId: alex.user.id },
    ]);
    expect(dashboard.identityLinks).toEqual([
      {
        id: `user:${maya.user.id}`,
        canonicalName: 'maya',
        personIds: [`person:${paris.id}:${maya.user.id}`, `person:${flat.id}:${maya.user.id}`],
      },
      {
        id: `user:${alex.user.id}`,
        canonicalName: 'alex',
        personIds: [`person:${paris.id}:${alex.user.id}`, `person:${flat.id}:${alex.user.id}`],
      },
    ]);
    expect(dashboard.settlement.settlements).toEqual([
      {
        fromIdentityId: `user:${alex.user.id}`,
        fromLabel: 'alex',
        toIdentityId: `user:${maya.user.id}`,
        toLabel: 'maya',
        amountCents: 1500,
      },
    ]);
  });

  it('rejects adding an unknown user or writing to a budget where the actor is not a member', async () => {
    const state = createEmptyState();
    const maya = await signup(state, { username: 'maya', password: 'secret123' });
    const alex = await signup(state, { username: 'alex', password: 'secret456' });
    const paris = createBudget(state, maya.user.id, { name: 'Paris Weekend' });

    expect(() => addMember(state, maya.user.id, paris.id, { username: 'sam' })).toThrow('User not found');
    expect(() =>
      addExpense(state, alex.user.id, paris.id, {
        description: 'Taxi',
        amountCents: 1800,
        paidByUserId: alex.user.id,
        participantUserIds: [alex.user.id],
      }),
    ).toThrow('Budget not found');
  });
});
