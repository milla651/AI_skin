"""JSON API routes."""
from __future__ import annotations

import base64
import binascii
import os
import uuid
from pathlib import Path

from flask import Blueprint, abort, current_app, jsonify, request, url_for
from werkzeug.utils import secure_filename

from ..extensions import db
from ..models.analysis import Analysis
from ..tasks.analyze import run_analysis

api_bp = Blueprint("api", __name__)


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
        # Expect data URL: "data:image/png;base64,...."
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

    analysis = Analysis(image_path=image_path, status="queued")
    db.session.add(analysis)
    db.session.commit()

    # Kick off the background job.
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


@api_bp.route("/result/<uuid:analysis_id>", methods=["GET"])
def result(analysis_id):
    analysis = db.session.get(Analysis, analysis_id)
    if analysis is None:
        abort(404)

    payload = analysis.to_dict()

    # Convert absolute image paths to URLs the browser can load.
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    for key in ("image_path", "annotated_path"):
        p = payload.get(key)
        if p and p.startswith(upload_folder):
            rel = os.path.relpath(p, upload_folder).replace("\\", "/")
            payload[key + "_url"] = url_for(
                "static", filename=f"uploads/{rel}", _external=False
            )

    return jsonify(payload)
