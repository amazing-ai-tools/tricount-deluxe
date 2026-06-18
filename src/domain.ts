export type Person = {
  id: string;
  name: string;
  budgetId: string;
};

export type Budget = {
  id: string;
  name: string;
  memberIds: string[];
};

export type Expense = {
  id: string;
  budgetId: string;
  description: string;
  amountCents: number;
  paidById: string;
  participantIds: string[];
};

export type IdentityLink = {
  id: string;
  canonicalName: string;
  personIds: string[];
};

export type IdentityBalance = {
  identityId: string;
  label: string;
  balanceCents: number;
  personIds: string[];
};

export type Settlement = {
  fromIdentityId: string;
  fromLabel: string;
  toIdentityId: string;
  toLabel: string;
  amountCents: number;
};

export type GlobalSettlementInput = {
  people: Person[];
  budgets: Budget[];
  expenses: Expense[];
  identityLinks: IdentityLink[];
};

export type GlobalSettlementResult = {
  balancesByIdentity: IdentityBalance[];
  settlements: Settlement[];
};

export type IdentityLinkSuggestion = {
  personAId: string;
  personBId: string;
  personALabel: string;
  personBLabel: string;
  confidence: 'medium' | 'high';
  reason: string;
};

type IdentityLookup = {
  identityId: string;
  label: string;
  personIds: string[];
};

export function computeGlobalSettlement(input: GlobalSettlementInput): GlobalSettlementResult {
  const identityByPersonId = buildIdentityLookup(input.people, input.identityLinks);
  const balances = new Map<string, IdentityBalance>();

  for (const person of input.people) {
    const identity = identityByPersonId.get(person.id);
    if (!identity || balances.has(identity.identityId)) {
      continue;
    }

    balances.set(identity.identityId, {
      identityId: identity.identityId,
      label: identity.label,
      balanceCents: 0,
      personIds: identity.personIds,
    });
  }

  for (const expense of input.expenses) {
    const payer = identityByPersonId.get(expense.paidById);
    if (!payer || expense.participantIds.length === 0) {
      continue;
    }

    const payerBalance = balances.get(payer.identityId);
    if (payerBalance) {
      payerBalance.balanceCents += expense.amountCents;
    }

    const participantShares = splitCents(expense.amountCents, expense.participantIds.length);
    expense.participantIds.forEach((personId, index) => {
      const participant = identityByPersonId.get(personId);
      if (!participant) {
        return;
      }

      const participantBalance = balances.get(participant.identityId);
      if (participantBalance) {
        participantBalance.balanceCents -= participantShares[index];
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

export function findIdentityLinkSuggestions(
  people: Person[],
  identityLinks: IdentityLink[],
): IdentityLinkSuggestion[] {
  const linkedPersonIds = new Set(identityLinks.flatMap((link) => link.personIds));
  const suggestions: IdentityLinkSuggestion[] = [];

  for (let leftIndex = 0; leftIndex < people.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < people.length; rightIndex += 1) {
      const left = people[leftIndex];
      const right = people[rightIndex];

      if (
        left.budgetId === right.budgetId ||
        linkedPersonIds.has(left.id) ||
        linkedPersonIds.has(right.id)
      ) {
        continue;
      }

      const confidence = nameMatchConfidence(left.name, right.name);
      if (!confidence) {
        continue;
      }

      suggestions.push({
        personAId: left.id,
        personBId: right.id,
        personALabel: left.name,
        personBLabel: right.name,
        confidence,
        reason: 'Similar names across different budgets',
      });
    }
  }

  return suggestions;
}

export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  return `${sign}$${(absolute / 100).toFixed(2)}`;
}

function buildIdentityLookup(people: Person[], identityLinks: IdentityLink[]): Map<string, IdentityLookup> {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const lookup = new Map<string, IdentityLookup>();

  for (const link of identityLinks) {
    const personIds = link.personIds.filter((personId) => peopleById.has(personId));
    for (const personId of personIds) {
      lookup.set(personId, {
        identityId: link.id,
        label: link.canonicalName,
        personIds,
      });
    }
  }

  for (const person of people) {
    if (lookup.has(person.id)) {
      continue;
    }

    lookup.set(person.id, {
      identityId: `person:${person.id}`,
      label: person.name,
      personIds: [person.id],
    });
  }

  return lookup;
}

function splitCents(amountCents: number, parts: number): number[] {
  const baseShare = Math.floor(amountCents / parts);
  const remainder = amountCents % parts;

  return Array.from({ length: parts }, (_, index) => baseShare + (index < remainder ? 1 : 0));
}

function createSettlements(balances: IdentityBalance[]): Settlement[] {
  const debtors = balances
    .filter((balance) => balance.balanceCents < 0)
    .map((balance) => ({ ...balance, amountCents: Math.abs(balance.balanceCents) }))
    .sort((a, b) => b.amountCents - a.amountCents || a.label.localeCompare(b.label));

  const creditors = balances
    .filter((balance) => balance.balanceCents > 0)
    .map((balance) => ({ ...balance, amountCents: balance.balanceCents }))
    .sort((a, b) => b.amountCents - a.amountCents || a.label.localeCompare(b.label));

  const settlements: Settlement[] = [];
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

function nameMatchConfidence(leftName: string, rightName: string): IdentityLinkSuggestion['confidence'] | null {
  const left = normalizeName(leftName);
  const right = normalizeName(rightName);

  if (!left || !right) {
    return null;
  }

  if (left === right) {
    return 'high';
  }

  if (left.length >= 4 && right.length >= 4 && (left.startsWith(right) || right.startsWith(left))) {
    return 'medium';
  }

  if (levenshteinDistance(left, right) <= 2) {
    return 'medium';
  }

  return null;
}

function normalizeName(name: string): string {
  return name
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}

function levenshteinDistance(left: string, right: string): number {
  const matrix = Array.from({ length: left.length + 1 }, () =>
    Array.from({ length: right.length + 1 }, () => 0),
  );

  for (let leftIndex = 0; leftIndex <= left.length; leftIndex += 1) {
    matrix[leftIndex][0] = leftIndex;
  }

  for (let rightIndex = 0; rightIndex <= right.length; rightIndex += 1) {
    matrix[0][rightIndex] = rightIndex;
  }

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      matrix[leftIndex][rightIndex] = Math.min(
        matrix[leftIndex - 1][rightIndex] + 1,
        matrix[leftIndex][rightIndex - 1] + 1,
        matrix[leftIndex - 1][rightIndex - 1] + cost,
      );
    }
  }

  return matrix[left.length][right.length];
}
