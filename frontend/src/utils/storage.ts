import { Language } from '../types';
import {
  SNIPPETS,
  DEFAULT_INPUT,
  DEFAULT_EXPECTED_OUTPUT,
} from '../constants/snippets';

export const WORKSPACE_STORAGE_KEY = 'bun_runner_workspace_draft_v1';

export interface SavedWorkspace {
  version: number;
  activeLanguage: Language;
  codeDrafts: Record<Language, string>;
  compilerFlagsMap: Record<Language, string[]>;
  input: string;
  expectedOutput: string;
  validateOutput: boolean;
  memoryLimitMb: number;
  lastSavedAt?: number;
}

export const DEFAULT_WORKSPACE: SavedWorkspace = {
  version: 1,
  activeLanguage: 'cpp',
  codeDrafts: {
    cpp: SNIPPETS.cpp.basic,
    rust: SNIPPETS.rust.basic,
  },
  compilerFlagsMap: {
    cpp: ['-O3', '-std=c++20'],
    rust: ['-O'],
  },
  input: DEFAULT_INPUT,
  expectedOutput: DEFAULT_EXPECTED_OUTPUT,
  validateOutput: false,
  memoryLimitMb: 256,
};

/**
 * Safely load saved workspace state from localStorage on initial mount.
 * Handles corrupt data or older formats with clean fallbacks.
 */
export function loadSavedWorkspace(): SavedWorkspace {
  if (typeof window === 'undefined') {
    return DEFAULT_WORKSPACE;
  }

  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return DEFAULT_WORKSPACE;

    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return DEFAULT_WORKSPACE;

    const activeLanguage: Language =
      data.activeLanguage === 'rust' || data.language === 'rust' ? 'rust' : 'cpp';

    const codeDrafts: Record<Language, string> = {
      cpp:
        typeof data.codeDrafts?.cpp === 'string'
          ? data.codeDrafts.cpp
          : typeof data.code === 'string' && activeLanguage === 'cpp'
            ? data.code
            : DEFAULT_WORKSPACE.codeDrafts.cpp,
      rust:
        typeof data.codeDrafts?.rust === 'string'
          ? data.codeDrafts.rust
          : typeof data.code === 'string' && activeLanguage === 'rust'
            ? data.code
            : DEFAULT_WORKSPACE.codeDrafts.rust,
    };

    const compilerFlagsMap: Record<Language, string[]> = {
      cpp:
        Array.isArray(data.compilerFlagsMap?.cpp)
          ? data.compilerFlagsMap.cpp
          : Array.isArray(data.compilerFlags) && activeLanguage === 'cpp'
            ? data.compilerFlags
            : DEFAULT_WORKSPACE.compilerFlagsMap.cpp,
      rust:
        Array.isArray(data.compilerFlagsMap?.rust)
          ? data.compilerFlagsMap.rust
          : Array.isArray(data.compilerFlags) && activeLanguage === 'rust'
            ? data.compilerFlags
            : DEFAULT_WORKSPACE.compilerFlagsMap.rust,
    };

    const input =
      typeof data.input === 'string' ? data.input : DEFAULT_WORKSPACE.input;

    const expectedOutput =
      typeof data.expectedOutput === 'string'
        ? data.expectedOutput
        : DEFAULT_WORKSPACE.expectedOutput;

    const validateOutput =
      typeof data.validateOutput === 'boolean'
        ? data.validateOutput
        : DEFAULT_WORKSPACE.validateOutput;

    const memoryLimitMb =
      typeof data.memoryLimitMb === 'number'
        ? data.memoryLimitMb
        : typeof data.memory_limit_mb === 'number'
          ? data.memory_limit_mb
          : DEFAULT_WORKSPACE.memoryLimitMb;

    return {
      version: 1,
      activeLanguage,
      codeDrafts,
      compilerFlagsMap,
      input,
      expectedOutput,
      validateOutput,
      memoryLimitMb,
      lastSavedAt: typeof data.lastSavedAt === 'number' ? data.lastSavedAt : undefined,
    };
  } catch (err) {
    console.warn('Failed to parse saved workspace draft from localStorage:', err);
    return DEFAULT_WORKSPACE;
  }
}

/**
 * Safely save workspace state to localStorage.
 */
export function saveWorkspace(workspace: SavedWorkspace): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
  } catch (err) {
    console.warn('Failed to save workspace draft to localStorage:', err);
  }
}
