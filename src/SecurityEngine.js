// src/SecurityEngine.js
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export class RossUlbrichtProtocol {
  constructor(onLockdown) {
    this.onLockdown = onLockdown;
    this.isLocked = false;
    this.faceLandmarker = null;
    this.lastSeenTime = Date.now();
    this.attentionInterval = null;
    this.volatileMemoryPool = []; // Array of Uint8Arrays to scrub
    this.jamesBondMode = false;
    
    this.handleMotion = this.handleMotion.bind(this);
  }

  registerVolatileMemory(uint8Array) {
    this.volatileMemoryPool.push(uint8Array);
  }

  async init(jamesBondMode = false) {
    this.jamesBondMode = jamesBondMode;
    if (!this.jamesBondMode) return;

    // 1. Kinetic Impact Trigger
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceMotionEvent.requestPermission();
        if (permission === 'granted') {
          window.addEventListener('devicemotion', this.handleMotion);
        }
      } catch (e) {
        console.warn("Kinetic trigger permission denied.");
      }
    } else {
      window.addEventListener('devicemotion', this.handleMotion);
    }

    // 2. Attention-Aware Auto-Lock
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numFaces: 1
      });
      this.startAttentionTracking();
    } catch (e) {
      console.warn("Attention tracking initialization failed. Ensure camera permissions.", e);
    }
  }

  handleMotion(event) {
    if (this.isLocked || !this.jamesBondMode) return;
    const acc = event.acceleration || event.accelerationIncludingGravity;
    if (!acc) return;
    
    // Calculate magnitude of acceleration vector
    const magnitude = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
    
    // Threshold for sudden snatch/drop (approx 2.5G)
    if (magnitude > 25) {
      console.warn("[SECURITY] Kinetic Impact Detected!");
      this.executeLockdown();
    }
  }

  async startAttentionTracking() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      this.attentionInterval = setInterval(() => {
        if (this.isLocked || !this.jamesBondMode) return;
        
        const results = this.faceLandmarker.detectForVideo(video, performance.now());
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          this.lastSeenTime = Date.now();
        } else {
          // If face not seen for 3 seconds, lock
          if (Date.now() - this.lastSeenTime > 3000) {
            console.warn("[SECURITY] Attention Lost!");
            this.executeLockdown();
          }
        }
      }, 500);
    } catch (e) {
      console.warn("Camera access denied for Attention-Aware lock.");
    }
  }

  executeLockdown() {
    if (this.isLocked) return;
    this.isLocked = true;
    
    // Volatile Memory Scrubbing: Immediate zero-byte overwriting
    for (let i = 0; i < this.volatileMemoryPool.length; i++) {
      const mem = this.volatileMemoryPool[i];
      if (mem && mem.length > 0) {
        crypto.getRandomValues(mem); // Cryptographic overwrite
        mem.fill(0); // Zero out
      }
    }
    this.volatileMemoryPool = [];
    
    // Anti-Coercion Protocol: Trigger UI lock requiring cognitive passcode
    this.onLockdown();
  }

  unlock() {
    this.isLocked = false;
    this.lastSeenTime = Date.now();
  }

  destroy() {
    window.removeEventListener('devicemotion', this.handleMotion);
    if (this.attentionInterval) clearInterval(this.attentionInterval);
  }
}