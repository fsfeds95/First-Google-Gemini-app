// No specific types needed for this simple app beyond what's directly from the SDK or React.
// Keeping this file for structural consistency.
export interface ImageGenerationConfig {
  prompt: string;
  numberOfImages: number;
  outputMimeType: string;
  aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  referenceImage?: {
    data: string; // base64 encoded string
    mimeType: string;
  };
}

export interface HistoryItem {
  imageUrl: string;
  prompt: string;
  aspectRatio: ImageGenerationConfig['aspectRatio'];
  imageStyle: string;
  referenceImageUrl?: string; // data URL of the reference image
}
