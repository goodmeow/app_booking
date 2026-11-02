#!/bin/sh
# Download the OpenCV Zoo models used by the face service.
# Not committed: SFace alone is ~37 MB.
set -eu

DIR="$(cd "$(dirname "$0")" && pwd)/models"
mkdir -p "$DIR"

fetch() {
  url="$1"
  target="$2"
  expected="$3"
  if [ -f "$target" ]; then
    echo "sudah ada: $target"
    return
  fi
  echo "unduh $target"
  curl -fsSL -o "$target" "$url"
  actual=$(sha256sum "$target" | cut -d' ' -f1)
  if [ "$actual" != "$expected" ]; then
    rm -f "$target"
    echo "checksum salah untuk $target" >&2
    exit 1
  fi
}

fetch \
  "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx" \
  "$DIR/yunet.onnx" \
  "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4"

fetch \
  "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx" \
  "$DIR/sface.onnx" \
  "0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79"

echo "selesai. model di: $DIR"
