"""Guards around the HTTP surface: frame bounds and the internal token.

Run inside the face-service image (needs fastapi + opencv):

    python -m unittest test_guards -v
"""

import os
import unittest

from pydantic import ValidationError

import app


class FrameBoundsTest(unittest.TestCase):
    def test_identify_rejects_more_than_the_cap(self):
        app.IdentifyRequest(frames=["a", "b", "c"])
        with self.assertRaises(ValidationError):
            app.IdentifyRequest(frames=["a", "b", "c", "d"])

    def test_enroll_needs_two_frames(self):
        with self.assertRaises(ValidationError):
            app.EnrollRequest(employee_id="x", frames=["a"])

    def test_oversized_base64_is_dropped_before_decode(self):
        oversized = "A" * (app.MAX_FRAME_BASE64_CHARS + 1)
        self.assertIsNone(app._decode(oversized))


class InternalTokenTest(unittest.TestCase):
    def setUp(self):
        self.saved = os.environ.get("FACE_INTERNAL_TOKEN")

    def tearDown(self):
        os.environ.pop("FACE_INTERNAL_TOKEN", None)
        if self.saved is not None:
            os.environ["FACE_INTERNAL_TOKEN"] = self.saved

    def test_missing_configuration_fails_closed(self):
        os.environ.pop("FACE_INTERNAL_TOKEN", None)
        with self.assertRaises(app.HTTPException) as caught:
            app._check_internal_token("anything")
        self.assertEqual(caught.exception.status_code, 503)

    def test_wrong_and_missing_token_are_rejected(self):
        os.environ["FACE_INTERNAL_TOKEN"] = "secret"
        for received in (None, "wrong"):
            with self.assertRaises(app.HTTPException) as caught:
                app._check_internal_token(received)
            self.assertEqual(caught.exception.status_code, 401)

    def test_matching_token_is_allowed(self):
        os.environ["FACE_INTERNAL_TOKEN"] = "secret"
        app._check_internal_token("secret")


if __name__ == "__main__":
    unittest.main()
