import { type ClassValue } from 'clsx';
/**
 * Merge Tailwind CSS class names with clsx and tailwind-merge.
 * Resolves conflicting utility classes (e.g., `px-2 px-4` → `px-4`).
 */
export declare function cn(...inputs: ClassValue[]): string;
/**
 * Format a Date object to a localized date string.
 */
export declare function formatDate(date: Date | string): string;
/**
 * Format a Date object to a localized date-time string.
 */
export declare function formatDateTime(date: Date | string): string;
/**
 * Format a number with commas as thousands separators.
 */
export declare function formatNumber(value: number): string;
/**
 * Truncate a string to a maximum length, appending ellipsis.
 */
export declare function truncate(str: string, maxLength: number): string;
/**
 * Debounce a function by a given delay in milliseconds.
 */
export declare function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void;
