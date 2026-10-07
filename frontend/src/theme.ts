import { createTheme } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'indigo',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontFamilyMonospace: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
  defaultRadius: 'sm',
  components: {
    Button: {
      defaultProps: {
        size: 'sm',
      },
    },
    Badge: {
      defaultProps: {
        radius: 'sm',
      },
    },
    Paper: {
      defaultProps: {
        shadow: 'sm',
        withBorder: true,
      },
    },
  },
});
