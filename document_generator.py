"""
Document Generator
Creates Word documents with verified news articles and references
"""

from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from datetime import datetime
from typing import List
import os


class DocumentGenerator:
    """Generates Word documents with news reports"""
    
    def __init__(self, output_dir: str = "output"):
        """
        Initialize the document generator
        
        Args:
            output_dir: Directory to save generated documents
        """
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    def generate_report(self, category: str, verification_results: List,
                       include_unverified: bool = False) -> str:
        """
        Generate a comprehensive news report
        
        Args:
            category: News category
            verification_results: List of VerificationResult objects
            include_unverified: Whether to include unverified articles
            
        Returns:
            Path to the generated document
        """
        print(f"📄 Generating Word document...")
        
        # Create document
        doc = Document()
        
        # Set up styles
        self._setup_document_styles(doc)
        
        # Add title
        title = doc.add_heading('Neuzo News Report', 0)
        title.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        # Add metadata
        self._add_metadata(doc, category)
        
        # Add summary
        self._add_summary(doc, verification_results, category)
        
        # Add verified articles
        verified_results = [r for r in verification_results if r.verified]
        if verified_results:
            doc.add_page_break()
            doc.add_heading('Verified News Articles', 1)
            for i, result in enumerate(verified_results, 1):
                self._add_article(doc, result, i)
        
        # Add unverified articles if requested
        if include_unverified:
            unverified_results = [r for r in verification_results if not r.verified]
            if unverified_results:
                doc.add_page_break()
                doc.add_heading('Unverified Articles', 1)
                for i, result in enumerate(unverified_results, 1):
                    self._add_article(doc, result, i, verified=False)
        
        # Add references
        doc.add_page_break()
        self._add_references(doc, verified_results)
        
        # Save document
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"neuzo_news_{category}_{timestamp}.docx"
        filepath = os.path.join(self.output_dir, filename)
        doc.save(filepath)
        
        print(f"✅ Document saved: {filepath}")
        return filepath
    
    def _setup_document_styles(self, doc: Document):
        """Set up document styles"""
        # You can customize styles here if needed
        pass
    
    def _add_metadata(self, doc: Document, category: str):
        """Add document metadata"""
        # Category
        p = doc.add_paragraph()
        p.add_run(f"Category: ").bold = True
        p.add_run(category.title())
        
        # Generation time
        p = doc.add_paragraph()
        p.add_run("Generated: ").bold = True
        p.add_run(datetime.now().strftime("%B %d, %Y at %H:%M:%S"))
        
        # Separator
        doc.add_paragraph("_" * 80)
    
    def _add_summary(self, doc: Document, results: List, category: str):
        """Add executive summary"""
        doc.add_heading('Executive Summary', 1)
        
        total = len(results)
        verified = sum(1 for r in results if r.verified)
        avg_confidence = sum(r.confidence for r in results) / total if total > 0 else 0
        
        # Summary stats
        p = doc.add_paragraph()
        p.add_run(f"Total Articles Analyzed: ").bold = True
        p.add_run(f"{total}\n")
        
        p.add_run(f"Verified Articles: ").bold = True
        p.add_run(f"{verified} ({verified/total*100:.1f}%)\n" if total > 0 else "0\n")
        
        p.add_run(f"Average Confidence: ").bold = True
        p.add_run(f"{avg_confidence*100:.1f}%\n")
        
        p.add_run(f"Category: ").bold = True
        p.add_run(f"{category.title()}\n")
        
        # Key findings with actual news content
        if verified > 0:
            doc.add_heading('Key Findings', 2)
            
            # Generate intelligent summary
            verified_articles = [r.article for r in results if r.verified]
            
            # Introduction
            doc.add_paragraph(
                f"This report analyzes {total} news articles from the {category} category, "
                f"of which {verified} articles ({verified/total*100:.1f}%) have been verified "
                f"through cross-referencing with multiple sources using Natural Language Processing. "
                f"The analysis was conducted on {datetime.now().strftime('%B %d, %Y')}."
            )
            
            # Top stories summary
            if verified_articles:
                doc.add_heading('Top Stories', 3)
                for i, article in enumerate(verified_articles[:5], 1):
                    p = doc.add_paragraph(style='List Number')
                    p.add_run(f"{article.title}").bold = True
                    
                    # Use full description without truncation
                    if article.description:
                        p.add_run(f" — {article.description}")
                    
                    # Add content if available (NewsAPI provides some content)
                    if article.content and article.content != article.description:
                        # Remove the [+chars] suffix that NewsAPI adds
                        clean_content = article.content.split('[+')[0].strip()
                        if clean_content and clean_content != article.description:
                            p.add_run(f" {clean_content}")
                    
                    p.add_run(f" (Source: {article.source})")
            
            # Trends and insights
            doc.add_heading('Coverage Analysis', 3)
            
            # Get unique sources
            sources = set(article.source for article in verified_articles)
            
            doc.add_paragraph(
                f"The verified news comes from {len(sources)} different sources, "
                f"providing diverse perspectives on {category} topics. "
                f"The average confidence score of {avg_confidence*100:.1f}% indicates "
                f"{'high' if avg_confidence > 0.8 else 'good' if avg_confidence > 0.6 else 'moderate'} "
                f"reliability across the analyzed articles."
            )
            
            # Time distribution
            recent_count = sum(1 for a in verified_articles 
                             if a.published_at and (datetime.now() - a.published_at).total_seconds() / 3600 < 24)
            if recent_count > 0:
                doc.add_paragraph(
                    f"{recent_count} of the verified articles were published within the last 24 hours, "
                    f"ensuring timely and current information."
                )
        else:
            doc.add_heading('Analysis Results', 2)
            doc.add_paragraph(
                f"This report analyzed {total} news articles from the {category} category. "
                f"No articles met the verification threshold of {self._get_threshold()*100:.0f}% confidence. "
                f"This may indicate a lack of cross-referencing sources or highly diverse topics "
                f"within this time window. Consider expanding the time range or adjusting verification parameters."
            )
    
    def _get_threshold(self) -> float:
        """Get verification threshold (default 0.7)"""
        return 0.7
    
    def _add_article(self, doc: Document, result, index: int, verified: bool = True):
        """Add a single article to the document"""
        article = result.article
        
        # Article number and title
        heading = doc.add_heading(f"{index}. {article.title}", 2)
        
        # Verification badge
        p = doc.add_paragraph()
        badge = p.add_run("✓ VERIFIED " if verified else "⚠ UNVERIFIED ")
        badge.bold = True
        badge.font.color.rgb = RGBColor(0, 128, 0) if verified else RGBColor(255, 140, 0)
        
        confidence_text = p.add_run(f"(Confidence: {result.confidence*100:.1f}%)")
        confidence_text.font.size = Pt(10)
        
        # Source and date
        p = doc.add_paragraph()
        p.add_run("Source: ").bold = True
        p.add_run(f"{article.source}\n")
        
        if article.published_at:
            p.add_run("Published: ").bold = True
            p.add_run(f"{article.published_at.strftime('%B %d, %Y at %H:%M')}\n")
        
        # Description
        if article.description:
            p = doc.add_paragraph()
            p.add_run("Summary: ").bold = True
            doc.add_paragraph(article.description)
        
        # Full content if available
        if article.content and article.content != article.description:
            # Remove the [+chars] suffix that NewsAPI adds
            clean_content = article.content.split('[+')[0].strip()
            if clean_content and clean_content != article.description:
                p = doc.add_paragraph()
                p.add_run("Full Content: ").bold = True
                doc.add_paragraph(clean_content)
        
        # URL
        p = doc.add_paragraph()
        p.add_run("URL: ").bold = True
        p.add_run(article.url).font.color.rgb = RGBColor(0, 0, 255)
        
        # Similar sources (for verified articles)
        if verified and result.similar_sources:
            doc.add_heading('Cross-References', 3)
            for i, source in enumerate(result.similar_sources[:3], 1):
                p = doc.add_paragraph(style='List Bullet')
                p.add_run(f"{source['source']}: ").bold = True
                p.add_run(f"{source['title']} ")
                similarity = p.add_run(f"(Similarity: {source['similarity']*100:.1f}%)")
                similarity.font.size = Pt(9)
                similarity.font.italic = True
        
        # Separator
        doc.add_paragraph("─" * 80)
    
    def _add_references(self, doc: Document, results: List):
        """Add references section"""
        doc.add_heading('References', 1)
        
        doc.add_paragraph(
            "All articles in this report have been verified through cross-referencing "
            "with multiple news sources using Natural Language Processing (NLP) and "
            "semantic similarity analysis."
        )
        
        # List all unique sources
        sources = set()
        for result in results:
            sources.add(result.article.source)
            for similar in result.similar_sources:
                sources.add(similar['source'])
        
        doc.add_heading('News Sources', 2)
        for source in sorted(sources):
            doc.add_paragraph(source, style='List Bullet')
        
        # Methodology
        doc.add_heading('Verification Methodology', 2)
        doc.add_paragraph(
            "1. News articles are fetched from multiple reliable sources\n"
            "2. Each article is analyzed using advanced NLP models\n"
            "3. Articles are cross-referenced for semantic similarity\n"
            "4. Confidence scores are calculated based on source agreement\n"
            "5. Only articles meeting verification thresholds are included"
        )
