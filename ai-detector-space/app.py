"""
AI Text Detector - Ensemble Gradio App
Detects whether text is human-written, AI-generated, or humanized AI text.
Uses ensemble of DistilBERT + RoBERTa + Claude for improved accuracy.
Achieves 80% accuracy on challenging test cases (vs 40-60% for single models).
"""

import gradio as gr
import torch
import torch.nn.functional as F
from transformers import (
    AutoTokenizer, AutoModelForSequenceClassification,
    RobertaTokenizer, RobertaForSequenceClassification
)
import boto3
from botocore.config import Config
from pathlib import Path
import os
import json
import requests

# iDrive e2 credentials
E2_ENDPOINT = "https://s3.us-west-1.idrivee2.com"
E2_BUCKET = "crop-spray-uploads"
E2_ACCESS_KEY = os.environ.get("E2_ACCESS_KEY", "EQQ53Vm4Cr9Rov1FsOPt")
E2_SECRET_KEY = os.environ.get("E2_SECRET_KEY", "far8XneFX3NH9UT6HFUjAAt9YZ3CB8RmJiCvKpe6")

# Blackbox API for Claude
BLACKBOX_API_URL = "https://api.blackbox.ai/chat/completions"
BLACKBOX_API_KEY = os.environ.get("BLACKBOX_API_KEY", "sk-H2150aIqY3ULNxFdWwLXdg")
BLACKBOX_MODEL = "blackboxai/anthropic/claude-3-haiku"

# Model paths on e2
DISTILBERT_PREFIX = "ai-detector-platform/models/detector_balanced_v2/"
ROBERTA_PREFIX = "ai-detector-platform/models/roberta_balanced_v2/"

# Local model directories
DISTILBERT_DIR = Path("/tmp/distilbert_model")
ROBERTA_DIR = Path("/tmp/roberta_model")

# Label mapping
LABELS = {
    0: "Human-Written",
    1: "AI-Generated", 
    2: "Humanized AI"
}

LABEL_COLORS = {
    0: "#22c55e",  # Green for human
    1: "#ef4444",  # Red for AI
    2: "#f59e0b"   # Orange for humanized
}

def download_models():
    """Download models from iDrive e2 if not already present."""
    s3 = boto3.client(
        's3',
        endpoint_url=E2_ENDPOINT,
        aws_access_key_id=E2_ACCESS_KEY,
        aws_secret_access_key=E2_SECRET_KEY,
        config=Config(signature_version='s3v4')
    )
    
    # Download DistilBERT
    if not DISTILBERT_DIR.exists() or not (DISTILBERT_DIR / "model.safetensors").exists():
        print("Downloading DistilBERT model from iDrive e2...")
        DISTILBERT_DIR.mkdir(parents=True, exist_ok=True)
        response = s3.list_objects_v2(Bucket=E2_BUCKET, Prefix=DISTILBERT_PREFIX)
        for obj in response.get('Contents', []):
            key = obj['Key']
            filename = key.replace(DISTILBERT_PREFIX, '')
            if filename:
                local_path = DISTILBERT_DIR / filename
                print(f"Downloading {filename}...")
                s3.download_file(E2_BUCKET, key, str(local_path))
        print("DistilBERT download complete!")
    else:
        print("DistilBERT model already downloaded")
    
    # Download RoBERTa
    if not ROBERTA_DIR.exists() or not (ROBERTA_DIR / "model.safetensors").exists():
        print("Downloading RoBERTa model from iDrive e2...")
        ROBERTA_DIR.mkdir(parents=True, exist_ok=True)
        response = s3.list_objects_v2(Bucket=E2_BUCKET, Prefix=ROBERTA_PREFIX)
        for obj in response.get('Contents', []):
            key = obj['Key']
            filename = key.replace(ROBERTA_PREFIX, '')
            if filename:
                local_path = ROBERTA_DIR / filename
                print(f"Downloading {filename}...")
                s3.download_file(E2_BUCKET, key, str(local_path))
        print("RoBERTa download complete!")
    else:
        print("RoBERTa model already downloaded")

# Download models on startup
download_models()

# Load DistilBERT model and tokenizer
print("Loading DistilBERT model...")
distilbert_tokenizer = AutoTokenizer.from_pretrained(str(DISTILBERT_DIR))
distilbert_model = AutoModelForSequenceClassification.from_pretrained(str(DISTILBERT_DIR))
distilbert_model.eval()

# Load RoBERTa model and tokenizer
print("Loading RoBERTa model...")
roberta_tokenizer = RobertaTokenizer.from_pretrained(str(ROBERTA_DIR))
roberta_model = RobertaForSequenceClassification.from_pretrained(str(ROBERTA_DIR))
roberta_model.eval()

# Move to GPU if available
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
distilbert_model.to(device)
roberta_model.to(device)
print(f"Models loaded on {device}")

def predict_distilbert(text: str) -> tuple:
    """Get prediction from DistilBERT model."""
    inputs = distilbert_tokenizer(
        text, return_tensors="pt", truncation=True, max_length=512, padding=True
    )
    inputs = {k: v.to(device) for k, v in inputs.items()}
    with torch.no_grad():
        outputs = distilbert_model(**inputs)
        probs = F.softmax(outputs.logits, dim=-1)
        pred_class = torch.argmax(probs, dim=-1).item()
        confidence = probs[0][pred_class].item()
    return LABELS[pred_class], confidence, probs[0].cpu().tolist()

def predict_roberta(text: str) -> tuple:
    """Get prediction from RoBERTa model."""
    inputs = roberta_tokenizer(
        text, return_tensors="pt", truncation=True, max_length=512, padding=True
    )
    inputs = {k: v.to(device) for k, v in inputs.items()}
    with torch.no_grad():
        outputs = roberta_model(**inputs)
        probs = F.softmax(outputs.logits, dim=-1)
        pred_class = torch.argmax(probs, dim=-1).item()
        confidence = probs[0][pred_class].item()
    return LABELS[pred_class], confidence, probs[0].cpu().tolist()

def predict_claude(text: str) -> tuple:
    """Get prediction from Claude via Blackbox API."""
    prompt = f'''You are an AI text detection expert. Analyze the following text and classify it into one of three categories:

1. "Human-Written" - Text written by a human, may have casual language, personal experiences, minor errors, or unique voice
2. "AI-Generated" - Text generated by AI, typically formal, well-structured, uses common AI patterns
3. "Humanized AI" - AI-generated text that has been modified to appear more human-like, often has mixed characteristics

Text to analyze:
"{text}"

Respond with ONLY a JSON object in this exact format (no other text):
{{"classification": "Human-Written" or "AI-Generated" or "Humanized AI", "confidence": 0.0-1.0, "reasoning": "brief explanation"}}'''

    headers = {
        "Authorization": f"Bearer {BLACKBOX_API_KEY}",
        "Content-Type": "application/json"
    }
    
    data = {
        "model": BLACKBOX_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 256
    }
    
    try:
        response = requests.post(BLACKBOX_API_URL, headers=headers, json=data, timeout=120)
        response.raise_for_status()
        result = response.json()
        
        content = result['choices'][0]['message']['content']
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        parsed = json.loads(content)
        classification = parsed.get('classification', 'Human-Written')
        confidence = float(parsed.get('confidence', 0.5))
        reasoning = parsed.get('reasoning', '')
        
        return classification, confidence, {"reasoning": reasoning}
    
    except Exception as e:
        print(f"Claude API error: {e}")
        return None, None, {"error": str(e)}

def ensemble_predict(text: str, use_claude: bool = True) -> dict:
    """Get ensemble prediction combining all models."""
    distilbert_label, distilbert_conf, distilbert_probs = predict_distilbert(text)
    roberta_label, roberta_conf, roberta_probs = predict_roberta(text)
    
    claude_label, claude_conf, claude_info = None, None, None
    if use_claude:
        claude_label, claude_conf, claude_info = predict_claude(text)
    
    votes = {}
    distilbert_weight = 1.0
    roberta_weight = 1.2
    claude_weight = 1.8 if use_claude and claude_label else 0
    
    if distilbert_label not in votes:
        votes[distilbert_label] = 0
    votes[distilbert_label] += distilbert_conf * distilbert_weight
    
    if roberta_label not in votes:
        votes[roberta_label] = 0
    votes[roberta_label] += roberta_conf * roberta_weight
    
    if use_claude and claude_label:
        if claude_label not in votes:
            votes[claude_label] = 0
        votes[claude_label] += claude_conf * claude_weight
    
    final_label = max(votes, key=votes.get)
    total_weight = sum(votes.values())
    final_confidence = votes[final_label] / total_weight if total_weight > 0 else 0
    
    result = {
        "prediction": final_label,
        "confidence": final_confidence,
        "votes": votes,
        "individual_predictions": {
            "distilbert": {
                "label": distilbert_label,
                "confidence": distilbert_conf,
                "probabilities": {
                    "Human-Written": distilbert_probs[0],
                    "AI-Generated": distilbert_probs[1],
                    "Humanized AI": distilbert_probs[2]
                }
            },
            "roberta": {
                "label": roberta_label,
                "confidence": roberta_conf,
                "probabilities": {
                    "Human-Written": roberta_probs[0],
                    "AI-Generated": roberta_probs[1],
                    "Humanized AI": roberta_probs[2]
                }
            }
        }
    }
    
    if use_claude and claude_label:
        result["individual_predictions"]["claude"] = {
            "label": claude_label,
            "confidence": claude_conf,
            "info": claude_info
        }
    
    return result

def create_result_html(result: dict, use_claude: bool) -> str:
    """Create HTML for displaying ensemble results."""
    if "error" in result:
        return f"<div style='padding: 20px; text-align: center; color: red;'>{result['error']}</div>"
    
    label = result["prediction"]
    confidence = result["confidence"]
    
    label_idx = [k for k, v in LABELS.items() if v == label][0]
    color = LABEL_COLORS[label_idx]
    
    html = f"""
    <div style='padding: 20px; border-radius: 10px; background: linear-gradient(135deg, {color}22, {color}11);'>
        <h2 style='margin: 0 0 10px 0; color: {color}; text-align: center;'>{label}</h2>
        <p style='margin: 0; text-align: center; font-size: 24px; font-weight: bold;'>{confidence*100:.1f}% ensemble confidence</p>
        <hr style='margin: 15px 0; border: none; border-top: 1px solid {color}44;'>
        <h4 style='margin: 10px 0 5px 0;'>Individual Model Predictions:</h4>
        <div style='display: flex; flex-direction: column; gap: 8px;'>
    """
    
    db = result["individual_predictions"]["distilbert"]
    db_color = LABEL_COLORS[[k for k, v in LABELS.items() if v == db["label"]][0]]
    html += f"""
        <div style='display: flex; align-items: center; gap: 10px; padding: 8px; background: {db_color}11; border-radius: 4px;'>
            <span style='width: 100px; font-weight: bold;'>DistilBERT:</span>
            <span style='color: {db_color};'>{db["label"]}</span>
            <span style='margin-left: auto;'>{db["confidence"]*100:.1f}%</span>
        </div>
    """
    
    rb = result["individual_predictions"]["roberta"]
    rb_color = LABEL_COLORS[[k for k, v in LABELS.items() if v == rb["label"]][0]]
    html += f"""
        <div style='display: flex; align-items: center; gap: 10px; padding: 8px; background: {rb_color}11; border-radius: 4px;'>
            <span style='width: 100px; font-weight: bold;'>RoBERTa:</span>
            <span style='color: {rb_color};'>{rb["label"]}</span>
            <span style='margin-left: auto;'>{rb["confidence"]*100:.1f}%</span>
        </div>
    """
    
    if use_claude and "claude" in result["individual_predictions"]:
        cl = result["individual_predictions"]["claude"]
        if cl["label"]:
            cl_color = LABEL_COLORS[[k for k, v in LABELS.items() if v == cl["label"]][0]]
            reasoning = cl.get("info", {}).get("reasoning", "")
            html += f"""
                <div style='display: flex; align-items: center; gap: 10px; padding: 8px; background: {cl_color}11; border-radius: 4px;'>
                    <span style='width: 100px; font-weight: bold;'>Claude:</span>
                    <span style='color: {cl_color};'>{cl["label"]}</span>
                    <span style='margin-left: auto;'>{cl["confidence"]*100:.1f}%</span>
                </div>
            """
            if reasoning:
                html += f"""
                    <div style='padding: 8px; background: #f3f4f6; border-radius: 4px; font-size: 12px; color: #666;'>
                        <strong>Claude's reasoning:</strong> {reasoning}
                    </div>
                """
    
    html += "</div></div>"
    return html

def analyze_text(text: str, use_claude: bool = True) -> str:
    """Main analysis function for Gradio."""
    if not text or len(text.strip()) < 10:
        return "<div style='padding: 20px; text-align: center;'>Please enter at least 10 characters of text.</div>"
    
    result = ensemble_predict(text, use_claude=use_claude)
    return create_result_html(result, use_claude)

# Create Gradio interface
with gr.Blocks(
    title="AI Text Detector - Ensemble",
    theme=gr.themes.Soft(),
    css="""
        .gradio-container { max-width: 900px !important; }
        .result-box { min-height: 200px; }
    """
) as demo:
    gr.Markdown("""
    # AI Text Detector - Ensemble Model
    
    Detect whether text is **human-written**, **AI-generated**, or **humanized AI text**.
    
    This detector uses an **ensemble of 3 models** for improved accuracy:
    - **DistilBERT** (99.55% test accuracy on training data)
    - **RoBERTa** (99.89% test accuracy on training data)
    - **Claude 3 Haiku** (via Blackbox API for edge case handling)
    
    The ensemble achieves **80% accuracy** on challenging real-world test cases (vs 40-60% for single models).
    
    ### How to use:
    1. Paste or type your text in the box below
    2. Optionally enable/disable Claude for faster results
    3. Click "Analyze" to detect the text origin
    4. View the ensemble result with individual model predictions
    """)
    
    with gr.Row():
        with gr.Column(scale=1):
            text_input = gr.Textbox(
                label="Enter text to analyze",
                placeholder="Paste your text here (minimum 10 characters)...",
                lines=10,
                max_lines=20
            )
            with gr.Row():
                use_claude_checkbox = gr.Checkbox(
                    label="Use Claude (slower but more accurate for edge cases)",
                    value=True
                )
            analyze_btn = gr.Button("Analyze", variant="primary", size="lg")
        
        with gr.Column(scale=1):
            result_output = gr.HTML(
                label="Detection Result",
                elem_classes=["result-box"]
            )
    
    # Example texts
    gr.Markdown("### Try these examples:")
    gr.Examples(
        examples=[
            ["I went to the coffee shop this morning and the barista totally messed up my order. Like, I asked for an oat milk latte and got regular milk instead. Had to go back and wait another 10 minutes. So annoying but whatever, at least they gave me a free pastry for the trouble."],
            ["Artificial intelligence has revolutionized numerous industries by enabling machines to perform tasks that traditionally required human intelligence. Through sophisticated algorithms and vast datasets, AI systems can now recognize patterns, make predictions, and generate content with remarkable accuracy."],
            ["So basically, AI is changing everything these days. It's kinda wild how machines can do stuff that used to need humans, you know? They use fancy algorithms and tons of data to spot patterns and make guesses. Pretty cool but also a bit scary if you think about it too much lol."],
        ],
        inputs=text_input,
        label="Example Texts"
    )
    
    # Connect button to function
    analyze_btn.click(
        fn=analyze_text,
        inputs=[text_input, use_claude_checkbox],
        outputs=result_output
    )
    
    # Also trigger on Enter key
    text_input.submit(
        fn=analyze_text,
        inputs=[text_input, use_claude_checkbox],
        outputs=result_output
    )
    
    gr.Markdown("""
    ---
    ### About the Ensemble Model
    
    - **DistilBERT**: Fast, lightweight transformer trained on 115K balanced samples
    - **RoBERTa**: More powerful transformer with better contextual understanding
    - **Claude 3 Haiku**: LLM-based detector for nuanced edge cases
    
    **Ensemble Weights**: DistilBERT (1.0x) + RoBERTa (1.2x) + Claude (1.8x)
    
    **Training Data**: 115,083 balanced samples (50K human + 50K AI-generated + 15K humanized)
    - Human sources: Wikipedia, Reddit, The Pile
    - AI sources: GPT Wiki Intros, Essays, Perplexity, Venice AI
    
    **Note**: This detector works best with English text of at least 50-100 words.
    Disabling Claude will make predictions faster but may reduce accuracy on edge cases.
    """)

# Launch the app
if __name__ == "__main__":
    demo.launch()
