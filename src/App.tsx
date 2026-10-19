import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import { 
  Send, BarChart2, MessageSquare, Info, CheckCircle, AlertCircle, Loader2, 
  Copy, Download, History, ChevronDown, ChevronUp, FileText, RotateCcw, 
  Bot, Sparkles, User, X, RefreshCw, BookOpen, Layers, Compass, GitMerge, Link2, 
  HelpCircle, ArrowRight, Upload, FileUp, FileCheck, Trash2, Award, GraduationCap, 
  Calculator, Sliders
} from 'lucide-react';

// Types
export type WeightRatio = '50-50' | '60-40' | '40-60' | '100-logic' | '100-halliday';

export interface CompositeScoreResult {
  finalScore: number;
  toulminRaw: number;
  toulminScore: number;
  hallidayRaw?: number;
  hallidayScore?: number;
  totalRaw: number;
  maxRaw: number;
  grade: 'A' | 'B' | 'C' | 'D';
  predicate: string;
  gradeColor: string;
  badgeClass: string;
  barClass: string;
  weightLabel: string;
}

export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

export interface UploadedPdfInfo {
  filename: string;
  sizeFormatted: string;
  numPages: number;
  wordCount: number;
  extractedText: string;
  uploadedAt: number;
}

export interface HallidayIdeational {
  score: number;
  status: string;
  dominantProcess: string;
  explanation: string;
  keyClauseExample?: string;
  recommendation: string;
}

export interface HallidayInterpersonal {
  score: number;
  status: string;
  modalityLevel: string;
  stanceAnalysis: string;
  keyMarkers?: string[];
  recommendation: string;
}

export interface HallidayTextual {
  score: number;
  status: string;
  thematicProgression: string;
  themeRhemeFlow: string;
  recommendation: string;
}

export interface HallidayCohesion {
  score: number;
  status: string;
  cohesiveDevices: string;
  cohesionStrength: string;
  recommendation: string;
}

export interface HallidayAnalysis {
  ideational: HallidayIdeational;
  interpersonal: HallidayInterpersonal;
  textual: HallidayTextual;
  cohesion: HallidayCohesion;
  sflSummary: string;
}

export interface AnalysisResult {
  claimClarity: { score: number; status: string; feedback: string };
  evidenceQuality: { score: number; status: string; feedback: string };
  reasoningCoherence: { score: number; status: string; feedback: string };
  counterArgument: { score: number; status: string; feedback: string };
  generalFeedback: string;
  halliday?: HallidayAnalysis;
  sourcePdf?: { filename: string; numPages: number };
}

export interface AnalysisHistoryItem extends AnalysisResult {
  id: string;
  timestamp: number;
  originalText: string;
}

export default function App() {
  // State
  const [text, setText] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'ai', text: 'Halo! Saya asisten scaffolding Anda. Mari kita mulai menyusun argumen yang logis dan persuasif. Anda dapat mengetik langsung atau mengunggah dokumen PDF berisi teks argumentatif.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isChatting, setIsChatting] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistoryItem[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'analysis' | 'chat'>('analysis'); // Mobile tab state
  const [analysisView, setAnalysisView] = useState<'halliday' | 'argument' | 'all'>('halliday');
  const [showTheoryGuide, setShowTheoryGuide] = useState(false);
  const [showRubricModal, setShowRubricModal] = useState(false);
  const [weightRatio, setWeightRatio] = useState<WeightRatio>('50-50');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // PDF Upload & Extraction State
  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdfInfo | null>(null);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [pdfExtractionProgress, setPdfExtractionProgress] = useState<string>('');
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showPdfReplaceModal, setShowPdfReplaceModal] = useState(false);
  const [pendingPdf, setPendingPdf] = useState<UploadedPdfInfo | null>(null);
  const [autoAnalyzeAfterUpload, setAutoAnalyzeAfterUpload] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper for toasts
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Effects
  useEffect(() => {
    const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);
  }, [text]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Handlers
  const handleAnalyze = async (overrideText?: string, pdfMeta?: { filename: string; numPages: number }) => {
    const textToAnalyze = overrideText !== undefined ? overrideText : text;
    if (textToAnalyze.trim().length < 20) {
      showToast("Teks terlalu singkat. Mohon tulis atau unggah argumen minimal 20 karakter untuk dianalisis.", "info");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysis(null); // Reset previous analysis

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToAnalyze }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Terjadi gangguan saat memproses analisis.');
      }

      const result = await response.json() as AnalysisResult;
      const currentPdf = pdfMeta || (uploadedPdf ? { filename: uploadedPdf.filename, numPages: uploadedPdf.numPages } : undefined);
      if (currentPdf) {
        result.sourcePdf = currentPdf;
      }

      setAnalysis(result);
      setAnalysisError(null);
      
      // Add to history
      const historyItem: AnalysisHistoryItem = {
        ...result,
        id: Date.now().toString(),
        timestamp: Date.now(),
        originalText: textToAnalyze
      };
      setAnalysisHistory(prev => [historyItem, ...prev]);
      
      // Add general feedback to chat
      const hallidayHighlight = result.halliday 
        ? ` Evaluasi Halliday: ${result.halliday.sflSummary}` 
        : '';
      const sourceNote = currentPdf ? ` (Dokumen PDF: **${currentPdf.filename}**)` : '';

      setChatHistory(prev => [...prev, { 
        role: 'ai', 
        text: `**Analisis selesai${sourceNote}.** ${result.generalFeedback}${hallidayHighlight}` 
      }]);

      showToast("Analisis argumen & indikator Halliday berhasil diselesaikan!", "success");

    } catch (error: any) {
      console.error("Analysis error:", error);
      const msg = error.message || "Gagal menganalisis argumen. Silakan coba lagi.";
      setAnalysisError(msg);
      showToast(msg, "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // PDF Upload Handlers
  const handlePdfFile = async (file: File, autoAnalyze = autoAnalyzeAfterUpload) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      showToast("Format file tidak didukung. Mohon unggah dokumen PDF (.pdf).", "error");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      showToast("Ukuran dokumen PDF melebihi batas 25MB.", "error");
      return;
    }

    setIsExtractingPdf(true);
    setPdfError(null);
    setPdfExtractionProgress(`Membaca dokumen ${file.name}...`);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string;
          const base64 = res.includes(',') ? res.split(',')[1] : res;
          resolve(base64);
        };
        reader.onerror = (e) => reject(e);
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      setPdfExtractionProgress("Mengekstrak teks argumentatif dari PDF...");

      const res = await fetch('/api/extract-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64,
          filename: file.name
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Gagal mengekstrak teks dari PDF.');
      }

      const data = await res.json();
      const extractedText = (data.text || '').trim();

      const sizeKB = Math.round(file.size / 1024);
      const sizeFormatted = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;

      const pdfData: UploadedPdfInfo = {
        filename: file.name,
        sizeFormatted,
        numPages: data.numPages || 1,
        wordCount: data.wordCount || extractedText.split(/\s+/).filter(Boolean).length,
        extractedText,
        uploadedAt: Date.now()
      };

      // Check if text already exists in editor
      if (text.trim().length > 30) {
        setPendingPdf(pdfData);
        setShowPdfReplaceModal(true);
      } else {
        applyPdfContent(pdfData, 'replace', autoAnalyze);
      }
    } catch (err: any) {
      console.error("PDF extraction error:", err);
      const msg = err.message || "Gagal memproses file PDF.";
      setPdfError(msg);
      showToast(msg, "error");
    } finally {
      setIsExtractingPdf(false);
      setPdfExtractionProgress('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const applyPdfContent = (pdfData: UploadedPdfInfo, mode: 'replace' | 'append', shouldAnalyze: boolean) => {
    const nextText = mode === 'replace' 
      ? pdfData.extractedText 
      : `${text.trim()}\n\n---\n\n${pdfData.extractedText}`;
    
    setText(nextText);
    setUploadedPdf(pdfData);
    setShowPdfReplaceModal(false);
    setPendingPdf(null);

    showToast(`Dokumen "${pdfData.filename}" berhasil dimuat (${pdfData.wordCount} kata, ${pdfData.numPages} hal).`, 'success');

    if (shouldAnalyze) {
      handleAnalyze(nextText, { filename: pdfData.filename, numPages: pdfData.numPages });
    }
  };

  const handleRemovePdf = () => {
    setUploadedPdf(null);
    showToast("Berkas PDF dilepas dari sesi editor.", "info");
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handlePdfFile(file);
    }
  };

  const handleSendMessage = async (customMessage?: string) => {
    const messageToSend = typeof customMessage === 'string' ? customMessage : chatInput;
    if (!messageToSend.trim()) return;

    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: messageToSend }]);
    setIsChatting(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          userMsg: messageToSend,
          chatHistory: chatHistory.slice(-5)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Terjadi kesalahan pada respon asisten.');
      }

      const data = await response.json();
      const aiResponse = data.text || "Maaf, saya sedang mengalami gangguan.";
      
      setChatHistory(prev => [...prev, { role: 'ai', text: aiResponse }]);

    } catch (error: any) {
      console.error("Chat failed:", error);
      const errMsg = error.message || "Maaf, terjadi kesalahan koneksi.";
      setChatHistory(prev => [...prev, { role: 'ai', text: `Perhatian: ${errMsg}` }]);
      showToast(errMsg, "error");
    } finally {
      setIsChatting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSendMessage();
  };

  // Helper to render score color
  const getScoreColor = (score: number) => {
    if (score >= 3) return 'text-optimal';
    if (score === 2) return 'text-yellow-600';
    return 'text-red-500';
  };

  const getScoreBadgeClass = (score: number) => {
    if (score >= 3) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (score === 2) return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  // Helper to calculate 0-100 score and academic grade conversion
  const calculateCompositeScore = (
    item?: AnalysisResult | AnalysisHistoryItem | null,
    ratio: WeightRatio = weightRatio
  ): CompositeScoreResult | null => {
    if (!item) return null;

    const toulminRaw = 
      (item.claimClarity?.score || 0) + 
      (item.evidenceQuality?.score || 0) + 
      (item.reasoningCoherence?.score || 0) + 
      (item.counterArgument?.score || 0);
    const toulminScore = Math.round((toulminRaw / 16) * 100);

    const hasHalliday = !!item.halliday;
    const hallidayRaw = hasHalliday
      ? (item.halliday!.ideational?.score || 0) +
        (item.halliday!.interpersonal?.score || 0) +
        (item.halliday!.textual?.score || 0) +
        (item.halliday!.cohesion?.score || 0)
      : 0;
    const hallidayScore = hasHalliday ? Math.round((hallidayRaw / 16) * 100) : 0;

    let finalScore = toulminScore;
    let totalRaw = toulminRaw;
    let maxRaw = 16;
    let weightLabel = '100% Logika Argumen';

    if (hasHalliday) {
      totalRaw = toulminRaw + hallidayRaw;
      maxRaw = 32;

      if (ratio === '50-50') {
        finalScore = Math.round(toulminScore * 0.5 + hallidayScore * 0.5);
        weightLabel = '50% Logika : 50% Halliday (Seimbang)';
      } else if (ratio === '60-40') {
        finalScore = Math.round(toulminScore * 0.6 + hallidayScore * 0.4);
        weightLabel = '60% Logika : 40% Halliday (Fokus Logika)';
      } else if (ratio === '40-60') {
        finalScore = Math.round(toulminScore * 0.4 + hallidayScore * 0.6);
        weightLabel = '40% Logika : 60% Halliday (Fokus Linguistik)';
      } else if (ratio === '100-logic') {
        finalScore = toulminScore;
        weightLabel = '100% Logika Argumen Saja';
      } else if (ratio === '100-halliday') {
        finalScore = hallidayScore;
        weightLabel = '100% Linguistik Halliday Saja';
      }
    }

    let grade: 'A' | 'B' | 'C' | 'D' = 'D';
    let predicate = 'Perlu Bimbingan (Novice)';
    let gradeColor = 'text-red-600';
    let badgeClass = 'bg-red-50 text-red-700 border-red-200';
    let barClass = 'bg-red-500';

    if (finalScore >= 85) {
      grade = 'A';
      predicate = 'Sangat Baik (Mahir / Advanced)';
      gradeColor = 'text-emerald-700';
      badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-300';
      barClass = 'bg-emerald-500';
    } else if (finalScore >= 75) {
      grade = 'B';
      predicate = 'Baik (Kompeten / Proficient)';
      gradeColor = 'text-blue-700';
      badgeClass = 'bg-blue-50 text-blue-800 border-blue-300';
      barClass = 'bg-blue-600';
    } else if (finalScore >= 60) {
      grade = 'C';
      predicate = 'Cukup (Berkembang / Developing)';
      gradeColor = 'text-amber-700';
      badgeClass = 'bg-amber-50 text-amber-800 border-amber-300';
      barClass = 'bg-amber-500';
    }

    return {
      finalScore,
      toulminRaw,
      toulminScore,
      hallidayRaw: hasHalliday ? hallidayRaw : undefined,
      hallidayScore: hasHalliday ? hallidayScore : undefined,
      totalRaw,
      maxRaw,
      grade,
      predicate,
      gradeColor,
      badgeClass,
      barClass,
      weightLabel
    };
  };

  // Helper to generate text report with Halliday indicators
  const generateReportText = (item: AnalysisHistoryItem | AnalysisResult, includeOriginalText = false) => {
    let report = `LAPORAN ANALISIS ARGUMEN & LINGUISTIK FUNGSIONAL (HALLIDAY)\n`;
    if ('timestamp' in item) {
      report += `Waktu: ${new Date(item.timestamp).toLocaleString()}\n`;
    }
    if (item.sourcePdf) {
      report += `Dokumen Sumber PDF: ${item.sourcePdf.filename} (${item.sourcePdf.numPages} Halaman)\n`;
    }

    const comp = calculateCompositeScore(item, weightRatio);
    if (comp) {
      report += `========================================\n`;
      report += `RINGKASAN NILAI AKHIR (SKALA 0 - 100):\n`;
      report += `Nilai Keseluruhan: ${comp.finalScore} / 100 [Predikat: ${comp.grade} - ${comp.predicate}]\n`;
      report += `Total Skor Mentah: ${comp.totalRaw} / ${comp.maxRaw} Poin\n`;
      report += `- Skor Logika Argumen (Toulmin): ${comp.toulminScore} / 100 (${comp.toulminRaw}/16 Poin)\n`;
      if (comp.hallidayScore !== undefined) {
        report += `- Skor Linguistik Fungsional (Halliday): ${comp.hallidayScore} / 100 (${comp.hallidayRaw}/16 Poin)\n`;
      }
      report += `- Skema Pembobotan: ${comp.weightLabel}\n`;
      report += `========================================\n`;
    }
    report += `----------------------------------------\n`;
    
    if (includeOriginalText && 'originalText' in item) {
      report += `TEKS ASLI:\n${item.originalText}\n\n`;
      report += `----------------------------------------\n`;
    }

    report += `I. DIMENSI LOGIKA ARGUMEN:\n`;
    report += `1. Kejelasan Klaim: ${item.claimClarity.status} (${item.claimClarity.score}/4)\n`;
    report += `   Catatan: ${item.claimClarity.feedback}\n\n`;
    report += `2. Kualitas Bukti: ${item.evidenceQuality.status} (${item.evidenceQuality.score}/4)\n`;
    report += `   Catatan: ${item.evidenceQuality.feedback}\n\n`;
    report += `3. Koherensi Penalaran: ${item.reasoningCoherence.status} (${item.reasoningCoherence.score}/4)\n`;
    report += `   Catatan: ${item.reasoningCoherence.feedback}\n\n`;
    report += `4. Argumen Kontra: ${item.counterArgument.status} (${item.counterArgument.score}/4)\n`;
    report += `   Catatan: ${item.counterArgument.feedback}\n\n`;
    report += `Rangkuman Logika: ${item.generalFeedback}\n\n`;

    if (item.halliday) {
      report += `----------------------------------------\n`;
      report += `II. INDIKATOR LINGUISTIK SISTEMIK FUNGSIONAL (M.A.K. HALLIDAY):\n\n`;
      
      report += `1. Metafungsi Ideasional (Sistem Transitivitas):\n`;
      report += `   - Skor: ${item.halliday.ideational.score}/4 (${item.halliday.ideational.status})\n`;
      report += `   - Proses Dominan: ${item.halliday.ideational.dominantProcess}\n`;
      report += `   - Penjelasan: ${item.halliday.ideational.explanation}\n`;
      if (item.halliday.ideational.keyClauseExample) {
        report += `   - Contoh Klausa: "${item.halliday.ideational.keyClauseExample}"\n`;
      }
      report += `   - Rekomendasi: ${item.halliday.ideational.recommendation}\n\n`;

      report += `2. Metafungsi Interpersonal (Mood & Modalitas):\n`;
      report += `   - Skor: ${item.halliday.interpersonal.score}/4 (${item.halliday.interpersonal.status})\n`;
      report += `   - Tingkat Modalitas: ${item.halliday.interpersonal.modalityLevel}\n`;
      report += `   - Analisis Stance/Sikap: ${item.halliday.interpersonal.stanceAnalysis}\n`;
      if (item.halliday.interpersonal.keyMarkers?.length) {
        report += `   - Pemarkah: ${item.halliday.interpersonal.keyMarkers.join(', ')}\n`;
      }
      report += `   - Rekomendasi: ${item.halliday.interpersonal.recommendation}\n\n`;

      report += `3. Metafungsi Tekstual (Struktur Tema - Rema):\n`;
      report += `   - Skor: ${item.halliday.textual.score}/4 (${item.halliday.textual.status})\n`;
      report += `   - Pola Progresi Tematis: ${item.halliday.textual.thematicProgression}\n`;
      report += `   - Alur Tema-Rema: ${item.halliday.textual.themeRhemeFlow}\n`;
      report += `   - Rekomendasi: ${item.halliday.textual.recommendation}\n\n`;

      report += `4. Kohesi Wacana (Halliday & Hasan 1976):\n`;
      report += `   - Skor: ${item.halliday.cohesion.score}/4 (${item.halliday.cohesion.status})\n`;
      report += `   - Piranti Kohesi: ${item.halliday.cohesion.cohesiveDevices}\n`;
      report += `   - Kepaduan: ${item.halliday.cohesion.cohesionStrength}\n`;
      report += `   - Rekomendasi: ${item.halliday.cohesion.recommendation}\n\n`;

      report += `Sintesis Fungsional Halliday: ${item.halliday.sflSummary}\n`;
    }
    
    return report;
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    showToast("Laporan berhasil disalin ke clipboard!", "success");
  };

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`File ${filename} berhasil diunduh!`, "success");
  };

  const handleDownloadHistory = () => {
    const fullReport = analysisHistory.map((item, index) => {
      return `ANALISIS #${analysisHistory.length - index}\n` + generateReportText(item, true) + `\n========================================\n\n`;
    }).join('');
    handleDownload(fullReport, `riwayat-analisis-${Date.now()}.txt`);
  };

  const handleReset = () => {
    if (text.trim() === '' && !analysis && !uploadedPdf) return;
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    setText('');
    setAnalysis(null);
    setAnalysisError(null);
    setUploadedPdf(null);
    setPdfError(null);
    setShowResetConfirm(false);
    showToast("Editor berhasil dikosongkan.", "info");
  };

  const formatChatMarkdown = (content: string) => {
    if (!content) return '';
    // Format numbered list items that were stuck into sentences (e.g., "ini: 1. **" or "? 2. **")
    let formatted = content.replace(/([:?!.])\s+(\d+\.\s+)/g, '$1\n\n$2');
    // Format bullet list items
    formatted = formatted.replace(/([:?!.])\s+([•\-*]\s+)/g, '$1\n\n$2');
    return formatted;
  };

  return (
    <div className="flex flex-col h-screen bg-bg-app text-text-main font-sans">
      {/* Header */}
      <header className="bg-primary text-white px-6 py-4 flex justify-between items-center shadow-md shrink-0">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <BarChart2 className="w-6 h-6" />
          Personalized AI Assistant - Cognitive Scaffolding Workspace
        </h1>
        <div className="bg-white/10 px-3 py-1 rounded-full text-sm backdrop-blur-sm hidden md:block">
          Mode: <strong>AI Terpersonalisasi</strong>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex flex-1 p-4 gap-4 overflow-hidden flex-col md:flex-row relative">
        
        {/* Mobile Tab Navigation */}
        <div className="flex md:hidden border-b border-border mb-2">
          <button 
            className={`flex-1 py-2 text-sm font-medium ${activeTab === 'analysis' ? 'text-primary border-b-2 border-primary' : 'text-text-muted'}`}
            onClick={() => setActiveTab('analysis')}
          >
            Analisis & Editor
          </button>
          <button 
            className={`flex-1 py-2 text-sm font-medium ${activeTab === 'chat' ? 'text-primary border-b-2 border-primary' : 'text-text-muted'}`}
            onClick={() => setActiveTab('chat')}
          >
            AI Chat
          </button>
        </div>

        {/* Left Column: Editor + Analysis Results */}
        <div className={`flex flex-col flex-[2] gap-4 overflow-y-auto min-w-0 ${activeTab === 'chat' ? 'hidden md:flex' : 'flex'}`}>
          
          {/* Editor Section */}
          <section 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="relative bg-panel rounded-lg border border-border flex flex-col p-4 shadow-sm min-h-[320px] transition-all"
          >
            {/* Hidden File Input for PDF */}
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".pdf,application/pdf"
              className="hidden" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePdfFile(file);
              }}
            />

            {/* Drag & Drop Visual Overlay */}
            {isDraggingOver && (
              <div className="absolute inset-0 bg-blue-600/15 backdrop-blur-[2px] border-2 border-dashed border-primary rounded-lg z-30 flex flex-col items-center justify-center pointer-events-none p-4">
                <div className="bg-white px-6 py-5 rounded-2xl shadow-2xl flex flex-col items-center gap-2 border border-blue-100 text-center animate-scaleUp">
                  <FileUp className="w-12 h-12 text-primary animate-bounce" />
                  <p className="font-bold text-slate-800 text-base">Lepaskan Berkas PDF di Sini</p>
                  <p className="text-xs text-slate-500 max-w-xs">Teks argumentatif dalam dokumen PDF akan diekstrak secara otomatis untuk dinilai.</p>
                </div>
              </div>
            )}

            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
                <Info className="w-5 h-5 text-primary shrink-0" />
                Area Penulisan & Penilaian Teks Argumentatif
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isExtractingPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-primary border border-blue-200 rounded-md text-xs font-semibold transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                  title="Unggah berkas PDF berisi teks argumentatif"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Unggah PDF</span>
                </button>
              </div>
            </div>

            {/* PDF Extraction Progress State */}
            {isExtractingPdf && (
              <div className="mb-3 p-3.5 bg-blue-50/90 border border-blue-200 rounded-lg flex items-center justify-between gap-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900">{pdfExtractionProgress || "Mengekstrak teks argumentatif dari PDF..."}</p>
                    <p className="text-xs text-blue-700">Membaca halaman, klausa kalimat, dan struktur alinea dokumen.</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-medium text-blue-700 bg-white px-2.5 py-1 rounded-md border border-blue-200 shadow-2xs">
                  Mengekstrak...
                </span>
              </div>
            )}

            {/* PDF Error State */}
            {pdfError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-900">Gagal Membaca Dokumen PDF</p>
                    <p className="text-xs text-red-700 mt-0.5">{pdfError}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors"
                  >
                    Pilih File Lain
                  </button>
                  <button
                    onClick={() => setPdfError(null)}
                    className="p-1 text-red-600 hover:bg-red-100 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Active Uploaded PDF Document Banner */}
            {uploadedPdf && !isExtractingPdf && (
              <div className="mb-3 p-3.5 bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/60 border border-blue-200 rounded-lg shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 border border-red-200 flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs tracking-wider">
                      PDF
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-800 max-w-[240px] sm:max-w-[340px] truncate" title={uploadedPdf.filename}>
                          {uploadedPdf.filename}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <FileCheck className="w-3 h-3" /> Teks Termuat
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 text-xs text-slate-500 mt-0.5">
                        <span>{uploadedPdf.numPages} Halaman</span>
                        <span>•</span>
                        <span>{uploadedPdf.wordCount} Kata Argumentasi</span>
                        <span>•</span>
                        <span>{uploadedPdf.sizeFormatted}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      onClick={() => handleAnalyze()}
                      disabled={isAnalyzing}
                      className="px-3.5 py-1.5 bg-primary hover:bg-blue-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                      title="Langsung nilai teks dari berkas PDF ini"
                    >
                      {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                      <span>Nilai Dokumen Ini</span>
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-xs font-medium transition-colors cursor-pointer"
                      title="Ganti dokumen PDF"
                    >
                      Ganti
                    </button>
                    <button
                      onClick={handleRemovePdf}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                      title="Lepas dokumen PDF dari sesi editor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Helpful Empty Dropzone Notice */}
            {!uploadedPdf && !isExtractingPdf && text.trim() === '' && (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="mb-3 p-4 border-2 border-dashed border-blue-200 hover:border-primary bg-blue-50/40 hover:bg-blue-50/70 rounded-lg cursor-pointer transition-all text-center flex flex-col items-center justify-center gap-1.5 group"
              >
                <div className="p-2.5 rounded-full bg-blue-100 text-primary group-hover:scale-105 transition-transform">
                  <FileUp className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  Punya berkas PDF berisi teks argumentatif? <span className="text-primary underline underline-offset-2">Klik untuk mengunggah</span> atau seret file PDF ke sini
                </p>
                <p className="text-xs text-slate-500">
                  Mendukung dokumen PDF esai, artikel opini, tugas kuliah, atau karya ilmiah untuk dinilai (maks. 25MB)
                </p>
              </div>
            )}
            
            {/* Textarea Editor */}
            <textarea
              className="flex-1 w-full p-4 border border-border rounded-md text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none transition-all min-h-[220px]"
              placeholder="Tulis teks argumentatif Anda di sini, atau unggah dokumen PDF di atas untuk mengekstrak dan menilai teks secara langsung..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            
            {/* Bottom Editor Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-4 text-text-muted text-sm">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono bg-slate-100 px-2.5 py-1 rounded text-xs text-slate-700 font-semibold border border-slate-200">
                  Kata: {wordCount}
                </span>
                {uploadedPdf && (
                  <span className="text-xs text-slate-500 hidden sm:inline flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-red-500 inline shrink-0" />
                    Sumber: <strong className="text-slate-700 truncate max-w-[200px] inline-block align-bottom">{uploadedPdf.filename}</strong>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-slate-100 hover:bg-slate-200 text-text-main px-3 py-2 rounded-md font-medium text-xs sm:text-sm transition-colors flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                  title="Unggah berkas PDF argumentatif"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-600" />
                  <span>Unggah PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="bg-slate-200 hover:bg-slate-300 text-text-main px-3 sm:px-4 py-2 rounded-md font-medium text-xs sm:text-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Mulai Baru / Kosongkan"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
                <button 
                  type="button"
                  onClick={() => handleAnalyze()}
                  disabled={isAnalyzing}
                  className="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-xs sm:text-sm transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                >
                  {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {isAnalyzing ? 'Menganalisis...' : 'Analisis Argumen'}
                </button>
              </div>
            </div>

            {/* Reset Confirmation */}
            {showResetConfirm && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-900 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                <span>Kosongkan teks editor & lepas dokumen PDF saat ini? (Riwayat analisis sebelumnya tetap tersimpan)</span>
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button 
                    onClick={confirmReset}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors"
                  >
                    Ya, Kosongkan
                  </button>
                  <button 
                    onClick={() => setShowResetConfirm(false)}
                    className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-medium transition-colors"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}

            {/* Analysis Error Notification with Retry */}
            {analysisError && (
              <div className="mt-3 p-3.5 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900">{analysisError}</p>
                    <p className="text-xs text-red-700 mt-0.5">Sistem telah dilengkapi cadangan model otomatis. Silakan coba klik tombol di samping untuk mencoba kembali.</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleAnalyze()}
                  disabled={isAnalyzing}
                  className="shrink-0 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Coba Lagi
                </button>
              </div>
            )}
          </section>

          {/* PDF Replace / Append Conflict Modal */}
          {showPdfReplaceModal && pendingPdf && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4 animate-scaleUp">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-100 text-primary shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Muat Teks dari Dokumen PDF</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Berkas <strong>{pendingPdf.filename}</strong> ({pendingPdf.wordCount} kata, {pendingPdf.numPages} halaman) berhasil diekstrak.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                  Editor Anda saat ini telah berisi {wordCount} kata. Pilih cara penggabungan teks argumentasi:
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input 
                    type="checkbox" 
                    id="autoAnalyzeCheck" 
                    checked={autoAnalyzeAfterUpload} 
                    onChange={(e) => setAutoAnalyzeAfterUpload(e.target.checked)}
                    className="rounded text-primary focus:ring-primary h-4 w-4"
                  />
                  <label htmlFor="autoAnalyzeCheck" className="text-xs text-slate-700 font-medium cursor-pointer">
                    Langsung nilai argumen segera setelah teks dimuat
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => applyPdfContent(pendingPdf, 'replace', autoAnalyzeAfterUpload)}
                    className="flex-1 py-2 px-3 bg-primary hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    Ganti Teks Saat Ini
                  </button>
                  <button
                    onClick={() => applyPdfContent(pendingPdf, 'append', autoAnalyzeAfterUpload)}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Sambungkan di Akhir
                  </button>
                  <button
                    onClick={() => { setShowPdfReplaceModal(false); setPendingPdf(null); }}
                    className="py-2 px-3 bg-transparent hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-medium transition-colors"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Analysis Results Section (Moved below Editor) */}
          <section className="bg-panel rounded-lg border border-border flex flex-col p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-primary mb-4 border-b-2 border-bg-app pb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">Scaffolding Kognitif Vygotskian</span>
              {analysis?.sourcePdf && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium">
                  <FileText className="w-3.5 h-3.5 text-red-500" /> Dokumen PDF: {analysis.sourcePdf.filename}
                </span>
              )}
            </h2>

            <div className="space-y-6">
              {/* Mechanisms */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-bg-app p-3 rounded-md border border-border">
                  <h3 className="text-sm font-semibold mb-2">Progressive Autonomy</h3>
                  <div className="w-full h-2 bg-slate-300 rounded-full overflow-hidden mb-1">
                    <div className="h-full bg-primary w-[40%]"></div>
                  </div>
                  <small className="text-xs text-text-muted">Tingkat dukungan AI: Sedang (Fase Fading)</small>
                </div>
                
                <div className="bg-bg-app p-3 rounded-md border border-border">
                  <h3 className="text-sm font-semibold mb-2">Cognitive Load</h3>
                  <div className="w-full h-2 bg-slate-300 rounded-full overflow-hidden mb-1">
                    <div className="h-full bg-optimal w-[60%]"></div>
                  </div>
                  <small className="text-xs text-text-muted">Beban Mental: Optimal</small>
                </div>
              </div>

              {/* Nilai Konversi 0-100 & Evaluasi Akademik */}
              {(() => {
                const composite = calculateCompositeScore(analysis, weightRatio);
                if (composite) {
                  return (
                    <div className="bg-gradient-to-br from-white via-slate-50/60 to-blue-50/30 border border-slate-200 rounded-xl p-4 shadow-xs">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-3.5 border-b border-slate-200">
                        <div className="flex items-center gap-3.5">
                          <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex flex-col items-center justify-center border font-bold shadow-xs shrink-0 ${composite.badgeClass}`}>
                            <span className="text-2xl sm:text-3xl leading-none font-extrabold">{composite.finalScore}</span>
                            <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">/ 100</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                                <Award className="w-5 h-5 text-amber-500 shrink-0" />
                                <span>Nilai Konversi: <span className={composite.gradeColor}>{composite.finalScore} / 100</span></span>
                              </h3>
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${composite.badgeClass}`}>
                                Predikat {composite.grade}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">
                              <strong>{composite.predicate}</strong> • Skor Mentah: <strong>{composite.totalRaw}/{composite.maxRaw} Poin</strong> ({Math.round((composite.totalRaw / composite.maxRaw) * 100)}%)
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
                          <button
                            onClick={() => setShowRubricModal(true)}
                            className="text-xs text-primary hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-colors cursor-pointer shadow-2xs"
                            title="Buka panduan & formula konversi nilai 0-100"
                          >
                            <GraduationCap className="w-4 h-4 text-primary" />
                            <span>Rubrik & Panduan 0-100</span>
                          </button>
                        </div>
                      </div>

                      {/* Dual Dimension Sub-Score Bars */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3.5">
                        {/* Dimension 1: Toulmin Logika */}
                        <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <BarChart2 className="w-3.5 h-3.5 text-primary" /> Logika Argumen (Toulmin)
                            </span>
                            <span className="font-bold text-slate-800">
                              {composite.toulminScore} / 100 <span className="text-slate-400 font-normal">({composite.toulminRaw}/16)</span>
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all duration-500 rounded-full" 
                              style={{ width: `${composite.toulminScore}%` }}
                            />
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-slate-500">
                            <span>Klaim, Bukti, Penalaran, Kontra</span>
                            <span className="font-medium text-slate-700">
                              {composite.toulminScore >= 85 ? 'Mahir (A)' : composite.toulminScore >= 75 ? 'Kompeten (B)' : composite.toulminScore >= 60 ? 'Cukup (C)' : 'Kurang (D)'}
                            </span>
                          </div>
                        </div>

                        {/* Dimension 2: Halliday SFL */}
                        <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-indigo-600" /> Linguistik Fungsional (Halliday)
                            </span>
                            <span className="font-bold text-slate-800">
                              {composite.hallidayScore ?? 0} / 100 <span className="text-slate-400 font-normal">({composite.hallidayRaw ?? 0}/16)</span>
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-600 transition-all duration-500 rounded-full" 
                              style={{ width: `${composite.hallidayScore ?? 0}%` }}
                            />
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-slate-500">
                            <span>Transitivitas, Modalitas, Tema-Rema, Kohesi</span>
                            <span className="font-medium text-slate-700">
                              {(composite.hallidayScore ?? 0) >= 85 ? 'Mahir (A)' : (composite.hallidayScore ?? 0) >= 75 ? 'Kompeten (B)' : (composite.hallidayScore ?? 0) >= 60 ? 'Cukup (C)' : 'Kurang (D)'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Weight Selector / Customizer Bar */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-slate-500">Skema Pembobotan:</span>
                          <span className="font-semibold text-slate-800">{composite.weightLabel}</span>
                        </div>
                        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                          <button
                            onClick={() => setWeightRatio('50-50')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                              weightRatio === '50-50' 
                                ? 'bg-primary text-white shadow-2xs' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                            title="50% Logika : 50% Bahasa (Standar Umum)"
                          >
                            50:50 (Seimbang)
                          </button>
                          <button
                            onClick={() => setWeightRatio('60-40')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                              weightRatio === '60-40' 
                                ? 'bg-primary text-white shadow-2xs' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                            title="60% Logika Argumen : 40% Bahasa (Fokus Argumen/Debat)"
                          >
                            60:40 (Logika)
                          </button>
                          <button
                            onClick={() => setWeightRatio('40-60')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                              weightRatio === '40-60' 
                                ? 'bg-primary text-white shadow-2xs' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                            title="40% Logika Argumen : 60% Bahasa (Fokus Linguistik/Wacana)"
                          >
                            40:60 (Linguistik)
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Empty state preview
                return (
                  <div className="bg-slate-50/80 border border-dashed border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-blue-100/70 text-primary flex items-center justify-center shrink-0">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800 block">Sistem Penilaian 0 - 100 Terintegrasi</span>
                        <span className="text-slate-500">8 indikator (4 Logika Toulmin + 4 Linguistik Halliday) dikonversi proporsional ke skala 0-100 & predikat huruf (A/B/C/D).</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowRubricModal(true)}
                      className="shrink-0 text-primary hover:text-blue-800 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" /> Pelajari Rubrik & Formula
                    </button>
                  </div>
                );
              })()}

              {/* View Selector Tabs & Action Bar */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-border">
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-medium">
                    <button
                      onClick={() => setAnalysisView('halliday')}
                      className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                        analysisView === 'halliday'
                          ? 'bg-white text-primary shadow-xs font-semibold'
                          : 'text-text-muted hover:text-text-main'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 text-primary" />
                      <span>Indikator Halliday (SFL)</span>
                    </button>
                    <button
                      onClick={() => setAnalysisView('argument')}
                      className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                        analysisView === 'argument'
                          ? 'bg-white text-primary shadow-xs font-semibold'
                          : 'text-text-muted hover:text-text-main'
                      }`}
                    >
                      <BarChart2 className="w-3.5 h-3.5" />
                      <span>Logika Argumen</span>
                    </button>
                    <button
                      onClick={() => setAnalysisView('all')}
                      className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                        analysisView === 'all'
                          ? 'bg-white text-primary shadow-xs font-semibold'
                          : 'text-text-muted hover:text-text-main'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Semua Dimensi</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => setShowTheoryGuide(true)}
                      className="text-xs text-primary hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 px-2.5 py-1.5 rounded-md flex items-center gap-1 font-medium transition-colors"
                      title="Pelajari teori Halliday"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Panduan Teori SFL</span>
                    </button>
                    
                    {analysis && (
                      <div className="flex gap-1 border-l border-slate-200 pl-2">
                        <button 
                          onClick={() => handleCopy(generateReportText(analysis))}
                          className="p-1 hover:bg-slate-100 rounded text-text-muted"
                          title="Salin Seluruh Laporan"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDownload(generateReportText(analysis, true), `analisis-lengkap-${Date.now()}.txt`)}
                          className="p-1 hover:bg-slate-100 rounded text-text-muted"
                          title="Unduh Laporan Lengkap (.txt)"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dimension 1: Halliday SFL Indicators */}
                {(analysisView === 'halliday' || analysisView === 'all') && (
                  <div className="mb-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                          Metafungsi Bahasa & Kohesi Wacana (M.A.K. Halliday)
                        </h4>
                      </div>
                      <span className="text-[11px] text-text-muted bg-slate-100 px-2 py-0.5 rounded-full">
                        Gramatika Fungsional
                      </span>
                    </div>

                    {/* SFL Summary Banner if available */}
                    {analysis?.halliday?.sflSummary && (
                      <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg text-xs leading-relaxed text-blue-900 shadow-2xs">
                        <div className="flex items-center gap-1.5 font-semibold text-primary mb-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>Sintesis Linguistik Fungsional:</span>
                        </div>
                        <p>{analysis.halliday.sflSummary}</p>
                      </div>
                    )}

                    {/* 4 Halliday Indicator Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      
                      {/* 1. Metafungsi Ideasional (Transitivitas) */}
                      <div className="p-3.5 bg-white border border-slate-200 rounded-lg shadow-2xs hover:border-blue-300 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-md bg-blue-100 text-primary flex items-center justify-center">
                              <Layers className="w-4 h-4" />
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-slate-800">1. Metafungsi Ideasional</h5>
                              <span className="text-[10px] text-text-muted">Sistem Transitivitas & Realitas</span>
                            </div>
                          </div>
                          {analysis?.halliday ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${getScoreBadgeClass(analysis.halliday.ideational.score)}`}>
                              {analysis.halliday.ideational.score}/4
                            </span>
                          ) : (
                            <span className="text-xs text-text-muted italic">-</span>
                          )}
                        </div>

                        {analysis?.halliday ? (
                          <div className="space-y-2 text-xs">
                            <div className="inline-block bg-blue-50 text-primary px-2 py-0.5 rounded text-[11px] font-medium border border-blue-100">
                              Proses: {analysis.halliday.ideational.dominantProcess}
                            </div>
                            <p className="text-slate-600 leading-relaxed">
                              {analysis.halliday.ideational.explanation}
                            </p>
                            {analysis.halliday.ideational.keyClauseExample && (
                              <div className="bg-slate-50 p-2 rounded border-l-2 border-primary text-[11px] text-slate-700 italic">
                                "{analysis.halliday.ideational.keyClauseExample}"
                              </div>
                            )}
                            <div className="bg-amber-50/80 p-2 rounded text-[11px] text-amber-900 border border-amber-200/60">
                              <strong>Saran Ideasional:</strong> {analysis.halliday.ideational.recommendation}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-text-muted italic py-3">Menunggu teks untuk dianalisis...</p>
                        )}
                      </div>

                      {/* 2. Metafungsi Interpersonal (Mood & Modalitas) */}
                      <div className="p-3.5 bg-white border border-slate-200 rounded-lg shadow-2xs hover:border-purple-300 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center">
                              <Compass className="w-4 h-4" />
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-slate-800">2. Metafungsi Interpersonal</h5>
                              <span className="text-[10px] text-text-muted">Mood, Sikap & Modalitas</span>
                            </div>
                          </div>
                          {analysis?.halliday ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${getScoreBadgeClass(analysis.halliday.interpersonal.score)}`}>
                              {analysis.halliday.interpersonal.score}/4
                            </span>
                          ) : (
                            <span className="text-xs text-text-muted italic">-</span>
                          )}
                        </div>

                        {analysis?.halliday ? (
                          <div className="space-y-2 text-xs">
                            <div className="inline-block bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-[11px] font-medium border border-purple-100">
                              Modalitas: {analysis.halliday.interpersonal.modalityLevel}
                            </div>
                            <p className="text-slate-600 leading-relaxed">
                              {analysis.halliday.interpersonal.stanceAnalysis}
                            </p>
                            {analysis.halliday.interpersonal.keyMarkers && analysis.halliday.interpersonal.keyMarkers.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                <span className="text-[10px] text-slate-500 font-medium">Pemarkah terdeteksi:</span>
                                {analysis.halliday.interpersonal.keyMarkers.map((marker, i) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-mono">
                                    {marker}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="bg-purple-50/80 p-2 rounded text-[11px] text-purple-900 border border-purple-200/60">
                              <strong>Saran Interpersonal:</strong> {analysis.halliday.interpersonal.recommendation}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-text-muted italic py-3">Menunggu teks untuk dianalisis...</p>
                        )}
                      </div>

                      {/* 3. Metafungsi Tekstual (Tema - Rema) */}
                      <div className="p-3.5 bg-white border border-slate-200 rounded-lg shadow-2xs hover:border-emerald-300 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
                              <GitMerge className="w-4 h-4" />
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-slate-800">3. Metafungsi Tekstual</h5>
                              <span className="text-[10px] text-text-muted">Struktur Tema-Rema & Progresi</span>
                            </div>
                          </div>
                          {analysis?.halliday ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${getScoreBadgeClass(analysis.halliday.textual.score)}`}>
                              {analysis.halliday.textual.score}/4
                            </span>
                          ) : (
                            <span className="text-xs text-text-muted italic">-</span>
                          )}
                        </div>

                        {analysis?.halliday ? (
                          <div className="space-y-2 text-xs">
                            <div className="inline-block bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[11px] font-medium border border-emerald-100">
                              Progresi: {analysis.halliday.textual.thematicProgression}
                            </div>
                            <p className="text-slate-600 leading-relaxed">
                              {analysis.halliday.textual.themeRhemeFlow}
                            </p>
                            <div className="bg-emerald-50/80 p-2 rounded text-[11px] text-emerald-900 border border-emerald-200/60">
                              <strong>Saran Alur Pesan:</strong> {analysis.halliday.textual.recommendation}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-text-muted italic py-3">Menunggu teks untuk dianalisis...</p>
                        )}
                      </div>

                      {/* 4. Kohesi Wacana (Halliday & Hasan) */}
                      <div className="p-3.5 bg-white border border-slate-200 rounded-lg shadow-2xs hover:border-teal-300 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-md bg-teal-100 text-teal-700 flex items-center justify-center">
                              <Link2 className="w-4 h-4" />
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-slate-800">4. Kohesi Wacana</h5>
                              <span className="text-[10px] text-text-muted">Piranti Gramatikal & Leksikal</span>
                            </div>
                          </div>
                          {analysis?.halliday ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${getScoreBadgeClass(analysis.halliday.cohesion.score)}`}>
                              {analysis.halliday.cohesion.score}/4
                            </span>
                          ) : (
                            <span className="text-xs text-text-muted italic">-</span>
                          )}
                        </div>

                        {analysis?.halliday ? (
                          <div className="space-y-2 text-xs">
                            <div className="inline-block bg-teal-50 text-teal-700 px-2 py-0.5 rounded text-[11px] font-medium border border-teal-100">
                              Piranti: {analysis.halliday.cohesion.cohesiveDevices}
                            </div>
                            <p className="text-slate-600 leading-relaxed">
                              {analysis.halliday.cohesion.cohesionStrength}
                            </p>
                            <div className="bg-teal-50/80 p-2 rounded text-[11px] text-teal-900 border border-teal-200/60">
                              <strong>Saran Kohesi:</strong> {analysis.halliday.cohesion.recommendation}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-text-muted italic py-3">Menunggu teks untuk dianalisis...</p>
                        )}
                      </div>

                    </div>
                  </div>
                )}

                {/* Dimension 2: Argument Logic Rubric */}
                {(analysisView === 'argument' || analysisView === 'all') && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                      <h4 className="text-sm font-bold text-slate-800">
                        Dimensi Logika Argumen & Pembuktian
                      </h4>
                    </div>

                    <ul className="space-y-3 text-sm">
                      <li className="flex flex-col border-b border-dashed border-border pb-2">
                        <div className="flex justify-between items-center">
                          <strong>Claim Clarity:</strong>
                          {analysis ? (
                            <span className={`font-medium ${getScoreColor(analysis.claimClarity.score)}`}>
                              {analysis.claimClarity.status} ({analysis.claimClarity.score}/4)
                            </span>
                          ) : (
                            <span className="text-text-muted italic">Menunggu teks...</span>
                          )}
                        </div>
                        {analysis && <p className="text-xs text-text-muted mt-1 bg-slate-50 p-2 rounded">{analysis.claimClarity.feedback}</p>}
                      </li>
                      <li className="flex flex-col border-b border-dashed border-border pb-2">
                        <div className="flex justify-between items-center">
                          <strong>Evidence Quality:</strong>
                          {analysis ? (
                            <span className={`font-medium ${getScoreColor(analysis.evidenceQuality.score)}`}>
                              {analysis.evidenceQuality.status} ({analysis.evidenceQuality.score}/4)
                            </span>
                          ) : (
                            <span className="text-text-muted italic">Menunggu teks...</span>
                          )}
                        </div>
                        {analysis && <p className="text-xs text-text-muted mt-1 bg-slate-50 p-2 rounded">{analysis.evidenceQuality.feedback}</p>}
                      </li>
                      <li className="flex flex-col border-b border-dashed border-border pb-2">
                        <div className="flex justify-between items-center">
                          <strong>Reasoning Coherence:</strong>
                          {analysis ? (
                            <span className={`font-medium ${getScoreColor(analysis.reasoningCoherence.score)}`}>
                              {analysis.reasoningCoherence.status} ({analysis.reasoningCoherence.score}/4)
                            </span>
                          ) : (
                            <span className="text-text-muted italic">Menunggu teks...</span>
                          )}
                        </div>
                        {analysis && <p className="text-xs text-text-muted mt-1 bg-slate-50 p-2 rounded">{analysis.reasoningCoherence.feedback}</p>}
                      </li>
                      <li className="flex flex-col border-b border-dashed border-border pb-2">
                        <div className="flex justify-between items-center">
                          <strong>Counter-argument:</strong>
                          {analysis ? (
                            <span className={`font-medium ${getScoreColor(analysis.counterArgument.score)}`}>
                              {analysis.counterArgument.status} ({analysis.counterArgument.score}/4)
                            </span>
                          ) : (
                            <span className="text-text-muted italic">Menunggu teks...</span>
                          )}
                        </div>
                        {analysis && <p className="text-xs text-text-muted mt-1 bg-slate-50 p-2 rounded">{analysis.counterArgument.feedback}</p>}
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* History Section */}
            {analysisHistory.length > 0 && (
              <div className="mt-6 border-t-2 border-bg-app pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Riwayat Progres ({analysisHistory.length})
                  </h3>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => handleCopy(analysisHistory.map((item, i) => `ANALISIS #${analysisHistory.length - i}\n` + generateReportText(item)).join('\n\n'))}
                      className="text-xs flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-text-muted"
                    >
                      <Copy className="w-3 h-3" /> Salin Semua
                    </button>
                    <button 
                      onClick={handleDownloadHistory}
                      className="text-xs flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-text-muted"
                    >
                      <Download className="w-3 h-3" /> Unduh Semua
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {analysisHistory.map((item, index) => (
                    <div key={item.id} className="border border-border rounded-md bg-bg-app overflow-hidden">
                      <button 
                        onClick={() => setExpandedHistoryId(expandedHistoryId === item.id ? null : item.id)}
                        className="w-full flex justify-between items-center p-3 text-left hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          <div>
                            <div className="text-sm font-medium flex items-center gap-2">
                              <span>Analisis #{analysisHistory.length - index}</span>
                              {(() => {
                                const hScore = calculateCompositeScore(item, weightRatio);
                                return hScore ? (
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${hScore.badgeClass}`}>
                                    Nilai: {hScore.finalScore} ({hScore.grade})
                                  </span>
                                ) : null;
                              })()}
                            </div>
                            <div className="text-xs text-text-muted">{new Date(item.timestamp).toLocaleTimeString()}</div>
                          </div>
                        </div>
                        {expandedHistoryId === item.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      
                      {expandedHistoryId === item.id && (
                        <div className="p-3 bg-white border-t border-border text-xs space-y-2.5">
                          {/* 0-100 Score Summary Banner */}
                          {(() => {
                            const hScore = calculateCompositeScore(item, weightRatio);
                            return hScore ? (
                              <div className="p-2.5 rounded-lg bg-gradient-to-r from-slate-50 to-blue-50/50 border border-slate-200 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Award className="w-4 h-4 text-amber-500 shrink-0" />
                                  <span className="font-semibold text-slate-800">
                                    Nilai Konversi: <strong className={hScore.gradeColor}>{hScore.finalScore} / 100</strong>
                                  </span>
                                  <span className="text-[11px] text-slate-500 hidden sm:inline">
                                    ({hScore.predicate})
                                  </span>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${hScore.badgeClass}`}>
                                  Predikat {hScore.grade}
                                </span>
                              </div>
                            ) : null;
                          })()}

                          <div className="p-2 bg-slate-50 rounded italic text-text-muted mb-2 line-clamp-3">
                            "{item.originalText}"
                          </div>
                          
                          {/* Argument metrics */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-2 border-b border-dashed border-slate-200">
                            <div>
                              <span className="text-[11px] text-slate-500 block">Klaim:</span>
                              <span className={`font-semibold ${getScoreColor(item.claimClarity.score)}`}>{item.claimClarity.score}/4</span>
                            </div>
                            <div>
                              <span className="text-[11px] text-slate-500 block">Bukti:</span>
                              <span className={`font-semibold ${getScoreColor(item.evidenceQuality.score)}`}>{item.evidenceQuality.score}/4</span>
                            </div>
                            <div>
                              <span className="text-[11px] text-slate-500 block">Penalaran:</span>
                              <span className={`font-semibold ${getScoreColor(item.reasoningCoherence.score)}`}>{item.reasoningCoherence.score}/4</span>
                            </div>
                            <div>
                              <span className="text-[11px] text-slate-500 block">Kontra:</span>
                              <span className={`font-semibold ${getScoreColor(item.counterArgument.score)}`}>{item.counterArgument.score}/4</span>
                            </div>
                          </div>

                          {/* Halliday metrics if available */}
                          {item.halliday && (
                            <div className="bg-blue-50/50 p-2.5 rounded border border-blue-100 space-y-1.5 text-slate-700">
                              <span className="font-semibold text-primary block text-[11px]">
                                Skor Indikator Halliday (SFL):
                              </span>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div>
                                  <span className="text-[10px] text-slate-500 block">Ideasional:</span>
                                  <span className={`font-semibold ${getScoreColor(item.halliday.ideational.score)}`}>{item.halliday.ideational.score}/4</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 block">Interpersonal:</span>
                                  <span className={`font-semibold ${getScoreColor(item.halliday.interpersonal.score)}`}>{item.halliday.interpersonal.score}/4</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 block">Tekstual:</span>
                                  <span className={`font-semibold ${getScoreColor(item.halliday.textual.score)}`}>{item.halliday.textual.score}/4</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 block">Kohesi:</span>
                                  <span className={`font-semibold ${getScoreColor(item.halliday.cohesion.score)}`}>{item.halliday.cohesion.score}/4</span>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="pt-1">
                            <span className="font-semibold block mb-0.5 text-slate-700">Catatan Ringkas:</span>
                            <p className="text-slate-600">{item.generalFeedback}</p>
                          </div>
                          
                          <div className="flex justify-end pt-1">
                            <button 
                              onClick={() => handleDownload(generateReportText(item, true), `analisis-${item.id}.txt`)}
                              className="text-primary hover:underline flex items-center gap-1 font-medium text-xs"
                            >
                              <Download className="w-3.5 h-3.5" /> Unduh Laporan Analisis Ini
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Chat UI Only */}
        <section className={`flex-1 bg-panel rounded-lg border border-border flex flex-col p-4 shadow-sm overflow-hidden min-w-[300px] h-full ${activeTab === 'analysis' ? 'hidden md:flex' : 'flex'}`}>
          <div className="flex items-center justify-between border-b-2 border-bg-app pb-2 mb-3">
            <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              AI Assistant Chat
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-primary border border-blue-200/60 font-medium">
              Cognitive Scaffolding
            </span>
          </div>

          <div className="flex flex-col border border-border rounded-lg overflow-hidden flex-1 bg-white shadow-xs">
            <div className="flex-1 p-4 bg-slate-50/70 overflow-y-auto space-y-4">
              {chatHistory.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex gap-2.5 ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}
                >
                  {msg.role === 'ai' && (
                    <div className="w-8 h-8 rounded-full bg-blue-100/90 text-primary flex items-center justify-center shrink-0 mt-0.5 border border-blue-200/50 shadow-2xs">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}
                  
                  <div 
                    className={`relative group max-w-[88%] text-sm rounded-2xl ${
                      msg.role === 'ai' 
                        ? 'bg-white border border-slate-200/90 text-text-main p-3.5 sm:p-4 shadow-xs rounded-tl-xs' 
                        : 'bg-primary text-white p-3.5 sm:p-4 shadow-xs rounded-tr-xs'
                    }`}
                  >
                    {msg.role === 'ai' ? (
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1.5 text-primary font-semibold">
                            <Sparkles className="w-3 h-3 text-amber-500" /> Asisten Scaffolding
                          </span>
                          <button
                            onClick={() => handleCopy(msg.text)}
                            className="hover:text-primary transition-colors flex items-center gap-1 text-slate-400 opacity-60 group-hover:opacity-100"
                            title="Salin jawaban"
                          >
                            <Copy className="w-3 h-3" />
                            <span className="text-[10px]">Salin</span>
                          </button>
                        </div>
                        <div className="text-sm leading-relaxed text-slate-800 space-y-2 [&_p]:mb-2.5 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:mb-1.5 [&_li:last-child]:mb-0 [&_strong]:font-semibold [&_strong]:text-slate-900 [&_em]:italic [&_em]:text-slate-700 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:italic [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono">
                          <Markdown>{formatChatMarkdown(msg.text)}</Markdown>
                        </div>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {msg.text}
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}
              
              {isChatting && (
                <div className="flex gap-2.5 justify-start items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-100/90 text-primary flex items-center justify-center shrink-0 border border-blue-200/50 shadow-2xs">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-white border border-slate-200/90 px-4 py-3 rounded-2xl rounded-tl-xs text-sm text-slate-500 flex items-center gap-2.5 shadow-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-xs font-medium">Asisten sedang menyusun panduan...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            
            {/* Quick Prompt Chips for Halliday & Argument Scaffolding */}
            <div className="px-3 pt-2 pb-1 bg-slate-50 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
              <span className="text-slate-400 font-medium shrink-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" /> Bantuan SFL & Nilai:
              </span>
              <button
                onClick={() => handleSendMessage("Bagaimana cara menilai dan mengonversi hasil analisis teks ini ke skala nilai 0-100? Berikan formula dan rubriknya.")}
                disabled={isChatting}
                className="shrink-0 px-2.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-full border border-amber-200 transition-colors disabled:opacity-50 flex items-center gap-1 font-semibold"
              >
                <Calculator className="w-3 h-3 text-amber-600" />
                Konversi Nilai 0-100
              </button>
              <button
                onClick={() => handleSendMessage("Bagaimana analisis sistem transitivitas (proses material/mental/relasional) pada klausa utama tulisan saya?")}
                disabled={isChatting}
                className="shrink-0 px-2 py-0.5 bg-white hover:bg-blue-50 text-slate-700 hover:text-primary rounded-full border border-slate-200 transition-colors disabled:opacity-50"
              >
                Transitivitas Ideasional
              </button>
              <button
                onClick={() => handleSendMessage("Evaluasi derajat modalitas dan tingkat kepastian (stance/hedging) argumen saya menurut Halliday.")}
                disabled={isChatting}
                className="shrink-0 px-2 py-0.5 bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-700 rounded-full border border-slate-200 transition-colors disabled:opacity-50"
              >
                Modalitas Interpersonal
              </button>
              <button
                onClick={() => handleSendMessage("Bagaimana progresi Tema-Rema dalam teks saya? Apakah sudah mengalir secara linier/berkesinambungan?")}
                disabled={isChatting}
                className="shrink-0 px-2 py-0.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-full border border-slate-200 transition-colors disabled:opacity-50"
              >
                Alur Tema-Rema
              </button>
              <button
                onClick={() => handleSendMessage("Bagaimana cara meningkatkan kohesi gramatikal (konjungsi) dan kohesi leksikal agar teks lebih padu?")}
                disabled={isChatting}
                className="shrink-0 px-2 py-0.5 bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-700 rounded-full border border-slate-200 transition-colors disabled:opacity-50"
              >
                Kohesi Wacana
              </button>
            </div>

            <div className="flex border-t border-border bg-white p-1.5">
              <input 
                type="text" 
                className="flex-1 px-3 py-2 text-sm focus:outline-none placeholder:text-slate-400"
                placeholder="Tanya asisten untuk panduan penulisan atau teori Halliday..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isChatting}
              />
              <button 
                onClick={() => handleSendMessage()}
                disabled={isChatting || !chatInput.trim()}
                className="bg-primary text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 font-medium text-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kirim</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Halliday SFL Theory Guide Modal */}
      {showTheoryGuide && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-primary text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-200" />
                <div>
                  <h3 className="font-bold text-base">Panduan Teori: Linguistik Sistemik Fungsional (SFL)</h3>
                  <p className="text-xs text-blue-100">Berdasarkan Gramatika Fungsional M.A.K. Halliday (1985, 1994) & Halliday & Hasan (1976)</p>
                </div>
              </div>
              <button 
                onClick={() => setShowTheoryGuide(false)}
                className="text-white/80 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed text-slate-700">
              <p className="text-slate-800 font-medium bg-blue-50 p-3 rounded-lg border border-blue-100">
                Dalam pandangan M.A.K. Halliday, bahasa bukan sekadar kumpulan aturan bentuk kalimat, melainkan <strong>sistem pemaknaan fungsional (*meaning-making system*)</strong> yang melayani tiga metafungsi utama serta perekatan tekstur wacana:
              </p>

              <div className="space-y-3">
                <div className="p-3.5 border border-slate-200 rounded-lg bg-slate-50/60">
                  <div className="flex items-center gap-2 font-bold text-sm text-blue-800 mb-1">
                    <Layers className="w-4 h-4 text-primary" />
                    <span>1. Metafungsi Ideasional (Sistem Transitivitas)</span>
                  </div>
                  <p className="mb-2 text-slate-600">
                    Merepresentasikan pengalaman manusia dan dunia nyata ke dalam bentuk bahasa. Sistem ini membedah klausa menjadi tiga unsur: <strong>Proses (Process)</strong>, <strong>Partisipan (Participants)</strong>, dan <strong>Sirkumstansi (Circumstances)</strong>.
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-600">
                    <li><strong>Proses Material:</strong> Tindakan fisik dan peristiwa nyata (*menghasilkan, membangun, memicu*).</li>
                    <li><strong>Proses Mental:</strong> Pengalaman batin, kognisi, afeksi, dan persepsi (*meyakini, memahami, menyadari*).</li>
                    <li><strong>Proses Relasional:</strong> Menghubungkan identitas atau atribut (*merupakan, adalah, mencirikan*). Sangat krusial dalam definisi klaim.</li>
                    <li><strong>Proses Verbal & Perilaku:</strong> Ujaran dan kutipan pakar (*menyatakan, mengemukakan, berpendapat*).</li>
                  </ul>
                </div>

                <div className="p-3.5 border border-slate-200 rounded-lg bg-slate-50/60">
                  <div className="flex items-center gap-2 font-bold text-sm text-purple-800 mb-1">
                    <Compass className="w-4 h-4 text-purple-700" />
                    <span>2. Metafungsi Interpersonal (Mood & Modalitas)</span>
                  </div>
                  <p className="mb-2 text-slate-600">
                    Mengatur interaksi sosial antara penulis dan pembaca, menetapkan sikap (*stance*), serta derajat kepastian atau kewajiban.
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-600">
                    <li><strong>Modalisasi (Epistemic Modality):</strong> Mengatur probabilitas (*mungkin, dapat dipastikan*) dan keberbiasaan (*sering, lazimnya*).</li>
                    <li><strong>Modulasi (Deontic Modality):</strong> Mengatur keharusan/kewajiban (*harus, wajib, patut*) dan kesediaan.</li>
                    <li><strong>Derajat Modalitas (Hedging):</strong> Penulis argumen yang matang menghindari generalisasi mutlak yang rapuh dengan memilih modalitas menengah untuk menunjukkan kehati-hatian akademik yang persuasif.</li>
                  </ul>
                </div>

                <div className="p-3.5 border border-slate-200 rounded-lg bg-slate-50/60">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-800 mb-1">
                    <GitMerge className="w-4 h-4 text-emerald-700" />
                    <span>3. Metafungsi Tekstual (Struktur Tema - Rema)</span>
                  </div>
                  <p className="mb-2 text-slate-600">
                    Menyusun klausa menjadi aliran pesan yang kohesif dan mudah dipahami pembaca melalui pengorganisasian informasi:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-600">
                    <li><strong>Tema (Theme):</strong> Titik tolak klausa (*point of departure*), biasanya memuat informasi yang sudah diketahui (*Given Information*).</li>
                    <li><strong>Rema (Rheme):</strong> Pengembangan pesan baru (*New Information*).</li>
                    <li><strong>Pola Progresi Tematis:</strong> Rema klausa pertama idealnya menjadi Tema pada klausa berikutnya (Pola Linier/Zig-zag), atau Tema diulang teratur (Pola Konstan) agar wacana tidak melompat-lompat.</li>
                  </ul>
                </div>

                <div className="p-3.5 border border-slate-200 rounded-lg bg-slate-50/60">
                  <div className="flex items-center gap-2 font-bold text-sm text-teal-800 mb-1">
                    <Link2 className="w-4 h-4 text-teal-700" />
                    <span>4. Kohesi Wacana (Halliday & Hasan 1976)</span>
                  </div>
                  <p className="mb-2 text-slate-600">
                    Kerekatan antarkalimat yang menciptakan "tekstur" wacana:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-600">
                    <li><strong>Kohesi Gramatikal:</strong> Referensi (kata ganti ia/mereka, penunjukan *hal ini*), Substitusi, Elipsis, dan Konjungsi logis (*oleh karena itu, namun, sebaliknya*).</li>
                    <li><strong>Kohesi Leksikal:</strong> Repetisi kata kunci argumen, sinonimi, antonimi, dan kolokasi istilah teknis.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setShowTheoryGuide(false)}
                className="px-4 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-blue-700 transition-colors"
              >
                Mengerti & Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rubric & Score Conversion (0-100) Modal */}
      {showRubricModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-white/10 text-amber-300">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    Rubrik Penilaian & Formula Konversi Nilai (0 - 100)
                  </h3>
                  <p className="text-xs text-blue-200">
                    Konversi Multi-Indikator Toulmin & Linguistik Fungsional Halliday ke Standar Nilai Akademik
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowRubricModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs leading-relaxed text-slate-700">
              
              {/* Introduction Banner */}
              <div className="p-3.5 bg-blue-50/80 rounded-xl border border-blue-200/70 text-slate-800 space-y-1.5">
                <div className="font-bold text-sm text-primary flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>Prinsip Penilaian Holistik (Logika + Bahasa)</span>
                </div>
                <p className="text-slate-600 leading-normal">
                  Sistem mengevaluasi <strong>8 Indikator Kunci</strong> (masing-masing berskala 1 - 4 poin) yang terbagi seimbang ke dalam dua pilar: 
                  <strong> 4 Indikator Logika Toulmin</strong> (maks. 16 poin) dan <strong>4 Indikator Linguistik Fungsional Halliday</strong> (maks. 16 poin), 
                  sehingga menghasilkan <strong>Total Skor Maksimal = 32 Poin</strong>.
                </p>
              </div>

              {/* Section 1: Mathematical Formulas */}
              <div className="space-y-3">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b pb-1.5 border-slate-200">
                  <Calculator className="w-4 h-4 text-primary" />
                  <span>1. Rumus & Formula Konversi ke Nilai 0 - 100</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* Skema 1: Seimbang */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-xs">Skema Standar (50% : 50%)</span>
                      <span className="bg-primary/10 text-primary font-bold px-2 py-0.5 rounded text-[10px]">Rekomendasi</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200 font-mono text-center text-xs font-semibold text-slate-800 shadow-2xs">
                      Nilai Akhir = (Total Skor Mentah / 32) × 100
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Cocok untuk penilaian esai umum akademik: memberi porsi sama kuat antara pembuktian logika (50%) dan kematangan ekspresi wacana (50%).
                    </p>
                  </div>

                  {/* Skema 2: Bobot Fleksibel */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <span className="font-bold text-slate-800 text-xs block">Skema Khusus (Bobot Berbeda)</span>
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200 font-mono text-center text-[11px] font-semibold text-slate-800 shadow-2xs">
                      Nilai = (Skor Toulmin / 16 × 100 × W₁) + (Skor Halliday / 16 × 100 × W₂)
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Dosen/Guru dapat menyesuaikan fokus: <strong>60:40</strong> untuk tugas riset/debat berbasis bukti, atau <strong>40:60</strong> untuk mata kuliah linguistik & kemahiran bahasa.
                    </p>
                  </div>
                </div>

                {/* Simulasi Kasus Nyata */}
                <div className="p-3 bg-amber-50/70 rounded-lg border border-amber-200/80 text-amber-950 space-y-1">
                  <span className="font-bold text-xs flex items-center gap-1.5 text-amber-900">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    Contoh Simulasi Perhitungan Nyata:
                  </span>
                  <p className="text-[11px] leading-relaxed text-amber-900">
                    Jika sebuah teks esai dinilai: 
                    <strong> Logika Argumen</strong> = 13/16 (Klaim 4, Bukti 3, Nalar 3, Kontra 3) & 
                    <strong> Linguistik Halliday</strong> = 15/16 (Ideasional 4, Interpersonal 3, Tekstual 4, Kohesi 4).<br />
                    Maka Total Skor Mentah = <strong>28 / 32 Poin</strong>.<br />
                    <strong>Nilai Konversi 0-100</strong> = (28 / 32) × 100 = <strong>87.5 (dibulatkan menjadi 88)</strong> → <strong>Predikat A (Sangat Baik / Mahir)</strong>.
                  </p>
                </div>
              </div>

              {/* Section 2: Predicate Conversion Table */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b pb-1.5 border-slate-200">
                  <Award className="w-4 h-4 text-emerald-600" />
                  <span>2. Konversi Rentang Nilai ke Predikat Huruf & Standar Akademik</span>
                </h4>

                <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-2.5 w-24">Rentang</th>
                        <th className="p-2.5 w-20">Huruf</th>
                        <th className="p-2.5 w-40">Kategori Predikat</th>
                        <th className="p-2.5">Karakteristik Kualitas Tulisan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50/80 bg-emerald-50/20">
                        <td className="p-2.5 font-bold font-mono text-emerald-800">85 - 100</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">A</span>
                        </td>
                        <td className="p-2.5 font-semibold text-emerald-900">Sangat Baik (Mahir / Advanced)</td>
                        <td className="p-2.5 text-slate-600">
                          Klaim sangat tajam, bukti empiris valid & meyakinkan, penalaran koheren, modalitas objektif (tidak overclaim), aliran tema-rema linier/zig-zag mulus, kohesi leksikal-gramatikal sangat padu.
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/80 bg-blue-50/20">
                        <td className="p-2.5 font-bold font-mono text-blue-800">75 - 84</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800 border border-blue-300">B</span>
                        </td>
                        <td className="p-2.5 font-semibold text-blue-900">Baik (Kompeten / Proficient)</td>
                        <td className="p-2.5 text-slate-600">
                          Memenuhi standar esai ilmiah. Klaim jelas dan didukung bukti relevan, transisi antarkalimat terjaga. Perlu sedikit penguatan pada antisipasi argumen kontra atau variasi proses transitivitas.
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/80 bg-amber-50/20">
                        <td className="p-2.5 font-bold font-mono text-amber-800">60 - 74</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-800 border border-amber-300">C</span>
                        </td>
                        <td className="p-2.5 font-semibold text-amber-900">Cukup (Berkembang / Developing)</td>
                        <td className="p-2.5 text-slate-600">
                          Argumen dasar dapat ditangkap, namun bukti masih berupa opini/klaim tak berdasar, ada lompatan penalaran, tema-rema melompat, atau pemarkah kohesi minim/berulang.
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/80 bg-red-50/20">
                        <td className="p-2.5 font-bold font-mono text-red-800">&lt; 60</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded font-bold bg-red-100 text-red-800 border border-red-300">D / E</span>
                        </td>
                        <td className="p-2.5 font-semibold text-red-900">Perlu Bimbingan (Novice)</td>
                        <td className="p-2.5 text-slate-600">
                          Struktur argumen belum terbentuk (klaim tidak eksplisit, tanpa bukti), modalitas mutlak tanpa argumentasi, atau teks terfragmentasi tanpa tekstur kohesi. Memerlukan bimbingan scaffolding intensif.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 3: Rubric Scale 1 - 4 Conversion */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b pb-1.5 border-slate-200">
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  <span>3. Matriks 8 Indikator & Poin Maksimal Rubrik</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* Toulmin Rubric Matrix */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex justify-between items-center font-bold text-slate-800">
                      <span className="flex items-center gap-1.5 text-primary">
                        <BarChart2 className="w-4 h-4" /> Dimensi Logika Toulmin
                      </span>
                      <span className="bg-blue-50 text-primary border border-blue-200 px-2 py-0.5 rounded text-[11px]">
                        Maks. 16 Poin
                      </span>
                    </div>
                    <ul className="divide-y divide-slate-100 text-[11px] space-y-1">
                      <li className="pt-1 flex justify-between">
                        <span>1. Kejelasan Klaim (*Claim Clarity*)</span>
                        <strong className="font-mono text-slate-800">1 - 4 Poin</strong>
                      </li>
                      <li className="pt-1 flex justify-between">
                        <span>2. Kualitas Bukti (*Evidence Quality*)</span>
                        <strong className="font-mono text-slate-800">1 - 4 Poin</strong>
                      </li>
                      <li className="pt-1 flex justify-between">
                        <span>3. Koherensi Penalaran (*Reasoning Coherence*)</span>
                        <strong className="font-mono text-slate-800">1 - 4 Poin</strong>
                      </li>
                      <li className="pt-1 flex justify-between">
                        <span>4. Argumen Kontra (*Counter-Argument*)</span>
                        <strong className="font-mono text-slate-800">1 - 4 Poin</strong>
                      </li>
                    </ul>
                  </div>

                  {/* Halliday Rubric Matrix */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex justify-between items-center font-bold text-slate-800">
                      <span className="flex items-center gap-1.5 text-indigo-700">
                        <Layers className="w-4 h-4" /> Dimensi Linguistik Halliday (SFL)
                      </span>
                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-[11px]">
                        Maks. 16 Poin
                      </span>
                    </div>
                    <ul className="divide-y divide-slate-100 text-[11px] space-y-1">
                      <li className="pt-1 flex justify-between">
                        <span>1. Metafungsi Ideasional (Transitivitas)</span>
                        <strong className="font-mono text-slate-800">1 - 4 Poin</strong>
                      </li>
                      <li className="pt-1 flex justify-between">
                        <span>2. Metafungsi Interpersonal (Mood & Modalitas)</span>
                        <strong className="font-mono text-slate-800">1 - 4 Poin</strong>
                      </li>
                      <li className="pt-1 flex justify-between">
                        <span>3. Metafungsi Tekstual (Tema-Rema)</span>
                        <strong className="font-mono text-slate-800">1 - 4 Poin</strong>
                      </li>
                      <li className="pt-1 flex justify-between">
                        <span>4. Kohesi Wacana (Gramatikal & Leksikal)</span>
                        <strong className="font-mono text-slate-800">1 - 4 Poin</strong>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Section 4: Tips for Teachers and Students */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-xs text-slate-800 block">
                  Pedoman Praktis Penggunaan (Penilaian Formatif & Sumatif):
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-600">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <strong className="text-slate-800 block mb-1">Bagi Dosen / Guru (Evaluator):</strong>
                    Gunakan nilai konversi 0-100 sebagai nilai objektif tugas esai. Anda dapat menyalin atau mengunduh laporan berformat lengkap yang memuat rincian breakdown poin mentah, nilai per dimensi, dan predikat resmi.
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <strong className="text-slate-800 block mb-1">Bagi Mahasiswa / Penulis:</strong>
                    Lihat indikator mana yang nilainya masih 1 atau 2. Tanyakan kepada Asisten AI Chat (misal: "Bagaimana cara menaikkan nilai saya ke 90+?") untuk mendapatkan scaffolding konkret perbaikan klausanya.
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Skor 0-100 otomatis diperbarui setiap kali Anda melakukan analisis baru.
              </span>
              <button
                onClick={() => setShowRubricModal(false)}
                className="px-4 py-1.5 bg-primary text-white rounded-md text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer shadow-xs"
              >
                Tutup Panduan Rubrik
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div 
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg border text-sm flex items-center gap-2.5 max-w-sm transition-all duration-200 animate-fadeIn ${
            toast.type === 'error'
              ? 'bg-red-700 text-white border-red-800'
              : toast.type === 'success'
              ? 'bg-emerald-700 text-white border-emerald-800'
              : 'bg-slate-800 text-white border-slate-900'
          }`}
        >
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-red-200" />}
          {toast.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0 text-emerald-200" />}
          {toast.type === 'info' && <Info className="w-4 h-4 shrink-0 text-blue-200" />}
          <span className="flex-1 text-xs leading-normal">{toast.message}</span>
          <button 
            onClick={() => setToast(null)}
            className="opacity-75 hover:opacity-100 p-0.5"
            title="Tutup"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
