import { db } from "./db";
import { salesforceFields } from "@shared/schema";
import { NLQEntity, SalesforceField } from "@shared/schema";
import { ilike, or, and, sql } from "drizzle-orm";

export async function searchSalesforceFieldsInDB(entities: NLQEntity): Promise<SalesforceField[]> {
  try {
    let whereConditions: any[] = [];

    // Filter by object if specified
    if (entities.object) {
      whereConditions.push(
        or(
          ilike(salesforceFields.objectLabel, `%${entities.object}%`),
          ilike(salesforceFields.objectApiName, `%${entities.object}%`)
        )
      );
    }

    // Filter by data type if specified
    if (entities.dataType) {
      whereConditions.push(
        ilike(salesforceFields.dataType, `%${entities.dataType}%`)
      );
    }

    // Search in keywords across multiple fields
    if (entities.keywords.length > 0) {
      const keywordConditions = entities.keywords.map(keyword => 
        or(
          ilike(salesforceFields.fieldLabel, `%${keyword}%`),
          ilike(salesforceFields.description, `%${keyword}%`),
          ilike(salesforceFields.helpText, `%${keyword}%`),
          ilike(salesforceFields.complianceCategory, `%${keyword}%`),
          ilike(salesforceFields.tagIds, `%${keyword}%`),
          ilike(salesforceFields.owners, `%${keyword}%`),
          ilike(salesforceFields.stakeholders, `%${keyword}%`)
        )
      );
      
      if (keywordConditions.length > 0) {
        whereConditions.push(or(...keywordConditions));
      }
    }

    // Build and execute the query
    const results = whereConditions.length > 0 
      ? await db.select().from(salesforceFields).where(and(...whereConditions)).limit(100)
      : await db.select().from(salesforceFields).limit(100);
    
    return results;

  } catch (error) {
    console.error('Database search error:', error);
    return [];
  }
}

export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await db.select().from(salesforceFields).limit(1);
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

export async function getSalesforceFieldCount(): Promise<number> {
  try {
    const result = await db.select({ count: sql<number>`count(*)` }).from(salesforceFields);
    return result[0]?.count || 0;
  } catch (error) {
    console.error('Error getting field count:', error);
    return 0;
  }
}