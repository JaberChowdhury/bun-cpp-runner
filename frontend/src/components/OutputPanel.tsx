import React from 'react';
import Editor from '@monaco-editor/react';
import {
  Box,
  Stack,
  Switch,
  Badge,
  Text,
  Group,
  Alert,
  ActionIcon,
  Tooltip,
  Paper,
  Loader,
  useComputedColorScheme,
  ScrollArea,
} from '@mantine/core';
import {
  IconCheck,
  IconX,
  IconClock,
  IconAlertTriangle,
  IconBug,
  IconCopy,
  IconTrash,
  IconBolt,
  IconHammer,
  IconArrowsDiff,
  IconBox,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { ExecuteResponse, VerdictType } from '../types';
import { formatMemory } from '../utils/format';

interface OutputPanelProps {
  input: string;
  onInputChange: (val: string) => void;
  validateOutput: boolean;
  onValidateOutputChange: (val: boolean) => void;
  expectedOutput: string;
  onExpectedOutputChange: (val: string) => void;
  result: ExecuteResponse | null;
  isRunning: boolean;
  onClearInput: () => void;
}

export const OutputPanel: React.FC<OutputPanelProps> = ({
  input,
  onInputChange,
  validateOutput,
  onValidateOutputChange,
  expectedOutput,
  onExpectedOutputChange,
  result,
  isRunning,
  onClearInput,
}) => {
  const computedColorScheme = useComputedColorScheme('dark', { getInitialValueInEffect: true });
  const isDark = computedColorScheme === 'dark';

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notifications.show({
        title: 'Copied',
        message: `${label} copied to clipboard`,
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

  const getVerdictDetails = (type: VerdictType, status: string, match?: boolean | null) => {
    switch (type) {
      case 'Accepted':
        return {
          color: 'teal',
          icon: <IconCheck size={18} />,
          title: 'Accepted',
          description: match ? 'Output matches expected output perfectly.' : 'Execution completed successfully.',
        };
      case 'Wrong Answer':
        return {
          color: 'red',
          icon: <IconX size={18} />,
          title: 'Wrong Answer',
          description: 'Actual output does not match expected output.',
        };
      case 'Time Limit Exceeded':
        return {
          color: 'yellow',
          icon: <IconClock size={18} />,
          title: 'Time Limit Exceeded',
          description: 'Program execution timed out (> 3000ms limit).',
        };
      case 'Memory Limit Exceeded':
        return {
          color: 'orange',
          icon: <IconAlertTriangle size={18} />,
          title: 'Memory Limit Exceeded',
          description: 'Program execution exceeded configured memory limit (MLE). Process terminated.',
        };
      case 'Compilation Error':
        return {
          color: 'red',
          icon: <IconAlertTriangle size={18} />,
          title: 'Compilation Error',
          description: 'Compiler failed to build executable.',
        };
      case 'Runtime Error':
        return {
          color: 'red',
          icon: <IconBug size={18} />,
          title: 'Runtime Error',
          description: 'Program terminated with non-zero exit code or crashed.',
        };
      default:
        return {
          color: status === 'success' ? 'teal' : 'red',
          icon: status === 'success' ? <IconCheck size={18} /> : <IconAlertTriangle size={18} />,
          title: type || 'Finished',
          description: '',
        };
    }
  };

  return (
    <Box p="md" style={{ height: '100%', overflowY: 'auto' }}>
      <Stack gap="md">
        {/* Standard Input Section */}
        <Box>
          <Group justify="space-between" align="center" mb={6}>
            <Text fw={600} size="sm">
              Standard Input (stdin)
            </Text>
            {input && (
              <Tooltip label="Clear Input" withArrow>
                <ActionIcon variant="subtle" color="gray" size="xs" onClick={onClearInput}>
                  <IconTrash size={14} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
          <Box style={{ border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`, borderRadius: '4px', overflow: 'hidden', backgroundColor: isDark ? '#101016' : '#ffffff' }}>
            <Editor
              height="120px"
              language="plaintext"
              theme={isDark ? 'vs-dark' : 'light'}
              value={input}
              onChange={(val) => onInputChange(val || '')}
              options={{
                minimap: { enabled: false },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                fontSize: 13,
                fontFamily: '"JetBrains Mono", monospace',
                padding: { top: 8, bottom: 8 },
                overviewRulerLanes: 0,
                hideCursorInOverviewRuler: true,
                renderLineHighlight: 'none',
              }}
            />
          </Box>
        </Box>

        {/* Expected Output Validation Section */}
        <Paper
          p="xs"
          radius="sm"
          style={{
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
          }}
        >
          <Switch
            checked={validateOutput}
            onChange={(e) => onValidateOutputChange(e.currentTarget.checked)}
            label={
              <Text size="xs" fw={600}>
                Enable Expected Output Validation
              </Text>
            }
            description="Automatically verify if stdout strictly matches target output"
            color="indigo"
            size="xs"
          />

          {validateOutput && (
            <Box mt="xs">
              <Group justify="space-between" align="center" mb={4}>
                <Text size="xs" fw={500} c="dimmed">
                  Expected Output
                </Text>
                {expectedOutput && (
                  <Tooltip label="Clear Expected Output" withArrow>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="xs"
                      onClick={() => onExpectedOutputChange('')}
                    >
                      <IconTrash size={12} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
              <Box style={{ border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`, borderRadius: '4px', overflow: 'hidden', backgroundColor: isDark ? '#101016' : '#ffffff' }}>
                <Editor
                  height="100px"
                  language="plaintext"
                  theme={isDark ? 'vs-dark' : 'light'}
                  value={expectedOutput}
                  onChange={(val) => onExpectedOutputChange(val || '')}
                  options={{
                    minimap: { enabled: false },
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    fontSize: 13,
                    fontFamily: '"JetBrains Mono", monospace',
                    padding: { top: 8, bottom: 8 },
                    overviewRulerLanes: 0,
                    hideCursorInOverviewRuler: true,
                    renderLineHighlight: 'none',
                  }}
                />
              </Box>
            </Box>
          )}
        </Paper>

        {/* Results Banner & Body */}
        {isRunning ? (
          <Paper
            p="lg"
            radius="sm"
            style={{
              textAlign: 'center',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
            }}
          >
            <Stack align="center" gap="sm">
              <Loader size="md" color="indigo" type="dots" />
              <Text size="sm" fw={500}>
                Compiling and running in sandbox...
              </Text>
              <Text size="xs" c="dimmed">
                Spawning isolated process with timeout & memory monitoring
              </Text>
            </Stack>
          </Paper>
        ) : result ? (
          <Stack gap="sm">
            {/* Verdict Card */}
            {(() => {
              const details = getVerdictDetails(result.type, result.status, result.match);
              return (
                <Alert
                  variant="light"
                  color={details.color}
                  title={
                    <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                      <Group gap="xs" align="center">
                        <Text fw={700} size="sm">
                          {details.title}
                        </Text>
                        <Badge color={details.color} size="sm" variant="filled">
                          {result.type}
                        </Badge>
                      </Group>
                      {/* Timing & Memory Badges */}
                      <Group gap="xs" align="center" wrap="wrap">
                        {result.compileTime && (
                          <Badge
                            size="sm"
                            variant="default"
                            leftSection={<IconHammer size={12} />}
                          >
                            Compile: {result.compileTime}ms
                          </Badge>
                        )}
                        {result.time && (
                          <Badge
                            size="sm"
                            variant="default"
                            leftSection={<IconBolt size={12} />}
                          >
                            Exec: {result.time}ms
                          </Badge>
                        )}
                        {result.memory && (
                          <Badge
                            size="sm"
                            variant={result.type === 'Memory Limit Exceeded' ? 'filled' : 'default'}
                            color={result.type === 'Memory Limit Exceeded' ? 'orange' : undefined}
                            leftSection={<IconBox size={12} />}
                          >
                            Memory: {formatMemory(result.memory)}
                          </Badge>
                        )}
                      </Group>
                    </Group>
                  }
                  icon={details.icon}
                  radius="sm"
                >
                  {details.description && (
                    <Text size="xs" mt={4}>
                      {details.description}
                    </Text>
                  )}
                </Alert>
              );
            })()}

            {/* Prominent MLE Warning Banner when Memory Limit Exceeded */}
            {result.type === 'Memory Limit Exceeded' && (
              <Paper
                p="sm"
                radius="sm"
                style={{
                  backgroundColor: isDark ? 'rgba(249, 115, 22, 0.12)' : '#fff7ed',
                  border: '1px solid rgba(249, 115, 22, 0.4)',
                }}
              >
                <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                  <Group gap="xs" align="center">
                    <Badge color="orange" variant="filled" size="sm">
                      MLE WARNING
                    </Badge>
                    <div>
                      <Text size="xs" fw={700} c={isDark ? 'orange.3' : 'orange.9'}>
                        Peak Memory Exceeded Threshold
                      </Text>
                      <Text size="11px" c="dimmed">
                        Program was terminated because RSS peak memory exceeded the configured limit.
                      </Text>
                    </div>
                  </Group>
                  {result.memory && (
                    <Badge
                      color="orange"
                      variant="light"
                      size="sm"
                      leftSection={<IconBox size={12} />}
                    >
                      Peak Memory: {formatMemory(result.memory)}
                    </Badge>
                  )}
                </Group>
              </Paper>
            )}

            {/* Error Message if Compilation / Runtime Error / MLE */}
            {result.message && (
              <Box>
                <Group justify="space-between" align="center" mb={4}>
                  <Text size="xs" fw={600} c="red">
                    Error Details / Compiler Output:
                  </Text>
                  <Tooltip label="Copy Error" withArrow>
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="red"
                      onClick={() => copyToClipboard(result.message || '', 'Error details')}
                    >
                      <IconCopy size={13} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
                <ScrollArea.Autosize mah={260}>
                  <Box
                    component="pre"
                    p="xs"
                    style={{
                      margin: 0,
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '12px',
                      borderRadius: '6px',
                      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.05)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: isDark ? '#fca5a5' : '#b91c1c',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {result.message}
                  </Box>
                </ScrollArea.Autosize>
              </Box>
            )}

            {/* If Wrong Answer: Show Diff Comparison */}
            {result.type === 'Wrong Answer' && validateOutput && (
              <Box>
                <Group gap="xs" mb={6} align="center">
                  <IconArrowsDiff size={16} color="#ef4444" />
                  <Text size="xs" fw={600}>
                    Output Comparison
                  </Text>
                </Group>
                <Group grow align="flex-start" gap="xs">
                  {/* Standard Input */}
                  {input && (
                    <Box>
                      <Group justify="space-between" align="center" mb={4}>
                        <Text size="11px" fw={600} c="dimmed">
                          Input:
                        </Text>
                        <Tooltip label="Copy Input" withArrow>
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color="gray"
                            onClick={() => copyToClipboard(input.trim(), 'Input')}
                          >
                            <IconCopy size={12} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                      <Box
                        component="pre"
                        p="xs"
                        style={{
                          margin: 0,
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '12px',
                          borderRadius: '6px',
                          backgroundColor: isDark ? '#101016' : '#ffffff',
                          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          minHeight: '60px',
                        }}
                      >
                        {(() => {
                          const trimmedInput = input.trim();
                          if (!trimmedInput) return '(empty)';
                          const inputLines = trimmedInput.split('\n');
                          
                          return inputLines.map((line, i) => (
                            <div key={i} style={{
                              display: 'flex',
                              color: isDark ? '#c1c2c5' : '#495057',
                              padding: '0 4px',
                              borderRadius: '2px',
                              marginBottom: '2px'
                            }}>
                              <span style={{ 
                                display: 'inline-block', 
                                width: '28px', 
                                opacity: 0.5, 
                                marginRight: '8px',
                                userSelect: 'none',
                                textAlign: 'right'
                              }}>
                                {i + 1}
                              </span>
                              <span style={{ flex: 1 }}>{line || ' '}</span>
                            </div>
                          ));
                        })()}
                      </Box>
                    </Box>
                  )}

                  {/* Actual Output */}
                  <Box>
                    <Group justify="space-between" align="center" mb={4}>
                      <Text size="11px" fw={600} c="red">
                        Actual Output:
                      </Text>
                      <Tooltip label="Copy Actual Output" withArrow>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color="gray"
                          onClick={() => copyToClipboard(result.output || '', 'Actual output')}
                        >
                          <IconCopy size={12} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                    <Box
                      component="pre"
                      p="xs"
                      style={{
                        margin: 0,
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '12px',
                        borderRadius: '6px',
                        backgroundColor: isDark ? '#101016' : '#ffffff',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        minHeight: '60px',
                      }}
                    >
                      {(() => {
                        if (!result.output) return '(empty)';
                        const actualLines = result.output.split('\n');
                        const expectedLines = expectedOutput.trim().split('\n');
                        
                        return actualLines.map((line, i) => {
                          const isMatch = i < expectedLines.length && line.trimEnd() === expectedLines[i].trimEnd();
                          return (
                            <div key={i} style={{
                              display: 'flex',
                              color: isMatch ? (isDark ? '#6ee7b7' : '#065f46') : (isDark ? '#fca5a5' : '#991b1b'),
                              backgroundColor: isMatch ? (isDark ? 'rgba(16, 185, 129, 0.1)' : '#f0fdf4') : (isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2'),
                              padding: '0 4px',
                              borderRadius: '2px',
                              marginBottom: '2px'
                            }}>
                              <span style={{ 
                                display: 'inline-block', 
                                width: '28px', 
                                opacity: 0.5, 
                                marginRight: '8px',
                                userSelect: 'none',
                                textAlign: 'right'
                              }}>
                                {i + 1}
                              </span>
                              <span style={{ flex: 1 }}>{line || ' '}</span>
                            </div>
                          );
                        });
                      })()}
                    </Box>
                  </Box>

                  {/* Expected Output */}
                  <Box>
                    <Group justify="space-between" align="center" mb={4}>
                      <Text size="11px" fw={600} c="teal">
                        Expected Output:
                      </Text>
                      <Tooltip label="Copy Expected Output" withArrow>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color="gray"
                          onClick={() => copyToClipboard(expectedOutput.trim(), 'Expected output')}
                        >
                          <IconCopy size={12} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                    <Box
                      component="pre"
                      p="xs"
                      style={{
                        margin: 0,
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '12px',
                        borderRadius: '6px',
                        backgroundColor: isDark ? '#101016' : '#ffffff',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        minHeight: '60px',
                      }}
                    >
                      {(() => {
                        const trimmedExpected = expectedOutput.trim();
                        if (!trimmedExpected) return '(empty)';
                        const expectedLines = trimmedExpected.split('\n');
                        
                        return expectedLines.map((line, i) => (
                          <div key={i} style={{
                            display: 'flex',
                            color: isDark ? '#6ee7b7' : '#065f46',
                            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#f0fdf4',
                            padding: '0 4px',
                            borderRadius: '2px',
                            marginBottom: '2px'
                          }}>
                            <span style={{ 
                              display: 'inline-block', 
                              width: '28px', 
                              opacity: 0.5, 
                              marginRight: '8px',
                              userSelect: 'none',
                              textAlign: 'right'
                            }}>
                              {i + 1}
                            </span>
                            <span style={{ flex: 1 }}>{line || ' '}</span>
                          </div>
                        ));
                      })()}
                    </Box>
                  </Box>
                </Group>
              </Box>
            )}

            {/* Standard Output (when not wrong answer, or general output) */}
            {result.type !== 'Wrong Answer' && result.output !== undefined && (
              <Box>
                <Group justify="space-between" align="center" mb={4}>
                  <Text size="xs" fw={600}>
                    Program Standard Output (stdout):
                  </Text>
                  <Tooltip label="Copy Output" withArrow>
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="gray"
                      onClick={() => copyToClipboard(result.output || '', 'Standard output')}
                    >
                      <IconCopy size={13} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
                <ScrollArea.Autosize mah={260}>
                  <Box
                    component="pre"
                    p="xs"
                    style={{
                      margin: 0,
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '12px',
                      borderRadius: '6px',
                      backgroundColor: isDark ? '#101016' : '#ffffff',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {result.output || '(No output produced)'}
                  </Box>
                </ScrollArea.Autosize>
              </Box>
            )}
          </Stack>
        ) : (
          <Paper
            p="md"
            radius="sm"
            style={{
              textAlign: 'center',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
              borderStyle: 'dashed',
            }}
          >
            <Text size="xs" c="dimmed">
              Output, timing statistics, and memory usage will appear here after running your code.
            </Text>
          </Paper>
        )}
      </Stack>
    </Box>
  );
};
