import React, {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Error Boundary để tránh trắng màn hình
interface EBState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, EBState> {
  state: EBState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        style: {
          minHeight: '100vh', display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: '#0f172a', color: 'white',
          fontFamily: 'system-ui', padding: '2rem'
        }
      },
        React.createElement('div', { style: { maxWidth: 500, textAlign: 'center' as const } },
          React.createElement('h1', { style: { fontSize: '2rem', marginBottom: '1rem' } }, '⚠️ Có lỗi xảy ra'),
          React.createElement('p', { style: { color: '#94a3b8', marginBottom: '1rem' } },
            this.state.error?.message || 'Lỗi không xác định'),
          React.createElement('pre', {
            style: { background: '#1e293b', padding: '1rem', borderRadius: '0.75rem',
              fontSize: '0.75rem', textAlign: 'left' as const, overflow: 'auto',
              maxHeight: '200px', color: '#f87171' }
          }, this.state.error?.stack),
          React.createElement('button', {
            onClick: () => {
              localStorage.removeItem('edumanage_role');
              localStorage.removeItem('edumanage_room_code');
              window.location.reload();
            },
            style: { marginTop: '1.5rem', padding: '0.75rem 2rem', background: '#3b82f6',
              color: 'white', border: 'none', borderRadius: '0.75rem', fontSize: '1rem',
              fontWeight: 'bold', cursor: 'pointer' }
          }, '🔄 Đăng xuất & Thử lại')
        )
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
