import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", { enum: ["officer", "admin"] }).notNull(),
  passwordHash: text("password_hash").notNull(),
  authSource: text("auth_source").notNull().default("internal"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
});

export const departments = sqliteTable("departments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  slaHours: integer("sla_hours").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    departmentId: integer("department_id").notNull().references(() => departments.id),
    name: text("name").notNull(),
    guidance: text("guidance").notNull().default(""),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [uniqueIndex("categories_dept_name_uq").on(t.departmentId, t.name)],
);

export const officers = sqliteTable("officers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().unique().references(() => users.id),
  departmentId: integer("department_id").notNull().references(() => departments.id),
  title: text("title").notNull(),
});

export const cases = sqliteTable(
  "cases",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    trackingNumber: text("tracking_number").notNull().unique(),
    year: integer("year").notNull(),
    seq: integer("seq").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    location: text("location").notNull(),
    categoryId: integer("category_id").notNull().references(() => categories.id),
    departmentId: integer("department_id").notNull().references(() => departments.id),
    priority: text("priority", { enum: ["low", "medium", "high", "critical"] }).notNull().default("medium"),
    status: text("status").notNull().default("submitted"),
    contactEmail: text("contact_email"),
    accessHash: text("access_hash").notNull(),
    assignedOfficerId: integer("assigned_officer_id").references(() => users.id),
    escalated: integer("escalated", { mode: "boolean" }).notNull().default(false),
    targetDate: integer("target_date").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    resolvedAt: integer("resolved_at"),
    feedbackScore: integer("feedback_score"),
    feedbackComment: text("feedback_comment"),
  },
  (t) => [
    uniqueIndex("cases_year_seq_uq").on(t.year, t.seq),
    index("cases_status_idx").on(t.status),
    index("cases_dept_status_idx").on(t.departmentId, t.status),
    index("cases_target_idx").on(t.targetDate),
    index("cases_officer_idx").on(t.assignedOfficerId),
  ],
);

export const timelineEvents = sqliteTable(
  "timeline_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    caseId: integer("case_id").notNull().references(() => cases.id),
    actorType: text("actor_type", { enum: ["citizen", "officer", "admin", "system"] }).notNull(),
    actorName: text("actor_name").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    note: text("note").notNull().default(""),
    internal: integer("internal", { mode: "boolean" }).notNull().default(false),
    at: integer("at").notNull(),
  },
  (t) => [index("timeline_case_idx").on(t.caseId)],
);

export const attachments = sqliteTable(
  "attachments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    caseId: integer("case_id").notNull().references(() => cases.id),
    key: text("key").notNull().unique(),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("attachments_case_idx").on(t.caseId)],
);

export const departmentsRelations = relations(departments, ({ many }) => ({ categories: many(categories), cases: many(cases) }));
export const categoriesRelations = relations(categories, ({ one, many }) => ({ department: one(departments, { fields: [categories.departmentId], references: [departments.id] }), cases: many(cases) }));
export const officersRelations = relations(officers, ({ one }) => ({ user: one(users, { fields: [officers.userId], references: [users.id] }), department: one(departments, { fields: [officers.departmentId], references: [departments.id] }) }));
export const casesRelations = relations(cases, ({ one, many }) => ({
  department: one(departments, { fields: [cases.departmentId], references: [departments.id] }),
  category: one(categories, { fields: [cases.categoryId], references: [categories.id] }),
  assignedOfficer: one(users, { fields: [cases.assignedOfficerId], references: [users.id] }),
  events: many(timelineEvents),
  attachments: many(attachments),
}));
export const timelineRelations = relations(timelineEvents, ({ one }) => ({ case: one(cases, { fields: [timelineEvents.caseId], references: [cases.id] }) }));
export const attachmentsRelations = relations(attachments, ({ one }) => ({ case: one(cases, { fields: [attachments.caseId], references: [cases.id] }) }));

export type User = typeof users.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Case = typeof cases.$inferSelect;
