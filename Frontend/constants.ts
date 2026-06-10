
import type React from 'react';
import type { Category } from './types';
import { CpuChipIcon, GlobeAltIcon, ChartBarIcon, HealthIcon, FireIcon, SparklesIcon, NewspaperIcon } from './components/icons';

export const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  CpuChipIcon,
  GlobeAltIcon,
  ChartBarIcon,
  HealthIcon,
  FireIcon,
  SparklesIcon,
  NewspaperIcon,
};

export const CATEGORIES: Category[] = [
  { 
    id: 'technology', 
    name: 'Technology', 
    icon: CpuChipIcon,
    defaultSources: ['https://techcrunch.com', 'https://www.theverge.com', 'https://www.wired.com']
  },
  { 
    id: 'world_news', 
    name: 'World News', 
    icon: GlobeAltIcon,
    defaultSources: ['https://www.reuters.com', 'https://www.apnews.com', 'https://www.bbc.com/news']
  },
  { 
    id: 'business', 
    name: 'Business', 
    icon: ChartBarIcon,
    defaultSources: ['https://www.bloomberg.com', 'https://www.wsj.com', 'https://www.ft.com']
  },
  { 
    id: 'healthcare', 
    name: 'Healthcare', 
    icon: HealthIcon,
    defaultSources: ['https://www.statnews.com', 'https://www.medicalnewstoday.com', 'https://www.who.int']
  },
  { 
    id: 'sports', 
    name: 'Sports', 
    icon: FireIcon,
    defaultSources: ['https://www.espn.com', 'https://bleacherreport.com', 'https://www.cbssports.com']
  },
  { 
    id: 'science', 
    name: 'Science', 
    icon: SparklesIcon,
    defaultSources: ['https://www.nature.com', 'https://www.newscientist.com', 'https://www.science.org']
  },
];

export const defaultNewCategoryIcon = NewspaperIcon;

// Must match PROCESSING_STEPS in backend/api_server.py exactly — the
// processing screen matches the polled step string against this list.
export const PROCESSING_STEPS = (categoryName: string) => [
  `Initiating agent for ${categoryName}...`,
  'Querying news pool...',
  'Receiving and parsing articles...',
  'Verifying news against references...',
  'Detecting duplicate and related stories...',
  'Synthesising final report...',
  'Generating document...',
];