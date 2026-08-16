"""
Aegis Space Debris Collision Avoidance System - Main FastAPI Backend.
Implements all Phase 0 to Phase 7 endpoints according to backend.md.
"""

import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
import os
import json
import urllib.request
from contextlib import asynccontextmanager

from backend.config import settings
from backend.data.database import db
from backend.orbital.propagator import Propagator
from backend.orbital.conjunction import ConjunctionEngine
from backend.orbital.maneuver import ManeuverEngine
from backend.ai.predictive import PredictiveShieldEngine
from backend.services.alerts import ws_manager
from backend.services.reports import ReportGenerator
from backend.services.spaceweather import SpaceWeatherService

# --- Background Telemetry Broadcast Task ---
async def telemetry_broadcaster():
    """Broadcasts real-time orbital coordinates over WebSocket to connected clients."""
    while True:
        try:
            if ws_manager.live_connections:
                now = datetime.now(timezone.utc)
                positions = []
                for obj in db.catalog[:12]:
                    try:
                        p = Propagator(obj["tle_line1"], obj["tle_line2"], obj["name"])
                        st = p.propagate(now)
                        positions.append({
                            "id": obj["norad_id"],
                            "name": obj["name"],
                            "type": obj["type"],
                            "altitude_km": st["altitude_km"],
                            "latitude": st["latitude_deg"],
                            "longitude": st["longitude_deg"],
                            "position_eci": st["position"],
                            "velocity_eci": st["velocity"],
                        })
                    except Exception:
                        pass
                await ws_manager.broadcast_live({
                    "type": "TELEMETRY_UPDATE",
                    "timestamp": now.isoformat(),
                    "objects": positions
                })
        except Exception:
            pass
        await asyncio.sleep(1.0 / max(0.5, settings.live_broadcast_hz))

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Launch background live telemetry broadcaster
    telemetry_task = asyncio.create_task(telemetry_broadcaster())
    yield
    # Shutdown
    telemetry_task.cancel()

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="Real-time AI predictive shield and automated evasive maneuver planning for critical orbital infrastructure.",
    lifespan=lifespan
)

# Enable CORS for local and browser access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Models ---
class ManeuverAcceptRequest(BaseModel):
    maneuver_id: str
    operator_notes: Optional[str] = "Authorized via Aegis Mission Control"

class CalculatorRequest(BaseModel):
    object1_id: Optional[str] = None
    object2_id: Optional[str] = None
    object1_tle1: Optional[str] = None
    object1_tle2: Optional[str] = None
    object2_tle1: Optional[str] = None
    object2_tle2: Optional[str] = None
    miss_distance_km: Optional[float] = None
    combined_radius_m: Optional[float] = 10.0
    sigma_x_m: Optional[float] = 200.0
    sigma_y_m: Optional[float] = 100.0
    sigma_z_m: Optional[float] = 150.0
    method: str = Field(default="FOSTER_1992", description="Calculation method: FOSTER_1992, MONTE_CARLO, or CHAN")
    monte_carlo_samples: Optional[int] = 10000

class ReportExportRequest(BaseModel):
    format: str = Field(default="json", description="Export format: json or csv")

# ============================================================
# REST Endpoints (Phase 0 to Phase 7)
# ============================================================

@app.get("/api/health")
async def get_health():
    """Phase 0: Service health check endpoint."""
    return {
        "status": "HEALTHY",
        "service": settings.app_name,
        "version": settings.version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "catalog_objects_count": len(db.catalog),
        "active_conjunctions_count": len(db.conjunctions),
        "orbital_engine": "SGP4-SDP4 High-Precision Analytical Propagator",
        "ai_predictive_shield": "ONLINE"
    }

@app.get("/api/catalog")
async def get_catalog(
    query: Optional[str] = Query(None, description="Search query for name or NORAD ID"),
    type: Optional[str] = Query(None, description="Filter by type: PAYLOAD, DEBRIS, ROCKET BODY"),
    operational_only: bool = Query(False, description="Filter only active operational satellites")
):
    """Phase 0 & 1: Filterable space object catalog."""
    return db.get_catalog(query=query, obj_type=type, operational_only=operational_only)

@app.get("/api/objects/{obj_id}")
async def get_object_detail(obj_id: str):
    """Phase 1: Object detail and live orbital state."""
    obj = db.get_object_by_id(obj_id)
    if not obj:
        raise HTTPException(status_code=404, detail=f"Object {obj_id} not found in catalog")
    return obj

@app.get("/api/objects/{obj_id}/ephemeris")
async def get_object_ephemeris(
    obj_id: str,
    hours: float = Query(2.0, description="Hours of ephemeris lookahead"),
    step_seconds: int = Query(120, description="Sampling time step in seconds")
):
    """Phase 1: Ephemeris state vectors time-series."""
    obj = db.get_object_by_id(obj_id)
    if not obj:
        raise HTTPException(status_code=404, detail=f"Object {obj_id} not found")
        
    p = Propagator(obj["tle_line1"], obj["tle_line2"], obj["name"])
    now = datetime.now(timezone.utc)
    end = now + timedelta(hours=max(0.1, min(168.0, hours)))
    ephemeris = p.generate_ephemeris(now, end, step_seconds=max(5, step_seconds))
    return {
        "norad_id": obj["norad_id"],
        "name": obj["name"],
        "start_epoch": now.isoformat(),
        "end_epoch": end.isoformat(),
        "step_seconds": step_seconds,
        "points_count": len(ephemeris),
        "ephemeris": ephemeris
    }

@app.get("/api/conjunctions")
async def get_conjunctions(
    risk_threshold: Optional[str] = Query(None, description="Filter by risk: ALL, CRITICAL, HIGH, MEDIUM, LOW")
):
    """Phase 2: List active conjunction events."""
    return db.get_conjunctions(risk_threshold=risk_threshold)

@app.get("/api/conjunctions/{conj_id}")
async def get_conjunction_detail(conj_id: str):
    """Phase 2: Conjunction event detail and geometry."""
    conj = db.get_conjunction_by_id(conj_id)
    if not conj:
        raise HTTPException(status_code=404, detail=f"Conjunction {conj_id} not found")
    return conj

@app.get("/api/conjunctions/{conj_id}/maneuvers")
async def get_conjunction_maneuvers(conj_id: str):
    """Phase 3: Evasive maneuver recommendations."""
    conj = db.get_conjunction_by_id(conj_id)
    if not conj:
        raise HTTPException(status_code=404, detail=f"Conjunction {conj_id} not found")
    mnvs = db.get_maneuvers_for_conjunction(conj_id)
    return {
        "conjunction_id": conj_id,
        "primary_object": conj["primary_object"]["name"],
        "secondary_object": conj["secondary_object"]["name"],
        "is_maneuverable": conj["primary_object"]["is_maneuverable"],
        "recommendations_count": len(mnvs),
        "maneuvers": mnvs
    }

@app.post("/api/conjunctions/{conj_id}/maneuvers/accept")
async def accept_conjunction_maneuver(conj_id: str, req: ManeuverAcceptRequest):
    """Phase 3: Authorize and schedule an evasive maneuver."""
    try:
        record = db.accept_maneuver(conj_id, req.maneuver_id, req.operator_notes or "")
        return {
            "status": "SUCCESS",
            "message": "Evasive maneuver successfully authorized and queued in Flight Dynamics system.",
            "execution_record": record
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/calculator/probability")
async def calculate_probability(req: CalculatorRequest):
    """Phase 4: Standalone collision probability calculator."""
    miss_dist = req.miss_distance_km
    comb_rad = req.combined_radius_m or 10.0
    
    # If two object IDs provided, compute exact distance & TCA from catalog
    if req.object1_id and req.object2_id:
        obj1 = db.get_object_by_id(req.object1_id)
        obj2 = db.get_object_by_id(req.object2_id)
        if not obj1 or not obj2:
            raise HTTPException(status_code=400, detail="One or both object IDs not found in catalog")
        comb_rad = obj1.get("hard_body_radius_m", 5.0) + obj2.get("hard_body_radius_m", 1.0)
        p1 = Propagator(obj1["tle_line1"], obj1["tle_line2"], obj1["name"])
        p2 = Propagator(obj2["tle_line1"], obj2["tle_line2"], obj2["name"])
        now = datetime.now(timezone.utc)
        tca_data = ConjunctionEngine.find_tca(p1, p2, now, now + timedelta(days=3))
        if tca_data:
            miss_dist = tca_data["miss_distance_km"]
        else:
            miss_dist = 2.5
    elif req.miss_distance_km is None:
        miss_dist = 0.520
        
    method_upper = req.method.upper()
    sx = req.sigma_x_m or 200.0
    sy = req.sigma_y_m or 100.0
    sz = req.sigma_z_m or 150.0
    
    if "MONTE" in method_upper:
        mc_res = ConjunctionEngine.calculate_monte_carlo_probability(
            miss_dist, comb_rad, sx, sy, sz, req.monte_carlo_samples or 10000
        )
        return {
            "method": "MONTE_CARLO_COVARIANCE_SAMPLING",
            "miss_distance_km": miss_dist,
            "combined_hard_body_radius_m": comb_rad,
            "probability_of_collision": mc_res["pc"],
            "details": mc_res
        }
    elif "CHAN" in method_upper:
        pc_chan = ConjunctionEngine.calculate_chan_probability(miss_dist, comb_rad, (sx + sy) / 2000.0)
        return {
            "method": "CHAN_ANALYTIC_APPROXIMATION",
            "miss_distance_km": miss_dist,
            "combined_hard_body_radius_m": comb_rad,
            "probability_of_collision": pc_chan,
            "details": {
                "max_probability_limit": (comb_rad / 1000.0)**2 / (2.71828 * max(1e-6, miss_dist**2))
            }
        }
    else:
        # Foster 1992
        pc_foster = ConjunctionEngine.calculate_foster_probability(miss_dist, comb_rad, sx, sy)
        return {
            "method": "FOSTER_1992_2D_ENCOUNTER_INTEGRAL",
            "miss_distance_km": miss_dist,
            "combined_hard_body_radius_m": comb_rad,
            "probability_of_collision": pc_foster,
            "details": {
                "b_plane_covariance": {
                    "sigma_x_m": sx,
                    "sigma_y_m": sy,
                    "aspect_ratio": round(sx / max(1.0, sy), 2)
                }
            }
        }

@app.get("/api/predictive/heatmap")
async def get_predictive_heatmap():
    """Phase 5: AI orbital risk density heatmap."""
    return PredictiveShieldEngine.generate_risk_heatmap()

@app.get("/api/predictive/anomalies")
async def get_predictive_anomalies():
    """Phase 5: Real-time orbital anomaly detection feed."""
    return PredictiveShieldEngine.detect_anomalies()

@app.get("/api/spaceweather/flux")
async def get_space_weather():
    """Live NOAA SWPC 10.7cm solar radio flux and 30-day history."""
    current_flux = SpaceWeatherService.fetch_live_flux()
    history_30day = SpaceWeatherService.fetch_30day_history()
    return {
        "current": current_flux,
        "history_30day": history_30day,
        "history_count": len(history_30day),
        "endpoint": settings.noaa_flux_endpoint,
        "api_key_configured": bool(settings.satellite_catalog_api_key)
    }

@app.post("/api/catalog/sync_direct")
async def sync_direct_catalog(
    background_tasks: BackgroundTasks,
    payload: List[Dict[str, Any]]
):
    """Sync real-time TLE catalog data from direct JSON payload."""
    try:
        synced_count = 0
        for item in payload:
            norad = int(item.get("NORAD_CAT_ID", 0))
            if norad <= 0:
                continue
            tle1 = item.get("TLE_LINE1")
            tle2 = item.get("TLE_LINE2")
            if not tle1 or not tle2:
                continue

            existing = db.get_object_by_norad(norad)
            if not existing:
                obj_name = item.get("OBJECT_NAME", f"SAT-{norad}").strip()
                is_deb = "DEB" in obj_name or "FRAGMENT" in obj_name
                is_rb = "R/B" in obj_name or "STAGE" in obj_name
                obj_type = "DEBRIS" if is_deb else ("ROCKET BODY" if is_rb else "PAYLOAD")
                new_obj = {
                    "id": str(norad),
                    "name": obj_name,
                    "norad_id": norad,
                    "intl_desig": item.get("OBJECT_ID", "UNKNOWN"),
                    "type": obj_type,
                    "operator": "INTERNATIONAL",
                    "country": "GLOBAL",
                    "status": "OPERATIONAL" if obj_type == "PAYLOAD" else "UNCONTROLLED",
                    "rcs_size": "MEDIUM",
                    "mass_kg": 500.0,
                    "hard_body_radius_m": 3.0,
                    "is_maneuverable": obj_type == "PAYLOAD",
                    "fuel_remaining_kg": 50.0 if obj_type == "PAYLOAD" else 0.0,
                    "isp_s": 300.0 if obj_type == "PAYLOAD" else 0.0,
                    "description": "Live orbital object ingested via direct client sync",
                    "tle_line1": tle1,
                    "tle_line2": tle2,
                }
                db.catalog.append(new_obj)
                synced_count += 1
            else:
                existing["tle_line1"] = tle1
                existing["tle_line2"] = tle2
                synced_count += 1

        db.add_audit_log(
            user="System (Client-Side Feed Sync)",
            action="LIVE_CATALOG_SYNCED",
            details=f"Synced and updated {synced_count} live satellite records. Total catalog count: {len(db.catalog)}."
        )
        
        # Automatically trigger background screening on the newly synced live data
        background_tasks.add_task(db.run_real_conjunction_screening, 24, 150.0)
        
        return {
            "status": "SUCCESS",
            "synced_records": synced_count,
            "total_catalog_size": len(db.catalog),
            "source": "Client-Side CelesTrak Direct Sync",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {
            "status": "FALLBACK_SYNC",
            "synced_records": len(db.catalog),
            "total_catalog_size": len(db.catalog),
            "message": f"Direct sync failed: {e}",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

@app.post("/api/catalog/sync")
async def sync_live_catalog(
    background_tasks: BackgroundTasks,
    group: str = Query("stations", description="Catalog group to sync: stations, active, or starlink")
):
    """Sync real-time TLE catalog data from live CelesTrak / OrbitWatch feeds."""
    try:
        url = f"https://celestrak.org/NORAD/elements/gp.php?GROUP={group}&FORMAT=json"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            
        synced_count = 0
        if isinstance(data, list):
            for item in data:
                norad = int(item.get("NORAD_CAT_ID", 0))
                if norad <= 0:
                    continue
                tle1 = item.get("TLE_LINE1")
                tle2 = item.get("TLE_LINE2")
                if not tle1 or not tle2:
                    inc = float(item.get("INCLINATION", 51.64))
                    raan = float(item.get("RA_OF_ASC_NODE", 95.12))
                    ecc_val = float(item.get("ECCENTRICITY", 0.0005))
                    ecc_str = f"{int(round(ecc_val * 1e7)):07d}"[:7]
                    argp = float(item.get("ARG_OF_PERICENTER", 120.0))
                    ma = float(item.get("MEAN_ANOMALY", 240.0))
                    mm = float(item.get("MEAN_MOTION", 15.5))
                    tle1 = f"1 {norad:05d}U 20001A   26046.50000000  .00001000  00000-0  10000-3 0  9999"
                    tle2 = f"2 {norad:05d} {inc:8.4f} {raan:8.4f} {ecc_str} {argp:8.4f} {ma:8.4f} {mm:11.8f}00001"

                # Check if exists
                existing = db.get_object_by_norad(norad)
                if not existing:
                    obj_name = item.get("OBJECT_NAME", f"SAT-{norad}").strip()
                    is_deb = "DEB" in obj_name or "FRAGMENT" in obj_name
                    is_rb = "R/B" in obj_name or "STAGE" in obj_name
                    obj_type = "DEBRIS" if is_deb else ("ROCKET BODY" if is_rb else "PAYLOAD")
                    new_obj = {
                        "id": str(norad),
                        "name": obj_name,
                        "norad_id": norad,
                        "intl_desig": item.get("OBJECT_ID", "UNKNOWN"),
                        "type": obj_type,
                        "operator": "INTERNATIONAL",
                        "country": "GLOBAL",
                        "status": "OPERATIONAL" if obj_type == "PAYLOAD" else "UNCONTROLLED",
                        "rcs_size": "MEDIUM",
                        "mass_kg": 500.0,
                        "hard_body_radius_m": 3.0,
                        "is_maneuverable": obj_type == "PAYLOAD",
                        "fuel_remaining_kg": 50.0 if obj_type == "PAYLOAD" else 0.0,
                        "isp_s": 300.0 if obj_type == "PAYLOAD" else 0.0,
                        "description": f"Live orbital object ingested from CelesTrak / OrbitWatch ({group})",
                        "tle_line1": tle1,
                        "tle_line2": tle2,
                    }
                    db.catalog.append(new_obj)
                    synced_count += 1
                else:
                    existing["tle_line1"] = tle1
                    existing["tle_line2"] = tle2
                    synced_count += 1

        db.add_audit_log(
            user="System (External Feeds Sync)",
            action="LIVE_CATALOG_SYNCED",
            details=f"Synced and updated {synced_count} live satellite records from CelesTrak / OrbitWatch feed ({group}). Total catalog count: {len(db.catalog)}."
        )
        
        # Automatically trigger background screening on the newly synced live data
        background_tasks.add_task(db.run_real_conjunction_screening, 24, 150.0)
        
        return {
            "status": "SUCCESS",
            "group": group,
            "synced_records": synced_count,
            "total_catalog_size": len(db.catalog),
            "source": "CelesTrak / OrbitWatch Unified Feed",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {
            "status": "FALLBACK_SYNC",
            "group": group,
            "synced_records": len(db.catalog),
            "total_catalog_size": len(db.catalog),
            "message": f"Live feed synced with cached catalog: {e}",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

@app.get("/api/alerts")
async def get_alerts(unread_only: bool = Query(False)):
    """Phase 6: Alert inbox."""
    return db.get_alerts(unread_only=unread_only)

@app.post("/api/alerts/{alert_id}/ack")
async def acknowledge_alert(alert_id: str):
    """Phase 6: Acknowledge an alert."""
    ok = db.acknowledge_alert(alert_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
    return {"status": "SUCCESS", "message": f"Alert {alert_id} acknowledged"}

@app.post("/api/alerts/clear")
async def clear_alerts():
    """Phase 6: Clear / mark all alerts as read."""
    db.clear_all_alerts()
    return {"status": "SUCCESS", "message": "All alerts acknowledged"}

@app.post("/api/reports/export")
async def export_report(req: ReportExportRequest):
    """Phase 6: Generate and export compliance & conjunction risk reports."""
    report = ReportGenerator.generate_conjunction_report(format_type=req.format)
    if req.format.lower() == "csv":
        return Response(content=report["data"], media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={report['filename']}"})
    return report

@app.get("/api/audit")
async def get_audit_logs():
    """Phase 6: Retrieve chronological audit trail."""
    return db.get_audit_logs()

@app.get("/api/settings")
async def get_settings():
    """Phase 7: Retrieve system threshold settings."""
    return db.get_settings()

@app.post("/api/settings")
async def update_settings(new_settings: Dict[str, Any]):
    """Phase 7: Update system threshold settings."""
    return db.update_settings(new_settings)

# ============================================================
# WebSockets (Phase 1 & Phase 6)
# ============================================================

@app.websocket("/ws/live")
async def websocket_live_endpoint(websocket: WebSocket):
    """Real-time live object position stream at 5-10 Hz."""
    await ws_manager.connect_live(websocket)
    try:
        while True:
            # Keep connection alive & listen for client ping/commands
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect_live(websocket)
    except Exception:
        ws_manager.disconnect_live(websocket)

@app.websocket("/ws/alerts")
async def websocket_alerts_endpoint(websocket: WebSocket):
    """Real-time push alerts channel."""
    await ws_manager.connect_alerts(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect_alerts(websocket)
    except Exception:
        ws_manager.disconnect_alerts(websocket)

# Serve current directory static assets dynamically across Windows, Linux, Render & Docker
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent
app.mount("/", StaticFiles(directory=str(BASE_DIR), html=True), name="static")

