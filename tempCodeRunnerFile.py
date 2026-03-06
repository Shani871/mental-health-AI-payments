import pandas as pd
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.multioutput import MultiOutputClassifier
from sklearn.ensemble import RandomForestClassifier

# Load dataset
df = pd.read_csv("Student Mental health final.csv")
df = df.ffill()

# Convert Yes/No columns
df['Do you have Depression?'] = df['Do you have Depression?'].map({'Yes': 1, 'No': 0})
df['Do you have Anxiety?'] = df['Do you have Anxiety?'].map({'Yes': 1, 'No': 0})
df['Do you have Panic attack?'] = df['Do you have Panic attack?'].map({'Yes': 1, 'No': 0})
df['Did you seek any specialist for a treatment?'] = df['Did you seek any specialist for a treatment?'].map({'Yes': 1, 'No': 0})

# Convert CGPA to numbers
def convert_cgpa(x):
    low, high = x.split('-')
    return (float(low) + float(high)) / 2

df['CGPA'] = df['What is your CGPA?'].apply(convert_cgpa)
df = df.drop(columns=['What is your CGPA?'])

# Encode categorical columns
le_gender = LabelEncoder()
le_course = LabelEncoder()
le_year = LabelEncoder()
le_marital = LabelEncoder()

df['Choose your gender'] = le_gender.fit_transform(df['Choose your gender'])
df['What is your course?'] = le_course.fit_transform(df['What is your course?'])
df['Your current year of Study'] = le_year.fit_transform(df['Your current year of Study'])
df['Marital status'] = le_marital.fit_transform(df['Marital status'])

# features and targets
X = df.drop(columns=[
    'Do you have Depression?',
    'Do you have Anxiety?',
    'Do you have Panic attack?',
    'Did you seek any specialist for a treatment?'
])

y = df[['Do you have Depression?', 'Do you have Anxiety?']]

# Scale features
scaler = StandardScaler()
X = scaler.fit_transform(X)

# Train test
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# Train model
model = MultiOutputClassifier(
    RandomForestClassifier(n_estimators=200, random_state=42)
)

model.fit(X_train, y_train)

# User input
print("Enter Student Details")

print("\nGender Options:")
for i, g in enumerate(le_gender.classes_):
    print(f"{i} - {g}")
gender = int(input("Select gender number: "))

age = int(input("Age: "))

print("\nCourse Options:")
for i, c in enumerate(le_course.classes_):
    print(f"{i} - {c}")
course = int(input("Select course number: "))

print("\nYear Options:")
for i, y_ in enumerate(le_year.classes_):
    print(f"{i} - {y_}")
year = int(input("Select year number: "))

print("\nMarital Status Options:")
for i, m in enumerate(le_marital.classes_):
    print(f"{i} - {m}")
marital = int(input("Select marital status number: "))

cgpa = float(input("CGPA (e.g., 3.2): "))

# Prepare input
new_student = [[gender, age, course, year, marital, cgpa]]
new_student = scaler.transform(new_student)

# Predict
prediction = model.predict(new_student)

depression = prediction[0][0]
anxiety = prediction[0][1]

# Output
print("\nPrediction Result")
if depression == 1:
    print("Depression Risk: High")
else:
    print("Depression Risk: Low")
if anxiety == 1:
    print("Anxiety Risk: High")
else:
    print("Anxiety Risk: Low")
if depression == 0 and anxiety == 0:
    print("Overall Status: Low Risk")
elif depression == 1 and anxiety == 1:
    print("Overall Status: High Risk")
else:
    print("Overall Status: Moderate Risk")
print("\nThis is an AI-based risk prediction tool made by Ayushdeep Mishra and not a medical diagnosis.")
input("\nPress Enter to exit...")