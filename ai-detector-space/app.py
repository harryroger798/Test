"""
AI Text Detector - Gradio App
Detects whether text is human-written, AI-generated, or humanized AI text.
Model trained on 174K samples with 99.81% accuracy.
"""

import gradio as gr
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import boto3
from botocore.config import Config
from pathlib import Path
import os

# iDrive e2 credentials
E2_ENDPOINT = "https://s3.us-west-1.idrivee2.com"
E2_BUCKET = "crop-spray-uploads"
E2_ACCESS_KEY = os.environ.get("E2_ACCESS_KEY", "EQQ53Vm4Cr9Rov1FsOPt")
E2_SECRET_KEY = os.environ.get("E2_SECRET_KEY", "far8XneFX3NH9UT6HFUjAAt9YZ3CB8RmJiCvKpe6")

# Model path on e2
MODEL_PREFIX = "ai-detector-platform/models/detector_174k/"

# Local model directory
MODEL_DIR = Path("/tmp/detector_model")

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

def download_model():
    """Download model from iDrive e2 if not already present."""
    if MODEL_DIR.exists() and (MODEL_DIR / "model.safetensors").exists():
        print("Model already downloaded")
        return
    
    print("Downloading model from iDrive e2...")
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    
    s3 = boto3.client(
        's3',
        endpoint_url=E2_ENDPOINT,
        aws_access_key_id=E2_ACCESS_KEY,
        aws_secret_access_key=E2_SECRET_KEY,
        config=Config(signature_version='s3v4')
    )
    
    # List and download all model files
    response = s3.list_objects_v2(Bucket=E2_BUCKET, Prefix=MODEL_PREFIX)
    
    for obj in response.get('Contents', []):
        key = obj['Key']
        filename = key.replace(MODEL_PREFIX, '')
        if filename:
            local_path = MODEL_DIR / filename
            print(f"Downloading {filename}...")
            s3.download_file(E2_BUCKET, key, str(local_path))
    
    print("Model download complete!")

# Download model on startup
download_model()

# Load model and tokenizer
print("Loading model...")
tokenizer = AutoTokenizer.from_pretrained(str(MODEL_DIR))
model = AutoModelForSequenceClassification.from_pretrained(str(MODEL_DIR))
model.eval()

# Move to GPU if available
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)
print(f"Model loaded on {device}")

def detect_text(text: str) -> tuple:
    """
    Detect whether text is human-written, AI-generated, or humanized.
    
    Returns:
        tuple: (label, confidence, detailed_results)
    """
    if not text or len(text.strip()) < 10:
        return "Please enter at least 10 characters of text.", None, None
    
    # Tokenize
    inputs = tokenizer(
        text,
        truncation=True,
        max_length=512,
        padding=True,
        return_tensors="pt"
    )
    inputs = {k: v.to(device) for k, v in inputs.items()}
    
    # Predict
    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.softmax(outputs.logits, dim=-1)[0]
    
    # Get prediction
    pred_idx = probs.argmax().item()
    confidence = probs[pred_idx].item()
    
    # Create detailed results
    results = {LABELS[i]: float(probs[i]) for i in range(len(LABELS))}
    
    # Format output
    label = LABELS[pred_idx]
    confidence_pct = f"{confidence * 100:.1f}%"
    
    return label, confidence_pct, results

def create_result_html(label: str, confidence: str, results: dict) -> str:
    """Create HTML for displaying results."""
    if results is None:
        return f"<div style='padding: 20px; text-align: center;'>{label}</div>"
    
    # Get color for label
    label_idx = [k for k, v in LABELS.items() if v == label][0]
    color = LABEL_COLORS[label_idx]
    
    html = f"""
    <div style='padding: 20px; border-radius: 10px; background: linear-gradient(135deg, {color}22, {color}11);'>
        <h2 style='margin: 0 0 10px 0; color: {color}; text-align: center;'>{label}</h2>
        <p style='margin: 0; text-align: center; font-size: 24px; font-weight: bold;'>{confidence} confidence</p>
        <hr style='margin: 15px 0; border: none; border-top: 1px solid {color}44;'>
        <div style='display: flex; flex-direction: column; gap: 8px;'>
    """
    
    for lbl, prob in sorted(results.items(), key=lambda x: -x[1]):
        idx = [k for k, v in LABELS.items() if v == lbl][0]
        bar_color = LABEL_COLORS[idx]
        pct = prob * 100
        html += f"""
            <div style='display: flex; align-items: center; gap: 10px;'>
                <span style='width: 120px; font-size: 14px;'>{lbl}</span>
                <div style='flex: 1; background: #e5e7eb; border-radius: 4px; height: 20px;'>
                    <div style='width: {pct}%; background: {bar_color}; height: 100%; border-radius: 4px;'></div>
                </div>
                <span style='width: 50px; text-align: right; font-size: 14px;'>{pct:.1f}%</span>
            </div>
        """
    
    html += "</div></div>"
    return html

def analyze_text(text: str) -> str:
    """Main analysis function for Gradio."""
    label, confidence, results = detect_text(text)
    return create_result_html(label, confidence, results)

# Create Gradio interface
with gr.Blocks(
    title="AI Text Detector",
    theme=gr.themes.Soft(),
    css="""
        .gradio-container { max-width: 800px !important; }
        .result-box { min-height: 150px; }
    """
) as demo:
    gr.Markdown("""
    # AI Text Detector
    
    Detect whether text is **human-written**, **AI-generated**, or **humanized AI text**.
    
    This model was trained on 174,615 samples and achieves **99.81% accuracy** on the test set.
    
    ### How to use:
    1. Paste or type your text in the box below
    2. Click "Analyze" to detect the text origin
    3. View the results with confidence scores
    """)
    
    with gr.Row():
        with gr.Column(scale=1):
            text_input = gr.Textbox(
                label="Enter text to analyze",
                placeholder="Paste your text here (minimum 10 characters)...",
                lines=10,
                max_lines=20
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
            ["The quick brown fox jumps over the lazy dog. This is a simple sentence that humans often use for typing practice."],
            ["In the realm of artificial intelligence, large language models have demonstrated remarkable capabilities in natural language processing, enabling sophisticated text generation that closely mimics human writing patterns."],
            ["I went to the store yesterday and bought some groceries. The weather was nice so I decided to walk instead of driving."],
        ],
        inputs=text_input,
        label="Example Texts"
    )
    
    # Connect button to function
    analyze_btn.click(
        fn=analyze_text,
        inputs=text_input,
        outputs=result_output
    )
    
    # Also trigger on Enter key
    text_input.submit(
        fn=analyze_text,
        inputs=text_input,
        outputs=result_output
    )
    
    gr.Markdown("""
    ---
    ### About the Model
    
    - **Architecture**: DistilBERT (distilbert-base-uncased)
    - **Training Data**: 174,615 samples (148K human + 6K AI-generated + 20K humanized)
    - **Test Accuracy**: 99.81%
    - **Classes**: Human-Written, AI-Generated, Humanized AI
    
    **Note**: This detector works best with English text of at least 50-100 words.
    """)

# Launch the app
if __name__ == "__main__":
    demo.launch()
