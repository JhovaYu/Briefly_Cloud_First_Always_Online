/**
 * Date utilities — all using LOCAL device time, NOT UTC.
 */

/**
 * Returns YYYY-MM-DD string in local time.
 * Uses getFullYear()/getMonth()+1/getDate() to avoid UTC drift.
 */
export function getLocalDateString(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 0-indexed
    const day = date.getDate();
    return (
        String(year) +
        '-' +
        String(month).padStart(2, '0') +
        '-' +
        String(day).padStart(2, '0')
    );
}
