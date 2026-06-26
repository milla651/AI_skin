"""Shared Flask extensions."""
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from celery import Celery

db = SQLAlchemy()
migrate = Migrate()

# Celery is instantiated here without config; configured later via app factory.
celery = Celery(__name__)
