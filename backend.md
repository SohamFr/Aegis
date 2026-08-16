## Aegis Backend Roadmap

This roadmap outlines the implementation plan for all backend functionalities of the **Aegis** space-debris collision avoidance system. It assumes a modular, scalable architecture built around a core orbital engine and an API gateway serving the frontend.

---

## 1. Architecture Overview

**Recommended Pattern:** Modular monolith first, then extract microservices as needed.

```
+----------------+     +----------------+     +----------------+
|   Frontend     | <-> |  API Gateway   | <-> |  Core Services |
|  (React/3D)    |     |  (REST/WS)     |     |  (Python)      |
+----------------+     +----------------+     +----------------+
                                                |  - Catalog     |
                                                |  - Conjunction |
                                                |  - Maneuver    |
                                                |  - Calculator  |
                                                |  - Alerts      |
                                                +----------------+
                                                       |
                                          +------------+------------+
                                          |                         |
                                    +-----------+          +-----------+
                                    | Database  |          | Job Queue |
                                    | (Postgres)|          | (Celery)  |
                                    +-----------+          +-----------+
                                          |
                                    +-----------+
                                    |   Cache   |
                                    |  (Redis)  |
                                    +-----------+
```

**Tech Stack (Core):**
- **Language:** Python 3.11+ (scientific computing, orbital mechanics libraries)
- **API Framework:** FastAPI (async, typed)
- **Database:** PostgreSQL + TimescaleDB (time-series orbital states) + PostGIS (if needed)
- **Cache:** Redis (real-time object positions, session)
- **Queue:** Celery + RabbitMQ / Redis (background propagation, large computations)
- **Object Storage:** AWS S3 or MinIO (reports, TLE archives)
- **Containerization:** Docker, Kubernetes

---

## 2. Phase 0: Foundation & Data Ingestion

**Goal:** Establish the backend skeleton and connect to public orbital data sources.

### Key Deliverables
- Project scaffolding (FastAPI, Docker, CI/CD)
- Data models (TLE, satellite, debris, orbit state)
- NORAD / Space-Track API client (CelesTrak as fallback)
- TLE parser (Python `sgp4` or `skyfield`)
- Scheduled ingestion jobs (Celery beat)
- Initial database schema and migrations

### Tasks
1. Set up PostgreSQL with TimescaleDB extension.
2. Implement TLE fetch from Space-Track / CelesTrak (e.g., `python-sgp4` for parsing).
3. Store TLEs with timestamps; keep history for trend analysis.
4. Create `catalog` table with metadata (NORAD ID, name, type, RCS, size).
5. Build a Celery worker to refresh TLEs every 6–12 hours.
6. Expose basic `/health`, `/catalog` endpoints.

**Milestone:** Backend can fetch, store, and serve a catalog of objects with their latest TLEs.

---

## 3. Phase 1: Orbital Propagation Engine

**Goal:** Compute accurate positions/velocities of all tracked objects over time.

### Key Deliverables
- SGP4/SDP4 propagation module (using `sgp4` library)
- Cartesian state vector generation (position, velocity)
- Batch propagation service for all objects
- REST endpoint `/objects/{id}/ephemeris`
- WebSocket stream for live object positions

### Tasks
1. Implement a `Propagator` class that takes TLE and time → ECI/ECEF state.
2. Pre-compute ephemeris for the next 7 days for all objects (cached in Redis).
3. Create a background job that updates ephemeris every hour.
4. Expose endpoint: `GET /objects/{id}/ephemeris?start=&end=&step=` returns state vectors.
5. Set up WebSocket channel `/ws/live` broadcasting object positions at 10 Hz for selected objects.
6. Handle coordinate transformations (TEME → ECI → ECEF) for visualization.

**Milestone:** Frontend 3D view can display moving satellites/debris based on backend-provided positions.

---

## 4. Phase 2: Collision Prediction & Risk Engine

**Goal:** Identify close approaches and compute collision probability (Pc).

### Key Deliverables
- Conjunction screening algorithm (spatial grid or all-pairs distance filter)
- Close-approach event detection (Time of Closest Approach, miss distance)
- Collision probability calculator (Foster-1992, Chan, Alfano, Monte Carlo)
- Risk classification and ranking
- REST endpoints: `/conjunctions`, `/conjunctions/{id}`
- WebSocket alerts for new high-risk events

### Tasks
1. Implement a spatial hash grid (or use `scipy.spatial.cKDTree`) to find pairs below a threshold (e.g., 100 km).
2. For each pair, run a coarse sweep over next 7 days to find TCA and minimum distance.
3. Filter events with miss distance < 5 km (configurable).
4. Implement covariance propagation (use state transition matrix or simplified covariance).
5. Implement at least two probability methods (e.g., Foster-1992 and Monte Carlo).
6. Store conjunction events in `conjunctions` table with risk level.
7. Expose `/conjunctions?from=&to=&risk_threshold=`.
8. Emit WebSocket event when a new high-risk conjunction is detected.

**Milestone:** Backend can list and detail conjunction events with Pc and miss distance.

---

## 5. Phase 3: Maneuver Recommendation Engine

**Goal:** Generate fuel-efficient evasive maneuvers for high-risk conjunctions.

### Key Deliverables
- Maneuver optimizer (delta-v minimization)
- Fuel consumption calculator
- Post-maneuver conjunction re-evaluation
- REST endpoint: `/conjunctions/{id}/maneuvers`
- Endpoint to accept/schedule a maneuver

### Tasks
1. Build a maneuver model: given object mass, current orbit, and desired post-maneuver orbit, compute delta-v.
2. Define search space: maneuver type (radial, along-track, cross-track, combined), magnitude, and execution time.
3. Use an optimizer (e.g., `scipy.optimize.differential_evolution` or genetic algorithm) to find candidate maneuvers that:
   - Increase miss distance to safe threshold (e.g., > 10 km)
   - Minimize total delta-v / fuel
   - Respect constraints (available fuel, maneuver lead time)
4. For each candidate, re-run conjunction prediction to get post-maneuver Pc and miss distance.
5. Return ranked list with delta-v, fuel mass, execution time, and new Pc.
6. Add endpoint `POST /conjunctions/{id}/maneuvers/accept` to store selected maneuver.
7. Optionally integrate with an external mission planning system (if available).

**Milestone:** Backend can recommend 3–5 maneuvers with fuel and safety metrics.

---

## 6. Phase 4: Collision Probability Calculator (Standalone)

**Goal:** Expose ad-hoc probability calculation as an API for the frontend calculator page.

### Key Deliverables
- Endpoint: `POST /calculator/probability`
- Support for manual TLE input or object IDs
- Multiple calculation methods selectable
- Return Pc, miss distance, relative velocity, covariance ellipsoid data

### Tasks
1. Design request schema: `{object1, object2, method, time_window, confidence_level}`.
2. Reuse propagation and probability modules from Phase 2.
3. Add Monte Carlo simulation with configurable number of samples (e.g., 10k, 100k).
4. Return detailed results: Pc histogram, closest approach geometry, covariance matrices.
5. Enable synchronous calculation for small requests; async job for heavy Monte Carlo.

**Milestone:** Frontend calculator can get probability results via API.

---

## 7. Phase 5: AI/ML Predictive Shield (Optional but Recommended)

**Goal:** Provide the flagship landing page feature — predictive risk heatmap and anomaly detection.

### Key Deliverables
- ML model for future conjunction risk (e.g., time-series forecasting)
- Anomaly detection service for unusual orbital behavior
- API endpoints: `/predictive/heatmap`, `/predictive/anomalies`
- Real-time streaming of predictions

### Tasks
1. Collect historical data: past conjunctions, solar activity, object density, maneuver history.
2. Train a gradient boosting model (XGBoost/LightGBM) or LSTM to predict high-risk zones for next 7 days.
3. Implement unsupervised anomaly detection (e.g., Isolation Forest) on orbital element changes.
4. Expose `/predictive/heatmap?start=&end=` returning 3D grid values for frontend overlay.
5. Run inference on a schedule (e.g., every 6 hours) and cache results.
6. Add confidence scores and explainability (SHAP values) for the UI.

**Milestone:** Landing page can show an AI risk heatmap and anomaly feed.

---

## 8. Phase 6: Alerts, Reports, and Audit Logs

**Goal:** Enable user notifications, exportable reports, and compliance.

### Key Deliverables
- Alert service (email, webhook, in-app)
- Report generation (PDF/CSV/JSON)
- Audit logging for all user actions
- REST endpoints: `/alerts`, `/reports`, `/audit`

### Tasks
1. Implement an alert system using Redis Pub/Sub + email/webhook connectors.
2. Create alert rules: new high-risk conjunction, threshold crossed, maneuver executed.
3. Build a report generator using `weasyprint` or `reportlab` for PDF.
4. Provide endpoints to export conjunction reports, maneuver plans, and fuel logs.
5. Log user actions (acknowledge, accept maneuver, export) in `audit_logs` table.
6. Create an admin dashboard for viewing audit trails.

**Milestone:** Users can configure alerts and export reports.

---

## 9. Phase 7: Production Hardening & Scaling

**Goal:** Ensure the system can handle thousands of objects and concurrent users.

### Key Deliverables
- Load testing and performance tuning
- Caching strategy refinement
- Kubernetes deployment with auto-scaling
- Monitoring and observability (Prometheus, Grafana)
- Security hardening (OAuth2, rate limiting)

### Tasks
1. Implement request caching for `/catalog` and `/conjunctions` (Redis, short TTL).
2. Use WebSocket connection pooling and Redis pub/sub for broadcasting.
3. Optimize database queries with indexes on time and object IDs.
4. Containerize and deploy to Kubernetes with horizontal pod autoscaling.
5. Set up Prometheus metrics and Grafana dashboards for API latency, job queue depth.
6. Implement OAuth2/JWT for authentication and role-based access.
7. Add rate limiting and API key management.

**Milestone:** Production-ready, scalable backend.

---

## 10. High-Level Timeline (Relative)

| Phase | Description | Effort |
|-------|-------------|--------|
| 0 | Foundation & data ingestion | 1–2 weeks |
| 1 | Orbital propagation engine | 2–3 weeks |
| 2 | Collision prediction & risk engine | 3–4 weeks |
| 3 | Maneuver recommendation engine | 2–3 weeks |
| 4 | Standalone calculator | 1–2 weeks |
| 5 | AI/ML predictive shield | 3–4 weeks |
| 6 | Alerts, reports, audit | 2 weeks |
| 7 | Production hardening | 2 weeks |

**Total estimated:** 16–24 weeks for a full MVP (without AI) and ~20–28 weeks including AI.

---

## 11. Key Backend Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Service health |
| `/api/catalog` | GET | Filterable object catalog |
| `/api/objects/{id}` | GET | Object detail + latest TLE |
| `/api/objects/{id}/ephemeris` | GET | Ephemeris data |
| `/api/conjunctions` | GET | List of conjunction events |
| `/api/conjunctions/{id}` | GET | Event detail |
| `/api/conjunctions/{id}/maneuvers` | GET | Maneuver recommendations |
| `/api/conjunctions/{id}/maneuvers/accept` | POST | Accept a maneuver |
| `/api/calculator/probability` | POST | Ad-hoc probability calculation |
| `/api/predictive/heatmap` | GET | AI risk heatmap |
| `/api/predictive/anomalies` | GET | Anomaly feed |
| `/api/alerts` | GET | Alert inbox |
| `/api/reports/export` | POST | Generate report |
| `/ws/live` | WebSocket | Real-time object positions |
| `/ws/alerts` | WebSocket | Real-time alert push |

---

This roadmap gives a complete, executable plan from data ingestion to production, covering all features described in the frontend design. Adjust priorities based on your MVP requirements and available resources.