import React, { useState, useEffect } from "react";
import SideNavBar from "../SideNavBar/SideNavBar";
import {
  getUserById,
  updateUser,
  uploadImage,
  sendNotification, // Import the notification function
} from "../../Config/FirebaseServices";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import "./Profile.css";
import { addDoc, query, orderBy, limit, getDocs } from "firebase/firestore";
import { fs, collection } from "../../Config/Firebase"; // Ensure Firebase is initialized
const defaultImageUrl =
  "https://firebasestorage.googleapis.com/v0/b/lawyer-app-ed056.appspot.com/o/DefaultUserImage.jpg?alt=media&token=3ba45526-99d8-4d30-9cb5-505a5e23eda1";

function Profile() {
  const { currentUser } = useAuth();
  const [userData, setUserData] = useState({
    display_name: "",
    middle_name: "",
    last_name: "",
    dob: "",
    phone: "",
    gender: "",
    city: "",
  });
  const [originalUserData, setOriginalUserData] = useState({});
  const [profileImage, setProfileImage] = useState(null);
  const [imageUrl, setImageUrl] = useState(defaultImageUrl);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [showSnackbar, setShowSnackbar] = useState(false);
  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // If user is not authenticated, redirect to the login page
        navigate("/");
      }
    });

    return () => unsubscribe(); // Clean up the listener on component unmount
  }, [auth, navigate]);

  useEffect(() => {
    const fetchUserData = async () => {
      const user = await getUserById(currentUser.uid);
      setUserData(user);
      setOriginalUserData(user); // Store original data for comparison
      setImageUrl(user.photo_url || defaultImageUrl);
    };

    if (currentUser) {
      fetchUserData();
    }
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUserData({ ...userData, [name]: value });
  };

  const handleImageChange = (e) => {
    if (e.target.files[0]) {
      setProfileImage(e.target.files[0]);
      const objectUrl = URL.createObjectURL(e.target.files[0]);
      setImageUrl(objectUrl);
    }
  };

  const findChangedFields = () => {
    const changes = {};
    Object.keys(userData).forEach((key) => {
      if (userData[key] !== originalUserData[key]) {
        changes[key] = {
          oldValue: originalUserData[key] || "Not specified",
          newValue: userData[key] || "Not specified",
        };
      }
    });
    return changes;
  };

  const fetchLatestLoginActivity = async (uid) => {
    const loginActivityRef = collection(fs, "users", uid, "loginActivity");
    const loginActivityQuery = query(
      loginActivityRef,
      orderBy("loginTime", "desc"),
      limit(1)
    );
    const loginActivitySnapshot = await getDocs(loginActivityQuery);
  
    if (!loginActivitySnapshot.empty) {
      const activityData = loginActivitySnapshot.docs[0].data();
      return {
        ipAddress: activityData.ipAddress || null,
        deviceName: activityData.deviceName || null,
      };
    }
    return { ipAddress: null, deviceName: null };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
  
    let updatedData = { ...userData };
    // Remove empty values
    Object.keys(updatedData).forEach((key) => {
      if (updatedData[key] === "") delete updatedData[key];
    });
  
    // Add profile image with timestamp if provided
    if (profileImage) {
      const now = new Date();
      const timestamp = `${now.getFullYear()}-${(now.getMonth() + 1)
        .toString()
        .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}_${now
        .getHours()
        .toString()
        .padStart(2, "0")}-${now.getMinutes().toString().padStart(2, "0")}-${now
        .getSeconds()
        .toString()
        .padStart(2, "0")}`;
      
      const imageUrl = await uploadImage(
        profileImage,
        `profile_images/${currentUser.uid}/profileImage_${timestamp}.png`
      );
      updatedData.photo_url = imageUrl;
    }
  
    // Add current timestamp for updated_time
    updatedData.updated_time = new Date();
  
    try {
      const changes = findChangedFields();
      await updateUser(currentUser.uid, updatedData);
  
      if (Object.keys(changes).length > 0) {
        const message = `Your profile has been updated. Fields changed: ${Object.keys(
          changes
        ).join(", ")}`;
        await sendNotification(message, currentUser.uid, "profile");
      }
  
      // Fetch latest login activity metadata
      const { ipAddress, deviceName } = await fetchLatestLoginActivity(
        currentUser.uid
      );
  
      // Create and clean audit log entry
      const auditLogEntry = {
        actionType: "UPDATE",
        timestamp: new Date(),
        uid: currentUser?.uid || null,
        changes: changes || {},
        affectedData: {
          userId: currentUser?.uid || null,
          userName: updatedData?.display_name || null,
        },
        metadata: {
          ipAddress: ipAddress,
          userAgent: deviceName,
        },
      };
  
      Object.keys(auditLogEntry.changes).forEach(
        (key) =>
          auditLogEntry.changes[key] === undefined &&
          (auditLogEntry.changes[key] = null)
      );
  
      await addDoc(collection(fs, "audit_logs"), auditLogEntry);
      setSnackbarMessage("Profile has been successfully updated.");
    } catch (error) {
      setSnackbarMessage("Failed to update profile. Please try again.");
    } finally {
      setIsSubmitting(false);
      setShowSnackbar(true);
      setTimeout(() => setShowSnackbar(false), 3000);
    }
  };
  
  if (!currentUser) {
    return <div>Loading...</div>;
  }

  return (
    <div className="dashboard-container">
      <SideNavBar />
      <div className="main-content">
        <br />
        <h3>Edit Profile</h3>
        <form onSubmit={handleSubmit} className="edit-profile-form">
          <div className="profile-section">
            <div className="profile-image">
              <div className="image-wrapper">
                <label htmlFor="profileImage" className="image-label">
                  <img src={imageUrl} alt="Profile" className="profile-pic" />
                </label>
                <input
                  type="file"
                  id="profileImage"
                  onChange={handleImageChange}
                  className="image-input"
                />
              </div>
            </div>
            <div className="profile-details">
              <div className="form-group">
                <label htmlFor="display_name">Display Name</label>
                <input
                  type="text"
                  id="display_name"
                  name="display_name"
                  value={userData.display_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="middle_name">Middle Initial</label>
                <input
                  type="text"
                  id="middle_name"
                  name="middle_name"
                  value={userData.middle_name}
                  onChange={(e) => {
                    const { value } = e.target;
                    // Regex to allow only 1-2 uppercase letters
                    if (/^[A-Z]{0,2}$/.test(value)) {
                      handleChange(e); // Only call handleChange if input is valid
                    }
                  }}
                  maxLength="2" // Limit input length to 2 characters
                />
              </div>
              <div className="form-group">
                <label htmlFor="last_name">Last Name</label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={userData.last_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="dob">Date of Birth</label>
                <input
                  type="date"
                  id="dob"
                  name="dob"
                  value={userData.dob}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="gender">Gender</label>
                <select
                  id="gender"
                  name="gender"
                  value={userData.gender}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="city">City</label>
                <select
                  id="city"
                  name="city"
                  value={userData.city}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select City</option>
                  <option value="Angat">Angat</option>
                  <option value="Balagtas">Balagtas</option>
                  <option value="Baliuag">Baliuag</option>
                  <option value="Bocaue">Bocaue</option>
                  <option value="Bulakan">Bulakan</option>
                  <option value="Bustos">Bustos</option>
                  <option value="Calumpit">Calumpit</option>
                  <option value="Doña Remedios Trinidad">
                    Doña Remedios Trinidad
                  </option>
                  <option value="Guiguinto">Guiguinto</option>
                  <option value="Hagonoy">Hagonoy</option>
                  <option value="Marilao">Marilao</option>
                  <option value="Norzagaray">Norzagaray</option>
                  <option value="Obando">Obando</option>
                  <option value="Pandi">Pandi</option>
                  <option value="Paombong">Paombong</option>
                  <option value="Plaridel">Plaridel</option>
                  <option value="Pulilan">Pulilan</option>
                  <option value="San Ildefonso">San Ildefonso</option>
                  <option value="San Miguel">San Miguel</option>
                  <option value="San Rafael">San Rafael</option>
                  <option value="Santa Maria">Santa Maria</option>
                </select>
              </div>
              <div className="form-group submit-group">
                <button
                  type="submit"
                  className="submit-button"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Updating..." : "Update Profile"}
                </button>
              </div>
            </div>
          </div>
        </form>
        {showSnackbar && <div className="snackbar">{snackbarMessage}</div>}
      </div>
    </div>
  );
}

export default Profile;
