# Use an official Node.js runtime as a parent image
FROM node:22

# Set the working directory
WORKDIR /usr/src/app

# Copy the current directory contents into the container at /usr/src/app
COPY . .

# Install any needed packages specified in package.json
RUN npm install
# catch any ts errors now
RUN npm test

ENV PORT_WEBAPP=7200
ENV TPLINK_URL=http://tplink:7201
# Make port 7200 available to the world outside this container
EXPOSE ${PORT_WEBAPP}

# Define environment variable
#ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright/

# Run the API on container startup
CMD ["sh", "-c", "npm run prod -- -p $PORT_WEBAPP"]
