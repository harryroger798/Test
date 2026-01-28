"""
AI Text Detector - Standalone RoBERTa Model + 10-Level Analysis
Trained on 123,653 samples achieving 99.18% test accuracy.
No API dependencies - fully standalone detection.
"""

import gradio as gr
import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModelForSequenceClassification, AutoModelForSeq2SeqLM
import boto3
from botocore.config import Config
from pathlib import Path
import os
import re
import math
from collections import Counter
from typing import Dict, List, Any

# iDrive e2 credentials
E2_ENDPOINT = "https://s3.us-west-1.idrivee2.com"
E2_BUCKET = "crop-spray-uploads"
E2_ACCESS_KEY = os.environ.get("E2_ACCESS_KEY", "EQQ53Vm4Cr9Rov1FsOPt")
E2_SECRET_KEY = os.environ.get("E2_SECRET_KEY", "far8XneFX3NH9UT6HFUjAAt9YZ3CB8RmJiCvKpe6")

# Model path on e2 - New trained model with 99.18% accuracy
ROBERTA_123K_PREFIX = "ai-detector/models/roberta_123k_trained/"

# Local model directory
MODEL_DIR = Path("/tmp/roberta_123k_model")

# Label mapping (binary classification)
LABELS = {
    0: "Human-Written",
    1: "AI-Generated"
}

LABEL_COLORS = {
    0: "#22c55e",  # Green for human
    1: "#ef4444",  # Red for AI
}

# ============== 10-LEVEL DETECTION SYSTEM ==============

class Level2_StatisticalFingerprinting:
    """AI has statistical patterns humans don't"""
    
    def detect(self, text: str) -> float:
        words = text.split()
        if not words or len(words) < 10:
            return 0.5
        
        ai_score = 0
        
        # Word length variation (AI has LOWER variation)
        word_lengths = [len(w) for w in words]
        avg_len = sum(word_lengths) / len(word_lengths)
        variance = sum((x - avg_len) ** 2 for x in word_lengths) / len(word_lengths)
        std = variance ** 0.5
        
        if std < 3.5:
            ai_score += 0.1
        
        # Contractions (humans use MORE)
        contractions = len(re.findall(r"n't|'re|'ve|'ll|'d|'m|'s", text))
        if contractions < len(words) * 0.02:
            ai_score += 0.1
        
        # Formal words (AI uses MORE)
        formal_words = sum(1 for w in words if w.lower() in 
                          ["furthermore", "moreover", "however", "thus", 
                           "consequently", "notwithstanding", "additionally",
                           "subsequently", "nevertheless", "henceforth"])
        if formal_words > 2:
            ai_score += 0.15
        
        # Pronouns (humans use MORE)
        pronouns = sum(1 for w in words if w.lower() in 
                      ["i", "me", "we", "you", "my", "your", "our", "us"])
        if pronouns < len(words) * 0.05:
            ai_score += 0.1
        
        return min(ai_score, 1.0)


class Level3_SyntacticPatterns:
    """Detect AI by sentence structure patterns"""
    
    def detect(self, text: str) -> float:
        sentences = re.split(r'[.!?]+', text)
        
        ai_score = 0
        complex_count = 0
        simple_count = 0
        passive_count = 0
        question_count = 0
        
        for sent in sentences:
            if not sent.strip():
                continue
            
            sent_lower = sent.lower()
            
            if re.search(r'\b(is|are|was|were)\b.*\b(by|that|which)\b', sent_lower):
                passive_count += 1
            
            if '?' in sent:
                question_count += 1
            
            clause_count = len(re.findall(r',|\bthat\b|\bwhich\b|\bbecause\b', sent_lower))
            if clause_count > 2:
                complex_count += 1
            else:
                simple_count += 1
        
        total = complex_count + simple_count + question_count
        if total == 0:
            return 0.5
        
        if (complex_count / total) > 0.5:
            ai_score += 0.15
        if passive_count > 0 and (passive_count / total) > 0.3:
            ai_score += 0.15
        if (question_count / total) > 0.2:
            ai_score -= 0.1
        
        return max(0, min(ai_score, 1.0))


class Level4_NGramEntropy:
    """AI has LOW entropy (repetitive), humans have HIGH entropy (varied)"""
    
    def extract_ngrams(self, text: str, n: int = 3) -> List[str]:
        words = text.lower().split()
        return [' '.join(words[i:i+n]) for i in range(len(words) - n + 1)]
    
    def calculate_entropy(self, ngrams: List[str]) -> float:
        if not ngrams:
            return 0
        
        counter = Counter(ngrams)
        total = len(ngrams)
        
        entropy = 0
        for count in counter.values():
            prob = count / total
            entropy -= prob * math.log2(prob + 1e-10)
        
        return entropy
    
    def detect(self, text: str) -> float:
        words = text.lower().split()
        if len(words) < 10:
            return 0.5
        
        bigrams = self.extract_ngrams(text, 2)
        trigrams = self.extract_ngrams(text, 3)
        fourgrams = self.extract_ngrams(text, 4)
        
        entropy_2 = self.calculate_entropy(bigrams)
        entropy_3 = self.calculate_entropy(trigrams)
        entropy_4 = self.calculate_entropy(fourgrams)
        
        avg_entropy = (entropy_2 + entropy_3 + entropy_4) / 3
        normalized = min(avg_entropy / 8, 1.0)
        return 1 - normalized


class Level6_LexicalDiversity:
    """Humans use MORE diverse vocabulary, AI tends to repeat"""
    
    def detect(self, text: str) -> float:
        words = text.lower().split()
        if not words or len(words) < 10:
            return 0.5
        
        unique_words = set(words)
        
        ai_score = 0
        
        ttr = len(unique_words) / len(words)
        if ttr < 0.4:
            ai_score += 0.2
        elif ttr < 0.5:
            ai_score += 0.1
        
        stopwords = ["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for"]
        stopword_ratio = sum(1 for w in words if w in stopwords) / len(words)
        if stopword_ratio > 0.25:
            ai_score += 0.15
        
        hapax = sum(1 for w in unique_words if words.count(w) == 1)
        hapax_ratio = hapax / len(unique_words) if unique_words else 0
        if hapax_ratio < 0.5:
            ai_score += 0.1
        
        return min(ai_score, 1.0)


class Level7_NamedEntities:
    """AI mentions FEWER specific people/places/dates"""
    
    def detect(self, text: str) -> float:
        sentences = re.split(r'[.!?]+', text)
        proper_nouns = 0
        
        for sent in sentences:
            words = sent.strip().split()
            for i, word in enumerate(words[1:], 1):
                if word and word[0].isupper() and word.isalpha():
                    proper_nouns += 1
        
        dates = len(re.findall(r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b', text))
        dates += len(re.findall(r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}', text, re.I))
        
        specific_numbers = len(re.findall(r'\b\d+(?:\.\d+)?%?\b', text))
        
        total_specifics = proper_nouns + dates + specific_numbers
        word_count = len(text.split())
        
        specifics_ratio = total_specifics / word_count if word_count > 0 else 0
        
        if specifics_ratio < 0.02:
            return 0.2
        elif specifics_ratio < 0.05:
            return 0.1
        else:
            return 0.0


class Level8_TemporalContextual:
    """AI uses generic temporal references, humans use specific ones"""
    
    def detect(self, text: str) -> float:
        ai_score = 0
        words = text.split()
        
        if len(words) < 10:
            return 0.5
        
        generic_temp = len(re.findall(
            r'\b(?:previously|furthermore|consequently|subsequently|moreover|additionally|therefore|hence)\b', 
            text, re.I
        ))
        if generic_temp > 3:
            ai_score += 0.15
        elif generic_temp > 1:
            ai_score += 0.1
        
        personal = sum(1 for w in words if w.lower() in ["i", "me", "my", "we", "our", "us"])
        if personal < 2:
            ai_score += 0.1
        
        specific_time = len(re.findall(
            r'\b(?:yesterday|today|tomorrow|last\s+(?:week|month|year)|this\s+(?:morning|afternoon|evening))\b',
            text, re.I
        ))
        if specific_time == 0:
            ai_score += 0.1
        
        return min(ai_score, 1.0)


class TenLevelAnalyzer:
    """10-Level Analysis System for supplementary detection insights"""
    
    def __init__(self):
        self.level2 = Level2_StatisticalFingerprinting()
        self.level3 = Level3_SyntacticPatterns()
        self.level4 = Level4_NGramEntropy()
        self.level6 = Level6_LexicalDiversity()
        self.level7 = Level7_NamedEntities()
        self.level8 = Level8_TemporalContextual()
        
        self.weights = {
            "statistical": 0.20,
            "syntactic": 0.15,
            "entropy": 0.20,
            "lexical": 0.15,
            "entities": 0.15,
            "temporal": 0.15,
        }
    
    def analyze(self, text: str) -> Dict[str, Any]:
        """Run all analysis levels"""
        if not text or len(text.strip()) < 50:
            return {"error": "Text too short for detailed analysis"}
        
        scores = {
            "statistical": self.level2.detect(text),
            "syntactic": self.level3.detect(text),
            "entropy": self.level4.detect(text),
            "lexical": self.level6.detect(text),
            "entities": self.level7.detect(text),
            "temporal": self.level8.detect(text),
        }
        
        total_weight = sum(self.weights.values())
        weighted_score = sum(scores[k] * self.weights[k] for k in scores) / total_weight
        
        votes_for_ai = sum(1 for s in scores.values() if s > 0.3)
        
        insights = []
        if scores["statistical"] > 0.3:
            insights.append("Formal language patterns detected")
        if scores["syntactic"] > 0.3:
            insights.append("Complex sentence structures typical of AI")
        if scores["entropy"] > 0.5:
            insights.append("Low vocabulary entropy (repetitive patterns)")
        if scores["lexical"] > 0.3:
            insights.append("Limited lexical diversity")
        if scores["entities"] > 0.15:
            insights.append("Few specific names/dates/numbers")
        if scores["temporal"] > 0.2:
            insights.append("Generic temporal references")
        
        return {
            "scores": scores,
            "weighted_score": weighted_score,
            "votes_for_ai": votes_for_ai,
            "total_levels": len(scores),
            "insights": insights
        }


# ============== MODEL LOADING ==============

def download_model():
    """Download trained RoBERTa model from iDrive e2."""
    s3 = boto3.client(
        's3',
        endpoint_url=E2_ENDPOINT,
        aws_access_key_id=E2_ACCESS_KEY,
        aws_secret_access_key=E2_SECRET_KEY,
        config=Config(signature_version='s3v4')
    )
    
    if not MODEL_DIR.exists() or not (MODEL_DIR / "model.safetensors").exists():
        print("Downloading RoBERTa 123K model from iDrive e2...")
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        
        # Download the zip file
        zip_path = MODEL_DIR / "model.zip"
        s3.download_file(E2_BUCKET, "ai-detector/models/roberta_123k_trained.zip", str(zip_path))
        
        # Extract
        import zipfile
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(MODEL_DIR)
        
        # Clean up zip
        zip_path.unlink()
        print("Model download complete!")
    else:
        print("Model already downloaded")


# Download model on startup
download_model()

# Load model and tokenizer
print("Loading RoBERTa 123K model (99.18% accuracy)...")
tokenizer = AutoTokenizer.from_pretrained(str(MODEL_DIR))
model = AutoModelForSequenceClassification.from_pretrained(str(MODEL_DIR))
model.eval()

# Move to GPU if available
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)
print(f"Model loaded on {device}")

# Initialize 10-level analyzer
ten_level_analyzer = TenLevelAnalyzer()

# Load Humanizer model
print("Loading Ateeqq Text-Rewriter-Paraphraser model...")
try:
    humanizer_tokenizer = AutoTokenizer.from_pretrained("Ateeqq/Text-Rewriter-Paraphraser")
    humanizer_model = AutoModelForSeq2SeqLM.from_pretrained("Ateeqq/Text-Rewriter-Paraphraser")
    humanizer_model.to(device)
    humanizer_model.eval()
    HUMANIZER_AVAILABLE = True
    print("Humanizer model loaded successfully!")
except Exception as e:
    print(f"Warning: Could not load humanizer model: {e}")
    humanizer_tokenizer = None
    humanizer_model = None
    HUMANIZER_AVAILABLE = False


# ============== PREDICTION FUNCTIONS ==============

def predict(text: str) -> Dict[str, Any]:
    """Get prediction from trained RoBERTa model."""
    inputs = tokenizer(
        text, return_tensors="pt", truncation=True, max_length=512, padding=True
    )
    inputs = {k: v.to(device) for k, v in inputs.items()}
    
    with torch.no_grad():
        outputs = model(**inputs)
        probs = F.softmax(outputs.logits, dim=-1)
        pred_class = torch.argmax(probs, dim=-1).item()
        confidence = probs[0][pred_class].item()
    
    return {
        "label": LABELS[pred_class],
        "confidence": confidence,
        "probabilities": {
            "Human-Written": probs[0][0].item(),
            "AI-Generated": probs[0][1].item()
        }
    }


def humanize_text(text: str, num_beams: int = 5, max_length: int = 512) -> str:
    """Humanize AI-generated text using Ateeqq Text-Rewriter-Paraphraser model."""
    if not HUMANIZER_AVAILABLE:
        return "Error: Humanizer model not available"
    
    try:
        input_text = f"paraphrase: {text}"
        inputs = humanizer_tokenizer(
            input_text, 
            return_tensors="pt", 
            truncation=True, 
            max_length=max_length,
            padding=True
        )
        inputs = {k: v.to(device) for k, v in inputs.items()}
        
        with torch.no_grad():
            outputs = humanizer_model.generate(
                **inputs,
                max_length=max_length,
                num_beams=num_beams,
                early_stopping=True,
                do_sample=True,
                temperature=0.7,
                top_p=0.9
            )
        
        humanized = humanizer_tokenizer.decode(outputs[0], skip_special_tokens=True)
        return humanized
    except Exception as e:
        return f"Error during humanization: {str(e)}"


# ============== UI FUNCTIONS ==============

def create_result_html(prediction: Dict, analysis: Dict) -> str:
    """Create HTML for displaying results."""
    label = prediction["label"]
    confidence = prediction["confidence"]
    probs = prediction["probabilities"]
    
    label_idx = 0 if label == "Human-Written" else 1
    color = LABEL_COLORS[label_idx]
    
    # Main result
    html = f"""
    <div style='padding: 20px; border-radius: 10px; background: linear-gradient(135deg, {color}22, {color}11);'>
        <h2 style='margin: 0 0 10px 0; color: {color}; text-align: center;'>{label}</h2>
        <p style='margin: 0; text-align: center; font-size: 24px; font-weight: bold;'>{confidence*100:.1f}% confidence</p>
        
        <hr style='margin: 15px 0; border: none; border-top: 1px solid {color}44;'>
        
        <h4 style='margin: 10px 0 5px 0;'>Probability Distribution:</h4>
        <div style='display: flex; gap: 10px; margin-bottom: 15px;'>
            <div style='flex: 1; padding: 10px; background: #22c55e22; border-radius: 4px; text-align: center;'>
                <div style='font-weight: bold; color: #22c55e;'>Human-Written</div>
                <div style='font-size: 18px;'>{probs["Human-Written"]*100:.1f}%</div>
            </div>
            <div style='flex: 1; padding: 10px; background: #ef444422; border-radius: 4px; text-align: center;'>
                <div style='font-weight: bold; color: #ef4444;'>AI-Generated</div>
                <div style='font-size: 18px;'>{probs["AI-Generated"]*100:.1f}%</div>
            </div>
        </div>
    """
    
    # 10-Level Analysis
    if "error" not in analysis:
        html += f"""
        <hr style='margin: 15px 0; border: none; border-top: 1px solid {color}44;'>
        <h4 style='margin: 10px 0 5px 0;'>10-Level Analysis ({analysis['votes_for_ai']}/{analysis['total_levels']} indicators suggest AI):</h4>
        <div style='display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;'>
        """
        
        level_names = {
            "statistical": "Statistical",
            "syntactic": "Syntactic",
            "entropy": "Entropy",
            "lexical": "Lexical",
            "entities": "Entities",
            "temporal": "Temporal"
        }
        
        for key, score in analysis["scores"].items():
            score_color = "#ef4444" if score > 0.3 else "#22c55e"
            html += f"""
            <div style='padding: 8px; background: {score_color}11; border-radius: 4px; text-align: center;'>
                <div style='font-size: 12px; color: #666;'>{level_names.get(key, key)}</div>
                <div style='font-weight: bold; color: {score_color};'>{score*100:.0f}%</div>
            </div>
            """
        
        html += "</div>"
        
        if analysis["insights"]:
            html += "<div style='margin-top: 10px; padding: 10px; background: #f3f4f6; border-radius: 4px;'>"
            html += "<strong>Key Insights:</strong><ul style='margin: 5px 0 0 0; padding-left: 20px;'>"
            for insight in analysis["insights"]:
                html += f"<li style='font-size: 13px; color: #666;'>{insight}</li>"
            html += "</ul></div>"
    
    html += "</div>"
    
    # Model info
    html += """
    <div style='margin-top: 10px; padding: 10px; background: #f0f9ff; border-radius: 4px; font-size: 12px; color: #0369a1;'>
        <strong>Model:</strong> RoBERTa-base trained on 123,653 samples | <strong>Test Accuracy:</strong> 99.18% | <strong>F1 Score:</strong> 99.31%
    </div>
    """
    
    return html


def analyze_text(text: str) -> str:
    """Main analysis function for Gradio."""
    if not text or len(text.strip()) < 10:
        return "<div style='padding: 20px; text-align: center;'>Please enter at least 10 characters of text.</div>"
    
    prediction = predict(text)
    analysis = ten_level_analyzer.analyze(text)
    
    return create_result_html(prediction, analysis)


def humanize_and_analyze(text: str) -> tuple:
    """Humanize text and analyze both versions."""
    if not text or len(text.strip()) < 10:
        error_msg = "<div style='padding: 20px; text-align: center;'>Please enter at least 10 characters of text.</div>"
        return error_msg, "", error_msg
    
    if not HUMANIZER_AVAILABLE:
        error_msg = "<div style='padding: 20px; text-align: center; color: red;'>Humanizer model not available.</div>"
        return error_msg, "", error_msg
    
    # Analyze original
    original_pred = predict(text)
    original_analysis = ten_level_analyzer.analyze(text)
    original_html = create_result_html(original_pred, original_analysis)
    
    # Humanize
    humanized_text = humanize_text(text)
    
    if humanized_text.startswith("Error"):
        return original_html, humanized_text, "<div style='padding: 20px; text-align: center; color: red;'>" + humanized_text + "</div>"
    
    # Analyze humanized
    humanized_pred = predict(humanized_text)
    humanized_analysis = ten_level_analyzer.analyze(humanized_text)
    humanized_html = create_result_html(humanized_pred, humanized_analysis)
    
    return original_html, humanized_text, humanized_html


def just_humanize(text: str) -> str:
    """Just humanize text without analysis."""
    if not text or len(text.strip()) < 10:
        return "Please enter at least 10 characters of text."
    return humanize_text(text)


# ============== GRADIO INTERFACE ==============

with gr.Blocks(title="AI Text Detector - 99.18% Accuracy", theme=gr.themes.Soft()) as demo:
    gr.Markdown("""
    # AI Text Detector
    ### Standalone RoBERTa Model + 10-Level Analysis
    
    **Model Performance:** 99.18% accuracy on 12,366 test samples | F1: 99.31% | Precision: 98.75% | Recall: 99.88%
    
    **Training Data:** 123,653 samples (50,000 human + 58,570 AI + 15,083 humanized AI)
    
    **No API Dependencies** - Fully standalone detection using trained transformer model.
    """)
    
    with gr.Tabs():
        with gr.Tab("Detect AI Text"):
            with gr.Row():
                with gr.Column(scale=1):
                    input_text = gr.Textbox(
                        label="Enter text to analyze",
                        placeholder="Paste the text you want to check for AI generation...",
                        lines=10
                    )
                    analyze_btn = gr.Button("Analyze Text", variant="primary")
                
                with gr.Column(scale=1):
                    result_html = gr.HTML(label="Detection Result")
            
            analyze_btn.click(
                fn=analyze_text,
                inputs=[input_text],
                outputs=[result_html]
            )
        
        with gr.Tab("Humanize & Detect"):
            gr.Markdown("""
            This tab humanizes AI-generated text and shows detection results for both versions.
            Uses the Ateeqq Text-Rewriter-Paraphraser model for humanization.
            """)
            
            with gr.Row():
                with gr.Column(scale=1):
                    humanize_input = gr.Textbox(
                        label="Enter AI-generated text to humanize",
                        placeholder="Paste AI-generated text here...",
                        lines=8
                    )
                    humanize_btn = gr.Button("Humanize & Analyze", variant="primary")
            
            with gr.Row():
                with gr.Column(scale=1):
                    gr.Markdown("### Original Text Analysis")
                    original_result = gr.HTML()
                
                with gr.Column(scale=1):
                    gr.Markdown("### Humanized Text")
                    humanized_output = gr.Textbox(label="Humanized Version", lines=6)
                    gr.Markdown("### Humanized Text Analysis")
                    humanized_result = gr.HTML()
            
            humanize_btn.click(
                fn=humanize_and_analyze,
                inputs=[humanize_input],
                outputs=[original_result, humanized_output, humanized_result]
            )
        
        with gr.Tab("Just Humanize"):
            gr.Markdown("Humanize text without detection analysis.")
            
            with gr.Row():
                with gr.Column(scale=1):
                    just_humanize_input = gr.Textbox(
                        label="Enter text to humanize",
                        placeholder="Paste text here...",
                        lines=8
                    )
                    just_humanize_btn = gr.Button("Humanize", variant="primary")
                
                with gr.Column(scale=1):
                    just_humanize_output = gr.Textbox(
                        label="Humanized Text",
                        lines=8
                    )
            
            just_humanize_btn.click(
                fn=just_humanize,
                inputs=[just_humanize_input],
                outputs=[just_humanize_output]
            )
    
    gr.Markdown("""
    ---
    ### About This Detector
    
    This AI text detector uses a RoBERTa-base model fine-tuned on a diverse dataset of 123,653 text samples:
    - **50,000 human-written** samples from Wikipedia, Reddit, and web sources
    - **58,570 AI-generated** samples from GPT-4, Claude, Gemini, Llama, and other models
    - **15,083 humanized AI** samples processed through various paraphrasers
    
    The model achieves **99.18% test accuracy** with excellent precision (98.75%) and recall (99.88%).
    
    The 10-level analysis provides additional insights using statistical fingerprinting, syntactic patterns,
    n-gram entropy, lexical diversity, named entity analysis, and temporal reference detection.
    
    **Fully Standalone** - No external API calls required for detection.
    """)

if __name__ == "__main__":
    demo.launch()
