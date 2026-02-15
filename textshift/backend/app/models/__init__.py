# Models module
from app.models.user import User
from app.models.scan import Scan
from app.models.credit import CreditTransaction
from app.models.subscription import Subscription
from app.models.api_key import APIKey

# Phase 3: Self-Learning ML System models
from app.models.feedback import UserFeedback, FeedbackType
from app.models.model_version import ModelVersion, ModelStatus, ModelType
from app.models.training_run import TrainingRun, TrainingStatus, TrainingTrigger
from app.models.ab_test import ABTestAssignment, ABTestGroup
from app.models.model_metrics import ModelMetrics
from app.models.training_sample import TrainingSampleQueue, SampleStatus, SampleSourceType

# Promo system models
from app.models.promo import Promo, PromoRedemption, PromoType

# Email campaign system models
from app.models.email_campaign import EmailCampaign, EmailSend, EmailType, CampaignStatus, TargetAudience

# Humanized text hash tracking (for ensuring TextShift humanized outputs pass our detector)
from app.models.humanized_hash import HumanizedTextHash
