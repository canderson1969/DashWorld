# Dash World Backend

Express.js REST API server for dashcam footage management.

## Responsibilities

- **Footage Management** - Upload, store, and retrieve dashcam footage with metadata
- **Request Handling** - Process and store requests for footage access
- **Authentication** - User registration, login, and JWT token validation
- **File Storage** - Handle video and thumbnail file uploads
- **Geocoding** - Reverse geocode coordinates to location names
- **Logging** - Structured logging with Winston for debugging and monitoring

## Tech Stack

- **Node.js v24** - JavaScript runtime (ES modules)
- **Express 4** - Web server framework
- **Multer** - Multipart file upload handling
- **Winston** - Structured logging
- **bcrypt** - Password hashing
- **jsonwebtoken** - JWT authentication
- **CORS** - Cross-origin resource sharing

## Project Structure

```
backend/
├── server.js                  # Main server entry point
├── config/
│   └── server.config.js       # Server configuration constants
├── routes/
│   └── authRoutes.js          # Authentication endpoints
├── utils/
│   ├── auth.js                # JWT authentication middleware
│   ├── geocoding.js           # Reverse geocoding utility
│   └── logger.js              # Winston logger configuration
├── data/                      # JSON database files
│   ├── footage.json           # Footage metadata
│   ├── requests.json          # Footage access requests
│   └── users.json             # User accounts
├── logs/                      # Log files
│   ├── error.log              # Error-level logs
│   └── combined.log           # All logs
└── package.json
```

## Getting Started

### Prerequisites

- Node.js v20+ installed
- npm installed

### Installation

```bash
cd backend
npm install
```

### Environment Configuration

Create a `.env` file (optional, defaults provided):

```bash
PORT=5000
NODE_ENV=development
CORS_ORIGIN=*
LOG_LEVEL=info
UPLOAD_DIR=../uploads
THUMBNAILS_DIR=../uploads/thumbnails
DATA_DIR=./data

# JWT Configuration
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
```

**IMPORTANT:** Change `JWT_SECRET` in production to a strong random value.

### Running the Server

**Development (with auto-reload):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

Server runs on `http://localhost:5000`

## API Endpoints

### Health Check

#### GET /api/health

Check if API server is running.

**Response:**
```json
{
  "status": "ok",
  "message": "Dash World API is running"
}
```

---

### Authentication

#### POST /api/auth/register

Register a new user account.

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Validation:**
- Username: 3-30 characters
- Email: Valid email format
- Password: Minimum 6 characters

**Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

**Errors:**
- `400` - Missing fields or validation failure
- `409` - Username or email already exists

#### POST /api/auth/login

Login with existing credentials.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

**Errors:**
- `400` - Missing fields
- `401` - Invalid email or password

---

### Footage

#### GET /api/footage

Retrieve all footage entries.

**Response (200):**
```json
[
  {
    "id": 1,
    "filename": "video-123456.mp4",
    "thumbnail": "thumbnail-123456.jpg",
    "location_name": "Market St & 5th St, San Francisco",
    "lat": 37.7749,
    "lng": -122.4194,
    "incident_date": "2024-12-15",
    "incident_time": "14:32",
    "incident_type": "collision",
    "description": "Red light violation at intersection",
    "duration": 45.5,
    "user_id": 1,
    "created_at": "2024-12-15T14:32:00.000Z"
  }
]
```

#### GET /api/footage/:id

Retrieve single footage entry by ID.

**Response (200):** Single footage object

**Errors:**
- `400` - Invalid ID format
- `404` - Footage not found

#### POST /api/footage/upload

Upload new dashcam footage with metadata. **Requires authentication.**

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: multipart/form-data
```

**Form Data:**
- `video` (file) - Video file (max 250MB)
- `thumbnail` (file, optional) - Thumbnail image
- `locationName` (string) - Location description
- `lat` (number) - Latitude (-90 to 90)
- `lng` (number) - Longitude (-180 to 180)
- `incidentDate` (string) - Date in YYYY-MM-DD format
- `incidentTime` (string) - Time in HH:MM format
- `incidentType` (string) - collision | near_miss | rear_end | side_swipe | other
- `description` (string, optional) - Incident description (max 1000 chars)

**Response (201):**
```json
{
  "success": true,
  "id": 5,
  "message": "Footage uploaded successfully"
}
```

**Errors:**
- `400` - Missing required fields or validation error
- `401` - Missing or invalid authentication token
- `413` - File size exceeds 250MB limit

#### DELETE /api/footage/:id

Delete footage entry. **Requires authentication.** Users can only delete their own footage.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Footage deleted successfully"
}
```

**Errors:**
- `401` - Not authenticated
- `403` - User does not own this footage
- `404` - Footage not found

#### PATCH /api/footage/:id/description

Update footage description. **Requires moderator or admin role.**

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "description": "Updated incident description"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Description updated successfully",
  "footage": { /* updated footage object */ }
}
```

**Errors:**
- `401` - Not authenticated
- `403` - Insufficient permissions (not moderator/admin)
- `404` - Footage not found

---

### Footage Requests

#### POST /api/footage/:id/request

Submit request to contact footage uploader.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "reason": "involved",
  "message": "I was driving the blue sedan in this footage."
}
```

**Reason Options:**
- `involved` - Involved in the incident
- `witness` - Witnessed the incident
- `representative` - Legal/insurance representative
- `other` - Other reason

**Response (201):**
```json
{
  "success": true,
  "id": 12,
  "message": "Request submitted successfully"
}
```

**Errors:**
- `400` - Missing fields or invalid reason
- `404` - Footage not found

#### GET /api/footage/:id/requests

Get all requests for specific footage.

**Response (200):**
```json
[
  {
    "id": 12,
    "footage_id": 5,
    "requester_name": "John Doe",
    "requester_email": "john@example.com",
    "reason": "involved",
    "message": "I was driving the blue sedan in this footage.",
    "status": "pending",
    "created_at": "2024-12-15T16:45:00.000Z"
  }
]
```

**Errors:**
- `400` - Invalid ID format
- `404` - Footage not found

---

## Configuration

All configuration is centralized in `config/server.config.js`:

### SERVER_CONFIG

Server-level settings including port, directories, and CORS.

```javascript
{
  PORT: 5000,
  NODE_ENV: 'development',
  UPLOAD_DIR: '../uploads',
  THUMBNAILS_DIR: '../uploads/thumbnails',
  DATA_DIR: './data',
  FOOTAGE_DB_FILE: 'footage.json',
  REQUESTS_DB_FILE: 'requests.json',
  CORS_ORIGIN: '*',
  LOG_LEVEL: 'info'
}
```

### FILE_CONFIG

File upload constraints and naming conventions.

```javascript
{
  MAX_FILE_SIZE_BYTES: 250 * 1024 * 1024, // 250MB
  MAX_FILE_SIZE_MB: 250,
  VIDEO_PREFIX: 'video-',
  THUMBNAIL_PREFIX: 'thumbnail-',
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/avi'],
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png']
}
```

### VALIDATION_RULES

Input validation constraints.

```javascript
{
  LATITUDE_MIN: -90,
  LATITUDE_MAX: 90,
  LONGITUDE_MIN: -180,
  LONGITUDE_MAX: 180,
  LOCATION_NAME_MAX_LENGTH: 200,
  DESCRIPTION_MAX_LENGTH: 1000,
  VALID_INCIDENT_TYPES: ['collision', 'near_miss', 'rear_end', 'side_swipe', 'other'],
  VALID_REQUEST_REASONS: ['involved', 'witness', 'representative', 'other']
}
```

## Data Models

### Footage

```javascript
{
  id: number,                    // Unique identifier
  filename: string,              // Video filename in uploads/
  thumbnail: string | null,      // Thumbnail filename in uploads/thumbnails/
  location_name: string,         // Human-readable location
  lat: number,                   // Latitude coordinate
  lng: number,                   // Longitude coordinate
  incident_date: string,         // Date in YYYY-MM-DD format
  incident_time: string,         // Time in HH:MM format
  incident_type: string,         // collision | near_miss | rear_end | side_swipe | other
  description: string | null,    // Optional incident description
  duration: number | null,       // Video duration in seconds
  user_id: number,               // ID of user who uploaded footage
  created_at: string             // ISO timestamp of upload
}
```

### Footage Request

```javascript
{
  id: number,                    // Unique identifier
  footage_id: number,            // Reference to footage.id
  requester_name: string,        // Name of person requesting
  requester_email: string,       // Contact email
  reason: string,                // involved | witness | representative | other
  message: string | null,        // Optional additional message
  status: string,                // pending | approved | rejected
  created_at: string             // ISO timestamp of request
}
```

### User

```javascript
{
  id: number,                    // Unique identifier
  username: string,              // Unique username
  email: string,                 // Unique email address
  password: string,              // Bcrypt hashed password
  role: string,                  // user | moderator | admin
  created_at: string             // ISO timestamp of registration
}
```

## Utilities

### Logger (`utils/logger.js`)

Winston-based structured logging.

**Functions:**
- `logger` - Winston logger instance
- `logSuccess(message, meta)` - Log successful operations
- `logError(message, error, meta)` - Log errors with full context

**Usage:**
```javascript
import { logger, logSuccess, logError } from './utils/logger.js';

logSuccess('Footage uploaded', {
  footageId: newId,
  filename: file.originalname,
  userId: req.user.id
});

logError('Database write failed', error, {
  operation: 'writeFootageDb',
  footageId: id
});
```

### Authentication (`utils/auth.js`)

JWT token validation middleware.

**Function:**
- `authenticateToken(req, res, next)` - Middleware to verify JWT tokens

**Usage:**
```javascript
import { authenticateToken } from './utils/auth.js';

app.post('/api/footage/upload', authenticateToken, async (req, res) => {
  // req.user contains decoded JWT payload
  const userId = req.user.userId;
  // ...
});
```

### Geocoding (`utils/geocoding.js`)

Reverse geocode coordinates to location names.

**Function:**
- `reverseGeocode(lat, lng)` - Get location name from coordinates

**Usage:**
```javascript
import { reverseGeocode } from './utils/geocoding.js';

const locationName = await reverseGeocode(37.7749, -122.4194);
// Returns: "Market St, San Francisco, CA"
```

## Error Handling

All errors are logged before being sent to the client. Error responses follow this format:

```json
{
  "error": "Error message here"
}
```

**HTTP Status Codes:**
- `200` - Success
- `201` - Resource created
- `400` - Bad request (validation failure)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Resource not found
- `409` - Conflict (duplicate username/email)
- `413` - Payload too large (file size limit)
- `500` - Internal server error

## Security

### Authentication
- JWT tokens with configurable expiration
- bcrypt password hashing with salt rounds
- Token required for upload and delete operations

### Authorization
- Role-based access control (user, moderator, admin)
- Users can only delete their own footage
- Moderators/admins can edit descriptions

### Input Validation
- File type validation (only videos allowed)
- File size limits (250MB max)
- Coordinate range validation
- String length limits
- Enum validation for incident types and request reasons

### Privacy
- User passwords are hashed and never exposed
- Email addresses only stored for authentication
- No automatic sharing of unblurred footage

## Logging

All logs are written to:
- `logs/error.log` - ERROR level and above
- `logs/combined.log` - All log levels
- Console output (development only)

**Log Levels:**
- `error` - Errors and exceptions
- `warn` - Warnings and recoverable issues
- `info` - Successful operations and key events
- `debug` - Detailed debugging information

**Log Format:**
```json
{
  "timestamp": "2024-12-15 14:32:15",
  "level": "info",
  "message": "Footage uploaded successfully",
  "service": "dash-world-backend",
  "footageId": 5,
  "filename": "video-123.mp4",
  "userId": 1
}
```

## Database

JSON file-based database for simplicity. Files stored in `data/` directory:

- `footage.json` - All footage metadata
- `requests.json` - All footage access requests
- `users.json` - All user accounts

**Helper Functions:**
- `readFootageDb()` - Read all footage
- `writeFootageDb(data)` - Write footage array
- `readRequestsDb()` - Read all requests
- `writeRequestsDb(data)` - Write requests array
- `readUsersDb()` - Read all users
- `writeUsersDb(data)` - Write users array

**Migration to Real Database:**
Replace helper functions with database ORM (Prisma, Sequelize) or query builder (Knex). API endpoints remain unchanged.

## File Storage

- **Videos:** Stored in `../uploads/` directory
- **Thumbnails:** Stored in `../uploads/thumbnails/` directory
- **Naming:** `video-{timestamp}-{random}.mp4`, `thumbnail-{timestamp}-{random}.jpg`

Static file serving: `/uploads` route serves files from uploads directory.

## Development Guidelines

Follow `../Claude.MD` for:
- Function documentation (JSDoc)
- Error handling patterns
- Logging standards
- Naming conventions
- Code organization

## Testing

```bash
# Health check
curl http://localhost:5000/api/health

# Get all footage
curl http://localhost:5000/api/footage

# Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## Troubleshooting

### Server won't start
- Check if port 5000 is already in use
- Verify Node.js version (v20+)
- Check logs in `logs/error.log`

### File upload fails
- Verify uploads directory exists and is writable
- Check file size (max 250MB)
- Ensure video MIME type is allowed

### Authentication errors
- Verify JWT_SECRET is set
- Check token expiration
- Ensure Authorization header format: `Bearer <token>`

## Future Enhancements

- [ ] Migrate to PostgreSQL/MySQL database
- [ ] Add video transcoding for consistent formats
- [ ] Implement automatic license plate blurring
- [ ] Add rate limiting for API endpoints
- [ ] Add request approval/rejection workflow
- [ ] Email notifications for request updates
- [ ] Admin dashboard for user management
- [ ] Video streaming instead of full download
