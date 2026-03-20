// Global variables
const BASE_URL = 'http://192.168.50.95:5000';
let map;
let ambulanceMarker;
let patientMarker;
let hospitalMarker;
let currentEmergency = null;
let emergencyTimer;
let timeLeft = 15;
let locationInterval;
let currentLocation = { lat: 13.026632, lon: 77.571419 }; // Fixed location
let currentMission = null;
let routingControl = null; // ADDED: Routing control variable

// Login function - REAL SERVER CONNECTION
function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        alert('Please enter both username and password');
        return;
    }
    
    // Show loading
    const loginBtn = document.querySelector('.login-btn');
    loginBtn.textContent = 'Connecting to Server...';
    loginBtn.disabled = true;
    
    fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username, password})
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Server error: ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        if (data.status === 'success') {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('main-app').style.display = 'block';
            
            document.getElementById('driver-name').textContent = data.driver_name;
            document.getElementById('ambulance-no').textContent = data.ambulance_no;
            document.getElementById('your-name').textContent = data.driver_name;
            document.getElementById('your-ambulance').textContent = data.ambulance_no;
            
            initMap();
            startLocationTracking();
            startEmergencyPolling();
            updateSystemStatus();
            
            console.log('Login successful with server');
        } else {
            alert('Login failed: ' + data.message);
            loginBtn.textContent = 'Login to Dashboard';
            loginBtn.disabled = false;
        }
    })
    .catch(error => {
        console.error('Login error:', error);
        alert('Cannot connect to server. Please check if Raspberry Pi server is running.');
        loginBtn.textContent = 'Login to Dashboard';
        loginBtn.disabled = false;
    });
}

function logout() {
    if (locationInterval) {
        clearInterval(locationInterval);
    }
    // ADDED: Clear routing control on logout
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }
    fetch(`${BASE_URL}/logout`, {method: 'POST'})
    .then(() => {
        location.reload();
    });
}

function initMap() {
    map = L.map('map').setView([13.026632, 77.571419], 15); // Fixed location
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

function startLocationTracking() {
    // Use fixed location
    updateAmbulanceLocation(currentLocation);
    sendLocationToServer(currentLocation);
    
    // Send location to server every 5 seconds
    locationInterval = setInterval(() => {
        sendLocationToServer(currentLocation);
    }, 5000);
}

function sendLocationToServer(location) {
    fetch(`${BASE_URL}/api/send_location`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ location: location })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status !== 'location_sent') {
            console.error('Failed to send location to server');
        } else {
            console.log('📍 Location sent to server:', location);
        }
    })
    .catch(error => {
        console.error('Error sending location:', error);
    });
}

// ADDED: Function to calculate and display route to patient
function calculateRouteToPatient(patientLocation) {
    // Clear any existing route
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }
    
    console.log("🛣️ Calculating route to patient...");
    
    // Use Leaflet Routing Machine to calculate route
    routingControl = L.Routing.control({
        waypoints: [
            L.latLng(currentLocation.lat, currentLocation.lon),
            L.latLng(patientLocation.lat, patientLocation.lon)
        ],
        routeWhileDragging: false,
        showAlternatives: false,
        lineOptions: {
            styles: [{ color: '#e74c3c', opacity: 0.8, weight: 6 }]
        },
        createMarker: function(i, waypoint, n) {
            // Don't create markers for waypoints to keep our existing markers
            return null;
        }
    }).addTo(map);
    
    // Listen for route calculation completion
    routingControl.on('routesfound', function(e) {
        const routes = e.routes;
        const route = routes[0];
        const distance = (route.summary.totalDistance / 1000).toFixed(1);
        const time = Math.round(route.summary.totalTime / 60);
        
        console.log(`📍 Route calculated: ${distance} km, ${time} minutes`);
        
        // Send routing distance to Raspberry Pi server
        sendRoutingDistanceToServer(route.summary.totalDistance, time);
        
        // Update mission info with routing distance
        document.getElementById('mission-distance').textContent = 
            `${Math.round(route.summary.totalDistance)}m (road distance) - ${time} min`;
    });
    
    routingControl.on('routingerror', function(e) {
        console.error('Route calculation error:', e.error);
        // Fallback: Use straight line distance
        const straightDistance = calculateDistance(
            currentLocation.lat, currentLocation.lon,
            patientLocation.lat, patientLocation.lon
        );
        document.getElementById('mission-distance').textContent = 
            `${Math.round(straightDistance)}m (straight line)`;
    });
}

// ADDED: Function to send routing distance to server
function sendRoutingDistanceToServer(distance, time) {
    fetch(`${BASE_URL}/api/routing_distance`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ 
            routing_distance: distance,
            estimated_time: time,
            emergency_id: currentMission ? currentMission.emergency_id : null
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'routing_distance_received') {
            console.log('📍 Routing distance sent to server:', distance + 'm');
        } else {
            console.error('Failed to send routing distance to server');
        }
    })
    .catch(error => {
        console.error('Error sending routing distance:', error);
    });
}

// ADDED: Function to clear route
function clearRoute() {
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
        console.log('🗑️ Route cleared');
    }
}

function updateAmbulanceLocation(location) {
    if (!ambulanceMarker) {
        ambulanceMarker = L.marker([location.lat, location.lon])
            .addTo(map)
            .bindPopup('🚑 Your Ambulance - ' + document.getElementById('driver-name').textContent)
            .openPopup();
            
        ambulanceMarker.setIcon(
            L.divIcon({
                html: '🚑',
                className: 'ambulance-marker',
                iconSize: [30, 30]
            })
        );
    } else {
        ambulanceMarker.setLatLng([location.lat, location.lon]);
    }
}

function startEmergencyPolling() {
    // Check for new emergencies every 2 seconds
    setInterval(() => {
        if (!currentEmergency) { // Only check if no current emergency
            checkForEmergencies();
        }
    }, 2000);
}

function checkForEmergencies() {
    console.log("🔍 Checking for emergencies...");
    
    fetch(`${BASE_URL}/api/get_my_emergencies`)
    .then(response => response.json())
    .then(data => {
        console.log("📋 Emergency check response:", data);
        
        if (data.emergencies && data.emergencies.length > 0) {
            const emergency = data.emergencies[0];
            console.log("🚨 New emergency found:", emergency);
            
            // Only show popup if we don't have a current emergency
            if (!currentEmergency) {
                showEmergencyPopup(emergency);
            }
        } else {
            console.log("📭 No emergencies found");
        }
    })
    .catch(error => {
        console.error('Error checking emergencies:', error);
    });
}

function showEmergencyPopup(emergency) {
    console.log("🎯 Showing emergency popup for REAL data:", emergency);
    
    currentEmergency = emergency;
    timeLeft = 15;
    
    // Update popup content - Use data from mobile app
    document.getElementById('popup-name').textContent = emergency.patient_name || 'Unknown';
    document.getElementById('popup-age').textContent = emergency.patient_age || 'Unknown';
    document.getElementById('popup-mobile').textContent = emergency.patient_mobile || 'Unknown';
    document.getElementById('popup-emergency').textContent = 'Medical Emergency'; // Default
    document.getElementById('popup-location').textContent = emergency.address || 'Current Location';
    
    // Show the popup
    document.getElementById('emergency-popup').style.display = 'block';
    
    // Update status
    document.getElementById('status-indicator').textContent = 'Emergency Alert';
    document.getElementById('status-indicator').className = 'status-indicator status-busy';
    
    // Start timer
    startEmergencyTimer();
    
    // Set patient location on map
    if (emergency.patient_location) {
        setPatientLocation(emergency.patient_location, emergency.patient_name);
    } else {
        console.warn("⚠️ No patient location data in emergency");
    }
}

function startEmergencyTimer() {
    clearInterval(emergencyTimer);
    
    // Update timer display immediately
    document.getElementById('emergency-timer').textContent = timeLeft + 's';
    
    emergencyTimer = setInterval(() => {
        timeLeft--;
        document.getElementById('emergency-timer').textContent = timeLeft + 's';
        
        if (timeLeft <= 0) {
            clearInterval(emergencyTimer);
            console.log("⏰ Emergency timer expired - auto declining");
            hideEmergencyPopup();
            // Auto-decline after timeout
            declineEmergency();
        }
    }, 1000);
}

function hideEmergencyPopup() {
    console.log("🎭 Hiding emergency popup");
    document.getElementById('emergency-popup').style.display = 'none';
    clearInterval(emergencyTimer);
    currentEmergency = null;
    
    // Reset status if not on mission
    if (!document.getElementById('mission-info').style.display || 
        document.getElementById('mission-info').style.display === 'none') {
        document.getElementById('status-indicator').textContent = 'Available';
        document.getElementById('status-indicator').className = 'status-indicator status-available';
    }
}

function acceptEmergency() {
    if (!currentEmergency) {
        alert('No emergency to accept');
        return;
    }
    
    console.log("✅ Accepting emergency:", currentEmergency.emergency_id);
    
    // Disable buttons during processing
    const acceptBtn = document.querySelector('.accept-btn');
    const declineBtn = document.querySelector('.decline-btn');
    acceptBtn.disabled = true;
    declineBtn.disabled = true;
    acceptBtn.textContent = 'Processing...';
    
    fetch(`${BASE_URL}/api/accept_emergency`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ emergency_id: currentEmergency.emergency_id })
    })
    .then(response => response.json())
    .then(data => {
        console.log("📨 Accept emergency response:", data);
        
        if (data.status === 'accepted') {
            hideEmergencyPopup();
            startMission(data.emergency || currentEmergency);
            alert('Emergency accepted! Route to patient calculated.');
        } else {
            alert('Error accepting emergency: ' + (data.message || 'Unknown error'));
            acceptBtn.disabled = false;
            declineBtn.disabled = false;
            acceptBtn.textContent = '✅ ACCEPT';
        }
    })
    .catch(error => {
        console.error('Error accepting emergency:', error);
        alert('Error accepting emergency. Please try again.');
        acceptBtn.disabled = false;
        declineBtn.disabled = false;
        acceptBtn.textContent = '✅ ACCEPT';
    });
}

function declineEmergency() {
    if (!currentEmergency) {
        alert('No emergency to decline');
        return;
    }
    
    console.log("❌ Declining emergency:", currentEmergency.emergency_id);
    
    // Disable buttons during processing
    const acceptBtn = document.querySelector('.accept-btn');
    const declineBtn = document.querySelector('.decline-btn');
    acceptBtn.disabled = true;
    declineBtn.disabled = true;
    declineBtn.textContent = 'Processing...';
    
    fetch(`${BASE_URL}/api/decline_emergency`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ emergency_id: currentEmergency.emergency_id })
    })
    .then(response => response.json())
    .then(data => {
        console.log("📨 Decline emergency response:", data);
        
        if (data.status === 'declined') {
            hideEmergencyPopup();
            // Reset status to available
            document.getElementById('status-indicator').textContent = 'Available';
            document.getElementById('status-indicator').className = 'status-indicator status-available';
            alert('Emergency declined. Waiting for next assignment.');
        } else {
            alert('Error declining emergency: ' + (data.message || 'Unknown error'));
            acceptBtn.disabled = false;
            declineBtn.disabled = false;
            declineBtn.textContent = '❌ DECLINE';
        }
    })
    .catch(error => {
        console.error('Error declining emergency:', error);
        alert('Error declining emergency. Please try again.');
        acceptBtn.disabled = false;
        declineBtn.disabled = false;
        declineBtn.textContent = '❌ DECLINE';
    });
}

function startMission(emergency) {
    console.log("🎯 Starting mission:", emergency);
    
    currentMission = emergency;
    document.getElementById('mission-info').style.display = 'block';
    document.getElementById('status-indicator').textContent = 'On Mission - Pickup';
    document.getElementById('status-indicator').className = 'status-indicator status-busy';
    
    // Update mission details
    document.getElementById('mission-patient').textContent = emergency.patient_name || 'Unknown';
    document.getElementById('mission-age').textContent = emergency.patient_age || 'Unknown';
    document.getElementById('mission-mobile').textContent = emergency.patient_mobile || 'Unknown';
    document.getElementById('mission-emergency').textContent = 'Medical Emergency'; // Default value
    
    // Update your status in system panel
    document.getElementById('your-status').textContent = 'On Mission - Pickup';
    
    // Show hospital search section
    document.getElementById('hospital-search-section').style.display = 'block';
    
    // Ensure patient location is set on map
    if (emergency.patient_location && !patientMarker) {
        setPatientLocation(emergency.patient_location, emergency.patient_name);
        // ADDED: Calculate route to patient
        calculateRouteToPatient(emergency.patient_location);
    }
    
    // Start checking if reached patient
    startPatientArrivalCheck();
}

function startPatientArrivalCheck() {
    const arrivalCheck = setInterval(() => {
        if (!currentMission || !currentLocation || !patientMarker) return;
        
        const patientLoc = patientMarker.getLatLng();
        const distance = calculateDistance(
            currentLocation.lat, currentLocation.lon,
            patientLoc.lat, patientLoc.lng
        );
        
        // Keep showing routing distance, but check straight-line for arrival
        if (distance <= 50) {
            clearInterval(arrivalCheck);
            patientPickedUp();
        }
    }, 3000);
}

function patientPickedUp() {
    console.log("✅ Patient picked up");
    document.getElementById('status-indicator').textContent = 'On Mission - To Hospital';
    document.getElementById('your-status').textContent = 'On Mission - To Hospital';
    document.getElementById('mission-distance').textContent = 'Patient picked up - Select hospital';
    
    // ADDED: Clear patient route when picked up
    clearRoute();
    
    alert('Patient picked up! Please search and select a hospital destination.');
    
    // Show hospital search prominently
    document.getElementById('hospital-search-section').style.display = 'block';
}

// REAL OSM Hospital Search Functions
function searchHospitals() {
    const searchInput = document.getElementById('hospital-search');
    const query = searchInput.value.trim();
    
    if (!query) {
        alert('Please enter a hospital name or area to search');
        return;
    }
    
    console.log("🏥 Searching hospitals on OSM:", query);
    
    // Show loading
    const searchBtn = document.querySelector('.search-hospital-btn');
    const originalText = searchBtn.textContent;
    searchBtn.textContent = 'Searching OSM...';
    searchBtn.disabled = true;
    
    // Clear previous results
    document.getElementById('hospital-list').innerHTML = '<div class="no-results">Searching OpenStreetMap...</div>';
    
    // Use Nominatim API for OSM search
    searchOSMHospitals(query)
        .then(hospitals => {
            displayHospitals(hospitals);
            searchBtn.textContent = originalText;
            searchBtn.disabled = false;
        })
        .catch(error => {
            console.error('OSM Search error:', error);
            document.getElementById('hospital-list').innerHTML = '<div class="no-results">Error searching hospitals. Please try again.</div>';
            searchBtn.textContent = originalText;
            searchBtn.disabled = false;
        });
}

function searchOSMHospitals(query) {
    // OSM Nominatim API for hospital search
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ' hospital bangalore')}&limit=10&addressdetails=1`;
    
    return fetch(url)
        .then(response => response.json())
        .then(data => {
            console.log("🏥 OSM Search results:", data);
            
            const hospitals = data.map(item => {
                // Calculate distance from current location
                let distance = 'Unknown';
                if (currentLocation) {
                    const dist = calculateDistance(
                        currentLocation.lat, currentLocation.lon,
                        parseFloat(item.lat), parseFloat(item.lon)
                    );
                    distance = (dist / 1000).toFixed(1) + ' km';
                }
                
                return {
                    name: item.display_name.split(',')[0] || 'Hospital',
                    address: item.display_name,
                    distance: distance,
                    location: { 
                        lat: parseFloat(item.lat), 
                        lon: parseFloat(item.lon) 
                    },
                    osmData: item
                };
            });
            
            return hospitals;
        });
}

function displayHospitals(hospitals) {
    const hospitalList = document.getElementById('hospital-list');
    hospitalList.innerHTML = '';
    
    if (hospitals.length === 0) {
        hospitalList.innerHTML = '<div class="no-results">No hospitals found. Try a different search.</div>';
        return;
    }
    
    hospitals.forEach((hospital, index) => {
        const hospitalItem = document.createElement('div');
        hospitalItem.className = 'hospital-item';
        hospitalItem.innerHTML = `
            <div class="hospital-info">
                <strong>🏥 ${hospital.name}</strong>
                <div class="hospital-address">📍 ${hospital.address.substring(0, 80)}${hospital.address.length > 80 ? '...' : ''}</div>
                <div class="hospital-distance">📏 ${hospital.distance} away</div>
            </div>
            <button class="select-hospital-btn" onclick="selectHospital(${index})">Select</button>
        `;
        
        // Store hospital data for selection
        hospitalItem.dataset.hospitalData = JSON.stringify(hospital);
        
        hospitalList.appendChild(hospitalItem);
    });
}

function selectHospital(index) {
    const hospitalItems = document.querySelectorAll('.hospital-item');
    if (hospitalItems[index]) {
        const hospitalData = JSON.parse(hospitalItems[index].dataset.hospitalData);
        setHospitalDestination(hospitalData);
    }
}

function setHospitalDestination(hospital) {
    console.log("🎯 Setting hospital destination:", hospital);
    
    // Remove existing hospital marker
    if (hospitalMarker) {
        map.removeLayer(hospitalMarker);
    }
    
    // Add hospital marker
    hospitalMarker = L.marker([hospital.location.lat, hospital.location.lon])
        .addTo(map)
        .bindPopup(`🏥 ${hospital.name}<br>${hospital.address}<br><strong>Hospital Destination</strong>`)
        .openPopup();
    
    // Add blue circle around hospital
    L.circle([hospital.location.lat, hospital.location.lon], {
        color: 'blue',
        fillColor: '#007bff',
        fillOpacity: 0.1,
        radius: 200
    }).addTo(map).bindPopup('Hospital Destination');
    
    // Update mission status
    document.getElementById('status-indicator').textContent = 'On Mission - To Hospital';
    document.getElementById('your-status').textContent = 'On Mission - To Hospital';
    
    // Update mission info with hospital details
    document.getElementById('mission-distance').textContent = `Going to ${hospital.name}`;
    
    // Show hospital destination in mission info
    const missionDetails = document.querySelector('.mission-details');
    if (!document.getElementById('hospital-destination')) {
        const hospitalElement = document.createElement('p');
        hospitalElement.id = 'hospital-destination';
        hospitalElement.innerHTML = `<strong>Hospital:</strong> ${hospital.name}`;
        missionDetails.appendChild(hospitalElement);
    } else {
        document.getElementById('hospital-destination').innerHTML = `<strong>Hospital:</strong> ${hospital.name}`;
    }
    
    // ADDED: Calculate route to hospital
    calculateRouteToHospital(hospital.location);
    
    // Start hospital arrival check
    startHospitalArrivalCheck(hospital);
    
    alert(`Hospital set: ${hospital.name}\nRoute to hospital calculated.`);
}

// ADDED: Function to calculate route to hospital
function calculateRouteToHospital(hospitalLocation) {
    // Clear any existing route
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }
    
    console.log("🛣️ Calculating route to hospital...");
    
    routingControl = L.Routing.control({
        waypoints: [
            L.latLng(currentLocation.lat, currentLocation.lon),
            L.latLng(hospitalLocation.lat, hospitalLocation.lon)
        ],
        routeWhileDragging: false,
        showAlternatives: false,
        lineOptions: {
            styles: [{ color: '#2196F3', opacity: 0.8, weight: 6 }]
        },
        createMarker: function(i, waypoint, n) {
            return null;
        }
    }).addTo(map);
    
    routingControl.on('routesfound', function(e) {
        const routes = e.routes;
        const route = routes[0];
        const distance = (route.summary.totalDistance / 1000).toFixed(1);
        const time = Math.round(route.summary.totalTime / 60);
        
        console.log(`🏥 Route to hospital: ${distance} km, ${time} minutes`);
        
        // Send hospital routing distance to server
        sendRoutingDistanceToServer(route.summary.totalDistance, time);
        
        document.getElementById('mission-distance').textContent = 
            `${Math.round(route.summary.totalDistance)}m to hospital - ${time} min`;
    });
}

function startHospitalArrivalCheck(hospital) {
    const arrivalCheck = setInterval(() => {
        if (!currentMission || !currentLocation || !hospitalMarker) return;
        
        const hospitalLoc = hospitalMarker.getLatLng();
        const distance = calculateDistance(
            currentLocation.lat, currentLocation.lon,
            hospitalLoc.lat, hospitalLoc.lng
        );
        
        // Update distance display
        if (document.getElementById('hospital-destination')) {
            document.getElementById('hospital-destination').innerHTML = 
                `<strong>Hospital:</strong> ${hospital.name} (${Math.round(distance)}m away)`;
        }
        
        // If within 20 meters, consider arrived at hospital
        if (distance <= 20) {
            clearInterval(arrivalCheck);
            arrivedAtHospital();
        }
    }, 3000);
}

function arrivedAtHospital() {
    console.log("🎉 Arrived at hospital");
    // ADDED: Clear route when mission completed
    clearRoute();
    alert('Arrived at hospital! Mission completed.');
    completeMission();
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
}

function completeMission() {
    console.log("🎉 Completing mission");
    
    // ADDED: Clear route when mission completed
    clearRoute();
    
    fetch(`${BASE_URL}/api/complete_mission`, {method: 'POST'})
    .then(response => response.json())
    .then(data => {
        console.log("📨 Complete mission response:", data);
        
        if (data.status === 'completed') {
            // Reset everything
            document.getElementById('mission-info').style.display = 'none';
            document.getElementById('hospital-search-section').style.display = 'none';
            document.getElementById('status-indicator').textContent = 'Available';
            document.getElementById('status-indicator').className = 'status-indicator status-available';
            document.getElementById('your-status').textContent = 'Available';
            
            // Clear markers
            if (patientMarker) {
                map.removeLayer(patientMarker);
                patientMarker = null;
            }
            if (hospitalMarker) {
                map.removeLayer(hospitalMarker);
                hospitalMarker = null;
            }
            
            // Clear search
            document.getElementById('hospital-search').value = '';
            document.getElementById('hospital-list').innerHTML = '';
            
            currentMission = null;
            currentEmergency = null;
            
            alert('Mission completed! Ready for next emergency.');
            updateSystemStatus();
        } else {
            alert('Error completing mission: ' + (data.message || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('Error completing mission:', error);
        alert('Error completing mission. Please try again.');
    });
}

function setPatientLocation(location, patientName) {
    console.log("📍 Setting patient location:", location, patientName);
    
    if (patientMarker) {
        map.removeLayer(patientMarker);
    }
    
    patientMarker = L.marker([location.lat, location.lon])
        .addTo(map)
        .bindPopup(`🚨 ${patientName || 'Patient'}<br>Emergency Location`)
        .openPopup();
    
    // Add red circle around patient
    L.circle([location.lat, location.lon], {
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.1,
        radius: 200
    }).addTo(map).bindPopup('Patient Location');
    
    // Fit map to show both ambulance and patient
    if (ambulanceMarker) {
        const group = L.featureGroup([ambulanceMarker, patientMarker]);
        map.fitBounds(group.getBounds().pad(0.1));
    }
    
    console.log("✅ Patient location set on map");
}

function updateSystemStatus() {
    fetch(`${BASE_URL}/api/get_system_status`)
    .then(response => response.json())
    .then(data => {
        if (data.status !== 'error') {
            document.getElementById('active-count').textContent = data.active_ambulances || 0;
            document.getElementById('pending-count').textContent = data.pending_emergencies || 0;
        }
    })
    .catch(error => {
        console.error('Error updating system status:', error);
    });
}

function centerOnAmbulance() {
    if (ambulanceMarker) {
        map.setView(ambulanceMarker.getLatLng(), 16);
    } else if (currentLocation) {
        map.setView([currentLocation.lat, currentLocation.lon], 16);
    }
}

// Update system status every 10 seconds
setInterval(updateSystemStatus, 10000);

// Enter key support for login and hospital search
document.getElementById('password').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        login();
    }
});

document.getElementById('hospital-search').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchHospitals();
    }
});