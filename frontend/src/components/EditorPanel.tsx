import React, { useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import {
  Box,
  Group,
  Select,
  Checkbox,
  Popover,
  Button,
  ActionIcon,
  Tooltip,
  Badge,
  Text,
  Stack,
  Loader,
  useComputedColorScheme,
} from '@mantine/core';
import {
  IconCode,
  IconCopy,
  IconRotateDot,
  IconSettings,
  IconCheck,
  IconTrash,
  IconDeviceFloppy,
  IconBox,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { Language, SnippetType } from '../types';
import { COMPILER_FLAGS_OPTIONS } from '../constants/snippets';

interface EditorPanelProps {
  language: Language;
  code: string;
  onChange: (value: string) => void;
  compilerFlags: string[];
  onCompilerFlagsChange: (flags: string[]) => void;
  onSnippetSelect: (snippet: SnippetType) => void;
  selectedSnippet: SnippetType;
  onRun: () => void;
  memoryLimitMb: number;
  onMemoryLimitChange: (limit: number) => void;
  saveStatus: 'saved' | 'saving';
  lastSavedTime: string | null;
  onResetTemplate: () => void;
}

const MEMORY_LIMIT_PRESETS = [
  { value: '128', label: '128 MB' },
  { value: '256', label: '256 MB (Default)' },
  { value: '512', label: '512 MB' },
  { value: '1024', label: '1024 MB (1 GB)' },
];

export const EditorPanel: React.FC<EditorPanelProps> = ({
  language,
  code,
  onChange,
  compilerFlags,
  onCompilerFlagsChange,
  onSnippetSelect,
  selectedSnippet,
  onRun,
  memoryLimitMb,
  onMemoryLimitChange,
  saveStatus,
  lastSavedTime,
  onResetTemplate,
}) => {
  const computedColorScheme = useComputedColorScheme('dark', { getInitialValueInEffect: true });
  const isDark = computedColorScheme === 'dark';

  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    // Bind Ctrl+Enter and Cmd+Enter to run code inside Monaco
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRunRef.current();
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      notifications.show({
        title: 'Copied',
        message: 'Code copied to clipboard',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } catch {
      notifications.show({
        title: 'Failed',
        message: 'Could not copy to clipboard',
        color: 'red',
      });
    }
  };

  const handleClear = () => {
    onChange('');
    notifications.show({
      title: 'Editor Cleared',
      message: 'Code has been emptied',
      color: 'gray',
    });
  };

  const availableFlags = COMPILER_FLAGS_OPTIONS[language];

  const toggleFlag = (flag: string) => {
    if (compilerFlags.includes(flag)) {
      onCompilerFlagsChange(compilerFlags.filter((f) => f !== flag));
    } else {
      onCompilerFlagsChange([...compilerFlags, flag]);
    }
  };

  const fileName = language === 'cpp' ? 'main.cpp' : 'main.rs';

  const memorySelectOptions = MEMORY_LIMIT_PRESETS.some(
    (preset) => preset.value === String(memoryLimitMb)
  )
    ? MEMORY_LIMIT_PRESETS
    : [
        ...MEMORY_LIMIT_PRESETS,
        { value: String(memoryLimitMb), label: `${memoryLimitMb} MB` },
      ];

  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: isDark ? '#14141a' : '#f8f9fa',
        borderRadius: '8px',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
        overflow: 'hidden',
      }}
    >
      {/* Editor Toolbar */}
      <Box
        px="sm"
        py="xs"
        style={{
          borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
          backgroundColor: isDark ? 'rgba(24, 24, 32, 0.7)' : 'rgba(241, 243, 245, 0.7)',
        }}
      >
        <Group justify="space-between" align="center" wrap="wrap" gap="xs">
          {/* File Tab, Snippet Selector & Auto-save Status */}
          <Group gap="xs" align="center" wrap="wrap">
            <Badge
              variant="filled"
              color={isDark ? 'dark.5' : 'gray.3'}
              c={isDark ? 'gray.2' : 'dark.7'}
              leftSection={<IconCode size={14} />}
              radius="sm"
            >
              {fileName}
            </Badge>

            <Select
              size="xs"
              value={selectedSnippet}
              onChange={(val) => {
                if (val) onSnippetSelect(val as SnippetType);
              }}
              data={[
                { value: 'basic', label: 'Standard Template' },
                { value: 'blank', label: 'Blank File' },
                { value: 'graph', label: 'Graph DFS' },
              ]}
              w={155}
              placeholder="Snippet"
              comboboxProps={{ shadow: 'md', transitionProps: { transition: 'pop', duration: 150 } }}
            />

            {/* Visual Auto-Save Indicator */}
            <Tooltip
              label={
                saveStatus === 'saving'
                  ? 'Saving workspace draft...'
                  : lastSavedTime
                    ? `Auto-saved locally at ${lastSavedTime}`
                    : 'Auto-saved locally'
              }
              withArrow
            >
              <Badge
                size="xs"
                variant="light"
                color={saveStatus === 'saving' ? 'yellow' : 'teal'}
                leftSection={
                  saveStatus === 'saving' ? (
                    <Loader size={10} color="yellow" />
                  ) : (
                    <IconDeviceFloppy size={12} />
                  )
                }
                style={{ textTransform: 'none', fontWeight: 500 }}
              >
                {saveStatus === 'saving' ? 'Saving...' : 'Auto-saved'}
              </Badge>
            </Tooltip>
          </Group>

          {/* Memory Limit, Compiler Flags & Actions */}
          <Group gap="xs" align="center" wrap="wrap">
            {/* Memory Limit Preset Selector */}
            <Tooltip label="Max Execution Memory Limit (MLE Threshold)" withArrow>
              <Select
                size="xs"
                w={140}
                value={String(memoryLimitMb)}
                onChange={(val) => {
                  if (val) onMemoryLimitChange(Number(val));
                }}
                data={memorySelectOptions}
                leftSection={<IconBox size={14} />}
                allowDeselect={false}
                aria-label="Memory Limit"
                comboboxProps={{ shadow: 'md', transitionProps: { transition: 'pop', duration: 150 } }}
              />
            </Tooltip>

            {/* Compiler Flags Popover */}
            <Popover width={280} position="bottom-end" shadow="md" withArrow>
              <Popover.Target>
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  leftSection={<IconSettings size={15} />}
                  rightSection={
                    compilerFlags.length > 0 && (
                      <Badge size="xs" variant="filled" color="indigo" circle>
                        {compilerFlags.length}
                      </Badge>
                    )
                  }
                >
                  Flags
                </Button>
              </Popover.Target>
              <Popover.Dropdown p="sm">
                <Text fw={600} size="xs" mb="xs">
                  Compiler Flags ({language.toUpperCase()})
                </Text>
                <Stack gap="xs">
                  {availableFlags.map((flag) => {
                    const checked = compilerFlags.includes(flag.value);
                    return (
                      <Checkbox
                        key={flag.value}
                        size="xs"
                        label={
                          <div>
                            <Text size="xs" fw={500}>
                              {flag.label}
                            </Text>
                            <Text size="11px" c="dimmed">
                              {flag.description}
                            </Text>
                          </div>
                        }
                        checked={checked}
                        onChange={() => toggleFlag(flag.value)}
                      />
                    );
                  })}
                </Stack>
              </Popover.Dropdown>
            </Popover>

            {/* Reset to Default Template Button */}
            <Tooltip label="Discard current draft and reload boilerplate template" withArrow>
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                leftSection={<IconRotateDot size={14} />}
                onClick={onResetTemplate}
              >
                Reset Template
              </Button>
            </Tooltip>

            {/* Quick Actions */}
            <Tooltip label="Copy Code" withArrow>
              <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleCopy}>
                <IconCopy size={16} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Clear Editor" withArrow>
              <ActionIcon variant="subtle" color="red" size="sm" onClick={handleClear}>
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Box>

      {/* Active Flags Badges (if any active) */}
      {compilerFlags.length > 0 && (
        <Box
          px="sm"
          py={4}
          style={{
            borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
            backgroundColor: isDark ? 'rgba(15, 15, 22, 0.5)' : '#f1f3f5',
          }}
        >
          <Group gap={6} align="center">
            <Text size="11px" c="dimmed" fw={500}>
              Active flags:
            </Text>
            {compilerFlags.map((flag) => (
              <Badge
                key={flag}
                size="xs"
                variant="outline"
                color="indigo"
                style={{ textTransform: 'none', cursor: 'pointer' }}
                onClick={() => toggleFlag(flag)}
              >
                {flag} ×
              </Badge>
            ))}
          </Group>
        </Box>
      )}

      {/* Monaco Editor Container */}
      <Box style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Editor
          height="100%"
          language={language === 'rust' ? 'rust' : 'cpp'}
          theme={isDark ? 'vs-dark' : 'light'}
          value={code}
          onChange={(val) => onChange(val || '')}
          onMount={handleEditorDidMount}
          options={{
            fontSize: 14,
            fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
            fontLigatures: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            bracketPairColorization: { enabled: true },
            padding: { top: 12, bottom: 12 },
            wordWrap: 'on',
            cursorBlinking: 'smooth',
            smoothScrolling: true,
          }}
        />
      </Box>
    </Box>
  );
};
