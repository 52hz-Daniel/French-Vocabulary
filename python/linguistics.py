from __future__ import annotations

from dataclasses import dataclass
import re


@dataclass(frozen=True)
class Analysis:
    surface: str
    lemma: str
    part_of_speech: str
    morphology: str
    confidence: float
    verification: str


class ReviewedFrenchAnalyzer:
    """Small deterministic adapter; production Morphalou/spaCy adapters plug in here."""

    REVIEWED = {
        "furent": Analysis("furent", "être", "verb", "passé simple · 3rd person plural", 1.0, "verified"),
        "reçu": Analysis("reçu", "recevoir", "verb", "past participle · masculine singular", 1.0, "verified"),
        "parlait": Analysis("parlait", "parler", "verb", "imparfait · 3rd person singular", 1.0, "verified"),
    }

    def analyze(self, surface: str, lemma: str | None = None, part_of_speech: str = "unknown") -> Analysis:
        reviewed = self.REVIEWED.get(surface.casefold())
        if reviewed:
            return reviewed
        return Analysis(surface, lemma or surface.casefold(), part_of_speech, "", 0.65, "needs_review")

    def analyze_compound(self, text: str) -> Analysis:
        match = re.fullmatch(r"(?:a|ont|ai|as|avons|avez)\s+(reçu)", text.casefold())
        if not match:
            return Analysis(text, text.casefold(), "unknown", "", 0.0, "unknown")
        return Analysis(text, "recevoir", "verb", "passé composé", 1.0, "verified")
