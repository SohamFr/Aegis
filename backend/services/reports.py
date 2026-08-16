"""
Compliance, Conjunction Risk, and Maneuver Execution Report Generator.
"""

from datetime import datetime, timezone
from typing import Dict, Any, List
import hashlib
import json
import io
import csv

from backend.data.database import db

class ReportGenerator:
    """
    Generates downloadable reports and mission audit records.
    """
    
    @classmethod
    def generate_conjunction_report(cls, format_type: str = "json") -> Dict[str, Any]:
        """Generates comprehensive conjunction risk and maneuver report."""
        now = datetime.now(timezone.utc)
        conjunctions = db.get_conjunctions()
        accepted_mnvs = db.accepted_maneuvers
        audit_trail = db.get_audit_logs()
        
        report_data = {
            "report_id": f"REP-AEGIS-{now.strftime('%Y%m%d-%H%M%S')}",
            "title": "Aegis Orbital Conjunction & Collision Avoidance Summary Report",
            "classification": "CONFIDENTIAL // FLIGHT OPERATIONS ONLY",
            "generated_at": now.isoformat(),
            "operator_system": "Aegis Autonomous Space Defense Engine v2.4.0",
            "summary_metrics": {
                "active_catalog_objects": len(db.catalog),
                "total_conjunctions_detected": len(conjunctions),
                "critical_risk_conjunctions": len([c for c in conjunctions if c["risk_level"] == "CRITICAL"]),
                "high_risk_conjunctions": len([c for c in conjunctions if c["risk_level"] == "HIGH"]),
                "scheduled_maneuvers_count": len(accepted_mnvs),
            },
            "conjunction_events": conjunctions,
            "authorized_maneuvers": accepted_mnvs,
            "recent_audit_trail": audit_trail[:10],
        }
        
        raw_json = json.dumps(report_data, sort_keys=True)
        sha256_hash = hashlib.sha256(raw_json.encode()).hexdigest()
        report_data["digital_signature_sha256"] = sha256_hash
        
        if format_type.lower() == "csv":
            csv_output = io.StringIO()
            writer = csv.writer(csv_output)
            writer.writerow(["Event ID", "Primary Object", "Secondary Object", "TCA (UTC)", "Miss Distance (km)", "Relative Speed (km/s)", "Collision Prob (Pc)", "Risk Level", "Status"])
            for c in conjunctions:
                writer.writerow([
                    c["id"],
                    c["primary_object"]["name"],
                    c["secondary_object"]["name"],
                    c["tca"],
                    c["miss_distance_km"],
                    c["relative_velocity_km_s"],
                    f"{c['probability_of_collision']:.2e}",
                    c["risk_level"],
                    c["status"]
                ])
            return {
                "report_id": report_data["report_id"],
                "format": "csv",
                "content_type": "text/csv",
                "filename": f"{report_data['report_id']}.csv",
                "data": csv_output.getvalue(),
                "sha256": sha256_hash
            }
            
        return {
            "report_id": report_data["report_id"],
            "format": "json",
            "content_type": "application/json",
            "filename": f"{report_data['report_id']}.json",
            "data": report_data,
            "sha256": sha256_hash
        }
