import { describe, it, expect, beforeEach } from 'bun:test';
import { formatMemory } from './format';
import {
  loadSavedWorkspace,
  saveWorkspace,
  DEFAULT_WORKSPACE,
  WORKSPACE_STORAGE_KEY,
} from './storage';

// In-memory mock for localStorage in non-browser environments
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

const mockStorage = createLocalStorageMock();
(globalThis as unknown as { localStorage: typeof mockStorage }).localStorage = mockStorage;
(globalThis as unknown as { window: unknown }).window = globalThis;

describe('formatMemory', () => {
  it('formats raw numbers to MB', () => {
    expect(formatMemory('4.2')).toBe('4.2 MB');
    expect(formatMemory('12')).toBe('12 MB');
  });

  it('keeps existing unit if already formatted', () => {
    expect(formatMemory('4.2 MB')).toBe('4.2 MB');
    expect(formatMemory('512 KB')).toBe('512 KB');
    expect(formatMemory('1.2 GB')).toBe('1.2 GB');
  });

  it('handles empty or undefined inputs gracefully', () => {
    expect(formatMemory('')).toBe('');
    expect(formatMemory(undefined)).toBe('');
  });
});

describe('storage utility', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('returns DEFAULT_WORKSPACE when localStorage is empty', () => {
    const ws = loadSavedWorkspace();
    expect(ws.activeLanguage).toBe('cpp');
    expect(ws.memoryLimitMb).toBe(256);
    expect(ws.codeDrafts.cpp).toBe(DEFAULT_WORKSPACE.codeDrafts.cpp);
  });

  it('saves and restores workspace state', () => {
    const custom = {
      version: 1,
      activeLanguage: 'rust' as const,
      codeDrafts: {
        cpp: '// Custom C++',
        rust: '// Custom Rust',
      },
      compilerFlagsMap: {
        cpp: ['-O3'],
        rust: ['-O', '-C opt-level=3'],
      },
      input: '42',
      expectedOutput: '84',
      validateOutput: true,
      memoryLimitMb: 512,
      lastSavedAt: Date.now(),
    };

    saveWorkspace(custom);
    const loaded = loadSavedWorkspace();
    expect(loaded.activeLanguage).toBe('rust');
    expect(loaded.codeDrafts.rust).toBe('// Custom Rust');
    expect(loaded.codeDrafts.cpp).toBe('// Custom C++');
    expect(loaded.compilerFlagsMap.rust).toEqual(['-O', '-C opt-level=3']);
    expect(loaded.input).toBe('42');
    expect(loaded.expectedOutput).toBe('84');
    expect(loaded.validateOutput).toBe(true);
    expect(loaded.memoryLimitMb).toBe(512);
  });

  it('recovers gracefully from corrupted JSON in localStorage', () => {
    globalThis.localStorage.setItem(WORKSPACE_STORAGE_KEY, 'invalid json{');
    const ws = loadSavedWorkspace();
    expect(ws.activeLanguage).toBe('cpp');
    expect(ws.memoryLimitMb).toBe(256);
  });
});
