"""
Configuration and settings for the Aegis Space Debris Collision Avoidance System.
"""

import os
from pydantic import BaseModel, Field
from typing import Dict, Any

class SystemSettings(BaseModel):
    app_name: str = "Aegis Space Debris Collision Avoidance System"
    version: str = "2.4.0"
    api_prefix: str = "/api"
    
    # Collision threshold settings
    miss_distance_critical_km: float = Field(default=1.0, description="Critical miss distance threshold in km")
    miss_distance_warning_km: float = Field(default=5.0, description="Warning miss distance threshold in km")
    probability_critical_threshold: float = Field(default=1e-4, description="Critical collision probability Pc")
    probability_warning_threshold: float = Field(default=1e-6, description="Warning collision probability Pc")
    
    # Screening parameters
    screening_horizon_days: int = Field(default=7, description="Lookahead window for conjunction screening")
    screening_step_seconds: int = Field(default=60, description="Time step for coarse conjunction sweep in seconds")
    monte_carlo_default_samples: int = Field(default=10000, description="Default Monte Carlo simulation iterations")
    
    # Satellite physical defaults
    default_satellite_mass_kg: float = Field(default=500.0, description="Default operational spacecraft dry mass")
    default_isp_seconds: float = Field(default=300.0, description="Default chemical/electric thruster specific impulse")
    safe_separation_target_km: float = Field(default=15.0, description="Target miss distance after evasive maneuver")
    
    # External Real-Time Feeds & Keys
    satellite_catalog_api_key: str = Field(
        default="ow_KTnBx6qzwY3aeskEQnTVVj-FE0JIeDQFQG1tZtNPip0",
        description="OrbitWatch / CelesTrak / GCAT / Wikidata 16,000+ satellite catalog API key"
    )
    noaa_flux_endpoint: str = Field(
        default="https://services.swpc.noaa.gov/products/summary/10cm-flux.json",
        description="NOAA SWPC live F10.7cm solar radio flux endpoint"
    )
    noaa_30day_flux_endpoint: str = Field(
        default="https://services.swpc.noaa.gov/products/10cm-flux-30-day.json",
        description="NOAA SWPC 30-day 10.7cm solar flux history endpoint"
    )

settings = SystemSettings()
