# Use Node.js 22 Alpine as the base image
FROM node:22-alpine

# Set working directory to /app
WORKDIR /app

# Copy the server package files first for caching
COPY server/package*.json ./server/

# Install dependencies in the server directory
RUN cd server && npm ci --only=production

# Copy the frontend static assets and server code
COPY css ./css
COPY design-system ./design-system
COPY js ./js
COPY index.html ./
COPY server/src ./server/src

# Expose the API port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the server from the server directory
CMD ["node", "server/src/index.js"]
