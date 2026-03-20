# app.py - Run this on your PC only
from flask import Flask, render_template, request, jsonify, session
from flask_socketio import SocketIO
import requests
import time

app = Flask(__name__)
app.config['SECRET_KEY'] = 'ambulance_dashboard_2024'
socketio = SocketIO(app, cors_allowed_origins="*")

# Raspberry Pi Server URL - YOUR RASPBERRY PI IP
RASPBERRY_PI_SERVER = "http://192.168.50.95:5000"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'status': 'error', 'message': 'Username and password required'}), 401
    
    # First check if Raspberry Pi server is online
    try:
        health_response = requests.get(f"{RASPBERRY_PI_SERVER}/api/health", timeout=5)
        if health_response.status_code != 200:
            return jsonify({'status': 'error', 'message': 'Server is offline'}), 503
    except requests.exceptions.RequestException:
        return jsonify({'status': 'error', 'message': 'Cannot connect to server'}), 503
    
    # Now try to login with Raspberry Pi server
    try:
        login_data = {
            'username': username,
            'password': password
        }
        
        login_response = requests.post(f"{RASPBERRY_PI_SERVER}/login", 
                                     json=login_data, timeout=10)
        
        if login_response.status_code == 200:
            response_data = login_response.json()
            if response_data.get('status') == 'success':
                session['driver_id'] = username
                session['driver_name'] = response_data.get('driver_name')
                session['ambulance_no'] = response_data.get('ambulance_no')
                
                return jsonify({
                    'status': 'success',
                    'message': 'Login successful',
                    'driver_name': response_data.get('driver_name'),
                    'ambulance_no': response_data.get('ambulance_no')
                })
        
        return jsonify({'status': 'error', 'message': 'Invalid credentials'}), 401
        
    except requests.exceptions.RequestException as e:
        return jsonify({'status': 'error', 'message': 'Login failed: Server error'}), 503

@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'status': 'success', 'message': 'Logged out'})

@app.route('/api/send_location', methods=['POST'])
def send_location():
    """Send ambulance location to Raspberry Pi server"""
    if 'driver_id' not in session:
        return jsonify({'status': 'error', 'message': 'Not logged in'}), 401
    
    data = request.json
    driver_id = session['driver_id']
    
    location_data = {
        'driver_id': driver_id,
        'location': data['location'],
        'driver_name': session['driver_name'],
        'ambulance_no': session['ambulance_no']
    }
    
    try:
        response = requests.post(f"{RASPBERRY_PI_SERVER}/api/register_ambulance", 
                               json=location_data, timeout=5)
        return jsonify({'status': 'location_sent'})
    except requests.exceptions.RequestException as e:
        return jsonify({'status': 'error', 'message': 'Cannot send location to server'}), 500

# ADDED: New endpoint to send routing distance to Raspberry Pi
@app.route('/api/routing_distance', methods=['POST'])
def send_routing_distance():
    """Send routing distance to Raspberry Pi server"""
    if 'driver_id' not in session:
        return jsonify({'status': 'error', 'message': 'Not logged in'}), 401
    
    data = request.json
    driver_id = session['driver_id']
    
    routing_data = {
        'driver_id': driver_id,
        'routing_distance': data.get('routing_distance'),
        'estimated_time': data.get('estimated_time'),
        'emergency_id': data.get('emergency_id'),
        'driver_name': session['driver_name'],
        'ambulance_no': session['ambulance_no']
    }
    
    try:
        # Send routing distance to Raspberry Pi server
        # Note: You might need to create this endpoint on your Raspberry Pi server
        response = requests.post(f"{RASPBERRY_PI_SERVER}/api/routing_distance", 
                               json=routing_data, timeout=5)
        
        print(f"📍 Routing distance sent to Raspberry Pi: {data.get('routing_distance')}m")
        return jsonify({'status': 'routing_distance_received'})
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to send routing distance: {e}")
        return jsonify({'status': 'error', 'message': 'Cannot send routing distance to server'}), 500

@app.route('/api/get_my_emergencies', methods=['GET'])
def get_my_emergencies():
    """Get emergencies assigned to this driver"""
    if 'driver_id' not in session:
        return jsonify({'status': 'error', 'message': 'Not logged in'}), 401
    
    driver_id = session['driver_id']
    
    try:
        response = requests.get(f"{RASPBERRY_PI_SERVER}/api/get_pending_emergencies?driver_id={driver_id}", 
                              timeout=5)
        return response.json()
    except requests.exceptions.RequestException as e:
        return jsonify({'status': 'error', 'message': 'Cannot fetch emergencies'}), 500

@app.route('/api/accept_emergency', methods=['POST'])
def accept_emergency():
    """Accept emergency on Raspberry Pi server"""
    if 'driver_id' not in session:
        return jsonify({'status': 'error', 'message': 'Not logged in'}), 401
    
    data = request.json
    
    accept_data = {
        'driver_id': session['driver_id'],
        'emergency_id': data['emergency_id']
    }
    
    try:
        response = requests.post(f"{RASPBERRY_PI_SERVER}/api/accept_emergency", 
                               json=accept_data, timeout=5)
        return response.json()
    except requests.exceptions.RequestException as e:
        return jsonify({'status': 'error', 'message': 'Cannot accept emergency'}), 500

@app.route('/api/decline_emergency', methods=['POST'])
def decline_emergency():
    """Decline emergency on Raspberry Pi server"""
    if 'driver_id' not in session:
        return jsonify({'status': 'error', 'message': 'Not logged in'}), 401
    
    data = request.json
    
    decline_data = {
        'driver_id': session['driver_id'],
        'emergency_id': data['emergency_id']
    }
    
    try:
        response = requests.post(f"{RASPBERRY_PI_SERVER}/api/decline_emergency", 
                               json=decline_data, timeout=5)
        return response.json()
    except requests.exceptions.RequestException as e:
        return jsonify({'status': 'error', 'message': 'Cannot decline emergency'}), 500

@app.route('/api/complete_mission', methods=['POST'])
def complete_mission():
    """Complete mission on Raspberry Pi server"""
    if 'driver_id' not in session:
        return jsonify({'status': 'error', 'message': 'Not logged in'}), 401
    
    complete_data = {
        'driver_id': session['driver_id']
    }
    
    try:
        response = requests.post(f"{RASPBERRY_PI_SERVER}/api/complete_mission", 
                               json=complete_data, timeout=5)
        return response.json()
    except requests.exceptions.RequestException as e:
        return jsonify({'status': 'error', 'message': 'Cannot complete mission'}), 500

@app.route('/api/get_system_status', methods=['GET'])
def get_system_status():
    """Get system status from Raspberry Pi server"""
    try:
        response = requests.get(f"{RASPBERRY_PI_SERVER}/api/get_system_status", timeout=5)
        return response.json()
    except requests.exceptions.RequestException as e:
        return jsonify({'status': 'error', 'message': 'Cannot get system status'}), 500

if __name__ == '__main__':
    print("🚑 Ambulance Dashboard Starting...")
    print("📍 Web App running on: http://localhost:3000")
    print("🔗 Connected to Raspberry Pi Server:", RASPBERRY_PI_SERVER)
    print("🛣️  ROUTING FEATURE ENABLED - Road distance calculation active")
    
    socketio.run(app, host='0.0.0.0', port=3000, debug=True)