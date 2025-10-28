FROM uhinf/webprogramming:2526

# Copy your project files into the container
COPY . /website

# Set working directory
WORKDIR /website

# Install Node dependencies
RUN npm install

# Expose the port your Node app listens on
EXPOSE 8080

# Start the Node server instead of nginx
CMD ["node", "app.js"]
