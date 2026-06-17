FROM node:20-slim

RUN apt-get update && apt-get install -y ffmpeg python3 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV PORT=3001
EXPOSE 3001

CMD ["node", "src/index.js"]
