"""
Automated unit and integration test suite for the Aegis backend.
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import pytest
from fastapi.testclient import TestClient
from backend.app import app

client = TestClient(app)

def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "HEALTHY"
    assert data["catalog_objects_count"] > 0
    assert data["orbital_engine"] is not None

def test_catalog_endpoints():
    # Full catalog
    res = client.get("/api/catalog")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 10
    
    # Filter by type
    res_debris = client.get("/api/catalog?type=DEBRIS")
    assert res_debris.status_code == 200
    assert all(obj["type"] == "DEBRIS" for obj in res_debris.json())
    
    # Search query
    res_iss = client.get("/api/catalog?query=ISS")
    assert res_iss.status_code == 200
    assert len(res_iss.json()) > 0
    assert "ISS" in res_iss.json()[0]["name"]

def test_object_detail_and_ephemeris():
    res = client.get("/api/objects/25544")
    assert res.status_code == 200
    data = res.json()
    assert data["norad_id"] == 25544
    assert "live_state" in data
    assert data["live_state"]["altitude_km"] > 300
    
    # Ephemeris
    res_eph = client.get("/api/objects/25544/ephemeris?hours=1&step_seconds=300")
    assert res_eph.status_code == 200
    eph_data = res_eph.json()
    assert eph_data["points_count"] > 5
    assert len(eph_data["ephemeris"]) > 0

def test_conjunctions_and_maneuvers():
    # List conjunctions
    res = client.get("/api/conjunctions")
    assert res.status_code == 200
    conjs = res.json()
    assert len(conjs) > 0
    
    # Pick a conjunction involving a maneuverable spacecraft
    conj = next((c for c in conjs if c.get("primary_object", {}).get("is_maneuverable")), conjs[0])
    conj_id = conj["id"]
    
    # Detail
    res_detail = client.get(f"/api/conjunctions/{conj_id}")
    assert res_detail.status_code == 200
    
    # Maneuvers
    res_mnvs = client.get(f"/api/conjunctions/{conj_id}/maneuvers")
    assert res_mnvs.status_code == 200
    mnv_data = res_mnvs.json()
    assert len(mnv_data["maneuvers"]) > 0
    
    # Accept Maneuver
    selected_mnv_id = mnv_data["maneuvers"][0]["id"]
    res_accept = client.post(
        f"/api/conjunctions/{conj_id}/maneuvers/accept",
        json={"maneuver_id": selected_mnv_id, "operator_notes": "Automated verification test"}
    )
    assert res_accept.status_code == 200
    assert res_accept.json()["status"] == "SUCCESS"
    assert "authorization_hash" in res_accept.json()["execution_record"]

def test_calculator_endpoint():
    # Foster 1992
    payload_foster = {
        "miss_distance_km": 0.450,
        "combined_radius_m": 12.0,
        "method": "FOSTER_1992"
    }
    res_f = client.post("/api/calculator/probability", json=payload_foster)
    assert res_f.status_code == 200
    assert res_f.json()["probability_of_collision"] > 0
    
    # Monte Carlo
    payload_mc = {
        "miss_distance_km": 0.300,
        "combined_radius_m": 15.0,
        "method": "MONTE_CARLO",
        "monte_carlo_samples": 5000
    }
    res_mc = client.post("/api/calculator/probability", json=payload_mc)
    assert res_mc.status_code == 200
    assert "distance_histogram" in res_mc.json()["details"]

def test_predictive_and_anomalies():
    res_hm = client.get("/api/predictive/heatmap")
    assert res_hm.status_code == 200
    assert len(res_hm.json()["grid"]) > 0
    
    res_anom = client.get("/api/predictive/anomalies")
    assert res_anom.status_code == 200
    assert len(res_anom.json()) > 0

def test_alerts_and_audit_and_reports():
    # Add genuine test alert
    from backend.data.database import db
    db.add_alert(severity="HIGH", title="Test Alert", message="Orbital test message")
    
    # Alerts
    res_al = client.get("/api/alerts")
    assert res_al.status_code == 200
    alerts = res_al.json()
    assert len(alerts) > 0
    
    # Ack
    res_ack = client.post(f"/api/alerts/{alerts[0]['id']}/ack")
    assert res_ack.status_code == 200
    
    # Audit
    res_aud = client.get("/api/audit")
    assert res_aud.status_code == 200
    assert len(res_aud.json()) > 0
    
    # Reports Export JSON
    res_rep_json = client.post("/api/reports/export", json={"format": "json"})
    assert res_rep_json.status_code == 200
    assert "digital_signature_sha256" in res_rep_json.json()["data"]
    
def test_spaceweather_endpoint():
    res = client.get("/api/spaceweather/flux")
    assert res.status_code == 200
    data = res.json()
    assert "current" in data
    assert data["current"]["flux_sfu"] > 0
    assert "thermospheric_drag_multiplier" in data["current"]
    assert "history_30day" in data
    assert len(data["history_30day"]) > 0

def test_catalog_sync_endpoint():
    res = client.post("/api/catalog/sync?group=stations")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ["SUCCESS", "FALLBACK_SYNC"]
    assert data["synced_records"] > 0

if __name__ == "__main__":
    pytest.main(["-v", __file__])
