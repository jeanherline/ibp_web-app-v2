import React, { useState, useEffect } from "react";
import SideNavBar from "../SideNavBar/SideNavBar";
import "../Dashboard/Dashboard.css";
import "./Appointments.css";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Pagination from "react-bootstrap/Pagination";
import {
  getLawyerAppointments,
  updateAppointment,
  getBookedSlots,
  getUserById,
  getUsers,
  sendNotification,
  getHeadLawyerUid,
} from "../../Config/FirebaseServices";
import { useAuth } from "../../contexts/AuthContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { fs, collection, auth, signInWithGoogle } from "../../Config/Firebase";
import {
  addDoc,
  query,
  where,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  Timestamp,
  orderBy,
  limit,
} from "firebase/firestore"; // Add these imports for Firestore // Add these imports for Firestore
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

import {
  faEye,
  faCheck,
  faCalendarAlt,
  faVideo,
  faBan,
  faFileEdit,
  faFileSignature,
} from "@fortawesome/free-solid-svg-icons";
import { Tooltip, OverlayTrigger } from "react-bootstrap";
import ibpLogo from "../../Assets/img/ibp_logo.png";

function ApptsLawyer() {
  const [isLoading, setIsLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [filter, setFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lastVisible, setLastVisible] = useState(null);
  const pageSize = 7;
  const [clientAttend, setClientAttend] = useState(null);
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
  const navigate = useNavigate();
  const auth = getAuth();
  const [showAcceptRefuseModal, setShowAcceptRefuseModal] = useState(false);
  const [actionType, setActionType] = useState(""); // "accept" or "refuse"
  const [refuseReason, setRefuseReason] = useState("");
  const [activeView, setActiveView] = useState(""); // 'view', 'eligibility', 'reassign'
  const [userData, setUserData] = useState(null);
  const [appointmentHour, setAppointmentHour] = useState("");
  const [appointmentMinute, setAppointmentMinute] = useState("");
  const [appointmentAmPm, setAppointmentAmPm] = useState("PM");
  const [rescheduleHour, setRescheduleHour] = useState("");
  const [rescheduleMinute, setRescheduleMinute] = useState("");
  const [rescheduleAmPm, setRescheduleAmPm] = useState("PM");
  const [selectedLawyerUid, setSelectedLawyerUid] = useState("");

  const isToday = (timestamp) => {
    const date = timestamp?.toDate?.() || new Date(timestamp);
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  const formatDateSafely = (dateValue) => {
    try {
      const date = dateValue?.toDate
        ? dateValue.toDate()
        : new Date(dateValue);
      return isNaN(date.getTime())
        ? "N/A"
        : date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
    } catch (e) {
      return "N/A";
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (currentUser?.uid) {
        const userRef = doc(fs, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserData(userSnap.data());
        }
      }
    };

    fetchUserData();
  }, [currentUser]);

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

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();

    if (!appointmentDate || !appointmentType) {
      setSnackbarMessage("Appointment date and type are required.");
      setShowSnackbar(true);
      return;
    }

    let meetingLink = null;

    if (appointmentType === "Online") {
      const { link, password } = generateJitsiLink(
        selectedAppointment.controlNumber
      );
      meetingLink = link;
    }
    const fullDate = new Date(appointmentDate);
    let h = parseInt(appointmentHour);
    if (appointmentAmPm === "PM" && h < 12) h += 12;
    if (appointmentAmPm === "AM" && h === 12) h = 0;
    fullDate.setHours(h, parseInt(appointmentMinute), 0, 0);

    const isSlotTakenForLawyer = async (
      date,
      lawyerUid,
      currentAppointmentId
    ) => {
      const start = Timestamp.fromDate(date);
      const end = Timestamp.fromDate(new Date(date.getTime() + 59 * 60 * 1000)); // +/- 59 mins

      const q = query(
        collection(fs, "appointments"),
        where("assignedLawyer", "==", lawyerUid),
        where("appointmentDate", ">=", start),
        where("appointmentDate", "<=", end)
      );

      const snapshot = await getDocs(q);

      return snapshot.docs.some((doc) => {
        const data = doc.data();
        return (
          doc.id !== currentAppointmentId && data?.appointmentStatus !== "done"
        );
      });
    };

    const updatedData = {
      "appointmentDetails.appointmentDate": Timestamp.fromDate(fullDate),

      "appointmentDetails.appointmentStatus": "scheduled",
      "appointmentDetails.scheduleType": appointmentType,
      ...(meetingLink && {
        "appointmentDetails.meetingLink": meetingLink,
      }),
    };

    try {
      await updateAppointment(selectedAppointment.id, updatedData);

      const appointmentId = selectedAppointment.id;
      const appointmentDateFormatted = getFormattedDate(appointmentDate, true);

      const lawyerFullName = assignedLawyerDetails
        ? `${assignedLawyerDetails.display_name} ${assignedLawyerDetails.middle_name} ${assignedLawyerDetails.last_name}`
        : "Assigned Lawyer Not Available";

      // Send notifications to the client, assigned lawyer, and head lawyer
      if (selectedAppointment.uid && selectedAppointment.controlNumber) {
        await sendNotification(
          `Your request (ID: ${appointmentId}) has been scheduled for an appointment.`,
          selectedAppointment.uid,
          "appointment",
          selectedAppointment.controlNumber
        );
      }

      if (assignedLawyerDetails?.uid) {
        await sendNotification(
          `You have chosen a type of appointment for request (ID: ${appointmentId}).`,
          assignedLawyerDetails.uid,
          "appointment"
        );
      }

      // Notify the head lawyer
      const headLawyerUid = await getHeadLawyerUid();
      if (headLawyerUid) {
        await sendNotification(
          `The request (ID: ${appointmentId}) has been scheduled a date for an appointment.`,
          headLawyerUid,
          "appointment"
        );
      }

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

      // Prepare audit log entry
      const auditLogEntry = {
        actionType: "UPDATE",
        timestamp: new Date(),
        uid: currentUser.uid,
        changes: {
          appointmentDate: selectedAppointment.appointmentDetails
            ?.appointmentDate
            ? {
              oldValue: selectedAppointment.appointmentDate,
              newValue: appointmentDate,
            }
            : null,
          scheduleType: selectedAppointment.scheduleType
            ? {
              oldValue: selectedAppointment.scheduleType,
              newValue: appointmentType,
            }
            : null,
          appointmentStatus: selectedAppointment.appointmentDetails
            ?.appointmentStatus
            ? {
              oldValue: selectedAppointment.appointmentStatus,
              newValue: "scheduled",
            }
            : null,
          ...(meetingLink && {
            meetingLink: {
              oldValue: selectedAppointment.meetingLink || null,
              newValue: meetingLink,
            },
          }),
        },
        affectedData: {
          appointmentId: appointmentId,

        },
        metadata: {
          ipAddress: ipAddress,
          userAgent: deviceName,
        },
      };

      // Remove any null entries in the `changes` map
      Object.keys(auditLogEntry.changes).forEach(
        (key) =>
          auditLogEntry.changes[key] === null &&
          delete auditLogEntry.changes[key]
      );

      // Add audit log entry
      await addDoc(collection(fs, "audit_logs"), auditLogEntry);

      // Update the appointments state directly for immediate UI update
      setAppointments((prevAppointments) =>
        prevAppointments.map((appt) =>
          appt.id === selectedAppointment.id
            ? { ...appt, ...updatedData }
            : appt
        )
      );

      // Clear form fields
      setAppointmentDate(null);
      setAppointmentType("");

      setSnackbarMessage("Appointment successfully scheduled.");
      setShowSnackbar(true);
      setTimeout(() => {
        setShowSnackbar(false);
        setSelectedAppointment(null);
        clearFormFields();
      }, 3000);
    } catch (error) {
      console.error("Error scheduling appointment:", error);
      setSnackbarMessage("Error scheduling appointment, please try again.");
      setShowSnackbar(true);
    }
  };


  const handlePrint = () => {
    if (!selectedAppointment) {
      alert("No appointment selected");
      return;
    }

    const printWindow = window.open("", "", "width=900,height=1200");

    const images = [
      {
        label: "Barangay Certificate",
        url: selectedAppointment.barangayImageUrl,
      },
      { label: "DSWD Certificate", url: selectedAppointment.dswdImageUrl },
      {
        label: "PAO Disqualification Letter",
        url: selectedAppointment.paoImageUrl,
      },
      {
        label: "Consultation Attachment",
        url: selectedAppointment.proceedingFileUrl,
      },
      { label: "New Request File", url: selectedAppointment.newRequestUrl },
    ].filter((img) => img.url);

    const qr = selectedAppointment.appointmentDetails.qrCode || "";
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
          margin: 0.2in 0.3in;
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
          ${qr ? `<img src="${qr}" class="qr" alt="Appointment QR Code" />` : ""
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
          <tr><th>Occupation</th><td>${selectedAppointment.occupation}</td></tr>
          <tr><th>Employment Type</th><td>${selectedAppointment.employmentType
      }</td></tr>
          <tr><th>Employer</th><td>${selectedAppointment.employerName}</td></tr>
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
    const unsubscribe = getLawyerAppointments(
      filter,
      lastVisible,
      pageSize,
      searchText,
      natureOfLegalAssistanceFilter,
      currentUser,
      (result) => {
        const { data, total } = result;
        console.log(data); // Check if rescheduleHistory is included here
        setAppointments(data);
        setTotalPages(Math.ceil(total / pageSize));
        setTotalFilteredItems(total);
        setIsLoading(false);
      }
    );

    return () => unsubscribe && unsubscribe();
  }, [
    filter,
    lastVisible,
    searchText,
    natureOfLegalAssistanceFilter,
    currentUser,
  ]);

  useEffect(() => {
    const unsubscribe = getBookedSlots((slots) => {
      setBookedSlots(slots);
    });

    return () => unsubscribe && unsubscribe();
  }, []);

  useEffect(() => {
    setSelectedAppointment(null);
    clearFormFields();

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
      fetchReviewerDetails(selectedAppointment.appointmentDetails.reviewefsy);
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
      fetchAssignedLawyerDetails(
        selectedAppointment.appointmentDetails.assignedLawyer
      );
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

  const isHourFullyBooked = (hour, date, lawyerUid) => {
    const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    return minutes.every((minute) => {
      const slot = new Date(date);
      slot.setHours(hour, minute, 0, 0);
      return isSlotTakenForLawyer(slot, lawyerUid, appointments);
    });
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
      const { data, lastDoc } = await getLawyerAppointments(
        filter,
        lastVisible,
        pageSize,
        searchText,
        natureOfLegalAssistanceFilter,
        currentUser
      );
      setAppointments(data);
      setLastVisible(lastDoc);
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevious = async () => {
    if (currentPage > 1) {
      const { data, firstDoc } = await getLawyerAppointments(
        filter,
        lastVisible,
        pageSize,
        searchText,
        natureOfLegalAssistanceFilter,
        currentUser,
        true
      );
      setAppointments(data);
      setLastVisible(firstDoc);
      setCurrentPage((prevPage) => prevPage - 1);
    }
  };

  const handleFirst = async () => {
    const { data, firstDoc } = await getLawyerAppointments(
      filter,
      null,
      pageSize,
      searchText,
      natureOfLegalAssistanceFilter,
      currentUser
    );
    setAppointments(data);
    setLastVisible(firstDoc);
    setCurrentPage(1);
  };

  const handleLast = async () => {
    const { data, lastDoc } = await getLawyerAppointments(
      filter,
      lastVisible,
      pageSize,
      searchText,
      natureOfLegalAssistanceFilter,
      currentUser,
      false,
      true
    );
    setAppointments(data);
    setLastVisible(lastDoc);
    setCurrentPage(totalPages);
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
    clearFormFields();
    setShowScheduleForm(false);
    setShowRescheduleForm(false);
    setShowProceedingNotesForm(false);
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
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="image-container">
            <img
              src={url}
              alt="Fullscreen Image"
              className="fullscreen-image"
            />
          </div>
          <button onClick={onClose} className="close-button">
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
        "clientEligibility.eligibility": clientEligibility.eligibility,
        "appointmentDetails.appointmentStatus":
          clientEligibility.eligibility === "yes" ? "approved" : "denied",
        "clientEligibility.denialReason": clientEligibility.denialReason,
        "clientEligibility.notes": clientEligibility.notes,
        "appointmentDetails.assignedLawyer": clientEligibility.assistingCounsel,
        "appointmentDetails.updatedTime": Timestamp.fromDate(new Date()),
      };

      await updateAppointment(selectedAppointment.id, updatedData);

      // Fetch latest login activity
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
                oldValue:
                  selectedAppointment.appointmentDetails.appointmentStatus,
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
                oldValue: selectedAppointment.appointmentDetails.updatedTime,
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
      clearFormFields();
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
      clearFormFields();
    }
  };
  const handleAccept = async () => {
    if (!selectedAppointment) return;
    try {
      await updateAppointment(selectedAppointment.id, {
        "appointmentDetails.appointmentStatus": "accepted",
      });
      setSnackbarMessage("Appointment successfully accepted!");
      setShowSnackbar(true);
      setShowAcceptRefuseModal(false);
      setSelectedAppointment(null);
      clearFormFields();
    } catch (error) {
      console.error("Error accepting appointment:", error);
      setSnackbarMessage("Error accepting appointment. Please try again.");
      setShowSnackbar(true);
    }
  };

  const handleRefuse = async () => {
    if (!selectedAppointment) return;
    if (!refuseReason.trim()) {
      alert("Please provide a refusal reason.");
      return;
    }

    try {
      const lawyerUid = currentUser?.uid || "Unknown UID";

      const refusalEntry = {
        reason: refuseReason,
        lawyerUid: lawyerUid, // ✅ Save the UID, not the displayName
        timestamp: Timestamp.fromDate(new Date()),
      };

      const appointmentRef = doc(fs, "appointments", selectedAppointment.id);
      const appointmentSnapshot = await getDoc(appointmentRef);

      const existingData = appointmentSnapshot.data();
      const currentRefusalHistory = existingData?.refusalHistory || [];

      const updatedData = {
        "appointmentDetails.appointmentStatus": "refused",
        "appointmentDetails.refusalHistory": [
          ...currentRefusalHistory,
          refusalEntry,
        ],
      };

      await updateDoc(appointmentRef, updatedData);

      setSnackbarMessage("Appointment has been refused.");
      setShowSnackbar(true);
      setShowAcceptRefuseModal(false);
      setRefuseReason("");
      setSelectedAppointment(null);
      clearFormFields();
    } catch (error) {
      console.error("Error refusing appointment:", error);
      setSnackbarMessage("Error refusing appointment. Please try again.");
      setShowSnackbar(true);
    }
  };

  const isSlotTakenForLawyer = (date, lawyerUid, appointments) => {
    return appointments.some((appt) => {
      const apptLawyer = appt?.assignedLawyer;
      const apptDate = appt?.appointmentDate?.toDate();
      return (
        apptLawyer === lawyerUid &&
        apptDate?.getTime() === date?.getTime() &&
        appt?.appointmentStatus !== "done"
      );
    });
  };

  const handleSubmitProceedingNotes = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      let fileUrl = null;

      // Check if a file is selected and upload it to Firebase Storage
      if (proceedingFile) {
        const currentUid = currentUser.uid;
        const controlNumber = selectedAppointment.controlNumber;
        const fullName = `${selectedAppointment.display_name || ""}_${selectedAppointment.middle_name || ""}_${selectedAppointment.last_name || ""}`.replace(/ /g, "_");
        // Get Firebase storage reference
        const storage = getStorage();
        const fileRef = ref(
          storage,
          `konsulta_user_uploads/${currentUid}/${controlNumber}/${fullName}_${controlNumber}_proceedingNotesFile`
        );

        // Upload the file
        await uploadBytes(fileRef, proceedingFile);
        fileUrl = await getDownloadURL(fileRef);
      }

      // Determine appointment status based on client attendance
      const appointmentStatus = clientAttend === "yes" ? "done" : "missed";

      // Update appointment data in Firestore
      const updatedData = {
        "appointmentDetails.proceedingNotes": proceedingNotes,
        "appointmentDetails.ibpParalegalStaff":
          clientEligibility.ibpParalegalStaff,
        "appointmentDetails.assistingCounsel":
          clientEligibility.assistingCounsel,
        "appointmentDetails.appointmentStatus": appointmentStatus,
        "appointmentDetails.updatedTime": Timestamp.fromDate(new Date()),
        "appointmentDetails.clientAttend": clientAttend,
        "appointmentDetails.proceedingFileUrl": fileUrl,
      };

      await updateAppointment(selectedAppointment.id, updatedData);

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

      // Add audit log entry
      const auditLogEntry = {
        actionType: "UPDATE",
        timestamp: new Date(),
        uid: currentUser.uid,
        changes: {
          proceedingNotes: selectedAppointment.appointmentDetails
            ?.proceedingNotes
            ? {
              oldValue:
                selectedAppointment.appointmentDetails.proceedingNotes,
              newValue: proceedingNotes,
            }
            : null,
          ibpParalegalStaff: selectedAppointment.appointmentDetails
            ?.ibpParalegalStaff
            ? {
              oldValue:
                selectedAppointment.appointmentDetails.ibpParalegalStaff,
              newValue: clientEligibility.ibpParalegalStaff,
            }
            : null,
          assistingCounsel: selectedAppointment.appointmentDetails
            ?.assistingCounsel
            ? {
              oldValue:
                selectedAppointment.appointmentDetails.assistingCounsel,
              newValue: clientEligibility.assistingCounsel,
            }
            : null,
          appointmentStatus: selectedAppointment.appointmentDetails
            ?.appointmentStatus
            ? {
              oldValue:
                selectedAppointment.appointmentDetails.appointmentStatus,
              newValue: appointmentStatus,
            }
            : null,
          clientAttend: selectedAppointment.clientAttend
            ? {
              oldValue: selectedAppointment.appointmentDetails.clientAttend,
              newValue: clientAttend,
            }
            : null,
          proceedingFileUrl: selectedAppointment.appointmentDetails
            ?.proceedingFileUrl
            ? {
              oldValue:
                selectedAppointment.appointmentDetails.proceedingFileUrl,
              newValue: fileUrl,
            }
            : null,
          updatedTime: selectedAppointment.updatedTime
            ? {
              oldValue: selectedAppointment.appointmentDetails.updatedTime,
              newValue: Timestamp.fromDate(new Date()),
            }
            : null,
        },
        affectedData: {
          appointmentId: selectedAppointment.id,

        },
        metadata: {
          ipAddress: ipAddress,
          userAgent: deviceName,
        },
      };

      // Remove any null entries in the `changes` map
      Object.keys(auditLogEntry.changes).forEach(
        (key) =>
          auditLogEntry.changes[key] === null &&
          delete auditLogEntry.changes[key]
      );

      // Add audit log entry to Firestore
      await addDoc(collection(fs, "audit_logs"), auditLogEntry);

      // Notify success and reset form values
      setSnackbarMessage("Remarks have been successfully submitted.");
      setProceedingNotes("");
      setProceedingFile(null);
      setClientAttend(null);
      setClientEligibility({
        ...clientEligibility,
        ibpParalegalStaff: "",
        assistingCounsel: "",
      });

      // Send notifications based on appointment status
      const appointmentId = selectedAppointment.id;
      const appointmentDateFormatted = getFormattedDate(appointmentDate, true);
      if (
        selectedAppointment.uid &&
        selectedAppointment.controlNumber &&
        appointmentStatus
      ) {
        let clientMessage = "";
        let lawyerMessage = "";
        let headMessage = "";

        switch (appointmentStatus) {
          case "pending":
            clientMessage = `Your request (ID: ${appointmentId}) is pending review.`;
            lawyerMessage = `A new appointment (ID: ${appointmentId}) is pending.`;
            headMessage = `New appointment (ID: ${appointmentId}) is awaiting review.`;
            break;
          case "approved":
            clientMessage = `Your request (ID: ${appointmentId}) has been approved.`;
            lawyerMessage = `An appointment (ID: ${appointmentId}) has been approved and needs lawyer assignment.`;
            headMessage = `Appointment (ID: ${appointmentId}) has been approved.`;
            break;
          case "accepted":
            clientMessage = `A lawyer has accepted your appointment (ID: ${appointmentId}).`;
            lawyerMessage = `You accepted the appointment (ID: ${appointmentId}).`;
            headMessage = `Appointment (ID: ${appointmentId}) has been accepted by a lawyer.`;
            break;
          case "denied":
            clientMessage = `Your request (ID: ${appointmentId}) has been denied.`;
            lawyerMessage = `An appointment (ID: ${appointmentId}) has been marked as denied.`;
            headMessage = `Appointment (ID: ${appointmentId}) has been denied.`;
            break;
          case "scheduled":
            clientMessage = `Your appointment (ID: ${appointmentId}) has been scheduled.`;
            lawyerMessage = `You have a scheduled appointment (ID: ${appointmentId}).`;
            headMessage = `Appointment (ID: ${appointmentId}) has been scheduled.`;
            break;
          case "rescheduled":
          case "pending_reschedule":
            clientMessage = `Your appointment (ID: ${appointmentId}) has been rescheduled.`;
            lawyerMessage = `Appointment (ID: ${appointmentId}) has been rescheduled.`;
            headMessage = `Appointment (ID: ${appointmentId}) has been rescheduled.`;
            break;
          case "missed":
            clientMessage = `You missed your appointment (ID: ${appointmentId}). Please reschedule.`;
            lawyerMessage = `The appointment (ID: ${appointmentId}) was marked as missed.`;
            headMessage = `Appointment (ID: ${appointmentId}) has been marked as missed.`;
            break;
          case "done":
            clientMessage = `Your appointment (ID: ${appointmentId}) has been marked as done.`;
            lawyerMessage = `You have successfully marked the appointment (ID: ${appointmentId}) as done.`;
            headMessage = `Appointment (ID: ${appointmentId}) has been marked as done.`;
            break;
          default:
            clientMessage = `There is an update to your appointment (ID: ${appointmentId}).`;
            lawyerMessage = `An appointment (ID: ${appointmentId}) was updated.`;
            headMessage = `Appointment (ID: ${appointmentId}) has been updated.`;
        }

        // Send to client
        await sendNotification(
          clientMessage,
          selectedAppointment.uid,
          "appointment",
          selectedAppointment.controlNumber
        );

        // Send to lawyer (if assigned)
        const lawyerUid = selectedAppointment.appointmentDetails?.assignedLawyer;
        if (lawyerUid) {
          await sendNotification(
            lawyerMessage,
            lawyerUid,
            "appointment",
            selectedAppointment.controlNumber
          );
        }

        // Send to head lawyer
        const headLawyerUid = await getHeadLawyerUid();
        if (headLawyerUid) {
          await sendNotification(
            headMessage,
            headLawyerUid,
            "appointment",
            selectedAppointment.controlNumber
          );
        }
      }


      // Optionally close the form/modal after successful submission
      setShowProceedingNotesForm(false);
    } catch (error) {
      console.error("Error submitting proceeding notes:", error);
      setSnackbarMessage("Error submitting remarks, please try again.");
    } finally {
      setShowSnackbar(true);
      setTimeout(() => setShowSnackbar(false), 3000);
      setIsSubmitting(false);
    }
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();

    if (!rescheduleDate || !rescheduleAppointmentType) {
      setSnackbarMessage("Reschedule date and type are required.");
      setShowSnackbar(true);
      return;
    }

    let meetingLink = selectedAppointment.meetingLink || null;

    if (
      !["Online", "In-person", "Face-to-Face"].includes(
        rescheduleAppointmentType
      )
    ) {
      setSnackbarMessage("Invalid appointment type selected.");
      setShowSnackbar(true);
      return;
    }

    if (rescheduleAppointmentType === "Online") {
      const { link, password } = generateJitsiLink(
        selectedAppointment.controlNumber
      );
      meetingLink = link;
    } else {
      meetingLink = null;
    }

    const appointmentRef = doc(fs, "appointments", selectedAppointment.id);
    const appointmentSnapshot = await getDoc(appointmentRef);
    const appointmentData = appointmentSnapshot.data();

    const rescheduleEntry = {
      rescheduleDate: selectedAppointment.appointmentDetails.appointmentDate,
      rescheduleAppointmentType:
        selectedAppointment.appointmentDetails.apptType,
      rescheduleReason: rescheduleReason,
      rescheduleTimestamp: Timestamp.fromDate(new Date()),
    };

    const updatedRescheduleHistory = appointmentData.rescheduleHistory
      ? [...appointmentData.rescheduleHistory, rescheduleEntry]
      : [rescheduleEntry];

    if (!rescheduleHour || !rescheduleMinute) {
      setSnackbarMessage("Please select hour and minute.");
      setShowSnackbar(true);
      return;
    }

    const fullDate = new Date(rescheduleDate);
    let h = parseInt(rescheduleHour);
    if (rescheduleAmPm === "PM" && h < 12) h += 12;
    if (rescheduleAmPm === "AM" && h === 12) h = 0;
    fullDate.setHours(h, parseInt(rescheduleMinute), 0, 0);

    const isSlotTakenForLawyer = async (
      date,
      lawyerUid,
      currentAppointmentId
    ) => {
      const start = Timestamp.fromDate(
        new Date(date.getTime() - 30 * 60 * 1000)
      );
      const end = Timestamp.fromDate(new Date(date.getTime() + 30 * 60 * 1000));

      const q = query(
        collection(fs, "appointments"),
        where("appointmentDetails.assignedLawyer", "==", lawyerUid),
        where("appointmentDetails.appointmentDate", ">=", start),
        where("appointmentDetails.appointmentDate", "<=", end)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.some((doc) => doc.id !== currentAppointmentId);
    };

    const slotTaken = await isSlotTakenForLawyer(
      fullDate,
      selectedAppointment.appointmentDetails.assignedLawyer,
      selectedAppointment.id
    );

    if (slotTaken) {
      setSnackbarMessage(
        "The selected schedule is already taken. Please choose a different time."
      );
      setShowSnackbar(true);
      return;
    }

    try {
      const updatedData = {
        "appointmentDetails.appointmentDate": Timestamp.fromDate(fullDate),
        "appointmentDetails.scheduleType": rescheduleAppointmentType,
        "appointmentDetails.meetingLink": meetingLink,
        "appointmentDetails.updatedTime": Timestamp.fromDate(new Date()),
        "appointmentDetails.rescheduleReason": rescheduleReason,
        rescheduleHistory: updatedRescheduleHistory,
      };

      await updateDoc(appointmentRef, updatedData);

      const appointmentId = selectedAppointment.id;
      const appointmentDateFormatted = getFormattedDate(fullDate, true);

      try {
        if (selectedAppointment.uid && selectedAppointment.controlNumber) {
          await sendNotification(
            `Your appointment (ID: ${appointmentId}) has been rescheduled.`,
            selectedAppointment.uid,
            "appointment",
            selectedAppointment.controlNumber
          );
        }

        if (assignedLawyerDetails?.uid) {
          await sendNotification(
            `The appointment (ID: ${appointmentId}) has been rescheduled.`,
            assignedLawyerDetails.uid,
            "appointment",
            selectedAppointment.controlNumber
          );
        }

        const headLawyerUid = await getHeadLawyerUid();
        if (headLawyerUid) {
          await sendNotification(
            `The appointment (ID: ${appointmentId}) has been rescheduled.`,
            headLawyerUid,
            "appointment",
            selectedAppointment.controlNumber
          );
        }
      } catch (notifError) {
        console.error("Notification error:", notifError);
      }

      setSnackbarMessage("Appointment successfully rescheduled.");
      setShowSnackbar(true);

      setAppointments((prevAppointments) =>
        prevAppointments.map((appt) =>
          appt.id === selectedAppointment.id
            ? { ...appt, ...updatedData }
            : appt
        )
      );

      setRescheduleDate(null);
      setRescheduleReason("");
      setRescheduleAppointmentType("");

      setTimeout(() => {
        setShowSnackbar(false);
        setSelectedAppointment(null);
        clearFormFields();
        setShowRescheduleForm(false);
      }, 3000);
    } catch (error) {
      console.error("Error rescheduling appointment:", error);
      setSnackbarMessage("An error occurred during rescheduling.");
      setShowSnackbar(true);
    }
  };

  const clearFormFields = () => {
    setAppointmentDate(null);
    setAppointmentHour("");
    setAppointmentMinute("");
    setAppointmentAmPm("PM");

    setRescheduleDate(null);
    setRescheduleHour("");
    setRescheduleMinute("");
    setRescheduleAmPm("PM");
    setRescheduleReason("");
    setRescheduleAppointmentType("");

    setAppointmentType("");
  };

  const getFormattedDate = (timestamp, includeTime = false) => {
    try {
      if (!timestamp || typeof timestamp.toDate !== "function") {
        console.error("Invalid timestamp: ", timestamp);
        return "N/A";
      }

      const date = timestamp.toDate();
      const options = {
        year: "numeric",
        month: "long",
        day: "numeric",
      };

      if (includeTime) {
        options.hour = "numeric";
        options.minute = "numeric";
        options.hour12 = true;
      }

      return date.toLocaleString("en-US", options);
    } catch (error) {
      console.error("Error formatting timestamp:", error, timestamp);
      return "N/A";
    }
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
        appointment.appointmentDetails?.assignedLawyer === currentUser.uid &&
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
      const assignedLawyer = appointment.appointmentDetails?.assignedLawyer;

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
          <option value="approved">Approved</option>
          <option value="refused">Refused</option>
          <option value="accepted">Accepted</option>
          <option value="scheduled">Scheduled</option>
          <option value="missed">Missed</option>
          <option value="pending_reschedule">Reschedule Request</option>
          <option value="done">Done</option>
        </select>
        &nbsp;&nbsp;
        <select
          onChange={(e) => setNatureOfLegalAssistanceFilter(e.target.value)}
          value={natureOfLegalAssistanceFilter}
        >
          <option value="all">Nature of Legal Assistance</option>
          <option value="Payong Legal (Legal Advice)">
            Payong Legal (Legal Advice)
          </option>
          <option value="Legal na Representasyon (Legal Representation)">
            Legal na Representasyon (Legal Representation)
          </option>
          <option value="Pag gawa ng Legal na Dokumento (Drafting of Legal Document)">
            Pag gawa ng Legal na Dokumento (Drafting of Legal Document)
          </option>
        </select>
        &nbsp;&nbsp;
        <button onClick={resetFilters}>Reset Filters</button>
        <br />
        <p>
          Total Filtered Items:{" "}
          {
            appointments.filter(
              (appointment) =>
                appointment.appointmentStatus !== "pending"
            ).length
          }
        </p>

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
              {userData?.member_type !== "secretary" && <th>Link</th>}
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {appointments.length > 0 ? (
              appointments
                .filter(
                  (appointment) =>
                    appointment.appointmentStatus !== "pending"
                )
                .sort((a, b) => {
                  const order = {
                    pending_reschedule: 0,
                    accepted: 1,
                    approved: 2,
                    scheduled: 3,
                    rescheduled: 4,
                    missed: 5,
                    refused: 6,
                    done: 7,
                  };
                  return order[a.appointmentStatus] - order[b.appointmentStatus];
                })
                .map((appointment, index) => (

                  <tr key={appointment.id}>
                    <td>{(currentPage - 1) * pageSize + index + 1}.</td>
                    <td>{appointment.controlNumber || "N/A"}</td>
                    <td>{`${appointment.display_name} ${appointment.middle_name} ${appointment.last_name}`}</td>
                    <td>{appointment.selectedAssistanceType || "N/A"}</td>
                    <td>{getFormattedDate(appointment.appointmentDate, true)}</td>
                    <td>
                      {capitalizeFirstLetter(appointment.appointmentDetails?.scheduleType || "N/A")}
                    </td>
                    <td>
                      {appointment.appointmentDetails?.appointmentStatus === "pending_reschedule"
                        ? "Reschedule Request"
                        : capitalizeFirstLetter(appointment.appointmentDetails?.appointmentStatus)}
                    </td>
                    {userData?.member_type !== "secretary" && (
                      <td>
                        {appointment.appointmentDetails?.scheduleType === "Online" ? (
                          <button
                            onClick={() => {
                              if (
                                isToday(appointment.appointmentDate) &&
                                appointment.appointmentDetails?.appointmentStatus !== "done"
                              ) {
                                window.open(
                                  `/vpaas-magic-cookie-ef5ce88c523d41a599c8b1dc5b3ab765/${appointment.id}`,
                                  "_blank"
                                );
                              }
                            }}
                            disabled={
                              !isToday(appointment.appointmentDate) ||
                              appointment.appointmentDetails?.appointmentStatus === "done"
                            }
                            style={{
                              backgroundColor:
                                isToday(appointment.appointmentDate) &&
                                  appointment.appointmentDetails?.appointmentStatus !== "done"
                                  ? "#28a745"
                                  : "gray",
                              color: "white",
                              border: "none",
                              padding: "5px 8px",
                              cursor:
                                isToday(appointment.appointmentDate) &&
                                  appointment.appointmentDetails?.appointmentStatus !== "done"
                                  ? "pointer"
                                  : "not-allowed",
                            }}
                          >
                            <FontAwesomeIcon icon={faVideo} style={{ marginRight: "8px" }} />
                            Join
                          </button>
                        ) : (
                          "N/A"
                        )}

                      </td>
                    )}
                    <td>
                      <OverlayTrigger
                        placement="top"
                        overlay={renderTooltip({ title: "View" })}
                      >
                        <button
                          onClick={() => {
                            setSelectedAppointment(appointment);
                            setSelectedLawyerUid(
                              appointment.appointmentDetails?.assignedLawyer || ""
                            );

                            setShowScheduleForm(false);
                            setShowRescheduleForm(false);
                            setShowProceedingNotesForm(false);
                            setActiveView("view");
                          }}
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
                      &nbsp; &nbsp;
                      {["approved", "pending_reschedule"].includes(appointment.appointmentStatus) && (
                        <>
                          {/* Accept/Refuse Button */}
                          <OverlayTrigger
                            placement="top"
                            overlay={renderTooltip({ title: "Accept/Refuse" })}
                          >
                            <button
                              onClick={() => {
                                setSelectedAppointment(appointment);
                                setSelectedLawyerUid(
                                  appointment.appointmentDetails?.assignedLawyer || ""
                                );
                                setShowAcceptRefuseModal(true);
                                setActionType("accept");
                              }}
                              style={{
                                backgroundColor: "#1f5954",
                                color: "white",
                                border: "none",
                                padding: "5px 9px",
                                cursor: "pointer",
                              }}
                            >
                              <FontAwesomeIcon icon={faFileEdit} />
                            </button>
                          </OverlayTrigger>

                          &nbsp;&nbsp;

                          {/* Done Button (Disabled by default like others) */}
                          <OverlayTrigger
                            placement="top"
                            overlay={renderTooltip({ title: "Done" })}
                          >
                            <button
                              disabled
                              style={{
                                backgroundColor: "gray",
                                color: "white",
                                border: "none",
                                padding: "5px 10px",
                                cursor: "not-allowed",
                              }}
                            >
                              <FontAwesomeIcon icon={faCheck} />
                            </button>
                          </OverlayTrigger>
                        </>
                      )}

                      {appointment.appointmentStatus === "refused" && (
                        <>
                          {/* Accept/Refuse button */}
                          <OverlayTrigger
                            placement="top"
                            overlay={renderTooltip({ title: "Accept/Refuse" })}
                          >
                            <button
                              disabled
                              onClick={() => {
                                setSelectedAppointment(appointment);
                                setSelectedLawyerUid(
                                  appointment.appointmentDetails
                                    ?.assignedLawyer || ""
                                );

                                setShowAcceptRefuseModal(true);
                                setActionType("accept");
                              }}
                              style={{
                                backgroundColor: "gray",
                                color: "white",
                                border: "none",
                                padding: "5px 10px",
                                cursor: "not-allowed",
                              }}
                            >
                              <FontAwesomeIcon icon={faFileEdit} />
                            </button>
                          </OverlayTrigger>
                          &nbsp; &nbsp;
                          {/* Done (Disabled) */}
                          <OverlayTrigger
                            placement="top"
                            overlay={renderTooltip({ title: "Done" })}
                          >
                            <button
                              disabled
                              style={{
                                backgroundColor: "gray",
                                color: "white",
                                border: "none",
                                padding: "5px 10px",
                                cursor: "not-allowed",
                              }}
                            >
                              <FontAwesomeIcon icon={faCheck} />
                            </button>
                          </OverlayTrigger>
                        </>
                      )}
                      {appointment.appointmentStatus === "accepted" && (
                        <>
                          <OverlayTrigger
                            placement="top"
                            overlay={renderTooltip({ title: "Schedule" })}
                          >
                            <button
                              onClick={() => {
                                setSelectedAppointment(appointment);
                                setSelectedLawyerUid(
                                  appointment.appointmentDetails
                                    ?.assignedLawyer || ""
                                );

                                setShowProceedingNotesForm(false);
                                setShowRescheduleForm(false);
                                setShowScheduleForm(true);
                              }}
                              style={{
                                backgroundColor: "#28a745",
                                color: "white",
                                border: "none",
                                padding: "5px 10px",
                                cursor: "pointer",
                              }}
                            >
                              <FontAwesomeIcon icon={faCalendarAlt} />
                            </button>
                          </OverlayTrigger>
                          &nbsp; &nbsp;
                          <OverlayTrigger
                            placement="top"
                            overlay={renderTooltip({ title: "Done" })}
                          >
                            <button
                              disabled
                              style={{
                                backgroundColor: "gray",
                                color: "white",
                                border: "none",
                                padding: "5px 10px",
                                cursor: "not-allowed",
                              }}
                            >
                              <FontAwesomeIcon icon={faCheck} />
                            </button>
                          </OverlayTrigger>
                        </>
                      )}
                      {appointment.appointmentStatus === "scheduled" && (
                        <>
                          <OverlayTrigger
                            placement="top"
                            overlay={renderTooltip({ title: "Reschedule" })}
                          >
                            <button
                              onClick={() => {
                                setSelectedAppointment(appointment);
                                setSelectedLawyerUid(
                                  appointment.appointmentDetails?.assignedLawyer || ""
                                );
                                setShowProceedingNotesForm(false);
                                setShowRescheduleForm(true);
                                setShowScheduleForm(false);
                              }}
                              style={{
                                backgroundColor: "#ff8b61",
                                color: "white",
                                border: "none",
                                padding: "5px 10px",
                                cursor: "pointer",
                              }}
                            >
                              <FontAwesomeIcon icon={faCalendarAlt} />
                            </button>
                          </OverlayTrigger>
                          &nbsp; &nbsp;
                          <OverlayTrigger
                            placement="top"
                            overlay={renderTooltip({ title: "Done" })}
                          >
                            <button
                              onClick={() => {
                                const now = new Date();
                                const scheduledDate = appointment.appointmentDate?.toDate?.() || new Date(appointment.appointmentDate);
                                const canProceed =
                                  scheduledDate <= now &&
                                  appointment.clientAttend !== "yes" &&
                                  appointment.clientAttend !== "no";

                                if (!canProceed) return;

                                setSelectedAppointment(appointment);
                                setSelectedLawyerUid(
                                  appointment.appointmentDetails?.assignedLawyer || ""
                                );
                                setShowProceedingNotesForm(true);
                                setShowRescheduleForm(false);
                                setShowScheduleForm(false);
                              }}
                              disabled={
                                (() => {
                                  const now = new Date();
                                  const scheduledDate = appointment.appointmentDate?.toDate?.() || new Date(appointment.appointmentDate);
                                  return (
                                    !scheduledDate ||
                                    scheduledDate > now ||
                                    appointment.clientAttend === "yes" ||
                                    appointment.clientAttend === "no"
                                  );
                                })()
                              }
                              style={{
                                backgroundColor: (() => {
                                  const now = new Date();
                                  const scheduledDate = appointment.appointmentDate?.toDate?.() || new Date(appointment.appointmentDate);
                                  const canProceed =
                                    scheduledDate <= now &&
                                    appointment.clientAttend !== "yes" &&
                                    appointment.clientAttend !== "no";
                                  return canProceed ? "#1fs954" : "gray";
                                })(),
                                color: "white",
                                border: "none",
                                padding: "5px 10px",
                                cursor: (() => {
                                  const now = new Date();
                                  const scheduledDate = appointment.appointmentDate?.toDate?.() || new Date(appointment.appointmentDate);
                                  const canProceed =
                                    scheduledDate <= now &&
                                    appointment.clientAttend !== "yes" &&
                                    appointment.clientAttend !== "no";
                                  return canProceed ? "pointer" : "not-allowed";
                                })(),
                              }}
                            >
                              <FontAwesomeIcon icon={faCheck} />
                            </button>
                          </OverlayTrigger>
                        </>
                      )}
                      {["pending", "done", "denied", "missed"].includes(appointment.appointmentStatus) && (
                        <>
                          <OverlayTrigger
                            placement="top"
                            overlay={renderTooltip({ title: "Schedule" })}
                          >
                            <button
                              disabled
                              style={{
                                backgroundColor: "gray",
                                color: "white",
                                border: "none",
                                padding: "5px 10px",
                                cursor: "not-allowed",
                              }}
                            >
                              <FontAwesomeIcon icon={faCalendarAlt} />
                            </button>
                          </OverlayTrigger>
                          &nbsp; &nbsp;
                          <OverlayTrigger
                            placement="top"
                            overlay={renderTooltip({ title: "Done" })}
                          >
                            <button
                              disabled
                              style={{
                                backgroundColor: "gray",
                                color: "white",
                                border: "none",
                                padding: "5px 10px",
                                cursor: "not-allowed",
                              }}
                            >
                              <FontAwesomeIcon icon={faCheck} />
                            </button>
                          </OverlayTrigger>
                        </>
                      )}

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
          !showScheduleForm && (
            <div className="client-eligibility">
              <button
                onClick={handleCloseModal}
                style={{
                  float: "right",
                  backgroundColor: "transparent",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "red",
                }}
                aria-label="Close"
              >
                &times;
              </button>
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
                        <td>{`${selectedAppointment.display_name} ${selectedAppointment.middle_name} ${selectedAppointment.last_name}`}</td>
                      </tr>
                      <tr>
                        <th>Date of Birth:</th>
                        <td>{formatDateSafely(selectedAppointment.dob || "")}</td>

                      </tr>
                      <tr>
                        <th>Contact Number:</th>
                        <td>
                          {selectedAppointment?.phone ||
                            "Not Available"}
                        </td>
                      </tr>
                      <>
                        <tr>
                          <th>Address:</th>
                          <td>
                            {selectedAppointment?.address || "Not Available"}
                          </td>
                        </tr>
                        <tr>
                          <th>Gender:</th>
                          <td>
                            {selectedAppointment?.gender || "Not Specified"}
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
                              !selectedAppointment.appointmentDetails
                                ?.requestReason && (
                                <tr>
                                  <th>New Request Control Number:</th>
                                  <td>
                                    {selectedAppointment.appointmentDetails
                                      ?.newControlNumber || "N/A"}
                                  </td>
                                </tr>
                              )}
                            <tr>
                              <th>Reason for New Request:</th>
                              <td>
                                {selectedAppointment.appointmentDetails
                                  ?.requestReason || "N/A"}
                              </td>
                            </tr>
                            {/* Only show Attached File if it exists */}
                            {selectedAppointment.appointmentDetails
                              ?.newRequestUrl && (
                                <tr>
                                  <th>Attached File:</th>
                                  <td>
                                    <a
                                      href={
                                        selectedAppointment.appointmentDetails
                                          ?.newRequestUrl
                                      }
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
                          {selectedAppointment.appointmentDetails ? (
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                openImageModal(
                                  selectedAppointment.appointmentDetails.qrCode
                                );
                              }}
                            >
                              <img
                                src={
                                  selectedAppointment.appointmentDetails.qrCode
                                }
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
                            {selectedAppointment.appointmentDetails
                              ?.apptType === "Online" ? (
                              selectedAppointment.appointmentDetails
                                ?.appointmentStatus === "done" ? (
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
                        <th>Schedule Type:</th>
                        <td>{selectedAppointment.scheduleType || "N/A"}</td>
                      </tr>
                      <tr>
                        <th>Appointment Status:</th>
                        <td>
                          {capitalizeFirstLetter(
                            selectedAppointment.appointmentDetails
                              ?.appointmentStatus
                          )}
                        </td>
                      </tr>
                      <>
                        {selectedAppointment.appointmentDetails
                          ?.appointmentStatus === "scheduled" && (
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
                                    selectedAppointment.appointmentDetails
                                      ?.appointmentDate,
                                    true
                                  )}
                                </td>
                              </tr>
                            </>
                          )}

                        {selectedAppointment.appointmentDetails
                          ?.appointmentStatus === "denied" && (
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
                        {selectedAppointment.appointmentDetails
                          ?.appointmentStatus === "done" && (
                            <>
                              <tr>
                                <th>Appointment Date:</th>
                                <td>
                                  {getFormattedDate(
                                    selectedAppointment.appointmentDetails
                                      ?.appointmentDate,
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
                                  {selectedAppointment.appointmentDetails
                                    ?.proceedingNotes || "N/A"}
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
                        {selectedAppointment.appointmentDetails
                          ?.appointmentStatus === "approved" && (
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
                            <th style={{ padding: "10px" }}>Reschedule Time</th>
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
                          {selectedAppointment?.employmentType ||
                            "Not Specified"}
                        </td>
                      </tr>
                      <tr>
                        <th>Employer Name:</th>
                        <td>
                          {selectedAppointment?.employerName || "Not Available"}
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
                          {selectedAppointment.barangayImageUrl &&
                            selectedAppointment.barangayImageUrlDateUploaded &&
                            new Date(
                              selectedAppointment.barangayImageUrlDateUploaded.toDate?.()
                            ) > new Date(Date.now() - 15552000000) ? (
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                openImageModal(
                                  selectedAppointment.barangayImageUrl
                                );
                              }}
                            >
                              <img
                                src={selectedAppointment.barangayImageUrl}
                                alt="Barangay Certificate"
                                className="img-thumbnail qr-code-image"
                                style={{ width: "100px", cursor: "pointer" }}
                              />
                            </a>
                          ) : (
                            <span style={{ color: "red", fontWeight: "bold" }}>
                              ✗ Expired or Missing (
                              {selectedAppointment.barangayImageUrlDateUploaded
                                ? `Uploaded: ${new Date(
                                  selectedAppointment.barangayImageUrlDateUploaded.toDate?.()
                                ).toLocaleDateString()}`
                                : "N/A"}
                              )
                            </span>
                          )}
                        </td>
                      </tr>

                      <tr>
                        <th>DSWD Certificate of Indigency:</th>
                        <td>
                          {selectedAppointment.dswdImageUrl &&
                            selectedAppointment.dswdImageUrlDateUploaded &&
                            new Date(
                              selectedAppointment.dswdImageUrlDateUploaded.toDate?.()
                            ) > new Date(Date.now() - 15552000000) ? (
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                openImageModal(
                                  selectedAppointment.dswdImageUrl
                                );
                              }}
                            >
                              <img
                                src={selectedAppointment.dswdImageUrl}
                                alt="DSWD Certificate"
                                className="img-thumbnail qr-code-image"
                                style={{ width: "100px", cursor: "pointer" }}
                              />
                            </a>
                          ) : (
                            <span style={{ color: "red", fontWeight: "bold" }}>
                              ✗ Expired or Missing (
                              {selectedAppointment.dswdImageUrlDateUploaded
                                ? `Uploaded: ${new Date(
                                  selectedAppointment.dswdImageUrlDateUploaded.toDate?.()
                                ).toLocaleDateString()}`
                                : "N/A"}
                              )
                            </span>
                          )}
                        </td>
                      </tr>

                      <tr>
                        <th>Disqualification Letter from PAO:</th>
                        <td>
                          {selectedAppointment.paoImageUrl &&
                            selectedAppointment.paoImageUrlDateUploaded &&
                            new Date(
                              selectedAppointment.paoImageUrlDateUploaded.toDate?.()
                            ) > new Date(Date.now() - 15552000000) ? (
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                openImageModal(selectedAppointment.paoImageUrl);
                              }}
                            >
                              <img
                                src={selectedAppointment.paoImageUrl}
                                alt="PAO Letter"
                                className="img-thumbnail qr-code-image"
                                style={{ width: "100px", cursor: "pointer" }}
                              />
                            </a>
                          ) : (
                            <span style={{ color: "red", fontWeight: "bold" }}>
                              ✗ Expired or Missing (
                              {selectedAppointment.paoImageUrlDateUploaded
                                ? `Uploaded: ${new Date(
                                  selectedAppointment.paoImageUrlDateUploaded.toDate?.()
                                ).toLocaleDateString()}`
                                : "N/A"}
                              )
                            </span>
                          )}
                        </td>
                      </tr>

                      <tr>
                        <th>Consultation Remarks Attached File:</th>
                        <td>
                          {selectedAppointment.proceedingFileUrl ? (
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                openImageModal(
                                  selectedAppointment.proceedingFileUrl
                                );
                              }}
                            >
                              <img
                                src={selectedAppointment.proceedingFileUrl}
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
                        <th>New Appointment Request File:</th>
                        <td>
                          {selectedAppointment.newRequestUrl ? (
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                openImageModal(
                                  selectedAppointment.newRequestUrl
                                );
                              }}
                            >
                              <img
                                src={selectedAppointment.newRequestUrl}
                                alt="New Appointment Request File"
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
        <br />
        {selectedAppointment &&
          selectedAppointment.appointmentStatus === "pending" && (
            <div className="client-eligibility">
              <h2>Client's Eligibility</h2>
              <form onSubmit={handleSubmit}>
                <b>
                  <p>Is the client eligible?</p>
                </b>
                <label>
                  <input
                    type="radio"
                    name="eligibility"
                    value="yes"
                    onChange={handleEligibilityChange}
                    required
                  />{" "}
                  Yes, the client is Eligible
                </label>
                <br />
                <label>
                  <input
                    type="radio"
                    name="eligibility"
                    value="no"
                    onChange={handleEligibilityChange}
                    required
                  />{" "}
                  No, the client is DISQUALIFIED/DENIED
                </label>
                <br />
                <br />
                {clientEligibility.eligibility === "yes" && (
                  <div>
                    <b>
                      <label>Assign a Lawyer: *</label>
                    </b>
                    <select
                      name="assistingCounsel"
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select a Lawyer</option>
                      {lawyers.map((lawyer) => (
                        <option key={lawyer.uid} value={lawyer.uid}>
                          {`${lawyer.display_name} ${lawyer.middle_name} ${lawyer.last_name}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {clientEligibility.eligibility === "no" && (
                  <div>
                    <b>
                      <p>If Disqualified/Denied:</p>
                    </b>
                    <em>
                      <p>
                        Please select the reason for the possible
                        Denial/Disqualification of the Client
                      </p>
                    </em>
                    <label>
                      <input
                        type="radio"
                        name="denialReason"
                        value="meansTest"
                        onChange={handleDenialReasonChange}
                        required
                      />{" "}
                      Persons who do not pass the means and merit test (sec. 5
                      of the Revised Manual of Operations of the NCLA)
                    </label>
                    <br />
                    <br />
                    <label>
                      <input
                        type="radio"
                        name="denialReason"
                        value="alreadyRepresented"
                        onChange={handleDenialReasonChange}
                        required
                      />{" "}
                      Parties already represented by a counsel de parte (sec. 5
                      of the Revised Manual of Operations of the NCLA)
                    </label>
                  </div>
                )}
                <br />
                <div>
                  <b>
                    <label>Notes:</label>
                  </b>
                  <textarea
                    name="notes"
                    rows="4"
                    placeholder="Enter any relevant notes here..."
                    value={clientEligibility.notes}
                    onChange={handleChange}
                    required
                  ></textarea>
                </div>
                <button disabled={isSubmitting}>
                  {isSubmitting ? (
                    <div
                      className="spinner-border text-light"
                      role="status"
                      style={{ width: "1rem", height: "1rem" }}
                    >
                      <span className="sr-only">Loading...</span>
                    </div>
                  ) : (
                    "Submit"
                  )}
                </button>
              </form>
            </div>
          )}
        {selectedAppointment && showProceedingNotesForm && (
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
            <h2>Remarks</h2>
            <table className="table table-striped table-bordered">
              <tbody>
                <tr>
                  <th>Control Number:</th>
                  <td>{selectedAppointment.controlNumber}</td>
                </tr>
                <tr>
                  <th>Full Name:</th>
                  <td>{`${selectedAppointment.display_name} ${selectedAppointment.middle_name} ${selectedAppointment.last_name}`}</td>
                </tr>
              </tbody>
            </table>
            <form onSubmit={handleSubmitProceedingNotes}>
              <div>
                <b>
                  <label>Did the client attend the appointment? *</label>
                </b>
                <label>
                  <input
                    type="radio"
                    name="clientAttend"
                    value="yes"
                    onChange={(e) => setClientAttend(e.target.value)}
                    required
                  />{" "}
                  Yes
                </label>
                <br />
                <label>
                  <input
                    type="radio"
                    name="clientAttend"
                    value="no"
                    onChange={(e) => setClientAttend(e.target.value)}
                    required
                  />{" "}
                  No
                </label>
              </div>
              <br />

              {/* Only show these fields if the client attended (if 'Yes' is selected) */}
              {clientAttend === "yes" && (
                <>
                  <div>
                    <b>
                      <label>Record of Consultation *</label>
                    </b>
                    <textarea
                      name="proceedingNotes"
                      rows="4"
                      placeholder="Enter proceeding notes here..."
                      value={proceedingNotes}
                      onChange={handleNotesChange}
                      required
                    ></textarea>
                  </div>
                  <br />
                  <div>
                    <b>
                      <label>Attach File (optional):</label>
                    </b>
                    <input
                      type="file"
                      name="proceedingFile"
                      accept="application/pdf, image/*" // Limit the file types
                      onChange={(e) => setProceedingFile(e.target.files[0])} // Capture file
                    />
                  </div>
                  <br />
                  <div>
                    <b>
                      <label>IBP Paralegal/Staff:</label>
                    </b>
                    <input
                      type="text"
                      name="ibpParalegalStaff"
                      placeholder="Enter name here..."
                      value={clientEligibility.ibpParalegalStaff}
                      onChange={handleChange}
                    />
                    <b>
                      <label>Assisting Counsel:</label>
                    </b>
                    <input
                      type="text"
                      name="assistingCounsel"
                      placeholder="Enter name here..."
                      value={clientEligibility.assistingCounsel}
                      onChange={handleChange}
                    />
                  </div>
                </>
              )}

              <button disabled={isSubmitting}>
                {isSubmitting ? (
                  <div
                    className="spinner-border text-light"
                    role="status"
                    style={{ width: "1rem", height: "1rem" }}
                  >
                    <span className="sr-only">Loading...</span>
                  </div>
                ) : (
                  "Submit"
                )}
              </button>
            </form>
          </div>
        )}
        {selectedAppointment && showRescheduleForm && (
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
            <h2>Reschedule Appointment</h2>
            <table className="table table-striped table-bordered">
              <tbody>
                <tr>
                  <th>Control Number:</th>
                  <td>{selectedAppointment.controlNumber}</td>
                </tr>
                <tr>
                  <th>Full Name:</th>
                  <td>{`${selectedAppointment.display_name} ${selectedAppointment.middle_name} ${selectedAppointment.last_name}`}</td>
                </tr>
              </tbody>
            </table>
            <br />
            <p>
              <strong>Current Appointment Date:</strong> <br></br>
              {getFormattedDate(
                selectedAppointment.appointmentDetails.appointmentDate,
                true
              )}
            </p>
            <form onSubmit={handleRescheduleSubmit}>
              <div>
                <b>
                  <label>Reason for Reschedule: *</label>
                </b>
                <textarea
                  name="rescheduleReason"
                  rows="4"
                  placeholder="Enter reason for reschedule..."
                  value={rescheduleReason}
                  onChange={handleRescheduleChange}
                  required
                ></textarea>
              </div>
              <br />
              <div>
                <b>
                  <label>Reschedule Date and Time: *</label>
                </b>
                <ReactDatePicker
                  selected={rescheduleDate}
                  onChange={(date) => setRescheduleDate(date)}
                  filterDate={(date) => filterDate(date) && date > new Date()}
                  dateFormat="MM/dd/yyyy"
                  inline
                />
                <br />
                <div style={{ gap: "0.5rem" }}>
                  <b>
                    <label>Select Time (1:00 PM - 5:00 PM): *</label>
                  </b>
                  <select
                    required
                    value={rescheduleHour}
                    onChange={(e) => setRescheduleHour(e.target.value)}
                  >
                    <option value="">Hour</option>
                    {[1, 2, 3, 4, 5].map((h) => {
                      const isDisabled = isHourFullyBooked(
                        h + 12,
                        appointmentDate,
                        selectedLawyerUid
                      ); // 1pm = 13
                      return (
                        <option key={h} value={h} disabled={isDisabled}>
                          {h}
                        </option>
                      );
                    })}
                  </select>

                  <select
                    required
                    value={rescheduleMinute}
                    onChange={(e) => setRescheduleMinute(e.target.value)}
                  >
                    <option value="">Minute</option>
                    {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => {
                      const fullDate = new Date(rescheduleDate);
                      let h = parseInt(rescheduleHour);
                      if (rescheduleAmPm === "PM" && h < 12) h += 12;
                      if (rescheduleAmPm === "AM" && h === 12) h = 0;
                      fullDate.setHours(h, m, 0, 0);

                      const disabled = isSlotTakenForLawyer(
                        fullDate,
                        selectedLawyerUid,
                        appointments
                      );

                      return (
                        <option
                          key={m}
                          value={m}
                          disabled={disabled}
                          style={{
                            backgroundColor: disabled ? "red" : "inherit",
                          }}
                        >
                          {m.toString().padStart(2, "0")}
                        </option>
                      );
                    })}
                  </select>

                  <select
                    required
                    value={rescheduleAmPm}
                    onChange={(e) => setRescheduleAmPm(e.target.value)}
                    disabled
                  >
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
              <br />
              <div>
                <b>
                  <label>Type of Rescheduled Appointment *</label>
                </b>
                <select
                  name="rescheduleAppointmentType"
                  value={rescheduleAppointmentType}
                  onChange={(e) => setRescheduleAppointmentType(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select Type
                  </option>
                  <option value="In-person">In-person Consultation</option>
                  <option value="Online">Online Video Consultation</option>
                </select>
              </div>
              <br />
              <button disabled={isSubmitting}>
                {isSubmitting ? (
                  <div
                    className="spinner-border text-light"
                    role="status"
                    style={{ width: "1.2rem", height: "1.2rem" }}
                  >
                    <span className="sr-only">Loading...</span>
                  </div>
                ) : (
                  "Submit"
                )}
              </button>
            </form>
          </div>
        )}
        {selectedAppointment && showScheduleForm && (
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
            <h2>Schedule Appointment</h2>
            <table className="table table-striped table-bordered">
              <tbody>
                <tr>
                  <th>Control Number:</th>
                  <td>{selectedAppointment.controlNumber}</td>
                </tr>
                <tr>
                  <th>Full Name:</th>
                  <td>{`${selectedAppointment.display_name} ${selectedAppointment.middle_name} ${selectedAppointment.last_name}`}</td>
                </tr>
              </tbody>
            </table>
            <br />
            <form onSubmit={handleScheduleSubmit}>
              <div>
                <b>
                  <label>Appointment Date and Time: *</label>
                </b>
                <ReactDatePicker
                  selected={appointmentDate}
                  onChange={(date) => setAppointmentDate(date)}
                  filterDate={(date) => filterDate(date) && date > new Date()}
                  dateFormat="MM/dd/yyyy"
                  inline
                />
                <br />
                <div style={{ gap: "0.5rem" }}>
                  <b>
                    <label>Select Time (1:00 PM - 5:00 PM): *</label>
                  </b>
                  <select
                    required
                    value={appointmentHour}
                    onChange={(e) => setAppointmentHour(e.target.value)}
                  >
                    <option value="">Hour</option>
                    {[1, 2, 3, 4, 5].map((h) => {
                      const isDisabled = isHourFullyBooked(
                        h + 12,
                        rescheduleDate,
                        selectedLawyerUid
                      );
                      return (
                        <option key={h} value={h} disabled={isDisabled}>
                          {h}
                        </option>
                      );
                    })}
                  </select>

                  <select
                    required
                    value={appointmentMinute}
                    onChange={(e) => setAppointmentMinute(e.target.value)}
                  >
                    <option value="">Minute</option>
                    {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => {
                      const fullDate = new Date(appointmentDate);
                      let h = parseInt(appointmentHour);
                      if (appointmentAmPm === "PM" && h < 12) h += 12;
                      if (appointmentAmPm === "AM" && h === 12) h = 0;
                      fullDate.setHours(h, m, 0, 0);

                      const disabled = isSlotTakenForLawyer(
                        fullDate,
                        selectedLawyerUid,
                        appointments
                      );

                      return (
                        <option
                          key={m}
                          value={m}
                          disabled={disabled}
                          style={{
                            backgroundColor: disabled ? "red" : "inherit",
                          }}
                        >
                          {m.toString().padStart(2, "0")}
                        </option>
                      );
                    })}
                  </select>

                  <select
                    required
                    value={appointmentAmPm}
                    onChange={(e) => setAppointmentAmPm(e.target.value)}
                    disabled
                  >
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
              <br />
              <div>
                <b>
                  <label>Type of Appointment *</label>
                </b>
                <select
                  name="appointmentType"
                  value={appointmentType}
                  onChange={(e) => setAppointmentType(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select Type
                  </option>
                  <option value="In-person">In-person Consultation</option>
                  <option value="Online">Online Video Consultation</option>
                </select>
              </div>
              <br />
              <br />
              <button disabled={isSubmitting}>
                {isSubmitting ? (
                  <div
                    className="spinner-border text-light"
                    role="status"
                    style={{ width: "1.2rem", height: "1.2rem" }}
                  >
                    <span className="sr-only">Loading...</span>
                  </div>
                ) : (
                  "Submit"
                )}
              </button>
            </form>
          </div>
        )}
        <br />
        {showSnackbar && (
          <div className="snackbar">
            <p>{snackbarMessage}</p>
          </div>
        )}
      </div>
      {/* MODAL for Accept / Refuse */}
      {
        showAcceptRefuseModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              {actionType === "refuse" ? (
                <>
                  <h5>
                    Please specify the reason for refusing this appointment.
                  </h5>
                  <textarea
                    value={refuseReason}
                    onChange={(e) => setRefuseReason(e.target.value)}
                    placeholder="Please specify the reason..."
                    style={{ width: "100%", height: "100px", marginTop: "10px" }}
                    required
                  />
                  <div
                    style={{
                      marginTop: "15px",
                      display: "flex",
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      onClick={() => setActionType("accept")}
                      style={{
                        backgroundColor: "#6c757d",
                        color: "white",
                        border: "none",
                        padding: "5px 10px",
                        marginRight: "10px",
                      }}
                    >
                      Back
                    </button>
                    <button
                      onClick={handleRefuse}
                      style={{
                        backgroundColor: "#dc3545",
                        color: "white",
                        border: "none",
                        padding: "5px 10px",
                      }}
                      disabled={!refuseReason.trim()}
                    >
                      Submit Refusal
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: "15px" }}>
                    <h5 style={{ marginBottom: "10px" }}>
                      Are you sure you want to accept this appointment?
                    </h5>

                    {selectedAppointment?.appointmentDetails?.appointmentStatus === "pending_reschedule" && (
                      <div
                        style={{
                          backgroundColor: "#fff3cd",
                          padding: "10px 12px",
                          borderRadius: "5px",
                          border: "1px solid #ffeeba",
                          color: "#856404",
                        }}
                      >
                        <strong>Reason for Reschedule Request:</strong>
                        <p style={{ margin: "8px 0 0" }}>
                          {selectedAppointment.appointmentDetails?.rescheduleReason || "Not provided"}
                        </p>
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      onClick={handleAccept}
                      style={{
                        backgroundColor: "#28a745",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        padding: "6px 12px",
                        marginRight: "10px",
                        fontWeight: "500",
                      }}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => setActionType("refuse")}
                      style={{
                        backgroundColor: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        padding: "6px 12px",
                        marginRight: "10px",
                        fontWeight: "500",
                      }}
                    >
                      Refuse
                    </button>
                    <button
                      onClick={() => {
                        setShowAcceptRefuseModal(false);
                        setActionType("");
                        setRefuseReason("");
                      }}
                      style={{
                        backgroundColor: "#6c757d",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        padding: "6px 12px",
                        fontWeight: "500",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </>

              )}
            </div>
          </div>
        )
      }
    </div >
  );
}

export default ApptsLawyer;
