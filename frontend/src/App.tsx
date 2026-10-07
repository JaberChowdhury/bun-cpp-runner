import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Tabs,
  Badge,
  useComputedColorScheme,
} from '@mantine/core';
import {
  IconTerminal2,
  IconHistory,
  IconFileText,
  IconCheck,
  IconX,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

import { Header } from './components/Header';
import { EditorPanel } from './components/EditorPanel';
import { OutputPanel } from './components/OutputPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { LogsPanel } from './components/LogsPanel';

import {
  Language,
  SnippetType,
  ExecuteRequest,
  ExecuteResponse,
  HistoryItem,
} from './types';
import { SNIPPETS } from './constants/snippets';
import {
  loadSavedWorkspace,
  saveWorkspace,
  SavedWorkspace,
} from './utils/storage';

export const App: React.FC = () => {
  const computedColorScheme = useComputedColorScheme('dark', { getInitialValueInEffect: true });
  const isDark = computedColorScheme === 'dark';

  // Load initial workspace state from localStorage (synchronous to prevent flash)
  const [initialWorkspace] = useState<SavedWorkspace>(() => loadSavedWorkspace());

  // Workspace States
  const [language, setLanguage] = useState<Language>(initialWorkspace.activeLanguage);
  const [codeDrafts, setCodeDrafts] = useState<Record<Language, string>>(
    initialWorkspace.codeDrafts
  );
  const [compilerFlagsMap, setCompilerFlagsMap] = useState<Record<Language, string[]>>(
    initialWorkspace.compilerFlagsMap
  );
  const [input, setInput] = useState<string>(initialWorkspace.input);
  const [validateOutput, setValidateOutput] = useState<boolean>(
    initialWorkspace.validateOutput
  );
  const [expectedOutput, setExpectedOutput] = useState<string>(
    initialWorkspace.expectedOutput
  );
  const [memoryLimitMb, setMemoryLimitMb] = useState<number>(
    initialWorkspace.memoryLimitMb
  );

  const [snippet, setSnippet] = useState<SnippetType>('basic');

  // Auto-Save Status States
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  // Execution States
  const [result, setResult] = useState<ExecuteResponse | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // History States
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<string | null>('io');

  // Keep a ref to handleRun for keyboard shortcut listeners
  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;

  // Track initial mount so we don't save immediately on mount
  const isFirstMount = useRef(true);

  // Debounced Auto-Save (~500ms) to localStorage
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    setSaveStatus('saving');

    const timer = setTimeout(() => {
      saveWorkspace({
        version: 1,
        activeLanguage: language,
        codeDrafts,
        compilerFlagsMap,
        input,
        expectedOutput,
        validateOutput,
        memoryLimitMb,
        lastSavedAt: Date.now(),
      });
      setSaveStatus('saved');
      setLastSavedTime(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    }, 500);

    return () => clearTimeout(timer);
  }, [
    language,
    codeDrafts,
    compilerFlagsMap,
    input,
    expectedOutput,
    validateOutput,
    memoryLimitMb,
  ]);

  // Guaranteed save on browser tab close / unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveWorkspace({
        version: 1,
        activeLanguage: language,
        codeDrafts,
        compilerFlagsMap,
        input,
        expectedOutput,
        validateOutput,
        memoryLimitMb,
        lastSavedAt: Date.now(),
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [
    language,
    codeDrafts,
    compilerFlagsMap,
    input,
    expectedOutput,
    validateOutput,
    memoryLimitMb,
  ]);

  // Fetch History
  const fetchHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setHistory(data);
        }
      }
    } catch {
      // Ignore background history fetch errors
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Language Change Handler: keeps previous language's code draft intact!
  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang);
  };

  // Code change in current active language
  const handleCodeChange = (newCode: string) => {
    setCodeDrafts((prev) => ({
      ...prev,
      [language]: newCode,
    }));
  };

  // Compiler Flags change in current active language
  const handleCompilerFlagsChange = (newFlags: string[]) => {
    setCompilerFlagsMap((prev) => ({
      ...prev,
      [language]: newFlags,
    }));
  };

  // Snippet change handler
  const handleSnippetSelect = (newSnippet: SnippetType) => {
    setSnippet(newSnippet);
    setCodeDrafts((prev) => ({
      ...prev,
      [language]: SNIPPETS[language][newSnippet],
    }));
  };

  // Reset to Default Template: discards current language draft and reloads boilerplate
  const handleResetTemplate = () => {
    const defaultTemplate = SNIPPETS[language][snippet] || SNIPPETS[language].basic;
    setCodeDrafts((prev) => ({
      ...prev,
      [language]: defaultTemplate,
    }));

    notifications.show({
      title: 'Template Reset',
      message: `Discarded ${language.toUpperCase()} draft and restored boilerplate template.`,
      color: 'blue',
      icon: <IconAlertTriangle size={16} />,
    });
  };

  // Current language values
  const currentCode = codeDrafts[language] || '';
  const currentCompilerFlags = compilerFlagsMap[language] || [];

  // Run Code
  const handleRun = useCallback(async () => {
    if (isRunningRef.current) return;

    if (!currentCode.trim()) {
      notifications.show({
        title: 'Empty Code',
        message: 'Please write or select code before running.',
        color: 'yellow',
      });
      return;
    }

    setIsRunning(true);
    // Switch to I/O tab so user immediately sees execution state
    setActiveTab('io');

    const payload: ExecuteRequest = {
      language,
      code: currentCode,
      input,
      validateOutput,
      expectedOutput,
      compilerFlags: currentCompilerFlags,
      memory_limit_mb: memoryLimitMb,
      memoryLimitMb: memoryLimitMb,
    };

    try {
      const response = await fetch('/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data: ExecuteResponse = await response.json();
      setResult(data);

      const isSuccess = data.status === 'success' && (!validateOutput || data.match);

      notifications.show({
        title: data.type || (isSuccess ? 'Success' : 'Execution Failed'),
        message: isSuccess
          ? `Finished in ${data.time || 0}ms (Comp: ${data.compileTime || 0}ms${
              data.memory ? `, Mem: ${data.memory}` : ''
            })`
          : data.message || `Verdict: ${data.type}`,
        color: isSuccess
          ? 'green'
          : data.type === 'Time Limit Exceeded'
            ? 'yellow'
            : data.type === 'Memory Limit Exceeded'
              ? 'orange'
              : 'red',
        icon: isSuccess ? (
          <IconCheck size={16} />
        ) : data.type === 'Time Limit Exceeded' || data.type === 'Memory Limit Exceeded' ? (
          <IconAlertTriangle size={16} />
        ) : (
          <IconX size={16} />
        ),
      });

      // Update history list
      fetchHistory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown server error';
      notifications.show({
        title: 'Execution Error',
        message: `Could not reach backend runner: ${msg}`,
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setIsRunning(false);
    }
  }, [
    currentCode,
    language,
    input,
    validateOutput,
    expectedOutput,
    currentCompilerFlags,
    memoryLimitMb,
    fetchHistory,
  ]);

  // Global Keyboard Shortcut: Ctrl+Enter / Cmd+Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRun]);

  // Restore past run from history
  const handleRestoreHistory = (item: HistoryItem) => {
    const itemLang = item.language || language;
    setLanguage(itemLang);

    if (item.code) {
      setCodeDrafts((prev) => ({
        ...prev,
        [itemLang]: item.code,
      }));
    }
    if (item.input !== undefined) {
      setInput(item.input);
    }
    if (item.expectedOutput !== undefined) {
      setExpectedOutput(item.expectedOutput);
    }
    if (item.validateOutput !== undefined) {
      setValidateOutput(item.validateOutput);
    }
    if (item.compilerFlags && Array.isArray(item.compilerFlags)) {
      setCompilerFlagsMap((prev) => ({
        ...prev,
        [itemLang]: item.compilerFlags || [],
      }));
    }
    if (item.memory_limit_mb !== undefined) {
      setMemoryLimitMb(item.memory_limit_mb);
    } else if (item.memoryLimitMb !== undefined) {
      setMemoryLimitMb(item.memoryLimitMb);
    }

    setResult(item);
    setActiveTab('io');

    notifications.show({
      title: 'Run Restored',
      message: `Restored session from ${item.date} (${item.type})`,
      color: 'indigo',
    });
  };

  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        backgroundColor: isDark ? '#0d0d12' : '#f1f3f5',
        overflow: 'hidden',
      }}
    >
      {/* Top Header */}
      <Header
        language={language}
        onLanguageChange={handleLanguageChange}
        onRun={handleRun}
        isRunning={isRunning}
      />

      {/* Main Split Workspace */}
      <Box p="sm" className="workspace-grid">
        {/* Left Side: Monaco Code Editor */}
        <Box style={{ height: '100%', minHeight: 0 }}>
          <EditorPanel
            language={language}
            code={currentCode}
            onChange={handleCodeChange}
            compilerFlags={currentCompilerFlags}
            onCompilerFlagsChange={handleCompilerFlagsChange}
            onSnippetSelect={handleSnippetSelect}
            selectedSnippet={snippet}
            onRun={handleRun}
            memoryLimitMb={memoryLimitMb}
            onMemoryLimitChange={setMemoryLimitMb}
            saveStatus={saveStatus}
            lastSavedTime={lastSavedTime}
            onResetTemplate={handleResetTemplate}
          />
        </Box>

        {/* Right Side: Tabbed Interface (I/O & Verdict, History, Server Logs) */}
        <Box
          style={{
            height: '100%',
            minHeight: 0,
            backgroundColor: isDark ? '#14141a' : '#ffffff',
            borderRadius: '8px',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Tabs
            value={activeTab}
            onChange={setActiveTab}
            style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
          >
            {/* Tab Navigation */}
            <Tabs.List
              style={{
                backgroundColor: isDark ? 'rgba(24, 24, 32, 0.7)' : 'rgba(241, 243, 245, 0.7)',
                padding: '4px 8px 0',
                borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
              }}
            >
              <Tabs.Tab
                value="io"
                leftSection={<IconTerminal2 size={16} />}
                rightSection={
                  result && (
                    <Badge
                      size="xs"
                      color={
                        result.type === 'Accepted' ||
                        (result.status === 'success' && result.match !== false)
                          ? 'teal'
                          : result.type === 'Time Limit Exceeded'
                            ? 'yellow'
                            : result.type === 'Memory Limit Exceeded'
                              ? 'orange'
                              : 'red'
                      }
                      variant="filled"
                    >
                      {result.type}
                    </Badge>
                  )
                }
              >
                I/O & Results
              </Tabs.Tab>

              <Tabs.Tab
                value="history"
                leftSection={<IconHistory size={16} />}
                rightSection={
                  history.length > 0 && (
                    <Badge size="xs" variant="light" color="indigo" circle>
                      {history.length}
                    </Badge>
                  )
                }
              >
                History
              </Tabs.Tab>

              <Tabs.Tab value="logs" leftSection={<IconFileText size={16} />}>
                Server Logs
              </Tabs.Tab>
            </Tabs.List>

            {/* Panel 1: I/O & Results */}
            <Tabs.Panel value="io" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <OutputPanel
                input={input}
                onInputChange={setInput}
                validateOutput={validateOutput}
                onValidateOutputChange={setValidateOutput}
                expectedOutput={expectedOutput}
                onExpectedOutputChange={setExpectedOutput}
                result={result}
                isRunning={isRunning}
                onClearInput={() => setInput('')}
              />
            </Tabs.Panel>

            {/* Panel 2: Past Runs History */}
            <Tabs.Panel value="history" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <HistoryPanel
                history={history}
                isLoading={isHistoryLoading}
                onRefresh={fetchHistory}
                onRestore={handleRestoreHistory}
              />
            </Tabs.Panel>

            {/* Panel 3: Server Logs */}
            <Tabs.Panel value="logs" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <LogsPanel />
            </Tabs.Panel>
          </Tabs>
        </Box>
      </Box>
    </Box>
  );
};

export default App;
