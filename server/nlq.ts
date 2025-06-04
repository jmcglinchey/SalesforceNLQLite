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

CRITICAL: DataType Inference Rules based on Keywords (for populating 'dataTypeFilter'):
Your primary goal here is to infer the most probable Salesforce field data type based on common language patterns in the user's query. Set 'dataTypeFilter.value' in the JSON plan accordingly. This inference is secondary to any explicit data type mentioned by the user (e.g., "show me all DATE fields").

1.  Monetary Terms: For keywords like "money", "cost", "price", "revenue", "amount", "value", "budget", "salary", "financial", "fee", "charge", infer 'dataTypeFilter.value' as "%Currency%".
2.  Temporal Terms: For "when", "date", "day", "month", "year", "time", "schedule", "deadline", "timestamp", "period", "duration", infer "%Date%" (matches "Date" or "Date/Time").
3.  Numerical/Count Terms: For "how many", "count", "quantity", "number of", "total", "sum" (when implying a count or simple number), infer "%Number%".
4.  Percentage Terms: For "what percent", "percentage", "rate", "ratio", "proportion", infer "%Percent%".
5.  Boolean/Checkbox Terms: For "is it true", "yes/no", "true/false", "active?", "enabled?", "flag", "checked?", "valid?", infer "Checkbox".
6.  Location/Address Terms: For "where", "location", "address", "city", "state", "zip", "country", "street", infer "%Address%" or "%Location%" or "%Text%".
7.  Email Terms: For "email", "email address", "e-mail", infer "%Email%".
8.  Phone Terms: For "phone", "phone number", "contact number", "fax", infer "%Phone%".
9.  URL/Link Terms: For "website", "URL", "link", "web page", "site", infer "%URL%".
10. Free-form Text Terms: If the query implies looking for descriptive text, notes, or long content (e.g., "description of", "notes about", "details for"), consider inferring "%Text%", "%TextArea%", or "%LongTextArea%".
11. Selection/Choice Terms: For "option", "choice", "status", "type" (as a selection), "category", "list", "dropdown", infer "%Picklist%" or "%MultiSelectPicklist%".
12. Formula/Calculation Terms: For "calculated", "formula", "derived", "computed", infer "%Formula%".
13. ID/Identifier Terms: For "ID", "identifier", "record ID", "key", infer "%ID%" or "%Text%".
14. Image/Picture Terms: For "picture", "image", "photo", "logo", consider "%URL%" (for image links) or "%RichText%" (if it implies embedded images).

General Guidelines for DataType Inference:
-   The 'dataTypeFilter.field' should always be "dataType".
-   The 'dataTypeFilter.operator' should usually be "ilike".
-   If a query implies multiple data types, choose the most dominant or primary one for the 'dataTypeFilter'. If unsure, or if no strong type is implied, set 'dataTypeFilter' to null.
-   These rules should complement, not replace, keyword searching in 'fieldLabel' and 'description' via 'filterGroups'.

CRITICAL: User Lookup / Ownership Inference Rules:
1. When queries contain terms like "who", "owner", "manager", "responsible for", "created by", "modified by", "assigned to", or "my" (when referring to owned records):
   a. Set 'dataTypeFilter' to: { "field": "dataType", "operator": "ilike", "value": "%Lookup(User)%" }
   b. Add relevant keywords like "owner", "user", "manager", "created", "modified" to the 'filterGroups' targeting 'fieldLabel' and 'description'.
2. For "my" queries (e.g., "my accounts"), assume "my" refers to an ownership context. Prioritize fields like "Account Owner" (which would be a Lookup(User)).
3. If a specific field name like "Account Owner" is mentioned, prioritize that in 'filterGroups' alongside setting the 'dataTypeFilter' for 'Lookup(User)'.

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

Query: "Who owns the Acme account?"
{
  "intent": "find_fields",
  "targetObject": "Account",
  "filterGroups": [
    {
      "logicalOperator": "OR",
      "conditions": [
        { "field": "fieldLabel", "operator": "ilike", "value": "%owner%" },
        { "field": "fieldLabel", "operator": "ilike", "value": "%Acme%" },
        { "field": "description", "operator": "ilike", "value": "%owner%" },
        { "field": "description", "operator": "ilike", "value": "%Acme%" }
      ]
    }
  ],
  "dataTypeFilter": { "field": "dataType", "operator": "ilike", "value": "%Lookup(User)%" },
  "rawKeywords": ["who", "owns", "Acme", "account"]
}

Query: "Show me my open opportunities"
{
  "intent": "find_fields",
  "targetObject": "Opportunity",
  "filterGroups": [
    {
      "logicalOperator": "OR",
      "conditions": [
        { "field": "fieldLabel", "operator": "ilike", "value": "%owner%" },
        { "field": "description", "operator": "ilike", "value": "%owner%" }
      ]
    },
    {
      "logicalOperator": "OR",
      "conditions": [
        { "field": "fieldLabel", "operator": "ilike", "value": "%open%" },
        { "field": "description", "operator": "ilike", "value": "%open%" }
      ]
    }
  ],
  "dataTypeFilter": { "field": "dataType", "operator": "ilike", "value": "%Lookup(User)%" },
  "rawKeywords": ["my", "open", "opportunities"]
}

Query: "Which user created this contact?"
{
  "intent": "find_fields",
  "targetObject": "Contact",
  "filterGroups": [
    {
      "logicalOperator": "OR",
      "conditions": [
        { "field": "fieldLabel", "operator": "ilike", "value": "%created by%" },
        { "field": "fieldLabel", "operator": "ilike", "value": "%user%" },
        { "field": "description", "operator": "ilike", "value": "%created by%" }
      ]
    }
  ],
  "dataTypeFilter": { "field": "dataType", "operator": "ilike", "value": "%Lookup(User)%" },
  "rawKeywords": ["user", "created", "contact"]
}

Query: "How much revenue did we make from the Acme deal?"
{
  "intent": "find_fields",
  "targetObject": "Opportunity",
  "filterGroups": [
    {
      "logicalOperator": "OR",
      "conditions": [
        { "field": "fieldLabel", "operator": "ilike", "value": "%revenue%" },
        { "field": "fieldLabel", "operator": "ilike", "value": "%amount%" },
        { "field": "description", "operator": "ilike", "value": "%revenue%" },
        { "field": "fieldLabel", "operator": "ilike", "value": "%Acme%" }
      ]
    }
  ],
  "dataTypeFilter": { "field": "dataType", "operator": "ilike", "value": "%Currency%" },
  "rawKeywords": ["how much", "revenue", "Acme", "deal"]
}

Query: "How do I know when a deal was closed?"
{
  "intent": "find_fields",
  "targetObject": "Opportunity",
  "filterGroups": [
    {
      "logicalOperator": "OR", 
      "conditions": [
        { "field": "fieldLabel", "operator": "ilike", "value": "%close%" },
        { "field": "fieldLabel", "operator": "ilike", "value": "%closed%" },
        { "field": "fieldLabel", "operator": "ilike", "value": "%won date%" },
        { "field": "description", "operator": "ilike", "value": "%close date%" },
        { "field": "description", "operator": "ilike", "value": "%when the deal closed%" }
      ]
    }
  ],
  "dataTypeFilter": { "field": "dataType", "operator": "ilike", "value": "%Date%" },
  "rawKeywords": ["when", "deal", "closed", "close", "won"]
}

Query: "When is the project deadline for case 00123?"
{
  "intent": "find_fields",
  "targetObject": "Case",
  "filterGroups": [
    {
      "logicalOperator": "OR",
      "conditions": [
        { "field": "fieldLabel", "operator": "ilike", "value": "%deadline%" },
        { "field": "fieldLabel", "operator": "ilike", "value": "%project end%" },
        { "field": "description", "operator": "ilike", "value": "%deadline%" },
        { "field": "fieldLabel", "operator": "ilike", "value": "%00123%" }
      ]
    }
  ],
  "dataTypeFilter": { "field": "dataType", "operator": "ilike", "value": "%Date%" },
  "rawKeywords": ["when", "project deadline", "case 00123"]
}

Query: "Is the high priority contact active?"
{
  "intent": "find_fields",
  "targetObject": "Contact",
  "filterGroups": [
    {
      "logicalOperator": "AND",
      "conditions": [
        { "field": "fieldLabel", "operator": "ilike", "value": "%active%" },
        { "field": "fieldLabel", "operator": "ilike", "value": "%high priority%" }
      ]
    }
  ],
  "dataTypeFilter": { "field": "dataType", "operator": "ilike", "value": "Checkbox" },
  "rawKeywords": ["high priority", "contact", "active"]
}

Query: "What are the status options for leads?"
{
  "intent": "find_fields",
  "targetObject": "Lead",
  "filterGroups": [
    {
      "logicalOperator": "OR",
      "conditions": [
        { "field": "fieldLabel", "operator": "ilike", "value": "%status%" },
        { "field": "description", "operator": "ilike", "value": "%status options%" }
      ]
    }
  ],
  "dataTypeFilter": { "field": "dataType", "operator": "ilike", "value": "%Picklist%" },
  "rawKeywords": ["status", "options", "leads"]
}

Query: "Show address for customer Alpha Corp"
{
  "intent": "find_fields",
  "targetObject": "Account",
  "filterGroups": [
    {
      "logicalOperator": "OR",
      "conditions": [
        { "field": "fieldLabel", "operator": "ilike", "value": "%address%" },
        { "field": "fieldLabel", "operator": "ilike", "value": "%location%" },
        { "field": "fieldLabel", "operator": "ilike", "value": "%Alpha Corp%" }
      ]
    }
  ],
  "dataTypeFilter": { "field": "dataType", "operator": "ilike", "value": "%Address%" },
  "rawKeywords": ["address", "customer", "Alpha Corp"]
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

async function getMatchConfidence(
  originalQuery: string,
  searchPlan: NLQSearchPlan,
  field: SalesforceField
): Promise<"High" | "Medium" | "Low" | null> {
  try {
    const prompt = `Context: You are an AI assistant evaluating the relevance of a Salesforce field to a user's query and the derived search plan.
Original User Query: "${originalQuery}"
Derived Search Plan: ${JSON.stringify(searchPlan)} 
Current Field Details:
  - Label: "${field.fieldLabel}"
  - API Name: "${field.fieldApiName}"
  - Object: "${field.objectLabel}"
  - Data Type: "${field.dataType}"
  - Description: "${field.description || 'N/A'}"
  - Help Text: "${field.helpText || 'N/A'}"
  - Tags: "${field.tagIds || 'N/A'}" 
  - Formula: ${field.formula ? "Yes" : "No"}

Task: Based on the Original User Query, the Derived Search Plan, and the Current Field Details, assess how well this specific field matches the user's likely intent.
Return ONLY one of the following confidence scores as a single word: "High", "Medium", or "Low".

Guidelines for Scoring:
- "High": Strong, direct match. Keywords from the query/plan appear in critical field attributes (Label, API Name, specific Tags). The field's object and type are highly relevant. The description clearly aligns with the query's intent. For example, if the query is about 'customer revenue on opportunities', a field named 'Opportunity.Amount' would be High.
- "Medium": Good partial or conceptual match. Some keywords match, or keywords match in less critical attributes (Description, Help Text). The object or type might be generally relevant but not a perfect fit. The field seems related but might not be the primary answer. For example, for 'customer revenue on opportunities', a field 'Account.AnnualRevenue' might be Medium if Opportunity context is primary.
- "Low": Weak or indirect match. Few or no keywords match directly. The field's purpose seems tangential. It might be a very broad match or related only by a common object without specific keyword relevance. For example, for 'customer revenue on opportunities', a field 'Opportunity.CloseDate' would be Low.

Output Example:
High`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 10,
    });

    const content = response.choices[0].message.content?.trim();
    if (content === "High" || content === "Medium" || content === "Low") {
      return content;
    }
    
    return null;
  } catch (error) {
    console.error("Error getting match confidence:", error);
    return null;
  }
}

export async function refineSearchResultsWithLLM(
  originalQuery: string,
  searchPlan: NLQSearchPlan,
  initialResults: SalesforceField[],
  maxResultsToRefine: number = 10,
  maxFieldsToReturn: number = 5
): Promise<Array<SalesforceField & { matchConfidence?: "High" | "Medium" | "Low" | null }>> {
  try {
    // Return immediately if no results to refine
    if (initialResults.length === 0) {
      return initialResults;
    }

    // Process up to maxResultsToRefine fields for confidence scoring
    const fieldsToProcess = initialResults.slice(0, maxResultsToRefine);
    
    // Add match confidence scores using LLM
    const fieldsWithConfidence = await Promise.all(
      fieldsToProcess.map(async (field) => {
        const matchConfidence = await getMatchConfidence(originalQuery, searchPlan, field);
        return { ...field, matchConfidence };
      })
    );

    // Add remaining fields without confidence scores
    const remainingFields = initialResults.slice(maxResultsToRefine).map(field => ({ ...field, matchConfidence: null }));
    
    // Combine all results
    const allFieldsWithConfidence = [...fieldsWithConfidence, ...remainingFields];

    // Sort by confidence first, then by existing scoring logic
    const confidenceOrder = { High: 1, Medium: 2, Low: 3 };
    
    const sortedResults = allFieldsWithConfidence.sort((a, b) => {
      // Primary sort: confidence level
      const confidenceA = a.matchConfidence || 'Low';
      const confidenceB = b.matchConfidence || 'Low';
      const orderA = confidenceOrder[confidenceA] || 4;
      const orderB = confidenceOrder[confidenceB] || 4;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // Secondary sort: documentation quality
      let scoreA = 0, scoreB = 0;
      if (a.description && a.description.length > 50) scoreA += 3;
      if (a.helpText && a.helpText.length > 20) scoreA += 2;
      if (b.description && b.description.length > 50) scoreB += 3;
      if (b.helpText && b.helpText.length > 20) scoreB += 2;
      
      return scoreB - scoreA;
    });

    return sortedResults.slice(0, maxFieldsToReturn);

  } catch (error) {
    console.error("Error refining search results:", error);
    return initialResults.map(field => ({ ...field, matchConfidence: null }));
  }
}

export async function generateResultsSummary(
  originalQuery: string,
  finalResults: SalesforceField[],
  maxFieldsToConsiderForSummary: number = 5
): Promise<string> {
  try {
    // Return default message for empty results
    if (finalResults.length === 0) {
      return "No specific fields found to summarize for this query.";
    }

    // Select subset of results for detailed consideration
    const fieldsToAnalyze = finalResults.slice(0, maxFieldsToConsiderForSummary);
    
    // Prepare field summaries for LLM analysis
    const fieldSummaries = fieldsToAnalyze.map(field => {
      const parts = [
        `Field: ${field.fieldLabel} (${field.fieldApiName}) on ${field.objectLabel}`,
        `Type: ${field.dataType}`
      ];
      
      if (field.description) {
        const desc = field.description.length > 150 
          ? field.description.substring(0, 150) + "..."
          : field.description;
        parts.push(`Description: ${desc}`);
      }
      
      if (field.helpText) {
        const help = field.helpText.length > 100
          ? field.helpText.substring(0, 100) + "..."
          : field.helpText;
        parts.push(`Help: ${help}`);
      }
      
      if (field.formula) {
        const formula = field.formula.length > 200
          ? field.formula.substring(0, 200) + "..."
          : field.formula;
        parts.push(`Formula: ${formula}`);
      }
      
      return parts.join(", ");
    });

    const prompt = `
You are an expert Salesforce data analyst. Your task is to provide a concise and helpful summary explaining how the provided Salesforce fields answer the user's original query. Focus on clarity and actionable insights.

Given the user's query: "${originalQuery}"
And the most relevant fields found:
${fieldSummaries.map((summary, i) => `${i + 1}. ${summary}`).join('\n')}

Please generate a natural language summary (2-4 sentences) that directly addresses the user's query using information from these fields.

Guidelines:
- If the query asks "how to calculate" something: Explain the logic, mention formulas if present, and identify key fields involved
- If the query asks "what" or "which" fields: Briefly state the purpose of key fields and mention the primary Salesforce objects
- Be concise and directly answer the user's question
- Avoid jargon where possible
- If the fields don't fully answer the query, acknowledge that while summarizing what was found
- Do not just list fields; synthesize information into a coherent explanation
- Base your response only on the provided field data

Return only the summary text, no additional formatting.`;

    // Call OpenAI for summary generation
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 300
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return "Unable to generate summary at this time.";
    }

    return content.trim();

  } catch (error) {
    console.error("Error generating results summary:", error);
    return "Unable to generate summary at this time.";
  }
}
