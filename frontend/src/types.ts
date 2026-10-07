export type Language = 'cpp' | 'rust';

export type SnippetType = 'basic' | 'blank' | 'graph';

export type VerdictType =
  | 'Accepted'
  | 'Wrong Answer'
  | 'Time Limit Exceeded'
  | 'Runtime Error'
  | 'Compilation Error'
  | 'Memory Limit Exceeded';

export interface ExecuteRequest {
  language: Language;
  code: string;
  input: string;
  expectedOutput: string;
  validateOutput: boolean;
  compilerFlags: string[];
  memory_limit_mb?: number;
  memoryLimitMb?: number;
}

export interface ExecuteResponse {
  status: 'success' | 'error';
  type: VerdictType;
  output?: string;
  message?: string;
  match?: boolean | null;
  time?: string;
  compileTime?: string;
  memory?: string;
}

export interface HistoryItem extends ExecuteResponse {
  id: string;
  date: string;
  language: Language;
  code: string;
  input: string;
  expectedOutput?: string;
  validateOutput: boolean;
  compilerFlags?: string[];
  memory_limit_mb?: number;
  memoryLimitMb?: number;
}

export type LogType = 'runner' | 'api';
