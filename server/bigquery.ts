import { BigQuery } from '@google-cloud/bigquery';
import { SalesforceField, NLQEntity } from '@shared/schema';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GCP_PROJECT_ID || 'default-project',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'salesforce_metadata';
const TABLE_ID = process.env.BIGQUERY_TABLE_ID || 'field_dictionary';

export async function searchSalesforceFields(entities: NLQEntity): Promise<SalesforceField[]> {
  try {
    let query = `
      SELECT 
        fieldLabel,
        fieldApiName,
        objectLabel,
        objectApiName,
        dataType,
        description,
        helpText,
        formula,
        picklistValues,
        tags,
        isRequired,
        isCustom
      FROM \`${bigquery.projectId}.${DATASET_ID}.${TABLE_ID}\`
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 0;

    // Filter by object if specified
    if (entities.object) {
      query += ` AND (LOWER(objectLabel) LIKE @object${paramIndex} OR LOWER(objectApiName) LIKE @object${paramIndex})`;
      params.push(`%${entities.object.toLowerCase()}%`);
      paramIndex++;
    }

    // Filter by data type if specified
    if (entities.dataType) {
      query += ` AND LOWER(dataType) LIKE @dataType${paramIndex}`;
      params.push(`%${entities.dataType.toLowerCase()}%`);
      paramIndex++;
    }

    // Search in keywords across multiple fields
    if (entities.keywords.length > 0) {
      const keywordConditions: string[] = [];
      
      entities.keywords.forEach((keyword, index) => {
        const paramName = `keyword${paramIndex + index}`;
        keywordConditions.push(`
          (LOWER(fieldLabel) LIKE @${paramName} 
           OR LOWER(description) LIKE @${paramName} 
           OR LOWER(helpText) LIKE @${paramName}
           OR EXISTS(SELECT 1 FROM UNNEST(tags) AS tag WHERE LOWER(tag) LIKE @${paramName}))
        `);
        params.push(`%${keyword.toLowerCase()}%`);
      });
      
      if (keywordConditions.length > 0) {
        query += ` AND (${keywordConditions.join(' OR ')})`;
      }
      paramIndex += entities.keywords.length;
    }

    // Order by relevance (exact matches first, then partial matches)
    query += ` ORDER BY 
      CASE 
        WHEN LOWER(fieldLabel) = LOWER(@searchTerm) THEN 1
        WHEN LOWER(fieldLabel) LIKE LOWER(@searchTerm) THEN 2
        ELSE 3
      END,
      objectLabel,
      fieldLabel
      LIMIT 100
    `;

    // Add search term for ordering
    const searchTerm = entities.keywords.length > 0 ? entities.keywords[0] : '';
    params.push(searchTerm);

    const options = {
      query,
      params,
      location: 'US',
    };

    const [rows] = await bigquery.query(options);
    
    return rows.map((row: any) => ({
      id: 0, // Not needed for search results
      fieldLabel: row.fieldLabel || '',
      fieldApiName: row.fieldApiName || '',
      objectLabel: row.objectLabel || '',
      objectApiName: row.objectApiName || '',
      dataType: row.dataType || '',
      description: row.description,
      helpText: row.helpText,
      formula: row.formula,
      picklistValues: row.picklistValues ? JSON.parse(row.picklistValues) : null,
      tags: row.tags ? JSON.parse(row.tags) : null,
      isRequired: Boolean(row.isRequired),
      isCustom: Boolean(row.isCustom),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

  } catch (error) {
    console.error('BigQuery search error:', error);
    
    // Return empty array on error rather than throwing
    // This allows the UI to show "no results" instead of an error
    return [];
  }
}

export async function testBigQueryConnection(): Promise<boolean> {
  try {
    const query = `SELECT 1 as test_connection`;
    const options = {
      query,
      location: 'US',
    };
    
    await bigquery.query(options);
    return true;
  } catch (error) {
    console.error('BigQuery connection test failed:', error);
    return false;
  }
}
