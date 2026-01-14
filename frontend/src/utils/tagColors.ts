// Function to generate consistent colors for tags
export const getTagColor = (tag: string): string => {
  const colors = [
    'blue',
    'green',
    'orange',
    'red',
    'purple',
    'cyan',
    'magenta',
    'lime',
    'gold',
    'volcano',
    'geekblue',
    'pink',
  ];

  // Simple hash function to ensure same tag always gets same color
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    const char = tag.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return colors[Math.abs(hash) % colors.length];
};

// Convert Ant Design color names to hex values
export const antdColorToHex = (colorName: string): string => {
  const colorMap: { [key: string]: string } = {
    blue: '#1677ff',
    green: '#52c41a',
    orange: '#fa8c16',
    red: '#ff4d4f',
    purple: '#722ed1',
    cyan: '#13c2c2',
    magenta: '#eb2f96',
    lime: '#a0d911',
    gold: '#faad14',
    volcano: '#fa541c',
    geekblue: '#2f54eb',
    pink: '#f759ab',
  };

  return colorMap[colorName] || '#333';
};

// Get hex color for a tag (combines the above two functions)
export const getTagHexColor = (tag: string): string => {
  const colorName = getTagColor(tag);
  return antdColorToHex(colorName);
};
