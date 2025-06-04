import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { extractEntitiesFromQuery, buildSearchSummary } from "./nlq";
import { searchSalesforceFields, testBigQueryConnection } from "./bigquery";
import { queryRequestSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      const bigQueryHealth = await testBigQueryConnection();
      res.json({ 
        status: "ok", 
        bigquery: bigQueryHealth ? "connected" : "disconnected",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ 
        status: "error", 
        message: "Health check failed",
        timestamp: new Date().toISOString()
      });
    }
  });

  // Main NLQ search endpoint
  app.post("/api/search", async (req, res) => {
    const startTime = Date.now();
    
    try {
      // Validate request body
      const { query } = queryRequestSchema.parse(req.body);
      
      // Extract entities using OpenAI
      const entities = await extractEntitiesFromQuery(query);
      
      // Search BigQuery for matching fields
      const results = await searchSalesforceFields(entities);
      
      // Calculate processing time
      const processingTime = Date.now() - startTime;
      
      // Log the query for analytics
      await storage.logQuery(query, entities, results.length, processingTime, true);
      
      // Build search summary
      const summary = buildSearchSummary(entities, results.length);
      
      res.json({
        query,
        entities,
        results,
        resultCount: results.length,
        summary,
        processingTimeMs: processingTime,
      });
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      // Log failed query
      if (req.body.query) {
        await storage.logQuery(req.body.query, { object: null, keywords: [], dataType: null, intent: "find_fields" }, 0, processingTime, false, errorMessage);
      }
      
      console.error("Search error:", error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          error: "Invalid request", 
          details: error.errors,
          message: "Please provide a valid query"
        });
      } else {
        res.status(500).json({ 
          error: "Search failed", 
          message: "Unable to process your query. Please try rephrasing your question or check the example queries.",
          processingTimeMs: processingTime
        });
      }
    }
  });

  // Get recent queries for analytics (optional)
  app.get("/api/queries/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const recentQueries = await storage.getRecentQueries(limit);
      res.json(recentQueries);
    } catch (error) {
      console.error("Error fetching recent queries:", error);
      res.status(500).json({ error: "Failed to fetch recent queries" });
    }
  });

  // Example queries endpoint
  app.get("/api/examples", (req, res) => {
    const examples = [
      "Show me all picklist fields on the Account object",
      "What fields contain sensitive customer information?", 
      "Find formula fields related to revenue calculation",
      "Show me address fields on Contact object",
      "What date fields are available on Case object?",
      "Find all custom fields on Opportunity"
    ];
    
    res.json({ examples });
  });

  const httpServer = createServer(app);
  return httpServer;
}
