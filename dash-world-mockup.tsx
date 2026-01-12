import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Calendar, Clock, Search, Grid, Map, Play, Filter, Upload, Info, AlertCircle, Check, ChevronRight, ArrowLeft, X, Mail, User, MessageSquare, Send, FileText } from 'lucide-react';

const UploadPage = ({ onBack }) => {
  const [step, setStep] = useState(1);
  const [videoFile, setVideoFile] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [userTimestamp, setUserTimestamp] = useState({ date: '', time: '' });
  const [incidentType, setIncidentType] = useState('');
  const [description, setDescription] = useState('');
  const [confidence, setConfidence] = useState({ location: 'high', time: 'high' });
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const uploadMapRef = useRef(null);
  const uploadMapInstanceRef = useRef(null);
  const uploadMarkerRef = useRef(null);
  const uploadCircleRef = useRef(null);

  useEffect(() => {
    if (window.L) {
      setLeafletLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (step === 3 && leafletLoaded && uploadMapRef.current && !uploadMapInstanceRef.current) {
      const L = window.L;
      const initialLat = metadata?.location?.lat || 37.7749;
      const initialLng = metadata?.location?.lng || -122.4194;
      
      const map = L.map(uploadMapRef.current).setView([initialLat, initialLng], 15);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      uploadMapInstanceRef.current = map;

      const radius = metadata?.location ? 50 : 200;
      
      const circle = L.circle([initialLat, initialLng], {
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.2,
        radius: radius
      }).addTo(map);
      
      const marker = L.marker([initialLat, initialLng], {
        draggable: true
      }).addTo(map);

      uploadCircleRef.current = circle;
      uploadMarkerRef.current = marker;

      marker.on('dragend', function(e) {
        const pos = e.target.getLatLng();
        setUserLocation({ lat: pos.lat, lng: pos.lng });
        circle.setLatLng([pos.lat, pos.lng]);
        circle.setRadius(100);
        setConfidence(prev => ({ ...prev, location: 'medium' }));
      });

      map.on('click', function(e) {
        marker.setLatLng(e.latlng);
        circle.setLatLng(e.latlng);
        circle.setRadius(100);
        setUserLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
        setConfidence(prev => ({ ...prev, location: 'medium' }));
      });
    }

    return () => {
      if (uploadMapInstanceRef.current) {
        uploadMapInstanceRef.current.remove();
        uploadMapInstanceRef.current = null;
        uploadMarkerRef.current = null;
        uploadCircleRef.current = null;
      }
    };
  }, [step, leafletLoaded, metadata]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      
      setTimeout(() => {
        const hasGPS = Math.random() > 0.3;
        const hasCorrectTime = Math.random() > 0.2;
        
        const now = new Date();
        let videoDate = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
        
        if (!hasCorrectTime) {
          if (Math.random() > 0.5) {
            videoDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
          } else {
            videoDate = new Date('2010-01-01');
          }
        }
        
        setMetadata({
          location: hasGPS ? {
            lat: 37.7749 + (Math.random() - 0.5) * 0.1,
            lng: -122.4194 + (Math.random() - 0.5) * 0.1,
            source: 'gps'
          } : null,
          timestamp: videoDate,
          hasGPS,
          hasCorrectTime,
          duration: 125,
          resolution: '1920x1080'
        });
        
        setUserTimestamp({
          date: videoDate.toISOString().split('T')[0],
          time: videoDate.toTimeString().slice(0, 5)
        });
        
        setConfidence({
          location: hasGPS ? 'high' : 'none',
          time: hasCorrectTime ? 'high' : 'low'
        });
        
        setStep(2);
      }, 1500);
    }
  };

  const getConfidenceColor = (level) => {
    switch(level) {
      case 'high': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-orange-500';
      case 'none': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getConfidenceRadius = () => {
    switch(confidence.location) {
      case 'high': return '~50m';
      case 'medium': return '~100m';
      case 'low': return '~200m';
      case 'none': return 'Unknown';
      default: return '';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      {/* Back Button */}
      <div className="bg-white border-b border-gray-200 p-4">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition"
        >
          <ArrowLeft size={20} />
          Back to Browse
        </button>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                {step > 1 ? <Check size={16} /> : '1'}
              </div>
              <span className="font-medium text-sm">Upload</span>
            </div>
            <ChevronRight className="text-gray-400" size={16} />
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                {step > 2 ? <Check size={16} /> : '2'}
              </div>
              <span className="font-medium text-sm">Time</span>
            </div>
            <ChevronRight className="text-gray-400" size={16} />
            <div className={`flex items-center gap-2 ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                {step > 3 ? <Check size={16} /> : '3'}
              </div>
              <span className="font-medium text-sm">Location</span>
            </div>
            <ChevronRight className="text-gray-400" size={16} />
            <div className={`flex items-center gap-2 ${step >= 4 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 4 ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                {step > 4 ? <Check size={16} /> : '4'}
              </div>
              <span className="font-medium text-sm">Details</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {step === 1 && (
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Upload Your Dashcam Footage</h2>
            <p className="text-gray-600 mb-6">
              Help others by sharing footage of incidents you've captured.
            </p>

            {!videoFile ? (
              <label className="border-2 border-dashed border-gray-300 rounded-lg p-12 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition">
                <Upload className="text-gray-400 mb-4" size={64} />
                <span className="text-gray-700 text-lg mb-2 font-medium">Click to upload video</span>
                <span className="text-gray-500 text-sm">MP4, MOV, AVI, or other formats</span>
                <input 
                  type="file" 
                  accept="video/*" 
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
                </div>
                <p className="text-center text-gray-600">Analyzing video metadata...</p>
              </div>
            )}
          </div>
        )}

        {step === 2 && metadata && (
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Verify Timestamp</h2>
            
            <div className={`border rounded-lg p-4 mb-6 ${!metadata.hasCorrectTime ? 'border-orange-300 bg-orange-50' : 'border-green-300 bg-green-50'}`}>
              <div className="flex items-start gap-3">
                {metadata.hasCorrectTime ? (
                  <Check className="text-green-600 flex-shrink-0 mt-1" size={20} />
                ) : (
                  <AlertCircle className="text-orange-600 flex-shrink-0 mt-1" size={20} />
                )}
                <div className="flex-1">
                  <h3 className={`font-semibold mb-2 ${metadata.hasCorrectTime ? 'text-green-800' : 'text-orange-800'}`}>
                    {metadata.hasCorrectTime ? 'Timestamp looks good!' : 'Timestamp may be incorrect'}
                  </h3>
                  <p className={`text-sm ${metadata.hasCorrectTime ? 'text-green-700' : 'text-orange-700'}`}>
                    {metadata.hasCorrectTime 
                      ? 'The timestamp from your video appears accurate.'
                      : 'Please correct the timestamp below.'}
                  </p>
                  <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Video file timestamp:</p>
                    <p className="font-mono text-sm text-gray-800">{metadata.timestamp.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                When did this incident occur?
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                    <Calendar size={14} />
                    Date
                  </label>
                  <input 
                    type="date"
                    value={userTimestamp.date}
                    onChange={(e) => {
                      setUserTimestamp(prev => ({ ...prev, date: e.target.value }));
                      setConfidence(prev => ({ ...prev, time: 'high' }));
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                    <Clock size={14} />
                    Time
                  </label>
                  <input 
                    type="time"
                    value={userTimestamp.time}
                    onChange={(e) => {
                      setUserTimestamp(prev => ({ ...prev, time: e.target.value }));
                      setConfidence(prev => ({ ...prev, time: 'high' }));
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={() => setStep(3)}
              disabled={!userTimestamp.date || !userTimestamp.time}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-lg transition font-semibold"
            >
              Continue to Location
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Set Incident Location</h2>
            
            <div className={`border rounded-lg p-4 mb-6 ${metadata?.location ? 'border-blue-300 bg-blue-50' : 'border-yellow-300 bg-yellow-50'}`}>
              <div className="flex items-start gap-3">
                <Info className={`${metadata?.location ? 'text-blue-600' : 'text-yellow-600'} flex-shrink-0 mt-1`} size={20} />
                <div>
                  <h3 className={`font-semibold mb-1 ${metadata?.location ? 'text-blue-800' : 'text-yellow-800'}`}>
                    {metadata?.location ? 'GPS data found' : 'No GPS data'}
                  </h3>
                  <p className={`text-sm ${metadata?.location ? 'text-blue-700' : 'text-yellow-700'}`}>
                    {metadata?.location 
                      ? 'Drag the pin or click to adjust location.'
                      : 'Click on the map where the incident occurred.'}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="text-gray-600">Accuracy:</span>
                    <span className={`font-semibold ${getConfidenceColor(confidence.location)}`}>
                      {confidence.location.toUpperCase()} ({getConfidenceRadius()})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <div className="h-96 rounded-lg overflow-hidden border border-gray-300">
                <div ref={uploadMapRef} className="h-full w-full"></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                <Info size={12} className="inline mr-1" />
                The blue circle shows the uncertainty radius.
              </p>
            </div>

            <button 
              onClick={() => setStep(4)}
              disabled={!userLocation && !metadata?.location}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-lg transition font-semibold"
            >
              Continue to Details
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Additional Details</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Incident Type</label>
                <select 
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select type...</option>
                  <option value="collision">Collision</option>
                  <option value="near_miss">Near Miss</option>
                  <option value="rear_end">Rear End</option>
                  <option value="side_swipe">Side Swipe</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description (Optional)</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of what happened"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setStep(3)}
                  className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 py-3 rounded-lg transition font-semibold"
                >
                  Back
                </button>
                <button 
                  onClick={() => {
                    alert('Upload complete!');
                    onBack();
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg transition font-semibold"
                >
                  Upload to Dash World
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const VideoDetailPage = ({ footage, onBack, onRequestFootage }) => {
  if (!footage) return null;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-4">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition"
        >
          <ArrowLeft size={20} />
          Back to Browse
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gray-900 aspect-video flex items-center justify-center relative">
            <Play size={64} className="text-white opacity-70" />
            <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded text-sm">
              License Plates Blurred
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">{footage.type}</h2>
                <p className="text-gray-600">{footage.location}</p>
              </div>
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                {footage.type}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-gray-200">
              <div className="flex items-start gap-2">
                <MapPin size={18} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Location</p>
                  <p className="text-sm font-medium text-gray-800">{footage.location}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar size={18} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Date</p>
                  <p className="text-sm font-medium text-gray-800">{footage.date}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock size={18} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Time</p>
                  <p className="text-sm font-medium text-gray-800">{footage.time}</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1">Need Unblurred Footage?</h3>
                  <p className="text-sm text-blue-800 mb-3">
                    If you were involved in this incident and need the original footage with visible license plates for insurance or legal purposes, you can request it from the uploader.
                  </p>
                  <p className="text-xs text-blue-700">
                    You can make up to 5 requests per month. The uploader will review your request and decide whether to share the unblurred version.
                  </p>
                </div>
              </div>
            </div>

            <button 
              onClick={onRequestFootage}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-lg transition font-semibold text-lg flex items-center justify-center gap-2"
            >
              <FileText size={20} />
              Request Unblurred Footage
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const RequestFormPage = ({ footage, formData, setFormData, onBack, onSubmit }) => {
  if (!footage) return null;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-4">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition"
        >
          <ArrowLeft size={20} />
          Back to Video
        </button>
      </div>

      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Request Unblurred Footage</h2>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              <strong>Requesting for:</strong> {footage.type} at {footage.location} on {footage.date} at {footage.time}
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <User size={16} />
                Your Name *
              </label>
              <input 
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="John Smith"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Mail size={16} />
                Your Email *
              </label>
              <input 
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="john.smith@email.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">The uploader will use this to send you the footage</p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <AlertCircle size={16} />
                Reason for Request *
              </label>
              <select 
                value={formData.reason}
                onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a reason...</option>
                <option value="involved">I was involved in this accident</option>
                <option value="witness">I witnessed this accident</option>
                <option value="representative">I represent someone involved (legal/insurance)</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <MessageSquare size={16} />
                Message to Uploader (Optional)
              </label>
              <textarea 
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Provide any additional context, such as your vehicle description..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Adding details like your vehicle description can help the uploader verify your request
              </p>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={onBack}
                className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 py-3 rounded-lg transition font-semibold"
              >
                Cancel
              </button>
              <button 
                onClick={onSubmit}
                disabled={!formData.name || !formData.email || !formData.reason}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-lg transition font-semibold flex items-center justify-center gap-2"
              >
                <Send size={18} />
                Send Request
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const RequestSentPage = ({ formData, onBack }) => {
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-2xl mx-auto p-6 py-12">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Request Sent!</h2>
          <p className="text-gray-600 mb-6">
            Your request has been sent to the uploader. They will review it and respond via email if they choose to share the unblurred footage.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-left mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">What happens next?</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">1.</span>
                <span>The uploader will receive an email notification with your request details</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">2.</span>
                <span>They'll review your information and decide whether to share the footage</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">3.</span>
                <span>If approved, you'll receive a download link via email at: <strong>{formData.email}</strong></span>
              </li>
            </ul>
          </div>
          <button 
            onClick={onBack}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition font-semibold"
          >
            Back to Browse
          </button>
        </div>
      </div>
    </div>
  );
};

const DashWorld = () => {
  const [view, setView] = useState('map');
  const [page, setPage] = useState('browse'); // 'browse', 'upload', 'video-detail', 'request-form', 'request-sent'
  const [selectedPin, setSelectedPin] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [requestFormData, setRequestFormData] = useState({
    name: '',
    email: '',
    reason: '',
    message: ''
  });
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  // Sample footage data
  const footageData = [
    { id: 1, lat: 37.7749, lng: -122.4194, location: "Market St & 5th St, SF", date: "2024-12-15", time: "14:32", type: "Collision", thumbnail: "🚗" },
    { id: 2, lat: 37.7849, lng: -122.4094, location: "Van Ness Ave, SF", date: "2024-12-20", time: "09:15", type: "Near Miss", thumbnail: "🚙" },
    { id: 3, lat: 37.7649, lng: -122.4294, location: "Mission St, SF", date: "2024-12-28", time: "17:45", type: "Rear End", thumbnail: "🚕" },
    { id: 4, lat: 37.7949, lng: -122.3994, location: "Lombard St, SF", date: "2024-12-10", time: "11:20", type: "Side Swipe", thumbnail: "🚐" },
  ];

  // Load Leaflet library
  useEffect(() => {
    if (window.L) {
      setLeafletLoaded(true);
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
    script.onload = () => setLeafletLoaded(true);
    document.body.appendChild(script);

    return () => {
      if (document.head.contains(link)) document.head.removeChild(link);
      if (document.body.contains(script)) document.body.removeChild(script);
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (view === 'map' && leafletLoaded && mapRef.current && !mapInstanceRef.current) {
      const L = window.L;
      const map = L.map(mapRef.current).setView([37.7749, -122.4194], 13);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;

      // Add markers
      footageData.forEach(footage => {
        const customIcon = L.divIcon({
          className: 'custom-marker',
          html: `
            <div style="position: relative; cursor: pointer;">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="${selectedPin?.id === footage.id ? '#ef4444' : '#2563eb'}" stroke="white" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              </svg>
              <div style="position: absolute; top: 8px; left: 50%; transform: translateX(-50%); font-size: 16px;">
                ${footage.thumbnail}
              </div>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 40],
          popupAnchor: [0, -40]
        });

        const marker = L.marker([footage.lat, footage.lng], { icon: customIcon })
          .addTo(map)
          .on('click', () => setSelectedPin(footage));

        markersRef.current.push({ marker, footage });
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current = [];
      }
    };
  }, [view, leafletLoaded]);

  // Update marker colors when selection changes
  useEffect(() => {
    if (mapInstanceRef.current && window.L) {
      markersRef.current.forEach(({ marker, footage }) => {
        const customIcon = window.L.divIcon({
          className: 'custom-marker',
          html: `
            <div style="position: relative; cursor: pointer; transition: transform 0.2s;">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="${selectedPin?.id === footage.id ? '#ef4444' : '#2563eb'}" stroke="white" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              </svg>
              <div style="position: absolute; top: 8px; left: 50%; transform: translateX(-50%); font-size: 16px;">
                ${footage.thumbnail}
              </div>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 40],
          popupAnchor: [0, -40]
        });
        marker.setIcon(customIcon);
      });
    }
  }, [selectedPin]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin size={32} className="text-yellow-300" />
            <h1 className="text-2xl font-bold">DASH WORLD</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setPage('upload')}
              className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg transition">
              <Play size={18} />
              Upload Footage
            </button>
            {page === 'browse' && (
              <div className="flex bg-blue-700 rounded-lg overflow-hidden">
                <button 
                  onClick={() => setView('map')}
                  className={`flex items-center gap-2 px-4 py-2 transition ${view === 'map' ? 'bg-blue-800' : 'hover:bg-blue-600'}`}
                >
                  <Map size={18} />
                  Map
                </button>
                <button 
                  onClick={() => setView('browse')}
                  className={`flex items-center gap-2 px-4 py-2 transition ${view === 'browse' ? 'bg-blue-800' : 'hover:bg-blue-600'}`}
                >
                  <Grid size={18} />
                  Browse
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {page === 'browse' ? (
          <>
            {/* Sidebar Filters */}
            <aside className="w-80 bg-white border-r border-gray-200 p-4 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Search size={16} />
                Search Location
              </label>
              <input 
                type="text"
                placeholder="Enter address or intersection..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Calendar size={16} />
                Date Range
              </label>
              <div className="space-y-2">
                <input 
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input 
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Clock size={16} />
                Time of Day
              </label>
              <input 
                type="time"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Filter size={16} />
                Incident Type
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>All Types</option>
                <option>Collision</option>
                <option>Near Miss</option>
                <option>Rear End</option>
                <option>Side Swipe</option>
              </select>
            </div>

            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition font-semibold">
              Apply Filters
            </button>

            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-blue-600">{footageData.length}</span> footage clips found
              </p>
            </div>
          </div>
        </aside>

        {/* Main View Area */}
        <main className="flex-1 relative">
          {view === 'map' ? (
            <div className="h-full relative">
              {/* Loading state */}
              {!leafletLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="text-gray-600">Loading map...</div>
                </div>
              )}
              
              {/* OpenStreetMap Container */}
              <div ref={mapRef} className="absolute inset-0 z-0"></div>

              {/* Selected Pin Info */}
              {selectedPin && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-2xl p-6 w-96 z-10">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-lg text-gray-800">{selectedPin.type}</h3>
                      <p className="text-sm text-gray-600">{selectedPin.location}</p>
                    </div>
                    <button onClick={() => setSelectedPin(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Calendar size={14} />
                      <span>{selectedPin.date}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Clock size={14} />
                      <span>{selectedPin.time}</span>
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-lg aspect-video flex items-center justify-center text-white text-sm mb-3">
                    <Play size={48} className="opacity-70" />
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setPage('video-detail');
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition font-semibold">
                      View Footage
                    </button>
                    <button className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 py-2 rounded-lg transition font-semibold">
                      Contact Uploader
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-6">
              <div className="max-w-7xl mx-auto">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Browse All Footage</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {footageData.map(footage => (
                    <div key={footage.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition">
                      <div className="bg-gray-800 aspect-video flex items-center justify-center text-white">
                        <Play size={48} className="opacity-70" />
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold text-lg text-gray-800 mb-1">{footage.type}</h3>
                        <p className="text-sm text-gray-600 mb-3">{footage.location}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {footage.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {footage.time}
                          </span>
                        </div>
                        <button 
                          onClick={() => {
                            setSelectedPin(footage);
                            setPage('video-detail');
                          }}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition font-semibold text-sm">
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
          </>
        ) : page === 'upload' ? (
          <UploadPage onBack={() => setPage('browse')} />
        ) : page === 'video-detail' ? (
          <VideoDetailPage 
            footage={selectedPin} 
            onBack={() => setPage('browse')}
            onRequestFootage={() => setPage('request-form')}
          />
        ) : page === 'request-form' ? (
          <RequestFormPage
            footage={selectedPin}
            formData={requestFormData}
            setFormData={setRequestFormData}
            onBack={() => setPage('video-detail')}
            onSubmit={() => setPage('request-sent')}
          />
        ) : page === 'request-sent' ? (
          <RequestSentPage
            formData={requestFormData}
            onBack={() => {
              setPage('browse');
              setRequestFormData({ name: '', email: '', reason: '', message: '' });
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

export default DashWorld;