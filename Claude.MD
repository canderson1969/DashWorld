# Claude.md — JavaScript/TypeScript Development Guidelines

## Role

Software architect with strong web development skills building modern web applications using JavaScript, TypeScript, React, and Node.js.

---

## Core Principles

### Separation of Concerns
- Each function does exactly one job
- Each file has a single responsibility
- Each module owns one domain
- Routes handle HTTP, services handle business logic, models handle data
- Components handle presentation, hooks handle state logic

### Function Documentation
Every function includes JSDoc with:
- Brief description of purpose
- `@param` - parameter name, type, and purpose
- `@returns` - type and description
- `@throws` - errors that may be thrown

Example:
```javascript
/**
 * Fetch footage metadata from database by ID
 *
 * @param {number} id - The footage ID to retrieve
 * @returns {Promise<Footage>} The footage object with metadata
 * @throws {FootageNotFoundError} If footage with given ID doesn't exist
 * @throws {DatabaseError} If database read fails
 */
async function getFootageById(id) {
  // implementation
}
```

### Modularity
- Small, composable functions over monoliths
- Extract repeated logic into shared utilities
- Use dependency injection
- Design for testability
- Single file should not exceed 300 lines

### Readability Over Cleverness
- Simple implementations win
- Descriptive names over comments
- No one-liners requiring mental gymnastics
- If a simpler implementation exists, use it
- Prefer explicit over implicit

---

## Naming Conventions

### JavaScript/TypeScript Conventions

**Functions and Variables:**
- camelCase for functions and variables
- Verb prefix for functions: `getUser`, `createJob`, `validateInput`
- Noun for variables: `userData`, `jobList`, `validationResult`

**Booleans:**
- Prefix with `is`, `has`, `can`, `should`: `isValid`, `hasPermission`, `canEdit`, `shouldRender`

**Constants:**
- UPPER_SNAKE_CASE for true constants
```javascript
const MAX_FILE_SIZE = 250 * 1024 * 1024;
const API_BASE_URL = 'http://localhost:5000/api';
const DEFAULT_PAGE_SIZE = 20;
```

**Classes and Interfaces:**
- PascalCase: `UserService`, `FootageModel`, `UploadConfig`
- Interfaces: `IUserData`, `FootageMetadata` (or without `I` prefix in TypeScript)

**React Components:**
- PascalCase: `VideoPlayer`, `UploadForm`, `NavBar`
- Props interfaces: `VideoPlayerProps`, `UploadFormProps`

**Files:**
- camelCase or kebab-case: `userService.js`, `footage-model.ts`, `UploadPage.tsx`
- Component files match component name: `VideoPlayer.tsx`
- Utility files: `dateUtils.ts`, `apiClient.ts`

---

## TypeScript Guidelines

### Always Use Types
```typescript
// ❌ Bad - implicit any
function processData(data) {
  return data.map(item => item.value);
}

// ✅ Good - explicit types
function processData(data: DataItem[]): number[] {
  return data.map(item => item.value);
}
```

### Interface Over Type for Objects
```typescript
// ✅ Preferred
interface UserData {
  id: number;
  name: string;
  email: string;
}

// ⚠️ Use for unions/primitives
type UserId = string | number;
type Status = 'pending' | 'approved' | 'rejected';
```

### No `any` Types
```typescript
// ❌ Never use any
const data: any = fetchData();

// ✅ Use unknown and narrow
const data: unknown = fetchData();
if (isValidData(data)) {
  // TypeScript knows data is ValidData here
  processValidData(data);
}
```

### Return Types Always Explicit
```typescript
// ❌ Bad - inferred return type
async function fetchUser(id: number) {
  return api.get(`/users/${id}`);
}

// ✅ Good - explicit return type
async function fetchUser(id: number): Promise<User> {
  return api.get<User>(`/users/${id}`);
}
```

---

## Error Handling

### Fail Hard, No Fallbacks
```javascript
// ❌ Bad - silent failure
function getUser(id) {
  try {
    return database.findUser(id);
  } catch (error) {
    return null; // Swallows error!
  }
}

// ✅ Good - let it fail
function getUser(id) {
  return database.findUser(id); // Throws if not found
}
```

### Custom Error Classes
Create error classes for each error type:

```javascript
class FootageNotFoundError extends Error {
  constructor(id) {
    super(`Footage with ID ${id} not found`);
    this.name = 'FootageNotFoundError';
    this.footageId = id;
    this.statusCode = 404;
  }
}

class ValidationError extends Error {
  constructor(field, message) {
    super(`Validation failed for ${field}: ${message}`);
    this.name = 'ValidationError';
    this.field = field;
    this.statusCode = 400;
  }
}

class DatabaseError extends Error {
  constructor(operation, originalError) {
    super(`Database ${operation} failed: ${originalError.message}`);
    this.name = 'DatabaseError';
    this.operation = operation;
    this.originalError = originalError;
    this.statusCode = 500;
  }
}
```

### Comprehensive Logging Before Throwing
```javascript
// ❌ Bad
throw new Error('Database error');

// ✅ Good
logger.error('Failed to fetch footage from database', {
  footageId: id,
  operation: 'read',
  error: error.message,
  stack: error.stack
});
throw new DatabaseError('read', error);
```

### Validate at System Boundaries
```javascript
/**
 * Upload route handler - validates all inputs
 */
app.post('/api/footage/upload', async (req, res) => {
  // Validate at boundary
  const validationError = validateUploadRequest(req);
  if (validationError) {
    logger.warn('Invalid upload request', {
      error: validationError,
      ip: req.ip
    });
    return res.status(400).json({ error: validationError });
  }

  // Process valid request
  const result = await footageService.createFootage(req.body);
  res.json(result);
});
```

### Never Swallow Exceptions
```javascript
// ❌ Bad
try {
  await processVideo(file);
} catch (error) {
  // Silent failure - never do this
}

// ✅ Good - log and re-throw or handle
try {
  await processVideo(file);
} catch (error) {
  logger.error('Video processing failed', {
    filename: file.name,
    error: error.message
  });
  throw new VideoProcessingError(file.name, error);
}
```

---

## Logging Standards

### Use Structured Logging
Use `winston`, `pino`, or similar structured logger. Never use `console.log` in production code.

```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### Log Levels and Context
```javascript
// INFO - successful operations
logger.info('Footage uploaded successfully', {
  footageId: newId,
  filename: file.name,
  userId: req.user.id,
  size: file.size
});

// WARN - recoverable issues
logger.warn('Invalid timestamp in video metadata', {
  footageId: id,
  providedTime: metadata.timestamp,
  fallbackTime: Date.now()
});

// ERROR - before throwing exceptions
logger.error('Database connection failed', {
  operation: 'connect',
  database: config.DB_NAME,
  error: error.message,
  stack: error.stack,
  retryCount: retries
});

// DEBUG - detailed debugging info
logger.debug('Processing video frame', {
  frameNumber: frame,
  timestamp: currentTime,
  processingTime: elapsedMs
});
```

### Include Relevant Entity IDs
Every log should include relevant identifiers:
```javascript
logger.info('Request processed', {
  userId: user.id,
  footageId: footage.id,
  requestId: req.id,
  duration: Date.now() - startTime
});
```

---

## Anti-Hallucination Rules

### Never Assume
- Uncertain about a library or API? State it and ask
- Do not invent function signatures or library methods
- Reference ARCHITECTURE.md for schemas and contracts
- Check documentation before using third-party APIs

### Reference First
- Check existing codebase before creating utilities
- Follow established project patterns
- Reuse existing types and interfaces
- Import from existing modules rather than recreating

### Be Explicit
```javascript
// ❌ Bad - wildcard imports
import * as utils from './utils';

// ✅ Good - named imports
import { formatDate, parseTimestamp } from './utils';
```

```typescript
// ❌ Bad - implicit types
function processData(data) {
  return data.filter(item => item.active);
}

// ✅ Good - explicit types
function processData(data: DataItem[]): DataItem[] {
  return data.filter(item => item.active);
}
```

### Verify Before Using
- Confirm npm packages exist before installing
- Check package documentation for correct usage
- Do not assume API response structure
- Flag uncertainty clearly in code comments

---

## Tech Debt Prevention

### No Magic Numbers or Strings
```javascript
// ❌ Bad
if (file.size > 250 * 1024 * 1024) {
  throw new Error('File too large');
}

// ✅ Good
const MAX_FILE_SIZE_BYTES = 250 * 1024 * 1024;
const MAX_FILE_SIZE_MB = 250;

if (file.size > MAX_FILE_SIZE_BYTES) {
  throw new FileSizeError(file.size, MAX_FILE_SIZE_BYTES);
}
```

### Configuration in Files or Environment
```javascript
// config/server.config.js
export const SERVER_CONFIG = {
  PORT: process.env.PORT || 5000,
  MAX_FILE_SIZE_BYTES: 250 * 1024 * 1024,
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  DB_PATH: process.env.DB_PATH || './data'
};

// Usage
import { SERVER_CONFIG } from './config/server.config.js';

app.listen(SERVER_CONFIG.PORT, () => {
  logger.info('Server started', { port: SERVER_CONFIG.PORT });
});
```

### No Dead Code
- No commented-out code (use git history instead)
- No unused imports (configure ESLint to catch these)
- Delete unreferenced functions immediately
- Remove debug console.logs before committing

### No Premature Abstraction
- Write concrete code first
- Extract to utility after third occurrence
- Don't create abstractions "just in case"
- Prefer duplication over wrong abstraction

### No Mixed Responsibilities
```javascript
// ❌ Bad - mixed concerns
async function uploadAndProcessVideo(file, metadata) {
  // Validates
  if (!file) throw new Error('No file');

  // Saves file
  const path = await saveFile(file);

  // Processes
  const thumbnail = await generateThumbnail(path);

  // Saves to database
  const id = await db.insert({ ...metadata, path, thumbnail });

  // Sends notification
  await notifyUser(metadata.userId, id);

  return id;
}

// ✅ Good - separated concerns
async function uploadVideo(file) {
  validateVideoFile(file);
  return saveVideoFile(file);
}

async function processVideo(videoPath) {
  return generateThumbnail(videoPath);
}

async function createFootageRecord(metadata) {
  return footageRepository.create(metadata);
}

// Orchestrate in service layer
async function handleVideoUpload(file, metadata) {
  const videoPath = await uploadVideo(file);
  const thumbnailPath = await processVideo(videoPath);
  const footage = await createFootageRecord({
    ...metadata,
    videoPath,
    thumbnailPath
  });
  await notificationService.notifyUser(metadata.userId, footage.id);
  return footage;
}
```

### No Implicit Dependencies
```javascript
// ❌ Bad - global state
let currentUser = null;

function deleteFootage(id) {
  if (!currentUser) throw new Error('Not authenticated');
  return db.delete(id);
}

// ✅ Good - explicit dependencies
function deleteFootage(id, user) {
  if (!user) throw new AuthenticationError();
  return footageRepository.delete(id, user);
}

// Or with dependency injection
class FootageService {
  constructor(repository, authService) {
    this.repository = repository;
    this.authService = authService;
  }

  async deleteFootage(id, user) {
    await this.authService.authorize(user, 'delete', id);
    return this.repository.delete(id);
  }
}
```

---

## React Component Guidelines

### Functional Components with Hooks
```typescript
// ✅ Preferred - functional component
interface VideoPlayerProps {
  src: string;
  autoPlay?: boolean;
  onEnded?: () => void;
}

export function VideoPlayer({ src, autoPlay = false, onEnded }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <video src={src} autoPlay={autoPlay} onEnded={onEnded} />
  );
}
```

### Props Destructuring with Types
```typescript
// ❌ Bad
function UploadForm(props: UploadFormProps) {
  return <form onSubmit={props.onSubmit}>...</form>;
}

// ✅ Good
function UploadForm({ onSubmit, isLoading, initialData }: UploadFormProps) {
  return <form onSubmit={onSubmit}>...</form>;
}
```

### Extract Complex Logic to Hooks
```typescript
// Custom hook
function useFootageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const uploadFootage = async (file: File, metadata: FootageMetadata) => {
    setIsUploading(true);
    setError(null);
    try {
      const thumbnail = await generateThumbnail(file);
      return await api.uploadFootage(file, thumbnail, metadata);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadFootage, isUploading, error };
}

// Component uses hook
function UploadPage() {
  const { uploadFootage, isUploading, error } = useFootageUpload();
  // ...
}
```

---

## File Organization

### Project Structure
```
src/
├── components/          # React components
│   ├── VideoPlayer.tsx
│   ├── UploadForm.tsx
│   └── shared/         # Shared components
│       ├── Button.tsx
│       └── Modal.tsx
├── hooks/              # Custom React hooks
│   ├── useFootageUpload.ts
│   └── useAuth.ts
├── services/           # Business logic
│   ├── footageService.ts
│   ├── authService.ts
│   └── apiClient.ts
├── models/             # Data models & types
│   ├── Footage.ts
│   ├── User.ts
│   └── types.ts
├── utils/              # Pure utility functions
│   ├── dateUtils.ts
│   ├── fileUtils.ts
│   └── validation.ts
├── config/             # Configuration
│   ├── constants.ts
│   └── environment.ts
└── api/                # API route handlers (backend)
    ├── routes/
    ├── middleware/
    └── controllers/
```

### Single Responsibility per File
- One component per file
- One service per file
- Group related utilities in same file
- Maximum 300 lines per file

---

## Documentation Standards

### README for Each Major Module
```markdown
# Footage Service

Handles all business logic for dashcam footage uploads, processing, and retrieval.

## Responsibilities
- Video file validation
- Thumbnail generation
- Metadata persistence
- File storage management

## Usage
\`\`\`typescript
const service = new FootageService(repository, fileStorage);
const footage = await service.uploadFootage(file, metadata);
\`\`\`
```

### Inline Comments for Complex Logic
```javascript
// ❌ Bad - obvious comments
// Increment counter
counter++;

// ✅ Good - explain WHY
// Use 1-second offset to avoid black frames at video start
video.currentTime = Math.max(1, video.duration / 2);
```

### Keep Docs Adjacent to Code
- Component docs in same directory
- Service docs in same file (JSDoc)
- API docs near route definitions
- Update docs in same commit as code

---

## Testing Guidelines

### Write Tests for Services
```javascript
describe('FootageService', () => {
  describe('uploadFootage', () => {
    it('should create footage record with valid metadata', async () => {
      const service = new FootageService(mockRepo, mockStorage);
      const result = await service.uploadFootage(mockFile, mockMetadata);

      expect(result.id).toBeDefined();
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: mockFile.name,
          lat: mockMetadata.lat,
          lng: mockMetadata.lng
        })
      );
    });

    it('should throw ValidationError for invalid coordinates', async () => {
      const invalidMetadata = { ...mockMetadata, lat: 999 };

      await expect(
        service.uploadFootage(mockFile, invalidMetadata)
      ).rejects.toThrow(ValidationError);
    });
  });
});
```

---

## Before Writing Code

1. Read ARCHITECTURE.md for data models and contracts
2. Check existing codebase for similar patterns
3. Identify the single responsibility of this function/component
4. Plan error cases and logging strategy
5. Write the JSDoc/types first
6. Implement with tests

---

## TypeScript Development Workflow

### Always Build Locally
```bash
npm run build       # Check for type errors
npm run lint        # Check for code quality issues
npm run test        # Run test suite
```

### Fix Type Errors Immediately
- Never commit code with TypeScript errors
- Never use `@ts-ignore` (fix the root cause)
- Use `@ts-expect-error` with explanation only for known library issues

### Common TypeScript Issues
- `boolean | null` vs `boolean | undefined` for React props
- Missing type annotations on function parameters
- Implicit `any` types
- Unused variables and imports (configure ESLint)

---

## Git Commit Guidelines

### Commit Message Format
```
<type>: <subject>

<body>

<footer>
```

**Types:** feat, fix, docs, refactor, test, chore

**Good Examples:**
```
feat: add video thumbnail generation

Generate JPEG thumbnails from uploaded videos using Canvas API.
Thumbnails created at 1-second mark with 1280px max width.
Stored in uploads/thumbnails/ directory.

Closes #42
```

```
fix: validate footage ID before database query

Parse and validate ID parameter is positive integer.
Return 400 error for invalid IDs instead of 500.
Add comprehensive logging for invalid requests.
```

**Bad Examples:**
```
Update stuff
WIP
Fix bug
🤖 Generated with Claude
```

### Commit Frequency
- Commit logical units of work
- One feature/fix per commit
- Don't commit broken code
- Don't commit commented-out code

---

## Performance Considerations

### Avoid Premature Optimization
- Write clear code first
- Profile before optimizing
- Optimize hot paths only
- Document performance-critical sections

### React Performance
```typescript
// Memoize expensive calculations
const sortedFootage = useMemo(
  () => footage.sort((a, b) => a.date.localeCompare(b.date)),
  [footage]
);

// Memoize callbacks passed to children
const handleUpload = useCallback(
  (file: File) => uploadService.upload(file),
  [uploadService]
);

// Memoize components that render frequently
const VideoCard = memo(({ footage }: VideoCardProps) => {
  return <div>{footage.title}</div>;
});
```

---

## Security Best Practices

### Input Validation
```javascript
function validateFootageMetadata(metadata) {
  if (!metadata.lat || !metadata.lng) {
    throw new ValidationError('location', 'Coordinates required');
  }

  if (metadata.lat < -90 || metadata.lat > 90) {
    throw new ValidationError('latitude', 'Must be between -90 and 90');
  }

  if (metadata.lng < -180 || metadata.lng > 180) {
    throw new ValidationError('longitude', 'Must be between -180 and 180');
  }

  // Sanitize string inputs
  metadata.description = sanitizeHtml(metadata.description);

  return metadata;
}
```

### Never Trust Client Data
- Validate all inputs on server
- Sanitize HTML/SQL inputs
- Check file types and sizes
- Verify authentication tokens

### Environment Variables for Secrets
```javascript
// ❌ Never commit secrets
const API_KEY = 'sk_live_abc123...';

// ✅ Use environment variables
const API_KEY = process.env.STRIPE_API_KEY;
if (!API_KEY) {
  throw new ConfigurationError('STRIPE_API_KEY not set');
}
```

---

## Summary

1. **Document everything** - JSDoc on all functions
2. **Type everything** - No implicit any, explicit returns
3. **Fail loudly** - Custom errors, comprehensive logging
4. **Separate concerns** - Services, models, routes, components
5. **No magic** - Named constants, environment config
6. **Test services** - Unit tests for business logic
7. **Keep it simple** - Readable over clever

Follow these guidelines to maintain a clean, maintainable, and professional codebase.
