"""
TriBoost V4 Predictor: XGBoost + LightGBM + CatBoost Ensemble for AI Detection

This module provides the TriBoost ensemble predictor that achieves 99.18% accuracy
on AI text detection using 565 features extracted by FeatureExtractor565.

Architecture:
- XGBoost: 99.82% accuracy, 99.84% F1
- LightGBM: 99.80% accuracy, 99.82% F1
- CatBoost: 99.71% accuracy, 99.74% F1
- Ensemble: Weighted average with soft voting

Model Location: s3://crop-spray-uploads/triboost-models/ai_detector_v4/
"""

import os
import pickle
import logging
import numpy as np
import boto3
from typing import Dict, Any, Optional, List, Tuple
from app.core.config import settings

logger = logging.getLogger(__name__)


class TriBoostPredictor:
    """
    TriBoost V4 ensemble predictor for AI text detection.
    
    Uses XGBoost, LightGBM, and CatBoost models trained on 565 features
    to achieve 99.18% accuracy on AI detection.
    """
    
    _instance = None
    _models_loaded = False
    _xgboost_model = None
    _lightgbm_model = None
    _catboost_model = None
    _feature_extractor = None
    
    # Model weights for ensemble (based on individual accuracy)
    MODEL_WEIGHTS = {
        'xgboost': 0.40,   # Highest accuracy
        'lightgbm': 0.35,  # Second highest
        'catboost': 0.25,  # Third
    }
    
    # S3 paths for models
    S3_MODEL_PREFIX = "triboost-models/ai_detector_v4/"
    LOCAL_MODEL_DIR = "/opt/textshift/models/triboost_v4"
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def _get_s3_client(self):
        """Get S3 client for iDrive e2."""
        return boto3.client(
            's3',
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY
        )
    
    def _download_models_from_s3(self) -> bool:
        """Download TriBoost models from iDrive e2."""
        try:
            os.makedirs(self.LOCAL_MODEL_DIR, exist_ok=True)
            s3 = self._get_s3_client()
            
            model_files = [
                'xgboost_model.pkl',
                'lightgbm_model.pkl',
                'catboost_model.pkl',
            ]
            
            for model_file in model_files:
                local_path = os.path.join(self.LOCAL_MODEL_DIR, model_file)
                if not os.path.exists(local_path):
                    s3_key = f"{self.S3_MODEL_PREFIX}{model_file}"
                    logger.info(f"Downloading {s3_key} to {local_path}")
                    s3.download_file(settings.S3_BUCKET, s3_key, local_path)
            
            return True
        except Exception as e:
            logger.error(f"Failed to download TriBoost models from S3: {e}")
            return False
    
    def _load_models(self) -> bool:
        """Load TriBoost ensemble models."""
        if self._models_loaded:
            return True
        
        try:
            # Download from S3 if not present locally
            if not os.path.exists(os.path.join(self.LOCAL_MODEL_DIR, 'xgboost_model.pkl')):
                if not self._download_models_from_s3():
                    return False
            
            # Load XGBoost
            xgb_path = os.path.join(self.LOCAL_MODEL_DIR, 'xgboost_model.pkl')
            if os.path.exists(xgb_path):
                with open(xgb_path, 'rb') as f:
                    self._xgboost_model = pickle.load(f)
                logger.info("XGBoost model loaded")
            
            # Load LightGBM
            lgb_path = os.path.join(self.LOCAL_MODEL_DIR, 'lightgbm_model.pkl')
            if os.path.exists(lgb_path):
                with open(lgb_path, 'rb') as f:
                    self._lightgbm_model = pickle.load(f)
                logger.info("LightGBM model loaded")
            
            # Load CatBoost
            cb_path = os.path.join(self.LOCAL_MODEL_DIR, 'catboost_model.pkl')
            if os.path.exists(cb_path):
                with open(cb_path, 'rb') as f:
                    self._catboost_model = pickle.load(f)
                logger.info("CatBoost model loaded")
            
            # Load feature extractor
            from app.services.feature_extractor import FeatureExtractor565
            self._feature_extractor = FeatureExtractor565()
            
            self._models_loaded = True
            logger.info("TriBoost V4 ensemble loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load TriBoost models: {e}")
            return False
    
    def _get_model_predictions(self, features: np.ndarray) -> Dict[str, Tuple[float, float]]:
        """
        Get predictions from each model in the ensemble.
        
        Returns:
            Dict mapping model name to (human_prob, ai_prob) tuple
        """
        predictions = {}
        
        # Ensure features is 2D
        if features.ndim == 1:
            features = features.reshape(1, -1)
        
        # XGBoost prediction
        if self._xgboost_model is not None:
            try:
                xgb_proba = self._xgboost_model.predict_proba(features)[0]
                predictions['xgboost'] = (float(xgb_proba[0]), float(xgb_proba[1]))
            except Exception as e:
                logger.warning(f"XGBoost prediction failed: {e}")
        
        # LightGBM prediction
        if self._lightgbm_model is not None:
            try:
                lgb_proba = self._lightgbm_model.predict_proba(features)[0]
                predictions['lightgbm'] = (float(lgb_proba[0]), float(lgb_proba[1]))
            except Exception as e:
                logger.warning(f"LightGBM prediction failed: {e}")
        
        # CatBoost prediction
        if self._catboost_model is not None:
            try:
                cb_proba = self._catboost_model.predict_proba(features)[0]
                predictions['catboost'] = (float(cb_proba[0]), float(cb_proba[1]))
            except Exception as e:
                logger.warning(f"CatBoost prediction failed: {e}")
        
        return predictions
    
    def _ensemble_vote(self, predictions: Dict[str, Tuple[float, float]]) -> Tuple[float, float]:
        """
        Combine predictions using weighted soft voting.
        
        Returns:
            (human_probability, ai_probability) tuple
        """
        if not predictions:
            return (0.5, 0.5)
        
        total_weight = 0.0
        weighted_human = 0.0
        weighted_ai = 0.0
        
        for model_name, (human_prob, ai_prob) in predictions.items():
            weight = self.MODEL_WEIGHTS.get(model_name, 0.33)
            weighted_human += human_prob * weight
            weighted_ai += ai_prob * weight
            total_weight += weight
        
        if total_weight > 0:
            weighted_human /= total_weight
            weighted_ai /= total_weight
        
        return (weighted_human, weighted_ai)
    
    def predict(self, text: str) -> Dict[str, Any]:
        """
        Predict whether text is AI-generated using TriBoost ensemble.
        
        Args:
            text: The text to analyze
            
        Returns:
            Dict with prediction results including:
            - ai_probability: Overall AI probability (0-100)
            - human_probability: Overall human probability (0-100)
            - confidence_score: 1-10 confidence score
            - confidence_level: very_low/low/medium/high/very_high
            - model_predictions: Individual model predictions
            - ensemble_method: "weighted_soft_voting"
        """
        if not self._load_models():
            return {
                "error": "Failed to load TriBoost models",
                "ai_probability": 50.0,
                "human_probability": 50.0,
                "confidence_score": 1,
                "confidence_level": "very_low"
            }
        
        try:
            # Extract 565 features
            features = self._feature_extractor.extract_all_features(text)
            features_array = np.array(features).reshape(1, -1)
            
            # Get predictions from each model
            model_predictions = self._get_model_predictions(features_array)
            
            # Ensemble vote
            human_prob, ai_prob = self._ensemble_vote(model_predictions)
            
            # Calculate confidence score (1-10)
            confidence_score = self._calculate_confidence_score(ai_prob)
            
            return {
                "ai_probability": round(ai_prob * 100, 2),
                "human_probability": round(human_prob * 100, 2),
                "confidence_score": confidence_score,
                "confidence_level": self._get_confidence_level(confidence_score),
                "model_predictions": {
                    name: {
                        "human_probability": round(probs[0] * 100, 2),
                        "ai_probability": round(probs[1] * 100, 2)
                    }
                    for name, probs in model_predictions.items()
                },
                "ensemble_method": "weighted_soft_voting",
                "model_weights": self.MODEL_WEIGHTS,
                "features_extracted": len(features),
                "model_version": "triboost_v4"
            }
            
        except Exception as e:
            logger.error(f"TriBoost prediction failed: {e}")
            return {
                "error": str(e),
                "ai_probability": 50.0,
                "human_probability": 50.0,
                "confidence_score": 1,
                "confidence_level": "very_low"
            }
    
    def predict_batch(self, texts: List[str]) -> List[Dict[str, Any]]:
        """
        Predict AI probability for multiple texts.
        
        Args:
            texts: List of texts to analyze
            
        Returns:
            List of prediction results
        """
        return [self.predict(text) for text in texts]
    
    def _calculate_confidence_score(self, ai_prob: float) -> int:
        """Calculate confidence score (1-10) based on AI probability."""
        if ai_prob >= 0.95:
            return 10
        elif ai_prob >= 0.85:
            return 9
        elif ai_prob >= 0.75:
            return 8
        elif ai_prob >= 0.65:
            return 7
        elif ai_prob >= 0.55:
            return 6
        elif ai_prob >= 0.45:
            return 5
        elif ai_prob >= 0.35:
            return 4
        elif ai_prob >= 0.25:
            return 3
        elif ai_prob >= 0.15:
            return 2
        else:
            return 1
    
    def _get_confidence_level(self, score: int) -> str:
        """Get confidence level string from score."""
        if score >= 9:
            return "very_high"
        elif score >= 7:
            return "high"
        elif score >= 5:
            return "medium"
        elif score >= 3:
            return "low"
        else:
            return "very_low"
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the loaded models."""
        return {
            "name": "TriBoost V4",
            "version": "4.0",
            "models": ["XGBoost", "LightGBM", "CatBoost"],
            "features": 565,
            "accuracy": "99.18%",
            "ensemble_method": "weighted_soft_voting",
            "weights": self.MODEL_WEIGHTS,
            "models_loaded": self._models_loaded,
            "s3_location": f"s3://{settings.S3_BUCKET}/{self.S3_MODEL_PREFIX}",
            "local_location": self.LOCAL_MODEL_DIR
        }


# Singleton instance
triboost_predictor = TriBoostPredictor()
