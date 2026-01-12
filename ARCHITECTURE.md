# Dash World - Architecture Documentation

## Overview

Dash World is a web application that allows users to upload, browse, and request dashcam footage of traffic incidents. The platform helps people involved in accidents find video evidence by providing a centralized repository of dashcam recordings with location and time-based search.

## Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **Leaflet.js** - Interactive maps (OpenStreetMap)
- **Lucide React** - Icon library

### Backend
- **Node.js v24** - JavaScript runtime
- **Express 4** - Web server framework
- **Multer** - Multipart form data handling for file uploads
- **CORS** - Cross-origin resource sharing middleware

### Data Storage
- **JSON files** - Flat-file database for footage metadata and requests
- **File system** - Video and thumbnail storage

## Project Structure

```
DashWorld/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── main.tsx         # Application entry point
│   │   ├── index.css        # Global styles and Tailwind imports
│   │   ├── DashWorld.tsx    # Main application component
│   │   └── api.ts           # Backend API client
│   ├── index.html           # HTML template
│   ├── vite.config.ts       # Vite configuration
│   ├── tailwind.config.js   # Tailwind CSS configuration
│   ├── tsconfig.json        # TypeScript configuration
│   └── package.json         # Frontend dependencies
│
├── backend/                  # Express backend server
│   ├── server.js            # Main server file
│   ├── data/
│   │   ├── footage.json     # Footage metadata database
│   │   └── requests.json    # Footage request database
│   └── package.json         # Backend dependencies
│
├── uploads/                  # File storage
│   ├── *.mp4                # Uploaded video files
│   └── thumbnails/          # Auto-generated video thumbnails
│       └── *.jpg
│
└── Claude.MD                 # Development guidelines
```

## Data Models

### Footage
```typescript
{
  id: number;                    // Unique identifier
  filename: string;              // Video filename in uploads/
  thumbnail: string | null;      // Thumbnail filename in uploads/thumbnails/
  location_name: string;         // Human-readable location
  lat: number;                   // Latitude coordinate
  lng: number;                   // Longitude coordinate
  incident_date: string;         // Date in YYYY-MM-DD format
  incident_time: string;         // Time in HH:MM format
  incident_type: string;         // Type: collision, near_miss, rear_end, side_swipe, other
  description: string | null;    // Optional incident description
  created_at: string;            // ISO timestamp of upload
}
```

### Footage Request
```typescript
{
  id: number;                    // Unique identifier
  footage_id: number;            // Reference to footage.id
  requester_name: string;        // Name of person requesting
  requester_email: string;       // Contact email
  reason: string;                // Reason: involved, witness, representative, other
  message: string | null;        // Optional additional message
  status: string;                // Request status: pending, approved, rejected
  created_at: string;            // ISO timestamp of request
}
```

## API Endpoints

### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "message": "Dash World API is running"
}
```

### GET /api/footage
Retrieve all footage entries.

**Response:**
```json
[
  {
    "id": 1,
    "filename": "video-123.mp4",
    "thumbnail": "thumbnail-123.jpg",
    "location_name": "Market St & 5th St, SF",
    "lat": 37.7749,
    "lng": -122.4194,
    "incident_date": "2024-12-15",
    "incident_time": "14:32",
    "incident_type": "collision",
    "description": "Red light violation",
    "created_at": "2024-12-15T14:32:00.000Z"
  }
]
```

### GET /api/footage/:id
Retrieve single footage entry by ID.

**Response:** Single footage object or 404 error

### POST /api/footage/upload
Upload new dashcam footage with metadata.

**Request:** multipart/form-data
- `video` (file): Video file (max 250MB)
- `thumbnail` (file, optional): Auto-generated thumbnail
- `locationName` (string): Location description
- `lat` (number): Latitude
- `lng` (number): Longitude
- `incidentDate` (string): YYYY-MM-DD
- `incidentTime` (string): HH:MM
- `incidentType` (string): Incident type
- `description` (string, optional): Description

**Response:**
```json
{
  "success": true,
  "id": 5,
  "message": "Footage uploaded successfully"
}
```

### POST /api/footage/:id/request
Submit request for unblurred footage.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "reason": "involved",
  "message": "I was driving the blue sedan"
}
```

**Response:**
```json
{
  "success": true,
  "id": 1,
  "message": "Request submitted successfully"
}
```

### GET /api/footage/:id/requests
Get all requests for specific footage.

**Response:** Array of footage request objects

## Frontend Architecture

### Component Hierarchy

```
DashWorld (Main Container)
├── Header
├── UploadPage
│   ├── Step 1: File Upload
│   ├── Step 2: Timestamp Verification
│   ├── Step 3: Location Selection (Leaflet Map)
│   └── Step 4: Details Form
├── VideoDetailPage
│   ├── Video Player
│   └── Request Button
├── RequestFormPage
│   └── Contact Form
├── RequestSentPage
│   └── Confirmation Message
└── Browse View
    ├── Sidebar (Filters)
    └── Main Area
        ├── Map View (Leaflet)
        └── Grid View (Cards)
```

### State Management

State managed with React hooks:
- `useState` - Component-level state
- `useEffect` - Side effects and data fetching
- `useRef` - DOM references (map instances)

Key state variables:
- `footageData` - Array of all footage
- `selectedPin` - Currently selected map marker
- `page` - Current view (browse, upload, video-detail, etc.)
- `view` - Map or grid view toggle
- `loading` - Loading state for API calls

### Data Flow

```
User Action → API Call → State Update → Component Re-render
```

1. **Initial Load:** Fetch all footage from `/api/footage`
2. **Upload:** Generate thumbnail → Upload video + thumbnail → Refresh footage list
3. **Request:** Submit form → POST to `/api/footage/:id/request` → Show confirmation
4. **Browse:** Filter/search footage locally, no API calls

## Backend Architecture

### Server Configuration

- Port: 5000
- CORS: Enabled for all origins
- Body parsing: JSON and URL-encoded
- Static files: `/uploads` served at `/uploads`

### File Upload Flow

```
1. Client selects video file
2. Client generates thumbnail using Canvas API
3. Client uploads video + thumbnail via FormData
4. Multer saves files to uploads/ directory
5. Server moves thumbnail to uploads/thumbnails/
6. Server generates unique ID
7. Server saves metadata to footage.json
8. Server responds with success + new ID
9. Client refreshes footage list
```

### Database Operations

JSON file read/write operations:
- `readFootageDb()` - Parse footage.json
- `writeFootageDb(data)` - Stringify and save footage.json
- `readRequestsDb()` - Parse requests.json
- `writeRequestsDb(data)` - Stringify and save requests.json

## Features

### 1. Video Upload
- Multi-step wizard interface
- Automatic thumbnail generation from video frame
- GPS metadata extraction (simulated)
- Interactive location picker with Leaflet map
- Date/time verification
- Incident type categorization
- File size limit: 250MB

### 2. Browse & Search
- Map view with clustered markers
- Grid view with thumbnail previews
- Filter by date, time, location, incident type
- Real-time client-side filtering

### 3. Video Playback
- HTML5 video player with controls
- Thumbnail preview in browse grid
- Privacy notice (license plates should be blurred)

### 4. Footage Requests
- Request form for unblurred footage
- Reason selection (involved, witness, representative)
- Email contact collection
- Request tracking in database

## Security Considerations

### Current Implementation
- File type validation (videos only)
- File size limits (250MB)
- Input validation on required fields
- No authentication/authorization

### Privacy
- Users responsible for blurring license plates before upload
- Privacy disclaimer on upload page
- Requests stored but no automatic sharing mechanism

## Performance Optimizations

- Thumbnail generation reduces bandwidth for browsing
- Client-side filtering (no API calls for search)
- Vite HMR for instant frontend updates
- Static file serving for videos

## Development

### Running Locally

**Backend:**
```bash
cd backend
npm install
npm start
# Server runs on http://localhost:5000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Dev server runs on http://localhost:3000
```

### Building for Production

**Frontend:**
```bash
cd frontend
npm run build
# Output: frontend/dist/
```

## Future Enhancements

### Immediate
- User authentication
- Real database (PostgreSQL/MySQL)
- Video processing for automatic license plate blurring
- Search by address/intersection
- Admin panel for managing requests

### Long-term
- Mobile apps (React Native)
- Video analytics (AI incident detection)
- Integration with insurance companies
- Public/private footage toggles
- Geofencing for automatic uploads
