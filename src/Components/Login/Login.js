import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  collection,
  setDoc,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import UAParser from "ua-parser-js"; // For detecting device and platform
import "../../Config/Firebase"; // Ensure Firebase is initialized
import "./Login.css";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged } from "firebase/auth";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();
  const auth = getAuth();
  const fs = getFirestore();
  const [showPassword, setShowPassword] = useState(false); // New state to control password visibility
  const [loading, setLoading] = useState(false);
  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword((prevShowPassword) => !prevShowPassword);
  };

  // Toggle between Login and Forgot Password forms
  const toggleForgotPassword = () => {
    setIsForgotPassword(!isForgotPassword);
    setError(null);
    setMessage(null);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;
      // 🔄 Refresh the user to get updated email verification status
      await user.reload();

      // ✅ If email is verified but user_status is still inactive, activate it
      if (user.emailVerified) {
        const userDocRef = doc(fs, "users", user.uid);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists() && userSnap.data().user_status === "inactive") {
          await updateDoc(userDocRef, { user_status: "active" });
        }
      }

      // Fetch the ID token from Firebase
      const token = await user.getIdToken();

      // Store the token in local storage for session management
      localStorage.setItem("authToken", token);

      // Fetch user details from Firestore
      const userDoc = doc(fs, "users", user.uid);
      const userSnap = await getDoc(userDoc);

      if (userSnap.exists()) {
        const userData = userSnap.data();

        if (
          userData.user_status === "active" &&
          userData.member_type !== "client"
        ) {
          // If user is active, log activity and update trusted devices
          const loginActivity = await logLoginActivity(user); // Assuming this function already logs the activity

          // Fetch the latest login activity for the user to get metadata
          const loginActivityRef = collection(
            fs,
            "users",
            user.uid,
            "loginActivity"
          );
          const loginActivityQuery = query(
            loginActivityRef,
            orderBy("loginTime", "desc"),
            limit(1)
          );
          const loginActivitySnapshot = await getDocs(loginActivityQuery);

          let ipAddress = "Unknown";
          let deviceName = "Unknown";
          let location = "Unknown";

          if (!loginActivitySnapshot.empty) {
            const activityData = loginActivitySnapshot.docs[0].data();
            ipAddress = activityData.ipAddress || "Unknown";
            deviceName = activityData.deviceName || "Unknown";
            location = activityData.location || "Unknown";
          }

          // Add audit log entry with "ACCESS" as the action type
          const auditLogEntry = {
            actionType: "ACCESS",
            timestamp: new Date(),
            uid: user.uid,
            changes: {
              action: "Login",
              status: "Success",
            },
            affectedData: {
              userId: user.uid,
              userName: userData.display_name || "Unknown",
            },
            metadata: {
              ipAddress,
              userAgent: deviceName, // Or keep it as userAgent: navigator.userAgent if you prefer
              location,
            },
          };

          // Add the document to the 'audit_logs' collection
          await addDoc(collection(fs, "audit_logs"), auditLogEntry); // Use addDoc instead of .add

          navigate("/dashboard");
        } else {
          setError("User account is not active");
        }
      } else {
        setError("No such user found");
      }
    } catch (err) {
      console.warn("Login failed:", err.message);
      setError("Invalid credentials");
      setLoading(false);

      try {
        const auditLogEntry = {
          actionType: "ACCESS",
          timestamp: new Date(),
          uid: "unknown",
          changes: {
            action: "Login",
            status: "Failed",
          },
          metadata: {
            ipAddress: "Unknown",
            userAgent: navigator.userAgent || "Unknown",
          },
        };

        await addDoc(collection(fs, "audit_logs"), auditLogEntry);
      } catch (auditError) {
        console.warn("Audit log write failed:", auditError.message);
        // Optionally ignore or silently log this
      }

      return;
    }

  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent! Check your inbox.");
    } catch (err) {
      console.warn("Login failed:", err.message); // Log safely without throwing
      setError("Invalid credentials");
      setLoading(false);
      return;
    }
  }

  // Log Login Activity and save trusted device if not already present
  const logLoginActivity = async (user) => {
    const { deviceName, ipAddress, location, platform } = await getDeviceInfo();

    // Save to loginActivity
    const loginActivityRef = collection(fs, `users/${user.uid}/loginActivity`);
    await addDoc(loginActivityRef, {
      deviceName,
      ipAddress,
      location,
      loginTime: new Date(),
    });

    // Save to trusted_devices only if the device is not already present
    const trustedDeviceRef = doc(
      fs,
      `users/${user.uid}/trusted_devices`,
      deviceName
    );
    const trustedDeviceSnapshot = await getDoc(trustedDeviceRef);

    if (!trustedDeviceSnapshot.exists()) {
      await setDoc(trustedDeviceRef, {
        device_name: deviceName || "Unknown",
        ipAddress: ipAddress || "Unknown",
        last_login: new Date(),
        location: location || "Unknown",
        platform: platform || "Unknown",
      });
    }
  };

  // Function to get device info (uses UAParser and ipapi for location and IP)
  const getDeviceInfo = async () => {
    const parser = new UAParser();
    const uaResult = parser.getResult();

    // Detect device name, or set fallback for desktops/laptops
    const deviceName =
      uaResult.device.model ||
      `${uaResult.browser.name} on ${uaResult.os.name}`;

    // Platform (OS and version)
    const platform = `${uaResult.os.name} ${uaResult.os.version}`;

    // Fetch IP address and location using ipapi.co
    const ipData = await fetch("https://ipapi.co/json/").then((res) =>
      res.json()
    );
    const ipAddress = ipData.ip;
    const location = `${ipData.city}, ${ipData.region}, ${ipData.country}`;

    return { deviceName, ipAddress, location, platform };
  };

  return (
    <div className="login-container">
      <div className="left-side">
        <div className="logo-overlay">
          <div className="logo-container">
            <img
              src={require("../../Assets/img/ibp_logo.png")}
              alt="IBP Logo"
              className="logo"
            />
          </div>
          <h1 className="organization-name">
            Integrated Bar of the Philippines
            <br />
            (IBP - Bulacan Chapter)
          </h1>
        </div>
      </div>
      <div className="right-side">
        <div className="login-box">
          {isForgotPassword ? (
            <>
              <h2>Reset Your Password</h2>
              <p
                style={{
                  fontSize: "16px",
                  color: "#666666",
                  marginBottom: "16px",
                }}
              >
                Enter your email address, and we'll send you a link to reset
                your password.
              </p>

              {message && <p className="success">{message}</p>}
              {error && <p className="error">{error}</p>}
              <form onSubmit={handleForgotPassword}>
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  placeholder="Enter your email address"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button type="submit">Send Reset Link</button>
              </form>
              <br />
              <p
                style={{
                  marginTop: "20px",
                  color: "#666666",
                  fontSize: "16px",
                }}
              >
                Remember your password?{" "}
                <span
                  onClick={toggleForgotPassword}
                  style={{
                    cursor: "pointer",
                    color: "#407ce2",
                    textDecoration: "none",
                  }}
                >
                  Back to Login
                </span>
              </p>

            </>
          ) : (
            <>

              <h2>Welcome!</h2>
              <p
                style={{
                  fontSize: "16px",
                  color: "#666666",
                  marginBottom: "16px",
                }}
              >
                Input your login credentials to start
              </p>


              {error && <p className="error">{error}</p>}
              <form onSubmit={handleLogin}>
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  placeholder="Enter your email address"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <label htmlFor="password">Password</label>
                <div className="input-with-icon">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    id="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <FontAwesomeIcon
                    icon={showPassword ? faEyeSlash : faEye}
                    onClick={togglePasswordVisibility}
                    className="icon"
                  />
                </div>
                <div className="forgot-password">
                  Having trouble signing in? <br></br>
                  <span
                    onClick={toggleForgotPassword}
                    style={{ cursor: "pointer", color: "#407ce2" }}
                  >
                    Reset my password
                  </span>
                </div>
                <button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <span
                        className="spinner"
                        style={{ marginRight: "8px" }}
                      ></span>{" "}
                      Signing in...
                    </>
                  ) : (
                    "Login"
                  )}
                </button>

                <p
                  style={{
                    marginTop: "20px",
                    color: "#666666",
                    fontSize: "16px",
                  }}
                >
                  Need tech support?{" "}
                  <a
                    href="mailto:nubcapstone@gmail.com"
                    target="_blank"
                    style={{
                      color: "#407ce2",
                      textDecoration: "none",
                    }}
                  >
                    Contact here
                  </a>
                </p>

              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
