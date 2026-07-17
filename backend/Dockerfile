# Use Node.js 22 Alpine as the base image
FROM node:22-alpine

# Set working directory to /app
WORKDIR /app

# Copy the backend package files first for caching
COPY backend/package*.json ./backend/

# Install dependencies in the backend directory
RUN cd backend && npm ci --only=production

# Copy the frontend static assets and server code
COPY css ./css
COPY design-system ./design-system
COPY js ./js
COPY mockups/mockups.css ./mockups/mockups.css
COPY index.html ./
COPY backend/src ./backend/src

# Expose the API port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the server from the backend directory
CMD ["node", "backend/src/index.js"]
