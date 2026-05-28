import { z } from "zod";

// ==========================================
// 1. INTEGRATION REGISTRY (Required 5+)
// ==========================================
export const IntegrationNames = z.enum([
  "slack",
  "stripe",
  "jira",
  "github",
  "gmail",
  "twilio",
  "openai",
]);
export type IntegrationName = z.infer<typeof IntegrationNames>;

// ==========================================
// 2. STAGE 1: APP INTENT
// ==========================================
export const AppIntentSchema = z.object({
  appName: z.string().min(3).max(50),
  description: z.string().min(10),
  coreEntities: z.array(z.string()).min(1),
  primaryActions: z.array(z.string()).min(1),
  requiredIntegrations: z.array(IntegrationNames).optional().default([]),
  targetAudience: z.string().optional(),
});
export type AppIntent = z.infer<typeof AppIntentSchema>;

// ==========================================
// 3. STAGE 2: DATA SCHEMA
// ==========================================
export const FieldType = z.enum([
  "uuid", "string", "text", "integer", "float", "boolean", "timestamp", "json",
]);

export const SchemaFieldSchema = z.object({
  name: z.string(),
  type: FieldType,
  isPrimaryKey: z.boolean().optional().default(false),
  isRequired: z.boolean().optional().default(true),
  references: z.string().optional(), // For Foreign Keys
});

export const TableSchema = z.object({
  name: z.string(),
  fields: z.array(SchemaFieldSchema).min(1),
});

export const RelationshipType = z.enum(["one-to-one", "one-to-many", "many-to-many"]);

export const RelationshipSchema = z.object({
  sourceTable: z.string(),
  targetTable: z.string(),
  type: RelationshipType,
  foreignKey: z.string().optional(),
});

export const DataSchemaSchema = z.object({
  tables: z.array(TableSchema).min(1),
  relationships: z.array(RelationshipSchema).optional().default([]),
});
export type DataSchema = z.infer<typeof DataSchemaSchema>;

// ==========================================
// 4. STAGE 3: APP SPEC
// ==========================================
export const UIComponentSchema = z.object({
  id: z.string(),
  type: z.enum(["Form", "DataTable", "Dashboard", "Button", "Modal"]),
  props: z.record(z.string(),z.any()),
  boundTable: z.string().optional(),
});

export const UIViewSchema = z.object({
  name: z.string(),
  description: z.string(),
  components: z.array(UIComponentSchema),
});

export const WorkflowActionSchema = z.object({
  integration: IntegrationNames,
  operation: z.string(), // e.g., "send_message", "create_charge"
  inputs: z.record(z.string(),z.any()),
});

export const WorkflowSchema = z.object({
  name: z.string(),
  trigger: z.object({
    type: z.enum(["on_create", "on_update", "on_delete", "cron"]),
    sourceTable: z.string(),
  }),
  actions: z.array(WorkflowActionSchema).min(1),
});

export const AppSpecSchema = z.object({
  version: z.string().default("1.0.0"),
  intent: AppIntentSchema,
  schema: DataSchemaSchema,
  uiViews: z.array(UIViewSchema).min(1),
  workflows: z.array(WorkflowSchema).optional().default([]),
});
export type AppSpec = z.infer<typeof AppSpecSchema>;

// ==========================================
// 5. VALIDATION ENGINE TYPES
// ==========================================
export type ValidationIssueType = "structural" | "field" | "consistency";

export interface ValidationIssue {
  type: ValidationIssueType;
  path: string[]; // JSON path to the error
  message: string;
  suggestion?: string; // Hint for the Repair Engine
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  issues: ValidationIssue[];
}