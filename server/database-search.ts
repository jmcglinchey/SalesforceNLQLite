import { db } from "./db";
import { salesforceFields } from "@shared/schema";
import { NLQEntity, SalesforceField, NLQSearchPlan, SearchCondition, FilterGroup } from "@shared/schema";
import { ilike, or, and, sql } from "drizzle-orm";



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

export async function searchSalesforceFieldsInDB(plan: NLQSearchPlan): Promise<SalesforceField[]> {
  try {
    let baseQuery = db.select().from(salesforceFields);
    const allWhereConditions: any[] = [];

    // Handle target object filter
    if (plan.targetObject) {
      allWhereConditions.push(
        or(
          ilike(salesforceFields.objectLabel, `%${plan.targetObject}%`),
          ilike(salesforceFields.objectApiName, `%${plan.targetObject}%`)
        )
      );
    }

    // Handle data type filter
    if (plan.dataTypeFilter) {
      const field = getFieldByName(plan.dataTypeFilter.field);
      if (field) {
        const condition = processSearchCondition(plan.dataTypeFilter);
        if (condition) {
          allWhereConditions.push(condition);
        }
      }
    }

    // Process filter groups
    plan.filterGroups.forEach(group => {
      const groupConditions: any[] = [];
      
      group.conditions.forEach(condition => {
        const field = getFieldByName(condition.field);
        if (field) {
          const processedCondition = processSearchCondition(condition);
          if (processedCondition) {
            groupConditions.push(processedCondition);
          }
        }
      });

      if (groupConditions.length > 0) {
        if (group.logicalOperator === 'OR') {
          allWhereConditions.push(or(...groupConditions));
        } else {
          allWhereConditions.push(and(...groupConditions));
        }
      }
    });

    // Build final query
    let finalQuery;
    if (allWhereConditions.length > 0) {
      finalQuery = baseQuery.where(and(...allWhereConditions)).limit(100);
    } else {
      finalQuery = baseQuery.limit(100);
    }

    const results = await finalQuery;
    return results as SalesforceField[];

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