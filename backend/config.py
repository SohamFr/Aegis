"""
Configuration and settings for the Aegis Space Debris Collision Avoidance System.
Reads from system environment variables with fallback defaults.
"""

import os
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

class SystemSettings(BaseModel):
    app_name: str = os.getenv("APP_NAME", "Aegis Space Debris Collision Avoidance System")
    version: str = os.getenv("APP_VERSION", "2.4.0")
    api_prefix: str = "/api"
    live_broadcast_hz: float = float(os.getenv("LIVE_BROADCAST_HZ", "5.0"))
    
    # Collision threshold settings
    miss_distance_critical_km: float = float(os.getenv("MISS_DISTANCE_CRITICAL_KM", "1.0"))
    miss_distance_warning_km: float = float(os.getenv("MISS_DISTANCE_WARNING_KM", "5.0"))
    probability_critical_threshold: float = float(os.getenv("PROBABILITY_CRITICAL_THRESHOLD", "1e-4"))
    probability_warning_threshold: float = float(os.getenv("PROBABILITY_WARNING_THRESHOLD", "1e-6"))
    
    # Screening parameters
    screening_horizon_days: int = int(os.getenv("SCREENING_HORIZON_DAYS", "7"))
    screening_step_seconds: int = int(os.getenv("SCREENING_STEP_SECONDS", "300"))
    monte_carlo_default_samples: int = int(os.getenv("MONTE_CARLO_SAMPLES", "10000"))
    
    # Satellite physical defaults
    default_satellite_mass_kg: float = float(os.getenv("DEFAULT_SATELLITE_MASS_KG", "500.0"))
    default_isp_seconds: float = float(os.getenv("DEFAULT_ISP_SECONDS", "300.0"))
    safe_separation_target_km: float = float(os.getenv("SAFE_SEPARATION_TARGET_KM", "15.0"))
    
    # External Live Feeds & API Keys
    satellite_catalog_api_key: str = os.getenv(
        "SATELLITE_CATALOG_API_KEY",
        "ow_KTnBx6qzwY3aeskEQnTVVj-FE0JIeDQFQG1tZtNPip0"
    )
    noaa_flux_endpoint: str = os.getenv(
        "NOAA_FLUX_ENDPOINT",
        "https://services.swpc.noaa.gov/products/summary/10cm-flux.json"
    )
    noaa_30day_flux_endpoint: str = os.getenv(
        "NOAA_30DAY_FLUX_ENDPOINT",
        "https://services.swpc.noaa.gov/products/10cm-flux-30-day.json"
    )
    
    # Optional External Providers
    space_track_user: Optional[str] = os.getenv("SPACE_TRACK_USER", None)
    space_track_password: Optional[str] = os.getenv("SPACE_TRACK_PASSWORD", None)
    leolabs_api_key: Optional[str] = os.getenv("LEOLABS_API_KEY", None)

settings = SystemSettings()
