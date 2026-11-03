FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY face_engine.py matcher.py store.py app.py enroll.py selfcheck.py test_guards.py ./

# Models are mounted at /app/models (see fetch-models.sh); they are not baked
# into the image so the build stays reproducible and the image small.
ENV FACE_YUNET_PATH=/app/models/yunet.onnx
ENV FACE_SFACE_PATH=/app/models/sface.onnx

EXPOSE 8090

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8090"]
