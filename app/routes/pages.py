"""HTML page routes."""
from flask import Blueprint, abort, render_template

from ..extensions import db
from ..models.analysis import Analysis

pages_bp = Blueprint("pages", __name__)


def _sidebar_context() -> dict:
    """Shared sidebar data (latest reading) — passed into every page render."""
    latest = (
        db.session.query(Analysis)
        .order_by(Analysis.created_at.desc())
        .first()
    )
    return {"latest": latest, "latest_id": latest.id if latest else None}


@pages_bp.route("/")
def index():
    return render_template("index.html", active_nav="capture", **_sidebar_context())


@pages_bp.route("/result/<uuid:analysis_id>")
def result(analysis_id):
    analysis = db.session.get(Analysis, analysis_id)
    if analysis is None:
        abort(404)
    return render_template(
        "result.html",
        analysis=analysis,
        active_nav="latest",
        **_sidebar_context(),
    )


@pages_bp.route("/history")
def history():
    items = (
        db.session.query(Analysis)
        .order_by(Analysis.created_at.desc())
        .limit(50)
        .all()
    )
    return render_template(
        "history.html",
        items=items,
        active_nav="atlas",
        **_sidebar_context(),
    )


@pages_bp.route("/compare")
@pages_bp.route("/compare/<uuid:a>/<uuid:b>")
def compare(a=None, b=None):
    return render_template(
        "compare.html",
        active_nav="compare",
        a_id=str(a) if a else None,
        b_id=str(b) if b else None,
        **_sidebar_context(),
    )
