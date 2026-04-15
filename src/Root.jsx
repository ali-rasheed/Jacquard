/**
 * Root — Renders the unified App (Weaving  Image Rects).
 * Mode switch lives inside App; V1 logic unchanged when Weaving is selected.
 * Error boundary surfaces render errors (e.g. in production build) instead of a black screen.
 */
import { Component } from 'react';
import App from './App.jsx';
import { AppTooltipProvider } from './components/ui/AppTooltipProvider.jsx';

class RootErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100dvh',
          padding: 24,
          background: '#0d0d0d',
          color: '#ff453a',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 13,
          whiteSpace: 'pre-wrap',
          overflow: 'auto',
        }}>
          <strong>Render error</strong>
          <pre style={{ marginTop: 8 }}>{this.state.error?.message}</pre>
          <pre style={{ marginTop: 8, color: '#a1a1a1' }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Root() {
  return (
    <RootErrorBoundary>
      <AppTooltipProvider>
        <App />
      </AppTooltipProvider>
    </RootErrorBoundary>
  );
}
