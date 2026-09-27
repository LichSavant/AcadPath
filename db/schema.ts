import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// The validated record document contains one curriculum, subjects and their
// relationships, student statuses, settings and plans. One atomic row prevents
// partial curriculum/status updates; revision protects against stale browser tabs.
export const studentRecords = sqliteTable('student_records', {
  userId: text('user_id').primaryKey(),
  displayName: text('display_name').notNull(),
  document: text('document').notNull(),
  revision: integer('revision').notNull().default(1),
  updatedAt: text('updated_at').notNull(),
});
