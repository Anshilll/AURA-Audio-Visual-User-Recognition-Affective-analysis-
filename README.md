
# AURA-Audio-Visual-User-Recognition-Affective-analysis-
AURA is an advanced application that evaluates emotional states in real-time using live speech, uploaded audio, and webcam interactions. Powered by a custom PyTorch LSTM and face-api.js, it features a stunning glassmorphism UI with responsive lighting and automatic therapeutic interventions for high stress.
=======
<div align="center">
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />
  <h1>🎙️ Multimodal Emotion AI Workspace 🧠</h1>
  <p><b>Real-time emotion recognition from Live Speech, Audio Files, and Webcam Facial Expressions.</b></p>
</div>

---

## 🌟 Overview
Built upon state-of-the-art multimodal modeling, this project provides a stunning, fluid web application capable of identifying and extracting human emotion using:

1. **Live Microphone Audio (Speech-to-Emotion)**
2. **Pre-recorded `.wav` File Uploads**
3. **Live Webcam Feed (Face Expression tracking)**

The interface relies on a robust backend running a custom **LSTM classifier** trained on the IEMOCAP dataset (for speech) and browser-capable neural networks (`face-api.js`) for rapid client-side face inference. 

To help ease sudden emotional distress, the application is also programmed with **Therapeutic Interventions**. When extended periods of stress, anger, or panic are detected, the UI gracefully pivots to suggest clinically-inspired breathing exercises and grounding techniques.

---

## 🎨 Premium UI Features
- **Dynamic Glassmorphism**: High-performance CSS backdrops and reactive element states.
- **Particle System & Mood Lighting**: Real-time ambient background glow adjusting dynamically to the primary emotion identified.
- **Waveform Visualizer**: True-time microphone drawing leveraging the Web Audio API. 
- **In-Browser Client AV Coding**: An implementation of a strict 44.1kHz WAV encoding purely on the browser to ensure absolute model compatibility without `ffmpeg`.
- **Live Tabulation & Dashboard**: Smooth history logging and probability breakdown graph mapping.

---

## 🚀 Setup & Execution

1. **Install Requirements:**
Ensure your Python virtual environment handles the dependencies correctly:
```bash
pip install -r requirements.txt
```

2. **Run The Backend:**
Startup the Flask app acting as our inference gateway:
```bash
python app.py
```

3. **Open The Client Hub:**
Navigate to `http://localhost:5000` via your modern web browser. Make sure camera and microphone permissions are granted.

---

## ⚙️ Model Information
For Speech Emotion Inference, this system passes 8-dimensional audio features through a Bidirectional PyTorch LSTM Classifier:

1. Signal Mean
2. Signal Std
3. RMSE Mean
4. RMSE Std
5. Silence Fraction
6. Harmonic Frequency
7. Auto Correlation Peak
8. Auto Correlation Std

> Please refer to the extensive training pipelines across the project's Jupyter Notebooks.

_Designed for SNLP implementation and modern evaluation._