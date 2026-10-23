import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { getApiError, resetCsrfToken } from '../services/api.js';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const refreshUser = useCallback(async () => {
    try { const result = await api.get('/auth/me'); setUser(result.data.user); setAuthError(''); return result.data.user; }
    catch (error) { setUser(null); if (error.response?.status !== 401) setAuthError(getApiError(error)); return null; }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refreshUser(); }, [refreshUser]);
  const login = async (values) => { resetCsrfToken(); const result = await api.post('/auth/login', values); setUser(result.data.user); setAuthError(''); return result.data.user; };
  const register = async (values) => { resetCsrfToken(); const result = await api.post('/auth/register', values); setUser(result.data.user); setAuthError(''); return result.data.user; };
  const logout = async () => { try { await api.post('/auth/logout'); } finally { setUser(null); resetCsrfToken(); } };
  const value = useMemo(() => ({ user, loading, authError, login, register, logout, refreshUser }), [user, loading, authError, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
