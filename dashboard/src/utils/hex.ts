export const stripHexPrefix = (hex: string): string => {
  return hex.startsWith('0x') ? hex.slice(2) : hex;
};

export const addHexPrefix = (hex: string): string => {
  return hex.startsWith('0x') ? hex : `0x${hex}`;
};

export const isAllZeroHex = (hex: string): boolean => {
  const stripped = stripHexPrefix(hex);

  for (let i = 0; i < stripped.length; i++) {
    if (stripped[i] !== '0') {
      return false;
    }
  }

  return true;
};
