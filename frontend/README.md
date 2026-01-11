# Dash World Frontend

React + TypeScript web application for browsing and uploading dashcam footage.

## Responsibilities

- **Video Upload** - Multi-step wizard for uploading footage with metadata
- **Browse Footage** - Map and grid views for discovering dashcam videos
- **Video Playback** - HTML5 video player with controls
- **Request System** - Submit requests to contact footage uploaders
- **Authentication** - User registration and login interface
- **Metadata Extraction** - Extract GPS and timestamp from video EXIF data
- **Thumbnail Generation** - Auto-generate thumbnails from video frames

## Tech Stack

- **React 18** - UI library with hooks
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Leaflet.js** - Interactive maps (OpenStreetMap)
- **Lucide React** - Icon library
- **ExifReader** - EXIF metadata extraction from videos

## Project Structure

```
frontend/
├── src/
│   ├── main.tsx              # Application entry point
│   ├── index.css             # Global styles and Tailwind imports
│   ├── DashWorld.tsx         # Main application component
│   ├── api.ts                # Backend API client functions
│   ├── config/
│   │   └── constants.ts      # Configuration constants
│   └── utils/
│       ├── timeFormat.ts     # Time formatting utilities
│       └── videoMetadata.ts  # Video EXIF extraction
├── index.html                # HTML template
├── vite.config.ts            # Vite configuration
├── tailwind.config.js        # Tailwind CSS configuration
├── tsconfig.json             # TypeScript configuration
└── package.json
```

## Getting Started

### Prerequisites

- Node.js v20+ installed
- npm installed
- Backend server running on http://localhost:5000

### Installation

```bash
cd frontend
npm install
```

### Environment Configuration

Create a `.env` file (optional, defaults provided):

```bash
VITE_API_URL=http://localhost:5000/api
```

### Running Development Server

```bash
npm run dev
```

Development server runs on `http://localhost:5173`

### Building for Production

```bash
npm run build
```

Build output in `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Component Architecture

### Main Component: DashWorld.tsx

Single-file component containing all views and state management.

**State Variables:**
- `footageData` - Array of all footage from API
- `selectedPin` - Currently selected map marker
- `page` - Current view (browse, upload, video-detail, request-form, etc.)
- `view` - Map or grid view toggle
- `filters` - Active search filters
- `user` - Current authenticated user
- `authToken` - JWT authentication token
- `loading` - Loading state for API calls

**Views:**
1. **Browse View** - Default landing page with map/grid toggle
2. **Upload Page** - 4-step upload wizard
3. **Video Detail Page** - Full video playback
4. **Request Form Page** - Contact uploader form
5. **Request Sent Page** - Confirmation message
6. **Auth Page** - Login/register interface
7. **My Uploads** - User's uploaded footage

### Upload Wizard Flow

#### Step 1: File Upload
- File input for video selection
- File size validation (max 250MB)
- Video type validation
- Display file size and duration

#### Step 2: Timestamp Verification
- Extract timestamp from video EXIF data
- Display detected time with confidence indicator
- Allow manual time adjustment
- Date and time pickers

#### Step 3: Location Selection
- Extract GPS coordinates from video EXIF data
- Display location on Leaflet map
- Allow manual location adjustment by dragging marker
- Geocode coordinates to human-readable address
- Manual coordinate input option

#### Step 4: Details Form
- Incident type selection (collision, near miss, etc.)
- Optional description textarea
- Privacy notice
- Upload button

**Upload Process:**
1. Generate thumbnail from video frame (canvas API)
2. Create FormData with video, thumbnail, and metadata
3. POST to `/api/footage/upload` with JWT token
4. Show success message
5. Refresh footage list
6. Navigate back to browse view

## API Integration

All API calls are in `src/api.ts`. Functions follow naming convention: `verb + Resource`.

### Footage APIs

```typescript
getAllFootage(): Promise<Footage[]>
getFootageById(id: number): Promise<Footage>
uploadFootage(formData: FormData, token: string): Promise<UploadResponse>
deleteFootage(id: number, token: string): Promise<SuccessResponse>
updateFootageDescription(id: number, description: string, token: string): Promise<UpdateResponse>
```

### Request APIs

```typescript
submitFootageRequest(footageId: number, data: RequestData): Promise<SuccessResponse>
getFootageRequests(footageId: number): Promise<FootageRequest[]>
```

### Auth APIs

```typescript
register(username: string, email: string, password: string): Promise<AuthResponse>
login(email: string, password: string): Promise<AuthResponse>
```

### Health Check

```typescript
healthCheck(): Promise<HealthResponse>
```

## Data Types

### Footage

```typescript
interface Footage {
  id: number;
  filename: string;
  thumbnail: string | null;
  location_name: string;
  lat: number;
  lng: number;
  incident_date: string;          // YYYY-MM-DD
  incident_time: string;          // HH:MM
  incident_type: string;
  description: string | null;
  duration: number | null;        // seconds
  user_id?: number;
  created_at: string;             // ISO timestamp
}
```

### User

```typescript
interface User {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'moderator' | 'admin';
}
```

### FootageRequest

```typescript
interface FootageRequest {
  id: number;
  footage_id: number;
  requester_name: string;
  requester_email: string;
  reason: string;
  message: string | null;
  status: string;
  created_at: string;
}
```

## Configuration

All configuration is centralized in `src/config/constants.ts`:

### API_CONFIG

```typescript
{
  BASE_URL: 'http://localhost:5000/api',
  UPLOAD_TIMEOUT_MS: 300000,     // 5 minutes for large uploads
  DEFAULT_TIMEOUT_MS: 30000      // 30 seconds for other requests
}
```

### THUMBNAIL_CONFIG

```typescript
{
  MAX_WIDTH: 1280,
  MAX_HEIGHT: 720,
  QUALITY: 0.85,
  SEEK_TIME_SECONDS: 1,
  FORMAT: 'image/jpeg'
}
```

### UPLOAD_CONFIG

```typescript
{
  MAX_FILE_SIZE_BYTES: 250 * 1024 * 1024,  // 250MB
  MAX_FILE_SIZE_MB: 250,
  ALLOWED_VIDEO_EXTENSIONS: ['.mp4', '.mov', '.avi'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/quicktime', 'video/x-msvideo']
}
```

### MAP_CONFIG

```typescript
{
  DEFAULT_CENTER: [37.7749, -122.4194],  // San Francisco
  DEFAULT_ZOOM: 12,
  MARKER_ZOOM: 15,
  TILE_URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  ATTRIBUTION: '&copy; OpenStreetMap contributors'
}
```

### UI_CONSTANTS

```typescript
{
  INCIDENT_EMOJIS: ['🚗', '🚙', '🚕', '🚐', '🚓', '🚑'],
  INCIDENT_TYPES: [
    { value: 'collision', label: 'Collision' },
    { value: 'near_miss', label: 'Near Miss' },
    { value: 'rear_end', label: 'Rear End' },
    { value: 'side_swipe', label: 'Side Swipe' },
    { value: 'other', label: 'Other' }
  ],
  REQUEST_REASONS: [
    { value: 'involved', label: 'I was involved in the incident' },
    { value: 'witness', label: 'I witnessed the incident' },
    { value: 'representative', label: 'Legal/Insurance representative' },
    { value: 'other', label: 'Other reason' }
  ]
}
```

## Utilities

### Time Formatting (`utils/timeFormat.ts`)

```typescript
/**
 * Convert 24-hour time to 12-hour format with AM/PM
 * @param {string} time24 - Time in HH:MM format
 * @returns {string} Time in 12-hour format (e.g., "2:30 PM")
 */
formatTimeTo12Hour(time24: string): string

/**
 * Format video duration in seconds to readable string
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration (e.g., "1:23" or "45s")
 */
formatDuration(seconds: number): string

/**
 * Format incident type enum to human-readable label
 * @param {string} type - Incident type enum value
 * @returns {string} Human-readable label
 */
formatIncidentType(type: string): string
```

### Video Metadata Extraction (`utils/videoMetadata.ts`)

```typescript
/**
 * Extract GPS coordinates and timestamp from video EXIF data
 * @param {File} videoFile - Video file to extract metadata from
 * @returns {Promise<Metadata>} Metadata object with location, timestamp, GPS status
 */
extractVideoMetadata(videoFile: File): Promise<Metadata>
```

**Metadata Object:**
```typescript
interface Metadata {
  location: { lat: number; lng: number; source: string } | null;
  timestamp: Date;
  hasGPS: boolean;
  hasCorrectTime: boolean;
  duration: number;
  resolution: string;
}
```

## State Management

Uses React hooks for state management:

- `useState` - Component-level state
- `useEffect` - Side effects (API calls, Leaflet initialization)
- `useRef` - DOM references (map instances, video elements)

**Authentication State:**
- JWT token stored in `localStorage` as `dash_world_token`
- User object stored in `localStorage` as `dash_world_user`
- Automatically loaded on app mount
- Cleared on logout

## Browse View Features

### Map View
- Leaflet.js interactive map
- Markers for each footage location
- Click marker to see preview popup
- Blue highlight for selected footage
- Zoom to marker on selection

### Grid View
- 3-column responsive grid
- Thumbnail preview cards
- Location, date, time, and type displayed
- Click card to view full video

### Filters (Both Views)
- **Search** - Filter by location name or description
- **Date Range** - Filter by incident date
- **Time Range** - Filter by incident time
- **Incident Type** - Filter by type (collision, near miss, etc.)

**Real-time Filtering:**
All filtering is client-side. No API calls when changing filters.

## Authentication Flow

### Registration
1. User clicks "Sign Up" button
2. Fills username, email, password form
3. POST to `/api/auth/register`
4. Receives JWT token and user object
5. Token saved to localStorage
6. User redirected to browse view

### Login
1. User clicks "Login" button
2. Fills email, password form
3. POST to `/api/auth/login`
4. Receives JWT token and user object
5. Token saved to localStorage
6. User redirected to browse view

### Logout
1. User clicks logout button
2. Token and user removed from localStorage
3. State cleared
4. User redirected to browse view

### Protected Actions
- **Upload footage** - Requires authentication
- **Delete footage** - Requires authentication (own footage only)
- **Edit description** - Requires moderator/admin role

## Map Integration

Uses Leaflet.js loaded from CDN (in index.html):

```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
```

**TypeScript Declaration:**
```typescript
declare global {
  interface Window {
    L: any;
  }
}
```

**Map Initialization:**
```typescript
const map = window.L.map(mapRef.current).setView([lat, lng], zoom);

window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19
}).addTo(map);
```

## Error Handling

All API calls wrapped in try-catch blocks:

```typescript
try {
  const result = await api.uploadFootage(formData, authToken);
  // Handle success
} catch (error) {
  alert(error.message || 'Upload failed');
  // Handle error
}
```

**User-Friendly Error Messages:**
- File too large → "File size exceeds 250MB limit"
- Network error → "Failed to upload footage"
- Auth required → "Please login to upload footage"

## Styling

### Tailwind CSS

Utility-first approach. No custom CSS classes beyond Tailwind utilities.

**Common Patterns:**
```tsx
// Button
<button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg">

// Card
<div className="bg-white rounded-lg shadow-md p-4">

// Input
<input className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
```

### Responsive Design

Mobile-first approach with Tailwind breakpoints:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

**Breakpoints:**
- `sm:` - 640px and up
- `md:` - 768px and up
- `lg:` - 1024px and up
- `xl:` - 1280px and up

## Development Guidelines

Follow `../Claude.MD` for:
- TypeScript types (no `any`, explicit returns)
- Function documentation (JSDoc)
- Error handling patterns
- Naming conventions
- Component organization

## Build and Deployment

### Development Build

```bash
npm run dev
```

Vite dev server with HMR (Hot Module Replacement).

### Production Build

```bash
npm run build
```

**Output:**
- `dist/` directory
- Minified JavaScript bundles
- Optimized CSS
- Static HTML

**Build Process:**
1. TypeScript compilation (`tsc`)
2. Vite bundling (Rollup under the hood)
3. CSS purging (Tailwind removes unused utilities)
4. Asset optimization

### Preview Production Build

```bash
npm run preview
```

Serves production build locally for testing.

## Performance Optimizations

### Thumbnail Generation
- Generate on client-side (no server processing)
- Max width 1280px (reduces upload size)
- JPEG quality 0.85 (balance size/quality)
- Extract frame at 1 second (avoid black frames)

### Client-Side Filtering
- All footage loaded once on mount
- Filters applied in JavaScript (no API calls)
- Fast search with `.filter()` and `.includes()`

### Video Loading
- Lazy loading thumbnails in grid view
- Video loads only when detail page opened
- HTML5 video controls (browser-optimized)

### Map Optimization
- Single Leaflet instance per view
- Cleanup on component unmount
- Markers update without map re-render

## Browser Compatibility

**Supported Browsers:**
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

**Required Features:**
- ES6+ JavaScript
- Fetch API
- Canvas API
- HTML5 Video
- LocalStorage
- File API

## Troubleshooting

### Leaflet map not showing
- Check browser console for errors
- Verify Leaflet CDN loaded (check network tab)
- Ensure map container has height: `style={{ height: '400px' }}`

### Video upload fails
- Check file size (max 250MB)
- Verify video format (MP4, MOV, AVI)
- Ensure backend server is running
- Check authentication token in localStorage

### Thumbnail generation fails
- Ensure browser supports Canvas API
- Check video codec (H.264 recommended)
- Verify video is not corrupted

### EXIF extraction not working
- Not all videos contain EXIF data
- GPS data requires camera with GPS
- Fallback to manual input if extraction fails

## Testing

### Manual Testing Checklist

**Browse View:**
- [ ] Map loads with markers
- [ ] Grid view shows thumbnails
- [ ] Filters work correctly
- [ ] Search filters by location
- [ ] Click marker opens popup
- [ ] Click card opens video detail

**Upload Flow:**
- [ ] File upload validates size/type
- [ ] Metadata extraction works
- [ ] Map shows correct location
- [ ] Manual location adjustment works
- [ ] Thumbnail generates correctly
- [ ] Upload succeeds with auth token

**Authentication:**
- [ ] Registration creates new user
- [ ] Login returns token
- [ ] Logout clears state
- [ ] Protected routes require auth

**Video Detail:**
- [ ] Video plays correctly
- [ ] Metadata displays correctly
- [ ] Request button opens form
- [ ] Delete button works (own footage)

## Future Enhancements

- [ ] Add React Router for proper URL routing
- [ ] Implement video player with custom controls
- [ ] Add progress indicator for video upload
- [ ] Implement pagination for large datasets
- [ ] Add map clustering for many markers
- [ ] Implement video preview on hover
- [ ] Add dark mode toggle
- [ ] Implement drag-and-drop upload
- [ ] Add real-time notifications
- [ ] Implement admin dashboard view

## Dependencies

### Production
- `react` - UI library
- `react-dom` - React DOM renderer
- `exifreader` - EXIF metadata extraction
- `lucide-react` - Icon library

### Development
- `@types/react` - React TypeScript types
- `@types/react-dom` - React DOM TypeScript types
- `@vitejs/plugin-react` - Vite React plugin
- `typescript` - TypeScript compiler
- `vite` - Build tool and dev server
- `tailwindcss` - CSS framework
- `postcss` - CSS processing
- `autoprefixer` - CSS vendor prefixes

## File Size Considerations

**Bundle Size:**
- React + React DOM: ~140KB (gzipped)
- ExifReader: ~60KB (gzipped)
- Lucide Icons: ~20KB (gzipped)
- Application Code: ~30KB (gzipped)

**Total:** ~250KB (gzipped)

**Optimization Tips:**
- Tree-shaking enabled by Vite
- Code splitting with dynamic imports
- Lazy load Leaflet on demand
- Compress images/videos before upload
