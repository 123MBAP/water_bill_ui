import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

export const AuthContext = createContext(null);
const AUTH_CACHE_KEY = 'auth-cache';

function readCachedAuth() {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedAuth(user, profile) {
  try {
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ user, profile }));
  } catch {
    // ignore cache write failures
  }
}

function clearCachedAuth() {
  localStorage.removeItem(AUTH_CACHE_KEY);
}

function isHardAuthFailure(error) {
  return error?.status === 401 || error?.status === 403;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const cachedAuth = readCachedAuth();

    if (cachedAuth?.user) {
      setUser(cachedAuth.user);
      setProfile(cachedAuth.profile || null);
    }

    if (token) {
      api.me()
        .then((data) => {
          setUser(data.user);
          setProfile(data.profile);
          writeCachedAuth(data.user, data.profile);
        })
        .catch((error) => {
          if (isHardAuthFailure(error)) {
            localStorage.removeItem('token');
            clearCachedAuth();
            setUser(null);
            setProfile(null);
          }
        })
        .finally(() => setLoading(false));
    } else {
      if (cachedAuth?.user) {
        setLoading(false);
        return;
      }
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await api.login({ email, password });
    localStorage.setItem('token', data.session.access_token);
    setUser(data.user);
    setProfile(data.profile);
    writeCachedAuth(data.user, data.profile);
    return data;
  };

  const register = async (form) => {
    const data = await api.register(form);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    clearCachedAuth();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    try {
      const data = await api.me();
      setUser(data.user);
      setProfile(data.profile);
      writeCachedAuth(data.user, data.profile);
    } catch {
      // silently ignore
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, register, logout, refreshProfile, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

// useAuth is in ./useAuth.js — keeping it separate prevents Vite Fast Refresh full reloads
