import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config({ override: true });

function getGeminiApiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return undefined;
  const cleaned = key.replace(/["']/g, "").trim();
  if (!cleaned || cleaned === "MY_GEMINI_API_KEY") return undefined;
  return cleaned;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateContentWithRetry(ai: GoogleGenAI, config: any) {
  // Use high-capacity, low-latency models with automatic fallback & backoff
  const candidateModels = [
    "gemini-2.5-flash",
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite"
  ];
  let lastError: any = null;

  for (const model of candidateModels) {
    // Try up to 2 attempts for each model in case of a temporary capacity spike
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({
          ...config,
          model,
        });
      } catch (err: any) {
        lastError = err;
        const status = err?.status || err?.code;
        // If 503 (high demand) or 429 (rate limit), pause and retry or fallback
        if (status === 503 || status === 429) {
          if (attempt === 0) {
            await sleep(800);
            continue;
          }
          break; // proceed to next candidate model
        }
        // If model not found or unavailable, try next candidate
        if (status === 404) {
          break;
        }
        // Non-transient errors (like bad API key 400) should throw immediately
        throw err;
      }
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Health check endpoint for deployment monitoring
  app.get("/api/health", (req, res) => {
    const hasKey = !!getGeminiApiKey();
    res.json({
      status: "ok",
      apiKeyConfigured: hasKey,
      env: process.env.NODE_ENV || "production",
      port: PORT,
      timestamp: new Date().toISOString()
    });
  });

  // Helper for binary .doc files (Word 97-2003)
  function extractTextFromDocBinary(buffer: Buffer): string {
    const utf16Chunks: string[] = [];
    let currentChunk = "";
    for (let i = 0; i < buffer.length - 1; i += 2) {
      const code = buffer.readUInt16LE(i);
      if ((code >= 32 && code <= 126) || code === 10 || code === 13 || (code >= 160 && code <= 1000)) {
        currentChunk += String.fromCharCode(code);
      } else {
        if (currentChunk.trim().length >= 10) {
          utf16Chunks.push(currentChunk.trim());
        }
        currentChunk = "";
      }
    }
    if (currentChunk.trim().length >= 10) {
      utf16Chunks.push(currentChunk.trim());
    }

    const latin1 = buffer.toString("latin1");
    const runs = latin1.match(/[\w\s.,;:!?"'()\-–—]{12,}/g) || [];
    const latinClean = runs
      .map(r => r.trim())
      .filter(r => r.length > 15 && !r.includes("\x00") && !/^[0-9\s]+$/.test(r) && !r.startsWith("Microsoft"));

    const combined = [...utf16Chunks, ...latinClean];
    const filtered = combined.filter((chunk, idx, arr) => {
      if (chunk.length < 10) return false;
      if (chunk.includes("Normal.dotm") || chunk.includes("Root Entry") || chunk.includes("WordDocument") || chunk.includes("CompObj")) return false;
      return arr.indexOf(chunk) === idx;
    });

    return filtered.join("\n\n").trim();
  }

  // Unified document extraction logic for PDF, DOCX, and DOC
  async function extractDocumentData(base64: string, filename: string = "dokumen") {
    let cleanBase64 = base64;
    if (cleanBase64.includes(",")) {
      cleanBase64 = cleanBase64.split(",")[1];
    }

    const buffer = Buffer.from(cleanBase64, "base64");
    const lowerFilename = filename.toLowerCase();

    // Determine document type
    let fileType: "pdf" | "docx" | "doc" = "pdf";
    if (lowerFilename.endsWith(".docx")) {
      fileType = "docx";
    } else if (lowerFilename.endsWith(".doc")) {
      fileType = "doc";
    } else if (lowerFilename.endsWith(".pdf")) {
      fileType = "pdf";
    } else {
      // Check magic numbers
      if (buffer.length >= 4) {
        if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
          fileType = "pdf";
        } else if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
          fileType = "docx";
        } else if (buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0) {
          fileType = "doc";
        }
      }
    }

    let extractedText = "";
    let numPages = 1;
    let method: string = fileType;

    if (fileType === "docx" || fileType === "doc") {
      // 1. Try mammoth for Word documents (both .docx and OpenXML .doc)
      try {
        const mammothModule = await import("mammoth");
        const mammoth = (mammothModule as any).default || mammothModule;
        const result = await mammoth.extractRawText({ buffer });
        extractedText = (result.value || "").trim();
        method = "mammoth-docx";
      } catch (docErr: any) {
        console.warn("Mammoth extraction warning:", docErr?.message || docErr);
      }

      // 2. If mammoth failed and it's a binary .doc, use binary stream extraction
      if ((!extractedText || extractedText.length < 20) && fileType === "doc") {
        try {
          const binText = extractTextFromDocBinary(buffer);
          if (binText && binText.length > extractedText.length) {
            extractedText = binText;
            method = "binary-doc-stream";
          }
        } catch (binErr: any) {
          console.warn("Binary doc extraction error:", binErr?.message || binErr);
        }
      }

      // Estimate pages for Word documents (~300 words/page)
      const words = extractedText.split(/\s+/).filter(Boolean).length;
      numPages = Math.max(1, Math.ceil(words / 300));

    } else {
      // PDF Extraction
      try {
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        let raw = (result.text || "").trim();
        raw = raw.replace(/--\s*\d+\s+of\s+\d+\s*--/g, "").trim();
        extractedText = raw;
        numPages = result.total || 1;
        await parser.destroy().catch(() => {});
        method = "pdf-parse";
      } catch (parseErr: any) {
        console.warn("Local PDF parsing warning:", parseErr?.message || parseErr);
      }

      // Fallback for scanned/empty PDF
      if (extractedText.length < 40) {
        const apiKey = getGeminiApiKey();
        if (apiKey) {
          try {
            const ai = new GoogleGenAI({
              apiKey,
              httpOptions: {
                headers: { 'User-Agent': 'aistudio-build' }
              }
            });
            const prompt = "Ekstrak seluruh teks argumentatif yang tertulis di dalam dokumen PDF ini. Pertahankan susunan paragraf dan kalimat secara utuh tanpa merangkum atau menambahkan opini pembuka/penutup. Jika dokumen benar-benar kosong atau tidak memuat teks tulisan apa pun, jawab HANYA dengan kata: KOSONG";
            const response = await generateContentWithRetry(ai, {
              contents: [
                {
                  inlineData: {
                    data: cleanBase64,
                    mimeType: "application/pdf"
                  }
                },
                prompt
              ]
            });
            const geminiText = (response.text || "").trim();
            if (geminiText.toUpperCase() !== "KOSONG" && geminiText.length > extractedText.length) {
              extractedText = geminiText;
              method = "gemini-multimodal";
            }
          } catch (geminiErr: any) {
            console.warn("Gemini PDF OCR fallback error:", geminiErr?.message || geminiErr);
          }
        }
      }
    }

    if (!extractedText || extractedText.length < 10) {
      const formatLabel = fileType === "pdf" ? "PDF" : (fileType === "docx" ? "Word (.docx)" : "Word (.doc)");
      throw new Error(`Tidak dapat membaca teks tulisan dari dokumen ${formatLabel} ini. Pastikan berkas memuat teks yang dapat dibaca atau silakan salin-tempel teks secara langsung ke editor.`);
    }

    const wordCount = extractedText.trim().split(/\s+/).filter(Boolean).length;

    return {
      text: extractedText,
      numPages,
      filename: filename || `dokumen.${fileType}`,
      fileType,
      wordCount,
      method
    };
  }

  // Unified extract endpoint for PDF & Word
  app.post("/api/extract-document", async (req, res) => {
    try {
      const { base64, filename } = req.body;
      if (!base64) {
        return res.status(400).json({ error: "Data berkas dokumen tidak ditemukan." });
      }
      const result = await extractDocumentData(base64, filename);
      res.json(result);
    } catch (error: any) {
      console.error("Document extraction error:", error);
      res.status(422).json({ error: error.message || "Gagal memproses berkas dokumen." });
    }
  });

  // Legacy route backwards compatibility
  app.post("/api/extract-pdf", async (req, res) => {
    try {
      const { base64, filename } = req.body;
      if (!base64) {
        return res.status(400).json({ error: "Data file PDF/dokumen tidak ditemukan." });
      }
      const result = await extractDocumentData(base64, filename);
      res.json(result);
    } catch (error: any) {
      console.error("PDF/doc extraction endpoint error:", error);
      res.status(422).json({ error: error.message || "Gagal memproses file dokumen." });
    }
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const { text } = req.body;
      const apiKey = getGeminiApiKey();
      
      if (!apiKey) {
        return res.status(401).json({ error: "Gemini API Key belum dikonfigurasi pada server. Pastikan API Key telah tersedia pada environment variable GEMINI_API_KEY." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `
        Analisis teks argumentatif berikut ini secara mendalam berdasarkan dua dimensi:
        DIMENSI 1: Kriteria Logika Argumen (Toulmin / Argumentative Writing)
        1. Kejelasan Klaim (Claim Clarity)
        2. Kualitas Bukti (Evidence Quality)
        3. Koherensi Penalaran (Reasoning Coherence)
        4. Argumen Kontra (Counter-argument)

        DIMENSI 2: Indikator Linguistik Sistemik Fungsional M.A.K. Halliday (SFL / Systemic Functional Linguistics)
        1. Metafungsi Ideasional (Ideational Metafunction - Sistem Transitivitas):
           - Analisis tipe proses yang digunakan (Proses Material: aksi fisik; Proses Mental: kognisi/afeksi; Proses Relasional: identifikasi/atribut; Proses Verbal: ujaran/kutipan; Perilaku; Wujud).
           - Kejelasan partisipan dan sirkumstansi dalam mengartikulasikan realitas dan data.
        2. Metafungsi Interpersonal (Interpersonal Metafunction - Sistem Mood & Modalitas):
           - Analisis sikap/posisi penulis (stance), daya asertif, keterlibatan audiens.
           - Derajat modalitas (Rendah / Menengah / Tinggi) untuk kepastian (modalisasi: mungkin, pasti) dan keharusan/kewajiban (modulasi: harus, patut, perlu).
        3. Metafungsi Tekstual (Textual Metafunction - Struktur Tema-Rema):
           - Analisis titik tolak pesan (Tema) dan pengembangannya (Rema).
           - Pola progresi tematis (Pola Tema Konstan, Pola Linier/Zig-zag dari Rema ke Tema berikutnya, atau Pola Terfragmentasi).
        4. Kohesi Wacana (Discourse Cohesion - Halliday & Hasan):
           - Analisis piranti kohesi gramatikal (referensi, konjungsi kausal/adversatif/aditif) dan kohesi leksikal (repetisi kata kunci, sinonimi, kolokasi istilah).

        Teks yang dianalisis: "${text}"

        Berikan output HANYA dalam format valid JSON dengan struktur persis seperti ini:
        {
          "claimClarity": { "score": 1-4, "status": "Singkat (misal: Cukup Jelas)", "feedback": "Saran singkat peningkatan klaim" },
          "evidenceQuality": { "score": 1-4, "status": "Singkat", "feedback": "Saran singkat bukti" },
          "reasoningCoherence": { "score": 1-4, "status": "Singkat", "feedback": "Saran singkat penalaran" },
          "counterArgument": { "score": 1-4, "status": "Singkat", "feedback": "Saran singkat argumen kontra" },
          "generalFeedback": "Satu atau dua kalimat rangkuman scaffolding untuk membantu penulis mengembangkan argumennya.",
          "halliday": {
            "ideational": {
              "score": 1-4,
              "status": "Singkat (misal: Didominasi Proses Relasional & Material)",
              "dominantProcess": "Nama proses dominan (Material, Mental, Relasional, Verbal, dll.)",
              "explanation": "Penjelasan fungsi ideasional bagaimana teks merepresentasikan realitas/tindakan dalam argumen.",
              "keyClauseExample": "Contoh penggalan klausa dari teks yang merepresentasikan sistem transitivitas ini.",
              "recommendation": "Saran konkret untuk mengoptimalkan variasi proses transitivitas."
            },
            "interpersonal": {
              "score": 1-4,
              "status": "Singkat (misal: Modalitas Menengah yang Objektif)",
              "modalityLevel": "Tingkat Modalitas (Rendah / Menengah / Tinggi)",
              "stanceAnalysis": "Analisis posisi/sikap penulis dan daya persuasi terhadap pembaca.",
              "keyMarkers": ["kata1", "kata2"],
              "recommendation": "Saran untuk memperkuat atau menyesuaikan derajat kepastian argumen."
            },
            "textual": {
              "score": 1-4,
              "status": "Singkat (misal: Progresi Linier Zig-Zag Terjaga)",
              "thematicProgression": "Pola progresi tematis (Linier / Konstan / Bercabang / Kurang Teratur)",
              "themeRhemeFlow": "Analisis bagaimana Tema (titik tolak) dan Rema (informasi baru) mengalir antar kalimat.",
              "recommendation": "Saran perbaikan aliran informasi dari informasi lama ke informasi baru."
            },
            "cohesion": {
              "score": 1-4,
              "status": "Singkat (misal: Kohesi Gramatikal & Leksikal Kuat)",
              "cohesiveDevices": "Piranti kohesi yang teridentifikasi (konjungsi kausal/adversatif, pronomina, repetisi)",
              "cohesionStrength": "Penjelasan kepaduan antarkalimat dan keterkaitan makna.",
              "recommendation": "Saran penguatan konjungtor atau pertautan leksikal."
            },
            "sflSummary": "Ringkasan evaluasi wacana berbasis Linguistik Fungsional Halliday secara utuh."
          }
        }
      `;

      const response = await generateContentWithRetry(ai, {
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      let cleanText = (response.text || "{}").trim();
      if (cleanText.includes("```")) {
        const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
          cleanText = match[1].trim();
        } else {
          cleanText = cleanText.replace(/```json|```/g, "").trim();
        }
      }

      let result;
      try {
        result = JSON.parse(cleanText);
      } catch (parseError) {
        const firstBrace = cleanText.indexOf('{');
        const lastBrace = cleanText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          result = JSON.parse(cleanText.substring(firstBrace, lastBrace + 1));
        } else {
          throw parseError;
        }
      }

      res.json(result);
    } catch (error: any) {
      console.error("Analysis failed:", error);
      let errorMsg = "Gagal menganalisis argumen.";
      if (error?.status === 400) {
        errorMsg = "API key tidak valid. Silakan periksa kembali Gemini API Key Anda di menu Pengaturan.";
      } else if (error?.status === 503) {
        errorMsg = "Layanan model AI sedang mengalami lonjakan beban (high demand). Silakan coba klik 'Analisis Argumen' beberapa saat lagi.";
      }
      res.status(500).json({ error: errorMsg });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { text, userMsg, chatHistory } = req.body;
      const apiKey = getGeminiApiKey();
      
      if (!apiKey) {
        return res.status(401).json({ error: "Gemini API Key belum dikonfigurasi pada server. Silakan atur API Key Anda di menu Secrets AI Studio." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const contextPrompt = `
        Anda adalah asisten "Cognitive Scaffolding" yang mengintegrasikan prinsip Vygotsky dengan analisis linguistik fungsional M.A.K. Halliday (Systemic Functional Linguistics - SFL).
        Tugas Anda adalah membimbing pengguna menulis argumen yang kuat, logis, terpadu, dan bertekstur wacana yang kaya.
        
        Keahlian Analisis Anda mencakup:
        1. Struktur Logika Argumen (Klaim, Bukti/Evidence, Penalaran/Warrant, dan Argumen Kontra).
        2. Metafungsi Bahasa M.A.K. Halliday:
           - Metafungsi Ideasional (Sistem Transitivitas: Proses Material, Mental, Relasional, Verbal, Perilaku, Wujud; Partisipan dan Sirkumstansi).
           - Metafungsi Interpersonal (Sistem Mood dan Modalitas: probabilitas, keharusan/obligasi, tingkat kepastian/hedging, evaluasi sikap).
           - Metafungsi Tekstual (Struktur Tema-Rema, progresi tematik konstan vs zig-zag/linier, variasi tema topikal/interpersonal/tekstual).
           - Kohesi Wacana Halliday & Hasan (Kohesi Gramatikal: konjungsi, referensi penunjukan/pronomina, substitusi, elipsis; Kohesi Leksikal: repetisi, sinonimi, kolokasi).
        3. Rubrik Penilaian & Konversi ke Skala Nilai 0-100:
           - Jika pengguna bertanya mengenai cara penilaian atau konversi ke nilai 0-100, jelaskan dengan jelas:
             * Ada 8 indikator berskala 1 - 4 (4 Logika Toulmin + 4 Linguistik Halliday), dengan total skor maksimal 32 poin (16 Logika + 16 Halliday).
             * Formula Standar (50% Logika : 50% Halliday):
               Nilai = ((Skor Toulmin / 16 * 100) * 0.5) + ((Skor Halliday / 16 * 100) * 0.5) = (Total Skor / 32) * 100
             * Konversi Predikat Akademik:
               - 85 - 100: A (Sangat Baik / Mahir)
               - 75 - 84: B (Baik / Kompeten)
               - 60 - 74: C (Cukup / Berkembang)
               - < 60: D (Perlu Bimbingan / Kurang)
             * Berikan contoh simulasi konkret serta strategi perbaikan spesifik untuk meningkatkan skor ke kategori A (misal: memperkuat bukti empiris dan memperbaiki alur Tema-Rema).

        Pedoman Bimbingan (Scaffolding):
        - Jangan menuliskan esai lengkap atau menggantikan pekerjaan pengguna. Berikan pertanyaan pemantik, evaluasi konstruktif, penggalan contoh perbaikan kecil, atau saran langkah demi langkah (Zone of Proximal Development).
        
        Konteks Tulisan Pengguna saat ini:
        "${text.substring(0, 1000)}..."
        
        Riwayat Chat Terakhir:
        ${chatHistory.map((m: any) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.text}`).join('\n')}
        User: ${userMsg}
        
        Pedoman Format Jawaban (Sangat Penting):
        - Jawab dengan bahasa Indonesia yang ramah, akademik, terstruktur, dan suportif.
        - Pisahkan setiap poin pemikiran ke dalam paragraf pendek terpisah (gunakan double line break).
        - Jika menyajikan saran, pertanyaan pemantik, atau langkah perbaikan, WAJIB gunakan daftar berbutir (-) atau bernomor (1., 2.) di baris tersendiri untuk setiap item.
        - Jangan pernah menumpuk poin 1, 2, 3 dalam satu baris/paragraf panjang tanpa pemisah baris.
        - Gunakan penekanan tebal (**teks**) secukupnya untuk kata kunci penting agar mudah dipindai (scannable).
      `;

      const response = await generateContentWithRetry(ai, {
        contents: contextPrompt,
      });

      res.json({ text: response.text || "Maaf, saya sedang mengalami gangguan." });
    } catch (error: any) {
      console.error("Chat failed:", error);
      let errorMsg = "Gagal memproses pesan chat.";
      if (error?.status === 400) {
        errorMsg = "API key tidak valid. Silakan periksa kembali Gemini API Key Anda.";
      } else if (error?.status === 503) {
        errorMsg = "Layanan model AI sedang mengalami lonjakan beban sementara. Silakan ulangi pertanyaan Anda.";
      }
      res.status(500).json({ error: errorMsg });
    }
  });

  // Serve static assets in production, or Vite dev server in development
  const isDev = process.env.NODE_ENV !== "production" && process.env.npm_lifecycle_event !== "start";
  const distPath = path.join(process.cwd(), 'dist');
  const distExists = fs.existsSync(path.join(distPath, 'index.html'));

  if (!isDev && distExists) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
