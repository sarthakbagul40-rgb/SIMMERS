import { TextRecognition } from '@capacitor-mlkit/text-recognition';
import { Capacitor } from '@capacitor/core';

export interface MLKitScanResult {
  rawText: string;
  lines: Array<{
    text: string;
    top?: number;
    left?: number;
    bottom?: number;
    right?: number;
  }>;
}

export async function processImageWithMLKit(imagePath: string): Promise<MLKitScanResult | null> {
  // ML Kit native plugin is available on Android & iOS native platforms
  if (!Capacitor.isNativePlatform()) {
    console.log('[MLKitScanner] Running on Web browser, falling back to Web JS OCR.');
    return null;
  }

  try {
    const result = await TextRecognition.processImage({
      path: imagePath,
    });

    const lines: MLKitScanResult['lines'] = [];
    if (result.blocks && result.blocks.length > 0) {
      for (const block of result.blocks) {
        for (const line of block.lines) {
          lines.push({
            text: line.text,
            top: line.boundingBox?.top,
            left: line.boundingBox?.left,
            bottom: line.boundingBox?.bottom,
            right: line.boundingBox?.right,
          });
        }
      }
    }

    return {
      rawText: result.text || '',
      lines,
    };
  } catch (err) {
    console.warn('[MLKitScanner] Native ML Kit processing failed, using fallback OCR:', err);
    return null;
  }
}
