import pandas as pd
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.multioutput import MultiOutputClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
import sys

# =========================
# LOAD DATASET
# =========================
df = pd.read_csv("Student Mental health final.csv")
df = df.ffill()

# =========================
# CONVERT YES/NO TO 1/0
# =========================
df['Do you have Depression?'] = df['Do you have Depression?'].map({'Yes': 1, 'No': 0})
df['Do you have Anxiety?'] = df['Do you have Anxiety?'].map({'Yes': 1, 'No': 0})
df['Do you have Panic attack?'] = df['Do you have Panic attack?'].map({'Yes': 1, 'No': 0})
df['Did you seek any specialist for a treatment?'] = df['Did you seek any specialist for a treatment?'].map({'Yes': 1, 'No': 0})

# =========================
# CONVERT CGPA RANGE TO NUMBER
# =========================
def convert_cgpa(x):
    low, high = x.split('-')
    return (float(low) + float(high)) / 2

df['CGPA'] = df['What is your CGPA?'].apply(convert_cgpa)
df = df.drop(columns=['What is your CGPA?'])

# =========================
# ENCODE CATEGORICAL DATA
# =========================
le_gender = LabelEncoder()
le_course = LabelEncoder()
le_year = LabelEncoder()
le_marital = LabelEncoder()

df['Choose your gender'] = le_gender.fit_transform(df['Choose your gender'])
df['What is your course?'] = le_course.fit_transform(df['What is your course?'])
df['Your current year of Study'] = le_year.fit_transform(df['Your current year of Study'])
df['Marital status'] = le_marital.fit_transform(df['Marital status'])

# =========================
# FEATURES AND TARGET
# =========================
X = df.drop(columns=[
    'Do you have Depression?',
    'Do you have Anxiety?',
    'Do you have Panic attack?',
    'Did you seek any specialist for a treatment?'
])

y = df[['Do you have Depression?', 'Do you have Anxiety?', 'Do you have Panic attack?']]

# =========================
# SCALE FEATURES
# =========================
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# =========================
# TRAIN TEST SPLIT
# =========================
X_train, X_test, y_train, y_test = train_test_split(
    X_scaled, y, test_size=0.2, random_state=42
)

# =========================
# TRAIN MODEL
# =========================
model = MultiOutputClassifier(
    RandomForestClassifier(n_estimators=200, random_state=42)
)

model.fit(X_train, y_train)

# =========================
# MODEL EVALUATION
# =========================
print("\n--- Model Evaluation ---")
y_pred = model.predict(X_test)

for i, col in enumerate(y.columns):
    acc = accuracy_score(y_test.iloc[:, i], y_pred[:, i])
    print(f"{col} Prediction Accuracy: {acc * 100:.1f}%")

print("------------------------\n")

print("Enter Student Details (type 'q' to exit)")

# =========================
# INPUT FUNCTIONS
# =========================
def get_int_input(prompt, valid_range=None):
    while True:
        val = input(prompt)

        if val.lower() == 'q':
            print("Exiting...")
            sys.exit()

        try:
            num = int(val)

            if valid_range and num not in valid_range:
                print("Please enter a valid option.")
                continue

            return num

        except ValueError:
            print("Invalid input. Enter a whole number.")


def get_float_input(prompt):
    while True:
        val = input(prompt)

        if val.lower() == 'q':
            print("Exiting...")
            sys.exit()

        try:
            return float(val)

        except ValueError:
            print("Invalid input. Enter a decimal number.")


# =========================
# USER INPUT
# =========================

print("\nGender Options:")
for i, g in enumerate(le_gender.classes_):
    print(f"{i} - {g}")

gender = get_int_input("Select gender number: ", range(len(le_gender.classes_)))

age = get_int_input("Age: ")

print("\nCourse Options:")
for i, c in enumerate(le_course.classes_):
    print(f"{i} - {c}")

course = get_int_input("Select course number: ", range(len(le_course.classes_)))

print("\nYear Options:")
for i, y_ in enumerate(le_year.classes_):
    print(f"{i} - {y_}")

year = get_int_input("Select year number: ", range(len(le_year.classes_)))

print("\nMarital Status Options:")
for i, m in enumerate(le_marital.classes_):
    print(f"{i} - {m}")

marital = get_int_input("Select marital status number: ", range(len(le_marital.classes_)))

cgpa = get_float_input("CGPA (e.g., 3.2): ")

# =========================
# PREPARE INPUT (FIXED WARNING)
# =========================
new_student = pd.DataFrame(
    [[gender, age, course, year, marital, cgpa]],
    columns=X.columns
)

new_student_scaled = scaler.transform(new_student)

# =========================
# PREDICTION
# =========================
prediction = model.predict(new_student_scaled)
probabilities = model.predict_proba(new_student_scaled)

depression = prediction[0][0]
anxiety = prediction[0][1]
panic = prediction[0][2]

prob_dep = probabilities[0][0][1] * 100 if len(probabilities[0][0]) > 1 else 0
prob_anx = probabilities[1][0][1] * 100 if len(probabilities[1][0]) > 1 else 0
prob_pan = probabilities[2][0][1] * 100 if len(probabilities[2][0]) > 1 else 0

# =========================
# OUTPUT RESULT
# =========================
print("\n=== Prediction Result ===")

print(f"Depression Risk: {'High' if depression else 'Low'} ({prob_dep:.1f}%)")
print(f"Anxiety Risk:    {'High' if anxiety else 'Low'} ({prob_anx:.1f}%)")
print(f"Panic Attack:    {'High' if panic else 'Low'} ({prob_pan:.1f}%)")

# =========================
# OVERALL RISK
# =========================
risk_score = depression + anxiety + panic

if risk_score == 0:
    print("Overall Status:  Low Risk")

elif risk_score == 3:
    print("Overall Status:  High Risk")

else:
    print("Overall Status:  Moderate Risk")

# =========================
# FEATURE IMPORTANCE
# =========================
avg_importances = sum(est.feature_importances_ for est in model.estimators_) / len(model.estimators_)

features_list = list(X.columns)

top_feature_idx = avg_importances.argmax()

print(f"\n[Model Insights] Most influential factor: {features_list[top_feature_idx]}")

# =========================
# DISCLAIMER
# =========================
print("\nDisclaimer: This is an AI-based risk prediction tool made by Ayushdeep Mishra and not a medical diagnosis.")

input("\nPress Enter to exit...")
