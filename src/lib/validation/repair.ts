import { ValidationIssue } from "@/lib/schemas";

export function generateRepairPrompt(
  originalOutputJson: string,
  issues: ValidationIssue[] | undefined,
  stageContext: string
): string {
  
  // Safety check: if no issues, return the original JSON
  if (!issues || issues.length === 0) {
    return `Please regenerate the JSON for ${stageContext}. The previous output was invalid.`;
  }
  
  const errorList = issues
    .map((issue, i) => {
      const path = issue.path && issue.path.length > 0 ? ` at \`${issue.path.join(".")}\`` : "";
      return `${i + 1}. [${issue.type.toUpperCase()}]${path}: ${issue.message}\n   -> Hint: ${issue.suggestion || "Fix the error based on schema rules."}`;
    })
    .join("\n");

  return `You are a JSON repair expert. The previous AI generated invalid JSON for the ${stageContext}.

Here is the broken JSON:
\`\`\`json
${originalOutputJson}
\`\`\`

Here are the exact validation errors that must be fixed:
${errorList}

INSTRUCTIONS:
1. Fix ONLY the errors listed above.
2. Do not add new features or change the core logic.
3. Output ONLY the corrected JSON. No markdown formatting, no explanations.
`;
}