import React, { useState, FormEvent } from 'react';
import { Modal } from './Modal';
import * as NeuzoApi from '../services/neuzoApi';

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
      await NeuzoApi.addSource(
        categoryId,
        sourceUrl,
        sourceName || new URL(sourceUrl).hostname,
        sourceType as 'web' | 'rss' | 'api',
        reliabilityScore / 100
      );

      onSourceAdded();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add source';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Save a news source"
      subtitle={
        <>
          Add a source to <span className="text-blue-400">{categoryName}</span> for everyone using
          this category.
        </>
      }
      onClose={onClose}
    >
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="source-url" className="block text-sm font-medium text-gray-300 mb-2">
            Source URL *
          </label>
          <input
            id="source-url"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://example.com/news"
            className="input px-4 py-2"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="source-name" className="block text-sm font-medium text-gray-300 mb-2">
            Source name (optional)
          </label>
          <input
            id="source-name"
            type="text"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            placeholder="Auto-detected from URL"
            className="input px-4 py-2"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="source-type" className="block text-sm font-medium text-gray-300 mb-2">
            Source type
          </label>
          <select
            id="source-type"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="input px-4 py-2"
            disabled={loading}
          >
            <option value="web">Web</option>
            <option value="rss">RSS Feed</option>
            <option value="api">API</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="source-reliability"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            Reliability score: {reliabilityScore}%
          </label>
          <input
            id="source-reliability"
            type="range"
            min="0"
            max="100"
            value={reliabilityScore}
            onChange={(e) => setReliabilityScore(Number(e.target.value))}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
            disabled={loading}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Low</span>
            <span>Medium</span>
            <span>High</span>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary flex-1 px-4 py-2"
            disabled={loading}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary flex-1 px-4 py-2" disabled={loading}>
            {loading ? 'Saving…' : 'Save source'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
