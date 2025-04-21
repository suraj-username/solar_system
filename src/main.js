import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { TextureLoader } from 'three';

// 1. Create the scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000033);

// 2. Create the camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 50, 150); // Set further back to see the full system

// 3. Create the renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
renderer.xr.enabled = true; // Enable WebXR for VR

// Add VR button to the document
VRButton.createButton(renderer);

// Get the VR enable and disable buttons
const enableVRButton = document.getElementById('enableVR');
const disableVRButton = document.getElementById('disableVR');

// 4. Add orbit controls (for mouse interaction)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Function to enable orbit controls
function enableOrbit() {
    controls.enabled = true;
    camera.position.set(0, 50, 150);
    controls.update();
    enableVRButton.style.display = 'block';
    disableVRButton.style.display = 'none';
    renderer.xr.enabled = false;
    renderer.setAnimationLoop(animate); // Restart normal animation loop
}

// Function to disable orbit controls and enter VR
function enableVR() {
    controls.enabled = false;
    enableVRButton.style.display = 'none';
    disableVRButton.style.display = 'block';
    renderer.xr.enabled = true;
    renderer.setAnimationLoop(renderer.render); // Use VR render loop
}

// Event listeners for the VR buttons
enableVRButton.addEventListener('click', enableVR);
disableVRButton.addEventListener('click', enableOrbit);

// 5. Add lights
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// UI overlay for information
const infoElement = document.createElement('div');
infoElement.style.position = 'absolute';
infoElement.style.top = '10px';
infoElement.style.left = '10px';
infoElement.style.color = 'white';
infoElement.style.fontFamily = 'Arial, sans-serif';
infoElement.style.padding = '10px';
infoElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
infoElement.style.borderRadius = '5px';
infoElement.style.pointerEvents = 'none';
infoElement.innerHTML = 'Solar System Simulation<br>Use mouse to navigate';
document.body.appendChild(infoElement);

// Add scale toggle button
const scaleToggle = document.createElement('button');
scaleToggle.style.position = 'absolute';
scaleToggle.style.bottom = '10px';
scaleToggle.style.right = '10px';
scaleToggle.style.padding = '8px 12px';
scaleToggle.style.backgroundColor = '#333';
scaleToggle.style.color = 'white';
scaleToggle.style.border = 'none';
scaleToggle.style.borderRadius = '4px';
scaleToggle.style.cursor = 'pointer';
scaleToggle.textContent = 'Toggle Realistic Scale';
document.body.appendChild(scaleToggle);

// Global variables for toggling between visual and realistic scales
let useRealisticScale = false;
let currentPlanets = [];
let currentAsteroidBelt = null;
let currentSunSystem = null;

// Texture loader
const textureLoader = new TextureLoader();

// SCALING CONSTANTS
// For a more accurate representation but still visible simulation
// We'll have two scales - a visual one and a more realistic one
const VISUAL_SCALE = {
    SIZE_SCALE: 0.5,         // Scale planet sizes (more visible)
    DISTANCE_SCALE: 2,       // Scale orbital distances (compressed)
    SUN_SIZE: 10,            // Sun size for visual appeal
    INCLINATION_FACTOR: 1.8  // Exaggerate inclinations slightly
};

const REALISTIC_SCALE = {
    SIZE_SCALE: 0.1,         // Much smaller planets relative to sun
    DISTANCE_SCALE: 5,       // More expanded distances
    SUN_SIZE: 25,            // Much larger sun (still not fully to scale)
    INCLINATION_FACTOR: 1.0  // True inclinations
};

// Start with visual scale
let CURRENT_SCALE = VISUAL_SCALE;

// Function to create an elliptical orbit curve with proper inclination
function createEllipticalOrbit(semiMajorAxis, eccentricity, inclination, longitudeOfAscendingNode) {
    const points = [];
    const segments = 128;

    // Apply the inclination factor to make orbital planes more visible
    const adjustedInclination = inclination * CURRENT_SCALE.INCLINATION_FACTOR;

    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;

        // Calculate radius at this angle (polar form of ellipse equation)
        const radius = semiMajorAxis * (1 - eccentricity * eccentricity) /
                      (1 + eccentricity * Math.cos(theta));

        // Convert polar to Cartesian coordinates
        const x = radius * Math.cos(theta);
        const z = radius * Math.sin(theta);

        // Apply inclination rotation
        const y = z * Math.sin(adjustedInclination);
        const adjustedZ = z * Math.cos(adjustedInclination);

        // Apply longitude of ascending node rotation
        const finalX = x * Math.cos(longitudeOfAscendingNode) - adjustedZ * Math.sin(longitudeOfAscendingNode);
        const finalZ = x * Math.sin(longitudeOfAscendingNode) + adjustedZ * Math.cos(longitudeOfAscendingNode);

        points.push(new THREE.Vector3(finalX, y, finalZ));
    }

    // Create a curve from the points
    const curve = new THREE.CatmullRomCurve3(points);
    return curve;
}

// Function to create an orbit line from a curve
function createOrbitLine(curve, color = 0x888888) {
    const points = curve.getPoints(128);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.3
    });
    return new THREE.Line(geometry, material);
}

// Create the sun
function createSun() {
    const sunGeometry = new THREE.SphereGeometry(CURRENT_SCALE.SUN_SIZE, 64, 64);
    const sunMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        emissive: 0xffaa00,
        emissiveIntensity: 0.5
    });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sun);

    // Add sun glow effect
    const sunGlowGeometry = new THREE.SphereGeometry(CURRENT_SCALE.SUN_SIZE * 1.1, 64, 64);
    const sunGlowMaterial = new THREE.MeshBasicMaterial({
        color: 0xffdd00,
        transparent: true,
        opacity: 0.3
    });
    const sunGlow = new THREE.Mesh(sunGlowGeometry, sunGlowMaterial);
    scene.add(sunGlow);

    return { sun, sunGlow };
}

// Function to create a planet
function createPlanet(name, radius, distance, eccentricity, color, orbitalPeriod, inclination = 0, longitudeOfAscendingNode = 0, axialTilt = 0) {
    // Scale radius and distance
    const scaledRadius = radius * CURRENT_SCALE.SIZE_SCALE;
    const scaledDistance = distance * CURRENT_SCALE.DISTANCE_SCALE;

    // Calculate orbital parameters
    const semiMajorAxis = scaledDistance;
    const adjustedEccentricity = eccentricity;

    // Create the planet
    const geometry = new THREE.SphereGeometry(scaledRadius, 32, 32);
    const material = new THREE.MeshStandardMaterial({ color });
    const planet = new THREE.Mesh(geometry, material);

    // Create an orbit path
    const orbitCurve = createEllipticalOrbit(
        semiMajorAxis,
        adjustedEccentricity,
        inclination * (Math.PI / 180), // Convert degrees to radians
        longitudeOfAscendingNode * (Math.PI / 180)
    );
    const orbitLine = createOrbitLine(orbitCurve);
    scene.add(orbitLine);

    // Create a container for the planet
    const axisHelper = new THREE.Group();
    axisHelper.add(planet);
    scene.add(axisHelper);

    // Apply axial tilt
    planet.rotation.x = axialTilt * (Math.PI / 180);

    // Add reference grid to visualize orbital plane
    if (name === "Earth") {
        const gridHelper = new THREE.GridHelper(scaledDistance * 2, 10, 0x0000ff, 0x0000ff);
        gridHelper.material.transparent = true;
        gridHelper.material.opacity = 0.1;
        scene.add(gridHelper);
    }

    // Store planet data for animation
    return {
        name,
        planet,
        orbitLine,
        axisHelper,
        curve: orbitCurve,
        orbitalPeriod,
        position: 0, // Position along curve (0 to 1)
        rotationSpeed: 0.01 * (1 / orbitalPeriod) * 20, // Faster rotation for closer planets
        // Store original parameters for rescaling
        originalParams: {
            radius,
            distance,
            eccentricity,
            inclination,
            longitudeOfAscendingNode,
            axialTilt
        }
    };
}

// Function to create a moon
function createMoon(parentPlanet, radius, distance, color, orbitalPeriod, inclination = 0) {
    const scaledRadius = radius * CURRENT_SCALE.SIZE_SCALE * 2; // Moons scaled larger to be visible
    const scaledDistance = distance * CURRENT_SCALE.SIZE_SCALE * 10; // Scale moon distances differently

    // Create the moon
    const geometry = new THREE.SphereGeometry(scaledRadius, 16, 16);
    const material = new THREE.MeshStandardMaterial({ color });
    const moon = new THREE.Mesh(geometry, material);

    // Create a lunar orbit path
    const points = [];
    const segments = 64;

    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const x = scaledDistance * Math.cos(theta);
        const z = scaledDistance * Math.sin(theta);

        // Apply inclination
        const y = z * Math.sin(inclination * (Math.PI / 180));
        const adjustedZ = z * Math.cos(inclination * (Math.PI / 180));

        points.push(new THREE.Vector3(x, y, adjustedZ));
    }

    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const orbitMaterial = new THREE.LineBasicMaterial({
        color: 0x444444,
        transparent: true,
        opacity: 0.3
    });
    const orbit = new THREE.Line(orbitGeometry, orbitMaterial);

    // Create a container for the moon and its orbit
    const moonSystem = new THREE.Group();
    moonSystem.add(moon);
    moonSystem.add(orbit);

    // Position the moon along its orbit
    moon.position.x = scaledDistance;

    // Add the moon system to the parent planet's axis helper
    parentPlanet.axisHelper.add(moonSystem);

    return {
        moon,
        orbitalPeriod,
        distance: scaledDistance,
        angle: 0
    };
}

// Create asteroid belt
function createAsteroidBelt() {
    // ASTEROID BELT PARAMETERS
    // The asteroid belt is located between Mars and Jupiter (approximately 2.2 to 3.2 AU from the Sun)
    const marsDistance = 22 * CURRENT_SCALE.DISTANCE_SCALE;
    const jupiterDistance = 34 * CURRENT_SCALE.DISTANCE_SCALE;

    const minRadius = marsDistance * 1.2; // Just outside Mars' orbit
    const maxRadius = jupiterDistance * 0.8; // Just inside Jupiter's orbit

    // Asteroid belt visualization parameters
    const asteroidCount = 5000; // More asteroids for better visibility
    const beltHeight = 4 * CURRENT_SCALE.DISTANCE_SCALE; // Increased belt thickness

    // Asteroid size parameters
    const minSize = 0.1 * CURRENT_SCALE.SIZE_SCALE; // Larger minimum size for visibility
    const maxSize = 0.4 * CURRENT_SCALE.SIZE_SCALE; // Larger maximum size for visibility

    // Create a group for the asteroids
    const asteroids = new THREE.Group();

    // Create a visualization of the asteroid belt as a ring
    const beltRingGeometry = new THREE.RingGeometry(minRadius, maxRadius, 128);
    const beltRingMaterial = new THREE.MeshBasicMaterial({
        color: 0xaaaaaa,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.15
    });
    const beltRing = new THREE.Mesh(beltRingGeometry, beltRingMaterial);
    beltRing.rotation.x = Math.PI / 2;
    scene.add(beltRing);

    // Create individual asteroids
    for (let i = 0; i < asteroidCount; i++) {
        // Random radius within the belt
        const radius = minRadius + Math.random() * (maxRadius - minRadius);

        // Random position on the circle at this radius
        const theta = Math.random() * Math.PI * 2;

        // Add some height variance (belt thickness)
        const height = (Math.random() - 0.5) * beltHeight;

        // Create asteroid
        const size = minSize + Math.random() * (maxSize - minSize);
        const asteroidGeometry = new THREE.IcosahedronGeometry(size, 0);

        // Vary the color slightly for visual interest
        const colorValue = 0.6 + Math.random() * 0.4;
        const asteroidMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(colorValue, colorValue * 0.9, colorValue * 0.8),
            roughness: 0.8,
            metalness: Math.random() * 0.5
        });

        const asteroid = new THREE.Mesh(asteroidGeometry, asteroidMaterial);

        // Apply a random inclination to the asteroid's orbit
        const inclination = (Math.random() - 0.5) * Math.PI * 0.3; // Random inclination up to ±27 degrees

        // Position asteroid with inclination
        asteroid.position.x = radius * Math.cos(theta);
        asteroid.position.y = height + radius * Math.sin(theta) * Math.sin(inclination);
        asteroid.position.z = radius * Math.sin(theta) * Math.cos(inclination);

        // Random rotation and scale for variety
        asteroid.rotation.x = Math.random() * Math.PI;
        asteroid.rotation.y = Math.random() * Math.PI;
        asteroid.rotation.z = Math.random() * Math.PI;
        asteroid.scale.set(
            0.5 + Math.random(),
            0.5 + Math.random(),
            0.5 + Math.random()
        );

        // Store original position data for animation
        asteroid.userData = {
            radius,
            theta,
            height,
            inclination,
            speed: 0.0002 + Math.random() * 0.0006
        };

        asteroids.add(asteroid);
    }

    scene.add(asteroids);
    return { asteroids, beltRing };
}

// Function to create solar system with specific scale
function createSolarSystem() {
    // Remove existing solar system if it exists
    if (currentSunSystem) {
        scene.remove(currentSunSystem.sun);
        scene.remove(currentSunSystem.sunGlow);
    }

    if (currentPlanets.length > 0) {
        currentPlanets.forEach(planet => {
            scene.remove(planet.axisHelper);
            scene.remove(planet.orbitLine);
        });
        currentPlanets = [];
    }

    if (currentAsteroidBelt) {
        scene.remove(currentAsteroidBelt.asteroids);
        scene.remove(currentAsteroidBelt.beltRing);
        currentAsteroidBelt = null;
    }

    // Create new solar system
    const sunSystem = createSun();

    // Create planets with accurate relative sizes, distances, and orbital parameters
    // Values are approximations to maintain visual interest while being more accurate than before
    const planets = [
        // name, radius, distance, eccentricity, color, orbitalPeriod, inclination, longitudeOfAscendingNode, axialTilt
        createPlanet("Mercury", 0.38, 9, 0.206, 0xaaaaaa, 0.24, 7.0, 48.3, 0.03),
        createPlanet("Venus", 0.95, 12, 0.007, 0xffccaa, 0.62, 3.4, 76.7, 177.4),
        createPlanet("Earth", 1.0, 16, 0.017, 0x3366ff, 1.0, 0.0, 348.7, 23.4),
        createPlanet("Mars", 0.53, 22, 0.093, 0xff3333, 1.88, 1.8, 49.6, 25.2),
        createPlanet("Jupiter", 11.2, 34, 0.048, 0xffcc99, 11.86, 1.3, 100.6, 3.1),
        createPlanet("Saturn", 9.4, 62, 0.056, 0xffffcc, 29.46, 2.5, 113.7, 26.7),
        createPlanet("Uranus", 4.0, 124, 0.047, 0x99ffff, 84.01, 0.8, 74.0, 97.8),
        createPlanet("Neptune", 3.9, 195, 0.009, 0x6666ff, 164.8, 1.8, 131.7, 28.3)
    ];

    // Add rings to Saturn
    const saturnRingGeometry = new THREE.RingGeometry(
        9.4 * CURRENT_SCALE.SIZE_SCALE * 1.2,
        9.4 * CURRENT_SCALE.SIZE_SCALE * 2.3,
        64
    );
    const saturnRingMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffcc,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
    });
    const saturnRing = new THREE.Mesh(saturnRingGeometry, saturnRingMaterial);
    saturnRing.rotation.x = Math.PI / 2;
    planets[5].planet.add(saturnRing);

    // Add rings to Uranus (fainter than Saturn's)
    const uranusRingGeometry = new THREE.RingGeometry(
        4.0 * CURRENT_SCALE.SIZE_SCALE * 1.5,
        4.0 * CURRENT_SCALE.SIZE_SCALE * 1.8,
        64
    );
    const uranusRingMaterial = new THREE.MeshStandardMaterial({
        color: 0x99ffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.4
    });
    const uranusRing = new THREE.Mesh(uranusRingGeometry, uranusRingMaterial);
    uranusRing.rotation.x = Math.PI / 2;
    planets[6].planet.add(uranusRing);

    // Add moons to planets
    // Earth's moon (Luna)
    createMoon(planets[2], 0.27, 0.4, 0xdddddd, 27.3, 5.1);

    // Mars' moons (Phobos and Deimos)
    createMoon(planets[3], 0.01, 0.15, 0xaaaaaa, 0.32, 1.0);
    createMoon(planets[3], 0.005, 0.25, 0x999999, 1.26, 1.8);

    // Jupiter's 4 largest moons (Galilean moons)
    createMoon(planets[4], 0.15, 0.4, 0xddddcc, 1.77, 0.0);  // Io
    createMoon(planets[4], 0.14, 0.7, 0xffffff, 3.55, 0.5);  // Europa
    createMoon(planets[4], 0.17, 1.1, 0xbbbbaa, 7.15, 0.2);  // Ganymede
    createMoon(planets[4], 0.15, 1.6, 0x888899, 16.69, 0.3); // Callisto

    // Saturn's major moons
    createMoon(planets[5], 0.16, 0.8, 0xeeeecc, 15.95, 0.0); // Titan
    createMoon(planets[5], 0.04, 0.5, 0xdddddd, 2.74, 0.0);  // Enceladus

    // Uranus' largest moons
    createMoon(planets[6], 0.05, 0.5, 0xddddff, 8.71, 0.0);  // Titania
    createMoon(planets[6], 0.04, 0.7, 0xccccff, 13.46, 0.0); // Oberon

    // Neptune's largest moon (Triton)
    createMoon(planets[7], 0.08, 0.6, 0xbbbbff, 5.88, 157.0); // Retrograde orbit

    // Create the asteroid belt
    const asteroidBelt = createAsteroidBelt();

    // Add label for the asteroid belt
    const beltLabelDiv = document.createElement('div');
    beltLabelDiv.className = 'beltLabel';
    beltLabelDiv.textContent = 'Asteroid Belt';
    beltLabelDiv.style.position = 'absolute';
    beltLabelDiv.style.display = 'none';
    beltLabelDiv.style.color = 'white';
    beltLabelDiv.style.backgroundColor = 'rgba(0,0,0,0.5)';
    beltLabelDiv.style.padding = '4px 8px';
    beltLabelDiv.style.borderRadius = '4px';
    beltLabelDiv.style.fontSize = '12px';
    document.body.appendChild(beltLabelDiv);

    // Store the current solar system
    currentSunSystem = sunSystem;
    currentPlanets = planets;
    currentAsteroidBelt = asteroidBelt;

    return { sunSystem, planets, asteroidBelt };
}

// Add a starfield background
function createStarfield() {
    const starsGeometry = new THREE.BufferGeometry();
    const starCount = 8000;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
        const i3 = i * 3;

        // Position stars in a sphere around the scene
        const radius = 1000;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);

        positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = radius * Math.cos(phi);

        // Randomize star colors slightly
        const colorChoice = Math.random();
        if (colorChoice > 0.95) {
            // Red/orange stars
            colors[i3] = 1.0;
            colors[i3 + 1] = 0.7 + Math.random() * 0.3;
            colors[i3 + 2] = 0.6 + Math.random() * 0.4;
        } else if (colorChoice > 0.8) {
            // Blue stars
            colors[i3] = 0.6 + Math.random() * 0.4;
            colors[i3 + 1] = 0.7 + Math.random() * 0.3;
            colors[i3 + 2] = 1.0;
        } else {
            // White/yellow stars
            const brightness = 0.8 + Math.random() * 0.2;
            colors[i3] = brightness;
            colors[i3 + 1] = brightness;
            colors[i3 + 2] = brightness;
        }

        // Random star sizes
        sizes[i] = Math.random() * 2;
    }

    starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    starsGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const starsMaterial = new THREE.PointsMaterial({
        size: 1.5,
        vertexColors: true,
        transparent: true,
        opacity: 0.8
    });

    const starField = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starField);

    return starField;
}

// Create initial solar system and starfield
const starField = createStarfield();
const { sunSystem, planets, asteroidBelt } = createSolarSystem();
currentSunSystem = sunSystem;

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Add a dedicated button to focus on the asteroid belt
const beltFocusButton = document.createElement('button');
beltFocusButton.style.position = 'absolute';
beltFocusButton.style.bottom = '10px';
beltFocusButton.style.left = '10px';
beltFocusButton.style.padding = '8px 12px';
beltFocusButton.style.backgroundColor = '#444';
beltFocusButton.style.color = 'white';
beltFocusButton.style.border = 'none';
beltFocusButton.style.borderRadius = '4px';
beltFocusButton.style.cursor = 'pointer';
beltFocusButton.textContent = 'View Asteroid Belt';
document.body.appendChild(beltFocusButton);

beltFocusButton.addEventListener('click', () => {
    focusAsteroidBelt();
});

// Function to focus on asteroid belt
function focusAsteroidBelt() {
    // Position midway between Mars and Jupiter
    const marsDistance = 22 * CURRENT_SCALE.DISTANCE_SCALE;
    const jupiterDistance = 34 * CURRENT_SCALE.DISTANCE_SCALE;
    const beltCenter = (marsDistance + jupiterDistance) / 2;

    // Set camera position to view belt from above
    controls.target.set(0, 0, 0);
    camera.position.set(beltCenter/2, beltCenter/2, beltCenter/2);

    // Update info display
    infoElement.innerHTML = 'Viewing: Asteroid Belt<br>Located between Mars and Jupiter';
}

// Focus camera on a specific planet
function focusPlanet(index) {
    if (index >= 0 && index < currentPlanets.length) {
        const target = currentPlanets[index].planet.position.clone();
        controls.target.copy(target);

        // Position camera at a distance relative to planet size
        const offset = new THREE.Vector3(0, 5, 20);
        const cameraPosition = target.clone().add(offset);
        camera.position.copy(cameraPosition);

        // Update info display
        infoElement.innerHTML = `Viewing: ${currentPlanets[index].name}`;
    } else if (index === -1) {
        // Reset to solar system view
        controls.target.set(0, 0, 0);
        camera.position.set(0, 50, 150);
        infoElement.innerHTML = 'Solar System Overview';
    }
}

// Toggle scale function
scaleToggle.addEventListener('click', () => {
    useRealisticScale = !useRealisticScale;

    if (useRealisticScale) {
        CURRENT_SCALE = REALISTIC_SCALE;
        scaleToggle.textContent = 'Switch to Visual Scale';
        infoElement.innerHTML = 'Realistic Scale Mode<br>Sun and planets more accurately sized';
    } else {
        CURRENT_SCALE = VISUAL_SCALE;
        scaleToggle.textContent = 'Switch to Realistic Scale';
        infoElement.innerHTML = 'Visual Scale Mode<br>Planets enlarged for visibility';
    }

    // Recreate the solar system with new scale
    createSolarSystem();

    // Reset view
    focusPlanet(-1);
});

// Initialize keyboard controls for planet focus
window.addEventListener('keydown', (event) => {
    // Number keys 0-8 (0 for Sun, 1-8 for planets)
    const key = parseInt(event.key);
    if (!isNaN(key) && key >= 0 && key <= 8) {
        focusPlanet(key - 1); // -1 for Sun, 0-7 for planets
    }
    // Press 'R' to reset view
    if (event.key === 'r' || event.key === 'R') {
        focusPlanet(-1);
    }
    // Press 'A' to focus on asteroid belt
    if (event.key === 'a' || event.key === 'A') {
        focusAsteroidBelt();
    }
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Rotate the sun
    currentSunSystem.sun.rotation.y += 0.001;
    currentSunSystem.sunGlow.rotation.y -= 0.0005;

    // Animate planets
    currentPlanets.forEach((planet, index) => {
        // Update position along orbital path
        planet.position += 0.001 / planet.orbitalPeriod;
        if (planet.position > 1) planet.position = 0;

        // Get position from curve
        const point = planet.curve.getPointAt(planet.position);
        planet.axisHelper.position.copy(point);

        // Rotate planet on its axis
        planet.planet.rotation.y += planet.rotationSpeed;
    });

    // Animate asteroid belt
    if (currentAsteroidBelt && currentAsteroidBelt.asteroids) {
        currentAsteroidBelt.asteroids.children.forEach(asteroid => {
            // Rotate each asteroid around the sun
            const data = asteroid.userData;
            data.theta += data.speed;

            // Calculate position with inclination
            const radius = data.radius;
            asteroid.position.x = radius * Math.cos(data.theta);
            asteroid.position.y = data.height + radius * Math.sin(data.theta) * Math.sin(data.inclination);
            asteroid.position.z = radius * Math.sin(data.theta) * Math.cos(data.inclination);

            // Spin the asteroid
            asteroid.rotation.x += 0.01;
            asteroid.rotation.y += 0.01;
        });
    }

    controls.update();
    renderer.render(scene, camera);
}
animate();

// Instructions for the user
console.log("Enhanced Solar System Simulation Controls:");
console.log("- Left mouse button: Rotate view (in normal mode)");
console.log("- Right mouse button: Pan view (in normal mode)");
console.log("- Mouse wheel: Zoom in/out (in normal mode)");
console.log("- Keys 1-8: Focus on planets (1=Mercury, 8=Neptune)");
console.log("- Key R: Reset to overview");
console.log("- Key A: Focus on asteroid belt");
console.log("- Button 'Toggle Realistic Scale': Switch between visual and realistic scales");
console.log("- Button 'Enable VR': Enter VR mode (if VR headset is connected)");
console.log("- Button 'Disable VR': Return to normal viewing mode");