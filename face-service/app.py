"""HTTP surface for kiosk face-unlock.

The service answers two questions and nothing else:

    identify  who is this?           (1:N, used when the kiosk shows no card)
    verify    is this <employee>?    (1:1, used after a card tap)

Booking rules (does this person have a room booked right now?) stay in
app_booking; this service never reads the events tables.

Liveness is NOT implemented yet. Every response says so explicitly through
`liveness: null` so no caller can mistake an unchecked frame for a live one.
"""

import base64
import os
from contextlib import asynccontextmanager

import cv2
import numpy as np
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

import face_engine
import matcher as matcher_module
import store as store_module

MODEL_VERSION = face_engine.MODEL_VERSION
THRESHOLD = float(os.environ.get("FACE_MATCH_THRESHOLD", matcher_module.DEFAULT_THRESHOLD))
MARGIN = float(os.environ.get("FACE_MATCH_MARGIN", matcher_module.DEFAULT_MARGIN))

# Enrollment quality gates. A template is only as good as the photo behind it,
# and re-enrolling from a bad frame quietly lowers everyone's accuracy later.
ENROLL_MIN_DETECTION = 0.6
ENROLL_MAX_YAW = 0.35
ENROLL_MIN_AGREEMENT = 0.5

engine = None
matcher = None
template_store = None


@asynccontextmanager
async def lifespan(_app):
    global engine, matcher, template_store
    engine = face_engine.FaceEngine(
        os.environ.get("FACE_YUNET_PATH", "models/yunet.onnx"),
        os.environ.get("FACE_SFACE_PATH", "models/sface.onnx"),
    )
    template_store = store_module.PostgresStore(
        os.environ["FACE_DB_DSN"], store_module.load_key_from_env()
    )
    matcher = matcher_module.Matcher(threshold=THRESHOLD, margin=MARGIN)
    _reload_templates()
    yield


app = FastAPI(title="360booking face service", version="0.1.0", lifespan=lifespan)


class IdentifyRequest(BaseModel):
    frames: list[str] = Field(min_length=1)
    device_id: str | None = None


class VerifyRequest(BaseModel):
    employee_id: str
    frames: list[str] = Field(min_length=1)
    device_id: str | None = None


class EnrollRequest(BaseModel):
    employee_id: str
    frames: list[str] = Field(min_length=2)
    device_id: str | None = None


@app.get("/health")
def health():
    return {
        "ok": True,
        "model_version": MODEL_VERSION,
        "templates": len(matcher) if matcher else 0,
        "threshold": THRESHOLD,
        "margin": MARGIN,
        "liveness_required": False,
    }


@app.post("/reload")
def reload_templates():
    count = _reload_templates()
    return {"ok": True, "templates": count}


@app.post("/identify")
def identify(request: IdentifyRequest):
    reads = _read_frames(request.frames)
    if not reads:
        _log(request.device_id, "no_face", None, None, None, len(request.frames))
        return {"result": "no_face", "score": None, "margin": None,
                "face_group": None, "candidates": [], "liveness": None}

    best = face_engine.pick_best_frame(reads)
    outcome = matcher.identify(best.embedding)
    payload = outcome.as_dict()
    payload["liveness"] = None
    payload["frame_quality"] = {
        "detection_score": round(best.detection_score, 3),
        "yaw": round(best.yaw, 3),
        "frames_with_face": len(reads),
    }
    _log(request.device_id, outcome.result, outcome.score, outcome.margin, None,
         len(request.frames), _leading_employee(outcome), outcome.face_group)
    return payload


@app.post("/enroll")
def enroll(request: EnrollRequest, x_face_token: str | None = Header(default=None)):
    """Daftarkan wajah untuk satu employee_id.

    Hanya dipanggil oleh app_booking setelah identitas pemilik akun terbukti
    (admin CMS, atau tap kartu di kiosk). Service ini tidak tahu siapa yang
    berhak, jadi jangan pernah mengekspos endpoint ini ke kiosk langsung.
    """
    _check_internal_token(x_face_token)

    reads = _read_frames(request.frames)
    if len(reads) < 2:
        raise HTTPException(status_code=422, detail="butuh minimal 2 frame berisi wajah")

    best = face_engine.pick_best_frame(reads)
    if best.detection_score < ENROLL_MIN_DETECTION:
        raise HTTPException(status_code=422, detail=f"deteksi lemah ({best.detection_score:.2f})")
    if best.yaw > ENROLL_MAX_YAW:
        raise HTTPException(status_code=422, detail=f"kepala menoleh (yaw {best.yaw:.2f})")

    # Semua frame harus orang yang sama: mencegah frame ditukar di tengah burst.
    agreement = min(
        float(np.dot(best.embedding, read.embedding)) for read in reads
    )
    if agreement < ENROLL_MIN_AGREEMENT:
        raise HTTPException(status_code=422, detail=f"frame tidak konsisten ({agreement:.2f})")

    written = template_store.upsert_template(
        employee_id=request.employee_id,
        face_group=request.employee_id,
        embedding=best.embedding,
        model_version=MODEL_VERSION,
        quality=best.detection_score,
    )
    if not written:
        raise HTTPException(status_code=404, detail="employee_id tidak ada di tbl_users")

    _reload_templates()
    return {
        "ok": True,
        "employee_id": request.employee_id,
        "quality": round(best.detection_score, 3),
        "yaw": round(best.yaw, 3),
        "agreement": round(agreement, 3),
        "frames": len(reads),
        "templates": len(matcher),
    }


@app.post("/verify")
def verify(request: VerifyRequest):
    reads = _read_frames(request.frames)
    if not reads:
        _log(request.device_id, "no_face", None, None, None, len(request.frames),
             request.employee_id)
        return {"result": "no_face", "score": None, "liveness": None}

    best = face_engine.pick_best_frame(reads)
    score = matcher.verify(best.embedding, request.employee_id)
    if score is None:
        raise HTTPException(status_code=404, detail="no template for employee_id")

    result = "match" if score >= THRESHOLD else "no_match"
    _log(request.device_id, result, score, None, None, len(request.frames), request.employee_id)
    return {"result": result, "score": round(score, 4), "liveness": None}


def _reload_templates():
    templates = template_store.fetch_templates(MODEL_VERSION)
    matcher.load(templates)
    return len(templates)


def _check_internal_token(received):
    """Shared secret between app_booking and this service.

    Enrollment changes who can log in as whom, so it must not be reachable just
    because someone found the port. Unset variable = no check (dev only).
    """
    expected = os.environ.get("FACE_INTERNAL_TOKEN")
    if expected and received != expected:
        raise HTTPException(status_code=401, detail="invalid internal token")


def _read_frames(frames):
    reads = []
    for encoded in frames:
        image = _decode(encoded)
        if image is None:
            continue
        read = engine.read_face(image)
        if read is not None:
            reads.append(read)
    return reads


def _decode(encoded):
    if "," in encoded[:64] and encoded.lstrip().startswith("data:"):
        encoded = encoded.split(",", 1)[1]
    try:
        raw = base64.b64decode(encoded)
    except Exception:
        return None
    return cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)


def _leading_employee(outcome):
    if not outcome.candidates:
        return None
    return outcome.candidates[0][0]


def _log(device_id, result, score, margin, liveness, frame_count,
         employee_id=None, face_group=None):
    try:
        template_store.log_verify(device_id, result, score, margin, liveness,
                                  frame_count, employee_id, face_group)
    except Exception:
        # Logging must never break a verification attempt.
        pass
