import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import LandingPage from './LandingPage';
import LoginPage   from './LoginPage';
import SignUpPage  from './SignUpPage';
import App         from './App';
import { supabase } from './lib/supabase';
import './index.css';

// page: 'landing' | 'login' | 'signup' | 'app' | 'loading'
function Root() {
  const [page, setPage] = useState('loading'); // wait for session check

  useEffect(() => {
    if (!supabase) {
      // Supabase not configured — go straight to landing
      setPage('landing');
      return;
    }

    // Check current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setPage(session ? 'app' : 'landing');
    });

    // Keep page in sync when auth state changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setPage('app');
      } else {
        // Only redirect away from app/protected pages on sign-out
        setPage(prev => (prev === 'app' ? 'landing' : prev));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (page === 'loading') {
    // Minimal full-screen loader while session is being checked
    return (
      <div style={{
        minHeight: '100vh', background: '#0D0A08',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: '#F5D5B8', fontFamily: 'serif', fontSize: '18px', opacity: 0.6 }}>
          VentureScope
        </span>
      </div>
    );
  }

  if (page === 'app')    return <App />;
  if (page === 'signup') return (
    <SignUpPage
      onSuccess={() => setPage('app')}
      onBack={()    => setPage('login')}
    />
  );
  if (page === 'login')  return (
    <LoginPage
      onLogin={()          => setPage('app')}
      onBack={()           => setPage('landing')}
      onRequestAccess={()  => setPage('signup')}
    />
  );
  // landing
  return (
    <LandingPage
      onLogin={()     => setPage('login')}
      onSignUp={()    => setPage('signup')}
      onEnterApp={()  => setPage('login')}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);