"""Flask application factory."""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path

from flask import Flask, g, request
from sqlalchemy import text

from .config import Config
from .extensions import celery, db, migrate


def create_app(config_class: type[Config] = Config) -> Flask:
    app = Flask(__name__, instance_relative_config=False)
    app.config.from_object(config_class)

    # Ensure upload folder exists
    Path(app.config["UPLOAD_FOLDER"]).mkdir(parents=True, exist_ok=True)

    # Init extensions
    db.init_app(app)
    migrate.init_app(app, db)
    _configure_celery(app)

    # Ensure the dedicated schema exists before models/migrations touch it
    with app.app_context():
        _ensure_schema(app.config["DB_SCHEMA"])

    # ------------------------------------------------------------------
    # Device-ID middleware (§8.4 of IMPLEMENTATION.md)
    # ------------------------------------------------------------------
    @app.before_request
    def _ensure_device_id():
        did = request.cookies.get("skinna.did")
        if not did:
            did = str(uuid.uuid4())
        g.device_id = did
        # tz offset sent by lib/device.js; default 0 (UTC)
        try:
            g.tz_offset = int(request.cookies.get("skinna.tzoff", "0"))
        except (ValueError, TypeError):
            g.tz_offset = 0

    @app.after_request
    def _set_device_cookie(resp):
        did = g.get("device_id")
        if did and request.cookies.get("skinna.did") != did:
            resp.set_cookie(
                "skinna.did",
                did,
                max_age=60 * 60 * 24 * 365,
                httponly=True,
                samesite="Lax",
            )
        return resp

    # Register blueprints
    from .routes.pages import pages_bp
    from .routes.api import api_bp

    app.register_blueprint(pages_bp)
    app.register_blueprint(api_bp, url_prefix="/api")

    # Import models so Flask-Migrate sees them
    from .models import analysis  # noqa: F401

    return app


def _configure_celery(app: Flask) -> None:
    celery.conf.update(
        broker_url=app.config["CELERY_BROKER_URL"],
        result_backend=app.config["CELERY_RESULT_BACKEND"],
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        enable_utc=True,
    )

    class FlaskTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = FlaskTask
    app.extensions["celery"] = celery


def _ensure_schema(schema: str) -> None:
    """Create the dedicated Postgres schema if it doesn't exist yet."""
    try:
        with db.engine.connect() as conn:
            conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
            conn.commit()
    except Exception as exc:  # pragma: no cover - first-run helper
        # Don't kill the app if DB isn't reachable yet; surface in logs.
        print(f"[ai_skin] WARN: could not ensure schema '{schema}': {exc}")
