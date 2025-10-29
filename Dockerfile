# Use a base Node image
FROM node:22

# Create app directory
WORKDIR /app

# Copy only package files first (to leverage Docker caching)
COPY package*.json ./

# Copy the rest of the project
COPY . .

# Expose the app port
EXPOSE 8080

# Start the server
CMD ["node", "app.js"]
