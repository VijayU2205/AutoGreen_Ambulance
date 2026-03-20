let map;
let ambulanceMarker = null;
let patientMarker = null;
let routingControl = null;

let activeEmergency = null;
let driver_name = "";
let ambulance_no = "";

// --------------------------
// LOGIN
// --------------------------
async function login() {
    let username = document.getElementById("username").value.trim();
    let password = document.getElementById("password").value.trim();

    let res = await fetch("/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({username, password})
    });

    let data = await res.json();

    if (data.status === "success") {
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("main-app").style.display = "block";

        driver_name = data.driver_name;
        ambulance_no = data.ambulance_no;

        document.getElementById("driver-name").innerText = driver_name;
        document.getElementById("ambulance-no").innerText = ambulance_no;
        document.getElementById("your-name").innerText = driver_name;
        document.getElementById("your-ambulance").innerText = ambulance_no;

        startMap();
        pollEmergencies();
        sendAmbulanceLocation();
    } else {
        alert(data.message);
    }
}

function logout() {
    fetch("/logout", {method:"POST"});
    location.reload();
}

// --------------------------
// MAP INITIALIZATION
// --------------------------
function startMap() {
    map = L.map("map").setView([12.9716, 77.5946], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
    }).addTo(map);
}

// --------------------------
// SEND AMBULANCE LOCATION
// --------------------------
function sendAmbulanceLocation() {
    if (!navigator.geolocation) return;

    navigator.geolocation.watchPosition(pos => {
        let lat = pos.coords.latitude;
        let lon = pos.coords.longitude;

        if (ambulanceMarker) map.removeLayer(ambulanceMarker);

        ambulanceMarker = L.marker([lat, lon]).addTo(map);

        fetch("/api/send_location", {
            method:"POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({location:{lat,lon}})
        });

    }, err => {}, {enableHighAccuracy:true});
}

function centerOnAmbulance() {
    if (ambulanceMarker) map.setView(ambulanceMarker.getLatLng(), 15);
}

// --------------------------
// POLL FOR EMERGENCIES
// --------------------------
async function pollEmergencies() {
    setInterval(async () => {
        let res = await fetch("/api/get_my_emergencies");
        let data = await res.json();

        if (data.emergencies && data.emergencies.length > 0) {
            let e = data.emergencies[0];
            if (!activeEmergency) showEmergencyPopup(e);

            activeEmergency = e;
        }
    }, 3000);
}

// --------------------------
// EMERGENCY POPUP
// --------------------------
function showEmergencyPopup(e) {
    document.getElementById("popup-name").innerText = e.name;
    document.getElementById("popup-age").innerText = e.age;
    document.getElementById("popup-mobile").innerText = e.mobile;
    document.getElementById("popup-location").innerText = `${e.lat}, ${e.lon}`;

    document.getElementById("emergency-popup").style.display = "flex";
}

// --------------------------
// ACCEPT EMERGENCY
// --------------------------
async function acceptEmergency() {
    document.getElementById("emergency-popup").style.display = "none";

    await fetch("/api/accept_emergency", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ emergency_id: activeEmergency.emergency_id })
    });

    showMissionInfo(activeEmergency);
    drawRoute(activeEmergency);
}

// --------------------------
// DECLINE
// --------------------------
function declineEmergency() {
    document.getElementById("emergency-popup").style.display = "none";
    activeEmergency = null;
}

// --------------------------
// MISSION DETAILS
// --------------------------
function showMissionInfo(e) {
    document.getElementById("mission-info").style.display = "block";
    document.getElementById("mission-patient").innerText = e.name;
    document.getElementById("mission-age").innerText = e.age;
    document.getElementById("mission-mobile").innerText = e.mobile;
}

// --------------------------
// ROUTING
// --------------------------
function drawRoute(e) {
    if (!ambulanceMarker) return;

    let start = ambulanceMarker.getLatLng();
    let end = L.latLng(e.lat, e.lon);

    if (patientMarker) map.removeLayer(patientMarker);
    patientMarker = L.marker(end).addTo(map);

    if (routingControl) map.removeControl(routingControl);

    routingControl = L.Routing.control({
        waypoints: [start, end],
        routeWhileDragging: false,
    }).addTo(map);
}

function clearRoute() {
    if (routingControl) map.removeControl(routingControl);
}

// --------------------------
// COMPLETE MISSION
// --------------------------
async function completeMission() {
    await fetch("/api/complete_mission", {method:"POST"});
    alert("Mission Completed");

    activeEmergency = null;
    clearRoute();
}
