FROM mcr.microsoft.com/playwright:v1.44.0-jammy

# Set the working directory
WORKDIR /usr/src/app

# Copy the current directory contents into the container at /usr/src/app
COPY . .

# Install any needed packages specified in package.json
RUN npm install
# catch any ts errors now
RUN npm test

WORKDIR /usr/src/app/scripts/tplink
RUN npm install

WORKDIR /usr/src/app/scripts/ltu
RUN curl -sSL https://install.python-poetry.org | python3 -
RUN /root/.local/bin/poetry install

WORKDIR /usr/src/app

ENV PORT_WEBAPP=7200
ENV LABEL_URL=http://label:7210
# Make port 7200 available to the world outside this container
EXPOSE ${PORT_WEBAPP}

# Define environment variable
#ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright/

# Run the API on container startup
CMD ["sh", "-c", "npm run prod -- -p $PORT_WEBAPP"]
