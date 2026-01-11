/**
 * Browse view component
 *
 * Displays footage in a grid layout with thumbnails, metadata, and action buttons.
 * Supports filtering, graphic content warnings, and video preview on hover.
 *
 * @module BrowseView
 */

import { Calendar, Clock, Play, AlertTriangle, Trash2 } from 'lucide-react';
import { API_CONFIG } from '../../config/constants';
import { formatTimeTo12Hour, formatDuration, formatIncidentType } from '../../utils/timeFormat';
import { ProgressiveImage } from '../ProgressiveImage';
import type { FootageItem } from '../../types';
import * as api from '../../api';

interface BrowseViewProps {
  footageData: FootageItem[];
  setSelectedPin: (pin: FootageItem | null) => void;
  setPage: (page: 'browse' | 'search' | 'upload' | 'video-detail' | 'request-form' | 'request-sent' | 'inbox' | 'conversation' | 'profile') => void;
  setWarningFootage: (footage: FootageItem) => void;
  setShowContentWarningModal: (show: boolean) => void;
  currentUser: api.User | null;
  handleDeleteFootage: (id: number) => void;
}

/**
 * Browse view component
 *
 * Renders all footage in a responsive grid with previews and actions.
 *
 * @param {BrowseViewProps} props - Component props including footage data and callbacks
 * @returns {JSX.Element} Grid view of all footage
 */
export function BrowseView({
  footageData,
  setSelectedPin,
  setPage,
  setWarningFootage,
  setShowContentWarningModal,
  currentUser,
  handleDeleteFootage
}: BrowseViewProps) {
  return (
    <div className="h-full overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Browse All Footage</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {footageData.map(footage => (
            <div key={footage.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-xl transition">
              <div
                onClick={() => {
                  if (footage.is_graphic_content) {
                    setWarningFootage(footage);
                    setShowContentWarningModal(true);
                  } else {
                    setSelectedPin(footage);
                    setPage('video-detail');
                  }
                }}
                className="bg-gray-800 aspect-video flex items-center justify-center text-white relative overflow-hidden cursor-pointer group"
              >
                {footage.thumbnail ? (
                  <>
                    <ProgressiveImage
                      smallSrc={`${API_CONFIG.SERVER_URL}/uploads/thumbnails/${footage.thumbnail_small || footage.thumbnail}`}
                      mediumSrc={`${API_CONFIG.SERVER_URL}/uploads/thumbnails/${footage.thumbnail_medium || footage.thumbnail}`}
                      largeSrc={footage.thumbnail_large ? `${API_CONFIG.SERVER_URL}/uploads/thumbnails/${footage.thumbnail_large}` : undefined}
                      alt={footage.type}
                      className="w-full h-full object-cover"
                      shouldBlur={footage.is_graphic_content}
                    />
                    {footage.duration && (
                      <div className="absolute bottom-2 right-2 bg-black/80 text-white px-2 py-1 rounded text-xs font-semibold z-10">
                        {formatDuration(footage.duration)}
                      </div>
                    )}
                    {footage.is_graphic_content && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 pointer-events-none">
                        <AlertTriangle size={48} className="text-orange-500" />
                        <div className="text-center px-4">
                          <p className="font-bold text-sm">Graphic Content Warning</p>
                          <p className="text-xs text-gray-300 mt-1">Click to view content warning</p>
                        </div>
                      </div>
                    )}
                    {!footage.is_graphic_content && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/50 transition">
                        <Play size={48} className="text-white" />
                      </div>
                    )}
                    {footage.filename && !footage.is_graphic_content && (
                      <video
                        src={`${API_CONFIG.SERVER_URL}/uploads/${footage.filename}`}
                        className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        muted
                        loop
                        onMouseEnter={(e) => e.currentTarget.play()}
                        onMouseLeave={(e) => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 0;
                        }}
                      />
                    )}
                  </>
                ) : (
                  <Play size={48} className="opacity-70" />
                )}
              </div>
              <div className="p-4">
                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-1">{formatIncidentType(footage.type)}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{footage.location}</p>
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {footage.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {formatTimeTo12Hour(footage.time)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (footage.is_graphic_content) {
                        setWarningFootage(footage);
                        setShowContentWarningModal(true);
                      } else {
                        setSelectedPin(footage);
                        setPage('video-detail');
                      }
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition font-semibold text-sm">
                    {footage.is_graphic_content ? 'View Content Warning' : 'View Details'}
                  </button>
                  {currentUser && (footage.user_id === currentUser.id || currentUser.role === 'moderator' || currentUser.role === 'admin') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFootage(footage.id);
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg transition"
                      title="Delete footage"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
