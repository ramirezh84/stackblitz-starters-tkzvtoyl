import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { getAllResources } from './aws.js';
import { discoverResourceRelationships } from './resourceRelationships.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 5173;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.get('/api/resources', async (req, res) => {
  try {
    const resources = await getAllResources();
    res.json(resources);
  } catch (error) {
    console.error('Error fetching resources:', error);
    res.status(500).json({ error: 'Failed to fetch AWS resources' });
  }
});

// Resource Relationships API
app.get('/api/resource-relationships', async (req, res) => {
  try {
    const { application } = req.query;
    console.log(`Fetching relationships for application: ${application}`);
    
    const allResources = await getAllResources();
    console.log(`Total resources: ${allResources.length}`);
    
    // Filter resources by application if specified
    const focusResources = application 
      ? allResources.filter(r => r.application === application)
      : null;
    
    if (focusResources) {
      console.log(`Resources for application ${application}: ${focusResources.length}`);
      console.log('Focus resources:', focusResources.map(r => ({ id: r.id, name: r.name, type: r.type })));
    }
    
    const relationships = await discoverResourceRelationships(allResources, focusResources);
    console.log(`Discovered relationships: ${relationships.length}`);
    console.log('Relationships:', JSON.stringify(relationships, null, 2));
    
    // Ensure proper JSON formatting by using a properly structured object
    const responseData = {
      resources: focusResources || allResources,
      relationships: relationships || [],
      externalResources: focusResources 
        ? allResources.filter(r => !focusResources.some(fr => fr.id === r.id))
        : []
    };
    
    // Log the response data
    console.log(`External resources: ${responseData.externalResources.length}`);
    
    // Set proper content type and stringify the JSON with proper formatting
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(responseData));
  } catch (error) {
    console.error('Error fetching resource relationships:', error);
    res.status(500).json({ error: 'Failed to fetch resource relationships' });
  }
});

// Serve static files
app.use(express.static(join(__dirname, '../dist')));

// Handle all other routes by serving index.html
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
