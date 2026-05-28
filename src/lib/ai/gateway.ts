import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { AI_ROUTING } from "@/config/ai.config";
import { LLMRequest, LLMResponse, PipelineStage } from "./types";
import { calculateCost } from "./cost";

// Initialize Clients with strict typing
const groqClient = new OpenAI({ 
  apiKey: process.env.GROQ_API_KEY as string, 
  baseURL: "https://api.groq.com/openai/v1" 
});

const deepseekClient = new OpenAI({ 
  apiKey: process.env.DEEPSEEK_API_KEY as string, 
  baseURL: "https://api.deepseek.com" 
});

const openrouterClient = new OpenAI({ 
  apiKey: process.env.OPENROUTER_API_KEY as string, 
  baseURL: "https://openrouter.ai/api/v1" 
});

// Gemini doesn't use baseURL in the same way, but we ensure the key is a string
const geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export class AIGateway {
  
  async call(stage: PipelineStage, request: LLMRequest): Promise<LLMResponse> {
    const route = AI_ROUTING[stage];
    const startTime = Date.now();

    try {
      // 1. Try Primary Provider
      console.log(`[Gateway] ${stage}: Attempting ${route.primaryProvider} (${route.primaryModel})`);
      return await this.executeProvider(route.primaryProvider, route.primaryModel, request, startTime);
    } catch (error: any) {
      console.warn(`[Gateway] ${stage}: Primary failed (${error.message}). Falling back to OpenRouter.`);
      
      // 2. Fallback to OpenRouter
      const fallbackStart = Date.now();
      return await this.executeProvider(route.fallbackProvider, route.fallbackModel, request, fallbackStart);
    }
  }

  private async executeProvider(
    provider: string, 
    model: string, 
    request: LLMRequest, 
    startTime: number
  ): Promise<LLMResponse> {
    
    let content = "";
    let promptTokens = 0;
    let completionTokens = 0;

    if (provider === "gemini") {
  // Gemini SDK expects model name with or without "models/" prefix
  const cleanModelName = model.replace("models/", "");
  
  const geminiModel = geminiClient.getGenerativeModel({ 
    model: cleanModelName,
    generationConfig: { 
      responseMimeType: "application/json",
      temperature: request.temperature ?? 0.1
    }
  });
      
      // Gemini expects system instruction separately
      const systemMsg = request.messages.find(m => m.role === "system");
      const userMsgs = request.messages.filter(m => m.role !== "system");
      
      const result = await geminiModel.generateContent({
        contents: userMsgs.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        systemInstruction: systemMsg ? { role: "system", parts: [{ text: systemMsg.content }] } : undefined,
      });

      const response = await result.response;
      content = response.text();
      promptTokens = response.usageMetadata?.promptTokenCount || 0;
      completionTokens = response.usageMetadata?.candidatesTokenCount || 0;

    } else {
      // OpenAI Compatible (Groq, DeepSeek, OpenRouter)
      const client = this.getOpenAIClient(provider);
      
      const response = await client.chat.completions.create({
        model: model,
        messages: request.messages,
        response_format: { type: "json_object" }, // Enforce JSON in OpenAI-compatible APIs
        temperature: request.temperature ?? 0.1, // Low temperature for structured output
      });

      content = response.choices[0]?.message?.content || "";
      promptTokens = response.usage?.prompt_tokens || 0;
      completionTokens = response.usage?.completion_tokens || 0;
    }

    // Clean up common LLM JSON markdown wrapping (```json ... ```)
    const cleanContent = content.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
    
    let parsedJson: any = undefined;
    try {
      parsedJson = JSON.parse(cleanContent);
    } catch (e) {
      console.error("[Gateway] Failed to parse JSON from LLM:", cleanContent);
      throw new Error("LLM returned invalid JSON despite JSON enforcement.");
    }

    return {
      content: cleanContent,
      parsedJson,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      provider,
      model,
      estimatedCostUSD: calculateCost(model, promptTokens, completionTokens),
      latencyMs: Date.now() - startTime,
    };
  }

  private getOpenAIClient(provider: string): OpenAI {
    switch (provider) {
      case "groq": return groqClient;
      case "deepseek": return deepseekClient;
      case "openrouter": return openrouterClient;
      default: throw new Error(`Unknown OpenAI-compatible provider: ${provider}`);
    }
  }
}

export const aiGateway = new AIGateway();