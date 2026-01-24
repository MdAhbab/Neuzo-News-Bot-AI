import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { AppState } from './types';
import type { Job, Category } from './types';
import { CATEGORIES, PROCESSING_STEPS, defaultNewCategoryIcon } from './constants';
import * as NeuzoApi from './services/neuzoApi';
import { CategoryCard } from './components/CategoryCard';
import { ProcessingStatus } from './components/ProcessingStatus';
import { ResultScreen } from './components/ResultScreen';
import { ReportView } from './components/ReportView';
import { AddSourceModal } from './components/AddSourceModal';
import { BotIcon, XCircleIcon, PlusCircleIcon, NewspaperIcon } from './components/icons';
import { AuthScreen } from './components/AuthScreen';

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.AUTH);
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

  const getCategoryName = (id: string | null) => {
    if (!id) return '';
    return categories.find(c => c.id === id)?.name || 'Selected Category';
  };

  const handleCategorySelect = (categoryId: string) => {
    if (selectedCategory === categoryId) return;

    setSelectedCategory(categoryId);
    const category = categories.find(c => c.id === categoryId);
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
      } catch (_) {
        alert('Please enter a valid URL.');
      }
    }
  };

  const handleAddSourceToDatabase = () => {
    setIsAddSourceModalOpen(true);
  };

  const handleSourceAdded = () => {
    // Refresh sources for the selected category
    if (selectedCategory) {
      const category = categories.find(c => c.id === selectedCategory);
      // You could also fetch from the API here
      setSources(category?.defaultSources || []);
    }
  };
  
  const handleRemoveSource = (sourceToRemove: string) => {
    setSources(sources.filter(source => source !== sourceToRemove));
  };

  const handleGenerateReport = async () => {
    if (!selectedCategory || sources.length === 0) return;
    setAppState(AppState.PROCESSING);
    
    try {
      const initialJob = await NeuzoApi.startJob(selectedCategory, sources);
      setJob(initialJob);
      setCurrentStep(PROCESSING_STEPS(getCategoryName(selectedCategory))[0]);
    } catch (error: any) {
      // If auth error, apiCall will reload the page
      // Otherwise show error
      if (!error.message?.includes('Session expired')) {
        setErrorMessage(error.message || 'Failed to start job');
        setAppState(AppState.ERROR);
      }
    }
  };

  const handleReset = () => {
    setAppState(AppState.SELECTION);
    setSelectedCategory(null);
    setJob(null);
    setCurrentStep('');
    setErrorMessage(null);
    setSources([]);
  };

  const handleAuthSuccess = () => {
    setAppState(AppState.SELECTION);
  };

  const handleAddCategory = (e: FormEvent) => {
    e.preventDefault();
    if (newCategoryName.trim()) {
      const newCategory: Category = {
        id: newCategoryName.trim().toLowerCase().replace(/\s+/g, '_'),
        name: newCategoryName.trim(),
        icon: defaultNewCategoryIcon,
        defaultSources: [],
        isCustom: true,
      };
      setCategories([...categories, newCategory]);
      setIsAddCategoryModalOpen(false);
      setNewCategoryName('');
    }
  };

  const pollJobStatus = useCallback(async () => {
    if (!job || !job.jobId) return;

    try {
      const updatedJob = await NeuzoApi.getJobStatus(job.jobId);
      setJob(updatedJob);

      if (updatedJob.status === 'Processing' && updatedJob.step) {
        setCurrentStep(updatedJob.step);
      } else if (updatedJob.status === 'Complete') {
        setAppState(AppState.REPORT_VIEW);
      } else if (updatedJob.status === 'Error') {
        setErrorMessage(updatedJob.message || 'An unknown error occurred.');
        setAppState(AppState.ERROR);
      }
    } catch (error) {
      console.error('Failed to get job status:', error);
      setErrorMessage('Failed to communicate with the service.');
      setAppState(AppState.ERROR);
    }
  }, [job]);


  useEffect(() => {
    if (appState === AppState.PROCESSING && job?.jobId) {
      const intervalId = setInterval(pollJobStatus, 2500);
      return () => clearInterval(intervalId);
    }
  }, [appState, job, pollJobStatus]);


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
        case AppState.SELECTION:
        default:
            return (
            <div className="w-full max-w-5xl text-center">
                <h1 className="text-4xl md:text-5xl font-extrabold text-white">Neuzo: Your Agentic News Bot</h1>
                <p className="mt-4 text-lg text-gray-300 max-w-2xl mx-auto">Select a category to begin. Neuzo will fetch, verify, and synthesise all news from the past hour.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 my-10">
                {categories.map(cat => (
                    <CategoryCard
                    key={cat.id}
                    category={cat}
                    isSelected={selectedCategory === cat.id}
                    onClick={handleCategorySelect}
                    />
                ))}
                <div
                    onClick={() => setIsAddCategoryModalOpen(true)}
                    className="flex flex-col items-center justify-center p-6 bg-white/5 backdrop-blur-md rounded-xl cursor-pointer transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:shadow-2xl hover:bg-white/10 border-2 border-dashed border-white/20"
                    role="button"
                >
                    <PlusCircleIcon className="h-10 w-10 mb-4 text-gray-400" />
                    <span className="text-lg font-semibold text-gray-300 text-center">Add Category</span>
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
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-500 disabled:bg-gray-600/50 transition-colors" disabled={!newSourceUrl}>Add Source</button>
                            </form>
                            <div className="flex flex-wrap gap-2">
                                {sources.map(source => (
                                <div key={source} className="flex items-center justify-between bg-white/10 text-blue-300 text-sm font-medium pl-3 pr-2 py-1 rounded-full">
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
                                {sources.length === 0 && <p className="text-gray-400 text-sm">No sources defined. Add one above to generate a report.</p>}
                            </div>
                        </>
                    ) : (
                        <p className="text-gray-400">Select a category above to see default sources.</p>
                    )}
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
    return <div className="animate-fade-in w-full flex items-center justify-center">{content()}</div>;
  };

  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-4 font-sans text-gray-200">
        <header className="fixed top-0 left-0 right-0 p-4 bg-black/20 backdrop-blur-md shadow-lg z-10 border-b border-white/10">
            <div className="max-w-6xl mx-auto flex items-center">
                <BotIcon className="h-8 w-8 text-blue-400 mr-3" />
                <span className="text-2xl font-bold text-white tracking-wider">Neuzo</span>
            </div>
        </header>
        <main className="flex flex-col items-center justify-center w-full pt-24 pb-12">
            {renderContent()}
        </main>
        {isAddCategoryModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={() => setIsAddCategoryModalOpen(false)}>
                <div className="bg-black/50 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                    <h2 className="text-2xl font-bold text-white mb-4">Add New Category</h2>
                    <form onSubmit={handleAddCategory}>
                        <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="e.g., Artificial Intelligence"
                            className="w-full p-3 mb-4 border border-white/20 bg-white/5 rounded-md text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                        />
                        <div className="flex justify-end gap-4">
                            <button type="button" onClick={() => setIsAddCategoryModalOpen(false)} className="px-6 py-2 bg-white/10 text-gray-200 font-semibold rounded-lg hover:bg-white/20">Cancel</button>
                            <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 disabled:bg-gray-600/50" disabled={!newCategoryName.trim()}>Add</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
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