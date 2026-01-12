# DashWorld - URL Routing and Navigation Plan

## Current State

### How Navigation Works Now
The application currently uses **internal state-based navigation** without URL routing:

```typescript
// Current approach in DashWorld.tsx
const [page, setPage] = useState<'upload' | 'browse' | 'video-detail' | 'account' | 'request-form'>('browse');

// Navigation happens by changing state
<button onClick={() => setPage('browse')}>Browse</button>
```

### Problems with Current Approach

1. **No Unique URLs**
   - Everything is at `localhost:3000` (or `yourdomain.com` in production)
   - Can't bookmark specific pages
   - Can't share links to specific videos
   - Can't open footage in new tab

2. **Browser Navigation Broken**
   - Back/Forward buttons don't work
   - Refreshing the page loses your current view
   - No browser history integration

3. **Poor SEO**
   - Search engines can't index individual footage pages
   - No social media preview cards for shared links
   - All pages appear as the same URL to crawlers

4. **No Deep Linking**
   - Can't link directly to a specific video from external sources
   - Email notifications can't include direct links
   - QR codes can't point to specific footage

---

## Planned URL Structure

### Production Domain Structure

Assuming the application will be deployed at `https://dashworld.app` (or your chosen domain):

```
https://dashworld.app/                          → Home/Browse page
https://dashworld.app/browse                    → Browse footage (grid view)
https://dashworld.app/map                       → Map view
https://dashworld.app/upload                    → Upload new footage
https://dashworld.app/footage/:id               → View specific footage
https://dashworld.app/footage/:id/edit          → Edit footage details
https://dashworld.app/request                   → Request footage form
https://dashworld.app/account                   → User account settings
https://dashworld.app/login                     → Login page
https://dashworld.app/signup                    → Registration page
```

### URL Parameters and Query Strings

```
# Filter footage by parameters
https://dashworld.app/browse?type=accident&date=2024-01-15

# Map view with specific location
https://dashworld.app/map?lat=37.7749&lng=-122.4194&zoom=12

# Browse with search query
https://dashworld.app/browse?q=highway+101

# Share specific footage with timestamp
https://dashworld.app/footage/42?t=15s

# Upload flow with step tracking
https://dashworld.app/upload?step=2
```

### Dynamic Routes

```typescript
// Footage detail page
/footage/:id                    → /footage/42
/footage/:id/edit              → /footage/42/edit

// User profiles (future feature)
/user/:username                 → /user/john_doe

// Public collections (future feature)
/collection/:id                 → /collection/highway-incidents-2024
```

---

## Implementation Plan

### 1. Install React Router

```bash
cd frontend
npm install react-router-dom
npm install --save-dev @types/react-router-dom
```

### 2. Update Main Application Structure

**Before (current):**
```typescript
// main.tsx
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DashWorld />
  </React.StrictMode>
)
```

**After (with routing):**
```typescript
// main.tsx
import { BrowserRouter } from 'react-router-dom';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
```

### 3. Create Route Configuration

```typescript
// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { BrowsePage } from './pages/BrowsePage';
import { MapPage } from './pages/MapPage';
import { UploadPage } from './pages/UploadPage';
import { FootageDetailPage } from './pages/FootageDetailPage';
import { AccountPage } from './pages/AccountPage';
import { RequestPage } from './pages/RequestPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/browse" replace />} />
        <Route path="browse" element={<BrowsePage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="footage/:id" element={<FootageDetailPage />} />
        <Route path="login" element={<LoginPage />} />

        {/* Protected routes (require authentication) */}
        <Route path="upload" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
        <Route path="footage/:id/edit" element={<ProtectedRoute><EditFootagePage /></ProtectedRoute>} />
        <Route path="account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
        <Route path="request" element={<RequestPage />} />

        {/* 404 Not Found */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
```

### 4. Update Navigation Components

**Before (state-based):**
```typescript
<button onClick={() => setPage('browse')}>
  Browse Footage
</button>
```

**After (URL-based):**
```typescript
import { Link, useNavigate } from 'react-router-dom';

// Using Link component
<Link to="/browse" className="nav-link">
  <Grid size={24} />
  Browse Footage
</Link>

// Using programmatic navigation
const navigate = useNavigate();

const handleFootageClick = (id: number) => {
  navigate(`/footage/${id}`);
};
```

### 5. Update Page Components to Use URL Parameters

**Footage Detail Page:**
```typescript
import { useParams, useNavigate } from 'react-router-dom';

export function FootageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [footage, setFootage] = useState<FootageItem | null>(null);

  useEffect(() => {
    async function loadFootage() {
      if (!id) return;

      const data = await api.getFootageById(parseInt(id));
      if (!data) {
        // Redirect to 404 if footage not found
        navigate('/404', { replace: true });
        return;
      }

      setFootage(data);
    }

    loadFootage();
  }, [id, navigate]);

  return (
    <div>
      <button onClick={() => navigate('/browse')}>
        Back to Browse
      </button>
      {/* Footage details */}
    </div>
  );
}
```

**Browse Page with Query Parameters:**
```typescript
import { useSearchParams } from 'react-router-dom';

export function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read filters from URL
  const filters = {
    type: searchParams.get('type') || '',
    date: searchParams.get('date') || '',
    query: searchParams.get('q') || ''
  };

  // Update URL when filters change
  const handleFilterChange = (newFilters: Filters) => {
    const params = new URLSearchParams();

    if (newFilters.type) params.set('type', newFilters.type);
    if (newFilters.date) params.set('date', newFilters.date);
    if (newFilters.query) params.set('q', newFilters.query);

    setSearchParams(params);
  };

  return (
    <div>
      {/* Filter controls */}
      {/* Footage grid */}
    </div>
  );
}
```

### 6. Shared Layout Component

```typescript
// src/components/Layout.tsx
import { Outlet } from 'react-router-dom';
import { Navigation } from './Navigation';
import { Header } from './Header';

export function Layout() {
  return (
    <div className="flex h-screen">
      <Navigation />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-auto">
          <Outlet /> {/* Child routes render here */}
        </main>
      </div>
    </div>
  );
}
```

### 7. Protected Routes for Authentication

```typescript
// src/components/ProtectedRoute.tsx
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = localStorage.getItem('auth_token');
  const location = useLocation();

  if (!isAuthenticated) {
    // Redirect to login, but save the attempted URL
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// After login, redirect back to attempted page
function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = async (credentials) => {
    await login(credentials);

    // Redirect to the page they were trying to access
    const from = location.state?.from?.pathname || '/browse';
    navigate(from, { replace: true });
  };
}
```

---

## Backend Configuration

### Server-Side Routing Support

When deployed, the backend needs to serve `index.html` for all routes (except API endpoints) to support client-side routing.

**Express.js Configuration:**
```javascript
// backend/server.js

// Serve static files from React build
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// API routes
app.use('/api', apiRouter);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// IMPORTANT: Handle all other routes by serving index.html
// This enables client-side routing to work
app.get('*', (req, res) => {
  // Don't serve index.html for API routes or file uploads
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});
```

### Production Server Configuration (Nginx)

```nginx
# /etc/nginx/sites-available/dashworld

server {
    listen 80;
    server_name dashworld.app www.dashworld.app;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dashworld.app www.dashworld.app;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/dashworld.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dashworld.app/privkey.pem;

    # Serve static files
    location / {
        root /var/www/dashworld/frontend/dist;
        try_files $uri $uri/ /index.html;  # Important for SPA routing
    }

    # Proxy API requests to Node.js backend
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Increase timeout for video uploads
        client_max_body_size 250M;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }

    # Serve uploaded files
    location /uploads {
        alias /var/www/dashworld/backend/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## URL Examples in Production

### Basic Navigation
```
https://dashworld.app/                    → Redirects to /browse
https://dashworld.app/browse              → Browse all footage
https://dashworld.app/map                 → Map view
https://dashworld.app/upload              → Upload page
https://dashworld.app/account             → User account
```

### Sharing Specific Footage
```
https://dashworld.app/footage/42          → View footage #42
https://dashworld.app/footage/42?t=30s    → Jump to 30 seconds in video
```

### Filtered Browse Views
```
https://dashworld.app/browse?type=accident
https://dashworld.app/browse?type=accident&date=2024-01-15
https://dashworld.app/browse?q=highway+101
https://dashworld.app/browse?type=near-miss&dateFrom=2024-01-01&dateTo=2024-01-31
```

### Map with Location
```
https://dashworld.app/map?lat=37.7749&lng=-122.4194&zoom=13
https://dashworld.app/map?location=San+Francisco
```

### Deep Linking to Upload Flow
```
https://dashworld.app/upload?step=2       → Resume upload at step 2
```

---

## SEO and Social Media Integration

### Meta Tags for Each Page

```typescript
// src/components/MetaTags.tsx
import { Helmet } from 'react-helmet-async';

interface MetaTagsProps {
  title: string;
  description: string;
  image?: string;
  url: string;
}

export function MetaTags({ title, description, image, url }: MetaTagsProps) {
  return (
    <Helmet>
      <title>{title} | DashWorld</title>
      <meta name="description" content={description} />

      {/* Open Graph (Facebook, LinkedIn) */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      {image && <meta property="og:image" content={image} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}

      {/* Canonical URL */}
      <link rel="canonical" href={url} />
    </Helmet>
  );
}

// Usage in FootageDetailPage
export function FootageDetailPage() {
  const { id } = useParams();
  const [footage, setFootage] = useState<FootageItem | null>(null);

  return (
    <>
      <MetaTags
        title={`${footage?.type} - ${footage?.location}`}
        description={footage?.description || `Dashcam footage from ${footage?.date}`}
        image={`https://dashworld.app/uploads/thumbnails/${footage?.thumbnail}`}
        url={`https://dashworld.app/footage/${id}`}
      />

      {/* Page content */}
    </>
  );
}
```

### Social Media Preview Example

When someone shares `https://dashworld.app/footage/42` on Facebook or Twitter, they'll see:

```
┌─────────────────────────────────────┐
│  [Thumbnail Image]                  │
├─────────────────────────────────────┤
│ Highway Accident - I-880 Oakland    │
│ Dashcam footage from 2024-01-15    │
│ dashworld.app                       │
└─────────────────────────────────────┘
```

---

## Migration Strategy

### Phase 1: Install Dependencies
```bash
npm install react-router-dom
npm install react-helmet-async  # For SEO meta tags
npm install --save-dev @types/react-router-dom
```

### Phase 2: Restructure Application
1. Create new page components
2. Move current page logic into separate files
3. Create Layout component
4. Set up route configuration

### Phase 3: Update Navigation
1. Replace `setPage()` calls with `navigate()`
2. Replace conditional rendering with `<Link>` components
3. Update all button clicks to use routing

### Phase 4: URL Parameter Integration
1. Add query string support for filters
2. Update state management to sync with URL
3. Implement URL-based state persistence

### Phase 5: Backend Configuration
1. Update Express.js to serve index.html for all routes
2. Test routing in production build
3. Configure Nginx/Apache for SPA support

### Phase 6: Testing
1. Test all routes manually
2. Test browser back/forward buttons
3. Test direct URL access
4. Test URL sharing and bookmarking
5. Verify 404 handling

---

## URL Design Best Practices

### 1. Keep URLs Readable and Meaningful
```
✅ Good: /footage/42
✅ Good: /browse?type=accident
❌ Bad:  /f/42
❌ Bad:  /browse?t=1
```

### 2. Use Plural for Collections
```
✅ Good: /footage (collection)
✅ Good: /footage/42 (single item)
❌ Bad:  /footages/42
```

### 3. Use Hyphens, Not Underscores
```
✅ Good: /near-miss
❌ Bad:  /near_miss
```

### 4. Lowercase URLs
```
✅ Good: /browse
❌ Bad:  /Browse
```

### 5. Consistent Date Format
```
✅ Good: ?date=2024-01-15 (ISO format)
❌ Bad:  ?date=01/15/2024
```

---

## Analytics Integration

With proper URL routing, you can track user behavior more effectively:

```typescript
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    // Google Analytics
    if (window.gtag) {
      window.gtag('config', 'GA_MEASUREMENT_ID', {
        page_path: location.pathname + location.search,
      });
    }

    // Custom analytics
    fetch('/api/analytics/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: location.pathname,
        search: location.search,
        timestamp: new Date().toISOString()
      })
    });
  }, [location]);
}

// Use in App component
function App() {
  usePageTracking();

  return (
    <Routes>
      {/* routes */}
    </Routes>
  );
}
```

---

## Security Considerations

### 1. Prevent URL Injection
```typescript
// Validate route parameters
const { id } = useParams<{ id: string }>();

// Convert and validate ID
const footageId = parseInt(id || '', 10);

if (!footageId || isNaN(footageId) || footageId < 1) {
  navigate('/404', { replace: true });
  return;
}
```

### 2. Sanitize Query Parameters
```typescript
import DOMPurify from 'dompurify';

const searchQuery = searchParams.get('q') || '';
const sanitizedQuery = DOMPurify.sanitize(searchQuery);
```

### 3. Rate Limiting for Direct Access
Prevent scraping by rate-limiting direct footage URL access.

---

## Summary

### Current State
- No URL routing
- State-based navigation only
- All pages at `localhost:3000`

### After Implementation
```
Production URLs:
https://dashworld.app/browse
https://dashworld.app/footage/42
https://dashworld.app/map?lat=37.7749&lng=-122.4194

Features:
✅ Shareable links to specific footage
✅ Bookmarkable pages
✅ Browser back/forward works
✅ SEO-friendly URLs
✅ Social media preview cards
✅ Deep linking support
✅ Query parameter filtering
```

**Next Steps:**
1. Install react-router-dom
2. Refactor DashWorld.tsx into separate page components
3. Implement route configuration
4. Update backend to support SPA routing
5. Test thoroughly before deployment

---

**Last Updated:** 2026-01-01
