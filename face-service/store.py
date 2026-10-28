"""Persistence for face templates and verification attempts.

Embeddings are biometric data, so they are stored encrypted with AES-GCM and
the key lives only in the face service environment. Nothing here stores the
original photo: enrollment reads a photo, computes an embedding, and discards
the photo.
"""

import base64
import os

import numpy as np
import psycopg
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from matcher import Template

NONCE_BYTES = 12


def load_key_from_env(variable="FACE_EMBEDDING_KEY"):
    """Read a base64 encoded 32-byte key from the environment."""
    raw = os.environ.get(variable)
    if not raw:
        raise RuntimeError(f"{variable} is not set")
    key = base64.b64decode(raw)
    if len(key) != 32:
        raise RuntimeError(f"{variable} must decode to 32 bytes, got {len(key)}")
    return key


class PostgresStore:
    def __init__(self, dsn, key):
        self._dsn = dsn
        self._cipher = AESGCM(key)

    def _connect(self):
        return psycopg.connect(self._dsn)

    def fetch_templates(self, model_version):
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT employee_id, face_group, embedding, quality
                FROM tbl_face_templates
                WHERE model_version = %s
                """,
                (model_version,),
            ).fetchall()
        return [
            Template(
                employee_id=row[0],
                face_group=row[1],
                embedding=self._decrypt(row[2]),
                quality=row[3],
            )
            for row in rows
        ]

    def upsert_template(self, employee_id, face_group, embedding, model_version, quality=None):
        payload = self._encrypt(embedding)
        with self._connect() as conn:
            result = conn.execute(
                """
                INSERT INTO tbl_face_templates
                    (user_id, employee_id, face_group, embedding, model_version, quality)
                SELECT _id, %s, %s, %s, %s, %s
                FROM tbl_users
                WHERE employee_id = %s
                ON CONFLICT (employee_id, model_version)
                DO UPDATE SET embedding = EXCLUDED.embedding,
                              face_group = EXCLUDED.face_group,
                              quality = EXCLUDED.quality
                RETURNING _id
                """,
                (employee_id, face_group, payload, model_version, quality, employee_id),
            ).fetchone()
        return result is not None

    def log_verify(self, device_id, result, score, margin, liveness, frame_count,
                   employee_id=None, face_group=None):
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO tbl_face_verify_log
                    (device_id, employee_id, face_group, result, score, margin, liveness, frame_count)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (device_id, employee_id, face_group, result, score, margin, liveness, frame_count),
            )

    def _encrypt(self, embedding):
        nonce = os.urandom(NONCE_BYTES)
        plaintext = np.asarray(embedding, dtype=np.float32).tobytes()
        return nonce + self._cipher.encrypt(nonce, plaintext, None)

    def _decrypt(self, payload):
        nonce, ciphertext = bytes(payload[:NONCE_BYTES]), bytes(payload[NONCE_BYTES:])
        plaintext = self._cipher.decrypt(nonce, ciphertext, None)
        return np.frombuffer(plaintext, dtype=np.float32).copy()
