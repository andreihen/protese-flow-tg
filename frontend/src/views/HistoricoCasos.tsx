import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Search, Calendar, Filter, Database, ExternalLink, Edit3, X } from 'lucide-react';

interface Pedido {
  id: number;
  nome_paciente: string;
  dentista_nome: string;
  operador_nome: string | null;
  tipo_servico: string;
  cor: string;
  status: 'PENDENTE' | 'INICIADO' | 'RETRABALHO_OPERADOR' | 'RETRABALHO_CLIENTE' | 'EM_APROVACAO' | 'FINALIZADO';
  urgente?: boolean;
  data_criacao: string;
  prazo_original: string | null;
  prazo_ajustado: string | null;
  dentes?: string;
  elementos?: string;
  componentes_implante?: string | null;
  observacoes?: string | null;
}

const getServiceGroups = (elementosStr?: string, fallbackServicesStr?: string, fallbackTeethStr?: string) => {
  const groups: Record<string, number[]> = {};
  
  if (elementosStr) {
    try {
      const raw = JSON.parse(elementosStr);
      Object.entries(raw).forEach(([tooth, services]) => {
        const toothNum = Number(tooth);
        if (isNaN(toothNum)) return;
        
        const servList: string[] = Array.isArray(services) 
          ? services 
          : typeof services === 'string' 
            ? [services] 
            : [];
            
        servList.forEach((s: string) => {
          if (!s) return;
          if (!groups[s]) groups[s] = [];
          if (!groups[s].includes(toothNum)) {
            groups[s].push(toothNum);
          }
        });
      });
    } catch (e) {
      console.error('Falha ao processar elementos:', e);
    }
  }

  // Se não encontrou elementos mapeados no JSON, usa o tipo_servico e dentes gerais
  if (Object.keys(groups).length === 0 && fallbackServicesStr) {
    const services = fallbackServicesStr.split(',').map(s => s.trim()).filter(Boolean);
    const teeth = (fallbackTeethStr || '').split(',').map(t => Number(t.trim())).filter(n => !isNaN(n));
    services.forEach(s => {
      groups[s] = teeth;
    });
  }

  // Ordena os dentes numericamente
  Object.keys(groups).forEach(s => {
    groups[s].sort((a, b) => a - b);
  });

  return groups;
};

const getImplantComponents = (compStr?: string | null) => {
  if (!compStr) return [];
  try {
    const parsed = JSON.parse(compStr);
    if (Array.isArray(parsed)) {
      return parsed.filter(c => (c.dentes && c.dentes.length > 0) || (c.marcaModelo && c.marcaModelo.trim() !== ''));
    }
  } catch (e) {
    console.error('Falha ao parsear componentes_implante:', e);
  }
  return [];
};

const HistoricoCasos: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [patientSearch, setPatientSearch] = useState('');
  const [osSearch, setOsSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dentistSearch, setDentistSearch] = useState('');
  const [operatorSearch, setOperatorSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Derived arrays for autocompleting (datalists)
  const [dentistsList, setDentistsList] = useState<string[]>([]);
  const [operatorsList, setOperatorsList] = useState<string[]>([]);

  const fetchPedidos = async () => {
    try {
      setLoading(true);
      const response = await api.get<Pedido[]>('/pedidos/');
      setPedidos(response.data);

      // Extract unique dentists and operators for autocomplete datalists
      const dentists = Array.from(new Set(response.data.map(p => p.dentista_nome))).filter(Boolean);
      const operators = Array.from(new Set(response.data.map(p => p.operador_nome))).filter(Boolean) as string[];
      setDentistsList(dentists);
      setOperatorsList(operators);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao carregar o histórico de casos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPedidos();
  }, []);

  const filteredPedidos = pedidos.filter((pedido) => {
    // 1. Patient Name (Only patient name, no service matching)
    const matchesPatient = patientSearch === '' || 
      pedido.nome_paciente.toLowerCase().includes(patientSearch.toLowerCase());

    // 2. OS Search (ID code)
    const matchesOS = osSearch === '' ||
      pedido.id.toString().includes(osSearch);

    // 3. Status
    const matchesStatus = statusFilter === '' || pedido.status === statusFilter;

    // 4. Dentist Name (Text search)
    const matchesDentist = dentistSearch === '' ||
      pedido.dentista_nome.toLowerCase().includes(dentistSearch.toLowerCase());

    // 5. Operator Name (Text search)
    const matchesOperator = operatorSearch === '' ||
      (pedido.operador_nome && pedido.operador_nome.toLowerCase().includes(operatorSearch.toLowerCase()));

    // 6. Date Range
    let matchesDate = true;
    if (startDate || endDate) {
      const caseDate = new Date(pedido.data_criacao).getTime();
      if (startDate) {
        const start = new Date(startDate).getTime();
        if (caseDate < start) matchesDate = false;
      }
      if (endDate) {
        const end = new Date(endDate + 'T23:59:59').getTime();
        if (caseDate > end) matchesDate = false;
      }
    }

    return matchesPatient && matchesOS && matchesStatus && matchesDentist && matchesOperator && matchesDate;
  });

  const getStatusBadge = (status: string) => {
    const labels: Record<string, { label: string; class: string }> = {
      PENDENTE: { label: 'Pendente', class: 'badge-pending' },
      INICIADO: { label: 'Iniciado', class: 'badge-production' },
      RETRABALHO_OPERADOR: { label: 'Retrabalho Operador', class: 'badge-rework' },
      RETRABALHO_CLIENTE: { label: 'Retrabalho Cliente', class: 'badge-rework' },
      EM_APROVACAO: { label: 'Em Aprovação', class: 'badge-pending' },
      FINALIZADO: { label: 'Finalizado', class: 'badge-completed' },
      CANCELADO: { label: 'Cancelado', class: 'badge-rework' },
    };
    const info = labels[status] || { label: status, class: '' };
    return <span className={`badge ${info.class}`}>{info.label}</span>;
  };

  const clearFilters = () => {
    setPatientSearch('');
    setOsSearch('');
    setDentistSearch('');
    setOperatorSearch('');
    setStatusFilter('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '2rem', margin: 0, fontWeight: 600 }}>Histórico Geral de Casos</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '4px' }}>
          Banco de dados completo contendo todos os pedidos cadastrados no sistema (ativos e finalizados).
        </p>
      </div>

      {/* Advanced Filters Block */}
      <div className="glass-card" style={{ padding: '25px', borderLeft: '4px solid var(--accent-purple)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <Filter size={18} color="var(--accent-purple)" />
          <h2 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 600 }}>Filtros de Busca Avançada</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          
          {/* Patient Search */}
          <div className="form-group">
            <label className="form-label">Paciente</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Nome do paciente..."
                className="form-control"
                style={{ paddingLeft: '32px' }}
                value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
              />
            </div>
          </div>

          {/* OS Search */}
          <div className="form-group">
            <label className="form-label">Código OS</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Número da OS..."
                className="form-control"
                style={{ paddingLeft: '32px' }}
                value={osSearch}
                onChange={e => setOsSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Status Select */}
          <div className="form-group">
            <label className="form-label">Filtrar por Status</label>
            <select className="form-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Todos os Status</option>
              <option value="PENDENTE">Pendente</option>
              <option value="INICIADO">Iniciado</option>
              <option value="RETRABALHO_OPERADOR">Retrabalho Operador</option>
              <option value="RETRABALHO_CLIENTE">Retrabalho Cliente</option>
              <option value="EM_APROVACAO">Em Aprovação</option>
              <option value="FINALIZADO">Finalizado</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>

          {/* Dentist Autocomplete (Only visible to admin/gestor as dentist only has their own) */}
          {(user?.role === 'GESTOR' || user?.is_superuser) && (
            <div className="form-group">
              <label className="form-label">Dentista</label>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  list="dentists-datalist"
                  placeholder="Digitar nome..."
                  className="form-control"
                  style={{ paddingLeft: '32px' }}
                  value={dentistSearch}
                  onChange={e => setDentistSearch(e.target.value)}
                />
                <datalist id="dentists-datalist">
                  {dentistsList.map(name => <option key={name} value={name} />)}
                </datalist>
              </div>
            </div>
          )}

          {/* Operator Autocomplete (Visible to Gestor/Admin/Dentist) */}
          {(user?.role === 'GESTOR' || user?.is_superuser || user?.role === 'DENTISTA') && (
            <div className="form-group">
              <label className="form-label">Operador</label>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  list="operators-datalist"
                  placeholder="Digitar nome..."
                  className="form-control"
                  style={{ paddingLeft: '32px' }}
                  value={operatorSearch}
                  onChange={e => setOperatorSearch(e.target.value)}
                />
                <datalist id="operators-datalist">
                  {operatorsList.map(name => <option key={name} value={name} />)}
                </datalist>
              </div>
            </div>
          )}

          {/* Start Date */}
          <div className="form-group">
            <label className="form-label">Data Inicial</label>
            <input type="date" className="form-control" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>

          {/* End Date */}
          <div className="form-group">
            <label className="form-label">Data Final</label>
            <input type="date" className="form-control" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button onClick={clearFilters} className="btn btn-secondary" style={{ padding: '8px 20px', fontSize: '0.9rem' }}>
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* Results Container */}
      <div className="glass-card" style={{ padding: '30px' }}>
        {error && <div style={{ color: 'var(--status-rework)', marginBottom: '20px' }}>{error}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Buscando base de dados...</div>
        ) : filteredPedidos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Nenhum registro encontrado para a combinação de filtros selecionada.
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', marginBottom: '15px', fontSize: '0.9rem' }}>
              <Database size={16} />
              <span>{filteredPedidos.length} caso(s) correspondente(s)</span>
            </div>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Paciente</th>
                    <th>Dentista</th>
                    <th>Operador</th>
                    <th>Data Criação</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPedidos.map((pedido) => {
                    const isSelected = selectedPedido?.id === pedido.id;
                    return (
                      <tr
                        key={pedido.id}
                        onClick={() => setSelectedPedido(isSelected ? null : pedido)}
                        onDoubleClick={() => navigate(`/pedidos/${pedido.id}`)}
                        style={{
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          background: isSelected
                            ? 'rgba(0, 242, 254, 0.12)'
                            : pedido.urgente
                              ? 'rgba(231, 76, 60, 0.06)'
                              : undefined,
                          borderLeft: isSelected
                            ? '4px solid var(--primary-cyan)'
                            : pedido.urgente
                              ? '3px solid var(--status-rework)'
                              : undefined,
                        }}
                        title="Clique para selecionar e ver detalhes abaixo"
                      >
                        <td style={{ fontWeight: 600, color: 'var(--primary-cyan)' }}>
                          {pedido.urgente && <span style={{ marginRight: '6px' }} title="Urgente">🚨</span>}
                          #{pedido.id}
                        </td>
                        <td style={{ fontWeight: 500 }}>{pedido.nome_paciente}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{pedido.dentista_nome}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{pedido.operador_nome || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                            <Calendar size={14} color="var(--text-muted)" />
                            <span>{new Date(pedido.data_criacao).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </td>
                        <td>{getStatusBadge(pedido.status)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/pedidos/${pedido.id}`);
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                            >
                              Ver
                            </button>
                            {(pedido.status === 'PENDENTE' || pedido.status === 'RETRABALHO_CLIENTE') && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/pedidos/${pedido.id}/editar`);
                                }} 
                                className="btn btn-primary" 
                                style={{ padding: '6px 12px', fontSize: '0.85rem', minWidth: 'auto' }}
                              >
                                Editar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Painel Inferior Compacto de Informações Rápidas do Caso Selecionado */}
        {selectedPedido && (() => {
          const serviceGroups = getServiceGroups(
            selectedPedido.elementos,
            selectedPedido.tipo_servico,
            selectedPedido.dentes
          );
          const serviceEntries = Object.entries(serviceGroups);
          const implantComponents = getImplantComponents(selectedPedido.componentes_implante);

          return (
            <div
              className="glass-card animate-fade-in"
              style={{
                marginTop: '14px',
                padding: '14px 18px',
                border: '1px solid rgba(0, 242, 254, 0.35)',
                background: 'rgba(15, 23, 42, 0.95)',
                boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35), 0 0 10px rgba(0, 242, 254, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                borderRadius: '12px',
              }}
            >
              {/* Header Compacto */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--primary-cyan)' }}>
                    {selectedPedido.urgente && <span style={{ marginRight: '4px' }} title="Urgente">🚨</span>}
                    #{selectedPedido.id}
                  </span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {selectedPedido.nome_paciente}
                  </span>
                  <div>{getStatusBadge(selectedPedido.status)}</div>
                  {selectedPedido.urgente && (
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(231, 76, 60, 0.2)',
                      color: 'var(--status-rework)',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      border: '1px solid var(--status-rework)',
                    }}>
                      URGENTE
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => navigate(`/pedidos/${selectedPedido.id}`)}
                    className="btn btn-secondary"
                    style={{ padding: '5px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <ExternalLink size={13} /> Ver Completo
                  </button>
                  {(selectedPedido.status === 'PENDENTE' || selectedPedido.status === 'RETRABALHO_CLIENTE') && (
                    <button
                      onClick={() => navigate(`/pedidos/${selectedPedido.id}/editar`)}
                      className="btn btn-primary"
                      style={{ padding: '5px 10px', fontSize: '0.8rem', minWidth: 'auto', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <Edit3 size={13} /> Editar
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedPedido(null)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '4px',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Fechar"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Informações Básicas em Linha Compacta */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
                padding: '8px 12px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                fontSize: '0.8rem',
              }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', marginRight: '5px' }}>Dentista:</span>
                  <strong style={{ color: 'var(--text-main)' }}>{selectedPedido.dentista_nome}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', marginRight: '5px' }}>Operador:</span>
                  <strong style={{ color: selectedPedido.operador_nome ? 'var(--text-main)' : 'var(--status-pending)' }}>
                    {selectedPedido.operador_nome || 'Aguardando'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', marginRight: '5px' }}>Prazo:</span>
                  <strong style={{ color: 'var(--text-main)' }}>
                    {selectedPedido.prazo_ajustado || selectedPedido.prazo_original
                      ? new Date(selectedPedido.prazo_ajustado || selectedPedido.prazo_original || '').toLocaleDateString('pt-BR')
                      : 'Não definido'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', marginRight: '5px' }}>Criado em:</span>
                  <strong style={{ color: 'var(--text-main)' }}>
                    {new Date(selectedPedido.data_criacao).toLocaleDateString('pt-BR')}
                  </strong>
                </div>
              </div>

              {/* Detalhamento de Serviços e Dentes Compacto */}
              <div
                style={{
                  border: '1px solid rgba(0, 242, 254, 0.2)',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  maxHeight: '160px',
                  overflowY: 'auto',
                }}
              >
                {serviceEntries.length === 0 ? (
                  <div style={{ padding: '10px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.8rem' }}>
                    Nenhum serviço mapeado.
                  </div>
                ) : (
                  serviceEntries.map(([servico, dentes], idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(200px, 300px) 1fr',
                        alignItems: 'center',
                        padding: '7px 12px',
                        borderBottom: idx < serviceEntries.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                        background: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                        fontSize: '0.82rem',
                      }}
                    >
                      {/* Nome do Serviço */}
                      <div style={{ fontWeight: 600, color: '#e2e8f0' }}>
                        {servico}
                      </div>

                      {/* Dentes */}
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {dentes.map(t => (
                          <span
                            key={t}
                            style={{
                              padding: '1px 6px',
                              borderRadius: '3px',
                              background: 'rgba(0, 242, 254, 0.12)',
                              color: 'var(--primary-cyan)',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              border: '1px solid rgba(0, 242, 254, 0.25)',
                            }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Componentes de Implante Compactos */}
              {implantComponents.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-purple)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Componentes de Implante
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {implantComponents.map((comp, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '4px 10px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          borderRadius: '6px',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.8rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Dentes:</span>
                          {comp.dentes && comp.dentes.length > 0 ? (
                            comp.dentes.map((t: number) => (
                              <span key={t} style={{
                                padding: '1px 5px',
                                background: 'rgba(0, 242, 254, 0.15)',
                                color: 'var(--primary-cyan)',
                                borderRadius: '3px',
                                fontWeight: 700,
                                fontSize: '0.75rem'
                              }}>
                                {t}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Geral</span>
                          )}
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>Modelo:</span>
                          <strong style={{ color: 'var(--primary-cyan)' }}>{comp.marcaModelo || 'Não especificado'}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Observações Compactas */}
              {selectedPedido.observacoes && (
                <div style={{ fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.02)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <strong style={{ color: 'var(--text-muted)', marginRight: '6px' }}>Obs:</strong>
                  <span style={{ color: 'var(--text-main)' }}>{selectedPedido.observacoes}</span>
                </div>
              )}
            </div>
          );
        })()}

      </div>
    </div>
  );
};

export default HistoricoCasos;
