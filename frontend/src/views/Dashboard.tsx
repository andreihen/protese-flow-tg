import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Search,
  Plus,
  Calendar,
  Clock,
  AlertTriangle,
  Layers,
  UserCog,
  ExternalLink,
  Edit3,
  X,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Filter,
} from 'lucide-react';

interface Pedido {
  id: number;
  nome_paciente: string;
  dentista_nome: string;
  operador_nome: string | null;
  tipo_servico: string;
  cor: string;
  status:
    | 'PENDENTE'
    | 'INICIADO'
    | 'RETRABALHO_OPERADOR'
    | 'RETRABALHO_CLIENTE'
    | 'EM_APROVACAO'
    | 'FINALIZADO'
    | 'CANCELADO';
  urgente: boolean;
  data_criacao: string;
  prazo_original: string | null;
  prazo_ajustado: string | null;
  dentes?: string;
  elementos?: string;
  componentes_implante?: string | null;
  observacoes?: string | null;
}

interface ServicoDB {
  id: number;
  nome: string;
  ativo: boolean;
}

interface ImplantComponent {
  dentes?: number[];
  marcaModelo?: string;
}

const getServiceGroups = (
  elementosStr?: string,
  fallbackServicesStr?: string,
  fallbackTeethStr?: string
) => {
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

  if (Object.keys(groups).length === 0 && fallbackServicesStr) {
    const services = fallbackServicesStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const teeth = (fallbackTeethStr || '')
      .split(',')
      .map((t) => Number(t.trim()))
      .filter((n) => !isNaN(n));
    services.forEach((s) => {
      groups[s] = teeth;
    });
  }

  Object.keys(groups).forEach((s) => {
    groups[s].sort((a, b) => a - b);
  });

  return groups;
};

const getImplantComponents = (compStr?: string | null): ImplantComponent[] => {
  if (!compStr) return [];
  try {
    const parsed = JSON.parse(compStr);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (c) =>
          (c.dentes && c.dentes.length > 0) ||
          (c.marcaModelo && c.marcaModelo.trim() !== '')
      );
    }
  } catch (e) {
    console.error('Falha ao parsear componentes_implante:', e);
  }
  return [];
};

// Componente Compacto de Seleção Pesquisável com Botão Limpar (X)
interface SearchableSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelectOption = (val: string) => {
    onChange(val);
    setQuery(val);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', zIndex: isOpen ? 500 : 'auto' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          placeholder={placeholder}
          className="form-control"
          style={{
            height: '32px',
            fontSize: '0.8rem',
            paddingLeft: '8px',
            paddingRight: query ? '44px' : '24px',
            background: 'rgba(15, 23, 42, 0.8)',
            borderColor: isOpen ? 'var(--primary-cyan)' : 'rgba(255, 255, 255, 0.1)',
            color: '#f8fafc',
            borderRadius: '5px',
          }}
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            const newQuery = e.target.value;
            setQuery(newQuery);
            onChange(newQuery);
            setIsOpen(true);
          }}
        />

        {/* Botão X de Limpeza */}
        {query ? (
          <button
            type="button"
            onClick={handleClear}
            style={{
              position: 'absolute',
              right: '22px',
              background: 'rgba(231, 76, 60, 0.15)',
              border: '1px solid rgba(231, 76, 60, 0.3)',
              color: 'var(--status-rework)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1px',
              borderRadius: '3px',
            }}
            title="Limpar filtro"
          >
            <X size={12} />
          </button>
        ) : null}

        {/* Seta Dropdown */}
        <div
          style={{
            position: 'absolute',
            right: '6px',
            pointerEvents: 'none',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ChevronDown size={13} />
        </div>
      </div>

      {/* Lista Pop-up de Opções */}
      {isOpen && filteredOptions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 3px)',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: '#131826',
            border: '1px solid rgba(139, 92, 246, 0.35)',
            borderRadius: '6px',
            maxHeight: '180px',
            overflowY: 'auto',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.6)',
          }}
        >
          {filteredOptions.map((opt) => (
            <div
              key={opt}
              onClick={() => handleSelectOption(opt)}
              style={{
                padding: '7px 10px',
                fontSize: '0.8rem',
                color: '#f8fafc',
                cursor: 'pointer',
                borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                background: value === opt ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139, 92, 246, 0.25)')}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  value === opt ? 'rgba(139, 92, 246, 0.2)' : 'transparent')
              }
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [registeredServicesList, setRegisteredServicesList] = useState<string[]>([]);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Barra de Pesquisa Geral
  const [globalSearch, setGlobalSearch] = useState('');

  // 2. Toggle dos Filtros Avançados
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // 3. Filtros Avançados Específicos
  const [patientSearch, setPatientSearch] = useState('');
  const [osSearch, setOsSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dentistSearch, setDentistSearch] = useState('');
  const [operatorSearch, setOperatorSearch] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<'TODOS' | 'APENAS_URGENTES' | 'NORMAIS'>('TODOS');
  const [operatorAssignedFilter, setOperatorAssignedFilter] = useState<'TODOS' | 'COM_OPERADOR' | 'SEM_OPERADOR'>('TODOS');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('');
  const [deadlineFilter, setDeadlineFilter] = useState<'TODOS' | 'ATRASADOS' | 'HOJE_AMAP' | 'NO_PRAZO'>('TODOS');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pedidosRes, servicosRes] = await Promise.allSettled([
        api.get<Pedido[]>('/pedidos/'),
        api.get<ServicoDB[]>('/servicos/'),
      ]);

      if (pedidosRes.status === 'fulfilled') {
        setPedidos(pedidosRes.value.data);
      }
      if (servicosRes.status === 'fulfilled') {
        const servs = servicosRes.value.data.map((s) => s.nome).filter(Boolean);
        setRegisteredServicesList(servs);
      }
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Listas limpas para dentistas e operadores
  const dentistsList = Array.from(new Set(pedidos.map((p) => p.dentista_nome))).filter(Boolean);
  const operatorsList = Array.from(
    new Set(pedidos.map((p) => p.operador_nome))
  ).filter(Boolean) as string[];

  // KPIs
  const kpis = {
    semOperador: pedidos.filter((p) => p.status === 'PENDENTE' && !p.operador_nome).length,
    pendente: pedidos.filter((p) => p.status === 'PENDENTE').length,
    pendenteComOperador: pedidos.filter((p) => p.status === 'PENDENTE' && p.operador_nome).length,
    production: pedidos.filter((p) => p.status === 'INICIADO').length,
    reworkOperador: pedidos.filter((p) => p.status === 'RETRABALHO_OPERADOR').length,
    reworkCliente: pedidos.filter((p) => p.status === 'RETRABALHO_CLIENTE').length,
    emAprovacao: pedidos.filter((p) => p.status === 'EM_APROVACAO').length,
    completed: pedidos.filter((p) => p.status === 'FINALIZADO').length,
  };

  const toggleUrgency = (key: 'APENAS_URGENTES' | 'NORMAIS') => {
    setUrgencyFilter((prev) => (prev === key ? 'TODOS' : key));
  };

  const toggleOperatorAssigned = (key: 'COM_OPERADOR' | 'SEM_OPERADOR') => {
    setOperatorAssignedFilter((prev) => (prev === key ? 'TODOS' : key));
  };

  const toggleDeadline = (key: 'ATRASADOS' | 'HOJE_AMAP' | 'NO_PRAZO') => {
    setDeadlineFilter((prev) => (prev === key ? 'TODOS' : key));
  };

  // Contagem de filtros avançados ativos
  const activeAdvancedFiltersCount = [
    patientSearch,
    osSearch,
    statusFilter,
    dentistSearch,
    operatorSearch,
    serviceTypeFilter,
    startDate,
    endDate,
  ].filter(Boolean).length +
    (urgencyFilter !== 'TODOS' ? 1 : 0) +
    (operatorAssignedFilter !== 'TODOS' ? 1 : 0) +
    (deadlineFilter !== 'TODOS' ? 1 : 0);

  // Lógica de filtragem completa
  const filteredPedidos = pedidos.filter((pedido) => {
    // 1. Pesquisa Geral
    if (globalSearch.trim() !== '') {
      const term = globalSearch.toLowerCase().trim();
      const matchGlobal =
        pedido.nome_paciente.toLowerCase().includes(term) ||
        pedido.id.toString().includes(term) ||
        pedido.dentista_nome.toLowerCase().includes(term) ||
        (pedido.operador_nome && pedido.operador_nome.toLowerCase().includes(term)) ||
        pedido.tipo_servico.toLowerCase().includes(term) ||
        (pedido.cor && pedido.cor.toLowerCase().includes(term)) ||
        (pedido.observacoes && pedido.observacoes.toLowerCase().includes(term)) ||
        (pedido.componentes_implante && pedido.componentes_implante.toLowerCase().includes(term));

      if (!matchGlobal) return false;
    }

    // 2. Nome do Paciente
    if (patientSearch && !pedido.nome_paciente.toLowerCase().includes(patientSearch.toLowerCase())) {
      return false;
    }

    // 3. Código OS
    if (osSearch && !pedido.id.toString().includes(osSearch)) {
      return false;
    }

    // 4. Status
    // Ocultar CANCELADO e FINALIZADO na fila geral por padrão (quando nenhum filtro de status específico estiver selecionado)
    if (statusFilter === '' && (pedido.status === 'CANCELADO' || pedido.status === 'FINALIZADO')) {
      return false;
    }

    if (statusFilter === 'SEM_OPERADOR') {
      if (!(!pedido.operador_nome || pedido.operador_nome.trim() === '')) return false;
    } else if (statusFilter === 'COM_OPERADOR') {
      if (!pedido.operador_nome || pedido.operador_nome.trim() === '') return false;
    } else if (statusFilter === 'PENDENTE_COM_OPERADOR') {
      if (!(pedido.status === 'PENDENTE' && !!pedido.operador_nome)) return false;
    } else if (statusFilter === 'RETRABALHO') {
      if (!(pedido.status === 'RETRABALHO_OPERADOR' || pedido.status === 'RETRABALHO_CLIENTE')) return false;
    } else if (statusFilter !== '') {
      if (pedido.status !== statusFilter) return false;
    }

    // 5. Dentista
    if (dentistSearch && !pedido.dentista_nome.toLowerCase().includes(dentistSearch.toLowerCase())) {
      return false;
    }

    // 6. Operador (Igual regra do Dentista)
    if (
      operatorSearch &&
      (!pedido.operador_nome || !pedido.operador_nome.toLowerCase().includes(operatorSearch.toLowerCase()))
    ) {
      return false;
    }

    // 6b. Operador Atribuído (Com vs Sem Operador)
    if (operatorAssignedFilter === 'COM_OPERADOR') {
      if (!pedido.operador_nome || pedido.operador_nome.trim() === '') return false;
    } else if (operatorAssignedFilter === 'SEM_OPERADOR') {
      if (pedido.operador_nome && pedido.operador_nome.trim() !== '') return false;
    }

    // 7. Urgência
    if (urgencyFilter === 'APENAS_URGENTES' && !pedido.urgente) return false;
    if (urgencyFilter === 'NORMAIS' && pedido.urgente) return false;

    // 8. Tipo de Serviço (Apenas Cadastrados)
    if (
      serviceTypeFilter &&
      !pedido.tipo_servico.toLowerCase().includes(serviceTypeFilter.toLowerCase())
    ) {
      return false;
    }

    // 9. Prazo
    if (deadlineFilter !== 'TODOS') {
      const deadlineStr = pedido.prazo_ajustado || pedido.prazo_original;
      if (!deadlineStr) {
        return false;
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deadlineDate = new Date(deadlineStr + 'T00:00:00');

        const diffTime = deadlineDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (deadlineFilter === 'ATRASADOS' && diffDays >= 0) return false;
        if (deadlineFilter === 'HOJE_AMAP' && (diffDays < 0 || diffDays > 2)) return false;
        if (deadlineFilter === 'NO_PRAZO' && diffDays < 0) return false;
      }
    }

    // 10. Intervalo de Datas
    if (startDate || endDate) {
      const caseDate = new Date(pedido.data_criacao).getTime();
      if (startDate) {
        const start = new Date(startDate + 'T00:00:00').getTime();
        if (caseDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate + 'T23:59:59').getTime();
        if (caseDate > end) return false;
      }
    }

    return true;
  });

  const clearAllFilters = () => {
    setGlobalSearch('');
    setPatientSearch('');
    setOsSearch('');
    setStatusFilter('');
    setDentistSearch('');
    setOperatorSearch('');
    setUrgencyFilter('TODOS');
    setOperatorAssignedFilter('TODOS');
    setServiceTypeFilter('');
    setDeadlineFilter('TODOS');
    setStartDate('');
    setEndDate('');
  };

  const setDateShortcut = (period: 'hoje' | '7dias' | 'mes') => {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    if (period === 'hoje') {
      setStartDate(formatDate(today));
      setEndDate(formatDate(today));
    } else if (period === '7dias') {
      const past = new Date();
      past.setDate(today.getDate() - 7);
      setStartDate(formatDate(past));
      setEndDate(formatDate(today));
    } else if (period === 'mes') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(formatDate(firstDay));
      setEndDate(formatDate(today));
    }
  };

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
    return <span className={`badge ${info.class}`} style={{ whiteSpace: 'nowrap' }}>{info.label}</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* KPI Cards Grid Compacto */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
        }}
      >
        {user?.role === 'GESTOR' && (
          <div
            className="glass-card"
            onClick={() => setStatusFilter('SEM_OPERADOR')}
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              borderLeft: '3px solid var(--status-pending)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: 'var(--status-pending)',
              }}
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                Sem Operador
              </span>
              <UserCog size={15} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '4px 0 0' }}>
              {kpis.semOperador}
            </h2>
          </div>
        )}

        {(user?.role === 'GESTOR' || user?.role === 'OPERADOR') && (
          <div
            className="glass-card"
            onClick={() => setStatusFilter('PENDENTE')}
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              borderLeft: '3px solid var(--primary-blue)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: 'var(--primary-blue)',
              }}
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                Pendente
              </span>
              <Layers size={15} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '4px 0 0' }}>
              {kpis.pendenteComOperador}
            </h2>
          </div>
        )}

        {user?.role === 'DENTISTA' && (
          <div
            className="glass-card"
            onClick={() => setStatusFilter('PENDENTE')}
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              borderLeft: '3px solid var(--primary-blue)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: 'var(--primary-blue)',
              }}
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                Pendente
              </span>
              <Layers size={15} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '4px 0 0' }}>
              {kpis.pendente}
            </h2>
          </div>
        )}

        {user?.role !== 'DENTISTA' && (
          <div
            className="glass-card"
            onClick={() => setStatusFilter('INICIADO')}
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              borderLeft: '3px solid var(--status-production)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: 'var(--status-production)',
              }}
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                Iniciado
              </span>
              <Clock size={15} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '4px 0 0' }}>
              {kpis.production}
            </h2>
          </div>
        )}

        {user?.role === 'DENTISTA' ? (
          <div
            className="glass-card"
            onClick={() => setStatusFilter('RETRABALHO_CLIENTE')}
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              borderLeft: '3px solid var(--status-rework)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: 'var(--status-rework)',
              }}
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                Retrabalho
              </span>
              <AlertTriangle size={15} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '4px 0 0' }}>
              {kpis.reworkCliente}
            </h2>
          </div>
        ) : (
          <div
            className="glass-card"
            onClick={() => setStatusFilter('RETRABALHO')}
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              borderLeft: '3px solid var(--status-rework)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: 'var(--status-rework)',
              }}
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                Retrabalhos
              </span>
              <AlertTriangle size={15} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '4px 0 0' }}>
              {kpis.reworkOperador + kpis.reworkCliente}
            </h2>
          </div>
        )}

        <div
          className="glass-card"
          onClick={() => setStatusFilter('EM_APROVACAO')}
          style={{
            padding: '12px 16px',
            cursor: 'pointer',
            borderLeft: '3px solid var(--status-pending)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: 'var(--status-pending)',
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
              Em Aprovação
            </span>
            <Clock size={15} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '4px 0 0' }}>
            {kpis.emAprovacao}
          </h2>
        </div>

        <div
          className="glass-card"
          onClick={() => setStatusFilter('FINALIZADO')}
          style={{
            padding: '12px 16px',
            cursor: 'pointer',
            borderLeft: '3px solid var(--status-completed)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: 'var(--status-completed)',
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
              {user?.role === 'DENTISTA' ? 'Finalizados' : 'Recém Finalizados'}
            </span>
            <Clock size={15} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '4px 0 0' }}>
            {kpis.completed}
          </h2>
        </div>
      </div>

      {/* Top Search Bar & Toggle Action Bar (Clean & Uncluttered) */}
      <div
        className="glass-card"
        style={{
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          borderRadius: '10px',
          position: 'relative',
          zIndex: 50,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          {/* Barra de Pesquisa Geral */}
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--primary-cyan)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Pesquisar em tudo (Paciente, OS, Dentista, Operador, Serviço, Obs...)"
              className="form-control"
              style={{
                paddingLeft: '38px',
                paddingRight: globalSearch ? '34px' : '14px',
                height: '40px',
                fontSize: '0.88rem',
                borderRadius: '6px',
                background: 'rgba(15, 23, 42, 0.8)',
                borderColor: 'rgba(0, 242, 254, 0.25)',
              }}
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
            />
            {globalSearch && (
              <button
                onClick={() => setGlobalSearch('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Botão Toggle Filtros Avançados */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="btn"
            style={{
              height: '40px',
              padding: '0 16px',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: showAdvancedFilters
                ? 'rgba(139, 92, 246, 0.25)'
                : 'rgba(255, 255, 255, 0.05)',
              border: showAdvancedFilters
                ? '1px solid #8b5cf6'
                : '1px solid var(--border-color)',
              color: showAdvancedFilters ? '#a78bfa' : '#f8fafc',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <SlidersHorizontal size={15} color={showAdvancedFilters ? '#a78bfa' : '#94a3b8'} />
            <span>Filtros Avançados</span>
            {activeAdvancedFiltersCount > 0 && (
              <span
                style={{
                  background: '#8b5cf6',
                  color: '#ffffff',
                  borderRadius: '10px',
                  padding: '1px 7px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}
              >
                {activeAdvancedFiltersCount}
              </span>
            )}
            {showAdvancedFilters ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {/* Botão de Limpar Todos os Filtros */}
          {(globalSearch || activeAdvancedFiltersCount > 0) && (
            <button
              onClick={clearAllFilters}
              className="btn btn-secondary"
              style={{
                height: '40px',
                padding: '0 12px',
                fontSize: '0.82rem',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                color: 'var(--status-rework)',
              }}
              title="Limpar todos os filtros aplicados"
            >
              <RotateCcw size={13} />
              <span>Limpar</span>
            </button>
          )}

          {/* Botão Novo Pedido (Dentista) */}
          {user?.role === 'DENTISTA' && (
            <button
              onClick={() => navigate('/pedidos/novo')}
              className="btn btn-primary"
              style={{
                height: '40px',
                padding: '0 16px',
                fontSize: '0.88rem',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Plus size={16} />
              <span>Novo Pedido</span>
            </button>
          )}
        </div>

        {/* ------------------- PAINEL EXPANSÍVEL DE FILTROS AVANÇADOS (TUDO NA MESMA LINHA) ------------------- */}
        {showAdvancedFilters && (
          <div
            className="animate-fade-in"
            style={{
              padding: '10px 14px',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderLeft: '4px solid #8b5cf6',
              borderRadius: '8px',
              marginTop: '2px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              gap: '8px',
            }}
          >
            {/* Paciente */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: '1 1 120px', minWidth: '110px' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Paciente</label>
              <input
                type="text"
                placeholder="Paciente..."
                className="form-control"
                style={{ height: '32px', fontSize: '0.8rem', padding: '0 8px' }}
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
              />
            </div>

            {/* Código OS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: '0 1 90px', minWidth: '80px' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Código OS</label>
              <input
                type="text"
                placeholder="OS..."
                className="form-control"
                style={{ height: '32px', fontSize: '0.8rem', padding: '0 8px' }}
                value={osSearch}
                onChange={(e) => setOsSearch(e.target.value)}
              />
            </div>

            {/* Status */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: '1 1 130px', minWidth: '120px' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Status OS</label>
              <select
                className="form-control"
                style={{ height: '32px', fontSize: '0.8rem', padding: '0 8px' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Todos Status</option>
                <option value="INICIADO">⚙️ Iniciada</option>
                <option value="COM_OPERADOR">👤 Com Operador</option>
                <option value="SEM_OPERADOR">⏳ Sem Operador</option>
                <option value="PENDENTE">Pendente</option>
                <option value="PENDENTE_COM_OPERADOR">Pendente w/ Op</option>
                <option value="RETRABALHO_OPERADOR">Retr. Operador</option>
                <option value="RETRABALHO_CLIENTE">Retr. Cliente</option>
                <option value="EM_APROVACAO">Em Aprovação</option>
                <option value="FINALIZADO">Finalizado</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>

            {/* Dentista */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: '1 1 130px', minWidth: '120px' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Dentista</label>
              <SearchableSelect
                value={dentistSearch}
                onChange={setDentistSearch}
                options={dentistsList}
                placeholder="Dentista..."
              />
            </div>

            {/* Operador */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: '1 1 130px', minWidth: '120px' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Operador</label>
              <SearchableSelect
                value={operatorSearch}
                onChange={setOperatorSearch}
                options={operatorsList}
                placeholder="Operador..."
              />
            </div>

            {/* Atribuição de Operador (Liga/Desliga) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: '0 0 auto' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Atribuição</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[
                  { key: 'COM_OPERADOR', label: '👤 Com Op' },
                  { key: 'SEM_OPERADOR', label: '⏳ Sem Op' },
                ].map((opt) => {
                  const isActive = operatorAssignedFilter === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => toggleOperatorAssigned(opt.key as any)}
                      style={{
                        height: '24px',
                        padding: '0 6px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        borderRadius: '4px',
                        border: isActive
                          ? '1px solid var(--primary-blue)'
                          : '1px solid rgba(255, 255, 255, 0.1)',
                        background: isActive
                          ? 'rgba(79, 172, 254, 0.2)'
                          : 'rgba(255, 255, 255, 0.03)',
                        color: isActive ? 'var(--primary-blue)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prioridade (Liga/Desliga) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: '0 0 auto' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Prioridade</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[
                  { key: 'APENAS_URGENTES', label: '🚨 Urgentes' },
                  { key: 'NORMAIS', label: 'Normais' },
                ].map((opt) => {
                  const isActive = urgencyFilter === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => toggleUrgency(opt.key as any)}
                      style={{
                        height: '24px',
                        padding: '0 6px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        borderRadius: '4px',
                        border: isActive
                          ? '1px solid var(--primary-cyan)'
                          : '1px solid rgba(255, 255, 255, 0.1)',
                        background: isActive
                          ? 'rgba(0, 242, 254, 0.15)'
                          : 'rgba(255, 255, 255, 0.03)',
                        color: isActive ? 'var(--primary-cyan)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status do Prazo (Liga/Desliga) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: '0 0 auto' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Status Prazo</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[
                  { key: 'ATRASADOS', label: '🔴 Atrasados' },
                  { key: 'HOJE_AMAP', label: '🟡 Vencendo' },
                  { key: 'NO_PRAZO', label: '🟢 No Prazo' },
                ].map((opt) => {
                  const isActive = deadlineFilter === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => toggleDeadline(opt.key as any)}
                      style={{
                        height: '24px',
                        padding: '0 6px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        borderRadius: '4px',
                        border: isActive
                          ? '1px solid #8b5cf6'
                          : '1px solid rgba(255, 255, 255, 0.1)',
                        background: isActive
                          ? 'rgba(139, 92, 246, 0.2)'
                          : 'rgba(255, 255, 255, 0.03)',
                        color: isActive ? '#a78bfa' : 'var(--text-muted)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Serviço Cadastrado */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: '1 1 140px', minWidth: '130px' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Serviço</label>
              <SearchableSelect
                value={serviceTypeFilter}
                onChange={setServiceTypeFilter}
                options={registeredServicesList}
                placeholder="Serviço..."
              />
            </div>

            {/* Data Inicial */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: '0 1 120px', minWidth: '110px' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Data Inicial</label>
              <input
                type="date"
                className="form-control"
                style={{ height: '32px', fontSize: '0.8rem', padding: '0 6px' }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* Data Final */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: '0 1 120px', minWidth: '110px' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Data Final</label>
              <input
                type="date"
                className="form-control"
                style={{ height: '32px', fontSize: '0.8rem', padding: '0 6px' }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* Atalhos Rápidos Data */}
            <div style={{ display: 'flex', gap: '4px', flex: '0 0 auto', alignItems: 'center', height: '32px' }}>
              <button
                type="button"
                onClick={() => setDateShortcut('hoje')}
                className="btn btn-secondary"
                style={{ padding: '0 8px', fontSize: '0.72rem', height: '28px' }}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setDateShortcut('7dias')}
                className="btn btn-secondary"
                style={{ padding: '0 8px', fontSize: '0.72rem', height: '28px' }}
              >
                7d
              </button>
              <button
                type="button"
                onClick={() => setDateShortcut('mes')}
                className="btn btn-secondary"
                style={{ padding: '0 8px', fontSize: '0.72rem', height: '28px' }}
              >
                Mês
              </button>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="btn"
                  style={{
                    padding: '0 6px',
                    fontSize: '0.72rem',
                    height: '28px',
                    color: 'var(--status-rework)',
                    background: 'transparent',
                  }}
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabela de Resultados */}
      <div className="glass-card" style={{ padding: '14px 18px', position: 'relative', zIndex: 1 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                background: 'rgba(139, 92, 246, 0.15)',
                color: '#a78bfa',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                padding: '2px 10px',
                borderRadius: '12px',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              {filteredPedidos.length} {filteredPedidos.length === 1 ? 'caso' : 'casos'} encontrados
            </span>
          </div>
        </div>

        {/* Tabela */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Carregando casos...
          </div>
        ) : filteredPedidos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Nenhum caso encontrado com os filtros selecionados.
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>CÓDIGO OS</th>
                  <th>PACIENTE</th>
                  <th>DENTISTA</th>
                  <th>OPERADOR</th>
                  <th>PRAZO</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'center' }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {filteredPedidos.map((pedido) => {
                  const isSelected = selectedPedido?.id === pedido.id;
                  const hasImplant = !!(
                    pedido.componentes_implante &&
                    pedido.componentes_implante.trim() !== '' &&
                    pedido.componentes_implante !== '[]'
                  );

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
                      <td style={{ fontWeight: 600, color: 'var(--primary-cyan)', whiteSpace: 'nowrap' }}>
                        {pedido.urgente && (
                          <span style={{ marginRight: '6px' }} title="Urgente">
                            🚨
                          </span>
                        )}
                        #{pedido.id}
                      </td>
                      <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                        <div>{pedido.nome_paciente}</div>
                      </td>
                      <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{pedido.dentista_nome}</td>
                      <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {pedido.operador_nome || '-'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {pedido.prazo_ajustado || pedido.prazo_original ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={14} color="var(--text-muted)" />
                            <span>
                              {new Date(
                                pedido.prazo_ajustado || pedido.prazo_original || ''
                              ).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{getStatusBadge(pedido.status)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/pedidos/${pedido.id}`);
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '3px 10px', fontSize: '0.78rem', height: '26px', width: '48px', justifyContent: 'center' }}
                          >
                            Ver
                          </button>
                          {pedido.status === 'PENDENTE' ||
                          pedido.status === 'RETRABALHO_CLIENTE' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/pedidos/${pedido.id}/editar`);
                              }}
                              className="btn btn-primary"
                              style={{
                                padding: '3px 10px',
                                fontSize: '0.78rem',
                                height: '26px',
                                width: '56px',
                                justifyContent: 'center',
                                minWidth: 'auto',
                              }}
                            >
                              Editar
                            </button>
                          ) : (
                            <div style={{ width: '56px', height: '26px' }} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Detalhes do Caso Selecionado */}
        {selectedPedido &&
          (() => {
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
                  marginTop: '16px',
                  padding: '16px 20px',
                  border: '1px solid rgba(0, 242, 254, 0.35)',
                  background: 'rgba(15, 23, 42, 0.95)',
                  boxShadow:
                    '0 6px 24px rgba(0, 0, 0, 0.35), 0 0 10px rgba(0, 242, 254, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  borderRadius: '12px',
                }}
              >
                {/* Header Compacto */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span
                      style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--primary-cyan)' }}
                    >
                      {selectedPedido.urgente && (
                        <span style={{ marginRight: '4px' }} title="Urgente">
                          🚨
                        </span>
                      )}
                      #{selectedPedido.id}
                    </span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {selectedPedido.nome_paciente}
                    </span>
                    <div>{getStatusBadge(selectedPedido.status)}</div>
                    {selectedPedido.urgente && (
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(231, 76, 60, 0.2)',
                          color: 'var(--status-rework)',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          border: '1px solid var(--status-rework)',
                        }}
                      >
                        URGENTE
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      onClick={() => navigate(`/pedidos/${selectedPedido.id}`)}
                      className="btn btn-secondary"
                      style={{
                        padding: '5px 10px',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <ExternalLink size={13} /> Ver Completo
                    </button>
                    {(selectedPedido.status === 'PENDENTE' ||
                      selectedPedido.status === 'RETRABALHO_CLIENTE') && (
                      <button
                        onClick={() => navigate(`/pedidos/${selectedPedido.id}/editar`)}
                        className="btn btn-primary"
                        style={{
                          padding: '5px 10px',
                          fontSize: '0.8rem',
                          minWidth: 'auto',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
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

                {/* Informações Básicas */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '16px',
                    padding: '8px 12px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    fontSize: '0.8rem',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)', marginRight: '5px' }}>
                      Dentista:
                    </span>
                    <strong style={{ color: 'var(--text-main)' }}>
                      {selectedPedido.dentista_nome}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', marginRight: '5px' }}>
                      Operador:
                    </span>
                    <strong
                      style={{
                        color: selectedPedido.operador_nome
                          ? 'var(--text-main)'
                          : 'var(--status-pending)',
                      }}
                    >
                      {selectedPedido.operador_nome || 'Aguardando'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', marginRight: '5px' }}>Cor:</span>
                    <strong style={{ color: 'var(--primary-cyan)' }}>
                      {selectedPedido.cor || 'Não especificada'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', marginRight: '5px' }}>Prazo:</span>
                    <strong style={{ color: 'var(--text-main)' }}>
                      {selectedPedido.prazo_ajustado || selectedPedido.prazo_original
                        ? new Date(
                            selectedPedido.prazo_ajustado || selectedPedido.prazo_original || ''
                          ).toLocaleDateString('pt-BR')
                        : 'Não definido'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', marginRight: '5px' }}>
                      Criado em:
                    </span>
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
                    <div
                      style={{
                        padding: '10px',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        fontSize: '0.8rem',
                      }}
                    >
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
                          borderBottom:
                            idx < serviceEntries.length - 1
                              ? '1px solid rgba(255, 255, 255, 0.05)'
                              : 'none',
                          background: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                          fontSize: '0.82rem',
                        }}
                      >
                        <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{servico}</div>
                        <div
                          style={{
                            display: 'flex',
                            gap: '4px',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                          }}
                        >
                          {dentes.map((t: number) => (
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

                {/* Componentes de Implante */}
                {implantComponents.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: 'var(--accent-purple)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
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
                                <span
                                  key={t}
                                  style={{
                                    padding: '1px 5px',
                                    background: 'rgba(0, 242, 254, 0.15)',
                                    color: 'var(--primary-cyan)',
                                    borderRadius: '3px',
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                  }}
                                >
                                  {t}
                                </span>
                              ))
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>Geral</span>
                            )}
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>
                              Modelo:
                            </span>
                            <strong style={{ color: 'var(--primary-cyan)' }}>
                              {comp.marcaModelo || 'Não especificado'}
                            </strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Observações */}
                {selectedPedido.observacoes && (
                  <div
                    style={{
                      fontSize: '0.8rem',
                      background: 'rgba(255, 255, 255, 0.02)',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <strong style={{ color: 'var(--text-muted)', marginRight: '6px' }}>
                      Obs:
                    </strong>
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

export default Dashboard;
