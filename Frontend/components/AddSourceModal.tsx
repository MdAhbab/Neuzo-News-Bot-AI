import React, { useState, FormEvent } from 'react';
import { XMarkIcon } from './icons';

interface AddSourceModalProps {
  categoryId: string;
  categoryName: string;
  onClose: () => void;
  onSourceAdded: () => void;
}

export const AddSourceModal: React.FC<AddSourceModalProps> = ({
  categoryId,
  categoryName,
  onClose,
  onSourceAdded,
}) => {
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [sourceType, setSourceType] = useState('web');
  const [reliabilityScore, setReliabilityScore] = useState(80);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!sourceUrl.trim()) {
      setError('Source URL is required');
      return;
    }

    // Validate URL format
    try {
      new URL(sourceUrl);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(
        `${API_BASE_URL}/api/sources/${categoryId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            source_url: sourceUrl,
            source_name: sourceName || new URL(sourceUrl).hostname,
            source_type: sourceType,
            reliability_score: reliabilityScore / 100,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add source');
      }

      // Success
      onSourceAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add source');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          aria-label="Close modal"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Add News Source</h2>
          <p className="text-gray-400 text-sm">
            Add a new news source to <span className="text-cyan-400">{categoryName}</span>
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Source URL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Source URL *
            </label>
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://example.com/news"
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          {/* Source Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Source Name (optional)
            </label>
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="Auto-detected from URL"
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          {/* Source Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Source Type
            </label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              disabled={loading}
              aria-label="Source type"
            >
              <option value="web">Web</option>
              <option value="rss">RSS Feed</option>
              <option value="api">API</option>
            </select>
          </div>

          {/* Reliability Score */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Reliability Score: {reliabilityScore}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={reliabilityScore}
              onChange={(e) => setReliabilityScore(Number(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              disabled={loading}
              aria-label="Reliability score"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Source'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
