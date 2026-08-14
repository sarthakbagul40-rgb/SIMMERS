import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ScanItemResult {
  itemName?: string;
  expiryDate?: string; // YYYY-MM-DD
  confidence: 'high' | 'medium' | 'low';
  rawText?: string;
  error?: string;
}

export async function scanPantryImage(imageBase64: string): Promise<ScanItemResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'mock-gemini-key' || apiKey === 'your-gemini-api-key-here') {
    // Return structured mock result for local dev / testing
    return {
      itemName: 'Organic Whole Milk 1L',
      expiryDate: '2026-08-25',
      confidence: 'high',
      rawText: 'EXP: 2026-08-25 Organic Whole Milk',
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `Analyze this image of a grocery/pantry item or receipt.
Extract the product/item name and expiry date if visible.
Return strictly a valid JSON object matching this structure:
{
  "itemName": "string or null",
  "expiryDate": "YYYY-MM-DD format or null",
  "confidence": "high" | "medium" | "low",
  "rawText": "summary of detected text"
}
Do not include markdown formatting or backticks around the JSON.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: cleanBase64,
          mimeType: 'image/jpeg',
        },
      },
    ]);

    const response = await result.response;
    const text = response.text() || '';
    const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      itemName: parsed.itemName || undefined,
      expiryDate: parsed.expiryDate || undefined,
      confidence: parsed.confidence || 'low',
      rawText: parsed.rawText || text,
    };
  } catch (error) {
    console.error('[Gemini Service Scan Error]:', error);
    return {
      confidence: 'low',
      error: 'Failed to extract structured data from image',
    };
  }
}
