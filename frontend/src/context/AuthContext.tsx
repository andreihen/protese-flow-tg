import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

interface User {
  id: number;
  username: string;
  email: string;
  role: 'DENTISTA' | 'OPERADOR' | 'GESTOR' | 'ADMIN';
  cro: string | null;
  telefone: string | null;
  is_active: boolean;
  cadastro_confirmado: boolean;
  first_name?: string;
  is_superuser?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  updateUser: (updatedFields: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);


export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_profile');
    setUser(null);
  };

  const fetchUserProfile = async (username: string) => {
    try {
      const response = await api.get<User[]>('/usuarios/');
      // Filter list to find current user (Dentist will only get their own profile anyway)
      const currentUser = response.data.find(
        (u) => u.username.toLowerCase() === username.toLowerCase()
      );
      if (currentUser) {
        setUser(currentUser);
        localStorage.setItem('user_profile', JSON.stringify(currentUser));
      } else if (response.data.length > 0) {
        // Fallback to first user in list if exact match is not found
        setUser(response.data[0]);
        localStorage.setItem('user_profile', JSON.stringify(response.data[0]));
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      logout();
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const accessToken = localStorage.getItem('access_token');
      const cachedProfile = localStorage.getItem('user_profile');

      if (accessToken && cachedProfile) {
        try {
          const parsed = JSON.parse(cachedProfile) as User;
          setUser(parsed);
          // Async background refresh of the user profile
          fetchUserProfile(parsed.username);
        } catch {
          logout();
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const response = await api.post('/token/', { username, password });
    const { access, refresh } = response.data;

    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);

    await fetchUserProfile(username);
  };

  const updateUser = (updatedFields: Partial<User>) => {
    if (user) {
      const updated = { ...user, ...updatedFields };
      setUser(updated);
      localStorage.setItem('user_profile', JSON.stringify(updated));
    }
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};


export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
