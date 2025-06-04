import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Salesforce Field metadata table with complete schema
export const salesforceFields = pgTable("salesforce_fields", {
  id: serial("id").primaryKey(),
  // Core field information
  fieldLabel: text("field_label").notNull(), // Label
  fieldApiName: text("field_api_name").notNull(), // Name
  objectLabel: text("object_label").notNull(), // ParentDisplayName
  objectApiName: text("object_api_name").notNull(),
  dataType: text("data_type").notNull(), // Type
  
  // Field metadata
  picklistValues: text("picklist_values"), // PicklistValues
  ingestedBy: text("ingested_by"), // IngestedBy
  populatedBy: text("populated_by"), // PopulatedBy
  notes: text("notes"), // Notes
  definition: text("definition"), // Definition
  description: text("description"), // Description
  helpText: text("help_text"), // HelpText
  formula: text("formula"), // Formula
  
  // Compliance and sensitivity
  complianceCategory: text("compliance_category"), // ComplianceCategory
  fieldUsageId: text("field_usage_id"), // FieldUsageId
  dataSensitivityLevelId: text("data_sensitivity_level_id"), // DataSensitivityLevelId
  
  // Ownership and stakeholders
  owners: text("owners"), // Owners
  stakeholders: text("stakeholders"), // Stakeholders
  isFollowing: boolean("is_following").default(false), // IsFollowing
  tagIds: text("tag_ids"), // TagIds
  
  // Field properties
  isCustom: boolean("is_custom").default(false), // Custom
  isRequired: boolean("is_required").default(false), // Required
  isUnique: boolean("is_unique").default(false), // Unique
  defaultValue: text("default_value"), // DefaultValue
  scale: integer("scale"), // Scale
  
  // Audit fields
  createdBy: text("created_by"), // CreatedBy
  salesforceCreatedDate: text("salesforce_created_date"), // CreatedDate
  lastModifiedBy: text("last_modified_by"), // LastModifiedBy
  salesforceLastModifiedDate: text("salesforce_last_modified_date"), // LastModifiedDate
  managedPackage: text("managed_package"), // ManagedPackage
  
  // Usage statistics
  populationPercentage: integer("population_percentage"), // PopulationPercentage
  referenceCount: integer("reference_count"), // ReferenceCount
  populatedAndTotalRecords: text("populated_and_total_records"), // PopulatedAndTotalRecords
  sourceUrl: text("source_url"), // SourceUrl
  
  // System fields
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Salesforce Object metadata table
export const salesforceObjects = pgTable("salesforce_objects", {
  id: serial("id").primaryKey(),
  objectLabel: text("object_label").notNull(),
  objectApiName: text("object_api_name").notNull().unique(),
  description: text("description"),
  pluralLabel: text("plural_label"),
  keyPrefix: text("key_prefix"),
  isCustom: boolean("is_custom").default(false),
  tags: text("tags"),
  sharingModel: text("sharing_model"),
  matchConfidence: text("match_confidence", { enum: ["High", "Medium", "Low"] }),
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

// Schema for inserting salesforce objects
export const insertSalesforceObjectSchema = createInsertSchema(salesforceObjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for query requests
export const queryRequestSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
});

// Enhanced search condition schema for structured query planning
export const searchConditionSchema = z.object({
  field: z.string(), // Column name from salesforceFields table
  operator: z.enum(["ilike", "equals_ignore_case", "contains_in_array_field"]),
  value: z.union([z.string(), z.array(z.string())]),
});

export const filterGroupSchema = z.object({
  logicalOperator: z.enum(["AND", "OR"]), // How conditions within this group are combined
  conditions: z.array(searchConditionSchema),
});

export const nlqSearchPlanSchema = z.object({
  intent: z.enum(["find_fields", "find_objects", "describe_field", "list_objects", "filter_by_type"]).default("find_fields"),
  targetObject: z.string().nullable().optional(), // Primary Salesforce object if specified
  filterGroups: z.array(filterGroupSchema), // Main search criteria
  dataTypeFilter: searchConditionSchema.nullable().optional(), // Optional data type filter
  rawKeywords: z.array(z.string()).default([]), // Raw keywords for context
});

// Legacy schema for backwards compatibility
export const nlqEntitySchema = z.object({
  object: z.string().nullable().optional(),
  keywords: z.array(z.string()).default([]),
  dataType: z.string().nullable().optional(),
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
  picklistValues: z.string().nullable(),
  complianceCategory: z.string().nullable(),
  tagIds: z.string().nullable(),
  owners: z.string().nullable(),
  stakeholders: z.string().nullable(),
  isRequired: z.boolean(),
  isCustom: z.boolean(),
  isUnique: z.boolean(),
  populationPercentage: z.number().nullable(),
  referenceCount: z.number().nullable(),
  matchConfidence: z.enum(["High", "Medium", "Low"]).nullable().optional(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type SalesforceField = typeof salesforceFields.$inferSelect;
export type InsertSalesforceField = z.infer<typeof insertSalesforceFieldSchema>;
export type SalesforceObject = typeof salesforceObjects.$inferSelect;
export type InsertSalesforceObject = z.infer<typeof insertSalesforceObjectSchema>;
export type QueryRequest = z.infer<typeof queryRequestSchema>;
export type NLQEntity = z.infer<typeof nlqEntitySchema>;
export type NLQSearchPlan = z.infer<typeof nlqSearchPlanSchema>;
export type SearchCondition = z.infer<typeof searchConditionSchema>;
export type FilterGroup = z.infer<typeof filterGroupSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
export type QueryLog = typeof queryLogs.$inferSelect;
