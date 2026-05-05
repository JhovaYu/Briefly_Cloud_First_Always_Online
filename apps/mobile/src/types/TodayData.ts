/**
 * TodayData — shape exported for widget cache.
 *
 * Shared between app (writer) and widget (reader in PM-10D.2/3).
 * No tokens, no emails, no user IDs, no secrets.
 */

export type TodayData = {
  schemaVersion: 1;
  workspaceId: string | null;
  workspaceName: string | null;
  dateLabel: string;   // human-readable: "lunes, 4 de mayo"
  date: string;        // YYYY-MM-DD local
  pendingTasksCount: number;
  topTasks: Array<{
    id: string;
    text: string;
    priority?: string | null;
  }>;
  nextScheduleBlock: {
    id: string;
    title: string;
    start_time: string;
    duration_minutes?: number | null;
    location?: string | null;
  } | null;
  stale: boolean;
  emptyStateMessage: string | null;
  updatedAt: string;  // ISO timestamp
};