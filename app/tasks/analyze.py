"""Celery task that runs the skin-analysis pipeline.

For Step 1 this is a *stub* that just simulates work and writes mock results
to the DB. In later steps it will call ``app.ml.pipeline.analyze_image`` and
log to MLflow.
"""
from __future__ import annotations

import random
import time
import uuid
from datetime import datetime

from ..extensions import celery, db
from ..models.analysis import Analysis


@celery.task(name="ai_skin.run_analysis", bind=True, max_retries=0)
def run_analysis(self, analysis_id: str) -> dict:
    analysis: Analysis | None = db.session.get(Analysis, uuid.UUID(analysis_id))
    if analysis is None:
        return {"error": f"analysis {analysis_id} not found"}

    analysis.status = "running"
    db.session.commit()

    try:
        # ---- STUB PIPELINE (replaced in Step 4+) ----
        time.sleep(2)
        result = _mock_result()
        # --------------------------------------------

        analysis.result = result
        analysis.annotated_path = analysis.image_path  # placeholder
        analysis.status = "done"
        db.session.commit()
        return {"id": analysis_id, "status": "done"}
    except Exception as exc:  # noqa: BLE001
        analysis.status = "error"
        analysis.error = str(exc)
        db.session.commit()
        raise


def _derive_skin_type(m: dict) -> str:
    """Deterministic rule documented in docs/IMPLEMENTATION.md §6.3.1.

    Shared by the mock and (later) the real ML pipeline, so the UI's
    contract stays stable when real models replace this stub.
    """
    pores = m.get("pores", 0)
    acne = m.get("acne", 0)
    redness = m.get("redness", 0)
    wrinkles = m.get("wrinkles", 0)
    dark_circles = m.get("dark_circles", 0)

    if pores >= 55 and acne >= 25:
        return "oily"
    if redness >= 50 and wrinkles >= 35 and pores < 35:
        return "dry"
    if pores >= 45 and (acne < 20 or dark_circles >= 35):
        return "combination"
    return "normal"


def _mock_result() -> dict:
    """Random but believable-looking skin metrics so the UI is testable."""
    metrics = {
        "redness": random.randint(20, 70),
        "pigmentation": random.randint(15, 65),
        "wrinkles": random.randint(10, 50),
        "pores": random.randint(20, 70),
        "dark_circles": random.randint(15, 60),
        "acne": random.randint(0, 40),
    }
    overall = 100 - int(sum(metrics.values()) / len(metrics))
    return {
        "version": "stub-0.2",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "overall_score": overall,
        "skin_type": _derive_skin_type(metrics),
        "metrics": metrics,
        "recommendations": [
            "Use a broad-spectrum SPF 30+ daily.",
            "Hydrate with a fragrance-free moisturizer.",
            "Consider niacinamide for redness and pores.",
        ],
    }
