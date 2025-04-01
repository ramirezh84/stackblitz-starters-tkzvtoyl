#!/bin/bash

# Install D3.js and its TypeScript types
npm install d3 @types/d3 --save

# Build the project
npm run build

# Start the server
npm run dev
