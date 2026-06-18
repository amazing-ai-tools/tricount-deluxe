import React from 'react';
import ReactDOM from 'react-dom/client';
import { Bug, Rocket, ShieldCheck } from 'lucide-react';
import './styles.css';

const appName = import.meta.env.VITE_APP_NAME || 'New Amazing App';
const appDomain = import.meta.env.VITE_APP_DOMAIN || window.location.hostname;
const bugzeroAppKey = import.meta.env.VITE_BUGZERO_APP_KEY || '';
const bugzeroWidgetUrl =
  import.meta.env.VITE_BUGZERO_WIDGET_URL || 'https://bugzero.amazing-ai.tools/widget.js';

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

function App() {
  React.useEffect(() => {
    ensureBugZeroWidget();
  }, []);

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <Rocket size={16} />
            Static frontend on amazing-ai.tools
          </span>
          <h1>{appName}</h1>
          <p>
            This app was created by BugZero. It is ready for product copy,
            real screens, GitHub Actions deploys, and in-app bug reporting.
          </p>
          <div className="actions">
            <a href={`https://${appDomain}`} className="button primary">
              Open production URL
            </a>
            <a href="https://bugzero.amazing-ai.tools" className="button secondary">
              BugZero dashboard
            </a>
          </div>
        </div>
      </section>

      <section className="status-grid" aria-label="Provisioned capabilities">
        <article>
          <Bug size={22} />
          <h2>BugZero widget</h2>
          <p>Embedded automatically with this app's key.</p>
        </article>
        <article>
          <ShieldCheck size={22} />
          <h2>Azure Static Web Apps</h2>
          <p>Deployed from GitHub Actions on every main branch update.</p>
        </article>
        <article>
          <Rocket size={22} />
          <h2>Amazing Chat ready</h2>
          <p>Your app agent can evolve this template into the product you need.</p>
        </article>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
