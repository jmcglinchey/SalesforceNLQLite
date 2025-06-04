import { users, salesforceFields, queryLogs, type User, type InsertUser, type SalesforceField, type QueryLog, type InsertSalesforceField } from "@shared/schema";
import { NLQEntity } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  logQuery(query: string, entities: NLQEntity, resultCount: number, processingTime: number, success: boolean, errorMessage?: string): Promise<QueryLog>;
  getRecentQueries(limit?: number): Promise<QueryLog[]>;
  insertSalesforceFields(fields: InsertSalesforceField[]): Promise<void>;
  clearSalesforceFields(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async logQuery(
    query: string, 
    entities: NLQEntity, 
    resultCount: number, 
    processingTime: number, 
    success: boolean, 
    errorMessage?: string
  ): Promise<QueryLog> {
    const [queryLog] = await db
      .insert(queryLogs)
      .values({
        query,
        extractedEntities: entities,
        resultCount,
        processingTimeMs: processingTime,
        success,
        errorMessage: errorMessage || null,
      })
      .returning();
    return queryLog;
  }

  async getRecentQueries(limit: number = 10): Promise<QueryLog[]> {
    const { desc } = await import('drizzle-orm');
    const logs = await db
      .select()
      .from(queryLogs)
      .orderBy(desc(queryLogs.createdAt))
      .limit(limit);
    
    return logs;
  }

  async insertSalesforceFields(fields: InsertSalesforceField[]): Promise<void> {
    if (fields.length === 0) return;
    
    // Insert in batches of 1000 to avoid query limits
    const batchSize = 1000;
    for (let i = 0; i < fields.length; i += batchSize) {
      const batch = fields.slice(i, i + batchSize);
      await db.insert(salesforceFields).values(batch);
    }
  }

  async clearSalesforceFields(): Promise<void> {
    await db.delete(salesforceFields);
  }
}

export const storage = new DatabaseStorage();
