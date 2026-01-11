import { useState, useEffect, useRef } from 'react';
import { MapPin, Calendar, Clock, Search, Grid, Map, Play, Upload, Info, AlertCircle, Check, User, LogOut, UserCircle, Moon, Sun, AlertTriangle, Inbox } from 'lucide-react';
import * as api from './api';
import { API_CONFIG, UI_CONSTANTS, MAP_CONFIG } from './config/constants';
import { formatTimeTo12Hour, formatDuration, formatIncidentType } from './utils/timeFormat';
import { GlobalErrorToast } from './components/ErrorDisplay';
import { ProgressiveImage } from './components/ProgressiveImage';

// Import types
import type { FootageItem, RequestFormData } from './types';

// Import hooks
import { useAuth } from './hooks/useAuth';
import { useConversations } from './hooks/useConversations';

// Import page components
import { UploadPage } from './components/pages/UploadPage';
import { ProcessingPage } from './components/pages/ProcessingPage';
import { VideoDetailPage } from './components/pages/VideoDetailPage';
import { RequestFormPage } from './components/pages/RequestFormPage';
import { RequestSentPage } from './components/pages/RequestSentPage';
import { InboxPage } from './components/pages/InboxPage';
import { ConversationPage } from './components/pages/ConversationPage';
import { ProfilePage } from './components/pages/ProfilePage';
import { SearchPage } from './components/pages/SearchPage';

// Import modals
import { ShareModal } from './components/modals/ShareModal';
import { AuthModal } from './components/modals/AuthModal';
import { AuthPromptModal } from './components/modals/AuthPromptModal';
import { ContentWarningModal, ExistingConversationModal, DeleteConfirmModal } from './components/modals/ConfirmationModals';

// Import view components
import { MapView } from './components/views/MapView';
import { BrowseView } from './components/views/BrowseView';

// Declare Leaflet on window
declare global {
  interface Window {
    L: any;
  }
}

type PageType = 'browse' | 'search' | 'upload' | 'processing' | 'video-detail' | 'request-form' | 'request-sent' | 'inbox' | 'conversation' | 'profile';
type ViewType = 'map' | 'browse';
type TimeRangeType = '24h' | '3days' | '1week' | '2weeks' | '1month' | '3months' | 'all';

const DashWorld = () => {
  // Use auth hook
  const { authToken, currentUser, handleAuthSuccess: baseHandleAuthSuccess, handleLogout: baseHandleLogout, updateUser } = useAuth();

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  /**
   * Show a toast notification
   */
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    const duration = type === 'success' ? 5000 : 4000;
    setTimeout(() => setToast(null), duration);
  };

  // Use conversations hook
  const {
    conversations,
    selectedConversation,
    conversationMessages,
    unreadCount,
    loadConversations,
    loadConversationMessages,
    sendMessage,
    setSelectedConversation,
    findExistingConversation
  } = useConversations(authToken, showToast);

  // View and page state
  const [view, setView] = useState<ViewType>('map');
  const [page, setPage] = useState<PageType>('browse');
  const [selectedPin, setSelectedPin] = useState<FootageItem | null>(null);

  // Processing state
  const [processingFootageId, setProcessingFootageId] = useState<number | null>(null);
  const [processingThumbnail, setProcessingThumbnail] = useState<string | null>(null);

  // Modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAuthPromptModal, setShowAuthPromptModal] = useState(false);
  const [authPromptAction, setAuthPromptAction] = useState<'contact' | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [footageToShare, setFootageToShare] = useState<FootageItem | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showContentWarningModal, setShowContentWarningModal] = useState(false);
  const [warningFootage, setWarningFootage] = useState<FootageItem | null>(null);
  const [showExistingConversationModal, setShowExistingConversationModal] = useState(false);
  const [existingConversationToNavigate, setExistingConversationToNavigate] = useState<api.Conversation | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [footageToDelete, setFootageToDelete] = useState<number | null>(null);

  // Footage state
  const [footageData, setFootageData] = useState<FootageItem[]>([]);
  const [visibleFootage, setVisibleFootage] = useState<FootageItem[]>([]);
  const [acknowledgedFootageIds, setAcknowledgedFootageIds] = useState<Set<number>>(new Set());
  const [onlyShowVisibleFootage, setOnlyShowVisibleFootage] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRangeType>('2weeks');

  // Form state
  const [requestFormData, setRequestFormData] = useState<RequestFormData>({
    name: '',
    reason: '',
    message: ''
  });

  // Map state
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [mapLocationSuggestions, setMapLocationSuggestions] = useState<any[]>([]);
  const [showMapLocationSuggestions, setShowMapLocationSuggestions] = useState(false);
  const [isSearchingMapLocation, setIsSearchingMapLocation] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [mapDarkness, setMapDarkness] = useState(0);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const mapTileLayerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const markerClusterGroupRef = useRef<any>(null);
  const heatmapLayerRef = useRef<any>(null);
  const mapSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UI state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('dash_world_dark_mode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [isAtScrollBottom, setIsAtScrollBottom] = useState(false);
  const footageListRef = useRef<HTMLDivElement | null>(null);

  // Handlers

  /**
   * Handle successful authentication
   */
  const handleAuthSuccess = (token: string, user: api.User) => {
    baseHandleAuthSuccess(token, user);
    setShowAuthModal(false);
    setShowAuthPromptModal(false);

    if (authPromptAction === 'contact' && selectedPin) {
      setTimeout(() => {
        setPage('request-form');
        setAuthPromptAction(null);
      }, 100);
    }
  };

  /**
   * Handle user logout
   */
  const handleLogout = () => {
    baseHandleLogout();
    setShowUserMenu(false);
    setPage('browse');
  };

  /**
   * Handle scroll event on footage list
   */
  const handleFootageListScroll = () => {
    if (!footageListRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = footageListRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
    setIsAtScrollBottom(isAtBottom);
  };

  /**
   * Load footage from API
   */
  const loadFootage = async () => {
    try {
      const footage = await api.getAllFootage();
      const transformedData = footage.map((item, index) => ({
        id: item.id,
        user_id: (item as any).user_id,
        lat: item.lat,
        lng: item.lng,
        location: item.location_name,
        date: item.incident_date,
        time: item.incident_time,
        type: item.incident_type,
        emoji: UI_CONSTANTS.INCIDENT_EMOJIS[index % UI_CONSTANTS.INCIDENT_EMOJIS.length],
        thumbnail: item.thumbnail,
        thumbnail_small: (item as any).thumbnail_small,
        thumbnail_medium: (item as any).thumbnail_medium,
        thumbnail_large: (item as any).thumbnail_large,
        description: item.description,
        filename: item.filename,
        filename_compressed: (item as any).filename_compressed,
        filename_240p: (item as any).filename_240p,
        filename_360p: (item as any).filename_360p,
        filename_480p: (item as any).filename_480p,
        filename_720p: (item as any).filename_720p,
        filename_1080p: (item as any).filename_1080p,
        duration: item.duration,
        is_graphic_content: (item as any).is_graphic_content || false,
        content_warnings: (item as any).content_warnings || null,
        created_at: item.created_at
      }));
      setFootageData(transformedData);
      setVisibleFootage(transformedData);
    } catch (error) {
      showToast('Failed to load footage. Please try again.', 'error');
    }
  };

  /**
   * Update visible footage based on map bounds
   */
  const updateVisibleFootage = () => {
    if (!mapInstanceRef.current) {
      setVisibleFootage(footageData);
      return;
    }
    const bounds = mapInstanceRef.current.getBounds();
    const filtered = footageData.filter(footage => {
      const latLng = window.L.latLng(footage.lat, footage.lng);
      return bounds.contains(latLng);
    });
    setVisibleFootage(filtered);
  };

  /**
   * Get cutoff date for time range filter
   */
  const getTimeRangeCutoff = (range: string): string => {
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    switch(range) {
      case '24h': return new Date(now.getTime() - msPerDay).toISOString().split('T')[0];
      case '3days': return new Date(now.getTime() - 3 * msPerDay).toISOString().split('T')[0];
      case '1week': return new Date(now.getTime() - 7 * msPerDay).toISOString().split('T')[0];
      case '2weeks': return new Date(now.getTime() - 14 * msPerDay).toISOString().split('T')[0];
      case '1month': return new Date(now.getTime() - 30 * msPerDay).toISOString().split('T')[0];
      case '3months': return new Date(now.getTime() - 90 * msPerDay).toISOString().split('T')[0];
      case 'all': return '1900-01-01';
      default: return new Date(now.getTime() - 14 * msPerDay).toISOString().split('T')[0];
    }
  };

  /**
   * Apply time range filter to footage
   */
  const applyFilters = (footage: FootageItem[]): FootageItem[] => {
    const cutoffDate = getTimeRangeCutoff(timeRange);
    return footage.filter(item => item.date >= cutoffDate);
  };

  /**
   * Handle footage deletion
   */
  const handleDeleteFootage = async (footageId: number) => {
    if (!authToken) {
      showToast('You must be logged in to delete footage.', 'error');
      return;
    }
    setFootageToDelete(footageId);
    setShowDeleteConfirmModal(true);
  };

  /**
   * Confirm and execute footage deletion
   */
  const confirmDeleteFootage = async () => {
    if (!footageToDelete || !authToken) return;
    try {
      await api.deleteFootage(footageToDelete, authToken);
      await loadFootage();
      setSelectedPin(null);
      setPage('browse');
      showToast('Footage deleted successfully.', 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete footage';
      showToast('Delete failed: ' + errorMessage, 'error');
    }
    setShowDeleteConfirmModal(false);
    setFootageToDelete(null);
  };

  /**
   * Search for map location suggestions
   */
  const searchMapLocation = async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setMapLocationSuggestions([]);
      setShowMapLocationSuggestions(false);
      return;
    }
    setIsSearchingMapLocation(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (!response.ok) throw new Error('Location search failed');
      const results = await response.json();
      setMapLocationSuggestions(results);
      setShowMapLocationSuggestions(results.length > 0);
    } catch (error) {
      setMapLocationSuggestions([]);
      setShowMapLocationSuggestions(false);
    } finally {
      setIsSearchingMapLocation(false);
    }
  };

  /**
   * Handle selecting a map location suggestion
   */
  const handleSelectMapLocation = (suggestion: any) => {
    if (mapInstanceRef.current) {
      const lat = parseFloat(suggestion.lat);
      const lng = parseFloat(suggestion.lon);
      mapInstanceRef.current.setView([lat, lng], 13);
    }
    setMapSearchQuery('');
    setMapLocationSuggestions([]);
    setShowMapLocationSuggestions(false);
  };

  /**
   * Handle content warning confirmation
   */
  const handleContentWarningConfirm = (footage: FootageItem) => {
    setAcknowledgedFootageIds(prev => new Set(prev).add(footage.id));
    setSelectedPin(footage);
    setPage('video-detail');
    setShowContentWarningModal(false);
    setWarningFootage(null);
  };

  /**
   * Handle request footage action
   */
  const handleRequestFootage = async () => {
    if (!currentUser || !authToken) {
      setShowAuthPromptModal(true);
      setAuthPromptAction('contact');
      return;
    }
    if (!selectedPin) return;

    try {
      await loadConversations();
      const existingConversation = findExistingConversation(
        selectedPin.id,
        currentUser.id,
        selectedPin.user_id!
      );

      if (existingConversation) {
        setExistingConversationToNavigate(existingConversation);
        setShowExistingConversationModal(true);
      } else {
        setPage('request-form');
      }
    } catch (error) {
      setPage('request-form');
    }
  };

  /**
   * Handle going to existing conversation thread
   */
  const handleGoToExistingThread = async (conversation: api.Conversation) => {
    setSelectedConversation(conversation);
    setPage('conversation');
    await loadConversationMessages(conversation.id);
    setShowExistingConversationModal(false);
    setExistingConversationToNavigate(null);
  };

  /**
   * Handle request form submission
   */
  const handleRequestFormSubmit = async () => {
    if (!selectedPin || !selectedPin.user_id || !authToken) {
      showToast('Unable to send message. Please sign in.', 'error');
      return;
    }

    try {
      const reasonLabels: Record<string, string> = {
        involved: 'I was involved in this accident',
        witness: 'I witnessed this accident',
        representative: 'I represent someone involved (legal/insurance)',
        other: 'Other'
      };

      const subject = `Request: ${formatIncidentType(selectedPin.type)} at ${selectedPin.location}`;
      const messageBody = `Re: ${formatIncidentType(selectedPin.type)} at ${selectedPin.location}
Date: ${selectedPin.date} at ${formatTimeTo12Hour(selectedPin.time)}

---

From: ${requestFormData.name}
Reason: ${reasonLabels[requestFormData.reason] || requestFormData.reason}

${requestFormData.message ? `Message:\n${requestFormData.message}` : ''}`;

      await api.createConversation(
        selectedPin.id,
        selectedPin.user_id,
        subject,
        messageBody.trim(),
        authToken
      );

      setPage('request-sent');
      showToast('Message sent to uploader', 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showToast('Failed to send message: ' + errorMessage, 'error');
    }
  };

  // Effects

  useEffect(() => {
    loadFootage();
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('dash_world_dark_mode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    handleFootageListScroll();
  }, [footageData]);

  // Global error handler
  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const errorString = args.join(' ');
      if (
        errorString.includes('fetching process') ||
        errorString.includes('media resource') ||
        errorString.includes('aborted by the user agent') ||
        errorString.includes('_leaflet_pos')
      ) {
        return;
      }
      originalConsoleError.apply(console, args);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      const errorMessage = error?.message || String(error);
      const isIgnorable =
        error?.name === 'AbortError' ||
        error?.name === 'DOMException' ||
        errorMessage.includes('aborted') ||
        errorMessage.includes('media resource') ||
        errorMessage.includes('_leaflet_pos');

      if (isIgnorable) {
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      console.error = originalConsoleError;
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Leaflet loading
  useEffect(() => {
    if (window.L) {
      setLeafletLoaded(true);
      return;
    }

    const leafletCss = document.createElement('link');
    leafletCss.rel = 'stylesheet';
    leafletCss.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
    document.head.appendChild(leafletCss);

    const markerClusterCss = document.createElement('link');
    markerClusterCss.rel = 'stylesheet';
    markerClusterCss.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.css';
    document.head.appendChild(markerClusterCss);

    const markerClusterDefaultCss = document.createElement('link');
    markerClusterDefaultCss.rel = 'stylesheet';
    markerClusterDefaultCss.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.Default.css';
    document.head.appendChild(markerClusterDefaultCss);

    const leafletScript = document.createElement('script');
    leafletScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
    leafletScript.onload = () => {
      const markerClusterScript = document.createElement('script');
      markerClusterScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.js';
      markerClusterScript.onload = () => {
        const heatScript = document.createElement('script');
        heatScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.heat/0.2.0/leaflet-heat.js';
        heatScript.onload = () => setLeafletLoaded(true);
        document.body.appendChild(heatScript);
      };
      document.body.appendChild(markerClusterScript);
    };
    document.body.appendChild(leafletScript);
  }, []);

  // Map initialization
  useEffect(() => {
    if (view === 'map' && leafletLoaded && mapRef.current && !mapInstanceRef.current && page === 'browse') {
      const L = window.L;
      const map = L.map(mapRef.current).setView(MAP_CONFIG.DEFAULT_CENTER, MAP_CONFIG.DEFAULT_ZOOM);

      const tileLayer = L.tileLayer(MAP_CONFIG.TILE_URL, {
        attribution: MAP_CONFIG.ATTRIBUTION,
        maxZoom: 19,
        errorTileUrl: '',
      }).addTo(map);

      tileLayer.on('tileerror', function(error: any) {
        const tile = error.tile;
        const retryCount = tile.retryCount || 0;
        if (retryCount < 3) {
          tile.retryCount = retryCount + 1;
          setTimeout(() => { tile.src = tile.src; }, 1000 * (retryCount + 1));
        }
      });

      mapInstanceRef.current = map;
      mapTileLayerRef.current = tileLayer;

      setTimeout(() => map.invalidateSize(), 100);
      setTimeout(() => map.invalidateSize(), 250);
      setTimeout(() => map.invalidateSize(), 500);

      map.on('moveend', updateVisibleFootage);
      map.on('zoomend', updateVisibleFootage);
      updateVisibleFootage();

      const markerClusterGroup = (L as any).markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: function(cluster: any) {
          const childMarkers = cluster.getAllChildMarkers();
          const count = childMarkers.length;
          const hasGraphic = childMarkers.some((marker: any) => marker.options.isGraphic);
          const clusterColor = hasGraphic ? '#f97316' : '#2563eb';
          const sizeValue = count < 10 ? 40 : count < 100 ? 50 : 60;

          return L.divIcon({
            html: `<div style="position: relative;"><div style="background: ${clusterColor}; border: 3px solid white; border-radius: 50%; width: ${sizeValue}px; height: ${sizeValue}px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: ${sizeValue / 2.5}px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">${count}</div>${hasGraphic ? '<div style="position: absolute; top: -2px; right: -2px; background: #f97316; border: 2px solid white; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;"><svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 19h20L12 2z"/></svg></div>' : ''}</div>`,
            className: 'marker-cluster-custom',
            iconSize: L.point(sizeValue, sizeValue)
          });
        }
      });

      map.addLayer(markerClusterGroup);
      markerClusterGroupRef.current = markerClusterGroup;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current = [];
        markerClusterGroupRef.current = null;
      }
    };
  }, [view, leafletLoaded, page]);

  // Update markers
  useEffect(() => {
    if (view === 'map' && leafletLoaded && markerClusterGroupRef.current && window.L && page === 'browse') {
      const L = window.L;
      const markerClusterGroup = markerClusterGroupRef.current;

      markerClusterGroup.clearLayers();
      markersRef.current = [];

      const filteredData = applyFilters(footageData);

      filteredData.forEach(footage => {
        const markerColor = selectedPin?.id === footage.id ? '#ef4444' : footage.is_graphic_content ? '#f97316' : '#2563eb';
        const customIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="position: relative; cursor: pointer;"><svg width="40" height="40" viewBox="0 0 24 24" fill="${markerColor}" stroke="white" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path></svg><div style="position: absolute; top: 8px; left: 50%; transform: translateX(-50%); font-size: 16px;">${footage.emoji}</div>${footage.is_graphic_content ? '<div style="position: absolute; top: -4px; right: -4px; background: #f97316; border: 2px solid white; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;"><svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 19h20L12 2z"/></svg></div>' : ''}</div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 40],
          popupAnchor: [0, -40]
        });

        const marker = L.marker([footage.lat, footage.lng], { icon: customIcon, isGraphic: footage.is_graphic_content })
          .on('click', () => setSelectedPin(footage));

        markerClusterGroup.addLayer(marker);
        markersRef.current.push({ marker, footage });
      });
    }
  }, [view, leafletLoaded, footageData, timeRange, page]);

  // Heatmap toggle
  useEffect(() => {
    if (view === 'map' && leafletLoaded && mapInstanceRef.current && window.L && page === 'browse') {
      const L = window.L;
      const map = mapInstanceRef.current;

      if (showHeatmap) {
        if (!heatmapLayerRef.current) {
          const filteredData = applyFilters(footageData);
          const heatPoints = filteredData.map(footage => [footage.lat, footage.lng, 1.0]);
          heatmapLayerRef.current = L.heatLayer(heatPoints, {
            radius: 25,
            blur: 15,
            maxZoom: 17,
            max: 1.0,
            gradient: { 0.0: 'blue', 0.5: 'lime', 0.7: 'yellow', 1.0: 'red' }
          });
          heatmapLayerRef.current.addTo(map);
          if (markerClusterGroupRef.current) map.removeLayer(markerClusterGroupRef.current);
        }
      } else {
        if (heatmapLayerRef.current) {
          map.removeLayer(heatmapLayerRef.current);
          heatmapLayerRef.current = null;
          if (markerClusterGroupRef.current) map.addLayer(markerClusterGroupRef.current);
        }
      }
    }
  }, [showHeatmap, view, leafletLoaded, footageData, timeRange, page]);

  // Update marker colors on selection
  useEffect(() => {
    if (mapInstanceRef.current && window.L) {
      markersRef.current.forEach(({ marker, footage }) => {
        const markerColor = selectedPin?.id === footage.id ? '#ef4444' : footage.is_graphic_content ? '#f97316' : '#2563eb';
        const customIcon = window.L.divIcon({
          className: 'custom-marker',
          html: `<div style="position: relative; cursor: pointer; transition: transform 0.2s;"><svg width="40" height="40" viewBox="0 0 24 24" fill="${markerColor}" stroke="white" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path></svg><div style="position: absolute; top: 8px; left: 50%; transform: translateX(-50%); font-size: 16px;">${footage.emoji}</div>${footage.is_graphic_content ? '<div style="position: absolute; top: -4px; right: -4px; background: #f97316; border: 2px solid white; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;"><svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 19h20L12 2z"/></svg></div>' : ''}</div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 40],
          popupAnchor: [0, -40]
        });
        marker.setIcon(customIcon);
      });
    }
  }, [selectedPin]);

  // Render
  const displayedFootage = applyFilters(view === 'map' && onlyShowVisibleFootage ? visibleFootage : footageData);

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <GlobalErrorToast />

      {/* Header */}
      <header className="bg-blue-600 dark:bg-blue-900 text-white p-4 shadow-lg transition-colors duration-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button onClick={() => { setPage('browse'); setView('map'); }} className="flex items-center gap-3 hover:opacity-80 transition">
            <MapPin size={32} className="text-yellow-300" />
            <h1 className="text-2xl font-bold">DASH WORLD</h1>
          </button>

          <div className="flex items-center gap-4">
            <button onClick={() => setPage('search')} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg transition">
              <Search size={18} />
              Advanced Search
            </button>

            {currentUser && authToken && (
              <>
                <button onClick={() => setPage('upload')} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg transition">
                  <Upload size={18} />
                  Upload Footage
                </button>
                <button onClick={async () => { setPage('inbox'); await loadConversations(); }} className="relative flex items-center gap-2 bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg transition">
                  <Inbox size={18} />
                  Inbox
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              </>
            )}

            <div className="flex bg-blue-700 rounded-lg overflow-hidden">
              <button onClick={() => { setPage('browse'); setView('map'); }} className={`flex items-center gap-2 px-4 py-2 transition ${page === 'browse' && view === 'map' ? 'bg-blue-800' : 'hover:bg-blue-600'}`}>
                <Map size={18} />
                Map
              </button>
              <button onClick={() => { setPage('browse'); setView('browse'); }} className={`flex items-center gap-2 px-4 py-2 transition ${page === 'browse' && view === 'browse' ? 'bg-blue-800' : 'hover:bg-blue-600'}`}>
                <Grid size={18} />
                Browse
              </button>
            </div>

            <button onClick={() => setDarkMode(prev => !prev)} className="bg-blue-700 hover:bg-blue-800 p-2 rounded-lg transition" title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {currentUser ? (
              <div className="relative">
                <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg transition">
                  <UserCircle size={18} />
                  {currentUser.username}
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl py-2 w-48 z-50 transition-colors duration-200">
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{currentUser.username}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{currentUser.email}</p>
                      {(currentUser.role === 'moderator' || currentUser.role === 'admin') && (
                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-1 capitalize">{currentUser.role}</p>
                      )}
                    </div>
                    <button onClick={() => { setPage('profile'); setShowUserMenu(false); }} className="w-full flex items-center gap-2 px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                      <User size={16} />
                      My Profile
                    </button>
                    <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => setShowAuthModal(true)} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg transition">
                <UserCircle size={18} />
                Sign In / Register
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Modals */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} onAuthSuccess={handleAuthSuccess} />
      <AuthPromptModal isOpen={showAuthPromptModal} onClose={() => { setShowAuthPromptModal(false); setAuthPromptAction(null); }} onSignIn={() => setShowAuthModal(true)} onRegister={() => setShowAuthModal(true)} />
      <ShareModal isOpen={showShareModal && footageToShare !== null} onClose={() => setShowShareModal(false)} footage={footageToShare || { id: 0, lat: 0, lng: 0, location: '', date: '', time: '', type: '', emoji: '', thumbnail: null, description: null, filename: '', duration: null }} showToast={showToast} />
      <ContentWarningModal isOpen={showContentWarningModal} footage={warningFootage} onClose={() => { setShowContentWarningModal(false); setWarningFootage(null); }} onConfirm={handleContentWarningConfirm} />
      <ExistingConversationModal isOpen={showExistingConversationModal} conversation={existingConversationToNavigate} onClose={() => { setShowExistingConversationModal(false); setExistingConversationToNavigate(null); }} onGoToThread={handleGoToExistingThread} />
      <DeleteConfirmModal isOpen={showDeleteConfirmModal} onClose={() => { setShowDeleteConfirmModal(false); setFootageToDelete(null); }} onConfirm={confirmDeleteFootage} />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {page === 'browse' ? (
          <>
            {view === 'map' && (
              <aside className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto transition-colors duration-200 flex flex-col">
                <div className="flex-1 flex flex-col">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">{displayedFootage.length}</span> footage clips {onlyShowVisibleFootage ? 'visible' : 'found'}
                  </p>
                  <div className="mb-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input type="checkbox" checked={onlyShowVisibleFootage} onChange={(e) => setOnlyShowVisibleFootage(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                      <span>Only list footage shown on map</span>
                    </label>
                  </div>
                  <div className="relative flex-1 flex flex-col">
                    <div ref={footageListRef} onScroll={handleFootageListScroll} className="space-y-2 flex-1 overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: darkMode ? '#6b7280 #374151' : '#9ca3af #f3f4f6' }}>
                      {displayedFootage.length === 0 ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">{onlyShowVisibleFootage ? 'No footage in current map area' : 'No footage available'}</p>
                      ) : (
                        displayedFootage.map(footage => (
                          <div key={footage.id} onClick={() => setSelectedPin(footage)} className={`rounded-lg border cursor-pointer transition overflow-hidden ${selectedPin?.id === footage.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>
                            <div className="aspect-video relative bg-gray-800">
                              {footage.thumbnail ? (
                                <>
                                  <ProgressiveImage smallSrc={`${API_CONFIG.SERVER_URL}/uploads/thumbnails/${footage.thumbnail_small || footage.thumbnail}`} mediumSrc={`${API_CONFIG.SERVER_URL}/uploads/thumbnails/${footage.thumbnail_medium || footage.thumbnail}`} alt={footage.type} className="w-full h-full object-cover" shouldBlur={footage.is_graphic_content} />
                                  {footage.duration && <div className="absolute bottom-1 right-1 bg-black/80 text-white px-1.5 py-0.5 rounded text-xs font-semibold">{formatDuration(footage.duration)}</div>}
                                  {footage.is_graphic_content && <div className="absolute top-1 right-1 bg-orange-500 text-white px-1 py-0.5 rounded text-xs font-bold"><AlertTriangle size={10} className="inline" /></div>}
                                </>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center"><Play size={24} className="text-white opacity-70" /></div>
                              )}
                            </div>
                            <div className="p-2">
                              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{formatIncidentType(footage.type)}</h4>
                              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{footage.location}</p>
                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                <span className="flex items-center gap-1"><Calendar size={10} />{footage.date}</span>
                                <span className="flex items-center gap-1"><Clock size={10} />{formatTimeTo12Hour(footage.time)}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {displayedFootage.length > 3 && !isAtScrollBottom && <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white dark:from-gray-800 to-transparent pointer-events-none"></div>}
                  </div>
                </div>
              </aside>
            )}
            <main className="flex-1 relative">
              {view === 'map' ? (
                <MapView leafletLoaded={leafletLoaded} mapRef={mapRef} mapSearchQuery={mapSearchQuery} setMapSearchQuery={setMapSearchQuery} mapSearchTimeoutRef={mapSearchTimeoutRef} searchMapLocation={searchMapLocation} mapLocationSuggestions={mapLocationSuggestions} showMapLocationSuggestions={showMapLocationSuggestions} setShowMapLocationSuggestions={setShowMapLocationSuggestions} handleSelectMapLocation={handleSelectMapLocation} isSearchingMapLocation={isSearchingMapLocation} timeRange={timeRange} setTimeRange={setTimeRange} selectedPin={selectedPin} setSelectedPin={setSelectedPin} setWarningFootage={setWarningFootage} setShowContentWarningModal={setShowContentWarningModal} setPage={setPage} showHeatmap={showHeatmap} setShowHeatmap={setShowHeatmap} mapDarkness={mapDarkness} setMapDarkness={setMapDarkness} />
              ) : (
                <BrowseView footageData={footageData} setSelectedPin={setSelectedPin} setPage={setPage} setWarningFootage={setWarningFootage} setShowContentWarningModal={setShowContentWarningModal} currentUser={currentUser} handleDeleteFootage={handleDeleteFootage} />
              )}
            </main>
          </>
        ) : page === 'search' ? (
          <SearchPage footageData={footageData} onBack={() => setPage('browse')} onSelectFootage={(footage) => { setSelectedPin(footage); setPage('video-detail'); }} onShowContentWarning={(footage) => { setWarningFootage(footage); setShowContentWarningModal(true); }} />
        ) : page === 'upload' ? (
          <UploadPage onBack={() => setPage('browse')} onUploadComplete={loadFootage} onUploadSuccess={async (footageId) => {
            try {
              const allFootage = await api.getAllFootage();
              const uploadedFootage = allFootage.find((f: any) => f.id === footageId);
              if (uploadedFootage) {
                setProcessingFootageId(footageId);
                setProcessingThumbnail(uploadedFootage.thumbnail_medium || uploadedFootage.thumbnail);
                setPage('processing');
              } else {
                setPage('browse');
              }
            } catch (error) {
              setPage('browse');
            }
          }} authToken={authToken} showToast={showToast} />
        ) : page === 'processing' && processingFootageId && processingThumbnail ? (
          <ProcessingPage footageId={processingFootageId} thumbnail={processingThumbnail} onViewVideo={async () => {
            try {
              await loadFootage();
              const allFootage = await api.getAllFootage();
              const footage = allFootage.find((f: any) => f.id === processingFootageId);
              if (footage) {
                const footageItem: FootageItem = {
                  id: footage.id, user_id: footage.user_id, lat: footage.lat, lng: footage.lng, location: footage.location_name, date: footage.incident_date, time: footage.incident_time, type: footage.incident_type, emoji: UI_CONSTANTS.INCIDENT_EMOJIS[footage.id % UI_CONSTANTS.INCIDENT_EMOJIS.length], thumbnail: footage.thumbnail, thumbnail_small: footage.thumbnail_small, thumbnail_medium: footage.thumbnail_medium, thumbnail_large: footage.thumbnail_large, description: footage.description, filename: footage.filename, filename_compressed: footage.filename_compressed, filename_240p: footage.filename_240p, filename_360p: footage.filename_360p, filename_480p: footage.filename_480p, filename_720p: footage.filename_720p, filename_1080p: footage.filename_1080p, duration: footage.duration, is_graphic_content: footage.is_graphic_content || false, content_warnings: footage.content_warnings || null, created_at: footage.created_at
                };
                setSelectedPin(footageItem);
                setPage('video-detail');
              }
            } catch (error) {
              showToast('Failed to load video', 'error');
            }
          }} />
        ) : page === 'video-detail' ? (
          <VideoDetailPage footage={selectedPin} allFootage={footageData} onRequestFootage={handleRequestFootage} onDelete={handleDeleteFootage} onUpdate={async () => { await loadFootage(); if (selectedPin) { const updatedFootage = await api.getFootageById(selectedPin.id); if (updatedFootage) { setSelectedPin({ ...selectedPin, description: updatedFootage.description }); } } }} currentUser={currentUser} authToken={authToken} showToast={showToast} acknowledgedFootageIds={acknowledgedFootageIds} onAcknowledgeWarning={(footageId) => setAcknowledgedFootageIds(prev => new Set(prev).add(footageId))} onShare={(footage) => { setFootageToShare(footage); setShowShareModal(true); }} onSelectNearbyFootage={(footage) => setSelectedPin(footage)} />
        ) : page === 'request-form' ? (
          <RequestFormPage footage={selectedPin} formData={requestFormData} setFormData={setRequestFormData} onBack={() => setPage('video-detail')} onSubmit={handleRequestFormSubmit} />
        ) : page === 'request-sent' ? (
          <RequestSentPage onBack={() => { setPage('browse'); setRequestFormData({ name: '', reason: '', message: '' }); }} />
        ) : page === 'inbox' ? (
          <InboxPage conversations={conversations} onSelectConversation={async (id) => { const conversation = conversations.find(c => c.id === id); if (conversation) { setSelectedConversation(conversation); setPage('conversation'); await loadConversationMessages(id); } }} />
        ) : page === 'conversation' && selectedConversation ? (
          <ConversationPage conversation={selectedConversation} messages={conversationMessages} currentUser={currentUser} onSendMessage={async (messageBody) => await sendMessage(selectedConversation.id, messageBody)} onBack={() => setPage('inbox')} />
        ) : page === 'profile' && currentUser && authToken ? (
          <ProfilePage user={currentUser} authToken={authToken} showToast={showToast} onBack={() => setPage('browse')} onLogout={handleLogout} onProfileUpdate={(updatedUser) => updateUser(updatedUser)} />
        ) : null}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 max-w-md px-6 py-4 rounded-lg shadow-2xl text-white font-semibold z-50 animate-slide-in ${toast.type === 'success' ? 'bg-green-600 shadow-green-200' : toast.type === 'error' ? 'bg-red-600 shadow-red-200' : 'bg-blue-600 shadow-blue-200'}`}>
          <div className="flex items-center gap-3">
            {toast.type === 'success' && <div className="bg-white rounded-full p-1"><Check size={24} className="text-green-600" /></div>}
            {toast.type === 'error' && <AlertCircle size={24} />}
            {toast.type === 'info' && <Info size={24} />}
            <span className="text-base">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashWorld;
