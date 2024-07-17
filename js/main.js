import * as THREE from "https://cdn.skypack.dev/three@0.129.0";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js";

let scene, camera, renderer, controls;
let planets = [];
let planetLabels = [];
let planetLights = [];
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let selectedPlanet = null;
let zooming = false;
let zoomStartTime = 0;
let zoomDuration = 1000; // Duration of zoom animation in milliseconds
let initialCameraPosition = new THREE.Vector3();
let targetCameraPosition = new THREE.Vector3();
let normalSkybox, topViewSkybox;
let isTopView = false;

let mercury_orbit_radius = 50;
let venus_orbit_radius = 60;
let earth_orbit_radius = 70;
let mars_orbit_radius = 80;
let jupiter_orbit_radius = 100;
let saturn_orbit_radius = 120;
let uranus_orbit_radius = 140;
let neptune_orbit_radius = 160;

const storedData = localStorage.getItem('formData');
const formData = JSON.parse(storedData);
const daysDifference = formData.daysDifference;

// Orbital periods in days
const orbitalPeriods = {
  Mercury: 88,
  Venus: 225,
  Earth: 365,
  Mars: 687,
  Jupiter: 4333,
  Saturn: 10759,
  Uranus: 30687,
  Neptune: 60190,
};

function createMaterialArray(paths) {
  const materialArray = paths.map((image) => {
    let texture = new THREE.TextureLoader().load(image);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.flipY = false; // Ensure the texture is not flipped vertically
    return new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });
  });
  return materialArray;
}


function setSkyBox(materialArray, isTopViewSkybox) {
  const skyboxGeo = new THREE.BoxGeometry(1000, 1000, 1000);
  const skybox = new THREE.Mesh(skyboxGeo, materialArray);
  skybox.userData.isSkybox = true;

  // Correct the horizontal and vertical flip by scaling the skybox
  skybox.scale.set(-1, -1, 1); // Flip the texture horizontally and vertically

  if (isTopViewSkybox) {
    topViewSkybox = skybox;
  } else {
    normalSkybox = skybox;
  }
}


function loadPlanetTexture(texture, radius, widthSegments, heightSegments, meshType) {
  const geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
  const loader = new THREE.TextureLoader();
  const planetTexture = loader.load(texture);
  const material = meshType == "standard" ? new THREE.MeshStandardMaterial({ map: planetTexture }) : new THREE.MeshBasicMaterial({ map: planetTexture });
  const planet = new THREE.Mesh(geometry, material);
  return planet;
}

function createRing(innerRadius) {
  let outerRadius = innerRadius - 0.1;
  let thetaSegments = 100;
  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, thetaSegments);
  const material = new THREE.MeshBasicMaterial({ color: "#ffffff", side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function createLabel(planetName) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = "48px Arial";
  context.fillStyle = "white";
  context.fillText(planetName, 0, 48);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(20, 10, 1);

  return sprite;
}

function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 1000);

  const normalSkyboxPaths = [
    "../img/skybox/space_ft.png",
    "../img/skybox/space_bk.png",
    "../img/skybox/space_up.png",
    "../img/skybox/space_dn.png",
    "../img/skybox/space_rt.png",
    "../img/skybox/space_lf.png",
  ];

  const topViewSkyboxPaths = [
    "../img/rashi.jpeg",
    "../img/rashi.jpeg",
    "../img/rashi.jpeg",
    "../img/rashi.jpeg",
    "../img/rashi.jpeg",
    "../img/rashi.jpeg",
  ];

  setSkyBox(createMaterialArray(normalSkyboxPaths), false);
  setSkyBox(createMaterialArray(topViewSkyboxPaths), true);
  scene.add(normalSkybox);

  const planetData = [
    { name: "Sun", texture: "../img/sun_hd.jpg", size: 20, distance: 0, type: "basic" },
    { name: "Mercury", texture: "../img/mercury_hd.jpg", size: 2, distance: mercury_orbit_radius, type: "standard" },
    { name: "Venus", texture: "../img/venus_hd.jpg", size: 3, distance: venus_orbit_radius, type: "standard" },
    { name: "Earth", texture: "../img/earth_hd.jpg", size: 4, distance: earth_orbit_radius, type: "standard" },
    { name: "Mars", texture: "../img/mars_hd.jpg", size: 3.5, distance: mars_orbit_radius, type: "standard" },
    { name: "Jupiter", texture: "../img/jupiter_hd.jpg", size: 10, distance: jupiter_orbit_radius, type: "standard" },
    { name: "Saturn", texture: "../img/saturn_hd.jpg", size: 8, distance: saturn_orbit_radius, type: "standard" },
    { name: "Uranus", texture: "../img/uranus_hd.jpg", size: 6, distance: uranus_orbit_radius, type: "standard" },
    { name: "Neptune", texture: "../img/neptune_hd.jpg", size: 5, distance: neptune_orbit_radius, type: "standard" },
  ];

  planetData.forEach((data, index) => {
    const planet = loadPlanetTexture(data.texture, data.size, 100, 100, data.type);
    planet.userData = { name: data.name, distance: data.distance };

    // Calculate position based on revolution speed
    if (data.name !== "Sun") {
      const orbitalPeriod = orbitalPeriods[data.name];
      const angle = 2 * Math.PI * ((daysDifference % orbitalPeriod) / orbitalPeriod);
      planet.position.x = data.distance * Math.cos(angle);
      planet.position.z = data.distance * Math.sin(angle);
    }

    scene.add(planet);
    planets.push(planet);

    const label = createLabel(data.name);
    label.visible = false; // Hide all labels initially
    scene.add(label);
    planetLabels.push(label);

    // Add a point light to each planet except the Sun
    if (data.name !== "Sun") {
      const planetLight = new THREE.PointLight(0xffffff, 1, 50);
      planetLight.position.copy(planet.position);
      scene.add(planetLight);
      planetLights.push(planetLight);
    }
  });

  const sunLight = new THREE.PointLight(0xffffff, 1, 0);
  sunLight.position.copy(planets[0].position);
  scene.add(sunLight);

  // Additional light source from the back side
  const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
  backLight.position.set(160, 0, 0).normalize();
  scene.add(backLight);

  const rightLight = new THREE.DirectionalLight(0xffffff, 0.5);
  rightLight.position.set(80, -160, 0).normalize();
  scene.add(rightLight);

  const topLight = new THREE.DirectionalLight(0xffffff, 0.5);
  topLight.position.set(80, 0, 80).normalize();
  scene.add(topLight);

  const leftLight = new THREE.DirectionalLight(0xffffff, 0.5);
  leftLight.position.set(80, 160, 0).normalize();
  scene.add(leftLight);

  // Log the coordinates of each planet
  logPlanetPositions();

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  renderer.domElement.id = "c";

  controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = 12;
  controls.maxDistance = 1000;

  camera.position.z = 100;

  window.addEventListener("resize", onWindowResize, false);
  window.addEventListener("click", onDocumentMouseDown, false);

  // Add event listener for the exit button
  document.getElementById("exit-button").addEventListener("click", exitPlanetView);

  // Add event listener for the toggle view button
  document.getElementById("toggle-view-button").addEventListener("click", toggleView);
}

function logPlanetPositions() {
  const planetsInfo = [
    { name: "Mercury", speed: ((daysDifference % orbitalPeriods.Mercury) / orbitalPeriods.Mercury), radius: mercury_orbit_radius },
    { name: "Venus", speed: ((daysDifference % orbitalPeriods.Venus) / orbitalPeriods.Venus), radius: venus_orbit_radius },
    { name: "Earth", speed: ((daysDifference % orbitalPeriods.Earth) / orbitalPeriods.Earth), radius: earth_orbit_radius },
    { name: "Mars", speed: ((daysDifference % orbitalPeriods.Mars) / orbitalPeriods.Mars), radius: mars_orbit_radius },
    { name: "Jupiter", speed: ((daysDifference % orbitalPeriods.Jupiter) / orbitalPeriods.Jupiter), radius: jupiter_orbit_radius },
    { name: "Saturn", speed: ((daysDifference % orbitalPeriods.Saturn) / orbitalPeriods.Saturn), radius: saturn_orbit_radius },
    { name: "Uranus", speed: ((daysDifference % orbitalPeriods.Uranus) / orbitalPeriods.Uranus), radius: uranus_orbit_radius },
    { name: "Neptune", speed: ((daysDifference % orbitalPeriods.Neptune) / orbitalPeriods.Neptune), radius: neptune_orbit_radius },
  ];

  planetsInfo.forEach((planet) => {
    const angle = 2 * Math.PI * planet.speed;
    const x = planet.radius * Math.cos(angle);
    const y = planet.radius * Math.sin(angle);
    console.log(`${planet.name} position - x: ${x.toFixed(2)}, y: ${y.toFixed(2)}`);
  });
}

function animate() {
  requestAnimationFrame(animate);

  const rotationSpeed = 0.005;
  planets.forEach((planet, index) => {
    planet.rotation.y += rotationSpeed;

    let label = planetLabels[index];
    label.position.copy(planet.position);
    label.position.y += 10;

    // Update the position of the planet light
    if (planetLights[index - 1]) {
      planetLights[index - 1].position.copy(planet.position);
    }
  });

  if (zooming) {
    const elapsed = Date.now() - zoomStartTime;
    const progress = Math.min(elapsed / zoomDuration, 1);
    camera.position.lerpVectors(initialCameraPosition, targetCameraPosition, progress);

    if (progress === 1) {
      zooming = false;
    }
  }

  // Update the skybox position
  scene.children.forEach(child => {
    if (child.userData.isSkybox) {
      child.position.copy(camera.position);
    }
  });

  controls.update();
  renderer.render(scene, camera);
}

function toggleView() {
  isTopView = !isTopView;

  if (isTopView) {
    scene.remove(normalSkybox);
    scene.add(topViewSkybox);
    camera.position.set(0, 450, -50); // Adjust the camera position for top view
    // controls.enabled = false; // Disable orbit controls for top view
  } else {
    scene.remove(topViewSkybox);
    scene.add(normalSkybox);
    camera.position.set(100, 0, 200); // Adjust the camera position for normal view
    controls.enabled = true; // Enable orbit controls for normal view
  }
}

function onDocumentMouseDown(event) {
  event.preventDefault();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(planets);

  if (intersects.length > 0) {
    selectedPlanet = intersects[0].object;
    const distance = selectedPlanet.userData.distance;

    // Show only the selected planet's label
    planetLabels.forEach((label, index) => {
      label.visible = planets[index] === selectedPlanet;
    });

    initialCameraPosition.copy(camera.position);
    targetCameraPosition.copy(selectedPlanet.position);
    targetCameraPosition.z += distance / 2;
    zooming = true;
    zoomStartTime = Date.now();

    controls.target.copy(selectedPlanet.position);
    controls.update();

    // Show the planet information overlay
    showPlanetInfo(selectedPlanet.userData.name);
  } else {
    // Hide all labels if clicked in outer space
    planetLabels.forEach((label) => {
      label.visible = false;
    });
    selectedPlanet = null;
  }
}

function showPlanetInfo(planetName) {
  const infoOverlay = document.getElementById("info-overlay");
  const planetInfo = document.getElementById("planet-info");

  // Update planet information (this could be more detailed)
  planetInfo.innerHTML = `
    <h2>${planetName}</h2>
    <p>Information about ${planetName}.</p>
  `;

  infoOverlay.style.display = "block";
}

function exitPlanetView() {
  const infoOverlay = document.getElementById("info-overlay");
  infoOverlay.style.display = "none";

  initialCameraPosition.copy(camera.position);
  targetCameraPosition.copy(planets[0].position);
  targetCameraPosition.z += 100; // Adjust the zoom out distance as needed
  zooming = true;
  zoomStartTime = Date.now();

  controls.target.copy(planets[0].position);
  controls.update();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

init();
animate();
