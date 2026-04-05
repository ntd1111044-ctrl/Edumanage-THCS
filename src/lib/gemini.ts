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
  _triedModels: string[] = []
): Promise<string> {
  if (!apiKey) {
    throw new Error('Vui lòng cấu hình API Key trong phần cài đặt.');
  }

  // Build ordered model list: requested model first, then fallbacks
  const orderedModels = modelId
    ? [modelId, ...FALLBACK_MODELS.filter(m => m !== modelId)]
    : [...FALLBACK_MODELS];

  // Find next model that hasn't been tried yet
  const nextModel = orderedModels.find(m => !_triedModels.includes(m));

  if (!nextModel) {
    throw new Error('Đã thử tất cả các model nhưng vẫn xảy ra lỗi. Vui lòng thử lại sau.');
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: nextModel,
      contents: [{ parts: [{ text: prompt }] }],
    });
    
    return response.text || '';
  } catch (error: any) {
    console.error(`Gemini API Error with model [${nextModel}]:`, error.message);
    
    const newTriedModels = [..._triedModels, nextModel];
    const remaining = orderedModels.filter(m => !newTriedModels.includes(m));
    
    if (remaining.length > 0) {
      console.log(`Đang tự động Fallback sang model kế tiếp: ${remaining[0]}...`);
      return callGeminiAI(prompt, apiKey, modelId, newTriedModels);
    }
    
    // Completely exhausted
    throw error;
  }
}
