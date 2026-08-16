# 🛰️ Aegis: Space Debris Collision Avoidance System

<div align="center">

[![Live Demo](https://img.shields.io/badge/Live_Demo-aegis--97li.onrender.com-00d2ff?style=for-the-badge&logo=render&logoColor=white)](https://aegis-97li.onrender.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![Three.js](https://img.shields.io/badge/3D_Engine-Three.js-black?style=for-the-badge&logo=three.js)](https://threejs.org/)
[![Astrodynamics](https://img.shields.io/badge/Physics-SGP4_Propagator-blueviolet?style=for-the-badge)](https://space-track.org)

**Real-Time Space Situational Awareness (SSA) • Orbital Conjunction Prediction • Fuel-Optimized Autonomous Maneuvers**

[Explore Live Demo](https://aegis-97li.onrender.com/) • [View Architecture](#-architecture--data-pipeline) • [Key Features](#-core-features) • [Installation](#-getting-started)

</div>

---

## 🌌 Overview

With Low Earth Orbit (LEO) becoming exponentially congested with active payloads and defunct space debris, traditional manual collision monitoring cannot scale. **Aegis** is an end-to-end, real-time **Space Situational Awareness (SSA)** and autonomous collision avoidance platform.

Aegis ingests publicly available Two-Line Element (TLE) datasets from **Space-Track.org** and **CelesTrak**, dynamically computes high-precision orbital state vectors using **SGP4 propagation**, evaluates collision probabilities ($P_c$) using classical 2D Foster and Monte Carlo methods, and leverages machine learning to recommend **fuel-efficient, delta-v optimized evasive maneuvers**.

---

## 🚀 Live Deployment

The system is deployed and accessible live:
🔗 **[https://aegis-97li.onrender.com/](https://aegis-97li.onrender.com/)**

---

## ✨ Core Features

### 1. 🌐 Cinematic & Real-Time 3D Orbital Visualizers
* **Cinematic Landing Globe:** High-fidelity 3D Earth model rendering dynamically propagated real orbits rather than static mock paths. Color-coded classification:
  * 🟡 **Payloads / Active Satellites**
  * 🔴 **Space Debris**
  * 🟢 **Rocket Bodies**
* **Mission Control LEO Visualizer:** WebSocket-driven tracking canvas rendering real-time object positions, velocity vectors, and orbital planes at 60 FPS.

### 2. ⚡ Real-Time Telemetry & Data Architecture
* **SGP4 Ephemeris Engine:** Mathematical propagation core converting TLE orbital elements into instantaneous Cartesian $(X, Y, Z)$ state vectors.
* **WebSocket Pipeline (`/ws/live`):** Continuous, bi-directional telemetry streaming to update client-side positions without polling overhead.
* **RESTful Catalog API (`/api/catalog`):** Filterable orbital database indexed by NORAD ID, object type, apogee, perigee, and inclination.

### 3. 🎯 Conjunction Assessment & Collision Probability Engine
* **Automated Risk Triage:** Conjunction events categorized by severity thresholds (Critical, High, Medium, Low) based on calculated Probability of Collision ($P_c$).
* **Mathematical Sandbox:** Integrated **2D Foster** and **Monte Carlo** collision probability calculator supporting custom covariance matrices ($\sigma_x, \sigma_y, \sigma_z$), hard-body combined radius, and miss distance.
* **Covariance Ellipsoids:** Visual spatial error representations at the predicted Time of Closest Approach (TCA).

### 4. 🎛️ Fuel-Efficient Maneuver Planning
* **Delta-V Optimization:** AI/RL-assisted recommendations calculating minimal impulse burns required to clear safety thresholds while preserving onboard propellant.
* **Operator Authorization Flow:** Interactive review drawer allowing mission operators to simulate burn vectors, review post-maneuver trajectories, and dispatch authorization payloads to flight dynamics endpoints.

---

## 🏗️ Architecture & Data Pipeline
