// src/SecureP2PManager.js
export class SecureP2PManager {
  constructor(onMessage, onHaloTrigger) {
    this.pc = null;
    this.dataChannel = null;
    this.onMessage = onMessage;
    this.onHaloTrigger = onHaloTrigger;
    this.aesKey = null;
    this.iv = null;
  }

  async initializeCrypto() {
    // Generate ephemeral AES-GCM 256-bit key for the session
    this.aesKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    this.iv = crypto.getRandomValues(new Uint8Array(12));
    return { key: this.aesKey, iv: this.iv };
  }

  async encryptMessage(text) {
    if (!this.aesKey) throw new Error("Crypto not initialized");
    const encoded = new TextEncoder().encode(text);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: this.iv },
      this.aesKey,
      encoded
    );
    return ciphertext;
  }

  async decryptMessage(ciphertext) {
    if (!this.aesKey) throw new Error("Crypto not initialized");
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: this.iv },
      this.aesKey,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  }

  initiateConnection() {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }] // Standard STUN for NAT traversal
    });

    this.dataChannel = this.pc.createDataChannel("uncut-secure-stream");
    this.setupChannelListeners(this.dataChannel);

    this.pc.ondatachannel = (event) => {
      this.setupChannelListeners(event.channel);
    };
  }

  setupChannelListeners(channel) {
    channel.onmessage = async (event) => {
      try {
        // Trigger Spatial UI Perimeter Halo
        this.onHaloTrigger();
        
        const decryptedText = await this.decryptMessage(event.data);
        this.onMessage(decryptedText);
      } catch (e) {
        console.error("Decryption failure on incoming P2P stream", e);
      }
    };
  }

  async sendMessage(text) {
    if (this.dataChannel && this.dataChannel.readyState === "open") {
      const encrypted = await this.encryptMessage(text);
      this.dataChannel.send(encrypted);
    }
  }

  // Zero-Defect Teardown to prevent memory leaks
  destroy() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.ondatachannel = null;
      this.pc.close();
      this.pc = null;
    }
    // Scrub crypto keys from memory
    this.aesKey = null;
    if (this.iv) {
      crypto.getRandomValues(this.iv);
      this.iv.fill(0);
    }
  }
}