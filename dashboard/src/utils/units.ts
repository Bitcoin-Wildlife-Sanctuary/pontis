export const parseUnit = (
  value: string | number,
): {
  value: number;
  unit: 'px' | 'rem' | 'em' | '%';
} => {
  if (typeof value === 'number') {
    return {
      value,
      unit: 'px',
    };
  }

  value = value.trim();

  if (value.endsWith('px')) {
    return {
      value: parseInt(value.replace('px', '')),
      unit: 'px',
    };
  }

  if (value.endsWith('rem')) {
    return {
      value: parseInt(value.replace('rem', '')),
      unit: 'rem',
    };
  }

  if (value.endsWith('em')) {
    return {
      value: parseInt(value.replace('em', '')),
      unit: 'em',
    };
  }

  if (value.endsWith('%')) {
    return {
      value: parseInt(value.replace('%', '')),
      unit: '%',
    };
  }

  throw new Error(`Invalid value passed. Value: ${value}`);
};

export const rem = (input: number | string, base = 16): `${number}rem` => {
  const {value, unit} = parseUnit(input);

  let result = value;

  if (unit === '%') result = (value / 100) * base;
  if (unit === 'px') result = value / base;

  return `${Number(result.toFixed(4))}rem`;
};

export const px = (input: number | string, base = 16): `${number}px` => {
  const {value, unit} = parseUnit(input);

  let result = value;

  if (unit === '%') result = (value / 100) * base;
  if (unit === 'rem' || unit === 'em') result = value * base;

  return `${Number(result.toFixed(4))}px`;
};
