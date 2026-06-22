import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

// a React context that holds the logged-in user and shares it with the whole app
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // the logged-in user, or null
  const [loading, setLoading] = useState(true); // true while we check the session at startup

  // when the app loads, ask the server who is logged in (to restore the session)
  useEffect(() => {
    let cancelled = false;
    api.me()
      .then(u => { if (!cancelled) setUser(u); })
      .catch(() => { if (!cancelled) setUser(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // log in: call the API, then save the user
  async function login(username, password) {
    const u = await api.login(username, password);
    setUser(u);
    return u;
  }

  // log out: call the API, then clear the user
  async function logout() {
    await api.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// small helper so components can read the user
export function useAuth() {
  return useContext(AuthContext);
}
