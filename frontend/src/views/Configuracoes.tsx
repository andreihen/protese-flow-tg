import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Settings, Save, AlertCircle, CheckCircle, Calendar, ChevronLeft, ChevronRight, Trash2, Download, RefreshCw, Pencil, Check, X, ChevronDown, ChevronUp, User, Lock } from 'lucide-react';

interface DiaExcecao {
  id: number;
  data: string;
  trabalha: boolean;
  descricao?: string;
}

const Configuracoes: React.FC = () => {
  const { user, updateUser } = useAuth();
  const isAdmin = user?.role === 'GESTOR' || user?.role === 'ADMIN' || !!user?.is_superuser;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Profile State
  const [perfilFirstName, setPerfilFirstName] = useState('');
  const [perfilEmail, setPerfilEmail] = useState('');
  const [perfilTelefone, setPerfilTelefone] = useState('');
  const [perfilCro, setPerfilCro] = useState('');
  const [perfilPassword, setPerfilPassword] = useState('');
  const [perfilConfirmPassword, setPerfilConfirmPassword] = useState('');
  const [profileSaveLoading, setProfileSaveLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setPerfilFirstName(user.first_name || '');
      setPerfilEmail(user.email || '');
      setPerfilTelefone(user.telefone || '');
      setPerfilCro(user.cro || '');
    }
  }, [user]);


  // Calendar State
  const [exceptions, setExceptions] = useState<DiaExcecao[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [importLoading, setImportLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [showHolidaysList, setShowHolidaysList] = useState(false);

  const fetchConfig = async () => {
    try {
      await api.get('/pedidos/configuracao/');
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchExceptions = async () => {
    try {
      const response = await api.get('/dia-excecao/');
      setExceptions(response.data);
    } catch (err) {
      console.error('Erro ao buscar exceções do calendário:', err);
    }
  };

  const initData = async () => {
    setLoading(true);
    await Promise.all([fetchConfig(), fetchExceptions()]);
    setLoading(false);
  };

  useEffect(() => {
    initData();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (perfilPassword && perfilPassword !== perfilConfirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setProfileSaveLoading(true);

    try {
      const payload: any = {
        first_name: perfilFirstName,
        email: perfilEmail,
        telefone: perfilTelefone,
      };

      if (user?.role === 'DENTISTA') {
        payload.cro = perfilCro;
      }

      if (perfilPassword) {
        payload.password = perfilPassword;
      }

      const response = await api.patch(`/usuarios/${user?.id}/`, payload);
      
      updateUser(response.data);
      
      setSuccess('Perfil atualizado com sucesso!');
      setPerfilPassword('');
      setPerfilConfirmPassword('');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Erro ao atualizar perfil.');
      setTimeout(() => setError(null), 4000);
    } finally {
      setProfileSaveLoading(false);
    }
  };

  // Helper to format local date YYYY-MM-DD
  const formatDateLocal = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleToggleDay = async (date: Date) => {
    const dateStr = formatDateLocal(date);
    const existing = exceptions.find(e => e.data === dateStr);
    const weekday = date.getDay(); // 0 = Sunday, 6 = Saturday
    const isDefaultWorking = weekday !== 0 && weekday !== 6;

    try {
      if (existing) {
        await api.delete(`/dia-excecao/${existing.id}/`);
        setSuccess('Dia redefinido para o padrão!');
      } else {
        const trabalha = !isDefaultWorking;
        await api.post('/dia-excecao/', {
          data: dateStr,
          trabalha: trabalha,
          descricao: trabalha ? 'Trabalho Extra' : 'Folga / Feriado'
        });
        setSuccess('Alteração salva com sucesso!');
      }
      fetchExceptions();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(err);
      setError('Erro ao salvar alteração no calendário.');
      setTimeout(() => setError(null), 3500);
    }
  };

  const handleDeleteException = async (id: number) => {
    try {
      await api.delete(`/dia-excecao/${id}/`);
      setSuccess('Dia redefinido para o padrão com sucesso!');
      fetchExceptions();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(err);
      setError('Erro ao remover a exceção.');
      setTimeout(() => setError(null), 3500);
    }
  };

  const handleSaveDescription = async (id: number) => {
    try {
      await api.patch(`/dia-excecao/${id}/`, { descricao: editingText });
      setSuccess('Descrição atualizada com sucesso!');
      setEditingId(null);
      fetchExceptions();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(err);
      setError('Erro ao atualizar a descrição.');
      setTimeout(() => setError(null), 3500);
    }
  };

  // Build calendar grid days
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const daysGrid = [];
  // Prev month filler days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    daysGrid.push({
      day: prevMonthTotalDays - i,
      isCurrentMonth: false,
      date: new Date(year, month - 1, prevMonthTotalDays - i),
    });
  }
  // Current month days
  for (let i = 1; i <= totalDays; i++) {
    daysGrid.push({
      day: i,
      isCurrentMonth: true,
      date: new Date(year, month, i),
    });
  }
  // Next month filler days
  const totalGridCells = Math.ceil(daysGrid.length / 7) * 7;
  const nextMonthDaysNeeded = totalGridCells - daysGrid.length;
  for (let i = 1; i <= nextMonthDaysNeeded; i++) {
    daysGrid.push({
      day: i,
      isCurrentMonth: false,
      date: new Date(year, month + 1, i),
    });
  }

  const monthsBr = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(year, month + offset, 1));
  };

  // Import Brazil national holidays
  const handleImportHolidays = async () => {
    setImportLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
      if (!response.ok) {
        throw new Error('Falha ao buscar feriados na API externa');
      }
      const holidays = await response.json();
      
      const newHolidays = holidays.filter((h: any) => !exceptions.some(e => e.data === h.date));
      
      if (newHolidays.length === 0) {
        setSuccess('Todos os feriados nacionais deste ano já foram importados!');
        setImportLoading(false);
        setTimeout(() => setSuccess(null), 3000);
        return;
      }

      await Promise.all(newHolidays.map((h: any) => 
        api.post('/dia-excecao/', {
          data: h.date,
          trabalha: false,
          descricao: h.name
        })
      ));

      setSuccess(`${newHolidays.length} feriados nacionais importados para o ano ${year}!`);
      fetchExceptions();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao importar feriados. Verifique sua conexão e tente novamente.');
      setTimeout(() => setError(null), 4000);
    } finally {
      setImportLoading(false);
    }
  };

  const sortedExceptions = [...exceptions].sort((a, b) => a.data.localeCompare(b.data));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', maxWidth: '750px', margin: '0 auto', paddingBottom: '60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <h1 style={{ fontSize: '1.8rem', margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Settings size={28} color="var(--primary-cyan)" />
          Configurações do Sistema
        </h1>
      </div>

      {error && (
        <div style={{
          padding: '15px 20px', background: 'rgba(231, 76, 60, 0.12)', border: '1px solid var(--status-rework)',
          borderRadius: '8px', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <AlertCircle size={20} color="var(--status-rework)" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={{
          padding: '15px 20px', background: 'rgba(46, 204, 113, 0.12)', border: '1px solid var(--status-completed)',
          borderRadius: '8px', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <CheckCircle size={20} color="var(--status-completed)" />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Carregando configurações...
        </div>
      ) : (
        <>
          {/* Card 1: Meu Perfil */}
          <form onSubmit={handleSaveProfile} className="glass-card" style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', color: 'var(--primary-cyan)', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px 0', fontWeight: 500 }}>
                <User size={20} />
                Informações do Perfil
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                Atualize seus dados pessoais e de acesso.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label">Nome Completo</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  value={perfilFirstName}
                  onChange={(e) => setPerfilFirstName(e.target.value)}
                  style={{ height: '42px' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input
                  type="email"
                  required
                  className="form-control"
                  value={perfilEmail}
                  onChange={(e) => setPerfilEmail(e.target.value)}
                  style={{ height: '42px' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="(00) 00000-0000"
                  value={perfilTelefone}
                  onChange={(e) => setPerfilTelefone(e.target.value)}
                  style={{ height: '42px' }}
                />
              </div>

              {user?.role === 'DENTISTA' && (
                <div className="form-group">
                  <label className="form-label">Registro CRO</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    value={perfilCro}
                    onChange={(e) => setPerfilCro(e.target.value)}
                    style={{ height: '42px' }}
                  />
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '10px' }}>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--primary-cyan)', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 15px 0', fontWeight: 500 }}>
                <Lock size={18} />
                Alterar Senha (Opcional)
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Nova Senha</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Deixe em branco para manter"
                    value={perfilPassword}
                    onChange={(e) => setPerfilPassword(e.target.value)}
                    style={{ height: '42px' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Confirmar Nova Senha</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Confirme a nova senha"
                    value={perfilConfirmPassword}
                    onChange={(e) => setPerfilConfirmPassword(e.target.value)}
                    style={{ height: '42px' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button type="submit" className="btn btn-primary" disabled={profileSaveLoading} style={{ minWidth: '180px' }}>
                <Save size={18} />
                <span>{profileSaveLoading ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </form>

          {/* Card 2: Calendário */}
          <div className="glass-card" style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '15px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', color: 'var(--primary-cyan)', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px 0', fontWeight: 500 }}>
                  <Calendar size={20} />
                  Calendário de Dias Úteis
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                  {isAdmin ? 'Gerencie exceções de expediente. Clique em um dia para alternar seu status (trabalhado / não trabalhado).' : 'Visualize exceções de expediente no calendário.'}
                </p>
              </div>
              
              {isAdmin && (
                <button
                  onClick={handleImportHolidays}
                  disabled={importLoading}
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem', padding: '8px 14px', minWidth: '180px', background: 'transparent', border: '1px solid var(--primary-cyan)', color: 'var(--primary-cyan)' }}
                >
                  {importLoading ? <RefreshCw size={16} className="spin" style={{ marginRight: '8px' }} /> : <Download size={16} style={{ marginRight: '8px' }} />}
                  Importar Feriados {year}
                </button>
              )}
            </div>

            {/* Calendar Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 500 }}>
                {monthsBr[month]} {year}
              </h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => changeMonth(-1)} 
                  className="btn" 
                  style={{ padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <ChevronLeft size={18} />
                </button>
                <button 
                  onClick={() => changeMonth(1)} 
                  className="btn" 
                  style={{ padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {/* Grid Layout */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Weekday Headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center' }}>
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                  <div key={day} style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', paddingBottom: '5px' }}>
                    {day}
                  </div>
                ))}
              </div>

              {/* Days Cells */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
                {daysGrid.map(({ day, isCurrentMonth, date }, idx) => {
                  const dateStr = formatDateLocal(date);
                  const exc = exceptions.find(e => e.data === dateStr);
                  const weekday = date.getDay();
                  const isDefaultWorking = weekday !== 0 && weekday !== 6;

                  let isWorking = isDefaultWorking;
                  if (exc) {
                    isWorking = exc.trabalha;
                  }

                  let cellBg = isWorking ? 'rgba(255, 255, 255, 0.02)' : 'rgba(239, 68, 68, 0.05)';
                  let cellBorder = '1px solid var(--border-color)';
                  let cellTextColor = 'var(--text-main)';
                  let label = '';

                  if (isCurrentMonth) {
                    if (exc) {
                      if (exc.trabalha) {
                        cellBg = 'rgba(46, 204, 113, 0.15)';
                        cellBorder = '1px solid var(--status-completed)';
                        cellTextColor = '#2ecc71';
                        label = 'Extra';
                      } else {
                        cellBg = 'rgba(231, 76, 60, 0.15)';
                        cellBorder = '1px solid var(--status-rework)';
                        cellTextColor = '#e74c3c';
                        label = 'Folga';
                      }
                    } else if (!isDefaultWorking) {
                      cellBg = 'rgba(255, 255, 255, 0.005)';
                      cellBorder = '1px dashed var(--border-color)';
                      cellTextColor = 'var(--text-muted)';
                      label = 'Fim de Sem.';
                    }
                  } else {
                    // Out of month
                    cellBg = 'transparent';
                    cellBorder = '1px solid transparent';
                    cellTextColor = 'rgba(255, 255, 255, 0.1)';
                  }

                  return (
                    <button
                      key={idx}
                      disabled={!isCurrentMonth}
                      onClick={() => isAdmin && handleToggleDay(date)}
                      style={{
                        height: '75px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: cellBg,
                        border: cellBorder,
                        color: cellTextColor,
                        cursor: isCurrentMonth && isAdmin ? 'pointer' : 'default',
                        opacity: isCurrentMonth ? 1 : 0.3,
                        transition: 'all 0.2s ease',
                        textAlign: 'left',
                        position: 'relative'
                      }}
                      className={isCurrentMonth && isAdmin ? 'calendar-day-btn' : ''}
                    >
                      <span style={{ fontSize: '1rem', fontWeight: 600 }}>{day}</span>
                      {label && (
                        <span style={{ fontSize: '0.65rem', padding: '2px 4px', borderRadius: '3px', background: 'rgba(0,0,0,0.3)', fontWeight: 500, alignSelf: 'stretch', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {label}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }} />
                <span>Dia de Trabalho Padrão (Seg-Sex)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', border: '1px dashed var(--border-color)', background: 'rgba(255,255,255,0.005)' }} />
                <span>Descanso Padrão (Sáb-Dom)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', border: '1px solid var(--status-completed)', background: 'rgba(46, 204, 113, 0.15)' }} />
                <span>Trabalho Extra (Exceção)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', border: '1px solid var(--status-rework)', background: 'rgba(231, 76, 60, 0.15)' }} />
                <span>Folga / Feriado (Exceção)</span>
              </div>
            </div>
          </div>

          {/* Card 3: Lista em Tabela */}
          <div className="glass-card" style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div 
              onClick={() => setShowHolidaysList(!showHolidaysList)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
            >
              <div>
                <h2 style={{ fontSize: '1.25rem', color: 'var(--primary-cyan)', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px 0', fontWeight: 500 }}>
                  <Settings size={20} />
                  Lista de Feriados e Exceções Configurados
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                  Clique para {showHolidaysList ? 'ocultar' : 'visualizar'} e remover folgas, feriados ou turnos extras programados.
                </p>
              </div>
              <div style={{ color: 'var(--primary-cyan)', display: 'flex', alignItems: 'center', transition: 'transform 0.2s' }}>
                {showHolidaysList ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
              </div>
            </div>

            {showHolidaysList && (
              <>
                {sortedExceptions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                    Nenhum feriado ou dia de folga customizado foi cadastrado ainda.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '12px 15px', fontWeight: 600, color: 'var(--text-muted)' }}>Data</th>
                      <th style={{ padding: '12px 15px', fontWeight: 600, color: 'var(--text-muted)' }}>Tipo</th>
                      <th style={{ padding: '12px 15px', fontWeight: 600, color: 'var(--text-muted)' }}>Descrição</th>
                      {isAdmin && <th style={{ padding: '12px 15px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedExceptions.map((exc) => {
                      const formattedDate = exc.data.split('-').reverse().join('/');
                      return (
                        <tr key={exc.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s', background: 'rgba(255,255,255,0.01)' }}>
                          <td style={{ padding: '12px 15px', fontWeight: 500 }}>{formattedDate}</td>
                          <td style={{ padding: '12px 15px' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              background: exc.trabalha ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                              color: exc.trabalha ? '#2ecc71' : '#e74c3c',
                              border: exc.trabalha ? '1px solid rgba(46, 204, 113, 0.3)' : '1px solid rgba(231, 76, 60, 0.3)'
                            }}>
                              {exc.trabalha ? 'Trabalho Extra' : 'Folga / Feriado'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 15px', color: 'var(--text-muted)' }}>
                            {editingId === exc.id && isAdmin ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="text"
                                  className="form-control"
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveDescription(exc.id);
                                    if (e.key === 'Escape') setEditingId(null);
                                  }}
                                  style={{
                                    height: '32px',
                                    padding: '4px 8px',
                                    fontSize: '0.85rem',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    color: '#fff',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '4px',
                                    width: '100%',
                                    maxWidth: '220px'
                                  }}
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveDescription(exc.id)}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--status-completed)', cursor: 'pointer', display: 'flex', padding: '4px' }}
                                  title="Salvar"
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--status-rework)', cursor: 'pointer', display: 'flex', padding: '4px' }}
                                  title="Cancelar"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>{exc.descricao || '-'}</span>
                                {isAdmin && (
                                  <button
                                    onClick={() => {
                                      setEditingId(exc.id);
                                      setEditingText(exc.descricao || '');
                                    }}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: 'var(--text-muted)',
                                      cursor: 'pointer',
                                      padding: '4px',
                                      display: 'inline-flex',
                                      opacity: 0.6,
                                      transition: 'opacity 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                                    title="Editar descrição"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          {isAdmin && (
                            <td style={{ padding: '12px 15px', textAlign: 'right' }}>
                              <button
                                onClick={() => handleDeleteException(exc.id)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--status-rework)',
                                  cursor: 'pointer',
                                  padding: '5px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'transform 0.2s'
                                }}
                                title="Remover exceção e voltar para o padrão"
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.15)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                  </div>
                )}
              </>
            )}
          </div>

        </>
      )}
    </div>
  );
};

export default Configuracoes;
