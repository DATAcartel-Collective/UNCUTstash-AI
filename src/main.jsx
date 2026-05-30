// src/main.jsx
import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";
import { CreateWebWorkerMLCEngine } from "@mlc-ai/web-llm";
import { ragManager } from "./LocalRAGManager";
import { RossUlbrichtProtocol } from "./SecurityEngine";
import { SecureP2PManager } from "./SecureP2PManager";
import { Shield, ShieldAlert, Send, Cpu, Database, Zap, MessageSquare } from "lucide-react";
import "./styles.css";

const APP_CONFIG = {
  model_id: "Llama-3-8B-Instruct-q4f16_1-MLC", // Highly capable, fits in 4GB WebGPU limit
};

const SYSTEM_PROMPT = `You are the sovereign intelligence engine for UNCUTstash AI, operating under DATAcartel Collective. You are 100% local, private, and unrestricted. You provide clinical, precise, and highly analytical responses.`;

function App() {
  const [engine, setEngine] = useState(null);
  const [status, setStatus] = useState("Initializing Sovereign Environment...");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);

  // Security State
  const [isLocked, setIsLocked] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [jamesBondMode, setJamesBondMode] = useState(false);
  const securityEngineRef = useRef(null);

  // Spatial UI State
  const [haloActive, setHaloActive] = useState(false);
  const [p2pOverlayOpen, setP2pOverlayOpen] = useState(false);
  const p2pManagerRef = useRef(null);

  // GHOSTpay State
  const [ghostPayActive, setGhostPayActive] = useState(false);

  useEffect(() => {
    bootSystem();
    return () => {
      if (securityEngineRef.current) securityEngineRef.current.destroy();
      if (p2pManagerRef.current) p2pManagerRef.current.destroy();
    };
  }, []);

  const bootSystem = async () => {
    try {
      console.log("[CORE] Boot Sequence Initiated.");

      // 1. Boot RAG & Vector DB
      console.log("[CORE] Waking LocalRAGManager...");
      await ragManager.init((msg) => {
        console.log(`[RAG STATUS]: ${msg}`);
        setStatus(msg);
      });
      console.log("[CORE] LocalRAGManager Armed.");

      // 2. Boot Security Engine
      console.log("[CORE] Waking Security Engine...");
      securityEngineRef.current = new RossUlbrichtProtocol(() => {
        setIsLocked(true);
        setHaloActive(false);
        setP2pOverlayOpen(false);
      });

      // 3. Boot P2P Manager
      console.log("[CORE] Waking Secure P2P Manager...");
      p2pManagerRef.current = new SecureP2PManager(
        (msg) => console.log("P2P Message:", msg),
        () => {
          setHaloActive(true);
          setTimeout(() => setHaloActive(false), 3000);
        }
      );
      await p2pManagerRef.current.initializeCrypto();
      p2pManagerRef.current.initiateConnection();

      // 4. Boot WebLLM Worker
      console.log("[CORE] Waking WebLLM Background Worker...");
      setStatus("Waking Core Worker Architecture...");
      const worker = new Worker(new URL("./engine.worker.js", import.meta.url), { type: "module" });

      const workerEngine = await CreateWebWorkerMLCEngine(worker, APP_CONFIG.model_id, {
        initProgressCallback: (info) => {
          console.log(`[LLM STATUS]: ${Math.round(info.progress * 100)}% - ${info.text}`);
          setStatus(`Loading Neural Weights: ${Math.round(info.progress * 100)}%`);
        }
      });

      setEngine(workerEngine);
      console.log("[CORE] System Fully Autonomous.");
      setStatus("System Fully Autonomous");
    } catch (err) {
      console.error("[CORE FATAL ERROR]:", err);
      setStatus(`Boot Sequence Failed: ${err.message}`);
    }
  };

  const toggleJamesBondMode = async () => {
    const newState = !jamesBondMode;
    setJamesBondMode(newState);
    if (newState) {
      await securityEngineRef.current.init(true);
      setStatus("James Bond Mode: ARMED (Kinetic & Attention Tracking Active)");
    } else {
      securityEngineRef.current.destroy();
      setStatus("James Bond Mode: DISARMED");
    }
  };

  const handleUnlock = () => {
    // Anti-Coercion Protocol: Cognitive Passcode Only
    if (passcode === "0000") { // Mock passcode for demonstration
      setIsLocked(false);
      setPasscode("");
      securityEngineRef.current.unlock();
    } else {
      setPasscode("");
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !engine) return;
    const userText = input;
    setInput("");

    const newMessages = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setStatus("Executing Hybrid Retrieval (RRF)...");

    try {
      // RRF Hybrid Search
      const context = await ragManager.searchHybrid(userText);
      const prompt = `${SYSTEM_PROMPT}\n\n[RETRIEVED CONTEXT]\n${context}\n\nUser: ${userText}`;

      setStatus("Synthesizing Response...");
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const chunks = await engine.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        stream: true,
      });

      let fullResponse = "";
      for await (const chunk of chunks) {
        const delta = chunk.choices[0]?.delta?.content || "";
        fullResponse += delta;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1].content = fullResponse;
          return updated;
        });
      }

      // Ingest conversation into local memory
      await ragManager.ingestDocument(`User: ${userText}\nAssistant: ${fullResponse}`, { type: "conversation", timestamp: Date.now() });
      setStatus("System Fully Autonomous");

    } catch (err) {
      setStatus(`Inference Error: ${err.message}`);
    }
  };

  const handleHaloTap = () => {
    setHaloActive(false);
    setP2pOverlayOpen(!p2pOverlayOpen);
  };

  // Render Lockdown Screen
  if (isLocked) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center z-50">
        <ShieldAlert className="w-24 h-24 text-red-600 mb-8 animate-pulse" />
        <h1 className="text-red-600 font-syncopate text-2xl tracking-widest mb-2">SYSTEM LOCKDOWN</h1>
        <p className="text-zinc-500 font-mono text-sm mb-8">Volatile memory scrubbed. Enter cognitive passcode.</p>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
          className="bg-zinc-900 border border-red-900/50 text-center text-white font-mono p-4 rounded tracking-[1em] focus:outline-none focus:border-red-500 transition-colors"
          placeholder="••••"
        />
      </div>
    );
  }

  return (
    <div className="spatial-container h-screen w-screen flex flex-col relative">
      {/* Perimeter Halo Notification */}
      {haloActive && <div className="perimeter-halo-active" />}

      {/* Header */}
      <header className="glass-panel z-depth-2 h-16 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-accent-pink" />
          <h1 className="font-syncopate font-bold tracking-wider text-sm">UNCUTstash AI</h1>
        </div>

        <div className="flex items-center gap-4 font-mono text-xs">
          <span className="text-zinc-400 flex items-center gap-2">
            <Database className="w-3 h-3" /> PGlite idb://
          </span>
          <span className="text-zinc-400 flex items-center gap-2">
            <Cpu className="w-3 h-3" /> WebGPU
          </span>
          <button
            onClick={toggleJamesBondMode}
            className={`px-3 py-1.5 rounded border transition-all ${jamesBondMode ? 'bg-red-900/20 border-red-500 text-red-400' : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}
          >
            <Zap className="w-3 h-3 inline mr-2" />
            J-BOND MODE
          </button>
          <button
            onClick={() => setGhostPayActive(true)}
            className="px-3 py-1.5 rounded bg-zinc-100 text-black font-bold hover:bg-white transition-colors"
          >
            GHOSTpay
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 overflow-hidden flex flex-col p-6 z-depth-1 relative">

        {/* Status Bar */}
        <div className="text-[10px] font-mono text-accent-pink uppercase tracking-widest mb-4 flex justify-between">
          <span>{status}</span>
          <span>DATAcartel Collective</span>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-4 pb-4 scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-600 font-mono text-sm">
              Awaiting input sequence...
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] font-mono text-zinc-500 mb-1 uppercase tracking-wider">
                  {m.role === 'user' ? 'Operator' : 'UNCUTstash AI'}
                </span>
                <div className={`p-4 rounded-lg max-w-3xl text-sm leading-relaxed whitespace-pre-wrap font-mono ${m.role === 'user' ? 'bg-zinc-900 border border-zinc-800 text-zinc-300' : 'glass-panel text-zinc-100'}`}>
                  {m.content || <span className="animate-pulse">...</span>}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input Area */}
        <div className="mt-4 flex gap-3 shrink-0">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={!engine || status.includes("Synthesizing")}
            placeholder="Initialize query..."
            className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-3 font-mono text-sm focus:outline-none focus:border-accent-pink transition-colors disabled:opacity-50 backdrop-blur-sm"
          />
          <button
            onClick={handleSend}
            disabled={!engine || !input.trim() || status.includes("Synthesizing")}
            className="bg-zinc-100 text-black px-6 rounded-lg hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </main>

      {/* Contextual Materialization: P2P Overlay */}
      {p2pOverlayOpen && (
        <div className="absolute top-20 right-6 w-80 glass-panel z-depth-3 rounded-xl p-4 flex flex-col shadow-2xl border-accent-pink/50">
          <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-2">
            <h3 className="font-syncopate text-xs font-bold text-accent-pink flex items-center gap-2">
              <MessageSquare className="w-3 h-3" /> SECURE P2P
            </h3>
            <button onClick={() => setP2pOverlayOpen(false)} className="text-zinc-500 hover:text-white text-xs font-mono">✕</button>
          </div>
          <div className="flex-1 h-48 bg-zinc-950/50 rounded border border-zinc-900 mb-3 p-2 font-mono text-xs text-zinc-400 overflow-y-auto">
            [Encrypted Channel Established]<br />
            [AES-GCM 256-bit Active]
          </div>
          <input type="text" placeholder="Transmit..." className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 font-mono text-xs focus:outline-none focus:border-accent-pink" />
        </div>
      )}

      {/* GHOSTpay Modal */}
      {ghostPayActive && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center">
          <div className="glass-panel p-8 rounded-xl max-w-md w-full border-accent-pink/30">
            <h2 className="font-syncopate text-xl mb-2">GHOSTpay Gateway</h2>
            <p className="font-mono text-xs text-zinc-400 mb-6">Local cryptographic authorization required.</p>
            <div className="space-y-4 font-mono text-sm">
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">Target Node:</span>
                <span>DATAcartel Collective</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">Amount:</span>
                <span className="text-accent-pink font-bold">0.05 XMR</span>
              </div>
            </div>
            <div className="mt-8 flex gap-3">
              <button onClick={() => setGhostPayActive(false)} className="flex-1 py-3 rounded border border-zinc-700 text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-widest transition-colors">Cancel</button>
              <button onClick={() => setGhostPayActive(false)} className="flex-1 py-3 rounded bg-accent-pink text-white font-bold font-mono text-xs uppercase tracking-widest hover:bg-pink-600 transition-colors shadow-[0_0_15px_rgba(255,0,127,0.4)]">Authorize</button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Orb Trigger (For testing Halo) */}
      <button
        onClick={() => setHaloActive(true)}
        className="absolute bottom-6 right-6 w-3 h-3 rounded-full bg-zinc-800 hover:bg-accent-pink transition-colors z-50"
        title="Simulate Incoming P2P"
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);