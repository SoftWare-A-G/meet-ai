export const DEFAULT_SCHEMA = '#222244,#2D2B55,#B362FF,#FFFFFF,#2D2B55,#A599E9,#3AD900,#FAD000,#3B3768,#7E74A8'

export const THEME_PRESETS = [
  { name: 'meet-ai Default', schema: '#194234,#9c2e33,#E7C12e,#194234,#9c2e33,#FFFFFF,#ee6030,#9C2E33,#9c2e33,#FFFFFF' },
  { name: 'One Dark Pro', schema: '#282C34,#2C313A,#528BFF,#FFFFFF,#2C313A,#ABB2BF,#98C379,#E06C75,#3E4451,#5C6370' },
  { name: 'Dracula', schema: '#282A36,#343746,#BD93F9,#FFFFFF,#343746,#F8F8F2,#50FA7B,#FF79C6,#44475A,#6272A4' },
  { name: 'GitHub Dark', schema: '#0D1117,#161B22,#1F6FEB,#FFFFFF,#161B22,#C9D1D9,#3FB950,#F85149,#21262D,#8B949E' },
  { name: 'Nord', schema: '#2E3440,#3B4252,#88C0D0,#ECEFF4,#3B4252,#D8DEE9,#A3BE8C,#BF616A,#434C5E,#4C566A' },
  { name: 'Monokai', schema: '#272822,#3E3D32,#F92672,#FFFFFF,#3E3D32,#F8F8F2,#A6E22E,#F92672,#49483E,#75715E' },
  { name: 'Solarized Dark', schema: '#002B36,#073642,#2AA198,#FFFFFF,#073642,#839496,#859900,#DC322F,#073642,#586E75' },
  { name: 'Tokyo Night', schema: '#1A1B26,#24283B,#7AA2F7,#FFFFFF,#24283B,#A9B1D6,#73DACA,#F7768E,#2F3549,#565F89' },
  { name: 'Catppuccin Mocha', schema: '#1E1E2E,#313244,#89B4FA,#FFFFFF,#313244,#CDD6F4,#A6E3A1,#F38BA8,#45475A,#6C7086' },
  { name: 'Gruvbox Dark', schema: '#282828,#3C3836,#FABD2F,#282828,#3C3836,#EBDBB2,#B8BB26,#FB4934,#504945,#928374' },
  { name: 'Ayu Dark', schema: '#0B0E14,#131721,#E6B450,#0B0E14,#131721,#BFBDB6,#AAD94C,#F07178,#11151C,#565B66' },
  { name: 'Ayu Mirage', schema: '#1F2430,#272D38,#FFCC66,#1F2430,#272D38,#CCCAC2,#D5FF80,#F28779,#171B24,#5C6166' },
  { name: 'Ayu Light', schema: '#FAFAFA,#F0F0F0,#FF9940,#FFFFFF,#F0F0F0,#575F66,#86B300,#F07171,#E8E8E8,#ABB0B6' },
  { name: 'Night Owl', schema: '#011627,#0B2942,#7E57C2,#FFFFFF,#0B2942,#D6DEEB,#ADDB67,#EF5350,#122D42,#5F7E97' },
  { name: 'One Light', schema: '#FAFAFA,#EAEAEB,#4078F2,#FFFFFF,#EAEAEB,#383A42,#50A14F,#E45649,#D4D4D4,#A0A1A7' },
  { name: 'Shades of Purple', schema: '#222244,#2D2B55,#B362FF,#FFFFFF,#2D2B55,#A599E9,#3AD900,#FAD000,#3B3768,#7E74A8' },
]

export const SCHEMA_LABELS = [
  'Column BG', 'Menu Hover', 'Active Item', 'Active Text', 'Hover Item',
  'Text Color', 'Presence', 'Badge', 'Divider', 'Alt Text',
]

export const STORAGE_KEYS = {
  apiKey: 'meet-ai-key',
  handle: 'meet-ai-handle',
  colorSchema: 'meet-ai-color-schema',
} as const
