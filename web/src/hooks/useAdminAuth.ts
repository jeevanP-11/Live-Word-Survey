import { useCallback, useState } from 'react';

const STORAGE_KEY = 'survey_admin_token';

export function useAdminAuth() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(STORAGE_KEY));

  const login = useCallback((newToken: string) => {
    sessionStorage.setItem(STORAGE_KEY, newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setToken(null);
  }, []);

  return { token, login, logout, isAuthenticated: Boolean(token) };
}
