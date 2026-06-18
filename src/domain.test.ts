import { describe, expect, it } from 'vitest';
import {
  computeGlobalSettlement,
  findIdentityLinkSuggestions,
  type Budget,
  type Expense,
  type IdentityLink,
  type Person,
} from './domain';

const people: Person[] = [
  { id: 'alice-trip', name: 'Alice', budgetId: 'paris' },
  { id: 'ben-trip', name: 'Ben', budgetId: 'paris' },
  { id: 'alice-flat', name: 'Alicia', budgetId: 'apartment' },
  { id: 'cara-flat', name: 'Cara', budgetId: 'apartment' },
];

const budgets: Budget[] = [
  { id: 'paris', name: 'Paris Weekend', memberIds: ['alice-trip', 'ben-trip'] },
  { id: 'apartment', name: 'Apartment', memberIds: ['alice-flat', 'cara-flat'] },
];

const expenses: Expense[] = [
  {
    id: 'dinner',
    budgetId: 'paris',
    description: 'Dinner',
    amountCents: 12000,
    paidById: 'alice-trip',
    participantIds: ['alice-trip', 'ben-trip'],
  },
  {
    id: 'groceries',
    budgetId: 'apartment',
    description: 'Groceries',
    amountCents: 9000,
    paidById: 'cara-flat',
    participantIds: ['alice-flat', 'cara-flat'],
  },
];

describe('computeGlobalSettlement', () => {
  it('combines balances only through explicit shared identities', () => {
    const linked: IdentityLink[] = [
      {
        id: 'alice-link',
        canonicalName: 'Alice',
        personIds: ['alice-trip', 'alice-flat'],
      },
    ];

    const settlement = computeGlobalSettlement({ people, budgets, expenses, identityLinks: linked });

    expect(settlement.balancesByIdentity).toEqual([
      { identityId: 'alice-link', label: 'Alice', balanceCents: 1500, personIds: ['alice-trip', 'alice-flat'] },
      { identityId: 'person:ben-trip', label: 'Ben', balanceCents: -6000, personIds: ['ben-trip'] },
      { identityId: 'person:cara-flat', label: 'Cara', balanceCents: 4500, personIds: ['cara-flat'] },
    ]);
    expect(settlement.settlements).toEqual([
      { fromIdentityId: 'person:ben-trip', fromLabel: 'Ben', toIdentityId: 'person:cara-flat', toLabel: 'Cara', amountCents: 4500 },
      { fromIdentityId: 'person:ben-trip', fromLabel: 'Ben', toIdentityId: 'alice-link', toLabel: 'Alice', amountCents: 1500 },
    ]);
  });

  it('does not merge similar names without an explicit link', () => {
    const settlement = computeGlobalSettlement({ people, budgets, expenses, identityLinks: [] });

    expect(settlement.balancesByIdentity).toContainEqual({
      identityId: 'person:alice-trip',
      label: 'Alice',
      balanceCents: 6000,
      personIds: ['alice-trip'],
    });
    expect(settlement.balancesByIdentity).toContainEqual({
      identityId: 'person:alice-flat',
      label: 'Alicia',
      balanceCents: -4500,
      personIds: ['alice-flat'],
    });
  });
});

describe('findIdentityLinkSuggestions', () => {
  it('suggests likely matches across budgets without changing settlement math', () => {
    const suggestions = findIdentityLinkSuggestions(people, []);

    expect(suggestions).toContainEqual({
      personAId: 'alice-trip',
      personBId: 'alice-flat',
      personALabel: 'Alice',
      personBLabel: 'Alicia',
      confidence: 'medium',
      reason: 'Similar names across different budgets',
    });
  });
});
