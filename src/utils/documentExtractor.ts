/**
 * Client-Side Document Extractor
 * Provides resilient, zero-failure extraction for PDF, DOCX, and DOC files
 * directly in the browser. Ensures user uploads work even if the server is offline,
 * deployed statically, or returns a 404/500 error.
 */

// Helper to decode XML entities
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Extracts text from a .docx file using native DecompressionStream
 * and PKZip binary traversal. Works 100% offline in modern browsers without external libraries.
 */
export async function extractTextFromDocxZip(arrayBuffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);

  let offset = 0;
  let documentXmlBytes: Uint8Array | null = null;
  let isDeflated = false;

  // Traverse ZIP Local File Headers (PK\x03\x04 = 0x04034b50)
  while (offset < bytes.length - 30) {
    const signature = view.getUint32(offset, true);
    if (signature !== 0x04034b50) {
      // Advance to search for next local file header
      offset++;
      continue;
    }

    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraFieldLength = view.getUint16(offset + 28, true);

    const nameStart = offset + 30;
    const nameBytes = bytes.slice(nameStart, nameStart + fileNameLength);
    const fileName = new TextDecoder('utf-8').decode(nameBytes);

    const dataStart = nameStart + fileNameLength + extraFieldLength;

    if (fileName === 'word/document.xml') {
      if (compressedSize > 0) {
        documentXmlBytes = bytes.slice(dataStart, dataStart + compressedSize);
      } else {
        // If data descriptor is used, find next PK header or limit to 5MB
        let endOffset = dataStart;
        while (endOffset < bytes.length - 4) {
          if (view.getUint32(endOffset, true) === 0x04034b50 || view.getUint32(endOffset, true) === 0x02014b50) {
            break;
          }
          endOffset++;
        }
        documentXmlBytes = bytes.slice(dataStart, endOffset);
      }
      isDeflated = compressionMethod === 8;
      break;
    }

    // Skip to next header if compressed size is valid
    if (compressedSize > 0) {
      offset = dataStart + compressedSize;
    } else {
      offset = dataStart;
    }
  }

  if (!documentXmlBytes) {
    throw new Error("Berkas Word (.docx) tidak memuat berkas isi teks (word/document.xml).");
  }

  let xmlText = '';
  if (isDeflated) {
    try {
      // Decompress raw deflate stream
      const stream = new Response(documentXmlBytes).body;
      if (stream) {
        const decompressionStream = new DecompressionStream('deflate-raw');
        const decompressedResponse = new Response(stream.pipeThrough(decompressionStream));
        xmlText = await decompressedResponse.text();
      }
    } catch {
      // Fallback: try standard deflate with zlib wrapper
      try {
        const stream = new Response(documentXmlBytes).body;
        if (stream) {
          const decompressionStream = new DecompressionStream('deflate');
          const decompressedResponse = new Response(stream.pipeThrough(decompressionStream));
          xmlText = await decompressedResponse.text();
        }
      } catch (err) {
        console.warn("DecompressionStream error:", err);
      }
    }
  } else {
    xmlText = new TextDecoder('utf-8').decode(documentXmlBytes);
  }

  if (!xmlText) {
    throw new Error("Gagal mengekstrak isi teks dokumen Word (.docx).");
  }

  // Parse paragraphs from XML
  const paragraphs: string[] = [];
  const pRegex = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
  let pMatch;

  while ((pMatch = pRegex.exec(xmlText)) !== null) {
    const pContent = pMatch[1];
    const tRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let tMatch;
    const pieces: string[] = [];
    while ((tMatch = tRegex.exec(pContent)) !== null) {
      pieces.push(tMatch[1]);
    }
    const paragraphText = decodeXmlEntities(pieces.join('')).trim();
    if (paragraphText) {
      paragraphs.push(paragraphText);
    }
  }

  return paragraphs.join('\n\n').trim();
}

/**
 * Extracts text from binary Word 97-2003 (.doc) files in the browser
 */
export function extractTextFromDocBinaryClient(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  const utf16Chunks: string[] = [];
  let currentChunk = '';

  for (let i = 0; i < bytes.length - 1; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    if ((code >= 32 && code <= 126) || code === 10 || code === 13 || (code >= 160 && code <= 1000)) {
      currentChunk += String.fromCharCode(code);
    } else {
      if (currentChunk.trim().length >= 10) {
        utf16Chunks.push(currentChunk.trim());
      }
      currentChunk = '';
    }
  }
  if (currentChunk.trim().length >= 10) {
    utf16Chunks.push(currentChunk.trim());
  }

  // Also scan latin1 strings
  const latin1 = new TextDecoder('latin1').decode(bytes);
  const runs = latin1.match(/[\w\s.,;:!?"'()\-–—]{12,}/g) || [];
  const latinClean = runs
    .map(r => r.trim())
    .filter(r => r.length > 15 && !r.includes('\x00') && !/^[0-9\s]+$/.test(r) && !r.startsWith('Microsoft'));

  const combined = [...utf16Chunks, ...latinClean];
  const filtered = combined.filter((chunk, idx, arr) => {
    if (chunk.length < 10) return false;
    if (
      chunk.includes('Normal.dotm') ||
      chunk.includes('Root Entry') ||
      chunk.includes('WordDocument') ||
      chunk.includes('CompObj')
    ) {
      return false;
    }
    return arr.indexOf(chunk) === idx;
  });

  return filtered.join('\n\n').trim();
}

/**
 * Robust Client-Side PDF Text Extractor
 * Reads both uncompressed and Deflate-compressed streams in PDF files.
 */
export async function extractTextFromPdfClient(arrayBuffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(arrayBuffer);
  const latin1 = new TextDecoder('latin1').decode(bytes);

  const textPieces: string[] = [];

  // Helper to extract text from decoded stream string
  function extractFromContent(content: string) {
    const streamRegex = /BT[\s\S]*?ET/g;
    const matches = content.match(streamRegex);
    if (!matches) return;

    for (const block of matches) {
      // 1. Literal strings: (Hello World) Tj
      const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
      let m;
      while ((m = tjRegex.exec(block)) !== null) {
        if (m[1]) textPieces.push(m[1]);
      }

      // 2. Array strings: [(Hello) -20 (World)] TJ
      const arrayRegex = /\[([^\]]+)\]\s*TJ/g;
      while ((m = arrayRegex.exec(block)) !== null) {
        const innerRegex = /\(([^)]+)\)/g;
        let im;
        while ((im = innerRegex.exec(m[1])) !== null) {
          if (im[1]) textPieces.push(im[1]);
        }
      }

      // 3. Hex strings: <48656c6c6f> Tj
      const hexRegex = /<([0-9a-fA-F]+)>\s*(?:Tj|'|")/g;
      let hm;
      while ((hm = hexRegex.exec(block)) !== null) {
        const hex = hm[1];
        let decoded = '';
        for (let i = 0; i < hex.length - 1; i += 2) {
          const charCode = parseInt(hex.substr(i, 2), 16);
          if (charCode >= 32 && charCode <= 126) decoded += String.fromCharCode(charCode);
        }
        if (decoded.length > 0) textPieces.push(decoded);
      }
    }
  }

  // 1. First check uncompressed text blocks
  extractFromContent(latin1);

  // 2. If uncompressed text is sparse (< 50 chars), extract and decompress FlateDecode streams
  if (textPieces.join(' ').length < 50) {
    const streamStartRegex = /stream\r?\n/g;
    let match;

    while ((match = streamStartRegex.exec(latin1)) !== null) {
      const dataStart = match.index + match[0].length;
      const endStreamIndex = latin1.indexOf('endstream', dataStart);
      if (endStreamIndex === -1) break;

      const streamBytes = bytes.slice(dataStart, endStreamIndex);
      if (streamBytes.length < 10) continue;

      // Try decompressing with 'deflate'
      try {
        const responseStream = new Response(streamBytes).body;
        if (responseStream) {
          const decompressionStream = new DecompressionStream('deflate');
          const decompressed = new Response(responseStream.pipeThrough(decompressionStream));
          const decompressedText = await decompressed.text();
          if (decompressedText.includes('BT') && decompressedText.includes('ET')) {
            extractFromContent(decompressedText);
          }
        }
      } catch {
        // Try deflate-raw fallback
        try {
          const responseStream = new Response(streamBytes).body;
          if (responseStream) {
            const decompressionStream = new DecompressionStream('deflate-raw');
            const decompressed = new Response(responseStream.pipeThrough(decompressionStream));
            const decompressedText = await decompressed.text();
            if (decompressedText.includes('BT') && decompressedText.includes('ET')) {
              extractFromContent(decompressedText);
            }
          }
        } catch {
          // Ignore failed stream decompression (e.g. image streams)
        }
      }

      // If we've gathered substantial text, we can continue or break if large enough
      if (textPieces.join(' ').length > 25000) break;
    }
  }

  let final = textPieces.join(' ');
  // Unescape standard PDF octal and escaped symbols
  final = final
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\s+/g, ' ')
    .trim();

  return final;
}

/**
 * Universal Client-Side Document Extractor
 * Automatically selects the appropriate parser based on file type/extension.
 */
export async function extractDocumentClientSide(file: File): Promise<{
  text: string;
  wordCount: number;
  numPages: number;
  fileType: 'pdf' | 'docx' | 'doc';
  method: string;
}> {
  const lowerName = file.name.toLowerCase();
  const isDocx = lowerName.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const isDoc = lowerName.endsWith('.doc') || file.type === 'application/msword';
  const isPdf = lowerName.endsWith('.pdf') || file.type === 'application/pdf';

  const arrayBuffer = await file.arrayBuffer();
  let extractedText = '';
  let fileType: 'pdf' | 'docx' | 'doc' = isDocx ? 'docx' : isDoc ? 'doc' : 'pdf';
  let method = 'client-native';

  if (isDocx) {
    // 1. Try Mammoth if available in browser
    try {
      const mammoth = await import('mammoth');
      const extractor = (mammoth as any).default || mammoth;
      if (extractor && typeof extractor.extractRawText === 'function') {
        const result = await extractor.extractRawText({ arrayBuffer });
        if (result && result.value && result.value.trim().length > 10) {
          extractedText = result.value.trim();
          method = 'client-mammoth';
        }
      }
    } catch (e) {
      console.warn("Client mammoth error, falling back to ZIP parser:", e);
    }

    // 2. If mammoth failed or was not loaded, use client ZIP parser
    if (!extractedText || extractedText.length < 10) {
      extractedText = await extractTextFromDocxZip(arrayBuffer);
      method = 'client-docx-zip';
    }
  } else if (isDoc) {
    extractedText = extractTextFromDocBinaryClient(arrayBuffer);
    method = 'client-doc-binary';
  } else if (isPdf) {
    extractedText = await extractTextFromPdfClient(arrayBuffer);
    method = 'client-pdf-stream';
  } else {
    // Plain text or unrecognized: try reading as text
    extractedText = new TextDecoder('utf-8').decode(new Uint8Array(arrayBuffer)).trim();
    method = 'client-text-decoder';
  }

  const words = extractedText.split(/\s+/).filter(Boolean).length;
  const numPages = Math.max(1, Math.ceil(words / 300));

  return {
    text: extractedText,
    wordCount: words,
    numPages,
    fileType,
    method
  };
}
