"""Enrollment CLI: photo files -> encrypted templates in Postgres.

Input is a CSV with a header row:

    employee_id,photo,face_group
    90211,/path/90211.jpg,
    90187,/path/90187.jpg,robert-hall
    101240028,/path/101240028.jpg,robert-hall

face_group may be empty, in which case it defaults to employee_id. Only put two
accounts in the same group when they are the same physical person; grouping by
name alone is wrong (different people can share a name).

The photo itself is never stored. Run:

    python enroll.py --csv mapping.csv --dsn "$FACE_DB_DSN"
"""

import argparse
import csv
import os
import sys

import cv2
import numpy as np

import face_engine
import store as store_module

MIN_DETECTION_SCORE = 0.6
MAX_YAW = 0.35
ZK_PHOTO_PREFIX = b"eav101$"


def load_zk_photo(path, key):
    """Decrypt a ZKBioTime biophoto in memory, never on disk.

    Format: b"eav101$" + AES-CBC ciphertext, IV taken from key[8:24], PKCS7
    padding. The vendor ships this key as a default in site_settings.py, so the
    source is not confidential - but our copies still should not be plain files.
    """
    from cryptography.hazmat.primitives import padding
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

    with open(path, "rb") as handle:
        blob = handle.read()
    if not blob.startswith(ZK_PHOTO_PREFIX):
        return None

    password = key.encode("utf-8")
    decryptor = Cipher(algorithms.AES(password), modes.CBC(password[8:24])).decryptor()
    padded = decryptor.update(blob[len(ZK_PHOTO_PREFIX):]) + decryptor.finalize()
    unpadder = padding.PKCS7(128).unpadder()
    plain = unpadder.update(padded) + unpadder.finalize()
    return cv2.imdecode(np.frombuffer(plain, dtype=np.uint8), cv2.IMREAD_COLOR)


def main():
    parser = argparse.ArgumentParser(description="Enroll face templates from photos")
    parser.add_argument("--csv", required=True, help="employee_id,photo[,face_group]")
    parser.add_argument("--dsn", default=os.environ.get("FACE_DB_DSN"))
    parser.add_argument("--zk-source", help="folder foto BioTime terenkripsi (<employee_id>.jpg)")
    parser.add_argument("--zk-key", help="IMAGE_AES_PASSWORD untuk --zk-source")
    parser.add_argument("--dry-run", action="store_true", help="compute but do not write")
    args = parser.parse_args()

    if not args.dsn:
        sys.exit("FACE_DB_DSN is not set and --dsn was not given")
    if args.zk_source and not args.zk_key:
        sys.exit("--zk-source membutuhkan --zk-key")

    engine = face_engine.FaceEngine(
        os.environ.get("FACE_YUNET_PATH", "models/yunet.onnx"),
        os.environ.get("FACE_SFACE_PATH", "models/sface.onnx"),
    )
    template_store = None
    if not args.dry_run:
        template_store = store_module.PostgresStore(args.dsn, store_module.load_key_from_env())

    enrolled, skipped = [], []
    with open(args.csv, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            employee_id = (row.get("employee_id") or "").strip()
            photo = (row.get("photo") or "").strip()
            face_group = (row.get("face_group") or "").strip() or employee_id
            if not employee_id:
                continue

            image = None
            if args.zk_source:
                encrypted_path = os.path.join(args.zk_source, f"{employee_id}.jpg")
                if os.path.exists(encrypted_path):
                    image = load_zk_photo(encrypted_path, args.zk_key)
                if image is None:
                    skipped.append((employee_id, encrypted_path, "foto ZK tidak terbaca/didekripsi"))
                    continue
                photo = encrypted_path
            elif photo:
                image = cv2.imread(photo)
            if image is None:
                skipped.append((employee_id, photo, "file tidak terbaca"))
                continue

            read = engine.read_face(image)
            if read is None:
                skipped.append((employee_id, photo, "wajah tidak terdeteksi"))
                continue
            if read.detection_score < MIN_DETECTION_SCORE:
                skipped.append((employee_id, photo, f"deteksi lemah {read.detection_score:.2f}"))
                continue
            if read.yaw > MAX_YAW:
                skipped.append((employee_id, photo, f"kepala menoleh (yaw {read.yaw:.2f})"))
                continue

            if template_store is not None:
                written = template_store.upsert_template(
                    employee_id=employee_id,
                    face_group=face_group,
                    embedding=read.embedding,
                    model_version=face_engine.MODEL_VERSION,
                    quality=read.detection_score,
                )
                if not written:
                    skipped.append((employee_id, photo, "employee_id tidak ada di tbl_users"))
                    continue

            enrolled.append((employee_id, face_group, read.detection_score))

    print(f"terdaftar: {len(enrolled)} | dilewati: {len(skipped)}")
    for employee_id, face_group, score in enrolled[:5]:
        print(f"  ok  {employee_id} group={face_group} det={score:.2f}")
    if len(enrolled) > 5:
        print(f"  ... {len(enrolled) - 5} lagi")
    for employee_id, photo, reason in skipped:
        print(f"  skip {employee_id}: {reason}")


if __name__ == "__main__":
    main()
