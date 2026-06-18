import React from 'react';
import {
  ArrowRight,
  LogOut,
  Plus,
  Receipt,
  RefreshCw,
  Scale,
  UserPlus,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { formatMoney, type Budget, type Expense, type GlobalSettlementResult, type IdentityLink, type Person } from './domain';

const bugzeroAppKey = import.meta.env.VITE_BUGZERO_APP_KEY || '';
const bugzeroWidgetUrl =
  import.meta.env.VITE_BUGZERO_WIDGET_URL || 'https://bugzero.amazing-ai.tools/widget.js';
const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL || 'https://tricount-deluxe.api.amazing-ai.tools'
).replace(/\/$/, '');
const sessionStorageKey = 'tricount-deluxe-token';

type CurrentUser = {
  id: string;
  username: string;
};

type AppBudget = Budget & {
  ownerUserId: string;
  memberUserIds: string[];
};

type AppPerson = Person & {
  userId: string;
};

type AppExpense = Expense & {
  paidByUserId: string;
  participantUserIds: string[];
};

type Dashboard = {
  currentUser: CurrentUser;
  budgets: AppBudget[];
  people: AppPerson[];
  expenses: AppExpense[];
  identityLinks: IdentityLink[];
  settlement: GlobalSettlementResult;
};

type ExpenseForm = {
  description: string;
  amount: string;
  paidByUserId: string;
  participantUserIds: string[];
};

type AuthMode = 'login' | 'signup';

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
  const [token, setToken] = React.useState(() => localStorage.getItem(sessionStorageKey) ?? '');
  const [dashboard, setDashboard] = React.useState<Dashboard | null>(null);
  const [selectedBudgetId, setSelectedBudgetId] = React.useState('');
  const [authMode, setAuthMode] = React.useState<AuthMode>('signup');
  const [authForm, setAuthForm] = React.useState({ username: '', password: '' });
  const [budgetName, setBudgetName] = React.useState('');
  const [memberUsername, setMemberUsername] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [isBusy, setIsBusy] = React.useState(false);

  const selectedBudget = dashboard?.budgets.find((budget) => budget.id === selectedBudgetId) ?? dashboard?.budgets[0];
  const selectedPeople = React.useMemo(
    () => (selectedBudget && dashboard ? dashboard.people.filter((person) => person.budgetId === selectedBudget.id) : []),
    [dashboard, selectedBudget],
  );
  const selectedExpenses = React.useMemo(
    () =>
      selectedBudget && dashboard
        ? dashboard.expenses.filter((expense) => expense.budgetId === selectedBudget.id)
        : [],
    [dashboard, selectedBudget],
  );

  const [expenseForm, setExpenseForm] = React.useState<ExpenseForm>({
    description: '',
    amount: '',
    paidByUserId: '',
    participantUserIds: [],
  });

  React.useEffect(() => {
    ensureBugZeroWidget();
  }, []);

  React.useEffect(() => {
    if (!token) {
      setDashboard(null);
      return;
    }

    void loadDashboard(token);
  }, [token]);

  React.useEffect(() => {
    if (!selectedBudget && dashboard?.budgets[0]) {
      setSelectedBudgetId(dashboard.budgets[0].id);
    }
  }, [dashboard, selectedBudget]);

  React.useEffect(() => {
    setExpenseForm({
      description: '',
      amount: '',
      paidByUserId: selectedPeople[0]?.userId ?? '',
      participantUserIds: selectedPeople.map((person) => person.userId),
    });
  }, [selectedBudgetId, selectedPeople]);

  async function loadDashboard(activeToken = token) {
    setIsBusy(true);
    setNotice('');
    try {
      const nextDashboard = await apiRequest<Dashboard>('/api/dashboard', { token: activeToken });
      setDashboard(nextDashboard);
      if (!selectedBudgetId && nextDashboard.budgets[0]) {
        setSelectedBudgetId(nextDashboard.budgets[0].id);
      }
    } catch (error) {
      setNotice(getErrorMessage(error));
      if (getErrorMessage(error) === 'Unauthorized') {
        signOut();
      }
    } finally {
      setIsBusy(false);
    }
  }

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setNotice('');
    try {
      const result = await apiRequest<{ token: string; user: CurrentUser }>(`/api/auth/${authMode}`, {
        body: authForm,
      });
      localStorage.setItem(sessionStorageKey, result.token);
      setToken(result.token);
      setAuthForm({ username: '', password: '' });
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function submitBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = budgetName.trim();
    if (!name) {
      return;
    }

    await mutate(`/api/budgets`, { name });
    setBudgetName('');
  }

  async function submitMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBudget || !memberUsername.trim()) {
      return;
    }

    await mutate(`/api/budgets/${selectedBudget.id}/members`, { username: memberUsername });
    setMemberUsername('');
  }

  async function submitExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBudget) {
      return;
    }

    const amountCents = Math.round(Number(expenseForm.amount) * 100);
    if (!expenseForm.description.trim() || !Number.isInteger(amountCents) || amountCents <= 0) {
      setNotice('Enter a description and a positive amount.');
      return;
    }

    await mutate(`/api/budgets/${selectedBudget.id}/expenses`, {
      description: expenseForm.description,
      amountCents,
      paidByUserId: expenseForm.paidByUserId,
      participantUserIds: expenseForm.participantUserIds,
    });
  }

  async function mutate(path: string, body: unknown) {
    setIsBusy(true);
    setNotice('');
    try {
      await apiRequest(path, { token, body });
      await loadDashboard(token);
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  function signOut() {
    localStorage.removeItem(sessionStorageKey);
    setToken('');
    setDashboard(null);
    setSelectedBudgetId('');
  }

  function toggleParticipant(userId: string) {
    setExpenseForm((current) => {
      const participantUserIds = current.participantUserIds.includes(userId)
        ? current.participantUserIds.filter((id) => id !== userId)
        : [...current.participantUserIds, userId];

      return { ...current, participantUserIds };
    });
  }

  if (!token || !dashboard) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div className="brand-lockup">
            <div className="brand-mark">
              <WalletCards size={22} />
            </div>
            <div>
              <p>Tricount Deluxe</p>
              <span>Shared budgets that remember who is really who</span>
            </div>
          </div>
          <div className="auth-copy">
            <p className="screen-label">Private beta</p>
            <h1>Split with a friend in two windows.</h1>
            <p>Create a username, share it with your friend, add each other to budgets, and settle globally.</p>
          </div>
          <form className="auth-form" onSubmit={submitAuth}>
            <div className="segmented-control" aria-label="Auth mode">
              <button className={authMode === 'signup' ? 'active' : ''} type="button" onClick={() => setAuthMode('signup')}>
                Sign up
              </button>
              <button className={authMode === 'login' ? 'active' : ''} type="button" onClick={() => setAuthMode('login')}>
                Log in
              </button>
            </div>
            <label>
              Username
              <input
                autoComplete="username"
                value={authForm.username}
                onChange={(event) => setAuthForm((current) => ({ ...current, username: event.target.value }))}
                placeholder="maya"
              />
            </label>
            <label>
              Password
              <input
                autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                type="password"
                value={authForm.password}
                onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="At least 6 characters"
              />
            </label>
            <button className="primary-action" disabled={isBusy} type="submit">
              {authMode === 'signup' ? 'Create account' : 'Log in'}
            </button>
            {notice ? <p className="notice">{notice}</p> : null}
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Budgets and account">
        <div className="brand-lockup">
          <div className="brand-mark">
            <WalletCards size={22} />
          </div>
          <div>
            <p>Tricount Deluxe</p>
            <span>@{dashboard.currentUser.username}</span>
          </div>
        </div>

        <section className="side-section">
          <div className="section-title">
            <UsersRound size={16} />
            <h2>Budgets</h2>
          </div>
          <form className="compact-form" onSubmit={submitBudget}>
            <input
              value={budgetName}
              onChange={(event) => setBudgetName(event.target.value)}
              placeholder="New budget"
            />
            <button className="icon-action" disabled={isBusy} type="submit" aria-label="Create budget">
              <Plus size={16} />
            </button>
          </form>
          <div className="budget-list">
            {dashboard.budgets.map((budget) => (
              <button
                className={`budget-button ${budget.id === selectedBudget?.id ? 'active' : ''}`}
                key={budget.id}
                onClick={() => setSelectedBudgetId(budget.id)}
                type="button"
              >
                <span>{budget.name}</span>
                <small>{budget.memberUserIds.length} people</small>
              </button>
            ))}
          </div>
        </section>

        <section className="side-section">
          <div className="section-title">
            <UserPlus size={16} />
            <h2>Add a friend</h2>
          </div>
          <form className="compact-form" onSubmit={submitMember}>
            <input
              value={memberUsername}
              onChange={(event) => setMemberUsername(event.target.value)}
              placeholder="friend username"
            />
            <button className="icon-action" disabled={isBusy || !selectedBudget} type="submit" aria-label="Add member">
              <Plus size={16} />
            </button>
          </form>
          <p className="quiet-copy">No email verification. The username is enough for this beta.</p>
        </section>

        <section className="side-section">
          <div className="section-title">
            <ArrowRight size={16} />
            <h2>Shared identities</h2>
          </div>
          <div className="identity-stack">
            {dashboard.identityLinks.length === 0 ? (
              <p className="quiet-copy">Add the same account to multiple budgets to consolidate balances.</p>
            ) : (
              dashboard.identityLinks.map((link) => (
                <div className="identity-link" key={link.id}>
                  <strong>{link.canonicalName}</strong>
                  <span>{link.personIds.length} budget profiles linked by account</span>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="sidebar-actions">
          <button className="secondary-action dark" disabled={isBusy} type="button" onClick={() => void loadDashboard()}>
            <RefreshCw size={15} />
            Refresh
          </button>
          <button className="secondary-action dark" type="button" onClick={signOut}>
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      <section className="workspace" aria-label="Budget workspace">
        <header className="topbar">
          <div>
            <p className="screen-label">Active budget</p>
            <h1>{selectedBudget?.name ?? 'Create a budget'}</h1>
          </div>
          <div className="topbar-metric">
            <span>{selectedExpenses.length}</span>
            <small>expenses</small>
          </div>
        </header>

        {notice ? <p className="notice inline">{notice}</p> : null}

        {selectedBudget ? (
          <>
            <section className="entry-panel" aria-label="Add expense">
              <div className="panel-heading">
                <Receipt size={18} />
                <h2>Add an expense</h2>
              </div>
              <form className="expense-form" onSubmit={submitExpense}>
                <label>
                  Description
                  <input
                    value={expenseForm.description}
                    onChange={(event) =>
                      setExpenseForm((current) => ({ ...current, description: event.target.value }))
                    }
                    placeholder="Dinner, rent, train tickets"
                  />
                </label>
                <label>
                  Amount
                  <input
                    inputMode="decimal"
                    value={expenseForm.amount}
                    onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))}
                    placeholder="0.00"
                  />
                </label>
                <label>
                  Paid by
                  <select
                    value={expenseForm.paidByUserId}
                    onChange={(event) =>
                      setExpenseForm((current) => ({ ...current, paidByUserId: event.target.value }))
                    }
                  >
                    {selectedPeople.map((person) => (
                      <option key={person.id} value={person.userId}>
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
                          checked={expenseForm.participantUserIds.includes(person.userId)}
                          onChange={() => toggleParticipant(person.userId)}
                          type="checkbox"
                        />
                        <span>{person.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <button className="primary-action" disabled={isBusy} type="submit">
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
                {selectedExpenses.length === 0 ? (
                  <p className="empty-state">No expenses yet. Add the first one above.</p>
                ) : (
                  selectedExpenses.map((expense) => (
                    <article className="ledger-row" key={expense.id}>
                      <div>
                        <strong>{expense.description}</strong>
                        <span>
                          Paid by {getUserName(selectedPeople, expense.paidByUserId)} for{' '}
                          {expense.participantUserIds.map((userId) => getUserName(selectedPeople, userId)).join(', ')}
                        </span>
                      </div>
                      <b>{formatMoney(expense.amountCents)}</b>
                    </article>
                  ))
                )}
              </div>
            </section>
          </>
        ) : (
          <section className="entry-panel">
            <p className="empty-state">Create a budget, then add your friend by username.</p>
          </section>
        )}
      </section>

      <aside className="settlement-panel" aria-label="Global balances">
        <div className="settlement-header">
          <p className="screen-label">Across your budgets</p>
          <h2>Who owes who</h2>
          <span>Accounts are explicit shared identities. Add the same user to multiple budgets to merge them.</span>
        </div>

        <section className="balance-list">
          {dashboard.settlement.balancesByIdentity.length === 0 ? (
            <p className="empty-state">No open balance yet.</p>
          ) : (
            dashboard.settlement.balancesByIdentity.map((balance) => (
              <div className="balance-row" key={balance.identityId}>
                <div>
                  <strong>{balance.label}</strong>
                  <span>
                    {balance.personIds.length > 1 ? `${balance.personIds.length} linked budget profiles` : 'single profile'}
                  </span>
                </div>
                <b className={balance.balanceCents >= 0 ? 'positive' : 'negative'}>
                  {formatMoney(balance.balanceCents)}
                </b>
              </div>
            ))
          )}
        </section>

        <section className="settlement-list">
          <h3>Suggested settlements</h3>
          {dashboard.settlement.settlements.length === 0 ? (
            <p className="empty-state">Nothing to settle.</p>
          ) : (
            dashboard.settlement.settlements.map((item) => (
              <article className="settlement-row" key={`${item.fromIdentityId}-${item.toIdentityId}-${item.amountCents}`}>
                <div>
                  <strong>{item.fromLabel}</strong>
                  <span>pays {item.toLabel}</span>
                </div>
                <b>{formatMoney(item.amountCents)}</b>
              </article>
            ))
          )}
        </section>
      </aside>
    </main>
  );
}

async function apiRequest<T>(path: string, options: { token?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.body ? 'POST' : 'GET',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Request failed');
  }

  return payload as T;
}

function getUserName(people: AppPerson[], userId: string): string {
  return people.find((person) => person.userId === userId)?.name ?? 'Unknown';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}
