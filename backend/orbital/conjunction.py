"""
Collision Prediction, Conjunction Screening, and Probability of Collision (Pc) Engine.
Implements Foster-1992 2D Encounter Plane Integration, Monte Carlo Sampling, and Chan's formulation.
"""

import math
import numpy as np
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Tuple, Optional
from scipy.optimize import minimize_scalar
from scipy.integrate import dblquad

from backend.orbital.propagator import Propagator

class ConjunctionEngine:
    """
    Orbital Conjunction Screening and Probability of Collision Calculator.
    """
    
    @staticmethod
    def calculate_distance_at_time(prop1: Propagator, prop2: Propagator, dt: datetime) -> Tuple[float, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """Returns distance in km, r1, v1, r2, v2 at given datetime."""
        s1 = prop1.propagate(dt)
        s2 = prop2.propagate(dt)
        r1 = np.array([s1["position"]["x"], s1["position"]["y"], s1["position"]["z"]])
        v1 = np.array([s1["velocity"]["vx"], s1["velocity"]["vy"], s1["velocity"]["vz"]])
        r2 = np.array([s2["position"]["x"], s2["position"]["y"], s2["position"]["z"]])
        v2 = np.array([s2["velocity"]["vx"], s2["velocity"]["vy"], s2["velocity"]["vz"]])
        dist = float(np.linalg.norm(r1 - r2))
        return dist, r1, v1, r2, v2

    @classmethod
    def find_tca(cls, prop1: Propagator, prop2: Propagator, start_dt: datetime, end_dt: datetime, step_s: int = 60) -> Optional[Dict[str, Any]]:
        """
        Find the Time of Closest Approach (TCA) and minimum miss distance between two objects within [start_dt, end_dt].
        Uses a two-phase search: coarse grid scan + 1D minimization.
        """
        curr = start_dt
        min_dist = float("inf")
        coarse_tca = start_dt
        
        while curr <= end_dt:
            try:
                dist, _, _, _, _ = cls.calculate_distance_at_time(prop1, prop2, curr)
                if dist < min_dist:
                    min_dist = dist
                    coarse_tca = curr
            except Exception:
                pass
            curr += timedelta(seconds=step_s)
            
        if min_dist == float("inf"):
            return None
            
        # Refine TCA with continuous 1D minimization around coarse_tca
        window_s = step_s * 2
        refine_start = coarse_tca - timedelta(seconds=window_s)
        
        def dist_func(offset_s: float) -> float:
            target_dt = refine_start + timedelta(seconds=offset_s)
            try:
                d, _, _, _, _ = cls.calculate_distance_at_time(prop1, prop2, target_dt)
                return d
            except Exception:
                return 1e6

        res = minimize_scalar(dist_func, bounds=(0, window_s * 2), method="bounded")
        exact_offset_s = float(res.x)
        exact_tca = refine_start + timedelta(seconds=exact_offset_s)
        
        miss_dist_km, r1, v1, r2, v2 = cls.calculate_distance_at_time(prop1, prop2, exact_tca)
        
        r_rel = r1 - r2
        v_rel = v1 - v2
        v_rel_mag = float(np.linalg.norm(v_rel))
        
        # Radial, In-Track, Cross-Track (RIC) frame relative position
        r1_unit = r1 / np.linalg.norm(r1)
        cross_unit = np.cross(r1, v1)
        cross_unit = cross_unit / np.linalg.norm(cross_unit)
        in_track_unit = np.cross(cross_unit, r1_unit)
        
        radial_km = float(np.dot(r_rel, r1_unit))
        in_track_km = float(np.dot(r_rel, in_track_unit))
        cross_track_km = float(np.dot(r_rel, cross_unit))
        
        return {
            "tca": exact_tca.isoformat(),
            "miss_distance_km": round(miss_dist_km, 4),
            "relative_velocity_km_s": round(v_rel_mag, 4),
            "relative_vector_km": {
                "x": round(float(r_rel[0]), 4),
                "y": round(float(r_rel[1]), 4),
                "z": round(float(r_rel[2]), 4),
                "radial_km": round(radial_km, 4),
                "in_track_km": round(in_track_km, 4),
                "cross_track_km": round(cross_track_km, 4),
            },
            "primary_state": {"position": r1.tolist(), "velocity": v1.tolist()},
            "secondary_state": {"position": r2.tolist(), "velocity": v2.tolist()},
        }

    @staticmethod
    def calculate_foster_probability(
        miss_distance_km: float,
        combined_radius_m: float,
        sigma_x_m: float = 200.0,
        sigma_y_m: float = 100.0,
        relative_offset_m: Optional[Tuple[float, float]] = None
    ) -> float:
        """
        Calculates collision probability Pc using Foster-1992 encounter plane integration.
        Integrates bivariate normal distribution over combined hard-body collision circle.
        """
        combined_radius_km = combined_radius_m / 1000.0
        sigma_x_km = max(0.001, sigma_x_m / 1000.0)
        sigma_y_km = max(0.001, sigma_y_m / 1000.0)
        
        if relative_offset_m is not None:
            x_e = relative_offset_m[0] / 1000.0
            y_e = relative_offset_m[1] / 1000.0
        else:
            x_e = miss_distance_km * 0.7071
            y_e = miss_distance_km * 0.7071
            
        r_comb = combined_radius_km
        
        # If miss distance is huge relative to covariance, Pc is numerically 0
        if (x_e**2 / sigma_x_km**2 + y_e**2 / sigma_y_km**2) > 100.0:
            return 1e-15
            
        # 2D polar numerical integration over the collision disk
        # x = r cos theta + x_e, y = r sin theta + y_e
        def integrand(r: float, theta: float) -> float:
            x = r * math.cos(theta) + x_e
            y = r * math.sin(theta) + y_e
            expo = -0.5 * ((x / sigma_x_km)**2 + (y / sigma_y_km)**2)
            return r * math.exp(expo) / (2.0 * math.pi * sigma_x_km * sigma_y_km)

        try:
            val, _ = dblquad(integrand, 0.0, 2.0 * math.pi, 0.0, r_comb)
            pc = float(max(1e-15, min(1.0, val)))
        except Exception:
            # Analytical approximation fallback
            area = math.pi * (r_comb**2)
            peak = 1.0 / (2.0 * math.pi * sigma_x_km * sigma_y_km)
            expo = -0.5 * ((x_e / sigma_x_km)**2 + (y_e / sigma_y_km)**2)
            pc = float(max(1e-15, min(1.0, area * peak * math.exp(expo))))
            
        return pc

    @staticmethod
    def calculate_monte_carlo_probability(
        miss_distance_km: float,
        combined_radius_m: float,
        sigma_x_m: float = 200.0,
        sigma_y_m: float = 100.0,
        sigma_z_m: float = 150.0,
        num_samples: int = 10000
    ) -> Dict[str, Any]:
        """
        Calculates collision probability using Monte Carlo random sampling from covariance.
        """
        combined_radius_km = combined_radius_m / 1000.0
        sx_km = sigma_x_m / 1000.0
        sy_km = sigma_y_m / 1000.0
        sz_km = sigma_z_m / 1000.0
        
        # Nominal encounter offset (miss vector)
        mean_offset = np.array([miss_distance_km * 0.7071, miss_distance_km * 0.7071, 0.0])
        
        # Sample stochastic perturbations
        dx = np.random.normal(0, sx_km, num_samples)
        dy = np.random.normal(0, sy_km, num_samples)
        dz = np.random.normal(0, sz_km, num_samples)
        
        sampled_x = mean_offset[0] + dx
        sampled_y = mean_offset[1] + dy
        sampled_z = mean_offset[2] + dz
        
        distances = np.sqrt(sampled_x**2 + sampled_y**2 + sampled_z**2)
        hits = np.sum(distances <= combined_radius_km)
        pc_mc = float(hits / num_samples)
        
        # Build histogram for UI visualization
        hist_counts, bin_edges = np.histogram(distances, bins=20)
        histogram_data = [
            {"bin_start_km": round(float(bin_edges[i]), 3), "bin_end_km": round(float(bin_edges[i+1]), 3), "count": int(hist_counts[i])}
            for i in range(len(hist_counts))
        ]
        
        return {
            "pc": max(pc_mc, 1e-6 if miss_distance_km < 1.0 else 1e-12),
            "num_samples": num_samples,
            "simulated_collisions": int(hits),
            "min_simulated_distance_km": round(float(np.min(distances)), 4),
            "mean_simulated_distance_km": round(float(np.mean(distances)), 4),
            "distance_histogram": histogram_data
        }

    @staticmethod
    def calculate_chan_probability(miss_distance_km: float, combined_radius_m: float, sigma_km: float = 0.2) -> float:
        """Chan's analytical series approximation for isotropic/circular covariance."""
        r_c = combined_radius_m / 1000.0
        u = (r_c / sigma_km)**2
        v = (miss_distance_km / sigma_km)**2
        # Max collision probability formulation
        if miss_distance_km > 0:
            pc_max = (r_c**2) / (math.e * (miss_distance_km**2))
        else:
            pc_max = 1.0
        pc = 1.0 - math.exp(-u / 2.0) * math.exp(-v / 2.0) * (1.0 + 0.5 * u * v)
        return float(max(1e-15, min(pc_max, pc)))

    @classmethod
    def evaluate_conjunction(
        cls,
        obj1: Dict[str, Any],
        obj2: Dict[str, Any],
        start_dt: datetime,
        end_dt: datetime
    ) -> Optional[Dict[str, Any]]:
        """
        Evaluate full conjunction between two catalog objects.
        """
        prop1 = Propagator(obj1["tle_line1"], obj1["tle_line2"], obj1["name"])
        prop2 = Propagator(obj2["tle_line1"], obj2["tle_line2"], obj2["name"])
        
        tca_res = cls.find_tca(prop1, prop2, start_dt, end_dt)
        if not tca_res:
            return None
            
        miss_dist_km = tca_res["miss_distance_km"]
        comb_radius_m = obj1.get("hard_body_radius_m", 5.0) + obj2.get("hard_body_radius_m", 1.0)
        
        # Position uncertainty / covariance based on object type & tracking data
        sigma_x = 250.0 if obj2["type"] == "DEBRIS" else 150.0
        sigma_y = 120.0 if obj2["type"] == "DEBRIS" else 80.0
        
        pc_foster = cls.calculate_foster_probability(miss_dist_km, comb_radius_m, sigma_x, sigma_y)
        chan_pc = cls.calculate_chan_probability(miss_dist_km, comb_radius_m, (sigma_x + sigma_y) / 2000.0)
        
        # Risk classification
        if pc_foster >= 1e-4 or miss_dist_km < 0.5:
            risk_level = "CRITICAL"
        elif pc_foster >= 1e-5 or miss_dist_km < 1.5:
            risk_level = "HIGH"
        elif pc_foster >= 1e-6 or miss_dist_km < 5.0:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"
            
        conjunction_id = f"CONJ-{obj1['norad_id']}-{obj2['norad_id']}-{datetime.fromisoformat(tca_res['tca']).strftime('%Y%m%d%H%M')}"
        
        return {
            "id": conjunction_id,
            "primary_object": {
                "id": str(obj1["norad_id"]),
                "name": obj1["name"],
                "norad_id": obj1["norad_id"],
                "type": obj1["type"],
                "is_maneuverable": obj1.get("is_maneuverable", False),
                "hard_body_radius_m": obj1.get("hard_body_radius_m", 5.0),
                "mass_kg": obj1.get("mass_kg", 500.0),
                "fuel_remaining_kg": obj1.get("fuel_remaining_kg", 0.0),
                "isp_s": obj1.get("isp_s", 300.0),
            },
            "secondary_object": {
                "id": str(obj2["norad_id"]),
                "name": obj2["name"],
                "norad_id": obj2["norad_id"],
                "type": obj2["type"],
                "is_maneuverable": obj2.get("is_maneuverable", False),
                "hard_body_radius_m": obj2.get("hard_body_radius_m", 1.0),
                "mass_kg": obj2.get("mass_kg", 10.0),
            },
            "tca": tca_res["tca"],
            "miss_distance_km": miss_dist_km,
            "relative_velocity_km_s": tca_res["relative_velocity_km_s"],
            "relative_vector_km": tca_res["relative_vector_km"],
            "probability_of_collision": pc_foster,
            "probability_chan": chan_pc,
            "combined_hard_body_radius_m": comb_radius_m,
            "covariance_ellipsoid": {
                "sigma_x_m": sigma_x,
                "sigma_y_m": sigma_y,
                "sigma_z_m": 180.0,
                "orientation_deg": 42.5
            },
            "risk_level": risk_level,
            "status": "ACTIVE_WARNING" if risk_level in ["CRITICAL", "HIGH"] else "MONITORING",
            "detection_timestamp": datetime.now(timezone.utc).isoformat()
        }
