import { createContext, useContext, useEffect, useState } from "react";
import { loginUser, registerCustomer, fetchCurrentUser, updateMyPhone } from "../api/authApi.js";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    fetchCurrentUser()
      .then((res) => setUser(res.data.user))
      .catch(() => {
        localStorage.removeItem("token");
      })
      .finally(() => setLoading(false));
  }, []);

  const persistSession = (userData, token) => {
    localStorage.setItem("token", token);
    setUser(userData);
  };

  const login = async (email, password) => {
    const res = await loginUser({ email, password });
    persistSession(res.data.user, res.data.token);
    return res.data.user;
  };

  const register = async (name, email, password, phone) => {
    const res = await registerCustomer({ name, email, password, phone });
    persistSession(res.data.user, res.data.token);
    return res.data.user;
  };

  // Saves the customer's phone number and refreshes the signed-in user.
  const updatePhone = async (phone) => {
    const res = await updateMyPhone(phone);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, updatePhone, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
