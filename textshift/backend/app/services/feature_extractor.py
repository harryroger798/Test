"""
FeatureExtractor565: Comprehensive feature extraction for TriBoost ensemble
(XGBoost + CatBoost + LightGBM) used in AI detection, plagiarism detection,
and humanizer detection.

This module provides a single class that extracts 565 features from text:
- 215 plagiarism detection features (indices 0-214)
- 150 AI detection features (indices 215-364)
- 200 humanizer detection features (indices 365-564)
"""

import re
import string
import numpy as np
from collections import Counter
from typing import List, Optional, Tuple
import warnings
import math

# Optional imports with graceful fallback
try:
    import nltk
    from nltk.tokenize import sent_tokenize, word_tokenize
    from nltk.corpus import stopwords
    from nltk.tag import pos_tag
    NLTK_AVAILABLE = True
except ImportError:
    NLTK_AVAILABLE = False
    warnings.warn("NLTK not available. Some features will use basic tokenization.")

try:
    import textstat
    TEXTSTAT_AVAILABLE = True
except ImportError:
    TEXTSTAT_AVAILABLE = False
    warnings.warn("textstat not available. Readability features will be approximated.")


class FeatureExtractor565:
    """
    Extract 565 features from text for plagiarism, AI detection, and humanizer detection.
    
    The features are organized into three main categories:
    - Plagiarism Features (0-214): 215 features
    - AI Detection Features (215-364): 150 features  
    - Humanizer Features (365-564): 200 features
    """
    
    # Zero-width characters
    ZERO_WIDTH_CHARS = [
        '\u200B', '\u200C', '\u200D', '\u200E', '\u200F',
        '\uFEFF', '\u2060', '\u2061', '\u2062', '\u2063', '\u2064',
    ]
    
    # Cyrillic homoglyphs (look like Latin)
    CYRILLIC_HOMOGLYPHS = {
        'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x',
        'А': 'A', 'Е': 'E', 'О': 'O', 'Р': 'P', 'С': 'C', 'У': 'Y', 'Х': 'X',
    }
    
    # Greek homoglyphs
    GREEK_HOMOGLYPHS = {
        'α': 'a', 'β': 'b', 'γ': 'y', 'ο': 'o', 'ρ': 'p', 'ν': 'v',
    }
    
    # QuillBot/SpinBot signature words
    QUILLBOT_MARKERS = [
        'utilize', 'commence', 'terminate', 'acquire', 'demonstrate',
        'facilitate', 'subsequently', 'henceforth', 'endeavor', 'procure',
        'expedite', 'ameliorate', 'elucidate', 'substantiate', 'corroborate',
        'ascertain', 'delineate', 'promulgate', 'necessitate', 'perpetuate',
    ]
    
    # AI writing markers
    AI_MARKERS = [
        'delve', 'furthermore', 'moreover', 'in conclusion', 'it is worth noting',
        'it is important to note', 'it should be noted', 'notably', 'essentially',
        'fundamentally', 'comprehensive', 'robust', 'seamless', 'leverage',
        'paradigm', 'synergy', 'holistic', 'multifaceted', 'nuanced',
    ]
    
    # Transition words commonly overused by AI
    AI_TRANSITIONS = [
        'however', 'therefore', 'consequently', 'additionally', 'furthermore',
        'moreover', 'nevertheless', 'nonetheless', 'subsequently', 'accordingly',
        'thus', 'hence', 'thereby', 'whereas', 'meanwhile',
    ]
    
    # Personal pronouns for detecting human-like writing
    PERSONAL_PRONOUNS = ['i', 'me', 'my', 'mine', 'myself', 'we', 'us', 'our', 'ours']
    
    # Uncertainty markers (humans use more)
    UNCERTAINTY_MARKERS = [
        'maybe', 'perhaps', 'probably', 'possibly', 'might', 'could',
        'i think', 'i believe', 'i guess', 'i suppose', 'not sure',
        'kind of', 'sort of', 'somewhat', 'fairly', 'rather',
    ]
    
    # Filler words (humans use more)
    FILLER_WORDS = [
        'um', 'uh', 'like', 'you know', 'i mean', 'basically', 'actually',
        'literally', 'honestly', 'frankly', 'well', 'so', 'anyway',
    ]
    
    # Academic/formal phrases
    ACADEMIC_PHRASES = [
        'according to', 'as stated by', 'research shows', 'studies indicate',
        'it has been found', 'evidence suggests', 'data demonstrates',
        'findings reveal', 'analysis shows', 'results indicate',
    ]
    
    # Citation patterns
    CITATION_PATTERNS = [
        r'\([A-Z][a-z]+,?\s*\d{4}\)',  # (Author, 2020)
        r'\[[0-9]+\]',  # [1]
        r'\([0-9]+\)',  # (1)
        r'et al\.',  # et al.
        r'ibid\.',  # ibid.
    ]

    def __init__(self):
        """Initialize the feature extractor with necessary resources."""
        self.stopwords = self._get_stopwords()
        self._compile_patterns()
    
    def _compile_patterns(self):
        """Pre-compile regex patterns for efficiency."""
        self.citation_regexes = [re.compile(p, re.IGNORECASE) for p in self.CITATION_PATTERNS]
        self.sentence_end_pattern = re.compile(r'[.!?]+')
        self.word_pattern = re.compile(r'\b[a-zA-Z]+\b')
        self.number_pattern = re.compile(r'\b\d+\.?\d*\b')
        self.url_pattern = re.compile(r'https?://\S+|www\.\S+')
        self.email_pattern = re.compile(r'\b[\w.-]+@[\w.-]+\.\w+\b')
    
    def _get_stopwords(self) -> set:
        """Get English stopwords with fallback if NLTK unavailable."""
        if NLTK_AVAILABLE:
            try:
                return set(stopwords.words('english'))
            except:
                pass
        
        return {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
            'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
            'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
            'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what',
            'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every',
            'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
            'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
        }
    
    def _tokenize_sentences(self, text: str) -> List[str]:
        """Tokenize text into sentences with NLTK fallback."""
        if not text:
            return []
        
        if NLTK_AVAILABLE:
            try:
                return sent_tokenize(text)
            except:
                pass
        
        # Fallback: simple sentence splitting
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if s.strip()]
    
    def _tokenize_words(self, text: str) -> List[str]:
        """Tokenize text into words with NLTK fallback."""
        if not text:
            return []
        
        if NLTK_AVAILABLE:
            try:
                return word_tokenize(text.lower())
            except:
                pass
        
        # Fallback: simple word splitting
        return self.word_pattern.findall(text.lower())
    
    def _get_pos_tags(self, words: List[str]) -> List[Tuple[str, str]]:
        """Get POS tags for words with fallback."""
        if not words:
            return []
        
        if NLTK_AVAILABLE:
            try:
                return pos_tag(words)
            except:
                pass
        
        # Fallback: simple heuristic POS tagging
        tags = []
        for word in words:
            if word in self.stopwords:
                tags.append((word, 'DT'))
            elif word.endswith('ly'):
                tags.append((word, 'RB'))
            elif word.endswith('ing'):
                tags.append((word, 'VBG'))
            elif word.endswith('ed'):
                tags.append((word, 'VBD'))
            elif word.endswith('s') and len(word) > 2:
                tags.append((word, 'NNS'))
            else:
                tags.append((word, 'NN'))
        return tags
    
    def _safe_divide(self, numerator: float, denominator: float, default: float = 0.0) -> float:
        """Safely divide two numbers, returning default if denominator is zero."""
        if denominator == 0:
            return default
        return numerator / denominator
    
    def _normalize(self, value: float, max_val: float = 1.0) -> float:
        """Normalize a value to [0, 1] range."""
        if max_val == 0:
            return 0.0
        return min(1.0, max(0.0, value / max_val))
    
    def _calculate_entropy(self, text: str) -> float:
        """Calculate Shannon entropy of character distribution."""
        if not text:
            return 0.0
        
        freq = Counter(text)
        total = len(text)
        entropy = 0.0
        
        for count in freq.values():
            if count > 0:
                p = count / total
                entropy -= p * math.log2(p)
        
        return entropy
    
    def _calculate_word_entropy(self, words: List[str]) -> float:
        """Calculate Shannon entropy of word distribution."""
        if not words:
            return 0.0
        
        freq = Counter(words)
        total = len(words)
        entropy = 0.0
        
        for count in freq.values():
            if count > 0:
                p = count / total
                entropy -= p * math.log2(p)
        
        return entropy


    def _extract_plagiarism_features(self, text: str, words: List[str], 
                                      sentences: List[str], pos_tags: List[Tuple[str, str]]) -> np.ndarray:
        """
        Extract plagiarism detection features (indices 0-214).
        
        Categories:
        - 0-19: Text Structure
        - 20-44: Lexical Manipulation
        - 45-59: Semantic Transformation
        - 60-74: Character Level
        - 75-84: Translation Based
        - 85-94: Citation Manipulation
        - 95-109: Content Augmentation
        - 110-124: Algorithm Specific
        - 125-139: Obfuscation Levels
        - 140-149: Paraphrasing Tool
        - 150-159: Semantic Role
        - 160-169: Discourse Level
        - 170-179: Source Specific
        - 180-189: Multi Document
        - 190-199: Technical Evasion
        - 200-214: Emerging Advanced
        """
        features = np.zeros(215, dtype=np.float32)
        
        if not text or not words:
            return features
        
        text_lower = text.lower()
        word_count = len(words)
        sent_count = len(sentences) if sentences else 1
        char_count = len(text)
        
        # ========== 0-19: Text Structure Features ==========
        # 0: Average sentence length
        features[0] = self._safe_divide(word_count, sent_count)
        
        # 1: Sentence length variance
        if sentences:
            sent_lengths = [len(self._tokenize_words(s)) for s in sentences]
            features[1] = np.std(sent_lengths) if len(sent_lengths) > 1 else 0
        
        # 2: Paragraph count (approximated by double newlines)
        paragraphs = [p for p in text.split('\n\n') if p.strip()]
        features[2] = len(paragraphs)
        
        # 3: Average paragraph length
        features[3] = self._safe_divide(word_count, len(paragraphs)) if paragraphs else 0
        
        # 4: Passive voice ratio
        passive_count = len(re.findall(r'\b(was|were|been|being|is|are|am)\s+\w+ed\b', text_lower))
        features[4] = self._safe_divide(passive_count, sent_count)
        
        # 5: Active voice ratio (inverse of passive)
        features[5] = 1.0 - features[4] if features[4] <= 1.0 else 0.0
        
        # 6: Question sentence ratio
        question_count = text.count('?')
        features[6] = self._safe_divide(question_count, sent_count)
        
        # 7: Exclamation ratio
        exclamation_count = text.count('!')
        features[7] = self._safe_divide(exclamation_count, sent_count)
        
        # 8: Average word length
        features[8] = self._safe_divide(sum(len(w) for w in words), word_count)
        
        # 9: Long word ratio (>6 chars)
        long_words = sum(1 for w in words if len(w) > 6)
        features[9] = self._safe_divide(long_words, word_count)
        
        # 10: Short sentence ratio (<5 words)
        if sentences:
            short_sents = sum(1 for s in sentences if len(self._tokenize_words(s)) < 5)
            features[10] = self._safe_divide(short_sents, sent_count)
        
        # 11: Long sentence ratio (>25 words)
        if sentences:
            long_sents = sum(1 for s in sentences if len(self._tokenize_words(s)) > 25)
            features[11] = self._safe_divide(long_sents, sent_count)
        
        # 12: Comma density
        comma_count = text.count(',')
        features[12] = self._safe_divide(comma_count, word_count)
        
        # 13: Semicolon density
        semicolon_count = text.count(';')
        features[13] = self._safe_divide(semicolon_count, word_count)
        
        # 14: Colon density
        colon_count = text.count(':')
        features[14] = self._safe_divide(colon_count, word_count)
        
        # 15: Dash usage
        dash_count = text.count('-') + text.count('—') + text.count('–')
        features[15] = self._safe_divide(dash_count, word_count)
        
        # 16: Parentheses usage
        paren_count = text.count('(') + text.count(')')
        features[16] = self._safe_divide(paren_count, word_count)
        
        # 17: Quote usage
        quote_count = text.count('"') + text.count("'") + text.count('"') + text.count('"')
        features[17] = self._safe_divide(quote_count, word_count)
        
        # 18: Sentence start variation (unique first words / total sentences)
        if sentences:
            first_words = [self._tokenize_words(s)[0] if self._tokenize_words(s) else '' for s in sentences]
            unique_starts = len(set(first_words))
            features[18] = self._safe_divide(unique_starts, sent_count)
        
        # 19: Sentence ending variation
        if sentences:
            endings = [s[-1] if s else '' for s in sentences]
            unique_endings = len(set(endings))
            features[19] = self._safe_divide(unique_endings, 3)  # Normalize by typical endings (.!?)
        
        # ========== 20-44: Lexical Manipulation Features ==========
        # 20: Type-token ratio (vocabulary diversity)
        unique_words = len(set(words))
        features[20] = self._safe_divide(unique_words, word_count)
        
        # 21: Hapax legomena ratio (words appearing once)
        word_freq = Counter(words)
        hapax = sum(1 for w, c in word_freq.items() if c == 1)
        features[21] = self._safe_divide(hapax, word_count)
        
        # 22: Dis legomena ratio (words appearing twice)
        dis = sum(1 for w, c in word_freq.items() if c == 2)
        features[22] = self._safe_divide(dis, word_count)
        
        # 23: Yule's K measure (vocabulary richness)
        if word_count > 0:
            freq_of_freq = Counter(word_freq.values())
            m1 = word_count
            m2 = sum(f * (r ** 2) for r, f in freq_of_freq.items())
            features[23] = 10000 * (m2 - m1) / (m1 ** 2) if m1 > 0 else 0
        
        # 24: Simpson's D (diversity index)
        if word_count > 1:
            features[24] = 1 - sum(c * (c - 1) for c in word_freq.values()) / (word_count * (word_count - 1))
        
        # 25: Synonym pattern score (QuillBot markers)
        quillbot_count = sum(1 for w in words if w in self.QUILLBOT_MARKERS)
        features[25] = self._safe_divide(quillbot_count, word_count) * 100
        
        # 26-30: N-gram repetition features
        for n, idx in [(2, 26), (3, 27), (4, 28), (5, 29), (6, 30)]:
            if len(words) >= n:
                ngrams = [tuple(words[i:i+n]) for i in range(len(words) - n + 1)]
                ngram_freq = Counter(ngrams)
                repeated = sum(1 for c in ngram_freq.values() if c > 1)
                features[idx] = self._safe_divide(repeated, len(ngrams))
        
        # 31: Collocation break score (unusual word combinations)
        common_collocations = {'in order', 'as well', 'such as', 'due to', 'in terms'}
        colloc_count = sum(1 for c in common_collocations if c in text_lower)
        features[31] = self._safe_divide(colloc_count, sent_count)
        
        # 32: Rare word ratio
        rare_words = sum(1 for w in words if len(w) > 8 and w not in self.stopwords)
        features[32] = self._safe_divide(rare_words, word_count)
        
        # 33: Function word ratio
        function_words = sum(1 for w in words if w in self.stopwords)
        features[33] = self._safe_divide(function_words, word_count)
        
        # 34: Content word ratio
        features[34] = 1.0 - features[33]
        
        # 35: Average word frequency rank (approximated)
        common_words = {'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i'}
        common_count = sum(1 for w in words if w in common_words)
        features[35] = self._safe_divide(common_count, word_count)
        
        # 36-40: Word length distribution
        for length, idx in [(1, 36), (2, 37), (3, 38), (4, 39), (5, 40)]:
            count = sum(1 for w in words if len(w) == length)
            features[idx] = self._safe_divide(count, word_count)
        
        # 41: Very long word ratio (>10 chars)
        very_long = sum(1 for w in words if len(w) > 10)
        features[41] = self._safe_divide(very_long, word_count)
        
        # 42: Syllable complexity (approximated by vowel clusters)
        vowel_pattern = re.compile(r'[aeiou]+', re.IGNORECASE)
        total_syllables = sum(len(vowel_pattern.findall(w)) for w in words)
        features[42] = self._safe_divide(total_syllables, word_count)
        
        # 43: Lexical density
        if pos_tags:
            content_pos = {'NN', 'NNS', 'NNP', 'NNPS', 'VB', 'VBD', 'VBG', 'VBN', 'VBP', 'VBZ', 'JJ', 'JJR', 'JJS', 'RB', 'RBR', 'RBS'}
            content_words = sum(1 for _, tag in pos_tags if tag in content_pos)
            features[43] = self._safe_divide(content_words, word_count)
        
        # 44: Vocabulary sophistication
        sophisticated = {'albeit', 'notwithstanding', 'hitherto', 'heretofore', 'wherein', 'thereby'}
        soph_count = sum(1 for w in words if w in sophisticated)
        features[44] = self._safe_divide(soph_count, word_count) * 100


        # ========== 45-59: Semantic Transformation Features ==========
        # 45: Cause-effect pattern density
        cause_effect = ['because', 'therefore', 'thus', 'hence', 'consequently', 'as a result']
        ce_count = sum(1 for ce in cause_effect if ce in text_lower)
        features[45] = self._safe_divide(ce_count, sent_count)
        
        # 46: Comparison pattern density
        comparison = ['similarly', 'likewise', 'in contrast', 'on the other hand', 'whereas']
        comp_count = sum(1 for c in comparison if c in text_lower)
        features[46] = self._safe_divide(comp_count, sent_count)
        
        # 47: Temporal sequence markers
        temporal = ['first', 'then', 'next', 'finally', 'subsequently', 'previously', 'afterwards']
        temp_count = sum(1 for t in temporal if t in text_lower)
        features[47] = self._safe_divide(temp_count, sent_count)
        
        # 48: Logical connector density
        logical = ['if', 'unless', 'provided', 'assuming', 'given that', 'in case']
        log_count = sum(1 for l in logical if l in text_lower)
        features[48] = self._safe_divide(log_count, sent_count)
        
        # 49: Example marker density
        example_markers = ['for example', 'for instance', 'such as', 'e.g.', 'i.e.', 'namely']
        ex_count = sum(1 for e in example_markers if e in text_lower)
        features[49] = self._safe_divide(ex_count, sent_count)
        
        # 50: Definition pattern density
        definition = [' is defined as', ' refers to', ' means that', ' is known as']
        def_count = sum(1 for d in definition if d in text_lower)
        features[50] = self._safe_divide(def_count, sent_count)
        
        # 51: Emphasis marker density
        emphasis = ['importantly', 'significantly', 'notably', 'crucially', 'essentially']
        emp_count = sum(1 for e in emphasis if e in text_lower)
        features[51] = self._safe_divide(emp_count, sent_count)
        
        # 52: Hedging language density
        hedging = ['may', 'might', 'could', 'possibly', 'perhaps', 'seemingly', 'apparently']
        hedge_count = sum(1 for h in hedging if h in words)
        features[52] = self._safe_divide(hedge_count, word_count)
        
        # 53: Boosting language density
        boosting = ['certainly', 'definitely', 'clearly', 'obviously', 'undoubtedly', 'absolutely']
        boost_count = sum(1 for b in boosting if b in words)
        features[53] = self._safe_divide(boost_count, word_count)
        
        # 54: Negation density
        negation = ['not', 'no', 'never', 'neither', 'nor', 'none', 'nothing', 'nowhere']
        neg_count = sum(1 for n in negation if n in words)
        features[54] = self._safe_divide(neg_count, word_count)
        
        # 55: Modal verb density
        modals = ['can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would']
        modal_count = sum(1 for m in modals if m in words)
        features[55] = self._safe_divide(modal_count, word_count)
        
        # 56: Nominalization density (words ending in -tion, -ment, -ness)
        nominalization = sum(1 for w in words if w.endswith(('tion', 'ment', 'ness', 'ity')))
        features[56] = self._safe_divide(nominalization, word_count)
        
        # 57: Abstract noun ratio
        abstract_suffixes = ('ism', 'ity', 'ness', 'ance', 'ence', 'ment', 'ship')
        abstract_count = sum(1 for w in words if w.endswith(abstract_suffixes))
        features[57] = self._safe_divide(abstract_count, word_count)
        
        # 58: Concrete noun approximation (based on common patterns)
        concrete_patterns = re.findall(r'\b(table|chair|book|car|house|tree|water|food)\b', text_lower)
        features[58] = self._safe_divide(len(concrete_patterns), word_count)
        
        # 59: Semantic coherence score (sentence similarity approximation)
        if len(sentences) > 1:
            coherence_scores = []
            for i in range(len(sentences) - 1):
                words1 = set(self._tokenize_words(sentences[i]))
                words2 = set(self._tokenize_words(sentences[i + 1]))
                if words1 and words2:
                    overlap = len(words1 & words2) / len(words1 | words2)
                    coherence_scores.append(overlap)
            features[59] = np.mean(coherence_scores) if coherence_scores else 0
        
        # ========== 60-74: Character Level Features ==========
        # 60: Zero-width character count
        zw_count = sum(1 for c in text if c in self.ZERO_WIDTH_CHARS)
        features[60] = zw_count
        
        # 61: Zero-width character ratio
        features[61] = self._safe_divide(zw_count, char_count)
        
        # 62: Cyrillic homoglyph count
        cyrillic_count = sum(1 for c in text if c in self.CYRILLIC_HOMOGLYPHS)
        features[62] = cyrillic_count
        
        # 63: Cyrillic homoglyph ratio
        features[63] = self._safe_divide(cyrillic_count, char_count)
        
        # 64: Greek homoglyph count
        greek_count = sum(1 for c in text if c in self.GREEK_HOMOGLYPHS)
        features[64] = greek_count
        
        # 65: Greek homoglyph ratio
        features[65] = self._safe_divide(greek_count, char_count)
        
        # 66: Total homoglyph count
        features[66] = cyrillic_count + greek_count
        
        # 67: Unicode category diversity
        unicode_cats = set()
        for c in text[:1000]:  # Sample first 1000 chars
            try:
                import unicodedata
                unicode_cats.add(unicodedata.category(c))
            except:
                pass
        features[67] = len(unicode_cats)
        
        # 68: Non-ASCII character ratio
        non_ascii = sum(1 for c in text if ord(c) > 127)
        features[68] = self._safe_divide(non_ascii, char_count)
        
        # 69: Invisible character count (broader than zero-width)
        invisible_chars = sum(1 for c in text if ord(c) in range(0x2000, 0x200F) or ord(c) in range(0x2028, 0x202F))
        features[69] = invisible_chars
        
        # 70: Whitespace anomaly score
        normal_spaces = text.count(' ')
        all_whitespace = sum(1 for c in text if c.isspace())
        features[70] = self._safe_divide(all_whitespace - normal_spaces, char_count)
        
        # 71: Multiple space sequences
        multi_space = len(re.findall(r'  +', text))
        features[71] = self._safe_divide(multi_space, word_count)
        
        # 72: Tab character usage
        tab_count = text.count('\t')
        features[72] = self._safe_divide(tab_count, char_count)
        
        # 73: Line break anomalies
        line_breaks = text.count('\n')
        features[73] = self._safe_divide(line_breaks, sent_count)
        
        # 74: Special Unicode space characters
        special_spaces = sum(1 for c in text if c in '\u00A0\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A')
        features[74] = special_spaces
        
        # ========== 75-84: Translation Based Features ==========
        # 75: Article omission pattern (common in MT from article-less languages)
        article_ratio = sum(1 for w in words if w in ['a', 'an', 'the']) / max(word_count, 1)
        features[75] = article_ratio
        
        # 76: Preposition error patterns
        prep_patterns = len(re.findall(r'\b(in|on|at)\s+(the\s+)?\w+\s+(in|on|at)\b', text_lower))
        features[76] = self._safe_divide(prep_patterns, sent_count)
        
        # 77: Word order anomaly score
        # Check for adjective-noun order issues
        adj_noun_pattern = len(re.findall(r'\b\w+ly\s+\w+ing\b', text_lower))
        features[77] = self._safe_divide(adj_noun_pattern, sent_count)
        
        # 78: Literal translation markers
        literal_markers = ['make a decision', 'take a decision', 'do a mistake', 'make a party']
        lit_count = sum(1 for m in literal_markers if m in text_lower)
        features[78] = lit_count
        
        # 79: False friend patterns (common translation errors)
        false_friends = ['actually', 'eventually', 'sensible', 'sympathetic']
        ff_count = sum(1 for f in false_friends if f in words)
        features[79] = self._safe_divide(ff_count, word_count)
        
        # 80: Calque detection (loan translations)
        calques = ['it gives', 'it makes', 'have reason', 'make sense']
        calque_count = sum(1 for c in calques if c in text_lower)
        features[80] = self._safe_divide(calque_count, sent_count)
        
        # 81: Pronoun consistency
        pronouns = ['he', 'she', 'it', 'they', 'him', 'her', 'them']
        pronoun_count = sum(1 for p in pronouns if p in words)
        features[81] = self._safe_divide(pronoun_count, word_count)
        
        # 82: Tense consistency score
        past_markers = sum(1 for w in words if w.endswith('ed'))
        present_markers = sum(1 for w in words if w.endswith('s') and len(w) > 2)
        features[82] = abs(past_markers - present_markers) / max(word_count, 1)
        
        # 83: Gender agreement errors (approximation)
        gender_errors = len(re.findall(r'\b(he|him|his)\s+\w+\s+(she|her|hers)\b', text_lower))
        features[83] = gender_errors
        
        # 84: Number agreement errors
        number_errors = len(re.findall(r'\b(this|that)\s+\w+s\b|\b(these|those)\s+\w+[^s]\b', text_lower))
        features[84] = number_errors


        # ========== 85-94: Citation Manipulation Features ==========
        # 85: Citation count
        total_citations = sum(len(regex.findall(text)) for regex in self.citation_regexes)
        features[85] = total_citations
        
        # 86: Citation density
        features[86] = self._safe_divide(total_citations, sent_count)
        
        # 87: APA style citation count
        apa_citations = len(re.findall(r'\([A-Z][a-z]+,?\s*\d{4}\)', text))
        features[87] = apa_citations
        
        # 88: Numeric citation count
        numeric_citations = len(re.findall(r'\[\d+\]', text))
        features[88] = numeric_citations
        
        # 89: Mixed citation style (inconsistency)
        citation_styles = sum([1 if apa_citations > 0 else 0, 1 if numeric_citations > 0 else 0])
        features[89] = 1.0 if citation_styles > 1 else 0.0
        
        # 90: Self-citation patterns
        self_cite = len(re.findall(r'\b(our|we|my|I)\s+\w+\s+\(\d{4}\)', text))
        features[90] = self_cite
        
        # 91: Citation clustering (multiple citations together)
        citation_clusters = len(re.findall(r'\[\d+\]\s*\[\d+\]|\([^)]+\)\s*\([^)]+\)', text))
        features[91] = citation_clusters
        
        # 92: Footnote markers
        footnotes = len(re.findall(r'\[\d+\]|\*{1,3}', text))
        features[92] = footnotes
        
        # 93: Bibliography indicators
        bib_markers = ['references', 'bibliography', 'works cited', 'sources']
        bib_count = sum(1 for b in bib_markers if b in text_lower)
        features[93] = bib_count
        
        # 94: Quote attribution patterns
        quote_attr = len(re.findall(r'(said|stated|argued|claimed|noted)\s+(that|,)', text_lower))
        features[94] = quote_attr
        
        # ========== 95-109: Content Augmentation Features ==========
        # 95: Commentary density (opinion markers)
        commentary = ['in my opinion', 'i believe', 'it seems', 'arguably', 'presumably']
        comm_count = sum(1 for c in commentary if c in text_lower)
        features[95] = self._safe_divide(comm_count, sent_count)
        
        # 96: Transition word density
        transition_count = sum(1 for t in self.AI_TRANSITIONS if t in words)
        features[96] = self._safe_divide(transition_count, sent_count)
        
        # 97: Elaboration markers
        elaboration = ['that is', 'in other words', 'to clarify', 'specifically', 'particularly']
        elab_count = sum(1 for e in elaboration if e in text_lower)
        features[97] = self._safe_divide(elab_count, sent_count)
        
        # 98: Summary markers
        summary = ['in summary', 'to summarize', 'in conclusion', 'overall', 'in brief']
        sum_count = sum(1 for s in summary if s in text_lower)
        features[98] = self._safe_divide(sum_count, sent_count)
        
        # 99: Introduction markers
        intro = ['this paper', 'this essay', 'this article', 'the purpose', 'the aim']
        intro_count = sum(1 for i in intro if i in text_lower)
        features[99] = intro_count
        
        # 100: Methodology markers
        method = ['method', 'approach', 'procedure', 'technique', 'framework']
        method_count = sum(1 for m in method if m in words)
        features[100] = self._safe_divide(method_count, word_count)
        
        # 101: Results markers
        results = ['results', 'findings', 'outcomes', 'data shows', 'analysis reveals']
        results_count = sum(1 for r in results if r in text_lower)
        features[101] = results_count
        
        # 102: Discussion markers
        discussion = ['discussion', 'implications', 'significance', 'interpretation']
        disc_count = sum(1 for d in discussion if d in words)
        features[102] = self._safe_divide(disc_count, word_count)
        
        # 103: Filler content ratio
        filler_phrases = ['it is important to', 'it should be noted', 'it is worth mentioning']
        filler_count = sum(1 for f in filler_phrases if f in text_lower)
        features[103] = self._safe_divide(filler_count, sent_count)
        
        # 104: Redundancy score (repeated phrases)
        phrase_pattern = re.findall(r'\b(\w+\s+\w+\s+\w+)\b', text_lower)
        phrase_freq = Counter(phrase_pattern)
        repeated_phrases = sum(1 for c in phrase_freq.values() if c > 1)
        features[104] = self._safe_divide(repeated_phrases, len(phrase_pattern)) if phrase_pattern else 0
        
        # 105: Padding word ratio
        padding = ['very', 'really', 'quite', 'rather', 'somewhat', 'fairly', 'pretty']
        padding_count = sum(1 for p in padding if p in words)
        features[105] = self._safe_divide(padding_count, word_count)
        
        # 106: Adverb density
        adverbs = sum(1 for w in words if w.endswith('ly'))
        features[106] = self._safe_divide(adverbs, word_count)
        
        # 107: Adjective density (approximation)
        if pos_tags:
            adj_count = sum(1 for _, tag in pos_tags if tag.startswith('JJ'))
            features[107] = self._safe_divide(adj_count, word_count)
        
        # 108: Verb density
        if pos_tags:
            verb_count = sum(1 for _, tag in pos_tags if tag.startswith('VB'))
            features[108] = self._safe_divide(verb_count, word_count)
        
        # 109: Noun density
        if pos_tags:
            noun_count = sum(1 for _, tag in pos_tags if tag.startswith('NN'))
            features[109] = self._safe_divide(noun_count, word_count)
        
        # ========== 110-124: Algorithm Specific Features ==========
        # 110: Turnitin bypass signature (character substitution patterns)
        substitution_score = features[62] + features[64] + features[60]  # Homoglyphs + zero-width
        features[110] = substitution_score
        
        # 111: Copyscape bypass signature (structural manipulation)
        features[111] = features[25] + features[104]  # Synonym + redundancy
        
        # 112: Word boundary manipulation
        word_boundary_issues = len(re.findall(r'\w\u200B\w', text))
        features[112] = word_boundary_issues
        
        # 113: Sentence boundary manipulation
        sent_boundary_issues = len(re.findall(r'[.!?]\u200B[A-Z]', text))
        features[113] = sent_boundary_issues
        
        # 114: Paragraph structure anomaly
        para_lengths = [len(p.split()) for p in paragraphs]
        features[114] = np.std(para_lengths) if len(para_lengths) > 1 else 0
        
        # 115: Heading pattern detection
        headings = len(re.findall(r'^[A-Z][^.!?]*:?\s*$', text, re.MULTILINE))
        features[115] = headings
        
        # 116: List structure detection
        list_items = len(re.findall(r'^\s*[-•*]\s+\w', text, re.MULTILINE))
        features[116] = list_items
        
        # 117: Numbered list detection
        numbered_items = len(re.findall(r'^\s*\d+[.)]\s+\w', text, re.MULTILINE))
        features[117] = numbered_items
        
        # 118: Block quote detection
        block_quotes = len(re.findall(r'^\s{4,}["\']?\w', text, re.MULTILINE))
        features[118] = block_quotes
        
        # 119: Code block detection
        code_blocks = len(re.findall(r'```[\s\S]*?```|`[^`]+`', text))
        features[119] = code_blocks
        
        # 120: Table structure detection
        table_patterns = len(re.findall(r'\|.*\|', text))
        features[120] = table_patterns
        
        # 121: URL presence
        urls = len(self.url_pattern.findall(text))
        features[121] = urls
        
        # 122: Email presence
        emails = len(self.email_pattern.findall(text))
        features[122] = emails
        
        # 123: Date pattern presence
        dates = len(re.findall(r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\w+\s+\d{1,2},?\s+\d{4}\b', text))
        features[123] = dates
        
        # 124: Numeric data density
        numbers = len(self.number_pattern.findall(text))
        features[124] = self._safe_divide(numbers, word_count)


        # ========== 125-139: Obfuscation Levels Features ==========
        # 125: Light obfuscation score
        light_obf = features[25] * 0.3 + features[20] * 0.3 + features[96] * 0.4
        features[125] = light_obf
        
        # 126: Moderate obfuscation score
        mod_obf = features[60] * 0.2 + features[62] * 0.2 + features[104] * 0.3 + features[25] * 0.3
        features[126] = mod_obf
        
        # 127: Heavy obfuscation score
        heavy_obf = features[66] * 0.3 + features[60] * 0.3 + features[110] * 0.4
        features[127] = heavy_obf
        
        # 128: Overall obfuscation score
        features[128] = (features[125] + features[126] + features[127]) / 3
        
        # 129: Character-level obfuscation
        features[129] = features[60] + features[66] + features[68]
        
        # 130: Word-level obfuscation
        features[130] = features[25] + features[32]
        
        # 131: Sentence-level obfuscation
        features[131] = features[1] + features[18]
        
        # 132: Paragraph-level obfuscation
        features[132] = features[114]
        
        # 133: Structural obfuscation
        features[133] = features[115] + features[116] + features[117]
        
        # 134: Semantic obfuscation
        features[134] = features[45] + features[46] + features[47]
        
        # 135: Stylistic obfuscation
        features[135] = features[4] + features[106] + features[107]
        
        # 136: Technical obfuscation
        features[136] = features[119] + features[120]
        
        # 137: Citation obfuscation
        features[137] = features[89] + features[91]
        
        # 138: Format obfuscation
        features[138] = features[70] + features[73]
        
        # 139: Multi-layer obfuscation
        features[139] = (features[129] + features[130] + features[131] + features[132]) / 4
        
        # ========== 140-149: Paraphrasing Tool Features ==========
        # 140: QuillBot signature score
        quillbot_score = features[25]
        features[140] = quillbot_score
        
        # 141: SpinBot signature (more aggressive synonyms)
        spinbot_markers = ['utilize', 'procure', 'endeavor', 'ascertain', 'promulgate']
        spinbot_count = sum(1 for w in words if w in spinbot_markers)
        features[141] = self._safe_divide(spinbot_count, word_count) * 100
        
        # 142: Paraphrase tool vocabulary shift
        formal_informal_ratio = features[44] / max(features[33], 0.01)
        features[142] = formal_informal_ratio
        
        # 143: Sentence restructuring score
        features[143] = features[1] * features[18]
        
        # 144: Word order variation
        features[144] = features[77]
        
        # 145: Passive voice increase (common in paraphrasing)
        features[145] = features[4]
        
        # 146: Nominalization increase
        features[146] = features[56]
        
        # 147: Complexity increase score
        features[147] = features[8] + features[9]
        
        # 148: Readability change indicator
        if TEXTSTAT_AVAILABLE:
            try:
                features[148] = textstat.flesch_reading_ease(text) / 100
            except:
                features[148] = 0.5
        else:
            features[148] = 0.5
        
        # 149: Paraphrase confidence score
        features[149] = (features[140] + features[141] + features[143]) / 3
        
        # ========== 150-159: Semantic Role Features ==========
        # 150: Agent-patient swap indicator
        agent_patient = len(re.findall(r'\bby\s+the\s+\w+\b', text_lower))
        features[150] = self._safe_divide(agent_patient, sent_count)
        
        # 151: Subject-object inversion
        features[151] = features[4]  # Passive voice as proxy
        
        # 152: Verb nominalization
        features[152] = features[56]
        
        # 153: Adjective to adverb conversion
        adj_to_adv = len(re.findall(r'\b\w+ly\s+\w+ed\b', text_lower))
        features[153] = self._safe_divide(adj_to_adv, sent_count)
        
        # 154: Noun to verb conversion
        noun_to_verb = len(re.findall(r'\b(impact|access|contact|email|message)\b', text_lower))
        features[154] = self._safe_divide(noun_to_verb, word_count)
        
        # 155: Clause restructuring
        clause_markers = ['which', 'that', 'who', 'whom', 'whose', 'where', 'when']
        clause_count = sum(1 for c in clause_markers if c in words)
        features[155] = self._safe_divide(clause_count, sent_count)
        
        # 156: Coordination to subordination
        coord = words.count('and') + words.count('but') + words.count('or')
        subord = words.count('because') + words.count('although') + words.count('while')
        features[156] = self._safe_divide(subord, max(coord, 1))
        
        # 157: Direct to indirect speech
        direct_speech = len(re.findall(r'"[^"]*"', text))
        features[157] = self._safe_divide(direct_speech, sent_count)
        
        # 158: Tense shift patterns
        features[158] = features[82]
        
        # 159: Voice consistency score
        features[159] = 1.0 - abs(features[4] - 0.2)  # Optimal passive ratio ~20%
        
        # ========== 160-169: Discourse Level Features ==========
        # 160: Anaphora density (pronoun references)
        anaphora = ['this', 'that', 'these', 'those', 'it', 'they', 'them']
        anaph_count = sum(1 for a in anaphora if a in words)
        features[160] = self._safe_divide(anaph_count, word_count)
        
        # 161: Cataphora patterns
        cataphora = len(re.findall(r'\b(this|it)\s+\w+\s+that\b', text_lower))
        features[161] = cataphora
        
        # 162: Lexical cohesion (word repetition across sentences)
        if len(sentences) > 1:
            cohesion_scores = []
            for i in range(len(sentences) - 1):
                w1 = set(self._tokenize_words(sentences[i])) - self.stopwords
                w2 = set(self._tokenize_words(sentences[i + 1])) - self.stopwords
                if w1 and w2:
                    cohesion_scores.append(len(w1 & w2) / len(w1 | w2))
            features[162] = np.mean(cohesion_scores) if cohesion_scores else 0
        
        # 163: Conjunction density
        conjunctions = ['and', 'but', 'or', 'yet', 'so', 'for', 'nor']
        conj_count = sum(1 for c in conjunctions if c in words)
        features[163] = self._safe_divide(conj_count, word_count)
        
        # 164: Discourse marker density
        discourse_markers = ['however', 'therefore', 'moreover', 'furthermore', 'nevertheless']
        dm_count = sum(1 for d in discourse_markers if d in words)
        features[164] = self._safe_divide(dm_count, sent_count)
        
        # 165: Topic continuity score
        features[165] = features[162]  # Lexical cohesion as proxy
        
        # 166: Information flow pattern
        features[166] = features[59]  # Semantic coherence
        
        # 167: Paragraph cohesion
        if len(paragraphs) > 1:
            para_cohesion = []
            for i in range(len(paragraphs) - 1):
                w1 = set(self._tokenize_words(paragraphs[i])) - self.stopwords
                w2 = set(self._tokenize_words(paragraphs[i + 1])) - self.stopwords
                if w1 and w2:
                    para_cohesion.append(len(w1 & w2) / len(w1 | w2))
            features[167] = np.mean(para_cohesion) if para_cohesion else 0
        
        # 168: Reference chain length
        features[168] = features[160] * sent_count
        
        # 169: Discourse structure score
        features[169] = (features[162] + features[164] + features[167]) / 3
        
        # ========== 170-179: Source Specific Features ==========
        # 170: Academic content score
        academic_words = ['research', 'study', 'analysis', 'methodology', 'hypothesis', 'conclusion']
        acad_count = sum(1 for a in academic_words if a in words)
        features[170] = self._safe_divide(acad_count, word_count) * 100
        
        # 171: Web content score
        web_markers = ['click', 'link', 'website', 'online', 'download', 'subscribe']
        web_count = sum(1 for w in web_markers if w in words)
        features[171] = self._safe_divide(web_count, word_count) * 100
        
        # 172: News content score
        news_markers = ['reported', 'according to', 'sources say', 'officials', 'announced']
        news_count = sum(1 for n in news_markers if n in text_lower)
        features[172] = self._safe_divide(news_count, sent_count)
        
        # 173: Blog content score
        blog_markers = ['i think', 'my opinion', 'personally', 'in my experience', 'i believe']
        blog_count = sum(1 for b in blog_markers if b in text_lower)
        features[173] = self._safe_divide(blog_count, sent_count)
        
        # 174: Technical content score
        tech_markers = ['algorithm', 'function', 'variable', 'parameter', 'implementation']
        tech_count = sum(1 for t in tech_markers if t in words)
        features[174] = self._safe_divide(tech_count, word_count) * 100
        
        # 175: Legal content score
        legal_markers = ['hereby', 'whereas', 'pursuant', 'notwithstanding', 'thereof']
        legal_count = sum(1 for l in legal_markers if l in words)
        features[175] = self._safe_divide(legal_count, word_count) * 100
        
        # 176: Medical content score
        medical_markers = ['patient', 'diagnosis', 'treatment', 'symptoms', 'clinical']
        med_count = sum(1 for m in medical_markers if m in words)
        features[176] = self._safe_divide(med_count, word_count) * 100
        
        # 177: Scientific content score
        sci_markers = ['experiment', 'hypothesis', 'data', 'results', 'significant']
        sci_count = sum(1 for s in sci_markers if s in words)
        features[177] = self._safe_divide(sci_count, word_count) * 100
        
        # 178: Literary content score
        lit_markers = ['metaphor', 'narrative', 'protagonist', 'theme', 'symbolism']
        lit_count = sum(1 for l in lit_markers if l in words)
        features[178] = self._safe_divide(lit_count, word_count) * 100
        
        # 179: Mixed source indicator
        source_scores = [features[170], features[171], features[172], features[173], features[174]]
        features[179] = np.std(source_scores) if source_scores else 0
        
        # ========== 180-189: Multi Document Features ==========
        # 180: Style consistency score
        features[180] = 1.0 - features[179] / max(np.mean(source_scores), 0.01)
        
        # 181: Vocabulary consistency
        if len(paragraphs) > 1:
            vocab_per_para = [set(self._tokenize_words(p)) for p in paragraphs]
            vocab_overlaps = []
            for i in range(len(vocab_per_para) - 1):
                if vocab_per_para[i] and vocab_per_para[i + 1]:
                    overlap = len(vocab_per_para[i] & vocab_per_para[i + 1]) / len(vocab_per_para[i] | vocab_per_para[i + 1])
                    vocab_overlaps.append(overlap)
            features[181] = np.mean(vocab_overlaps) if vocab_overlaps else 0
        
        # 182: Tone consistency
        features[182] = 1.0 - features[1] / max(features[0], 1)  # Sentence length variance
        
        # 183: Formality consistency
        features[183] = features[33]  # Function word ratio as proxy
        
        # 184: Source blending score
        features[184] = features[179] * features[181]
        
        # 185: Transition anomaly
        features[185] = features[96] - features[164]
        
        # 186: Topic drift score
        features[186] = 1.0 - features[162]
        
        # 187: Author fingerprint variation
        features[187] = features[20] * features[1]  # TTR * sentence variance
        
        # 188: Compilation indicator
        features[188] = features[115] + features[116] + features[179]
        
        # 189: Patchwork score
        features[189] = (features[184] + features[186] + features[188]) / 3
        
        # ========== 190-199: Technical Evasion Features ==========
        # 190: Hash manipulation score
        features[190] = features[60] + features[66]  # Zero-width + homoglyphs
        
        # 191: Fingerprint evasion score
        features[191] = features[112] + features[113]  # Boundary manipulation
        
        # 192: Whitespace manipulation
        features[192] = features[70] + features[74]
        
        # 193: Character encoding anomaly
        features[193] = features[68]  # Non-ASCII ratio
        
        # 194: Invisible text score
        features[194] = features[60] + features[69]
        
        # 195: Format stripping indicator
        features[195] = 1.0 - (features[115] + features[116] + features[117]) / max(sent_count, 1)
        
        # 196: Metadata removal indicator
        features[196] = 1.0 if features[121] == 0 and features[122] == 0 else 0.0
        
        # 197: OCR artifact score
        ocr_artifacts = len(re.findall(r'[Il1|O0]', text))
        features[197] = self._safe_divide(ocr_artifacts, char_count)
        
        # 198: PDF extraction artifact
        pdf_artifacts = len(re.findall(r'[^\x00-\x7F]{2,}', text))
        features[198] = self._safe_divide(pdf_artifacts, char_count)
        
        # 199: Technical evasion composite
        features[199] = (features[190] + features[191] + features[192] + features[194]) / 4
        
        # ========== 200-214: Emerging Advanced Features ==========
        # 200: LLM paraphrasing signature
        llm_markers = ['delve', 'comprehensive', 'robust', 'leverage', 'paradigm']
        llm_count = sum(1 for l in llm_markers if l in words)
        features[200] = self._safe_divide(llm_count, word_count) * 100
        
        # 201: ChatGPT rewrite signature
        chatgpt_markers = ['certainly', 'absolutely', 'i understand', 'great question']
        chatgpt_count = sum(1 for c in chatgpt_markers if c in text_lower)
        features[201] = chatgpt_count
        
        # 202: Claude rewrite signature
        claude_markers = ['i appreciate', 'nuanced', 'multifaceted', 'holistic']
        claude_count = sum(1 for c in claude_markers if c in text_lower)
        features[202] = claude_count
        
        # 203: AI paraphrase confidence
        features[203] = (features[200] + features[201] + features[202]) / 3
        
        # 204: Human-AI hybrid score
        features[204] = features[203] * (1 - features[173])  # AI markers * (1 - personal markers)
        
        # 205: Iterative rewriting score
        features[205] = features[25] * features[200]  # QuillBot * LLM
        
        # 206: Multi-tool processing
        features[206] = features[140] + features[141] + features[200]
        
        # 207: Adversarial perturbation
        features[207] = features[60] + features[66] + features[77]
        
        # 208: Semantic preservation score
        features[208] = features[59] * features[162]
        
        # 209: Syntactic variation score
        features[209] = features[1] * features[18]
        
        # 210: Lexical substitution density
        features[210] = features[25] + features[32]
        
        # 211: Structural transformation score
        features[211] = features[4] + features[56] + features[155]
        
        # 212: Evasion sophistication
        features[212] = (features[199] + features[206] + features[207]) / 3
        
        # 213: Detection difficulty score
        features[213] = features[212] * (1 - features[128])
        
        # 214: Overall plagiarism risk
        features[214] = (features[128] + features[149] + features[189] + features[203]) / 4
        
        return features


    def _extract_ai_detection_features(self, text: str, words: List[str],
                                        sentences: List[str], pos_tags: List[Tuple[str, str]]) -> np.ndarray:
        """
        Extract AI detection features (indices 215-364).
        
        Categories:
        - 215-234: Character Manipulation
        - 235-259: Linguistic Stylistic
        - 260-279: Semantic Content
        - 280-294: Prompt Engineering
        - 295-306: Paraphrasing
        - 307-321: Adversarial ML
        - 322-331: Structural Format
        - 332-339: Hybrid Multisource
        - 340-349: Cognitive Patterns
        - 350-357: Imperfection Error
        - 358-364: Specialized Technical
        """
        features = np.zeros(150, dtype=np.float32)
        
        if not text or not words:
            return features
        
        text_lower = text.lower()
        word_count = len(words)
        sent_count = len(sentences) if sentences else 1
        char_count = len(text)
        
        # ========== 215-234: Character Manipulation Features ==========
        # 215: Zero-width space count (U+200B)
        features[0] = text.count('\u200B')
        
        # 216: Zero-width non-joiner (U+200C)
        features[1] = text.count('\u200C')
        
        # 217: Zero-width joiner (U+200D)
        features[2] = text.count('\u200D')
        
        # 218: Left-to-right mark (U+200E)
        features[3] = text.count('\u200E')
        
        # 219: Right-to-left mark (U+200F)
        features[4] = text.count('\u200F')
        
        # 220: Byte order mark (U+FEFF)
        features[5] = text.count('\uFEFF')
        
        # 221: Word joiner (U+2060)
        features[6] = text.count('\u2060')
        
        # 222: Invisible operators (U+2061-U+2064)
        features[7] = sum(text.count(chr(c)) for c in range(0x2061, 0x2065))
        
        # 223: Total zero-width characters
        features[8] = sum(features[0:8])
        
        # 224: Zero-width character ratio
        features[9] = self._safe_divide(features[8], char_count)
        
        # 225: Cyrillic 'a' homoglyph
        features[10] = text.count('а')  # Cyrillic
        
        # 226: Cyrillic 'e' homoglyph
        features[11] = text.count('е')  # Cyrillic
        
        # 227: Cyrillic 'o' homoglyph
        features[12] = text.count('о')  # Cyrillic
        
        # 228: Cyrillic 'p' homoglyph
        features[13] = text.count('р')  # Cyrillic
        
        # 229: Cyrillic 'c' homoglyph
        features[14] = text.count('с')  # Cyrillic
        
        # 230: Greek 'o' homoglyph
        features[15] = text.count('ο')  # Greek omicron
        
        # 231: Total homoglyph count
        cyrillic_count = sum(1 for c in text if c in self.CYRILLIC_HOMOGLYPHS)
        greek_count = sum(1 for c in text if c in self.GREEK_HOMOGLYPHS)
        features[16] = cyrillic_count + greek_count
        
        # 232: Homoglyph ratio
        features[17] = self._safe_divide(features[16], char_count)
        
        # 233: Mixed script detection
        has_latin = bool(re.search(r'[a-zA-Z]', text))
        has_cyrillic = bool(re.search(r'[\u0400-\u04FF]', text))
        has_greek = bool(re.search(r'[\u0370-\u03FF]', text))
        features[18] = sum([has_latin, has_cyrillic, has_greek]) - 1 if has_latin else 0
        
        # 234: Character manipulation composite score
        features[19] = features[9] * 100 + features[17] * 100
        
        # ========== 235-259: Linguistic Stylistic Features ==========
        # 235: Burstiness (sentence length variation)
        if sentences:
            sent_lengths = [len(self._tokenize_words(s)) for s in sentences]
            features[20] = np.std(sent_lengths) / max(np.mean(sent_lengths), 1) if sent_lengths else 0
        
        # 236: Perplexity approximation (word entropy)
        features[21] = self._calculate_word_entropy(words)
        
        # 237: Character entropy
        features[22] = self._calculate_entropy(text)
        
        # 238: Vocabulary diversity (TTR)
        unique_words = len(set(words))
        features[23] = self._safe_divide(unique_words, word_count)
        
        # 239: MTLD approximation (lexical diversity)
        features[24] = features[23] * math.log(word_count + 1)
        
        # 240: Average sentence length
        features[25] = self._safe_divide(word_count, sent_count)
        
        # 241: Sentence length variance
        if sentences:
            sent_lengths = [len(self._tokenize_words(s)) for s in sentences]
            features[26] = np.var(sent_lengths) if len(sent_lengths) > 1 else 0
        
        # 242: Short sentence ratio
        if sentences:
            short_sents = sum(1 for s in sentences if len(self._tokenize_words(s)) < 8)
            features[27] = self._safe_divide(short_sents, sent_count)
        
        # 243: Long sentence ratio
        if sentences:
            long_sents = sum(1 for s in sentences if len(self._tokenize_words(s)) > 20)
            features[28] = self._safe_divide(long_sents, sent_count)
        
        # 244: AI transition word density
        ai_trans_count = sum(1 for t in self.AI_TRANSITIONS if t in words)
        features[29] = self._safe_divide(ai_trans_count, sent_count)
        
        # 245: AI marker word density
        ai_marker_count = sum(1 for m in self.AI_MARKERS if m in text_lower)
        features[30] = self._safe_divide(ai_marker_count, sent_count)
        
        # 246: "Delve" usage (strong AI indicator)
        features[31] = text_lower.count('delve')
        
        # 247: "Furthermore" usage
        features[32] = text_lower.count('furthermore')
        
        # 248: "Moreover" usage
        features[33] = text_lower.count('moreover')
        
        # 249: "In conclusion" usage
        features[34] = text_lower.count('in conclusion')
        
        # 250: "It is worth noting" usage
        features[35] = text_lower.count('it is worth noting')
        
        # 251: Formal phrase density
        formal_phrases = ['it is important to', 'it should be noted', 'one must consider']
        formal_count = sum(1 for f in formal_phrases if f in text_lower)
        features[36] = self._safe_divide(formal_count, sent_count)
        
        # 252: Passive voice ratio
        passive_count = len(re.findall(r'\b(was|were|been|being|is|are)\s+\w+ed\b', text_lower))
        features[37] = self._safe_divide(passive_count, sent_count)
        
        # 253: Adverb density
        adverbs = sum(1 for w in words if w.endswith('ly'))
        features[38] = self._safe_divide(adverbs, word_count)
        
        # 254: Nominalization density
        nominalization = sum(1 for w in words if w.endswith(('tion', 'ment', 'ness', 'ity')))
        features[39] = self._safe_divide(nominalization, word_count)
        
        # 255: Hedging language ratio
        hedging = ['may', 'might', 'could', 'possibly', 'perhaps', 'seemingly']
        hedge_count = sum(1 for h in hedging if h in words)
        features[40] = self._safe_divide(hedge_count, word_count)
        
        # 256: Boosting language ratio
        boosting = ['certainly', 'definitely', 'clearly', 'obviously', 'undoubtedly']
        boost_count = sum(1 for b in boosting if b in words)
        features[41] = self._safe_divide(boost_count, word_count)
        
        # 257: Sentence start repetition
        if sentences:
            first_words = [self._tokenize_words(s)[0] if self._tokenize_words(s) else '' for s in sentences]
            word_freq = Counter(first_words)
            repeated_starts = sum(1 for c in word_freq.values() if c > 1)
            features[42] = self._safe_divide(repeated_starts, sent_count)
        
        # 258: Paragraph uniformity
        paragraphs = [p for p in text.split('\n\n') if p.strip()]
        if paragraphs:
            para_lengths = [len(p.split()) for p in paragraphs]
            features[43] = 1.0 - (np.std(para_lengths) / max(np.mean(para_lengths), 1))
        
        # 259: Stylistic consistency score
        features[44] = (features[20] + features[42] + features[43]) / 3


        # ========== 260-279: Semantic Content Features ==========
        # 260: Personal pronoun density
        personal_count = sum(1 for p in self.PERSONAL_PRONOUNS if p in words)
        features[45] = self._safe_divide(personal_count, word_count)
        
        # 261: First person singular ratio
        first_person = sum(1 for w in words if w in ['i', 'me', 'my', 'mine', 'myself'])
        features[46] = self._safe_divide(first_person, word_count)
        
        # 262: Personal anecdote indicators
        anecdote_markers = ['i remember', 'one time', 'personally', 'in my experience', 'i once']
        anecdote_count = sum(1 for a in anecdote_markers if a in text_lower)
        features[47] = anecdote_count
        
        # 263: Specific detail density (numbers, dates, names)
        specific_details = len(re.findall(r'\b\d+\b|\b[A-Z][a-z]+\s+[A-Z][a-z]+\b', text))
        features[48] = self._safe_divide(specific_details, sent_count)
        
        # 264: Named entity density (approximation)
        named_entities = len(re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text))
        features[49] = self._safe_divide(named_entities, word_count)
        
        # 265: Temporal reference density
        temporal_refs = len(re.findall(r'\b(yesterday|today|tomorrow|last\s+\w+|next\s+\w+|\d{4})\b', text_lower))
        features[50] = self._safe_divide(temporal_refs, sent_count)
        
        # 266: Location reference density
        location_preps = len(re.findall(r'\b(in|at|near|from)\s+[A-Z][a-z]+\b', text))
        features[51] = self._safe_divide(location_preps, sent_count)
        
        # 267: Emotional language density
        emotional = ['love', 'hate', 'fear', 'joy', 'angry', 'sad', 'happy', 'excited', 'worried']
        emotion_count = sum(1 for e in emotional if e in words)
        features[52] = self._safe_divide(emotion_count, word_count)
        
        # 268: Sensory language density
        sensory = ['see', 'hear', 'feel', 'smell', 'taste', 'touch', 'look', 'sound']
        sensory_count = sum(1 for s in sensory if s in words)
        features[53] = self._safe_divide(sensory_count, word_count)
        
        # 269: Concrete noun ratio
        concrete_patterns = len(re.findall(r'\b(table|chair|book|car|house|tree|water|food|door|window)\b', text_lower))
        features[54] = self._safe_divide(concrete_patterns, word_count)
        
        # 270: Abstract concept ratio
        abstract = ['freedom', 'justice', 'love', 'truth', 'beauty', 'knowledge', 'power']
        abstract_count = sum(1 for a in abstract if a in words)
        features[55] = self._safe_divide(abstract_count, word_count)
        
        # 271: Opinion marker density
        opinion = ['i think', 'i believe', 'in my opinion', 'i feel', 'it seems to me']
        opinion_count = sum(1 for o in opinion if o in text_lower)
        features[56] = self._safe_divide(opinion_count, sent_count)
        
        # 272: Uncertainty marker density
        uncertainty_count = sum(1 for u in self.UNCERTAINTY_MARKERS if u in text_lower)
        features[57] = self._safe_divide(uncertainty_count, sent_count)
        
        # 273: Filler word density
        filler_count = sum(1 for f in self.FILLER_WORDS if f in text_lower)
        features[58] = self._safe_divide(filler_count, word_count)
        
        # 274: Colloquial expression density
        colloquial = ['gonna', 'wanna', 'gotta', 'kinda', 'sorta', 'dunno', 'yeah', 'nope']
        colloquial_count = sum(1 for c in colloquial if c in words)
        features[59] = self._safe_divide(colloquial_count, word_count)
        
        # 275: Contraction usage
        contractions = len(re.findall(r"\b\w+'(t|s|re|ve|ll|d|m)\b", text_lower))
        features[60] = self._safe_divide(contractions, word_count)
        
        # 276: Rhetorical question density
        rhetorical = text.count('?')
        features[61] = self._safe_divide(rhetorical, sent_count)
        
        # 277: Exclamation usage
        exclamations = text.count('!')
        features[62] = self._safe_divide(exclamations, sent_count)
        
        # 278: Human authenticity score
        features[63] = (features[45] + features[47] + features[57] + features[58] + features[60]) / 5
        
        # 279: AI content probability
        features[64] = 1.0 - features[63]
        
        # ========== 280-294: Prompt Engineering Features ==========
        # 280: Temperature artifact (vocabulary uniformity)
        features[65] = 1.0 - features[23]  # Inverse of vocabulary diversity
        
        # 281: Top-p artifact (predictable word choices)
        common_words = {'the', 'is', 'are', 'was', 'were', 'have', 'has', 'been', 'will', 'would'}
        common_ratio = sum(1 for w in words if w in common_words) / max(word_count, 1)
        features[66] = common_ratio
        
        # 282: Repetition penalty artifact
        word_freq = Counter(words)
        max_freq = max(word_freq.values()) if word_freq else 0
        features[67] = self._safe_divide(max_freq, word_count)
        
        # 283: Persona marker detection
        persona_markers = ['as an ai', 'as a language model', 'i am an ai', 'i am a bot']
        persona_count = sum(1 for p in persona_markers if p in text_lower)
        features[68] = persona_count
        
        # 284: Instruction following patterns
        instruction_patterns = ['here is', 'here are', 'below is', 'the following', 'as requested']
        instr_count = sum(1 for i in instruction_patterns if i in text_lower)
        features[69] = instr_count
        
        # 285: List generation pattern
        list_markers = len(re.findall(r'^\s*[-•*]\s+\w|^\s*\d+[.)]\s+\w', text, re.MULTILINE))
        features[70] = list_markers
        
        # 286: Structured output pattern
        structured = len(re.findall(r'^\s*\*\*[^*]+\*\*\s*:', text, re.MULTILINE))
        features[71] = structured
        
        # 287: Code block presence
        code_blocks = len(re.findall(r'```[\s\S]*?```', text))
        features[72] = code_blocks
        
        # 288: Markdown formatting
        markdown = len(re.findall(r'\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_', text))
        features[73] = self._safe_divide(markdown, sent_count)
        
        # 289: Bullet point density
        features[74] = self._safe_divide(features[70], sent_count)
        
        # 290: Numbered list density
        numbered = len(re.findall(r'^\s*\d+[.)]\s+', text, re.MULTILINE))
        features[75] = self._safe_divide(numbered, sent_count)
        
        # 291: Header pattern
        headers = len(re.findall(r'^#+\s+\w|^[A-Z][^.!?]*:\s*$', text, re.MULTILINE))
        features[76] = headers
        
        # 292: Conclusion pattern
        conclusion_patterns = ['in conclusion', 'to summarize', 'in summary', 'to conclude', 'overall']
        conclusion_count = sum(1 for c in conclusion_patterns if c in text_lower)
        features[77] = conclusion_count
        
        # 293: Introduction pattern
        intro_patterns = ['in this', 'this article', 'this essay', 'we will', 'i will']
        intro_count = sum(1 for i in intro_patterns if i in text_lower)
        features[78] = intro_count
        
        # 294: Prompt engineering composite
        features[79] = (features[68] + features[69] + features[70] + features[77] + features[78]) / 5


        # ========== 295-306: Paraphrasing Features ==========
        # 295: QuillBot processing signature
        quillbot_count = sum(1 for w in words if w in self.QUILLBOT_MARKERS)
        features[80] = self._safe_divide(quillbot_count, word_count) * 100
        
        # 296: Synonym density (unusual word choices)
        unusual_synonyms = ['utilize', 'commence', 'terminate', 'endeavor', 'procure']
        syn_count = sum(1 for s in unusual_synonyms if s in words)
        features[81] = self._safe_divide(syn_count, word_count) * 100
        
        # 297: Back-translation artifact
        awkward_phrases = ['it is that', 'there is that', 'what is that']
        awkward_count = sum(1 for a in awkward_phrases if a in text_lower)
        features[82] = awkward_count
        
        # 298: Sentence restructuring indicator
        if sentences:
            sent_lengths = [len(self._tokenize_words(s)) for s in sentences]
            features[83] = np.std(sent_lengths) if len(sent_lengths) > 1 else 0
        
        # 299: Word order anomaly
        word_order_issues = len(re.findall(r'\badverb\s+verb\b|\badjective\s+adverb\b', text_lower))
        features[84] = word_order_issues
        
        # 300: Passive voice increase
        features[85] = features[37]  # Reuse passive voice ratio
        
        # 301: Nominalization increase
        features[86] = features[39]  # Reuse nominalization density
        
        # 302: Complexity score
        avg_word_len = sum(len(w) for w in words) / max(word_count, 1)
        features[87] = avg_word_len
        
        # 303: Readability score
        if TEXTSTAT_AVAILABLE:
            try:
                features[88] = textstat.flesch_reading_ease(text) / 100
            except:
                features[88] = 0.5
        else:
            # Approximate Flesch reading ease
            syllable_count = sum(len(re.findall(r'[aeiou]+', w, re.I)) for w in words)
            features[88] = 206.835 - 1.015 * (word_count / max(sent_count, 1)) - 84.6 * (syllable_count / max(word_count, 1))
            features[88] = max(0, min(100, features[88])) / 100
        
        # 304: Vocabulary sophistication
        sophisticated = sum(1 for w in words if len(w) > 10)
        features[89] = self._safe_divide(sophisticated, word_count)
        
        # 305: Paraphrase tool confidence
        features[90] = (features[80] + features[81] + features[85] + features[86]) / 4
        
        # 306: Multi-pass rewriting indicator
        features[91] = features[80] * features[30]  # QuillBot * AI markers
        
        # ========== 307-321: Adversarial ML Features ==========
        # 307: TextFooler signature (synonym substitution)
        features[92] = features[81]  # Synonym density
        
        # 308: BERT-Attack signature (contextual perturbation)
        features[93] = features[19]  # Character manipulation
        
        # 309: Character-level perturbation
        features[94] = features[9]  # Zero-width ratio
        
        # 310: Word-level perturbation
        features[95] = features[80]  # QuillBot signature
        
        # 311: Sentence-level perturbation
        features[96] = features[83]  # Sentence restructuring
        
        # 312: Embedding perturbation indicator
        features[97] = features[17]  # Homoglyph ratio
        
        # 313: Gradient attack signature
        features[98] = (features[94] + features[95] + features[96]) / 3
        
        # 314: Black-box attack indicator
        features[99] = features[92] + features[93]
        
        # 315: White-box attack indicator
        features[100] = features[97] + features[98]
        
        # 316: Universal perturbation
        features[101] = features[19]  # Character manipulation composite
        
        # 317: Targeted attack indicator
        features[102] = features[30]  # AI marker density
        
        # 318: Untargeted attack indicator
        features[103] = features[20]  # Burstiness
        
        # 319: Adversarial robustness score
        features[104] = 1.0 - (features[98] + features[99]) / 2
        
        # 320: Attack sophistication
        features[105] = (features[98] + features[99] + features[100]) / 3
        
        # 321: Adversarial detection confidence
        features[106] = features[105] * (1 - features[104])
        
        # ========== 322-331: Structural Format Features ==========
        # 322: Paragraph count
        paragraphs = [p for p in text.split('\n\n') if p.strip()]
        features[107] = len(paragraphs)
        
        # 323: Average paragraph length
        features[108] = self._safe_divide(word_count, len(paragraphs)) if paragraphs else 0
        
        # 324: Paragraph length variance
        if paragraphs:
            para_lengths = [len(p.split()) for p in paragraphs]
            features[109] = np.std(para_lengths) if len(para_lengths) > 1 else 0
        
        # 325: Section structure
        sections = len(re.findall(r'^#+\s+|^[A-Z][^.!?]*:\s*$', text, re.MULTILINE))
        features[110] = sections
        
        # 326: List structure ratio
        features[111] = self._safe_divide(features[70], sent_count)
        
        # 327: Table presence
        tables = len(re.findall(r'\|.*\|', text))
        features[112] = tables
        
        # 328: Code presence
        features[113] = features[72]  # Code blocks
        
        # 329: Quote presence
        quotes = len(re.findall(r'>[^\n]+|"[^"]{20,}"', text))
        features[114] = quotes
        
        # 330: Formatting consistency
        features[115] = 1.0 - features[109] / max(features[108], 1)
        
        # 331: Structure complexity score
        features[116] = (features[110] + features[111] + features[112] + features[113]) / 4
        
        # ========== 332-339: Hybrid Multisource Features ==========
        # 332: Human-AI hybrid indicator
        features[117] = features[63] * features[64]  # Human * AI probability
        
        # 333: Style inconsistency
        features[118] = features[20]  # Burstiness as proxy
        
        # 334: Vocabulary shift
        if len(paragraphs) > 1:
            vocab_per_para = [set(self._tokenize_words(p)) for p in paragraphs]
            vocab_diffs = []
            for i in range(len(vocab_per_para) - 1):
                if vocab_per_para[i] and vocab_per_para[i + 1]:
                    diff = 1 - len(vocab_per_para[i] & vocab_per_para[i + 1]) / len(vocab_per_para[i] | vocab_per_para[i + 1])
                    vocab_diffs.append(diff)
            features[119] = np.mean(vocab_diffs) if vocab_diffs else 0
        
        # 335: Tone shift
        features[120] = features[109] / max(features[108], 1)  # Paragraph variance
        
        # 336: Formality shift
        features[121] = features[119]  # Vocabulary shift as proxy
        
        # 337: Source attribution
        features[122] = features[69]  # Instruction patterns
        
        # 338: Multi-author indicator
        features[123] = (features[118] + features[119] + features[120]) / 3
        
        # 339: Hybrid detection confidence
        features[124] = features[117] * features[123]
        
        # ========== 340-349: Cognitive Patterns Features ==========
        # 340: Non-linear thinking indicator
        non_linear = ['actually', 'wait', 'hmm', 'let me think', 'on second thought']
        nl_count = sum(1 for n in non_linear if n in text_lower)
        features[125] = nl_count
        
        # 341: Self-correction patterns
        self_correct = ['i mean', 'rather', 'or rather', 'actually', 'correction']
        sc_count = sum(1 for s in self_correct if s in text_lower)
        features[126] = sc_count
        
        # 342: Stream of consciousness
        features[127] = features[58]  # Filler word density
        
        # 343: Digression patterns
        digression = ['by the way', 'speaking of', 'that reminds me', 'anyway']
        dig_count = sum(1 for d in digression if d in text_lower)
        features[128] = dig_count
        
        # 344: Incomplete thought patterns
        incomplete = text.count('...') + text.count('—') + text.count('–')
        features[129] = self._safe_divide(incomplete, sent_count)
        
        # 345: Question-answer patterns
        qa_pattern = len(re.findall(r'\?\s+[A-Z]', text))
        features[130] = qa_pattern
        
        # 346: Reasoning chain
        reasoning = ['because', 'therefore', 'so', 'thus', 'hence']
        reason_count = sum(1 for r in reasoning if r in words)
        features[131] = self._safe_divide(reason_count, sent_count)
        
        # 347: Metacognition markers
        meta = ['i think', 'i wonder', 'i realize', 'it occurs to me']
        meta_count = sum(1 for m in meta if m in text_lower)
        features[132] = meta_count
        
        # 348: Cognitive load indicator
        features[133] = (features[125] + features[126] + features[128] + features[129]) / 4
        
        # 349: Human cognition score
        features[134] = features[133] * features[63]
        
        # ========== 350-357: Imperfection Error Features ==========
        # 350: Typo density (repeated characters)
        typos = len(re.findall(r'(.)\1{2,}', text))
        features[135] = self._safe_divide(typos, word_count)
        
        # 351: Spelling variation
        spelling_vars = len(re.findall(r'\b(colour|colour|grey|gray|centre|center)\b', text_lower))
        features[136] = spelling_vars
        
        # 352: Grammar error patterns
        grammar_errors = len(re.findall(r'\b(their|there|they\'re)\b.*\b(their|there|they\'re)\b', text_lower))
        features[137] = grammar_errors
        
        # 353: Punctuation errors
        punct_errors = len(re.findall(r'[,;:]{2,}|[.!?]{3,}', text))
        features[138] = punct_errors
        
        # 354: Capitalization errors
        cap_errors = len(re.findall(r'\bi\b(?!\s+[A-Z])|(?<=[.!?]\s)[a-z]', text))
        features[139] = cap_errors
        
        # 355: Run-on sentences
        run_ons = len(re.findall(r'[^.!?]{200,}[.!?]', text))
        features[140] = run_ons
        
        # 356: Fragment sentences
        fragments = len(re.findall(r'^[A-Z][^.!?]{1,20}[.!?]$', text, re.MULTILINE))
        features[141] = fragments
        
        # 357: Human imperfection score
        features[142] = (features[135] + features[138] + features[139] + features[140]) / 4
        
        # ========== 358-364: Specialized Technical Features ==========
        # 358: Watermark removal indicator
        features[143] = features[19]  # Character manipulation
        
        # 359: Entropy manipulation
        features[144] = abs(features[22] - 4.5)  # Deviation from typical entropy
        
        # 360: Perplexity engineering
        features[145] = abs(features[21] - 8.0)  # Deviation from typical word entropy
        
        # 361: Token distribution anomaly
        features[146] = features[67]  # Repetition penalty artifact
        
        # 362: Attention pattern artifact
        features[147] = features[42]  # Sentence start repetition
        
        # 363: Decoding strategy indicator
        features[148] = (features[65] + features[66] + features[67]) / 3
        
        # 364: Technical evasion composite
        features[149] = (features[143] + features[144] + features[145] + features[148]) / 4
        
        return features


    def _extract_humanizer_features(self, text: str, words: List[str],
                                     sentences: List[str], pos_tags: List[Tuple[str, str]]) -> np.ndarray:
        """
        Extract humanizer detection features (indices 365-564).
        
        Categories:
        - 365-379: Document Format
        - 380-399: Linguistic Obfuscation
        - 400-414: Statistical Disruption
        - 415-429: Model Specific
        - 430-444: Generation Time
        - 445-459: Post Processing
        - 460-474: Semantic Content
        - 475-484: Advanced Technical
        - 485-489: Emerging Experimental
        - 490-504: Stylometric Masking
        - 505-514: Multi Language
        - 515-524: Temporal Contextual
        - 525-534: Cognitive Mimicry
        - 535-544: Adversarial Learning
        - 545-554: Hybrid Ensemble
        - 555-564: Cutting Edge
        """
        features = np.zeros(200, dtype=np.float32)
        
        if not text or not words:
            return features
        
        text_lower = text.lower()
        word_count = len(words)
        sent_count = len(sentences) if sentences else 1
        char_count = len(text)
        
        # ========== 365-379: Document Format Features ==========
        # 365: PDF extraction indicator
        pdf_artifacts = len(re.findall(r'\f|\x0c', text))
        features[0] = pdf_artifacts
        
        # 366: OCR artifact density
        ocr_artifacts = len(re.findall(r'[Il1|O0]{2,}', text))
        features[1] = self._safe_divide(ocr_artifacts, char_count)
        
        # 367: Whitespace anomaly
        whitespace_ratio = sum(1 for c in text if c.isspace()) / max(char_count, 1)
        features[2] = whitespace_ratio
        
        # 368: Line break pattern
        line_breaks = text.count('\n')
        features[3] = self._safe_divide(line_breaks, sent_count)
        
        # 369: Tab character usage
        tabs = text.count('\t')
        features[4] = self._safe_divide(tabs, char_count)
        
        # 370: Non-breaking space usage
        nbsp = text.count('\u00A0')
        features[5] = nbsp
        
        # 371: Special whitespace characters
        special_ws = sum(1 for c in text if c in '\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A')
        features[6] = special_ws
        
        # 372: Format stripping indicator
        format_chars = len(re.findall(r'[\*_~`#]', text))
        features[7] = self._safe_divide(format_chars, char_count)
        
        # 373: Encoding anomaly
        encoding_issues = len(re.findall(r'[^\x00-\x7F]{3,}', text))
        features[8] = self._safe_divide(encoding_issues, char_count)
        
        # 374: Control character presence
        control_chars = sum(1 for c in text if ord(c) < 32 and c not in '\n\r\t')
        features[9] = control_chars
        
        # 375: Unicode normalization indicator
        import unicodedata
        nfc_text = unicodedata.normalize('NFC', text)
        nfd_text = unicodedata.normalize('NFD', text)
        features[10] = 1.0 if len(nfc_text) != len(nfd_text) else 0.0
        
        # 376: Bidirectional text markers
        bidi_markers = sum(1 for c in text if c in '\u200E\u200F\u202A\u202B\u202C\u202D\u202E')
        features[11] = bidi_markers
        
        # 377: Soft hyphen usage
        soft_hyphens = text.count('\u00AD')
        features[12] = soft_hyphens
        
        # 378: Document structure score
        features[13] = (features[3] + features[7]) / 2
        
        # 379: Format manipulation composite
        features[14] = (features[0] + features[5] + features[6] + features[11] + features[12]) / 5
        
        # ========== 380-399: Linguistic Obfuscation Features ==========
        # 380: Dependency randomization (clause order variation)
        clause_markers = ['which', 'that', 'who', 'where', 'when', 'while', 'although']
        clause_count = sum(1 for c in clause_markers if c in words)
        features[15] = self._safe_divide(clause_count, sent_count)
        
        # 381: Syntax variation score
        if sentences:
            sent_structures = []
            for s in sentences:
                s_words = self._tokenize_words(s)
                if s_words:
                    # Simple structure: first word type
                    first_word = s_words[0] if s_words else ''
                    sent_structures.append(first_word)
            unique_structures = len(set(sent_structures))
            features[16] = self._safe_divide(unique_structures, sent_count)
        
        # 382: Word order perturbation
        unusual_order = len(re.findall(r'\b(very|really|quite)\s+\w+ly\b', text_lower))
        features[17] = unusual_order
        
        # 383: Phrase restructuring
        restructured = len(re.findall(r'\b(not only|both|either|neither)\b', text_lower))
        features[18] = restructured
        
        # 384: Clause embedding depth
        embedding_markers = text.count('(') + text.count('[') + text.count('{')
        features[19] = self._safe_divide(embedding_markers, sent_count)
        
        # 385: Coordination variation
        coord_patterns = ['and', 'but', 'or', 'yet', 'so', 'for', 'nor']
        coord_count = sum(1 for c in coord_patterns if c in words)
        features[20] = self._safe_divide(coord_count, sent_count)
        
        # 386: Subordination variation
        subord_patterns = ['because', 'although', 'while', 'if', 'unless', 'until']
        subord_count = sum(1 for s in subord_patterns if s in words)
        features[21] = self._safe_divide(subord_count, sent_count)
        
        # 387: Relative clause density
        relative = ['who', 'whom', 'whose', 'which', 'that']
        rel_count = sum(1 for r in relative if r in words)
        features[22] = self._safe_divide(rel_count, sent_count)
        
        # 388: Appositive usage
        appositives = len(re.findall(r',\s*[a-z]+\s+[a-z]+\s*,', text_lower))
        features[23] = self._safe_divide(appositives, sent_count)
        
        # 389: Parenthetical insertion
        parentheticals = len(re.findall(r'\([^)]{5,}\)', text))
        features[24] = self._safe_divide(parentheticals, sent_count)
        
        # 390: Inversion patterns
        inversions = len(re.findall(r'\b(never|rarely|seldom|hardly)\s+\w+\s+\w+\b', text_lower))
        features[25] = inversions
        
        # 391: Cleft sentence patterns
        clefts = len(re.findall(r'\b(it is|it was)\s+\w+\s+that\b', text_lower))
        features[26] = clefts
        
        # 392: Pseudo-cleft patterns
        pseudo_clefts = len(re.findall(r'\bwhat\s+\w+\s+(is|was)\b', text_lower))
        features[27] = pseudo_clefts
        
        # 393: Extraposition patterns
        extraposition = len(re.findall(r'\bit\s+(is|was|seems)\s+\w+\s+that\b', text_lower))
        features[28] = extraposition
        
        # 394: Topicalization
        topicalization = len(re.findall(r'^[A-Z][a-z]+,\s+', text, re.MULTILINE))
        features[29] = topicalization
        
        # 395: Right dislocation
        right_disl = len(re.findall(r',\s+(it|they|he|she)\s*[.!?]', text_lower))
        features[30] = right_disl
        
        # 396: Left dislocation
        left_disl = len(re.findall(r'^(As for|Regarding|Concerning)\s+', text, re.MULTILINE | re.IGNORECASE))
        features[31] = left_disl
        
        # 397: Ellipsis patterns
        ellipsis = text.count('...')
        features[32] = self._safe_divide(ellipsis, sent_count)
        
        # 398: Linguistic obfuscation score
        features[33] = (features[15] + features[16] + features[20] + features[21]) / 4
        
        # 399: Syntax complexity score
        features[34] = (features[19] + features[22] + features[24]) / 3


        # ========== 400-414: Statistical Disruption Features ==========
        # 400: Perplexity engineering (word entropy deviation)
        word_entropy = self._calculate_word_entropy(words)
        features[35] = abs(word_entropy - 8.0)  # Deviation from typical
        
        # 401: Character entropy deviation
        char_entropy = self._calculate_entropy(text)
        features[36] = abs(char_entropy - 4.5)  # Deviation from typical
        
        # 402: Burstiness manipulation
        if sentences:
            sent_lengths = [len(self._tokenize_words(s)) for s in sentences]
            burstiness = np.std(sent_lengths) / max(np.mean(sent_lengths), 1)
            features[37] = burstiness
        
        # 403: Vocabulary distribution anomaly
        word_freq = Counter(words)
        freq_values = list(word_freq.values())
        features[38] = np.std(freq_values) if freq_values else 0
        
        # 404: Zipf's law deviation
        if word_freq:
            sorted_freqs = sorted(word_freq.values(), reverse=True)
            expected_zipf = [sorted_freqs[0] / (i + 1) for i in range(len(sorted_freqs))]
            deviation = sum(abs(a - b) for a, b in zip(sorted_freqs, expected_zipf))
            features[39] = deviation / max(len(sorted_freqs), 1)
        
        # 405: N-gram distribution anomaly
        if len(words) >= 2:
            bigrams = [tuple(words[i:i+2]) for i in range(len(words) - 1)]
            bigram_freq = Counter(bigrams)
            features[40] = len(bigram_freq) / max(len(bigrams), 1)
        
        # 406: Sentence length distribution
        if sentences:
            sent_lengths = [len(self._tokenize_words(s)) for s in sentences]
            features[41] = np.mean(sent_lengths) if sent_lengths else 0
        
        # 407: Word length distribution anomaly
        word_lengths = [len(w) for w in words]
        features[42] = np.std(word_lengths) if word_lengths else 0
        
        # 408: Punctuation distribution
        punct_count = sum(1 for c in text if c in string.punctuation)
        features[43] = self._safe_divide(punct_count, char_count)
        
        # 409: Whitespace distribution
        ws_count = sum(1 for c in text if c.isspace())
        features[44] = self._safe_divide(ws_count, char_count)
        
        # 410: Character class distribution
        upper_count = sum(1 for c in text if c.isupper())
        lower_count = sum(1 for c in text if c.islower())
        digit_count = sum(1 for c in text if c.isdigit())
        features[45] = self._safe_divide(upper_count, max(lower_count, 1))
        
        # 411: Token probability manipulation
        features[46] = features[38]  # Word frequency std as proxy
        
        # 412: Attention weight disruption
        features[47] = features[37]  # Burstiness as proxy
        
        # 413: Statistical signature score
        features[48] = (features[35] + features[36] + features[39]) / 3
        
        # 414: Distribution manipulation composite
        features[49] = (features[40] + features[42] + features[43]) / 3
        
        # ========== 415-429: Model Specific Features ==========
        # 415: GPTZero bypass pattern
        gptzero_bypass = features[37] + features[35]  # Burstiness + perplexity
        features[50] = gptzero_bypass
        
        # 416: Originality.ai bypass pattern
        originality_bypass = features[48] + features[33]  # Statistical + linguistic
        features[51] = originality_bypass
        
        # 417: Turnitin AI bypass pattern
        turnitin_bypass = features[14] + features[34]  # Format + syntax
        features[52] = turnitin_bypass
        
        # 418: ZeroGPT bypass pattern
        zerogpt_bypass = features[37] * features[16]  # Burstiness * syntax variation
        features[53] = zerogpt_bypass
        
        # 419: Copyleaks bypass pattern
        copyleaks_bypass = features[49] + features[33]
        features[54] = copyleaks_bypass
        
        # 420: Winston AI bypass pattern
        winston_bypass = features[35] + features[16]
        features[55] = winston_bypass
        
        # 421: Sapling bypass pattern
        sapling_bypass = features[36] + features[37]
        features[56] = sapling_bypass
        
        # 422: Writer.com bypass pattern
        writer_bypass = features[33] + features[34]
        features[57] = writer_bypass
        
        # 423: Crossplag bypass pattern
        crossplag_bypass = features[14] + features[49]
        features[58] = crossplag_bypass
        
        # 424: Content at Scale bypass
        cas_bypass = features[50] + features[51]
        features[59] = cas_bypass
        
        # 425: Multi-detector evasion score
        features[60] = (features[50] + features[51] + features[52] + features[53]) / 4
        
        # 426: Detection model confusion
        features[61] = np.std([features[50], features[51], features[52], features[53], features[54]])
        
        # 427: Classifier boundary manipulation
        features[62] = features[60] * features[61]
        
        # 428: Model-agnostic evasion
        features[63] = (features[48] + features[33] + features[14]) / 3
        
        # 429: Detector bypass composite
        features[64] = (features[60] + features[63]) / 2


        # ========== 430-444: Generation Time Features ==========
        # 430: Greedy decoding signature (low variance)
        features[65] = 1.0 - features[37]  # Inverse of burstiness
        
        # 431: Beam search signature (structured output)
        beam_indicators = features[16] * features[41]  # Syntax variation * avg sent length
        features[66] = beam_indicators
        
        # 432: Nucleus sampling signature (high variance)
        features[67] = features[37]  # Burstiness
        
        # 433: Top-k sampling signature
        unique_ratio = len(set(words)) / max(word_count, 1)
        features[68] = unique_ratio
        
        # 434: Temperature indicator (vocabulary diversity)
        features[69] = features[68]  # Unique word ratio
        
        # 435: Repetition penalty indicator
        word_freq = Counter(words)
        max_freq = max(word_freq.values()) if word_freq else 0
        features[70] = 1.0 - self._safe_divide(max_freq, word_count)
        
        # 436: Length penalty indicator
        features[71] = features[41] / 20  # Normalized avg sentence length
        
        # 437: Presence penalty indicator
        features[72] = features[68]  # Vocabulary diversity
        
        # 438: Frequency penalty indicator
        features[73] = features[70]  # Repetition penalty
        
        # 439: Stop sequence indicator
        stop_patterns = ['###', '---', '***', 'END', 'STOP']
        stop_count = sum(1 for s in stop_patterns if s in text)
        features[74] = stop_count
        
        # 440: Max tokens indicator
        features[75] = 1.0 if word_count > 500 else word_count / 500
        
        # 441: Truncation indicator
        truncation_markers = ['...', '[continued]', '[truncated]', 'to be continued']
        trunc_count = sum(1 for t in truncation_markers if t in text_lower)
        features[76] = trunc_count
        
        # 442: Generation parameter score
        features[77] = (features[65] + features[67] + features[69]) / 3
        
        # 443: Decoding strategy confidence
        features[78] = abs(features[65] - features[67])  # Greedy vs nucleus difference
        
        # 444: Generation signature composite
        features[79] = (features[77] + features[78]) / 2
        
        # ========== 445-459: Post Processing Features ==========
        # 445: Style transfer indicator
        style_markers = ['formal', 'casual', 'academic', 'conversational']
        style_count = sum(1 for s in style_markers if s in text_lower)
        features[80] = style_count
        
        # 446: Multi-pass rewriting indicator
        rewrite_markers = features[33] * features[48]  # Linguistic * statistical
        features[81] = rewrite_markers
        
        # 447: Human editing indicator
        edit_markers = ['[edit]', '[note]', '[update]', 'edited', 'updated']
        edit_count = sum(1 for e in edit_markers if e in text_lower)
        features[82] = edit_count
        
        # 448: Proofreading indicator
        proofread_quality = 1.0 - features[43]  # Inverse of punctuation density
        features[83] = proofread_quality
        
        # 449: Grammar correction indicator
        grammar_markers = ['which', 'whom', 'whose', 'that']
        grammar_count = sum(1 for g in grammar_markers if g in words)
        features[84] = self._safe_divide(grammar_count, sent_count)
        
        # 450: Vocabulary enhancement
        enhanced_vocab = sum(1 for w in words if len(w) > 8)
        features[85] = self._safe_divide(enhanced_vocab, word_count)
        
        # 451: Sentence restructuring
        features[86] = features[16]  # Syntax variation
        
        # 452: Paragraph reorganization
        paragraphs = [p for p in text.split('\n\n') if p.strip()]
        if paragraphs:
            para_lengths = [len(p.split()) for p in paragraphs]
            features[87] = np.std(para_lengths) if len(para_lengths) > 1 else 0
        
        # 453: Tone adjustment
        tone_markers = ['however', 'nevertheless', 'indeed', 'certainly']
        tone_count = sum(1 for t in tone_markers if t in words)
        features[88] = self._safe_divide(tone_count, sent_count)
        
        # 454: Formality adjustment
        formal_markers = ['therefore', 'consequently', 'furthermore', 'moreover']
        formal_count = sum(1 for f in formal_markers if f in words)
        features[89] = self._safe_divide(formal_count, sent_count)
        
        # 455: Simplification indicator
        simple_words = sum(1 for w in words if len(w) <= 4)
        features[90] = self._safe_divide(simple_words, word_count)
        
        # 456: Elaboration indicator
        elaboration = ['that is', 'in other words', 'specifically', 'namely']
        elab_count = sum(1 for e in elaboration if e in text_lower)
        features[91] = elab_count
        
        # 457: Condensation indicator
        features[92] = 1.0 - features[91] / max(sent_count, 1)
        
        # 458: Post-processing score
        features[93] = (features[81] + features[86] + features[88]) / 3
        
        # 459: Editing intensity composite
        features[94] = (features[82] + features[85] + features[87]) / 3


        # ========== 460-474: Semantic Content Features ==========
        # 460: Temporal anchor density
        temporal_anchors = len(re.findall(r'\b(yesterday|today|tomorrow|last\s+\w+|next\s+\w+|in\s+\d{4})\b', text_lower))
        features[95] = self._safe_divide(temporal_anchors, sent_count)
        
        # 461: Geographic reference density
        geo_refs = len(re.findall(r'\b(in|at|from|near)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b', text))
        features[96] = self._safe_divide(geo_refs, sent_count)
        
        # 462: Cultural reference density
        cultural = ['christmas', 'thanksgiving', 'easter', 'halloween', 'new year']
        cultural_count = sum(1 for c in cultural if c in text_lower)
        features[97] = cultural_count
        
        # 463: Pop culture reference
        pop_culture = ['movie', 'song', 'celebrity', 'tv show', 'social media']
        pop_count = sum(1 for p in pop_culture if p in text_lower)
        features[98] = pop_count
        
        # 464: Current events indicator
        current = ['recently', 'nowadays', 'these days', 'currently', 'at present']
        current_count = sum(1 for c in current if c in text_lower)
        features[99] = current_count
        
        # 465: Historical reference
        historical = ['historically', 'in the past', 'traditionally', 'centuries ago']
        hist_count = sum(1 for h in historical if h in text_lower)
        features[100] = hist_count
        
        # 466: Personal experience marker
        personal = ['i remember', 'in my experience', 'personally', 'i have seen']
        personal_count = sum(1 for p in personal if p in text_lower)
        features[101] = personal_count
        
        # 467: Anecdote indicator
        anecdote = ['one time', 'once', 'there was', 'i recall', 'story']
        anecdote_count = sum(1 for a in anecdote if a in text_lower)
        features[102] = anecdote_count
        
        # 468: Specific detail density
        specific = len(re.findall(r'\b\d+\s*(percent|%|dollars|\$|years|months|days)\b', text_lower))
        features[103] = self._safe_divide(specific, sent_count)
        
        # 469: Named entity density
        named_entities = len(re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b', text))
        features[104] = self._safe_divide(named_entities, sent_count)
        
        # 470: Quote usage
        quotes = len(re.findall(r'"[^"]{10,}"', text))
        features[105] = quotes
        
        # 471: Dialogue indicator
        dialogue = len(re.findall(r'"[^"]*"\s*(said|asked|replied|answered)', text_lower))
        features[106] = dialogue
        
        # 472: Sensory detail density
        sensory = ['saw', 'heard', 'felt', 'smelled', 'tasted', 'touched', 'looked', 'sounded']
        sensory_count = sum(1 for s in sensory if s in words)
        features[107] = self._safe_divide(sensory_count, word_count)
        
        # 473: Semantic richness score
        features[108] = (features[95] + features[96] + features[101] + features[103]) / 4
        
        # 474: Content authenticity composite
        features[109] = (features[101] + features[102] + features[107]) / 3
        
        # ========== 475-484: Advanced Technical Features ==========
        # 475: Embedding perturbation indicator
        features[110] = features[14]  # Format manipulation
        
        # 476: Watermark neutralization
        watermark_chars = sum(1 for c in text if c in self.ZERO_WIDTH_CHARS)
        features[111] = watermark_chars
        
        # 477: Token manipulation
        features[112] = features[49]  # Distribution manipulation
        
        # 478: Attention disruption
        features[113] = features[37]  # Burstiness
        
        # 479: Gradient masking
        features[114] = features[48]  # Statistical signature
        
        # 480: Feature space perturbation
        features[115] = (features[110] + features[112] + features[114]) / 3
        
        # 481: Model uncertainty exploitation
        features[116] = features[61]  # Detection model confusion
        
        # 482: Confidence calibration attack
        features[117] = features[62]  # Classifier boundary manipulation
        
        # 483: Ensemble attack indicator
        features[118] = features[60]  # Multi-detector evasion
        
        # 484: Technical evasion composite
        features[119] = (features[115] + features[116] + features[118]) / 3
        
        # ========== 485-489: Emerging Experimental Features ==========
        # 485: Adversarial training mimicry
        features[120] = features[119] * features[64]  # Technical * bypass
        
        # 486: GAN-based text generation
        features[121] = features[37] * features[68]  # Burstiness * diversity
        
        # 487: Reinforcement learning artifact
        features[122] = features[77]  # Generation parameter score
        
        # 488: Neural style transfer
        features[123] = features[93]  # Post-processing score
        
        # 489: Experimental technique composite
        features[124] = (features[120] + features[121] + features[122] + features[123]) / 4


        # ========== 490-504: Stylometric Masking Features ==========
        # 490: Function word manipulation
        function_words = ['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with']
        func_count = sum(1 for f in function_words if f in words)
        features[125] = self._safe_divide(func_count, word_count)
        
        # 491: Function word distribution
        func_positions = [i for i, w in enumerate(words) if w in function_words]
        if len(func_positions) > 1:
            gaps = [func_positions[i+1] - func_positions[i] for i in range(len(func_positions)-1)]
            features[126] = np.std(gaps) if gaps else 0
        
        # 492: POS pattern manipulation
        if pos_tags:
            pos_sequence = [tag for _, tag in pos_tags]
            pos_bigrams = [tuple(pos_sequence[i:i+2]) for i in range(len(pos_sequence)-1)]
            features[127] = len(set(pos_bigrams)) / max(len(pos_bigrams), 1)
        
        # 493: Sentence length manipulation
        if sentences:
            sent_lengths = [len(self._tokenize_words(s)) for s in sentences]
            features[128] = np.std(sent_lengths) if len(sent_lengths) > 1 else 0
        
        # 494: Word length manipulation
        word_lengths = [len(w) for w in words]
        features[129] = np.std(word_lengths) if word_lengths else 0
        
        # 495: Vocabulary richness manipulation
        features[130] = features[68]  # Unique word ratio
        
        # 496: Punctuation pattern manipulation
        punct_pattern = [c for c in text if c in string.punctuation]
        features[131] = len(set(punct_pattern)) / max(len(punct_pattern), 1) if punct_pattern else 0
        
        # 497: Capitalization pattern
        cap_pattern = sum(1 for c in text if c.isupper())
        features[132] = self._safe_divide(cap_pattern, char_count)
        
        # 498: Contraction manipulation
        contractions = len(re.findall(r"\b\w+'(t|s|re|ve|ll|d|m)\b", text_lower))
        features[133] = self._safe_divide(contractions, word_count)
        
        # 499: Pronoun distribution
        pronouns = ['i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']
        pronoun_count = sum(1 for p in pronouns if p in words)
        features[134] = self._safe_divide(pronoun_count, word_count)
        
        # 500: Adverb placement
        adverbs = [i for i, w in enumerate(words) if w.endswith('ly')]
        features[135] = len(adverbs) / max(word_count, 1)
        
        # 501: Adjective density
        if pos_tags:
            adj_count = sum(1 for _, tag in pos_tags if tag.startswith('JJ'))
            features[136] = self._safe_divide(adj_count, word_count)
        
        # 502: Verb tense distribution
        past_tense = sum(1 for w in words if w.endswith('ed'))
        present_tense = sum(1 for w in words if w.endswith('s') and len(w) > 2)
        features[137] = self._safe_divide(past_tense, max(present_tense, 1))
        
        # 503: Stylometric masking score
        features[138] = (features[125] + features[128] + features[130]) / 3
        
        # 504: Author fingerprint disruption
        features[139] = (features[126] + features[129] + features[131]) / 3
        
        # ========== 505-514: Multi Language Features ==========
        # 505: Pivot language indicator
        pivot_markers = ['in other words', 'that is to say', 'so to speak']
        pivot_count = sum(1 for p in pivot_markers if p in text_lower)
        features[140] = pivot_count
        
        # 506: Code-switching indicator
        code_switch = len(re.findall(r'\b[A-Za-z]+\s+[^\x00-\x7F]+|\b[^\x00-\x7F]+\s+[A-Za-z]+', text))
        features[141] = code_switch
        
        # 507: Loan word density
        loan_words = ['cafe', 'naive', 'resume', 'fiance', 'cliche', 'genre']
        loan_count = sum(1 for l in loan_words if l in words)
        features[142] = self._safe_divide(loan_count, word_count)
        
        # 508: Translation artifact
        translation_markers = ['it is that', 'there is that', 'one says']
        trans_count = sum(1 for t in translation_markers if t in text_lower)
        features[143] = trans_count
        
        # 509: Non-native speaker pattern
        non_native = ['make a decision', 'do a mistake', 'make a party']
        nn_count = sum(1 for n in non_native if n in text_lower)
        features[144] = nn_count
        
        # 510: Article usage anomaly
        article_ratio = sum(1 for w in words if w in ['a', 'an', 'the']) / max(word_count, 1)
        features[145] = abs(article_ratio - 0.08)  # Deviation from typical
        
        # 511: Preposition usage anomaly
        prepositions = ['in', 'on', 'at', 'to', 'for', 'with', 'by', 'from']
        prep_count = sum(1 for p in prepositions if p in words)
        features[146] = self._safe_divide(prep_count, word_count)
        
        # 512: Idiom usage
        idioms = ['break a leg', 'piece of cake', 'hit the road', 'under the weather']
        idiom_count = sum(1 for i in idioms if i in text_lower)
        features[147] = idiom_count
        
        # 513: Multi-language score
        features[148] = (features[140] + features[141] + features[143]) / 3
        
        # 514: Language transfer indicator
        features[149] = (features[144] + features[145] + features[146]) / 3
        
        # ========== 515-524: Temporal Contextual Features ==========
        # 515: Writing session simulation
        session_markers = ['continuing from', 'as mentioned', 'earlier', 'previously']
        session_count = sum(1 for s in session_markers if s in text_lower)
        features[150] = session_count
        
        # 516: Draft revision indicator
        revision_markers = ['actually', 'rather', 'instead', 'correction']
        revision_count = sum(1 for r in revision_markers if r in text_lower)
        features[151] = revision_count
        
        # 517: Thought progression
        progression = ['first', 'then', 'next', 'finally', 'lastly']
        prog_count = sum(1 for p in progression if p in words)
        features[152] = self._safe_divide(prog_count, sent_count)
        
        # 518: Interruption patterns
        interruptions = text.count('--') + text.count('—') + text.count('...')
        features[153] = self._safe_divide(interruptions, sent_count)
        
        # 519: Pause indicators
        pause_markers = ['um', 'uh', 'hmm', 'well', 'so']
        pause_count = sum(1 for p in pause_markers if p in words)
        features[154] = self._safe_divide(pause_count, word_count)
        
        # 520: Real-time composition
        realtime = ['wait', 'hold on', 'let me think', 'actually']
        realtime_count = sum(1 for r in realtime if r in text_lower)
        features[155] = realtime_count
        
        # 521: Editing trace
        edit_traces = ['[', ']', '(', ')', '*']
        trace_count = sum(text.count(t) for t in edit_traces)
        features[156] = self._safe_divide(trace_count, char_count)
        
        # 522: Version indicator
        version_markers = ['v1', 'v2', 'draft', 'revision', 'updated']
        version_count = sum(1 for v in version_markers if v in text_lower)
        features[157] = version_count
        
        # 523: Temporal authenticity score
        features[158] = (features[150] + features[151] + features[155]) / 3
        
        # 524: Writing process indicator
        features[159] = (features[152] + features[153] + features[154]) / 3
        
        # ========== 525-534: Cognitive Mimicry Features ==========
        # 525: Stream of consciousness
        stream_markers = ['and then', 'but wait', 'oh', 'hmm', 'anyway']
        stream_count = sum(1 for s in stream_markers if s in text_lower)
        features[160] = stream_count
        
        # 526: Uncertainty expression
        uncertainty = ['maybe', 'perhaps', 'possibly', 'i think', 'not sure']
        uncert_count = sum(1 for u in uncertainty if u in text_lower)
        features[161] = self._safe_divide(uncert_count, sent_count)
        
        # 527: Self-doubt patterns
        self_doubt = ['i guess', 'i suppose', 'i wonder', 'not certain']
        doubt_count = sum(1 for d in self_doubt if d in text_lower)
        features[162] = doubt_count
        
        # 528: Cognitive load markers
        cognitive = ['let me', 'trying to', 'thinking about', 'considering']
        cog_count = sum(1 for c in cognitive if c in text_lower)
        features[163] = cog_count
        
        # 529: Memory reference
        memory = ['i remember', 'i recall', 'as i remember', 'if i recall']
        mem_count = sum(1 for m in memory if m in text_lower)
        features[164] = mem_count
        
        # 530: Emotional expression
        emotional = ['feel', 'felt', 'feeling', 'emotion', 'happy', 'sad', 'angry', 'excited']
        emotion_count = sum(1 for e in emotional if e in words)
        features[165] = self._safe_divide(emotion_count, word_count)
        
        # 531: Intuition markers
        intuition = ['somehow', 'instinctively', 'gut feeling', 'sense that']
        intuit_count = sum(1 for i in intuition if i in text_lower)
        features[166] = intuit_count
        
        # 532: Reasoning chain
        reasoning = ['because', 'therefore', 'so', 'thus', 'hence', 'since']
        reason_count = sum(1 for r in reasoning if r in words)
        features[167] = self._safe_divide(reason_count, sent_count)
        
        # 533: Cognitive authenticity score
        features[168] = (features[160] + features[161] + features[163]) / 3
        
        # 534: Human thought pattern score
        features[169] = (features[162] + features[164] + features[165]) / 3
        
        # ========== 535-544: Adversarial Learning Features ==========
        # 535: Gradient attack signature
        features[170] = features[119]  # Technical evasion
        
        # 536: Black-box optimization
        features[171] = features[64]  # Detector bypass
        
        # 537: Transferability indicator
        features[172] = features[60]  # Multi-detector evasion
        
        # 538: Query-based attack
        features[173] = features[61]  # Detection model confusion
        
        # 539: Score-based attack
        features[174] = features[62]  # Classifier boundary
        
        # 540: Decision-based attack
        features[175] = features[63]  # Model-agnostic evasion
        
        # 541: Universal perturbation
        features[176] = features[14]  # Format manipulation
        
        # 542: Targeted evasion
        features[177] = features[64] * features[119]  # Bypass * technical
        
        # 543: Adversarial robustness
        features[178] = 1.0 - features[177]
        
        # 544: Adversarial learning composite
        features[179] = (features[170] + features[171] + features[172]) / 3
        
        # ========== 545-554: Hybrid Ensemble Features ==========
        # 545: Multi-humanizer chain
        features[180] = features[93] * features[64]  # Post-processing * bypass
        
        # 546: Sequential processing
        features[181] = features[81]  # Multi-pass rewriting
        
        # 547: Parallel processing
        features[182] = features[60]  # Multi-detector evasion
        
        # 548: Ensemble diversity
        features[183] = features[61]  # Detection model confusion
        
        # 549: Voting-based evasion
        features[184] = (features[50] + features[51] + features[52]) / 3  # Avg bypass scores
        
        # 550: Stacking indicator
        features[185] = features[180] * features[181]
        
        # 551: Boosting indicator
        features[186] = features[182] * features[183]
        
        # 552: Bagging indicator
        features[187] = features[184] * features[64]
        
        # 553: Ensemble attack score
        features[188] = (features[185] + features[186] + features[187]) / 3
        
        # 554: Hybrid processing composite
        features[189] = (features[180] + features[181] + features[188]) / 3
        
        # ========== 555-564: Cutting Edge Features ==========
        # 555: TAROT pattern (Token-Aware Rewriting for Obfuscation of Text)
        features[190] = features[112] * features[119]  # Token * technical
        
        # 556: LLMask pattern (LLM-based Masking)
        features[191] = features[64] * features[93]  # Bypass * post-processing
        
        # 557: Paraphrase attack
        features[192] = features[33] * features[48]  # Linguistic * statistical
        
        # 558: Style mimicry attack
        features[193] = features[138] * features[139]  # Stylometric masking * fingerprint
        
        # 559: Semantic preservation attack
        features[194] = features[108] * features[109]  # Semantic richness * authenticity
        
        # 560: Fluency preservation
        if TEXTSTAT_AVAILABLE:
            try:
                features[195] = textstat.flesch_reading_ease(text) / 100
            except:
                features[195] = 0.5
        else:
            features[195] = 0.5
        
        # 561: Coherence preservation
        features[196] = features[33]  # Linguistic obfuscation
        
        # 562: Detection evasion confidence
        features[197] = (features[190] + features[191] + features[192]) / 3
        
        # 563: Quality preservation score
        features[198] = (features[194] + features[195] + features[196]) / 3
        
        # 564: Cutting edge composite
        features[199] = (features[197] + features[198]) / 2
        
        return features


    def extract_all(self, text: str) -> np.ndarray:
        """
        Extract all 565 features from the input text.
        
        Args:
            text: Input text to analyze
            
        Returns:
            np.ndarray: Feature vector of shape (565,)
        """
        # Handle empty/None text
        if not text or not isinstance(text, str):
            return np.zeros(565, dtype=np.float32)
        
        # Clean text
        text = text.strip()
        if not text:
            return np.zeros(565, dtype=np.float32)
        
        # Tokenize
        words = self._tokenize_words(text)
        sentences = self._tokenize_sentences(text)
        pos_tags = self._get_pos_tags(words)
        
        # Extract features from each category
        plagiarism_features = self._extract_plagiarism_features(text, words, sentences, pos_tags)
        ai_detection_features = self._extract_ai_detection_features(text, words, sentences, pos_tags)
        humanizer_features = self._extract_humanizer_features(text, words, sentences, pos_tags)
        
        # Concatenate all features
        all_features = np.concatenate([
            plagiarism_features,      # 0-214 (215 features)
            ai_detection_features,    # 215-364 (150 features)
            humanizer_features        # 365-564 (200 features)
        ])
        
        # Ensure correct shape
        assert all_features.shape == (565,), f"Expected shape (565,), got {all_features.shape}"
        
        return all_features
    
    def get_feature_names(self) -> List[str]:
        """
        Get names for all 565 features.
        
        Returns:
            List[str]: List of feature names
        """
        names = []
        
        # Plagiarism features (0-214)
        plagiarism_categories = [
            (0, 19, "text_structure"),
            (20, 44, "lexical_manipulation"),
            (45, 59, "semantic_transformation"),
            (60, 74, "character_level"),
            (75, 84, "translation_based"),
            (85, 94, "citation_manipulation"),
            (95, 109, "content_augmentation"),
            (110, 124, "algorithm_specific"),
            (125, 139, "obfuscation_levels"),
            (140, 149, "paraphrasing_tool"),
            (150, 159, "semantic_role"),
            (160, 169, "discourse_level"),
            (170, 179, "source_specific"),
            (180, 189, "multi_document"),
            (190, 199, "technical_evasion"),
            (200, 214, "emerging_advanced"),
        ]
        
        for start, end, category in plagiarism_categories:
            for i in range(start, end + 1):
                names.append(f"plag_{category}_{i}")
        
        # AI detection features (215-364)
        ai_categories = [
            (215, 234, "character_manipulation"),
            (235, 259, "linguistic_stylistic"),
            (260, 279, "semantic_content"),
            (280, 294, "prompt_engineering"),
            (295, 306, "paraphrasing"),
            (307, 321, "adversarial_ml"),
            (322, 331, "structural_format"),
            (332, 339, "hybrid_multisource"),
            (340, 349, "cognitive_patterns"),
            (350, 357, "imperfection_error"),
            (358, 364, "specialized_technical"),
        ]
        
        for start, end, category in ai_categories:
            for i in range(start, end + 1):
                names.append(f"ai_{category}_{i}")
        
        # Humanizer features (365-564)
        humanizer_categories = [
            (365, 379, "document_format"),
            (380, 399, "linguistic_obfuscation"),
            (400, 414, "statistical_disruption"),
            (415, 429, "model_specific"),
            (430, 444, "generation_time"),
            (445, 459, "post_processing"),
            (460, 474, "semantic_content"),
            (475, 484, "advanced_technical"),
            (485, 489, "emerging_experimental"),
            (490, 504, "stylometric_masking"),
            (505, 514, "multi_language"),
            (515, 524, "temporal_contextual"),
            (525, 534, "cognitive_mimicry"),
            (535, 544, "adversarial_learning"),
            (545, 554, "hybrid_ensemble"),
            (555, 564, "cutting_edge"),
        ]
        
        for start, end, category in humanizer_categories:
            for i in range(start, end + 1):
                names.append(f"human_{category}_{i}")
        
        return names


def extract_features_for_triboost(text: str) -> np.ndarray:
    """
    Convenience function to extract features for TriBoost ensemble.
    
    Args:
        text: Input text to analyze
        
    Returns:
        np.ndarray: Feature vector of shape (565,)
    """
    extractor = FeatureExtractor565()
    return extractor.extract_all(text)


def extract_features_batch(texts: List[str]) -> np.ndarray:
    """
    Extract features from multiple texts in batch.
    
    Args:
        texts: List of input texts to analyze
        
    Returns:
        np.ndarray: Feature matrix of shape (n_texts, 565)
    """
    extractor = FeatureExtractor565()
    features = []
    
    for text in texts:
        features.append(extractor.extract_all(text))
    
    return np.array(features)


if __name__ == "__main__":
    # Demonstration with sample texts
    print("=" * 70)
    print("FeatureExtractor565 - Demonstration")
    print("=" * 70)
    
    # Sample human-written text
    human_text = """
    I remember the first time I tried to learn programming. It was back in 2015, 
    and honestly, I had no idea what I was doing. My friend Jake told me to start 
    with Python, but I was stubborn and picked C++ instead. Big mistake! I spent 
    like three weeks just trying to understand pointers. Eventually, I gave up and 
    switched to Python. Best decision ever. Now I actually enjoy coding, though I 
    still get frustrated sometimes when bugs take forever to fix. Anyway, that's 
    my story. What about you? How did you get into programming?
    """
    
    # Sample AI-generated text
    ai_text = """
    In the realm of software development, programming languages serve as fundamental 
    tools that enable developers to create sophisticated applications. It is worth 
    noting that Python has emerged as one of the most popular programming languages 
    in recent years. Furthermore, its versatility and ease of use make it an excellent 
    choice for beginners and experienced developers alike. Moreover, the extensive 
    ecosystem of libraries and frameworks available for Python facilitates rapid 
    development across various domains. In conclusion, mastering a programming 
    language is essential for anyone seeking to pursue a career in technology.
    """
    
    # Sample humanized AI text (with evasion attempts)
    humanized_text = """
    So I've been thinking about programming languages lately... Python is pretty 
    cool, I guess? Like, it's definitely easier than some other languages I've 
    tried. My coworker Sarah uses it all the time for her data analysis stuff. 
    She showed me some code last Tuesday and I was like "wow, that's actually 
    readable!" Ha. Anyway, I'm still learning but it's going okay. Sometimes I 
    get stuck on weird errors though. Yesterday I spent 2 hours debugging a 
    simple typo. Ugh. But yeah, overall I'd recommend Python to beginners.
    """
    
    # Initialize extractor
    extractor = FeatureExtractor565()
    
    # Extract features
    print("\nExtracting features from sample texts...")
    print("-" * 70)
    
    texts = {
        "Human-written": human_text,
        "AI-generated": ai_text,
        "Humanized AI": humanized_text
    }
    
    for name, text in texts.items():
        features = extractor.extract_all(text)
        print(f"\n{name} text:")
        print(f"  Total features: {len(features)}")
        print(f"  Feature shape: {features.shape}")
        print(f"  Non-zero features: {np.count_nonzero(features)}")
        print(f"  Feature range: [{features.min():.4f}, {features.max():.4f}]")
        print(f"  Feature mean: {features.mean():.4f}")
        print(f"  Feature std: {features.std():.4f}")
        
        # Show some key features
        print(f"\n  Key feature values:")
        print(f"    - Plagiarism risk (idx 214): {features[214]:.4f}")
        print(f"    - AI content probability (idx 279): {features[279]:.4f}")
        print(f"    - Zero-width chars (idx 60): {features[60]:.4f}")
        print(f"    - QuillBot signature (idx 140): {features[140]:.4f}")
        print(f"    - Personal pronoun density (idx 260): {features[260]:.4f}")
        print(f"    - Burstiness (idx 235): {features[235]:.4f}")
    
    # Batch extraction demo
    print("\n" + "-" * 70)
    print("Batch extraction demo:")
    batch_features = extract_features_batch(list(texts.values()))
    print(f"  Batch shape: {batch_features.shape}")
    print(f"  Expected: (3, 565)")
    
    # Feature names demo
    print("\n" + "-" * 70)
    print("Feature names (first 10 and last 10):")
    feature_names = extractor.get_feature_names()
    print(f"  First 10: {feature_names[:10]}")
    print(f"  Last 10: {feature_names[-10:]}")
    
    print("\n" + "=" * 70)
    print("Demonstration complete!")
    print("=" * 70)
