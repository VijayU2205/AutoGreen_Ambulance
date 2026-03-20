from flask import Flask, request, jsonify
from flask_cors import CORS
import math
import random
import time
from datetime import datetime
import requests
import copy

app = Flask(__name__)
CORS(app)

# ================= CONFIG =================
ACCEPT_TIMEOUT_SECONDS = 25
OSRM_URL = "http://router.project-osrm.org"

# ================= DEMO DB =================
users_db = {
    'driver1': {'password': 'driver123', 'name': 'Sunjay Kumar', 'ambulance_no': 'KA01AB1234'},
    'driver2': {'password': 'driver123', 'name': 'Suresh Patel', 'ambulance_no': 'KA01CD5678'},
    'driver3': {'password': 'driver123', 'name': 'Anil Sharma', 'ambulance_no': 'KA01EF9012'}
}

# ================= RUNTIME =================
active_ambulances = {}
pending_emergencies = []
current_assignments = {}
emergency_status = {}

# ================= HELPERS =================
def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)

    a = (math.sin(dphi/2)**2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(dlam/2)**2)

    return R * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def routing_distance(lat1, lon1, lat2, lon2):
    try:
        url = f"{OSRM_URL}/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false"
        r = requests.get(url, timeout=3).json()
        return r["routes"][0]["distance"]
    except:
        return calculate_distance(lat1, lon1, lat2, lon2)


def find_nearest(patient):
    best = None
    best_dist = float("inf")

    for d_id, amb in active_ambulances.items():
        if amb["status"] != "available":
            continue

        loc = amb["location"]
        dist = routing_distance(patient["lat"], patient["lon"], loc["lat"], loc["lon"])

        if dist < best_dist:
            best_dist = dist
            best = d_id

    return best


# ================= LOGIN =================
@app.route('/login', methods=['POST'])
def login():
    data = request.json
    user = users_db.get(data["username"])

    if user and user["password"] == data["password"]:
        return jsonify({
            "status": "success",
            "driver_name": user["name"],
            "ambulance_no": user["ambulance_no"]
        })

    return jsonify({"status": "error"}), 401


# ================= LOCATION =================
@app.route('/api/send_location', methods=['POST'])
def send_location():
    data = request.json
    driver_id = data["driver_id"]
    location = data["location"]

    if driver_id not in active_ambulances:
        active_ambulances[driver_id] = {
            "location": location,
            "status": "available",
            "last_update": datetime.now().isoformat()
        }
    else:
        active_ambulances[driver_id]["location"] = location

    check_timeouts()
    assign_pending()

    return jsonify({"status": "ok"})


# ================= EMERGENCY =================
@app.route('/api/emergency', methods=['POST'])
def emergency():
    data = request.json

    eid = f"em_{int(time.time())}"

    e = {
        "emergency_id": eid,
        "patient_name": data["name"],
        "patient_location": {
            "lat": data["latitude"],
            "lon": data["longitude"]
        },
        "status": "pending",
        "assigned_to": None,
        "assigned_time": None
    }

    emergency_status[eid] = {
        "status": "searching",
        "assigned_ambulance": None,
        "routing_distance": None
    }

    pending_emergencies.append(e)
    assign_pending()

    return jsonify({"status": "received", "emergency_id": eid})


# ================= ASSIGN =================
def assign_pending():
    for e in pending_emergencies:
        if e["assigned_to"] is None:
            d = find_nearest(e["patient_location"])
            if d:
                e["assigned_to"] = d
                e["assigned_time"] = time.time()

                emergency_status[e["emergency_id"]]["assigned_ambulance"] = d
                emergency_status[e["emergency_id"]]["status"] = "assigned"

                active_ambulances[d]["status"] = "pending_accept"


# ================= TIMEOUT =================
def check_timeouts():
    now = time.time()

    for e in pending_emergencies:
        if e["assigned_to"] and e["assigned_time"]:
            if now - e["assigned_time"] > ACCEPT_TIMEOUT_SECONDS:

                d = e["assigned_to"]
                active_ambulances[d]["status"] = "available"

                e["assigned_to"] = None
                e["assigned_time"] = None


# ================= DRIVER VIEW =================
@app.route('/api/get_my_emergencies')
def get_my():
    driver_id = request.args.get("driver_id")

    out = []
    for e in pending_emergencies:
        if e["assigned_to"] == driver_id:
            out.append(e)

    return jsonify({"emergencies": out})


# ================= ACCEPT =================
@app.route('/api/accept_emergency', methods=['POST'])
def accept():
    data = request.json
    eid = data["emergency_id"]
    driver_id = data["driver_id"]

    for e in pending_emergencies:
        if e["emergency_id"] == eid:
            active_ambulances[driver_id]["status"] = "busy"
            current_assignments[driver_id] = eid

            emergency_status[eid]["status"] = "accepted"

            pending_emergencies.remove(e)

            return jsonify({"status": "accepted"})

    return jsonify({"status": "error"})


# ================= DECLINE =================
@app.route('/api/decline_emergency', methods=['POST'])
def decline():
    data = request.json
    eid = data["emergency_id"]
    driver_id = data["driver_id"]

    for e in pending_emergencies:
        if e["emergency_id"] == eid:
            active_ambulances[driver_id]["status"] = "available"
            e["assigned_to"] = None
            return jsonify({"status": "declined"})

    return jsonify({"status": "error"})


# ================= ROUTING =================
@app.route('/api/routing_distance', methods=['POST'])
def routing_update():
    data = request.json
    eid = data["emergency_id"]

    emergency_status[eid]["routing_distance"] = data["routing_distance"]
    emergency_status[eid]["estimated_time"] = data["estimated_time"]

    return jsonify({"status": "ok"})


# ================= STATUS =================
@app.route('/api/emergency_status/<eid>')
def status(eid):
    return jsonify(emergency_status.get(eid, {}))


# ================= COMPLETE =================
@app.route('/api/complete_mission', methods=['POST'])
def complete():
    driver_id = request.json["driver_id"]

    if driver_id in current_assignments:
        eid = current_assignments[driver_id]

        active_ambulances[driver_id]["status"] = "available"
        emergency_status[eid]["status"] = "completed"

        del current_assignments[driver_id]

    return jsonify({"status": "completed"})


# ================= HEALTH =================
@app.route('/api/get_system_status')
def system():
    return jsonify({
        "active": len(active_ambulances),
        "pending": len(pending_emergencies)
    })


# ================= DEBUG =================
@app.route('/api/debug')
def debug():
    return jsonify({
        "ambulances": active_ambulances,
        "pending": pending_emergencies,
        "assignments": current_assignments
    })


# ================= MAIN =================
if __name__ == "__main__":
    print("🚑 Server running on port 5000")
    app.run(host="0.0.0.0", port=5000, debug=True)