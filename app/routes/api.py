"""JSON API routes."""
from __future__ import annotations

import base64
import binascii
import os
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

from flask import Blueprint, abort, current_app, g, jsonify, request, url_for
from sqlalchemy import func
from werkzeug.utils import secure_filename

from ..extensions import db
from ..models.analysis import Analysis
from ..tasks.analyze import run_analysis

api_bp = Blueprint("api", __name__)


# =========================================================================
#  Helpers
# =========================================================================

def _allowed(filename: str) -> bool:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return ext in current_app.config["ALLOWED_EXTENSIONS"]


def _save_upload(image_bytes: bytes, ext: str) -> str:
    folder = Path(current_app.config["UPLOAD_FOLDER"])
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}.{ext}"
    full = folder / name
    with open(full, "wb") as f:
        f.write(image_bytes)
    return str(full)


def _device_id() -> str | None:
    """Return the current device UUID from g (set by middleware)."""
    return g.get("device_id")


def _local_date_now() -> date:
    """Compute the user-local calendar date from the tz offset cookie."""
    tz_off = g.get("tz_offset", 0)
    # JS getTimezoneOffset() is minutes *west* of UTC, e.g. UTC+3 → -180
    utcnow = datetime.utcnow()
    local = utcnow - timedelta(minutes=tz_off)
    return local.date()


def _image_url(payload: dict) -> dict:
    """Enrich payload with browser-loadable URLs for image paths."""
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    for key in ("image_path", "annotated_path"):
        p = payload.get(key)
        if p and p.startswith(upload_folder):
            rel = os.path.relpath(p, upload_folder).replace("\\", "/")
            payload[key + "_url"] = url_for(
                "static", filename=f"uploads/{rel}", _external=False
            )
    return payload


# =========================================================================
#  POST /api/analyze
# =========================================================================

@api_bp.route("/analyze", methods=["POST"])
def analyze():
    """Accept either multipart 'image' file or JSON {image: <base64 data url>}."""
    image_bytes: bytes | None = None
    ext = "jpg"

    if "image" in request.files:
        f = request.files["image"]
        if not f.filename or not _allowed(f.filename):
            return jsonify({"error": "Unsupported file type"}), 400
        filename = secure_filename(f.filename)
        ext = filename.rsplit(".", 1)[-1].lower()
        image_bytes = f.read()
    else:
        payload = request.get_json(silent=True) or {}
        data_url = payload.get("image")
        if not data_url:
            return jsonify({"error": "No image provided"}), 400
        try:
            header, b64 = data_url.split(",", 1)
            if "image/png" in header:
                ext = "png"
            elif "image/webp" in header:
                ext = "webp"
            else:
                ext = "jpg"
            image_bytes = base64.b64decode(b64)
        except (ValueError, binascii.Error):
            return jsonify({"error": "Invalid base64 image"}), 400

    if not image_bytes:
        return jsonify({"error": "Empty image"}), 400

    image_path = _save_upload(image_bytes, ext)

    # Parse device_id as UUID (set by middleware)
    did_str = _device_id()
    did_uuid = None
    if did_str:
        try:
            did_uuid = uuid.UUID(did_str)
        except ValueError:
            pass

    analysis = Analysis(
        image_path=image_path,
        status="queued",
        device_id=did_uuid,
        local_date=_local_date_now(),
    )
    db.session.add(analysis)
    db.session.commit()

    run_analysis.delay(str(analysis.id))

    return jsonify(
        {
            "id": str(analysis.id),
            "status": analysis.status,
            "result_url": url_for(
                "api.result", analysis_id=str(analysis.id), _external=False
            ),
        }
    ), 202


# =========================================================================
#  GET /api/result/<id>
# =========================================================================

@api_bp.route("/result/<uuid:analysis_id>", methods=["GET"])
def result(analysis_id):
    analysis = db.session.get(Analysis, analysis_id)
    if analysis is None:
        abort(404)

    payload = analysis.to_dict()
    _image_url(payload)
    return jsonify(payload)


# =========================================================================
#  GET /api/history/trend?days=30  (§6.5)
# =========================================================================

@api_bp.route("/history/trend", methods=["GET"])
def history_trend():
    """Return score data points for the current device, windowed by days."""
    did = _device_id()
    if not did:
        return jsonify([])

    try:
        did_uuid = uuid.UUID(did)
    except ValueError:
        return jsonify([])

    days = request.args.get("days", 30, type=int)
    days = min(max(days, 1), 365)
    cutoff = datetime.utcnow() - timedelta(days=days)

    rows = (
        db.session.query(Analysis)
        .filter(
            Analysis.device_id == did_uuid,
            Analysis.status == "done",
            Analysis.created_at >= cutoff,
        )
        .order_by(Analysis.created_at.asc())
        .all()
    )

    data = []
    for a in rows:
        r = a.result or {}
        data.append(
            {
                "id": str(a.id),
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "overall_score": r.get("overall_score"),
                "skin_type": r.get("skin_type"),
            }
        )

    return jsonify(data)


# =========================================================================
#  GET /api/streak  (§6.7)
# =========================================================================

@api_bp.route("/streak", methods=["GET"])
def streak():
    """Compute the current and longest scan streaks for this device."""
    did = _device_id()
    if not did:
        return jsonify({"current": 0, "longest": 0, "last7": []})

    try:
        did_uuid = uuid.UUID(did)
    except ValueError:
        return jsonify({"current": 0, "longest": 0, "last7": []})

    # Get all distinct local_date values for this device, newest first
    rows = (
        db.session.query(func.distinct(Analysis.local_date))
        .filter(
            Analysis.device_id == did_uuid,
            Analysis.local_date.isnot(None),
        )
        .order_by(Analysis.local_date.desc())
        .all()
    )
    scanned_dates = sorted([r[0] for r in rows if r[0]], reverse=True)

    if not scanned_dates:
        return jsonify({"current": 0, "longest": 0, "last7": []})

    today = _local_date_now()
    scanned_set = set(scanned_dates)

    # Current streak: count consecutive days ending today (or yesterday)
    current = 0
    check = today
    # Allow "today not yet scanned" — start from yesterday
    if check not in scanned_set and (check - timedelta(days=1)) in scanned_set:
        check = check - timedelta(days=1)

    while check in scanned_set:
        current += 1
        check -= timedelta(days=1)

    # Longest streak ever
    longest = 0
    run = 0
    for i, d in enumerate(sorted(scanned_dates)):
        if i == 0:
            run = 1
        else:
            prev = sorted(scanned_dates)[i - 1]
            if (d - prev).days == 1:
                run += 1
            else:
                run = 1
        longest = max(longest, run)

    # Last 7 days
    last7 = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        last7.append(d in scanned_set)

    return jsonify({"current": current, "longest": longest, "last7": last7})


# =========================================================================
#  GET /api/compare?a=<id>&b=<id>  (§6.6)
# =========================================================================

@api_bp.route("/compare", methods=["GET"])
def compare_api():
    """Return two readings + per-metric deltas."""
    did = _device_id()
    a_id = request.args.get("a")
    b_id = request.args.get("b")

    # Default: latest two readings of this device
    if not a_id or not b_id:
        if not did:
            return jsonify({"error": "No readings to compare"}), 400
        try:
            did_uuid = uuid.UUID(did)
        except ValueError:
            return jsonify({"error": "Invalid device"}), 400

        latest_two = (
            db.session.query(Analysis)
            .filter(Analysis.device_id == did_uuid, Analysis.status == "done")
            .order_by(Analysis.created_at.desc())
            .limit(2)
            .all()
        )
        if len(latest_two) < 2:
            return jsonify({"error": "Need at least 2 readings to compare"}), 400
        a_id = str(latest_two[0].id)
        b_id = str(latest_two[1].id)

    try:
        a_uuid = uuid.UUID(a_id)
        b_uuid = uuid.UUID(b_id)
    except ValueError:
        return jsonify({"error": "Invalid reading IDs"}), 400

    reading_a = db.session.get(Analysis, a_uuid)
    reading_b = db.session.get(Analysis, b_uuid)

    if not reading_a or not reading_b:
        return jsonify({"error": "Reading not found"}), 404

    ra = reading_a.result or {}
    rb = reading_b.result or {}
    ma = ra.get("metrics", {})
    mb = rb.get("metrics", {})

    # Compute deltas
    all_keys = sorted(set(list(ma.keys()) + list(mb.keys())))
    deltas = {}
    for key in all_keys:
        va = ma.get(key)
        vb = mb.get(key)
        if va is not None and vb is not None:
            diff = va - vb
            pct = round((diff / vb * 100), 1) if vb != 0 else 0
            # For skin metrics: lower is better, so negative diff = improvement
            deltas[key] = {
                "a": va,
                "b": vb,
                "diff": diff,
                "pct": pct,
                "direction": "better" if diff < 0 else ("worse" if diff > 0 else "same"),
                "muted": abs(diff) < 3,
            }
        else:
            deltas[key] = {
                "a": va,
                "b": vb,
                "diff": None,
                "pct": None,
                "direction": "unknown",
                "muted": True,
            }

    payload_a = reading_a.to_dict()
    payload_b = reading_b.to_dict()
    _image_url(payload_a)
    _image_url(payload_b)

    return jsonify(
        {
            "a": payload_a,
            "b": payload_b,
            "deltas": deltas,
            "overall_diff": (ra.get("overall_score", 0) or 0) - (rb.get("overall_score", 0) or 0),
        }
    )


# =========================================================================
#  GET /api/history?limit=50&offset=0  (paginated atlas)
# =========================================================================

@api_bp.route("/history", methods=["GET"])
def history_list():
    """Paginated history for the current device."""
    did = _device_id()
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)
    limit = min(max(limit, 1), 200)

    q = db.session.query(Analysis).order_by(Analysis.created_at.desc())

    if did:
        try:
            did_uuid = uuid.UUID(did)
            q = q.filter(Analysis.device_id == did_uuid)
        except ValueError:
            pass

    items = q.offset(offset).limit(limit).all()
    return jsonify([_image_url(a.to_dict()) for a in items])
