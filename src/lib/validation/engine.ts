import { z, ZodError, ZodSchema, ZodIssue } from "zod";
import { ValidationIssue, ValidationResult } from "@/lib/schemas";
import { checkConsistency } from "./rules/consistency";

export class ValidationEngine {
  /**
   * Validates data against a Zod schema and runs custom consistency rules.
   */
  static validate<T>(data: unknown, schema: ZodSchema<T>, stageName: string): ValidationResult<T> {
    const issues: ValidationIssue[] = [];

    // 1. Structural & Field Validation (via Zod)
    const result = schema.safeParse(data);
    
    if (!result.success) {
      const zodIssues = this.mapZodErrors(result.error.issues);
      issues.push(...zodIssues);
    }

    // 2. Consistency Validation (Custom Rules)
    // We only run this if the basic structure is somewhat intact to avoid cascading errors
    if (result.success) {
      const consistencyIssues = checkConsistency(result.data, stageName);
      issues.push(...consistencyIssues);
    }

    if (issues.length > 0) {
      return {
        success: false,
        data: result.success ? result.data : undefined,
        issues,
      };
    }

    return {
      success: true,
      data: result.data,
      issues: [],
    };
  }

  /**
   * Maps Zod's nested error paths into our custom ValidationIssue format
   */
  private static mapZodErrors(zodIssues: ZodIssue[]): ValidationIssue[] {
    return zodIssues.map((err) => {
      const path = err.path.map(String);
      const isStructural = err.code === "invalid_type" && (err as any).received === "undefined";
      
      return {
        type: isStructural ? "structural" : "field",
        path,
        message: err.message,
        suggestion: `Fix the field at path '${path.join(".")}'. Expected: ${(err as any).expected || "valid format"}.`,
      };
    });
  }
}