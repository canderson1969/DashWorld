/**
 * Share modal component
 *
 * Allows users to share footage via link, QR code, embed code, or social media.
 * Provides copy-to-clipboard functionality and QR code generation.
 *
 * @module ShareModal
 */

import { useState, useEffect, useMemo, memo } from 'react';
import { Share2, Copy, QrCode, Code, CheckCircle, X, FileText, Video } from 'lucide-react';
import QRCodeLib from 'qrcode';
import type { FootageItem } from '../../types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  footage: FootageItem;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * Share modal component
 *
 * @param {boolean} isOpen - Whether the modal is visible
 * @param {() => void} onClose - Handler for closing the modal
 * @param {FootageItem} footage - The footage to share
 * @param {Function} showToast - Toast notification function
 * @returns {JSX.Element} Share modal with tabs for link, QR code, embed, and social
 */
export const ShareModal = memo(({ isOpen, onClose, footage, showToast }: ShareModalProps) => {
  const [activeTab, setActiveTab] = useState<'link' | 'qr' | 'embed' | 'social'>('link');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState<'link' | 'embed' | null>(null);

  // Memoize URLs to prevent recalculation
  const shareUrl = useMemo(() => `${window.location.origin}/?footage=${footage.id}`, [footage.id]);
  const embedCode = useMemo(() => `<iframe src="${window.location.origin}/embed/${footage.id}" width="640" height="360" frameborder="0" allowfullscreen></iframe>`, [footage.id]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('link');
      setQrCodeUrl('');
      setCopied(null);
    }
  }, [isOpen]);

  // Generate QR code when tab is switched to QR (only once per modal open)
  useEffect(() => {
    if (isOpen && activeTab === 'qr' && !qrCodeUrl) {
      QRCodeLib.toDataURL(shareUrl, { width: 256, margin: 2 })
        .then(setQrCodeUrl)
        .catch(err => console.error('QR code generation failed:', err));
    }
  }, [isOpen, activeTab, shareUrl, qrCodeUrl]);

  /**
   * Copy text to clipboard
   *
   * @param {string} text - Text to copy
   * @param {'link' | 'embed'} type - Type of content being copied
   */
  const copyToClipboard = async (text: string, type: 'link' | 'embed') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      showToast('Copied to clipboard!', 'success');
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  /**
   * Download QR code as image
   */
  const downloadQRCode = () => {
    if (!qrCodeUrl) return;

    const link = document.createElement('a');
    link.download = `dashworld-footage-${footage.id}-qr.png`;
    link.href = qrCodeUrl;
    link.click();
    showToast('QR code downloaded!', 'success');
  };

  /**
   * Share to social media
   *
   * @param {'twitter' | 'facebook' | 'reddit'} platform - Social media platform
   */
  const shareToSocial = (platform: 'twitter' | 'facebook' | 'reddit') => {
    const text = `Check out this dashcam footage: ${footage.type} at ${footage.location}`;
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(text);

    let url = '';
    switch (platform) {
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'reddit':
        url = `https://reddit.com/submit?url=${encodedUrl}&title=${encodedText}`;
        break;
    }

    window.open(url, '_blank', 'width=600,height=400');
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 transition-opacity duration-200 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden transition-transform duration-200 ${isOpen ? 'scale-100' : 'scale-95'}`}>
        {/* Header */}
        <div className="bg-blue-600 dark:bg-blue-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Share2 size={24} className="text-white" />
            <h2 className="text-xl font-bold text-white">Share Footage</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex">
            <button
              onClick={() => setActiveTab('link')}
              className={`flex-1 px-4 py-3 font-medium transition ${
                activeTab === 'link'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Copy size={18} />
                <span>Link</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('qr')}
              className={`flex-1 px-4 py-3 font-medium transition ${
                activeTab === 'qr'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <QrCode size={18} />
                <span>QR Code</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('embed')}
              className={`flex-1 px-4 py-3 font-medium transition ${
                activeTab === 'embed'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Code size={18} />
                <span>Embed</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('social')}
              className={`flex-1 px-4 py-3 font-medium transition ${
                activeTab === 'social'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Share2 size={18} />
                <span>Social</span>
              </div>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Link Tab */}
          {activeTab === 'link' && (
            <div className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Share this link to allow anyone to view this footage:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
                />
                <button
                  onClick={() => copyToClipboard(shareUrl, 'link')}
                  className="px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-semibold flex items-center gap-2"
                >
                  {copied === 'link' ? (
                    <>
                      <CheckCircle size={18} />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={18} />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>Tip:</strong> Anyone with this link can view the footage. The video will open directly when they visit the link.
                </p>
              </div>
            </div>
          )}

          {/* QR Code Tab */}
          {activeTab === 'qr' && (
            <div className="space-y-4 text-center">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Scan this QR code with a mobile device to view the footage:
              </p>
              {qrCodeUrl ? (
                <div className="flex flex-col items-center">
                  <div className="bg-white p-4 rounded-lg shadow-md inline-block">
                    <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
                  </div>
                  <button
                    onClick={downloadQRCode}
                    className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-semibold flex items-center gap-2"
                  >
                    <FileText size={18} />
                    Download QR Code
                  </button>
                </div>
              ) : (
                <div className="py-12 text-gray-500 dark:text-gray-400">
                  Generating QR code...
                </div>
              )}
            </div>
          )}

          {/* Embed Tab */}
          {activeTab === 'embed' && (
            <div className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Embed this footage on your website:
              </p>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Embed Code (copy and paste into your HTML):
                </label>
                <textarea
                  value={embedCode}
                  readOnly
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm resize-none"
                />
                <button
                  onClick={() => copyToClipboard(embedCode, 'embed')}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-semibold flex items-center justify-center gap-2"
                >
                  {copied === 'embed' ? (
                    <>
                      <CheckCircle size={18} />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={18} />
                      Copy Embed Code
                    </>
                  )}
                </button>
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mt-4">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Preview:</p>
                <div className="aspect-video bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <div className="text-center">
                    <Video size={48} className="mx-auto mb-2" />
                    <p className="text-sm">Embedded Player (640x360)</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Social Media Tab */}
          {activeTab === 'social' && (
            <div className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Share this footage on social media:
              </p>
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => shareToSocial('twitter')}
                  className="w-full px-6 py-4 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white rounded-lg transition font-semibold flex items-center justify-center gap-3"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                  Share on Twitter/X
                </button>

                <button
                  onClick={() => shareToSocial('facebook')}
                  className="w-full px-6 py-4 bg-[#4267B2] hover:bg-[#365899] text-white rounded-lg transition font-semibold flex items-center justify-center gap-3"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Share on Facebook
                </button>

                <button
                  onClick={() => shareToSocial('reddit')}
                  className="w-full px-6 py-4 bg-[#FF4500] hover:bg-[#e03d00] text-white rounded-lg transition font-semibold flex items-center justify-center gap-3"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                  </svg>
                  Share on Reddit
                </button>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mt-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  <strong>Note:</strong> Sharing on social media will open a new window. You may need to log in to the respective platform.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
});

ShareModal.displayName = 'ShareModal';
