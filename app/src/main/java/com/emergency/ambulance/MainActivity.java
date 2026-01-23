package com.emergency.ambulance;

import android.Manifest;
import android.app.ProgressDialog;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.os.Handler;
import android.os.Looper;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresPermission;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;

import org.json.JSONException;
import org.json.JSONObject;

public class MainActivity extends AppCompatActivity {

    private TextView serverStatusTextView, statusTextView, driverStatusTextView, timerTextView;
    private EditText nameEditText, ageEditText, mobileEditText, otpEditText;
    private Button sendOtpButton, loginButton, resendOtpButton, emergencyButton;
    private LinearLayout loginSection, otpSection, emergencySection;

    private ServerManager serverManager;

    private String currentRequestId = "";
    private String userName = "", userAge = "", userMobile = "";
    private CountDownTimer resendTimer;

    private Handler statusHandler;
    private Runnable statusRunnable;

    private LocationManager locationManager;
    private LocationListener locationListener;
    private Location bestLocation = null;
    private boolean waitingForFreshLocation = false;

    private ProgressDialog progressDialog;

    private Handler gpsTimeoutHandler = new Handler(Looper.getMainLooper());
    private Runnable gpsTimeoutRunnable;

    private static final int LOCATION_PERMISSION_REQUEST_CODE = 1001;
    private static final int RESEND_TIMER_DURATION = 30000;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        initializeViews();
        serverManager = ServerManager.getInstance(this);

        checkServerConnection();
        setupClickListeners();
        requestLocationPermissions();
    }

    private void initializeViews() {
        serverStatusTextView = findViewById(R.id.serverStatusTextView);
        statusTextView = findViewById(R.id.statusTextView);
        driverStatusTextView = findViewById(R.id.driverStatusTextView);
        timerTextView = findViewById(R.id.timerTextView);

        nameEditText = findViewById(R.id.nameEditText);
        ageEditText = findViewById(R.id.ageEditText);
        mobileEditText = findViewById(R.id.mobileEditText);
        otpEditText = findViewById(R.id.otpEditText);

        sendOtpButton = findViewById(R.id.sendOtpButton);
        loginButton = findViewById(R.id.loginButton);
        resendOtpButton = findViewById(R.id.resendOtpButton);
        emergencyButton = findViewById(R.id.emergencyButton);

        loginSection = findViewById(R.id.loginSection);
        otpSection = findViewById(R.id.otpSection);
        emergencySection = findViewById(R.id.emergencySection);
    }

    private void setupClickListeners() {
        sendOtpButton.setOnClickListener(v -> sendOtp());
        loginButton.setOnClickListener(v -> verifyOtp());
        resendOtpButton.setOnClickListener(v -> resendOtp());
        emergencyButton.setOnClickListener(v -> onEmergencyPressed());
    }

    private void checkServerConnection() {
        serverStatusTextView.setText("Checking server connection...");

        serverManager.checkServerHealth(new ServerManager.ServerCallback() {
            @Override
            public void onSuccess(JSONObject res) {
                runOnUiThread(() -> {
                    serverStatusTextView.setText("✅ Server Connected");
                    serverStatusTextView.setBackgroundColor(0xFFC8E6C9);
                    updateStatus("Server OK");
                });
            }

            @Override
            public void onError(String err) {
                runOnUiThread(() -> {
                    serverStatusTextView.setText("❌ Server Disconnected");
                    serverStatusTextView.setBackgroundColor(0xFFFFCDD2);
                    updateStatus("Server offline: " + err);
                });
            }
        });
    }

    private void sendOtp() {
        userName = nameEditText.getText().toString().trim();
        userAge = ageEditText.getText().toString().trim();
        userMobile = mobileEditText.getText().toString().trim();

        if (userName.isEmpty() || userAge.isEmpty() || userMobile.isEmpty()) {
            Toast.makeText(this, "Please fill all fields", Toast.LENGTH_SHORT).show();
            return;
        }

        updateStatus("Sending OTP...");
        sendOtpButton.setEnabled(false);

        serverManager.sendOtpRequest(userName, userAge, userMobile, new ServerManager.ServerCallback() {
            @Override
            public void onSuccess(JSONObject res) {
                runOnUiThread(() -> {
                    try {
                        currentRequestId = res.getString("request_id");
                        String otp = res.getString("otp");

                        otpSection.setVisibility(LinearLayout.VISIBLE);
                        startResendTimer();

                        updateStatus("OTP sent: " + otp);
                        Toast.makeText(MainActivity.this, "OTP: " + otp, Toast.LENGTH_LONG).show();

                    } catch (JSONException e) {
                        updateStatus("Error reading OTP response");
                    }
                    sendOtpButton.setEnabled(true);
                });
            }

            @Override
            public void onError(String err) {
                runOnUiThread(() -> {
                    updateStatus("OTP failed: " + err);
                    sendOtpButton.setEnabled(true);
                });
            }
        });
    }

    private void startResendTimer() {
        resendOtpButton.setEnabled(false);

        resendTimer = new CountDownTimer(RESEND_TIMER_DURATION, 1000) {
            @Override
            public void onTick(long ms) {
                timerTextView.setText("Resend in " + (ms / 1000) + "s");
            }

            @Override
            public void onFinish() {
                resendOtpButton.setEnabled(true);
                timerTextView.setText("Ready to resend");
            }
        }.start();
    }

    private void verifyOtp() {
        String otp = otpEditText.getText().toString().trim();

        if (otp.length() != 4) {
            Toast.makeText(this, "Enter valid 4-digit OTP", Toast.LENGTH_SHORT).show();
            return;
        }

        updateStatus("Verifying OTP...");
        loginButton.setEnabled(false);

        serverManager.verifyOtp(currentRequestId, otp, new ServerManager.ServerCallback() {
            @Override
            public void onSuccess(JSONObject res) {
                runOnUiThread(() -> {
                    try {
                        if (res.getBoolean("verified")) {
                            loginSection.setVisibility(LinearLayout.GONE);
                            emergencySection.setVisibility(LinearLayout.VISIBLE);
                            updateStatus("Login successful");
                        } else {
                            Toast.makeText(MainActivity.this, "Invalid OTP", Toast.LENGTH_SHORT).show();
                        }
                    } catch (JSONException e) {
                        updateStatus("Verification error");
                    }
                    loginButton.setEnabled(true);
                });
            }

            @Override
            public void onError(String err) {
                runOnUiThread(() -> {
                    updateStatus("OTP verify failed: " + err);
                    loginButton.setEnabled(true);
                });
            }
        });
    }

    private void resendOtp() {
        sendOtp();
    }

    // ------------------- FRESH GPS MODE -------------------
    private void onEmergencyPressed() {
        bestLocation = null;
        waitingForFreshLocation = true;
        startFreshLocationFetch();
    }

    @RequiresPermission(allOf = {Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION})
    private void startFreshLocationFetch() {
        if (!hasLocationPermission()) {
            requestLocationPermissions();
            return;
        }

        progressDialog = new ProgressDialog(this);
        progressDialog.setMessage("Fetching LIVE location…");
        progressDialog.setCancelable(false);
        progressDialog.show();

        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);

        locationListener = new LocationListener() {
            @Override
            public void onLocationChanged(@NonNull Location location) {

                if (bestLocation == null || location.getAccuracy() < bestLocation.getAccuracy()) {
                    bestLocation = location;
                }

                updateStatus("GPS: " + bestLocation.getLatitude() + ", " + bestLocation.getLongitude()
                        + " (Acc: " + bestLocation.getAccuracy() + "m)");

                // Only accept accurate location
                if (location.getAccuracy() <= 20 && waitingForFreshLocation) {
                    waitingForFreshLocation = false;
                    stopLocationListeners();
                    sendEmergency(bestLocation);
                }
            }
        };

        try {
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                // TODO: Consider calling
                //    ActivityCompat#requestPermissions
                // here to request the missing permissions, and then overriding
                //   public void onRequestPermissionsResult(int requestCode, String[] permissions,
                //                                          int[] grantResults)
                // to handle the case where the user grants the permission. See the documentation
                // for ActivityCompat#requestPermissions for more details.
                return;
            }
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                // TODO: Consider calling
                //    ActivityCompat#requestPermissions
                // here to request the missing permissions, and then overriding
                //   public void onRequestPermissionsResult(int requestCode, String[] permissions,
                //                                          int[] grantResults)
                // to handle the case where the user grants the permission. See the documentation
                // for ActivityCompat#requestPermissions for more details.
                return;
            }
            locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 0, 0, locationListener); }
        catch (Exception ignored) {}

        try { locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 0, 0, locationListener); }
        catch (Exception ignored) {}

        gpsTimeoutRunnable = () -> {
            stopLocationListeners();
            if (bestLocation != null) {
                sendEmergency(bestLocation);
            } else {
                Toast.makeText(this, "Unable to get location. Try again.", Toast.LENGTH_LONG).show();
            }
        };

        gpsTimeoutHandler.postDelayed(gpsTimeoutRunnable, 8000);
    }

    private void stopLocationListeners() {
        try {
            if (locationManager != null && locationListener != null)
                locationManager.removeUpdates(locationListener);
        } catch (Exception ignored) {}

        if (progressDialog != null && progressDialog.isShowing())
            progressDialog.dismiss();

        gpsTimeoutHandler.removeCallbacks(gpsTimeoutRunnable);
    }

    private boolean hasLocationPermission() {
        return ActivityCompat.checkSelfPermission(this,
                Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestLocationPermissions() {
        ActivityCompat.requestPermissions(this,
                new String[]{
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                },
                LOCATION_PERMISSION_REQUEST_CODE
        );
    }

    @Override
    public void onRequestPermissionsResult(int req, @NonNull String[] perms, @NonNull int[] results) {
        super.onRequestPermissionsResult(req, perms, results);
        if (req == LOCATION_PERMISSION_REQUEST_CODE &&
                results.length > 0 &&
                results[0] == PackageManager.PERMISSION_GRANTED) {

            updateStatus("Permission granted");
        }
    }

    // ---------------------- SEND EMERGENCY ----------------------
    private void sendEmergency(Location loc) {

        if (loc == null) {
            Toast.makeText(this, "No location found!", Toast.LENGTH_SHORT).show();
            return;
        }

        updateStatus("Sending emergency...");
        emergencyButton.setEnabled(false);

        double lat = loc.getLatitude();
        double lon = loc.getLongitude();

        serverManager.sendEmergencyRequest(
                userName, userAge, userMobile, lat, lon,
                new ServerManager.ServerCallback() {
                    @Override
                    public void onSuccess(JSONObject res) {
                        runOnUiThread(() -> {
                            try {
                                String id = res.getString("emergency_id");
                                driverStatusTextView.setVisibility(TextView.VISIBLE);
                                driverStatusTextView.setText("Searching for ambulance…");
                                startEmergencyStatusCheck(id);
                            } catch (JSONException e) {
                                updateStatus("Error reading emergency response");
                            }
                            emergencyButton.setEnabled(true);
                        });
                    }

                    @Override
                    public void onError(String err) {
                        runOnUiThread(() -> {
                            updateStatus("Emergency failed: " + err);
                            emergencyButton.setEnabled(true);
                        });
                    }
                });
    }

    // ---------------------- STATUS POLLING ----------------------
    private void startEmergencyStatusCheck(String emergencyId) {

        statusHandler = new Handler();
        statusRunnable = new Runnable() {
            @Override
            public void run() {
                serverManager.checkEmergencyStatus(emergencyId, new ServerManager.ServerCallback() {
                    @Override
                    public void onSuccess(JSONObject res) {
                        runOnUiThread(() -> {
                            try {
                                String status = res.getString("status");
                                double distance = res.optDouble("routing_distance", -1);
                                String eta = res.optString("estimated_time", "");

                                switch (status) {
                                    case "searching":
                                        driverStatusTextView.setText("🔍 Searching...");
                                        break;
                                    case "assigned":
                                        driverStatusTextView.setText("🚑 Ambulance Assigned");
                                        break;
                                    case "accepted":
                                        driverStatusTextView.setText("🚑 Ambulance on the way!"+
                                                "📏 Distance: " + Math.round(distance) + " m\n" +
                                                        "⏱ ETA: " + eta);

                                        break;
                                    case "arrived":
                                        driverStatusTextView.setText("🎉 Ambulance Arrived!");
                                        statusHandler.removeCallbacks(statusRunnable);
                                        return;
                                    case "completed":
                                        driverStatusTextView.setText("✔ Mission Completed");
                                        statusHandler.removeCallbacks(statusRunnable);
                                        return;
                                    case "not_found":
                                        driverStatusTextView.setText("❌ Not Found");
                                        statusHandler.removeCallbacks(statusRunnable);
                                        return;
                                }

                                statusHandler.postDelayed(statusRunnable, 3000);

                            } catch (JSONException ignored) {}
                        });
                    }

                    @Override
                    public void onError(String err) {
                        statusHandler.postDelayed(statusRunnable, 5000);
                    }
                });
            }
        };

        statusHandler.postDelayed(statusRunnable, 3000);
    }

    private void updateStatus(String msg) {
        runOnUiThread(() -> statusTextView.setText("Status: " + msg));
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();

        if (resendTimer != null) resendTimer.cancel();
        if (statusHandler != null && statusRunnable != null)
            statusHandler.removeCallbacks(statusRunnable);

        stopLocationListeners();
    }
}
