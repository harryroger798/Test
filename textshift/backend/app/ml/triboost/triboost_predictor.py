"""
TriBoost Predictor - Ensemble model for AI detection, humanizer detection, and plagiarism detection.

This module provides a unified interface for making predictions using the TriBoost ensemble
(XGBoost + LightGBM + CatBoost) trained on 565 features extracted from text.

Models are stored on iDrive e2 at: s3://crop-spray-uploads/triboost-models/
"""

import os
import pickle
import numpy as np
from typing import Dict, Tuple, Optional, List
import boto3
from botocore.config import Config

# Import feature extractor
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from app.services.feature_extractor import FeatureExtractor565


class TriBoostPredictor:
    """
    TriBoost ensemble predictor for text classification tasks.
    
    Supports three tasks:
    - AI Detection: Classify text as human-written (0) or AI-generated (1)
    - Humanizer Detection: Classify text as original (0) or humanized (1)
    - Plagiarism Detection: Classify text as original (0) or plagiarized (1)
    
    Models are loaded from iDrive e2 storage on first use and cached locally.
    """
    
    # iDrive e2 configuration
    IDRIVE_ENDPOINT = "https://s3.us-west-1.idrivee2.com"
    IDRIVE_BUCKET = "crop-spray-uploads"
    S3_BASE_PATH = "triboost-models"
    
    # Local cache directory - use pre-deployed models
    LOCAL_CACHE_DIR = "/opt/textshift/backend/triboost_models"
    
    # Task names
    TASKS = ["ai_detector", "humanizer", "plagiarism"]
    
    def __init__(self, 
                 access_key: Optional[str] = None,
                 secret_key: Optional[str] = None,
                 local_model_dir: Optional[str] = None):
        """
        Initialize the TriBoost predictor.
        
        Args:
            access_key: iDrive e2 access key (defaults to env var IDRIVE_ACCESS_KEY)
            secret_key: iDrive e2 secret key (defaults to env var IDRIVE_SECRET_KEY)
            local_model_dir: Local directory containing pre-downloaded models (optional)
        """
        self.access_key = access_key or os.environ.get("IDRIVE_ACCESS_KEY", "")
        self.secret_key = secret_key or os.environ.get("IDRIVE_SECRET_KEY", "")
        self.local_model_dir = local_model_dir
        
        # Initialize feature extractor
        self.extractor = FeatureExtractor565()
        
        # Model cache
        self._models: Dict[str, Dict[str, object]] = {}
        
        # Initialize S3 client
        self._s3_client = None
    
    @property
    def s3_client(self):
        """Lazy initialization of S3 client."""
        if self._s3_client is None:
            self._s3_client = boto3.client(
                's3',
                endpoint_url=self.IDRIVE_ENDPOINT,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name='us-west-1',
                config=Config(
                    signature_version='s3v4',
                    s3={'addressing_style': 'path'}
                )
            )
        return self._s3_client
    
    def _download_model(self, task: str, model_name: str) -> str:
        """Download a model from iDrive e2 to local cache."""
        os.makedirs(os.path.join(self.LOCAL_CACHE_DIR, task), exist_ok=True)
        local_path = os.path.join(self.LOCAL_CACHE_DIR, task, f"{model_name}_model.pkl")
        
        if not os.path.exists(local_path):
            # Try to download from S3 if not exists locally
            try:
                s3_key = f"{self.S3_BASE_PATH}/{task}/{model_name}_model.pkl"
                self.s3_client.download_file(self.IDRIVE_BUCKET, s3_key, local_path)
            except Exception as e:
                raise FileNotFoundError(f"Model not found locally at {local_path} and failed to download from S3: {e}")
        
        return local_path
    
    def _load_models(self, task: str) -> Dict[str, object]:
        """Load all three models for a task."""
        if task in self._models:
            return self._models[task]
        
        models = {}
        model_names = ["xgboost", "lightgbm", "catboost"]
        
        for model_name in model_names:
            if self.local_model_dir:
                model_path = os.path.join(self.local_model_dir, task, f"{model_name}_model.pkl")
            else:
                model_path = self._download_model(task, model_name)
            
            with open(model_path, 'rb') as f:
                models[model_name] = pickle.load(f)
        
        self._models[task] = models
        return models
    
    def predict(self, text: str, task: str = "ai_detector") -> Dict:
        """
        Make a prediction for a single text.
        
        Args:
            text: Input text to classify
            task: One of "ai_detector", "humanizer", or "plagiarism"
        
        Returns:
            Dictionary with prediction results:
            - prediction: 0 or 1
            - label: Human-readable label
            - confidence: Confidence score (0-1)
            - probabilities: Dict with class probabilities
            - individual_predictions: Dict with each model's prediction
        """
        if task not in self.TASKS:
            raise ValueError(f"Invalid task: {task}. Must be one of {self.TASKS}")
        
        # Extract features
        features = self.extractor.extract_all(text)
        X = features.reshape(1, -1)
        
        # Load models
        models = self._load_models(task)
        
        # Get predictions from each model
        predictions = {}
        probabilities = {}
        
        for name, model in models.items():
            pred = model.predict(X)[0]
            prob = model.predict_proba(X)[0]
            predictions[name] = int(pred)
            probabilities[name] = prob.tolist()
        
        # Ensemble prediction (majority voting)
        ensemble_pred = int(sum(predictions.values()) >= 2)
        
        # Average probability
        avg_prob = np.mean([probabilities[m] for m in models.keys()], axis=0)
        
        # Labels based on task
        labels = {
            "ai_detector": {0: "Human-Written", 1: "AI-Generated"},
            "humanizer": {0: "Original", 1: "Humanized"},
            "plagiarism": {0: "Original", 1: "Plagiarized"}
        }
        
        return {
            "prediction": ensemble_pred,
            "label": labels[task][ensemble_pred],
            "confidence": float(max(avg_prob)),
            "probabilities": {
                "class_0": float(avg_prob[0]),
                "class_1": float(avg_prob[1])
            },
            "individual_predictions": predictions,
            "individual_probabilities": probabilities
        }
    
    def predict_batch(self, texts: List[str], task: str = "ai_detector") -> List[Dict]:
        """
        Make predictions for multiple texts.
        
        Args:
            texts: List of input texts
            task: One of "ai_detector", "humanizer", or "plagiarism"
        
        Returns:
            List of prediction dictionaries
        """
        return [self.predict(text, task) for text in texts]
    
    def predict_all_tasks(self, text: str) -> Dict[str, Dict]:
        """
        Run all three detection tasks on a single text.
        
        Args:
            text: Input text to classify
        
        Returns:
            Dictionary with results for each task
        """
        return {task: self.predict(text, task) for task in self.TASKS}


# Convenience functions
def detect_ai(text: str) -> Dict:
    """Detect if text is AI-generated."""
    predictor = TriBoostPredictor()
    return predictor.predict(text, "ai_detector")


def detect_humanizer(text: str) -> Dict:
    """Detect if text has been humanized."""
    predictor = TriBoostPredictor()
    return predictor.predict(text, "humanizer")


def detect_plagiarism(text: str) -> Dict:
    """Detect if text is plagiarized."""
    predictor = TriBoostPredictor()
    return predictor.predict(text, "plagiarism")


if __name__ == "__main__":
    # Test the predictor
    sample_text = """In the journey of life, there are moments when we seek clarity, 
    yet what we truly need is understanding. Sometimes, silence speaks louder than words, 
    offering comfort beyond explanation."""
    
    predictor = TriBoostPredictor(local_model_dir="/home/ubuntu/triboost_training/models")
    
    print("Testing TriBoost Predictor...")
    print(f"\nSample text: {sample_text[:100]}...")
    
    for task in TriBoostPredictor.TASKS:
        result = predictor.predict(sample_text, task)
        print(f"\n{task.upper()}:")
        print(f"  Prediction: {result['label']}")
        print(f"  Confidence: {result['confidence']*100:.1f}%")
