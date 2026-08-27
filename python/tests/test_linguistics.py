from python.linguistics import ReviewedFrenchAnalyzer


def test_regular_verb():
    result = ReviewedFrenchAnalyzer().analyze("parlait")
    assert (result.lemma, result.morphology) == ("parler", "imparfait · 3rd person singular")


def test_irregular_verb_and_lemma_relationship():
    result = ReviewedFrenchAnalyzer().analyze("furent")
    assert result.lemma == "être"
    assert result.verification == "verified"


def test_compound_tense():
    result = ReviewedFrenchAnalyzer().analyze_compound("a reçu")
    assert (result.lemma, result.morphology) == ("recevoir", "passé composé")
