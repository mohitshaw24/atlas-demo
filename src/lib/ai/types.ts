export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  temperature?: number;
  // We will inject the Zod schema as a JSON schema string into the system prompt 
  // to ensure maximum compatibility across all providers.
  jsonSchemaHint?: string; 
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  content: string;
  parsedJson?: any;
  usage: TokenUsage;
  provider: string;
  model: string;
  estimatedCostUSD: number;
  latencyMs: number;
}

export type PipelineStage = 
  | "stage1_intent" 
  | "stage2_schema" 
  | "stage3_spec" 
  | "repair_engine";