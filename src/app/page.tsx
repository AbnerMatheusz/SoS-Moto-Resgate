"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { MapPin, AlertCircle, Loader2, ArrowDown, Flag } from "lucide-react";
import { supabase } from "@/lib/supabase";

type ResgateForm = {
  nome: string;
  telefone: string;
  moto: string;
  endereco_origem: string;
  cidade_origem: string;
  endereco_destino: string;
  cidade_destino: string;
  travada: "sim" | "nao" | null;
  acompanhantes: "0" | "1" | "2" | null;
  agendamento_tipo: "agora" | "agendado" | null;
  data_agendamento?: string;
  hora_agendamento?: string;
};

export default function Home() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [latLongOrigem, setLatLongOrigem] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [submittedData, setSubmittedData] = useState<(ResgateForm & { latLongOrigem: string }) | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<ResgateForm>();

  const agendamentoTipo = watch("agendamento_tipo");

  const getLocalizacao = () => {
    if (!navigator.geolocation) {
      alert("Geolocalização não é suportada pelo seu navegador.");
      return;
    }

    // Check if in a secure context (required for geolocation in modern browsers)
    if (!window.isSecureContext) {
      alert("⚠️ GPS não disponível em modo de teste (HTTP).\n\nPara usar o GPS, o site precisa estar em HTTPS. Isso funciona normalmente na versão publicada do site.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setLatLongOrigem(`${lat}, ${lon}`);

        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
          if (response.ok) {
            const data = await response.json();
            if (data && data.display_name) {
              const road = data.address.road || data.address.pedestrian || data.address.path || "";
              const number = data.address.house_number || "";

              let shortAddress = "";
              if (road && number) {
                shortAddress = `${road}, ${number}`;
              } else if (road) {
                shortAddress = `Próximo a ${road}`;
              } else {
                // Último recurso: pega as primeiras partes do display_name
                shortAddress = data.display_name.split(",").slice(0, 2).join(",").trim();
              }

              setValue("endereco_origem", shortAddress, { shouldValidate: true });
              // Auto-fill city from GPS
              const cidade = data.address.city || data.address.town || data.address.village || data.address.municipality || "";
              if (cidade) setValue("cidade_origem", cidade, { shouldValidate: true });
            }
          }
        } catch (err) {
          console.error("Erro ao buscar endereço pelo GPS:", err);
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        alert("Não foi possível obter a sua localização. Verifique as permissões de GPS.");
        setIsLocating(false);
      }
    );
  };

  // Extrai nome da rua removendo números, vírgulas e espaços extras
  const extrairRua = (endereco: string) => {
    return endereco
      .toLowerCase()
      .replace(/[0-9]/g, "")
      .replace(/,/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const onSubmit = async (data: ResgateForm) => {
    if (data.travada === null) {
      setErrorMsg("Por favor, informe se a moto está travada.");
      return;
    }

    if (data.acompanhantes === null) {
      setErrorMsg("Por favor, informe a quantidade de acompanhantes.");
      return;
    }

    if (data.agendamento_tipo === "agendado" && (!data.data_agendamento || !data.hora_agendamento)) {
      setErrorMsg("Por favor, preencha a data e a hora do agendamento.");
      return;
    }

    // Validação: endereços de origem e destino não podem ser a mesma rua
    const ruaOrigem = extrairRua(data.endereco_origem);
    const ruaDestino = extrairRua(data.endereco_destino);
    if (ruaOrigem && ruaDestino && ruaOrigem === ruaDestino) {
      setErrorMsg("⚠️ O endereço de BUSCA e o de ENTREGA não podem ser na mesma rua. Verifique os endereços.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    const stringAgendamento = data.agendamento_tipo === "agora" || !data.agendamento_tipo
      ? "PARA AGORA"
      : `AGENDADO: ${data.data_agendamento?.split('-').reverse().join('/')} às ${data.hora_agendamento}`;

    // Combine GPS and text address to fit the MVP database schema constraint
    const origemCombinada = latLongOrigem
      ? `Endereço: ${data.endereco_origem} | GPS: ${latLongOrigem}`
      : data.endereco_origem;

    // Combine Moto, Acompanhantes and Agendamento to fit schema constraint
    const motoComAcompanhantes = `${data.moto} | Acompanhantes: ${data.acompanhantes === '0' ? 'Não irá' : data.acompanhantes} | ${stringAgendamento}`;

    const { error } = await supabase.from("solicitacoes").insert([
      {
        nome: data.nome,
        telefone: data.telefone,
        moto: data.moto,
        endereco_origem: `${data.endereco_origem}${data.cidade_origem ? `, ${data.cidade_origem}` : ""}`,
        lat_long_origem: latLongOrigem || null,
        endereco_destino: `${data.endereco_destino}${data.cidade_destino ? `, ${data.cidade_destino}` : ""}`,
        travada: data.travada === "sim",
        acompanhantes: parseInt(data.acompanhantes || "0"),
        agendamento_data: data.agendamento_tipo === "agendado" ? data.data_agendamento : null,
        agendamento_hora: data.agendamento_tipo === "agendado" ? data.hora_agendamento : null,
        status: "pendente",
      },
    ]);

    setIsSubmitting(false);

    if (error) {
      setErrorMsg(`Erro ao enviar solicitação: ${error.message} (${error.code})`);
      console.error("Supabase insert error:", error);
    } else {
      setSubmittedData({ ...data, latLongOrigem });
      setSuccess(true);
    }
  };

  if (success && submittedData) {
    const numeroSOS = "5500000000000"; // Substitua pelo número do WhatsApp da empresa
    const textoWhatsapp = `Olá! Já fiz o pedido pelo site e fico no aguardo de mais informações. 😊`;
    const linkWhatsapp = `https://api.whatsapp.com/send?phone=${numeroSOS}&text=${encodeURIComponent(textoWhatsapp)}`;

    const handleWhatsapp = () => {
      window.open(linkWhatsapp, "_blank");
    };

    const handleNovaSolicitacao = () => {
      setSuccess(false);
      setSubmittedData(null);
      reset();
      setLatLongOrigem("");
    };

    return (
      <div className="relative w-full max-w-3xl mx-auto">
        {/* Blurred form behind */}
        <div className="blur-sm pointer-events-none select-none opacity-40 bg-white p-6 md:p-10 rounded-2xl border border-gray-100 min-h-[500px]" />

        {/* Modal Overlay */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-300">
            {/* Top green accent */}
            <div className="bg-gradient-to-r from-[#25D366] to-[#128C7E] p-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-9 h-9 fill-white" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.128.552 4.192 1.6 6.015L.15 23.365l5.47-1.436c1.761.956 3.738 1.46 5.766 1.46v-.001c6.646 0 12.03-5.385 12.03-12.03S18.675 0 12.031 0h-.001zm0 20.392c-1.801 0-3.565-.483-5.11-1.399l-.367-.217-3.793.995 1.018-3.702-.238-.378a10.024 10.024 0 01-1.53-5.31C2.015 4.881 6.88 0 12.031 0s10.016 4.881 10.016 10.016-4.881 10.016-10.016 10.016v-.001zm5.503-7.518c-.302-.151-1.782-.88-2.057-.981-.275-.101-.476-.151-.676.151-.201.302-.777.981-.953 1.182-.176.201-.352.226-.653.075-1.554-.775-2.731-1.46-3.805-3.351-.176-.301.176-.276.471-.861.1-.201.05-.377-.025-.527-.075-.151-.676-1.631-.926-2.234-.242-.581-.489-.503-.676-.512h-.577c-.201 0-.527.075-.803.377-.275.302-1.054 1.03-1.054 2.515 0 1.485 1.078 2.922 1.229 3.123s2.126 3.42 5.253 4.757c2.197.935 2.96.88 3.486.744.606-.156 1.782-.729 2.032-1.433.25-.704.25-1.308.176-1.434-.076-.126-.277-.201-.578-.352z" />
                </svg>
              </div>
              <h2 className="text-xl font-black tracking-tight">Solicitação Registrada! ✅</h2>
              <p className="text-white/80 text-sm mt-1">Sua solicitação está no sistema.</p>
            </div>

            {/* Body */}
            <div className="p-6 text-center">
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-5 text-left flex gap-3 items-start">
                <span className="text-2xl shrink-0">👇</span>
                <div>
                  <p className="font-black text-gray-900 text-sm">Último passo importante!</p>
                  <p className="text-gray-600 text-sm mt-1">
                    Clique no botão abaixo para <strong>confirmar pelo WhatsApp</strong>. Nossa equipe irá te responder e confirmar o horário do resgate por lá e <strong>te passar o valor do guincho!</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={handleWhatsapp}
                className="w-full bg-[#25D366] hover:bg-[#1ebe5d] active:scale-95 text-white font-black text-lg py-4 px-6 rounded-2xl shadow-lg shadow-green-200 transition-all duration-200 flex items-center justify-center gap-3 mb-2"
              >
                <svg className="w-6 h-6 fill-white shrink-0" viewBox="0 0 24 24">
                  <path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.128.552 4.192 1.6 6.015L.15 23.365l5.47-1.436c1.761.956 3.738 1.46 5.766 1.46v-.001c6.646 0 12.03-5.385 12.03-12.03S18.675 0 12.031 0h-.001zm0 20.392c-1.801 0-3.565-.483-5.11-1.399l-.367-.217-3.793.995 1.018-3.702-.238-.378a10.024 10.024 0 01-1.53-5.31C2.015 4.881 6.88 0 12.031 0s10.016 4.881 10.016 10.016-4.881 10.016-10.016 10.016v-.001zm5.503-7.518c-.302-.151-1.782-.88-2.057-.981-.275-.101-.476-.151-.676.151-.201.302-.777.981-.953 1.182-.176.201-.352.226-.653.075-1.554-.775-2.731-1.46-3.805-3.351-.176-.301.176-.276.471-.861.1-.201.05-.377-.025-.527-.075-.151-.676-1.631-.926-2.234-.242-.581-.489-.503-.676-.512h-.577c-.201 0-.527.075-.803.377-.275.302-1.054 1.03-1.054 2.515 0 1.485 1.078 2.922 1.229 3.123s2.126 3.42 5.253 4.757c2.197.935 2.96.88 3.486.744.606-.156 1.782-.729 2.032-1.433.25-.704.25-1.308.176-1.434-.076-.126-.277-.201-.578-.352z" />
                </svg>
                Enviar no WhatsApp Agora
              </button>

              <button
                onClick={handleNovaSolicitacao}
                className="w-full text-gray-400 font-semibold text-sm py-2 hover:text-gray-600 transition-colors"
              >
                Fazer nova solicitação
              </button>

            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto bg-white p-6 md:p-10 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/50">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-black mb-2 text-gray-900 tracking-tight">
          Solicitar Resgate
        </h2>
        <p className="text-gray-500 text-sm font-medium">Preencha os dados abaixo rapidamente para enviarmos ajuda.</p>
      </div>

      {errorMsg && (
        <div className="bg-red-50/80 backdrop-blur-sm border border-red-100 text-red-600 p-4 rounded-xl mb-8 flex items-start shadow-sm">
          <AlertCircle className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
          <span className="font-medium text-sm">{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Nome Completo</label>
          <input
            {...register("nome", { required: "Campo obrigatório" })}
            className="w-full bg-gray-50/50 border border-black rounded-xl p-3.5 text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
            placeholder="Digite seu nome"
          />
          {errors.nome && <span className="text-red-500 text-sm mt-1.5 inline-block font-medium">{errors.nome.message}</span>}
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Telefone (WhatsApp)</label>
          <input
            type="tel"
            {...register("telefone", { required: "Campo obrigatório" })}
            className="w-full bg-gray-50/50 border border-black rounded-xl p-3.5 text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
            placeholder="(43) 90000-0000"
          />
          {errors.telefone && <span className="text-red-500 text-sm mt-1.5 inline-block font-medium">{errors.telefone.message}</span>}
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Modelo da Moto</label>
          <input
            {...register("moto", { required: "Campo obrigatório" })}
            className="w-full bg-gray-50/50 border border-black rounded-xl p-3.5 text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
            placeholder="Ex: Honda CG 160"
          />
          {errors.moto && <span className="text-red-500 text-sm mt-1.5 inline-block font-medium">{errors.moto.message}</span>}
        </div>

        {/* ===== SEÇÃO ORIGEM - BUSCAR AQUI ===== */}
        <div className="bg-amber-50 p-5 rounded-2xl border-2 border-amber-300 space-y-4 relative">
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-amber-500 text-white p-2 rounded-lg shadow-sm">
              <MapPin className="w-5 h-5" />
            </span>
            <div>
              <p className="text-amber-800 font-black text-base tracking-tight">📍 BUSCAR AQUI</p>
              <p className="text-amber-600 text-xs font-medium">Onde a moto está parada agora?</p>
            </div>
          </div>

          <div>
            <input
              {...register("endereco_origem", { required: "O endereço de origem é obrigatório" })}
              className="w-full bg-white border-2 border-amber-200 rounded-xl p-3.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all duration-200 shadow-sm mb-2 placeholder:text-gray-400"
              placeholder="Ex: Rua das Flores, 123, Centro"
            />
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                {errors.endereco_origem && <span className="text-red-500 text-sm mb-1 inline-block font-medium">{errors.endereco_origem.message}</span>}
              </div>
              <div>
                <input
                  {...register("cidade_origem", { required: "Informe a cidade" })}
                  className="w-full bg-white border-2 border-amber-200 rounded-xl p-3.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all duration-200 shadow-sm text-sm placeholder:text-gray-400"
                  placeholder="Cidade"
                />
                {errors.cidade_origem && <span className="text-red-500 text-xs mt-1 inline-block font-medium">{errors.cidade_origem.message}</span>}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={getLocalizacao}
            disabled={isLocating}
            className="w-full bg-white border-2 border-dashed border-amber-300 text-amber-700 font-semibold py-3 px-4 rounded-xl hover:bg-amber-50 hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 flex items-center justify-center transition-all duration-200"
          >
            {isLocating ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin text-amber-600" /> Capturando GPS...</>
            ) : latLongOrigem ? (
              <span className="text-emerald-600 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                GPS Capturado ✓ — Toque para Atualizar
              </span>
            ) : (
              <><MapPin className="w-4 h-4 mr-2" /> Anexar Localização Atual (GPS) — Opcional</>
            )}
          </button>

          {latLongOrigem && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(latLongOrigem)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 mt-2 w-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-sm py-2.5 px-4 rounded-xl hover:bg-emerald-100 transition-all"
            >
              <MapPin className="w-4 h-4" />
              Ver minha localização no Maps ↗
            </a>
          )}
        </div>

        {/* Seta visual indicando direção */}
        <div className="flex justify-center -my-2">
          <div className="bg-gray-200 rounded-full p-2">
            <ArrowDown className="w-5 h-5 text-gray-500" />
          </div>
        </div>

        <div className="pt-2">
          <label className="block text-sm font-bold text-gray-700 mb-3">Quando precisa do resgate?</label>
          <div className="flex gap-4 mb-4">
            <label className="group flex flex-1 items-center justify-center space-x-2 cursor-pointer bg-white border border-black py-3 px-3 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 shadow-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:ring-1 has-[:checked]:ring-primary/50">
              <input
                type="radio"
                value="agora"
                {...register("agendamento_tipo", { required: "Selecione quando precisa do resgate" })}
                className="w-4 h-4 text-primary focus:ring-primary/20 border-gray-300"
              />
              <span className="font-bold text-gray-700 group-has-[:checked]:text-primary text-sm whitespace-nowrap">Para Agora</span>
            </label>
            <label className="group flex flex-1 items-center justify-center space-x-2 cursor-pointer bg-white border border-black py-3 px-3 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 shadow-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:ring-1 has-[:checked]:ring-primary/50">
              <input
                type="radio"
                value="agendado"
                {...register("agendamento_tipo")} // Handled by conditional validation
                className="w-4 h-4 text-primary focus:ring-primary/20 border-gray-300"
              />
              <span className="font-bold text-gray-700 group-has-[:checked]:text-primary text-sm whitespace-nowrap">Agendar</span>
            </label>
          </div>
          {errors.agendamento_tipo && <span className="text-red-500 text-sm mt-2 block font-medium text-center">{errors.agendamento_tipo.message}</span>}

          {agendamentoTipo === "agendado" && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Data</label>
                <input
                  type="date"
                  {...register("data_agendamento", { required: "A data é obrigatória quando agendado" })}
                  className="w-full bg-white border border-black rounded-xl p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                />
                {errors.data_agendamento && <span className="text-red-500 text-xs mt-1 block font-medium">{errors.data_agendamento.message}</span>}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Hora</label>
                <input
                  type="time"
                  {...register("hora_agendamento", { required: "A hora é obrigatória quando agendado" })}
                  className="w-full bg-white border border-black rounded-xl p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                />
                {errors.hora_agendamento && <span className="text-red-500 text-xs mt-1 block font-medium">{errors.hora_agendamento.message}</span>}
              </div>
            </div>
          )}
        </div>

        {/* ===== SEÇÃO DESTINO - LEVAR PARA ===== */}
        <div className="bg-emerald-50 p-5 rounded-2xl border-2 border-emerald-300 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-emerald-500 text-white p-2 rounded-lg shadow-sm">
              <Flag className="w-5 h-5" />
            </span>
            <div>
              <p className="text-emerald-800 font-black text-base tracking-tight">🏁 LEVAR PARA</p>
              <p className="text-emerald-600 text-xs font-medium">Onde devemos entregar a moto?</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <input
                {...register("endereco_destino", { required: "Campo obrigatório" })}
                className="w-full bg-white border-2 border-emerald-200 rounded-xl p-3.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition-all duration-200 shadow-sm placeholder:text-gray-400"
                placeholder="Ex: Oficina do João, Rua Bela Vista, 456"
              />
              {errors.endereco_destino && <span className="text-red-500 text-sm mt-1.5 inline-block font-medium">{errors.endereco_destino.message}</span>}
            </div>
            <div>
              <input
                {...register("cidade_destino", { required: "Informe a cidade" })}
                className="w-full bg-white border-2 border-emerald-200 rounded-xl p-3.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition-all duration-200 shadow-sm text-sm placeholder:text-gray-400"
                placeholder="Cidade"
              />
              {errors.cidade_destino && <span className="text-red-500 text-xs mt-1.5 inline-block font-medium">{errors.cidade_destino.message}</span>}
            </div>
          </div>
        </div>

        <div className="pt-2">
          <label className="block text-sm font-bold text-gray-700 mb-3">A moto esta travada ou batida?</label>
          <div className="flex gap-4">
            <label className="group flex flex-1 items-center justify-center space-x-2 cursor-pointer bg-white border border-black py-4 px-4 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 shadow-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:ring-1 has-[:checked]:ring-primary/50">
              <input
                type="radio"
                value="sim"
                {...register("travada", { required: "Selecione uma opção" })}
                className="w-4 h-4 text-primary focus:ring-primary/20 border-gray-300"
              />
              <span className="font-bold text-gray-700 group-has-[:checked]:text-primary">Sim</span>
            </label>
            <label className="group flex flex-1 items-center justify-center space-x-2 cursor-pointer bg-white border border-black py-4 px-4 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 shadow-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:ring-1 has-[:checked]:ring-primary/50">
              <input
                type="radio"
                value="nao"
                {...register("travada", { required: "Selecione uma opção" })}
                className="w-4 h-4 text-primary focus:ring-primary/20 border-gray-300"
              />
              <span className="font-bold text-gray-700 group-has-[:checked]:text-primary">Não</span>
            </label>
          </div>
          {errors.travada && <span className="text-red-500 text-sm mt-2 block font-medium text-center">{errors.travada.message}</span>}
        </div>

        <div className="pt-2">
          <label className="block text-sm font-bold text-gray-700 mb-3">Irá alguém junto no transporte (acompanhante)?</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="group flex flex-1 items-center justify-center space-x-2 cursor-pointer bg-white border border-black py-3 px-3 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 shadow-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:ring-1 has-[:checked]:ring-primary/50">
              <input
                type="radio"
                value="0"
                {...register("acompanhantes", { required: "Selecione uma opção" })}
                className="w-4 h-4 text-primary focus:ring-primary/20 border-gray-300"
              />
              <span className="font-bold text-gray-700 group-has-[:checked]:text-primary text-sm whitespace-nowrap">Não vou junto</span>
            </label>
            <label className="group flex flex-1 items-center justify-center space-x-2 cursor-pointer bg-white border border-black py-3 px-3 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 shadow-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:ring-1 has-[:checked]:ring-primary/50">
              <input
                type="radio"
                value="1"
                {...register("acompanhantes", { required: "Selecione uma opção" })}
                className="w-4 h-4 text-primary focus:ring-primary/20 border-gray-300"
              />
              <span className="font-bold text-gray-700 group-has-[:checked]:text-primary text-sm whitespace-nowrap">Apenas 1</span>
            </label>
            <label className="group flex flex-1 items-center justify-center space-x-2 cursor-pointer bg-white border border-black py-3 px-3 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 shadow-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:ring-1 has-[:checked]:ring-primary/50">
              <input
                type="radio"
                value="2"
                {...register("acompanhantes", { required: "Selecione uma opção" })}
                className="w-4 h-4 text-primary focus:ring-primary/20 border-gray-300"
              />
              <span className="font-bold text-gray-700 group-has-[:checked]:text-primary text-sm whitespace-nowrap">Irão 2</span>
            </label>
          </div>
          {errors.acompanhantes && <span className="text-red-500 text-sm mt-2 block font-medium text-center">{errors.acompanhantes.message}</span>}
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="relative w-full overflow-hidden bg-primary text-primary-foreground font-black text-lg py-4 px-6 rounded-xl shadow-[0_4px_14px_0_rgba(0,0,255,0.39)] hover:shadow-[0_6px_20px_rgba(0,0,255,0.23)] hover:bg-blue-700 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-primary/30 transition-all duration-200 mt-2 flex items-center justify-center disabled:opacity-70 disabled:hover:translate-y-0"
          >
            {isSubmitting ? (
              <><Loader2 className="w-6 h-6 mr-2 animate-spin" /> Enviando...</>
            ) : (
              "SOLICITAR RESGATE"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
