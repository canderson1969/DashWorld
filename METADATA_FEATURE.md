# Video Metadata Extraction Feature

## Overview

The upload process now automatically extracts metadata from video files including:
- **Date and Time** - When the video was recorded
- **GPS Coordinates** - Latitude and longitude if embedded in the video
- **Manual Coordinate Input** - Fallback option with two-way sync to map

## Implementation Details

### 1. Video Metadata Extraction (`frontend/src/utils/videoMetadata.ts`)

Created a new utility module using the `exifreader` library that:

- Extracts EXIF metadata from video files
- Parses GPS coordinates from various tag formats (GPSLatitude, GPSLongitude, etc.)
- Converts DMS (Degrees, Minutes, Seconds) to decimal degrees
- Extracts date/time from multiple possible EXIF tags:
  - DateTimeOriginal
  - DateTime
  - ModifyDate
- Falls back to file modification time if no EXIF data is available

### 2. Upload Flow Updates

**File Upload Handler (`handleFileUpload`):**
- Now uses `async/await` to extract metadata
- Auto-populates date and time from video metadata
- Detects GPS coordinates and displays them
- Sets coordinate inputs if GPS is found
- Falls back gracefully if metadata extraction fails

**State Management:**
- Added `manualCoords` state with `{ lat: '', lng: '' }`
- Coordinates sync between map pin and input fields
- Real-time validation of coordinate ranges

### 3. Location Selection (Step 3)

**New Manual Coordinate Inputs:**
- Two input fields for Latitude and Longitude
- Live synchronization with map pin:
  - **Map → Inputs**: Clicking or dragging pin updates input boxes
  - **Inputs → Map**: Typing coordinates moves the pin and centers map
- Input validation on blur (latitude: -90 to 90, longitude: -180 to 180)
- Visual feedback with placeholder examples

**Map Interactions:**
- Click anywhere on map to set location
- Drag the marker to adjust position
- Both actions update coordinate inputs automatically
- Confidence level adjusts based on GPS vs manual input

## Features

### ✅ Automatic GPS Detection
- If video has GPS metadata, coordinates are extracted automatically
- Map centers on GPS location
- Coordinate inputs pre-filled
- High confidence indicator

### ✅ Manual Coordinate Entry
- Users can type lat/lng directly if no GPS data
- Input fields validate coordinate ranges
- Map updates when user tabs out of input
- Useful for videos without GPS or to correct inaccurate GPS

### ✅ Two-Way Synchronization
```
Map Pin Movement ←→ Coordinate Input Boxes
     ↓                        ↓
  Click/Drag            Type Numbers
     ↓                        ↓
Updates Inputs        Updates Map Pin
```

### ✅ Date/Time Auto-Population
- Extracts recording timestamp from video
- Falls back to file modification time
- Pre-populates date and time fields in Step 2
- Confidence indicator shows if timestamp is from metadata or file

## Usage Example

### Scenario 1: Dashcam with GPS
1. Upload dashcam video file
2. System extracts: `2025-12-30 14:30:00, GPS: (37.774900, -122.419400)`
3. Step 2: Date/time auto-filled
4. Step 3: Map centered on GPS coordinates, inputs show exact values
5. User can click to adjust or type to fine-tune

### Scenario 2: Video without GPS
1. Upload regular video file
2. System extracts: `2025-12-30 14:30:00, No GPS`
3. Step 2: Date/time auto-filled
4. Step 3: Map centered on default location (San Francisco)
5. User clicks map or types coordinates manually
6. Coordinates sync to input boxes

## Technical Stack

**Dependencies Added:**
- `exifreader` (npm package) - Parses EXIF/metadata from video files

**New Files:**
- `frontend/src/utils/videoMetadata.ts` - Metadata extraction utilities

**Modified Files:**
- `frontend/src/DashWorld.tsx` - Upload flow with metadata integration

## Metadata Extraction Details

### GPS Coordinate Formats Supported
```javascript
// Format 1: Decimal degrees (direct)
{ Latitude: 37.774900, Longitude: -122.419400 }

// Format 2: DMS (Degrees, Minutes, Seconds)
{
  GPSLatitude: "37° 46' 29.64\"",
  GPSLatitudeRef: "N",
  GPSLongitude: "122° 25' 9.84\"",
  GPSLongitudeRef: "W"
}
```

### DateTime Formats Supported
```javascript
// EXIF Standard Format
"2025:12:30 14:30:45"

// Converted to
date: "2025-12-30"
time: "14:30"
```

## Future Enhancements

- [ ] Reverse geocoding: Show address from GPS coordinates
- [ ] Speed and direction from video metadata
- [ ] Support for more video formats (currently optimized for MP4)
- [ ] Camera model and settings extraction
- [ ] G-sensor data parsing (for impact detection)

## Testing

To test with real dashcam footage:
1. Use a video file from an actual dashcam with GPS
2. Upload through the web interface
3. Check browser console for "Extracted metadata:" log
4. Verify GPS coordinates appear in input boxes
5. Verify map centers on correct location

## Notes

- Metadata extraction happens client-side (in the browser)
- No video data is sent to server until user completes upload
- GPS accuracy depends on dashcam's GPS receiver quality
- Some older dashcams may not embed GPS in video files
