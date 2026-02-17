import json
import logging
import os
import time
import torch
import boto3
import tarfile
import tempfile
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    AutoModelForSeq2SeqLM,
    T5ForConditionalGeneration,
    T5Tokenizer,
    MarianMTModel,
    MarianTokenizer,
)
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
S3_BUCKET = "textshift-sagemaker-models-096938402960"
MAX_BATCH_SIZE = 12


def _download_s3_model(s3_key, target_dir):
    s3 = boto3.client("s3", region_name="us-east-1")
    local_tar = os.path.join(tempfile.gettempdir(), os.path.basename(s3_key))
    logger.info(f"Downloading s3://{S3_BUCKET}/{s3_key} -> {local_tar}")
    s3.download_file(S3_BUCKET, s3_key, local_tar)
    os.makedirs(target_dir, exist_ok=True)
    with tarfile.open(local_tar, "r:gz") as tar:
        tar.extractall(target_dir)
    os.remove(local_tar)
    logger.info(f"Extracted to {target_dir}, contents: {os.listdir(target_dir)}")


def model_fn(model_dir):
    t0 = time.time()
    models = {}

    cache_dir = os.path.join(tempfile.gettempdir(), "hf_cache")
    os.makedirs(cache_dir, exist_ok=True)

    custom_dir = os.path.join(tempfile.gettempdir(), "custom_models")
    os.makedirs(custom_dir, exist_ok=True)

    logger.info(f"Loading all models on device={DEVICE}")

    logger.info("Loading CoEdIT-large...")
    tok = AutoTokenizer.from_pretrained("grammarly/coedit-large", cache_dir=cache_dir)
    mdl = AutoModelForSeq2SeqLM.from_pretrained("grammarly/coedit-large", cache_dir=cache_dir).to(DEVICE)
    mdl.eval()
    models["coedit-large"] = {"tokenizer": tok, "model": mdl, "task": "text2text"}

    logger.info("Loading Flan-T5-base...")
    tok = AutoTokenizer.from_pretrained("google/flan-t5-base", cache_dir=cache_dir)
    mdl = AutoModelForSeq2SeqLM.from_pretrained("google/flan-t5-base", cache_dir=cache_dir).to(DEVICE)
    mdl.eval()
    models["flan-t5-base"] = {"tokenizer": tok, "model": mdl, "task": "text2text"}

    logger.info("Loading Tone Detector (go_emotions)...")
    tok = AutoTokenizer.from_pretrained("SamLowe/roberta-base-go_emotions", cache_dir=cache_dir)
    mdl = AutoModelForSequenceClassification.from_pretrained("SamLowe/roberta-base-go_emotions", cache_dir=cache_dir).to(DEVICE)
    mdl.eval()
    models["tone-detector"] = {"tokenizer": tok, "model": mdl, "task": "classification"}

    logger.info("Loading SBERT (all-MiniLM-L6-v2)...")
    sbert = SentenceTransformer("all-MiniLM-L6-v2", cache_folder=cache_dir, device=DEVICE)
    models["sbert"] = {"model": sbert, "task": "embedding"}

    logger.info("Loading Translator en-es...")
    tok = MarianTokenizer.from_pretrained("Helsinki-NLP/opus-mt-en-es", cache_dir=cache_dir)
    mdl = MarianMTModel.from_pretrained("Helsinki-NLP/opus-mt-en-es", cache_dir=cache_dir).to(DEVICE)
    mdl.eval()
    models["translator-en-es"] = {"tokenizer": tok, "model": mdl, "task": "translation"}

    logger.info("Loading Translator en-hi...")
    tok = MarianTokenizer.from_pretrained("Helsinki-NLP/opus-mt-en-hi", cache_dir=cache_dir)
    mdl = MarianMTModel.from_pretrained("Helsinki-NLP/opus-mt-en-hi", cache_dir=cache_dir).to(DEVICE)
    mdl.eval()
    models["translator-en-hi"] = {"tokenizer": tok, "model": mdl, "task": "translation"}

    detector_dir = os.path.join(custom_dir, "detector")
    _download_s3_model("models/textshift-detector/model.tar.gz", detector_dir)
    logger.info("Loading AI Detector (custom RoBERTa)...")
    tok = AutoTokenizer.from_pretrained(detector_dir)
    mdl = AutoModelForSequenceClassification.from_pretrained(detector_dir).to(DEVICE)
    mdl.eval()
    models["detector"] = {"tokenizer": tok, "model": mdl, "task": "classification"}

    humanizer_dir = os.path.join(custom_dir, "humanizer")
    _download_s3_model("models/textshift-humanizer/model.tar.gz", humanizer_dir)
    logger.info("Loading Humanizer (custom T5)...")
    tok = T5Tokenizer.from_pretrained(humanizer_dir)
    mdl = T5ForConditionalGeneration.from_pretrained(humanizer_dir).to(DEVICE)
    mdl.eval()
    if DEVICE == "cuda":
        try:
            logger.info("Applying torch.compile to humanizer model...")
            mdl = torch.compile(mdl)
            logger.info("Humanizer model compiled successfully")
        except Exception as e:
            logger.warning(f"torch.compile failed for humanizer: {e}")
    models["humanizer"] = {"tokenizer": tok, "model": mdl, "task": "text2text"}

    elapsed = time.time() - t0
    logger.info(f"All models loaded in {elapsed:.1f}s on {DEVICE}")
    logger.info(f"Models available: {list(models.keys())}")

    if DEVICE == "cuda":
        mem = torch.cuda.memory_allocated() / 1024**3
        logger.info(f"GPU memory used: {mem:.2f} GB")

    return models


def input_fn(request_body, content_type):
    if content_type == "application/json":
        return json.loads(request_body)
    raise ValueError(f"Unsupported content type: {content_type}")


def _build_gen_kwargs(parameters):
    gen_kwargs = {
        "max_new_tokens": parameters.get("max_new_tokens", 256),
        "num_beams": parameters.get("num_beams", 4),
    }
    for key in ["do_sample", "temperature", "top_p", "top_k",
                 "repetition_penalty", "no_repeat_ngram_size",
                 "early_stopping", "length_penalty"]:
        if key in parameters:
            gen_kwargs[key] = parameters[key]
    if "early_stopping" not in gen_kwargs:
        gen_kwargs["early_stopping"] = True
    return gen_kwargs


def _predict_text2text_single(model_info, text, parameters):
    tokenizer = model_info["tokenizer"]
    model = model_info["model"]
    max_input_len = parameters.get("max_input_length", 512)
    gen_kwargs = _build_gen_kwargs(parameters)
    input_ids = tokenizer(
        text, return_tensors="pt", max_length=max_input_len, truncation=True
    ).input_ids.to(DEVICE)
    with torch.no_grad():
        if DEVICE == "cuda":
            with torch.amp.autocast("cuda"):
                outputs = model.generate(input_ids, **gen_kwargs)
        else:
            outputs = model.generate(input_ids, **gen_kwargs)
    return tokenizer.decode(outputs[0], skip_special_tokens=True)


def _predict_text2text_batch(model_info, inputs_list, parameters):
    tokenizer = model_info["tokenizer"]
    model = model_info["model"]
    max_input_len = parameters.get("max_input_length", 512)
    gen_kwargs = _build_gen_kwargs(parameters)

    all_results = []
    for i in range(0, len(inputs_list), MAX_BATCH_SIZE):
        batch = inputs_list[i:i + MAX_BATCH_SIZE]
        encoded = tokenizer(
            batch, return_tensors="pt", max_length=max_input_len,
            truncation=True, padding=True
        ).to(DEVICE)
        with torch.no_grad():
            if DEVICE == "cuda":
                with torch.amp.autocast("cuda"):
                    outputs = model.generate(
                        input_ids=encoded.input_ids,
                        attention_mask=encoded.attention_mask,
                        **gen_kwargs
                    )
            else:
                outputs = model.generate(
                    input_ids=encoded.input_ids,
                    attention_mask=encoded.attention_mask,
                    **gen_kwargs
                )
        for j in range(len(batch)):
            text = tokenizer.decode(outputs[j], skip_special_tokens=True)
            all_results.append({"generated_text": text})
    return all_results


def predict_fn(data, models):
    model_name = data.get("model_name", "coedit-large")
    inputs = data.get("inputs", "")
    parameters = data.get("parameters", {})

    if model_name not in models:
        return {"error": f"Unknown model: {model_name}. Available: {list(models.keys())}"}

    model_info = models[model_name]
    task = model_info["task"]

    try:
        if isinstance(inputs, list):
            if task == "text2text":
                t0 = time.time()
                results = _predict_text2text_batch(model_info, inputs, parameters)
                elapsed = time.time() - t0
                logger.info(f"Batch text2text [{model_name}]: {len(inputs)} inputs in {elapsed:.1f}s")
                return results

            if task == "translation":
                tokenizer = model_info["tokenizer"]
                model = model_info["model"]
                all_results = []
                for i in range(0, len(inputs), MAX_BATCH_SIZE):
                    batch = inputs[i:i + MAX_BATCH_SIZE]
                    encoded = tokenizer(
                        batch, return_tensors="pt", max_length=512,
                        truncation=True, padding=True
                    ).input_ids.to(DEVICE)
                    with torch.no_grad():
                        if DEVICE == "cuda":
                            with torch.amp.autocast("cuda"):
                                out = model.generate(encoded, max_length=512)
                        else:
                            out = model.generate(encoded, max_length=512)
                    for j in range(len(batch)):
                        text = tokenizer.decode(out[j], skip_special_tokens=True)
                        all_results.append({"translation_text": text})
                return all_results

            results = []
            for single_input in inputs:
                single_data = {"model_name": model_name, "inputs": single_input, "parameters": parameters}
                result = predict_fn(single_data, models)
                results.append(result)
            return results

        if task == "text2text":
            result = _predict_text2text_single(model_info, inputs, parameters)
            return [{"generated_text": result}]

        elif task == "classification":
            tokenizer = model_info["tokenizer"]
            model = model_info["model"]
            encoded = tokenizer(
                inputs, return_tensors="pt", max_length=512, truncation=True, padding=True
            ).to(DEVICE)
            with torch.no_grad():
                outputs = model(**encoded)
            scores = torch.softmax(outputs.logits, dim=-1)[0]
            id2label = model.config.id2label
            top_k = parameters.get("top_k", len(id2label))
            results = [
                {"label": id2label[i], "score": scores[i].item()}
                for i in range(len(id2label))
            ]
            results.sort(key=lambda x: x["score"], reverse=True)
            return [results[:top_k]]

        elif task == "translation":
            tokenizer = model_info["tokenizer"]
            model = model_info["model"]
            input_ids = tokenizer(
                inputs, return_tensors="pt", max_length=512, truncation=True
            ).input_ids.to(DEVICE)
            with torch.no_grad():
                outputs = model.generate(input_ids, max_length=512)
            result = tokenizer.decode(outputs[0], skip_special_tokens=True)
            return [{"translation_text": result}]

        elif task == "embedding":
            model = model_info["model"]
            embeddings = model.encode([inputs])
            return [{"embedding": embeddings[0].tolist()}]

        else:
            return {"error": f"Unknown task: {task}"}

    except Exception as e:
        logger.error(f"Prediction error for {model_name}: {e}")
        return {"error": str(e)}


def output_fn(prediction, accept):
    return json.dumps(prediction), "application/json"
