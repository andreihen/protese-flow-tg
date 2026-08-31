import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';

// Views
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import NovoPedido from './views/NovoPedido';
import DetalhesPedido from './views/DetalhesPedido';
import Usuarios from './views/Usuarios';
import Servicos from './views/Servicos';
import HistoricoCasos from './views/HistoricoCasos';
import Configuracoes from './views/Configuracoes';

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-base)',
        color: 'var(--text-muted)'
      }}>
        Iniciando sessão segura...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
};

// Login Route Guard (redirects logged-in users back to dashboard)
const LoginRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null;

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Public auth route */}
        <Route
          path="/login"
          element={
            <LoginRoute>
              <Login />
            </LoginRoute>
          }
        />

        {/* Protected app routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/pedidos/novo"
          element={
            <ProtectedRoute>
              <NovoPedido />
            </ProtectedRoute>
          }
        />

        <Route
          path="/pedidos/:id/editar"
          element={
            <ProtectedRoute>
              <NovoPedido />
            </ProtectedRoute>
          }
        />


        <Route
          path="/pedidos/:id"
          element={
            <ProtectedRoute>
              <DetalhesPedido />
            </ProtectedRoute>
          }
        />

        <Route
          path="/usuarios"
          element={
            <ProtectedRoute>
              <Usuarios />
            </ProtectedRoute>
          }
        />

        <Route
          path="/servicos"
          element={
            <ProtectedRoute>
              <Servicos />
            </ProtectedRoute>
          }
        />

        <Route
          path="/casos"
          element={
            <ProtectedRoute>
              <HistoricoCasos />
            </ProtectedRoute>
          }
        />

        <Route
          path="/configuracoes"
          element={
            <ProtectedRoute>
              <Configuracoes />
            </ProtectedRoute>
          }
        />

        {/* Fallback redirects */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
