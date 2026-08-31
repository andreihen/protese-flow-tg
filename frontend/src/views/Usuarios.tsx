import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { UserCheck, UserX, AlertCircle, Plus, Edit2 } from 'lucide-react';

interface Usuario {
  id: number;
  username: string;
  email: string;
  role: 'DENTISTA' | 'OPERADOR' | 'GESTOR' | 'ADMIN';
  is_active: boolean;
  cadastro_confirmado: boolean;
  telefone: string | null;
  cro: string | null;
}

const Usuarios: React.FC = () => {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showForm, setShowForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'DENTISTA',
    telefone: '',
    cro: ''
  });

  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      const response = await api.get<Usuario[]>('/usuarios/');
      setUsuarios(response.data);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao buscar usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const toggleStatus = async (id: number, currentStatus: boolean, role: string) => {
    if (id === user?.id) {
      alert('Você não pode bloquear sua própria conta!');
      return;
    }
    if (role === 'ADMIN') {
      alert('Contas de Administrador não podem ser bloqueadas nesta tela para evitar perdas de acesso.');
      return;
    }

    try {
      await api.patch(`/usuarios/${id}/`, { is_active: !currentStatus });
      fetchUsuarios();
    } catch (err) {
      console.error('Erro ao alterar status:', err);
      alert('Erro ao alterar status do usuário.');
    }
  };

  const handleOpenNew = () => {
    setEditingUserId(null);
    setFormData({ username: '', email: '', password: '', role: 'DENTISTA', telefone: '', cro: '' });
    setShowForm(true);
  };

  const handleOpenEdit = (u: Usuario) => {
    setEditingUserId(u.id);
    setFormData({
      username: u.username,
      email: u.email,
      password: '', // leave empty so it won't update unless typed
      role: u.role,
      telefone: u.telefone || '',
      cro: u.cro || ''
    });
    setShowForm(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.role === 'DENTISTA' && !formData.cro) {
      alert('O registro do CRO é obrigatório para cadastrar/editar dentistas.');
      return;
    }

    try {
      if (editingUserId) {
        // Editing existing user
        const updateData: any = { ...formData };
        if (!updateData.password) {
          delete updateData.password; // Do not overwrite password if empty
        }
        await api.patch(`/usuarios/${editingUserId}/`, updateData);
      } else {
        // Creating new user
        if (!formData.password) {
          alert('Senha é obrigatória para criar uma nova conta.');
          return;
        }
        await api.post('/usuarios/', formData);
      }
      
      setShowForm(false);
      setEditingUserId(null);
      setFormData({ username: '', email: '', password: '', role: 'DENTISTA', telefone: '', cro: '' });
      fetchUsuarios();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.cro?.[0] || err.response?.data?.username?.[0] || 'Erro ao salvar usuário.');
    }
  };

  if (user?.role !== 'GESTOR' && user?.role !== 'ADMIN') {
    return (
      <div style={{ textAlign: 'center', padding: '100px', color: 'var(--status-rework)' }}>
        <AlertCircle size={48} style={{ margin: '0 auto 15px' }} />
        <h2>Acesso Negado</h2>
        <p>Você não tem permissão para gerenciar usuários.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', margin: 0, fontWeight: 600 }}>Gerenciamento de Usuários</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '4px' }}>
            Crie novos perfis, edite informações e controle acessos.
          </p>
        </div>
        {!showForm && (
          <button onClick={handleOpenNew} className="btn btn-primary">
            <Plus size={18} />
            <span>Novo Usuário</span>
          </button>
        )}
      </div>

      {showForm && (
        <div className="glass-card animate-fade-in" style={{ padding: '30px', borderLeft: `4px solid ${editingUserId ? 'var(--primary-blue)' : 'var(--primary-cyan)'}` }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '20px' }}>
            {editingUserId ? 'Editar Usuário' : 'Cadastrar Novo Profissional'}
          </h2>
          <form onSubmit={handleSaveUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            
            <div className="form-group">
              <label className="form-label">Nome de Usuário (Login)</label>
              <input type="text" required className="form-control" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
            </div>

            <div className="form-group">
              <label className="form-label">E-mail</label>
              <input type="email" required className="form-control" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>

            <div className="form-group">
              <label className="form-label">Senha {editingUserId ? '(Deixe em branco para manter a atual)' : 'Padrão'}</label>
              <input type="password" minLength={8} required={!editingUserId} className="form-control" placeholder={editingUserId ? "••••••••" : ""} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            </div>

            <div className="form-group">
              <label className="form-label">Perfil de Acesso {editingUserId && '(Não alterável)'}</label>
              <select className="form-control" disabled={!!editingUserId} value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                <option value="DENTISTA">Dentista (Cliente)</option>
                <option value="OPERADOR">Operador CAD (Laboratório)</option>
                <option value="GESTOR">Gestor (Recepção/Triagem)</option>
                {user.role === 'ADMIN' && <option value="ADMIN">Administrador Geral</option>}
              </select>
            </div>

            {formData.role === 'DENTISTA' ? (
              <div className="form-group">
                <label className="form-label">CRO (Obrigatório)</label>
                <input type="text" required className="form-control" placeholder="Ex: 12345-SP" value={formData.cro} onChange={e => setFormData({...formData, cro: e.target.value})} />
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Telefone (Opcional)</label>
                <input type="text" className="form-control" value={formData.telefone} onChange={e => setFormData({...formData, telefone: e.target.value})} />
              </div>
            )}

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
              <button type="button" onClick={() => { setShowForm(false); setEditingUserId(null); }} className="btn btn-secondary" style={{ padding: '10px 24px' }}>
                Voltar
              </button>
              <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px' }}>
                {editingUserId ? 'Salvar Alterações' : 'Cadastrar Conta'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-card" style={{ padding: '30px' }}>
        {error && <div style={{ color: 'var(--status-rework)', marginBottom: '20px' }}>{error}</div>}
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Carregando...</div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Usuário</th>
                  <th>E-mail</th>
                  <th>Perfil (Role)</th>
                  <th>CRO / Telefone</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => {
                  const isBlockedButton = u.id === user?.id || u.role === 'ADMIN';
                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600, color: 'var(--primary-cyan)' }}>#{u.id}</td>
                      <td style={{ fontWeight: 500 }}>{u.username}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                      <td>
                        <span className={`badge ${u.role === 'GESTOR' || u.role === 'ADMIN' ? 'badge-production' : u.role === 'DENTISTA' ? 'badge-pending' : 'badge-completed'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        {u.role === 'DENTISTA' ? (u.cro || 'Não inf.') : (u.telefone || '-')}
                      </td>
                      <td>
                        {u.is_active ? (
                          <span style={{ color: 'var(--status-approved)', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem', fontWeight: 500 }}>
                            <UserCheck size={16} /> Ativo
                          </span>
                        ) : (
                          <span style={{ color: 'var(--status-rework)', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem', fontWeight: 500 }}>
                            <UserX size={16} /> Inativo
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                          title="Editar Cadastro"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => toggleStatus(u.id, u.is_active, u.role)}
                          disabled={isBlockedButton}
                          className={`btn ${u.is_active ? 'btn-danger' : 'btn-primary'}`}
                          style={{ padding: '6px 12px', fontSize: '0.85rem', opacity: isBlockedButton ? 0.4 : 1, cursor: isBlockedButton ? 'not-allowed' : 'pointer' }}
                          title={isBlockedButton ? "Contas de administrador ou a sua própria conta não podem ser alteradas aqui." : "Alterar Status"}
                        >
                          {u.is_active ? 'Bloquear' : 'Ativar'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Usuarios;
