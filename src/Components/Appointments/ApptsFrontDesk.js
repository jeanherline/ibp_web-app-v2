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
  getAppointments,
} from "../../Config/FirebaseServices";
import { useAuth } from "../../AuthContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { fs, auth, signInWithGoogle } from "../../Config/Firebase";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore"; // Add these imports for Firestore

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
    let meetingPass = null;

    if (appointmentType === "Online") {
      const { link, password } = generateJitsiLink(
        selectedAppointment.controlNumber
      );
      meetingLink = link;
      meetingPass = password;
    }

    const updatedData = {
      "appointmentDetails.appointmentDate": Timestamp.fromDate(appointmentDate),
      "appointmentDetails.appointmentStatus": "scheduled",
      "appointmentDetails.apptType": appointmentType,
      ...(meetingLink && {
        "appointmentDetails.meetingLink": meetingLink,
        "appointmentDetails.meetingPass": meetingPass,
      }),
    };

    try {
      await updateAppointment(selectedAppointment.id, updatedData);

      const clientFullName = selectedAppointment.fullName;
      const appointmentId = selectedAppointment.id;
      const appointmentDateFormatted = getFormattedDate(appointmentDate, true);

      const lawyerFullName = assignedLawyerDetails
        ? `${assignedLawyerDetails.display_name} ${assignedLawyerDetails.middle_name} ${assignedLawyerDetails.last_name}`
        : "Assigned Lawyer Not Available";

      // Send notifications to the client, assigned lawyer, and head lawyer
      await sendNotification(
        `Your appointment (ID: ${appointmentId}) has been scheduled a date and as an ${appointmentType} appointment.`,
        selectedAppointment.uid,
        "appointment"
      );

      if (assignedLawyerDetails?.uid) {
        await sendNotification(
          `You have scheduled the appointment (ID: ${appointmentId}) for ${clientFullName} in the date provided as an ${appointmentType} appointment.`,
          assignedLawyerDetails.uid,
          "appointment"
        );
      }

      // Notify the head lawyer
      const headLawyerUid = await getHeadLawyerUid();
      if (headLawyerUid) {
        await sendNotification(
          `The appointment (ID: ${appointmentId}) for ${clientFullName} has been scheduled a date and as an ${appointmentType} appointment.`,
          headLawyerUid,
          "appointment"
        );
      }

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

    // Get the contents of the appointment details section
    const printContents = document.getElementById(
      "appointment-details-section"
    ).innerHTML;

    // Create a temporary div to modify the contents for printing
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = printContents;

    // Remove any elements you don't want to print (with class 'no-print')
    const noPrintSection = tempDiv.querySelectorAll(".no-print");
    noPrintSection.forEach((section) => section.remove());

    const modifiedPrintContents = tempDiv.innerHTML;

    // Open a new window for printing
    const printWindow = window.open("", "", "height=500, width=500");
    printWindow.document.write(
      "<html><head><title>Appointment Details</title></head><body>"
    );

    // Add custom styles for the print layout, including setting the paper size to legal (8.5x13 inches)
    printWindow.document.write("<style>");
    printWindow.document.write(`
          @media print {
            @page {
              size: 8.5in 13in;
              margin: 0.5in; /* Set margins for the print */
            }
            .page-break { page-break-before: always; }
            .print-section { page-break-inside: avoid; }
            .print-image { width: 100%; height: auto; object-fit: cover; }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            table, th, td {
              border: 1px solid black;
            }
            th, td {
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f2f2f2;
            }
            .section-title {
              color: #a34bc9;
              font-size: 16px;
            }
            .no-print {
              display: none;
            }
            .print-only {
              display: block;
            }
          }
        `);
    printWindow.document.write("</style>");

    // Add the IBP logo and QR code to the print layout
    printWindow.document.write(`
          <div style="text-align: center;">
            <img src="${ibpLogo}" alt="IBP Logo" style="width: 100px; display: block; margin: 0 auto;" />
            <h2>Integrated Bar of the Philippines - Malolos</h2>
            ${
              selectedAppointment.appointmentDetails.qrCode
                ? `<img src="${selectedAppointment.appointmentDetails.qrCode}" alt="QR Code" style="width: 100px; display: block; margin: 0 auto;" />`
                : ""
            }
          </div>
          <hr />
        `);

    // Insert the modified contents
    printWindow.document.write(modifiedPrintContents);

    // Add the reschedule history section
    if (
      selectedAppointment.rescheduleHistory &&
      selectedAppointment.rescheduleHistory.length > 0
    ) {
      printWindow.document.write(`
        <h2 style="color: #a34bc9; font-size: 16px;">Reschedule History</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="border: 1px solid black; padding: 8px;">Original Date</th>
              <th style="border: 1px solid black; padding: 8px;">Original Type</th>
              <th style="border: 1px solid black; padding: 8px;">Reason</th>
              <th style="border: 1px solid black; padding: 8px;">Reschedule Time</th>
            </tr>
          </thead>
          <tbody>
      `);

      selectedAppointment.rescheduleHistory.forEach((entry) => {
        printWindow.document.write(`
          <tr>
            <td style="border: 1px solid black; padding: 8px;">${getFormattedDate(
              entry.rescheduleDate,
              true
            )}</td>
            <td style="border: 1px solid black; padding: 8px;">${
              entry.rescheduleAppointmentType || "N/A"
            }</td>
            <td style="border: 1px solid black; padding: 8px;">${
              entry.rescheduleReason || "N/A"
            }</td>
            <td style="border: 1px solid black; padding: 8px;">${getFormattedDate(
              entry.rescheduleTimestamp,
              true
            )}</td>
          </tr>
        `);
      });

      printWindow.document.write(`
          </tbody>
        </table>
        <br />
      `);
    }

    // Include any relevant images for printing
    const images = document.querySelectorAll(".img-thumbnail");
    images.forEach((image) => {
      if (!image.classList.contains("qr-code-image")) {
        printWindow.document.write("<div class='page-break'></div>");
        printWindow.document.write(
          `<img src='${image.src}' class='print-image' />`
        );
      }
    });

    // Close and trigger the print dialog
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.focus(); // Focus the window to ensure it shows up
    printWindow.print(); // Trigger print

    // Close the print window after printing
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
        const aDate = a.appointmentDetails?.appointmentDate?.toDate
          ? a.appointmentDetails.appointmentDate.toDate()
          : null;
        const bDate = b.appointmentDetails?.appointmentDate?.toDate
          ? b.appointmentDetails.appointmentDate.toDate()
          : null;

        const isAWalkIn = a.appointmentDetails?.apptType === "Walk-in";
        const isBWalkIn = b.appointmentDetails?.apptType === "Walk-in";

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
    const fetchReviewerDetails = async (reviewedBy) => {
      if (reviewedBy) {
        const userData = await getUserById(reviewedBy);
        setReviewerDetails(userData);
      }
    };

    if (selectedAppointment?.appointmentDetails?.reviewedBy) {
      fetchReviewerDetails(selectedAppointment.appointmentDetails.reviewedBy);
    }
  }, [selectedAppointment]);

  useEffect(() => {
    const fetchAssignedLawyerDetails = async (assignedLawyerId) => {
      if (assignedLawyerId) {
        const userData = await getUserById(assignedLawyerId);
        setAssignedLawyerDetails(userData);
      }
    };

    if (selectedAppointment?.appointmentDetails?.assignedLawyer) {
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

  const filterTime = (time) => {
    if (!(time instanceof Date)) return false;
    const hours = time.getHours();
    const minutes = time.getMinutes();
    const now = new Date();

    if (hours < 13 || hours >= 17 || time <= now) return false;

    const dateTime = new Date(appointmentDate);
    dateTime.setHours(hours, minutes, 0, 0);

    return !isSlotBookedByAssignedLawyer(dateTime);
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const updatedData = {
        "clientEligibility.eligibility": clientEligibility.eligibility,
        "appointmentDetails.appointmentStatus":
          clientEligibility.eligibility === "yes" ? "approved" : "denied",
        "clientEligibility.denialReason": clientEligibility.denialReason,
        "appointmentDetails.updatedTime": Timestamp.fromDate(new Date()),
      };

      await updateAppointment(selectedAppointment.id, updatedData);
      setSnackbarMessage("Form has been successfully submitted.");
      setSelectedAppointment(null);
    } catch (error) {
      setSnackbarMessage("Error submitting form, please try again.");
    } finally {
      setIsSubmitting(false);
      setShowSnackbar(true);
      setTimeout(() => setShowSnackbar(false), 3000);
    }
  };

  const handleSubmitProceedingNotes = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const updatedData = {
        "appointmentDetails.proceedingNotes": proceedingNotes,
        "appointmentDetails.ibpParalegalStaff":
          clientEligibility.ibpParalegalStaff,
        "appointmentDetails.assistingCounsel":
          clientEligibility.assistingCounsel,
        "appointmentDetails.appointmentStatus": "done",
        "appointmentDetails.updatedTime": Timestamp.fromDate(new Date()),
        "appointmentDetails.clientAttend": clientAttend,
      };

      await updateAppointment(selectedAppointment.id, updatedData);
      setSnackbarMessage("Remarks have been successfully submitted.");

      // Clear form fields after successful submission
      setProceedingNotes("");
      setClientAttend(null);
      setClientEligibility({
        ...clientEligibility,
        ibpParalegalStaff: "",
        assistingCounsel: "",
      });

      // Optionally, close the form/modal if needed
      setShowProceedingNotesForm(false);
    } catch (error) {
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

    let meetingLink =
      selectedAppointment.appointmentDetails?.meetingLink || null;
    let meetingPass =
      selectedAppointment.appointmentDetails?.meetingPass || null;

    if (rescheduleAppointmentType === "Online") {
      const { link, password } = generateJitsiLink(
        selectedAppointment.controlNumber
      );
      meetingLink = link;
      meetingPass = password;
    } else if (rescheduleAppointmentType === "In-person") {
      meetingLink = null;
      meetingPass = null;
    }

    const appointmentRef = doc(fs, "appointments", selectedAppointment.id);
    const appointmentSnapshot = await getDoc(appointmentRef);
    const appointmentData = appointmentSnapshot.data();

    const rescheduleEntry = {
      rescheduleDate: selectedAppointment.appointmentDetails?.appointmentDate,
      rescheduleAppointmentType:
        selectedAppointment.appointmentDetails?.apptType,
      rescheduleReason: rescheduleReason,
      rescheduleTimestamp: Timestamp.fromDate(new Date()),
    };

    const updatedRescheduleHistory = appointmentData.rescheduleHistory
      ? [...appointmentData.rescheduleHistory, rescheduleEntry]
      : [rescheduleEntry];

    const updatedData = {
      "appointmentDetails.appointmentDate": Timestamp.fromDate(rescheduleDate),
      "appointmentDetails.apptType": rescheduleAppointmentType,
      rescheduleHistory: updatedRescheduleHistory,
      "appointmentDetails.updatedTime": Timestamp.fromDate(new Date()),
      ...(meetingLink && {
        "appointmentDetails.meetingLink": meetingLink,
        "appointmentDetails.meetingPass": meetingPass,
      }),
    };

    try {
      // Save the updated appointment information first
      await updateDoc(appointmentRef, updatedData);

      const clientFullName = selectedAppointment.fullName;
      const appointmentId = selectedAppointment.id;

      const lawyerFullName = assignedLawyerDetails
        ? `${assignedLawyerDetails.display_name} ${assignedLawyerDetails.middle_name} ${assignedLawyerDetails.last_name}`
        : "Assigned Lawyer Not Available";

      // Send notifications after successfully updating Firestore
      await sendNotification(
        `Your appointment (ID: ${appointmentId}) has been rescheduled to a different date and as an ${rescheduleAppointmentType} appointment.`,
        selectedAppointment.uid,
      );

      if (assignedLawyerDetails?.uid) {
        await sendNotification(
          `The appointment (ID: ${appointmentId}) for ${clientFullName} has been rescheduled to a different date and as an ${rescheduleAppointmentType} appointment.`,
          assignedLawyerDetails.uid,
          "appointment"
        );
      }

      const headLawyerUid = await getHeadLawyerUid();
      if (headLawyerUid) {
        await sendNotification(
          `The appointment (ID: ${appointmentId}) for ${clientFullName} has been rescheduled to a different date and as an ${rescheduleAppointmentType} appointment.`,
          headLawyerUid,
          "appointment"
        );
      }

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

      setSnackbarMessage("Appointment successfully rescheduled.");
      setShowSnackbar(true);
      setTimeout(() => {
        setShowSnackbar(false);
        setSelectedAppointment(null);
      }, 3000);
    } catch (error) {
      console.error("Error rescheduling appointment:", error);
      setSnackbarMessage("Error rescheduling appointment, please try again.");
      setShowSnackbar(true);
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
    if (isSlotBookedByAssignedLawyer(dateTime)) {
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

    return !isSlotBookedByAssignedLawyer(dateTime);
  };

  const isSlotBookedByAssignedLawyer = (dateTime) => {
    return appointments.some((appointment) => {
      const appointmentDate = appointment.appointmentDetails?.appointmentDate;
      const assignedLawyer = appointment.appointmentDetails?.assignedLawyer;

      return (
        assignedLawyer ===
          selectedAppointment?.appointmentDetails?.assignedLawyer &&
        appointmentDate?.toDate().getTime() === dateTime.getTime()
      );
    });
  };

  const isSlotBookedByCurrentUser = (dateTime) => {
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
    if (isSlotBookedByAssignedLawyer(dateTime)) {
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
          <option value="all">Status</option>
          <option value="approved">Approved</option>
          <option value="scheduled">Scheduled</option>
          <option value="denied">Denied</option>
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
        <p>Total Filtered Items: {totalFilteredItems}</p>
        <table class="flexible-table">
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
                  <td>{appointment.fullName}</td>
                  <td>{appointment.selectedAssistanceType}</td>
                  <td>{getFormattedDate(appointment.appointmentDate, true)}</td>
                  <td>{appointment.appointmentDetails?.apptType}</td>
                  <td>
                    <span
                      style={{
                        color:
                          appointment.appointmentStatus === "pending"
                            ? "black"
                            : "normal", // Highlight the "Pending" status
                      }}
                    >
                      {capitalizeFirstLetter(appointment.appointmentStatus)}
                    </span>
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
              <h2>Appointment Details</h2>
              <div id="appointment-details-section">
                <section className="mb-4 print-section">
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
                        <td>
                          {selectedAppointment.appointmentDetails?.apptType ||
                            "N/A"}
                        </td>
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
                {selectedAppointment?.rescheduleHistory &&
                selectedAppointment.rescheduleHistory.length > 0 ? (
                  <section className="mb-4">
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
                        <td>{selectedAppointment.fullName}</td>
                      </tr>
                      <tr>
                        <th>Date of Birth:</th>
                        <td>
                          {selectedAppointment.dob
                            ? new Date(
                                selectedAppointment.dob
                              ).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })
                            : "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <th>Contact Number:</th>
                        <td>
                          {selectedAppointment?.contactNumber ||
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
                            {selectedAppointment?.selectedGender ||
                              "Not Specified"}
                          </td>
                        </tr>
                        <tr>
                          <th>Spouse Name:</th>
                          <td>
                            {selectedAppointment.spouseName || "Not Available"}
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

                <section className="mb-4 print-section">
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
                          {selectedAppointment?.kindOfEmployment ||
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
                          {selectedAppointment.barangayImageUrl ? (
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
                          {selectedAppointment.dswdImageUrl ? (
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
                          {selectedAppointment.paoImageUrl ? (
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                openImageModal(selectedAppointment.paoImageUrl);
                              }}
                            >
                              <img
                                src={selectedAppointment.paoImageUrl}
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
                    </tbody>
                  </table>
                </section>

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
