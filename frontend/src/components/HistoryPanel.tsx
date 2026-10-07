import React from 'react';
import {
  Box,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  ActionIcon,
  Tooltip,
  Paper,
  Loader,
  ScrollArea,
  useComputedColorScheme,
} from '@mantine/core';
import {
  IconHistory,
  IconRefresh,
  IconArrowBackUp,
  IconHammer,
  IconBolt,
  IconBrandCpp,
  IconCpu,
  IconBox,
} from '@tabler/icons-react';
import { HistoryItem, VerdictType } from '../types';
import { formatMemory } from '../utils/format';

interface HistoryPanelProps {
  history: HistoryItem[];
  isLoading: boolean;
  onRefresh: () => void;
  onRestore: (item: HistoryItem) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  isLoading,
  onRefresh,
  onRestore,
}) => {
  const computedColorScheme = useComputedColorScheme('dark', { getInitialValueInEffect: true });
  const isDark = computedColorScheme === 'dark';

  const getVerdictBadgeColor = (type: VerdictType, status: string, match?: boolean | null) => {
    if (type === 'Accepted' || (status === 'success' && match !== false)) {
      return 'teal';
    }
    if (type === 'Time Limit Exceeded') {
      return 'yellow';
    }
    if (type === 'Memory Limit Exceeded') {
      return 'orange';
    }
    return 'red';
  };

  return (
    <Box p="md" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header bar */}
      <Group justify="space-between" align="center" mb="sm">
        <Group gap="xs" align="center">
          <IconHistory size={18} />
          <Text fw={600} size="sm">
            Run History
          </Text>
          <Badge size="xs" variant="light" color="indigo">
            {history.length} {history.length === 1 ? 'record' : 'records'}
          </Badge>
        </Group>

        <Tooltip label="Refresh history from server" withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={onRefresh}
            loading={isLoading}
          >
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Text size="xs" c="dimmed" mb="sm">
        Click &quot;Restore&quot; on any past execution to restore code, input, language, memory limits, and validation settings.
      </Text>

      {/* History List */}
      <Box style={{ flex: 1, minHeight: 0 }}>
        {isLoading && history.length === 0 ? (
          <Group justify="center" p="xl">
            <Loader size="sm" color="indigo" />
            <Text size="xs" c="dimmed">
              Loading history...
            </Text>
          </Group>
        ) : history.length === 0 ? (
          <Paper
            p="xl"
            radius="sm"
            style={{
              textAlign: 'center',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
              borderStyle: 'dashed',
            }}
          >
            <IconHistory size={28} opacity={0.3} style={{ margin: '0 auto 8px' }} />
            <Text size="xs" c="dimmed">
              No previous runs saved yet.
            </Text>
          </Paper>
        ) : (
          <ScrollArea style={{ height: '100%' }} offsetScrollbars>
            <Stack gap="xs">
              {history.map((item, index) => {
                const badgeColor = getVerdictBadgeColor(item.type, item.status, item.match);
                const isCpp = item.language === 'cpp';

                return (
                  <Paper
                    key={`${item.id}-${index}`}
                    p="xs"
                    radius="sm"
                    style={{
                      backgroundColor: isDark ? 'rgba(26, 26, 36, 0.7)' : '#ffffff',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      {/* Left: Info */}
                      <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                        <Group gap={6} align="center" wrap="wrap">
                          <Badge size="xs" color={badgeColor} variant="filled">
                            {item.type || 'Completed'}
                          </Badge>
                          <Badge
                            size="xs"
                            variant="light"
                            color={isCpp ? 'blue' : 'orange'}
                            leftSection={isCpp ? <IconBrandCpp size={11} /> : <IconCpu size={11} />}
                          >
                            {isCpp ? 'C++' : 'Rust'}
                          </Badge>
                          <Text size="11px" c="dimmed">
                            {item.date}
                          </Text>
                        </Group>

                        {/* Timing and Memory stats */}
                        <Group gap={6} align="center" wrap="wrap">
                          {item.compileTime && (
                            <Group gap={3} align="center">
                              <IconHammer size={12} opacity={0.6} />
                              <Text size="11px" c="dimmed">
                                {item.compileTime}ms
                              </Text>
                            </Group>
                          )}
                          {item.compileTime && item.time && (
                            <Text size="10px" c="dimmed" opacity={0.4}>
                              •
                            </Text>
                          )}
                          {item.time && (
                            <Group gap={3} align="center">
                              <IconBolt size={12} opacity={0.6} />
                              <Text size="11px" c="dimmed">
                                {item.time}ms
                              </Text>
                            </Group>
                          )}
                          {(item.compileTime || item.time) && item.memory && (
                            <Text size="10px" c="dimmed" opacity={0.4}>
                              •
                            </Text>
                          )}
                          {item.memory && (
                            <Group gap={3} align="center">
                              <IconBox size={12} opacity={0.6} />
                              <Text
                                size="11px"
                                c={item.type === 'Memory Limit Exceeded' ? 'orange' : 'dimmed'}
                                fw={item.type === 'Memory Limit Exceeded' ? 600 : 400}
                              >
                                {formatMemory(item.memory)}
                              </Text>
                            </Group>
                          )}
                        </Group>

                        {/* Code snippet preview */}
                        <Text
                          size="11px"
                          c="dimmed"
                          lineClamp={1}
                          style={{
                            fontFamily: '"JetBrains Mono", monospace',
                            opacity: 0.8,
                          }}
                        >
                          {item.code.split('\n').filter(Boolean)[0] || '(empty code)'}
                        </Text>
                      </Stack>

                      {/* Right: Restore button */}
                      <Button
                        size="xs"
                        variant="light"
                        color="indigo"
                        leftSection={<IconArrowBackUp size={14} />}
                        onClick={() => onRestore(item)}
                      >
                        Restore
                      </Button>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          </ScrollArea>
        )}
      </Box>
    </Box>
  );
};
