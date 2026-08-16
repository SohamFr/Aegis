/* =========================================================
   Aegis — Space Debris Collision Avoidance System
   Frontend SPA Client & Mission Control Controller
   ========================================================= */
(function () {
  "use strict";

  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------
     Background video — keep it playing on strict autoplay UAs
     --------------------------------------------------------- */
  var video = document.querySelector(".bg-video");
  if (video) {
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute("muted", "");

    var tryPlay = function () {
      var p = video.play();
      if (p && typeof p.catch === "function") p.catch(function () {});
    };

    tryPlay();
    video.addEventListener("loadeddata", tryPlay, { once: true });
    video.addEventListener("canplay", tryPlay, { once: true });
    document.addEventListener("click", tryPlay, { once: true });
    document.addEventListener("touchstart", tryPlay, { once: true, passive: true });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) tryPlay();
    });
  }

  /* ---------------------------------------------------------
     Logo — graceful inline fallback mark if the webp is absent
     --------------------------------------------------------- */
  var logoImg = document.querySelector(".logo img");
  if (logoImg) {
    var fallbackMark =
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
          '<g fill="none" stroke="#0a0a0a" stroke-width="5" stroke-linecap="round">' +
          '<circle cx="32" cy="32" r="20"/>' +
          '<path d="M32 12v40M12 32h40"/>' +
          "</g>" +
          '<circle cx="32" cy="32" r="6.5" fill="#0a0a0a"/>' +
          "</svg>"
      );
    logoImg.addEventListener("error", function () {
      if (logoImg.dataset.fallback === "1") return;
      logoImg.dataset.fallback = "1";
      logoImg.src = fallbackMark;
    });
    if (logoImg.complete && logoImg.naturalWidth === 0) {
      logoImg.dataset.fallback = "1";
      logoImg.src = fallbackMark;
    }
  }

  /* ---------------------------------------------------------
     Release entrance animations when they finish
     --------------------------------------------------------- */
  function bindAnimEndListeners() {
    Array.prototype.forEach.call(
      document.querySelectorAll(".anim, .headline span"),
      function (el) {
        if (el.dataset.animBound === "1") return;
        el.dataset.animBound = "1";
        el.addEventListener("animationend", function (e) {
          if (e.target !== el) return;
          el.classList.add("anim-done");
        });
      }
    );
  }

  bindAnimEndListeners();

  /* ---------------------------------------------------------
     Stats count-up
     --------------------------------------------------------- */
  var stats = Array.prototype.slice.call(document.querySelectorAll(".stat"));

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function renderStat(el, value, decimals, suffix) {
    el.textContent = value.toFixed(decimals) + suffix;
  }

  function countUp(stat, index) {
    var valueEl = stat.querySelector(".stat-value");
    if (!valueEl) return;

    var target = parseFloat(stat.getAttribute("data-target")) || 0;
    var suffix = stat.getAttribute("data-suffix") || "";
    var decimals = parseInt(stat.getAttribute("data-decimals"), 10) || 0;

    if (reduceMotion) {
      renderStat(valueEl, target, decimals, suffix);
      return;
    }

    var duration = 1500 + index * 80;
    var startDelay = 480 + index * 90;

    window.setTimeout(function () {
      var start = null;

      var step = function (ts) {
        if (start === null) start = ts;
        var elapsed = ts - start;
        var t = Math.min(elapsed / duration, 1);
        renderStat(valueEl, target * easeOutCubic(t), decimals, suffix);
        if (t < 1) {
          window.requestAnimationFrame(step);
        } else {
          renderStat(valueEl, target, decimals, suffix);
        }
      };

      window.requestAnimationFrame(step);
    }, startDelay);
  }

  function startStatsCountUp() {
    if (!stats.length) return;

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var el = entry.target;
            if (el.dataset.counted === "1") return;
            el.dataset.counted = "1";
            countUp(el, stats.indexOf(el));
            io.unobserve(el);
          });
        },
        { threshold: 0.25 }
      );
      stats.forEach(function (stat) {
        io.observe(stat);
      });
    } else {
      stats.forEach(function (stat, i) {
        stat.dataset.counted = "1";
        countUp(stat, i);
      });
    }
  }

  startStatsCountUp();

  /* ---------------------------------------------------------
     Landing Page — Interactive 3D Earth Globe with Satellites
     --------------------------------------------------------- */
  var landingGlobe = {
    scene: null, camera: null, renderer: null, controls: null,
    earth: null, satellites: [], trails: [], clock: null,
    initialized: false, animId: null
  };

  function initLandingGlobe() {
    if (landingGlobe.initialized) return;
    if (typeof THREE === "undefined") return;

    var canvas = document.getElementById("landingGlobeCanvas");
    var container = document.getElementById("landingGlobeContainer");
    if (!canvas || !container) return;

    var w = container.clientWidth || 700;
    var h = container.clientHeight || 500;

    // Scene
    var scene = new THREE.Scene();
    landingGlobe.scene = scene;

    // Camera
    var camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 2000);
    camera.position.set(0, 1.2, 7.5);
    landingGlobe.camera = camera;

    // Renderer
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    landingGlobe.renderer = renderer;

    // Controls
    if (typeof THREE.OrbitControls !== "undefined") {
      var controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.enableZoom = true;
      controls.minDistance = 3.5;
      controls.maxDistance = 12;
      controls.enablePan = false;
      controls.autoRotate = false;
      controls.autoRotateSpeed = 0;
      controls.target.set(0, 0, 0);
      landingGlobe.controls = controls;
    }

    // Lighting
    var ambientLight = new THREE.AmbientLight(0x334455, 0.6);
    scene.add(ambientLight);

    var sunLight = new THREE.DirectionalLight(0xffeedd, 1.8);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    var rimLight = new THREE.DirectionalLight(0x4488ff, 0.4);
    rimLight.position.set(-3, 1, -5);
    scene.add(rimLight);

    // Atmospheric glow ring
    var glowGeo = new THREE.RingGeometry(2.9, 3.3, 64);
    var glowMat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide
    });
    var glowRing = new THREE.Mesh(glowGeo, glowMat);
    glowRing.lookAt(camera.position);
    scene.add(glowRing);

    // Starfield background
    var starGeo = new THREE.BufferGeometry();
    var starCount = 2000;
    var starPositions = new Float32Array(starCount * 3);
    for (var si = 0; si < starCount; si++) {
      starPositions[si * 3] = (Math.random() - 0.5) * 200;
      starPositions[si * 3 + 1] = (Math.random() - 0.5) * 200;
      starPositions[si * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    var starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.15, sizeAttenuation: true });
    var stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Texture Loader for High-Res Photorealistic Earth & Clouds
    var textureLoader = new THREE.TextureLoader();
    textureLoader.crossOrigin = "anonymous";
    var dayTexture = textureLoader.load("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg");
    var bumpTexture = textureLoader.load("https://unpkg.com/three-globe/example/img/earth-topology.png");
    var specTexture = textureLoader.load("https://unpkg.com/three-globe/example/img/earth-water.png");
    var cloudTexture = textureLoader.load("https://unpkg.com/three-globe/example/img/earth-clouds.png");

    // Photorealistic Earth Surface
    var earthGeo = new THREE.SphereGeometry(2.75, 64, 64);
    var earthMat = new THREE.MeshPhongMaterial({
      map: dayTexture,
      bumpMap: bumpTexture,
      bumpScale: 0.05,
      specularMap: specTexture,
      specular: new THREE.Color(0x335577),
      shininess: 18
    });
    var earthMesh = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earthMesh);
    landingGlobe.earth = earthMesh;

    // Atmospheric Cloud Layer
    var cloudGeo = new THREE.SphereGeometry(2.79, 64, 64);
    var cloudMat = new THREE.MeshPhongMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending
    });
    var cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    scene.add(cloudMesh);
    landingGlobe.clouds = cloudMesh;

    // Create orbiting satellites
    createOrbitingSatellites(scene, 2.82);

    landingGlobe.clock = new THREE.Clock();
    landingGlobe.initialized = true;

    // Start animation
    animateLandingGlobe();

    // Resize handling
    window.addEventListener("resize", function () {
      var cw = container.clientWidth || 700;
      var ch = container.clientHeight || 500;
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    });
  }

  function createOrbitingSatellites(scene, earthRadius) {
    var satCount = 40;
    var satColors = [0x00ccff, 0xff4466, 0x44ff88, 0xffaa22, 0xaa66ff, 0xff66aa];

    for (var i = 0; i < satCount; i++) {
      var orbitRadius = earthRadius + 0.25 + Math.random() * 1.2;
      var inclination = (Math.random() - 0.5) * Math.PI * 0.9;
      var startAngle = Math.random() * Math.PI * 2;
      var speed = 0.15 + Math.random() * 0.35;
      var color = satColors[i % satColors.length];

      // Satellite body (small glowing sphere)
      var satGeo = new THREE.SphereGeometry(0.02 + Math.random() * 0.015, 8, 8);
      var satMat = new THREE.MeshBasicMaterial({ color: color });
      var satMesh = new THREE.Mesh(satGeo, satMat);
      scene.add(satMesh);

      // Glow point light on satellite
      var satGlow = new THREE.PointLight(color, 0.15, 0.6);
      satMesh.add(satGlow);

      // Orbit path ring (thin line)
      var orbitCurve = new THREE.EllipseCurve(0, 0, orbitRadius, orbitRadius, 0, Math.PI * 2, false, 0);
      var orbitPoints = orbitCurve.getPoints(128);
      var orbitGeo3D = new THREE.BufferGeometry();
      var positions = new Float32Array(orbitPoints.length * 3);
      for (var p = 0; p < orbitPoints.length; p++) {
        positions[p * 3] = orbitPoints[p].x;
        positions[p * 3 + 1] = 0;
        positions[p * 3 + 2] = orbitPoints[p].y;
      }
      orbitGeo3D.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      var orbitLineMat = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.08
      });
      var orbitLine = new THREE.Line(orbitGeo3D, orbitLineMat);

      // Apply inclination rotation
      var axisVec = new THREE.Vector3(
        Math.cos(startAngle * 0.5),
        0,
        Math.sin(startAngle * 0.5)
      ).normalize();
      orbitLine.setRotationFromAxisAngle(axisVec, inclination);
      scene.add(orbitLine);

      landingGlobe.satellites.push({
        mesh: satMesh,
        orbitLine: orbitLine,
        orbitRadius: orbitRadius,
        inclination: inclination,
        angle: startAngle,
        speed: speed,
        axisVec: axisVec
      });
    }
  }

  function animateLandingGlobe() {
    landingGlobe.animId = requestAnimationFrame(animateLandingGlobe);

    var dt = landingGlobe.clock ? landingGlobe.clock.getDelta() : 0.016;
    var elapsed = landingGlobe.clock ? landingGlobe.clock.getElapsedTime() : 0;

    // Earth stays fixed - no rotation

    // Update satellite positions
    for (var i = 0; i < landingGlobe.satellites.length; i++) {
      var sat = landingGlobe.satellites[i];
      sat.angle += sat.speed * dt;

      // Position in orbit plane
      var x = Math.cos(sat.angle) * sat.orbitRadius;
      var z = Math.sin(sat.angle) * sat.orbitRadius;

      // Apply inclination
      var pos = new THREE.Vector3(x, 0, z);
      pos.applyAxisAngle(sat.axisVec, sat.inclination);

      sat.mesh.position.copy(pos);

      // Pulsing glow
      sat.mesh.scale.setScalar(1 + Math.sin(elapsed * 3 + i) * 0.2);
    }

    // Update glow ring to face camera
    var glowRing = landingGlobe.scene.children.find(function (c) {
      return c.geometry && c.geometry.type === "RingGeometry";
    });
    if (glowRing && landingGlobe.camera) {
      glowRing.lookAt(landingGlobe.camera.position);
      glowRing.material.opacity = 0.08 + Math.sin(elapsed * 0.8) * 0.04;
    }

    if (landingGlobe.controls) landingGlobe.controls.update();
    if (landingGlobe.renderer && landingGlobe.scene && landingGlobe.camera) {
      landingGlobe.renderer.render(landingGlobe.scene, landingGlobe.camera);
    }
  }

  // Initialize the globe when the DOM is ready
  initLandingGlobe();

  /* ---------------------------------------------------------
     API Client & State Management
     --------------------------------------------------------- */
  var API_BASE = window.location.protocol === "file:" ? "http://127.0.0.1:8000" : "";
  var WS_BASE = (window.location.protocol === "https:" ? "wss://" : "ws://") + (window.location.host || "127.0.0.1:8000");

  var state = {
    catalog: [],
    conjunctions: [],
    currentManeuvers: [],
    selectedConjId: null,
    anomalies: [],
    hotspots: [],
    alerts: [],
    auditLogs: [],
    settings: {},
    activeCatalogFilter: "ALL",
    catalogSearchQuery: "",
    activeRiskFilter: "ALL"
  };

  async function apiCall(endpoint, options) {
    try {
      var res = await fetch(API_BASE + endpoint, options);
      if (!res.ok) {
        var err = await res.json().catch(function () { return { detail: res.statusText }; });
        throw new Error(err.detail || "API Error");
      }
      return await res.json();
    } catch (e) {
      console.warn("API Call Failed [" + endpoint + "]:", e.message);
      return null;
    }
  }

  /* ---------------------------------------------------------
     WebSocket Telemetry & Alerts Connection
     --------------------------------------------------------- */
  var liveWs = null;
  function connectLiveWebSocket() {
    try {
      liveWs = new WebSocket(WS_BASE + "/ws/live");
      liveWs.onmessage = function (event) {
        try {
          var data = JSON.parse(event.data);
          if (data.type === "TELEMETRY_UPDATE" && Array.isArray(data.objects)) {
            updateLiveTelemetry(data.objects);
          }
        } catch (e) {}
      };
      liveWs.onclose = function () {
        setTimeout(connectLiveWebSocket, 3000);
      };
    } catch (e) {}
  }

  /* ---------------------------------------------------------
     3D LEO Orbital Trajectory & Debris Visualizer (Three.js)
     --------------------------------------------------------- */
  var globe3D = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    earth: null,
    orbitLines: [],
    satelliteMeshes: {},
    raycaster: null,
    mouse: null,
    initialized: false
  };

  function init3DOrbitGlobe() {
    if (globe3D.initialized || typeof THREE === "undefined") return;
    var canvas = document.getElementById("orbitGlobeCanvas");
    var container = document.getElementById("orbitGlobeContainer");
    if (!canvas || !container) return;

    var width = container.clientWidth || 800;
    var height = container.clientHeight || 380;

    globe3D.scene = new THREE.Scene();
    globe3D.scene.background = new THREE.Color(0x06080c);

    globe3D.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    globe3D.camera.position.set(22, 14, 26);

    globe3D.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    globe3D.renderer.setSize(width, height);
    globe3D.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    if (typeof THREE.OrbitControls !== "undefined") {
      globe3D.controls = new THREE.OrbitControls(globe3D.camera, canvas);
      globe3D.controls.enableDamping = true;
      globe3D.controls.dampingFactor = 0.05;
      globe3D.controls.minDistance = 10;
      globe3D.controls.maxDistance = 75;
      globe3D.controls.autoRotate = true;
      globe3D.controls.autoRotateSpeed = 0.4;
    }

    // Lighting (Sunlight + Space ambient)
    var ambient = new THREE.AmbientLight(0xffffff, 0.9);
    globe3D.scene.add(ambient);

    var sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
    sunLight.position.set(40, 20, 50);
    globe3D.scene.add(sunLight);

    var rimLight = new THREE.DirectionalLight(0x4488ff, 0.5);
    rimLight.position.set(-40, -15, -40);
    globe3D.scene.add(rimLight);

    // Texture Loader for High-Res Photorealistic Earth
    var texLoader = new THREE.TextureLoader();
    texLoader.crossOrigin = "anonymous";
    var dayTex = texLoader.load("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg");
    var bumpTex = texLoader.load("https://unpkg.com/three-globe/example/img/earth-topology.png");
    var specTex = texLoader.load("https://unpkg.com/three-globe/example/img/earth-water.png");
    var cloudTex = texLoader.load("https://unpkg.com/three-globe/example/img/earth-clouds.png");

    // Earth Sphere (Scale: 1 unit = 1000 km, Earth Radius = 6.371 units)
    var earthGeo = new THREE.SphereGeometry(6.371, 64, 64);
    var earthMat = new THREE.MeshPhongMaterial({
      map: dayTex,
      bumpMap: bumpTex,
      bumpScale: 0.05,
      specularMap: specTex,
      specular: new THREE.Color(0x335588),
      shininess: 20
    });
    globe3D.earth = new THREE.Mesh(earthGeo, earthMat);
    globe3D.scene.add(globe3D.earth);

    // Atmospheric Cloud Layer
    var cloudGeo = new THREE.SphereGeometry(6.43, 64, 64);
    var cloudMat = new THREE.MeshPhongMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending
    });
    globe3D.clouds = new THREE.Mesh(cloudGeo, cloudMat);
    globe3D.scene.add(globe3D.clouds);

    // Equatorial Ring
    var eqGeo = new THREE.RingGeometry(6.38, 6.42, 64);
    var eqMat = new THREE.MeshBasicMaterial({ color: 0x2a4a75, side: THREE.DoubleSide });
    var eqRing = new THREE.Mesh(eqGeo, eqMat);
    eqRing.rotation.x = Math.PI / 2;
    globe3D.earth.add(eqRing);

    // Raycaster for hover/click tooltips
    globe3D.raycaster = new THREE.Raycaster();
    globe3D.mouse = new THREE.Vector2();

    var tooltip = document.getElementById("orbitTooltip");
    var tipName = document.getElementById("tooltipObjName");
    var tipAlt = document.getElementById("tooltipObjAlt");

    canvas.addEventListener("mousemove", function (e) {
      var rect = canvas.getBoundingClientRect();
      globe3D.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      globe3D.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      globe3D.raycaster.setFromCamera(globe3D.mouse, globe3D.camera);
      var meshes = Object.values(globe3D.satelliteMeshes).map(function (s) { return s.mesh; });
      var intersects = globe3D.raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        var hit = intersects[0].object;
        var info = hit.userData;
        if (info && tooltip) {
          tooltip.style.display = "block";
          if (tipName) tipName.textContent = info.name || "Satellite";
          if (tipAlt) tipAlt.textContent = "Type: " + (info.type || "LEO") + " | Alt: " + (info.alt || "500") + " km | Speed: " + (info.speed || "7.6") + " km/s";
        }
      } else {
        if (tooltip) tooltip.style.display = "none";
      }
    });

    canvas.addEventListener("click", function () {
      globe3D.raycaster.setFromCamera(globe3D.mouse, globe3D.camera);
      var meshes = Object.values(globe3D.satelliteMeshes).map(function (s) { return s.mesh; });
      var intersects = globe3D.raycaster.intersectObjects(meshes);
      if (intersects.length > 0) {
        var hit = intersects[0].object;
        if (hit.userData && hit.userData.norad_id) {
          window.inspectObject(hit.userData.norad_id);
        }
      }
    });

    var resetBtn = document.getElementById("reset3DCameraBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        globe3D.camera.position.set(22, 14, 26);
        if (globe3D.controls) globe3D.controls.target.set(0, 0, 0);
      });
    }

    window.addEventListener("resize", function () {
      if (!container || !globe3D.renderer || !globe3D.camera) return;
      var w = container.clientWidth;
      var h = container.clientHeight || 380;
      globe3D.camera.aspect = w / h;
      globe3D.camera.updateProjectionMatrix();
      globe3D.renderer.setSize(w, h);
    });

    function animate() {
      requestAnimationFrame(animate);
      if (globe3D.earth) {
        globe3D.earth.rotation.y += 0.0006;
      }
      if (globe3D.clouds) {
        globe3D.clouds.rotation.y += 0.0009;
      }
      if (globe3D.controls) globe3D.controls.update();
      globe3D.renderer.render(globe3D.scene, globe3D.camera);
    }
    animate();

    globe3D.initialized = true;
    update3DOrbitsFromCatalog();
  }

  function update3DOrbitsFromCatalog() {
    if (!globe3D.initialized || !state.catalog.length) return;

    // Clear old orbit lines
    globe3D.orbitLines.forEach(function (l) { globe3D.scene.remove(l); });
    globe3D.orbitLines = [];

    state.catalog.forEach(function (sat) {
      var norad = sat.norad_id;
      var isDebris = sat.type === "DEBRIS";
      var isRB = sat.type === "ROCKET BODY";
      var colorHex = isDebris ? 0xff7b72 : (isRB ? 0xf2cc60 : 0x56d364);

      // Generate 3D Keplerian Orbit Path (64 points)
      var incRad = (sat.live_state && sat.live_state.keplerian ? sat.live_state.keplerian.inclination_deg : 51.6) * (Math.PI / 180);
      var altKm = (sat.live_state && sat.live_state.altitude_km ? sat.live_state.altitude_km : 500);
      var rUnits = (6371 + altKm) / 1000.0;

      var curvePoints = [];
      for (var i = 0; i <= 64; i++) {
        var theta = (i / 64) * Math.PI * 2;
        var x = rUnits * Math.cos(theta);
        var y = rUnits * Math.sin(theta) * Math.sin(incRad);
        var z = rUnits * Math.sin(theta) * Math.cos(incRad);
        curvePoints.push(new THREE.Vector3(x, y, z));
      }

      var lineGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
      var lineMat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.38 });
      var line = new THREE.Line(lineGeo, lineMat);
      globe3D.scene.add(line);
      globe3D.orbitLines.push(line);

      // Create Satellite Node Marker
      if (!globe3D.satelliteMeshes[norad]) {
        var nodeGeo = new THREE.SphereGeometry(isDebris ? 0.22 : 0.32, 12, 12);
        var nodeMat = new THREE.MeshBasicMaterial({ color: colorHex });
        var nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
        nodeMesh.userData = {
          norad_id: norad,
          name: sat.name,
          type: sat.type,
          alt: altKm.toFixed(1),
          speed: (sat.live_state && sat.live_state.velocity ? sat.live_state.velocity.magnitude_km_s.toFixed(2) : "7.66")
        };
        globe3D.scene.add(nodeMesh);
        globe3D.satelliteMeshes[norad] = { mesh: nodeMesh, radius: rUnits, inc: incRad, phase: Math.random() * Math.PI * 2 };
      }
    });
  }

  function update3DLivePositions(liveObjects) {
    if (!globe3D.initialized) return;

    liveObjects.forEach(function (obj) {
      var norad = obj.norad_id;
      var node = globe3D.satelliteMeshes[norad];
      if (node && obj.position_eci) {
        // Direct conversion from SGP4 ECI Cartesian (km -> units)
        node.mesh.position.set(
          obj.position_eci.x / 1000.0,
          obj.position_eci.z / 1000.0,
          -obj.position_eci.y / 1000.0
        );
        node.mesh.userData.alt = (obj.altitude_km || 500).toFixed(1);
        node.mesh.userData.speed = (obj.velocity_eci && obj.velocity_eci.magnitude_km_s ? obj.velocity_eci.magnitude_km_s.toFixed(2) : "7.66");
      }
    });
  }

  function updateLiveTelemetry(liveObjects) {
    var tbody = document.getElementById("dashTelemetryBody");
    if (liveObjects.length) {
      update3DLivePositions(liveObjects);
    }
    if (!tbody || !liveObjects.length) return;

    var rows = liveObjects.slice(0, 6).map(function (obj) {
      var speed = obj.velocity_eci && obj.velocity_eci.magnitude_km_s ? obj.velocity_eci.magnitude_km_s.toFixed(2) : "7.66";
      var alt = obj.altitude_km ? obj.altitude_km.toFixed(1) : "--";
      var typeClass = obj.type === "DEBRIS" ? "text-ruby" : (obj.type === "PAYLOAD" ? "text-emerald" : "text-amber");
      return (
        "<tr>" +
        "<td><strong>" + obj.name + "</strong></td>" +
        "<td><span class='" + typeClass + "'>" + obj.type + "</span></td>" +
        "<td>" + alt + " km</td>" +
        "<td>" + speed + " km/s</td>" +
        "<td><span class='badge-risk LOW'>NOMINAL</span></td>" +
        "</tr>"
      );
    }).join("");

    tbody.innerHTML = rows;
  }

  /* ---------------------------------------------------------
     Dashboard View Controller
     --------------------------------------------------------- */
  async function loadDashboardData() {
    var health = await apiCall("/api/health");
    if (health) {
      var hb = document.getElementById("systemHealthText");
      if (hb) hb.textContent = health.orbital_engine ? "SGP4 Core Online" : "System Active";
    }

    var catalog = await apiCall("/api/catalog");
    if (catalog) {
      var trackedStat = document.getElementById("trackedObjectsLandingStat");
      if (trackedStat) {
        // Convert to 'K' format if over 1000
        var val = catalog.length;
        if (val > 1000) {
          trackedStat.setAttribute("data-target", (val / 1000).toFixed(1));
          trackedStat.setAttribute("data-suffix", "K");
          trackedStat.setAttribute("data-decimals", "1");
        } else {
          trackedStat.setAttribute("data-target", val);
          trackedStat.setAttribute("data-suffix", "");
          trackedStat.setAttribute("data-decimals", "0");
        }
        
        // Retrigger the count-up specifically for this element if it was already counted
        if (trackedStat.dataset.counted === "1") {
          trackedStat.dataset.counted = "0";
          countUp(trackedStat, 3);
        }
      }
    }

    var conjs = await apiCall("/api/conjunctions");
    if (conjs) {
      state.conjunctions = conjs;
      var elCount = document.getElementById("dashActiveConjs");
      if (elCount) elCount.textContent = conjs.length;

      var listEl = document.getElementById("dashConjunctionsList");
      if (listEl) {
        if (!conjs.length) {
          listEl.innerHTML = "<div class='loading-state'>No high-risk conjunctions detected.</div>";
        } else {
          listEl.innerHTML = conjs.map(function (c) {
            var tcaFormatted = new Date(c.tca).toUTCString().replace("GMT", "UTC");
            return (
              "<div class='conjunction-item-quick'>" +
              "<div class='item-top-row'>" +
              "<span>" + c.primary_object.name + " <span class='conj-vs-badge'>vs</span> " + c.secondary_object.name + "</span>" +
              "<span class='badge-risk " + c.risk_level + "'>" + c.risk_level + "</span>" +
              "</div>" +
              "<div class='item-desc'>Miss: <strong>" + c.miss_distance_km + " km</strong> | Rel Speed: " + c.relative_velocity_km_s + " km/s | Pc = " + c.probability_of_collision.toExponential(2) + "</div>" +
              "<div class='item-meta-row'>" +
              "<span>TCA: " + tcaFormatted + "</span>" +
              "<a href='#maneuvers' data-nav='maneuvers' class='card-action' onclick='window.selectConjunctionForManeuver(\"" + c.id + "\")'>Plan Burn &rarr;</a>" +
              "</div>" +
              "</div>"
            );
          }).join("");
        }
      }
    }

    var anoms = await apiCall("/api/predictive/anomalies");
    if (anoms) {
      state.anomalies = anoms;
      var anomEl = document.getElementById("dashAnomaliesList");
      if (anomEl) {
        anomEl.innerHTML = anoms.map(function (a) {
          return (
            "<div class='anomaly-item'>" +
            "<div class='item-top-row'>" +
            "<span>" + a.object_name + "</span>" +
            "<span class='badge-risk " + a.severity + "'>" + a.type.replace(/_/g, " ") + "</span>" +
            "</div>" +
            "<div class='item-desc'>" + a.description + "</div>" +
            "<div class='item-meta-row'><span>Rec: " + a.recommended_action + "</span></div>" +
            "</div>"
          );
        }).join("");
      }
    }

    var hm = await apiCall("/api/predictive/heatmap");
    if (hm && hm.hotspot_regions) {
      var hsEl = document.getElementById("dashHotspotsList");
      if (hsEl) {
        hsEl.innerHTML = hm.hotspot_regions.map(function (h) {
          return (
            "<div class='hotspot-item'>" +
            "<div class='item-top-row'>" +
            "<span>" + h.regime + "</span>" +
            "<span class='badge-risk " + h.risk + "'>" + h.risk + "</span>" +
            "</div>" +
            "<div class='item-desc'>Threat Source: " + h.primary_source + "</div>" +
            "</div>"
          );
        }).join("");
      }
    }

    var sw = await apiCall("/api/spaceweather/flux");
    if (sw && sw.current) {
      var fluxEl = document.getElementById("dashSolarFlux");
      var fluxMeta = document.getElementById("dashSolarMeta");
      var swBody = document.getElementById("dashSpaceWeatherBody");

      if (fluxEl) fluxEl.textContent = sw.current.flux_sfu + " sfu";
      if (fluxMeta) fluxMeta.textContent = sw.current.activity_level.replace(/_/g, " ") + " • " + sw.current.atmospheric_density_impact;

      if (swBody) {
        var sparklineHtml = "";
        if (sw.history_30day && sw.history_30day.length) {
          var maxF = Math.max.apply(null, sw.history_30day.map(function (x) { return x.flux; })) || 150;
          sparklineHtml = (
            "<div style='margin-top:14px;'>" +
            "<div style='font-size:11.5px; color:var(--text-muted); margin-bottom:6px; font-weight:600;'>30-Day F10.7 Solar Flux Trend:</div>" +
            "<div style='display:flex; align-items:flex-end; gap:2px; height:50px; background:var(--surface-2); border:1px solid var(--surface-border); padding:6px; border-radius:8px;'>" +
            sw.history_30day.map(function (d) {
              var pct = Math.max(15, (d.flux / maxF) * 100);
              return "<div title='" + d.time_tag + ": " + d.flux + " sfu' style='flex:1; min-width:4px; height:" + pct + "%; background:var(--amber); border-radius:1px;'></div>";
            }).join("") +
            "</div>" +
            "</div>"
          );
        }

        swBody.innerHTML = (
          "<div style='display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;'>" +
          "<div><span style='font-size:22px; font-weight:700; color:var(--amber);'>" + sw.current.flux_sfu + " sfu</span> <small class='text-muted'>(10.7 cm radio flux)</small></div>" +
          "<span class='badge-risk " + sw.current.severity + "'>" + sw.current.activity_level.replace(/_/g, " ") + "</span>" +
          "</div>" +
          "<div style='font-size:12.5px; color:var(--text-secondary); line-height:1.5;'>" +
          "<strong>Thermospheric Drag Scaling:</strong> " + sw.current.thermospheric_drag_multiplier + "x (" + sw.current.atmospheric_density_impact + ")<br>" +
          "<strong>Solar Cycle Phase:</strong> " + sw.current.solar_cycle_phase + "<br>" +
          "<strong>Data Source:</strong> " + sw.current.source + " (Live Observation)" +
          "</div>" +
          sparklineHtml
        );
      }
    }
  }

  /* ---------------------------------------------------------
     Catalog View Controller
     --------------------------------------------------------- */
  async function loadCatalogData() {
    var query = state.catalogSearchQuery ? "?query=" + encodeURIComponent(state.catalogSearchQuery) : "";
    var catalog = await apiCall("/api/catalog" + query);
    if (!catalog) return;
    state.catalog = catalog;

    var tbody = document.getElementById("catalogTableBody");
    if (!tbody) return;

    var tabAll = document.querySelector("#catalogFilterTabs [data-filter='ALL']");
    if (tabAll) tabAll.textContent = "All Objects (" + catalog.length + ")";
    var trackCount = document.getElementById("dashTrackedCount");
    if (trackCount) trackCount.textContent = catalog.length;

    var filtered = catalog.filter(function (obj) {
      if (state.activeCatalogFilter === "ALL") return true;
      return obj.type === state.activeCatalogFilter;
    });

    if (!filtered.length) {
      tbody.innerHTML = "<tr><td colspan='9' class='loading-state'>No matching objects found.</td></tr>";
      return;
    }

    tbody.innerHTML = filtered.map(function (obj) {
      var alt = obj.live_state ? obj.live_state.altitude_km.toFixed(1) + " km" : "--";
      var speed = obj.live_state ? obj.live_state.velocity.magnitude_km_s.toFixed(2) + " km/s" : "--";
      var inc = obj.live_state && obj.live_state.keplerian ? obj.live_state.keplerian.inclination_deg + "°" : "--";
      var prop = obj.is_maneuverable ? "<span class='text-emerald'>Active (" + (obj.fuel_remaining_kg || 0).toFixed(0) + " kg)</span>" : "<span class='text-muted'>None (Passive)</span>";
      var typeClass = obj.type === "DEBRIS" ? "text-ruby" : (obj.type === "PAYLOAD" ? "text-emerald" : "text-amber");

      return (
        "<tr>" +
        "<td><code>" + obj.norad_id + "</code></td>" +
        "<td><strong>" + obj.name + "</strong><br><small class='text-muted'>" + (obj.country || "") + " • " + (obj.intl_desig || "") + "</small></td>" +
        "<td><span class='" + typeClass + "'>" + obj.type + "</span></td>" +
        "<td>" + alt + "</td>" +
        "<td>" + speed + "</td>" +
        "<td>" + inc + "</td>" +
        "<td>" + obj.rcs_size + " (" + (obj.hard_body_radius_m || 1) + "m)</td>" +
        "<td>" + prop + "</td>" +
        "<td><button class='btn-secondary btn-sm' onclick='window.inspectObject(\"" + obj.norad_id + "\")'><i class='fa-solid fa-satellite'></i> Inspect</button></td>" +
        "</tr>"
      );
    }).join("");
  }

  window.inspectObject = async function (noradId) {
    var obj = await apiCall("/api/objects/" + noradId);
    if (!obj) return;

    var modal = document.getElementById("objectModalOverlay");
    var title = document.getElementById("modalObjName");
    var sub = document.getElementById("modalObjNorad");
    var body = document.getElementById("modalObjBody");

    if (title) title.textContent = obj.name;
    if (sub) sub.textContent = "NORAD ID: " + obj.norad_id + " • International Designator: " + (obj.intl_desig || "--");
    if (body) {
      var st = obj.live_state || {};
      var kep = st.keplerian || {};
      var pos = st.position || {};
      var vel = st.velocity || {};

      body.innerHTML = (
        "<div class='metrics-grid mb-16'>" +
        "<div class='metric-card'><span class='metric-label'>Altitude</span><span class='metric-value'>" + (st.altitude_km ? st.altitude_km.toFixed(1) : "--") + " km</span></div>" +
        "<div class='metric-card'><span class='metric-label'>Velocity</span><span class='metric-value'>" + (vel.magnitude_km_s ? vel.magnitude_km_s.toFixed(2) : "--") + " km/s</span></div>" +
        "<div class='metric-card'><span class='metric-label'>Period</span><span class='metric-value'>" + (kep.period_minutes || "--") + " min</span></div>" +
        "<div class='metric-card'><span class='metric-label'>Inclination</span><span class='metric-value'>" + (kep.inclination_deg || "--") + "°</span></div>" +
        "</div>" +
        "<h4 style='margin:0 0 8px; font-size:13px; color:#ffffff;'>ECI Cartesian State Vector:</h4>" +
        "<div style='background:var(--surface-2); border:1px solid var(--surface-border); padding:14px; border-radius:10px; font-family:monospace; font-size:12px; margin-bottom:16px; color:#f0f6fc; line-height:1.6;'>" +
        "Position (km): X=" + (pos.x ? pos.x.toFixed(2) : "--") + ", Y=" + (pos.y ? pos.y.toFixed(2) : "--") + ", Z=" + (pos.z ? pos.z.toFixed(2) : "--") + "<br>" +
        "Velocity (km/s): Vx=" + (vel.vx ? vel.vx.toFixed(3) : "--") + ", Vy=" + (vel.vy ? vel.vy.toFixed(3) : "--") + ", Vz=" + (vel.vz ? vel.vz.toFixed(3) : "--") +
        "</div>" +
        "<h4 style='margin:0 0 8px; font-size:13px; color:#ffffff;'>NORAD Two-Line Element (TLE) Set:</h4>" +
        "<div style='background:var(--surface-2); border:1px solid var(--surface-border); padding:14px; border-radius:10px; font-family:monospace; font-size:12px; word-break:break-all; color:#79c0ff; line-height:1.6;'>" +
        obj.tle_line1 + "<br>" + obj.tle_line2 +
        "</div>"
      );
    }

    if (modal) modal.hidden = false;
  };

  /* ---------------------------------------------------------
     Conjunctions View Controller
     --------------------------------------------------------- */
  async function loadConjunctionsData() {
    var risk = state.activeRiskFilter === "ALL" ? "" : "?risk_threshold=" + state.activeRiskFilter;
    var conjs = await apiCall("/api/conjunctions" + risk);
    if (!conjs) return;

    var container = document.getElementById("conjunctionCardsList");
    if (!container) return;

    if (!conjs.length) {
      container.innerHTML = "<div class='loading-state'>No conjunction events match current filter.</div>";
      return;
    }

    container.innerHTML = conjs.map(function (c) {
      var tcaDate = new Date(c.tca);
      var tcaFormatted = tcaDate.toUTCString().replace("GMT", "UTC");
      var rel = c.relative_vector_km || {};

      return (
        "<div class='conjunction-card'>" +
        "<div class='conj-header'>" +
        "<div class='conj-objects-pair'>" +
        "<span class='text-white'><i class='fa-solid fa-satellite text-emerald'></i> " + c.primary_object.name + "</span>" +
        "<span class='conj-vs-badge'>CONJUNCTION WITH</span>" +
        "<span class='text-ruby'><i class='fa-solid fa-meteor'></i> " + c.secondary_object.name + "</span>" +
        "</div>" +
        "<span class='badge-risk " + c.risk_level + "'>" + c.risk_level + " RISK</span>" +
        "</div>" +
        "<div class='conj-metrics-row'>" +
        "<div class='conj-metric-item'><span class='conj-metric-label'>Miss Distance</span><span class='conj-metric-value text-ruby'>" + c.miss_distance_km + " km</span></div>" +
        "<div class='conj-metric-item'><span class='conj-metric-label'>Collision Prob (Pc)</span><span class='conj-metric-value text-amber'>" + c.probability_of_collision.toExponential(2) + "</span></div>" +
        "<div class='conj-metric-item'><span class='conj-metric-label'>Relative Speed</span><span class='conj-metric-value'>" + c.relative_velocity_km_s + " km/s</span></div>" +
        "<div class='conj-metric-item'><span class='conj-metric-label'>Hard-Body Radius</span><span class='conj-metric-value'>" + (c.combined_hard_body_radius_m || 10) + " m</span></div>" +
        "</div>" +
        "<div style='display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;'>" +
        "<span style='font-size:12.5px; color:var(--text-secondary);'><strong>TCA Epoch:</strong> " + tcaFormatted + " (In-track offset: " + (rel.in_track_km || "--") + " km)</span>" +
        "<a href='#maneuvers' data-nav='maneuvers' class='btn-primary btn-sm' onclick='window.selectConjunctionForManeuver(\"" + c.id + "\")'><i class='fa-solid fa-rocket'></i> Evasive Maneuver Options &rarr;</a>" +
        "</div>" +
        "</div>"
      );
    }).join("");
  }

  /* ---------------------------------------------------------
     Maneuvers View Controller
     --------------------------------------------------------- */
  window.selectConjunctionForManeuver = function (conjId) {
    state.selectedConjId = conjId;
    var sel = document.getElementById("maneuverConjSelect");
    if (sel) sel.value = conjId;
    loadManeuversData(conjId);
  };

  async function loadManeuversData(targetConjId) {
    var conjs = await apiCall("/api/conjunctions");
    if (!conjs || !conjs.length) return;

    var sel = document.getElementById("maneuverConjSelect");
    if (sel) {
      sel.innerHTML = conjs.map(function (c) {
        return "<option value='" + c.id + "'>" + c.primary_object.name + " vs " + c.secondary_object.name + " (" + c.risk_level + ")</option>";
      }).join("");

      if (targetConjId) {
        sel.value = targetConjId;
      }
    }

    var activeId = targetConjId || (sel ? sel.value : conjs[0].id);
    var conj = conjs.find(function (c) { return c.id === activeId; }) || conjs[0];

    // Populate context banner
    var pName = document.getElementById("mnvPrimaryName");
    var sName = document.getElementById("mnvSecondaryName");
    var fuelMeta = document.getElementById("mnvFuelMeta");
    var missDist = document.getElementById("mnvMissDist");
    var pcMeta = document.getElementById("mnvPc");
    var tcaMeta = document.getElementById("mnvTca");
    var relVel = document.getElementById("mnvRelVel");

    if (pName) pName.textContent = conj.primary_object.name;
    if (sName) sName.textContent = conj.secondary_object.name;
    if (fuelMeta) fuelMeta.textContent = "Fuel Remaining: " + (conj.primary_object.fuel_remaining_kg || 0) + " kg | Isp: " + (conj.primary_object.isp_s || 300) + " s";
    if (missDist) missDist.textContent = conj.miss_distance_km + " km";
    if (pcMeta) pcMeta.textContent = "Unmitigated Pc = " + conj.probability_of_collision.toExponential(2) + " (" + conj.risk_level + ")";
    if (tcaMeta) tcaMeta.textContent = "TCA: " + new Date(conj.tca).toLocaleTimeString();
    if (relVel) relVel.textContent = "Relative Speed: " + conj.relative_velocity_km_s + " km/s";

    // Fetch maneuver recommendations
    var mnvRes = await apiCall("/api/conjunctions/" + conj.id + "/maneuvers");
    var grid = document.getElementById("maneuverPlansGrid");
    if (!grid) return;

    if (!mnvRes || !mnvRes.maneuvers || !mnvRes.maneuvers.length) {
      grid.innerHTML = "<div class='loading-state'>Primary spacecraft is non-maneuverable (passive object). Evasive impulse cannot be executed.</div>";
      return;
    }

    grid.innerHTML = mnvRes.maneuvers.map(function (m) {
      var isRecClass = m.is_recommended ? "is-recommended" : "";
      var badge = m.is_recommended ? "<span class='maneuver-badge-rec'>Recommended</span>" : "";
      var isScheduled = m.status === "ACCEPTED_SCHEDULED";
      var btnText = isScheduled ? "<i class='fa-solid fa-check'></i> Maneuver Scheduled" : "<i class='fa-solid fa-rocket'></i> Authorize & Queue Burn";
      var btnClass = isScheduled ? "btn-secondary w-100" : "btn-primary w-100";

      return (
        "<div class='maneuver-card " + isRecClass + "'>" +
        "<div>" +
        badge +
        "<h4 class='maneuver-title'>" + m.name + "</h4>" +
        "<p class='maneuver-desc'>" + m.description + "</p>" +
        "</div>" +
        "<div class='maneuver-specs'>" +
        "<div class='spec-row'><span>Delta-V Required:</span><span class='spec-val text-cyan'>" + m.delta_v.total_magnitude_m_s.toFixed(2) + " m/s</span></div>" +
        "<div class='spec-row'><span>Propellant Cost:</span><span class='spec-val'>" + m.fuel_consumption_kg.toFixed(2) + " kg (" + m.fuel_cost_percentage + "%)</span></div>" +
        "<div class='spec-row'><span>Lead Time:</span><span class='spec-val'>" + m.lead_time_minutes + " min prior</span></div>" +
        "<div class='spec-row'><span>Post-Burn Miss Distance:</span><span class='spec-val text-emerald'>" + m.post_maneuver_miss_distance_km + " km</span></div>" +
        "<div class='spec-row'><span>Post-Burn Pc:</span><span class='spec-val text-emerald'>" + m.post_maneuver_pc.toExponential(1) + "</span></div>" +
        "</div>" +
        "<button class='" + btnClass + "' " + (isScheduled ? "disabled" : "") + " onclick='window.authorizeManeuver(\"" + conj.id + "\", \"" + m.id + "\")'>" +
        btnText +
        "</button>" +
        "</div>"
      );
    }).join("");
  }

  window.authorizeManeuver = async function (conjId, mnvId) {
    var res = await apiCall("/api/conjunctions/" + conjId + "/maneuvers/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maneuver_id: mnvId, operator_notes: "Authorized via Aegis Mission Control console" })
    });

    if (res && res.status === "SUCCESS") {
      alert("Maneuver successfully authorized and queued in Flight Dynamics system!\n\nDigital Auth Signature:\n" + (res.execution_record.authorization_hash || ""));
      loadManeuversData(conjId);
      loadDashboardData();
    }
  };

  /* ---------------------------------------------------------
     Calculator View Controller
     --------------------------------------------------------- */
  function setupCalculator() {
    var form = document.getElementById("calcForm");
    if (!form) return;

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var obj1 = document.getElementById("calcObj1").value;
      var obj2 = document.getElementById("calcObj2").value;
      var missDist = parseFloat(document.getElementById("calcMissDist").value) || 0.5;
      var radius = parseFloat(document.getElementById("calcRadius").value) || 10.0;
      var method = document.getElementById("calcMethod").value;
      var samples = parseInt(document.getElementById("calcSamples").value, 10) || 10000;
      var sx = parseFloat(document.getElementById("calcSigmaX").value) || 200.0;
      var sy = parseFloat(document.getElementById("calcSigmaY").value) || 100.0;

      var payload = {
        miss_distance_km: missDist,
        combined_radius_m: radius,
        method: method,
        monte_carlo_samples: samples,
        sigma_x_m: sx,
        sigma_y_m: sy
      };

      if (obj1 !== "CUSTOM" && obj2 !== "CUSTOM") {
        payload.object1_id = obj1;
        payload.object2_id = obj2;
      }

      var resContainer = document.getElementById("calcResults");
      if (resContainer) {
        resContainer.innerHTML = "<div class='loading-state'><i class='fa-solid fa-spinner fa-spin'></i> Computing encounter integral...</div>";
      }

      var res = await apiCall("/api/calculator/probability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res || !resContainer) return;

      var pc = res.probability_of_collision;
      var riskLevel = pc > 1e-4 ? "CRITICAL" : (pc > 1e-5 ? "HIGH" : (pc > 1e-6 ? "MEDIUM" : "LOW"));
      var colorClass = pc > 1e-4 ? "text-ruby" : (pc > 1e-5 ? "text-amber" : "text-emerald");

      var histogramHtml = "";
      if (res.details && res.details.distance_histogram) {
        histogramHtml = (
          "<h4 style='margin:16px 0 8px; font-size:13px; color:#ffffff;'>Monte Carlo Distance Distribution:</h4>" +
          "<div style='display:flex; align-items:flex-end; gap:3px; height:80px; background:var(--surface-2); border:1px solid var(--surface-border); padding:10px; border-radius:10px; overflow-x:auto;'>" +
          res.details.distance_histogram.map(function (b) {
            var maxCount = Math.max.apply(null, res.details.distance_histogram.map(function (x) { return x.count; })) || 1;
            var hPct = Math.max(8, (b.count / maxCount) * 100);
            return "<div title='" + b.bin_start_km + "-" + b.bin_end_km + " km: " + b.count + " hits' style='flex:1; min-width:8px; height:" + hPct + "%; background:var(--cyan); border-radius:2px;'></div>";
          }).join("") +
          "</div>"
        );
      }

      resContainer.innerHTML = (
        "<div style='display:flex; flex-direction:column; gap:14px;'>" +
        "<div class='metrics-grid'>" +
        "<div class='metric-card'><span class='metric-label'>Collision Prob (Pc)</span><span class='metric-value " + colorClass + "'>" + pc.toExponential(3) + "</span><span class='metric-meta'>Risk Rating: <strong>" + riskLevel + "</strong></span></div>" +
        "<div class='metric-card'><span class='metric-label'>Nominal Miss Distance</span><span class='metric-value'>" + res.miss_distance_km.toFixed(3) + " km</span><span class='metric-meta'>Collision Envelope: " + res.combined_hard_body_radius_m + " m</span></div>" +
        "</div>" +
        "<div style='background:var(--surface-2); border:1px solid var(--surface-border); border-radius:12px; padding:14px; font-size:13px; line-height:1.5; color:var(--text-secondary);'>" +
        "<strong>Algorithm Applied:</strong> " + res.method.replace(/_/g, " ") + "<br>" +
        "<strong>Safety Threshold:</strong> Recommended operational threshold is Pc &lt; 1.00e-4.<br>" +
        "<strong>Assessment:</strong> " + (pc > 1e-4 ? "Immediate evasive burn required to achieve clearance &gt; 15 km." : "Collision risk within acceptable bounds. Continue passive tracking.") +
        "</div>" +
        histogramHtml +
        "</div>"
      );
    });
  }

  /* ---------------------------------------------------------
     Reports & Audit View Controller
     --------------------------------------------------------- */
  async function loadReportsData() {
    var auditLogs = await apiCall("/api/audit");
    if (auditLogs) {
      state.auditLogs = auditLogs;
      var tbody = document.getElementById("auditTableBody");
      if (tbody) {
        tbody.innerHTML = auditLogs.map(function (log) {
          return (
            "<tr>" +
            "<td><code>" + new Date(log.timestamp).toUTCString().replace("GMT", "UTC") + "</code></td>" +
            "<td>" + log.user + "</td>" +
            "<td><span class='badge-tag'>" + log.action + "</span></td>" +
            "<td>" + log.details + "</td>" +
            "</tr>"
          );
        }).join("");
      }
    }

    var csvBtn = document.getElementById("exportCsvBtn");
    if (csvBtn) {
      csvBtn.onclick = async function () {
        var res = await fetch(API_BASE + "/api/reports/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format: "csv" })
        });
        var text = await res.text();
        var blob = new Blob([text], { type: "text/csv" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "Aegis_Conjunction_Report.csv";
        a.click();
      };
    }

    var jsonBtn = document.getElementById("exportJsonBtn");
    if (jsonBtn) {
      jsonBtn.onclick = async function () {
        var res = await apiCall("/api/reports/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format: "json" })
        });
        if (!res) return;
        var blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "Aegis_Mission_Report_Signed.json";
        a.click();
      };
    }
  }

  /* ---------------------------------------------------------
     Alerts Drawer Controller
     --------------------------------------------------------- */
  async function loadAlertsDrawer() {
    var alerts = await apiCall("/api/alerts");
    if (!alerts) return;
    state.alerts = alerts;

    var listEl = document.getElementById("alertsDrawerList");
    if (!listEl) return;

    if (!alerts.length) {
      listEl.innerHTML = "<div class='loading-state'>No active alerts.</div>";
      return;
    }

    listEl.innerHTML = alerts.map(function (a) {
      var unread = a.is_read ? "" : "is-unread";
      return (
        "<div class='alert-item-card " + unread + "'>" +
        "<div style='display:flex; justify-content:space-between; align-items:center;'>" +
        "<span class='badge-risk " + a.severity + "'>" + a.severity + "</span>" +
        "<small style='color:var(--text-muted);'>" + new Date(a.created_at).toLocaleTimeString() + "</small>" +
        "</div>" +
        "<h4 class='alert-title'>" + a.title + "</h4>" +
        "<p class='alert-msg'>" + a.message + "</p>" +
        (!a.acknowledged ? "<button class='text-btn' style='align-self:flex-start;' onclick='window.ackAlert(\"" + a.id + "\")'>Acknowledge &rarr;</button>" : "") +
        "</div>"
      );
    }).join("");
  }

  window.ackAlert = async function (alertId) {
    await apiCall("/api/alerts/" + alertId + "/ack", { method: "POST" });
    loadAlertsDrawer();
  };

  function setupAlertsDrawerListeners() {
    var btn = document.getElementById("alertsBtn");
    var drawer = document.getElementById("alertsDrawer");
    var overlay = document.getElementById("alertsDrawerOverlay");
    var closeBtn = document.getElementById("closeAlertsDrawerBtn");
    var clearBtn = document.getElementById("clearAlertsBtn");

    function openAlerts() {
      if (drawer && overlay) {
        drawer.hidden = false;
        overlay.hidden = false;
        loadAlertsDrawer();
      }
    }

    function closeAlerts() {
      if (drawer && overlay) {
        drawer.hidden = true;
        overlay.hidden = true;
      }
    }

    if (btn) btn.addEventListener("click", openAlerts);
    if (overlay) overlay.addEventListener("click", closeAlerts);
    if (closeBtn) closeBtn.addEventListener("click", closeAlerts);
    if (clearBtn) {
      clearBtn.addEventListener("click", async function () {
        await apiCall("/api/alerts/clear", { method: "POST" });
        loadAlertsDrawer();
      });
    }

    var objOverlay = document.getElementById("objectModalOverlay");
    var objCloseBtn = document.getElementById("closeObjectModalBtn");
    if (objOverlay) {
      objOverlay.addEventListener("click", function (e) {
        if (e.target === objOverlay) objOverlay.hidden = true;
      });
    }
    if (objCloseBtn) {
      objCloseBtn.addEventListener("click", function () {
        if (objOverlay) objOverlay.hidden = true;
      });
    }
  }

  /* ---------------------------------------------------------
     Catalog and Filter Listeners
     --------------------------------------------------------- */
  function setupFilterListeners() {
    var tabs = document.querySelectorAll("#catalogFilterTabs .filter-pill");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) { t.classList.remove("is-active"); });
        tab.classList.add("is-active");
        state.activeCatalogFilter = tab.getAttribute("data-filter") || "ALL";
        loadCatalogData();
      });
    });

    var searchInput = document.getElementById("catalogSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", function (e) {
        state.catalogSearchQuery = e.target.value;
        loadCatalogData();
      });
    }

    var syncBtn = document.getElementById("syncCatalogBtn");
    if (syncBtn) {
      syncBtn.addEventListener("click", async function () {
        var icon = syncBtn.querySelector("i");
        if (icon) icon.classList.add("fa-spin");
        syncBtn.disabled = true;

        try {
          var celestrakRes = await fetch("https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json");
          var textRes = await celestrakRes.text();
          
          // CelesTrak returns a plaintext string if data hasn't updated in the last 2 hours.
          if (textRes.startsWith("GP data")) {
            alert("CelesTrak Live Feed: " + textRes + "\n\n(Your catalog is already running on the latest available real-time orbital data!)");
            if (icon) icon.classList.remove("fa-spin");
            syncBtn.disabled = false;
            return;
          }
          
          var data = JSON.parse(textRes);
          var res = await apiCall("/api/catalog/sync_direct", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
          });
          if (res && res.status === "SUCCESS") {
            alert("Successfully synchronized " + res.synced_records + " live satellites from CelesTrak / OrbitWatch feeds!\nTotal Catalog Database: " + res.total_catalog_size + " objects.");
          } else {
            alert("Catalog synchronized with cached tracking feeds.");
          }
        } catch (e) {
          alert("Failed to reach CelesTrak live feed: " + e.message);
        }

        if (icon) icon.classList.remove("fa-spin");
        syncBtn.disabled = false;
        loadCatalogData();
        loadDashboardData();
      });
    }

    var riskTabs = document.querySelectorAll("#conjunctionRiskFilter .filter-pill");
    riskTabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        riskTabs.forEach(function (t) { t.classList.remove("is-active"); });
        tab.classList.add("is-active");
        state.activeRiskFilter = tab.getAttribute("data-risk") || "ALL";
        loadConjunctionsData();
      });
    });

    var selMnv = document.getElementById("maneuverConjSelect");
    if (selMnv) {
      selMnv.addEventListener("change", function () {
        loadManeuversData(selMnv.value);
      });
    }

    var saveSettingsBtn = document.getElementById("saveSettingsBtn");
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener("click", async function () {
        var critMiss = parseFloat(document.getElementById("settingCriticalMiss").value) || 1.0;
        var warnMiss = parseFloat(document.getElementById("settingWarningMiss").value) || 5.0;
        var critPc = parseFloat(document.getElementById("settingCriticalPc").value) || 1e-4;
        var webhook = document.getElementById("settingWebhook").value;
        var overwatch = document.getElementById("settingOverwatch").checked;
        var autoMnv = document.getElementById("settingAutoManeuver").checked;

        var res = await apiCall("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            miss_distance_critical_km: critMiss,
            miss_distance_warning_km: warnMiss,
            probability_critical_threshold: critPc,
            webhook_url: webhook,
            autonomous_overwatch_enabled: overwatch,
            auto_maneuver_recommendation: autoMnv
          })
        });

        if (res) {
          alert("System Configuration successfully saved and applied across all screening engines!");
        }
      });
    }
  }

  /* ---------------------------------------------------------
     SPA View Switching
     --------------------------------------------------------- */
  var allViews = Array.prototype.slice.call(document.querySelectorAll(".view"));
  var desktopLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-pill .nav-link"));
  var mobileLinks = Array.prototype.slice.call(document.querySelectorAll(".mobile-nav .m-link"));

  /**
   * Switch to the target view by its id.
   * Updates nav indicators on both desktop and mobile menus.
   */
  function switchView(targetId) {
    var viewId = targetId || "landing";

    // Set background dimming class for high-contrast non-translucent workspace
    if (document.body) {
      document.body.classList.toggle("mission-control-active", viewId !== "landing");
    }

    allViews.forEach(function (v) {
      if (v.id === viewId) {
        v.classList.add("active");
      } else {
        v.classList.remove("active");
      }
    });

    desktopLinks.forEach(function (link) {
      var navTarget = link.getAttribute("data-nav");
      if (navTarget === viewId || (viewId === "landing" && navTarget === "landing")) {
        link.classList.add("is-active");
      } else {
        link.classList.remove("is-active");
      }
    });

    mobileLinks.forEach(function (link) {
      var navTarget = link.getAttribute("data-nav");
      if (navTarget === viewId || (viewId === "landing" && navTarget === "landing")) {
        link.classList.add("is-active");
      } else {
        link.classList.remove("is-active");
      }
    });

    if (viewId === "landing") {
      stats.forEach(function (stat) {
        if (stat.dataset.counted !== "1") {
          startStatsCountUp();
        }
      });
    }

    var page = document.querySelector(".page");
    if (page) {
      page.style.overflowY = "auto";
      page.scrollTop = 0;
    }

    // Trigger view-specific data loading
    if (viewId === "dashboard") {
      loadDashboardData();
      setTimeout(init3DOrbitGlobe, 100);
    }
    else if (viewId === "catalog") loadCatalogData();
    else if (viewId === "conjunctions") loadConjunctionsData();
    else if (viewId === "maneuvers") loadManeuversData(state.selectedConjId);
    else if (viewId === "reports") loadReportsData();
  }

  // Handle clicks on elements with data-nav attributes
  document.addEventListener("click", function (e) {
    var navEl = e.target.closest("[data-nav]");
    if (!navEl) return;

    e.preventDefault();
    var targetId = navEl.getAttribute("data-nav");
    switchView(targetId);

    if (isOpen()) closeMenu();
  });

  window.addEventListener("hashchange", function () {
    var hash = window.location.hash.replace("#", "") || "landing";
    switchView(hash);
  });

  (function () {
    var hash = window.location.hash.replace("#", "");
    if (hash && hash !== "landing") {
      switchView(hash);
    }
  })();

  /* ---------------------------------------------------------
     Mobile menu
     --------------------------------------------------------- */
  var burger = document.getElementById("burger");
  var overlay = document.getElementById("menuOverlay");
  var menu = document.getElementById("mobileMenu");

  function openMenu() {
    if (!burger || !menu || !overlay) return;
    burger.setAttribute("aria-expanded", "true");
    overlay.hidden = false;
    menu.hidden = false;
    document.body.classList.add("menu-open");
  }

  function closeMenu() {
    if (!burger || !menu || !overlay) return;
    burger.setAttribute("aria-expanded", "false");
    overlay.hidden = true;
    menu.hidden = true;
    document.body.classList.remove("menu-open");
  }

  function isOpen() {
    return burger && burger.getAttribute("aria-expanded") === "true";
  }

  if (burger) {
    burger.addEventListener("click", function () {
      if (isOpen()) closeMenu();
      else openMenu();
    });
  }

  if (overlay) {
    overlay.addEventListener("click", closeMenu);
  }

  document.addEventListener("keydown", function (e) {
    if ((e.key === "Escape" || e.key === "Esc") && isOpen()) closeMenu();
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 720 && isOpen()) closeMenu();
  });

  function startMasterClock() {
    var clockEl = document.getElementById("masterUtcClock");
    if (!clockEl) return;
    function tick() {
      var now = new Date();
      var utcStr = now.toUTCString().replace("GMT", "UTC");
      clockEl.textContent = utcStr.split(" ").slice(4, 6).join(" ");
    }
    tick();
    setInterval(tick, 1000);
  }

  // Initialize features
  setupFilterListeners();
  setupCalculator();
  setupAlertsDrawerListeners();
  connectLiveWebSocket();
  loadDashboardData();
  startMasterClock();
  setTimeout(init3DOrbitGlobe, 300);
})();
