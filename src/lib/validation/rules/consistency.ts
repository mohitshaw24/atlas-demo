import { ValidationIssue, DataSchema, AppSpec } from "@/lib/schemas";

export function checkConsistency(data: any, stageName: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (stageName === "stage2_schema") {
    issues.push(...checkSchemaConsistency(data as DataSchema));
  } 
  
  if (stageName === "stage3_spec") {
    // AppSpec contains the schema, so we check it again here, plus UI/Workflow consistency
    issues.push(...checkSchemaConsistency(data.schema));
    issues.push(...checkAppSpecConsistency(data as AppSpec));
  }

  return issues;
}

function checkSchemaConsistency(schema: DataSchema): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!schema || !schema.tables) return issues;

  const tableNames = new Set(schema.tables.map((t) => t.name));

  // Check relationships point to real tables
  schema.relationships?.forEach((rel, index) => {
    if (!tableNames.has(rel.sourceTable)) {
      issues.push({
        type: "consistency",
        path: ["relationships", String(index), "sourceTable"],
        message: `Relationship references non-existent source table: ${rel.sourceTable}`,
        suggestion: `Change sourceTable to one of: ${Array.from(tableNames).join(", ")}`,
      });
    }
    if (!tableNames.has(rel.targetTable)) {
      issues.push({
        type: "consistency",
        path: ["relationships", String(index), "targetTable"],
        message: `Relationship references non-existent target table: ${rel.targetTable}`,
        suggestion: `Change targetTable to one of: ${Array.from(tableNames).join(", ")}`,
      });
    }
  });

  return issues;
}

function checkAppSpecConsistency(spec: AppSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!spec || !spec.uiViews || !spec.schema?.tables) return issues;

  const tableNames = new Set(spec.schema.tables.map((t) => t.name));

  // Check if UI components are bound to real tables
  spec.uiViews.forEach((view, vIndex) => {
    view.components.forEach((comp, cIndex) => {
      if (comp.boundTable && !tableNames.has(comp.boundTable)) {
        issues.push({
          type: "consistency",
          path: ["uiViews", String(vIndex), "components", String(cIndex), "boundTable"],
          message: `UI Component bound to non-existent table: ${comp.boundTable}`,
          suggestion: `Remove boundTable or change to one of: ${Array.from(tableNames).join(", ")}`,
        });
      }
    });
  });

  return issues;
}