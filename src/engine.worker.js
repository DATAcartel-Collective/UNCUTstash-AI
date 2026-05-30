// src/engine.worker.js
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

console.log("[UNCUTstash AI] WebWorker Engine Initializing...");

try {
  const handler = new WebWorkerMLCEngineHandler();
  self.onmessage = (msg) => {
    handler.onmessage(msg);
  };
  console.log("[UNCUTstash AI] WebWorker Engine Armed.");
} catch (err) {
  console.error("[UNCUTstash AI] WebWorker Fatal Error:", err);
  self.postMessage({ type: "error", message: err.message });
}