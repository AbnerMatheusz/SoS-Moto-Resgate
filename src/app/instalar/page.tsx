"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function InstalarPage() {
  const [notifStatus, setNotifStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");
  const [isInstalled, setIsInstalled] = useState(false);
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    // Initialize QR URL with current origin
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQrUrl(window.location.origin);
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }
    if (Notification.permission === "granted") {
      setNotifStatus("granted");
    } else if (Notification.permission === "denied") {
      setNotifStatus("denied");
    }
  }, []);

  const enableNotifications = async () => {
    setNotifStatus("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNotifStatus("denied");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });

      setNotifStatus("granted");
    } catch (err) {
      console.error("Erro ao ativar notificações:", err);
      setNotifStatus("denied");
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-8 px-4 space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary/30">
          <span className="text-white font-black text-2xl">SOS</span>
        </div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Instalar o App</h1>
        <p className="text-gray-500 text-sm mt-2">Adicione o SOS Moto Resgate à tela inicial do seu celular</p>
      </div>

      {/* QR Code */}
      <div className="bg-white rounded-3xl border border-black/10 shadow-sm p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Escaneie para abrir no celular</p>
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-white rounded-2xl border-2 border-gray-100 shadow-inner">
            {qrUrl && (
              <QRCodeSVG
                value={qrUrl}
                size={200}
                level="H"
                fgColor="#0000FF"
                bgColor="#ffffff"
              />
            )}
          </div>
        </div>
        {/* Editable URL for the QR code */}
        <div className="mt-3">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">URL do QR Code (editável)</label>
          <input
            type="text"
            value={qrUrl}
            onChange={(e) => setQrUrl(e.target.value)}
            className="w-full border border-black rounded-xl p-2.5 text-sm text-gray-900 text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="http://192.168.x.x:3000"
          />
          <p className="text-xs text-gray-400 mt-1">Para testes no celular, utilize o IP da sua rede WiFi (ex: <strong>http://192.168.x.x:3000</strong>)</p>
        </div>
      </div>

      {/* Install Instructions */}
      <div className="bg-white rounded-3xl border border-black/10 shadow-sm p-6 space-y-4">
        <h2 className="font-black text-gray-900 text-lg">Como instalar</h2>

        <div className="space-y-3">
          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 bg-gray-900 text-white rounded-xl flex items-center justify-center font-black text-sm shrink-0">A</div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Android (Chrome)</p>
              <p className="text-gray-500 text-xs">Toque nos <strong>⋮ 3 pontos</strong> no canto superior → <strong>&quot;Adicionar à tela inicial&quot;</strong></p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 bg-gray-200 text-gray-800 rounded-xl flex items-center justify-center font-black text-sm shrink-0">🍎</div>
            <div>
              <p className="font-bold text-gray-900 text-sm">iPhone (Safari)</p>
              <p className="text-gray-500 text-xs">Toque no ícone de <strong>compartilhar ↑</strong> → role para baixo → <strong>&quot;Adicionar à Tela de Início&quot;</strong></p>
            </div>
          </div>
        </div>

        {isInstalled && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-2">
            <span className="text-emerald-600 font-black text-sm">✅ App instalado!</span>
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-3xl border border-black/10 shadow-sm p-6">
        <h2 className="font-black text-gray-900 text-lg mb-1">Notificações</h2>
        <p className="text-gray-500 text-sm mb-4">Receba alertas quando uma nova solicitação chegar.</p>

        {notifStatus === "granted" ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-sm font-bold text-emerald-700 flex items-center gap-2">
            🔔 Notificações ativas neste dispositivo!
          </div>
        ) : notifStatus === "denied" ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-sm font-bold text-red-700">
            ❌ Permissão negada. Ative nas configurações do navegador.
          </div>
        ) : (
          <button
            onClick={enableNotifications}
            disabled={notifStatus === "loading"}
            className="w-full bg-primary text-white font-black py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {notifStatus === "loading" ? "Aguarde..." : "🔔 Ativar Notificações"}
          </button>
        )}
      </div>
    </div>
  );
}

// Helper: convert base64 to Uint8Array for VAPID
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}
