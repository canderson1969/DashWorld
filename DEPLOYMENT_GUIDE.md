# Dash World - Deployment Guide

Guide to run Dash World locally and deploy to production.

---

## Local Development Setup

### Prerequisites

- Node.js 20+
- Docker Desktop

### 1. Start PostgreSQL with Docker

```bash
docker run -d \
  --name dashworld-db \
  -e POSTGRES_DB=dashworld \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16
```

### 2. Configure Backend

Create `backend/.env`:

```bash
PORT=5000
NODE_ENV=development
JWT_SECRET=change-this-to-a-secure-random-string
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dashworld
UPLOAD_DIR=../uploads
THUMBNAILS_DIR=../uploads/thumbnails
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### 3. Install Dependencies & Start

```bash
# Terminal 1 - Backend
cd backend
npm install
npm run dev

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev
```

### 4. Access the App

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000/api

### Useful Docker Commands

```bash
docker ps                    # List running containers
docker stop dashworld-db     # Stop the database
docker start dashworld-db    # Start the database
docker logs dashworld-db     # View database logs
docker exec -it dashworld-db psql -U postgres -d dashworld  # Connect to DB
```

---

## Option 1: ngrok (Fastest - Temporary Demo)

**Time:** 5 minutes
**Cost:** Free
**Best for:** Quick demos, temporary sharing

### Steps:

1. **Download ngrok:**
   - Visit https://ngrok.com/download
   - Create a free account
   - Download and install ngrok

2. **Start your servers:**
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run dev

   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

3. **Expose backend with ngrok:**
   ```bash
   # Terminal 3
   ngrok http 5000
   ```

   You'll get a URL like: `https://abc123.ngrok-free.app`

4. **Update frontend to use ngrok backend:**

   Create `frontend/.env.local`:
   ```bash
   VITE_API_URL=https://abc123.ngrok-free.app/api
   ```

   Restart frontend server.

5. **Expose frontend with ngrok:**
   ```bash
   # Terminal 4
   ngrok http 3000
   ```

   You'll get a URL like: `https://xyz789.ngrok-free.app`

6. **Share the frontend URL** with your friend!

**Limitations:**
- URLs expire when you close ngrok
- Free tier shows ngrok warning page
- Not suitable for production

---

## Option 2: Cloudflare Pages + Railway (Recommended)

**Time:** 20-30 minutes
**Cost:** Free tier available
**Best for:** Production apps with custom domain

### Database Setup (Railway)

1. **Sign up at Railway.app:**
   - Visit https://railway.app
   - Sign in with GitHub

2. **Create PostgreSQL database:**
   - Click "New Project"
   - Select "Provision PostgreSQL"
   - Railway creates a managed PostgreSQL instance
   - Copy the `DATABASE_URL` from the Variables tab

### Backend Deployment (Railway)

1. **Add backend service:**
   - In the same project, click "New" → "GitHub Repo"
   - Connect your DashWorld repository
   - Set root directory to `backend`
   - Set watch branch to `main`

2. **Set environment variables:**
   ```
   PORT=5000
   NODE_ENV=production
   JWT_SECRET=<generate-strong-random-secret>
   DATABASE_URL=<paste-from-postgresql-service>
   CORS_ORIGINS=https://dashworld.net,https://dev.dashworld.pages.dev
   ```

3. **Add custom domain (optional):**
   - Settings → Domains → Add Domain
   - Add `api.dashworld.net`
   - Add CNAME record to your DNS

4. **Get your backend URL:**
   - Railway provides: `https://your-app.railway.app`
   - Or custom: `https://api.dashworld.net`

### Frontend Deployment (Cloudflare Pages)

1. **Sign up at Cloudflare:**
   - Visit https://dash.cloudflare.com
   - Create account or sign in

2. **Create Pages project:**
   - Go to Workers & Pages → Create → Pages
   - Connect to GitHub
   - Select your DashWorld repository

3. **Configure build settings:**
   - Project name: `dashworld`
   - Production branch: `main`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `frontend`

4. **Set environment variables:**
   ```
   VITE_API_URL=https://api.dashworld.net/api
   ```

5. **Add custom domain:**
   - Custom domains → Add domain
   - Add `dashworld.net` and `www.dashworld.net`
   - Update DNS records as instructed

6. **Deploy:**
   - Click "Save and Deploy"
   - Production URL: `https://dashworld.net`

### Cloudflare R2 Storage Setup

Store video uploads in Cloudflare R2 (S3-compatible, free egress).

1. **Create R2 bucket:**
   - Cloudflare Dashboard → R2 → Create bucket
   - Name: `dashworld-uploads`
   - Location: Automatic

2. **Enable public access:**
   - Bucket → Settings → Public access
   - Enable "Allow public access"
   - Get public URL: `https://pub-xxx.r2.dev`

   Or use custom domain:
   - Add custom domain: `cdn.dashworld.net`
   - Add CNAME record in DNS

3. **Create API token:**
   - R2 → Manage R2 API Tokens → Create API token
   - Permissions: Object Read & Write
   - Specify bucket: `dashworld-uploads`
   - Copy: Account ID, Access Key ID, Secret Access Key

4. **Add to Railway environment variables:**
   ```
   STORAGE_PROVIDER=r2
   R2_ACCOUNT_ID=<your-account-id>
   R2_ACCESS_KEY_ID=<your-access-key-id>
   R2_SECRET_ACCESS_KEY=<your-secret-access-key>
   R2_BUCKET_NAME=dashworld-uploads
   R2_PUBLIC_URL=https://cdn.dashworld.net
   ```

5. **Configure CORS (if needed):**
   - Bucket → Settings → CORS policy
   ```json
   [
     {
       "AllowedOrigins": ["https://dashworld.net"],
       "AllowedMethods": ["GET"],
       "AllowedHeaders": ["*"]
     }
   ]
   ```

---

## Staging/Preview Environments

Test changes before deploying to production.

### How It Works

| Branch | Environment | URL |
|--------|-------------|-----|
| `main` | Production | dashworld.net |
| `dev` | Staging | dev.dashworld.pages.dev |
| PR branches | Preview | pr-123.dashworld.pages.dev |

### Cloudflare Pages (Automatic Previews)

Cloudflare Pages automatically deploys every branch:

1. **Push to dev branch:**
   ```bash
   git checkout dev
   git push origin dev
   ```

2. **Get preview URL:**
   - Cloudflare auto-deploys to `dev.dashworld.pages.dev`
   - Each PR gets its own URL

3. **Configure preview environment variables:**
   - Pages → Settings → Environment variables
   - Add variables for "Preview" environment:
   ```
   VITE_API_URL=https://api-staging.railway.app/api
   ```

### Railway (Staging Environment)

Create a separate staging backend:

1. **Create staging environment:**
   - Project → Settings → Environments
   - Click "New Environment" → Name it "staging"

2. **Configure staging:**
   - Same services auto-created
   - Set different environment variables:
   ```
   NODE_ENV=staging
   DATABASE_URL=<staging-database-url>
   CORS_ORIGINS=https://dev.dashworld.pages.dev
   ```

3. **Link to dev branch:**
   - Service → Settings → Deploy
   - Set branch to `dev` for staging environment

4. **Staging URL:**
   - Railway provides separate URL for staging
   - e.g., `https://dashworld-staging.railway.app`

### Workflow

```
dev branch → push → staging auto-deploys → test
                         ↓
                    looks good?
                         ↓
main branch ← merge ← create PR → production auto-deploys
```

### Database Considerations

**Option A: Shared database (simple)**
- Staging and production use same database
- Good for early development
- Risk: staging bugs can affect production data

**Option B: Separate databases (recommended)**
- Create second PostgreSQL instance for staging
- Safer, but need to manage two databases
- Use database migrations to keep schemas in sync

---

## Option 3: Render (All-in-One)

**Time:** 20 minutes
**Cost:** Free tier available
**Best for:** Simple all-in-one deployment

### Deploy PostgreSQL Database

1. **Sign up at Render.com:**
   - Visit https://render.com
   - Sign in with GitHub

2. **Create PostgreSQL:**
   - Click "New" → "PostgreSQL"
   - Name: `dashworld-db`
   - Select free tier
   - Copy the "External Database URL"

### Deploy Backend

1. **Create Web Service:**
   - Click "New" → "Web Service"
   - Connect GitHub repository
   - Select `backend` directory

2. **Configure:**
   ```
   Name: dashworld-backend
   Environment: Node
   Build Command: npm install
   Start Command: npm start
   ```

3. **Environment Variables:**
   ```
   NODE_ENV=production
   JWT_SECRET=<strong-random-secret>
   DATABASE_URL=<paste-external-database-url>
   CORS_ORIGINS=https://your-frontend.onrender.com
   ```

4. **Create:**
   - Free tier: App sleeps after 15 min inactivity
   - URL: `https://dashworld-backend.onrender.com`

### Deploy Frontend

1. **Create Static Site:**
   - Click "New" → "Static Site"
   - Same repository, `frontend` directory

2. **Configure:**
   ```
   Build Command: npm run build
   Publish Directory: dist
   ```

3. **Environment Variable:**
   ```
   VITE_API_URL=https://dashworld-backend.onrender.com/api
   ```

4. **Deploy:**
   - URL: `https://dashworld.onrender.com`

---

## Option 4: Local Network (Same WiFi)

**Time:** 2 minutes
**Cost:** Free
**Best for:** Showing to someone in the same room/WiFi network

### Steps:

1. **Find your local IP:**
   ```bash
   # Windows
   ipconfig
   # Look for IPv4 Address (e.g., 192.168.1.10)

   # Mac/Linux
   ifconfig
   # Look for inet address
   ```

2. **Update backend CORS:**

   Edit `backend/server.js`:
   ```javascript
   app.use(cors({ origin: '*' })); // Allow all origins for demo
   ```

3. **Start servers with network access:**
   ```bash
   # Backend - runs on your IP
   cd backend
   npm start

   # Frontend - accessible on network
   cd frontend
   npm run dev -- --host
   ```

4. **Access from other devices:**
   - Backend: `http://192.168.1.10:5000`
   - Frontend: `http://192.168.1.10:3000`

5. **Update frontend .env:**
   ```bash
   VITE_API_URL=http://192.168.1.10:5000/api
   ```

**Limitations:**
- Only works on same WiFi network
- Requires your PC to stay on
- IP address may change

---

## Option 5: Docker + Cloud VM (Advanced)

**Time:** 1 hour
**Cost:** $5-10/month (DigitalOcean, AWS, etc.)
**Best for:** Full control, production apps

### Quick Setup with Docker:

1. **Create Dockerfile for backend** (`backend/Dockerfile`):
   ```dockerfile
   FROM node:20
   WORKDIR /app
   COPY package*.json ./
   RUN npm install --production
   COPY . .
   EXPOSE 5000
   CMD ["npm", "start"]
   ```

2. **Create Dockerfile for frontend** (`frontend/Dockerfile`):
   ```dockerfile
   FROM node:20 AS build
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   ARG VITE_API_URL
   ENV VITE_API_URL=$VITE_API_URL
   RUN npm run build

   FROM nginx:alpine
   COPY --from=build /app/dist /usr/share/nginx/html
   EXPOSE 80
   CMD ["nginx", "-g", "daemon off;"]
   ```

3. **Create docker-compose.yml** (project root):
   ```yaml
   version: '3.8'
   services:
     db:
       image: postgres:16
       restart: always
       environment:
         POSTGRES_DB: dashworld
         POSTGRES_USER: postgres
         POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
       volumes:
         - postgres_data:/var/lib/postgresql/data
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U postgres"]
         interval: 5s
         timeout: 5s
         retries: 5

     backend:
       build: ./backend
       restart: always
       ports:
         - "5000:5000"
       environment:
         - NODE_ENV=production
         - PORT=5000
         - JWT_SECRET=${JWT_SECRET}
         - DATABASE_URL=postgresql://postgres:${DB_PASSWORD:-postgres}@db:5432/dashworld
         - CORS_ORIGINS=${FRONTEND_URL:-http://localhost}
       volumes:
         - uploads:/app/uploads
       depends_on:
         db:
           condition: service_healthy

     frontend:
       build:
         context: ./frontend
         args:
           VITE_API_URL: ${API_URL:-http://localhost:5000}/api
       restart: always
       ports:
         - "80:80"
       depends_on:
         - backend

   volumes:
     postgres_data:
     uploads:
   ```

4. **Create .env file** (project root):
   ```bash
   JWT_SECRET=your-secure-random-secret-here
   DB_PASSWORD=your-secure-db-password
   API_URL=http://your-server-ip:5000
   FRONTEND_URL=http://your-server-ip
   ```

5. **Deploy to DigitalOcean/AWS/etc:**
   ```bash
   # On your server
   git clone <your-repo>
   cd DashWorld

   # Create .env with production values
   nano .env

   # Start all services
   docker-compose up -d

   # View logs
   docker-compose logs -f
   ```

6. **Useful commands:**
   ```bash
   docker-compose down          # Stop all services
   docker-compose up -d --build # Rebuild and restart
   docker-compose ps            # Check service status
   docker-compose exec db psql -U postgres -d dashworld  # Access DB
   ```

---

## Recommendations by Use Case

### "Show my friend right now"
→ **Option 4: Local Network** (if same WiFi)
→ **Option 1: ngrok** (if remote)

### "Add to my portfolio"
→ **Option 2: Vercel + Railway**

### "Quick permanent demo"
→ **Option 3: Render**

### "Production application"
→ **Option 5: Docker + Cloud VM**

---

## Production Checklist

Before sharing publicly, ensure:

### Required
- [ ] Change `JWT_SECRET` to strong random value (use `openssl rand -base64 32`)
- [ ] Set strong `DB_PASSWORD` for PostgreSQL
- [ ] Update `CORS_ORIGINS` to specific frontend domain(s)
- [ ] Enable HTTPS (automatic with Vercel/Render/Railway, or use Caddy/nginx)
- [ ] Verify `DATABASE_URL` points to production PostgreSQL

### Recommended
- [ ] Set up automated database backups
- [ ] Configure file storage (S3, Cloudflare R2) for uploads in production
- [ ] Add rate limiting to prevent abuse
- [ ] Set up monitoring (Sentry, LogRocket, or similar)
- [ ] Configure log aggregation for debugging
- [ ] Test video upload size limits match your hosting provider
- [ ] Set up health check endpoints for uptime monitoring

### Already Implemented
- [x] PostgreSQL database (production-ready)
- [x] Structured logging with Winston
- [x] Input validation and sanitization
- [x] JWT authentication
- [x] CORS configuration
- [x] Environment-based configuration

---

## Troubleshooting

### Database Connection Issues

**"DATABASE_URL environment variable is required"**
- Ensure `dotenv` is installed: `npm install dotenv`
- Check `.env` file exists in `backend/` directory
- Verify `DATABASE_URL` is set correctly

**"password authentication failed"**
- Check PostgreSQL is running: `docker ps`
- Verify password matches in `DATABASE_URL` and Docker container
- If using local PostgreSQL, it may conflict with Docker on port 5432

**Port 5432 already in use**
- Stop local PostgreSQL: `net stop postgresql-x64-16` (Windows)
- Or use different port: `-p 5433:5432` in Docker and update `DATABASE_URL`

### CORS Errors
- Check `CORS_ORIGINS` includes your frontend URL (with port if applicable)
- Ensure backend URL includes `/api` prefix
- Clear browser cache

### Video Upload Fails
- Check file size limits (250MB default)
- Verify upload directory permissions
- Check cloud provider upload limits

### App Sleeps (Render free tier)
- First request after sleep takes 30-60 seconds
- Upgrade to paid tier for always-on
- Use cron job to ping app every 10 minutes

### Environment Variables Not Working
- Restart build/deployment after changes
- Check for typos in variable names
- Frontend vars must start with `VITE_`

### Docker Issues
- **Container won't start:** Check logs with `docker logs dashworld-db`
- **Data lost after restart:** Ensure volumes are configured in docker-compose
- **Can't connect to DB:** Wait for healthcheck, use `docker-compose logs db`

---

## Cost Comparison

| Option | Monthly Cost | Setup Time | Uptime |
|--------|-------------|------------|--------|
| ngrok | Free* | 5 min | While running |
| Vercel + Railway | Free** | 20 min | 99.9% |
| Render | Free** | 20 min | 99.9% (sleeps) |
| DigitalOcean | $6 | 1 hour | 99.99% |
| AWS/GCP | $10-20 | 2 hours | 99.99% |

*Free tier has limitations
**Free tier has usage limits

---

## Next Steps

1. Choose deployment option based on your needs
2. Follow the steps for that option
3. Share the URL with your friend
4. Monitor usage and performance
5. Upgrade to paid tier if needed

For questions or issues, refer to:
- [Vercel Docs](https://vercel.com/docs)
- [Railway Docs](https://docs.railway.app)
- [Render Docs](https://render.com/docs)
- [ngrok Docs](https://ngrok.com/docs)
