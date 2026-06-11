"""
Lightweight lexicon-based sentiment and tone analysis.
stdlib only — no external dependencies required.
"""

import re

# Positive and negative word lexicons (small, deterministic)
_POSITIVE = frozenset([
    "good", "great", "excellent", "amazing", "wonderful", "fantastic",
    "outstanding", "positive", "success", "successful", "benefit",
    "beneficial", "improve", "improvement", "improved", "advance",
    "progress", "gain", "gains", "win", "wins", "won", "victory",
    "hope", "hopeful", "promising", "strong", "strength", "thrive",
    "growth", "recover", "recovery", "boost", "boosted", "boost",
    "celebrate", "celebrated", "celebrate", "achieve", "achieved",
    "achievement", "safe", "safety", "protect", "protection", "secure",
    "security", "relief", "resolve", "resolved", "agreement", "approve",
    "approved", "support", "supported", "praise", "praised", "effective",
    "efficient", "innovative", "opportunity", "opportunities", "rise",
    "rising", "increased", "increase", "surge", "higher", "record",
    "breakthrough", "hero", "heroic", "landmark", "milestone",
])

_NEGATIVE = frozenset([
    "bad", "terrible", "awful", "horrible", "dreadful", "poor",
    "failure", "fail", "failed", "fails", "crisis", "disaster",
    "catastrophe", "catastrophic", "danger", "dangerous", "threat",
    "threatens", "threatened", "attack", "attacked", "attacks",
    "violence", "violent", "conflict", "war", "wars", "death", "deaths",
    "die", "died", "dies", "kill", "killed", "kills", "loss", "losses",
    "lose", "lost", "fall", "fell", "fallen", "drop", "dropped",
    "decline", "declining", "declines", "collapse", "collapsed",
    "crash", "crashed", "fear", "fears", "panic", "concern", "concerns",
    "concerned", "worried", "worry", "risk", "risks", "risky",
    "problem", "problems", "issue", "issues", "trouble", "troubles",
    "scandal", "controversy", "controversial", "corruption", "corrupt",
    "illegal", "crime", "criminal", "fraud", "abuse", "abused",
    "victim", "victims", "suffer", "suffering", "damage", "damaged",
    "harm", "harmful", "harmed", "injury", "injured", "accident",
    "tragedy", "tragic", "shock", "shocking", "disturbing", "alarming",
    "alarm", "warning", "warn", "warned", "ban", "banned", "sanction",
    "sanctions", "cut", "cuts", "reduce", "reduced", "layoff",
    "layoffs", "fired", "bankrupt", "bankruptcy", "deficit",
])

# Emotive marker words (indicate high subjectivity / emotional tone)
_EMOTIVE_MARKERS = frozenset([
    "outrage", "outraged", "furious", "fury", "shock", "shocking",
    "horrifying", "horrified", "appalling", "disgusting", "disgusted",
    "heartbreaking", "heartbroken", "devastating", "devastated",
    "incredible", "unbelievable", "stunning", "explosive", "scandalous",
    "shameful", "shame", "disgrace", "disgraced", "desperate",
    "desperately", "urgent", "urgently", "critical", "terrifying",
    "terrified", "haunting", "haunted", "outrageous", "injustice",
])

# Analytical marker words (indicate measured, analytical tone)
_ANALYTICAL_MARKERS = frozenset([
    "analysis", "analytical", "according", "report", "reports",
    "reported", "study", "studies", "research", "researcher",
    "researchers", "data", "statistics", "statistical", "percent",
    "percentage", "forecast", "forecasted", "projected", "projection",
    "expected", "expectation", "estimated", "estimate", "likely",
    "unlikely", "possible", "possibly", "could", "would", "may",
    "might", "suggest", "suggests", "suggested", "indicate",
    "indicates", "indicated", "conclude", "concludes", "concluded",
    "findings", "evidence", "survey", "surveyed", "measure",
    "measured", "assessment", "assessed", "evaluate", "evaluation",
    "compared", "comparison", "trend", "trends", "pattern", "patterns",
    "correlation", "impact", "implications", "implication", "context",
    "overview", "perspective", "review", "reviewed", "examine",
    "examined", "investigation", "investigate", "model", "models",
])


def _tokenize(text: str):
    """Split text into lowercased word tokens."""
    return re.findall(r"[a-z]+", text.lower())


def sentiment(text: str) -> float:
    """
    Return a sentiment score in [-1, 1].
    Formula: (pos - neg) / (pos + neg + 1), clamped to [-1, 1].
    """
    if not text:
        return 0.0
    tokens = _tokenize(text)
    pos = sum(1 for t in tokens if t in _POSITIVE)
    neg = sum(1 for t in tokens if t in _NEGATIVE)
    score = (pos - neg) / (pos + neg + 1)
    return max(-1.0, min(1.0, score))


def tone(text: str) -> str:
    """
    Return one of "factual", "analytical", or "emotive".

    Rules (in order):
    1. emotive  — |sentiment| > 0.4 OR any emotive marker present
    2. analytical — any analytical marker present
    3. factual  — default
    """
    if not text:
        return "factual"
    tokens = _tokenize(text)
    token_set = set(tokens)

    sent = sentiment(text)
    if abs(sent) > 0.4 or token_set & _EMOTIVE_MARKERS:
        return "emotive"
    if token_set & _ANALYTICAL_MARKERS:
        return "analytical"
    return "factual"
