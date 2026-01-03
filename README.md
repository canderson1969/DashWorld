# Dash World

A web platform for uploading, browsing, and requesting dashcam footage of traffic incidents. Help people find video evidence of accidents by providing a centralized repository of dashcam recordings with location and time-based search.

![Status](https://img.shields.io/badge/status-development-yellow)
![Node](https://img.shields.io/badge/node-v20+-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## Overview

Dash World connects dashcam owners with people who need video evidence of traffic incidents. Upload footage, browse by location and time, and request access to specific recordings.

**Key Features:**
- 📹 Upload dashcam footage with automatic GPS and timestamp extraction
- 🗺️ Interactive map view to browse footage by location
- 🔍 Search and filter by date, time, location, and incident type
- 📧 Request system to contact footage uploaders
- 🔐 User authentication and authorization
- 📱 Mobile-responsive design

## Tech Stack

### Frontend
- **React 18** + **TypeScript** - Type-safe UI development
- **Vite** - Lightning-fast development and builds
- **Tailwind CSS** - Utility-first styling
- **Leaflet.js** - Interactive maps
- **ExifReader** - Video metadata extraction

### Backend
- **Node.js v24** + **Express 4** - REST API server
- **Winston** - Structured logging
- **Multer** - File upload handling
- **JWT** + **bcrypt** - Authentication and security

### Data Storage
- **JSON files** - Flat-file database (development)
- **File system** - Video and thumbnail storage

## Quick Start

### Prerequisites

- Node.js v20 or higher
- npm or yarn package manager
- 500MB+ free disk space (for uploads)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/DashWorld.git
cd DashWorld

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Configuration

#### Backend (.env)

Create `backend/.env`:

```bash
PORT=5000
NODE_ENV=development
CORS_ORIGIN=*
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
LOG_LEVEL=info
```

#### Frontend (.env)

Create `frontend/.env`:

```bash
VITE_API_URL=http://localhost:5000/api
```

### Running the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

Server runs on `http://localhost:5000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

App runs on `http://localhost:5173`

**Open browser:** Navigate to `http://localhost:5173`

## Project Structure

```
DashWorld/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── DashWorld.tsx     # Main app component
│   │   ├── api.ts            # Backend API client
│   │   ├── config/           # Configuration constants
│   │   └── utils/            # Utility functions
│   └── package.json
│
├── backend/                  # Express backend server
│   ├── server.js             # Main server entry point
│   ├── routes/               # API route handlers
│   ├── utils/                # Utilities (auth, logging, geocoding)
│   ├── config/               # Configuration constants
│   ├── data/                 # JSON database files
│   └── package.json
│
├── uploads/                  # Uploaded files
│   ├── *.mp4                 # Video files
│   └── thumbnails/           # Auto-generated thumbnails
│
├── ARCHITECTURE.md           # System architecture documentation
├── Claude.MD                 # Development guidelines
└── README.md                 # This file
```

## Documentation

### Core Documentation
- **[README.md](README.md)** - Project overview and quick start (this file)
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and data models
- **[Claude.MD](Claude.MD)** - Development guidelines and coding standards

### Module Documentation
- **[Backend README](backend/README.md)** - API endpoints, configuration, and backend architecture
- **[Frontend README](frontend/README.md)** - Components, state management, and frontend architecture

### Implementation Guides
- **[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)** - Detailed implementation roadmap
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Summary of completed work
- **[METADATA_FEATURE.md](METADATA_FEATURE.md)** - Video metadata extraction feature

### Audit Reports
- **[AUDIT_REPORT.md](AUDIT_REPORT.md)** - TypeScript codebase audit
- **[AUDIT_REPORT_JS.md](AUDIT_REPORT_JS.md)** - JavaScript backend audit

## Usage

### Uploading Footage

1. **Click "Upload Footage"** button (requires login)
2. **Select video file** (MP4, MOV, or AVI, max 250MB)
3. **Verify timestamp** - Extracted from video metadata or enter manually
4. **Set location** - Drag map marker or enter coordinates
5. **Add details** - Select incident type and add description
6. **Upload** - Thumbnail generated automatically

### Browsing Footage

**Map View:**
- Pan and zoom to explore locations
- Click markers to see footage preview
- Blue markers = selected footage

**Grid View:**
- Thumbnail cards with location, date, and time
- Click card to watch full video

**Filters:**
- Search by location or description
- Filter by date range
- Filter by time range
- Filter by incident type

### Requesting Footage

1. **Watch video** on detail page
2. **Click "Request Unblurred Version"**
3. **Fill contact form** with name, email, and reason
4. **Submit** - Uploader will be notified

### Authentication

**Register:**
- Username (3-30 characters)
- Email address
- Password (minimum 6 characters)

**Login:**
- Email and password
- Receive JWT token (expires in 7 days)

**Roles:**
- `user` - Upload and delete own footage
- `moderator` - Edit any footage description
- `admin` - Full access to all operations

## API Endpoints

Full API documentation in [backend/README.md](backend/README.md).

### Quick Reference

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/health` | Health check | No |
| GET | `/api/footage` | Get all footage | No |
| GET | `/api/footage/:id` | Get footage by ID | No |
| POST | `/api/footage/upload` | Upload new footage | Yes |
| DELETE | `/api/footage/:id` | Delete footage | Yes |
| PATCH | `/api/footage/:id/description` | Update description | Mod/Admin |
| POST | `/api/footage/:id/request` | Submit access request | No |
| GET | `/api/footage/:id/requests` | Get all requests | No |
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login user | No |

## Data Models

### Footage

```typescript
{
  id: number;
  filename: string;
  thumbnail: string | null;
  location_name: string;
  lat: number;
  lng: number;
  incident_date: string;         // YYYY-MM-DD
  incident_time: string;         // HH:MM
  incident_type: string;         // collision | near_miss | rear_end | side_swipe | other
  description: string | null;
  duration: number | null;       // seconds
  user_id: number;
  created_at: string;            // ISO timestamp
}
```

### User

```typescript
{
  id: number;
  username: string;
  email: string;
  password: string;              // bcrypt hashed
  role: string;                  // user | moderator | admin
  created_at: string;
}
```

### Footage Request

```typescript
{
  id: number;
  footage_id: number;
  requester_name: string;
  requester_email: string;
  reason: string;                // involved | witness | representative | other
  message: string | null;
  status: string;                // pending | approved | rejected
  created_at: string;
}
```

## Development

### Code Quality

Follow guidelines in [Claude.MD](Claude.MD):
- **Separation of concerns** - One responsibility per function/file
- **JSDoc documentation** - Document all functions with @param and @returns
- **Type safety** - Explicit types, no `any`
- **Error handling** - Fail hard, log comprehensively
- **No magic numbers** - Named constants

### Git Workflow

```bash
# Feature development
git checkout -b feature/your-feature-name
# Make changes
git add .
git commit -m "feat: add video thumbnail generation"
git push origin feature/your-feature-name
# Create pull request
```

**Commit Message Format:**
```
<type>: <description>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

### Building for Production

**Frontend:**
```bash
cd frontend
npm run build
# Output: frontend/dist/
```

**Backend:**
```bash
cd backend
# No build step - Node.js runs JavaScript directly
```

## Security Considerations

### Current Implementation
- ✅ JWT authentication with bcrypt password hashing
- ✅ File type and size validation
- ✅ Input validation on all endpoints
- ✅ CORS configuration
- ✅ Role-based access control

### Privacy
- ⚠️ Users responsible for blurring license plates before upload
- ⚠️ Privacy disclaimer shown during upload
- ⚠️ No automatic video processing/blurring

### Production Requirements
- ❌ Change `JWT_SECRET` to strong random value
- ❌ Enable HTTPS (TLS/SSL certificates)
- ❌ Rate limiting on API endpoints
- ❌ Input sanitization for XSS prevention
- ❌ Migrate to production database (PostgreSQL)
- ❌ Implement CSRF protection
- ❌ Add request throttling

## Performance

### Current Optimizations
- Client-side filtering (no API calls)
- Thumbnail generation (reduces bandwidth)
- Vite HMR (instant dev updates)
- Static file serving

### Recommendations
- Add video transcoding for consistent formats
- Implement CDN for video delivery
- Add caching headers for static assets
- Database indexing on lat/lng/date fields
- Implement pagination for large datasets

## Testing

### Manual Testing

**Backend:**
```bash
# Health check
curl http://localhost:5000/api/health

# Get all footage
curl http://localhost:5000/api/footage

# Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'
```

**Frontend:**
1. Open `http://localhost:5173`
2. Test upload flow
3. Test map interactions
4. Test filters and search
5. Test video playback
6. Test authentication

### Test Checklist

- [ ] Upload video with GPS metadata
- [ ] Upload video without GPS (manual location)
- [ ] Browse map view with multiple markers
- [ ] Browse grid view with thumbnails
- [ ] Filter by date, time, type
- [ ] Search by location
- [ ] Watch video on detail page
- [ ] Submit footage request
- [ ] Register new user
- [ ] Login existing user
- [ ] Upload as authenticated user
- [ ] Delete own footage
- [ ] Logout

## Troubleshooting

### Backend won't start
```bash
# Check if port 5000 is in use
netstat -ano | findstr :5000   # Windows
lsof -i :5000                  # Mac/Linux

# Kill process using port 5000
taskkill /PID <PID> /F         # Windows
kill -9 <PID>                  # Mac/Linux

# Verify Node.js version
node --version                 # Should be v20+
```

### Frontend won't start
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check Vite configuration
npm run dev -- --debug
```

### Video upload fails
- Check file size (max 250MB)
- Verify video format (MP4, MOV, AVI)
- Check backend logs in `backend/logs/error.log`
- Ensure `uploads/` directory exists and is writable

### Map not displaying
- Check browser console for Leaflet errors
- Verify internet connection (OSM tiles require network)
- Check Leaflet CDN in `frontend/index.html`

## Deployment

### Frontend Deployment (Vercel/Netlify)

```bash
cd frontend
npm run build
# Deploy dist/ directory
```

**Environment Variables:**
- `VITE_API_URL` - Production API URL

### Backend Deployment (Heroku/Railway)

```bash
cd backend
# Procfile: web: node server.js
```

**Environment Variables:**
- `PORT` - Provided by platform
- `NODE_ENV=production`
- `JWT_SECRET` - Strong random secret
- `CORS_ORIGIN` - Frontend domain

### Full Stack Deployment (DigitalOcean/AWS)

1. Set up Ubuntu server
2. Install Node.js v20+
3. Clone repository
4. Configure environment variables
5. Set up Nginx reverse proxy
6. Enable HTTPS with Let's Encrypt
7. Set up PM2 for process management

## Future Enhancements

### Phase 1 (MVP Complete)
- ✅ Video upload with metadata
- ✅ Browse map and grid views
- ✅ Footage request system
- ✅ User authentication
- ✅ Search and filters

### Phase 2 (In Progress)
- [ ] Real database (PostgreSQL)
- [ ] Email notifications
- [ ] Admin dashboard
- [ ] Video processing pipeline
- [ ] Automatic license plate blurring

### Phase 3 (Planned)
- [ ] Mobile apps (React Native)
- [ ] Real-time updates (WebSockets)
- [ ] Advanced search (address lookup)
- [ ] Video analytics (AI incident detection)
- [ ] Integration with insurance companies

## Contributing

Contributions welcome! Please follow these steps:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Follow [Claude.MD](Claude.MD) coding guidelines
4. Commit changes (`git commit -m 'feat: add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open pull request

## License

MIT License - See LICENSE file for details

## Support

- **Issues:** [GitHub Issues](https://github.com/yourusername/DashWorld/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/DashWorld/discussions)
- **Email:** support@dashworld.example.com

## Acknowledgments

- [OpenStreetMap](https://www.openstreetmap.org/) - Map tiles and data
- [Leaflet.js](https://leafletjs.com/) - Map library
- [Lucide](https://lucide.dev/) - Icon library
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework

---

**Built with ❤️ by the Dash World team**
"# DashWorld" 
