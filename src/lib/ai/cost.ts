// Rough cost estimates per 1M tokens (Input / Output)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Groq Models
  "llama-3.1-8b-instant": { input: 0.05, output: 0.08 },
  "llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
  
  // Gemini Models ✅ Updated
  "models/gemini-flash-latest": { input: 0.075, output: 0.30 },
  "gemini-flash-latest": { input: 0.075, output: 0.30 }, // Fallback lookup
  
  // DeepSeek Models
  "deepseek-chat": { input: 0.14, output: 0.28 },
  
  // OpenRouter Fallbacks
  "meta-llama/llama-3.1-8b-instruct": { input: 0.10, output: 0.10 },
  "google/gemini-flash-1.5": { input: 0.075, output: 0.30 },
  "deepseek/deepseek-chat": { input: 0.14, output: 0.28 },
};

export function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model] || { input: 0.10, output: 0.10 }; // Default fallback
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}