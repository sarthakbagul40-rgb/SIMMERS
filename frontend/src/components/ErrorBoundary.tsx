import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log full error details & stack trace to console for server-side / developer debugging
    console.error('[Global ErrorBoundary] Uncaught application exception:', error);
    console.error('[Global ErrorBoundary] Component stack trace:', errorInfo.componentStack);
  }

  public handleReload = () => {
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100dvh',
          width: '100vw',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#090d16',
          color: '#f8fafc',
          padding: '24px',
          boxSizing: 'border-box',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🍲</div>
          <h2 style={{ fontSize: '22px', fontWeight: 900, margin: '0 0 8px 0', color: '#60a5fa' }}>
            Oops! Something went wrong
          </h2>
          <p style={{ fontSize: '14px', color: '#94a3b8', maxWidth: '320px', margin: '0 0 24px 0', lineHeight: 1.5 }}>
            Don't worry, your pantry data is safe. Tap below to reload the app.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '14px 28px',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '16px',
              fontWeight: 800,
              fontSize: '15px',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4)'
            }}
          >
            🔄 Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
