import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Group,
  SegmentedControl,
  ActionIcon,
  Tooltip,
  Text,
  Switch,
  Paper,
  Loader,
  Badge,
  useComputedColorScheme,
} from '@mantine/core';
import {
  IconRefresh,
  IconCopy,
  IconCheck,
  IconTerminal2,
  IconActivity,
  IconArrowsSort,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { LogType } from '../types';

export const LogsPanel: React.FC = () => {
  const computedColorScheme = useComputedColorScheme('dark', { getInitialValueInEffect: true });
  const isDark = computedColorScheme === 'dark';

  const [logType, setLogType] = useState<LogType>('runner');
  const [logs, setLogs] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);

  const logContainerRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async (type: LogType, isPolling = false) => {
    if (!isPolling) setIsLoading(true);
    try {
      const res = await fetch(`/api/logs/${type}`);
      if (res.ok) {
        const text = await res.text();
        setLogs(text);
      } else {
        setLogs(`Error: Unable to fetch logs (HTTP ${res.status})`);
      }
    } catch {
      setLogs('Error: Failed to reach backend server.');
    } finally {
      if (!isPolling) setIsLoading(false);
    }
  }, []);

  // Fetch when tab changes
  useEffect(() => {
    fetchLogs(logType);
  }, [logType, fetchLogs]);

  // Polling effect
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs(logType, true);
    }, 2500);
    return () => clearInterval(interval);
  }, [autoRefresh, logType, fetchLogs]);

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(logs);
      notifications.show({
        title: 'Copied',
        message: `${logType === 'runner' ? 'Runner' : 'API'} logs copied to clipboard`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } catch {
      notifications.show({
        title: 'Failed',
        message: 'Could not copy logs to clipboard',
        color: 'red',
      });
    }
  };

  // Helper to colorize log lines
  const renderLogLine = (line: string, index: number) => {
    // Escape or split tags
    let levelColor = 'inherit';
    let levelBg = 'transparent';

    if (line.includes('[INFO]') || line.includes('[API]')) {
      levelColor = '#60a5fa'; // Blue
    } else if (line.includes('[COMPILE]')) {
      levelColor = '#facc15'; // Yellow
    } else if (line.includes('[EXECUTE]')) {
      levelColor = '#38bdf8'; // Cyan
    } else if (line.includes('[SUCCESS]')) {
      levelColor = '#4ade80'; // Green
    } else if (line.includes('[ERROR]')) {
      levelColor = '#f87171'; // Red
      levelBg = 'rgba(239, 68, 68, 0.08)';
    } else if (line.includes('[POST]')) {
      levelColor = '#c084fc'; // Purple
    } else if (line.includes('[GET]')) {
      levelColor = '#2dd4bf'; // Teal
    }

    return (
      <div
        key={index}
        style={{
          padding: '2px 6px',
          borderRadius: '3px',
          backgroundColor: levelBg,
          color: levelColor,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '12px',
          lineHeight: '1.45',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {line}
      </div>
    );
  };

  const lines = logs.split('\n').filter((l) => l.trim().length > 0);

  return (
    <Box p="md" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Controls Bar */}
      <Group justify="space-between" align="center" mb="sm" wrap="wrap" gap="xs">
        <Group gap="xs" align="center">
          <SegmentedControl
            size="xs"
            value={logType}
            onChange={(val) => setLogType(val as LogType)}
            data={[
              {
                value: 'runner',
                label: (
                  <Group gap={6} wrap="nowrap">
                    <IconTerminal2 size={14} />
                    <span>Runner Engine</span>
                  </Group>
                ),
              },
              {
                value: 'api',
                label: (
                  <Group gap={6} wrap="nowrap">
                    <IconActivity size={14} />
                    <span>API Hits</span>
                  </Group>
                ),
              },
            ]}
          />

          <Badge size="xs" variant="dot" color={autoRefresh ? 'teal' : 'gray'}>
            {autoRefresh ? 'Live' : 'Paused'}
          </Badge>
        </Group>

        <Group gap="xs" align="center">
          <Switch
            size="xs"
            label="Live Poll"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.currentTarget.checked)}
            color="teal"
          />

          <Switch
            size="xs"
            label="Auto-scroll"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.currentTarget.checked)}
            color="indigo"
          />

          <Tooltip label="Scroll to bottom" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={() => {
                if (logContainerRef.current) {
                  logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
                }
              }}
            >
              <IconArrowsSort size={15} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Copy all logs" withArrow>
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleCopy}>
              <IconCopy size={15} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Refresh logs" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              loading={isLoading}
              onClick={() => fetchLogs(logType)}
            >
              <IconRefresh size={15} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Log Terminal Window */}
      <Paper
        style={{
          flex: 1,
          minHeight: 0,
          backgroundColor: isDark ? '#0d0d12' : '#1e1e24',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : '#33333e'}`,
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Terminal Header */}
        <Box
          px="sm"
          py={6}
          style={{
            backgroundColor: isDark ? '#14141c' : '#272730',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Group gap={6}>
            <Box style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ef4444' }} />
            <Box style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
            <Box style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#10b981' }} />
            <Text size="11px" c="dimmed" ml="xs" style={{ fontFamily: 'monospace' }}>
              {logType === 'runner' ? 'runner.log (max 400 lines)' : 'api.log (max 200 lines)'}
            </Text>
          </Group>
          <Text size="10px" c="dimmed">
            {lines.length} lines
          </Text>
        </Box>

        {/* Terminal Body */}
        <Box
          ref={logContainerRef}
          p="xs"
          style={{
            flex: 1,
            overflowY: 'auto',
            color: '#e2e8f0',
          }}
        >
          {isLoading && lines.length === 0 ? (
            <Group justify="center" p="xl">
              <Loader size="xs" color="indigo" />
              <Text size="xs" c="dimmed">
                Loading logs...
              </Text>
            </Group>
          ) : lines.length === 0 ? (
            <Text size="xs" c="dimmed" p="sm" ta="center">
              No log entries available.
            </Text>
          ) : (
            lines.map((line, idx) => renderLogLine(line, idx))
          )}
        </Box>
      </Paper>
    </Box>
  );
};
