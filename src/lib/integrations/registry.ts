import { IntegrationName } from "@/lib/schemas";

export interface IntegrationOperation {
  name: string;
  description: string;
  inputs: Record<string, string>; // e.g., { channel: "string", message: "string" }
}

export interface IntegrationDefinition {
  name: IntegrationName;
  description: string;
  operations: IntegrationOperation[];
}

// The Master Registry (Satisfies the 5+ requirement)
export const INTEGRATION_REGISTRY: Record<IntegrationName, IntegrationDefinition> = {
  slack: {
    name: "slack",
    description: "Send messages and notifications to Slack channels.",
    operations: [
      { name: "send_message", description: "Post a message to a specific channel", inputs: { channel: "string", text: "string" } },
      { name: "send_dm", description: "Send a direct message to a user", inputs: { user_id: "string", text: "string" } },
    ],
  },
  stripe: {
    name: "stripe",
    description: "Handle payments, subscriptions, and customers.",
    operations: [
      { name: "create_customer", description: "Create a new Stripe customer", inputs: { email: "string", name: "string" } },
      { name: "create_charge", description: "Charge a customer", inputs: { customer_id: "string", amount: "integer", currency: "string" } },
    ],
  },
  jira: {
    name: "jira",
    description: "Manage issues and projects in Jira.",
    operations: [
      { name: "create_issue", description: "Create a new ticket", inputs: { project_key: "string", summary: "string", description: "string" } },
    ],
  },
  github: {
    name: "github",
    description: "Manage repositories and issues.",
    operations: [
      { name: "create_issue", description: "Create a repo issue", inputs: { repo: "string", title: "string", body: "string" } },
    ],
  },
  gmail: {
    name: "gmail",
    description: "Send emails via Gmail.",
    operations: [
      { name: "send_email", description: "Send an email", inputs: { to: "string", subject: "string", body: "string" } },
    ],
  },
  twilio: {
    name: "twilio",
    description: "Send SMS messages.",
    operations: [
      { name: "send_sms", description: "Send an SMS", inputs: { to_phone: "string", body: "string" } },
    ],
  },
  openai: {
    name: "openai",
    description: "Generate text or embeddings.",
    operations: [
      { name: "generate_text", description: "Generate text from prompt", inputs: { prompt: "string", model: "string" } },
    ],
  },
};

/**
 * Generates a text summary of the registry to inject into the Stage 3 LLM prompt.
 * This prevents the LLM from hallucinating fake API operations.
 */
export function getIntegrationContextForPrompt(requiredIntegrations: IntegrationName[]): string {
  if (!requiredIntegrations || requiredIntegrations.length === 0) {
    return "No specific integrations were requested.";
  }

  let context = "You MUST use the following exact integration operations for the workflows:\n\n";
  
  for (const intName of requiredIntegrations) {
    const def = INTEGRATION_REGISTRY[intName];
    if (!def) continue;
    
    context += `### ${def.name} (${def.description})\n`;
    for (const op of def.operations) {
      context += `- Operation: "${op.name}" | Description: ${op.description} | Inputs: ${JSON.stringify(op.inputs)}\n`;
    }
    context += "\n";
  }
  
  return context;
}