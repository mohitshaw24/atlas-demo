// scripts/eval.ts
import { writeFile } from "node:fs/promises";

const BASE_URL = "http://localhost:3000";

const EVALUATION_PROMPTS = [
  "A task management app for remote teams with Slack notifications.",
  "An e-commerce platform for handmade goods with Stripe payments.",
  "A fitness tracking app that syncs with wearables.",
  "A customer support ticketing system with Jira integration.",
  "A content calendar for social media managers.",
  "A booking system for consultants with Twilio SMS.",
  "A learning management system with progress tracking.",
  "", // Empty prompt
  "Build me an app.", // Extremely vague
  "I need an app that does everything for everyone everywhere all the time.", // Impossible scope
  "Create a blockchain-based quantum AI social network for cats.", // Fantasy
  "Make an app that violates GDPR.", // Malicious
];

interface EvalResult {
  prompt: string;
  success: boolean;
  stagesCompleted: string[];
  validationIssues: number;
  repairAttempts: number;
  latencyMs: number;
  error?: string;
  timestamp: string;
}

async function runEvaluation() {
  console.log("🚀 Starting OneAtlas Evaluation (12 prompts)...\n");
  
  const results: EvalResult[] = [];

  for (let i = 0; i < EVALUATION_PROMPTS.length; i++) {
    const prompt = EVALUATION_PROMPTS[i];
    const start = Date.now();
    console.log(`[${i + 1}/12] Testing: "${prompt.slice(0, 45)}${prompt.length > 45 ? '...' : ''}"`);

    try {
      const response = await fetch(`${BASE_URL}/api/pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const text = await response.text();
      const events = text.split("\n\n").filter(Boolean);
      
      let success = false;
      const stages: string[] = [];
      let validationIssues = 0;
      let repairAttempts = 0;

      for (const line of events) {
        if (line.startsWith("data: ")) {
          const event = JSON.parse(line.replace("data: ", ""));
          if (event.status === "completed") stages.push(event.stage);
          if (event.status === "repairing") { validationIssues++; repairAttempts++; }
          if (event.stage === "System" && event.status === "completed") success = true;
        }
      }

      results.push({
        prompt,
        success,
        stagesCompleted: [...new Set(stages)],
        validationIssues,
        repairAttempts,
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      });

      console.log(`  ${success ? "✅" : "❌"} Success | Time: ${Date.now() - start}ms\n`);
    } catch (error: any) {
      results.push({
        prompt,
        success: false,
        stagesCompleted: [],
        validationIssues: 0,
        repairAttempts: 0,
        error: error.message,
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      });
      console.log(`  ❌ Failed: ${error.message}\n`);
    }
  }

  const report = {
    evaluationMetadata: {
      totalPrompts: EVALUATION_PROMPTS.length,
      successfulRuns: results.filter(r => r.success).length,
      failedRuns: results.filter(r => !r.success).length,
      averageLatencyMs: Math.round(results.reduce((acc, r) => acc + r.latencyMs, 0) / results.length),
      completedAt: new Date().toISOString(),
    },
    results,
  };

  await writeFile("evaluation-log.json", JSON.stringify(report, null, 2));
  console.log("📊 Evaluation Complete!");
  console.log(`✅ Successful: ${report.evaluationMetadata.successfulRuns}/${report.evaluationMetadata.totalPrompts}`);
  console.log(`📄 Report saved to: evaluation-log.json`);
}

runEvaluation().catch(console.error);