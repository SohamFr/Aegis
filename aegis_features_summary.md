# Aegis: Space Debris Collision Avoidance System
**Detailed Features & Facilities Summary**

Aegis is a comprehensive, real-time Space Situational Awareness (SSA) and collision avoidance platform. It combines modern web technologies with advanced astrodynamics (like SGP4 propagation) to track, predict, and mitigate collisions between active satellites and space debris in Low Earth Orbit (LEO).

Below is a detailed summary of the platform's core features, architecture, and real-time data capabilities.

---

## 1. Real-Time Data Fetching & Architecture

The backbone of Aegis is its robust real-time data integration, designed to provide operators with up-to-the-second accuracy regarding orbital threats.

- **RESTful Catalog API (`/api/catalog`)**: The backend serves a comprehensive database of tracked objects (Payloads, Debris, Rocket Bodies) along with their Two-Line Element (TLE) sets, physical parameters (mass, cross-section), and orbital characteristics (altitude, inclination).
- **WebSocket Telemetry (`/ws/live`)**: Instead of relying solely on static data, the platform maintains a persistent WebSocket connection to stream live telemetry updates directly to the frontend. This ensures the 3D visualization and dashboard metrics reflect the exact current state of the orbital environment.
- **SGP4 Propagation**: The backend utilizes the industry-standard SGP4 model to propagate historical TLE data into real-time Ephemeris state vectors (exact XYZ positions and velocities). 
- **Uses**: This real-time architecture is crucial for dynamic collision risk assessment (Conjunction Analysis), live 3D visualization, and calculating precise Time of Closest Approach (TCA).

---

## 2. Interactive 3D Orbital Visualizers

Aegis features two distinct 3D visualizers built with Three.js to provide spatial awareness.

### Cinematic Landing Globe
- **Visuals**: A high-fidelity, cinematic Earth model with dynamic lighting, an atmospheric glow, and rotating cloud layers.
- **Data-Driven Orbits**: Upon loading, it fetches the real catalog data via the API and accurately plots the orbital paths (using precise inclinations and altitudes) rather than relying on randomized mock data.
- **Color-Coded Classification**: Objects are visually categorized using intuitive colors:
  - 🟡 **Payloads / Active Satellites** (Yellow)
  - 🔴 **Debris** (Red)
  - 🟢 **Rocket Bodies** (Green)

### Dashboard LEO Trajectory Visualizer
- **Live Tracking**: Directly hooked into the WebSocket telemetry stream, this visualizer renders the real-time movement of space objects across the globe.
- **Interactivity**: Operators can interact with the globe to select specific satellites, view their immediate trajectories, and assess localized orbital congestion.

---

## 3. Core Operational Modules

The application is structured as a Single Page Application (SPA) divided into several specialized operational modules.

### A. Dashboard
- **Overview Metrics**: Displays critical system vitals at a glance, including total tracked objects, active payloads, known debris counts, and the number of active alerts.
- **Recent Anomalies**: A feed of recent system alerts or sudden orbital changes requiring operator attention.

### B. Catalog (Space Object Database)
- **Search & Filtering**: A comprehensive table allowing operators to search for specific NORAD IDs or satellite names.
- **Data Details**: Displays object type, orbital regime, mass, and current status. It dynamically sorts and filters based on user queries, providing a quick reference for any tracked object.

### C. Conjunctions (Collision Risk Assessment)
- **Event Tracking**: Identifies and lists predicted close approaches (conjunctions) between objects. 
- **Risk Triage**: Events are categorized by severity thresholds (Critical, High, Medium, Low) based on the calculated Probability of Collision (Pc).
- **Detailed Geometry**: Clicking an event reveals the exact Time of Closest Approach (TCA), predicted miss distance, relative velocity, and the specific geometry of the encounter.

### D. Maneuvers (Evasive Action Planning)
- **Automated Recommendations**: When a critical conjunction is detected involving an active, maneuverable payload, the system generates recommended evasive maneuvers (e.g., Delta-V burns).
- **Authorization Flow**: Operators can review the suggested thrust parameters, add operational notes, and securely "Accept" the maneuver via an API endpoint (`/api/conjunctions/{id}/maneuvers/accept`), effectively queuing the command for the Flight Dynamics system.

### E. Calculator (Standalone Probability Engine)
- **Monte Carlo & 2D Foster**: A dedicated mathematical sandbox where operators can manually calculate the Probability of Collision.
- **Custom Inputs**: Users can input custom covariance matrices (Sigma X, Y, Z), miss distances, and combined hard-body radii.
- **Catalog Integration**: Operators can select two distinct object IDs from the catalog, and the engine will automatically compute their exact current distance and TCA using the backend propagator to feed the probability models.

### F. Reports & Settings
- **Audit Logs**: Maintains a secure history of all system events, acknowledged alerts, and authorized maneuvers.
- **Customization**: Allows operators to adjust risk thresholds, toggle UI themes (Dark/Light), and manage API keys for external data ingestion (e.g., Space-Track.org integration).

---

## Conclusion
Aegis is not just a visualization tool; it is a full-stack, data-driven command and control interface. By combining real-time SGP4 physics propagation with highly interactive, cinematic 3D web interfaces, it provides operators with the situational awareness required to protect critical orbital infrastructure from the growing threat of space debris.
