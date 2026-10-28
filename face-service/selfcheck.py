"""Self-check against real photos. Needs only OpenCV and numpy.

    FACE_SELFCHECK_GALLERY=/path/to/photos \\
    FACE_SELFCHECK_PROBE=/path/to/live_capture.jpg \\
    python selfcheck.py

Asserts the three things the design depends on:
  1. a live capture of an enrolled person still matches   (no false reject)
  2. no other person is above the threshold                (no false accept)
  3. two accounts of one person resolve into one face_group, using a photo that
     is NOT in the gallery (otherwise the check proves nothing)
"""

import os
import sys

import cv2

import face_engine
import matcher as matcher_module

GALLERY = os.environ.get("FACE_SELFCHECK_GALLERY", "/tmp/opencode/faces/gallery")
PROBE = os.environ.get("FACE_SELFCHECK_PROBE", "/tmp/opencode/faces/me_live.jpg")
PROBE_ID = os.environ.get("FACE_SELFCHECK_PROBE_ID", "90211")
GROUP_PAIR = ("90187", "101240028")  # Robert: two employee accounts, one person
SHARED_GROUP = "robert-hall"

engine = face_engine.FaceEngine(
    os.environ.get("FACE_YUNET_PATH", "/tmp/opencode/models/yunet.onnx"),
    os.environ.get("FACE_SFACE_PATH", "/tmp/opencode/models/sface.onnx"),
)


def read(path):
    image = cv2.imread(path)
    if image is None:
        sys.exit(f"tidak bisa membaca {path}")
    return engine.read_face(image)


def build_gallery(exclude=()):
    templates = []
    for name in sorted(os.listdir(GALLERY)):
        if not name.lower().endswith(".jpg"):
            continue
        employee_id = name[:-4]
        if employee_id in exclude:
            continue
        read_face = read(os.path.join(GALLERY, name))
        if read_face is None:
            continue
        group = SHARED_GROUP if employee_id in GROUP_PAIR else employee_id
        templates.append(matcher_module.Template(employee_id, group, read_face.embedding))
    return templates


def main():
    probe = read(PROBE)
    assert probe is not None, "wajah tidak terdeteksi di foto probe"

    matcher = matcher_module.Matcher()
    matcher.load(build_gallery())
    print(f"galeri: {len(matcher)} template")

    outcome = matcher.identify(probe.embedding)
    print(f"1. genuine   -> {outcome.result} score={outcome.score:.4f} group={outcome.face_group}")
    assert outcome.result == "match", "wajah sendiri tidak dikenali"
    assert outcome.face_group == PROBE_ID, f"match ke group yang salah: {outcome.face_group}"
    assert outcome.score >= 0.6, f"skor terlalu rendah: {outcome.score:.4f}"

    top = matcher.top_scores(probe.embedding, limit=3)
    print("2. teratas    -> " + ", ".join(f"{i}={s:.4f}" for i, s in top))
    for employee_id, score in matcher.top_scores(probe.embedding, limit=len(matcher)):
        if employee_id == PROBE_ID:
            continue
        assert score < 0.6, f"{employee_id} (orang lain) lolos ambang: {score:.4f}"

    # 3. cross-photo: probe with the account that is deliberately excluded.
    held_out, kept = GROUP_PAIR
    held_out_read = read(os.path.join(GALLERY, f"{held_out}.jpg"))
    matcher.load(build_gallery(exclude={held_out}))
    outcome = matcher.identify(held_out_read.embedding)
    print(f"3. group     -> {outcome.result} score={outcome.score:.4f} group={outcome.face_group}")
    assert outcome.result == "match", "akun kedua orang yang sama gagal cocok"
    assert outcome.face_group == SHARED_GROUP, "face_group tidak tergabung"
    assert outcome.candidates and outcome.candidates[0][0] == kept, \
        "yang cocok bukan akun pasangannya"

    print("SEMUA CEK LULUS")


if __name__ == "__main__":
    main()
