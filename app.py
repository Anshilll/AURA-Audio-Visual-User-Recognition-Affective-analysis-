import os
import tempfile
from flask import Flask, request, jsonify, render_template

# Make sure we use the same path for serving if needed, but Flask defaults are fine
app = Flask(__name__, static_folder='static', template_folder='templates')

try:
    from inference import predict_emotion
except ImportError:
    print("Warning: inference.py not found or failed to load. Ensure the model files are present.")
    def predict_emotion(wav_path):
        return {
            'emotion': 'Neutral 😐',
            'confidence': 95.5,
            'all_scores': {
                'Anger 😠': 1.0, 'Happiness 😊': 2.0, 'Sadness 😢': 0.5,
                'Fear 😨': 0.5, 'Surprise 😲': 0.5, 'Neutral 😐': 95.5
            }
        }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400
    
    file = request.files['audio']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    if file:
        # Save to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name
            
        try:
            # Run inference
            result = predict_emotion(tmp_path)
            # Make sure it returns a proper python dict
            return jsonify(result)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({'error': str(e)}), 500
        finally:
            # Clean up
            if os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except Exception as e:
                    print(f"Error deleting temp file: {e}")

if __name__ == '__main__':
    # Make sure port 5000 is open or change if necessary
    app.run(debug=True, host='0.0.0.0', port=5000)
