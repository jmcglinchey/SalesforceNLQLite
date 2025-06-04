import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { extractEntitiesFromQuery, generateSearchPlan, buildSearchSummary, refineSearchResultsWithLLM, generateResultsSummary } from "./nlq";
import { searchSalesforceFieldsInDB, searchSalesforceObjectsInDB, testDatabaseConnection, getSalesforceFieldCount } from "./database-search";
import { queryRequestSchema, insertSalesforceFieldSchema, insertSalesforceObjectSchema } from "@shared/schema";
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

  // Enhanced NLQ search endpoint with structured planning
  app.post("/api/search", async (req, res) => {
    const startTime = Date.now();
    
    try {
      // Validate request body
      const { query } = queryRequestSchema.parse(req.body);
      
      // Generate structured search plan using OpenAI
      const searchPlan = await generateSearchPlan(query);
      
      // Search database based on intent
      let fieldResults: any[] = [];
      let objectResults: any[] = [];
      let narrativeSummary = "No information found for this query.";
      let summary = "No results.";
      let refinementDetails = null;

      if (searchPlan.intent === "find_objects") {
        objectResults = await searchSalesforceObjectsInDB(searchPlan);
        summary = `Found ${objectResults.length} object(s)`;
        if (objectResults.length > 0) {
          narrativeSummary = `Discovered ${objectResults.length} Salesforce object(s) related to your query. Key objects include: ${objectResults.slice(0,3).map(o => o.objectLabel).join(', ')}.`;
        }
        refinementDetails = {
          initialCount: objectResults.length,
          refinedCount: objectResults.length,
          applied: false,
          reason: "Object search does not use refinement"
        };
      } else if (searchPlan.intent === "find_fields") {
        const initialResults = await searchSalesforceFieldsInDB(searchPlan);
        
        // Apply LLM refinement and confidence scoring to field results
        let refinedResults = initialResults;
        
        if (initialResults.length > 0) {
          try {
            const refinementStartTime = Date.now();
            refinedResults = await refineSearchResultsWithLLM(query, searchPlan, initialResults);
            
            const refinementTime = Date.now() - refinementStartTime;
            refinementDetails = {
              initialCount: initialResults.length,
              refinedCount: refinedResults.length,
              refinementTimeMs: refinementTime,
              applied: true
            };
          } catch (error) {
            console.error("LLM refinement failed, using initial results:", error);
            refinedResults = initialResults.map(field => ({ ...field, matchConfidence: null }));
            refinementDetails = {
              initialCount: initialResults.length,
              refinedCount: initialResults.length,
              applied: false,
              error: "Refinement failed"
            };
          }
        } else {
          refinementDetails = {
            initialCount: initialResults.length,
            refinedCount: initialResults.length,
            applied: false,
            reason: "No results to process"
          };
        }
        
        fieldResults = refinedResults;
        summary = buildSearchSummary(searchPlan, fieldResults.length);
        narrativeSummary = fieldResults.length > 0 
          ? await generateResultsSummary(query, fieldResults)
          : "No specific fields found to summarize for this query.";
      }
      
      // Calculate total processing time
      const processingTime = Date.now() - startTime;
      
      // Convert search plan to legacy entity format for logging
      const legacyEntities = {
        object: searchPlan.targetObject,
        keywords: searchPlan.rawKeywords || [],
        dataType: searchPlan.dataTypeFilter?.value as string || null,
        intent: searchPlan.intent === "find_objects" ? "find_fields" : searchPlan.intent // Map find_objects to find_fields for logging compatibility
      };
      
      // Calculate result count based on intent
      const resultCount = searchPlan.intent === "find_objects" ? objectResults.length : fieldResults.length;
      
      // Enhanced logging
      const logMessage = searchPlan.intent === "find_objects" 
        ? `Object search returned ${objectResults.length} results`
        : refinementDetails?.applied 
          ? `Refined from ${refinementDetails.initialCount} to ${fieldResults.length} results`
          : `Field search returned ${fieldResults.length} results`;
      
      await storage.logQuery(query, legacyEntities, resultCount, processingTime, true, logMessage);
      
      res.json({
        query,
        entities: searchPlan, // Include search plan as entities for frontend compatibility
        fieldResults,       // Array of SearchResult (fields)
        objectResults,      // Array of SalesforceObject 
        results: fieldResults, // Backward compatibility - keep existing results field for fields
        resultCount,
        summary,
        narrativeSummary,
        processingTimeMs: processingTime,
        refinementDetails
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
      // Remove BOM if present
      let buffer = req.file.buffer;
      if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        buffer = buffer.slice(3);
      }
      const stream = Readable.from(buffer);
      
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

      // Transform CSV data to match our expanded schema
      const salesforceFields = csvData.map((row) => {
        // Core field information - trim whitespace and handle empty values
        const fieldLabel = (row.Label || '').trim();
        const fieldApiName = (row.Name || '').trim();
        const objectLabel = (row.ParentDisplayName || '').trim();
        const objectApiName = (row.ParentDisplayName || '').trim(); // Using same as label for now
        const dataType = (row.Type || 'text').trim();
        
        // Field metadata - handle empty strings as null
        const picklistValues = row.PicklistValues && row.PicklistValues.trim() ? row.PicklistValues.trim() : null;
        const ingestedBy = row.IngestedBy && row.IngestedBy.trim() ? row.IngestedBy.trim() : null;
        const populatedBy = row.PopulatedBy && row.PopulatedBy.trim() ? row.PopulatedBy.trim() : null;
        const notes = row.Notes && row.Notes.trim() ? row.Notes.trim() : null;
        const definition = row.Definition && row.Definition.trim() ? row.Definition.trim() : null;
        const description = row.Description && row.Description.trim() ? row.Description.trim() : null;
        const helpText = row.HelpText && row.HelpText.trim() ? row.HelpText.trim() : null;
        const formula = row.Formula && row.Formula.trim() ? row.Formula.trim() : null;
        
        // Compliance and sensitivity
        const complianceCategory = row.ComplianceCategory && row.ComplianceCategory.trim() ? row.ComplianceCategory.trim() : null;
        const fieldUsageId = row.FieldUsageId && row.FieldUsageId.trim() ? row.FieldUsageId.trim() : null;
        const dataSensitivityLevelId = row.DataSensitivityLevelId && row.DataSensitivityLevelId.trim() ? row.DataSensitivityLevelId.trim() : null;
        
        // Ownership and stakeholders
        const owners = row.Owners && row.Owners.trim() ? row.Owners.trim() : null;
        const stakeholders = row.Stakeholders && row.Stakeholders.trim() ? row.Stakeholders.trim() : null;
        const isFollowing = row.IsFollowing === 'TRUE' || row.IsFollowing === 'true';
        const tagIds = row.TagIds && row.TagIds.trim() ? row.TagIds.trim() : null;
        
        // Field properties
        const isCustom = row.Custom === 'TRUE' || row.Custom === 'true';
        const isRequired = row.Required === 'TRUE' || row.Required === 'true';
        const isUnique = row.Unique === 'TRUE' || row.Unique === 'true';
        const defaultValue = row.DefaultValue && row.DefaultValue.trim() ? row.DefaultValue.trim() : null;
        const scale = row.Scale && row.Scale.trim() ? parseInt(row.Scale) : null;
        
        // Audit fields
        const createdBy = row.CreatedBy && row.CreatedBy.trim() ? row.CreatedBy.trim() : null;
        const salesforceCreatedDate = row.CreatedDate && row.CreatedDate.trim() ? row.CreatedDate.trim() : null;
        const lastModifiedBy = row.LastModifiedBy && row.LastModifiedBy.trim() ? row.LastModifiedBy.trim() : null;
        const salesforceLastModifiedDate = row.LastModifiedDate && row.LastModifiedDate.trim() ? row.LastModifiedDate.trim() : null;
        const managedPackage = row.ManagedPackage && row.ManagedPackage.trim() ? row.ManagedPackage.trim() : null;
        
        // Usage statistics
        const populationPercentage = row.PopulationPercentage && row.PopulationPercentage.trim() ? parseInt(row.PopulationPercentage) : null;
        const referenceCount = row.ReferenceCount && row.ReferenceCount.trim() ? parseInt(row.ReferenceCount) : null;
        const populatedAndTotalRecords = row.PopulatedAndTotalRecords && row.PopulatedAndTotalRecords.trim() ? row.PopulatedAndTotalRecords.trim() : null;
        const sourceUrl = row.SourceUrl && row.SourceUrl.trim() ? row.SourceUrl.trim() : null;

        return {
          fieldLabel,
          fieldApiName,
          objectLabel,
          objectApiName,
          dataType,
          picklistValues,
          ingestedBy,
          populatedBy,
          notes,
          definition,
          description,
          helpText,
          formula,
          complianceCategory,
          fieldUsageId,
          dataSensitivityLevelId,
          owners,
          stakeholders,
          isFollowing,
          tagIds,
          isCustom,
          isRequired,
          isUnique,
          defaultValue,
          scale,
          createdBy,
          salesforceCreatedDate,
          lastModifiedBy,
          salesforceLastModifiedDate,
          managedPackage,
          populationPercentage,
          referenceCount,
          populatedAndTotalRecords,
          sourceUrl,
        };
      }).filter(field => field.fieldLabel && field.fieldApiName && field.objectLabel); // Only include valid fields with all required data

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
      const objectCount = await storage.getSalesforceObjectCount();
      const hasFieldData = fieldCount > 0;
      const hasObjectData = objectCount > 0;
      
      res.json({
        hasData: hasFieldData, // Keep backward compatibility
        hasFieldData,
        hasObjectData,
        fieldCount,
        objectCount,
        message: hasFieldData ? `Database contains ${fieldCount} fields` : "No field data uploaded yet"
      });
    } catch (error) {
      res.json({
        hasData: false,
        hasFieldData: false,
        hasObjectData: false,
        fieldCount: 0,
        objectCount: 0,
        message: "No data uploaded yet"
      });
    }
  });

  // Object CSV Upload endpoint
  app.post("/api/upload-objects-csv", upload.single('csvFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const csvData = req.file.buffer.toString('utf-8');
      const results: any[] = [];

      // Parse CSV data
      await new Promise((resolve, reject) => {
        const stream = Readable.from([csvData]);
        stream
          .pipe(csv())
          .on('data', (row) => {
            results.push(row);
          })
          .on('end', resolve)
          .on('error', reject);
      });

      // Transform and validate the data based on actual CSV columns
      const transformedObjects = results.map((row) => {
        const objectLabel = row.Name || '';
        const objectApiName = row.ApiName || '';
        const description = row.Description && row.Description.trim() ? row.Description.trim() : null;
        const pluralLabel = null; // Not in CSV
        const keyPrefix = null; // Not in CSV
        const isCustom = row.IsCustom === 'TRUE' || row.IsCustom === 'true' || row.IsCustom === '1' || row.IsCustom === 1;
        const tags = null; // Not in CSV
        const sharingModel = null; // Not in CSV

        return {
          objectLabel,
          objectApiName,
          description,
          pluralLabel,
          keyPrefix,
          isCustom,
          tags,
          sharingModel
        };
      }).filter(obj => obj.objectLabel && obj.objectApiName);

      // Validate using schema
      const validatedObjects = transformedObjects.map(obj => 
        insertSalesforceObjectSchema.parse(obj)
      );

      // Clear existing data and insert new data
      await storage.clearSalesforceObjects();
      await storage.insertSalesforceObjects(validatedObjects);

      res.json({
        message: `Successfully uploaded ${validatedObjects.length} Salesforce objects`,
        recordsProcessed: validatedObjects.length,
        totalRows: results.length,
        objectCount: validatedObjects.length
      });

    } catch (error) {
      console.error("Object CSV upload error:", error);
      res.status(500).json({ 
        error: "Failed to upload object CSV",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // Clear objects data endpoint
  app.post("/api/clear-objects", async (req, res) => {
    try {
      await storage.clearSalesforceObjects();
      res.json({
        message: "Successfully cleared all Salesforce objects data",
        objectCount: 0
      });
    } catch (error) {
      console.error("Clear objects error:", error);
      res.status(500).json({ 
        error: "Failed to clear objects data",
        message: error instanceof Error ? error.message : "Unknown error occurred"
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
