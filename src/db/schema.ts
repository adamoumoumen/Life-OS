import { relations } from 'drizzle-orm';
import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  json,
  date,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // using text for external Auth UUIDs
  familyId: integer('family_id'),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull().default('parent'), // parent, child, admin
  timezone: text('timezone').notNull().default('UTC'),
  locale: text('locale').notNull().default('en'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const families = pgTable('families', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const taskEvents = pgTable('task_events', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  familyId: integer('family_id').references(() => families.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  isTask: boolean('is_task').notNull().default(true),
  status: text('status').notNull().default('pending'), // pending, in_progress, completed, cancelled
  priority: integer('priority').notNull().default(0),
  tags: json('tags'), // string array
  dueDate: timestamp('due_date', { withTimezone: true }),
  startTime: timestamp('start_time', { withTimezone: true }),
  endTime: timestamp('end_time', { withTimezone: true }),
  originTimezone: text('origin_timezone').notNull().default('UTC'),
  rrule: text('rrule'),
  isMovable: boolean('is_movable').notNull().default(true),
  visibility: text('visibility').notNull().default('private'), // private, family
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const agentActionLogs = pgTable('agent_action_logs', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  actionType: text('action_type').notNull(),
  planPayload: json('plan_payload').notNull(),
  beforeState: json('before_state'),
  status: text('status').notNull().default('proposed'), // proposed, confirmed, executed, reverted
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  executedAt: timestamp('executed_at', { withTimezone: true }),
});

export const gamificationProfiles = pgTable('gamification_profiles', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  level: integer('level').notNull().default(1),
  currentXp: integer('current_xp').notNull().default(0),
  streakDays: integer('streak_days').notNull().default(0),
  streakFreezesAvailable: integer('streak_freezes_available').notNull().default(0),
  lastActiveDate: date('last_active_date'),
});

// Relationships
export const usersRelations = relations(users, ({ one, many }) => ({
  family: one(families, { fields: [users.familyId], references: [families.id] }),
  tasks: many(taskEvents),
  agentLogs: many(agentActionLogs),
  gamification: one(gamificationProfiles, { fields: [users.id], references: [gamificationProfiles.userId] })
}));

export const familiesRelations = relations(families, ({ many }) => ({
  users: many(users),
  tasks: many(taskEvents),
}));

export const taskEventsRelations = relations(taskEvents, ({ one }) => ({
  user: one(users, { fields: [taskEvents.userId], references: [users.id] }),
  family: one(families, { fields: [taskEvents.familyId], references: [families.id] }),
}));

export const agentActionLogsRelations = relations(agentActionLogs, ({ one }) => ({
  user: one(users, { fields: [agentActionLogs.userId], references: [users.id] }),
}));
