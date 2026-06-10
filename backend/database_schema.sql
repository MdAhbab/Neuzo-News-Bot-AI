-- Neuzo MySQL Database Schema
-- Created: November 18, 2025

CREATE DATABASE IF NOT EXISTS neuzo_db;
USE neuzo_db;

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    INDEX idx_email (email)
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    icon_name VARCHAR(100) DEFAULT 'NewspaperIcon',
    is_custom BOOLEAN DEFAULT FALSE,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_category_id (category_id)
);

-- News sources/pool table
CREATE TABLE IF NOT EXISTS news_sources (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    source_url VARCHAR(500) NOT NULL,
    source_name VARCHAR(255),
    source_type ENUM('rss', 'api', 'web') DEFAULT 'web',
    is_active BOOLEAN DEFAULT TRUE,
    reliability_score DECIMAL(3,2) DEFAULT 0.80,
    last_checked TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    INDEX idx_category (category_id),
    INDEX idx_url (source_url(255))
);

-- User category preferences
CREATE TABLE IF NOT EXISTS user_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    category_id INT NOT NULL,
    is_favorite BOOLEAN DEFAULT FALSE,
    custom_sources TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_category (user_id, category_id)
);

-- Jobs/Reports table
CREATE TABLE IF NOT EXISTS jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id VARCHAR(100) UNIQUE NOT NULL,
    user_id INT NOT NULL,
    category_id INT NOT NULL,
    status ENUM('Pending', 'Processing', 'Complete', 'Error') DEFAULT 'Pending',
    current_step VARCHAR(255),
    report_path VARCHAR(500),
    report_name VARCHAR(255),
    sources_used TEXT,
    agent_actions TEXT,
    error_message TEXT,
    articles_count INT DEFAULT NULL,
    verified_count INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    INDEX idx_job_id (job_id),
    INDEX idx_user (user_id),
    INDEX idx_status (status)
);

-- Insert default categories
INSERT INTO categories (category_id, name, icon_name, is_custom) VALUES
('technology', 'Technology', 'CpuChipIcon', FALSE),
('world_news', 'World News', 'GlobeAltIcon', FALSE),
('business', 'Business', 'ChartBarIcon', FALSE),
('healthcare', 'Healthcare', 'HealthIcon', FALSE),
('sports', 'Sports', 'FireIcon', FALSE),
('science', 'Science', 'SparklesIcon', FALSE);

-- Insert default news sources for Technology
INSERT INTO news_sources (category_id, source_url, source_name, source_type, reliability_score) VALUES
(1, 'https://techcrunch.com', 'TechCrunch', 'web', 0.90),
(1, 'https://www.theverge.com', 'The Verge', 'web', 0.88),
(1, 'https://www.wired.com', 'Wired', 'web', 0.87),
(1, 'https://arstechnica.com', 'Ars Technica', 'web', 0.89),
(1, 'https://www.technologyreview.com', 'MIT Technology Review', 'web', 0.92),
(1, 'https://venturebeat.com', 'VentureBeat', 'web', 0.85),
(1, 'https://www.cnet.com', 'CNET', 'web', 0.83);

-- Insert default news sources for World News
INSERT INTO news_sources (category_id, source_url, source_name, source_type, reliability_score) VALUES
(2, 'https://www.reuters.com', 'Reuters', 'web', 0.95),
(2, 'https://www.apnews.com', 'Associated Press', 'web', 0.94),
(2, 'https://www.bbc.com/news', 'BBC News', 'web', 0.93),
(2, 'https://www.aljazeera.com', 'Al Jazeera', 'web', 0.88),
(2, 'https://www.theguardian.com', 'The Guardian', 'web', 0.89),
(2, 'https://www.nytimes.com', 'The New York Times', 'web', 0.91),
(2, 'https://www.cnn.com', 'CNN', 'web', 0.85);

-- Insert default news sources for Business
INSERT INTO news_sources (category_id, source_url, source_name, source_type, reliability_score) VALUES
(3, 'https://www.bloomberg.com', 'Bloomberg', 'web', 0.94),
(3, 'https://www.wsj.com', 'Wall Street Journal', 'web', 0.93),
(3, 'https://www.ft.com', 'Financial Times', 'web', 0.92),
(3, 'https://www.forbes.com', 'Forbes', 'web', 0.87),
(3, 'https://www.businessinsider.com', 'Business Insider', 'web', 0.84),
(3, 'https://www.cnbc.com', 'CNBC', 'web', 0.86),
(3, 'https://www.marketwatch.com', 'MarketWatch', 'web', 0.85);

-- Insert default news sources for Healthcare
INSERT INTO news_sources (category_id, source_url, source_name, source_type, reliability_score) VALUES
(4, 'https://www.statnews.com', 'STAT News', 'web', 0.91),
(4, 'https://www.medicalnewstoday.com', 'Medical News Today', 'web', 0.86),
(4, 'https://www.who.int', 'World Health Organization', 'web', 0.95),
(4, 'https://www.medscape.com', 'Medscape', 'web', 0.88),
(4, 'https://www.healthline.com', 'Healthline', 'web', 0.84),
(4, 'https://www.webmd.com', 'WebMD', 'web', 0.82),
(4, 'https://www.nejm.org', 'New England Journal of Medicine', 'web', 0.96);

-- Insert default news sources for Sports
INSERT INTO news_sources (category_id, source_url, source_name, source_type, reliability_score) VALUES
(5, 'https://www.espn.com', 'ESPN', 'web', 0.89),
(5, 'https://bleacherreport.com', 'Bleacher Report', 'web', 0.83),
(5, 'https://www.cbssports.com', 'CBS Sports', 'web', 0.87),
(5, 'https://www.si.com', 'Sports Illustrated', 'web', 0.86),
(5, 'https://www.thescore.com', 'theScore', 'web', 0.84),
(5, 'https://www.skysports.com', 'Sky Sports', 'web', 0.88),
(5, 'https://www.goal.com', 'Goal.com', 'web', 0.82);

-- Insert default news sources for Science
INSERT INTO news_sources (category_id, source_url, source_name, source_type, reliability_score) VALUES
(6, 'https://www.nature.com', 'Nature', 'web', 0.96),
(6, 'https://www.newscientist.com', 'New Scientist', 'web', 0.90),
(6, 'https://www.science.org', 'Science Magazine', 'web', 0.95),
(6, 'https://www.scientificamerican.com', 'Scientific American', 'web', 0.91),
(6, 'https://phys.org', 'Phys.org', 'web', 0.87),
(6, 'https://www.sciencedaily.com', 'Science Daily', 'web', 0.85),
(6, 'https://www.livescience.com', 'Live Science', 'web', 0.84);
