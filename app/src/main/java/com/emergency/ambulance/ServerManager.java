package com.emergency.ambulance;

import android.content.Context;
import android.util.Log;
import com.android.volley.Request;
import com.android.volley.RequestQueue;
import com.android.volley.Response;
import com.android.volley.VolleyError;
import com.android.volley.toolbox.JsonObjectRequest;
import com.android.volley.toolbox.Volley;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.HashMap;
import java.util.Map;

public class ServerManager {
    private static ServerManager instance;
    private RequestQueue requestQueue;
    private static final String BASE_URL = "http://192.168.32.95:3000";
    private static final String TAG = "ServerManager";

    private ServerManager(Context context) {
        requestQueue = Volley.newRequestQueue(context.getApplicationContext());
    }

    public static synchronized ServerManager getInstance(Context context) {
        if (instance == null) {
            instance = new ServerManager(context);
        }
        return instance;
    }

    public interface ServerCallback {
        void onSuccess(JSONObject response);
        void onError(String error);
    }

    // Check server health
    public void checkServerHealth(final ServerCallback callback) {
        String url = BASE_URL + "/api/health";
        Log.d(TAG, "Checking server health at: " + url);

        JsonObjectRequest jsonObjectRequest = new JsonObjectRequest(
                Request.Method.GET,
                url,
                null,
                new Response.Listener<JSONObject>() {
                    @Override
                    public void onResponse(JSONObject response) {
                        Log.d(TAG, "Server health check SUCCESS: " + response.toString());
                        if (callback != null) {
                            callback.onSuccess(response);
                        }
                    }
                },
                new Response.ErrorListener() {
                    @Override
                    public void onErrorResponse(VolleyError error) {
                        String errorMessage = "Server connection failed: ";

                        if (error.networkResponse != null) {
                            int statusCode = error.networkResponse.statusCode;
                            errorMessage += "HTTP " + statusCode;
                        } else {
                            errorMessage += error.getMessage();
                        }

                        Log.e(TAG, errorMessage);
                        if (callback != null) {
                            callback.onError(errorMessage);
                        }
                    }
                }
        );

        jsonObjectRequest.setRetryPolicy(new com.android.volley.DefaultRetryPolicy(
                10000, // 10 seconds timeout
                2, // 2 retries
                com.android.volley.DefaultRetryPolicy.DEFAULT_BACKOFF_MULT
        ));

        requestQueue.add(jsonObjectRequest);
    }

    // Send OTP request
    public void sendOtpRequest(String name, String age, String mobile, final ServerCallback callback) {
        String url = BASE_URL + "/api/send_otp";
        Log.d(TAG, "Sending OTP request to: " + url);

        try {
            JSONObject requestBody = new JSONObject();
            requestBody.put("name", name);
            requestBody.put("age", age);
            requestBody.put("mobile", mobile);

            JsonObjectRequest jsonObjectRequest = new JsonObjectRequest(
                    Request.Method.POST,
                    url,
                    requestBody,
                    new Response.Listener<JSONObject>() {
                        @Override
                        public void onResponse(JSONObject response) {
                            Log.d(TAG, "OTP request successful: " + response.toString());
                            if (callback != null) {
                                callback.onSuccess(response);
                            }
                        }
                    },
                    new Response.ErrorListener() {
                        @Override
                        public void onErrorResponse(VolleyError error) {
                            String errorMessage = "OTP request failed: ";
                            if (error.networkResponse != null && error.networkResponse.data != null) {
                                errorMessage += new String(error.networkResponse.data);
                            } else {
                                errorMessage += error.getMessage();
                            }
                            Log.e(TAG, errorMessage);
                            if (callback != null) {
                                callback.onError(errorMessage);
                            }
                        }
                    }
            ) {
                @Override
                public Map<String, String> getHeaders() {
                    Map<String, String> headers = new HashMap<>();
                    headers.put("Content-Type", "application/json");
                    return headers;
                }
            };

            requestQueue.add(jsonObjectRequest);

        } catch (JSONException e) {
            Log.e(TAG, "JSON Exception: " + e.getMessage());
            if (callback != null) {
                callback.onError("JSON Error: " + e.getMessage());
            }
        }
    }

    // Verify OTP
    public void verifyOtp(String requestId, String otp, final ServerCallback callback) {
        String url = BASE_URL + "/api/verify_otp";
        Log.d(TAG, "Verifying OTP at: " + url);

        try {
            JSONObject requestBody = new JSONObject();
            requestBody.put("request_id", requestId);
            requestBody.put("otp", otp);

            JsonObjectRequest jsonObjectRequest = new JsonObjectRequest(
                    Request.Method.POST,
                    url,
                    requestBody,
                    new Response.Listener<JSONObject>() {
                        @Override
                        public void onResponse(JSONObject response) {
                            Log.d(TAG, "OTP verification response: " + response.toString());
                            if (callback != null) {
                                callback.onSuccess(response);
                            }
                        }
                    },
                    new Response.ErrorListener() {
                        @Override
                        public void onErrorResponse(VolleyError error) {
                            String errorMessage = "OTP verification failed: ";
                            if (error.networkResponse != null && error.networkResponse.data != null) {
                                errorMessage += new String(error.networkResponse.data);
                            } else {
                                errorMessage += error.getMessage();
                            }
                            Log.e(TAG, errorMessage);
                            if (callback != null) {
                                callback.onError(errorMessage);
                            }
                        }
                    }
            ) {
                @Override
                public Map<String, String> getHeaders() {
                    Map<String, String> headers = new HashMap<>();
                    headers.put("Content-Type", "application/json");
                    return headers;
                }
            };

            requestQueue.add(jsonObjectRequest);

        } catch (JSONException e) {
            Log.e(TAG, "JSON Exception: " + e.getMessage());
            if (callback != null) {
                callback.onError("JSON Error: " + e.getMessage());
            }
        }
    }

    // Send emergency request
    public void sendEmergencyRequest(String name, String age, String mobile,
                                     double latitude, double longitude,
                                     final ServerCallback callback) {
        String url = BASE_URL + "/api/emergency";
        Log.d(TAG, "Sending emergency request to: " + url);

        try {
            JSONObject requestBody = new JSONObject();
            requestBody.put("name", name);
            requestBody.put("age", age);
            requestBody.put("mobile", mobile);
            requestBody.put("latitude", latitude);
            requestBody.put("longitude", longitude);

            JsonObjectRequest jsonObjectRequest = new JsonObjectRequest(
                    Request.Method.POST,
                    url,
                    requestBody,
                    new Response.Listener<JSONObject>() {
                        @Override
                        public void onResponse(JSONObject response) {
                            Log.d(TAG, "Emergency request successful: " + response.toString());
                            if (callback != null) {
                                callback.onSuccess(response);
                            }
                        }
                    },
                    new Response.ErrorListener() {
                        @Override
                        public void onErrorResponse(VolleyError error) {
                            String errorMessage = "Emergency request failed: ";
                            if (error.networkResponse != null && error.networkResponse.data != null) {
                                errorMessage += new String(error.networkResponse.data);
                            } else {
                                errorMessage += error.getMessage();
                            }
                            Log.e(TAG, errorMessage);
                            if (callback != null) {
                                callback.onError(errorMessage);
                            }
                        }
                    }
            ) {
                @Override
                public Map<String, String> getHeaders() {
                    Map<String, String> headers = new HashMap<>();
                    headers.put("Content-Type", "application/json");
                    return headers;
                }
            };

            requestQueue.add(jsonObjectRequest);

        } catch (JSONException e) {
            Log.e(TAG, "JSON Exception: " + e.getMessage());
            if (callback != null) {
                callback.onError("JSON Error: " + e.getMessage());
            }
        }
    }

    // Check emergency status
    public void checkEmergencyStatus(String emergencyId, final ServerCallback callback) {
        String url = BASE_URL + "/api/emergency_status/" + emergencyId;
        Log.d(TAG, "Checking emergency status at: " + url);

        JsonObjectRequest jsonObjectRequest = new JsonObjectRequest(
                Request.Method.GET,
                url,
                null,
                new Response.Listener<JSONObject>() {
                    @Override
                    public void onResponse(JSONObject response) {
                        Log.d(TAG, "Emergency status check: " + response.toString());
                        if (callback != null) {
                            callback.onSuccess(response);
                        }
                    }
                },
                new Response.ErrorListener() {
                    @Override
                    public void onErrorResponse(VolleyError error) {
                        String errorMessage = "Status check failed: ";
                        if (error.networkResponse != null && error.networkResponse.data != null) {
                            errorMessage += new String(error.networkResponse.data);
                        } else {
                            errorMessage += error.getMessage();
                        }
                        Log.e(TAG, errorMessage);
                        if (callback != null) {
                            callback.onError(errorMessage);
                        }
                    }
                }
        );

        requestQueue.add(jsonObjectRequest);
    }
}