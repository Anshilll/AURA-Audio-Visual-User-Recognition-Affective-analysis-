"""
inference.py - Load the trained LSTM model and predict emotion from a WAV file.
"""
import os
import torch
import numpy as np
import librosa
import torch.nn as nn
import torch.nn.functional as F


# ── Model Definition (mirrored from lstm_classifier/s2e/lstm_classifier.py) ──
class LSTMClassifier(nn.Module):
    def __init__(self, config):
        super(LSTMClassifier, self).__init__()
        self.n_layers = config['n_layers']
        self.input_dim = config['input_dim']
        self.hidden_dim = config['hidden_dim']
        self.output_dim = config['output_dim']
        self.bidirectional = config['bidirectional']
        self.dropout = config['dropout'] if self.n_layers > 1 else 0

        self.rnn = nn.LSTM(self.input_dim, self.hidden_dim, bias=True,
                           num_layers=2, dropout=self.dropout,
                           bidirectional=self.bidirectional)
        self.out = nn.Linear(self.hidden_dim, self.output_dim)

    def forward(self, input_seq):
        rnn_output, (hidden, _) = self.rnn(input_seq)
        if self.bidirectional:
            rnn_output = rnn_output[:, :, :self.hidden_dim] + \
                         rnn_output[:, :, self.hidden_dim:]
        class_scores = F.softmax(self.out(rnn_output[0]), dim=1)
        return class_scores


# ── Config (must match training config) ──────────────────────────────────────
MODEL_CONFIG = {
    'bidirectional': False,
    'input_dim': 8,
    'hidden_dim': 50,
    'output_dim': 6,
    'dropout': 0.2,
    'n_layers': 2,
}

EMOTION_LABELS = {0: 'Anger 😠', 1: 'Happiness 😊', 2: 'Sadness 😢',
                  3: 'Fear 😨', 4: 'Surprise 😲', 5: 'Neutral 😐'}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, 'lstm_classifier', 's2e', 'runs',
                          'basic_lstm-best_model.pth')


# ── Feature Extraction (from main.py / extract_audio_features) ───────────────
def extract_features(wav_path: str, sr: int = 44100) -> np.ndarray:
    """
    Extract the same 8-dimensional feature vector used during training:
      sig_mean, sig_std, rmse_mean, rmse_std, silence, harmonic,
      auto_corr_max, auto_corr_std
    """
    y, _ = librosa.load(wav_path, sr=sr)

    sig_mean = np.mean(np.abs(y))
    sig_std = np.std(y)

    rmse = librosa.feature.rms(y=y + 0.0001)[0]
    rmse_mean = np.mean(rmse)
    rmse_std = np.std(rmse)

    silence = np.sum(rmse <= 0.4 * np.mean(rmse)) / float(len(rmse))

    y_harmonic = librosa.effects.hpss(y)[0]
    harmonic = np.mean(y_harmonic) * 1000

    cl = 0.45 * sig_mean
    center_clipped = []
    for s in y:
        if s >= cl:
            center_clipped.append(s - cl)
        elif s <= -cl:
            center_clipped.append(s + cl)
        else:
            center_clipped.append(0)
    auto_corrs = librosa.autocorrelate(np.array(center_clipped))
    auto_corr_max = 1000 * np.max(auto_corrs) / len(auto_corrs)
    auto_corr_std = np.std(auto_corrs)

    return np.array([sig_mean, sig_std, rmse_mean, rmse_std,
                     silence, harmonic, auto_corr_max, auto_corr_std],
                    dtype=np.float32)


# ── Inference ─────────────────────────────────────────────────────────────────
_model = None  # cached singleton


def _load_model():
    global _model
    if _model is not None:
        return _model

    device = 'cpu'
    _model = LSTMClassifier(MODEL_CONFIG).to(device)
    checkpoint = torch.load(MODEL_PATH, map_location=device)
    _model.load_state_dict(checkpoint['model'])
    _model.eval()
    return _model


def predict_emotion(wav_path: str):
    """
    Returns dict with keys:
      - emotion: str   (e.g. "Happiness 😊")
      - confidence: float (0-100)
      - all_scores: dict[str, float]   probabilities for every class
    """
    features = extract_features(wav_path)
    tensor = torch.FloatTensor(features).unsqueeze(0).unsqueeze(0)  # [1, 1, 8]

    model = _load_model()
    with torch.no_grad():
        probs = model(tensor).squeeze()  # [6]

    idx = torch.argmax(probs).item()
    confidence = probs[idx].item() * 100

    all_scores = {EMOTION_LABELS[i]: round(probs[i].item() * 100, 2)
                  for i in range(len(EMOTION_LABELS))}

    return {
        'emotion': EMOTION_LABELS[idx],
        'confidence': round(confidence, 2),
        'all_scores': all_scores,
    }
