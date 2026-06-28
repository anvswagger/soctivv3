/**
 * useDebounce — returns a value that only updates after the delay has passed
 * without the value changing. Used by the editor to throttle auto-save.
 */
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(t);
    }, [value, delayMs]);
    return debounced;
}
