import { Component } from 'react';
import { translate } from '../i18n.js';
import { currentLang } from '../store/i18n.jsx';

// The last line of defence: anything that throws while rendering leaves this
// screen with a way out, rather than a blank page.
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const tt = (key) => translate(currentLang, key);
    return (
      <div className="app-shell">
        <div className="page" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <h1 className="h1">{tt('common.crashTitle')}</h1>
          <p className="sub">{tt('common.crashMsg')}</p>
          <button className="btn btn--primary" style={{ marginTop: 20 }} onClick={() => window.location.reload()}>
            {tt('common.crashReload')}
          </button>
        </div>
      </div>
    );
  }
}
