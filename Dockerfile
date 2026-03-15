# STAGE 1: Build the React application
FROM node:20-alpine AS build
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all source code
COPY . .

# Catch the argument passed from docker-compose.yml
ARG VITE_API_BASE_URL
# Set it as an environment variable for the build command
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Vite will now see the VITE_API_BASE_URL and bake it into the static files
RUN npm run build

# STAGE 2: Serve with Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]