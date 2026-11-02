"""1:N matching with a group rule.

Thresholds come from measurements on the real gallery (269 BioTime photos,
255 distinct people after merging duplicate accounts):

    threshold 0.363 (SFace default) -> 81.6% of people had a lookalike above it
    threshold 0.55                  ->  3.1%
    threshold 0.60                  ->  1.6%
    threshold 0.65                  ->  0.0%

0.60 is the default because it leaves room for real-world variation (glasses,
ageing photos) while keeping the lookalike rate near 1.6%. The margin rule
exists because a single threshold cannot separate two similar faces; the best
match must also be clearly ahead of the runner-up.

Accounts that share a face (one person, two employee records) are placed in the
same face_group and are NOT treated as rivals of each other.
"""

import numpy as np

DEFAULT_THRESHOLD = 0.60
DEFAULT_MARGIN = 0.05


class Template:
    __slots__ = ("employee_id", "face_group", "embedding", "quality")

    def __init__(self, employee_id, face_group, embedding, quality=None):
        self.employee_id = employee_id
        self.face_group = face_group
        self.embedding = embedding
        self.quality = quality


class MatchResult:
    __slots__ = ("result", "score", "margin", "face_group", "candidates")

    def __init__(self, result, score, margin, face_group, candidates):
        self.result = result
        self.score = score
        self.margin = margin
        self.face_group = face_group
        self.candidates = candidates

    def as_dict(self):
        return {
            "result": self.result,
            "score": None if self.score is None else round(self.score, 4),
            "margin": None if self.margin is None else round(self.margin, 4),
            "face_group": self.face_group,
            "candidates": [
                {"employee_id": employee_id, "score": round(score, 4)}
                for employee_id, score in self.candidates
            ],
        }


class Matcher:
    def __init__(self, threshold=DEFAULT_THRESHOLD, margin=DEFAULT_MARGIN):
        self.threshold = threshold
        self.margin = margin
        self._templates = []
        self._matrix = None

    def load(self, templates):
        self._templates = list(templates)
        if self._templates:
            self._matrix = np.vstack([t.embedding for t in self._templates])
        else:
            self._matrix = None

    def __len__(self):
        return len(self._templates)

    def identify(self, embedding):
        if not self._templates:
            return MatchResult("no_match", None, None, None, [])

        scores = self._matrix @ embedding
        best_index = int(np.argmax(scores))
        best = self._templates[best_index]
        best_score = float(scores[best_index])

        runner_up = self._runner_up_score(scores, best.face_group)
        margin = best_score - runner_up

        same_group = [
            (template.employee_id, float(scores[index]))
            for index, template in enumerate(self._templates)
            if template.face_group == best.face_group
        ]
        same_group.sort(key=lambda pair: pair[1], reverse=True)

        if best_score < self.threshold:
            return MatchResult("no_match", best_score, margin, None, same_group[:3])
        if margin < self.margin:
            # Too close to call: another person scores nearly the same.
            return MatchResult("ambiguous", best_score, margin, None, same_group[:3])

        return MatchResult("match", best_score, margin, best.face_group, same_group[:3])

    def top_scores(self, embedding, limit=5):
        """Highest scoring templates overall, for diagnostics and tests."""
        if not self._templates:
            return []
        scores = self._matrix @ embedding
        order = np.argsort(scores)[::-1][:limit]
        return [
            (self._templates[int(index)].employee_id, float(scores[index]))
            for index in order
        ]

    def verify(self, embedding, employee_id):
        """1:1 check used when the account is already known (card tap)."""
        indices = [
            index
            for index, template in enumerate(self._templates)
            if template.employee_id == employee_id
        ]
        if not indices:
            return None
        scores = self._matrix[indices] @ embedding
        return float(np.max(scores))

    def _runner_up_score(self, scores, winning_group):
        """Best score from a different face_group."""
        best = -1.0
        for index, score in enumerate(scores):
            if self._templates[index].face_group == winning_group:
                continue
            if score > best:
                best = float(score)
        return best
