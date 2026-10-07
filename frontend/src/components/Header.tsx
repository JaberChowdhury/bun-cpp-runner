import React from 'react';
import {
  Group,
  Text,
  Button,
  ActionIcon,
  SegmentedControl,
  Badge,
  Tooltip,
  Box,
  Kbd,
  useMantineColorScheme,
  useComputedColorScheme,
} from '@mantine/core';
import {
  IconPlayerPlay,
  IconSun,
  IconMoon,
  IconTerminal2,
  IconBrandCpp,
  IconCpu,
} from '@tabler/icons-react';
import { Language } from '../types';

interface HeaderProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onRun: () => void;
  isRunning: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  onLanguageChange,
  onRun,
  isRunning,
}) => {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('dark', { getInitialValueInEffect: true });
  const isDark = computedColorScheme === 'dark';

  const toggleTheme = () => {
    setColorScheme(isDark ? 'light' : 'dark');
  };

  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  return (
    <Box
      component="header"
      px="md"
      py="xs"
      style={{
        borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
        backgroundColor: isDark ? 'rgba(20, 20, 26, 0.95)' : '#ffffff',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
      }}
    >
      <Group justify="space-between" align="center" wrap="nowrap">
        {/* Left: Branding & Language */}
        <Group gap="md" align="center">
          <Group gap="xs" align="center">
            <Box
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                color: '#fff',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.35)',
              }}
            >
              <IconTerminal2 size={22} stroke={2.2} />
            </Box>
            <div>
              <Group gap="xs" align="center">
                <Text fw={700} size="md" style={{ letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                  Bun Runner
                </Text>
                <Badge
                  size="xs"
                  variant="light"
                  color={language === 'cpp' ? 'blue' : 'orange'}
                  leftSection={<IconCpu size={12} />}
                >
                  {language === 'cpp' ? 'GCC 14 / C++20' : 'Rust 1.80+'}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed" style={{ lineHeight: 1.2 }}>
                High-Performance Asynchronous Sandbox
              </Text>
            </div>
          </Group>

          {/* Language Selector */}
          <SegmentedControl
            size="xs"
            value={language}
            onChange={(val) => onLanguageChange(val as Language)}
            data={[
              {
                value: 'cpp',
                label: (
                  <Group gap={6} wrap="nowrap">
                    <IconBrandCpp size={16} />
                    <span>C++ (G++)</span>
                  </Group>
                ),
              },
              {
                value: 'rust',
                label: (
                  <Group gap={6} wrap="nowrap">
                    <IconCpu size={16} />
                    <span>Rust (rustc)</span>
                  </Group>
                ),
              },
            ]}
          />
        </Group>

        {/* Right: Actions */}
        <Group gap="sm" align="center">
          {/* Run Button with Keyboard Shortcut indicator */}
          <Tooltip
            label={
              <Group gap={4}>
                <span>Run with</span>
                <Kbd size="xs">{isMac ? '⌘' : 'Ctrl'}</Kbd>
                <span>+</span>
                <Kbd size="xs">Enter</Kbd>
              </Group>
            }
            withArrow
          >
            <Button
              color="teal"
              variant="filled"
              size="sm"
              loading={isRunning}
              disabled={isRunning}
              leftSection={<IconPlayerPlay size={18} fill="currentColor" />}
              onClick={onRun}
              style={{
                fontWeight: 600,
                boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)',
              }}
            >
              {isRunning ? 'Running...' : 'Run Code'}
            </Button>
          </Tooltip>

          {/* Theme Toggle Button */}
          <Tooltip label={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'} withArrow>
            <ActionIcon
              variant="default"
              size="lg"
              aria-label="Toggle theme"
              onClick={toggleTheme}
            >
              {isDark ? (
                <IconSun size={18} stroke={1.8} color="#eab308" />
              ) : (
                <IconMoon size={18} stroke={1.8} color="#6366f1" />
              )}
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Box>
  );
};
