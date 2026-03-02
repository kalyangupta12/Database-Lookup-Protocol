import { DLPError } from '../types/protocol';

interface BlockedPattern {
  pattern: RegExp;
  code: DLPError['code'];
  label: string;
}

const BLOCKED_PATTERNS: BlockedPattern[] = [
  {
    pattern: /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|REPLACE|MERGE|UPSERT)\b/i,
    code: 'WRITE_OPERATION',
    label: 'Write operations are not permitted',
  },
  {
    pattern: /\b(EXEC|EXECUTE|SP_|XP_)\b/i,
    code: 'WRITE_OPERATION',
    label: 'Stored procedure execution is not permitted',
  },
  {
    pattern: /;.+/s,
    code: 'SQL_INJECTION',
    label: 'Multiple statements are not permitted',
  },
  {
    pattern: /--.*$/m,
    code: 'SQL_INJECTION',
    label: 'SQL comments are not permitted',
  },
  {
    pattern: /\/\*/,
    code: 'SQL_INJECTION',
    label: 'Block comments are not permitted',
  },
  {
    pattern: /\bUNION\b/i,
    code: 'SQL_INJECTION',
    label: 'UNION queries are not permitted',
  },
  {
    pattern: /\bINTO\s+OUTFILE\b/i,
    code: 'SQL_INJECTION',
    label: 'INTO OUTFILE is not permitted',
  },
  {
    pattern: /\bLOAD_FILE\s*\(/i,
    code: 'SQL_INJECTION',
    label: 'LOAD_FILE is not permitted',
  },
  {
    pattern: /\bINFORMATION_SCHEMA\b/i,
    code: 'SQL_INJECTION',
    label: 'Direct INFORMATION_SCHEMA access is not permitted',
  },
  {
    pattern: /\bPG_SLEEP\s*\(/i,
    code: 'SQL_INJECTION',
    label: 'Time-based injection functions are not permitted',
  },
  {
    pattern: /\bSLEEP\s*\(/i,
    code: 'SQL_INJECTION',
    label: 'Time-based injection functions are not permitted',
  },
  {
    pattern: /\bBENCHMARK\s*\(/i,
    code: 'SQL_INJECTION',
    label: 'BENCHMARK is not permitted',
  },
  {
    pattern: /0x[0-9a-fA-F]+/,
    code: 'SQL_INJECTION',
    label: 'Hex literals are not permitted',
  },
  {
    pattern: /CHAR\s*\(\s*\d+/i,
    code: 'SQL_INJECTION',
    label: 'CHAR() encoding is not permitted',
  },
];

const REQUIRES_LIMIT = /\bLIMIT\s+\d+/i;

export interface ValidationResult {
  valid: boolean;
  error?: DLPError;
}

export function validateSafeQuery(query: string): ValidationResult {
  const trimmed = query.trim();

  if (!/^SELECT\s/i.test(trimmed)) {
    return {
      valid: false,
      error: { error: 'Only SELECT queries are permitted', code: 'WRITE_OPERATION' },
    };
  }

  for (const { pattern, code, label } of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: { error: label, code } };
    }
  }

  if (!REQUIRES_LIMIT.test(trimmed)) {
    return {
      valid: false,
      error: { error: 'Query must include a LIMIT clause', code: 'MISSING_LIMIT' },
    };
  }

  return { valid: true };
}

export function extractLimit(query: string, maxRows: number): number {
  const match = query.match(/\bLIMIT\s+(\d+)/i);
  if (!match) return maxRows;
  return Math.min(parseInt(match[1], 10), maxRows);
}

export function sanitizeIdentifier(name: string): string {
  if (!/^[a-zA-Z0-9_.\-]+$/.test(name)) {
    throw new Error(`Invalid identifier: "${name}"`);
  }
  return name;
}
