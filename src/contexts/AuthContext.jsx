import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);

function readSessionFromStorage() {
  return {
    isLoggedIn: localStorage.getItem('isLoggedIn') === 'true',
    userId: localStorage.getItem('userId') || '',
    userRole: localStorage.getItem('userRole') || 'customer',
    userName: localStorage.getItem('userName') || 'User',
    username: localStorage.getItem('username') || '',
    token: localStorage.getItem('token') || '',
  };
}

function writeSessionToStorage(session) {
  localStorage.setItem('isLoggedIn', session.isLoggedIn ? 'true' : 'false');
  localStorage.setItem('userId', session.userId || '');
  localStorage.setItem('userRole', session.userRole || 'customer');
  localStorage.setItem('userName', session.userName || 'User');
  localStorage.setItem('username', session.username || '');

  if (session.token) {
    localStorage.setItem('token', session.token);
  } else {
    localStorage.removeItem('token');
  }

  window.dispatchEvent(new Event('auth-session-changed'));
}

function clearSessionStorage() {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('userId');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userName');
  localStorage.removeItem('username');
  localStorage.removeItem('token');
  window.dispatchEvent(new Event('auth-session-changed'));
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSessionFromStorage);

  useEffect(() => {
    const syncFromStorage = () => setSession(readSessionFromStorage());

    window.addEventListener('storage', syncFromStorage);
    window.addEventListener('auth-session-changed', syncFromStorage);

    return () => {
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener('auth-session-changed', syncFromStorage);
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      signIn: (nextSession) => {
        const merged = {
          isLoggedIn: true,
          userId: nextSession?.userId || '',
          userRole: nextSession?.userRole || 'customer',
          userName: nextSession?.userName || 'User',
          username: nextSession?.username || '',
          token: nextSession?.token || '',
        };

        writeSessionToStorage(merged);
        setSession(merged);
      },
      signOut: () => {
        clearSessionStorage();
        setSession({
          isLoggedIn: false,
          userId: '',
          userRole: 'customer',
          userName: 'User',
          username: '',
          token: '',
        });
      },
      refreshSession: () => {
        const next = readSessionFromStorage();
        setSession(next);
        return next;
      },
    }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
