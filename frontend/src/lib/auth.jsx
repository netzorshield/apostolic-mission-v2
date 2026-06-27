import { createContext, useContext, useEffect, useState } from "react";
import { api, clearStoredSession, getStoredToken, setStoredToken } from "./api";

const AuthContext = createContext(null);

async function wipeSession() {
  clearStoredSession();
  try {
    await api.logout();
  } catch {
    /* ignore — logout clears legacy cookies without requiring a token */
  }
}

function purgeLegacyOnLoad() {
  try {
    localStorage.removeItem("iam_token");
    localStorage.removeItem("iam_remember");
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    purgeLegacyOnLoad();
    if (!getStoredToken()) {
      api.logout().catch(() => {});
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => {
        clearStoredSession();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    await wipeSession();
    const data = await api.login(email, password);
    if (data.user?.email?.toLowerCase() !== email.trim().toLowerCase()) {
      await wipeSession();
      throw new Error("Sign-in session mismatch. Please try again.");
    }
    setStoredToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (email, password, name) => {
    await wipeSession();
    const data = await api.register(email, password, name);
    setStoredToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await wipeSession();
    setUser(null);
    window.location.replace("/");
  };

  const refreshUser = async () => {
    const me = await api.me();
    setUser(me);
    return me;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
        isAdmin: user?.role === "admin",
        isApprovedMember: Boolean(
          user?.role === "member" &&
            user?.enrollment_complete &&
            user?.member_id &&
            user?.status === "active"
        ),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
