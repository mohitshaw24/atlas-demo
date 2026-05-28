import { PipelineStage } from "@/lib/ai/types";

export interface RouteConfig {
  primaryProvider: "groq" | "gemini" | "deepseek"|"openrouter";
  primaryModel: string;
  fallbackProvider: "openrouter";
  fallbackModel: string;
  maxRetries: number;
}

export const AI_ROUTING: Record<PipelineStage, RouteConfig> = {
  stage1_intent: {
    primaryProvider: "groq",
    primaryModel: "llama-3.1-8b-instant",
    fallbackProvider: "openrouter",
    fallbackModel: "meta-llama/llama-3.1-8b-instruct",
    maxRetries: 2,
  },
  stage2_schema: {
    primaryProvider: "gemini",
    primaryModel: "models/gemini-flash-latest", // ✅ Updated: Valid model from your list
    fallbackProvider: "openrouter",
    fallbackModel: "google/gemini-flash-1.5",
    maxRetries: 2,
  },
  stage3_spec: {
  primaryProvider: "openrouter",
  primaryModel: "deepseek/deepseek-chat", // Uses DeepSeek via OpenRouter
  fallbackProvider: "openrouter",
  fallbackModel: "meta-llama/llama-3.1-70b-instruct",
  maxRetries: 2,
},
  repair_engine: {
    primaryProvider: "groq",
    primaryModel: "llama-3.3-70b-versatile",
    fallbackProvider: "openrouter",
    fallbackModel: "meta-llama/llama-3.1-70b-instruct",
    maxRetries: 1,
  },
};