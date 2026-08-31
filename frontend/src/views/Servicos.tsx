import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Plus, CheckCircle2, XCircle, Edit2, DollarSign, X } from 'lucide-react';

export interface Servico {
  id: number;
  nome: string;
  valor: string;
  ativo: boolean;
  tipo: 'ELEMENTO' | 'ARCADA' | 'BOCA';
  requer_implante: boolean;
  data_criacao?: string;
  data_atualizacao?: string;
}

const Servicos: React.FC = () => {
  const { user } = useAuth();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showForm, setShowForm] = useState(false);
  const [editingServicoId, setEditingServicoId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    nome: '',
    valor: '',
    tipo: 'ELEMENTO',
    requer_implante: false,
    ativo: true
  });

  const fetchServicos = async () => {
    try {
      setLoading(true);
      const response = await api.get<Servico[]>('/servicos/');
      setServicos(response.data);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao buscar serviços.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServicos();
  }, []);

  const toggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      await api.patch(`/servicos/${id}/`, { ativo: !currentStatus });
      fetchServicos();
    } catch (err) {
      console.error('Erro ao alterar status:', err);
      alert('Erro ao alterar status do serviço.');
    }
  };

  const handleOpenNew = () => {
    setEditingServicoId(null);
    setFormData({ nome: '', valor: '', tipo: 'ELEMENTO', requer_implante: false, ativo: true });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenEdit = (s: Servico) => {
    setEditingServicoId(s.id);
    setFormData({
      nome: s.nome,
      valor: s.valor,
      tipo: s.tipo,
      requer_implante: s.requer_implante ?? false,
      ativo: s.ativo
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveServico = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingServicoId) {
        await api.patch(`/servicos/${editingServicoId}/`, formData);
      } else {
        await api.post('/servicos/', formData);
      }
      
      setShowForm(false);
      setEditingServicoId(null);
      setFormData({ nome: '', valor: '', tipo: 'ELEMENTO', requer_implante: false, ativo: true });
      fetchServicos();
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.detail 
        || err.response?.data?.nome?.[0] 
        || err.response?.data?.valor?.[0]
        || err.response?.data?.tipo?.[0]
        || 'Erro ao salvar serviço.';
      alert(msg);
    }
  };

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  const formatTipo = (tipo: string) => {
    switch (tipo) {
      case 'ELEMENTO': return 'Por Dente';
      case 'ARCADA': return 'Por Arcada';
      case 'BOCA': return 'Boca Inteira';
      default: return tipo;
    }
  };

  if (user?.role !== 'GESTOR' && user?.role !== 'ADMIN') {
    return (
      <div style={{ textAlign: 'center', padding: '100px', color: 'var(--status-rework)' }}>
        <AlertCircle size={48} style={{ margin: '0 auto 15px' }} />
        <h2>Acesso Negado</h2>
        <p>Você não tem permissão para gerenciar serviços.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', margin: 0, fontWeight: 600 }}>Tabela de Serviços</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '4px' }}>
            Gerencie os serviços oferecidos, precificação e como são aplicados no pedido.
          </p>
        </div>
        {!showForm && (
          <button onClick={handleOpenNew} className="btn btn-primary">
            <Plus size={18} />
            <span>Novo Serviço</span>
          </button>
        )}
      </div>

      {showForm && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999
          }}
          onClick={() => { setShowForm(false); setEditingServicoId(null); }}
        >
          <div 
            className="glass-card animate-fade-in" 
            style={{ 
              width: '90%',
              maxWidth: '520px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '30px',
              borderLeft: `4px solid ${editingServicoId ? 'var(--primary-blue)' : 'var(--primary-cyan)'}`,
              position: 'relative',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              zIndex: 100000
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 600 }}>
                {editingServicoId ? 'Editar Serviço' : 'Cadastrar Novo Serviço'}
              </h2>
              <button 
                type="button"
                onClick={() => { setShowForm(false); setEditingServicoId(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveServico} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              <div className="form-group">
                <label className="form-label">Nome do Serviço</label>
                <input type="text" required className="form-control" placeholder="Ex: Coroa Sobre Implante" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} />
              </div>

              <div className="form-group">
                <label className="form-label">Valor (R$)</label>
                <div style={{ position: 'relative' }}>
                  <DollarSign size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    required 
                    className="form-control" 
                    style={{ paddingLeft: '35px' }}
                    placeholder="0.00" 
                    value={formData.valor} 
                    onChange={e => setFormData({...formData, valor: e.target.value})} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Tipo de Aplicação no Odontograma</label>
                <select className="form-control" required value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value as any})}>
                  <option value="ELEMENTO">Por Dente / Elemento Único</option>
                  <option value="ARCADA">Por Arcada (Globaliza por Arco)</option>
                  <option value="BOCA">Global / Boca Inteira (ex: Modelo)</option>
                </select>
              </div>

              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  background: 'rgba(255, 255, 255, 0.03)', 
                  padding: '12px 16px', 
                  borderRadius: 'var(--radius-sm)', 
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer' 
                }}
                onClick={() => setFormData({ ...formData, requer_implante: !formData.requer_implante })}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                    Exige Componentes de Implante?
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                    Solicita marca/modelo do implante para os dentes com este serviço.
                  </div>
                </div>
                <input 
                  type="checkbox"
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary-cyan)' }}
                  checked={formData.requer_implante}
                  onChange={e => setFormData({ ...formData, requer_implante: e.target.checked })}
                  onClick={e => e.stopPropagation()}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" onClick={() => { setShowForm(false); setEditingServicoId(null); }} className="btn btn-secondary" style={{ padding: '10px 24px' }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px' }}>
                  {editingServicoId ? 'Salvar Alterações' : 'Cadastrar Serviço'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      <div className="glass-card" style={{ padding: '30px' }}>
        {error && <div style={{ color: 'var(--status-rework)', marginBottom: '20px' }}>{error}</div>}
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Carregando serviços...</div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nome do Serviço</th>
                  <th>Valor</th>
                  <th>Aplicação</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {servicos.map((s) => (
                  <tr key={s.id} style={{ opacity: s.ativo ? 1 : 0.6 }}>
                    <td style={{ fontWeight: 600, color: 'var(--primary-cyan)' }}>#{s.id}</td>
                    <td style={{ fontWeight: 600, color: '#fff' }}>{s.nome}</td>
                    <td style={{ color: 'var(--status-approved)', fontWeight: 600 }}>{formatCurrency(s.valor)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                        <span className="badge badge-production" style={{ background: 'rgba(0, 242, 254, 0.1)', color: 'var(--primary-cyan)', border: '1px solid rgba(0, 242, 254, 0.2)' }}>
                          {formatTipo(s.tipo)}
                        </span>
                        {s.requer_implante && (
                          <span className="badge" style={{ background: 'rgba(127, 90, 240, 0.15)', color: 'var(--accent-purple)', border: '1px solid rgba(127, 90, 240, 0.3)', fontSize: '0.7rem' }}>
                            🔩 Exige Implante
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {s.ativo ? (
                        <span style={{ color: 'var(--status-approved)', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem', fontWeight: 500 }}>
                          <CheckCircle2 size={16} /> Ativo
                        </span>
                      ) : (
                        <span style={{ color: 'var(--status-rework)', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem', fontWeight: 500 }}>
                          <XCircle size={16} /> Inativo
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button 
                          onClick={() => handleOpenEdit(s)}
                          className="btn btn-secondary" 
                          style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                          title="Editar Serviço"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => toggleStatus(s.id, s.ativo)}
                          className="btn" 
                          style={{ 
                            padding: '6px 12px', 
                            fontSize: '0.85rem',
                            background: s.ativo ? 'rgba(231, 76, 60, 0.1)' : 'rgba(46, 204, 113, 0.1)',
                            color: s.ativo ? 'var(--status-rework)' : 'var(--status-approved)',
                            border: `1px solid ${s.ativo ? 'rgba(231, 76, 60, 0.3)' : 'rgba(46, 204, 113, 0.3)'}`
                          }}
                          title={s.ativo ? "Desativar Serviço" : "Reativar Serviço"}
                        >
                          {s.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {servicos.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      Nenhum serviço cadastrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Servicos;
