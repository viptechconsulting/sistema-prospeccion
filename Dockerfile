FROM node:22-slim
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p /app/data
ENV PORT=3100
EXPOSE 3100
CMD ["node", "src/server.js"]
