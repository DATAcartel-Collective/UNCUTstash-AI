// src/LocalRAGManager.js
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { pipeline, env } from '@huggingface/transformers';

// Prevent 404 errors by stopping the library from looking for models in the local Vite /public folder.
// It will fetch from the CDN once, and the browser's native Cache API will store it locally forever.
env.allowLocalModels = false;
env.allowRemoteModels = true;

export class LocalRAGManager {
  constructor() {
    this.pg = null;
    this.embedder = null;
    this.isReady = false;
  }

  async init(progressCallback) {
    try {
      if (progressCallback) progressCallback("Requesting persistent storage...");
      if (navigator.storage && navigator.storage.persist) {
        await navigator.storage.persist();
      }

      if (progressCallback) progressCallback("Initializing WebGPU Embedding Pipeline...");

      // Hardware Validation Protocol
      let deviceType = 'wasm';
      let precision = 'fp32';
      if (navigator.gpu) {
        try {
          const adapter = await navigator.gpu.requestAdapter();
          if (adapter) {
            deviceType = 'webgpu';
            precision = 'fp16';
          }
        } catch (e) {
          console.warn("[RAG] WebGPU adapter request failed, falling back to WASM.");
        }
      }

      // Multi-Tiered Graceful Degradation
      try {
        this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
          device: deviceType,
          dtype: precision
        });
      } catch (pipelineError) {
        console.warn(`[RAG] Primary pipeline (${deviceType}) failed. Executing WASM fallback...`, pipelineError.message);
        // Force WASM fallback if WebGPU compilation crashes (common in headless Chrome)
        this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
          device: 'wasm',
          dtype: 'fp32'
        });
      }

      if (progressCallback) progressCallback("Booting Sovereign PGlite Engine (IndexedDB)...");

      this.pg = await PGlite.create({
        dataDir: "idb://uncutstash-secure-vault",
        extensions: { vector }
      });

      await this._initializeSchemas();
      this.isReady = true;
      if (progressCallback) progressCallback("Local Vector DB Armed.");
    } catch (error) {
      // Convert error to string so it doesn't get masked as JSHandle@error
      console.error("RAG Initialization Error:", error.message || error);
      throw error;
    }
  }

  async _initializeSchemas() {
    await this.pg.exec(`
      CREATE EXTENSION IF NOT EXISTS vector;
      
      -- Hybrid Search Table
      CREATE TABLE IF NOT EXISTS knowledge_stash (
        id UUID PRIMARY KEY,
        text TEXT,
        embedding vector(384),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Relational Graph Mapping: Entities
      CREATE TABLE IF NOT EXISTS entities (
        id UUID PRIMARY KEY,
        name TEXT,
        type TEXT,
        properties JSONB
      );

      -- Relational Graph Mapping: Relations
      CREATE TABLE IF NOT EXISTS relations (
        source_id UUID,
        target_id UUID,
        predicate TEXT,
        weight REAL CHECK (weight >= 0.0 AND weight <= 1.0),
        PRIMARY KEY (source_id, target_id, predicate)
      );

      -- BM25 Indexing
      CREATE INDEX IF NOT EXISTS knowledge_fts_idx ON knowledge_stash USING GIN (to_tsvector('english', text));
    `);
  }

  async _getEmbedding(text) {
    const output = await this.embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  async ingestDocument(text, metadata = {}) {
    if (!this.isReady) throw new Error("Database offline");
    const rawVector = await this._getEmbedding(text);
    const uniqueId = crypto.randomUUID();
    const pgVectorString = `[${rawVector.join(",")}]`;

    await this.pg.query(
      "INSERT INTO knowledge_stash (id, text, embedding, metadata) VALUES ($1, $2, $3, $4);",
      [uniqueId, text, pgVectorString, JSON.stringify(metadata)]
    );
    return uniqueId;
  }

  async ingestGraphRelation(sourceName, sourceType, targetName, targetType, predicate, weight = 1.0) {
    if (!this.isReady) return;
    const sourceId = crypto.randomUUID();
    const targetId = crypto.randomUUID();

    await this.pg.query("INSERT INTO entities (id, name, type, properties) VALUES ($1, $2, $3, '{}') ON CONFLICT DO NOTHING;", [sourceId, sourceName, sourceType]);
    await this.pg.query("INSERT INTO entities (id, name, type, properties) VALUES ($1, $2, $3, '{}') ON CONFLICT DO NOTHING;", [targetId, targetName, targetType]);
    await this.pg.query("INSERT INTO relations (source_id, target_id, predicate, weight) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING;", [sourceId, targetId, predicate, weight]);
  }

  // Reciprocal Rank Fusion (RRF) merging BM25 lexical search and WebGPU vector search
  async searchHybrid(queryText, limit = 5) {
    if (!this.isReady) return "";

    const queryVector = await this._getEmbedding(queryText);
    const pgVectorString = `[${queryVector.join(",")}]`;
    const k = 60; // Baseline rank constant

    // 1. Vector Search (Cosine Distance)
    const vecRes = await this.pg.query(`
      SELECT id, text, embedding <=> $1 AS distance
      FROM knowledge_stash
      ORDER BY distance ASC LIMIT 50;
    `, [pgVectorString]);

    // 2. BM25 Lexical Search
    const bm25Res = await this.pg.query(`
      SELECT id, text, ts_rank(to_tsvector('english', text), plainto_tsquery('english', $1)) AS rank
      FROM knowledge_stash
      WHERE to_tsvector('english', text) @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC LIMIT 50;
    `, [queryText]);

    const scores = new Map();

    // Weighting: Vector = 0.7
    vecRes.rows.forEach((row, index) => {
      const rank = index + 1;
      const score = 0.7 * (1 / (k + rank));
      scores.set(row.id, { text: row.text, score: score });
    });

    // Weighting: Keyword = 0.3
    bm25Res.rows.forEach((row, index) => {
      const rank = index + 1;
      const score = 0.3 * (1 / (k + rank));
      const existing = scores.get(row.id) || { text: row.text, score: 0 };
      existing.score += score;
      scores.set(row.id, existing);
    });

    return Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => `[Retrieved Context]: ${item.text}`)
      .join("\n\n");
  }
}

export const ragManager = new LocalRAGManager();