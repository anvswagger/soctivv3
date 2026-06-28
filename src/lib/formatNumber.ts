/**
 * Format a number for display. 1 decimal max, no trailing zeros.
 */
export function formatNumber(n: number): string {
    if (!Number.isFinite(n)) return '0';
    return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}
