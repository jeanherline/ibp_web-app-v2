import React, { useState, useEffect } from "react";
import "./Settings.css";
import SideNavBar from "../SideNavBar/SideNavBar";
import { useAuth } from "../../contexts/AuthContext";
import { useHistory } from "react-router-dom";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import {
  fs,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  getDocs,
} from "../../Config/Firebase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faSignOutAlt } from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import { Switch, TextField, Button, Snackbar } from "@mui/material";
import {
  PhoneAuthProvider,
  multiFactor,
  RecaptchaVerifier,
} from "firebase/auth";

function Settings() {
  const { currentUser } = useAuth();
  const [trustedDevices, setTrustedDevices] = useState([]);
  const [loginActivities, setLoginActivities] = useState([]);
  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneLinked, setPhoneLinked] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [verificationId, setVerificationId] = useState(null);
  const [otpCode, setOtpCode] = useState("");
  const [auditLogs, setAuditLogs] = useState([]); // State for audit logs
  const [openSections, setOpenSections] = useState({
    changes: {},
    affectedData: {},
    metadata: {},
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const db = fs; // Firestore instance
  const navigate = useNavigate();
  const auth = getAuth();

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/"); // Redirect to login page if not authenticated
      }
    });

    return () => unsubscribe();
  }, [auth, navigate]);

  const fetchAuditLogs = async () => {
    const auditLogsRef = collection(db, "audit_logs");
    const auditLogsQuery = query(auditLogsRef, orderBy("timestamp", "desc"));
    const auditLogsSnapshot = await getDocs(auditLogsQuery);
    const userAuditLogs = auditLogsSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((log) => log.uid === currentUser.uid); // Filter logs for current user

    // Fetch full names for each user in audit logs
    const userNames = {};
    for (const log of userAuditLogs) {
      const userDoc = await getDoc(doc(db, "users", log.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        userNames[log.uid] = `${userData.display_name} ${
          userData.middle_name || ""
        } ${userData.last_name}`.trim();
      }
    }

    const sortObjectKeys = (obj) => {
      return Object.keys(obj)
        .sort()
        .reduce((sortedObj, key) => {
          sortedObj[key] = obj[key];
          return sortedObj;
        }, {});
    };

    // Update your audit log formatting
    const formattedAuditLogs = userAuditLogs.map((log) => ({
      ...log,
      fullName: userNames[log.uid] || "Unknown User",
      changes: JSON.stringify(sortObjectKeys(log.changes), null, 2), // Sort changes
      affectedData: JSON.stringify(sortObjectKeys(log.affectedData), null, 2), // Sort affected data
      metadata: JSON.stringify(sortObjectKeys(log.metadata), null, 2), // Sort metadata
    }));

    setAuditLogs(formattedAuditLogs);
  };

  fetchAuditLogs(); // Fetch audit logs

  // Initialize reCAPTCHA verifier for phone authentication (for production mode only)
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" && !window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        "recaptcha-container",
        { size: "invisible" },
        auth
      );
    }
  }, [auth]);

  // Send OTP
  const sendOtp = async () => {
    if (!phoneNumber) {
      setSnackbarMessage("Please enter a valid phone number.");
      setShowSnackbar(true);
      return;
    }

    // Ensure the phone number is in E.164 format
    const formattedPhoneNumber = phoneNumber.startsWith("+")
      ? phoneNumber
      : `+63${phoneNumber}`;

    try {
      const phoneProvider = new PhoneAuthProvider(auth);

      // Ensure recaptchaVerifier is initialized and rendered
      const recaptcha =
        process.env.NODE_ENV === "development"
          ? undefined // Skip reCAPTCHA in development
          : window.recaptchaVerifier;

      // If recaptchaVerifier is undefined or not rendered, throw an error
      if (process.env.NODE_ENV !== "development" && !recaptcha) {
        throw new Error("RecaptchaVerifier is not initialized.");
      }

      // Render the reCAPTCHA if necessary
      if (recaptcha) {
        await recaptcha.render();
      }

      // Send OTP to the formatted phone number
      const verificationId = await phoneProvider.verifyPhoneNumber(
        formattedPhoneNumber,
        recaptcha
      );
      setVerificationId(verificationId);
      setSnackbarMessage("OTP sent to your phone.");
      setShowSnackbar(true);
    } catch (error) {
      console.error("Error sending OTP:", error);
      setSnackbarMessage("Error sending OTP. Try again.");
      setShowSnackbar(true);
    }
  };

  // Verify OTP and link phone number
  const verifyOtp = async () => {
    if (!otpCode) {
      setSnackbarMessage("Please enter the OTP.");
      setShowSnackbar(true);
      return;
    }

    try {
      const credential = PhoneAuthProvider.credential(verificationId, otpCode);
      const user = auth.currentUser;
      const multiFactorUser = multiFactor(user);

      if (!multiFactorUser.enrolledFactors.length) {
        await multiFactorUser.enroll(credential, "Phone Number");
      }

      const userDoc = doc(db, "users", currentUser.uid);
      await updateDoc(userDoc, {
        phone: phoneNumber,
        isTwoFactorEnabled: true,
      });

      setPhoneLinked(true);
      setSnackbarMessage("Phone Number Linked and 2FA enabled successfully.");
      setShowSnackbar(true);
    } catch (error) {
      console.error("Error verifying OTP:", error);
      setSnackbarMessage("Invalid OTP. Try again.");
      setShowSnackbar(true);
    }
  };

  // Fetch user data, trusted devices, and login activities from Firestore
  useEffect(() => {
    if (currentUser) {
      const fetchUserData = async () => {
        const userDoc = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userDoc);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          setIsTwoFactorEnabled(userData.isTwoFactorEnabled || false);
          setPhoneNumber(userData.phone || "");
          setPhoneLinked(!!userData.phone);
          setIsAdmin(userData.member_type === "admin"); // Set admin status
        }
      };

      const fetchTrustedDevices = async () => {
        const trustedDevicesRef = collection(
          db,
          `users/${currentUser.uid}/trusted_devices`
        );
        const trustedDevicesQuery = query(
          trustedDevicesRef,
          orderBy("last_login", "desc")
        );
        const trustedDevicesSnapshot = await getDocs(trustedDevicesQuery);
        setTrustedDevices(
          trustedDevicesSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
        );
      };

      const fetchLoginActivities = async () => {
        const loginActivityRef = collection(
          db,
          `users/${currentUser.uid}/loginActivity`
        );
        const loginActivityQuery = query(
          loginActivityRef,
          orderBy("loginTime", "desc")
        );
        const loginActivitySnapshot = await getDocs(loginActivityQuery);
        setLoginActivities(
          loginActivitySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
        );
      };

      fetchUserData();
      fetchTrustedDevices();
      fetchLoginActivities();
    }
  }, [currentUser, db]);

  const removeDevice = async (deviceId) => {
    if (!currentUser) {
      console.error("No current user found");
      return;
    }
    await deleteDoc(
      doc(db, `users/${currentUser.uid}/trusted_devices`, deviceId)
    );
    setTrustedDevices(
      trustedDevices.filter((device) => device.id !== deviceId)
    );
  };

  const logoutAllDevices = async () => {
    if (!currentUser) {
      console.error("No current user found");
      return;
    }
    try {
      const response = await fetch(
        "https://us-central1-lawyer-app-ed056.cloudfunctions.net/logoutAllDevices",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId: currentUser.uid }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to log out from all devices. Status: ${response.status}`
        );
      }

      await signOut(auth);
      setShowSnackbar(true);
      setSnackbarMessage("Session Expired. Redirecting to login.");
      setTimeout(() => {
        setShowSnackbar(false);
        navigate("/"); // Redirect to login page
      }, 3000);
    } catch (error) {
      console.error("Error logging out from all devices:", error);
      alert("An error occurred while logging out from all devices.");
    }
  };

  const toggleTwoFactor = async () => {
    if (!phoneLinked && !isTwoFactorEnabled) {
      setSnackbarMessage("Please link your phone number to enable 2FA.");
      setShowSnackbar(true);
      return;
    }

    const updatedStatus = !isTwoFactorEnabled;
    setIsTwoFactorEnabled(updatedStatus);

    const userDoc = doc(db, "users", currentUser.uid);
    await updateDoc(userDoc, { isTwoFactorEnabled: updatedStatus });

    setSnackbarMessage(
      updatedStatus
        ? "Two-Factor Authentication Enabled"
        : "Two-Factor Authentication Disabled"
    );
    setShowSnackbar(true);
  };

  return (
    <div className="dashboard-container">
      <SideNavBar />
      <div className="main-content">
        <h3>Settings</h3>
        <br />

        {/* Two-Factor Authentication Section
        <div className="settings-section">
          <h4>Security Settings</h4>
          <div className="two-factor-section">
            <div className="two-factor-toggle">
              <Switch
                checked={isTwoFactorEnabled}
                onChange={toggleTwoFactor}
                color="primary"
              />
              <p>Enable Two-Factor Authentication</p>
            </div>
            {phoneLinked ? (
              <Button variant="contained" color="success" disabled>
                Phone Number Linked
              </Button>
            ) : (
              <div className="link-phone-section">
                <TextField
                  label="Phone Number"
                  variant="outlined"
                  value={
                    phoneNumber.startsWith("+63")
                      ? phoneNumber
                      : `+63${phoneNumber}`
                  }
                  onChange={(e) => {
                    const input = e.target.value.replace("+63", "");
                    if (/^\d{0,10}$/.test(input)) {
                      setPhoneNumber(`+63${input}`);
                    }
                  }}
                  placeholder="Enter your phone number, e.g., 9123456789"
                />
                {!verificationId ? (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={sendOtp}
                    style={{ marginLeft: "10px" }}
                  >
                    Link Phone Number
                  </Button>
                ) : (
                  <div className="otp-verification-section">
                    <TextField
                      label="Enter OTP"
                      variant="outlined"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="Enter the OTP"
                    />
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={verifyOtp}
                      style={{ marginLeft: "10px" }}
                    >
                      Verify OTP
                    </Button>
                  </div>
                )}
                <div id="recaptcha-container"></div>
              </div>
            )}
          </div>
        </div> */}

        {/* Trusted Devices Section */}
        <div className="settings-section">
          <h4>Trusted Devices</h4>
          {trustedDevices.length > 0 ? (
            <div className="table-container">
              <table className="trusted-devices-table">
                <thead>
                  <tr>
                    <th>Device Name</th>
                    <th>IP Address</th>
                    <th>Last Login</th>
                    <th>Location</th>
                    <th>Platform</th>
                    {/* <th>Actions</th> */}
                  </tr>
                </thead>
                <tbody>
                  {trustedDevices.map((device) => (
                    <tr key={device.id}>
                      <td>{device.device_name}</td>
                      <td>{device.ipAddress}</td>
                      <td>
                        {new Date(
                          device.last_login.seconds * 1000
                        ).toLocaleString()}
                      </td>
                      <td>{device.location}</td>
                      <td>{device.platform}</td>
                      {/* <td>
                        <button
                          className="remove-device-btn"
                          onClick={() => removeDevice(device.id)}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </td> */}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No trusted devices found.</p>
          )}
        </div>

        {/* Login Activity Section */}
        <div className="settings-section">
          <h4>Login Activity</h4>
          {loginActivities.length > 0 ? (
            <div className="table-container">
              <table className="login-activity-table">
                <thead>
                  <tr>
                    <th>Device Name</th>
                    <th>IP Address</th>
                    <th>Login Time</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {loginActivities.map((activity) => (
                    <tr key={activity.id}>
                      <td>{activity.deviceName}</td>
                      <td>{activity.ipAddress}</td>
                      <td>
                        {new Date(
                          activity.loginTime.seconds * 1000
                        ).toLocaleString()}
                      </td>
                      <td>{activity.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No login activity found.</p>
          )}
          <div className="logout-all-container">
            <button className="logout-all-btn" onClick={logoutAllDevices}>
              <FontAwesomeIcon icon={faSignOutAlt} /> Logout from All Devices
            </button>
          </div>
        </div>

        {/* Snackbar for session expiration */}
        {showSnackbar && (
          <Snackbar
            open={showSnackbar}
            autoHideDuration={3000}
            message={snackbarMessage}
            onClose={() => setShowSnackbar(false)}
          />
        )}
        {/* Audit Logs Section */}
        <div className="settings-section">
          <h4>Audit Logs</h4>
          {auditLogs.length > 0 ? (
            <div className="table-container">
              <table className="audit-logs-table">
                <thead>
                  <tr>
                    <th>Action Type</th>
                    <th>Timestamp</th>
                    <th>Changes</th>
                    <th>Affected Data</th>
                    <th>Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.actionType}</td>
                      <td>
                        {new Date(
                          log.timestamp.seconds * 1000
                        ).toLocaleString()}
                      </td>
                      <td>
                        <div className="collapsible">
                          <button
                            className="collapsible-button"
                            onClick={() =>
                              setOpenSections((prev) => ({
                                ...prev,
                                changes: {
                                  ...prev.changes,
                                  [log.id]: !prev.changes[log.id],
                                },
                              }))
                            }
                          >
                            {openSections.changes[log.id]
                              ? "Hide Changes"
                              : "View Changes"}
                          </button>
                          {openSections.changes[log.id] && (
                            <div className="collapsible-content">
                              {log.changes ? (
                                <pre>{log.changes}</pre>
                              ) : (
                                <p>No changes recorded.</p>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="collapsible">
                          <button
                            className="collapsible-button"
                            onClick={() =>
                              setOpenSections((prev) => ({
                                ...prev,
                                affectedData: {
                                  ...prev.affectedData,
                                  [log.id]: !prev.affectedData[log.id],
                                },
                              }))
                            }
                          >
                            {openSections.affectedData[log.id]
                              ? "Hide Affected Data"
                              : "View Affected Data"}
                          </button>
                          {openSections.affectedData[log.id] && (
                            <div className="collapsible-content">
                              {log.affectedData ? (
                                <pre>{log.affectedData}</pre>
                              ) : (
                                <p>No affected data recorded.</p>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="collapsible">
                          <button
                            className="collapsible-button"
                            onClick={() =>
                              setOpenSections((prev) => ({
                                ...prev,
                                metadata: {
                                  ...prev.metadata,
                                  [log.id]: !prev.metadata[log.id],
                                },
                              }))
                            }
                          >
                            {openSections.metadata[log.id]
                              ? "Hide Metadata"
                              : "View Metadata"}
                          </button>
                          {openSections.metadata[log.id] && (
                            <div className="collapsible-content">
                              {log.metadata ? (
                                <pre>{log.metadata}</pre>
                              ) : (
                                <p>No metadata recorded.</p>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No audit logs found.</p>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "10px",
            }}
          >
            {isAdmin && (
              <Button
                variant="contained"
                color="primary"
                onClick={() => window.open("/all-audit-logs", "_blank")}
              >
                View All Audit Logs
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
