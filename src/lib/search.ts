/**
 * Escapes special characters in a search string to prevent PostgreSQL LIKE wildcard injection.
 * Truncates the input to 200 characters to prevent DoS via excessively long queries.
 *
 * @param value - The raw search string from user input
 * @returns A sanitized string safe for use in ILIKE queries
 */
export function escapeSearch(value: string): string {
    return value
        .substring(0, 200)
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
}
