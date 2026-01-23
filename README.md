## Abstract

Urban traffic congestion significantly impacts emergency response times, particularly for ambulances operating in densely populated cities. This project presents an **IoT-enabled Automatic Green Signal Preemption System** that prioritizes ambulances at signalized intersections using **GPS tracking** and **LoRa-based long-range communication**. 

The proposed system enables ambulances to continuously transmit their real-time location to upcoming traffic junctions, allowing automatic green signal allocation along the ambulance route. A web-based control dashboard integrated with offline routing assists emergency operators in navigation and coordination. Experimental results demonstrate a significant reduction in ambulance waiting time at intersections, validating the effectiveness of the system for smart city deployments.

---

## Keywords

Smart Traffic Management, Ambulance Priority, Internet of Things (IoT), LoRa Communication, GPS Tracking, Emergency Response Systems, Smart Cities

---

## Problem Statement

Urban traffic congestion severely affects ambulance response times. Existing traffic signal systems lack real-time coordination with emergency vehicles, leading to unnecessary delays at signalized intersections. Manual traffic clearance methods are inefficient, unsafe, and unreliable during peak traffic conditions.

---

## Objectives

The primary objectives of this project are:

- To design an automatic traffic signal preemption system for ambulances  
- To enable real-time ambulance-to-junction communication using LoRa technology  
- To reduce ambulance waiting time at traffic intersections  
- To provide a web-based emergency monitoring and routing interface  
- To support both simulation-based testing and real-field deployment  

---

## System Architecture

The proposed system consists of the following major components:

1. **Ambulance Unit**
   - ESP32 microcontroller
   - GPS module / simulated GPS coordinates
   - LoRa transmitter for long-range communication

2. **Traffic Junction Unit**
   - Arduino-based traffic signal controller
   - LoRa receiver
   - Automatic signal preemption logic
   - Buzzer alert for emergency indication

3. **Central Server (Raspberry Pi / PC)**
   - Flask-based backend API
   - Emergency management logic
   - Offline OSRM routing engine (Docker-based)

4. **Web-Based Control Dashboard**
   - Emergency notification and acceptance
   - Live ambulance tracking
   - Route visualization and ETA estimation

---

## Working Principle

1. When an emergency request is accepted, the ambulance unit begins transmitting its GPS coordinates using LoRa.
2. The traffic junction unit receives ambulance location updates and calculates distance and bearing.
3. When the ambulance enters a predefined radius (e.g., 300 meters), traffic signal preemption is activated.
4. The corresponding approach direction is granted a green signal, and other signals are held red.
5. Once the ambulance crosses the junction, normal traffic operation is restored.
6. The web dashboard provides real-time visualization and routing assistance throughout the process.

---

## Experimental Results and Discussion

Experimental testing was conducted using both simulation and controlled field trials. The results indicate:

- Significant reduction in ambulance waiting time at intersections  
- Reliable long-range communication using LoRa at urban distances  
- Accurate direction-based signal preemption  
- Stable system performance under repeated emergency scenarios  

These results demonstrate the feasibility of deploying the proposed system in real-world smart city environments.

---

## Conclusion

This project successfully demonstrates an intelligent, low-cost, and scalable solution for ambulance signal preemption using IoT and LoRa communication. By integrating real-time vehicle tracking, automated traffic control, and web-based monitoring, the system improves emergency response efficiency and enhances urban traffic management. The proposed architecture is suitable for further expansion to city-wide deployment and integration with smart city infrastructure.

---

## Future Scope

- Integration with multiple ambulances simultaneously  
- Dynamic hospital selection based on real-time traffic conditions  
- AI-based traffic prediction and optimization  
- Integration with government traffic management systems  

---

## Repository Structure

```text
AutoGreen_Ambulance/
│
├── ambulance_lora/        # ESP32 ambulance code
├── junction_lora/         # Arduino traffic junction code
├── server/                # Flask backend APIs
├── web_app/               # Web-based dashboard (HTML, CSS, JS)
├── osrm/                  # Offline routing data (Docker)
└── README.md
