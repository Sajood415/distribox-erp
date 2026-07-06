import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);
const SESSION_KEY = "distribox_session";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      const savedToken = localStorage.getItem(SESSION_KEY);
      if (!savedToken) {
        setLoading(false);
        return;
      }

      window.api.session.setToken(savedToken);
      const result = await window.api.auth.validate(savedToken);
      if (result.success) {
        setToken(savedToken);
        setUser(result.data.user);
      } else {
        localStorage.removeItem(SESSION_KEY);
        window.api.session.setToken(null);
      }
      setLoading(false);
    }

    restoreSession();
  }, []);

  async function login(username, password) {
    const result = await window.api.auth.login({ username, password });
    if (!result.success) {
      return result;
    }

    const sessionToken = result.data.token;
    localStorage.setItem(SESSION_KEY, sessionToken);
    window.api.session.setToken(sessionToken);
    setToken(sessionToken);
    setUser(result.data.user);
    return result;
  }

  async function logout() {
    if (token) {
      await window.api.auth.logout(token);
    }
    localStorage.removeItem(SESSION_KEY);
    window.api.session.setToken(null);
    setToken(null);
    setUser(null);
  }

  async function selectCompany(companyId) {
    const result = await window.api.company.select({ companyId });

    if (result.success) {
      setUser((current) => ({
        ...current,
        companyId: result.data.id,
        company: {
          id: result.data.id,
          name: result.data.name,
          code: result.data.code,
        },
      }));
    }

    return result;
  }

  const value = useMemo(
    () => ({ user, token, loading, login, logout, selectCompany }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
