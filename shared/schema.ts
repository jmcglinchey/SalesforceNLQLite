import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Salesforce Field metadata table
export const salesforceFields = pgTable("salesforce_fields", {
  id: serial("id").primaryKey(),
  fieldLabel: text("field_label").notNull(),
  fieldApiName: text("field_api_name").notNull(),
  objectLabel: text("object_label").notNull(),
  objectApiName: text("object_api_name").notNull(),
  dataType: text("data_type").notNull(),
  description: text("description"),
  helpText: text("help_text"),
  formula: text("formula"),
  picklistValues: jsonb("picklist_values"),
  tags: jsonb("tags"), // For PII, Address, Contact Info, Financial, etc.
  isRequired: boolean("is_required").default(false),
  isCustom: boolean("is_custom").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Query logs for analytics
export const queryLogs = pgTable("query_logs", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  extractedEntities: jsonb("extracted_entities"),
  resultCount: integer("result_count").default(0),
  processingTimeMs: integer("processing_time_ms"),
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Users table (keeping original for potential future auth)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Schema for inserting salesforce fields
export const insertSalesforceFieldSchema = createInsertSchema(salesforceFields).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for query requests
export const queryRequestSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
});

// Schema for NLQ entity extraction
export const nlqEntitySchema = z.object({
  object: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  dataType: z.string().optional(),
  intent: z.enum(["find_fields", "describe_field", "list_objects", "filter_by_type"]).default("find_fields"),
});

// Schema for search results
export const searchResultSchema = z.object({
  fieldLabel: z.string(),
  fieldApiName: z.string(),
  objectLabel: z.string(),
  objectApiName: z.string(),
  dataType: z.string(),
  description: z.string().nullable(),
  helpText: z.string().nullable(),
  formula: z.string().nullable(),
  picklistValues: z.array(z.string()).nullable(),
  tags: z.array(z.string()).nullable(),
  isRequired: z.boolean(),
  isCustom: z.boolean(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type SalesforceField = typeof salesforceFields.$inferSelect;
export type InsertSalesforceField = z.infer<typeof insertSalesforceFieldSchema>;
export type QueryRequest = z.infer<typeof queryRequestSchema>;
export type NLQEntity = z.infer<typeof nlqEntitySchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
export type QueryLog = typeof queryLogs.$inferSelect;
