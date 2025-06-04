import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { extractEntitiesFromQuery, buildSearchSummary } from "./nlq";
import { searchSalesforceFieldsInDB, testDatabaseConnection, getSalesforceFieldCount } from "./database-search";
import { queryRequestSchema, insertSalesforceFieldSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Configure multer for file uploads
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
        cb(null, true);
      } else {
        cb(new Error('Only CSV files are allowed'));
      }
    }
  });
  
  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      const dbHealth = await testDatabaseConnection();
      const fieldCount = await getSalesforceFieldCount();
      res.json({ 
        status: "ok", 
        database: dbHealth ? "connected" : "disconnected",
        fieldCount,
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
      
      // Search database for matching fields
      const results = await searchSalesforceFieldsInDB(entities);
      
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
        await storage.logQuery(req.body.query, { object: undefined, keywords: [], dataType: undefined, intent: "find_fields" }, 0, processingTime, false, errorMessage);
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

  // CSV Upload endpoint
  app.post("/api/upload-csv", upload.single('csvFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const csvData: any[] = [];
      const stream = Readable.from(req.file.buffer);
      
      // Parse CSV data
      await new Promise<void>((resolve, reject) => {
        stream
          .pipe(csv())
          .on('data', (row) => {
            csvData.push(row);
          })
          .on('end', () => {
            resolve();
          })
          .on('error', (error) => {
            reject(error);
          });
      });

      if (csvData.length === 0) {
        return res.status(400).json({ error: "CSV file is empty" });
      }

      // Transform CSV data to match our schema
      const salesforceFields = csvData.map((row) => {
        // Handle your specific CSV column names
        const fieldLabel = row.Label || row.fieldLabel || '';
        const fieldApiName = row.Name || row.fieldApiName || '';
        const objectLabel = row.ParentDisplayName || row.objectLabel || '';
        const objectApiName = row.ParentDisplayName || row.objectApiName || ''; // Using same as label for now
        const dataType = row.Type || row.dataType || 'text';
        const description = row.Description || row.description || '';
        const helpText = row.HelpText || row.helpText || '';
        const formula = row.Formula || row.formula || '';
        const isRequired = row.Required === 'TRUE' || row.Required === 'true' || row.isRequired === 'true';
        const isCustom = row.Custom === 'TRUE' || row.Custom === 'true' || row.isCustom === 'true';

        // Parse picklist values if they exist
        let picklistValues = null;
        const picklistString = row.PicklistValues || row.picklistValues || '';
        if (picklistString && picklistString.trim()) {
          // Split by comma and clean up
          picklistValues = picklistString.split(',').map((v: string) => v.trim()).filter((v: string) => v);
        }

        // Parse tags if they exist - using ComplianceCategory and other relevant fields
        let tags = [];
        if (row.ComplianceCategory && row.ComplianceCategory.trim()) {
          tags.push(row.ComplianceCategory.trim());
        }
        if (row.TagIds && row.TagIds.trim()) {
          const tagIds = row.TagIds.split(',').map((v: string) => v.trim()).filter((v: string) => v);
          tags = tags.concat(tagIds);
        }
        // Add data type as a tag for easier searching
        if (dataType) {
          tags.push(dataType);
        }
        const finalTags = tags.length > 0 ? tags : null;

        return {
          fieldLabel,
          fieldApiName,
          objectLabel,
          objectApiName,
          dataType,
          description: description || null,
          helpText: helpText || null,
          formula: formula || null,
          picklistValues,
          tags: finalTags,
          isRequired,
          isCustom,
        };
      }).filter(field => field.fieldLabel && field.fieldApiName); // Only include valid fields

      // Clear existing data and insert new data
      await storage.clearSalesforceFields();
      await storage.insertSalesforceFields(salesforceFields);

      res.json({
        message: "CSV uploaded successfully",
        recordsProcessed: salesforceFields.length,
        totalRows: csvData.length,
      });

    } catch (error) {
      console.error("CSV upload error:", error);
      res.status(500).json({ 
        error: "Failed to process CSV file",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // Get upload status
  app.get("/api/upload-status", async (req, res) => {
    try {
      const fieldCount = await getSalesforceFieldCount();
      res.json({
        hasData: fieldCount > 0,
        fieldCount,
        message: fieldCount > 0 ? `Database contains ${fieldCount} fields` : "No data uploaded yet"
      });
    } catch (error) {
      res.json({
        hasData: false,
        fieldCount: 0,
        message: "No data uploaded yet"
      });
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
