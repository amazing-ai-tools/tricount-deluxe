import React from 'react';
import {
  ArrowRight,
  ArrowRightLeft,
  Check,
  Link2,
  Plus,
  Receipt,
  Scale,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import {
  computeGlobalSettlement,
  findIdentityLinkSuggestions,
  formatMoney,
  type Budget,
  type Expense,
  type IdentityLink,
  type Person,
} from './domain';

const bugzeroAppKey = import.meta.env.VITE_BUGZERO_APP_KEY || '';
const bugzeroWidgetUrl =
  import.meta.env.VITE_BUGZERO_WIDGET_URL || 'https://bugzero.amazing-ai.tools/widget.js';

const initialBudgets: Budget[] = [
  { id: 'paris', name: 'Paris Weekend', memberIds: ['maya-paris', 'alex-paris'] },
  { id: 'apartment', name: 'Apartment', memberIds: ['maya-home', 'sam-home', 'alex-home'] },
];

const initialPeople: Person[] = [
  { id: 'maya-paris', name: 'Maya', budgetId: 'paris' },
  { id: 'alex-paris', name: 'Alex', budgetId: 'paris' },
  { id: 'maya-home', name: 'Maya L.', budgetId: 'apartment' },
  { id: 'sam-home', name: 'Sam', budgetId: 'apartment' },
  { id: 'alex-home', name: 'Alex D.', budgetId: 'apartment' },
];

const initialLinks: IdentityLink[] = [
  {
    id: 'identity-maya',
    canonicalName: 'Maya',
    personIds: ['maya-paris', 'maya-home'],
  },
];

const initialExpenses: Expense[] = [
  {
    id: 'expense-dinner',
    budgetId: 'paris',
    description: 'Canal dinner',
    amountCents: 12640,
    paidById: 'maya-paris',
    participantIds: ['maya-paris', 'alex-paris'],
  },
  {
    id: 'expense-taxi',
    budgetId: 'paris',
    description: 'Late taxi',
    amountCents: 3480,
    paidById: 'alex-paris',
    participantIds: ['maya-paris', 'alex-paris'],
  },
  {
    id: 'expense-market',
    budgetId: 'apartment',
    description: 'Shared groceries',
    amountCents: 8875,
    paidById: 'sam-home',
    participantIds: ['maya-home', 'sam-home', 'alex-home'],
  },
  {
    id: 'expense-internet',
    budgetId: 'apartment',
    description: 'Internet renewal',
    amountCents: 6000,
    paidById: 'alex-home',
    participantIds: ['maya-home', 'sam-home', 'alex-home'],
  },
];

type ExpenseForm = {
  description: string;
  amount: string;
  paidById: string;
  participantIds: string[];
};

function ensureBugZeroWidget() {
  if (!bugzeroAppKey || document.querySelector('script[data-bugzero-widget]')) {
    return;
  }

  const script = document.createElement('script');
  script.src = bugzeroWidgetUrl;
  script.async = true;
  script.dataset.bugzeroWidget = 'true';
  script.dataset.appKey = bugzeroAppKey;
  document.body.appendChild(script);
}

export default function App() {
  const [budgets] = React.useState<Budget[]>(initialBudgets);
  const [people] = React.useState<Person[]>(initialPeople);
  const [identityLinks, setIdentityLinks] = React.useState<IdentityLink[]>(initialLinks);
  const [expenses, setExpenses] = React.useState<Expense[]>(initialExpenses);
  const [selectedBudgetId, setSelectedBudgetId] = React.useState(initialBudgets[0].id);

  const selectedBudget = budgets.find((budget) => budget.id === selectedBudgetId) ?? budgets[0];
  const selectedPeople = people.filter((person) => selectedBudget.memberIds.includes(person.id));
  const selectedExpenses = expenses.filter((expense) => expense.budgetId === selectedBudget.id);

  const [form, setForm] = React.useState<ExpenseForm>(() => ({
    description: '',
    amount: '',
    paidById: selectedPeople[0]?.id ?? '',
    participantIds: selectedPeople.map((person) => person.id),
  }));

  React.useEffect(() => {
    ensureBugZeroWidget();
  }, []);

  React.useEffect(() => {
    setForm({
      description: '',
      amount: '',
      paidById: selectedPeople[0]?.id ?? '',
      participantIds: selectedPeople.map((person) => person.id),
    });
  }, [selectedBudgetId]);

  const settlement = React.useMemo(
    () => computeGlobalSettlement({ people, budgets, expenses, identityLinks }),
    [people, budgets, expenses, identityLinks],
  );

  const suggestions = React.useMemo(
    () => findIdentityLinkSuggestions(people, identityLinks),
    [people, identityLinks],
  );

  function addExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amountCents = Math.round(Number(form.amount) * 100);
    const description = form.description.trim();

    if (!description || !Number.isFinite(amountCents) || amountCents <= 0 || form.participantIds.length === 0) {
      return;
    }

    setExpenses((current) => [
      {
        id: `expense-${Date.now()}`,
        budgetId: selectedBudget.id,
        description,
        amountCents,
        paidById: form.paidById,
        participantIds: form.participantIds,
      },
      ...current,
    ]);
    setForm({
      description: '',
      amount: '',
      paidById: selectedPeople[0]?.id ?? '',
      participantIds: selectedPeople.map((person) => person.id),
    });
  }

  function acceptSuggestion(personAId: string, personBId: string) {
    const linkedPeople = [personAId, personBId]
      .map((personId) => people.find((person) => person.id === personId))
      .filter((person): person is Person => Boolean(person));

    if (linkedPeople.length !== 2) {
      return;
    }

    setIdentityLinks((current) => [
      ...current,
      {
        id: `identity-${personAId}-${personBId}`,
        canonicalName: linkedPeople[0].name,
        personIds: [personAId, personBId],
      },
    ]);
  }

  function toggleParticipant(personId: string) {
    setForm((current) => {
      const isSelected = current.participantIds.includes(personId);
      const participantIds = isSelected
        ? current.participantIds.filter((id) => id !== personId)
        : [...current.participantIds, personId];

      return { ...current, participantIds };
    });
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Budgets and identity links">
        <div className="brand-lockup">
          <div className="brand-mark">
            <WalletCards size={22} />
          </div>
          <div>
            <p>Tricount Deluxe</p>
            <span>Shared budgets, one identity graph</span>
          </div>
        </div>

        <section className="side-section">
          <div className="section-title">
            <UsersRound size={16} />
            <h2>Budgets</h2>
          </div>
          <div className="budget-list">
            {budgets.map((budget) => (
              <button
                className={`budget-button ${budget.id === selectedBudget.id ? 'active' : ''}`}
                key={budget.id}
                onClick={() => setSelectedBudgetId(budget.id)}
                type="button"
              >
                <span>{budget.name}</span>
                <small>{budget.memberIds.length} people</small>
              </button>
            ))}
          </div>
        </section>

        <section className="side-section">
          <div className="section-title">
            <Link2 size={16} />
            <h2>Shared identities</h2>
          </div>
          <div className="identity-stack">
            {identityLinks.map((link) => (
              <div className="identity-link" key={link.id}>
                <strong>{link.canonicalName}</strong>
                <span>{link.personIds.map((personId) => getPersonName(people, personId)).join(' + ')}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="suggestion-panel">
          <div className="section-title">
            <ArrowRightLeft size={16} />
            <h2>Link suggestions</h2>
          </div>
          {suggestions.length === 0 ? (
            <p className="quiet-copy">No likely matches waiting. Settlement math only uses confirmed links.</p>
          ) : (
            suggestions.map((suggestion) => (
              <div className="suggestion" key={`${suggestion.personAId}-${suggestion.personBId}`}>
                <div>
                  <strong>
                    {suggestion.personALabel} <ArrowRight size={12} /> {suggestion.personBLabel}
                  </strong>
                  <span>{suggestion.reason}</span>
                </div>
                <button
                  className="icon-action"
                  type="button"
                  aria-label={`Link ${suggestion.personALabel} and ${suggestion.personBLabel}`}
                  onClick={() => acceptSuggestion(suggestion.personAId, suggestion.personBId)}
                >
                  <Check size={16} />
                </button>
              </div>
            ))
          )}
        </section>
      </aside>

      <section className="workspace" aria-label="Budget workspace">
        <header className="topbar">
          <div>
            <p className="screen-label">Active budget</p>
            <h1>{selectedBudget.name}</h1>
          </div>
          <div className="topbar-metric">
            <span>{selectedExpenses.length}</span>
            <small>expenses</small>
          </div>
        </header>

        <section className="entry-panel" aria-label="Add expense">
          <div className="panel-heading">
            <Receipt size={18} />
            <h2>Add an expense</h2>
          </div>
          <form className="expense-form" onSubmit={addExpense}>
            <label>
              Description
              <input
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Dinner, rent, train tickets"
              />
            </label>
            <label>
              Amount
              <input
                inputMode="decimal"
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                placeholder="0.00"
              />
            </label>
            <label>
              Paid by
              <select
                value={form.paidById}
                onChange={(event) => setForm((current) => ({ ...current, paidById: event.target.value }))}
              >
                {selectedPeople.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>Split with</legend>
              <div className="participant-grid">
                {selectedPeople.map((person) => (
                  <label className="check-row" key={person.id}>
                    <input
                      checked={form.participantIds.includes(person.id)}
                      onChange={() => toggleParticipant(person.id)}
                      type="checkbox"
                    />
                    <span>{person.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button className="primary-action" type="submit">
              <Plus size={17} />
              Add expense
            </button>
          </form>
        </section>

        <section className="ledger" aria-label="Expense ledger">
          <div className="panel-heading">
            <Scale size={18} />
            <h2>Ledger</h2>
          </div>
          <div className="ledger-list">
            {selectedExpenses.map((expense) => (
              <article className="ledger-row" key={expense.id}>
                <div>
                  <strong>{expense.description}</strong>
                  <span>
                    Paid by {getPersonName(people, expense.paidById)} for{' '}
                    {expense.participantIds.map((personId) => getPersonName(people, personId)).join(', ')}
                  </span>
                </div>
                <b>{formatMoney(expense.amountCents)}</b>
              </article>
            ))}
          </div>
        </section>
      </section>

      <aside className="settlement-panel" aria-label="Global balances">
        <div className="settlement-header">
          <p className="screen-label">Across all budgets</p>
          <h2>Who owes who</h2>
          <span>Explicit links are included in the compute. Suggestions are not.</span>
        </div>

        <section className="balance-list">
          {settlement.balancesByIdentity.map((balance) => (
            <div className="balance-row" key={balance.identityId}>
              <div>
                <strong>{balance.label}</strong>
                <span>{balance.personIds.length > 1 ? `${balance.personIds.length} linked profiles` : 'single profile'}</span>
              </div>
              <b className={balance.balanceCents >= 0 ? 'positive' : 'negative'}>
                {formatMoney(balance.balanceCents)}
              </b>
            </div>
          ))}
        </section>

        <section className="settlement-list">
          <h3>Suggested settlements</h3>
          {settlement.settlements.map((item) => (
            <article className="settlement-row" key={`${item.fromIdentityId}-${item.toIdentityId}-${item.amountCents}`}>
              <div>
                <strong>{item.fromLabel}</strong>
                <span>pays {item.toLabel}</span>
              </div>
              <b>{formatMoney(item.amountCents)}</b>
            </article>
          ))}
        </section>
      </aside>
    </main>
  );
}

function getPersonName(people: Person[], personId: string): string {
  return people.find((person) => person.id === personId)?.name ?? 'Unknown';
}
