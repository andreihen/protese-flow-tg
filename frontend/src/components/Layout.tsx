import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, FilePlus, Users, LogOut, Activity, Database, Settings } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return <>{children}</>;

  const menuItems = [
    {
      label: 'Painel Principal',
      path: '/dashboard',
      icon: <LayoutDashboard size={20} />,
      roles: ['DENTISTA', 'OPERADOR', 'GESTOR', 'ADMIN'],
    },
    {
      label: 'Todos os Casos',
      path: '/casos',
      icon: <Database size={20} />,
      roles: ['DENTISTA', 'OPERADOR', 'GESTOR', 'ADMIN'],
    },
    {
      label: 'Novo Pedido',
      path: '/pedidos/novo',
      icon: <FilePlus size={20} />,
      roles: ['DENTISTA'],
    },
    {
      label: 'Gerenciar Usuários',
      path: '/usuarios',
      icon: <Users size={20} />,
      roles: ['GESTOR', 'ADMIN'],
    },
    {
      label: 'Serviços e Valores',
      path: '/servicos',
      icon: <Database size={20} />,
      roles: ['GESTOR', 'ADMIN'],
    },
    {
      label: 'Configurações',
      path: '/configuracoes',
      icon: <Settings size={20} />,
      roles: ['DENTISTA', 'OPERADOR', 'GESTOR', 'ADMIN'],
    },

  ];

  const filteredMenu = menuItems.filter(
    (item) => item.roles.includes(user.role || '') || user.role === 'ADMIN'
  );

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div>
          <div className="sidebar-logo">
            <Activity size={26} color="var(--primary-cyan)" />
            <span>Cadify</span>
          </div>

          <nav>
            <ul className="sidebar-menu">
              {filteredMenu.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <li key={item.path}>
                    <button
                      onClick={() => navigate(item.path)}
                      className={`sidebar-link ${isActive ? 'active' : ''}`}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        width: '100%',
                        textAlign: 'left',
                      }}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="user-profile-summary">
            <div className="user-avatar">
              {user.first_name ? user.first_name[0].toUpperCase() : user.username[0].toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-name">{user.first_name || user.username}</span>
              <span className="user-role">
                {user.role ? (user.role.charAt(0) + user.role.slice(1).toLowerCase()) : 'Usuário'}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="sidebar-link"
            style={{
              background: 'transparent',
              border: 'none',
              width: '100%',
              textAlign: 'left',
              color: 'var(--status-rework)',
            }}
          >
            <LogOut size={20} />
            <span>Sair da Conta</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="animate-fade-in">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
