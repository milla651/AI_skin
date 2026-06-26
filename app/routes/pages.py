"""HTML page routes."""
from flask import Blueprint, abort, render_template

from ..extensions import db
from ..models.analysis import Analysis

pages_bp = Blueprint("pages", __name__)


@pages_bp.route("/")
def index():
    return render_template("index.html")


@pages_bp.route("/result/<uuid:analysis_id>")
def result(analysis_id):
    analysis = db.session.get(Analysis, analysis_id)
    if analysis is None:
        abort(404)
    return render_template("result.html", analysis=analysis)


@pages_bp.route("/history")
def history():
    items = (
        db.session.query(Analysis)
        .order_by(Analysis.created_at.desc())
        .limit(50)
        .all()
    )
    return render_template("history.html", items=items)
