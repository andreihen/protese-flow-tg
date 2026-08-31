import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { API_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Download, Upload, AlertCircle, CheckCircle, Calendar, FileText, UserCog, Clock } from 'lucide-react';

interface Anexo {
  id: number;
  arquivo: string;
  descricao: string;
  uploaded_at: string;
}

interface Historico {
  id: number;
  usuario_nome: string;
  status_anterior: string | null;
  status_novo: string;
  motivo_retrabalho: string | null;
  detalhes_alteracao: string | null;
  data_transicao: string;
}

interface Pedido {
  id: number;
  nome_paciente: string;
  dentista: number;
  dentista_nome: string;
  operador: number | null;
  operador_nome: string | null;
  tipo_servico: string;
  cor: string;
  sexo: 'M' | 'F';
  status: 'PENDENTE' | 'INICIADO' | 'RETRABALHO_OPERADOR' | 'RETRABALHO_CLIENTE' | 'EM_APROVACAO' | 'FINALIZADO' | 'CANCELADO';
  data_criacao: string;
  data_conclusao: string | null;
  prazo_original: string | null;
  prazo_ajustado: string | null;
  observacoes: string | null;
  dentes: string;
  elementos: string;
  componentes_implante: string | null;
  arquivo_entregavel: string | null;
  anexos: Anexo[];
  urgente: boolean;
  updated_at: string;
}

interface Usuario {
  id: number;
  username: string;
  first_name: string;
}

const DetalhesPedido: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [historico, setHistorico] = useState<Historico[]>([]);
  const [operadores, setOperadores] = useState<Usuario[]>([]);
  const [selectedOperador, setSelectedOperador] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states for actions
  const [motivoRework, setMotivoRework] = useState('');
  const [showReworkForm, setShowReworkForm] = useState(false);
  const [entregavelFile, setEntregavelFile] = useState<File | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setConflictError(false);
      const [resPedido, resHistorico] = await Promise.all([
        api.get<Pedido>(`/pedidos/${id}/`),
        api.get<Historico[]>(`/pedidos/${id}/historico/`)
      ]);
      setPedido(resPedido.data);
      setHistorico(resHistorico.data);

      if (user?.role === 'GESTOR' || user?.is_superuser) {
        const resUsers = await api.get<Usuario[]>('/usuarios/');
        // We assume fetching all users here, you could filter by role='OPERADOR' in backend if needed
        setOperadores(resUsers.data);
      }
    } catch (err: any) {
      console.error(err);
      setError('Falha ao carregar detalhes do caso.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, user]);

  const handleActionError = (err: any) => {
    if (err.response?.status === 409) {
      setConflictError(true);
      setError('Este caso foi modificado desde a sua última leitura. Atualizando dados...');
      setTimeout(() => {
        fetchData();
        setError(null);
      }, 3000);
    } else {
      setError(err.response?.data?.error || 'Erro ao processar a ação.');
    }
  };

  const handleAtribuirOperador = async () => {
    if (!pedido || !selectedOperador) return;
    setActionLoading(true);
    try {
      await api.post(`/pedidos/${pedido.id}/atribuir_operador/`, {
        operador_id: selectedOperador,
        updated_at: pedido.updated_at
      });
      await fetchData();
    } catch (err) {
      handleActionError(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleIniciarProducao = async () => {
    if (!pedido) return;
    setActionLoading(true);
    try {
      await api.post(`/pedidos/${pedido.id}/iniciar_producao/`, { updated_at: pedido.updated_at });
      await fetchData();
    } catch (err) {
      handleActionError(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalizarCaso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pedido || !entregavelFile) return;
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('arquivo_entregavel', entregavelFile);
      formData.append('updated_at', pedido.updated_at);
      await api.post(`/pedidos/${pedido.id}/finalizar_caso/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEntregavelFile(null);
      await fetchData();
    } catch (err) {
      handleActionError(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAprovarCaso = async () => {
    if (!pedido) return;
    setActionLoading(true);
    try {
      await api.post(`/pedidos/${pedido.id}/aprovar_caso/`, { updated_at: pedido.updated_at });
      await fetchData();
    } catch (err) {
      handleActionError(err);
    } finally {
      setActionLoading(false);
    }
  };


  const handleSolicitarRetrabalho = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pedido || !motivoRework) return;
    setActionLoading(true);
    try {
      await api.post(`/pedidos/${pedido.id}/solicitar_retrabalho/`, {
        motivo_retrabalho: motivoRework,
        updated_at: pedido.updated_at
      });
      setShowReworkForm(false);
      setMotivoRework('');
      await fetchData();
    } catch (err) {
      handleActionError(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSolicitarRetrabalhoCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pedido || !motivoRework) return;
    setActionLoading(true);
    try {
      await api.post(`/pedidos/${pedido.id}/solicitar_retrabalho_cliente/`, {
        motivo_retrabalho: motivoRework,
        updated_at: pedido.updated_at
      });
      setShowReworkForm(false);
      setMotivoRework('');
      await fetchData();
    } catch (err) {
      handleActionError(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelarCaso = async () => {
    if (!pedido) return;
    if (!window.confirm("Tem certeza de que deseja cancelar esta ordem de serviço? Esta ação não pode ser desfeita.")) return;
    setActionLoading(true);
    try {
      await api.post(`/pedidos/${pedido.id}/cancelar_caso/`, { updated_at: pedido.updated_at });
      navigate('/dashboard');
    } catch (err) {
      handleActionError(err);
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '100px', color: 'var(--text-muted)' }}>Carregando dados do pedido...</div>;
  }

  if (!pedido) {
    return (
      <div className="glass-card" style={{ padding: '30px', textAlign: 'center' }}>
        <AlertCircle size={48} color="var(--status-rework)" style={{ margin: '0 auto 15px' }} />
        <h2 style={{ marginBottom: '10px' }}>Ocorreu um erro</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>{error || 'Pedido não encontrado.'}</p>
        <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">
          Voltar ao Painel
        </button>
      </div>
    );
  }

  // Parse elements JSON
  let elementos: Record<string, string> = {};
  try {
    elementos = JSON.parse(pedido.elementos || '{}');
  } catch (e) {
    console.error('Falha ao parsear elementos JSON:', e);
  }
  const selectedTeeth = Object.keys(elementos).map(Number).sort((a, b) => a - b);

  // Parse componentes_implante JSON
  let componentesImplanteList: Array<{ dentes: number[]; marcaModelo: string }> = [];
  if (pedido.componentes_implante) {
    try {
      const parsed = JSON.parse(pedido.componentes_implante);
      if (Array.isArray(parsed)) {
        componentesImplanteList = parsed.filter(c => (c.dentes && c.dentes.length > 0) || (c.marcaModelo && c.marcaModelo.trim() !== ''));
      }
    } catch (e) {
      console.error('Falha ao parsear componentes_implante:', e);
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDENTE: 'Pendente',
      INICIADO: 'Iniciado',
      RETRABALHO_OPERADOR: 'Retrabalho Operador',
      RETRABALHO_CLIENTE: 'Retrabalho Cliente',
      EM_APROVACAO: 'Em Aprovação',
      FINALIZADO: 'Finalizado',
      CANCELADO: 'Cancelado',
    };
    return labels[status] || status;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

      {conflictError && (
        <div style={{
          padding: '15px 20px', background: 'rgba(231, 76, 60, 0.15)', border: '1px solid var(--status-rework)',
          borderRadius: '8px', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <AlertCircle size={20} color="var(--status-rework)" />
          <span>{error}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => navigate('/dashboard')} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: '1.8rem', margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              Caso #{pedido.id} - {pedido.nome_paciente}
              {pedido.urgente && (
                <span className="badge badge-rework" style={{
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  boxShadow: '0 0 10px var(--status-rework)',
                  backgroundColor: 'var(--status-rework)',
                  color: '#fff',
                  fontWeight: 700
                }}>
                  🚨 URGENTE
                </span>
              )}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
              Criado em {new Date(pedido.data_criacao).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          {(pedido.status === 'PENDENTE' || pedido.status === 'RETRABALHO_CLIENTE') &&
            (user?.role === 'GESTOR' || user?.is_superuser || pedido.dentista === user?.id) && (
              <button
                onClick={() => navigate(`/pedidos/${pedido.id}/editar`)}
                className="btn btn-primary"
                style={{
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>Editar Caso</span>
              </button>
            )}

          {pedido.status !== 'FINALIZADO' && pedido.status !== 'CANCELADO' &&
            (user?.role === 'GESTOR' || user?.is_superuser || pedido.dentista === user?.id) && (
              <button
                onClick={handleCancelarCaso}
                className="btn"
                disabled={actionLoading}
                style={{
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderColor: 'var(--status-rework)',
                  color: 'var(--status-rework)',
                  background: 'rgba(231, 76, 60, 0.08)',
                  border: '1px solid',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(231, 76, 60, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(231, 76, 60, 0.08)';
                }}
              >
                <span>Cancelar Caso</span>
              </button>
            )}

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Status Atual:</span>
            <span style={{ fontWeight: 600, color: 'var(--primary-cyan)' }}>{getStatusLabel(pedido.status)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>

        {/* Clincal Case Details Card */}
        <div className="glass-card" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--primary-cyan)' }}>Dados Clínicos</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Paciente</span>
              <p style={{ fontWeight: 500, marginTop: '2px' }}>{pedido.nome_paciente} ({pedido.sexo === 'M' ? 'Masc' : 'Fem'})</p>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Dentista</span>
              <p style={{ fontWeight: 500, marginTop: '2px' }}>{pedido.dentista_nome}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tipo de Serviço</span>
              <p style={{ fontWeight: 500, marginTop: '2px' }}>{pedido.tipo_servico}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}></span>
              <p style={{ fontWeight: 600, color: 'var(--primary-blue)', marginTop: '2px' }}></p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Prazo de Entrega</span>
              <p style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <Calendar size={14} color="var(--text-muted)" />
                {pedido.prazo_ajustado || pedido.prazo_original ? new Date(pedido.prazo_ajustado || pedido.prazo_original || '').toLocaleDateString('pt-BR') : 'Não agendada'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Operador Responsável</span>
              <p style={{ fontWeight: 500, marginTop: '2px', color: pedido.operador_nome ? 'var(--text-main)' : 'var(--status-pending)' }}>
                {pedido.operador_nome || 'Aguardando atribuição'}
              </p>
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Dentes Selecionados</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
              {selectedTeeth.map((tooth) => (
                <span
                  key={tooth}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(0, 242, 254, 0.12)',
                    color: 'var(--primary-cyan)',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    border: '1px solid rgba(0, 242, 254, 0.2)',
                  }}
                >
                  {tooth}
                </span>
              ))}
            </div>
          </div>

          {componentesImplanteList.length > 0 && (
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Componentes de Implante
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                {componentesImplanteList.map((comp, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dentes:</span>
                      {comp.dentes && comp.dentes.length > 0 ? (
                        comp.dentes.map(t => (
                          <span
                            key={t}
                            style={{
                              padding: '2px 8px',
                              background: 'rgba(0, 242, 254, 0.15)',
                              color: 'var(--primary-cyan)',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                            }}
                          >
                            {t}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Geral</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 500 }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginRight: '6px' }}>Marca / Modelo / Plataforma:</span>
                      <strong style={{ color: 'var(--primary-cyan)' }}>{comp.marcaModelo || 'Não especificado'}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Observações</span>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
              {pedido.observacoes || 'Nenhuma observação inserida.'}
            </p>
          </div>
        </div>

        {/* Action panel (Strict State Machine) */}
        <div className="glass-card animate-fade-in" style={{ padding: '30px' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '20px', color: 'var(--text-main)' }}>Ações do Caso Clínico</h2>

          {actionLoading && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Processando ação...</div>
          )}

          {!actionLoading && (
            <div>
              {/* PENDENTE (Gestor atribui ou Operador inicia) */}
              {pedido.status === 'PENDENTE' && (
                <div>
                  {!pedido.operador ? (
                    <div>
                      {(user?.role === 'GESTOR' || user?.is_superuser) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                            Atribua um operador para este caso.
                          </p>
                          <select className="form-control" value={selectedOperador} onChange={(e) => setSelectedOperador(e.target.value)}>
                            <option value="">Selecione um profissional</option>
                            {operadores.map(op => (
                              <option key={op.id} value={op.id}>{op.first_name || op.username}</option>
                            ))}
                          </select>
                          <button onClick={handleAtribuirOperador} className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={!selectedOperador}>
                            <UserCog size={18} /> <span>Designar Operador</span>
                          </button>
                        </div>
                      ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Aguardando atribuição de um operador pelo gestor.</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      {pedido.operador === user?.id || user?.role === 'GESTOR' || user?.is_superuser ? (
                        <div>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '15px' }}>
                            Este caso está alocado para o operador {pedido.operador_nome}. Inicie a produção para registrar o tempo de trabalho.
                          </p>
                          {pedido.operador === user?.id && (
                            <button onClick={handleIniciarProducao} className="btn btn-primary">
                              <Clock size={18} /> <span>Iniciar Produção</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Aguardando o operador iniciar a produção.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* INICIADO / RETRABALHO_OPERADOR */}
              {(pedido.status === 'INICIADO' || pedido.status === 'RETRABALHO_OPERADOR') && (
                <div>
                  {pedido.operador === user?.id || user?.role === 'GESTOR' || user?.is_superuser ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                        Insira o arquivo final do desenho (.STL/.PLY) para concluir, ou solicite retrabalho ao dentista caso o escaneamento esteja inadequado.
                      </p>

                      {!showReworkForm ? (
                        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                          <form onSubmit={handleFinalizarCaso} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <input
                              type="file"
                              required
                              className="form-control"
                              onChange={(e) => setEntregavelFile(e.target.files ? e.target.files[0] : null)}
                              style={{ width: 'auto' }}
                            />
                            <button type="submit" className="btn btn-primary">
                              <Upload size={18} /> <span>Entregar CAD</span>
                            </button>
                          </form>
                          {pedido.operador === user?.id && (
                            <button type="button" onClick={() => setShowReworkForm(true)} className="btn btn-danger" style={{ alignSelf: 'flex-start' }}>
                              <AlertCircle size={18} /> <span>Pedir Novo Escaneamento (Retrabalho Cliente)</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <form onSubmit={handleSolicitarRetrabalhoCliente} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                          <div className="form-group">
                            <label className="form-label">Motivo do Retrabalho (Para o Dentista)</label>
                            <textarea
                              required rows={3}
                              placeholder="Descreva o problema com o escaneamento..."
                              className="form-control"
                              value={motivoRework}
                              onChange={(e) => setMotivoRework(e.target.value)}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button type="button" onClick={() => setShowReworkForm(false)} className="btn btn-secondary">Cancelar</button>
                            <button type="submit" className="btn btn-danger">Enviar Solicitação</button>
                          </div>
                        </form>
                      )}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Em fase de desenho/ajustes no laboratório.</p>
                  )}
                </div>
              )}

              {/* RETRABALHO_CLIENTE */}
              {pedido.status === 'RETRABALHO_CLIENTE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <p style={{ color: 'var(--status-rework)', fontSize: '0.95rem', fontWeight: 500 }}>
                    <AlertCircle size={18} style={{ verticalAlign: 'middle', marginRight: '5px' }} />
                    O laboratório solicitou um retrabalho por parte da clínica (ex: novo escaneamento).
                    Por favor, atualize o caso anexando os novos modelos ou modificando as informações clínicas necessárias.
                  </p>
                  {(user?.role === 'GESTOR' || user?.is_superuser || pedido.dentista === user?.id) && (
                    <button
                      onClick={() => navigate(`/pedidos/${pedido.id}/editar`)}
                      className="btn btn-primary"
                      style={{ alignSelf: 'flex-start' }}
                    >
                      Editar e Reenviar Caso
                    </button>
                  )}
                </div>
              )}


              {/* EM_APROVACAO */}
              {pedido.status === 'EM_APROVACAO' && (
                <div>
                  {pedido.dentista === user?.id || user?.role === 'GESTOR' || user?.is_superuser ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                        O desenho CAD foi entregue pelo laboratório. Avalie o arquivo 3D na seção abaixo para aprovar ou solicitar ajustes.
                      </p>

                      {!showReworkForm ? (
                        <div style={{ display: 'flex', gap: '15px' }}>
                          <button onClick={handleAprovarCaso} className="btn btn-primary" style={{ background: 'var(--status-approved)' }}>
                            <CheckCircle size={18} /> <span>Aprovar Caso</span>
                          </button>
                          <button onClick={() => setShowReworkForm(true)} className="btn btn-danger">
                            <AlertCircle size={18} /> <span>Solicitar Ajuste ao Operador</span>
                          </button>
                        </div>
                      ) : (
                        <form onSubmit={handleSolicitarRetrabalho} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                          <div className="form-group">
                            <label className="form-label">Motivo do Ajuste (Retrabalho)</label>
                            <textarea
                              required rows={3}
                              placeholder="Descreva exatamente o que precisa ser modificado anatômica ou esteticamente..."
                              className="form-control"
                              value={motivoRework}
                              onChange={(e) => setMotivoRework(e.target.value)}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button type="button" onClick={() => setShowReworkForm(false)} className="btn btn-secondary">Cancelar</button>
                            <button type="submit" className="btn btn-danger">Enviar Retrabalho</button>
                          </div>
                        </form>
                      )}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Aguardando aprovação do cirurgião-dentista.</p>
                  )}
                </div>
              )}

              {/* FINALIZADO */}
              {pedido.status === 'FINALIZADO' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--status-approved)' }}>
                  <CheckCircle size={26} />
                  <span style={{ fontSize: '1rem', fontWeight: 600 }}>Este caso foi finalizado com sucesso!</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>

        {/* Timeline (Historico_Pedidos) */}
        <div className="glass-card" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--accent-purple)' }}>Atualizações</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', position: 'relative', paddingLeft: '20px', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
            {historico.length === 0 ? (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nenhum evento registrado ainda.</span>
            ) : (
              historico.map((evento) => {
                const isCreation = evento.status_anterior === null || (evento.detalhes_alteracao && evento.detalhes_alteracao.includes('Estado Inicial'));
                
                // Clean any legacy raw JSON syntax from details
                let cleanDetails = evento.detalhes_alteracao || '';
                if (cleanDetails) {
                  cleanDetails = cleanDetails.replace(/\{[^{}]*\}/g, (match) => {
                    try {
                      const p = JSON.parse(match);
                      return Object.entries(p).map(([k, v]) => `Dente ${k}: ${v}`).join(', ');
                    } catch (e) { return match; }
                      try {
                        const p = JSON.parse(match);
                        if (Array.isArray(p)) {
                          return p.map((i: any) => typeof i === 'object' ? `${i.marcaModelo || ''} ${i.dentes ? `(Dentes: ${i.dentes})` : ''}`.trim() : String(i)).join('; ');
                        }
                      } catch (e) {}
                      return match;
                    });
                }

                // Fallback for older creation events that were saved only with "Caso criado."
                const showFallbackCreation = isCreation && (!cleanDetails || cleanDetails === "Caso criado.");

                return (
                  <div key={evento.id} style={{ position: 'relative' }}>
                    <div style={{
                      position: 'absolute', left: '-26px', top: '5px', width: '10px', height: '10px',
                      borderRadius: '50%', background: 'var(--primary-cyan)', border: '2px solid #111'
                    }}></div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {isCreation ? 'Caso Criado (Cadastro Inicial)' : getStatusLabel(evento.status_novo)}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Por {evento.usuario_nome || 'Sistema'} em {new Date(evento.data_transicao).toLocaleString('pt-BR')}
                      </span>

                      {cleanDetails && !showFallbackCreation && (
                        <div style={{
                          marginTop: '6px', fontSize: '0.85rem', color: 'var(--primary-cyan)',
                          background: 'rgba(0, 242, 254, 0.03)', padding: '8px 12px', borderRadius: '6px',
                          border: '1px solid rgba(0, 242, 254, 0.12)', whiteSpace: 'pre-wrap', lineHeight: '1.5'
                        }}>
                          {cleanDetails}
                        </div>
                      )}

                      {showFallbackCreation && (
                        <div style={{
                          marginTop: '6px', fontSize: '0.85rem', color: 'var(--primary-cyan)',
                          background: 'rgba(0, 242, 254, 0.03)', padding: '8px 12px', borderRadius: '6px',
                          border: '1px solid rgba(0, 242, 254, 0.12)', whiteSpace: 'pre-wrap', lineHeight: '1.5'
                        }}>
                          <strong>Estado Inicial no Cadastro:</strong>
                          <br />• Paciente: {pedido.nome_paciente}
                          <br />• Sexo: {pedido.sexo === 'M' ? 'Masculino' : 'Feminino'}
                          <br />• Tipo de Serviço: {pedido.tipo_servico}
                          {pedido.cor && <><br />• Cor: {pedido.cor}</>}
                          <br />• Urgente: {pedido.urgente ? 'Sim' : 'Não'}
                          {selectedTeeth.length > 0 && <><br />• Dentes/Elementos: {selectedTeeth.map(t => `Dente ${t}${elementos[t] ? ` (${elementos[t]})` : ''}`).join(', ')}</>}
                          {componentesImplanteList.length > 0 && (
                            <><br />• Componentes de Implante: {componentesImplanteList.map(c => `${c.marcaModelo || 'Geral'}${c.dentes?.length ? ` (Dentes: ${c.dentes.join(', ')})` : ''}`).join('; ')}</>
                          )}
                          {pedido.observacoes && <><br />• Observações: {pedido.observacoes}</>}
                        </div>
                      )}

                      {evento.motivo_retrabalho && (
                        <div style={{ marginTop: '8px', padding: '10px', background: 'rgba(231,76,60,0.1)', borderRadius: '6px', borderLeft: '3px solid var(--status-rework)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          "{evento.motivo_retrabalho}"
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Attachments and Deliverables */}
        <div className="glass-card" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--accent-purple)' }}>Arquivos do Caso</h2>

          {/* Clinician scans */}
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Modelos do Escaneamento</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              {pedido.anexos.length === 0 ? (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nenhum arquivo enviado.</span>
              ) : (
                pedido.anexos.map((anexo) => (
                  <div
                    key={anexo.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)', padding: '12px 16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <FileText size={20} color="var(--primary-blue)" />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{anexo.descricao}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Anexado em {new Date(anexo.uploaded_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    <a href={`${API_URL}${anexo.arquivo}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                      <Download size={14} /> <span>Baixar</span>
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cadista deliverables */}
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Projeto/Desenho Final CAD</span>
            <div style={{ marginTop: '10px' }}>
              {pedido.arquivo_entregavel ? (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'rgba(46, 204, 113, 0.04)', border: '1px solid rgba(46, 204, 113, 0.2)',
                  borderRadius: 'var(--radius-sm)', padding: '14px 20px',
                }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <CheckCircle size={20} color="var(--status-completed)" />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--status-completed)' }}>Arquivo Pronto para Entrega</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Desenho 3D finalizado</span>
                    </div>
                  </div>
                  <a href={`${API_URL}${pedido.arquivo_entregavel}`} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem', background: 'var(--status-completed)', boxShadow: 'none' }}>
                    <Download size={14} /> <span>Download STL</span>
                  </a>
                </div>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nenhum desenho entregue ainda.</span>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DetalhesPedido;