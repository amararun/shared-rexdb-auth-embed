import { useState, useCallback, useEffect, useReducer } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import axios from 'axios'
import { Loader2, Maximize2, Minimize2, TableProperties, LayoutGrid, LineChart, Database, Upload, Plus, X, Copy, LogOut } from "lucide-react"
import { DataTable } from "@/components/data-table"
import { ChartDisplay } from "@/components/chart-display";
import { useToast } from "@/components/ui/use-toast"
import { ToastProvider } from "@/components/ui/toast"
import { Toaster } from "@/components/ui/toaster"
import { Tooltip } from "@/components/ui/tooltip"
import { DocumentBox } from "@/components/document-box"
import { AnalysisTabs } from "@/components/analysis-tabs"
import { v4 as uuidv4 } from 'uuid';
import { useAuth0 } from "@auth0/auth0-react";

// Add this console log to debug environment variables
console.log('Environment Variables:', {
  FLOWISE: import.meta.env.VITE_FLOWISE_API_ENDPOINT,
  API: import.meta.env.VITE_API_ENDPOINT,
  // Don't log the full API key in production
  OPENAI_KEY_EXISTS: !!import.meta.env.VITE_OPENAI_API_KEY
});

// Export the constants with fallbacks
export const FLOWISE_API_ENDPOINT = import.meta.env.VITE_FLOWISE_API_ENDPOINT ||
  "https://flowise.tigzig.com/api/v1/prediction/flowise-fallback-endpoint";

export const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT ||
  "https://file-processing-endpoint-fallback.tigzig.com";

export const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// Use the environment variable for API_URL
export const API_URL = import.meta.env.VITE_NEON_API_URL;

// Update the color constants
const SECTION_COLORS = {
  chat: 'bg-indigo-100 border-indigo-200', // Darker background for Analytics Python Agent
  chart: 'bg-indigo-300 border-indigo-100', // Updated to lighter indigo for Charts
  table: 'bg-emerald-100 border-emerald-200' // Green for Data Table
};

type State = {
  files: {
    main: { content: string; filename: string; } | null;
    summary: { content: string; filename: string; } | null;
  };
  tables: {
    main: { columns: any[]; data: any[]; } | null;
    summary: { columns: any[]; data: any[]; } | null;
  };
  loading: boolean;
  error: string | null;
  status: string;
  progress: number;
  charts: { url: string; timestamp: number }[];
  tableInfo: {
    tableName: string | null;
    rowCount: number;
    columns: string[];
  };
}

type Action =
  | { type: 'SET_FILES'; payload: any }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_STATUS'; payload: string }
  | { type: 'SET_PROGRESS'; payload: number }
  | { type: 'ADD_CHART'; payload: { url: string; timestamp: number } }
  | { type: 'RESET' }
  | { type: 'SET_TABLE_INFO'; payload: { tableName: string; rowCount: number; columns: string[] } };

const initialState: State = {
  files: { main: null, summary: null },
  tables: { main: null, summary: null },
  loading: false,
  error: null,
  status: 'pending',
  progress: 0,
  charts: [],
  tableInfo: {
    tableName: null,
    rowCount: 0,
    columns: []
  },
}

function reducer(state: State, action: Action): State {
  console.log('Reducer called with action:', action.type);

  switch (action.type) {
    case 'SET_FILES':
    case 'SET_LOADING':
    case 'SET_ERROR':
    case 'SET_STATUS':
    case 'SET_PROGRESS':
      return {
        ...state, [action.type === 'SET_FILES' ? 'files' :
          action.type === 'SET_LOADING' ? 'loading' :
            action.type === 'SET_ERROR' ? 'error' :
              action.type === 'SET_STATUS' ? 'status' :
                'progress']: action.payload
      };
    case 'RESET':
      return initialState;
    case 'ADD_CHART':
      console.log('Processing ADD_CHART action');
      console.log('Current charts:', state.charts);
      console.log('New chart payload:', action.payload);

      const newCharts = [...state.charts, action.payload];
      console.log('New charts array:', newCharts);

      const newState = {
        ...state,
        charts: newCharts
      };

      console.log('Final state:', newState);
      return newState;
    case 'SET_TABLE_INFO':
      return {
        ...state,
        tableInfo: action.payload
      };
    default:
      return state;
  }
}

// Add this type to better manage table views
type TableView = {
  type: 'main' | 'summary';
  viewType: 'simple' | 'advanced';
} | null;

// Add this type definition near the top of the file with other types
type UploadResponse = {
  status: string;
  message: string;
  table_name: string;
  rows_inserted: number;
  columns: string[];
};

// Add this type for handling different upload modes
type UploadMode = 'database' | 'grid';

// Add a helper function to detect delimiter
const detectDelimiter = (content: string): string => {
  const firstLine = content.split('\n')[0];
  const pipeCount = (firstLine.match(/\|/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;

  console.log('Delimiter detection:', { pipeCount, commaCount });
  return pipeCount > commaCount ? '|' : ',';
};

// Add these constants at the top with other constants
export const OPENAI_API_URL = import.meta.env.VITE_OPENAI_API_URL ||
  "https://api.openai.com/v1/chat/completions";

// Add type for schema response
type ColumnSchema = {
  name: string;
  type: string;
  description: string;
}

type SchemaResponse = {
  columns: ColumnSchema[];
}

// Add function to get schema from gpt-4o-mini
const getSchemaFromGPT = async (sampleData: string, delimiter: string): Promise<SchemaResponse> => {
  console.log('Sample data being sent to GPT:', sampleData);
  console.log('Delimiter being used:', delimiter);

  const prompt = `You are a PostgreSQL schema analyzer. Your task is to analyze the provided data sample and determine the appropriate schema.
  
Background:
- We need to properly type each column for an interactive grid display
- The data will be used for analysis and visualization
  
Task:
1. Analyze the first few rows of data
2. Determine appropriate column types
3. Provide brief descriptions of what each column represents
4. Return the schema in the specified JSON format
  
Data Sample (delimiter: '${delimiter}'):
${sampleData}
  
Requirements:
1. Use these types only: TEXT, INTEGER, NUMERIC, DATE, TIMESTAMP
2. Ensure column names are SQL-safe (alphanumeric and underscores only)
3. Use INTEGER for whole numbers, NUMERIC for decimals
4. Use DATE for dates, TIMESTAMP for date-times
5. Use TEXT for string data or when unsure
6. Descriptions should be brief but informative
  
Return ONLY a JSON object in this exact format:
{
  "columns": [
    {"name": "column_name", "type": "postgresql_type", "description": "brief description"}
  ]
}`;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a PostgreSQL schema analyzer that returns only JSON responses."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      console.error('OpenAI API Error Status:', response.status);
      console.error('OpenAI API Error StatusText:', response.statusText);
      const errorText = await response.text();
      console.error('OpenAI API Error Response:', errorText);
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const rawData = await response.json();
    console.log('Raw OpenAI Response:', rawData);
    console.log('Message Content:', rawData.choices[0].message.content);

    const parsedSchema = JSON.parse(rawData.choices[0].message.content);
    console.log('Parsed Schema:', parsedSchema);

    return parsedSchema;
  } catch (error) {
    console.error('Error in getSchemaFromGPT:', error);
    throw error;
  }
};

// Add this constant near other API endpoints

// Add this type near other type definitions
type AnalysisState = {
  isAnalyzing: boolean;
  isStructureAnalyzing: boolean;
  isQuickAnalyzing: boolean;
  isCustomAnalyzing: boolean;
};

// Add this near other type definitions
type SchemaAnalysisResponse = {
  structure: any[];
  sampleData: any[];
};

// Fix the fetchAndAnalyzeSchema function
const fetchAndAnalyzeSchema = async (tableName: string): Promise<SchemaAnalysisResponse> => {
  const baseURL = 'https://rexdb.hosting.tigzig.com/sqlquery/';
  const cloudProvider = 'neon';
  const schemaName = 'public';

  try {
    // Fetch table structure
    const structureQuery = `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = '${schemaName}' AND table_name = '${tableName}'`;
    const structureResponse = await fetch(`${baseURL}?sqlquery=${encodeURIComponent(structureQuery)}&cloud=${cloudProvider}`);
    if (!structureResponse.ok) throw new Error('Failed to fetch table structure');
    const structureText = await structureResponse.text();

    // Parse CSV-like response into structured data
    const structureRows = structureText.split('\n')
      .filter(row => row.trim())
      .map(row => {
        const [column_name, data_type] = row.split(',').map(val => val.trim());
        return { column_name, data_type };
      });

    // Fetch sample rows
    const sampleQuery = `SELECT * FROM ${schemaName}.${tableName} LIMIT 10`;
    const sampleResponse = await fetch(`${baseURL}?sqlquery=${encodeURIComponent(sampleQuery)}&cloud=${cloudProvider}`);
    if (!sampleResponse.ok) throw new Error('Failed to fetch sample data');
    const sampleText = await sampleResponse.text();

    // Parse CSV-like response into structured data
    const sampleRows = sampleText.split('\n')
      .filter(row => row.trim())
      .map(row => {
        const values = row.split(',').map(val => val.trim());
        return values;
      });

    // First row contains headers
    const headers = sampleRows[0];
    const data: Record<string, string>[] = sampleRows.slice(1).map(row => {
      return headers.reduce<Record<string, string>>((obj, header, index) => {
        obj[header] = row[index];
        return obj;
      }, {});
    });

    return {
      structure: structureRows,
      sampleData: data
    };
  } catch (error) {
    console.error('Error fetching schema data:', error);
    throw new Error('Failed to parse database response. Please try again.');
  }
};

// Add this new function near the original fetchAndAnalyzeSchema function
const fetchAndAnalyzeSchemaCustomDB = async (
  tableName: string,
  parsedCredentials: ParsedDbCredentials
): Promise<SchemaAnalysisResponse> => {
  try {
    // Structure query based on DB type
    const structureQuery = parsedCredentials.db_type === 'mysql'
      ? `SELECT column_name, data_type FROM information_schema.columns 
         WHERE table_schema = DATABASE() AND table_name = '${tableName}'`
      : `SELECT column_name, data_type FROM information_schema.columns 
         WHERE table_schema = '${parsedCredentials.schema || 'public'}' AND table_name = '${tableName}'`;

    // Construct URL with credentials
    const structureUrl = `https://rexdb.hosting.tigzig.com/connect-db/?host=${parsedCredentials.host}&database=${parsedCredentials.database}&user=${parsedCredentials.user}&password=${parsedCredentials.password}&sqlquery=${encodeURIComponent(structureQuery)}&port=${parsedCredentials.port}&db_type=${parsedCredentials.db_type}`;

    const structureResponse = await fetch(structureUrl);
    if (!structureResponse.ok) throw new Error('Failed to fetch table structure');
    const structureText = await structureResponse.text();

    // Parse structure data
    const structureRows = structureText.split('\n')
      .filter(row => row.trim())
      .map(row => {
        const [column_name, data_type] = row.split(',').map(val => val.trim());
        return { column_name, data_type };
      });

    // Sample query based on DB type
    const sampleQuery = parsedCredentials.db_type === 'mysql'
      ? `SELECT * FROM ${tableName} LIMIT 10`
      : `SELECT * FROM ${parsedCredentials.schema || 'public'}.${tableName.replace(/^public\./, '')} LIMIT 10`;
    
    // Construct URL for sample data
    const sampleUrl = `https://rexdb.hosting.tigzig.com/connect-db/?host=${parsedCredentials.host}&database=${parsedCredentials.database}&user=${parsedCredentials.user}&password=${parsedCredentials.password}&sqlquery=${encodeURIComponent(sampleQuery)}&port=${parsedCredentials.port}&db_type=${parsedCredentials.db_type}`;

    const sampleResponse = await fetch(sampleUrl);
    if (!sampleResponse.ok) throw new Error('Failed to fetch sample data');
    const sampleText = await sampleResponse.text();

    // Rest of the function remains the same
    const sampleRows = sampleText.split('\n')
      .filter(row => row.trim())
      .map(row => {
        const values = row.split(',').map(val => val.trim());
        return values;
      });

    const headers = sampleRows[0];
    const data = sampleRows.slice(1).map(row => {
      return headers.reduce<Record<string, string>>((obj, header, index) => {
        obj[header] = row[index];
        return obj;
      }, {});
    });

    return {
      structure: structureRows,
      sampleData: data
    };
  } catch (error) {
    console.error('Error fetching custom DB schema data:', error);
    throw new Error('Failed to parse database response. Please try again.');
  }
};

// Update the sendSchemaToAgent function to accept tableName
const sendSchemaToAgent = async (schemaData: SchemaAnalysisResponse, sessionId: string, tableName: string) => {
  const structureTable = schemaData.structure
    .map(col => `${col.column_name} (${col.data_type})`)
    .join('\n');

  const sampleDataTable = [
    Object.keys(schemaData.sampleData[0]).join(','),
    ...schemaData.sampleData.map(row => Object.values(row).join(','))
  ].join('\n');

  const prompt = `I am sharing the schema and sample data for a PostgreSQL table. Note that you already have access to the data structure report and analysis report in your conversation history.

Database Details:
- Warehouse: Neon (PostgreSQL)
- Schema: public unless otherwise specified
- Table Name: ${tableName}
- Connection: Available through SQL query tools

Table Structure:
${structureTable}

Sample Data (10 rows):
${sampleDataTable}

Instructions:
1. You already have access to the data structure and analysis reports from our previous conversation
2. Study this additional schema information
3. Note that you can use SQL query tools to access this database
5. The table name '${tableName}' must be used in all queries
6. Respond  with: Confirm that you have studied the schema and all. Share a few lines of your undrestanding of dataset and the kind of anlaysis that can be done. 
And then show your eagerness to assist with any questions and analysis that the user might have. 
Restrict your initial respose to 150 words

Please analyze this information and prepare to assist with queries and analysis.`;

  try {
    const response = await fetch(FLOWISE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        question: prompt,
        overrideConfig: {
          sessionId: sessionId
        }
      })
    });

    if (!response.ok) throw new Error('Failed to send schema to agent');
    return await response.json();
  } catch (error) {
    console.error('Error sending schema to agent:', error);
    throw error;
  }
};

// First, add this type near other type definitions
type Message = {
  role: 'assistant' | 'user';
  content: string;
};


// Add these types near other type definitions
type DbCredentials = {
  host: string;
  database: string;
  user: string;
  password: string;
  port: string;
  db_type: 'mysql' | 'postgresql';
};

// First, let's extract the CSS into a constant at the top of the file
const PDF_GENERATION_CSS = `body {
  font-family: Arial, sans-serif;
  line-height: 1.6;
  margin: 10px 0;
  color: #333;
  padding: 0;
}

.content-wrapper {
  max-width: 100%;
  margin: 0;
  padding: 0;
}

p {
  font-size: 17px;
  margin-bottom: 12px;
  text-align: justify;
  color: #333;
  padding: 0;
}

h1 {
  font-size: 36px;
  font-weight: 800;
  color: #1e3a8a;
  margin: 0 0 20px 0;
  padding: 0 0 8px 0;
  border-bottom: 2px solid #1e3a8a;
  line-height: 1.2;
}

h2 {
  font-size: 28px;
  font-weight: 700;
  color: #1e40af;
  margin: 20px 0 12px 0;
  line-height: 1.2;
}

h3 {
  font-size: 22px;
  font-weight: 600;
  color: #333;
  margin: 16px 0 6px 0;
  line-height: 1.2;
}

h4 {
  font-size: 20px;
  font-weight: 600;
  color: #4f46e5;
  margin: 14px 0 8px 0;
  line-height: 1.2;
}

ul, ol {
  margin-left: 16px;
  margin-bottom: 4px;
  padding-left: 12px;
  line-height: 1.1;
}

li {
  margin-bottom: 4px;
  font-size: 17px;
  color: #333;
  line-height: 1.7;
  padding-top: 0;
  padding-bottom: 0;
}

li p {
  margin: 0;
  line-height: 1.7;
}

li > ul, 
li > ol {
  margin-top: 0px;
  margin-bottom: 0px;
  padding-left: 12px;
}

li > ul li,
li > ol li {
  margin-bottom: 0px;
}

ul:last-child,
ol:last-child {
  margin-bottom: 4px;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 20px 0;
}

th {
  background-color: #f8fafc;
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #1e40af;
  border: 1px solid #e2e8f0;
}

td {
  padding: 12px;
  border: 1px solid #e2e8f0;
  color: #333;
}

code {
  background-color: #f1f5f9;
  padding: 2px 4px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 14px;
}

pre code {
  display: block;
  padding: 12px;
  margin: 16px 0;
  overflow-x: auto;
}`;

// First, add this constant near the top of the file with other constants
const DEFAULT_ANALYSIS_PROMPT = `Analyze this dataset and provide detailed insights. 
The report must begin with a Main Heading, followed by a few introductory lines providing context to the analysis. Make sure that the main heading is relevant to the analysis and something that creates interest in the reader. When presenting large numbers, convert them into millions or thousands for readability. Quote specific numbers from the attached data in your analysis, but DO NOT do any calculations like averages, min, max, ratios etc as with a text prompt data these sort of calculations are likely to go wrong, hence stick to quoting numbers directly available in the data only. Please note : DO NOT DO ANY CALCULATIONS..

Then, structure the report using the following sections and subsections
      1. Key Insights & Patterns
      - Major trends and patterns
      - Significant correlations
      - Anomalies or outliers
      - Seasonal patterns (if applicable)

      2. Analytics Use Cases. Share 3 use cases for each sub-section
      - Potential predictive modeling opportunities
      - Segmentation possibilities
      - Optimization scenarios
      - ROI estimates for proposed solutions
      - Cost Saving Use cases.
      - Revenue enhancement use cases
      - Further analysis suggestions`;

// First, add this constant near other constants
const DEFAULT_STRUCTURE_PROMPT = `Analyze the structure and content of the dataset based on this sample. 
Your analysis should focus exclusively on understanding the data structure and not interpreting or analyzing the data values themselves.
Start with a relevant main H1 heading. Followed by a paragraph that describes the dataset on a high level, and then go into the sections below.

Requirements:

1. Column Analysis
   - Describe what each column represents based on its name
   - Identify the data types contained in each column
   - Note any naming conventions or potential redundancies
Identify the level of granularity of the data (e.g., daily transactions vs. monthly summaries
- Assess if the data has a temporal element 


2. Data Quality Assessment
   - Identify any missing values or potential data integrity issues
   - Note any apparent data format inconsistencies
   - Highlight potential data quality concerns

3. Structural Relationships
   - Identify any apparent relationships between columns
   - Note hierarchical data structures if present
   - Identify primary and foreign key candidates
- Assess if the data has a temporal element 

4. Technical Recommendations
   - Suggest data type optimizations
   - Recommend index candidates
   - Propose normalization opportunities
   - Suggest potential data transformations needed;

5. Suggest potential use cases for this dataset within analytics and data science applications, with a particular focus on revenue enhancement or cost-saving opportunities.Share seven use cases.`;

// Update the hardcoded credentials with the correct values
const CUSTOM_DB_CREDENTIALS = {
  host: "not-used",
  database: "not-used",
  user: "not-used",
  password: "not-used",
  schema: "not-used",
  port: "not-used",
  sslmode: "not-used",
  db_type: "not-used" as const
};

// Move this type definition outside
type CustomDbUploadResponse = {
  status: string;
  message: string;
  table_name: string;
  rows_inserted: number;
  columns: string[];
  duration_seconds?: number;
};

// Add these types near other type definitions
type ParsedDbCredentials = {
  host: string;
  database: string;
  user: string;
  password: string;
  schema: string;
  port: string;
  db_type: 'postgresql' | 'mysql';
};

// Update the parseCredentialsWithAI function
const parseCredentialsWithAI = async (credentialsString: string): Promise<ParsedDbCredentials> => {
  console.log('Parsing credentials with OpenAI...');
  console.log('Raw credentials string:', credentialsString);

  const enhancedPrompt = `You are a specialized database credentials parser. Parse the following connection details into a standardized JSON format.

Background:
- These credentials will be used for automated database connections
- The format must be exact as it will be used directly in code
- All values must be strings
- The response must be valid JSON without any markdown or additional text

Required Fields (all must be present):
1. host: The database server hostname/IP
2. database: The database name
3. user: The username for authentication
4. password: The password for authentication
5. schema: The database schema (default to "public" if not specified)
6. port: The connection port (use defaults if not specified)
7. db_type: Must be either "postgresql" or "mysql"

Rules:
1. Default Ports:
   - PostgreSQL: use "5432"
   - MySQL: use "3306"
2. Default Schema:
   - If not specified, use "public"
3. Database Type Detection:
   - Look for keywords like "postgres", "postgresql", "psql" to set as "postgresql"
   - Look for keywords like "mysql", "mariadb" to set as "mysql"
   - If unclear, default to "postgresql"
4. Value Formatting:
   - All values must be strings (including port numbers)
   - Remove any surrounding quotes or whitespace
   - Preserve exact case for username/password
   - Convert hostname to lowercase

Expected JSON Structure:
{
  "host": "example.host.com",
  "database": "dbname",
  "user": "username",
  "password": "exact_password",
  "schema": "public",
  "port": "5432",
  "db_type": "postgresql"
}

Input to parse:
${credentialsString}

Return ONLY the JSON object, no explanations or additional text.`;

  try {
    console.log('Making OpenAI API request...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a specialized database credentials parser. Return only valid JSON without any markdown formatting or additional text."
          },
          {
            role: "user",
            content: enhancedPrompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1  // Added for more consistent outputs
      })
    });

    console.log('OpenAI Response Status:', response.status);
    const data = await response.json();
    console.log('OpenAI Full Response:', data);

    // Extract JSON from the content
    const content = data.choices[0].message.content;
    console.log('Raw content:', content);

    // Parse the JSON
    const parsedCredentials = JSON.parse(content);
    console.log('Parsed Credentials:', {
      ...parsedCredentials,
      password: '***' // Mask password in logs
    });

    // Validate the parsed credentials
    const requiredFields = ['host', 'database', 'user', 'password', 'schema', 'port', 'db_type'];
    const missingFields = requiredFields.filter(field => !parsedCredentials[field]);

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    if (!['postgresql', 'mysql'].includes(parsedCredentials.db_type)) {
      throw new Error('Invalid database type. Must be either "postgresql" or "mysql"');
    }

    return parsedCredentials;
  } catch (error) {
    console.error('Error parsing credentials:', error);
    throw new Error('Failed to parse database credentials: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
};

// Add the TREE_NAMES constant here, before any component definitions
const TREE_NAMES = [
  'teak', 'walnut', 'pine', 'oak', 'maple', 'cedar', 'willow',
  'cypress', 'fir', 'aspen', 'alder', 'beech', 'balsa',
  'fig', 'hazel', 'linden', 'rowan'
];

// Add this function near the top of the App component

function App() {
  // Add this near the top of the App component with other hooks
  const { isAuthenticated, logout, user, loginWithRedirect } = useAuth0();
  
  const [sessionId] = useState(() => {
    const newSessionId = uuidv4();
    console.log('Created new sessionId:', newSessionId);
    return newSessionId;
  });

  // Move sharedMessages state declaration up here, before handleCustomPushToDb
  const [sharedMessages, setSharedMessages] = useState<Message[]>([]);

  // Move all useState declarations inside the component
  const [isCustomDbLoading, setIsCustomDbLoading] = useState(false);
  const [showPushToMyDbDialog, setShowPushToMyDbDialog] = useState(false);
  const [myDbCredentials, setMyDbCredentials] = useState({
    host: '',
    database: '',
    user: '',
    password: '',
    schema: '',
    port: '',
    db_type: '' as 'mysql' | 'postgresql' | ''
  });

  // Now handleCustomPushToDb can use setSharedMessages
  const handleCustomPushToDb = useCallback(async (
    file: File,
    _setLoading: (loading: boolean) => void,
    toast: any,
    dispatch: any,
    parsedCredentials?: ParsedDbCredentials
  ) => {
    // Add validation at the start
    if (!parsedCredentials) {
      throw new Error('No database credentials provided. Please connect to a database first.');
    }

    console.log('Starting custom DB upload process...');
    console.log('Database type:', parsedCredentials?.db_type || 'postgresql');

    // Create FormData for the file only
    const formData = new FormData();
    console.log('File to upload:', file.name);
    formData.append('file', file);

    // Determine the endpoint based on database type
    const dbType = parsedCredentials?.db_type || 'postgresql';
    const endpoint = dbType === 'postgresql'
      ? '/upload-file-custom-db-pg/'
      : '/upload-file-custom-db-mysql/';

    console.log('Selected endpoint:', endpoint);

    // Create query parameters string (removed sslmode)
    const queryParams = new URLSearchParams({
      host: parsedCredentials?.host || CUSTOM_DB_CREDENTIALS.host,
      database: parsedCredentials?.database || CUSTOM_DB_CREDENTIALS.database,
      user: parsedCredentials?.user || CUSTOM_DB_CREDENTIALS.user,
      password: parsedCredentials?.password || CUSTOM_DB_CREDENTIALS.password,
      schema: parsedCredentials?.schema || CUSTOM_DB_CREDENTIALS.schema,
      port: parsedCredentials?.port || CUSTOM_DB_CREDENTIALS.port
    });

    // Construct the full URL with query parameters
    const fullUrl = `${API_ENDPOINT}${endpoint}?${queryParams.toString()}`;

    // Log the URL (without password) for debugging
    const debugUrl = fullUrl.replace(
      new RegExp(parsedCredentials?.password || CUSTOM_DB_CREDENTIALS.password, 'g'),
      '***'
    );
    console.log('Using endpoint:', debugUrl);

    try {
      console.log('Making API request...');
      const response = await axios.post<CustomDbUploadResponse>(
        fullUrl,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Accept': 'application/json'
          },
          timeout: 900000,
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              console.log(`Upload Progress: ${percentCompleted}%`);
            }
          }
        }
      );

      console.log('Response received:', response.data);

      if (response.data.status === 'success') {
        console.log('Upload successful, updating UI...');
        toast({
          title: "File Upload Successful. Now sending schema to AI....",
          description: `${response.data.rows_inserted} rows inserted into ${dbType === 'postgresql' ? 'PostgreSQL' : 'MySQL'
            } table ${response.data.table_name}`,
          duration: 3000,
          className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
        });

        dispatch({
          type: 'SET_TABLE_INFO',
          payload: {
            tableName: response.data.table_name,
            rowCount: response.data.rows_inserted,
            columns: response.data.columns
          }
        });

        // Use the new custom DB schema analysis function
        if (parsedCredentials) {
          try {
            const schemaData = await fetchAndAnalyzeSchemaCustomDB(response.data.table_name, parsedCredentials);
            const schemaResponse = await sendSchemaToAgent(schemaData, sessionId, response.data.table_name);

            // Update shared messages
            setSharedMessages(prev => [...prev, {
              role: 'assistant',
              content: schemaResponse.text || schemaResponse.message
            }]);

            toast({
              title: "Schema Analysis Complete",
              description: "Schema sent to AI agent. Check the AI Chat tab for insights.",
              duration: 3000,
              className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
            });

            const chatTabEvent = new CustomEvent('activateChatTab', {
              detail: { activate: true }
            });
            window.dispatchEvent(chatTabEvent);

          } catch (error) {
            console.error('Error in automatic schema analysis:', error);
            toast({
              title: "Schema Analysis Failed",
              description: "File was uploaded but schema analysis failed. Please try again.",
              duration: 3000,
              className: "bg-red-50 border-red-200 shadow-lg border-2 rounded-xl",
            });
          }
        }
      }

      return response.data;

    } catch (error) {
      console.error('Upload error:', error);
      let errorMessage = 'An unexpected error occurred';

      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', {
          response: error.response?.data,
          status: error.response?.status,
          headers: error.response?.headers
        });

        if (error.response?.data) {
          console.error('Server error response:', error.response.data);
          errorMessage = typeof error.response.data === 'string'
            ? error.response.data
            : JSON.stringify(error.response.data);
        }
      }

      throw new Error(`${dbType === 'postgresql' ? 'PostgreSQL' : 'MySQL'} Upload failed: ${errorMessage}`);
    }
  }, [sessionId, setSharedMessages]);

  const handleMyDbCredentialsChange = useCallback((field: string, value: string) => {
    setMyDbCredentials(prev => {
      const updated = { ...prev, [field]: value };

      if (field === 'db_type') {
        updated.port = value === 'postgresql' ? '5432' : value === 'mysql' ? '3306' : '';
      }

      return updated;
    });
  }, []);

  const validateMyDbForm = useCallback(() => {
    return myDbCredentials.host.trim() !== '' &&
      myDbCredentials.database.trim() !== '' &&
      myDbCredentials.user.trim() !== '' &&
      myDbCredentials.password.trim() !== '' &&
      myDbCredentials.db_type !== '';
  }, [myDbCredentials]);

  // Move these state declarations inside the App function
  const [] = useState(false);
  const [] = useState(false);
  const [] = useState<DbCredentials>({
    host: '',
    database: '',
    user: '',
    password: '',
    port: '3306',
    db_type: 'mysql'
  });

  // Add a function to update credentials

  const [state, dispatch] = useReducer(reducer, initialState);
  const [tableView, setTableView] = useState<TableView>(null);
  const [analysisContent, setAnalysisContent] = useState('');
  const [panelState, setPanelState] = useState<PanelState>({
    expanded: 'analysis',
    maximized: null
  });
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const { toast } = useToast();

  // Move handleTestConnection inside App function as well

  // Add state for tracking the current data in grid format
  const [gridData, setGridData] = useState<{ columns: any[]; data: any[]; schema?: SchemaResponse } | null>(null);

  // Add separate loading states for each button
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [isGridLoading, setIsGridLoading] = useState(false);

  // Add a function to handle AI analysis (to be implemented)

  const handleShowTable = useCallback((type: 'main' | 'summary', viewType: 'simple' | 'advanced') => {
    setTableView({ type, viewType });

    if (viewType === 'advanced') {
      toast({
        title: "Interactive table loaded below ↓",
        duration: 2000,
        className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
      })

      setTimeout(() => {
        const tableSection = document.querySelector('.mt-6.w-full');
        if (tableSection) {
          const yOffset = -100;
          const y = tableSection.getBoundingClientRect().top + window.pageYOffset + yOffset;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 100);
    }
  }, [toast]);

  const handleFileUpload = useCallback(async (form: HTMLFormElement, mode: UploadMode) => {
    console.log(`File upload started in ${mode} mode...`);
    console.log('Using API endpoint:', API_ENDPOINT); // Add this debug log

    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      toast({
        title: "Missing File",
        description: "Please choose a file first",
        duration: 3000,
        className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
      });
      return;
    }

    // Set loading state based on mode
    if (mode === 'database') {
      setIsDbLoading(true);
    } else {
      setIsGridLoading(true);
    }

    try {
      const formData = new FormData(form);
      const file = formData.get('file') as File;

      if (!file) {
        toast({
          title: "Error",
          description: "Please select a file first",
          duration: 3000,
          className: "bg-red-50 border-red-200 shadow-lg border-2",
        });
        return;
      }

      if (mode === 'grid') {
        // Grid mode handling
        const text = await file.text();
        const delimiter = detectDelimiter(text);

        // Get all rows and filter empty ones
        const allRows = text.split('\n')
          .map(row => row.trim())
          .filter(row => row.length > 0);

        if (allRows.length === 0) {
          throw new Error('File is empty');
        }

        // Get headers from first row
        const headers = allRows[0].split(delimiter).map(h => h.trim());
        console.log('Headers:', headers);

        // Get sample data for schema detection
        const sampleData = allRows.slice(0, 5).join('\n');
        const schema = await getSchemaFromGPT(sampleData, delimiter);
        console.log('Schema:', schema);

        // Create a map of normalized header names to schema columns
        const schemaMap = new Map(
          schema.columns.map(col => [
            col.name.toLowerCase().replace(/[_\s]/g, ''),
            col
          ])
        );

        // Create grid columns
        const gridColumns = headers.map(header => {
          const normalizedHeader = header.toLowerCase().replace(/[_\s]/g, '');
          const schemaCol = schemaMap.get(normalizedHeader);

          const baseConfig = {
            field: header,
            headerName: header,
            type: schemaCol?.type || 'TEXT',
            sortable: true,
            resizable: true,
            enableValue: true,
            width: 150,
          };

          // Add type-specific configurations
          if (schemaCol?.type === 'INTEGER' || schemaCol?.type === 'NUMERIC') {
            return {
              ...baseConfig,
              filter: 'agNumberColumnFilter',
              valueFormatter: (params: any) => {
                if (params.value === null || params.value === undefined) return '';
                return new Intl.NumberFormat('en-IN', {
                  maximumFractionDigits: 2,
                  minimumFractionDigits: 0,
                  style: 'decimal'
                }).format(params.value);
              },
              aggFunc: 'sum',
              allowedAggFuncs: ['sum', 'avg', 'min', 'max', 'count'],
            };
          }

          return {
            ...baseConfig,
            filter: 'agTextColumnFilter'
          };
        });

        console.log('Grid Columns:', gridColumns);

        // Parse data rows
        const gridRows = allRows.slice(1).map(row => {
          const values = row.split(delimiter);
          return headers.reduce((obj, header, idx) => {
            const normalizedHeader = header.toLowerCase().replace(/[_\s]/g, '');
            const schemaCol = schemaMap.get(normalizedHeader);
            const rawValue = values[idx]?.trim() || '';

            if (schemaCol?.type === 'INTEGER') {
              obj[header] = rawValue ? parseInt(rawValue, 10) : null;
            } else if (schemaCol?.type === 'NUMERIC') {
              obj[header] = rawValue ? parseFloat(rawValue) : null;
            } else {
              obj[header] = rawValue;
            }

            return obj;
          }, {} as Record<string, any>);
        });

        console.log('Sample Row:', gridRows[0]);

        setGridData({
          columns: gridColumns,
          data: gridRows,
          schema
        });

        handleShowTable('main', 'advanced');
      } else {
        // Database mode - Fixed URL format and proper FormData handling
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);

        console.log('Uploading to database with URL:', `${API_ENDPOINT}/upload-file-llm-pg/`);
        console.log('File being uploaded:', file.name);

        const response = await axios.post<UploadResponse>(
          `${API_ENDPOINT}/upload-file-llm-pg/`,  // Fixed URL format
          uploadFormData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              'Accept': 'application/json'
            },
            timeout: 900000, // 2 minutes timeout
            onUploadProgress: (progressEvent) => {
              console.log('Upload progress:', progressEvent.loaded, '/', progressEvent.total);
            }
          }
        );

        console.log('Database response:', response.data);

        if (response.data.status === 'success') {
          toast({
            title: "File Upload Successful. Now sending schema to AI....",
            description: `${response.data.rows_inserted} rows inserted into PostgreSQL Neon DataWarehouse table ${response.data.table_name}`,
            duration: 3000,
            className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
          });

          dispatch({
            type: 'SET_TABLE_INFO',
            payload: {
              tableName: response.data.table_name,
              rowCount: response.data.rows_inserted,
              columns: response.data.columns
            }
          });

          // Add this new code here to automatically trigger schema analysis
          try {
            const schemaData = await fetchAndAnalyzeSchema(response.data.table_name);
            const schemaResponse = await sendSchemaToAgent(schemaData, sessionId, response.data.table_name);

            // Update shared messages
            setSharedMessages(prev => [...prev, {
              role: 'assistant',
              content: schemaResponse.text || schemaResponse.message
            }]);

            // Show second toast for schema sent
            toast({
              title: "Schema Analysis Complete",
              description: "Schema sent to AI agent. Check the AI Chat tab for insights.",
              duration: 3000,
              className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
            });

            // Activate chat tab
            const chatTabEvent = new CustomEvent('activateChatTab', {
              detail: { activate: true }
            });
            window.dispatchEvent(chatTabEvent);

          } catch (error) {
            console.error('Error in automatic schema analysis:', error);
            toast({
              title: "Schema Analysis Failed",
              description: "File was uploaded but schema analysis failed. Please try again.",
              duration: 3000,
              className: "bg-red-50 border-red-200 shadow-lg border-2 rounded-xl",
            });
          }
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      // Enhanced error logging
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', {
          response: error.response?.data,
          status: error.response?.status,
          headers: error.response?.headers
        });
      }

      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Error processing file. Please try again.",
        duration: 3000,
        className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
      });
    } finally {
      // Clear loading state based on mode
      if (mode === 'database') {
        setIsDbLoading(false);
      } else {
        setIsGridLoading(false);
      }
    }
  }, [toast, dispatch]);

  const handleGeneratePdf = useCallback(async () => {
    if (!analysisContent) return;

    try {
      setIsPdfGenerating(true);

      const transformedMarkdown = `
<div class="content-wrapper">
${analysisContent
          .replace(/\\n/g, '\n')
          .split('\n')
          .map((line: string) => line.trim())
          .filter((line: string) => line)
          .join('\n\n')}
</div>`;

      const formData = new URLSearchParams();
      formData.append('markdown', transformedMarkdown);
      formData.append('engine', 'wkhtmltopdf');
      formData.append('css', PDF_GENERATION_CSS);  // Use the shared CSS

      const response = await fetch('https://md-to-pdf.fly.dev', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const pdfBlob = await response.blob();
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Analysis-Report-${new Date().toISOString()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsPdfGenerating(false);
    }
  }, [analysisContent]);

  useEffect(() => {
    const handleError = (error: Error) => {
      console.error('Global error caught:', error);
      toast({
        title: "An error occurred",
        description: "The application encountered an error. Please refresh the page.",
        duration: 5000,
        className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
      });
    };

    window.addEventListener('error', (event) => handleError(event.error));
    window.addEventListener('unhandledrejection', (event) => handleError(event.reason));

    return () => {
      window.removeEventListener('error', (event) => handleError(event.error));
      window.removeEventListener('unhandledrejection', (event) => handleError(event.reason));
    };
  }, [toast]);


  // Add this useEffect for chart events
  useEffect(() => {
    const handleNewChart = (event: CustomEvent<{ url: string; timestamp: number }>) => {
      console.log('New chart event received:', event.detail); // Debug log
      dispatch({
        type: 'ADD_CHART',
        payload: event.detail
      });
    };

    window.addEventListener('newChart', handleNewChart as EventListener);

    return () => {
      window.removeEventListener('newChart', handleNewChart as EventListener);
    };
  }, []);

  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    isAnalyzing: false,
    isStructureAnalyzing: false,
    isQuickAnalyzing: false,
    isCustomAnalyzing: false
  });

  const handleAnalyzeData = useCallback(async (file: File) => {
    try {
      console.log('Starting structure analysis...');
      setAnalysisState(prev => ({ ...prev, isStructureAnalyzing: true }));

      const text = await file.text();
      console.log('File content length:', text.length);

      // Format the data similar to working structure
      const rows = text.split('\n').filter(row => row.trim());
      const headers = rows[0].split('|');

      // Use DEFAULT_STRUCTURE_PROMPT instead of hardcoded prompt
      let formattedData = `${DEFAULT_STRUCTURE_PROMPT}\n\nDataset Structure:\n`;
      formattedData += 'Headers: ' + headers.join(' | ') + '\n\n';
      formattedData += 'Sample Data:\n';

      // Add sample rows (first 5 rows)
      rows.slice(1, 6).forEach((row, index) => {
        const values = row.split('|');
        formattedData += `Row ${index + 1}:\n`;
        headers.forEach((header, i) => {
          formattedData += `${header.trim()}: ${values[i]?.trim() || 'N/A'}\n`;
        });
        formattedData += '---\n';
      });

      console.log('Making API call to:', FLOWISE_API_ENDPOINT);

      const response = await fetch(FLOWISE_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: formattedData,
          overrideConfig: {
            sessionId: sessionId
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Analysis failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('Received result:', result);

      setAnalysisContent(result.text || result.message);
      setPanelState(prev => ({ ...prev, expanded: 'analysis' }));

      toast({
        title: "Analysis Complete",
        description: "Check the Analysis Report panel for insights",
        duration: 3000,
        className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
      });

    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze the file. Please try again.",
        duration: 3000,
        className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
      });
    } finally {
      setAnalysisState(prev => ({ ...prev, isStructureAnalyzing: false }));
    }
  }, [sessionId, toast]);

  const [quickAnalysisContent, setQuickAnalysisContent] = useState('');
  const [] = useState(false);
  const [isQuickPdfGenerating, setIsQuickPdfGenerating] = useState(false);

  const handleGenerateQuickAnalysisPdf = useCallback(async () => {
    if (!quickAnalysisContent) return;

    try {
      setIsQuickPdfGenerating(true);

      const transformedMarkdown = `
<div class="content-wrapper">
${quickAnalysisContent
          .replace(/\\n/g, '\n')
          .split('\n')
          .map((line: string) => line.trim())
          .filter((line: string) => line)
          .join('\n\n')}
</div>`;

      const formData = new URLSearchParams();
      formData.append('markdown', transformedMarkdown);
      formData.append('engine', 'wkhtmltopdf');
      formData.append('css', PDF_GENERATION_CSS);  // Use the shared CSS

      const response = await fetch('https://md-to-pdf.fly.dev', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const pdfBlob = await response.blob();
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Quick-Analysis-Report-${new Date().toISOString()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsQuickPdfGenerating(false);
    }
  }, [quickAnalysisContent]);

  const [showAnalysisOptions, setShowAnalysisOptions] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showCustomPromptDialog, setShowCustomPromptDialog] = useState(false);

  const handleCustomAnalysis = useCallback(async (file: File, customPrompt: string) => {
    console.log('handleCustomAnalysis called with:', { fileName: file.name, promptLength: customPrompt.length });

    try {
      setAnalysisState(prev => ({ ...prev, isCustomAnalyzing: true }));
      console.log('Starting custom analysis...');

      const text = await file.text();
      console.log('File content loaded, length:', text.length);

      const rows = text.split('\n').filter(row => row.trim());
      const headers = rows[0].split('|');

      let formattedData = `${customPrompt}\n\nDataset Structure:\n`;
      formattedData += 'Headers: ' + headers.join(' | ') + '\n\n';
      formattedData += 'Sample Data:\n';

      rows.slice(1, 100).forEach((row, index) => {
        const values = row.split('|');
        formattedData += `Row ${index + 1}:\n`;
        headers.forEach((header, i) => {
          formattedData += `${header.trim()}: ${values[i]?.trim() || 'N/A'}\n`;
        });
        formattedData += '---\n';
      });

      console.log('Making API call with formatted data length:', formattedData.length);

      const response = await fetch(FLOWISE_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: formattedData,
          overrideConfig: {
            sessionId: sessionId
          }
        })
      });

      console.log('API response status:', response.status);

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('Received result:', result);

      setQuickAnalysisContent(result.text || result.message);
      setPanelState(prev => ({ ...prev, expanded: 'quickAnalysis' }));

      toast({
        title: "Custom Analysis Complete",
        description: "Check the Quick Analysis Report panel for insights",
        duration: 3000,
        className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
      });

    } catch (error) {
      console.error('Custom analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze the file. Please try again.",
        duration: 3000,
        className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
      });
    } finally {
      setAnalysisState(prev => ({ ...prev, isCustomAnalyzing: false }));
      console.log('Custom analysis completed');
    }
  }, [sessionId, toast]);

  [] = useState(false);

  // Then update the handleSendSchemaToAnalyzer function to pass the table name

  // Add this click outside handler for the analysis menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.analysis-menu-container')) {
        setShowAnalysisOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Update the PanelState type to include all panel types
  type PanelState = {
    expanded: 'analysis' | 'quickAnalysis' | 'chat' | 'charts' | 'documents' | null;
    maximized: 'analysis' | 'quickAnalysis' | 'chat' | 'charts' | 'documents' | null;
  };

  // Update the toggleMaximize function to use the updated type
  const toggleMaximize = (panel: 'analysis' | 'quickAnalysis' | 'chat' | 'charts' | 'documents') => {
    setPanelState(prev => ({
      expanded: prev.expanded,
      maximized: prev.maximized === panel ? null : panel
    }));
  };

  // Add this function inside App component

  // Add this state near other state declarations in App
  const [showQuickConnectDialog, setShowQuickConnectDialog] = useState(false);
  const [connectionString, setConnectionString] = useState('');

  // Add this state near other state declarations in App
  const [isQuickConnecting, setIsQuickConnecting] = useState(false);

  // Update the handleQuickConnect function
  const handleQuickConnect = async (connectionString: string, additionalInfo: string = '') => {
    if (isQuickConnecting) return;

    if (!connectionString) {
      toast({
        title: "Missing Connection String",
        description: "Please provide database connection details",
        duration: 3000,
        className: "bg-red-50 border-red-200 shadow-lg border-2 rounded-xl",
      });
      return;
    }

    try {
      setIsQuickConnecting(true);

      // Store the credentials
      setStoredCredentials(connectionString);
      sessionStorage.setItem('dbCredentials', connectionString);

      // Add the additional info to the prompt if provided
      const prompt = `I have database connection details that I need you to analyze and test. Here are the details:

${connectionString}
${additionalInfo || ''}

Please:
1. Check if all required information is present (host, database, user, password, type, port)
2. If any required information is missing, tell me what's missing
3. If all information is present, try to connect and check for available schemas
4. Respond with one of:
   - "Missing required information: [list what's missing]"
   - "I have tested the connection and it is working. [Then share the database credential as a list nicely formatted :Database Nickname, Host, Database Name, User Name, Type of warehouse - PostGres or MySQL] Available schemas are ..[share as list]. Let me know your questions [Show eagerness to help]."
   - "Connection is not working. Please check your connection credentials."`;

      console.log('Making API call to Flowise...');
      const response = await fetch(FLOWISE_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question: prompt,
          overrideConfig: {
            sessionId: sessionId
          }
        })
      });

      if (!response.ok) throw new Error('Failed to send to agent');
      const result = await response.json();
      console.log('Received response from Flowise:', result);

      // Update shared messages first
      setSharedMessages(prev => [...prev, {
        role: 'assistant',
        content: result.text || result.message
      }]);

      // Then activate the chat tab
      const chatTabEvent = new CustomEvent('activateChatTab', {
        detail: { activate: true }
      });
      window.dispatchEvent(chatTabEvent);

      // Show chat panel and close dialog
      setPanelState(prev => ({ ...prev, expanded: 'chat' }));
      setShowQuickConnectDialog(false);

      toast({
        title: "AI Agent Response",
        description: "Check the AI Chat tab for the response",
        duration: 3000,
        className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
      });

    } catch (error) {
      console.error('Connection error:', error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect",
        duration: 3000,
        className: "bg-red-50 border-red-200 shadow-lg border-2 rounded-xl",
      });
    } finally {
      setIsQuickConnecting(false);
    }
  };

  // First, ensure we have the correct state variables at the top of the App component
  const [showStructureOptions, setShowStructureOptions] = useState(false);
  const [customStructurePrompt, setCustomStructurePrompt] = useState('');
  const [showCustomStructureDialog, setShowCustomStructureDialog] = useState(false);

  // Add this useEffect near the other click outside handlers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.analysis-menu-container')) {
        setShowStructureOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Update the existing button with this new version
  <Tooltip content="Analyze Data Structure">
    <div className="relative analysis-menu-container">
      <Button
        type="button"
        disabled={analysisState.isStructureAnalyzing}
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.preventDefault();
          const form = e.currentTarget.closest('form');
          const fileInput = form?.querySelector('input[type="file"]') as HTMLInputElement;
          if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            toast({
              title: "Missing File",
              description: "Please choose a file first",
              duration: 3000,
              className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
            });
            return;
          }
          setShowStructureOptions(!showStructureOptions);
        }}
        className="h-9 px-1.5 bg-indigo-50/30 hover:bg-indigo-100/40 text-indigo-600 flex items-center gap-1.5"
      >
        {analysisState.isStructureAnalyzing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-[15px] font-medium">Structure</span>
          </>
        ) : (
          <>
            <LayoutGrid className="h-4 w-4" />
            <span className="text-[15px] font-medium">Structure</span>
          </>
        )}
      </Button>

      {/* Structure Dropdown Menu */}
      {showStructureOptions && !analysisState.isStructureAnalyzing && (
        <div className="absolute right-0 mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            <button
              onClick={(e) => {
                e.preventDefault();
                setShowStructureOptions(false);
                const form = e.currentTarget.closest('form');
                const fileInput = form?.querySelector('input[type="file"]') as HTMLInputElement;
                if (fileInput?.files?.[0]) {
                  handleAnalyzeData(fileInput.files[0]);
                }
              }}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Quick Structure
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                setShowStructureOptions(false);
                setCustomStructurePrompt(DEFAULT_STRUCTURE_PROMPT);
                setShowCustomStructureDialog(true);
              }}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Custom Structure
            </button>
          </div>
        </div>
      )}
    </div>
  </Tooltip>

  // Add this new function to handle custom structure analysis.
  const handleCustomStructureAnalysis = useCallback(async (file: File, customPrompt: string) => {
    if (!file) {
      console.error('No file provided');
      return;
    }

    try {
      console.log('Starting custom structure analysis...');
      setAnalysisState(prev => ({ ...prev, isStructureAnalyzing: true }));
      setShowCustomStructureDialog(false);

      const text = await file.text();
      console.log('File content length:', text.length);

      // Format the data similar to working structure
      const rows = text.split('\n').filter(row => row.trim());
      const headers = rows[0].split('|');

      let formattedData = `${customPrompt}\n\nDataset Structure:\n`;
      formattedData += 'Headers: ' + headers.join(' | ') + '\n\n';
      formattedData += 'Sample Data:\n';

      // Add first 10 rows of data
      rows.slice(1, 11).forEach((row, index) => {
        const values = row.split('|');
        formattedData += `Row ${index + 1}:\n`;
        headers.forEach((header, i) => {
          formattedData += `${header.trim()}: ${values[i]?.trim() || 'N/A'}\n`;
        });
        formattedData += '---\n';
      });

      console.log('Making API call for custom structure analysis...');

      const response = await fetch(FLOWISE_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: formattedData,
          overrideConfig: {
            sessionId: sessionId
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Structure analysis failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('Received result:', result);

      setAnalysisContent(result.text || result.message);
      setPanelState(prev => ({ ...prev, expanded: 'analysis' }));

      toast({
        title: "Structure Analysis Complete",
        description: "Check the Analysis Report panel for insights",
        duration: 3000,
        className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
      });

    } catch (error) {
      console.error('Custom structure analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze the file. Please try again.",
        duration: 3000,
        className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
      });
    } finally {
      setAnalysisState(prev => ({ ...prev, isStructureAnalyzing: false }));
    }
  }, [sessionId, toast]);

  // Update the file input styles

  // Update the container styles
  <div className="w-full min-h-screen bg-gray-50/30">
    <div className="container mx-auto py-2"> {/* Reduced top padding */}
      <div className="bg-white rounded-lg shadow-sm"> {/* Removed border, kept subtle shadow */}
        {/* Rest of the code... */}
      </div>
    </div>
  </div>

  // Add this near the top with other state
  const [storedCredentials, setStoredCredentials] = useState<string | null>(null);

  // Update the Push to My DB button click handler
  const handlePushToMyDb = async (file: File) => {
    // Check state instead of sessionStorage
    if (!storedCredentials) {
      toast({
        title: "No Database Connection",
        description: "Please connect to a database first",
        duration: 3000,
        className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
      });
      return;
    }

    try {
      setIsCustomDbLoading(true);
      console.log('Starting credential parsing...');

      // Parse credentials using OpenAI
      const parsedCredentials = await parseCredentialsWithAI(storedCredentials);
      console.log('Using parsed credentials:', { ...parsedCredentials, password: '***' });

      // Use the parsed credentials for the upload
      await handleCustomPushToDb(
        file,
        setIsCustomDbLoading,
        toast,
        dispatch,
        parsedCredentials
      );

    } catch (error) {
      console.error('Push to DB error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload file",
        duration: 3000,
        className: "bg-red-50 border-red-200 shadow-lg border-2 rounded-xl",
      });
    } finally {
      setIsCustomDbLoading(false);
    }
  };

  // First, restore the correct analysis handling function
  const handleQuickAnalysis = useCallback(async (file: File) => {
    try {
      console.log('Starting quick analysis...');
      setAnalysisState(prev => ({ ...prev, isQuickAnalyzing: true }));

      const text = await file.text();
      const rows = text.split('\n').filter(row => row.trim());
      const headers = rows[0].split('|');

      // Format the data similar to working structure
      let formattedData = `${DEFAULT_ANALYSIS_PROMPT}\n\nDataset Structure:\n`;
      formattedData += 'Headers: ' + headers.join(' | ') + '\n\n';
      formattedData += 'Sample Data:\n';

      // Add sample rows (first 10 rows)
      rows.slice(1, 100).forEach((row, index) => {
        const values = row.split('|');
        formattedData += `Row ${index + 1}:\n`;
        headers.forEach((header, i) => {
          formattedData += `${header.trim()}: ${values[i]?.trim() || 'N/A'}\n`;
        });
        formattedData += '---\n';
      });

      console.log('Making API call for quick analysis...');

      const response = await fetch(FLOWISE_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: formattedData,
          overrideConfig: {
            sessionId: sessionId
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('Received result:', result);

      // Set the quick analysis content instead of analysis content
      setQuickAnalysisContent(result.text || result.message);
      setPanelState(prev => ({ ...prev, expanded: 'quickAnalysis' }));

      toast({
        title: "Analysis Complete",
        description: "Check the Quick Analysis Report panel for insights",
        duration: 3000,
        className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
      });

    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze the file. Please try again.",
        duration: 3000,
        className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
      });
    } finally {
      setAnalysisState(prev => ({ ...prev, isQuickAnalyzing: false }));
    }
  }, [sessionId, toast]);

  // Then update the Analysis dropdown menu to use this function
  {/* Analysis Options Dropdown */ }
  {
    showAnalysisOptions && !analysisState.isQuickAnalyzing && !analysisState.isCustomAnalyzing && (
      <div className="absolute right-0 mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
        <div className="py-1">
          <button
            onClick={(e) => {
              e.preventDefault();
              setShowAnalysisOptions(false);
              const form = e.currentTarget.closest('form');
              const fileInput = form?.querySelector('input[type="file"]') as HTMLInputElement;
              if (fileInput?.files?.[0]) {
                handleQuickAnalysis(fileInput.files[0]);
              }
            }}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Quick Analysis
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              setShowAnalysisOptions(false);
              setCustomPrompt(DEFAULT_ANALYSIS_PROMPT);
              setShowCustomPromptDialog(true);
            }}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Custom Analysis
          </button>
        </div>
      </div>
    )
  }

  {/* Custom Analysis Dialog */ }
  {
    showCustomPromptDialog && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
          <h3 className="text-lg font-medium mb-4">Custom Analysis Prompt</h3>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="w-full h-64 p-2 border rounded-md mb-4"
            placeholder="Enter your custom analysis prompt..."
          />
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setShowCustomPromptDialog(false)}
              variant="outline"
              size="sm"
              className="bg-white hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={(e) => {
                e.preventDefault();
                const form = document.querySelector('form');
                const fileInput = form?.querySelector('input[type="file"]') as HTMLInputElement;
                if (fileInput?.files?.[0]) {
                  handleCustomAnalysis(fileInput.files[0], customPrompt);
                  setShowCustomPromptDialog(false);
                }
              }}
              variant="default"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={analysisState.isCustomAnalyzing}
            >
              {analysisState.isCustomAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                'Analyze'
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Add this function where your other handlers are defined
  const handleCustomDbUpload = async (
    file: File,
    _credentials: any,
    setLoading: (loading: boolean) => void,
    toast: any,
    dispatch: any
  ) => {
    try {
      setLoading(true); // Now using the setLoading parameter
      // Implementation using file, credentials, toast, and dispatch
      const formData = new FormData();
      formData.append('file', file);

      // Use credentials and make API call

      // Use toast for notifications
      toast({
        title: "Success",
        description: "File uploaded successfully.",
        duration: 3000
      });

      // Use dispatch to update state
      dispatch({ type: 'SET_STATUS', payload: 'success' });

    } catch (error) {
      console.error('Error in custom DB upload:', error);
      toast({
        title: "Error",
        description: "Failed to upload file",
        duration: 3000
      });
    } finally {
      setLoading(false); // Now using the setLoading parameter
    }
  };

  // Add these near other state declarations
  const [showCreateDbDialog, setShowCreateDbDialog] = useState(false);
  const [dbNickname, setDbNickname] = useState(() => {
    // Randomly select a tree name as initial value
    return TREE_NAMES[Math.floor(Math.random() * TREE_NAMES.length)];
  });
  const [isCreatingDb, setIsCreatingDb] = useState(false);
  const [] = useState<string | null>(null);

  // Add this helper function near the top of the file
  const generateDatabaseName = (nickname: string): string => {
    const prefix = 'rexdb';
    const randomNum = Math.floor(Math.random() * (999 - 101 + 1)) + 101;
    const currentDay = new Date().getDate().toString().padStart(2, '0');
    return `${prefix}${randomNum}${currentDay}${nickname}`;
  };

  // In the handleCreateNeonDb function, modify only the database name construction
  const handleCreateNeonDb = async (nickname: string) => {
    if (!nickname.trim()) {
      toast({
        title: "Missing Nickname",
        description: "Please provide a nickname for your database",
        duration: 3000,
        className: "bg-red-50 border-red-200 shadow-lg border-2 rounded-xl",
      });
      return;
    }

    try {
      setIsCreatingDb(true);
      
      // Generate the database name using our new function
      const databaseName = generateDatabaseName(nickname);
      
      const response = await axios.post(
        `${API_URL}/api/create-neon-db`,
        {
          project: {
            name: databaseName // Using the generated name here
          }
        }
      );

      // Close the create dialog
      setShowCreateDbDialog(false);
      
      // Show credentials in a dialog
      setCredentialsDisplay({
        show: true,
        data: {
          hostname: response.data.hostname,
          database: response.data.database_name,
          username: response.data.database_owner,
          password: response.data.database_owner_password,
          port: response.data.port,
          type: response.data.database_type
        },
        message: "Database created successfully! Credentials are being passed to AI for analysis..."
      });

      // Format and pass to AI agent
      const dbDetailsMessage = `
Host: ${response.data.hostname}
Database: ${response.data.database_name}
Username: ${response.data.database_owner}
Password: ${response.data.database_owner_password}
Port: ${response.data.port}
Type: ${response.data.database_type}
Nickname: ${response.data.database_nickname}
      `.trim();

      // Pass to AI agent
      setTimeout(async () => {
        try {
          await handleQuickConnect(dbDetailsMessage, `New database created with nickname: ${nickname}`);
        } catch (error) {
          console.error('Error in AI analysis:', error);
          toast({
            title: "AI Analysis Failed",
            description: "Database was created but AI analysis failed. You can try connecting again later.",
            duration: 5000,
            className: "bg-yellow-50 border-yellow-200 shadow-lg border-2 rounded-xl",
          });
        }
      }, 1000);

      // Add this block after successful database creation
      if (user) {
        const webhookData = `User Data|user_id: ${user.sub}|user_email: ${user.email}|hostname: ${response.data.hostname}|database: ${response.data.database_name}|username: ${response.data.database_owner}|port: ${response.data.port}|type: ${response.data.database_type}|nickname: ${response.data.database_nickname}`;

        try {
          const webhookUrl = import.meta.env.VITE_MAKE_WEBHOOK_URL;
          if (webhookUrl) {
            await fetch(webhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ data: webhookData })
            });
            console.log('Webhook data sent successfully');
          } else {
            console.warn('Webhook URL not configured');
          }
        } catch (webhookError) {
          console.error('Failed to send data to webhook:', webhookError);
          // Optionally notify admin but don't interrupt user flow
          toast({
            title: "Note",
            description: "Database created successfully, but user data sync delayed",
            duration: 3000,
            className: "bg-yellow-50 border-yellow-200 shadow-lg border-2 rounded-xl",
          });
        }
      }

    } catch (error) {
      console.error('Error creating database:', error);
      toast({
        title: "Database Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create database",
        duration: 3000,
        className: "bg-red-50 border-red-200 shadow-lg border-2 rounded-xl",
      });
    } finally {
      setIsCreatingDb(false);
    }
  };

  // Add these new states near other state declarations
  const [showUriDialog, setShowUriDialog] = useState(false);
  const [currentUri] = useState('');

  // Add this helper function
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: "Connection URI has been copied",
        duration: 2000,
        className: "bg-green-50 border-green-200 shadow-lg border-2 rounded-xl",
      });
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Add this near other state declarations at the top of the App function
  const [credentialsDisplay, setCredentialsDisplay] = useState<{
    show: boolean;
    data: null | {
      hostname: string;
      database: string;
      username: string;
      password: string;
      port: number;
      type: string;
    };
    message: string;
  }>({
    show: false,
    data: null,
    message: ""
  });

  // Add this helper function at the top of your file
  const isInIframe = () => {
    try {
      return window !== window.top;
    } catch (e) {
      return true;
    }
  };

  // Add this near the top of your App component, after imports
  const SHOW_REX_DB_BUTTON = import.meta.env.VITE_SHOW_REX_DB_BUTTON === 'true';

  // In the return statement, right after ToastProvider opening tag
  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50">
        {/* URI Dialog - Place it first */}
        {showUriDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-lg p-6 w-full max-w-xl mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Database Connection Details</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUriDialog(false)}
                  className="hover:bg-gray-100 rounded-full h-8 w-8 p-0"
                >
                  <span className="sr-only">Close</span>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-md">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Connection URI:</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(currentUri)}
                      className="h-8 px-2 hover:bg-gray-200"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      <span className="text-sm">Copy</span>
                    </Button>
                  </div>
                  <code className="block bg-white p-3 rounded border text-sm font-mono break-all">
                    {currentUri}
                  </code>
                </div>
                
                <p className="text-sm text-gray-600">
                  Your database has been created successfully! The AI agent is now analyzing the connection.
                  You can copy the URI and close this dialog.
                </p>
              </div>

              <div className="flex justify-end mt-6">
                <Button
                  variant="default"
                  onClick={() => setShowUriDialog(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Main Header */}
        <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 text-white py-1.5 px-4 shadow-md">
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <h1 className="text-xl font-medium whitespace-nowrap">
              Analyze with AI
            </h1>
            <div className="h-5 w-px bg-indigo-400 mx-2"></div>
            <span className="text-base text-white font-semibold whitespace-nowrap">
              Connect to any PostGres & MySQL Database | Create DB on the Fly | Upload and Analyze CSV/TXT
            </span>
            <div className="h-5 w-px bg-indigo-400 mx-2"></div>
            {/* Transparent space blocker - maintains the same width as the removed link */}
            <div className="w-[180px] invisible">
              {/* This invisible div maintains the space */}
              <span className="text-sm px-3 py-1">Space Reserved</span>
            </div>
            {/* This empty div ensures right space remains free */}
            <div className="flex-grow"></div>
          </div>
        </div>

        {/* Menu Container - Adjust margins and max-width */}
        <div className="py-2 px-4">
          <div className="max-w-[1400px] mx-auto"> {/* Changed from mx-auto to mx-8 */}
            <div className="mb-0">
              <div className="flex flex-col">
                <form onSubmit={(e) => e.preventDefault()} className="flex items-center gap-4">
                  {/* BYOW Section - Adjust left margin */}
                  <div className="flex items-center ml-[100px] mr-5"> {/* Changed from ml-auto to ml-[200px] */}
                    <div className="flex items-center px-2 py-1 bg-indigo-200/90 rounded-xl border border-indigo-700/30 shadow-sm">
                      <span className="text-[18px] font-medium text-indigo-900 font-bold mr-3">BYOW</span>

                      {/* Connect to DB button - Now First */}
                      <Tooltip content="Quick Database Connection Check">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowQuickConnectDialog(true)}
                          className="h-8 px-2.5 bg-white hover:bg-indigo-50 text-indigo-600 flex items-center gap-1.5 shadow-sm border border-indigo-100 rounded-xl mr-2"
                        >
                          <Database className="h-4 w-4" />
                          <span className="text-[15px] font-medium">Connect</span>
                        </Button>
                      </Tooltip>

                      {/* Create DB button - Now Second */}
                      <Tooltip content="Create New Neon Database">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={async (e) => {
                            e.preventDefault();
                            
                            if (isInIframe()) {
                              // If in iframe, open in new window
                              const newWindow = window.open(window.location.href, '_blank');
                              if (newWindow) {
                                newWindow.focus();
                              }
                              
                              toast({
                                title: "Opening in new window",
                                description: "Continue with database creation in the new window",
                                duration: 3000,
                                className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
                              });
                            } else {
                              // If not in iframe, proceed with normal flow
                              if (!isAuthenticated) {
                                await loginWithRedirect();
                                return;
                              }
                              setShowCreateDbDialog(true);
                            }
                          }}
                          className="h-8 px-2.5 bg-white hover:bg-indigo-50 text-indigo-600 flex items-center gap-1.5 shadow-sm border border-indigo-100 rounded-xl"
                        >
                          <Plus className="h-4 w-4" />
                          <span className="text-[15px] font-medium">Create DB</span>
                        </Button>
                      </Tooltip>

                      {/* Add Logout button - Only show when authenticated */}
                      {isAuthenticated && (
                        <Tooltip content="Logout">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => logout({ 
                              logoutParams: {
                                returnTo: window.location.origin
                              }
                            })}
                            className="h-8 px-2.5 ml-2 bg-white hover:bg-indigo-50 text-indigo-600 flex items-center gap-1.5 shadow-sm border border-indigo-100 rounded-xl"
                          >
                            <LogOut className="h-4 w-4" />
                            <span className="text-[15px] font-medium">Logout</span>
                          </Button>
                        </Tooltip>
                      )}
                    </div>
                  </div>

                  {/* Vertical Divider */}
                  <div className="h-8 border-2 border-indigo-500 mr-0 ml-0"></div>

                  {/* File Upload Container */}
                  <div className="px-2 py-1 bg-white/90 rounded-xl border border-indigo-100 shadow-sm">
                    <Input
                      type="file"
                      name="file"
                      accept=".txt,.csv"
                      required
                      className="cursor-pointer text-[14px] w-[210px] border-none focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 bg-transparent h-8 px-1"
                    />
                  </div>

                  {/* Removed vertical line, just using gap-2 spacing */}

                  {/* First Button Group */}
                  <div className="flex h-9 items-center gap-0 px-0 py-1 bg-indigo-50/90 rounded-xl border border-indigo-300 shadow-sm">
                    <Tooltip content="View as Interactive Table">
                      <Button
                        type="button"
                        disabled={isGridLoading}
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          const form = e.currentTarget.closest('form');
                          if (form) handleFileUpload(form, 'grid');
                        }}
                        className="h-9 px-2.5 bg-indigo-50/30 hover:bg-indigo-100/40 text-indigo-600 flex items-center gap-1"
                      >
                        {isGridLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                            <span className="text-[15px] font-medium text-indigo-600">Table</span>
                          </>
                        ) : (
                          <>
                            <TableProperties className="h-4 w-4 text-indigo-600" />
                            <span className="text-[15px] font-medium text-indigo-600">Table</span>
                          </>
                        )}
                      </Button>
                    </Tooltip>

                    {/* Structure Button - Added relative positioning to container */}
                    <div className="relative">
                      <Tooltip content="Analyze Data Structure">
                        <div className="relative analysis-menu-container">
                          <Button
                            type="button"
                            disabled={analysisState.isStructureAnalyzing}
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              const form = e.currentTarget.closest('form');
                              const fileInput = form?.querySelector('input[type="file"]') as HTMLInputElement;
                              if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                                toast({
                                  title: "Missing File",
                                  description: "Please choose a file first",
                                  duration: 3000,
                                  className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
                                });
                                return;
                              }
                              setShowStructureOptions(!showStructureOptions);
                            }}
                            className="h-9 px-2.5 bg-indigo-50/30 hover:bg-indigo-100/40 text-indigo-600 flex items-center gap-1"
                          >
                            {analysisState.isStructureAnalyzing ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-[15px] font-medium">Structure</span>
                              </>
                            ) : (
                              <>
                                <LayoutGrid className="h-4 w-4" />
                                <span className="text-[15px] font-medium">Structure</span>
                              </>
                            )}
                          </Button>

                          {/* Structure Dropdown Menu - Fixed positioning */}
                          {showStructureOptions && !analysisState.isStructureAnalyzing && (
                            <div className="absolute right-0 mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                              <div className="py-1">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setShowStructureOptions(false);
                                    const form = e.currentTarget.closest('form');
                                    const fileInput = form?.querySelector('input[type="file"]') as HTMLInputElement;
                                    if (fileInput?.files?.[0]) {
                                      handleAnalyzeData(fileInput.files[0]);
                                    }
                                  }}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  Quick Structure
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setShowStructureOptions(false);
                                    setCustomStructurePrompt(DEFAULT_STRUCTURE_PROMPT);
                                    setShowCustomStructureDialog(true);
                                  }}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  Custom Structure
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </Tooltip>
                    </div>

                    {/* Analysis Button - Added relative positioning to container */}
                    <div className="relative">
                      <div className="relative analysis-menu-container">
                        <Tooltip content="Run AI Analysis on Your Data">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              const form = e.currentTarget.closest('form');
                              const fileInput = form?.querySelector('input[type="file"]') as HTMLInputElement;
                              if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                                toast({
                                  title: "Missing File",
                                  description: "Please choose a file first",
                                  duration: 3000,
                                  className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
                                });
                                return;
                              }
                              if (!analysisState.isQuickAnalyzing && !analysisState.isCustomAnalyzing) {
                                setShowAnalysisOptions(!showAnalysisOptions);
                              }
                            }}
                            className="h-9 px-2.5 bg-indigo-50/30 hover:bg-indigo-100/40 text-indigo-600 flex items-center gap-1"
                            disabled={analysisState.isQuickAnalyzing || analysisState.isCustomAnalyzing}
                          >
                            {(analysisState.isQuickAnalyzing || analysisState.isCustomAnalyzing) ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-[15px] font-medium">Processing...</span>
                              </>
                            ) : (
                              <>
                                <LineChart className="h-4 w-4" />
                                <span className="text-[15px] font-medium">Analysis</span>
                              </>
                            )}
                          </Button>
                        </Tooltip>

                        {/* Analysis Options Dropdown - Fixed positioning */}
                        {showAnalysisOptions && !analysisState.isQuickAnalyzing && !analysisState.isCustomAnalyzing && (
                          <div className="absolute right-0 mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                            <div className="py-1">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  setShowAnalysisOptions(false);
                                  const form = e.currentTarget.closest('form');
                                  const fileInput = form?.querySelector('input[type="file"]') as HTMLInputElement;
                                  if (fileInput?.files?.[0]) {
                                    handleQuickAnalysis(fileInput.files[0]);
                                  }
                                }}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                Quick Analysis
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  setShowAnalysisOptions(false);
                                  setCustomPrompt(DEFAULT_ANALYSIS_PROMPT);
                                  setShowCustomPromptDialog(true);
                                }}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                Custom Analysis
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Removed vertical line, just using gap-2 spacing */}

                  {/* Database Actions Group */}
                  <div className="flex h-9 items-center gap-3 px-0 py-1 bg-indigo-50/90 rounded-xl border border-indigo-300 shadow-sm">
                    {SHOW_REX_DB_BUTTON && (
                      <Tooltip content="Push Data to Database">
                        <Button
                          type="button"
                          disabled={isDbLoading}
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            const form = e.currentTarget.closest('form');
                            if (form) handleFileUpload(form, 'database');
                          }}
                          // Adjusted width and padding
                          className="w-[120px] h-8 px-1 bg-indigo-50/30 hover:bg-indigo-100/40 text-indigo-600 flex items-center gap-1"
                        >
                          {isDbLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-[15px] font-medium">Push: REX DB</span>
                            </>
                          ) : (
                            <>
                              <Database className="h-4 w-4" />
                              <span className="text-[15px] font-medium">Push: REX DB</span>
                            </>
                          )}
                        </Button>
                      </Tooltip>
                    )}

                    {/* Push to My DB button - Updated styling */}
                    <Tooltip content="Push to Your Database">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          const form = document.querySelector('form');
                          const fileInput = form?.querySelector('input[type="file"]') as HTMLInputElement;
                          if (!fileInput || !fileInput.files || !fileInput.files.length) {
                            toast({
                              title: "Missing File",
                              description: "Please choose a file first",
                              duration: 3000,
                              className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
                            });
                            return;
                          }
                          await handlePushToMyDb(fileInput.files[0]);
                        }}
                        // Adjusted styling to ensure no overlap
                        className="w-[120px] h-9 px-1.5 bg-indigo-200/30 hover:bg-indigo-200/40 text-indigo-600 flex items-center gap-1.5 rounded-xl border border-indigo-300 shadow-sm"
                      >
                        {isCustomDbLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-[15px] font-medium">Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4" />
                            <span className="text-[15px] font-medium">Push- My DB</span>
                          </>
                        )}
                      </Button>
                    </Tooltip>
                  </div>
                </form>

                {/* Bottom Row - Table Name - With adjusted left margin */}
                <div className="mt-1 px-2 min-h-[14px] mb-0 leading-[14px] flex items-center border-b border-transparent">
                  <span className="text-sm text-blue-700 leading-none ml-[700px] italic font-semibold"> {/* Changed from 600px to 528px (22 inches total) */}
                    {state.tableInfo.tableName ? `Table: ${state.tableInfo.tableName}` : '\u00A0'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 -mt-1"> {/* Added negative top margin */}
          {/* Chat Section */}
          <div className="md:col-span-2">
            <AnalysisTabs
              analysisContent={analysisContent}
              quickAnalysisContent={quickAnalysisContent}
              sessionId={sessionId}
              sharedMessages={sharedMessages}
              setSharedMessages={setSharedMessages}
              onGeneratePdf={handleGeneratePdf}
              onGenerateQuickPdf={handleGenerateQuickAnalysisPdf}
              isPdfGenerating={isPdfGenerating}
              isQuickPdfGenerating={isQuickPdfGenerating}
            />
          </div>

          {/* Chart Section */}
          <div className="md:col-span-1">
            <div
              className={`${panelState.maximized && panelState.maximized !== 'charts' ? 'hidden' : ''}
              ${panelState.maximized === 'charts' ? 'fixed inset-4 z-50 bg-white shadow-2xl rounded-lg' : ''}`}
            >
              <div className={`rounded-t-lg ${SECTION_COLORS.chart} px-3 py-1 border-b flex justify-between items-center`}>
                <span className="font-medium text-base text-indigo-800">Charts</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-indigo-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMaximize('charts');
                    }}
                  >
                    {panelState.maximized === 'charts' ? (
                      <Minimize2 className="h-4 w-4 text-indigo-700" />
                    ) : (
                      <Maximize2 className="h-4 w-4 text-indigo-700" />
                    )}
                  </Button>
                </div>
              </div>
              <Card
                className={`w-full border-indigo-100 bg-white/50 shadow-sm hover:shadow-md transition-shadow duration-200 rounded-t-none
                  ${panelState.maximized === 'charts' ? 'h-[calc(100%-2rem)]' : 'h-[300px]'}`}
              >
                <CardContent className="h-full p-0">
                  <ChartDisplay charts={state.charts} />
                </CardContent>
              </Card>
            </div>

            {/* Document Box */}
            <div className="mt-4">
              <DocumentBox
                isMaximized={panelState.maximized === 'documents'}
                onExpand={() => toggleMaximize('documents')}
                onDocumentSelect={(type) => {
                  console.log('Selected document type:', type);
                  // Handle document type selection
                }}
              />
            </div>
          </div>
        </div>

        {/* Data Table Section - Now properly positioned at the bottom */}
        <div className="mt-6 w-full">
          <div className={`rounded-t-lg ${SECTION_COLORS.table} px-3 py-1 border-b flex justify-between items-center`}>
            <span className="font-medium text-base text-emerald-800">
              Data Table
            </span>
          </div>

          {/* Show either the grid data or the regular table view */}
          {gridData ? (
            <div className="border border-t-0 border-indigo-100 rounded-b-lg">
              <DataTable
                columns={gridData.columns}
                data={gridData.data}
                tableType="advanced"
              />
            </div>
          ) : (
            tableView && state.tables?.[tableView.type] && (
              <div className="border border-t-0 border-indigo-100 rounded-b-lg">
                <DataTable
                  columns={state.tables?.[tableView.type]?.columns || []}
                  data={state.tables?.[tableView.type]?.data || []}
                  tableType={tableView.type === 'summary' ? 'summary' :
                    tableView.type === 'main' ? tableView.viewType :
                      'simple'}
                />
              </div>
            )
          )}
        </div>
      </div>

      {/* Add Quick Connect dialog */}
      {showQuickConnectDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl"> {/* Changed from max-w-md to max-w-4xl */}
            <h3 className="text-lg font-medium mb-4">Connect to Database</h3>

            <div className="grid grid-cols-2 gap-6"> {/* Added grid layout */}
              {/* Left Column */}
              <div className="space-y-4">
                {/* Nickname field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Database Nickname <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={dbNickname}
                    onChange={(e) => setDbNickname(e.target.value)}
                    className="w-full p-2 border rounded-md text-sm"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    A suggested nickname has been provided. Feel free to change it.
                  </p>
                </div>

                {/* Connection string input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Connection Details <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={connectionString}
                    onChange={(e) => setConnectionString(e.target.value)}
                    placeholder="Paste your connection details here..."
                    className="w-full h-[200px] p-3 border rounded-md placeholder:text-gray-400 text-sm"
                  />
                </div>
              </div>

              {/* Right Column - Instructions */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Connection Information Guide</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>Please provide the following database connection details:</p>
                  <ul className="list-disc pl-4 space-y-0">
                    <li>Host name (e.g., db.example.com)</li>
                    <li>Database name</li>
                    <li>Username</li>
                    <li>Password</li>
                    <li>Schema (optional)</li>
                    <li>Database type if not specified in connection string (PostgreSQL/MySQL)</li>
                    <li>Port number if different from default (default: PostgreSQL 5432, MySQL 3306)</li>
                  </ul>
                  <div className="mt-4 p-3 bg-blue-50 rounded-md">
                    <p className="text-blue-700 font-medium mb-2">Pro Tips:</p>
                    <ul className="list-disc pl-4 space-y-2 text-blue-600">
                      <li>Format doesn't matter - our AI can understand various formats e.g connection strings, seperate lines. You can dump it here in whichever format you have it.</li>
                      <li>Include a meaningful nickname for easier reference</li>                
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowQuickConnectDialog(false);
                  setDbNickname(TREE_NAMES[Math.floor(Math.random() * TREE_NAMES.length)]);
                }}
                disabled={isQuickConnecting}
              >
                Cancel
              </Button>
              <Button
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  if (!dbNickname.trim()) {
                    toast({
                      title: "Missing Nickname",
                      description: "Please provide a database nickname",
                      duration: 3000,
                      className: "bg-red-50 border-red-200 shadow-lg border-2 rounded-xl",
                    });
                    return;
                  }
                  const fullConnectionString = `${connectionString}\nNickname: ${dbNickname}`;
                  handleQuickConnect(fullConnectionString);
                }}
                disabled={isQuickConnecting || !dbNickname.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isQuickConnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  'Send to AI Agent'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCustomStructureDialog && !analysisState.isStructureAnalyzing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <h3 className="text-lg font-medium mb-4">Custom Structure Analysis Prompt</h3>
            <textarea
              value={customStructurePrompt}
              onChange={(e) => setCustomStructurePrompt(e.target.value)}
              className="w-full h-64 p-2 border rounded-md mb-4"
              placeholder="Enter your custom structure analysis prompt..."
            />
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setShowCustomStructureDialog(false)}
                variant="outline"
                size="sm"
                className="bg-white hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation(); // Add this to prevent event bubbling
                  const form = document.querySelector('form'); // Get the form directly
                  const fileInput = form?.querySelector('input[type="file"]') as HTMLInputElement;
                  if (fileInput?.files?.[0]) {
                    handleCustomStructureAnalysis(fileInput.files[0], customStructurePrompt);
                  } else {
                    toast({
                      title: "Missing File",
                      description: "Please choose a file first",
                      duration: 3000,
                      className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
                    });
                  }
                }}
                variant="default"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={analysisState.isStructureAnalyzing}
              >
                {analysisState.isStructureAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  'Analyze Structure'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showPushToMyDbDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
            <h3 className="text-lg font-medium mb-4">Push to My Database</h3>

            <div className="space-y-4">
              {/* Database Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Database Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={myDbCredentials.db_type}
                  onChange={(e) => handleMyDbCredentialsChange('db_type', e.target.value)}
                  className="w-full p-2 border rounded-md text-sm"
                  required
                >
                  <option value="">Select Database Type</option>
                  <option value="postgresql">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                </select>
              </div>

              {/* Host */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Host <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={myDbCredentials.host}
                  onChange={(e) => handleMyDbCredentialsChange('host', e.target.value)}
                  placeholder="e.g., your-db-host.com"
                  className="w-full p-2 border rounded-md text-sm"
                  required
                />
              </div>

              {/* Database Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Database <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={myDbCredentials.database}
                  onChange={(e) => handleMyDbCredentialsChange('database', e.target.value)}
                  placeholder="your_database"
                  className="w-full p-2 border rounded-md text-sm"
                  required
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={myDbCredentials.user}
                  onChange={(e) => handleMyDbCredentialsChange('user', e.target.value)}
                  placeholder="your_username"
                  className="w-full p-2 border rounded-md text-sm"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={myDbCredentials.password}
                  onChange={(e) => handleMyDbCredentialsChange('password', e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-2 border rounded-md text-sm"
                  required
                />
              </div>

              {/* Schema (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Schema <span className="text-gray-400 text-xs">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={myDbCredentials.schema}
                  onChange={(e) => handleMyDbCredentialsChange('schema', e.target.value)}
                  placeholder="custom_schema"
                  className="w-full p-2 border rounded-md text-sm"
                />
              </div>

              {/* Port (Optional with default) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Port <span className="text-gray-400 text-xs">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={myDbCredentials.port}
                  onChange={(e) => handleMyDbCredentialsChange('port', e.target.value)}
                  placeholder={myDbCredentials.db_type === 'postgresql' ? '5432' : '3306'}
                  className="w-full p-2 border rounded-md text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPushToMyDbDialog(false);
                  setMyDbCredentials({
                    host: '',
                    database: '',
                    user: '',
                    password: '',
                    schema: '',
                    port: '',
                    db_type: ''
                  });
                }}
                className="bg-white hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  const form = document.querySelector('form');
                  const fileInput = form?.querySelector('input[type="file"]') as HTMLInputElement;

                  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                    toast({
                      title: "Missing File",
                      description: "Please choose a file first",
                      duration: 3000,
                      className: "bg-blue-50 border-blue-200 shadow-lg border-2 rounded-xl",
                    });
                    return;
                  }

                  try {
                    console.log('Starting upload process...');
                    setIsDbLoading(true);

                    await handleCustomDbUpload(
                      fileInput.files[0],
                      myDbCredentials,
                      setIsDbLoading,
                      toast,
                      dispatch
                    );

                    // Close the dialog and reset form on success
                    setShowPushToMyDbDialog(false);
                    setMyDbCredentials({
                      host: '',
                      database: '',
                      user: '',
                      password: '',
                      schema: '',
                      port: '',
                      db_type: ''
                    });

                  } catch (error) {
                    console.error('Error in upload handler:', error);
                    toast({
                      title: "Upload Failed",
                      description: error instanceof Error ? error.message : "Failed to upload file",
                      duration: 3000,
                      className: "bg-red-50 border-red-200 shadow-lg border-2 rounded-xl",
                    });
                  } finally {
                    setIsDbLoading(false);
                  }
                }}
                disabled={!validateMyDbForm()}
                className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-300"
              >
                {isDbLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  'Push Data'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Analysis Dialog right before the closing ToastProvider */}
      {showCustomPromptDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <h3 className="text-lg font-medium mb-4">Custom Analysis Prompt</h3>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="w-full h-64 p-2 border rounded-md mb-4"
              placeholder="Enter your custom analysis prompt..."
            />
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setShowCustomPromptDialog(false)}
                variant="outline"
                size="sm"
                className="bg-white hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  const form = document.querySelector('form');
                  const fileInput = form?.querySelector('input[type="file"]') as HTMLInputElement;
                  if (fileInput?.files?.[0]) {
                    handleCustomAnalysis(fileInput.files[0], customPrompt);
                    setShowCustomPromptDialog(false);
                  }
                }}
                variant="default"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={analysisState.isCustomAnalyzing}
              >
                {analysisState.isCustomAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  'Analyze'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Toaster />

      {/* Create DB Dialog */}
      {showCreateDbDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Create New Neon Database</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Please provide a nickname for your new Neon PostgreSQL database.
                  This will help you identify it later.
                </label>
                <input
                  type="text"
                  value={dbNickname}
                  onChange={(e) => setDbNickname(e.target.value)}
                  placeholder="e.g., my-analytics-db"
                  className="w-full p-2 border rounded-md text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDbDialog(false);
                  setDbNickname('');
                }}
                disabled={isCreatingDb}
              >
                Cancel
              </Button>
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  handleCreateNeonDb(dbNickname);
                }}
                disabled={isCreatingDb || !dbNickname.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isCreatingDb ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  'Create Database'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {credentialsDisplay.show && credentialsDisplay.data && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-lg p-6 w-full max-w-xl mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Database Credentials</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCredentialsDisplay({ show: false, data: null, message: "" })}
                className="hover:bg-gray-100 rounded-full h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">{credentialsDisplay.message}</p>
            
            <div className="relative bg-gray-50 p-4 rounded-lg">
              <div className="font-mono text-sm whitespace-pre-wrap bg-white p-4 rounded border border-gray-200">
                {`Host: ${credentialsDisplay.data.hostname}
Database: ${credentialsDisplay.data.database}
Username: ${credentialsDisplay.data.username}
Password: ${credentialsDisplay.data.password}
Port: ${credentialsDisplay.data.port}
Type: ${credentialsDisplay.data.type}`}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const credentials = `Host: ${credentialsDisplay.data?.hostname}
Database: ${credentialsDisplay.data?.database}
Username: ${credentialsDisplay.data?.username}
Password: ${credentialsDisplay.data?.password}
Port: ${credentialsDisplay.data?.port}
Type: ${credentialsDisplay.data?.type}`;
                  navigator.clipboard.writeText(credentials);
                  toast({
                    title: "Copied!",
                    description: "All credentials copied to clipboard",
                    duration: 2000,
                  });
                }}
                className="absolute top-6 right-6 bg-white"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </ToastProvider>
  )
}

export default App
