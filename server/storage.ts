import { users, salesforceFields, queryLogs, type User, type InsertUser, type SalesforceField, type QueryLog } from "@shared/schema";
import { NLQEntity } from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  logQuery(query: string, entities: NLQEntity, resultCount: number, processingTime: number, success: boolean, errorMessage?: string): Promise<QueryLog>;
  getRecentQueries(limit?: number): Promise<QueryLog[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private queryLogs: Map<number, QueryLog>;
  private currentUserId: number;
  private currentQueryLogId: number;

  constructor() {
    this.users = new Map();
    this.queryLogs = new Map();
    this.currentUserId = 1;
    this.currentQueryLogId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
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
    const id = this.currentQueryLogId++;
    const queryLog: QueryLog = {
      id,
      query,
      extractedEntities: entities,
      resultCount,
      processingTimeMs: processingTime,
      success,
      errorMessage: errorMessage || null,
      createdAt: new Date(),
    };
    
    this.queryLogs.set(id, queryLog);
    return queryLog;
  }

  async getRecentQueries(limit: number = 10): Promise<QueryLog[]> {
    const logs = Array.from(this.queryLogs.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
    
    return logs;
  }
}

export const storage = new MemStorage();
