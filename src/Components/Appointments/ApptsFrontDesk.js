import React, { useState, useEffect } from "react";
import { FirebaseStorage } from "firebase/storage";
import SideNavBar from "../SideNavBar/SideNavBar";
import "../Dashboard/Dashboard.css";
import "./Appointments.css";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Pagination from "react-bootstrap/Pagination";
import {
  updateAppointment,
  getBookedSlots,
  getUserById,
  getUsers,
  getAppointments,
} from "../../Config/FirebaseServices";
import { useAuth } from "../../contexts/AuthContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { fs, auth, signInWithGoogle } from "../../Config/Firebase";
import {
  addDoc,
  collection,
  query,
  where,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  Timestamp,
  orderBy,
  limit,
} from "firebase/firestore"; // Add these imports for Firestore
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

import {
  faEye,
  faCheck,
  faCalendarAlt,
  faVideo,
} from "@fortawesome/free-solid-svg-icons";
import { Tooltip, OverlayTrigger } from "react-bootstrap";
import ibpLogo from "../../Assets/img/ibp_logo.png";

function ApptsFrontDesk() {
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [filter, setFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [lastVisible, setLastVisible] = useState(null);
  const predefinedOptions = [
    "Payong Legal (Legal Advice)",
    "Legal na Representasyon (Legal Representation)",
    "Pag gawa ng Legal na Dokumento (Drafting of Legal Document)"
  ];

  const pageSize = 7;
  const [clientEligibility, setClientEligibility] = useState({
    eligibility: "",
    denialReason: "",
    notes: "",
    ibpParalegalStaff: "",
    assistingCounsel: "",
  });
  const [appointmentDate, setAppointmentDate] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState(null);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [appointmentType, setAppointmentType] = useState(""); // Appointment Type (In-person or Online)
  const [rescheduleAppointmentType, setRescheduleAppointmentType] =
    useState(""); // Rescheduled appointment type
  const [bookedSlots, setBookedSlots] = useState([]);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // New state to prevent duplicate submissions
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState("");
  const { currentUser } = useAuth();
  const [reviewerDetails, setReviewerDetails] = useState(null);
  const [proceedingNotes, setProceedingNotes] = useState("");
  const [showProceedingNotesForm, setShowProceedingNotesForm] = useState(false);
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [natureOfLegalAssistanceFilter, setNatureOfLegalAssistanceFilter] =
    useState("all");
  const [totalFilteredItems, setTotalFilteredItems] = useState(0);
  const [lawyers, setLawyers] = useState([]);
  const [assignedLawyerDetails, setAssignedLawyerDetails] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [isRescheduleHistoryOpen, setIsRescheduleHistoryOpen] = useState(false);
  const [proceedingFile, setProceedingFile] = useState(null);
  const [clientAttend, setClientAttend] = useState(null);
  const navigate = useNavigate();
  const auth = getAuth();
  const [reschedulerNames, setReschedulerNames] = useState({});
  const latestReason = selectedAppointment?.rescheduleHistory
    ?.filter(entry => entry.rescheduleReason) // ensure it has the reason
    ?.slice(-1)[0]?.rescheduleReason || "No reason provided";

  useEffect(() => {
    const fetchReschedulerNames = async () => {
      const names = {};
      for (const entry of selectedAppointment?.rescheduleHistory || []) {
        const uid = entry.rescheduledByUid;
        if (uid && !names[uid]) {
          const user = await getUserById(uid);
          if (user) {
            names[uid] = `${user.display_name} ${user.middle_name || ""} ${user.last_name}`;
          }
        }
      }
      setReschedulerNames(names);
    };

    if (selectedAppointment?.rescheduleHistory) {
      fetchReschedulerNames();
    }
  }, [selectedAppointment]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // If user is not authenticated, redirect to the login page
        navigate("/");
      }
    });

    return () => unsubscribe(); // Clean up the listener on component unmount
  }, [auth, navigate]);

  const toggleRescheduleHistory = () => {
    setIsRescheduleHistoryOpen((prevState) => !prevState);
  };

  const generateJitsiLink = (controlNumber) => {
    const roomName = controlNumber ? controlNumber : `room-${Date.now()}`;
    const password = Math.floor(
      1000000000 + Math.random() * 9000000000
    ).toString();

    return {
      link: `https://8x8/vpaas-magic-cookie-ef5ce88c523d41a599c8b1dc5b3ab765/${roomName}`,
      password: password,
    };
  };

  const handlePrint = () => {
    if (!selectedAppointment) {
      alert("No appointment selected");
      return;
    }

    const printWindow = window.open("", "", "width=900,height=1200");

    const uploaded = selectedAppointment.uploadedImages || {};
    const images = [
      { label: "Barangay Certificate", url: uploaded.barangayImageUrl },
      { label: "DSWD Certificate", url: uploaded.dswdImageUrl },
      { label: "PAO Disqualification Letter", url: uploaded.paoImageUrl },
      { label: "Consultation Attachment", url: uploaded.proceedingFileUrl },
      { label: "New Request File", url: uploaded.newRequestUrl },
    ].filter((img) => img.url);

    const qr = selectedAppointment.qrCode || "";
    const appointmentDate = selectedAppointment.appointmentDate?.toDate
      ? selectedAppointment.appointmentDate.toDate().toLocaleString("en-US")
      : "N/A";

    const dob = selectedAppointment.dob?.toDate
      ? selectedAppointment.dob.toDate().toLocaleDateString("en-US")
      : "N/A";

    printWindow.document.write(`
      <html>
      <head>
        <title>Appointment Summary</title>
        <style>
          @page {
            size: A4;
            margin: 0.2in 0.3in; /* top/bottom 0.2in, left/right 0.3in */
          }
          body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            color: #000;
            margin: 0;
          }
          .section {
            page-break-after: always;
            padding: 0.3in;
          }
          .section:last-of-type {
            page-break-after: auto;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }
          .header .logo {
            width: 80px;
          }
          .header .qr {
            width: 100px;
          }
          h2 {
            text-align: center;
            margin-top: 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          table, th, td {
            border: 1px solid #444;
          }
          th, td {
            padding: 8px;
            text-align: left;
          }
.image-page {
  page-break-before: always;
  margin: 0;
  padding: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}

.image-page img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  margin: 0;
  padding: 0;
}


        </style>
      </head>
      <body>
        <div class="section">
          <div class="header">
            <img src="${ibpLogo}" class="logo" alt="IBP Logo" />
            ${qr
        ? `<img src="${qr}" class="qr" alt="Appointment QR Code" />`
        : ""
      }
          </div>
          <h2>Integrated Bar of the Philippines – Malolos Chapter</h2>
          <table>
            <tr><th>Control Number</th><td>${selectedAppointment.controlNumber
      }</td></tr>
            <tr><th>Status</th><td>${selectedAppointment.appointmentStatus
      }</td></tr>
            <tr><th>Type</th><td>${selectedAppointment.apptType}</td></tr>
            <tr><th>Appointment Date</th><td>${appointmentDate}</td></tr>
            <tr><th>Full Name</th><td>${selectedAppointment.display_name} ${selectedAppointment.middle_name
      } ${selectedAppointment.last_name}</td></tr>
            <tr><th>Birthdate</th><td>${dob}</td></tr>
            <tr><th>Phone</th><td>${selectedAppointment.phone}</td></tr>
            <tr><th>Gender</th><td>${selectedAppointment.gender}</td></tr>
            <tr><th>Address</th><td>${selectedAppointment.address}</td></tr>
            <tr><th>Spouse</th><td>${selectedAppointment.spouse}</td></tr>
            <tr><th>Spouse Occupation</th><td>${selectedAppointment.spouseOccupation
      }</td></tr>
            <tr><th>Children Names and Ages</th><td>${selectedAppointment.childrenNamesAges
      }</td></tr>
            <tr><th>Occupation</th><td>${selectedAppointment.occupation
      }</td></tr>
            <tr><th>Employment Type</th><td>${selectedAppointment.employmentType
      }</td></tr>
            <tr><th>Employer</th><td>${selectedAppointment.employerName
      }</td></tr>
            <tr><th>Employer Address</th><td>${selectedAppointment.employerAddress
      }</td></tr>
            <tr><th>Monthly Income</th><td>${selectedAppointment.monthlyIncome
      }</td></tr>
            <tr><th>Legal Assistance Type</th><td>${selectedAppointment.selectedAssistanceType
      }</td></tr>
            <tr><th>Problem</th><td>${selectedAppointment.problems}</td></tr>
            <tr><th>Problem Reason</th><td>${selectedAppointment.problemReason
      }</td></tr>
            <tr><th>Desired Solutions</th><td>${selectedAppointment.desiredSolutions
      }</td></tr>
          </table>
        </div>
  
        ${images
        .map(
          (img) => `
          <div class="image-page">
            <img src="${img.url}" />
          </div>`
        )
        .join("")}
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.onafterprint = () => printWindow.close();
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
    const fetchAppointments = async () => {
      const { data, total } = await getAppointments(
        filter,
        lastVisible,
        pageSize,
        searchText,
        natureOfLegalAssistanceFilter
      );

      const sortedAppointments = data.sort((a, b) => {
        const today = new Date();
        const aDate = a.appointmentDate?.toDate?.() ?? null;
        const bDate = b.appointmentDate?.toDate?.() ?? null;

        const isAWalkIn = a.apptType === "Walk-in";
        const isBWalkIn = b.apptType === "Walk-in";

        const isAToday = aDate && aDate.toDateString() === today.toDateString();
        const isBToday = bDate && bDate.toDateString() === today.toDateString();

        // Walk-in first
        if (isAWalkIn && !isBWalkIn) return -1;
        if (!isAWalkIn && isBWalkIn) return 1;

        // Today's appointments second
        if (isAToday && !isBToday) return -1;
        if (!isAToday && isBToday) return 1;

        // Descending order by date (handle cases where date might be missing)
        if (aDate && bDate) return bDate - aDate;
        if (aDate) return -1;
        if (bDate) return 1;

        return 0; // No valid date for comparison, keep order unchanged
      });

      setAppointments(sortedAppointments);
      setTotalPages(Math.ceil(total / pageSize));
      setTotalFilteredItems(total);
    };

    fetchAppointments();
  }, [filter, lastVisible, searchText, natureOfLegalAssistanceFilter]);

  useEffect(() => {
    const unsubscribe = getBookedSlots((slots) => {
      setBookedSlots(slots);
    });

    return () => unsubscribe && unsubscribe();
  }, []);

  useEffect(() => {
    setSelectedAppointment(null);
    setShowProceedingNotesForm(false);
    setShowRescheduleForm(false);
    setShowScheduleForm(false);
  }, [filter]);

  useEffect(() => {
    const fetchReviewerDetails = async (reviewefsy) => {
      if (reviewefsy) {
        const userData = await getUserById(reviewefsy);
        setReviewerDetails(userData);
      }
    };

    if (selectedAppointment?.reviewefsy) {
      fetchReviewerDetails(selectedAppointment.reviewefsy);
    }
  }, [selectedAppointment]);

  useEffect(() => {
    const fetchAssignedLawyerDetails = async (assignedLawyerId) => {
      if (assignedLawyerId) {
        const userData = await getUserById(assignedLawyerId);
        setAssignedLawyerDetails(userData);
      }
    };

    if (selectedAppointment?.assignedLawyer) {
      fetchAssignedLawyerDetails(selectedAppointment.assignedLawyer);
    }
  }, [selectedAppointment]);

  useEffect(() => {
    const fetchLawyers = async () => {
      const { users } = await getUsers(
        "active",
        "lawyer",
        "all",
        "",
        null,
        100
      );
      setLawyers(users);
    };
    fetchLawyers();
  }, [clientEligibility.eligibility]);

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const capitalizeFirstLetter = (string) => {
    if (!string) return "";
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  const isWeekday = (date) => {
    const day = date.getDay();
    return day === 2 || day === 4;
  };

  const isSlotBooked = (dateTime, slots = bookedSlots) => {
    return slots.some(
      (bookedDate) => dateTime.toISOString() === bookedDate.toISOString()
    );
  };

  const filterDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isHoliday = holidays.some(
      (holiday) => holiday.toDateString() === date.toDateString()
    );

    const isFullyBooked =
      bookedSlots.filter((slot) => slot.toDateString() === date.toDateString())
        .length === 4;

    return !isHoliday && isWeekday(date) && date >= today && !isFullyBooked;
  };

  const filterTime = (time) => {
    if (!(time instanceof Date)) return false;
    const hours = time.getHours();
    const minutes = time.getMinutes();
    const now = new Date();

    if (hours < 13 || hours >= 17 || time <= now) return false;

    const dateTime = new Date(appointmentDate);
    dateTime.setHours(hours, minutes, 0, 0);

    return !isSlotBookefsyAssignedLawyer(dateTime);
  };

  const handleNext = async () => {
    if (currentPage < totalPages) {
      const { data, lastDoc } = await getAppointments(
        filter,
        lastVisible,
        pageSize,
        searchText,
        natureOfLegalAssistanceFilter,
        false // Forward navigation
      );
      setAppointments(data);
      setLastVisible(lastDoc);
      setCurrentPage((prev) => prev + 1); // Move to the next page
    }
  };

  const handlePrevious = async () => {
    if (currentPage > 1) {
      const { data, firstDoc } = await getAppointments(
        filter,
        lastVisible,
        pageSize,
        searchText,
        natureOfLegalAssistanceFilter,
        true // Backward navigation
      );
      setAppointments(data);
      setLastVisible(firstDoc);
      setCurrentPage((prev) => prev - 1); // Move to the previous page
    }
  };

  const handleFirst = async () => {
    const { data, firstDoc } = await getAppointments(
      filter,
      null,
      pageSize,
      searchText,
      natureOfLegalAssistanceFilter
    );
    setAppointments(data);
    setLastVisible(firstDoc);
    setCurrentPage(1); // Reset to the first page
  };
  const handleLast = async () => {
    try {
      // Calculate the correct starting point for the last page
      const skipDocuments = (totalPages - 1) * pageSize;

      // Fetch data starting from the calculated point for the last page
      const { data, lastDoc } = await getAppointments(
        filter,
        null, // We start fresh for the last page fetch
        pageSize,
        searchText,
        natureOfLegalAssistanceFilter,
        false, // Forward navigation
        true, // Indicates moving to the last page
        skipDocuments // Skip documents to reach the last page
      );

      // Update the state with the last page data
      setAppointments(data);
      setLastVisible(lastDoc);
      setCurrentPage(totalPages); // Set to the last page
    } catch (error) {
      console.error("Error navigating to the last page:", error);
    }
  };

  const toggleDetails = (appointment) => {
    console.log("Selected Appointment: ", appointment);

    setSelectedAppointment(
      selectedAppointment?.id === appointment.id ? null : appointment
    );
    setShowProceedingNotesForm(false);
    setShowRescheduleForm(false);
    setShowScheduleForm(false);
  };

  const handleCloseModal = () => {
    setSelectedAppointment(null);
  };

  const handleEligibilityChange = (e) => {
    setClientEligibility({ ...clientEligibility, eligibility: e.target.value });
    setAppointmentDate(null);
  };

  const openImageModal = (url) => {
    setCurrentImageUrl(url);
    setIsModalOpen(true);
  };

  // ImageModal Component Definition
  const ImageModal = ({ isOpen, url, onClose }) => {
    if (!isOpen) return null;

    return (
      <div
        className="modal-overlay"
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          zIndex: 9999, // 👈 ensure this is higher than any Bootstrap/other modals
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className="modal-content"
          style={{
            position: "relative",
            maxWidth: "90%",
            maxHeight: "90%",
            zIndex: 10000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={url}
            alt="Preview"
            style={{
              width: "100%",
              height: "auto",
              borderRadius: "8px",
              boxShadow: "0 0 15px rgba(0,0,0,0.5)",
            }}
          />
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              background: "white",
              border: "none",
              borderRadius: "50%",
              width: 30,
              height: 30,
              fontSize: 18,
              cursor: "pointer",
              zIndex: 10001,
            }}
          >
            &times;
          </button>
        </div>
      </div>
    );
  };

  const handleDenialReasonChange = (e) => {
    const value = e.target.value;
    const denialReasonMap = {
      meansTest:
        "Persons who do not pass the means and merit test (sec. 5 of the Revised Manual of Operations of the NCLA)",
      alreadyRepresented:
        "Parties already represented by a counsel de parte (sec. 5 of the Revised Manual of Operations of the NCLA)",
    };
    setClientEligibility({
      ...clientEligibility,
      denialReason: denialReasonMap[value],
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setClientEligibility({ ...clientEligibility, [name]: value });
  };

  const handleNotesChange = (e) => {
    setProceedingNotes(e.target.value);
  };

  const handleRescheduleChange = (e) => {
    setRescheduleReason(e.target.value);
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
        ipAddress: activityData.ipAddress || "Unknown",
        deviceName: activityData.deviceName || "Unknown",
      };
    }
    return { ipAddress: "Unknown", deviceName: "Unknown" };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Get selected lawyer's full name
      const selectedLawyer = lawyers.find(
        (lawyer) => lawyer.uid === clientEligibility.assistingCounsel
      );
      const lawyerFullName = selectedLawyer
        ? `${selectedLawyer.display_name} ${selectedLawyer.middle_name} ${selectedLawyer.last_name}`
        : "Not Available";

      const updatedData = {
        "updatedTime": Timestamp.fromDate(new Date()),
        "clientEligibility.eligibility": clientEligibility.eligibility,
        "appointmentDetails.appointmentStatus":
          clientEligibility.eligibility === "yes" ? "approved" : "denied",
        "clientEligibility.denialReason": clientEligibility.denialReason,
        "clientEligibility.notes": clientEligibility.notes?.trim()
          ? clientEligibility.notes
          : clientEligibility.eligibility === "no"
            ? "Ineligible"
            : clientEligibility.eligibility === "yes"
              ? "All Documents Verified."
              : "No further reason provided.",
        "appointmentDetails.assignedLawyer": clientEligibility.assistingCounsel,
        "updatedTime": Timestamp.fromDate(new Date()),
      };

      await updateAppointment(selectedAppointment.id, updatedData);

      // 🔔 Notify client
      if (selectedAppointment?.uid && selectedAppointment?.controlNumber) {
        let message = "";

        if (clientEligibility.eligibility === "yes") {
          message = `Your request (ID: ${selectedAppointment.id}) has been approved.`;
        } else {
          message = `Your request (ID: ${selectedAppointment.id}) has been denied.`;
        }
      }
      const { ipAddress, deviceName } = await fetchLatestLoginActivity(
        currentUser.uid
      );

      // Prepare audit log with checks for undefined fields
      const auditLogEntry = {
        actionType: "UPDATE",
        timestamp: new Date(),
        uid: currentUser.uid,
        changes: {
          eligibility:
            selectedAppointment.clientEligibility?.eligibility !== undefined
              ? {
                oldValue: selectedAppointment.clientEligibility.eligibility,
                newValue: clientEligibility.eligibility,
              }
              : null,
          appointmentStatus:
            selectedAppointment.appointmentStatus !== undefined
              ? {
                oldValue: selectedAppointment.appointmentStatus,
                newValue:
                  clientEligibility.eligibility === "yes"
                    ? "approved"
                    : "denied",
              }
              : null,
          denialReason:
            selectedAppointment.clientEligibility?.denialReason !== undefined
              ? {
                oldValue: selectedAppointment.clientEligibility.denialReason,
                newValue: clientEligibility.denialReason,
              }
              : null,
          updatedTime:
            selectedAppointment.updatedTime !== undefined
              ? {
                oldValue: selectedAppointment.updatedTime,
                newValue: Timestamp.fromDate(new Date()),
              }
              : null,
        },
        affectedData: { appointmentId: selectedAppointment.id },
        metadata: { ipAddress, userAgent: deviceName },
      };

      // Remove any null entries in the `changes` map
      Object.keys(auditLogEntry.changes).forEach(
        (key) =>
          auditLogEntry.changes[key] === undefined &&
          delete auditLogEntry.changes[key]
      );

      // Add audit log entry
      await addDoc(collection(fs, "audit_logs"), auditLogEntry);

      setSnackbarMessage("Form has been successfully submitted.");
      setSelectedAppointment(null);
    } catch (error) {
      console.error("Error submitting form:", error);
      setSnackbarMessage("Error submitting form, please try again.");
    } finally {
      setIsSubmitting(false);
      setShowSnackbar(true);
      setTimeout(() => setShowSnackbar(false), 3000);
      // Reset form fields
      setClientEligibility({
        eligibility: "",
        denialReason: "",
        notes: "",
        ibpParalegalStaff: "",
        assistingCounsel: "",
      });
      setSelectedAppointment(null);
    }
  };

  const getFormattedDate = (timestamp, includeTime = false) => {
    if (!timestamp || !(timestamp instanceof Timestamp)) {
      console.error("Invalid timestamp: ", timestamp);
      return "N/A";
    }
    const date = timestamp.toDate();
    const options = { year: "numeric", month: "long", day: "numeric" };
    if (includeTime) {
      options.hour = "numeric";
      options.minute = "numeric";
      options.hour12 = true;
    }
    return date.toLocaleString("en-US", options);
  };

  const getDayClassName = (date) => {
    const isFullyBooked =
      bookedSlots.filter(
        (slot) =>
          slot.getDate() === date.getDate() &&
          slot.getMonth() === date.getMonth() &&
          slot.getFullYear() === date.getFullYear() &&
          slot.getHours() >= 13 &&
          slot.getHours() < 17
      ).length === 4;

    const isAssignedToCurrentLawyer = appointments.some(
      (appointment) =>
        appointment.assignedLawyer === currentUser.uid &&
        appointment.appointmentDate.toDate().toDateString() ===
        date.toDateString()
    );

    return isFullyBooked || isAssignedToCurrentLawyer
      ? "fully-booked-day disabled-day"
      : "";
  };

  const getTimeClassName = (time) => {
    const hours = time.getHours();

    // Hide times outside of 1:00 PM to 4:00 PM
    if (hours < 13 || hours > 16) {
      return "hidden-time"; // Apply the hidden-time class to hide these times
    }

    const dateTime = new Date(appointmentDate);
    dateTime.setHours(hours, time.getMinutes(), 0, 0);

    // Check if the slot is already booked
    if (isSlotBookefsyAssignedLawyer(dateTime)) {
      return "booked-time disabled-time"; // Mark the slot as booked and disable it
    }

    return ""; // Return no class if the time slot is valid
  };

  const filterRescheduleTime = (time) => {
    if (!(time instanceof Date)) return false;
    const hours = time.getHours();
    const minutes = time.getMinutes();
    const now = new Date();

    if (hours < 13 || hours >= 17 || time <= now) return false;

    const dateTime = new Date(rescheduleDate);
    dateTime.setHours(hours, minutes, 0, 0);

    return !isSlotBookefsyAssignedLawyer(dateTime);
  };

  const isSlotBookefsyAssignedLawyer = (dateTime) => {
    return appointments.some((appointment) => {
      const appointmentDate = appointment.appointmentDate;
      const assignedLawyer = appointment.assignedLawyer;

      return (
        assignedLawyer === selectedAppointment?.assignedLawyer &&
        appointmentDate?.toDate().getTime() === dateTime.getTime()
      );
    });
  };

  const isSlotBookefsyCurrentUser = (dateTime) => {
    return bookedSlots.some(
      (slot) =>
        slot.getDate() === dateTime.getDate() &&
        slot.getMonth() === dateTime.getMonth() &&
        slot.getFullYear() === dateTime.getFullYear() &&
        slot.getHours() === dateTime.getHours() &&
        slot.getMinutes() === dateTime.getMinutes() &&
        slot.assignedLawyer === currentUser.uid
    );
  };

  const getTimeRescheduleClassName = (time) => {
    const hours = time.getHours();

    // Hide times outside of 1:00 PM to 4:00 PM
    if (hours < 13 || hours > 16) {
      return "hidden-time"; // Apply the hidden-time class
    }

    const dateTime = new Date(rescheduleDate);
    dateTime.setHours(hours, time.getMinutes(), 0, 0);

    // Check if the slot is booked by the assigned lawyer
    if (isSlotBookefsyAssignedLawyer(dateTime)) {
      return "booked-time disabled-time"; // Apply class for booked slots
    }

    return ""; // Default return if slot is valid
  };

  const resetFilters = () => {
    setFilter("all");
    setSearchText("");
    setNatureOfLegalAssistanceFilter("all");
    setLastVisible(null);
    setCurrentPage(1);
  };

  if (!currentUser) {
    return <div>Loading...</div>;
  }

  const renderTooltip = (props) => (
    <Tooltip id="button-tooltip" {...props}>
      {props.title}
    </Tooltip>
  );

  return (
    <div className="dashboard-container">
      <SideNavBar />
      <div className="main-content">
        <br />
        <h3>Appointments</h3>
        <br />
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search..."
        />
        &nbsp;&nbsp;
        <select onChange={(e) => setFilter(e.target.value)} value={filter}>
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="refused">Refused</option>
          <option value="accepted">Accepted</option>
          <option value="scheduled">Scheduled</option>
          <option value="missed">Missed</option>
          <option value="done">Done</option>
        </select>
        &nbsp;&nbsp;
        <select
          onChange={(e) => setNatureOfLegalAssistanceFilter(e.target.value)}
          value={natureOfLegalAssistanceFilter}
        >
          <option value="all">Nature of Legal Assistance</option>
          {predefinedOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value="Others">Others</option>
        </select>
        &nbsp;&nbsp;
        <button onClick={resetFilters}>Reset Filters</button>
        <br />
        <p>Total Filtered Items: {totalFilteredItems}</p>
        <table className="table table-striped table-bordered">
          <thead>
            <tr>
              <th>#</th>
              <th>Control Number</th>
              <th>Full Name</th>
              <th>Legal Assistance</th>
              <th>Scheduled Date</th>
              <th>Type</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {appointments.length > 0 ? (
              appointments.map((appointment, index) => (
                <tr key={appointment.id}>
                  <td>{(currentPage - 1) * pageSize + index + 1}.</td>
                  <td>{appointment.controlNumber}</td>
                  <td>
                    {appointment.display_name} {appointment.middle_name}{" "}
                    {appointment.last_name}
                  </td>
                  <td>{appointment.selectedAssistanceType}</td>
                  <td>{getFormattedDate(appointment.appointmentDate, true)}</td>
                  <td>
                    {capitalizeFirstLetter(appointment.apptType || "N/A")}
                  </td>
                  <td>
                    {capitalizeFirstLetter(
                      appointment.appointmentStatus || "N/A"
                    )}
                  </td>
                  <td>
                    <center>
                      <OverlayTrigger
                        placement="top"
                        overlay={renderTooltip({ title: "View" })}
                      >
                        <button
                          onClick={() => toggleDetails(appointment)}
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
                      </OverlayTrigger>
                    </center>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" style={{ textAlign: "center" }}>
                  No results found.
                </td>
              </tr>
            )}
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
              onClick={() => {
                setCurrentPage(index + 1);
                setLastVisible(appointments[index]);
              }}
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
        {selectedAppointment &&
          !showProceedingNotesForm &&
          !showRescheduleForm &&
          (!showScheduleForm ||
            selectedAppointment.appointmentStatus !== "approved") && (
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
              <br />
              <h2>Appointment Details</h2>
              <div id="appointment-details-section">
                <section className="mb-4 print-section">
                  <h2>
                    <em
                      style={{
                        color: "#a34bc9",
                        fontSize: "16px",
                      }}
                    >
                      Applicant Profile
                    </em>
                  </h2>
                  <table className="table table-striped table-bordered">
                    <tbody>
                      <tr>
                        <th>Full Name:</th>
                        <td>
                          {selectedAppointment.display_name}{" "}
                          {selectedAppointment.middle_name}{" "}
                          {selectedAppointment.last_name}
                        </td>
                      </tr>
                      <tr>
                        <th>Date of Birth:</th>
                        <td>
                          {selectedAppointment.dob?.toDate
                            ? selectedAppointment.dob
                              .toDate()
                              .toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })
                            : "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <th>Contact Number:</th>
                        <td>{selectedAppointment.phone || "Not Available"}</td>
                      </tr>
                      <>
                        <tr>
                          <th>Address:</th>
                          <td>
                            {selectedAppointment.address || "Not Available"}
                          </td>
                        </tr>
                        <tr>
                          <th>Gender:</th>
                          <td>
                            {selectedAppointment.gender || "Not Specified"}
                          </td>
                        </tr>
                        <tr>
                          <th>Spouse Name:</th>
                          <td>
                            {selectedAppointment.spouse || "Not Available"}
                          </td>
                        </tr>
                        <tr>
                          <th>Spouse Occupation:</th>
                          <td>
                            {selectedAppointment.spouseOccupation ||
                              "Not Available"}
                          </td>
                        </tr>
                        <tr>
                          <th>Children Names and Ages:</th>
                          <td>
                            {selectedAppointment.childrenNamesAges ||
                              "Not Available"}
                          </td>
                        </tr>
                      </>
                    </tbody>
                  </table>
                </section>
                <br />
                <section className="mb-4 print-section">
                  {(selectedAppointment.newRequest ||
                    selectedAppointment.requestReason) && (
                      <section className="mb-4 print-section no-print">
                        <h2>
                          <em style={{ color: "#a34bc9", fontSize: "16px" }}>
                            New Request Details
                          </em>
                        </h2>
                        <table className="table table-striped table-bordered">
                          <tbody>
                            {/* Only show the control number if newRequest is true */}
                            {selectedAppointment.newRequest &&
                              !selectedAppointment?.requestReason && (
                                <tr>
                                  <th>New Request Control Number:</th>
                                  <td>
                                    {selectedAppointment?.newControlNumber ||
                                      "N/A"}
                                  </td>
                                </tr>
                              )}
                            <tr>
                              <th>Reason for New Request:</th>
                              <td>
                                {selectedAppointment?.requestReason || "N/A"}
                              </td>
                            </tr>
                            {/* Only show Attached File if it exists */}
                            {selectedAppointment?.newRequestUrl && (
                              <tr>
                                <th>Attached File:</th>
                                <td>
                                  <a
                                    href={selectedAppointment?.newRequestUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    View File
                                  </a>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </section>
                    )}
                  <br />
                  <h2>
                    <em style={{ color: "#a34bc9", fontSize: "16px" }}>
                      Basic Information
                    </em>
                  </h2>
                  <table className="table table-striped table-bordered">
                    <tbody>
                      <tr className="no-print">
                        <th>QR Code:</th>
                        <td>
                          {selectedAppointment ? (
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                openImageModal(selectedAppointment.qrCode);
                              }}
                            >
                              <img
                                src={selectedAppointment.qrCode}
                                alt="QR Code"
                                className="img-thumbnail qr-code-image"
                                style={{ width: "100px", cursor: "pointer" }}
                              />
                            </a>
                          ) : (
                            "Not Available"
                          )}
                        </td>
                      </tr>
                      {selectedAppointment.apptType === "Online" && (
                        <tr className="no-print">
                          <th>Meeting Link:</th>
                          <td>
                            {selectedAppointment?.apptType === "Online" ? (
                              selectedAppointment?.appointmentStatus ===
                                "done" ? (
                                // Appointment is done, show "Done" with a check icon
                                <button
                                  style={{
                                    backgroundColor: "#1fs954", // Green background for "Done"
                                    color: "white",
                                    border: "none",
                                    padding: "5px 8px",
                                    cursor: "not-allowed",
                                    display: "flex",
                                    alignItems: "center",
                                  }}
                                  disabled // Make the button unclickable
                                >
                                  <FontAwesomeIcon
                                    icon={faCheck}
                                    style={{ marginRight: "8px" }}
                                  />
                                  Done
                                </button>
                              ) : selectedAppointment.clientAttend === "no" ? (
                                // If client didn't attend, show "Unavailable" with a red background
                                <button
                                  style={{
                                    backgroundColor: "#dc3545", // Red background for "Unavailable"
                                    color: "white",
                                    border: "none",
                                    padding: "5px 8px",
                                    cursor: "not-allowed",
                                  }}
                                  disabled // Make the button unclickable
                                >
                                  Unavailable
                                </button>
                              ) : (
                                <button
                                  onClick={() =>
                                    window.open(
                                      `/vpaas-magic-cookie-ef5ce88c523d41a599c8b1dc5b3ab765/${selectedAppointment.id}`,
                                      "_blank"
                                    )
                                  }
                                  style={{
                                    backgroundColor: "#28a745", // Green background for active Join
                                    color: "white",
                                    border: "none",
                                    padding: "5px 8px",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                  }}
                                >
                                  <FontAwesomeIcon
                                    icon={faVideo}
                                    style={{ marginRight: "8px" }}
                                  />
                                  Join
                                </button>
                              )
                            ) : (
                              "N/A"
                            )}
                          </td>
                        </tr>
                      )}
                      <tr>
                        <th>Control Number:</th>
                        <td>{selectedAppointment.controlNumber}</td>
                      </tr>
                      <tr>
                        <th>Date Request Created:</th>
                        <td>
                          {getFormattedDate(selectedAppointment.createdDate)}
                        </td>
                      </tr>
                      <tr>
                        <th>Appointment Type:</th>
                        <td>{selectedAppointment.apptType || "N/A"}</td>
                      </tr>
                      <tr>
                        <th>Appointment Status:</th>
                        <td>
                          {capitalizeFirstLetter(
                            selectedAppointment.appointmentStatus
                          )}
                        </td>
                      </tr>
                      <>
                        {selectedAppointment.appointmentStatus ===
                          "scheduled" && (
                            <>
                              <tr>
                                <th>Eligibility:</th>
                                <td>
                                  {capitalizeFirstLetter(
                                    selectedAppointment.clientEligibility
                                      ?.eligibility || "N/A"
                                  )}
                                </td>
                              </tr>
                              <tr>
                                <th>Assigned Lawyer:</th>
                                <td>
                                  {assignedLawyerDetails
                                    ? `${assignedLawyerDetails.display_name} ${assignedLawyerDetails.middle_name} ${assignedLawyerDetails.last_name}`
                                    : "Not Available"}
                                </td>
                              </tr>
                              <tr>
                                <th>Eligibility Notes:</th>
                                <td>
                                  {selectedAppointment.clientEligibility?.notes ||
                                    "N/A"}
                                </td>
                              </tr>
                              <tr>
                                <th>Appointment Date:</th>
                                <td>
                                  {getFormattedDate(
                                    selectedAppointment.appointmentDate,
                                    true
                                  )}
                                </td>
                              </tr>
                            </>
                          )}

                        {selectedAppointment.appointmentStatus === "denied" && (
                          <>
                            <tr>
                              <th>Assigned Lawyer:</th>
                              <td>
                                {assignedLawyerDetails
                                  ? `${assignedLawyerDetails.display_name} ${assignedLawyerDetails.middle_name} ${assignedLawyerDetails.last_name}`
                                  : "Not Available"}
                              </td>
                            </tr>
                            <tr>
                              <th>Denial Reason:</th>
                              <td>
                                {selectedAppointment.clientEligibility
                                  ?.denialReason || "N/A"}
                              </td>
                            </tr>
                            <tr>
                              <th>Eligibility Notes:</th>
                              <td>
                                {selectedAppointment.clientEligibility?.notes ||
                                  "N/A"}
                              </td>
                            </tr>
                          </>
                        )}
                        {selectedAppointment.appointmentStatus === "done" && (
                          <>
                            <tr>
                              <th>Appointment Date:</th>
                              <td>
                                {getFormattedDate(
                                  selectedAppointment.appointmentDate,
                                  true
                                )}
                              </td>
                            </tr>
                            <tr>
                              <th>Eligibility:</th>
                              <td>
                                {capitalizeFirstLetter(
                                  selectedAppointment.clientEligibility
                                    ?.eligibility || "N/A"
                                )}
                              </td>
                            </tr>
                            <tr>
                              <th>Assigned Lawyer:</th>
                              <td>
                                {assignedLawyerDetails
                                  ? `${assignedLawyerDetails.display_name} ${assignedLawyerDetails.middle_name} ${assignedLawyerDetails.last_name}`
                                  : "Not Available"}
                              </td>
                            </tr>
                            <tr>
                              <th>Eligibility Notes:</th>
                              <td>
                                {selectedAppointment.clientEligibility?.notes ||
                                  "N/A"}
                              </td>
                            </tr>
                            <tr>
                              <th>Remarks (Record of Consultation):</th>
                              <td>
                                {selectedAppointment?.proceedingNotes || "N/A"}
                              </td>
                            </tr>
                            <tr>
                              <th>IBP Paralegal Staff:</th>
                              <td>
                                {selectedAppointment.clientEligibility
                                  ?.ibpParalegalStaff || "N/A"}
                              </td>
                            </tr>
                            <tr>
                              <th>Assisting Counsel:</th>
                              <td>
                                {selectedAppointment.clientEligibility
                                  ?.assistingCounsel || "N/A"}
                              </td>
                            </tr>
                          </>
                        )}
                        {selectedAppointment.appointmentStatus ===
                          "approved" && (
                            <>
                              <tr>
                                <th>Eligibility:</th>
                                <td>
                                  {capitalizeFirstLetter(
                                    selectedAppointment.clientEligibility
                                      ?.eligibility || "N/A"
                                  )}
                                </td>
                              </tr>
                              <tr>
                                <th>Assigned Lawyer:</th>
                                <td>
                                  {assignedLawyerDetails
                                    ? `${assignedLawyerDetails.display_name} ${assignedLawyerDetails.middle_name} ${assignedLawyerDetails.last_name}`
                                    : "Not Available"}
                                </td>
                              </tr>
                              <tr>
                                <th>Eligibility Notes:</th>
                                <td>
                                  {selectedAppointment.clientEligibility?.notes ||
                                    "N/A"}
                                </td>
                              </tr>
                            </>
                          )}
                      </>
                    </tbody>
                  </table>
                </section>
                <br />
                {selectedAppointment?.rescheduleHistory &&
                  selectedAppointment.rescheduleHistory.length > 0 ? (
                  <section className="mb-4 print-section no-print">
                    <h2
                      style={{ cursor: "pointer" }}
                      onClick={toggleRescheduleHistory}
                    >
                      <em style={{ color: "#a34bc9", fontSize: "16px" }}>
                        Reschedule History {isRescheduleHistoryOpen ? "▲" : "▼"}
                      </em>
                    </h2>
                    {isRescheduleHistoryOpen && (
                      <table className="table table-striped table-bordered">
                        <thead>
                          <tr
                            style={{
                              backgroundColor: "#f2f2f2",
                              textAlign: "left",
                            }}
                          >
                            <th style={{ padding: "10px" }}>Original Date</th>
                            <th style={{ padding: "10px" }}>Original Type</th>
                            <th style={{ padding: "10px" }}>Reason</th>
                            <th style={{ padding: "10px" }}>Person Rescheduled</th>
                            <th style={{ padding: "10px" }}>Status</th>
                            <th style={{ padding: "10px" }}>Time Updated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedAppointment.rescheduleHistory.map(
                            (entry, index) => (
                              <tr key={index}>
                                <td style={{ padding: "10px" }}>
                                  {getFormattedDate(entry.rescheduleDate, true)}
                                </td>
                                <td style={{ padding: "10px" }}>
                                  {entry.rescheduleAppointmentType || "N/A"}
                                </td>
                                <td style={{ padding: "10px" }}>
                                  {entry.rescheduleReason || "N/A"}
                                </td>
                                <td style={{ padding: "10px" }}>
                                  {reschedulerNames[entry.rescheduledByUid] || entry.rescheduledByUid}
                                </td>
                                <td style={{ padding: "10px" }}>
                                  {getFormattedDate(
                                    entry.rescheduleTimestamp,
                                    true
                                  )}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    )}
                  </section>
                ) : (
                  <p>No reschedule history available.</p>
                )}
                <br />
                <section className="mb-4 print-section employment-profile">
                  <h2>
                    <em
                      style={{
                        color: "#a34bc9",
                        fontSize: "16px",
                      }}
                    >
                      Employment Profile
                    </em>
                  </h2>
                  <table className="table table-striped table-bordered">
                    <tbody>
                      <tr>
                        <th>Occupation:</th>
                        <td>
                          {selectedAppointment.occupation || "Not Available"}
                        </td>
                      </tr>
                      <tr>
                        <th>Type of Employment:</th>
                        <td>
                          {selectedAppointment.employmentType ||
                            "Not Specified"}
                        </td>
                      </tr>
                      <tr>
                        <th>Employer Name:</th>
                        <td>
                          {selectedAppointment.employerName || "Not Available"}
                        </td>
                      </tr>
                      <tr>
                        <th>Employer Address:</th>
                        <td>
                          {selectedAppointment.employerAddress ||
                            "Not Available"}
                        </td>
                      </tr>
                      <tr>
                        <th>Monthly Income:</th>
                        <td>
                          {selectedAppointment.monthlyIncome || "Not Available"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </section>
                <br />
                <section className="mb-4 print-section">
                  <h2>
                    <em
                      style={{
                        color: "#a34bc9",
                        fontSize: "16px",
                      }}
                    >
                      Nature of Legal Assistance Requested
                    </em>
                  </h2>
                  <table className="table table-striped table-bordered">
                    <tbody>
                      <tr>
                        <th>Type of Legal Assistance:</th>
                        <td>
                          {selectedAppointment.selectedAssistanceType ||
                            "Not Specified"}
                        </td>
                      </tr>
                      <>
                        <tr>
                          <th>Problem:</th>
                          <td>
                            {selectedAppointment.problems || "Not Available"}
                          </td>
                        </tr>
                        <tr>
                          <th>Reason for Problem:</th>
                          <td>
                            {selectedAppointment.problemReason ||
                              "Not Available"}
                          </td>
                        </tr>
                        <tr>
                          <th>Desired Solutions:</th>
                          <td>
                            {selectedAppointment.desiredSolutions ||
                              "Not Available"}
                          </td>
                        </tr>
                      </>
                    </tbody>
                  </table>
                </section>
                <br />
                <section className="mb-4 print-section no-print">
                  <h2>
                    <em style={{ color: "#a34bc9", fontSize: "16px" }}>
                      Uploaded Images
                    </em>
                  </h2>
                  <table className="table table-striped table-bordered">
                    <tbody>
                      <tr>
                        <th>Barangay Certificate of Indigency:</th>
                        <td>
                          {selectedAppointment.uploadedImages
                            ?.barangayImageUrl ? (
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                openImageModal(
                                  selectedAppointment.uploadedImages
                                    ?.barangayImageUrl
                                );
                              }}
                            >
                              <img
                                src={
                                  selectedAppointment.uploadedImages
                                    ?.barangayImageUrl
                                }
                                alt="Barangay Certificate of Indigency"
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
                        <th>DSWD Certificate of Indigency:</th>
                        <td>
                          {selectedAppointment.uploadedImages?.dswdImageUrl ? (
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                openImageModal(
                                  selectedAppointment.uploadedImages
                                    ?.dswdImageUrl
                                );
                              }}
                            >
                              <img
                                src={
                                  selectedAppointment.uploadedImages
                                    ?.dswdImageUrl
                                }
                                alt="DSWD Certificate of Indigency"
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
                        <th>Disqualification Letter from PAO:</th>
                        <td>
                          {selectedAppointment.uploadedImages?.paoImageUrl ? (
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                openImageModal(
                                  selectedAppointment.uploadedImages
                                    ?.paoImageUrl
                                );
                              }}
                            >
                              <img
                                src={
                                  selectedAppointment.uploadedImages
                                    ?.paoImageUrl
                                }
                                alt="Disqualification Letter from PAO"
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
                        <th>Consultation Remarks Attached File:</th>
                        <td>
                          {selectedAppointment.uploadedImages
                            ?.proceedingFileUrl ? (
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                openImageModal(
                                  selectedAppointment.uploadedImages
                                    ?.proceedingFileUrl
                                );
                              }}
                            >
                              <img
                                src={
                                  selectedAppointment.uploadedImages
                                    ?.proceedingFileUrl
                                }
                                alt="Consultation Remarks Attached File"
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
                        <th>Recent Reschedule Request File:</th>
                        <td>
                          {selectedAppointment.uploadedImages?.newRequestUrl ? (
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                openImageModal(
                                  selectedAppointment.uploadedImages
                                    ?.newRequestUrl
                                );
                              }}
                            >
                              <img
                                src={
                                  selectedAppointment.uploadedImages
                                    ?.newRequestUrl
                                }
                                alt="Recent Reschedule Request File"
                                className="img-thumbnail"
                                style={{ width: "100px", cursor: "pointer" }}
                              />
                            </a>
                          ) : (
                            "Not Available"
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </section>
                <br />
                {isModalOpen && (
                  <ImageModal
                    isOpen={isModalOpen}
                    url={currentImageUrl}
                    onClose={closeModal}
                  />
                )}
              </div>
              <center>
                <button onClick={handlePrint} className="print-button">
                  Print Document
                </button>
              </center>
            </div>
          )}
        <br />
        {showSnackbar && (
          <div className="snackbar">
            <p>{snackbarMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ApptsFrontDesk;
