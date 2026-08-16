"""
High-Precision SGP4 Orbital Propagation Engine and Coordinate Transformations.
"""

import math
import numpy as np
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Tuple, Optional
from sgp4.api import Satrec, jday

# Earth WGS-84 Constants
EARTH_RADIUS_KM = 6378.137
EARTH_MU = 398600.4418  # km^3 / s^2
EARTH_ROTATION_RATE_RAD_S = 7.2921150e-5  # rad/s

class Propagator:
    """
    SGP4 Orbital Propagator for two-line element sets.
    """
    
    def __init__(self, tle_line1: str, tle_line2: str, name: str = ""):
        self.tle_line1 = tle_line1.strip()
        self.tle_line2 = tle_line2.strip()
        self.name = name
        self.satellite = Satrec.twoline2rv(self.tle_line1, self.tle_line2)
        self.norad_id = self.satellite.satnum
        
    @staticmethod
    def datetime_to_jd(dt: datetime) -> Tuple[float, float]:
        """Convert standard datetime (UTC) to Julian Date (jd, fr)."""
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return jday(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second + dt.microsecond * 1e-6)
    
    def propagate(self, dt: datetime) -> Dict[str, Any]:
        """
        Propagate satellite orbit to the specified datetime.
        Returns Cartesian state vector [r, v] in TEME/ECI coordinates and geodetic coords.
        """
        jd, fr = self.datetime_to_jd(dt)
        error_code, r, v = self.satellite.sgp4(jd, fr)
        
        if error_code != 0:
            # Fallback approximate state if sgp4 error (e.g. decayed)
            raise ValueError(f"SGP4 propagation error code {error_code} for satellite {self.norad_id}")
            
        rx, ry, rz = float(r[0]), float(r[1]), float(r[2])
        vx, vy, vz = float(v[0]), float(v[1]), float(v[2])
        
        r_mag = math.sqrt(rx*rx + ry*ry + rz*rz)
        v_mag = math.sqrt(vx*vx + vy*vy + vz*vz)
        altitude_km = max(0.0, r_mag - EARTH_RADIUS_KM)
        
        # Calculate Greenwich Mean Sidereal Time (GMST) for ECI to ECEF conversion
        gmst = self._calculate_gmst(jd + fr)
        
        # Convert ECI TEME to geodetic lat/lon
        lat_deg, lon_deg = self._eci_to_geodetic(rx, ry, rz, gmst)
        
        # Calculate classical orbital elements
        keplerian = self._cartesian_to_keplerian(np.array([rx, ry, rz]), np.array([vx, vy, vz]))
        
        return {
            "timestamp": dt.isoformat(),
            "position": {"x": rx, "y": ry, "z": rz, "magnitude_km": r_mag},
            "velocity": {"vx": vx, "vy": vy, "vz": vz, "magnitude_km_s": v_mag},
            "altitude_km": altitude_km,
            "latitude_deg": lat_deg,
            "longitude_deg": lon_deg,
            "keplerian": keplerian
        }

    def generate_ephemeris(self, start_dt: datetime, end_dt: datetime, step_seconds: int = 60) -> List[Dict[str, Any]]:
        """
        Generate ephemeris time-series data between start_dt and end_dt.
        """
        ephemeris = []
        curr = start_dt
        step = timedelta(seconds=max(1, step_seconds))
        
        while curr <= end_dt:
            try:
                state = self.propagate(curr)
                ephemeris.append(state)
            except Exception:
                pass
            curr += step
            
        return ephemeris

    def _calculate_gmst(self, jd_full: float) -> float:
        """Calculate Greenwich Mean Sidereal Time in radians for epoch jd."""
        t_ut1 = (jd_full - 2451545.0) / 36525.0
        gmst_seconds = (
            24110.54841 +
            8640184.812866 * t_ut1 +
            0.093104 * (t_ut1 ** 2) -
            6.2e-6 * (t_ut1 ** 3)
        )
        gmst_rad = (gmst_seconds % 86400.0) * (2.0 * math.pi / 86400.0)
        return gmst_rad

    def _eci_to_geodetic(self, x: float, y: float, z: float, gmst: float) -> Tuple[float, float]:
        """Convert ECI coordinates to Earth-fixed geodetic latitude & longitude in degrees."""
        # Rotate ECI around Z axis by GMST to get ECEF
        cos_g = math.cos(gmst)
        sin_g = math.sin(gmst)
        x_ecef = x * cos_g + y * sin_g
        y_ecef = -x * sin_g + y * cos_g
        z_ecef = z
        
        # Spherical / oblate geocentric approx
        r_xy = math.sqrt(x_ecef * x_ecef + y_ecef * y_ecef)
        lat_rad = math.atan2(z_ecef, r_xy)
        lon_rad = math.atan2(y_ecef, x_ecef)
        
        lat_deg = math.degrees(lat_rad)
        lon_deg = math.degrees(lon_rad)
        
        # Normalize longitude between -180 and +180
        lon_deg = (lon_deg + 180.0) % 360.0 - 180.0
        
        return round(lat_deg, 4), round(lon_deg, 4)

    def _cartesian_to_keplerian(self, r: np.ndarray, v: np.ndarray) -> Dict[str, float]:
        """Calculate Keplerian elements from state vector."""
        r_mag = np.linalg.norm(r)
        v_mag = np.linalg.norm(v)
        
        # Specific angular momentum vector h = r x v
        h = np.cross(r, v)
        h_mag = np.linalg.norm(h)
        
        # Line of nodes n = k x h
        k_unit = np.array([0.0, 0.0, 1.0])
        n = np.cross(k_unit, h)
        n_mag = np.linalg.norm(n)
        
        # Eccentricity vector e = (1/mu) * [(v^2 - mu/r)*r - (r.v)*v]
        e_vec = (1.0 / EARTH_MU) * ((v_mag**2 - EARTH_MU / r_mag) * r - np.dot(r, v) * v)
        eccentricity = float(np.linalg.norm(e_vec))
        
        # Specific mechanical energy xi = v^2 / 2 - mu / r
        energy = (v_mag**2) / 2.0 - EARTH_MU / r_mag
        
        if abs(1.0 - eccentricity) > 1e-7 and abs(energy) > 1e-9:
            semi_major_axis = float(-EARTH_MU / (2.0 * energy))
            period_minutes = float(2.0 * math.pi * math.sqrt((semi_major_axis**3) / EARTH_MU) / 60.0)
            apogee_alt = float(semi_major_axis * (1.0 + eccentricity) - EARTH_RADIUS_KM)
            perigee_alt = float(semi_major_axis * (1.0 - eccentricity) - EARTH_RADIUS_KM)
        else:
            semi_major_axis = r_mag
            period_minutes = 90.0
            apogee_alt = r_mag - EARTH_RADIUS_KM
            perigee_alt = r_mag - EARTH_RADIUS_KM
            
        # Inclination
        inc_rad = math.acos(np.clip(h[2] / max(1e-9, h_mag), -1.0, 1.0))
        inclination_deg = float(math.degrees(inc_rad))
        
        # RAAN (Right Ascension of Ascending Node)
        if n_mag > 1e-7:
            raan_rad = math.acos(np.clip(n[0] / n_mag, -1.0, 1.0))
            if n[1] < 0:
                raan_rad = 2.0 * math.pi - raan_rad
            raan_deg = float(math.degrees(raan_rad))
        else:
            raan_deg = 0.0
            
        # Argument of Perigee
        if n_mag > 1e-7 and eccentricity > 1e-6:
            argp_rad = math.acos(np.clip(np.dot(n, e_vec) / (n_mag * eccentricity), -1.0, 1.0))
            if e_vec[2] < 0:
                argp_rad = 2.0 * math.pi - argp_rad
            argp_deg = float(math.degrees(argp_rad))
        else:
            argp_deg = 0.0
            
        return {
            "semi_major_axis_km": round(semi_major_axis, 2),
            "eccentricity": round(eccentricity, 6),
            "inclination_deg": round(inclination_deg, 4),
            "raan_deg": round(raan_deg, 4),
            "arg_perigee_deg": round(argp_deg, 4),
            "period_minutes": round(period_minutes, 2),
            "apogee_altitude_km": round(apogee_alt, 2),
            "perigee_altitude_km": round(perigee_alt, 2)
        }
