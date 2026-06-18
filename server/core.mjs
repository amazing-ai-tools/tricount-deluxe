import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export function createEmptyState() {
  return {
    users: [],
    sessions: [],
    budgets: [],
    expenses: [],
    nextUserNumber: 1,
    nextBudgetNumber: 1,
    nextExpenseNumber: 1,
  };
}

export async function signup(state, input) {
  const username = normalizeUsername(input.username);
  assertPassword(input.password);

  if (state.users.some((user) => user.username === username)) {
    throw new Error('Username already exists');
  }

  const user = {
    id: `user-${state.nextUserNumber++}`,
    username,
    passwordHash: await hashPassword(input.password),
    createdAt: now(),
  };

  state.users.push(user);

  return createSession(state, user);
}

export async function login(state, input) {
  const username = normalizeUsername(input.username);
  const user = state.users.find((candidate) => candidate.username === username);

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new Error('Invalid username or password');
  }

  return createSession(state, user);
}

export function createBudget(state, actorUserId, input) {
  const actor = findUser(state, actorUserId);
  const name = String(input.name ?? '').trim();

  if (!name) {
    throw new Error('Budget name is required');
  }

  const budget = {
    id: `budget-${state.nextBudgetNumber++}`,
    name,
    ownerUserId: actor.id,
    memberUserIds: [actor.id],
    createdAt: now(),
  };

  state.budgets.push(budget);
  return budget;
}

export function addMember(state, actorUserId, budgetId, input) {
  const budget = findBudgetForMember(state, actorUserId, budgetId);
  const username = normalizeUsername(input.username);
  const user = state.users.find((candidate) => candidate.username === username);

  if (!user) {
    throw new Error('User not found');
  }

  if (!budget.memberUserIds.includes(user.id)) {
    budget.memberUserIds.push(user.id);
  }

  return budget;
}

export function addExpense(state, actorUserId, budgetId, input) {
  const budget = findBudgetForMember(state, actorUserId, budgetId);
  const description = String(input.description ?? '').trim();
  const amountCents = Number(input.amountCents);
  const participantUserIds = Array.from(new Set(input.participantUserIds ?? []));

  if (!description) {
    throw new Error('Description is required');
  }

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error('Amount must be positive');
  }

  assertBudgetMember(budget, input.paidByUserId);
  for (const userId of participantUserIds) {
    assertBudgetMember(budget, userId);
  }

  if (participantUserIds.length === 0) {
    throw new Error('At least one participant is required');
  }

  const expense = {
    id: `expense-${state.nextExpenseNumber++}`,
    budgetId,
    description,
    amountCents,
    paidByUserId: input.paidByUserId,
    participantUserIds,
    createdAt: now(),
  };

  state.expenses.unshift(expense);
  return expense;
}

export function getDashboard(state, actorUserId) {
  const currentUser = toPublicUser(findUser(state, actorUserId));
  const budgets = state.budgets
    .filter((budget) => budget.memberUserIds.includes(actorUserId))
    .map((budget) => ({
      id: budget.id,
      name: budget.name,
      ownerUserId: budget.ownerUserId,
      memberUserIds: [...budget.memberUserIds],
      memberIds: budget.memberUserIds.map((userId) => personId(budget.id, userId)),
    }));

  const visibleBudgetIds = new Set(budgets.map((budget) => budget.id));
  const visibleUserIds = new Set(budgets.flatMap((budget) => budget.memberUserIds));
  const people = budgets.flatMap((budget) =>
    budget.memberUserIds.map((userId) => {
      const user = findUser(state, userId);
      return {
        id: personId(budget.id, userId),
        name: user.username,
        budgetId: budget.id,
        userId,
      };
    }),
  );

  const expenses = state.expenses
    .filter((expense) => visibleBudgetIds.has(expense.budgetId))
    .map((expense) => ({
      id: expense.id,
      budgetId: expense.budgetId,
      description: expense.description,
      amountCents: expense.amountCents,
      paidById: personId(expense.budgetId, expense.paidByUserId),
      participantIds: expense.participantUserIds.map((userId) => personId(expense.budgetId, userId)),
      paidByUserId: expense.paidByUserId,
      participantUserIds: [...expense.participantUserIds],
    }));

  const identityLinks = Array.from(visibleUserIds)
    .map((userId) => {
      const user = findUser(state, userId);
      const personIds = budgets
        .filter((budget) => budget.memberUserIds.includes(userId))
        .map((budget) => personId(budget.id, userId));

      return {
        id: `user:${userId}`,
        canonicalName: user.username,
        personIds,
      };
    })
    .filter((link) => link.personIds.length > 1);

  return {
    currentUser,
    budgets,
    people,
    expenses,
    identityLinks,
    settlement: computeSettlement({ people, expenses, identityLinks }),
  };
}

export function getUserIdForToken(state, token) {
  const session = state.sessions.find((candidate) => candidate.token === token);
  return session?.userId ?? null;
}

function createSession(state, user) {
  const token = randomBytes(32).toString('base64url');
  state.sessions.push({
    token,
    userId: user.id,
    createdAt: now(),
  });

  return {
    token,
    user: toPublicUser(user),
  };
}

function findUser(state, userId) {
  const user = state.users.find((candidate) => candidate.id === userId);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
}

function findBudgetForMember(state, actorUserId, budgetId) {
  const budget = state.budgets.find(
    (candidate) => candidate.id === budgetId && candidate.memberUserIds.includes(actorUserId),
  );

  if (!budget) {
    throw new Error('Budget not found');
  }

  return budget;
}

function assertBudgetMember(budget, userId) {
  if (!budget.memberUserIds.includes(userId)) {
    throw new Error('User is not a budget member');
  }
}

function normalizeUsername(value) {
  const username = String(value ?? '').trim().toLowerCase();

  if (!/^[a-z0-9_]{2,24}$/.test(username)) {
    throw new Error('Username must be 2-24 characters using letters, numbers, or underscores');
  }

  return username;
}

function assertPassword(password) {
  if (String(password ?? '').length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('base64url');
  const hash = await scrypt(password, salt, 32);
  return `scrypt:${salt}:${Buffer.from(hash).toString('base64url')}`;
}

async function verifyPassword(password, storedHash) {
  const [method, salt, expectedHash] = String(storedHash).split(':');
  if (method !== 'scrypt' || !salt || !expectedHash) {
    return false;
  }

  const actual = await scrypt(password, salt, 32);
  const expected = Buffer.from(expectedHash, 'base64url');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
  };
}

function personId(budgetId, userId) {
  return `person:${budgetId}:${userId}`;
}

function computeSettlement({ people, expenses, identityLinks }) {
  const lookup = new Map();
  for (const link of identityLinks) {
    for (const id of link.personIds) {
      lookup.set(id, {
        identityId: link.id,
        label: link.canonicalName,
        personIds: link.personIds,
      });
    }
  }

  for (const person of people) {
    if (!lookup.has(person.id)) {
      lookup.set(person.id, {
        identityId: `person:${person.id}`,
        label: person.name,
        personIds: [person.id],
      });
    }
  }

  const balances = new Map();
  for (const identity of lookup.values()) {
    if (!balances.has(identity.identityId)) {
      balances.set(identity.identityId, {
        identityId: identity.identityId,
        label: identity.label,
        balanceCents: 0,
        personIds: identity.personIds,
      });
    }
  }

  for (const expense of expenses) {
    const payer = lookup.get(expense.paidById);
    if (!payer || expense.participantIds.length === 0) {
      continue;
    }

    balances.get(payer.identityId).balanceCents += expense.amountCents;
    const shares = splitCents(expense.amountCents, expense.participantIds.length);
    expense.participantIds.forEach((personId, index) => {
      const participant = lookup.get(personId);
      if (participant) {
        balances.get(participant.identityId).balanceCents -= shares[index];
      }
    });
  }

  const balancesByIdentity = Array.from(balances.values())
    .filter((balance) => balance.balanceCents !== 0)
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    balancesByIdentity,
    settlements: createSettlements(balancesByIdentity),
  };
}

function splitCents(amountCents, parts) {
  const base = Math.floor(amountCents / parts);
  const remainder = amountCents % parts;
  return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0));
}

function createSettlements(balances) {
  const debtors = balances
    .filter((balance) => balance.balanceCents < 0)
    .map((balance) => ({ ...balance, amountCents: Math.abs(balance.balanceCents) }))
    .sort((a, b) => b.amountCents - a.amountCents || a.label.localeCompare(b.label));
  const creditors = balances
    .filter((balance) => balance.balanceCents > 0)
    .map((balance) => ({ ...balance, amountCents: balance.balanceCents }))
    .sort((a, b) => b.amountCents - a.amountCents || a.label.localeCompare(b.label));

  const settlements = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amountCents = Math.min(debtor.amountCents, creditor.amountCents);

    settlements.push({
      fromIdentityId: debtor.identityId,
      fromLabel: debtor.label,
      toIdentityId: creditor.identityId,
      toLabel: creditor.label,
      amountCents,
    });

    debtor.amountCents -= amountCents;
    creditor.amountCents -= amountCents;

    if (debtor.amountCents === 0) {
      debtorIndex += 1;
    }
    if (creditor.amountCents === 0) {
      creditorIndex += 1;
    }
  }

  return settlements;
}

function now() {
  return new Date().toISOString();
}
