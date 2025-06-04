import { db } from "./db";
import { salesforceFields, salesforceObjects } from "@shared/schema";
import { NLQEntity, SalesforceField, SalesforceObject, NLQSearchPlan, SearchCondition, FilterGroup } from "@shared/schema";
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

function getObjectFieldByName(fieldName: string) {
  const objectFieldMap: Record<string, any> = {
    'objectLabel': salesforceObjects.objectLabel,
    'objectApiName': salesforceObjects.objectApiName,
    'description': salesforceObjects.description,
    'pluralLabel': salesforceObjects.pluralLabel,
    'tags': salesforceObjects.tags,
    'sharingModel': salesforceObjects.sharingModel,
    'keyPrefix': salesforceObjects.keyPrefix
  };
  
  return objectFieldMap[fieldName] || null;
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

function processObjectSearchCondition(condition: SearchCondition) {
  const field = getObjectFieldByName(condition.field);
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

export async function searchSalesforceObjectsInDB(plan: NLQSearchPlan): Promise<SalesforceObject[]> {
  try {
    let baseQuery = db.select().from(salesforceObjects);
    let allWhereConditions: any[] = [];

    // Add target object condition if specified
    if (plan.targetObject) {
      allWhereConditions.push(
        or(
          ilike(salesforceObjects.objectLabel, `%${plan.targetObject}%`),
          ilike(salesforceObjects.objectApiName, `%${plan.targetObject}%`)
        )
      );
    }

    // Process filter groups for object search
    plan.filterGroups.forEach((group: FilterGroup) => {
      const groupConditions = group.conditions
        .map(condition => processObjectSearchCondition(condition))
        .filter(condition => condition !== null);

      if (groupConditions.length > 0) {
        if (group.logicalOperator === "OR") {
          allWhereConditions.push(or(...groupConditions));
        } else {
          allWhereConditions.push(and(...groupConditions));
        }
      }
    });

    // Build final query
    let finalQuery;
    if (allWhereConditions.length > 0) {
      finalQuery = baseQuery.where(and(...allWhereConditions)).limit(50);
    } else {
      finalQuery = baseQuery.limit(50);
    }

    const results = await finalQuery;
    return results as SalesforceObject[];

  } catch (error) {
    console.error('Object database search error:', error);
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