
/**
 * Converts a SNAKE_CASE string to camelCase for use as a translation key.
 * E.g., 'NON_PARTICIPATING' -> 'nonParticipating'
 * @param str The SNAKE_CASE string.
 * @returns The camelCase string.
 */
export const snakeToCamel = (str: string): string => {
  if (!str) return '';
  return str.toLowerCase().replace(/_(\w)/g, (_, c) => c.toUpperCase());
};
