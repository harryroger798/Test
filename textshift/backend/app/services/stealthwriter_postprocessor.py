"""
Stealthwriter Post-Processor V7

Two-stage post-processor that combines:
1. Advanced Stealthwriter Humanizer - vocabulary substitutions, informal replacements
2. Aggressive Post-Processor - progressive tense, contraction expansion, comma removal

Based on analysis of 50 verified Stealthwriter pairs that achieved 0-10% AI detection.
"""

import re
import random
from typing import Dict, Any


class StealthwriterPostProcessor:
    """
    Post-processor designed to bypass Stealthwriter AI detection.
    
    Applies transformations learned from actual Stealthwriter outputs:
    - Progressive tense conversion
    - Contraction expansion
    - Informal word substitutions
    - Comma removal before conjunctions
    - Filler word insertion
    - Sentence restructuring
    """
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        
        # Progressive tense conversions
        self.progressive_verbs = {
            'watched': 'was watching',
            'sat': 'was sitting',
            'stood': 'was standing',
            'walked': 'was walking',
            'talked': 'was talking',
            'looked': 'was looking',
            'waited': 'was waiting',
            'worked': 'was working',
            'listened': 'was listening',
            'thought': 'was thinking',
            'tried': 'was trying',
            'started': 'was starting',
            'began': 'was beginning',
            'ran': 'was running',
            'came': 'was coming',
            'went': 'was going',
            'made': 'was making',
            'took': 'was taking',
            'got': 'was getting',
            'said': 'was saying',
            'told': 'was telling',
            'asked': 'was asking',
            'felt': 'was feeling',
            'found': 'was finding',
            'gave': 'was giving',
            'used': 'was using',
            'called': 'was calling',
            'moved': 'was moving',
            'lived': 'was living',
            'played': 'was playing',
            'learned': 'was learning',
            'changed': 'was changing',
            'helped': 'was helping',
            'showed': 'was showing',
            'turned': 'was turning',
            'kept': 'was keeping',
            'held': 'was holding',
            'brought': 'was bringing',
            'spent': 'was spending',
            'left': 'was leaving',
            'met': 'was meeting',
            'sent': 'was sending',
            'built': 'was building',
            'grew': 'was growing',
            'opened': 'was opening',
            'closed': 'was closing',
            'reached': 'was reaching',
            'remembered': 'was remembering',
            'considered': 'was considering',
            'appeared': 'was appearing',
            'expected': 'was expecting',
            'served': 'was serving',
            'received': 'was receiving',
            'returned': 'was returning',
            'suggested': 'was suggesting',
            'raised': 'was raising',
            'passed': 'was passing',
            'decided': 'was deciding',
            'developed': 'was developing',
            'continued': 'was continuing',
            'happened': 'was happening',
            'included': 'was including',
            'offered': 'was offering',
            'discussed': 'was discussing',
            'agreed': 'was agreeing',
            'arrived': 'was arriving',
            'noticed': 'was noticing',
            'described': 'was describing',
            'stopped': 'was stopping',
            'created': 'was creating',
            'spoke': 'was speaking',
            'accepted': 'was accepting',
            'hoped': 'was hoping',
            'planned': 'was planning',
            'wondered': 'was wondering',
            'mentioned': 'was mentioning',
            'remained': 'was remaining',
            'studied': 'was studying',
            'followed': 'was following',
            'produced': 'was producing',
            'added': 'was adding',
            'provided': 'was providing',
            'achieved': 'was achieving',
            'performed': 'was performing',
            'increased': 'was increasing',
            'managed': 'was managing',
            'enjoyed': 'was enjoying',
            'led': 'was leading',
            'discovered': 'was discovering',
            'presented': 'was presenting',
            'involved': 'was involving',
            'expressed': 'was expressing',
            'introduced': 'was introducing',
            'applied': 'was applying',
            'prepared': 'was preparing',
            'explained': 'was explaining',
            'improved': 'was improving',
            'stated': 'was stating',
            'designed': 'was designing',
            'supported': 'was supporting',
            'recognized': 'was recognizing',
            'generated': 'was generating',
            'shared': 'was sharing',
        }
        
        # Contractions to expand (Stealthwriter expands these)
        self.contractions = {
            "didn't": "did not",
            "wasn't": "was not",
            "couldn't": "could not",
            "wouldn't": "would not",
            "shouldn't": "should not",
            "isn't": "is not",
            "aren't": "are not",
            "won't": "will not",
            "can't": "cannot",
            "don't": "do not",
            "doesn't": "does not",
            "haven't": "have not",
            "hasn't": "has not",
            "hadn't": "had not",
            "I'm": "I am",
            "I've": "I have",
            "I'll": "I will",
            "I'd": "I would",
            "he's": "he is",
            "she's": "she is",
            "it's": "it is",
            "that's": "that is",
            "there's": "there is",
            "here's": "here is",
            "what's": "what is",
            "who's": "who is",
            "we're": "we are",
            "they're": "they are",
            "you're": "you are",
            "we've": "we have",
            "they've": "they have",
            "you've": "you have",
            "we'll": "we will",
            "they'll": "they will",
            "you'll": "you will",
            "let's": "let us",
        }
        
        # Formal to informal substitutions
        self.informal_subs = {
            'utilize': 'use',
            'purchase': 'buy',
            'commence': 'start',
            'terminate': 'end',
            'facilitate': 'help',
            'demonstrate': 'show',
            'indicate': 'show',
            'require': 'need',
            'obtain': 'get',
            'provide': 'give',
            'assist': 'help',
            'possess': 'have',
            'numerous': 'many',
            'sufficient': 'enough',
            'approximately': 'about',
            'subsequently': 'then',
            'previously': 'before',
            'currently': 'now',
            'frequently': 'often',
            'immediately': 'right away',
            'significantly': 'a lot',
            'substantially': 'a lot',
            'extremely': 'very',
            'particularly': 'especially',
            'essentially': 'basically',
            'primarily': 'mainly',
            'additionally': 'also',
            'furthermore': 'also',
            'moreover': 'also',
            'however': 'but',
            'therefore': 'so',
            'consequently': 'so',
            'nevertheless': 'still',
            'nonetheless': 'still',
            'regarding': 'about',
            'concerning': 'about',
            'endeavor': 'try',
            'attempt': 'try',
            'accomplish': 'do',
            'implement': 'use',
            'establish': 'set up',
            'construct': 'build',
            'manufacture': 'make',
            'acquire': 'get',
            'comprehend': 'understand',
            'perceive': 'see',
            'observe': 'see',
            'examine': 'look at',
            'investigate': 'look into',
            'analyze': 'look at',
            'evaluate': 'check',
            'assess': 'check',
            'determine': 'find out',
            'ascertain': 'find out',
            'communicate': 'talk',
            'converse': 'talk',
            'inquire': 'ask',
            'respond': 'answer',
            'reside': 'live',
            'relocate': 'move',
            'depart': 'leave',
            'proceed': 'go',
            'diminish': 'reduce',
            'augment': 'increase',
            'enhance': 'improve',
            'modify': 'change',
            'alter': 'change',
            'transform': 'change',
            'eliminate': 'remove',
            'preserve': 'keep',
            'maintain': 'keep',
            'retain': 'keep',
            'cease': 'stop',
            'initiate': 'start',
            'conclude': 'end',
            'finalize': 'finish',
            'complete': 'finish',
            'in recent years': 'lately',
            'vast amounts of': 'lots of',
            'remarkable accuracy': 'really good accuracy',
            'unprecedented pace': 'very fast pace',
            'significant challenges': 'big challenges',
        }
        
        # Sentence starters for human feel
        self.sentence_starters = [
            "I think ",
            "You know, ",
            "Actually, ",
            "To be honest, ",
            "In my opinion, ",
            "From what I can tell, ",
            "It seems like ",
            "Basically, ",
            "The thing is, ",
        ]
        
        # Filler words
        self.fillers = ['actually', 'basically', 'really', 'just', 'kind of', 'sort of']
        
        # Verbs that take 'that' after them
        self.that_verbs = [
            'said', 'told', 'thought', 'believed', 'knew', 'felt', 'realized',
            'understood', 'noticed', 'saw', 'heard', 'found', 'discovered',
            'learned', 'remembered', 'hoped', 'wished', 'wanted', 'expected',
        ]
    
    def _expand_contractions(self, text: str) -> str:
        """Expand all contractions."""
        result = text
        for contraction, expansion in self.contractions.items():
            result = result.replace(contraction, expansion)
            result = result.replace(contraction.capitalize(), expansion.capitalize())
        return result
    
    def _apply_informal_subs(self, text: str) -> str:
        """Replace formal words with informal equivalents."""
        result = text
        for formal, informal in self.informal_subs.items():
            pattern = r'\b' + re.escape(formal) + r'\b'
            result = re.sub(pattern, informal, result, flags=re.IGNORECASE)
        return result
    
    def _apply_progressive_tense(self, text: str, probability: float = 0.25) -> str:
        """Convert some past tense verbs to progressive tense."""
        result = text
        for verb, progressive in self.progressive_verbs.items():
            if random.random() < probability:
                pattern = r'\b' + re.escape(verb) + r'\b'
                result = re.sub(pattern, progressive, result, count=1, flags=re.IGNORECASE)
        return result
    
    def _remove_commas(self, text: str) -> str:
        """Remove commas before conjunctions (Stealthwriter pattern)."""
        result = re.sub(r',\s*(and|but|or)\s+', r' \1 ', text)
        return result
    
    def _insert_that(self, text: str, probability: float = 0.3) -> str:
        """Insert 'that' after verbs that commonly take it."""
        result = text
        for verb in self.that_verbs:
            if random.random() < probability:
                pattern = r'\b(' + re.escape(verb) + r')\s+(?!that\b)(\w)'
                replacement = r'\1 that \2'
                result = re.sub(pattern, replacement, result, count=1, flags=re.IGNORECASE)
        return result
    
    def _add_filler_words(self, text: str, probability: float = 0.12) -> str:
        """Add filler words for human feel."""
        sentences = re.split(r'(?<=[.!?])\s+', text)
        result_sentences = []
        
        for sentence in sentences:
            if random.random() < probability and len(sentence.split()) > 8:
                filler = random.choice(self.fillers)
                words = sentence.split()
                insert_pos = random.randint(2, min(4, len(words)-1))
                words.insert(insert_pos, filler)
                sentence = ' '.join(words)
            result_sentences.append(sentence)
        
        return ' '.join(result_sentences)
    
    def _add_sentence_starters(self, text: str, probability: float = 0.15) -> str:
        """Add human-like sentence starters."""
        sentences = re.split(r'(?<=[.!?])\s+', text)
        result_sentences = []
        
        for i, sentence in enumerate(sentences):
            if i > 0 and random.random() < probability and len(sentence) > 20:
                starter = random.choice(self.sentence_starters)
                if sentence and sentence[0].isupper():
                    sentence = sentence[0].lower() + sentence[1:]
                sentence = starter + sentence
            result_sentences.append(sentence)
        
        return ' '.join(result_sentences)
    
    def _restructure_sentences(self, text: str) -> str:
        """Restructure some sentences for variety."""
        sentences = re.split(r'(?<=[.!?])\s+', text)
        result_sentences = []
        
        for sentence in sentences:
            if random.random() < 0.15:
                time_patterns = [
                    r'(.*?)\s+(lately|recently|nowadays|today|now)([.!?])$',
                    r'(.*?)\s+(last year|last month|last week|yesterday)([.!?])$',
                ]
                for pattern in time_patterns:
                    match = re.match(pattern, sentence, re.IGNORECASE)
                    if match:
                        main_part = match.group(1)
                        time_phrase = match.group(2)
                        punct = match.group(3)
                        sentence = f"{time_phrase.capitalize()}, {main_part[0].lower()}{main_part[1:]}{punct}"
                        break
            
            result_sentences.append(sentence)
        
        return ' '.join(result_sentences)
    
    def _clean_text(self, text: str) -> str:
        """Clean up the text."""
        result = re.sub(r'\s+', ' ', text).strip()
        result = re.sub(r'\s+([.,!?])', r'\1', result)
        result = re.sub(r'([.,!?])([A-Za-z])', r'\1 \2', result)
        return result
    
    def process(self, text: str, intensity: str = 'high') -> Dict[str, Any]:
        """
        Apply all Stealthwriter-style post-processing transformations.
        
        Args:
            text: Input text to process (typically output from Final Humanizer)
            intensity: 'low', 'medium', or 'high'
        
        Returns:
            Dict with processed_text and transformations_applied
        """
        if not text or len(text.strip()) < 10:
            return {
                "processed_text": text,
                "transformations_applied": []
            }
        
        result = text
        transformations = []
        
        # Always apply these
        result = self._expand_contractions(result)
        transformations.append("expand_contractions")
        
        result = self._apply_informal_subs(result)
        transformations.append("informal_substitutions")
        
        result = self._remove_commas(result)
        transformations.append("remove_commas")
        
        # Intensity-based transformations
        if intensity in ['medium', 'high']:
            prob = 0.15 if intensity == 'medium' else 0.25
            result = self._apply_progressive_tense(result, probability=prob)
            transformations.append("progressive_tense")
            
            result = self._insert_that(result, probability=prob)
            transformations.append("insert_that")
        
        if intensity == 'high':
            result = self._add_filler_words(result, probability=0.12)
            transformations.append("filler_words")
            
            result = self._add_sentence_starters(result, probability=0.15)
            transformations.append("sentence_starters")
            
            result = self._restructure_sentences(result)
            transformations.append("restructure_sentences")
        
        result = self._clean_text(result)
        
        return {
            "processed_text": result,
            "transformations_applied": transformations
        }
    
    def get_info(self) -> Dict[str, str]:
        """Get information about the post-processor."""
        return {
            "name": "Stealthwriter Post-Processor V7",
            "version": "7.0",
            "technique": "Progressive tense + contraction expansion + informal subs + comma removal",
            "target": "Bypass Stealthwriter AI detection",
            "expected_results": {
                "stealthwriter": "<10% AI detection",
                "originality_ai": "Maintains low detection from Stage 1"
            }
        }


# Singleton instance
stealthwriter_postprocessor = StealthwriterPostProcessor()
