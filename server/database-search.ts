import { db } from "./db";
import { salesforceFields } from "@shared/schema";
import { NLQEntity, SalesforceField, NLQSearchPlan, SearchCondition, FilterGroup } from "@shared/schema";
import { ilike, or, and, sql } from "drizzle-orm";

export async function searchSalesforceFieldsWithPlan(searchPlan: NLQSearchPlan): Promise<SalesforceField[]> {
  try {
    let whereConditions: any[] = [];

    // Filter by target object if specified
    if (searchPlan.targetObject) {
      whereConditions.push(ilike(salesforceFields.objectLabel, `%${searchPlan.targetObject}%`));
    }

    // Process filter groups
    if (searchPlan.filterGroups.length > 0) {
      const groupConditions = searchPlan.filterGroups.map(group => {
        const conditions = group.conditions.map(condition => {
          const field = getFieldByName(condition.field);
          if (!field) return null;

          switch (condition.operator) {
            case "ilike":
              return ilike(field, condition.value as string);
            case "equals_ignore_case":
              return sql`LOWER(${field}) = LOWER(${condition.value})`;
            case "contains_in_array_field":
              // For comma-separated fields like tagIds
              return ilike(field, `%${condition.value}%`);
            default:
              return null;
          }
        }).filter(Boolean);

        if (conditions.length === 0) return null;

        return group.logicalOperator === "OR" 
          ? or(...conditions as any[])
          : and(...conditions as any[]);
      }).filter(Boolean);

      if (groupConditions.length > 0) {
        whereConditions.push(and(...groupConditions as any[]));
      }
    }

    // Apply data type filter
    if (searchPlan.dataTypeFilter) {
      const dataTypeCondition = processSearchCondition(searchPlan.dataTypeFilter);
      if (dataTypeCondition) {
        whereConditions.push(dataTypeCondition);
      }
    }

    // Build final query
    const query = db
      .select()
      .from(salesforceFields)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .limit(50);

    return await query;
  } catch (error) {
    console.error("Error searching with plan:", error);
    return [];
  }
}

function getFieldByName(fieldName: string) {
  const fieldMap: Record<string, any> = {
    'fieldLabel': salesforceFields.fieldLabel,
    'fieldApiName': salesforceFields.fieldApiName,
    'objectLabel': salesforceFields.objectLabel,
    'description': salesforceFields.description,
    'helpText': salesforceFields.helpText,
    'complianceCategory': salesforceFields.complianceCategory,
    'tagIds': salesforceFields.tagIds,
    'owners': salesforceFields.owners,
    'stakeholders': salesforceFields.stakeholders,
    'dataType': salesforceFields.dataType,
    'picklistValues': salesforceFields.picklistValues,
    'ingestedBy': salesforceFields.ingestedBy
  };
  
  return fieldMap[fieldName] || null;
}

function processSearchCondition(condition: SearchCondition) {
  const field = getFieldByName(condition.field);
  if (!field) return null;

  switch (condition.operator) {
    case "ilike":
      return ilike(field, condition.value as string);
    case "equals_ignore_case":
      return sql`LOWER(${field}) = LOWER(${condition.value})`;
    case "contains_in_array_field":
      return ilike(field, `%${condition.value}%`);
    default:
      return null;
  }
}

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