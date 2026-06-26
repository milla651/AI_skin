# Lumen · Skin Atlas

A local AI skin-analysis POC.  
Flask + Celery + Redis + PostgreSQL + MLflow + open-source vision models.

> **Step 1 status:** project skeleton + editorial UI + Celery+Redis-backed
> stub analysis pipeline. Future steps (4–10) plug in the real ML.

---

## 1 · What's in the box

```
AI_skin/
├── app/
│   ├── __init__.py            # Flask app factory + Celery wiring + schema bootstrap
│   ├── config.py              # Loads .env (DB, Redis, MLflow, uploads)
│   ├── extensions.py          # db, migrate, celery singletons
│   ├── routes/
│   │   ├── pages.py           # /, /result/<id>, /history
│   │   └── api.py             # POST /api/analyze, GET /api/result/<id>
│   ├── models/analysis.py     # Analysis table (schema: ai_skin)
│   ├── tasks/analyze.py       # Celery task (stub pipeline for now)
│   ├── templates/             # base / index / result / history
│   └── static/
│       ├── css/styles.css     # editorial design system
│       ├── js/capture.js      # upload + webcam capture
│       ├── js/result.js       # polls /api/result/<id>
│       └── uploads/           # saved input images
├── run.py                     # Flask dev entrypoint
├── celery_worker.py           # Celery worker entrypoint
├── requirements.txt
├── .env                       # local config (gitignored)
└── .env.example
```

---

## 2 · Prereqs

- Python 3.11+
- PostgreSQL running on `localhost:5432` (DB `postgres`)
- Redis running on `localhost:6379`
- MLflow server (used from Step 9 onward)

The Flask app will automatically create a dedicated schema `ai_skin` inside
the `postgres` database — it will not pollute `public`.

---

## 3 · One-time setup

```powershell
# from c:\Users\User\Desktop\masterclass_poc\AI_skin

python -m venv .venv
.venv\Scripts\activate

pip install -r requirements.txt

# create the migrations folder + first revision
flask db init
flask db migrate -m "initial analyses table"
flask db upgrade
```

> If `flask db init` complains, make sure `FLASK_APP=run.py` is set
> (it is, via `.env` — `python-dotenv` is auto-loaded by Flask 3.x).

---

## 4 · Run it 

### Terminal A — Flask
```powershell
.venv\Scripts\activate
python run.py
# → http://localhost:8000
```

### Terminal B — Celery worker
```powershell
.venv\Scripts\activate
celery -A celery_worker.celery worker --loglevel=info --pool=solo
```
> On Windows always use `--pool=solo` (or `eventlet`) because the default
> `prefork` pool doesn't work on Windows.

### Optional — MLflow server (used from Step 9)
```powershell
mlflow server --host 127.0.0.1 --port 5000
```

---

## 5 · Try it

1. Open <http://localhost:8000>.
2. Drop a selfie (or hit *Webcam → Open camera → Capture*).
3. Click **Read my skin**.
4. You'll be redirected to `/result/<id>` which polls the API and renders
   the metrics once the Celery worker finishes.
5. The atlas at <http://localhost:8000/history> shows your last 50 readings.

For Step 1 the metrics are **mocked** by the worker (random but realistic),
so you can verify the whole upload → queue → DB → poll → render loop is
working before we plug in the real ML.

---

## 6 · Roadmap

- [x] **1** Project skeleton (Flask + Postgres + Celery + editorial UI)
- [x] **2** Upload + webcam capture UI
- [x] **3** Celery + Redis background task + frontend polling
- [ ] **4** Face detection (MediaPipe) + face parsing (BiSeNet) → skin mask
- [ ] **5** Classical CV metrics (redness / pigmentation / wrinkles / pores / dark circles)
- [ ] **6** HuggingFace classifiers (skin type, acne / skin condition)
- [ ] **7** Scoring aggregator + recommendations + annotated overlay
- [ ] **8** Alembic migration polish + history filters
- [ ] **9** MLflow tracking of every run (params, metrics, artifacts)
- [ ] **10** UI polish (Chart.js trends, README screenshots)
