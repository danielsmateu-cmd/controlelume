import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, Clock, User, Users, Factory, Globe, Trash2, Edit2, CheckCircle2, AlertCircle, Link2, ExternalLink, Filter } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

const CATEGORIES = [
  { id: 'producao', label: 'Produção', color: 'bg-blue-500 text-white', border: 'border-blue-500' },
  { id: 'reuniao', label: 'Reunião', color: 'bg-purple-500 text-white', border: 'border-purple-500' },
  { id: 'orcamento', label: 'Orçamento / Visita', color: 'bg-emerald-500 text-white', border: 'border-emerald-500' },
  { id: 'entrega', label: 'Entrega / Logística', color: 'bg-amber-500 text-white', border: 'border-amber-500' },
  { id: 'pessoal', label: 'Pessoal', color: 'bg-rose-500 text-white', border: 'border-rose-500' }
];

export default function Agenda() {
  const { currentUser, usersList } = useAuth();
  const userLogin = currentUser?.login || 'default';
  const userName = currentUser?.name || currentUser?.login || 'Usuário';

  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [productionEvents, setProductionEvents] = useState([]);
  const [selectedUserFilter, setSelectedUserFilter] = useState('minha'); // 'minha', 'producao', 'todos', ou login do usuario
  const [googleCalendarUrl, setGoogleCalendarUrl] = useState('');
  const [showGoogleCalendar, setShowGoogleCalendar] = useState(false);
  const [googleUrlModalOpen, setGoogleUrlModalOpen] = useState(false);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    category: 'reuniao',
    assignedTo: userLogin,
    description: '',
    isShared: true
  });

  // Carregar eventos salvos no backend e integrar dados de produção
  useEffect(() => {
    const loadData = async () => {
      // 1. Carregar eventos pessoais/equipe
      try {
        const savedEvents = await api.getSettings('agenda_events');
        if (savedEvents && Array.isArray(savedEvents)) {
          setEvents(savedEvents);
        }
      } catch (err) {
        console.error('Erro ao carregar eventos da agenda:', err);
      }

      // 2. Carregar URL do Google Calendar do usuário
      try {
        const userGoogleConfig = await api.getSettings(`google_cal_${userLogin}`);
        if (userGoogleConfig?.url) {
          setGoogleCalendarUrl(userGoogleConfig.url);
        }
      } catch (_) {}

      // 3. Importar prazos de entrega da Produção (contas/pedidos)
      try {
        const contas = await api.getContas();
        if (contas && Array.isArray(contas)) {
          const prodList = [];
          contas.forEach((c) => {
            if (c.dueDate || c.data) {
              const eventDate = c.dueDate || c.data;
              prodList.push({
                id: `prod_${c.id}`,
                title: `🏭 Produção: ${c.client || c.name || 'Cliente'} - ${c.description || 'Pedido'}`,
                date: eventDate,
                time: '08:00',
                category: 'producao',
                assignedTo: 'producao',
                description: `Valor: R$ ${c.amount || c.valor || 0} | Status: ${c.status || 'Em produção'}`,
                isProduction: true
              });
            }
          });
          setProductionEvents(prodList);
        }
      } catch (err) {
        console.error('Erro ao carregar prazos da produção:', err);
      }
    };

    loadData();
  }, [userLogin]);

  // Salvar Eventos
  const saveEventsList = async (newList) => {
    setEvents(newList);
    try {
      await api.saveSettings('agenda_events', newList);
    } catch (err) {
      console.error('Erro ao salvar eventos da agenda:', err);
    }
  };

  // Salvar Google Calendar URL
  const handleSaveGoogleUrl = async (e) => {
    e.preventDefault();
    try {
      await api.saveSettings(`google_cal_${userLogin}`, { url: googleCalendarUrl });
      setGoogleUrlModalOpen(false);
      setShowGoogleCalendar(true);
    } catch (err) {
      alert('Erro ao salvar URL do Google Agenda.');
    }
  };

  // Criar / Editar Evento
  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.date) return;

    if (editingEvent) {
      const updated = events.map((item) => (item.id === editingEvent.id ? { ...formData, id: editingEvent.id } : item));
      await saveEventsList(updated);
    } else {
      const newEvt = {
        ...formData,
        id: Date.now().toString(),
        createdBy: userLogin
      };
      await saveEventsList([...events, newEvt]);
    }

    setEventModalOpen(false);
    setEditingEvent(null);
    setFormData({
      title: '',
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      category: 'reuniao',
      assignedTo: userLogin,
      description: '',
      isShared: true
    });
  };

  // Apagar Evento
  const handleDeleteEvent = async (id) => {
    if (window.confirm('Tem certeza que deseja apagar este compromisso?')) {
      const updated = events.filter((e) => e.id !== id);
      await saveEventsList(updated);
    }
  };

  // Filtragem de Eventos por Usuário
  const allEventsCombined = [...events, ...productionEvents];

  const filteredEvents = allEventsCombined.filter((evt) => {
    if (selectedUserFilter === 'minha') {
      return evt.assignedTo === userLogin || evt.createdBy === userLogin;
    }
    if (selectedUserFilter === 'producao') {
      return evt.category === 'producao' || evt.assignedTo === 'producao' || evt.isProduction;
    }
    if (selectedUserFilter === 'todos') {
      return evt.isShared !== false || evt.assignedTo === userLogin;
    }
    // Usuário Específico
    return evt.assignedTo === selectedUserFilter || evt.createdBy === selectedUserFilter;
  });

  // Funções Auxiliares de Calendário
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const today = () => setCurrentDate(new Date());

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* HEADER DA AGENDA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Agenda Lume</h1>
            <p className="text-xs text-gray-500">Gestão de Compromissos e Entregas da Produção</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Botão Alternar Google Calendar */}
          <button
            onClick={() => {
              if (!googleCalendarUrl) {
                setGoogleUrlModalOpen(true);
              } else {
                setShowGoogleCalendar(!showGoogleCalendar);
              }
            }}
            className={clsx(
              'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all',
              showGoogleCalendar
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            )}
          >
            <Globe className="w-4 h-4 text-blue-500" />
            {showGoogleCalendar ? 'Ver Agenda Lume' : 'Google Agenda'}
          </button>

          {googleCalendarUrl && (
            <button
              onClick={() => setGoogleUrlModalOpen(true)}
              title="Configurar Link do Google Agenda"
              className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs"
            >
              <Link2 className="w-4 h-4" />
            </button>
          )}

          {/* Botão Novo Evento */}
          <button
            onClick={() => {
              setEditingEvent(null);
              setFormData({
                title: '',
                date: new Date().toISOString().split('T')[0],
                time: '09:00',
                category: 'reuniao',
                assignedTo: userLogin,
                description: '',
                isShared: true
              });
              setEventModalOpen(true);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Novo Compromisso
          </button>
        </div>
      </div>

      {/* SELETOR DE FILTRO DE AGENDAS DA EQUIPE */}
      {!showGoogleCalendar && (
        <div className="flex items-center justify-between gap-4 bg-white p-3 rounded-xl border border-gray-200 shadow-xs flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-700">Visualizar Agenda:</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <button
              onClick={() => setSelectedUserFilter('minha')}
              className={clsx(
                'px-3 py-1.5 rounded-lg font-medium transition-all',
                selectedUserFilter === 'minha'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              👤 Minha Agenda ({userName})
            </button>

            <button
              onClick={() => setSelectedUserFilter('producao')}
              className={clsx(
                'px-3 py-1.5 rounded-lg font-medium transition-all',
                selectedUserFilter === 'producao'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
              )}
            >
              🏭 Agenda da Produção
            </button>

            <button
              onClick={() => setSelectedUserFilter('todos')}
              className={clsx(
                'px-3 py-1.5 rounded-lg font-medium transition-all',
                selectedUserFilter === 'todos'
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              👥 Toda a Equipe
            </button>

            {/* Outros Atendentes */}
            {usersList && usersList.filter((u) => u.login !== userLogin).map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedUserFilter(u.login)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg font-medium transition-all',
                  selectedUserFilter === u.login
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
                )}
              >
                {u.name || u.login}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SE HOUVER GOOGLE CALENDAR ATIVO */}
      {showGoogleCalendar ? (
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-800 text-sm flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600" />
              Google Agenda Integrado ({userName})
            </h2>
            <a
              href={googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
            >
              Abrir no Google <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="w-full h-[650px] rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
            {googleCalendarUrl.includes('iframe') ? (
              <div dangerouslySetInnerHTML={{ __html: googleCalendarUrl }} className="w-full h-full" />
            ) : (
              <iframe
                src={googleCalendarUrl}
                style={{ border: 0 }}
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                title="Google Calendar"
              ></iframe>
            )}
          </div>
        </div>
      ) : (
        /* VISÃO CALENDÁRIO LUME */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* GRID DO CALENDÁRIO (2 Colunas) */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            {/* Navegação do Mês */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {monthNames[month]} de {year}
              </h2>

              <div className="flex items-center gap-2">
                <button
                  onClick={today}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg"
                >
                  Hoje
                </button>
                <button
                  onClick={prevMonth}
                  className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={nextMonth}
                  className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Cabeçalho dos Dias da Semana */}
            <div className="grid grid-cols-7 text-center font-bold text-xs text-gray-400 border-b border-gray-100 pb-2">
              <div>Dom</div>
              <div>Seg</div>
              <div>Ter</div>
              <div>Qua</div>
              <div>Qui</div>
              <div>Sex</div>
              <div>Sáb</div>
            </div>

            {/* Dias do Mês */}
            <div className="grid grid-cols-7 gap-1">
              {/* Células vazias do mês anterior */}
              {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
                <div key={`empty-${idx}`} className="h-24 bg-gray-50/50 rounded-xl p-1 text-gray-300 text-xs"></div>
              ))}

              {/* Dias do mês atual */}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const isToday = new Date().toISOString().split('T')[0] === dayStr;

                const dayEvents = filteredEvents.filter((e) => e.date === dayStr);

                return (
                  <div
                    key={`day-${dayNum}`}
                    className={clsx(
                      'h-24 p-1.5 rounded-xl border flex flex-col justify-start transition-all overflow-hidden',
                      isToday
                        ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-500/20'
                        : 'bg-white border-gray-100 hover:border-gray-300'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={clsx(
                          'text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full',
                          isToday ? 'bg-emerald-600 text-white' : 'text-gray-700'
                        )}
                      >
                        {dayNum}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="text-[10px] text-gray-400 font-semibold">{dayEvents.length}</span>
                      )}
                    </div>

                    <div className="space-y-1 overflow-y-auto max-h-16 text-[10px]">
                      {dayEvents.map((evt) => {
                        const cat = CATEGORIES.find((c) => c.id === evt.category) || CATEGORIES[0];
                        return (
                          <div
                            key={evt.id}
                            title={`${evt.title} - ${evt.time}`}
                            className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium truncate', cat.color)}
                          >
                            {evt.time} {evt.title}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* COLUNA DIREITA: LISTA DE PRÓXIMOS COMPROMISSOS */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col space-y-4">
            <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              Próximos Compromissos ({filteredEvents.length})
            </h2>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {filteredEvents.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs space-y-2">
                  <CalendarIcon className="w-8 h-8 mx-auto text-gray-300 stroke-[1.5]" />
                  <p>Nenhum compromisso agendado para esta visualização.</p>
                </div>
              ) : (
                filteredEvents
                  .sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`))
                  .map((evt) => {
                    const cat = CATEGORIES.find((c) => c.id === evt.category) || CATEGORIES[0];
                    return (
                      <div
                        key={evt.id}
                        className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1.5 hover:border-gray-300 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className={clsx('px-2 py-0.5 rounded text-[9px] font-bold', cat.color)}>
                            {cat.label}
                          </span>
                          <span className="text-[11px] font-bold text-gray-500">
                            {evt.date.split('-').reverse().join('/')} às {evt.time}
                          </span>
                        </div>

                        <h3 className="font-bold text-gray-900 text-xs leading-tight">{evt.title}</h3>

                        {evt.description && (
                          <p className="text-[11px] text-gray-600 line-clamp-2">{evt.description}</p>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-gray-200/60 text-[10px] text-gray-400">
                          <span className="flex items-center gap-1 font-medium text-gray-500">
                            <User className="w-3 h-3" />
                            {evt.assignedTo === 'producao' ? 'Setor Produção' : evt.assignedTo}
                          </span>

                          {!evt.isProduction && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingEvent(evt);
                                  setFormData(evt);
                                  setEventModalOpen(true);
                                }}
                                className="p-1 text-gray-400 hover:text-indigo-600"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteEvent(evt.id)}
                                className="p-1 text-gray-400 hover:text-red-600"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO / EDITAR EVENTO */}
      {eventModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4">
            <h3 className="font-bold text-gray-900 text-base">
              {editingEvent ? 'Editar Compromisso' : 'Novo Compromisso'}
            </h3>

            <form onSubmit={handleSaveEvent} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Título do Compromisso *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Reunião de Orçamento Cliente X"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Horário *</label>
                  <input
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Categoria</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Atribuído a</label>
                  <select
                    value={formData.assignedTo}
                    onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
                  >
                    <option value={userLogin}>Mim ({userName})</option>
                    <option value="producao">Setor Produção</option>
                    {usersList && usersList.filter((u) => u.login !== userLogin).map((u) => (
                      <option key={u.id} value={u.login}>
                        {u.name || u.login}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Descrição / Observações</label>
                <textarea
                  rows={3}
                  placeholder="Detalhes adicionais do compromisso..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                ></textarea>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isShared"
                  checked={formData.isShared}
                  onChange={(e) => setFormData({ ...formData, isShared: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="isShared" className="text-gray-700 font-medium">
                  Visível para toda a equipe
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEventModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold"
                >
                  Salvar Compromisso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURAÇÃO GOOGLE CALENDAR */}
      {googleUrlModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-600" />
              Configurar Google Agenda
            </h3>

            <p className="text-xs text-gray-500">
              Cole a URL pública do seu Google Agenda (ou o código iframe Embed) para visualizar seus compromissos diretamente no Sistema Lume.
            </p>

            <form onSubmit={handleSaveGoogleUrl} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">URL / Embed do Google Agenda</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Ex: https://calendar.google.com/calendar/embed?src=seu-email..."
                  value={googleCalendarUrl}
                  onChange={(e) => setGoogleCalendarUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono text-[11px]"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setGoogleUrlModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold"
                >
                  Salvar e Abrir Agenda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
