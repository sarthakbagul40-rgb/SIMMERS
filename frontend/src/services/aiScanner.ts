import { createWorker } from 'tesseract.js';
import { processImageWithMLKit } from './mlKitScanner';

export interface ScanResult {
  success: boolean;
  expiryDate?: string; // YYYY-MM-DD
  daysFromToday?: number;
  detectedText?: string;
  itemName?: string;
  error?: string;
}

function normalizeOcrText(raw: string): string {
  // Replace letter O/o with 0, l/I with 1, Z/z with 2, S/s with 5 in date-like contexts
  let text = raw
    .replace(/EXP\.?\s*DAT[E3]/gi, 'EXP DATE')
    .replace(/MFG\.?\s*DAT[E3]/gi, 'MFG DATE')
    .replace(/B[E3]ST\s*B[E3]FOR[E3]/gi, 'BEST BEFORE')
    .replace(/US[E3]\s*BY/gi, 'USE BY');

  // Convert letter O or o to 0 inside date slash/dash/dot sequences (e.g., O3/O2/2O27 -> 03/02/2027)
  text = text.replace(/([O0-9]{1,2})\s*[\/\.\-]\s*([O0-9]{1,2})\s*[\/\.\-]\s*([O0-9]{2,4})/gi, (_m, p1, p2, p3) => {
    const c1 = p1.replace(/O/gi, '0');
    const c2 = p2.replace(/O/gi, '0');
    const c3 = p3.replace(/O/gi, '0');
    return `${c1}/${c2}/${c3}`;
  });

  return text;
}

function parseDateString(str: string): Date | null {
  let clean = str.replace(/[^\w\/\.\-\s]/g, '').trim();

  // Match DD/MM/YYYY or MM/DD/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dateMatch = clean.match(/(\d{1,2})\s*[\/\.\-]\s*(\d{1,2})\s*[\/\.\-]\s*(\d{2,4})/);
  if (dateMatch) {
    let p1 = parseInt(dateMatch[1], 10);
    let p2 = parseInt(dateMatch[2], 10);
    let p3 = parseInt(dateMatch[3], 10);

    if (!isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
      let year = p3;
      if (year < 100) year = 2000 + year;

      let day = p1;
      let month = p2;

      // Handle DD/MM/YYYY vs MM/DD/YYYY
      if (p1 > 12 && p2 <= 12) {
        day = p1;
        month = p2;
      } else if (p2 > 12 && p1 <= 12) {
        day = p2;
        month = p1;
      }

      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return new Date(year, month - 1, day);
      }
    }
  }

  // Match MM/YYYY or MM/YY
  const monthYearMatch = clean.match(/(\d{1,2})\s*[\/\.\-]\s*(\d{2,4})/);
  if (monthYearMatch) {
    let month = parseInt(monthYearMatch[1], 10);
    let year = parseInt(monthYearMatch[2], 10);
    if (year < 100) year = 2000 + year;
    if (month >= 1 && month <= 12) {
      return new Date(year, month, 0); // End of month
    }
  }

  // Match Month Names (e.g., 03 FEB 2027 or FEB 2027)
  const monthMap: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
  };
  const upper = clean.toUpperCase();
  for (const [mName, mIdx] of Object.entries(monthMap)) {
    if (upper.includes(mName)) {
      const yrMatch = upper.match(/\d{2,4}/);
      if (yrMatch) {
        let y = parseInt(yrMatch[0], 10);
        if (y < 100) y = 2000 + y;

        const dayMatch = upper.match(/(\d{1,2})\s*[A-Z]{3}/);
        const day = dayMatch ? parseInt(dayMatch[1], 10) : 28;

        return new Date(y, mIdx, Math.min(day, 28));
      }
    }
  }

  return null;
}

export function parseExpiryDateFromText(rawText: string): ScanResult {
  const normalized = normalizeOcrText(rawText);
  // Flatten multiline text into single spaces for pattern matching across line breaks
  const flattenedText = normalized.replace(/[\r\n]+/g, ' ');
  const upper = flattenedText.toUpperCase();

  // Explicit keyword patterns for Expiry Date
  const expiryRegexes = [
    /(?:EXP\.?\s*DATE|EXPIRY\.?\s*DATE|EXPIRY|EXP|USE\s*BY|BEST\s*BEFORE|USE\s*BEFORE|VALID\s*TILL|EXPIRES\s*ON|EXPIRES|BEST\s*BY)\s*[:.\-]?\s*(.{1,60})/gi,
  ];

  let detectedStr: string | null = null;
  let labelMatched: string = '';

  for (const regex of expiryRegexes) {
    const matches = Array.from(upper.matchAll(regex));
    for (const match of matches) {
      const lineContent = match[1] || '';
      // Look for 3-part or 2-part date strings
      const allSubMatches = Array.from(lineContent.matchAll(/(\d{1,2}\s*[\/\.\-]\s*\d{1,2}\s*[\/\.\-]\s*\d{2,4}|\d{1,2}\s*[\/\.\-]\s*\d{2,4}|[A-Z]{3,9}\s*\d{2,4}|\d{1,2}\s*[A-Z]{3,9}\s*\d{2,4})/gi));
      if (allSubMatches.length > 0) {
        // Pick the last date in the line (e.g. Mfg date 05/26 vs Expiry 26/05/27)
        const bestMatch = allSubMatches[allSubMatches.length - 1];
        detectedStr = bestMatch[0].trim();
        labelMatched = match[0].trim().substring(0, 40);
        break;
      }
    }
    if (detectedStr) break;
  }

  // Generic fallback if keyword regex missed but date format exists in text
  if (!detectedStr) {
    const genericDateRegex = /(\d{1,2}\s*[\/\.\-]\s*\d{1,2}\s*[\/\.\-]\s*\d{2,4}|\d{1,2}\s*[\/\.\-]\s*\d{2,4})/g;
    const allMatches = Array.from(upper.matchAll(genericDateRegex));
    if (allMatches.length > 0) {
      // Pick the last date in the text (Expiry Date is almost always printed after Mfg Date)
      const lastMatch = allMatches[allMatches.length - 1];
      detectedStr = lastMatch[1].trim();
      labelMatched = `EXP ${detectedStr}`;
    }
  }

  if (detectedStr) {
    const parsedDate = parseDateString(detectedStr);
    if (parsedDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffTime = parsedDate.getTime() - today.getTime();
      const daysFromToday = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (daysFromToday > 0) {
        const year = parsedDate.getFullYear();
        const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const day = String(parsedDate.getDate()).padStart(2, '0');
        const expiryDateFormatted = `${year}-${month}-${day}`;

        return {
          success: true,
          expiryDate: expiryDateFormatted,
          daysFromToday: Math.max(1, daysFromToday),
          detectedText: labelMatched
        };
      }
    }
  }

  return {
    success: false,
    error: 'Expiry date could not be read automatically. Please set or adjust expiry date manually below.'
  };
}

async function preprocessImageForOcr(base64Data: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width;
      let h = img.height;
      // Upscale low-res cropped photos to at least 1200px for sharp OCR character recognition
      if (w < 1000 || h < 1000) {
        const scale = Math.max(1200 / w, 1200 / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Data);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Adaptive Binarization for dot-matrix text on colored plastic packaging
      let totalLuma = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalLuma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      const avgLuma = totalLuma / (data.length / 4);

      for (let i = 0; i < data.length; i += 4) {
        const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const v = luma < avgLuma ? 0 : 255;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = () => resolve(base64Data);
    img.src = base64Data;
  });
}

export async function scanPacketExpiryDate(
  base64Data: string,
  mimeType: string = 'image/jpeg',
  apiKey?: string,
  nativeFilePath?: string
): Promise<ScanResult> {
  // Engine 0: Try Hardware-Accelerated Native ML Kit (100% Offline, sub-100ms)
  if (nativeFilePath) {
    try {
      const mlKitRes = await processImageWithMLKit(nativeFilePath);
      if (mlKitRes && mlKitRes.rawText) {
        const parsedResult = parseExpiryDateFromText(mlKitRes.rawText);
        if (parsedResult.success) {
          console.log('🎯 Native ML Kit successfully extracted expiry date offline!');
          return parsedResult;
        }
      }
    } catch (mlErr) {
      console.warn('Native ML Kit execution error, continuing to cloud/web engines:', mlErr);
    }
  }

  const envApiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  const activeApiKey = (apiKey && apiKey.trim().length > 0)
    ? apiKey.trim()
    : (envApiKey || '');

  // Engine 1: Try Gemini Vision API if key is present (trying gemini-1.5-flash and gemini-2.0-flash)
  if (activeApiKey) {
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const todayISO = new Date().toISOString().substring(0, 10);
    const modelsToTry = ['gemini-1.5-flash', 'gemini-2.0-flash'];

    for (const model of modelsToTry) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `Analyze this food product packet photo label.
                      Find the EXPIRY DATE (Exp. Date / Best Before / Use By / Exp Date) and the Food Item Name.
                      
                      CRITICAL INSTRUCTIONS:
                      1. Distinguish between Manufacturing Date (Mfg. Date / PKD) and Expiry Date (Exp. Date). Always pick the EXPIRY DATE!
                      2. Today's date is ${todayISO}.
                      3. Calculate exact days remaining from today (${todayISO}) to the expiry date.
                      
                      Return ONLY a raw valid JSON object (no markdown, no backticks) with this structure:
                      {
                        "itemName": "Milk",
                        "expiryDate": "YYYY-MM-DD",
                        "daysFromToday": 179,
                        "detectedText": "Exp. Date : 03/02/2027",
                        "readable": true
                      }
                      
                      If the expiry date is missing or unreadable:
                      { "itemName": "Milk", "readable": false }`
                    },
                    {
                      inline_data: {
                        mime_type: mimeType,
                        data: cleanBase64
                      }
                    }
                  ]
                }
              ]
            })
          }
        );

        if (response.ok) {
          const data = await response.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          
          if (rawText) {
            const jsonString = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(jsonString);

            if (parsed.readable && parsed.daysFromToday !== undefined) {
              return {
                success: true,
                itemName: parsed.itemName,
                expiryDate: parsed.expiryDate,
                daysFromToday: Math.max(1, Math.round(parsed.daysFromToday)),
                detectedText: parsed.detectedText || parsed.expiryDate
              };
            } else if (parsed.itemName) {
              return {
                success: false,
                itemName: parsed.itemName,
                error: 'Expiry date was not clearly visible in the photo. Please set date manually.'
              };
            }
          }
        }
      } catch (error) {
        console.warn(`Gemini API call (${model}) failed, trying fallback:`, error);
      }
    }
  }

  // Engine 2: Fallback to Tesseract OCR with Contrast Enhancement (No API key required!)
  try {
    const preprocessedImage = await preprocessImageForOcr(base64Data);
    const worker = await createWorker('eng');
    const ret = await worker.recognize(preprocessedImage);
    await worker.terminate();

    const ocrText = ret.data.text;
    console.log('Tesseract OCR Extracted Text:', ocrText);

    const parsedResult = parseExpiryDateFromText(ocrText);
    if (parsedResult.success) {
      return parsedResult;
    }

    // Secondary attempt on raw image if preprocessed failed
    const rawWorker = await createWorker('eng');
    const rawRet = await rawWorker.recognize(base64Data);
    await rawWorker.terminate();

    const rawParsedResult = parseExpiryDateFromText(rawRet.data.text);
    if (rawParsedResult.success) {
      return rawParsedResult;
    }
  } catch (ocrErr) {
    console.warn('Tesseract OCR extraction error:', ocrErr);
  }

  return {
    success: false,
    error: 'Expiry date could not be read automatically. Please set or adjust expiry date manually below.'
  };
}

