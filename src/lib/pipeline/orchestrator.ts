import { PipelineStage } from "@/lib/ai/types";
import { getIntegrationContextForPrompt } from "@/lib/integrations/registry";
import { aiGateway } from "@/lib/ai/gateway";
import { ValidationEngine } from "@/lib/validation/engine";
import { generateRepairPrompt } from "@/lib/validation/repair";
import { 
  AppIntentSchema, 
  DataSchemaSchema, 
  AppSpecSchema,
  AppIntent,
  DataSchema 
} from "@/lib/schemas";
import { SSEStreamer } from "./stream";

export class PipelineOrchestrator {
  private streamer: SSEStreamer;

  constructor(streamer: SSEStreamer) {
    this.streamer = streamer;
  }

  async run(userPrompt: string) {
    try {
      // --- STAGE 1: INTENT EXTRACTION ---
      this.streamer.send({ stage: "Stage 1", status: "started", message: "Extracting App Intent..." });
      
      const intentResult = await this.executeStage(
  "stage1_intent",
  "App Intent Extraction",
  `You are an expert application architect. Extract the following from this user prompt: "${userPrompt}"

Return a JSON object with these EXACT fields:
- "appName": string (3-50 characters, a short name for the app)
- "description": string (at least 10 characters, detailed description)
- "coreEntities": string[] (array of main data entities, e.g., ["User", "Project", "Invoice"])
- "primaryActions": string[] (array of main actions, e.g., ["create_invoice", "track_time"])
- "requiredIntegrations": string[] (array from: "slack", "stripe", "jira", "github", "gmail", "twilio", "openai")
- "targetAudience": string (optional, who will use this)

Output ONLY valid JSON. No markdown, no explanations.`,
  AppIntentSchema
);
      
      this.streamer.send({ stage: "Stage 1", status: "completed", message: "Intent extracted successfully.", data: intentResult });
      const intent = intentResult as AppIntent;

      // --- STAGE 2: SCHEMA GENERATION ---
this.streamer.send({ stage: "Stage 2", status: "started", message: "Generating Data Schema..." });

const schemaPrompt = `You are a database architect. Create a relational database schema for this application:

Application Intent: ${JSON.stringify(intent)}

REQUIREMENTS:
1. Create tables for ALL core entities mentioned in the intent
2. Each table MUST have these exact fields:
   - "name": string (table name, singular, e.g., "User", "Project")
   - "fields": array of field objects

3. Each field MUST have:
   - "name": string (field name, camelCase)
   - "type": one of ["uuid", "string", "text", "integer", "float", "boolean", "timestamp", "json"]
   - "isPrimaryKey": boolean (true for ID fields)
   - "isRequired": boolean

4. Define relationships between tables using:
   - "sourceTable": string
   - "targetTable": string  
   - "type": one of ["one-to-one", "one-to-many", "many-to-many"]
   - "foreignKey": string (optional, the field name)

OUTPUT FORMAT (EXACT):
{
  "tables": [
    {
      "name": "User",
      "fields": [
        { "name": "id", "type": "uuid", "isPrimaryKey": true, "isRequired": true },
        { "name": "email", "type": "string", "isRequired": true }
      ]
    }
  ],
  "relationships": [
    { "sourceTable": "Project", "targetTable": "User", "type": "many-to-one", "foreignKey": "userId" }
  ]
}

Output ONLY valid JSON. No markdown, no explanations.`;

const schemaResult = await this.executeStage(
  "stage2_schema",
  "Data Schema Generation",
  schemaPrompt,
  DataSchemaSchema,
  "stage2_schema"
);
      
      this.streamer.send({ stage: "Stage 2", status: "completed", message: "Schema generated successfully.", data: schemaResult });
      const schema = schemaResult as DataSchema;

          // --- STAGE 3: APP SPEC GENERATION ---
this.streamer.send({ stage: "Stage 3", status: "started", message: "Generating Final App Spec..." });

// Generate the strict menu of allowed API operations
const integrationContext = getIntegrationContextForPrompt(intent.requiredIntegrations || []);

const specPrompt = `You are an expert application architect. Generate a complete AppSpec based on:

Application Intent: ${JSON.stringify(intent)}
Database Schema: ${JSON.stringify(schema)}

${integrationContext}

CRITICAL: Output the JSON in this EXACT structure:

{
  "version": "1.0.0",
  "intent": {
    "appName": "string",
    "description": "string",
    "coreEntities": ["string"],
    "primaryActions": ["string"],
    "requiredIntegrations": ["slack" | "stripe" | "jira" | "github" | "gmail" | "twilio" | "openai"],
    "targetAudience": "string"
  },
  "schema": {
    "tables": [
      {
        "name": "string",
        "fields": [
          { "name": "string", "type": "uuid" | "string" | "text" | "integer" | "float" | "boolean" | "timestamp" | "json", "isPrimaryKey": boolean, "isRequired": boolean }
        ]
      }
    ],
    "relationships": [
      { "sourceTable": "string", "targetTable": "string", "type": "one-to-one" | "one-to-many" | "many-to-many", "foreignKey": "string" }
    ]
  },
  "uiViews": [
    {
      "name": "string",
      "description": "string",
      "components": [
        { "id": "string", "type": "Form" | "DataTable" | "Dashboard" | "Button" | "Modal", "props": {}, "boundTable": "string" }
      ]
    }
  ],
  "workflows": [
    {
      "name": "string",
      "trigger": { "type": "on_create" | "on_update" | "on_delete" | "cron", "sourceTable": "string" },
      "actions": [
        { "integration": "slack" | "stripe" | "jira" | "github" | "gmail" | "twilio" | "openai", "operation": "string", "inputs": {} }
      ]
    }
  ]
}

RULES:
1. Output ONLY the JSON object - NO wrapping keys like "AppSpec"
2. Use "uiViews" (lowercase 'ui'), NOT "UIViews"
3. Use "components" (NOT "elements")
4. Use "actions" (NOT "steps")
5. All field names must be EXACT as shown above
6. Include at least 2 UI views with components
7. Include at least 1 workflow with actions

Output ONLY valid JSON. No markdown, no explanations.`;

const specResult = await this.executeStage(
  "stage3_spec",
  "App Spec Generation",
  specPrompt,
  AppSpecSchema,
  "stage3_spec"
);
      
      this.streamer.send({ stage: "Stage 3", status: "completed", message: "App Spec generated successfully!", data: specResult });
      
      return specResult;

    } catch (error: any) {
      this.streamer.send({ stage: "Pipeline", status: "failed", message: `Pipeline crashed: ${error.message}` });
      throw error;
    }
  }

  private async executeStage(
    stageKey: any, 
    stageName: string, 
    prompt: string, 
    schema: any, 
    consistencyContext?: string
  ) {
    let attempts = 0;
    const maxAttempts = 2; // 1 initial attempt + 1 repair attempt
    let currentPrompt = prompt;
    let lastRawJson = "";

    while (attempts < maxAttempts) {
      attempts++;
      
      // 1. Call AI Gateway
      const llmResponse = await aiGateway.call(stageKey, {
        messages: [{ role: "user", content: currentPrompt }],
      });
      
      lastRawJson = llmResponse.content;

      // 2. Validate
      const validation = ValidationEngine.validate(
        llmResponse.parsedJson, 
        schema, 
        consistencyContext || stageKey
      );

      if (validation.success) {
  return validation.data;
}

// 🔍 ADD THIS FOR DEBUGGING
console.error("🔴 VALIDATION FAILED - Issues:", JSON.stringify(validation.issues, null, 2));
console.error("🔴 Raw LLM Output:", llmResponse.content);

// 3. Handle Failure (Repair)
if (attempts < maxAttempts) {
  this.streamer.send({ 
    stage: stageName, 
    status: "repairing", 
    message: `Validation failed (${validation.issues.length} issues). Attempting targeted repair...`,
    data: validation.issues
  });

        // Generate targeted repair prompt
        currentPrompt = generateRepairPrompt(lastRawJson, validation.issues, stageName);
      }
    }

    throw new Error(`${stageName} failed after ${maxAttempts} attempts.`);
  }
}