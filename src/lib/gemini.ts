import { GoogleGenAI } from "@google/genai";

export const MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', isDefault: true },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', isDefault: false },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', isDefault: false },
];

// Fallback order
const FALLBACK_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3-pro-preview',
  'gemini-2.5-flash'
];

export async function callGeminiAI(
  prompt: string, 
  apiKey: string, 
  modelId?: string, 
  fallbackIndex: number = 0
): Promise<string> {
  if (!apiKey) {
    throw new Error('Vui lòng cấu hình API Key trong phần cài đặt.');
  }

  // Use explicitly requested model or fallback model
  let targetModel = modelId;
  
  // If no initial model is specified, use the fallback order
  if (!targetModel) {
    targetModel = FALLBACK_MODELS[fallbackIndex];
  } else if (fallbackIndex > 0) {
    // If we're retrying and explicitly specified model failed,
    // we use the fallback list.
    targetModel = FALLBACK_MODELS[fallbackIndex - 1]; // Offset index
  }

  // Final check: if we exhausted the list
  if (fallbackIndex > FALLBACK_MODELS.length || !targetModel) {
    throw new Error(`Đã thử tất cả các model nhưng vẫn xảy ra lỗi. Vui lòng thử lại sau.`);
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: targetModel,
      contents: [{ parts: [{ text: prompt }] }],
    });
    
    return response.text || '';
  } catch (error: any) {
    console.error(`Gemini API Error with model [${targetModel}]:`, error.message);
    
    // Only fallback if we have remaining models in the list
    if (fallbackIndex < FALLBACK_MODELS.length) {
      console.log(`Đang tự động Fallback sang model kế tiếp (${fallbackIndex + 1}/${FALLBACK_MODELS.length})...`);
      return callGeminiAI(prompt, apiKey, modelId, fallbackIndex + 1);
    }
    
    // Completely exhausted
    throw error;
  }
}
