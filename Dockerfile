FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Build the frontend
RUN npm run build

# Expose the port
EXPOSE 5173

# Set AWS environment variables at runtime
ENV AWS_ACCESS_KEY_ID=
ENV AWS_SECRET_ACCESS_KEY=
ENV AWS_REGION=us-east-1

# Start the application
CMD ["node", "server/index.js"]