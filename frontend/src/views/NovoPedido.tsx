import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeft, Upload, Trash, AlertCircle, FilePlus, Plus, Eye, EyeOff, Save } from 'lucide-react';


interface ServicoDB {
  id: number;
  nome: string;
  valor: string;
  ativo: boolean;
  tipo: 'ELEMENTO' | 'ARCADA' | 'BOCA';
  requer_implante?: boolean;
}

const NovoPedido: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const [servicosDB, setServicosDB] = useState<ServicoDB[]>([]);
  const [diasExcecao, setDiasExcecao] = useState<{ id: number, data: string, trabalha: boolean, descricao: string }[]>([]);
  const [nomePaciente, setNomePaciente] = useState('');
  const [sexo, setSexo] = useState<'M' | 'F'>('M');
  const [tipoServico, setTipoServico] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [config, setConfig] = useState<{ inicio_expediente: string, fim_expediente: string, prazo_urgencia: number } | null>(null);
  const [estimatedDeadline, setEstimatedDeadline] = useState<Date | null>(null);
  const [componentesImplante, setComponentesImplante] = useState<{ dentes: number[], marcaModelo: string }[]>([{ dentes: [], marcaModelo: '' }]);
  const [implantTeethSemComponente, setImplantTeethSemComponente] = useState<number[]>([]);
  const [existingFiles, setExistingFiles] = useState<any[]>([]);
  const [pedidoVersion, setPedidoVersion] = useState<string | null>(null);

  useEffect(() => {
    if (isEditMode) {
      const fetchPedido = async () => {
        try {
          setLoading(true);
          const response = await api.get(`/pedidos/${id}/`);
          const p = response.data;
          
          if (p.status !== 'PENDENTE' && p.status !== 'RETRABALHO_CLIENTE') {
            setError('Não é permitido editar pedidos em produção ou finalizados.');
            setTimeout(() => navigate(`/pedidos/${id}`), 3000);
            return;
          }

          setNomePaciente(p.nome_paciente);
          setSexo(p.sexo);
          setObservacoes(p.observacoes || '');
          setUrgente(p.urgente);
          setPedidoVersion(p.updated_at);
          
          if (p.elementos) {
            try {
              const parsed = JSON.parse(p.elementos);
              const normalized: Record<number, string[]> = {};
              Object.entries(parsed).forEach(([key, val]) => {
                const toothNum = Number(key);
                if (Array.isArray(val)) {
                  normalized[toothNum] = val;
                } else if (typeof val === 'string') {
                  normalized[toothNum] = [val];
                } else {
                  normalized[toothNum] = [];
                }
              });
              setElementsMap(normalized);
            } catch (e) {
              console.error(e);
            }
          }
          if (p.componentes_implante) {
            try {
              const parsedComp = JSON.parse(p.componentes_implante);
              setComponentesImplante(parsedComp);
              
              // Reconstrói quais dentes foram marcados como "Sem implante"
              if (p.elementos) {
                const parsedElem = JSON.parse(p.elementos);
                const allImplant = Object.entries(parsedElem)
                  .filter(([_, services]) => {
                    const sList = Array.isArray(services) ? services : [String(services)];
                    return sList.some(s => String(s).includes('Sobre Implante'));
                  })
                  .map(([num]) => Number(num));
                
                const compTeeth = new Set<number>();
                parsedComp.forEach((c: any) => c.dentes?.forEach((d: number) => compTeeth.add(d)));
                
                const excluded = allImplant.filter(t => !compTeeth.has(t));
                setImplantTeethSemComponente(excluded);
              }
            } catch (e) {
              console.error(e);
            }
          }
          if (p.anexos) {
            setExistingFiles(p.anexos);
          }
        } catch (err: any) {
          console.error(err);
          setError('Erro ao carregar detalhes do caso para edição.');
        } finally {
          setLoading(false);
        }
      };
      fetchPedido();
    }
  }, [id, isEditMode]);


  React.useEffect(() => {
    const fetchConfigAndServicos = async () => {
      try {
        const [configRes, servicosRes, excecaoRes] = await Promise.all([
          api.get('/pedidos/configuracao/'),
          api.get('/servicos/?ativo=true'),
          api.get('/dia-excecao/')
        ]);
        setConfig(configRes.data);
        setServicosDB(servicosRes.data);
        setDiasExcecao(excecaoRes.data || []);
      } catch (e) {
        console.error('Falha ao buscar configurações, serviços ou exceções:', e);
      }
    };
    fetchConfigAndServicos();
  }, []);

  React.useEffect(() => {
    if (!config) return;

    const calculateDeadline = () => {
      const now = new Date();
      
      const [startH, startM] = config.inicio_expediente.split(':').map(Number);
      const [endH, endM] = config.fim_expediente.split(':').map(Number);
      
      const isDayOff = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        // Checar se há uma exceção cadastrada para este dia
        const exc = diasExcecao.find(e => e.data === dateStr);
        if (exc) {
          // Se "trabalha" for falso, o dia é folga
          return !exc.trabalha;
        }

        // Se não houver exceção, regra padrão: fim de semana é folga
        const weekday = date.getDay();
        return weekday === 0 || weekday === 6;
      };

      const adjustToBusinessHours = (date: Date) => {
        let current = new Date(date);
        while (true) {
          if (isDayOff(current)) {
            current.setDate(current.getDate() + 1);
            current.setHours(startH, startM, 0, 0);
            continue;
          }
          
          const curH = current.getHours();
          const curM = current.getMinutes();
          const curTime = curH + curM / 60;
          const startTimeVal = startH + startM / 60;
          const endTimeVal = endH + endM / 60;

          if (curTime < startTimeVal) {
            current.setHours(startH, startM, 0, 0);
            break;
          } else if (curTime >= endTimeVal) {
            current.setDate(current.getDate() + 1);
            current.setHours(startH, startM, 0, 0);
            continue;
          } else {
            break;
          }
        }
        return current;
      };

      let d = adjustToBusinessHours(now);
      
      const workdayHours = (endH + endM / 60) - (startH + startM / 60);
      const hoursToAdd = urgente ? (config.prazo_urgencia || 3) : (workdayHours > 0 ? workdayHours : 10);
      
      let remainingMs = hoursToAdd * 60 * 60 * 1000;

      while (remainingMs > 0) {
        d = adjustToBusinessHours(d);
        
        const dEnd = new Date(d);
        dEnd.setHours(endH, endM, 0, 0);
        
        const msAvailableToday = dEnd.getTime() - d.getTime();
        
        if (msAvailableToday >= remainingMs) {
          d = new Date(d.getTime() + remainingMs);
          remainingMs = 0;
        } else {
          remainingMs -= msAvailableToday;
          d.setDate(d.getDate() + 1);
          d.setHours(startH, startM, 0, 0);
        }
      }

      setEstimatedDeadline(d);
    };

    calculateDeadline();
    const timer = setInterval(calculateDeadline, 60000);
    return () => clearInterval(timer);
  }, [config, urgente, diasExcecao]);

  // Odontogram selection (Map tooth -> services[])
  const [elementsMap, setElementsMap] = useState<Record<number, string[]>>({});

  // File Upload
  const [files, setFiles] = useState<File[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const upperTeeth = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  const lowerTeeth = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

  const [showCisos, setShowCisos] = useState(false);
  const handleToggleCisos = () => {
    const nextVal = !showCisos;
    setShowCisos(nextVal);
    
    const newMap = { ...elementsMap };
    const cisos = [18, 28, 38, 48];
    let changed = false;

    if (nextVal) {
      // CISOS ESTÃO SENDO EXIBIDOS (nextVal === true):
      // Restaura apenas serviços de Boca Inteira ou Arcada Inteira
      // se os demais dentes estiverem com esses serviços marcados.

      const bocaServices = servicosDB.filter(s => s.tipo === 'BOCA').map(s => s.nome);
      const arcadaServices = servicosDB.filter(s => s.tipo === 'ARCADA').map(s => s.nome);

      // 1. Boca Inteira
      const nonCisoTeeth = [...upperTeeth, ...lowerTeeth].filter(t => !cisos.includes(t));
      bocaServices.forEach(bocaService => {
        const hasService = nonCisoTeeth.some(t => (newMap[t] || []).includes(bocaService));
        if (hasService) {
          cisos.forEach(num => {
            const current = newMap[num] || [];
            if (!current.includes(bocaService)) {
              newMap[num] = [...current, bocaService];
              changed = true;
            }
          });
        }
      });

      // 2. Arcada Inteira no arco superior (18, 28)
      const upperNonCisos = upperTeeth.filter(t => !cisos.includes(t));
      arcadaServices.forEach(arcadaService => {
        const hasUpperService = upperNonCisos.some(t => (newMap[t] || []).includes(arcadaService));
        if (hasUpperService) {
          [18, 28].forEach(num => {
            const current = newMap[num] || [];
            if (!current.includes(arcadaService)) {
              newMap[num] = [...current, arcadaService];
              changed = true;
            }
          });
        }
      });

      // 3. Arcada Inteira no arco inferior (38, 48)
      const lowerNonCisos = lowerTeeth.filter(t => !cisos.includes(t));
      arcadaServices.forEach(arcadaService => {
        const hasLowerService = lowerNonCisos.some(t => (newMap[t] || []).includes(arcadaService));
        if (hasLowerService) {
          [38, 48].forEach(num => {
            const current = newMap[num] || [];
            if (!current.includes(arcadaService)) {
              newMap[num] = [...current, arcadaService];
              changed = true;
            }
          });
        }
      });

      // Qualquer outro serviço individual (marcado elemento por elemento) NÃO é restaurado.
    } else {
      // CISOS ESTÃO SENDO OCULTADOS (nextVal === false):
      // Todo o serviço vinculado a esses dentes some completamente.
      cisos.forEach(num => {
        if (newMap[num]) {
          delete newMap[num];
          changed = true;
        }
      });
    }

    if (changed) {
      setElementsMap(newMap);
    }
  };
  const displayedUpperTeeth = showCisos ? upperTeeth : upperTeeth.filter(t => t !== 18 && t !== 28);
  const displayedLowerTeeth = showCisos ? lowerTeeth : lowerTeeth.filter(t => t !== 48 && t !== 38);
  const anteriorTeeth = [13, 12, 11, 21, 22, 23, 43, 42, 41, 31, 32, 33];

  const upperFront6 = [13, 12, 11, 21, 22, 23];
  const lowerFront6 = [43, 42, 41, 31, 32, 33];
  const upperMolars = [18, 17, 16, 15, 14, 24, 25, 26, 27, 28].filter(t => showCisos || (t !== 18 && t !== 28));
  const lowerMolars = [48, 47, 46, 45, 44, 34, 35, 36, 37, 38].filter(t => showCisos || (t !== 48 && t !== 38));

  const selectGroup = (teethList: number[]) => {
    if (!tipoServico) {
      setError('Selecione primeiro o "Tipo de Serviço" ativo no painel inferior antes de usar os atalhos de seleção.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setError(null), 3500);
      return;
    }
    const newMap = { ...elementsMap };
    teethList.forEach((num) => {
      const currentServices = newMap[num] || [];
      if (!currentServices.includes(tipoServico)) {
        newMap[num] = [...currentServices, tipoServico];
      }
    });
    setElementsMap(newMap);
  };

  const clearAllSelection = () => {
    setElementsMap({});
    setComponentesImplante([{ dentes: [], marcaModelo: '' }]);
  };

  const getServiceColor = (serviceName: string) => {
    const defaultColors: Record<string, string> = {
      'Coroa Sobre Implante': '#e74c3c',
      'Coroa Sobre Preparo': '#e67e22',
      'Copping Sobre Preparo': '#f1c40f',
      'Copping Sobre Implante': '#f39c12',
      'Inlay/Onlay Sobre Preparo': '#1abc9c',
      'Protocolo Sobre Implante': '#2ecc71',
      'Enceramento Para Diagnóstico': '#3498db',
      'Provisório Oco': '#9b59b6',
      'Modelo': '#34495e',
      'Placa Para Bruxismo': '#95a5a6'
    };
    if (defaultColors[serviceName]) return defaultColors[serviceName];
    
    // Hash determinístico para novos serviços
    let hash = 0;
    for (let i = 0; i < serviceName.length; i++) {
      hash = serviceName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 55%)`;
  };

  const removeServiceFromAll = (serviceToRemove: string) => {
    const newMap = { ...elementsMap };
    Object.keys(newMap).forEach((toothStr) => {
      const num = Number(toothStr);
      newMap[num] = newMap[num].filter(s => s !== serviceToRemove);
      if (newMap[num].length === 0) delete newMap[num];
    });
    setElementsMap(newMap);
  };

  const removeServiceFromTooth = (serviceToRemove: string, toothNum: number) => {
    const newMap = { ...elementsMap };
    if (newMap[toothNum]) {
      newMap[toothNum] = newMap[toothNum].filter(s => s !== serviceToRemove);
      if (newMap[toothNum].length === 0) delete newMap[toothNum];
      setElementsMap(newMap);
    }
  };

  const toggleTooth = (num: number) => {
    if (!tipoServico) {
      setError('Selecione primeiro o "Tipo de Serviço" ativo no painel inferior antes de clicar no dente.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setError(null), 3500);
      return;
    }

    const servicoObj = servicosDB.find(s => s.nome === tipoServico);
    const isBoca = servicoObj?.tipo === 'BOCA';
    const isArcada = servicoObj?.tipo === 'ARCADA';

    const currentServices = elementsMap[num] || [];
    const newMap = { ...elementsMap };

    // Se o dente já tem o serviço selecionado no pincel
    if (currentServices.includes(tipoServico)) {

      if (isBoca) {
        const allDisplayedTeeth = [...displayedUpperTeeth, ...displayedLowerTeeth];
        allDisplayedTeeth.forEach(t => {
          if (newMap[t]) {
            newMap[t] = newMap[t].filter(s => s !== tipoServico);
            if (newMap[t].length === 0) delete newMap[t];
          }
        });
        setElementsMap(newMap);
        return;
      }

      if (isArcada) {
        const arch = displayedUpperTeeth.includes(num) ? displayedUpperTeeth : displayedLowerTeeth;
        arch.forEach(t => {
          if (newMap[t]) {
            newMap[t] = newMap[t].filter(s => s !== tipoServico);
            if (newMap[t].length === 0) delete newMap[t];
          }
        });
        setElementsMap(newMap);
        return;
      }

      // Default: remove apenas de 1 dente
      const filtered = currentServices.filter(s => s !== tipoServico);
      if (filtered.length === 0) delete newMap[num];
      else newMap[num] = filtered;

      setElementsMap(newMap);
      return;
    }

    // Lógica de adição
    if (isBoca) {
      const allDisplayedTeeth = [...displayedUpperTeeth, ...displayedLowerTeeth];
      allDisplayedTeeth.forEach(t => {
        const current = newMap[t] || [];
        if (!current.includes(tipoServico)) {
          newMap[t] = [...current, tipoServico];
        }
      });
      setElementsMap(newMap);
      return;
    }

    if (isArcada) {
      const arch = displayedUpperTeeth.includes(num) ? displayedUpperTeeth : displayedLowerTeeth;
      arch.forEach(t => {
        const current = newMap[t] || [];
        if (!current.includes(tipoServico)) {
          newMap[t] = [...current, tipoServico];
        }
      });
      setElementsMap(newMap);
      return;
    }

    // Adição normal para 1 dente
    newMap[num] = [...currentServices, tipoServico];
    setElementsMap(newMap);
  };

  const toggleArch = (archTeeth: number[]) => {
    if (!tipoServico) {
      setError('Selecione primeiro o serviço ativo na Ferramenta Pincel.');
      setTimeout(() => setError(null), 3500);
      return;
    }

    const newMap = { ...elementsMap };
    const allHaveService = archTeeth.every(num => (newMap[num] || []).includes(tipoServico));

    if (allHaveService) {
      archTeeth.forEach(num => {
        const current = newMap[num] || [];
        const filtered = current.filter(s => s !== tipoServico);
        if (filtered.length === 0) delete newMap[num];
        else newMap[num] = filtered;
      });
    } else {
      archTeeth.forEach(num => {
        const current = newMap[num] || [];
        if (!current.includes(tipoServico)) {
          newMap[num] = [...current, tipoServico];
        }
      });
    }
    setElementsMap(newMap);
  };

  const isImplantService = (serviceName: string) => {
    const servObj = servicosDB.find(s => s.nome === serviceName);
    if (servObj && typeof servObj.requer_implante === 'boolean') {
      return servObj.requer_implante;
    }
    return serviceName?.includes('Sobre Implante');
  };

  const implantTeeth = Object.entries(elementsMap)
    .filter(([_, services]) => services?.some(isImplantService))
    .map(([num]) => Number(num));

  const hasImplantService = implantTeeth.length > 0;
  const implantTeethRequired = implantTeeth.filter(t => !implantTeethSemComponente.includes(t));

  const currentServObj = servicosDB.find(s => s.nome === tipoServico);
  const isGlobalOrArcada = currentServObj ? (currentServObj.tipo === 'ARCADA' || currentServObj.tipo === 'BOCA') : false;

  // Cleanup lost teeth from the component list if they are deselected
  React.useEffect(() => {
    setImplantTeethSemComponente(prev => {
      const filtered = prev.filter(t => implantTeeth.includes(t));
      if (filtered.length === prev.length) return prev;
      return filtered;
    });

    setComponentesImplante(prev => {
      let changed = false;
      const valid = prev.map(c => {
        const filtered = c.dentes.filter(t => implantTeeth.includes(t) && !implantTeethSemComponente.includes(t));
        if (filtered.length !== c.dentes.length) changed = true;
        return { ...c, dentes: filtered };
      });
      if (!changed) return prev;
      const filteredValid = valid.filter(c => c.dentes.length > 0 || c.marcaModelo.trim() !== '');
      return filteredValid.length > 0 ? filteredValid : [{ dentes: [], marcaModelo: '' }];
    });
  }, [elementsMap]);

  const toggleImplantRequirement = (tooth: number) => {
    setImplantTeethSemComponente(prev => {
      const exists = prev.includes(tooth);
      if (exists) {
        return prev.filter(t => t !== tooth);
      } else {
        // Remove from all components
        setComponentesImplante(compPrev => 
          compPrev.map(c => ({
            ...c,
            dentes: c.dentes.filter(t => t !== tooth)
          }))
        );
        return [...prev, tooth];
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles([...files, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleComponenteTextChange = (index: number, value: string) => {
    const novosComponentes = [...componentesImplante];
    novosComponentes[index] = { ...novosComponentes[index], marcaModelo: value };
    setComponentesImplante(novosComponentes);
  };

  const toggleToothForComponent = (compIdx: number, tooth: number) => {
    const novos = [...componentesImplante];
    const isSelectedHere = novos[compIdx].dentes.includes(tooth);
    const isExcluded = implantTeethSemComponente.includes(tooth);

    if (!isSelectedHere && !isExcluded) {
      // Estado 1: Selecionado neste componente
      novos.forEach((c, _i) => {
        c.dentes = c.dentes.filter(t => t !== tooth);
      });
      setImplantTeethSemComponente(prev => prev.filter(t => t !== tooth));
      novos[compIdx].dentes = [...novos[compIdx].dentes, tooth];
    } else if (isSelectedHere) {
      // Estado 2: Oculto/Excluído (Pôntico)
      novos[compIdx].dentes = novos[compIdx].dentes.filter(t => t !== tooth);
      setImplantTeethSemComponente(prev => {
        if (!prev.includes(tooth)) return [...prev, tooth];
        return prev;
      });
    } else if (isExcluded) {
      // Estado 3: Reset / Desmarcado
      setImplantTeethSemComponente(prev => prev.filter(t => t !== tooth));
    }
    setComponentesImplante(novos);
  };

  const handleSelectAllForComponent = (compIdx: number) => {
    const novos = [...componentesImplante];
    const availableTeeth = implantTeethRequired.filter(t => {
      const isSelectedElsewhere = componentesImplante.some((c, i) => i !== compIdx && c.dentes.includes(t));
      return !isSelectedElsewhere;
    });
    novos[compIdx].dentes = availableTeeth;
    setComponentesImplante(novos);
  };


  const addComponente = () => {
    const unmappedTeeth = implantTeethRequired.filter(t => !componentesImplante.some(c => c.dentes.includes(t)));
    if (unmappedTeeth.length > 0) {
      setComponentesImplante([...componentesImplante, { dentes: [], marcaModelo: '' }]);
    }
  };

  const removeComponente = (index: number) => {
    if (componentesImplante.length > 1) {
      setComponentesImplante(componentesImplante.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const selectedTeeth = Object.keys(elementsMap).map(Number);
    if (selectedTeeth.length === 0) {
      setError('Por favor, selecione o serviço e carimbe em pelo menos um dente no odontograma.');
      return;
    }

    if (files.length === 0 && existingFiles.length === 0) {
      setError('Por favor, envie pelo menos um arquivo de scanner STL/PLY ou imagem.');
      return;
    }

    if (hasImplantService) {
      const unmappedTeeth = implantTeethRequired.filter(t => !componentesImplante.some(c => c.dentes.includes(t)));
      if (unmappedTeeth.length > 0) {
        setError(`Ainda faltam componentes para os dentes sobre implante: ${unmappedTeeth.join(', ')}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const temVazio = componentesImplante.some(c => c.dentes.length > 0 && !c.marcaModelo.trim());
      if (temVazio) {
        setError('Por favor, preencha a marca/modelo de todos os componentes de implante selecionados.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    setLoading(true);

    try {
      const dentesString = selectedTeeth.sort((a, b) => a - b).join(', ');

      const allSelectedServices = new Set<string>();
      Object.values(elementsMap).forEach(services => {
        services.forEach(s => allSelectedServices.add(s));
      });

      let tipoServicoSummary = Array.from(allSelectedServices).join(', ');
      if (tipoServicoSummary.length === 0) {
        tipoServicoSummary = 'Nenhum serviço especificado';
      }

      const pedidoData = {
        nome_paciente: nomePaciente,
        sexo: sexo,
        tipo_servico: tipoServicoSummary,
        componentes_implante: hasImplantService ? JSON.stringify(componentesImplante.filter(c => c.dentes.length > 0)) : null,
        observacoes: observacoes,
        dentes: dentesString,
        elementos: JSON.stringify(elementsMap),
        urgente: urgente,
      };

      // 2. Post or Patch Pedido
      let pedidoId = id;
      if (isEditMode) {
        const payload = {
          ...pedidoData,
          updated_at: pedidoVersion
        };
        const response = await api.patch(`/pedidos/${id}/`, payload);
        pedidoId = response.data.id;
      } else {
        const response = await api.post('/pedidos/', pedidoData);
        pedidoId = response.data.id;
      }

      // 3. Upload files
      for (const file of files) {
        const formData = new FormData();
        formData.append('arquivo', file);
        formData.append('descricao', file.name.endsWith('.stl') || file.name.endsWith('.ply') ? 'Modelo 3D' : 'Anexo Clínico');

        await api.post(`/pedidos/${pedidoId}/upload_anexo/`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }

      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      let errorMsg = 'Erro ao salvar pedido. Por favor, revise os campos.';
      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMsg = err.response.data;
        } else if (err.response.data.error) {
          errorMsg = err.response.data.error;
        } else if (err.response.data.detail) {
          errorMsg = err.response.data.detail;
        } else if (typeof err.response.data === 'object') {
          const fieldErrors = Object.entries(err.response.data)
            .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(' ') : msgs}`)
            .join(' | ');
          if (fieldErrors) errorMsg = fieldErrors;
        }
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Back Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <button
          onClick={() => navigate('/dashboard')}
          className="btn btn-secondary"
          style={{ padding: '8px 12px' }}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ fontSize: '1.8rem', margin: 0, fontWeight: 600 }}>
          {isEditMode ? 'Editar Prótese' : 'Solicitar Nova Prótese'}
        </h1>
      </div>

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(231, 76, 60, 0.1)',
            border: '1px solid var(--status-rework)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px',
            color: 'var(--status-rework)',
          }}
        >
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>

        {/* Odontograma Visual Container com Layout de 2 Colunas */}
        <div style={{ display: 'grid', gridTemplateColumns: '340px minmax(0, 1fr)', gap: '24px', alignItems: 'start' }}>

          {/* Coluna Esquerda: Painel de Controles & Pincel de Serviços */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Card do Pincel de Serviços */}
            <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--primary-cyan)', margin: 0 }}>
                  Serviço Ativo
                </h3>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {tipoServico && (
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: getServiceColor(tipoServico), flexShrink: 0 }} />
                )}
                <select
                  className="form-control"
                  style={{ flex: 1, border: '1px solid var(--primary-cyan)', height: '45px', fontSize: '0.85rem', backgroundColor: '#141b2d', color: 'var(--text-main)' }}
                  value={tipoServico}
                  onChange={(e) => setTipoServico(e.target.value)}
                >
                  <option value="" disabled hidden style={{ fontStyle: 'italic', backgroundColor: '#141b2d' }}>Selecione o serviço...</option>
                  {(() => {
                    const unitarios = servicosDB.filter(s => s.tipo === 'ELEMENTO');
                    const arcada = servicosDB.filter(s => s.tipo === 'ARCADA');
                    const boca = servicosDB.filter(s => s.tipo === 'BOCA');
                    return (
                      <>
                        {unitarios.length > 0 && (
                          <optgroup label="── UNITÁRIO / POR DENTE ──" style={{ color: 'var(--primary-cyan)', fontStyle: 'normal', fontWeight: 600, background: '#141b2d' }}>
                            {unitarios.map(s => (
                              <option key={s.id} value={s.nome} style={{ color: '#ffffff', fontWeight: 'normal', background: '#141b2d' }}>{s.nome}</option>
                            ))}
                          </optgroup>
                        )}
                        {arcada.length > 0 && (
                          <optgroup label="── POR ARCADA ──" style={{ color: '#f5a623', fontStyle: 'normal', fontWeight: 600, background: '#141b2d' }}>
                            {arcada.map(s => (
                              <option key={s.id} value={s.nome} style={{ color: '#ffffff', fontWeight: 'normal', background: '#141b2d' }}>{s.nome}</option>
                            ))}
                          </optgroup>
                        )}
                        {boca.length > 0 && (
                          <optgroup label="── BOCA INTEIRA / MODELO ──" style={{ color: '#e879f9', fontStyle: 'normal', fontWeight: 600, background: '#141b2d' }}>
                            {boca.map(s => (
                              <option key={s.id} value={s.nome} style={{ color: '#ffffff', fontWeight: 'normal', background: '#141b2d' }}>{s.nome}</option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    );
                  })()}
                </select>
              </div>
            </div>

            {/* Card de Controles de Seleção */}
            <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', minHeight: '28px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--primary-cyan)', margin: 0 }}>
                  Controles de Seleção
                </h3>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', minHeight: '26px' }}>
                  {tipoServico && Object.values(elementsMap).some(services => services.includes(tipoServico)) && (
                    <button
                      type="button"
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--status-rework)',
                        border: '1px solid rgba(231, 76, 60, 0.3)',
                        background: 'rgba(231, 76, 60, 0.08)',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => removeServiceFromAll(tipoServico)}
                      title={`Limpar dentes marcados com "${tipoServico}"`}
                    >
                      Limpar seleção
                    </button>
                  )}
                </div>
              </div>

              {/* Dentes Selecionados Badge */}
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Dentes selecionados:
                <span style={{
                  background: 'rgba(0, 242, 254, 0.15)',
                  color: 'var(--primary-cyan)',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.8rem'
                }}>
                  {Object.keys(elementsMap).length}
                </span>
              </div>

              {/* Botões de Atalho em formato Pill Grid */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                opacity: isGlobalOrArcada ? 0.35 : 1,
                pointerEvents: isGlobalOrArcada ? 'none' : 'auto',
                transition: 'all 0.2s ease-in-out'
              }}>
                
                {/* Linha 1 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={isGlobalOrArcada}
                    style={{ padding: '8px 4px', fontSize: '0.75rem', borderRadius: '12px', justifyContent: 'center' }}
                    onClick={() => selectGroup([...displayedUpperTeeth, ...displayedLowerTeeth])}
                  >
                    Boca Toda
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={isGlobalOrArcada}
                    style={{ padding: '8px 4px', fontSize: '0.75rem', borderRadius: '12px', justifyContent: 'center' }}
                    onClick={() => selectGroup(anteriorTeeth)}
                  >
                    Anteriores (12)
                  </button>
                </div>

                {/* Linha 2: Superior */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={isGlobalOrArcada}
                    style={{ padding: '8px 2px', fontSize: '0.72rem', borderRadius: '12px', justifyContent: 'center' }}
                    onClick={() => selectGroup(displayedUpperTeeth)}
                  >
                    Superior
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={isGlobalOrArcada}
                    style={{ padding: '8px 2px', fontSize: '0.72rem', borderRadius: '12px', justifyContent: 'center' }}
                    onClick={() => selectGroup(upperFront6)}
                  >
                    Sup. Frontal (6)
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={isGlobalOrArcada}
                    style={{ padding: '8px 2px', fontSize: '0.72rem', borderRadius: '12px', justifyContent: 'center' }}
                    onClick={() => selectGroup(upperMolars)}
                  >
                    Molares Sup.
                  </button>
                </div>

                {/* Linha 3: Inferior */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={isGlobalOrArcada}
                    style={{ padding: '8px 2px', fontSize: '0.72rem', borderRadius: '12px', justifyContent: 'center' }}
                    onClick={() => selectGroup(displayedLowerTeeth)}
                  >
                    Inferior
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={isGlobalOrArcada}
                    style={{ padding: '8px 2px', fontSize: '0.72rem', borderRadius: '12px', justifyContent: 'center' }}
                    onClick={() => selectGroup(lowerFront6)}
                  >
                    Inf. Frontal (6)
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={isGlobalOrArcada}
                    style={{ padding: '8px 2px', fontSize: '0.72rem', borderRadius: '12px', justifyContent: 'center' }}
                    onClick={() => selectGroup(lowerMolars)}
                  >
                    Molares Inf.
                  </button>
                </div>

              </div>

              {isGlobalOrArcada && (
                <span style={{ fontSize: '0.72rem', color: 'var(--status-rework)', textAlign: 'center', fontWeight: 500 }}>
                  Atalhos desativados para serviços de Arcada ou Boca.
                </span>
              )}
            </div>

          </div>

          {/* Coluna Direita: Odontograma Chart */}
          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--primary-cyan)', margin: 0 }}>
                  Odontograma Clínico
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
                  Clique no dente para selecionar. Utilize o painel de controles ao lado para seleções rápidas.
                </p>
              </div>

              {/* Toggle Cisos */}
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  color: showCisos ? 'var(--text-muted)' : 'var(--primary-cyan)',
                  borderColor: showCisos ? 'var(--border-color)' : 'var(--primary-cyan)',
                  background: showCisos ? 'transparent' : 'rgba(0, 242, 254, 0.08)',
                  borderRadius: '12px',
                  cursor: 'pointer'
                }}
                onClick={handleToggleCisos}
                title="Ocultar/Exibir Cisos (18, 28, 38, 48)"
              >
                {showCisos ? <EyeOff size={14} style={{ marginRight: '6px' }} /> : <Eye size={14} style={{ marginRight: '6px' }} />}
                {showCisos ? 'Ocultar Cisos' : 'Exibir Cisos'}
              </button>
            </div>

            {/* Grid dos Dentes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', overflowX: 'auto', padding: '10px 0' }}>
              
              {/* Arcada Superior */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '720px' }}>
                
                {/* Números em CIMA para Arcada Superior */}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${displayedUpperTeeth.length}, 1fr)`, gap: '6px', textAlign: 'center' }}>
                  {displayedUpperTeeth.map(num => {
                    const isSelected = (elementsMap[num] || []).length > 0;
                    return (
                      <span key={num} style={{ fontSize: '0.75rem', fontWeight: 700, color: isSelected ? 'var(--primary-cyan)' : 'var(--text-muted)' }}>
                        {num}
                      </span>
                    );
                  })}
                </div>

                {/* Cards de Dentes Superiores (Pill shape) */}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${displayedUpperTeeth.length}, 1fr)`, gap: '6px' }}>
                  {displayedUpperTeeth.map((num) => {
                    const activeServices = elementsMap[num] || [];
                    const isActive = activeServices.length > 0;
                    const activeColor = isActive ? getServiceColor(activeServices[activeServices.length - 1]) : 'var(--primary-cyan)';
                    
                    return (
                      <div
                        key={num}
                        onClick={() => toggleTooth(num)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '12px 2px',
                          minHeight: '85px',
                          borderRadius: '16px',
                          cursor: 'pointer',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          backdropFilter: 'blur(8px)',
                          WebkitBackdropFilter: 'blur(8px)',
                          background: isActive ? `${activeColor}1f` : 'rgba(255, 255, 255, 0.02)',
                          border: isActive ? `2px solid ${activeColor}` : '1px solid rgba(255, 255, 255, 0.08)',
                          boxShadow: isActive ? `0 0 12px ${activeColor}33` : 'none',
                          position: 'relative'
                        }}
                      >
                        <img
                          src={`/odontogram/${num}.png`}
                          alt={`Dente ${num}`}
                          style={{ maxHeight: '48px', maxWidth: '34px', objectFit: 'contain' }}
                        />
                        <div style={{ display: 'flex', gap: '3px', marginTop: '6px', justifyContent: 'center', minHeight: '6px' }}>
                          {isActive && activeServices.map((s, i) => (
                            <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: getServiceColor(s) }} title={s} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Arcada Inferior */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '720px' }}>
                
                {/* Cards de Dentes Inferiores (Pill shape) */}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${displayedLowerTeeth.length}, 1fr)`, gap: '6px' }}>
                  {displayedLowerTeeth.map((num) => {
                    const activeServices = elementsMap[num] || [];
                    const isActive = activeServices.length > 0;
                    const activeColor = isActive ? getServiceColor(activeServices[activeServices.length - 1]) : 'var(--primary-cyan)';
                    
                    return (
                      <div
                        key={num}
                        onClick={() => toggleTooth(num)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '12px 2px',
                          minHeight: '85px',
                          borderRadius: '16px',
                          cursor: 'pointer',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          backdropFilter: 'blur(8px)',
                          WebkitBackdropFilter: 'blur(8px)',
                          background: isActive ? `${activeColor}1f` : 'rgba(255, 255, 255, 0.02)',
                          border: isActive ? `2px solid ${activeColor}` : '1px solid rgba(255, 255, 255, 0.08)',
                          boxShadow: isActive ? `0 0 12px ${activeColor}33` : 'none',
                          position: 'relative'
                        }}
                      >
                        <img
                          src={`/odontogram/${num}.png`}
                          alt={`Dente ${num}`}
                          style={{ maxHeight: '48px', maxWidth: '34px', objectFit: 'contain' }}
                        />
                        <div style={{ display: 'flex', gap: '3px', marginTop: '6px', justifyContent: 'center', minHeight: '6px' }}>
                          {isActive && activeServices.map((s, i) => (
                            <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: getServiceColor(s) }} title={s} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Números em BAIXO para Arcada Inferior */}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${displayedLowerTeeth.length}, 1fr)`, gap: '6px', textAlign: 'center' }}>
                  {displayedLowerTeeth.map(num => {
                    const isSelected = (elementsMap[num] || []).length > 0;
                    return (
                      <span key={num} style={{ fontSize: '0.75rem', fontWeight: 700, color: isSelected ? 'var(--primary-cyan)' : 'var(--text-muted)' }}>
                        {num}
                      </span>
                    );
                  })}
                </div>

              </div>

            </div>
          </div>

        </div>

          {Object.keys(elementsMap).length > 0 && (() => {
            const servicesSummary: Record<string, number[]> = {};
            Object.entries(elementsMap).forEach(([tooth, services]) => {
              services.forEach(s => {
                if (!servicesSummary[s]) servicesSummary[s] = [];
                servicesSummary[s].push(Number(tooth));
              });
            });

            return (
              <div className="animate-fade-in" style={{ marginTop: '25px', padding: '20px', background: 'rgba(0, 242, 254, 0.05)', borderRadius: '8px', border: '1px solid rgba(0, 242, 254, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3 style={{ fontSize: '1.05rem', color: 'var(--primary-cyan)', margin: 0 }}>Resumo de Serviços Atribuídos:</h3>
                  <button
                    type="button"
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--status-rework)',
                      border: '1px solid rgba(231, 76, 60, 0.3)',
                      background: 'rgba(231, 76, 60, 0.08)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onClick={clearAllSelection}
                    title="Remover todos os serviços atribuídos de todos os dentes"
                  >
                    Limpar todos os serviços
                  </button>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '-10px', marginBottom: '15px' }}>
                  Dica: Clique no nome do serviço ou em um número de dente abaixo para excluí-lo.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                  {Object.entries(servicesSummary).map(([service, teeth]) => (
                    <div key={service} style={{ padding: '12px 16px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '6px', border: `1px solid ${getServiceColor(service)}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: getServiceColor(service) }}></div>
                        <span
                          onClick={() => removeServiceFromAll(service)}
                          style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem', cursor: 'pointer', textDecoration: 'underline' }}
                          title="Clique para remover este serviço de todos os dentes"
                        >
                          {service} ({teeth.length})
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                        <strong style={{ color: 'var(--text-main)', marginRight: '4px' }}>Dentes: </strong>
                        {teeth.sort((a, b) => a - b).map((t, idx) => {
                          const servicoObj = servicosDB.find(s => s.nome === service);
                          const isGlobal = servicoObj ? servicoObj.tipo !== 'ELEMENTO' : false;
                          return (
                            <React.Fragment key={t}>
                              {isGlobal ? (
                                <span style={{ color: 'var(--text-muted)' }}>{t}</span>
                              ) : (
                                <span
                                  onClick={() => removeServiceFromTooth(service, t)}
                                  style={{ cursor: 'pointer', color: 'var(--text-muted)' }}
                                  title="Clique para remover deste dente"
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.color = 'var(--status-rework)';
                                    e.currentTarget.style.textDecoration = 'line-through';
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.color = 'var(--text-muted)';
                                    e.currentTarget.style.textDecoration = 'none';
                                  }}
                                >
                                  {t}
                                </span>
                              )}
                              {idx < teeth.length - 1 && <span>, </span>}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

        {/* Informações Gerais */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>

          {/* Dados do Paciente e Serviço */}
          <div className="glass-card" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--primary-blue)' }}>Informações Clínicas</h2>

            <div className="form-group">
              <label className="form-label">Nome do Paciente</label>
              <input
                type="text"
                required
                className="form-control"
                placeholder="Ex: Maria de Oliveira"
                value={nomePaciente}
                onChange={(e) => setNomePaciente(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Sexo do Paciente</label>
              <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="sexo"
                    checked={sexo === 'M'}
                    onChange={() => setSexo('M')}
                    style={{ accentColor: 'var(--primary-cyan)', width: '16px', height: '16px' }}
                  />
                  <span>Masculino</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="sexo"
                    checked={sexo === 'F'}
                    onChange={() => setSexo('F')}
                    style={{ accentColor: 'var(--primary-cyan)', width: '16px', height: '16px' }}
                  />
                  <span>Feminino</span>
                </label>
              </div>
            </div>

            {/* Campo Previsão de Entrega & Botão de Urgência Centralizados */}
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
              <label className="form-label" style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.9rem', textAlign: 'center' }}>
                Previsão de Entrega
              </label>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 24px',
                background: 'rgba(0, 242, 254, 0.05)',
                border: '1px solid rgba(0, 242, 254, 0.25)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--primary-cyan)',
                fontWeight: 700,
                fontSize: '1.1rem',
                width: '100%',
                maxWidth: '380px',
                textAlign: 'center'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📅 {estimatedDeadline ? estimatedDeadline.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Calculando...'}
                </span>
              </div>

              {/* Botão de Urgência separado e condizente com o sistema de design */}
              <button
                type="button"
                onClick={() => setUrgente(!urgente)}
                className={`btn ${urgente ? '' : 'btn-secondary'}`}
                style={{
                  padding: '8px 20px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  background: urgente ? 'rgba(231, 76, 60, 0.15)' : undefined,
                  color: urgente ? 'var(--status-rework)' : undefined,
                  border: urgente ? '1px solid var(--status-rework)' : undefined,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {urgente ? '🚨 Caso Urgente Ativado' : '⚡ Solicitar Urgência'}
              </button>
            </div>

            {hasImplantService && (
              <div className="form-group animate-fade-in" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <label className="form-label" style={{ color: 'var(--primary-cyan)' }}>Componentes Sobre Implante (Marca e Modelo)</label>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                  Especifique a marca e modelo para os dentes sobre implante. Para dentes intermediários/suspensos (sem implante), <strong>clique uma segunda vez</strong> sobre o dente correspondente no odontograma acima para marcá-lo como <strong>"Pôntico"</strong>.
                </p>

                {(() => {
                  const unmappedTeeth = implantTeethRequired.filter(t => !componentesImplante.some(c => c.dentes.includes(t)));
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      {implantTeethRequired.length > 0 && unmappedTeeth.length > 0 ? (
                        <div style={{ padding: '10px 15px', background: 'rgba(231, 76, 60, 0.1)', border: '1px solid var(--status-rework)', borderRadius: '6px', color: 'var(--status-rework)', fontSize: '0.85rem' }}>
                          Dentes aguardando especificação de implante: <strong style={{ fontSize: '1rem' }}>{unmappedTeeth.join(', ')}</strong>
                        </div>
                      ) : implantTeethRequired.length > 0 ? (
                        <div style={{ padding: '10px 15px', background: 'rgba(46, 204, 113, 0.1)', border: '1px solid var(--status-completed)', borderRadius: '6px', color: 'var(--status-completed)', fontSize: '0.85rem' }}>
                          Todos os implantes ativos foram especificados!
                        </div>
                      ) : (
                        <div style={{ padding: '10px 15px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                          Nenhum dente configurado com implante ativo.
                        </div>
                      )}

                      {implantTeethRequired.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                          {componentesImplante.map((comp, idx) => (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Selecionar dentes para este componente:</span>
                                {implantTeethRequired.some(t => !comp.dentes.includes(t) && !componentesImplante.some((c, cIdx) => cIdx !== idx && c.dentes.includes(t))) && (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectAllForComponent(idx)}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: 'var(--primary-cyan)',
                                      cursor: 'pointer',
                                      fontSize: '0.8rem',
                                      fontWeight: 600,
                                      textDecoration: 'underline',
                                      padding: 0
                                    }}
                                  >
                                    Selecionar todos disponíveis
                                  </button>
                                )}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {implantTeeth.map(t => {
                                  const isSelectedHere = comp.dentes.includes(t);
                                  const isExcluded = implantTeethSemComponente.includes(t);
                                  const isSelectedElsewhere = !isSelectedHere && !isExcluded && componentesImplante.some(c => c.dentes.includes(t));
                                  
                                  let buttonStyle: React.CSSProperties = {
                                    padding: '6px 14px',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    borderRadius: '6px',
                                    transition: 'all 0.2s',
                                    cursor: isSelectedElsewhere ? 'not-allowed' : 'pointer'
                                  };

                                  if (isSelectedHere) {
                                    buttonStyle = {
                                      ...buttonStyle,
                                      border: '1px solid var(--primary-cyan)',
                                      background: 'var(--primary-cyan)',
                                      color: '#000',
                                      boxShadow: '0 0 10px rgba(0,242,254,0.3)'
                                    };
                                  } else if (isExcluded) {
                                    buttonStyle = {
                                      ...buttonStyle,
                                      border: '1px dashed var(--accent-purple)',
                                      background: 'rgba(127, 90, 240, 0.1)',
                                      color: 'var(--accent-purple)'
                                    };
                                  } else {
                                    buttonStyle = {
                                      ...buttonStyle,
                                      border: '1px solid var(--border-color)',
                                      background: 'rgba(255,255,255,0.05)',
                                      color: isSelectedElsewhere ? 'rgba(255,255,255,0.2)' : 'var(--text-main)'
                                    };
                                  }

                                  return (
                                    <button
                                      key={t}
                                      type="button"
                                      onClick={() => toggleToothForComponent(idx, t)}
                                      disabled={isSelectedElsewhere}
                                      style={buttonStyle}
                                      title={isExcluded ? 'Pôntico / Sem implante. Clique para resetar.' : isSelectedHere ? 'Selecionado. Clique para marcar como Pôntico.' : 'Clique para selecionar para este componente.'}
                                    >
                                      Dente {t} {isExcluded ? '❌' : isSelectedHere ? '🔩' : ''}
                                    </button>
                                  );
                                })}
                              </div>
                              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  required={comp.dentes.length > 0}
                                  placeholder="Ex: Neodent Grand Morse..."
                                  className="form-control"
                                  value={comp.marcaModelo}
                                  onChange={(e) => handleComponenteTextChange(idx, e.target.value)}
                                  style={{ flex: 1 }}
                                />
                                {componentesImplante.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeComponente(idx)}
                                    className="btn btn-secondary"
                                    style={{ padding: '8px', color: 'var(--status-rework)' }}
                                    title="Remover este componente"
                                  >
                                    <Trash size={16} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {implantTeethRequired.length > 0 && unmappedTeeth.length > 0 && (
                        <button
                          type="button"
                          onClick={addComponente}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.85rem', padding: '8px 12px', alignSelf: 'flex-start' }}
                        >
                          <Plus size={16} style={{ marginRight: '5px' }} /> Adicionar outra especificação
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Upload de Arquivos e Observações */}
          <div className="glass-card" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--accent-purple)' }}>Modelos STL e Anexos</h2>

            <div className="form-group">
              <label className="form-label">Observações / Detalhes do Caso</label>
              <textarea
                rows={3}
                className="form-control"
                placeholder="Descreva detalhes específicos do trabalho (ex: tipo de preparo, características anatômicas)..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Arquivos STL/PLY de Escaneamento</label>
              <div
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  background: 'rgba(255, 255, 255, 0.01)',
                  transition: 'border-color 0.2s ease',
                }}
                onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--primary-cyan)')}
                onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
              >
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                  }}
                />
                <Upload size={32} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
                <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>Clique para anexar arquivos</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Suporta arquivos STL, PLY, OBJ ou Imagens de referência.
                </p>
              </div>
            </div>

            {/* List of Files */}
            {files.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span className="form-label">Novos Arquivos Selecionados:</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {files.map((file, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '8px 12px',
                        fontSize: '0.85rem',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--status-rework)', cursor: 'pointer' }}
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* List of Existing Files (Only in Edit Mode) */}
            {isEditMode && existingFiles.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                <span className="form-label">Arquivos do Caso já Enviados:</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {existingFiles.map((file) => (
                    <div
                      key={file.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(0, 242, 254, 0.03)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '8px 12px',
                        fontSize: '0.85rem',
                        border: '1px solid rgba(0, 242, 254, 0.2)',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%', color: 'var(--text-muted)' }}>
                        {file.descricao} ({file.arquivo.split('/').pop()})
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            if (window.confirm("Deseja realmente remover este arquivo anexo do caso?")) {
                              await api.post(`/pedidos/${id}/remover_anexo/`, { anexo_id: file.id });
                              setExistingFiles(existingFiles.filter(f => f.id !== file.id));
                            }
                          } catch (err: any) {
                            console.error(err);
                            setError(err.response?.data?.error || 'Erro ao remover anexo.');
                          }
                        }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--status-rework)', cursor: 'pointer' }}
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="btn btn-secondary"
            disabled={loading}
          >
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: '180px' }}>
            {isEditMode ? <Save size={18} /> : <FilePlus size={18} />}
            <span>{loading ? (isEditMode ? 'Salvando...' : 'Criando...') : (isEditMode ? 'Salvar Alterações' : 'Enviar Solicitação')}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default NovoPedido;
