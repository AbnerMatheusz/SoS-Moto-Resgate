"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { LogOut, FileText, CheckSquare, List, MapPin, Phone, Car, Edit3, CreditCard, Wallet, Banknote, Check, TrendingUp, Calendar, BarChart3, AlertCircle, Trash2 } from "lucide-react";

type Solicitacao = {
  id: string;
  nome: string;
  telefone: string;
  moto: string;
  endereco_origem: string;
  lat_long_origem: string;
  endereco_destino: string;
  travada: boolean;
  acompanhantes: number;
  agendamento_data: string | null;
  agendamento_hora: string | null;
  valor_cobrado: number;
  forma_pagamento: string | null;
  recebedor: string | null;
  status: string;
  created_at: string;
};

type Financeiro = {
  id: string;
  tipo_gasto: string;
  valor: number;
  km_rodado: number;
  data: string;
  nota_fiscal_url: string;
};

type Manutencao = {
  id: string;
  item_desgaste: string;
  valor: number;
  veiculo: string;
  data_troca: string;
  proxima_revisao: string;
};

export default function Dashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"resumo" | "resgates" | "financeiro" | "manutencao">("resumo");
  const [isLoading, setIsLoading] = useState(true);

  // Data State
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [financeiro, setFinanceiro] = useState<Financeiro[]>([]);
  const [manutencao, setManutencao] = useState<Manutencao[]>([]);

  // UI State for Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempPreco, setTempPreco] = useState<{ [id: string]: string }>({});

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    valor: string;
    forma_pagamento: string;
    recebedor: string;
  }>({ valor: "", forma_pagamento: "", recebedor: "" });

  // Manual Modal Payment State
  const [manualPayment, setManualPayment] = useState({ method: "", receiver: "" });
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Financial Filter State
  const [filterRange, setFilterRange] = useState<"hoje" | "7d" | "mes" | "personalizado">("mes");
  const [customRange, setCustomRange] = useState({ start: "", end: "" });

  // Notification State
  const [notification, setNotification] = useState<{ nome: string; id: string } | null>(null);
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Audio Unlock State
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const audioUnlockedRef = useRef(false);

  const unlockAudio = () => {
    setIsAudioUnlocked(true);
    audioUnlockedRef.current = true;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ctx.resume().then(() => console.log('Áudio desbloqueado com sucesso'));
    } catch (e) {
      console.warn("Audio Context init fail", e);
    }
  };

  // Play alarm using Web Audio API (no external files needed)
  const playAlarm = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playBeep = (startTime: number, freq: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      // Three urgent beeps
      playBeep(ctx.currentTime, 880, 0.15);
      playBeep(ctx.currentTime + 0.2, 880, 0.15);
      playBeep(ctx.currentTime + 0.4, 1100, 0.3);
    } catch (e) {
      console.warn("Audio not available:", e);
    }
  };

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login"); // Redirect to login if not authenticated
        return;
      }

      await loadData();
      setIsLoading(false);
    };

    checkAuthAndLoad();

    // Supabase Realtime: listen for new rescue requests
    const channel = supabase
      .channel("new-solicitacoes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "solicitacoes" },
        (payload) => {
          const nova = payload.new as Solicitacao;
          if (audioUnlockedRef.current) {
             playAlarm();
          }
          setNotification({ nome: nova.nome, id: nova.id });
          setSolicitacoes(prev => [nova, ...prev]);
          // Auto-dismiss after 10 seconds
          if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
          notifTimerRef.current = setTimeout(() => setNotification(null), 10000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    };
  }, [router]);

  const loadData = async () => {
    // Calculando data limite de 4 meses atrás para não sobrecarregar o DB e estourar RAM
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
    const limitDate = fourMonthsAgo.toISOString();

    const { data: qSolicitacoes } = await supabase.from("solicitacoes").select("*").gte("created_at", limitDate).order("created_at", { ascending: false });
    if (qSolicitacoes) setSolicitacoes(qSolicitacoes);

    const { data: qFinanceiro } = await supabase.from("financeiro").select("*").gte("data", limitDate).order("data", { ascending: false });
    if (qFinanceiro) setFinanceiro(qFinanceiro);

    const { data: qManutencao } = await supabase.from("manutencao").select("*").gte("data_troca", limitDate).order("data_troca", { ascending: false });
    if (qManutencao) setManutencao(qManutencao);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const submitFinanceiro = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const tipo_gasto = formData.get("tipo_gasto") as string;
    const valor = parseFloat(formData.get("valor") as string);
    const km_rodado = parseFloat(formData.get("km_rodado") as string);
    const data = formData.get("data") as string;
    const nota_fiscal_url = formData.get("nota_fiscal_url") as string;

    const { error } = await supabase.from("financeiro").insert([{ tipo_gasto, valor, km_rodado, data, nota_fiscal_url }]);
    if (!error) {
      form.reset();
      loadData();
    } else {
      alert("Erro ao salvar o lançamento.");
    }
    setIsSubmitting(false);
  };

  const submitManutencao = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const item_desgaste = formData.get("item_desgaste") as string;
    const valor = parseFloat(formData.get("valor") as string) || 0;
    const veiculo = formData.get("veiculo") as string;
    const data_troca = formData.get("data_troca") as string;
    const proxima_revisao = formData.get("proxima_revisao") as string;

    const { error } = await supabase.from("manutencao").insert([{ item_desgaste, valor, veiculo, data_troca, proxima_revisao }]);
    if (!error) {
      form.reset();
      loadData();
    } else {
      alert("Erro ao salvar o item de manutenção.");
    }
    setIsSubmitting(false);
  };

  const deleteManutencao = async (id: string) => {
    try {
      const { error } = await supabase.from("manutencao").delete().eq("id", id);
      if (error) throw error;
      setManutencao(prev => prev.filter(m => m.id !== id));
      setConfirmingDelete(null);
    } catch (error) {
      console.error("Erro ao excluir registro:", error);
      alert("Erro ao excluir registro.");
    }
  };

  const handleTempPrecoChange = (id: string, val: string) => {
    setTempPreco(prev => ({ ...prev, [id]: val }));
  };

  const updateStatus = async (id: string, newStatus: string, precoAtual?: number) => {
    let updatePayload: any = { status: newStatus };

    // If we are concluding and there is a price typed, charge it
    if (newStatus === "concluido" && tempPreco[id]) {
      updatePayload.valor_cobrado = parseFloat(tempPreco[id]);
    } else if (precoAtual !== undefined) {
      // Keep existing if any
      updatePayload.valor_cobrado = precoAtual;
    }

    const { error } = await supabase.from("solicitacoes").update(updatePayload).eq("id", id);
    if (!error) {
      // Clean up temp state
      if (newStatus === "concluido") {
        setTempPreco(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
      loadData();
    }
  };

  const submitManualResgate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nome = formData.get("nome") as string;
    const telefone = formData.get("telefone") as string;
    const moto = formData.get("moto") as string;
    const lat_long_origem = formData.get("lat_long_origem") as string;
    const endereco_destino = formData.get("endereco_destino") as string;
    const valor_cobrado = parseFloat(formData.get("valor_cobrado") as string) || 0;
    const forma_pagamento = formData.get("forma_pagamento") as string;
    const recebedor = formData.get("recebedor") as string;

    const { error } = await supabase.from("solicitacoes").insert([{
      nome,
      telefone,
      moto,
      endereco_origem: formData.get("endereco_origem") as string,
      lat_long_origem: null,
      endereco_destino,
      travada: false,
      status: "concluido",
      valor_cobrado,
      forma_pagamento,
      recebedor,
      acompanhantes: 0
    }]);

    if (!error) {
      setIsModalOpen(false);
      loadData();
    } else {
      alert("Erro ao criar resgate manual.");
    }
  };

  const handleEditClick = (s: Solicitacao) => {
    setEditingId(s.id);
    setEditForm({
      valor: s.valor_cobrado.toString(),
      forma_pagamento: s.forma_pagamento || "",
      recebedor: s.recebedor || ""
    });
  };

  const saveEdit = async (id: string) => {
    const { error } = await supabase.from("solicitacoes").update({
      valor_cobrado: parseFloat(editForm.valor) || 0,
      forma_pagamento: editForm.forma_pagamento,
      recebedor: editForm.recebedor
    }).eq("id", id);

    if (!error) {
      setEditingId(null);
      loadData();
    } else {
      alert("Erro ao salvar alterações.");
    }
  };

  // Helper for date filtering
  const getFilteredData = () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let startLimit = startOfToday;
    if (filterRange === "7d") {
      startLimit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (filterRange === "mes") {
      startLimit = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filterRange === "personalizado" && customRange.start) {
      startLimit = new Date(customRange.start);
    }

    const endLimit = (filterRange === "personalizado" && customRange.end) ? new Date(customRange.end) : new Date();

    const filteredSolicitacoes = solicitacoes.filter(s => {
      const d = new Date(s.created_at);
      return d >= startLimit && d <= endLimit && s.status === 'concluido';
    });

    const filteredFinanceiro = financeiro.filter(f => {
      const d = new Date(f.data);
      return d >= startLimit && d <= endLimit;
    });

    const filteredManutencao = manutencao.filter(m => {
      const d = new Date(m.data_troca);
      return d >= startLimit && d <= endLimit;
    });

    const receitaVal = filteredSolicitacoes.reduce((acc, curr) => acc + curr.valor_cobrado, 0);
    const gastosVal = filteredFinanceiro.reduce((acc, curr) => acc + curr.valor, 0) + filteredManutencao.reduce((acc, curr) => acc + curr.valor, 0);
    const kmVal = filteredFinanceiro.reduce((acc, curr) => acc + (curr.km_rodado || 0), 0);

    return { receita: receitaVal, gastos: gastosVal, km: kmVal };
  };

  const { receita, gastos, km } = getFilteredData();
  const lucro = receita - gastos;
  const lucroPorKm = km > 0 ? lucro / km : 0;

  // Chart Data (Last 4 months)
  const getChartData = () => {
    const months = [];
    const now = new Date();
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleString('pt-BR', { month: 'short' }).toUpperCase();
      const monthStart = d;
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

      const mRevenue = solicitacoes
        .filter(s => {
          const sd = new Date(s.created_at);
          return sd >= monthStart && sd <= monthEnd && s.status === 'concluido';
        })
        .reduce((acc, curr) => acc + curr.valor_cobrado, 0);

      const mExpenses = financeiro
        .filter(f => {
          const fd = new Date(f.data);
          return fd >= monthStart && fd <= monthEnd;
        })
        .reduce((acc, curr) => acc + curr.valor, 0) +
        manutencao
          .filter(m => {
            const md = new Date(m.data_troca);
            return md >= monthStart && md <= monthEnd;
          })
          .reduce((acc, curr) => acc + curr.valor, 0);

      months.push({ label: monthLabel, lucro: mRevenue - mExpenses, despesa: mExpenses });
    }
    return months;
  };

  const chartData = getChartData();



  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-gray-50/50 rounded-2xl animate-pulse">
        <div className="w-16 h-16 bg-gray-200 rounded-2xl mb-4"></div>
        <div className="h-4 w-48 bg-gray-200 rounded-full mb-2"></div>
        <div className="h-3 w-32 bg-gray-200 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="relative bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 min-h-[80vh] flex flex-col md:flex-row overflow-hidden">
      
      {!isAudioUnlocked && (
        <div className="absolute top-0 left-0 right-0 bg-amber-100 border-b border-amber-200 text-amber-800 text-sm font-bold text-center p-3 z-50 flex items-center justify-center gap-4 animate-in slide-in-from-top-4">
          <AlertCircle className="w-5 h-5 shrink-0" />
          O seu navegador silenciou os alertas do painel. Clique para ativar:
          <button onClick={unlockAudio} className="bg-amber-500 text-white px-4 py-1.5 rounded-lg hover:bg-amber-600 transition-colors shadow-sm active:scale-95">
            Ativar Som 🔊
          </button>
        </div>
      )}

      {/* 🔔 Notification Banner */}
      {notification && (
        <div className="fixed top-4 right-4 z-[100] max-w-sm w-full animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="bg-gray-900 text-white rounded-2xl shadow-2xl overflow-hidden border border-red-500/30">
            {/* Top blinking red bar */}
            <div className="h-1.5 bg-red-500 animate-pulse" />
            <div className="p-4 flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center animate-pulse">
                  <span className="text-xl">🚨</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-0.5">Novo Guincho!</p>
                <p className="font-black text-white text-sm truncate">{notification.nome}</p>
                <p className="text-gray-400 text-xs mt-0.5">Solicitação aguardando atendimento</p>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="text-gray-600 hover:text-gray-300 text-lg leading-none shrink-0 ml-1"
              >
                ×
              </button>
            </div>
            <div className="flex border-t border-gray-800">
              <button
                onClick={() => { setActiveTab("resgates"); setNotification(null); }}
                className="flex-1 py-2.5 text-xs font-black text-primary hover:bg-primary/10 transition-colors"
              >
                Ver Agora →
              </button>
              <button
                onClick={() => setNotification(null)}
                className="flex-1 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-800 transition-colors border-l border-gray-800"
              >
                Dispensar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <div className="w-full md:w-72 bg-gray-50/80 backdrop-blur-sm border-r border-gray-100 p-6 flex flex-col">
        <h2 className="text-2xl font-black mb-8 text-gray-900 tracking-tight flex items-center gap-2">
          Gestão SOS
        </h2>
        <nav className="flex-1 space-y-2">
          <button
            onClick={() => setActiveTab("resumo")}
            className={`w-full flex items-center p-3.5 rounded-xl transition-all duration-200 ${activeTab === "resumo" ? "bg-primary text-white font-bold shadow-md shadow-primary/20" : "text-gray-600 hover:bg-white hover:shadow-sm font-medium"
              }`}
          >
            <TrendingUp className={`w-5 h-5 mr-3 ${activeTab === "resumo" ? "text-white" : "text-gray-400"}`} />
            Inteligência Financeira
          </button>
          <button
            onClick={() => setActiveTab("resgates")}
            className={`w-full flex items-center p-3.5 rounded-xl transition-all duration-200 ${activeTab === "resgates" ? "bg-primary text-white font-bold shadow-md shadow-primary/20" : "text-gray-600 hover:bg-white hover:shadow-sm font-medium"
              }`}
          >
            <List className={`w-5 h-5 mr-3 ${activeTab === "resgates" ? "text-white" : "text-gray-400"}`} />
            Resgates Agendados
          </button>
          <button
            onClick={() => setActiveTab("financeiro")}
            className={`w-full flex items-center p-3.5 rounded-xl transition-all duration-200 ${activeTab === "financeiro" ? "bg-primary text-white font-bold shadow-md shadow-primary/20" : "text-gray-600 hover:bg-white hover:shadow-sm font-medium"
              }`}
          >
            <FileText className={`w-5 h-5 mr-3 ${activeTab === "financeiro" ? "text-white" : "text-gray-400"}`} />
            Controle Financeiro
          </button>
          <button
            onClick={() => setActiveTab("manutencao")}
            className={`w-full flex items-center p-3.5 rounded-xl transition-all duration-200 ${activeTab === "manutencao" ? "bg-primary text-white font-bold shadow-md shadow-primary/20" : "text-gray-600 hover:bg-white hover:shadow-sm font-medium"
              }`}
          >
            <CheckSquare className={`w-5 h-5 mr-3 ${activeTab === "manutencao" ? "text-white" : "text-gray-400"}`} />
            Checklist Manutenção
          </button>
        </nav>
        <button
          onClick={handleLogout}
          className="mt-8 flex items-center p-3.5 text-red-600 font-bold hover:bg-red-50 rounded-xl transition-colors w-full border border-transparent hover:border-red-100"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Sair do Sistema
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 md:p-10 bg-white max-h-screen overflow-y-auto">
        {activeTab === "resumo" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
              <h3 className="text-3xl font-black text-gray-900 tracking-tight">Inteligência Financeira</h3>

              <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                {[
                  { id: 'hoje', label: 'Hoje' },
                  { id: '7d', label: '7 Dias' },
                  { id: 'mes', label: 'Mês' },
                  { id: 'personalizado', label: 'Personalizado' }
                ].map((range) => (
                  <button
                    key={range.id}
                    onClick={() => setFilterRange(range.id as any)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterRange === range.id
                        ? "bg-white text-primary shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                      }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            {filterRange === 'personalizado' && (
              <div className="flex gap-4 mb-8 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Início</label>
                  <input
                    type="date"
                    value={customRange.start}
                    onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                    className="w-full bg-white border border-gray-200 p-2 rounded-lg text-xs font-bold text-black"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Fim</label>
                  <input
                    type="date"
                    value={customRange.end}
                    onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                    className="w-full bg-white border border-gray-200 p-2 rounded-lg text-xs font-bold text-black"
                  />
                </div>
              </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="bg-primary p-8 rounded-[2rem] shadow-xl shadow-primary/20 text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-24 h-24" />
                </div>
                <p className="text-primary-foreground/80 text-xs font-bold uppercase tracking-widest mb-2">Receita Total</p>
                <h4 className="text-4xl font-black">R$ {receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
              </div>

              <div className="bg-white border-4 border-primary/10 p-8 rounded-[2rem] shadow-sm relative overflow-hidden group">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Gastos Totais</p>
                <h4 className="text-4xl font-black text-gray-900">R$ {gastos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-[2rem] shadow-sm relative overflow-hidden group">
                <p className="text-emerald-600/70 text-xs font-bold uppercase tracking-widest mb-2">Lucro Líquido</p>
                <h4 className="text-4xl font-black text-emerald-700">R$ {lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
              </div>
            </div>

            {/* Efficiency & Chart Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Monthly Chart */}
              <div className="bg-white border border-gray-100 p-8 rounded-[2.5rem] shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h4 className="font-black text-xl text-gray-900 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Comparativo Mensal
                  </h4>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lucro vs Despesas</span>
                </div>

                <div className="relative h-56 flex items-end gap-3 px-2 pb-6 border-b border-gray-100">
                  <div className="flex-1 flex items-end justify-around h-full gap-2">
                    {chartData.map((data, idx) => {
                      const maxVal = Math.max(...chartData.flatMap(d => [d.lucro, d.despesa]), 1);
                      const barMaxPx = 160;
                      const lucroH = Math.max(Math.round((Math.max(data.lucro, 0) / maxVal) * barMaxPx), 4);
                      const despesaH = Math.max(Math.round((Math.max(data.despesa, 0) / maxVal) * barMaxPx), 4);

                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1.5">
                          <div className="w-full flex justify-center items-end gap-1.5" style={{ height: `${barMaxPx}px` }}>
                            <div
                              title={`Lucro: R$ ${data.lucro.toFixed(2)}`}
                              style={{ height: `${lucroH}px` }}
                              className="w-4 bg-primary rounded-t-lg transition-all duration-700 cursor-pointer hover:opacity-80"
                            />
                            <div
                              title={`Despesa: R$ ${data.despesa.toFixed(2)}`}
                              style={{ height: `${despesaH}px` }}
                              className="w-4 bg-gray-300 rounded-t-lg transition-all duration-700 cursor-pointer hover:opacity-80"
                            />
                          </div>
                          <span className="text-[10px] font-black text-gray-400 mt-1">{data.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Legend */}
                <div className="flex items-center gap-6 mt-4 px-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-primary rounded-full" />
                    <span className="text-xs font-bold text-gray-500">Lucro</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-300 rounded-full" />
                    <span className="text-xs font-bold text-gray-500">Despesas</span>
                  </div>
                </div>
              </div>

              {/* Efficiency Metric */}
              <div className="flex flex-col gap-6">
                <div className="bg-white border border-gray-100 p-8 rounded-[2.5rem] shadow-sm flex-1 flex flex-col justify-center">
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">Métrica de Ouro (Lucro/KM)</p>
                  <div className="flex items-baseline gap-2">
                    <h4 className="text-5xl font-black text-gray-900">R$ {lucroPorKm.toFixed(2)}</h4>
                    <span className="text-gray-400 font-bold text-lg">/ km</span>
                  </div>

                  {lucroPorKm < 2 && (
                    <div className="mt-6 flex items-center gap-3 bg-blue-50 border border-blue-100 p-4 rounded-2xl animate-pulse">
                      <AlertCircle className="w-5 h-5 text-primary" />
                      <p className="text-xs font-bold text-primary italic">Eficiência abaixo da meta (R$ 2,00/km)</p>
                    </div>
                  )}
                  {lucroPorKm >= 2 && (
                    <div className="mt-6 flex items-center gap-3 bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                      <Check className="w-5 h-5 text-emerald-600" />
                      <p className="text-xs font-bold text-emerald-600 uppercase tracking-tight">Operação Altamente Eficiente</p>
                    </div>
                  )}
                </div>

                <div className="bg-gray-900 p-6 rounded-[2rem] text-white flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-[10px] font-bold uppercase mb-1">Total Rodado no Período</p>
                    <p className="text-2xl font-black tracking-tight">{km.toFixed(1)} <span className="text-sm font-normal text-gray-500">KM</span></p>
                  </div>
                  <div className="p-3 bg-white/10 rounded-xl">
                    <Car className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "resgates" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
              <h3 className="text-3xl font-black text-gray-900 tracking-tight">Resgates Solicitados</h3>
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                + Lançar Resgate Manual
              </button>
            </div>

            {solicitacoes.length === 0 ? (
              <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-gray-500 font-medium">Nenhuma solicitação encontrada no momento.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {solicitacoes.map((s) => (
                  <div key={s.id} className="border border-gray-100 p-6 rounded-2xl hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-primary/20 transition-all duration-300 bg-white group">
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between items-start mb-5">
                        <div>
                          <h4 className="font-bold text-xl text-gray-900 group-hover:text-primary transition-colors">{s.nome}</h4>
                          <div className="flex items-center text-gray-500 mt-1 font-medium">
                            <Phone className="w-4 h-4 mr-2" />
                            {s.telefone}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleEditClick(s)}
                            className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                            title="Editar Valor e Pagamento"
                          >
                            <Edit3 className="w-5 h-5" />
                          </button>
                          <span
                            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${s.status === "pendente" ? "bg-amber-100 text-amber-800 border border-amber-200" :
                                s.status === "em_andamento" ? "bg-blue-100 text-blue-800 border border-blue-200" :
                                  "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              }`}
                          >
                            {s.status === 'em_andamento' ? 'EM ANDAMENTO' : s.status}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-gray-50/80 p-5 rounded-xl border border-gray-100 text-sm">
                        <div>
                          <span className="text-gray-400 block mb-1 text-xs font-bold uppercase tracking-wider">Motocicleta</span>
                          <div className="flex items-center font-bold text-gray-700"><Car className="w-4 h-4 mr-2 text-primary" />{s.moto}</div>
                        </div>
                        <div>
                          <span className="text-gray-400 block mb-1 text-xs font-bold uppercase tracking-wider">Acompanhantes</span>
                          <span className="font-bold text-gray-700">{s.acompanhantes > 0 ? `${s.acompanhantes} pessoa(s)` : "Nenhum"}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block mb-1 text-xs font-bold uppercase tracking-wider">Situação da Roda</span>
                          <span className={`font-black ${s.travada ? "text-red-600 bg-red-50 px-2 py-0.5 rounded-md" : "text-emerald-600"}`}>
                            {s.travada ? "TRAVADA" : "Livre"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block mb-1 text-xs font-bold uppercase tracking-wider">Agendamento</span>
                          <span className="font-bold text-gray-700">
                            {s.agendamento_data ? `${new Date(s.agendamento_data).toLocaleDateString('pt-BR')} às ${s.agendamento_hora}` : "PARA AGORA"}
                          </span>
                        </div>
                        <div className="md:col-span-2 mt-4 pt-4 border-t-2 border-primary/10">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="text-gray-400 block mb-1 text-[10px] font-bold uppercase tracking-wider"><MapPin className="w-3.5 h-3.5 inline mr-1" />Logística do Resgate</span>
                            </div>
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent("Endereço da sua base aqui")}&waypoints=${encodeURIComponent(s.lat_long_origem || s.endereco_origem)}&destination=${encodeURIComponent(s.endereco_destino)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-primary text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md hover:bg-blue-700 transition-all flex items-center gap-1.5"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              Ver Rota Completa ↗
                            </a>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-white p-3 rounded-xl border border-gray-100">
                              <span className="text-gray-400 block mb-1 text-[9px] font-bold uppercase tracking-wider">Ponto de Busca (Origem)</span>
                              <p className="font-bold text-gray-800 text-xs">{s.endereco_origem}</p>
                              {s.lat_long_origem && (
                                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md mt-1 inline-block">GPS Anexado ✓</span>
                              )}
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-gray-100">
                              <span className="text-gray-400 block mb-1 text-[9px] font-bold uppercase tracking-wider">Ponto de Entrega (Destino)</span>
                              <p className="font-bold text-gray-800 text-xs">{s.endereco_destino}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="md:col-span-2 mt-2 pt-2 border-t border-gray-200/60 pb-2 flex justify-between items-end">
                        <div className="flex-1">
                          <span className="text-gray-400 block mb-1 text-xs font-bold uppercase tracking-wider">Criado Em</span>
                          <span className="font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md inline-block">
                            {new Date(s.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        {s.valor_cobrado > 0 && (
                          <div className="sm:text-right mt-2 sm:mt-0 flex flex-col items-end">
                            <span className="text-gray-400 block mb-1 text-xs font-bold uppercase tracking-wider">Valor e Pagamento</span>
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg inline-block text-lg">
                                R$ {s.valor_cobrado.toFixed(2)}
                              </span>
                              {s.forma_pagamento && (
                                <span className="text-[10px] font-bold uppercase text-gray-400 flex items-center gap-1">
                                  {s.forma_pagamento} {s.recebedor ? `• ${s.recebedor}` : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {s.status === "em_andamento" && (
                          <div className="mt-2 sm:mt-0 w-full sm:w-32">
                            <label className="text-gray-400 block mb-1 text-xs font-bold uppercase tracking-wider">Preço (R$)</label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={tempPreco[s.id] || ''}
                              onChange={(e) => handleTempPrecoChange(s.id, e.target.value)}
                              className="w-full bg-white border border-gray-200 p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary text-right text-black"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Inline Editing Form */}
                    {editingId === s.id && (
                      <div className="mt-6 pt-6 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Valor Cobrado (R$)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={editForm.valor}
                              onChange={(e) => setEditForm({ ...editForm, valor: e.target.value })}
                              className="w-full border border-gray-200 p-3 rounded-xl font-black text-black focus:ring-2 focus:ring-primary/20 outline-none"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Forma de Pagamento</label>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { id: 'pix', label: 'Pix', icon: Wallet },
                                { id: 'cartao', label: 'Cartão', icon: CreditCard },
                                { id: 'dinheiro', label: 'Dinheiro', icon: Banknote }
                              ].map((method) => (
                                <button
                                  key={method.id}
                                  onClick={() => setEditForm({ ...editForm, forma_pagamento: method.id })}
                                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${editForm.forma_pagamento === method.id
                                      ? "bg-primary text-white border-primary"
                                      : "bg-white text-gray-600 border-gray-100 hover:border-primary/20 hover:bg-gray-50"
                                    }`}
                                >
                                  <method.icon className="w-4 h-4" />
                                  {method.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {(editForm.forma_pagamento === 'pix' || editForm.forma_pagamento === 'cartao') && (
                            <div className="md:col-span-3">
                              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Recebedor</label>
                              <div className="flex gap-2">
                                {['Recebedor 1', 'Recebedor 2'].map((recebedor) => (
                                  <button
                                    key={recebedor}
                                    type="button"
                                    onClick={() => setEditForm({ ...editForm, recebedor: recebedor })}
                                    className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${editForm.recebedor === recebedor
                                        ? "bg-blue-600 text-white border-blue-600"
                                        : "bg-white text-gray-600 border-gray-100 hover:border-blue-200 hover:bg-blue-50/30"
                                      }`}
                                  >
                                    {recebedor}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                          <button onClick={() => setEditingId(null)} className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-50">Cancelar</button>
                          <button onClick={() => saveEdit(s.id)} className="bg-primary text-white px-8 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-primary/20 flex items-center gap-2">
                            <Check className="w-4 h-4" />
                            Salvar Alterações
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 justify-end pt-4 border-t border-gray-100 mt-2">
                      {s.status === "pendente" && (
                        <button onClick={() => updateStatus(s.id, "em_andamento", s.valor_cobrado)} className="bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
                          Aceitar Resgate
                        </button>
                      )}
                      {s.status === "em_andamento" && (
                        <button
                          onClick={() => updateStatus(s.id, "concluido", s.valor_cobrado)}
                          disabled={!tempPreco[s.id]}
                          title={!tempPreco[s.id] ? "Insira o preço antes de concluir" : ""}
                          className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                        >
                          Concluir & Cobrar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Manual Resgate Modal */}
            {isModalOpen && (
              <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="bg-gray-50 border-b border-gray-100 p-5 flex justify-between items-center">
                    <h3 className="font-black text-xl text-gray-900">Adicionar Resgate Feito</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                      ✕
                    </button>
                  </div>
                  <form onSubmit={submitManualResgate} className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Nome</label>
                        <input name="nome" required className="w-full border border-gray-200 p-2.5 rounded-xl text-sm text-black" />
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Telefone</label>
                        <input name="telefone" required className="w-full border border-gray-200 p-2.5 rounded-xl text-sm text-black" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Moto / Veículo</label>
                        <input name="moto" required className="w-full border border-gray-200 p-2.5 rounded-xl text-sm text-black" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Origem (De onde)</label>
                        <input name="endereco_origem" required className="w-full border border-gray-200 p-2.5 rounded-xl text-sm text-black" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Destino (Pra onde)</label>
                        <input name="endereco_destino" required className="w-full border border-gray-200 p-2.5 rounded-xl text-sm text-black" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Valor Cobrado (R$)</label>
                        <input name="valor_cobrado" type="number" step="0.01" required className="w-full border border-gray-200 p-2.5 rounded-xl text-sm font-black text-black" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Forma de Pagamento</label>
                        <input type="hidden" name="forma_pagamento" value={manualPayment.method} />
                        <div className="flex flex-wrap gap-2">
                          {[
                            { id: 'pix', label: 'Pix', icon: Wallet },
                            { id: 'cartao', label: 'Cartão', icon: CreditCard },
                            { id: 'dinheiro', label: 'Dinheiro', icon: Banknote }
                          ].map((method) => (
                            <button
                              key={method.id}
                              type="button"
                              onClick={() => setManualPayment({ ...manualPayment, method: method.id })}
                              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${manualPayment.method === method.id
                                  ? "bg-primary text-white border-primary"
                                  : "bg-white text-gray-600 border-gray-100 hover:border-primary/20"
                                }`}
                            >
                              <method.icon className="w-3.5 h-3.5" />
                              {method.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {(manualPayment.method === 'pix' || manualPayment.method === 'cartao') && (
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Recebedor</label>
                          <input type="hidden" name="recebedor" value={manualPayment.receiver} />
                          <div className="flex gap-2">
                            {['Recebedor 1', 'Recebedor 2'].map((recebedor) => (
                              <button
                                key={recebedor}
                                type="button"
                                onClick={() => setManualPayment({ ...manualPayment, receiver: recebedor })}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${manualPayment.receiver === recebedor
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-white text-gray-600 border-gray-100 hover:border-blue-200"
                                  }`}
                              >
                                {recebedor}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                      <button type="button" onClick={() => {
                        setIsModalOpen(false);
                        setManualPayment({ method: "", receiver: "" });
                      }} className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
                      <button type="submit" className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:shadow-md hover:bg-blue-700">Salvar Resgate</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "financeiro" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-3xl font-black mb-8 text-gray-900 tracking-tight">Controle Financeiro</h3>

            <form onSubmit={submitFinanceiro} className="bg-gray-50/50 p-6 md:p-8 rounded-2xl border border-gray-100 mb-10 space-y-6 shadow-sm">
              <h4 className="font-bold text-xl text-gray-800 border-b border-gray-200 pb-4">Adicionar Lançamento / NF</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Gasto</label>
                  <input name="tipo_gasto" required placeholder="Ex: Combustível, Pedágio" className="w-full bg-white border border-gray-200 p-3.5 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-black" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Valor (R$)</label>
                  <input name="valor" type="number" step="0.01" required placeholder="0.00" className="w-full bg-white border border-gray-200 p-3.5 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors font-mono text-black" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">KM Rodado</label>
                  <input name="km_rodado" type="number" step="0.1" required placeholder="0.0" className="w-full bg-white border border-gray-200 p-3.5 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors font-mono text-black" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Data</label>
                  <input name="data" type="date" required className="w-full bg-white border border-gray-200 p-3.5 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-black" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">URL da Nota Fiscal (Opcional)</label>
                  <input name="nota_fiscal_url" type="url" placeholder="https://..." className="w-full bg-white border border-gray-200 p-3.5 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-black" />
                </div>
              </div>
              <button type="submit" className="bg-primary text-white font-bold py-3.5 px-8 rounded-xl hover:bg-blue-700 mt-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 block w-full md:w-auto">
                Registrar Gasto
              </button>
            </form>

            <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm mt-8">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm whitespace-nowrap border-collapse bg-white">
                  <thead className="uppercase tracking-wider bg-gray-50/80 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 font-bold text-gray-500 text-xs">Data</th>
                      <th className="px-6 py-4 font-bold text-gray-500 text-xs">Tipo</th>
                      <th className="px-6 py-4 font-bold text-gray-500 text-xs">Valor (R$)</th>
                      <th className="px-6 py-4 font-bold text-gray-500 text-xs">KM</th>
                      <th className="px-6 py-4 font-bold text-gray-500 text-xs text-center">NF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {financeiro.map(f => (
                      <tr key={f.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-600">{new Date(f.data).toLocaleDateString('pt-BR')}</td>
                        <td className="px-6 py-4 font-bold text-gray-900">{f.tipo_gasto}</td>
                        <td className="px-6 py-4 text-red-600 font-bold bg-red-50/30">R$ {f.valor.toFixed(2)}</td>
                        <td className="px-6 py-4 font-medium text-gray-600 bg-gray-50/30">{f.km_rodado} km</td>
                        <td className="px-6 py-4 text-center">
                          {f.nota_fiscal_url ? (
                            <a href={f.nota_fiscal_url} target="_blank" rel="noreferrer" className="text-primary hover:text-white hover:bg-primary px-3 py-1.5 rounded-md text-xs font-bold transition-colors inline-block border border-primary/20">Ver NF</a>
                          ) : <span className="text-gray-400 text-xs font-medium">N/A</span>}
                        </td>
                      </tr>
                    ))}
                    {financeiro.length === 0 && (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500 font-medium bg-gray-50/30">Nenhum registro financeiro efetuado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "manutencao" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-3xl font-black mb-8 text-gray-900 tracking-tight">Checklist Manutenção</h3>

            <form onSubmit={submitManutencao} className="bg-gray-50/50 p-6 md:p-8 rounded-2xl border border-gray-100 mb-10 space-y-6 shadow-sm">
              <h4 className="font-bold text-xl text-gray-800 border-b border-gray-200 pb-4">Adicionar Novo Checklist</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Veículo / Equipamento</label>
                  <div className="flex gap-4">
                    {['Fiesta', 'Ruby'].map((v) => (
                      <label key={v} className="flex-1 group flex items-center justify-center space-x-2 cursor-pointer bg-white border border-gray-200 py-3 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                        <input
                          type="radio"
                          name="veiculo"
                          required
                          value={v}
                          className="w-4 h-4 text-primary focus:ring-primary/20 border-gray-300"
                        />
                        <span className="font-bold text-gray-700 group-has-[:checked]:text-primary text-sm">{v}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Peça / Componente</label>
                  <input name="item_desgaste" required placeholder="Ex: Óleo, Pneus, Correia" className="w-full bg-white border border-gray-200 p-3.5 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-black" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Valor Total do Gasto (R$)</label>
                  <input name="valor" type="number" step="0.01" required placeholder="0.00" className="w-full bg-white border border-gray-200 p-3.5 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors font-mono text-black" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Data da Troca</label>
                  <input name="data_troca" type="date" required className="w-full bg-white border border-gray-200 p-3.5 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-black" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Próxima Revisão Estimada</label>
                  <input name="proxima_revisao" type="date" required className="w-full bg-white border border-gray-200 p-3.5 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-black" />
                </div>
              </div>
              <button type="submit" disabled={isSubmitting} className="bg-primary text-white font-bold py-3.5 px-8 rounded-xl hover:bg-blue-700 mt-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 block w-full md:w-auto disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                {isSubmitting ? "Aguarde..." : "Registrar Manutenção"}
              </button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {manutencao.map(m => {
                const isLate = new Date(m.proxima_revisao) < new Date();
                return (
                  <div key={m.id} className={`flex flex-col bg-white border ${isLate ? "border-red-200 shadow-red-50" : "border-gray-100 hover:border-primary/20"} p-5 rounded-2xl shadow-sm hover:shadow-md transition-all`}>
                    <div className="flex items-start justify-between mb-3 border-b border-gray-50 pb-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase text-primary bg-primary/5 px-2 py-0.5 rounded-md self-start mb-1">{m.veiculo}</span>
                        <span className="font-black text-lg text-gray-900">{m.item_desgaste}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-black text-red-600">R$ {m.valor.toFixed(2)}</span>
                          <button
                            onClick={() => setConfirmingDelete(m.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir Manutenção"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {isLate && <span className="text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 px-2 py-1 rounded-md">Vencido</span>}
                      </div>
                    </div>
                    <div className="text-sm space-y-2">
                      <p className="flex justify-between items-center text-gray-500">
                        <span className="font-semibold text-xs uppercase tracking-wider">Trocado em</span>
                        <span className="font-medium bg-gray-50 px-2 py-0.5 rounded text-gray-700">{new Date(m.data_troca).toLocaleDateString('pt-BR')}</span>
                      </p>
                      <p className={`flex justify-between items-center ${isLate ? "text-red-600" : "text-gray-500"}`}>
                        <span className="font-semibold text-xs uppercase tracking-wider">Próxima Revisão</span>
                        <span className={`font-bold ${isLate ? "bg-red-50 px-2 py-0.5 rounded" : "bg-gray-50 px-2 py-0.5 rounded text-gray-700"}`}>{new Date(m.proxima_revisao).toLocaleDateString('pt-BR')}</span>
                      </p>
                    </div>
                  </div>
                )
              })}
              {manutencao.length === 0 && (
                <div className="col-span-2 text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                  <p className="text-gray-500 font-medium">Nenhuma manutenção registrada até o momento.</p>
                </div>
              )}
            </div>

            {/* Confirmation Modal for Deletion */}
            {confirmingDelete && (
              <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Trash2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 mb-2">Confirmar Exclusão?</h3>
                    <p className="text-gray-500 text-sm mb-6">Esta ação não pode ser desfeita. O registro de manutenção será removido permanentemente.</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setConfirmingDelete(null)}
                        className="flex-1 px-4 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => deleteManutencao(confirmingDelete)}
                        className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors"
                      >
                        Sim, Excluir
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
