"""Face detection and embedding for kiosk face-unlock.

Uses the OpenCV Zoo models:
  YuNet  (MIT)          face detection + 5 landmarks
  SFace  (Apache-2.0)   face recognition embedding

The engine only turns one image into one normalised embedding. Matching lives in
matcher.py so it can be tested without OpenCV models.
"""

import cv2
import numpy as np

MODEL_VERSION = "sface-2021dec"
DETECT_INPUT_SIZE = (320, 320)


class FaceEngine:
    def __init__(self, yunet_path, sface_path, detect_threshold=0.6):
        self._detector = cv2.FaceDetectorYN.create(
            yunet_path, "", DETECT_INPUT_SIZE, detect_threshold, 0.3, 5000
        )
        self._recogniser = cv2.FaceRecognizerSF.create(sface_path, "")

    def read_face(self, image):
        """Return the most prominent face in the image, or None.

        The result carries the embedding plus the signals the caller needs to
        judge frame quality: detection confidence and head yaw. A frame with a
        large yaw is a bad match candidate even if a face was found.
        """
        height, width = image.shape[:2]
        self._detector.setInputSize((width, height))
        detected = self._detector.detect(image)[1]
        if detected is None or len(detected) == 0:
            return None

        face = max(detected, key=lambda box: (box[2] - box[0]) * (box[3] - box[1]))
        aligned = self._recogniser.alignCrop(image, face)
        embedding = self._recogniser.feature(aligned).ravel()
        embedding = embedding / np.linalg.norm(embedding)

        return FaceRead(
            embedding=embedding.astype(np.float32),
            detection_score=float(face[-1]),
            yaw=_yaw_from_landmarks(face),
        )

    def compare(self, first, second):
        """Cosine similarity between two embeddings."""
        return float(np.dot(first, second))


class FaceRead:
    __slots__ = ("embedding", "detection_score", "yaw")

    def __init__(self, embedding, detection_score, yaw):
        self.embedding = embedding
        self.detection_score = detection_score
        self.yaw = yaw


def _yaw_from_landmarks(face):
    """Head turn estimate: how far the nose sits from the midpoint of the eyes.

    Normalised by eye distance so it is independent of face size. 0 is frontal;
    anything above roughly 0.5 is a noticeably turned head.
    """
    left_eye, right_eye, nose = face[4:6], face[6:8], face[8:10]
    eye_distance = abs(float(right_eye[0]) - float(left_eye[0]))
    if eye_distance < 1e-3:
        return 1.0
    eye_midpoint = (float(left_eye[0]) + float(right_eye[0])) / 2.0
    return abs(float(nose[0]) - eye_midpoint) / eye_distance


def pick_best_frame(reads):
    """Choose the frame most likely to match: frontal and confidently detected."""
    if not reads:
        return None
    return max(reads, key=lambda read: read.detection_score - 0.5 * read.yaw)
