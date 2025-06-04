## Product Requirements Document: Lite NLQ for Salesforce Data Dictionary

Version: 0.2  
Date: \[Current Date\]  
Author/Owner: \[Your Name/Team\]  
---

### 1\. Introduction / Overview

This document outlines the requirements for a "Lite" Natural Language Query (NLQ) application designed to interface with a snapshot of a Salesforce Data Dictionary. The primary purpose of this application is to provide non-technical internal users with an easy-to-use interface to query and understand metadata about Salesforce objects and fields. The application will initially work off a pre-existing BigQuery table containing the Salesforce metadata schema. The core philosophy emphasizes an MVP-first approach, focusing on simplicity, clear value through common queries, and leveraging a snapshot-based data foundation.  
---

### 2\. Goals / Objectives

* Primary Goal: Enable non-technical users to successfully find key information (field's purpose, data type, and location/object) for \[Best Guess Assumption: 75%\] of their common field-related questions within an average of \[Best Guess Assumption: 2-3 queries\] without needing direct assistance from a technical team member.  
* MVP Goal: Deliver a simple, intuitive NLQ interface that allows users to find and understand Salesforce field metadata based on keywords, object context, and basic concepts.  
* Value Proposition: Provide a quick and accessible way for non-technical users to self-serve answers about Salesforce metadata, reducing their reliance on technical teams for common data dictionary lookups and improving their ability to leverage Salesforce data effectively (e.g., for reporting).  
* Technical Goal: Prove the viability of using a smaller, faster LLM (e.g., GPT-3.5-turbo or similar) for intent recognition and query translation against a structured metadata export.

---

### 3\. Target Audience / User Personas

* Primary Users: Non-technical internal team members.  
  * Examples: Business Analysts, Sales Managers, Sales Representatives, Customer Service Representatives.  
*   
* Key Characteristics:  
  * Familiar with Salesforce from a user perspective.  
  * Need to understand what data is available and what fields mean, often for reporting or understanding business processes.  
  * Likely not familiar with Salesforce object/field API names or SOQL.  
  * Value ease of use and quick answers.  
*   
* User Persona Examples (Illustrative):  
  * Persona 1: Sarah the Sales Manager  
    * Goal: Wants to create ad-hoc reports on team performance and opportunity pipeline. Needs to quickly find specific fields (e.g., "Close Date," "ARR," "Lead Source") and understand if they are standard or custom calculated fields.  
    * Pain Point: Currently has to ask a Salesforce Admin or BI team member for field details, which causes delays.  
    * Technical Comfort: Uses Salesforce daily, proficient with Excel/Sheets, but not a "technical" user.  
  *   
  * Persona 2: David the Business Analyst  
    * Goal: Needs to understand data lineage and field definitions when analyzing business processes or requirements for new Salesforce enhancements. Often investigates how certain key metrics are calculated.  
    * Pain Point: Sifting through extensive Salesforce setup menus or outdated documentation is time-consuming and sometimes confusing.  
    * Technical Comfort: Comfortable with data concepts, can read simple formulas, but not a Salesforce developer.  
  *   
* 

---

### 4\. User Stories / Use Cases

(These are initial high-level stories based on the brain dump and require further detail, prioritization, and validation)

* As Sarah the Sales Manager, I want to search for fields related to "deal size" on the "Opportunity" object, so that I can identify the correct fields for my quarterly revenue report.  
* As David the Business Analyst, I want to find all fields on the "Case" object that are of "picklist" type and contain "status", so that I can understand case resolution pathways.  
* As a Customer Service Rep, I want to understand how the "Service Level" field on a "Case" is determined, so that I can explain response times to a customer.  
* As any non-technical user, I want to type a question like "what fields show sensitive customer info on contacts?" so that I can quickly find fields potentially tagged as PII.  
* As any user, I want to see example questions when I first open the app, so that I can understand how to best phrase my queries.  
* As any user, I want to clearly see the data type and a concise description for any field returned in my search, so that I can quickly understand its purpose and format.  
* As any user, if a field is calculated, I want to see the underlying formula, so that I can get a basic understanding of its derivation, even if I need to ask an admin for a full explanation of complex logic.  
* As any user, I want to be able to click on a field in the results so that I can see more details like its full help text or all possible picklist values.

---

### 5\. Functional Requirements

5.1 Data Foundation:

* FR1.1: The application MUST query a designated BigQuery table which acts as the snapshot of the Salesforce metadata dictionary.  
* FR1.2: The application MUST be able to parse and utilize the following data points (at a minimum) for each field from the BigQuery table:  
  * Field Label  
  * Field API Name  
  * Object Label (of the object the field belongs to)  
  * Object API Name  
  * Data Type  
  * Description  
  * Help Text  
  * Formula (if the field is a formula field)  
  * Picklist Values (if applicable)  
  * Pre-computed "Tags" or "Categories" (e.g., "PII", "Address", "Contact Info", "Financial") associated with fields to aid conceptual search.  
* 

5.2 NLQ Engine & Logic:

* FR2.1: Intent Recognition: The system MUST interpret user's natural language queries to identify their intent (e.g., find fields).  
  * FR2.1.1: Support keyword spotting (e.g., "Show me fields," "What fields," "List fields").  
  * FR2.1.2: Employ simple pattern matching (e.g., regex) for common phrasings.  
*   
* FR2.2: Entity Extraction: The system MUST extract key entities from the user query.  
  * FR2.2.1: Object: Identify Salesforce object names (e.g., "Account", "Opportunity") from the query. If no object is specified, assume "any" (or prompt user to specify).  
  * FR2.2.2: Keywords/Concepts: Identify keywords or concepts (e.g., "address," "email," "PII," user-provided terms) to search within field labels, descriptions, help text, or pre-computed tags.  
  * FR2.2.3: Data Type: Identify desired field data types (e.g., "date," "picklist") if specified by the user. If no data type is specified, assume "any."  
*   
* FR2.3: LLM Integration (MVP):  
  * FR2.3.1: Utilize a smaller, faster LLM (e.g., GPT-3.5-turbo, or a local model like a quantized Llama/Mistral if feasible and aligned with "lite" philosophy) for entity extraction.  
  * FR2.3.2: Employ prompt engineering to instruct the LLM to return extracted entities in a structured format (e.g., JSON: {"object": "...", "keywords": \["...", "..."\], "dataType": "..."}).  
*   
* FR2.4: Query Translation:  
  * FR2.4.1: The system MUST translate the extracted entities into a structured query (e.g., SQL) executable against the BigQuery data store.  
*   
* FR2.5: Search Scope:  
  * FR2.5.1: Users MUST be able to query for fields by keywords present in the field's label, description, help text, or \[Best Guess Assumption:\] associated tags.  
  * FR2.5.2: Users MUST be able to filter search results by a specific Salesforce object.  
  * FR2.5.3: Users MUST be able to query by common data types (e.g., "show me all date fields").  
  * FR2.5.4: The system SHOULD recognize common concepts like "PII," "address," "email" primarily through matching against pre-defined tags in the data.  
*   
* FR2.6: Synonym Handling (Basic MVP):

5.3 User Interface (UI) & User Experience (UX):

* FR3.1: Input:  
  * FR3.1.1: Provide a simple text box for users to input their natural language query.  
  * FR3.1.2: Provide an "Ask" (or similar, e.g., "Search") button to submit the query.  
*   
* FR3.2: Output/Results Display:  
  * FR3.2.1: Display query results in a clear, tabular format.  
  * FR3.2.2: The results table MUST include at least: Field Label, Field API Name, Object Label, a snippet of the Description (e.g., first 100 characters), and Data Type.  
  * FR3.2.3: If a field is a formula field, its formula (from the BigQuery table) MUST be displayable. Do your best to summarize the calculation for humans  
  * FR3.2.4: Display a "No results found. Try rephrasing your question or see example queries." message when applicable.  
*   
* FR3.3: Detailed View:  
  * FR3.3.1: Provide an option for users to click on a field (e.g., its label) in the results list to see more details.  
  * FR3.3.2: The detailed view MUST show (if available from BigQuery): Full Description, Full Help Text, All Picklist Values (if applicable).  
*   
* FR3.4: Feedback & Guidance:  
  * FR3.4.1: Display a "Thinking..." or loading indicator (e.g., spinner) while the query is being processed.  
  * FR3.4.2: Provide 3-5 example questions prominently on the UI (e.g., below the search box or as placeholder text) to guide users.  
* 

---

### 6\. Non-Functional Requirements

* NFR1.1 Performance:  
  * NFR1.1.1: 90% of query responses for common searches should be returned to the user interface within \[Best Guess Assumption: 5 seconds\].  
  * NFR1.1.2: The UI should remain responsive during query processing (i.e., no browser freeze).  
*   
* NFR1.2 Usability:  
  * NFR1.2.1: The application must be intuitive and easy to use for the defined non-technical Salesforce users with minimal (e.g., a short 1-page guide or 2-min video) to no training.  
  * NFR1.2.2: Error messages should be clear, user-friendly, and suggest corrective actions where possible.  
  * NFR1.2.3: The application should strive to meet \[Best Guess Assumption: WCAG 2.1 Level AA\] accessibility guidelines.  
*   
* NFR1.3 Scalability (Data Source):  
  * NFR1.3.1: The application must be able to efficiently query the BigQuery metadata table, assuming a table size of up to \[Best Guess Assumption: 1 million rows, representing fields from all standard and custom objects in a large Salesforce org\].  
*   
* NFR1.4 Security:  
  * NFR1.4.1: \[Best Guess Assumption:\] User access to the application will be controlled via existing company Single Sign-On (SSO).  
  * NFR1.4.2: \[Best Guess Assumption:\] The application's service account for accessing BigQuery must have read-only, least-privilege access to only the specified metadata table.  
  * NFR1.4.3: No sensitive data (beyond metadata itself) should be stored or logged by the application unless explicitly required and secured.  
*   
* NFR1.5 Maintainability:  
  * NFR1.5.1: Prompt engineering for the LLM should be well-documented within the codebase/project documentation and easily updatable by a developer.  
  * NFR1.5.2: Configuration for connecting to BigQuery (e.g., project ID, table name) should be externalized from code (e.g., environment variables).  
* 

---

### 7\. Design Considerations / Mockups

* UI Simplicity: The UI should be extremely clean, minimalist, and uncluttered, focusing the user on the query input and the returned results.  
* Key UI Elements (from brain dump):  
  * Single, prominent text input field for the natural language query.  
  * Clear "Ask" / "Search" button.  
  * Tabular results display with sortable columns (e.g., by Field Label, Object Label).  
  * Clickable elements in the table to trigger the detailed view.  
  * Modal or slide-in panel for the detailed field view.  
* 

---

### 8\. Success Metrics

* SM1. Task Completion Rate: % of users who successfully find the field information they are looking for (defined as identifying the field's API name, purpose via description, and object). Target: \[Best Guess Assumption: \>= 75%\].  
* SM2. Query Efficiency: Average number of queries needed by a user to find the desired information per session. Target: \[Best Guess Assumption: \<= 3 queries\].  
* SM3. User Adoption Rate: % of target users (identified BAs, Sales Managers, etc.) actively using the application at least once per week, 1 month after launch. Target: \[Best Guess Assumption: \>= 20%\].  
* SM4. User Satisfaction: Measured via a simple in-app feedback mechanism (e.g., "Was this helpful? Yes/No") or a short survey post-launch. Target: \[Best Guess Assumption: \>= 70% positive responses or a CSAT score \> 3.5/5\].  
* SM5. Reduction in Support Queries (Qualitative initially): Anecdotal feedback from Salesforce admins/BI team on whether they perceive a reduction in basic field metadata questions. (Quantitative target: TBD post-MVP if measurable).  
* SM6. NLQ Engine Intent Recognition Accuracy (Internal Metric): % of test queries correctly understood (entities extracted correctly) by the NLQ engine. Target: \[Best Guess Assumption: \>= 80%\] on a predefined test set.

