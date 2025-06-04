import OpenAI from "openai";
import { NLQEntity, NLQSearchPlan, SalesforceField, nlqEntitySchema, nlqSearchPlanSchema } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export async function generateSearchPlan(query: string): Promise<NLQSearchPlan> {
  try {
    const prompt = `
You are an expert at analyzing natural language queries about Salesforce metadata fields stored in a PostgreSQL database.

Available queryable fields in the salesforceFields table:
- fieldLabel: The display name of the field
- fieldApiName: The API name of the field  
- objectLabel: The Salesforce object name (Account, Contact, Opportunity, etc.)
- description: Field description text
- helpText: Help text for the field
- complianceCategory: Compliance/regulatory categories (PII, GDPR, etc.)
- tagIds: Comma-separated tags
- owners: Field owners
- stakeholders: Field stakeholders
- dataType: Field data type (Text, Currency, Picklist, etc.)
- picklistValues: Available picklist options
- ingestedBy: Systems that populate this field

Your knowledge should include common Salesforce objects like Account (for companies/organizations), Contact (for individuals), Lead (for prospects), Opportunity (for deals/sales), and Case (for customer issues/tickets).

CRITICAL: Object Inference Rules for targetObject (MUST follow these rules):
1. ALWAYS check for business terms and infer the most appropriate Salesforce object:
   - "customer," "client," "company," "organization," "account" → "Account"
   - "person," "individual," "people," "contact" → "Contact" 
   - "prospect," "lead," "new inquiry," "potential customer" → "Lead"
   - "deal," "sale," "opportunity," "revenue," "pipeline" → "Opportunity"
   - "issue," "ticket," "problem," "support," "case" → "Case"

2. Explicit object names ALWAYS override inference (e.g., "customer fields on Lead object" → "Lead")

3. When multiple business terms appear, prioritize the most specific or recent one

4. Only set targetObject: null if truly no business context can be inferred

Generate a structured search plan in this exact JSON format:

{
  "intent": "find_fields",
  "targetObject": "string or null",
  "filterGroups": [
    {
      "logicalOperator": "AND|OR",
      "conditions": [
        {
          "field": "column_name",
          "operator": "ilike|equals_ignore_case|contains_in_array_field",
          "value": "%search_term%" 
        }
      ]
    }
  ],
  "dataTypeFilter": {
    "field": "dataType",
    "operator": "ilike",
    "value": "%type%"
  } or null,
  "rawKeywords": ["extracted", "keywords"]
}

Examples:

Query: "Show me deal size fields on Opportunity"
{
  "intent": "find_fields",
  "targetObject": "Opportunity",
  "filterGroups": [
    {
      "logicalOperator": "OR",
      "conditions": [
        { "field": "fieldLabel", "operator": "ilike", "value": "%deal size%" },
        { "field": "description", "operator": "ilike", "value": "%deal size%" },
        { "field": "fieldLabel", "operator": "ilike", "value": "%amount%" },
        { "field": "description", "operator": "ilike", "value": "%amount%" }
      ]
    }
  ],
  "dataTypeFilter": { "field": "dataType", "operator": "ilike", "value": "%Currency%" },
  "rawKeywords": ["deal size", "Opportunity"]
}

Query: "What are the main fields for our customers?"
{
  "intent": "find_fields",
  "targetObject": "Account",
  "filterGroups": [
    {
      "logicalOperator": "OR",
      "conditions": [
        { "field": "fieldLabel", "operator": "ilike", "value": "%name%" },
        { "field": "fieldLabel", "operator": "ilike", "value": "%main%" },
        { "field": "description", "operator": "ilike", "value": "%key%" },
        { "field": "description", "operator": "ilike", "value": "%primary%" }
      ]
    }
  ],
  "dataTypeFilter": null,
  "rawKeywords": ["main fields", "customers"]
}

Query: "Show customer related fields on the Lead object"
{
  "intent": "find_fields",
  "targetObject": "Lead",
  "filterGroups": [
    {
      "logicalOperator": "OR",
      "conditions": [
        { "field": "fieldLabel", "operator": "ilike", "value": "%customer%" },
        { "field": "description", "operator": "ilike", "value": "%customer%" }
      ]
    }
  ],
  "dataTypeFilter": null,
  "rawKeywords": ["customer related", "Lead object"]
}

Query: "PII fields on Contact"
{
  "intent": "find_fields",
  "targetObject": "Contact",
  "filterGroups": [
    {
      "logicalOperator": "OR",
      "conditions": [
        { "field": "fieldLabel", "operator": "ilike", "value": "%PII%" },
        { "field": "description", "operator": "ilike", "value": "%PII%" },
        { "field": "complianceCategory", "operator": "ilike", "value": "%PII%" },
        { "field": "tagIds", "operator": "ilike", "value": "%PII%" },
        { "field": "description", "operator": "ilike", "value": "%sensitive data%" }
      ]
    }
  ],
  "dataTypeFilter": null,
  "rawKeywords": ["PII", "Contact"]
}

Query: "${query}"
Return only the JSON response:`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const parsed = JSON.parse(content);
    return nlqSearchPlanSchema.parse(parsed);
  } catch (error) {
    console.error("Error generating search plan:", error);
    
    // Fallback to simple search plan
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2);

    return {
      intent: "find_fields",
      targetObject: null,
      filterGroups: [{
        logicalOperator: "OR",
        conditions: keywords.flatMap(keyword => [
          { field: "fieldLabel", operator: "ilike", value: `%${keyword}%` },
          { field: "description", operator: "ilike", value: `%${keyword}%` }
        ])
      }],
      dataTypeFilter: null,
      rawKeywords: keywords
    };
  }
}

export async function extractEntitiesFromQuery(query: string): Promise<NLQEntity> {
  try {
    const prompt = `
You are an expert at analyzing natural language queries about Salesforce metadata. 

Extract the following information from the user's query and respond with JSON in this exact format:
{
  "object": "string or null", 
  "keywords": ["array", "of", "strings"],
  "dataType": "string or null",
  "intent": "find_fields"
}

Guidelines:
- object: Identify Salesforce object names (Account, Contact, Opportunity, Case, Lead, etc.). If none specified, use null.
- keywords: Extract key terms that could match field labels, descriptions, help text, or tags (PII, address, email, revenue, date, etc.)
- dataType: Identify field types if mentioned (date, picklist, currency, text, formula, etc.). If none specified, use null.
- intent: Always use "find_fields" for this MVP

Examples:
Query: "Show me all date fields on the Opportunity object"
Response: {"object": "Opportunity", "keywords": ["date"], "dataType": "date", "intent": "find_fields"}

Query: "What fields contain sensitive customer information?"
Response: {"object": null, "keywords": ["sensitive", "customer", "information", "PII"], "dataType": null, "intent": "find_fields"}

Query: "Find formula fields related to revenue calculation"
Response: {"object": null, "keywords": ["revenue", "calculation"], "dataType": "formula", "intent": "find_fields"}

Now analyze this query: "${query}"
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a Salesforce metadata expert. Extract entities from natural language queries and respond with valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const parsed = JSON.parse(content);
    return nlqEntitySchema.parse(parsed);
  } catch (error) {
    console.error("Error extracting entities:", error);
    
    // Fallback to simple keyword extraction
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'had', 'but', 'not', 'what', 'all', 'were', 'they', 'we', 'been', 'is', 'do', 'be', 'have', 'to', 'of', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'this', 'that', 'but', 'his', 'from', 'they', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their'].includes(word));

    return {
      object: null,
      keywords,
      dataType: null,
      intent: "find_fields" as const,
    };
  }
}

export function buildSearchSummary(plan: NLQSearchPlan, resultCount: number): string {
  const parts: string[] = [];
  
  if (plan.targetObject) {
    parts.push(`on ${plan.targetObject} object`);
  }
  
  if (plan.dataTypeFilter) {
    parts.push(`of type ${plan.dataTypeFilter.value}`);
  }
  
  // Extract keywords from filter groups or use raw keywords
  const keywords = plan.rawKeywords && plan.rawKeywords.length > 0 
    ? plan.rawKeywords 
    : plan.filterGroups.flatMap(group => 
        group.conditions.map(condition => condition.value)
      ).filter(value => typeof value === 'string' && value.length > 0);
  
  if (keywords.length > 0) {
    parts.push(`matching "${keywords.join(', ')}"`);
  }
  
  const summary = parts.length > 0 ? ` ${parts.join(' ')}` : '';
  return `Found ${resultCount} field${resultCount !== 1 ? 's' : ''}${summary}`;
}

export async function refineSearchResultsWithLLM(
  originalQuery: string,
  searchPlan: NLQSearchPlan,
  initialResults: SalesforceField[],
  maxResultsToRefine: number = 20,
  maxFieldsToReturn: number = 10
): Promise<SalesforceField[]> {
  try {
    // Return immediately if no results to refine
    if (initialResults.length === 0) {
      return initialResults;
    }

    // Select subset of results to send to LLM (limit for token management)
    const resultsToAnalyze = initialResults.slice(0, maxResultsToRefine);
    
    // Prepare field summaries for LLM analysis
    const fieldSummaries = resultsToAnalyze.map((field, index) => ({
      id: index,
      fieldLabel: field.fieldLabel,
      fieldApiName: field.fieldApiName,
      objectLabel: field.objectLabel,
      objectApiName: field.objectApiName,
      dataType: field.dataType,
      description: field.description ? field.description.substring(0, 200) + (field.description.length > 200 ? '...' : '') : null,
      helpText: field.helpText ? field.helpText.substring(0, 150) + (field.helpText.length > 150 ? '...' : '') : null,
      formula: field.formula ? field.formula.substring(0, 250) + (field.formula.length > 250 ? '...' : '') : null,
      tags: field.tagIds ? field.tagIds.split(',').map(tag => tag.trim()) : []
    }));

    // Build search plan summary for context
    const searchPlanSummary = [
      searchPlan.targetObject ? `object: ${searchPlan.targetObject}` : null,
      searchPlan.rawKeywords ? `keywords: ${searchPlan.rawKeywords.join(', ')}` : null,
      searchPlan.dataTypeFilter ? `dataType: ${searchPlan.dataTypeFilter.value}` : null
    ].filter(Boolean).join(', ');

    const prompt = `
You are an intelligent Salesforce Data Steward. Your task is to review a list of Salesforce fields found by an initial search and select the most relevant ones that best answer the user's original query.

Given the user query: "${originalQuery}"
And the initial search criteria: ${searchPlanSummary}

Here are ${resultsToAnalyze.length} fields found:
${JSON.stringify(fieldSummaries, null, 2)}

Please analyze these fields and identify up to ${maxFieldsToReturn} that are most relevant to the user's query.

Consider the following when evaluating relevance:
- Direct keyword matches in label, description, help text
- Semantic relevance: Does the field's purpose align with the query's intent?
- Clues in fieldLabel or fieldApiName: Terms like 'OLD', 'Legacy', 'Archived', 'Inactive', 'Deprecated' usually mean less relevance unless specifically asked for
- If the query implies a calculation, examine the formula field closely
- Consistency with dataType if specified or implied by the query
- Prefer fields with detailed descriptions over technical/system fields unless specifically requested

Respond with a JSON object in this exact format:
{
  "refinedFieldIdentifiers": [
    { "fieldApiName": "string", "objectApiName": "string", "reasoning": "Brief explanation why this field is highly relevant" }
  ],
  "overallReasoning": "Brief summary of why this set of fields was chosen"
}

The fieldApiName and objectApiName must exactly match one of the provided fields. If none are good matches, return empty refinedFieldIdentifiers array.`;

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      console.error("No response content from OpenAI refinement");
      return initialResults;
    }

    // Parse LLM response
    const refinementResult = JSON.parse(content);
    const { refinedFieldIdentifiers } = refinementResult;

    if (!Array.isArray(refinedFieldIdentifiers) || refinedFieldIdentifiers.length === 0) {
      // Return original results if LLM found no good matches
      return initialResults;
    }

    // Map refined identifiers back to original SalesforceField objects
    const refinedResults: SalesforceField[] = [];
    
    for (const identifier of refinedFieldIdentifiers) {
      const matchingField = initialResults.find(field => 
        field.fieldApiName === identifier.fieldApiName && 
        field.objectApiName === identifier.objectApiName
      );
      
      if (matchingField) {
        refinedResults.push(matchingField);
      }
    }

    return refinedResults;

  } catch (error) {
    console.error("Error refining search results with LLM:", error);
    // Return original results as fallback
    return initialResults;
  }
}
