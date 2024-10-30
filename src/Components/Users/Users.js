import React, { useState, useEffect } from "react";
import SideNavBar from "../SideNavBar/SideNavBar";
import "../Dashboard/Dashboard.css";
import "./Users.css";
import Pagination from "react-bootstrap/Pagination";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import zxcvbn from "zxcvbn"; // For password strength detection
import {
  getUsers,
  getUsersCount,
  updateUser,
  getUserById,
  addUser, // Import the function to add a new user
} from "../../Config/FirebaseServices";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEye,
  faEdit,
  faArchive,
  faCheck,
  faSync,
  faUserPlus,
  faEyeSlash,
  faKey,
} from "@fortawesome/free-solid-svg-icons";
import {
  auth,
  doc,
  fs,
  collection,
  query,
  orderBy,
  limit,
} from "../../Config/Firebase";
import { addDoc, getDocs, setDoc, onSnapshot } from "firebase/firestore";
import {
  getAuth,
  signOut,

  createUserWithEmailAndPassword,
} from "firebase/auth"; // Import Firebase Auth

function Users() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("");
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lastVisible, setLastVisible] = useState(null);
  const pageSize = 10;
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [totalFilteredItems, setTotalFilteredItems] = useState(0);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [newUser, setNewUser] = useState({
    display_name: "",
    middle_name: "",
    last_name: "",
    dob: "",
    email: "",
    password: "",
    city: "",
    member_type: "",
    user_status: "active",
    photo_url: "",
  });
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordError, setPasswordError] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false); // State to toggle password visibility
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user);
      }
    });
    return unsubscribe;
  }, []);

  // Function to toggle password visibility
  const togglePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);
  };

  // Function to generate a strong password
  const generatePassword = () => {
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    setNewUser({ ...newUser, password });
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        window.location.href = "/";
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetchUsers(1); // Fetch users when component mounts or filters change
  }, [filterStatus, filterType, cityFilter, searchText]);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const userDocRef = doc(fs, "users", user.uid);
        const unsubscribeUserDoc = onSnapshot(
          userDocRef,
          (userDoc) => {
            if (userDoc.exists()) {
              setUserData(userDoc.data());
            } else {
              console.log("User document does not exist");
            }
            setLoading(false);
          },
          (error) => {
            console.error("Error fetching user data:", error);
            setLoading(false);
          }
        );

        return () => {
          unsubscribeUserDoc(); // Clean up the user document listener
        };
      } else {
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth(); // Clean up the auth state listener
    };
  }, []);

  const fetchUsers = async (page, lastVisibleDoc = null) => {
    try {
      const totalUsers = await getUsersCount(
        filterStatus,
        filterType,
        cityFilter,
        searchText
      );
      const newTotalPages = Math.ceil(totalUsers / pageSize);

      const { users, lastVisibleDoc: newLastVisibleDoc } = await getUsers(
        filterStatus,
        filterType,
        cityFilter,
        searchText,
        lastVisibleDoc,
        pageSize
      );

      setUsers(users);
      setTotalPages(newTotalPages);
      setLastVisible(newLastVisibleDoc);
      setCurrentPage(page);
      setTotalFilteredItems(totalUsers);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      fetchUsers(currentPage + 1, lastVisible);
    }
  };

  const handlePrevious = async () => {
    if (currentPage > 1) {
      const previousPageLastVisible = await getPreviousPageLastVisible(
        filterStatus,
        filterType,
        cityFilter,
        searchText,
        pageSize,
        currentPage - 1
      );
      fetchUsers(currentPage - 1, previousPageLastVisible);
    }
  };

  const handleFirst = () => {
    fetchUsers(1, null); // Fetch first page data
  };

  const handleLast = async () => {
    const lastPageLastVisible = await getLastPageLastVisible(
      filterStatus,
      filterType,
      cityFilter,
      searchText,
      pageSize
    );
    fetchUsers(totalPages, lastPageLastVisible); // Fetch last page data
  };

  const capitalizeFirstLetter = (string) => {
    if (typeof string !== "string") return ""; // Return empty string if not a string
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  const handlePageClick = (page) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      fetchUsers(page); // Fetch the selected page data
    }
  };

  // Helper function to get the last visible document for the previous page
  const getPreviousPageLastVisible = async (
    filterStatus,
    filterType,
    cityFilter,
    searchText,
    pageSize,
    targetPage
  ) => {
    try {
      const { users, lastVisibleDoc } = await getUsers(
        filterStatus,
        filterType,
        cityFilter,
        searchText,
        null,
        (targetPage - 1) * pageSize
      );
      return lastVisibleDoc;
    } catch (error) {
      console.error(
        "Failed to fetch previous page last visible document:",
        error
      );
    }
  };

  // Helper function to get the last visible document for the last page
  const getLastPageLastVisible = async (
    filterStatus,
    filterType,
    cityFilter,
    searchText,
    pageSize
  ) => {
    try {
      const totalUsers = await getUsersCount(
        filterStatus,
        filterType,
        cityFilter,
        searchText
      );
      const lastPageIndex = Math.floor(totalUsers / pageSize) * pageSize;

      const { lastVisibleDoc } = await getUsers(
        filterStatus,
        filterType,
        cityFilter,
        searchText,
        null,
        lastPageIndex
      );
      return lastVisibleDoc;
    } catch (error) {
      console.error("Failed to fetch last page last visible document:", error);
    }
  };

  const toggleDetails = async (user) => {
    try {
      const userDetails = await getUserById(user.uid);
      setSelectedUser(userDetails);
      setShowUserDetails(true); // Show user details when view button is clicked
      setIsEditing(false); // Reset editing state
    } catch (error) {
      console.error("Failed to fetch user details:", error);
    }
  };

  const handleEdit = async (user) => {
    if (
      userData.member_type === "admin" &&
      ["frontdesk", "head", "lawyer", "client", "admin"].includes(
        user.member_type
      )
    ) {
      setEditingUserId(user.uid);
      setSelectedUser(user); // Set user to selectedUser for editing
      setIsEditing(true);
      setShowUserDetails(false); // Hide user details when editing

      try {
        // Fetch latest login activity for metadata
        const loginActivitySnapshot = await getDocs(
          query(
            collection(fs, "users", currentUser.uid, "loginActivity"),
            orderBy("loginTime", "desc"),
            limit(1)
          )
        );

        let ipAddress = "Unknown";
        let deviceName = "Unknown";

        if (!loginActivitySnapshot.empty) {
          const loginData = loginActivitySnapshot.docs[0].data();
          ipAddress = loginData.ipAddress || "Unknown";
          deviceName = loginData.deviceName || "Unknown";
        }

        // Add audit log entry with "UPDATE" as the action type
        const auditLogEntry = {
          actionType: "UPDATE",
          timestamp: new Date(),
          uid: auth.currentUser.uid,
          changes: {
            action: "Edit User Profile",
            targetUserId: user.uid,
            targetMemberType: user.member_type,
          },
          affectedData: {
            adminUserId: currentUser.uid,
            adminUserName: auth.currentUser.displayName || "Unknown",
            targetUserId: user.uid,
          },
          metadata: {
            ipAddress: ipAddress,
            userAgent: deviceName,
          },
        };

        await addDoc(collection(fs, "audit_logs"), auditLogEntry);
      } catch (error) {
        console.error("Error logging edit access:", error);
      }
    }
  };

  const handleSave = async (user) => {
    try {
      const previousMemberType = user.member_type; // Capture the previous member type before updating

      // Update user member type in Firestore
      await updateUser(user.uid, {
        ...user,
        member_type: selectedUser.member_type,
      });

      setEditingUserId(null);
      setIsEditing(false);
      fetchUsers(currentPage);
      setSnackbarMessage("User member type has been successfully updated.");
      setShowSnackbar(true);
      setTimeout(() => setShowSnackbar(false), 3000);

      // Fetch latest login activity for metadata
      const loginActivitySnapshot = await fs
        .collection("users")
        .doc(currentUser.uid)
        .collection("loginActivity")
        .orderBy("loginTime", "desc")
        .limit(1)
        .get();

      let ipAddress = "Unknown";
      let deviceName = "Unknown";

      if (!loginActivitySnapshot.empty) {
        const loginData = loginActivitySnapshot.docs[0].data();
        ipAddress = loginData.ipAddress || "Unknown";
        deviceName = loginData.deviceName || "Unknown";
      }

      // Add audit log entry with "UPDATE" as the action type
      const auditLogEntry = {
        actionType: "UPDATE",
        timestamp: new Date(),
        uid: auth.currentUser.uid,
        changes: {
          member_type: {
            oldValue: previousMemberType,
            newValue: selectedUser.member_type,
          },
        },
        affectedData: {
          targetUserId: user.uid,
          targetUserName: user.display_name || "Unknown",
        },
        metadata: {
          ipAddress: ipAddress,
          userAgent: deviceName,
        },
      };

      await addDoc(collection(fs, "audit_logs"), auditLogEntry);
    } catch (error) {
      console.error("Failed to update user member type:", error);
    }
  };

  const handleArchive = async (user) => {
    if (userData.member_type === "admin") {
      setShowArchiveModal(true);
      setSelectedUser(user); // Set user to selectedUser for archiving
      setShowUserDetails(false); // Hide user details when archiving

      try {
        // Fetch latest login activity for metadata
        const loginActivitySnapshot = await fs
          .collection("users")
          .doc(currentUser.uid)
          .collection("loginActivity")
          .orderBy("loginTime", "desc")
          .limit(1)
          .get();

        let ipAddress = "Unknown";
        let deviceName = "Unknown";

        if (!loginActivitySnapshot.empty) {
          const loginData = loginActivitySnapshot.docs[0].data();
          ipAddress = loginData.ipAddress || "Unknown";
          deviceName = loginData.deviceName || "Unknown";
        }

        // Add audit log entry with "UPDATE" as the action type
        const auditLogEntry = {
          actionType: "UPDATE",
          timestamp: new Date(),
          uid: auth.currentUser.uid,
          changes: {
            action: "Initiate Archive",
            targetUserId: user.uid,
            targetMemberType: user.member_type,
          },
          affectedData: {
            adminUserId: currentUser.uid,
            adminUserName: auth.currentUser.displayName || "Unknown",
            targetUserId: user.uid,
          },
          metadata: {
            ipAddress: ipAddress,
            userAgent: deviceName,
          },
        };

        await addDoc(collection(fs, "audit_logs"), auditLogEntry);
      } catch (error) {
        console.error("Error logging archive initiation:", error);
      }
    }
  };

  const handleActivate = async (user) => {
    if (userData.member_type === "admin") {
      setShowActivateModal(true);
      setSelectedUser(user); // Set user to selectedUser for activating
      setShowUserDetails(false); // Hide user details when activating

      try {
        // Fetch latest login activity for metadata
        const loginActivitySnapshot = await fs
          .collection("users")
          .doc(currentUser.uid)
          .collection("loginActivity")
          .orderBy("loginTime", "desc")
          .limit(1)
          .get();

        let ipAddress = "Unknown";
        let deviceName = "Unknown";

        if (!loginActivitySnapshot.empty) {
          const loginData = loginActivitySnapshot.docs[0].data();
          ipAddress = loginData.ipAddress || "Unknown";
          deviceName = loginData.deviceName || "Unknown";
        }

        // Add audit log entry with "UPDATE" as the action type
        const auditLogEntry = {
          actionType: "UPDATE",
          timestamp: new Date(),
          uid: auth.currentUser.uid,
          changes: {
            action: "Initiate Activate",
            targetUserId: user.uid,
            targetMemberType: user.member_type,
          },
          affectedData: {
            adminUserId: currentUser.uid,
            adminUserName: auth.currentUser.displayName || "Unknown",
            targetUserId: user.uid,
          },
          metadata: {
            ipAddress: ipAddress,
            userAgent: deviceName,
          },
        };

        await addDoc(collection(fs, "audit_logs"), auditLogEntry);
      } catch (error) {
        console.error("Error logging activation initiation:", error);
      }
    }
  };

  const confirmArchive = async () => {
    try {
      await updateUser(selectedUser.uid, {
        ...selectedUser,
        user_status: "inactive",
      });
      setSelectedUser(null);
      setShowArchiveModal(false);
      fetchUsers(currentPage);
      setSnackbarMessage("User has been successfully archived.");
      setShowSnackbar(true);
      setTimeout(() => setShowSnackbar(false), 3000);
    } catch (error) {
      console.error("Failed to archive user:", error);
    }
  };

  const confirmActivate = async () => {
    try {
      await updateUser(selectedUser.uid, {
        ...selectedUser,
        user_status: "active",
      });
      setSelectedUser(null);
      setShowActivateModal(false);
      fetchUsers(currentPage);
      setSnackbarMessage("User has been successfully activated.");
      setShowSnackbar(true);
      setTimeout(() => setShowSnackbar(false), 3000);
    } catch (error) {
      console.error("Failed to activate user:", error);
    }
  };

  useEffect(() => {
    const handleResizeObserverError = (e) => {
      if (
        e.message ===
        "ResizeObserver loop completed with undelivered notifications."
      ) {
        e.preventDefault(); // Suppress the warning
      }
    };

    window.addEventListener("error", handleResizeObserverError);

    return () => {
      window.removeEventListener("error", handleResizeObserverError);
    };
  }, []);

  const clearForm = () => {
    setNewUser({
      display_name: "",
      middle_name: "",
      last_name: "",
      dob: "",
      email: "",
      password: "",
      city: "",
      member_type: "",
      user_status: "active",
      photo_url: "",
    });
    setPasswordStrength(0);
    setPasswordError("");
  };

  const handleOpenModal = () => {
    clearForm();
    setShowSignUpModal(true);
  };

  const handleCancel = () => {
    clearForm(); // Clear the form when canceling
    setShowSignUpModal(false);
  };

  const handleOpenSignUpModal = () => {
    clearForm(); // Clear form each time before opening the modal
    setShowSignUpModal(true);
  };

  const handleCloseSignUpModal = () => {
    setShowSignUpModal(false); // Close the modal first
    setTimeout(clearForm, 300); // Clear form data after modal is closed
  };

  const handleCloseModal = () => {
    setSelectedUser(null);
    setShowUserDetails(false); // Hide user details when closing modal
    setIsEditing(false); // Reset editing state
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Track changes before updating
      const previousData = await getUserById(selectedUser.uid); // Fetch current user data
      const changes = {};

      // Determine which fields were changed
      Object.keys(selectedUser).forEach((key) => {
        if (selectedUser[key] !== previousData[key]) {
          changes[key] = {
            oldValue: previousData[key] || "Not Set",
            newValue: selectedUser[key],
          };
        }
      });

      // Update user in Firestore
      await updateUser(selectedUser.uid, selectedUser);
      setSelectedUser(null);
      fetchUsers(currentPage);

      setSnackbarMessage("User details have been successfully updated.");
      setShowSnackbar(true);
      setTimeout(() => setShowSnackbar(false), 3000);

      // Fetch latest login activity for metadata
      const loginActivitySnapshot = await fs
        .collection("users")
        .doc(currentUser.uid)
        .collection("loginActivity")
        .orderBy("loginTime", "desc")
        .limit(1)
        .get();

      let ipAddress = "Unknown";
      let deviceName = "Unknown";

      if (!loginActivitySnapshot.empty) {
        const loginData = loginActivitySnapshot.docs[0].data();
        ipAddress = loginData.ipAddress || "Unknown";
        deviceName = loginData.deviceName || "Unknown";
      }

      // Add audit log entry with "UPDATE" as the action type
      const auditLogEntry = {
        actionType: "UPDATE",
        timestamp: new Date(),
        uid: auth.currentUser.uid,
        changes: changes,
        affectedData: {
          targetUserId: selectedUser.uid,
          targetUserName: selectedUser.display_name || "Unknown",
        },
        metadata: {
          ipAddress: ipAddress,
          userAgent: deviceName,
        },
      };

      await addDoc(collection(fs, "audit_logs"), auditLogEntry);
    } catch (error) {
      console.error("Failed to update user:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSelectedUser({ ...selectedUser, [name]: value });
  };

  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setLastVisible(null);
    fetchUsers(1);
  };

  const resetFilters = () => {
    setFilterStatus("all");
    setFilterType("");
    setCityFilter("all");
    setSearchText("");
    setLastVisible(null);
    fetchUsers(1);
  };

  const openImageModal = (imageUrl) => {
    window.open(imageUrl, "_blank");
  };

  const handleNewUserChange = (e) => {
    const { name, value } = e.target;
    setNewUser({ ...newUser, [name]: value });

    if (name === "password") {
      const passwordScore = zxcvbn(value).score;
      setPasswordStrength(passwordScore);

      const strongPasswordRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
      if (!strongPasswordRegex.test(value)) {
        setPasswordError(
          "Password must contain at least 8 characters, including uppercase, lowercase, numbers, and special characters."
        );
      } else {
        setPasswordError("");
      }
    }
  };
  const formatDate = (timestamp) =>
    timestamp?.seconds
      ? new Date(timestamp.seconds * 1000).toLocaleDateString()
      : "-";

  const formatTimestamp = (timestamp) =>
    timestamp?.seconds
      ? new Date(timestamp.seconds * 1000).toLocaleString()
      : "-";

  // Updated handleNewUserSubmit function
  const handleNewUserSubmit = async (e) => {
    e.preventDefault();

    // Validate password strength before proceeding
    if (passwordError || passwordStrength < 3) {
      alert("Please use a stronger password.");
      return;
    }

    let userCredential = null; // Initialize userCredential

    try {
      // Step 1: Get the current user's login activity data for metadata logging
      const loginActivitySnapshot = await getDocs(
        collection(fs, "users", auth.currentUser.uid, "loginActivity")
      );

      // Set default metadata values
      let ipAddress = "Unknown";
      let deviceName = "Unknown";

      // Extract IP and device info if login activity is available
      if (!loginActivitySnapshot.empty) {
        const loginData = loginActivitySnapshot.docs[0].data();
        ipAddress = loginData.ipAddress || "Unknown";
        deviceName = loginData.deviceName || "Unknown";
      }

      // Step 2: Create the new user in Firebase Authentication
      userCredential = await createUserWithEmailAndPassword(
        auth,
        newUser.email,
        newUser.password
      );
      const { uid } = userCredential.user;

      // Step 3: Add the new user to Firestore directly within the users collection
      await setDoc(doc(fs, "users", uid), {
        ...newUser,
        uid,
        user_status: "active", // Set new user to active by default
        created_time: new Date(), // Add a timestamp if desired
      });

      // Step 4: Log the creation in the audit logs
      const auditLogEntry = {
        actionType: "CREATE",
        timestamp: new Date(),
        uid: auth.currentUser.uid,
        changes: {
          action: "New User Created",
          targetUserId: uid,
          targetEmail: newUser.email,
        },
        affectedData: {
          adminUserId: auth.currentUser.uid,
          adminUserName: auth.currentUser.displayName || "Unknown",
          newUserId: uid,
        },
        metadata: {
          ipAddress,
          userAgent: deviceName,
        },
      };

      await addDoc(collection(fs, "audit_logs"), auditLogEntry);

      // Step 5: Close modal, reset the form, and navigate back to the root URL
      setShowSignUpModal(false);
      clearForm();
      alert("User added successfully.");

      // Optional: sign out the current user and redirect to login
      await signOut(auth);
      window.location.href = "/";
    } catch (error) {
      console.error("Failed to add new user:", error);
      alert("Failed to add new user: " + error.message);

      // If user creation failed mid-process, delete the orphaned user from Firebase Auth
      if (userCredential?.user) {
        await userCredential.user.delete();
      }
    }
  };

  return (
    <div className="dashboard-container">
      <SideNavBar />
      <div className="main-content">
        <br />
        <h3>Users</h3>
        <br />
        <input
          type="text"
          value={searchText}
          onChange={handleFilterChange(setSearchText)}
          placeholder="Search..."
        />
        &nbsp;&nbsp;
        <select onChange={handleFilterChange(setFilterType)} value={filterType}>
          <option value="" disabled>
            Roles
          </option>
          <option value="admin">Admin</option>
          <option value="lawyer">Lawyer</option>
          <option value="frontdesk">Frontdesk</option>
          <option value="client">Client</option>
        </select>
        &nbsp;&nbsp;
        <select onChange={handleFilterChange(setCityFilter)} value={cityFilter}>
          <option value="all" disabled>
            Cities
          </option>
          <option value="Angat">Angat</option>
          <option value="Balagtas">Balagtas</option>
          <option value="Baliuag">Baliuag</option>
          <option value="Bocaue">Bocaue</option>
          <option value="Bulakan">Bulakan</option>
          <option value="Bustos">Bustos</option>
          <option value="Calumpit">Calumpit</option>
          <option value="Doña Remedios Trinidad">Doña Remedios Trinidad</option>
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
        &nbsp;&nbsp;
        <select
          onChange={handleFilterChange(setFilterStatus)}
          value={filterStatus}
        >
          <option value="all" disabled>
            Active / Inactive
          </option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        &nbsp;&nbsp;
        <button onClick={resetFilters}>Reset Filters</button>
        &nbsp;&nbsp;
        <button
          onClick={handleOpenSignUpModal}
          style={{
            backgroundColor: "#1fs954",
            color: "white",
            padding: "10px 20px",
            cursor: "pointer",
            border: "none",
          }}
        >
          <FontAwesomeIcon icon={faUserPlus} /> Sign Up
        </button>
        <br />
        <p>Total Filtered Items: {totalFilteredItems}</p>
        <table className="table table-striped table-bordered">
          <thead>
            <tr>
              <th>#</th>
              <th>First Name</th>
              <th>Middle Name</th>
              <th>Last Name</th>
              <th>Email</th>
              <th>City</th>
              <th>Member Type</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => (
              <tr key={user.uid}>
                <td>{(currentPage - 1) * pageSize + index + 1}.</td>
                <td>{user.display_name}</td>
                <td>{user.middle_name}</td>
                <td>{user.last_name}</td>
                <td>{user.email}</td>
                <td>{user.city || "N/A"}</td>
                <td>
                  {editingUserId === user.uid ? (
                    <select
                      name="member_type"
                      value={selectedUser ? selectedUser.member_type : ""}
                      onChange={handleChange}
                    >
                      <option value="admin">Admin</option>
                      <option value="head">Head Lawyer</option>
                      <option value="lawyer">Legal Aid Volunteer</option>
                      <option value="frontdesk">Front Desk</option>
                      <option value="client">Client</option>
                    </select>
                  ) : (
                    capitalizeFirstLetter(user.member_type)
                  )}
                </td>
                <td>{capitalizeFirstLetter(user.user_status)}</td>
                <td>
                  <button
                    onClick={() => toggleDetails(user)}
                    style={{
                      backgroundColor: "#4267B2",
                      color: "white",
                      border: "none",
                      padding: "5px 10px",
                      cursor: "pointer",
                    }}
                  >
                    <FontAwesomeIcon icon={faEye} />
                  </button>
                  &nbsp; &nbsp;
                  {userData?.member_type === "admin" &&
                    ["frontdesk", "head", "lawyer", "client", "admin"].includes(
                      user.member_type
                    ) && (
                      <button
                        onClick={() =>
                          editingUserId === user.uid
                            ? handleSave(user)
                            : handleEdit(user)
                        }
                        style={{
                          backgroundColor:
                            editingUserId === user.uid ? "#4CAF50" : "#1fs954",
                          color: "white",
                          border: "none",
                          padding: "5px 10px",
                          cursor: "pointer",
                        }}
                      >
                        <FontAwesomeIcon
                          icon={editingUserId === user.uid ? faCheck : faEdit}
                        />
                      </button>
                    )}
                  &nbsp; &nbsp;
                  {userData?.member_type === "admin" && (
                    <>
                      {user.user_status === "inactive" ? (
                        <button
                          onClick={() => handleActivate(user)}
                          style={{
                            backgroundColor: "#4CAF50",
                            color: "white",
                            border: "none",
                            padding: "5px 10px",
                            cursor: "pointer",
                          }}
                        >
                          <FontAwesomeIcon icon={faSync} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleArchive(user)}
                          style={{
                            backgroundColor: "#ff8b61",
                            color: "white",
                            border: "none",
                            padding: "5px 10px",
                            cursor: "pointer",
                          }}
                        >
                          <FontAwesomeIcon icon={faArchive} />
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination>
          <Pagination.First
            onClick={handleFirst}
            disabled={currentPage === 1}
          />
          <Pagination.Prev
            onClick={handlePrevious}
            disabled={currentPage === 1}
          />
          {[...Array(totalPages).keys()].map((_, index) => (
            <Pagination.Item
              key={index + 1}
              active={index + 1 === currentPage}
              onClick={() => handlePageClick(index + 1)}
            >
              {index + 1}
            </Pagination.Item>
          ))}
          <Pagination.Next
            onClick={handleNext}
            disabled={currentPage === totalPages}
          />
          <Pagination.Last
            onClick={handleLast}
            disabled={currentPage === totalPages}
          />
        </Pagination>
        {showSnackbar && <div className="snackbar">{snackbarMessage}</div>}
        {showUserDetails && selectedUser && !showArchiveModal && (
          <div className="client-eligibility">
            <div style={{ position: "relative" }}>
              <button
                onClick={handleCloseModal}
                className="close-button"
                style={{ position: "absolute", top: "15px", right: "15px" }}
              >
                ×
              </button>
            </div>
            <br />
            <h2>User Details</h2>
            <section className="mb-4">
              <table>
                <thead>
                  <tr>
                    <th>User ID:</th>
                    <td>{selectedUser.uid}</td>
                  </tr>
                  <tr>
                    <th>Photo:</th>
                    <td>
                      {selectedUser.photo_url ? (
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            openImageModal(selectedUser.photo_url);
                          }}
                        >
                          <img
                            src={selectedUser.photo_url}
                            alt="Profile Photo"
                            className="img-thumbnail"
                            style={{ width: "100px", cursor: "pointer" }}
                          />
                        </a>
                      ) : (
                        "Not Available"
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th>First Name:</th>
                    <td>{capitalizeFirstLetter(selectedUser.display_name)}</td>
                  </tr>
                  <tr>
                    <th>Middle Name:</th>
                    <td>{capitalizeFirstLetter(selectedUser.middle_name)}</td>
                  </tr>
                  <tr>
                    <th>Last Name:</th>
                    <td>{capitalizeFirstLetter(selectedUser.last_name)}</td>
                  </tr>
                  <tr>
                    <th>Date of Birth:</th>
                    <td>{formatDate(selectedUser.dob || "-")}</td>
                  </tr>
                  <tr>
                    <th>Email:</th>
                    <td>{selectedUser.email}</td>
                  </tr>
                  <tr>
                    <th>City:</th>
                    <td>{selectedUser.city}</td>
                  </tr>
                  <tr>
                    <th>Member Type:</th>
                    <td>{capitalizeFirstLetter(selectedUser.member_type)}</td>
                  </tr>
                  <tr>
                    <th>Status:</th>
                    <td>{capitalizeFirstLetter(selectedUser.user_status)}</td>
                  </tr>
                  <tr>
                    <th>Created Time:</th>
                    <td>
                      <td>{formatTimestamp(selectedUser.created_time)}</td>
                    </td>
                  </tr>
                </thead>
              </table>
            </section>
          </div>
        )}
      </div>

      {showArchiveModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal active">
            <div className="custom-modal-header">
              <h5>Archive User</h5>
              <span
                className="custom-modal-close"
                onClick={() => setShowArchiveModal(false)}
              >
                ×
              </span>
            </div>
            <div className="custom-modal-body">
              Are you sure you want to archive this account and set it as
              inactive?
            </div>
            <div className="custom-modal-footer">
              <button
                className="custom-cancel-button"
                onClick={() => setShowArchiveModal(false)}
              >
                Cancel
              </button>
              <button
                className="custom-confirm-button"
                onClick={confirmArchive}
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activate User Modal */}
      {showActivateModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal active">
            <div className="custom-modal-header">
              <h5>Activate User</h5>
              <span
                className="custom-modal-close"
                onClick={() => setShowActivateModal(false)}
              >
                ×
              </span>
            </div>
            <div className="custom-modal-body">
              Are you sure you want to activate this account?
            </div>
            <div className="custom-modal-footer">
              <button
                className="custom-cancel-button"
                onClick={() => setShowActivateModal(false)}
              >
                Cancel
              </button>
              <button
                className="custom-activate-button"
                onClick={confirmActivate}
              >
                Activate
              </button>
            </div>
          </div>
        </div>
      )}

      {showSignUpModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal">
            <div className="custom-modal-header">
              <h4>Sign Up</h4>
              <button
                onClick={handleCloseSignUpModal}
                className="custom-close-button"
              >
                ×
              </button>
            </div>
            <div className="custom-modal-body">
              <form onSubmit={(e) => handleNewUserSubmit(e)} autoComplete="off">
                <div className="form-group">
                  <label htmlFor="display_name">First Name</label>
                  <input
                    type="text"
                    className="form-control"
                    id="display_name"
                    name="display_name"
                    value={newUser.display_name}
                    onChange={handleNewUserChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="middle_name">Middle Name</label>
                  <input
                    type="text"
                    className="form-control"
                    id="middle_name"
                    name="middle_name"
                    value={newUser.middle_name}
                    onChange={handleNewUserChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="last_name">Last Name</label>
                  <input
                    type="text"
                    className="form-control"
                    id="last_name"
                    name="last_name"
                    value={newUser.last_name}
                    onChange={handleNewUserChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    id="email"
                    name="email"
                    value={newUser.email}
                    onChange={handleNewUserChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="dob">Date of Birth</label>
                  <input
                    type="date"
                    className="form-control"
                    id="dob"
                    name="dob"
                    value={newUser.dob}
                    onChange={handleNewUserChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={passwordVisible ? "text" : "password"}
                      className="form-control"
                      id="password"
                      name="password"
                      value={newUser.password}
                      onChange={handleNewUserChange}
                      required
                    />
                    <FontAwesomeIcon
                      icon={passwordVisible ? faEyeSlash : faEye}
                      onClick={togglePasswordVisibility}
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        cursor: "pointer",
                      }}
                    />
                  </div>
                  {passwordError && (
                    <small className="text-danger">{passwordError}</small>
                  )}
                  <div className="password-strength-meter">
                    <progress
                      className={`strength-meter strength-${passwordStrength}`}
                      value={passwordStrength}
                      max="4"
                    />
                    <p>
                      Password Strength:{" "}
                      {["Weak", "Fair", "Good", "Strong"][passwordStrength]}
                    </p>
                  </div>
                </div>

                {/* Generate Strong Password Button */}
                <button
                  type="button"
                  className="custom-generate-button"
                  onClick={generatePassword}
                >
                  <FontAwesomeIcon icon={faKey} /> Generate Strong Password
                </button>

                <div className="form-group">
                  <br />
                  <label htmlFor="city">City</label>
                  <select
                    className="form-control"
                    id="city"
                    name="city"
                    value={newUser.city}
                    onChange={handleNewUserChange}
                  >
                    <option value="" disabled>
                      Select a city
                    </option>
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
                <div className="form-group">
                  <label htmlFor="member_type">Role</label>
                  <select
                    className="form-control"
                    id="member_type"
                    name="member_type"
                    value={newUser.member_type}
                    onChange={handleNewUserChange}
                    required
                  >
                    <option value="" disabled>
                      Select role
                    </option>
                    <option value="admin">Admin</option>
                    <option value="head">Head Lawyer</option>
                    <option value="lawyer">Legal Aid Volunteer</option>
                    <option value="frontdesk">Front Desk</option>
                    <option value="client">Client</option>
                  </select>
                </div>
                <div
                  className="form-group-full"
                  style={{ textAlign: "center" }}
                >
                  <button
                    type="button"
                    className="custom-cancel-button"
                    onClick={handleCloseSignUpModal}
                  >
                    Cancel
                  </button>
                  &nbsp;&nbsp;
                  <button type="submit" className="custom-confirm-button">
                    Add User
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Users;
