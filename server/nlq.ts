import OpenAI from "openai";
import { NLQEntity, nlqEntitySchema } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

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

export function buildSearchSummary(entities: NLQEntity, resultCount: number): string {
  const parts: string[] = [];
  
  if (entities.object) {
    parts.push(`on ${entities.object} object`);
  }
  
  if (entities.dataType) {
    parts.push(`of type ${entities.dataType}`);
  }
  
  if (entities.keywords.length > 0) {
    parts.push(`matching "${entities.keywords.join(', ')}"`);
  }
  
  const summary = parts.length > 0 ? ` ${parts.join(' ')}` : '';
  return `Found ${resultCount} field${resultCount !== 1 ? 's' : ''}${summary}`;
}
