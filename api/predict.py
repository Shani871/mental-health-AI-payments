import json
import os
import pickle
import sys
import warnings

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.multioutput import MultiOutputClassifier
from sklearn.preprocessing import LabelEncoder, StandardScaler

warnings.filterwarnings("ignore")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(SCRIPT_DIR, "..", "Student Mental health final.csv")
CACHE_PATH = os.path.join(SCRIPT_DIR, ".predict_model_cache.pkl")
CACHE_VERSION = "1"

TARGET_DEPRESSION = "Do you have Depression?"
TARGET_ANXIETY = "Do you have Anxiety?"

COL_GENDER = "Choose your gender"
COL_AGE = "Age"
COL_COURSE = "What is your course?"
COL_YEAR = "Your current year of Study"
COL_CGPA_RAW = "What is your CGPA?"
COL_CGPA = "CGPA"
COL_MARITAL = "Marital status"


def parse_cgpa(value):
    text = str(value).strip()
    if not text:
        return 3.0
    if "-" in text:
        parts = text.replace(" ", "").split("-")
        if len(parts) == 2:
            try:
                return (float(parts[0]) + float(parts[1])) / 2.0
            except Exception:
                pass
    try:
        return float(text)
    except Exception:
        return 3.0


def yes_no_to_binary(value):
    text = str(value).strip().lower()
    if text in ("yes", "y", "1", "true"):
        return 1
    return 0


def normalize_text(value):
    return " ".join(str(value).strip().split())


def normalize_gender(value):
    text = normalize_text(value).lower()
    if text in ("female", "f"):
        return "Female"
    if text in ("male", "m"):
        return "Male"
    return text.title()


def normalize_marital(value):
    text = normalize_text(value).lower()
    if text in ("yes", "y", "married", "1", "true"):
        return "Yes"
    if text in ("no", "n", "single", "0", "false"):
        return "No"
    return text.title()


def normalize_year(value):
    text = normalize_text(value).lower().replace("_", " ").replace("-", " ")
    text = " ".join(text.split())
    if text.startswith("year"):
        suffix = text.replace("year", "", 1).strip()
        if suffix:
            return f"Year {suffix}"
    return text.title()


def normalize_course(value):
    text = normalize_text(value)
    if not text:
        return text
    if text.isupper() and len(text) <= 6:
        return text
    return text.title()


def build_artifacts():
    df = pd.read_csv(DATASET_PATH).ffill()

    df[TARGET_DEPRESSION] = df[TARGET_DEPRESSION].apply(yes_no_to_binary)
    df[TARGET_ANXIETY] = df[TARGET_ANXIETY].apply(yes_no_to_binary)
    if "Do you have Panic attack?" in df.columns:
        df["Do you have Panic attack?"] = df["Do you have Panic attack?"].apply(yes_no_to_binary)
    if "Did you seek any specialist for a treatment?" in df.columns:
        df["Did you seek any specialist for a treatment?"] = df[
            "Did you seek any specialist for a treatment?"
        ].apply(yes_no_to_binary)

    df[COL_CGPA] = df[COL_CGPA_RAW].apply(parse_cgpa)

    df[COL_GENDER] = df[COL_GENDER].apply(normalize_gender)
    df[COL_COURSE] = df[COL_COURSE].apply(normalize_course)
    df[COL_YEAR] = df[COL_YEAR].apply(normalize_year)
    df[COL_MARITAL] = df[COL_MARITAL].apply(normalize_marital)

    le_gender = LabelEncoder()
    le_course = LabelEncoder()
    le_year = LabelEncoder()
    le_marital = LabelEncoder()

    df[COL_GENDER] = le_gender.fit_transform(df[COL_GENDER])
    df[COL_COURSE] = le_course.fit_transform(df[COL_COURSE])
    df[COL_YEAR] = le_year.fit_transform(df[COL_YEAR])
    df[COL_MARITAL] = le_marital.fit_transform(df[COL_MARITAL])

    feature_columns = [COL_GENDER, COL_AGE, COL_COURSE, COL_YEAR, COL_MARITAL, COL_CGPA]
    X = df[feature_columns].copy()
    y = df[[TARGET_DEPRESSION, TARGET_ANXIETY]].copy()

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    X_train, _, y_train, _ = train_test_split(X_scaled, y, test_size=0.2, random_state=42)
    model = MultiOutputClassifier(RandomForestClassifier(n_estimators=250, random_state=42))
    model.fit(X_train, y_train)

    return {
        "model": model,
        "scaler": scaler,
        "encoders": {
            "gender": le_gender,
            "course": le_course,
            "year": le_year,
            "marital": le_marital,
        },
    }


def dataset_fingerprint():
    stat = os.stat(DATASET_PATH)
    return f"{stat.st_size}:{stat.st_mtime_ns}"


def load_cached_artifacts(fingerprint):
    if not os.path.exists(CACHE_PATH):
        return None
    try:
        with open(CACHE_PATH, "rb") as cache_file:
            payload = pickle.load(cache_file)
        if not isinstance(payload, dict):
            return None
        if payload.get("version") != CACHE_VERSION:
            return None
        if payload.get("fingerprint") != fingerprint:
            return None
        artifacts = payload.get("artifacts")
        if not isinstance(artifacts, dict):
            return None
        return artifacts
    except Exception:
        return None


def save_cached_artifacts(artifacts, fingerprint):
    payload = {
        "version": CACHE_VERSION,
        "fingerprint": fingerprint,
        "artifacts": artifacts,
    }
    tmp_path = f"{CACHE_PATH}.{os.getpid()}.tmp"
    try:
        with open(tmp_path, "wb") as tmp_file:
            pickle.dump(payload, tmp_file, protocol=pickle.HIGHEST_PROTOCOL)
        os.replace(tmp_path, CACHE_PATH)
    except Exception:
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass


def build_or_load_artifacts(force_rebuild=False):
    fingerprint = dataset_fingerprint()
    if not force_rebuild:
        cached = load_cached_artifacts(fingerprint)
        if cached is not None:
            return cached

    artifacts = build_artifacts()
    save_cached_artifacts(artifacts, fingerprint)
    return artifacts


def encode_input_value(raw_value, encoder, normalizer):
    classes = list(encoder.classes_)
    if raw_value is None:
        return 0

    if isinstance(raw_value, (int, float)):
        numeric = int(raw_value)
        if 0 <= numeric < len(classes):
            return numeric

    text = normalizer(raw_value)
    if text.isdigit():
        numeric = int(text)
        if 0 <= numeric < len(classes):
            return numeric

    class_lookup = {normalizer(name): idx for idx, name in enumerate(classes)}
    return class_lookup.get(normalizer(text), 0)


def positive_probability(estimator, vector):
    probabilities = estimator.predict_proba(vector)[0]
    classes = list(estimator.classes_)
    if 1 in classes:
        return float(probabilities[classes.index(1)])
    return float(probabilities[-1])


def get_options(encoders):
    return {
        "genderOptions": list(encoders["gender"].classes_),
        "courseOptions": list(encoders["course"].classes_),
        "yearOptions": list(encoders["year"].classes_),
        "maritalOptions": list(encoders["marital"].classes_),
    }


def predict(payload, artifacts):
    encoders = artifacts["encoders"]
    model = artifacts["model"]
    scaler = artifacts["scaler"]

    gender = encode_input_value(payload.get("gender"), encoders["gender"], normalize_gender)
    course = encode_input_value(payload.get("course"), encoders["course"], normalize_course)
    year = encode_input_value(payload.get("year"), encoders["year"], normalize_year)
    marital = encode_input_value(payload.get("marital"), encoders["marital"], normalize_marital)

    try:
        age = float(payload.get("age", 20))
    except Exception:
        age = 20.0
    try:
        cgpa = float(payload.get("cgpa", 3.0))
    except Exception:
        cgpa = 3.0

    input_vector = [[gender, age, course, year, marital, cgpa]]
    scaled_vector = scaler.transform(input_vector)

    prediction = model.predict(scaled_vector)
    depression = int(prediction[0][0])
    anxiety = int(prediction[0][1])

    depression_probability = positive_probability(model.estimators_[0], scaled_vector)
    anxiety_probability = positive_probability(model.estimators_[1], scaled_vector)

    overall_status = "Moderate Risk"
    if depression == 0 and anxiety == 0:
        overall_status = "Low Risk"
    elif depression == 1 and anxiety == 1:
        overall_status = "High Risk"

    recommendation = {
        "Low Risk": "Maintain healthy sleep, exercise, and social routines.",
        "Moderate Risk": "Track mood regularly and consider speaking with a counselor.",
        "High Risk": "Please connect with a therapist as soon as possible.",
    }[overall_status]

    return {
        "depressionRisk": "High" if depression == 1 else "Low",
        "anxietyRisk": "High" if anxiety == 1 else "Low",
        "overallStatus": overall_status,
        "depressionProbability": round(depression_probability, 4),
        "anxietyProbability": round(anxiety_probability, 4),
        "recommendation": recommendation,
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input provided"}))
        return

    arg = sys.argv[1]
    force_rebuild = arg == "--rebuild-cache"
    artifacts = build_or_load_artifacts(force_rebuild=force_rebuild)

    if force_rebuild:
        print(json.dumps({"status": "ok", "message": "Prediction cache rebuilt"}))
        return

    if arg == "--options":
        print(json.dumps(get_options(artifacts["encoders"])))
        return

    payload = json.loads(arg)
    print(json.dumps(predict(payload, artifacts)))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
