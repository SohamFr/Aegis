<div align="center">

  <!-- Optional: Replace this with your actual banner image -->
  <img src="https://placehold.co/1000x200/03050a/ffffff?text=A++E++G++I++S&font=Montserrat" alt="Aegis Banner" width="100%" style="border-radius: 12px; margin-bottom: 20px;">

  # Aegis
  **Space Debris Collision Avoidance & Orbital Intelligence**

  [![Live Demo](https://img.shields.io/badge/Live_Demo-aegis--97li.onrender.com-0055FF?style=flat-square&logo=render&logoColor=white)](https://aegis-97li.onrender.com/)
  [![License](https://img.shields.io/badge/License-MIT-1A1A1A?style=flat-square)](LICENSE)
  [![3D Engine](https://img.shields.io/badge/WebGL-Three.js-1A1A1A?style=flat-square&logo=three.js)](https://threejs.org/)
  [![Data](https://img.shields.io/badge/Data-Space--Track.org-1A1A1A?style=flat-square)](https://space-track.org)

  <br>
  
  > *Securing Low Earth Orbit with real-time astrodynamics, predictive machine learning, and autonomous fuel-optimized evasive maneuvers.*

  [**Explore Live Demo**](https://aegis-97li.onrender.com/) &nbsp; • &nbsp; [**Architecture**](#-system-architecture) &nbsp; • &nbsp; [**Installation**](#-getting-started)

</div>

<br>

## 🌌 Overview

With Low Earth Orbit (LEO) becoming exponentially congested with active payloads and defunct space debris, traditional manual collision monitoring cannot scale. **Aegis** is an end-to-end, real-time **Space Situational Awareness (SSA)** and autonomous collision avoidance platform.

By ingesting publicly available Two-Line Element (TLE) datasets, Aegis dynamically computes high-precision orbital state vectors, evaluates collision probabilities ($P_c$), and leverages machine learning to recommend Delta-V optimized evasive maneuvers.

---

## ✨ Core Capabilities

### 🌐 Cinematic 3D Visualizer
* **Data-Driven Orbits:** High-fidelity 3D Earth model rendering dynamically propagated orbits rather than static mock paths.
* **Visual Classification:** Intuitive color-coding for payloads (Yellow), debris (Red), and rocket bodies (Green).
* **Live Telemetry:** WebSocket-driven tracking canvas rendering real-time object positions and velocity vectors at 60 FPS.

### ⚡ Astrodynamics & Telemetry
* **SGP4 Ephemeris Engine:** Mathematical core converting TLE elements into instantaneous Cartesian $(X, Y, Z)$ state vectors.
* **Persistent Streaming:** Bi-directional WebSocket pipeline (`/ws/live`) for continuous client-side updates without polling overhead.

### 🎯 Collision Probability Engine
* **Risk Triage:** Automated categorization of conjunction events based on computed Probability of Collision ($P_c$).
* **Mathematical Sandbox:** Integrated **2D Foster** and **Monte Carlo** calculator supporting custom covariance matrices ($\sigma_x, \sigma_y, \sigma_z$) and hard-body radii.
* **Covariance Ellipsoids:** Visual spatial error representations at the predicted Time of Closest Approach (TCA).

### 🎛️ Autonomous Maneuver Planning
* **Delta-V Optimization:** AI-assisted recommendations calculating minimal impulse burns required to clear safety thresholds.
* **Command Authorization:** Interactive review drawer allowing operators to simulate burn vectors and queue authorization payloads.

---

## 🛠️ Technology Stack

| Component | Technologies |
| :--- | :--- |
| **Frontend & UI** | Vanilla JS (SPA), CSS3 Glassmorphism, Font Awesome |
| **3D Rendering** | Three.js, WebGL, Custom Camera Controllers |
| **Astrodynamics** | SGP4 Propagation Model, Ephemeris Computing |
| **Calculations / ML** | 2D Foster, Monte Carlo, XGBoost / RL Optimization |
| **Data Ingestion** | Space-Track.org API, CelesTrak TLE Feeds |
| **Infrastructure** | Node.js / Python Backend, Render Cloud Deployment |

---

## 🏗️ System Architecture

<details>
<summary><b>Click to expand Data Pipeline Diagram</b></summary>

```text
┌────────────────────────────────────────────────────────┐
│             External Orbital Data Sources              │
│       (Space-Track.org / CelesTrak NORAD APIs)         │
└───────────────────────────┬────────────────────────────┘
                            │ TLE Stream
                            ▼
┌────────────────────────────────────────────────────────┐
│                   Aegis Core Backend                   │
│  ┌────────────────────────┐  ┌──────────────────────┐  │
│  │     SGP4 Propagator    │  │ Conjunction Analysis │  │
│  └───────────┬────────────┘  └──────────┬───────────┘  │
│              ▼                          ▼              │
│  ┌──────────────────────────────────────────────────┐  │
│  │  AI / RL Autonomous Maneuver Recommendation Engine │  │
│  └──────────────────────────┬───────────────────────┘  │
└─────────────────────────────┼──────────────────────────┘
                              │
             ┌────────────────┴────────────────┐
             │ REST API (`/api`) & WebSockets  │
             └────────────────┬────────────────┘
                              ▼
┌────────────────────────────────────────────────────────┐
│              Aegis Mission Control (SPA)               │
│  ┌───────────────────────┐  ┌───────────────────────┐  │
│  │   Three.js 3D Engine  │  │  Interactive Sandbox  │  │
│  └───────────────────────┘  └───────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

</details>

---

## 💻 Getting Started

### 1. Clone the repository
```bash
git clone [https://github.com/your-username/aegis.git](https://github.com/your-username/aegis.git)
cd aegis
```

### 2. Serve Locally
Because Aegis relies on native ES Modules and `fetch` requests, it must be run through a local web server (opening the `.html` file directly may cause CORS/module errors).

**Using Python:**
```bash
python -m http.server 8080
```

**Using Node.js:**
```bash
npx http-server . -p 8080
```

### 3. Launch
Navigate to `http://localhost:8080` in your web browser.

---

## 📡 API Reference

<details>
<summary><b>View REST & WebSocket Endpoints</b></summary>

<br>

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/catalog` | Fetch filtered orbital object catalog with active TLEs. |
| `GET` | `/api/conjunctions` | Retrieve prioritized list of predicted high-risk close approaches. |
| `POST` | `/api/calculator/pc` | Compute $P_c$ using custom covariance and miss distance. |
| `POST` | `/api/maneuvers/accept`| Authorize and queue an optimized evasive burn. |
| `WS` | `/ws/live` | Persistent stream for real-time propagated coordinates. |

</details>

---

## ⚖️ License & Acknowledgements

* **License:** Distributed under the [MIT License](LICENSE).
* **Data Providers:** Sincere gratitude to [Space-Track.org](https://space-track.org) and CelesTrak for providing open-access TLE orbital datasets.
* **Research:** Inspired by the ESA Space Debris Office for open-access conjunction analysis research and benchmarks.

<br>

<div align="center">
  <sub>Built for the future of orbital sustainability.</sub>
</div>
