import React, { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import { AppState } from './types';
import type { Job, Category, User, NewsEngine } from './types';
import { CATEGORIES, PROCESSING_STEPS, defaultNewCategoryIcon, ICON_MAP } from './constants';
import * as NeuzoApi from './services/neuzoApi';
import { CategoryCard } from './components/CategoryCard';
import { ProcessingStatus } from './components/ProcessingStatus';
import { ResultScreen } from './components/ResultScreen';
import { ReportView } from './components/ReportView';
import { AddSourceModal } from './components/AddSourceModal';
import { JobHistory } from './components/JobHistory';
import { AuthScreen } from './components/AuthScreen';
import {
  BotIcon,
  XCircleIcon,
  PlusCircleIcon,
  NewspaperIcon,
  ClockIcon,
  SpinnerIcon,
} from './components/icons';

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.AUTH);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>(CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [sources, setSources] = useState<string[]>([]);
  const [newSourceUrl, setNewSourceUrl] = useState<string>('');
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);

  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addCategoryError, setAddCategoryError] = useState<string | null>(null);
  const [addCategoryLoading, setAddCategoryLoading] = useState(false);

  const [selectedEngine, setSelectedEngine] = useState<NewsEngine>('auto');

  // Polling failure counter ref (reset on success, tolerate up to 3 failures)
  const pollFailureCount = useRef(0);

  const mapApiCategories = useCallback(
    (apiCats: { id: number; category_id: string; name: string; icon_name: string; is_custom: boolean; defaultSources: string[] }[]): Category[] => {
      return apiCats.map((c) => ({
        id: c.category_id,
        name: c.name,
        icon: ICON_MAP[c.icon_name] ?? NewspaperIcon,
        defaultSources: c.defaultSources ?? [],
        isCustom: c.is_custom,
      }));
    },
    []
  );

  const loadCategories = useCallback(async (): Promise<Category[]> => {
    try {
      const apiCats = await NeuzoApi.getCategories();
      const mapped = mapApiCategories(apiCats);
      setCategories(mapped);
      return mapped;
    } catch {
      setCategories(CATEGORIES);
      return CATEGORIES;
    }
  }, [mapApiCategories]);

  // Session restore on mount
  useEffect(() => {
    const token = localStorage.getItem('neuzo_auth_token');
    if (!token) {
      setIsRestoringSession(false);
      return;
    }

    NeuzoApi.getCurrentUser()
      .then((u) => {
        setUser(u);
        setAppState(AppState.SELECTION);
        return loadCategories();
      })
      .catch(() => {
        // Token is invalid; stay at AUTH
        NeuzoApi.clearAuthToken();
      })
      .finally(() => {
        setIsRestoringSession(false);
      });
  }, [loadCategories]);

  const getCategoryName = (id: string | null) => {
    if (!id) return '';
    return categories.find((c) => c.id === id)?.name || 'Selected Category';
  };

  const handleCategorySelect = (categoryId: string) => {
    if (selectedCategory === categoryId) return;
    setSelectedCategory(categoryId);
    const category = categories.find((c) => c.id === categoryId);
    setSources(category?.defaultSources || []);
    setNewSourceUrl('');
  };

  const handleAddSource = (e: FormEvent) => {
    e.preventDefault();
    if (newSourceUrl && !sources.includes(newSourceUrl)) {
      try {
        new URL(newSourceUrl);
        setSources([...sources, newSourceUrl]);
        setNewSourceUrl('');
      } catch {
        // Invalid URL — ignore silently (UI disables submit anyway)
      }
    }
  };

  const handleAddSourceToDatabase = () => {
    setIsAddSourceModalOpen(true);
  };

  const handleSourceAdded = async () => {
    const updated = await loadCategories();
    if (selectedCategory) {
      const category = updated.find((c) => c.id === selectedCategory);
      if (category) {
        setSources(category.defaultSources ?? []);
      }
    }
  };

  const handleRemoveSource = (sourceToRemove: string) => {
    setSources(sources.filter((source) => source !== sourceToRemove));
  };

  const handleGenerateReport = async () => {
    if (!selectedCategory || sources.length === 0) return;
    setAppState(AppState.PROCESSING);

    try {
      const initialJob = await NeuzoApi.startJob(selectedCategory, sources, selectedEngine);
      setJob(initialJob);
      setCurrentStep(PROCESSING_STEPS(getCategoryName(selectedCategory))[0]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to start job';
      if (!msg.includes('Session expired')) {
        setErrorMessage(msg);
        setAppState(AppState.ERROR);
      }
    }
  };

  const resetWorkspace = () => {
    setSelectedCategory(null);
    setJob(null);
    setCurrentStep('');
    setErrorMessage(null);
    setSources([]);
    pollFailureCount.current = 0;
  };

  const handleReset = () => {
    resetWorkspace();
    setAppState(AppState.SELECTION);
  };

  const handleAuthSuccess = (u: User) => {
    setUser(u);
    setAppState(AppState.SELECTION);
    loadCategories();
  };

  const handleLogout = async () => {
    try {
      await NeuzoApi.logout();
    } catch {
      // Clear local state regardless
      NeuzoApi.clearAuthToken();
    }
    resetWorkspace();
    setUser(null);
    setCategories(CATEGORIES);
    setAppState(AppState.AUTH);
  };

  const openAddCategoryModal = () => {
    setAddCategoryError(null);
    setNewCategoryName('');
    setIsAddCategoryModalOpen(true);
  };

  const handleAddCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setAddCategoryError(null);
    setAddCategoryLoading(true);

    const slug = newCategoryName.trim().toLowerCase().replace(/\s+/g, '_');
    try {
      await NeuzoApi.createCategory(slug, newCategoryName.trim());
      await loadCategories();
      setIsAddCategoryModalOpen(false);
      setNewCategoryName('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add category';
      setAddCategoryError(msg);
    } finally {
      setAddCategoryLoading(false);
    }
  };

  const pollJobStatus = useCallback(async () => {
    if (!job || !job.jobId) return;

    try {
      const updatedJob = await NeuzoApi.getJobStatus(job.jobId);
      pollFailureCount.current = 0;
      setJob(updatedJob);

      if (updatedJob.status === 'Processing' && updatedJob.step) {
        setCurrentStep(updatedJob.step);
      } else if (updatedJob.status === 'Complete') {
        setAppState(AppState.REPORT_VIEW);
      } else if (updatedJob.status === 'Error') {
        setErrorMessage(updatedJob.message || 'An unknown error occurred.');
        setAppState(AppState.ERROR);
      }
    } catch {
      pollFailureCount.current += 1;
      if (pollFailureCount.current >= 3) {
        setErrorMessage('Failed to communicate with the service.');
        setAppState(AppState.ERROR);
      }
    }
  }, [job?.jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (appState === AppState.PROCESSING && job?.jobId) {
      pollFailureCount.current = 0;
      const intervalId = setInterval(pollJobStatus, 2500);
      return () => clearInterval(intervalId);
    }
  }, [appState, job?.jobId, pollJobStatus]);

  const engineOptions: { value: NewsEngine; label: string }[] = [
    { value: 'auto', label: 'Auto' },
    { value: 'newsapi', label: 'NewsAPI' },
    { value: 'crawler', label: 'Local AI' },
  ];

  const renderContent = () => {
    const content = () => {
      switch (appState) {
        case AppState.AUTH:
          return <AuthScreen onAuthSuccess={handleAuthSuccess} />;

        case AppState.PROCESSING:
          return (
            <div className="w-full">
              <ProcessingStatus
                steps={PROCESSING_STEPS(getCategoryName(selectedCategory))}
                currentStep={currentStep}
                categoryName={getCategoryName(selectedCategory)}
                partialReportContent={job?.partialReportContent}
              />
              <div className="mt-8 text-center">
                <button
                  onClick={handleReset}
                  className="px-6 py-2 bg-white/10 text-gray-200 font-semibold rounded-lg hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-white/50"
                >
                  Cancel
                </button>
              </div>
            </div>
          );

        case AppState.REPORT_VIEW:
          return job ? <ReportView job={job} onReset={handleReset} /> : null;

        case AppState.ERROR:
          return (
            <ResultScreen
              categoryName={getCategoryName(selectedCategory)}
              errorMessage={errorMessage}
              onReset={handleReset}
            />
          );

        case AppState.JOB_HISTORY:
          return (
            <JobHistory
              onBack={() => setAppState(AppState.SELECTION)}
              onDownload={(jobId, reportName) => NeuzoApi.downloadReportFile(jobId, reportName)}
            />
          );

        case AppState.SELECTION:
        default:
          return (
            <div className="w-full max-w-5xl text-center">
              <h1 className="text-4xl md:text-5xl font-extrabold text-white">
                Neuzo: Your Agentic News Bot
              </h1>
              <p className="mt-4 text-lg text-gray-300 max-w-2xl mx-auto">
                Select a category to begin. Neuzo will fetch, verify, and synthesise all news from
                the past hour.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 my-10">
                {categories.map((cat) => (
                  <CategoryCard
                    key={cat.id}
                    category={cat}
                    isSelected={selectedCategory === cat.id}
                    onClick={handleCategorySelect}
                  />
                ))}
                <div
                  onClick={openAddCategoryModal}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openAddCategoryModal();
                    }
                  }}
                  className="flex flex-col items-center justify-center p-6 bg-white/5 backdrop-blur-md rounded-xl cursor-pointer transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:shadow-2xl hover:bg-white/10 border-2 border-dashed border-white/20"
                  role="button"
                  tabIndex={0}
                >
                  <PlusCircleIcon className="h-10 w-10 mb-4 text-gray-400" />
                  <span className="text-lg font-semibold text-gray-300 text-center">
                    Add Category
                  </span>
                </div>
              </div>

              <div className="bg-black/20 backdrop-blur-lg border border-white/10 p-6 rounded-xl my-8 shadow-lg text-left">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">News Pool Sources</h3>
                  {selectedCategory && (
                    <button
                      onClick={handleAddSourceToDatabase}
                      className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      <PlusCircleIcon className="h-4 w-4" />
                      Add to Database
                    </button>
                  )}
                </div>
                {selectedCategory ? (
                  <>
                    <form onSubmit={handleAddSource} className="flex flex-col sm:flex-row gap-2 mb-4">
                      <input
                        type="url"
                        value={newSourceUrl}
                        onChange={(e) => setNewSourceUrl(e.target.value)}
                        placeholder="https://your-news-source.com"
                        className="flex-grow p-2 border border-white/20 bg-white/5 rounded-md text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-500 disabled:bg-gray-600/50 transition-colors"
                        disabled={!newSourceUrl}
                      >
                        Add Source
                      </button>
                    </form>
                    <div className="flex flex-wrap gap-2">
                      {sources.map((source) => (
                        <div
                          key={source}
                          className="flex items-center justify-between bg-white/10 text-blue-300 text-sm font-medium pl-3 pr-2 py-1 rounded-full"
                        >
                          <span className="truncate max-w-xs">{source}</span>
                          <button
                            onClick={() => handleRemoveSource(source)}
                            className="ml-2 text-blue-400 hover:text-white"
                            aria-label={`Remove ${source}`}
                          >
                            <XCircleIcon className="h-5 w-5" />
                          </button>
                        </div>
                      ))}
                      {sources.length === 0 && (
                        <p className="text-gray-400 text-sm">
                          No sources defined. Add one above to generate a report.
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-gray-400">Select a category above to see default sources.</p>
                )}
              </div>

              {/* News engine picker */}
              <div className="flex flex-col items-center gap-2 mb-6">
                <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
                  <span className="text-sm text-gray-400 px-2">News engine:</span>
                  {engineOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedEngine(opt.value)}
                      className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        selectedEngine === opt.value
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  Auto uses NewsAPI and falls back to the on-device crawler.
                </p>
              </div>

              <button
                onClick={handleGenerateReport}
                disabled={!selectedCategory || sources.length === 0}
                className="w-full md:w-auto px-12 py-4 bg-blue-600 text-white font-bold text-lg rounded-lg shadow-lg hover:bg-blue-500 disabled:bg-gray-600/50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 disabled:transform-none flex items-center justify-center gap-3"
              >
                <BotIcon className="h-6 w-6" />
                Generate Report
              </button>
            </div>
          );
      }
    };
    return (
      <div className="animate-fade-in w-full flex items-center justify-center">{content()}</div>
    );
  };

  if (isRestoringSession) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <SpinnerIcon className="h-10 w-10 text-blue-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-4 font-sans text-gray-200">
      <header className="fixed top-0 left-0 right-0 p-4 bg-black/20 backdrop-blur-md shadow-lg z-10 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <BotIcon className="h-8 w-8 text-blue-400 mr-3" />
            <span className="text-2xl font-bold text-white tracking-wider">Neuzo</span>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAppState(AppState.JOB_HISTORY)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="View report history"
              >
                <ClockIcon className="h-4 w-4" />
                <span>History</span>
              </button>
              <span className="hidden sm:block text-sm text-gray-400">{user.email}</span>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="flex flex-col items-center justify-center w-full pt-24 pb-12">
        {renderContent()}
      </main>

      {/* Add Category Modal */}
      {isAddCategoryModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
          onClick={() => setIsAddCategoryModalOpen(false)}
        >
          <div
            className="bg-black/50 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-white mb-4">Add New Category</h2>
            {addCategoryError && (
              <p className="mb-3 text-sm text-red-400">{addCategoryError}</p>
            )}
            <form onSubmit={handleAddCategory}>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., Artificial Intelligence"
                className="w-full p-3 mb-4 border border-white/20 bg-white/5 rounded-md text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
              />
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setIsAddCategoryModalOpen(false)}
                  className="px-6 py-2 bg-white/10 text-gray-200 font-semibold rounded-lg hover:bg-white/20"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 disabled:bg-gray-600/50"
                  disabled={!newCategoryName.trim() || addCategoryLoading}
                >
                  {addCategoryLoading ? 'Adding...' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Source Modal */}
      {isAddSourceModalOpen && selectedCategory && (
        <AddSourceModal
          categoryId={selectedCategory}
          categoryName={getCategoryName(selectedCategory)}
          onClose={() => setIsAddSourceModalOpen(false)}
          onSourceAdded={handleSourceAdded}
        />
      )}
    </div>
  );
}

export default App;
