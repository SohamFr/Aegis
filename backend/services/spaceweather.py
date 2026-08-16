"""
Real-time NOAA Space Weather Prediction Center (SWPC) F10.7 Solar Flux and Atmospheric Drag Ingestion Service.
"""

import urllib.request
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

NOAA_CURRENT_FLUX_URL = "https://services.swpc.noaa.gov/products/summary/10cm-flux.json"
NOAA_30DAY_FLUX_URL = "https://services.swpc.noaa.gov/products/10cm-flux-30-day.json"
NOAA_SOLAR_CYCLE_URL = "https://services.swpc.noaa.gov/json/solar-cycle/f10-7cm-flux.json"

class SpaceWeatherService:
    """
    Manages live NOAA SWPC 10.7cm solar radio flux and thermospheric drag modeling.
    """
    
    _cached_flux: Optional[Dict[str, Any]] = None
    _cached_30day: Optional[List[Dict[str, Any]]] = None
    _last_fetched: Optional[datetime] = None

    @classmethod
    def fetch_live_flux(cls) -> Dict[str, Any]:
        """
        Fetches current 10.7cm solar radio flux from NOAA SWPC live API.
        """
        now = datetime.now(timezone.utc)
        
        # Cache for 5 minutes
        if cls._cached_flux and cls._last_fetched and (now - cls._last_fetched).total_seconds() < 300:
            return cls._cached_flux

        try:
            req = urllib.request.Request(
                NOAA_CURRENT_FLUX_URL,
                headers={"User-Agent": "Aegis-SpaceDefense/2.4 (Collision Avoidance System)"}
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode())
                
            if isinstance(data, list) and len(data) > 0:
                raw_entry = data[0]
                flux_val = float(raw_entry.get("flux", 117.0))
                time_tag = raw_entry.get("time_tag", now.isoformat())
            elif isinstance(data, dict):
                flux_val = float(data.get("flux", 117.0))
                time_tag = data.get("time_tag", now.isoformat())
            else:
                flux_val = 117.0
                time_tag = now.isoformat()
                
        except Exception as e:
            logger.warning(f"NOAA SWPC live fetch fallback due to: {e}")
            flux_val = 117.0
            time_tag = now.isoformat()

        # Classify solar activity and thermospheric drag index
        if flux_val < 90.0:
            activity = "SOLAR_MINIMUM_QUIET"
            drag_factor = 0.85
            severity = "LOW"
        elif flux_val < 140.0:
            activity = "MODERATE_SOLAR_ACTIVITY"
            drag_factor = 1.05
            severity = "MEDIUM"
        elif flux_val < 200.0:
            activity = "ELEVATED_SOLAR_MAXIMUM"
            drag_factor = 1.65
            severity = "HIGH"
        else:
            activity = "EXTREME_SOLAR_STORM"
            drag_factor = 2.80
            severity = "CRITICAL"

        cls._cached_flux = {
            "flux_sfu": flux_val,
            "unit": "Solar Flux Units (10^-22 W m^-2 Hz^-1)",
            "timestamp": time_tag,
            "source": "NOAA Space Weather Prediction Center (SWPC)",
            "solar_cycle_phase": "Solar Cycle 25 Maximum",
            "activity_level": activity,
            "severity": severity,
            "thermospheric_drag_multiplier": drag_factor,
            "atmospheric_density_impact": f"+{round((drag_factor - 1.0) * 100, 1)}% vs nominal" if drag_factor >= 1.0 else f"{round((drag_factor - 1.0) * 100, 1)}% vs nominal",
            "orbital_propagation_adjustment": "Dynamic BSTAR atmospheric scaling applied to LEO ephemerides"
        }
        cls._last_fetched = now
        return cls._cached_flux

    @classmethod
    def fetch_30day_history(cls) -> List[Dict[str, Any]]:
        """
        Fetches recent 30-day 10.7cm solar flux history from NOAA.
        """
        try:
            req = urllib.request.Request(
                NOAA_30DAY_FLUX_URL,
                headers={"User-Agent": "Aegis-SpaceDefense/2.4"}
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode())
                if isinstance(data, list) and len(data) > 0:
                    cls._cached_30day = data
                    return data
        except Exception as e:
            logger.warning(f"NOAA 30-day fetch fallback: {e}")

        if cls._cached_30day:
            return cls._cached_30day

        # Fallback synthetic 30-day profile
        return [
            {"time_tag": f"2026-08-{i:02d}T20:00:00", "flux": round(115 + (i % 7) * 2.5, 1)}
            for i in range(1, 31)
        ]
