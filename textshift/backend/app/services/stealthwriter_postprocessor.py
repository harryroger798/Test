"""
Stealthwriter Post-Processor V8

Redesigned post-processor that bypasses Stealthwriter AI detection by:
1. KEEPING contractions (natural human writing uses contractions)
2. Converting expanded forms BACK to contractions
3. Breaking long AI-style sentences into shorter varied ones
4. Replacing AI-characteristic phrases with casual alternatives
5. Mixing sentence lengths for natural rhythm
6. Adding casual touches and personal perspective

Key insight: V7 was EXPANDING contractions which made text MORE formal
and MORE detectable. Stealthwriter flags formal/stiff writing.
V8 does the opposite - makes text more casual and natural.
"""

import re
import random
from typing import Dict, Any, List


class StealthwriterPostProcessor:
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

        self.expanded_to_contraction = {
            "it is": "it's",
            "do not": "don't",
            "does not": "doesn't",
            "did not": "didn't",
            "cannot": "can't",
            "can not": "can't",
            "will not": "won't",
            "would not": "wouldn't",
            "could not": "couldn't",
            "should not": "shouldn't",
            "is not": "isn't",
            "are not": "aren't",
            "was not": "wasn't",
            "were not": "weren't",
            "has not": "hasn't",
            "have not": "haven't",
            "had not": "hadn't",
            "I am": "I'm",
            "I have": "I've",
            "I will": "I'll",
            "I would": "I'd",
            "you are": "you're",
            "you have": "you've",
            "you will": "you'll",
            "we are": "we're",
            "we have": "we've",
            "we will": "we'll",
            "they are": "they're",
            "they have": "they've",
            "they will": "they'll",
            "that is": "that's",
            "there is": "there's",
            "here is": "here's",
            "what is": "what's",
            "who is": "who's",
            "let us": "let's",
            "he is": "he's",
            "she is": "she's",
        }

        self.ai_phrase_replacements = {
            "in the journey of life": "in life",
            "in the journey of": "when it comes to",
            "navigate the complexities of existence": "deal with life's ups and downs",
            "navigate the complexities of": "deal with",
            "navigate the complexities": "deal with the tough parts",
            "complexities of existence": "ups and downs of life",
            "resilience and quiet strength": "toughness and a bit of grit",
            "offering comfort beyond explanation": "giving comfort you can't really put into words",
            "carrying our emotions with": "handling our feelings with",
            "seek clarity": "look for answers",
            "we truly need": "we actually need",
            "continue to move forward": "keep pushing ahead",
            "move forward": "keep going",
            "silence speaks louder than words": "silence says more than words ever could",
            "in the realm of": "when it comes to",
            "it is important to note that": "worth mentioning,",
            "it is worth noting that": "interestingly,",
            "it should be noted that": "keep in mind,",
            "in today's rapidly evolving": "in today's fast-changing",
            "in an increasingly": "in a more and more",
            "the importance of": "how much",
            "a wide range of": "all kinds of",
            "a variety of": "different",
            "a significant number of": "quite a few",
            "plays a crucial role": "really matters",
            "plays an important role": "matters a lot",
            "it is essential to": "you really gotta",
            "it is crucial to": "it's really important to",
            "it is imperative that": "we really need to",
            "serves as a testament to": "shows just how much",
            "on the other hand": "then again",
            "in addition to": "on top of",
            "as a result of": "because of",
            "due to the fact that": "since",
            "for the purpose of": "to",
            "with regard to": "about",
            "in terms of": "when it comes to",
            "in light of": "given",
            "it goes without saying that": "obviously,",
            "as a matter of fact": "actually",
            "by and large": "mostly",
            "for the most part": "usually",
            "at the end of the day": "when it comes down to it",
            "taking into account": "considering",
            "with this in mind": "knowing this",
            "having said that": "that said",
            "in the event that": "if",
            "for the time being": "for now",
            "at this point in time": "right now",
            "in the near future": "soon",
            "has the potential to": "could",
            "is capable of": "can",
            "in order to": "to",
            "for the sake of": "for",
            "on account of": "because of",
            "subsequent to": "after",
            "prior to": "before",
            "in the wake of": "after",
        }

        self.informal_word_subs = {
            'utilize': 'use',
            'facilitate': 'help',
            'demonstrate': 'show',
            'indicate': 'point to',
            'numerous': 'tons of',
            'sufficient': 'enough',
            'approximately': 'roughly',
            'subsequently': 'then',
            'previously': 'before',
            'currently': 'right now',
            'frequently': 'a lot',
            'significantly': 'really',
            'essentially': 'basically',
            'primarily': 'mainly',
            'additionally': 'plus',
            'furthermore': 'and also',
            'moreover': 'on top of that',
            'therefore': 'so',
            'consequently': 'so',
            'nevertheless': 'but still',
            'nonetheless': 'even so',
            'endeavor': 'try',
            'accomplish': 'pull off',
            'comprehend': 'get',
            'navigate': 'deal with',
            'resilience': 'toughness',
            'existence': 'life',
        }

        self.casual_sentence_enders = [
            ", honestly.",
            ", you know?",
            ", right?",
            " -- at least that's how I see it.",
            ". That's just how it goes.",
            ", if that makes sense.",
            " -- and I think that matters.",
        ]

        self.casual_transitions = [
            "And honestly, ",
            "The thing is, ",
            "Here's the deal -- ",
            "Look, ",
            "I mean, ",
            "So basically, ",
            "But here's what gets me -- ",
        ]

        self.sentence_break_patterns = [
            (r',\s*yet\s+', ". But "),
            (r',\s*while\s+', ". Meanwhile "),
            (r',\s*although\s+', ". Even though "),
            (r',\s*whereas\s+', ". But "),
        ]
    
    def _contract_expanded_forms(self, text):
        result = text
        sorted_expansions = sorted(self.expanded_to_contraction.items(),
                                   key=lambda x: len(x[0]), reverse=True)
        for expanded, contraction in sorted_expansions:
            pattern = re.compile(r'\b' + re.escape(expanded) + r'\b', re.IGNORECASE)
            matches = list(pattern.finditer(result))
            for match in reversed(matches):
                original = match.group()
                if original[0].isupper():
                    replacement = contraction[0].upper() + contraction[1:]
                else:
                    replacement = contraction
                result = result[:match.start()] + replacement + result[match.end():]
        return result

    def _replace_ai_phrases(self, text):
        result = text
        sorted_phrases = sorted(self.ai_phrase_replacements.items(),
                                key=lambda x: len(x[0]), reverse=True)
        for phrase, replacement in sorted_phrases:
            pattern = re.compile(re.escape(phrase), re.IGNORECASE)
            matches = list(pattern.finditer(result))
            for match in reversed(matches):
                original = match.group()
                if original[0].isupper():
                    new_replacement = replacement[0].upper() + replacement[1:]
                else:
                    new_replacement = replacement
                result = result[:match.start()] + new_replacement + result[match.end():]
        return result

    def _apply_informal_subs(self, text):
        result = text
        for formal, informal in self.informal_word_subs.items():
            pattern = r'\b' + re.escape(formal) + r'\b'
            result = re.sub(pattern, informal, result, flags=re.IGNORECASE)
        return result

    def _break_long_sentences(self, text):
        sentences = re.split(r'(?<=[.!?])\s+', text)
        result = []
        for sentence in sentences:
            words = sentence.split()
            if len(words) > 25:
                for pat, repl in self.sentence_break_patterns:
                    if re.search(pat, sentence):
                        sentence = re.sub(pat, repl, sentence, count=1)
                        break
                else:
                    em_dash_parts = sentence.split('\u2014')
                    if len(em_dash_parts) > 1 and len(em_dash_parts[0].split()) > 8:
                        first = em_dash_parts[0].rstrip()
                        rest = '\u2014'.join(em_dash_parts[1:]).strip()
                        if rest and rest[0].islower():
                            rest = rest[0].upper() + rest[1:]
                        sentence = first + ". " + rest
            result.append(sentence)
        return ' '.join(result)

    def _remove_commas_before_conjunctions(self, text):
        return re.sub(r',\s*(and|but|or)\s+', r' \1 ', text)

    def _add_casual_touches(self, text, probability=0.25):
        sentences = re.split(r'(?<=[.!?])\s+', text)
        result = []
        for i, sentence in enumerate(sentences):
            if i > 0 and i < len(sentences) - 1 and random.random() < probability * 0.4:
                transition = random.choice(self.casual_transitions)
                if sentence and sentence[0].isupper():
                    sentence = transition + sentence[0].lower() + sentence[1:]
            if (random.random() < probability * 0.3
                    and sentence.endswith('.')
                    and len(sentence.split()) > 5):
                ender = random.choice(self.casual_sentence_enders)
                sentence = sentence[:-1] + ender
            result.append(sentence)
        return ' '.join(result)

    def _vary_sentence_lengths(self, text):
        sentences = re.split(r'(?<=[.!?])\s+', text)
        if len(sentences) < 3:
            return text
        result = []
        for sentence in sentences:
            words = sentence.split()
            if len(words) > 20 and random.random() < 0.35:
                mid = len(words) // 2
                search_start = max(mid - 4, 4)
                search_end = min(mid + 4, len(words) - 3)
                split_at = None
                for j in range(search_start, search_end):
                    if words[j].lower() in ('and', 'but', 'so', 'which', 'where', 'when', 'while'):
                        split_at = j
                        break
                if split_at:
                    first_part = ' '.join(words[:split_at])
                    second_part = ' '.join(words[split_at:])
                    if first_part and first_part[-1] not in '.!?':
                        first_part = first_part.rstrip().rstrip(',') + '.'
                    if second_part and second_part[0].islower():
                        second_part = second_part[0].upper() + second_part[1:]
                    result.append(first_part)
                    result.append(second_part)
                    continue
            result.append(sentence)
        return ' '.join(result)

    def _add_short_reactions(self, text):
        sentences = re.split(r'(?<=[.!?])\s+', text)
        if len(sentences) < 3:
            return text
        reactions = [
            "That's huge.",
            "Think about that for a sec.",
            "Wild, right?",
            "And it shows.",
            "Makes you think.",
        ]
        result = list(sentences)
        if len(result) > 3 and random.random() < 0.4:
            insert_pos = random.randint(2, len(result) - 1)
            result.insert(insert_pos, random.choice(reactions))
        return ' '.join(result)

    def _clean_text(self, text):
        result = re.sub(r'\s+', ' ', text).strip()
        result = re.sub(r'\s+([.,!?])', r'\1', result)
        result = re.sub(r'([.!?])([A-Za-z])', r'\1 \2', result)
        result = re.sub(r'\.{2,}', '.', result)
        result = re.sub(r'\s*\.\s*\.', '.', result)
        return result
    
    def process(self, text, intensity='high'):
        if not text or len(text.strip()) < 10:
            return {
                "processed_text": text,
                "transformations_applied": []
            }

        result = text
        transformations = []

        result = self._replace_ai_phrases(result)
        transformations.append("ai_phrase_replacement")

        result = self._apply_informal_subs(result)
        transformations.append("informal_substitutions")

        result = self._contract_expanded_forms(result)
        transformations.append("contract_expanded_forms")

        result = self._remove_commas_before_conjunctions(result)
        transformations.append("remove_commas")

        result = self._break_long_sentences(result)
        transformations.append("break_long_sentences")

        if intensity in ['medium', 'high']:
            result = self._vary_sentence_lengths(result)
            transformations.append("vary_sentence_lengths")

        if intensity == 'high':
            result = self._add_casual_touches(result, probability=0.25)
            transformations.append("casual_touches")

            result = self._add_short_reactions(result)
            transformations.append("short_reactions")

        result = self._clean_text(result)

        return {
            "processed_text": result,
            "transformations_applied": transformations
        }

    def get_info(self):
        return {
            "name": "Stealthwriter Post-Processor V8",
            "version": "8.0",
            "technique": "Contraction preservation + AI phrase replacement + sentence variety + casual tone",
            "target": "Bypass Stealthwriter AI detection",
            "expected_results": {
                "stealthwriter": "<10% AI detection",
                "originality_ai": "Maintains low detection from Stage 1"
            }
        }


stealthwriter_postprocessor = StealthwriterPostProcessor()
