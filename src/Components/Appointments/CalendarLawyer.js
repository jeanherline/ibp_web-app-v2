import React, { useState, useEffect } from "react";
import SideNavBar from "../SideNavBar/SideNavBar";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import {
  aptsCalendar,
  getCalendar,
  getUserById,
} from "../../Config/FirebaseServices"; // Assuming getCalendar is correctly named
import "./Appointments.css";
import { fs, auth } from "../../Config/Firebase";
import ibpLogo from "../../Assets/img/ibp_logo.png";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVideo, faCheck } from "@fortawesome/free-solid-svg-icons"; // Import the video icon
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { useNavigate } from "react-router-dom";

const localizer = momentLocalizer(moment);

function CalendarLawyer() {
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null); // State to store the selected appointment details
  const [reviewerDetails, setReviewerDetails] = useState(null);
  const [statusFilters] = useState(["approved", "scheduled", "done"]);
  const [assignedLawyerDetails, setAssignedLawyerDetails] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState("");
  const [isRescheduleHistoryOpen, setIsRescheduleHistoryOpen] = useState(false);
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

  const toggleRescheduleHistory = () => {
    setIsRescheduleHistoryOpen((prevState) => !prevState);
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        window.location.href = "/";
      }
    });

    return () => unsubscribe();
  }, []);

  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUserId(user.uid); // Set currentUserId to logged-in user's UID
      } else {
        setCurrentUserId(null);
        window.location.href = "/"; // Redirect if not logged in
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchAppointmentsAndSlots = async () => {
      try {
        const apptData = await aptsCalendar(statusFilters, null, 50, "");
        const slotsData = await getCalendar();

        const formatTime = (date) => {
          let hours = date.getHours();
          const minutes = date.getMinutes().toString().padStart(2, "0");
          const ampm = hours >= 12 ? "PM" : "AM";
          hours = hours % 12;
          hours = hours ? hours : 12;
          return `${hours}:${minutes} ${ampm}`;
        };

        const formattedAppointments = apptData.data
          .filter(
            (appt) => appt.appointmentDetails?.assignedLawyer === currentUserId
          ) // Filter by current user's ID
          .map((appt) => {
            const appointmentDate = new Date(
              appt.appointmentDate.seconds * 1000
            );
            return {
              start: appointmentDate,
              end: appointmentDate,
              title: `${formatTime(appointmentDate)} - ${appt.fullName}`,
              allDay: false,
              appointmentStatus: appt.appointmentStatus,
              rescheduleHistory: appt.rescheduleHistory || [],
              ...appt,
            };
          });

        const formattedBookedSlots = slotsData.map((slot) => {
          const appointmentDate = new Date(slot.appointmentDate.seconds * 1000);
          return {
            start: appointmentDate,
            end: appointmentDate,
            title: `${formatTime(appointmentDate)} - ${slot.fullName}`,
            allDay: false,
            appointmentStatus: "scheduled",
            ...slot,
          };
        });

        setAppointments([...formattedAppointments, ...formattedBookedSlots]);
      } catch (error) {
        console.error("Error fetching appointments and slots:", error);
      }
    };

    if (currentUserId) {
      fetchAppointmentsAndSlots();
    }
  }, [statusFilters, currentUserId]);

  useEffect(() => {
    const fetchReviewerDetails = async (reviewedBy) => {
      if (reviewedBy) {
        const userData = await getUserById(reviewedBy);
        setReviewerDetails(userData);
      }
    };

    const fetchAssignedLawyerDetails = async (assignedLawyerId) => {
      if (assignedLawyerId) {
        const userData = await getUserById(assignedLawyerId);
        setAssignedLawyerDetails(userData);
      }
    };

    if (selectedAppointment?.appointmentDetails?.reviewedBy) {
      fetchReviewerDetails(selectedAppointment.appointmentDetails.reviewedBy);
    }

    if (selectedAppointment?.appointmentDetails?.assignedLawyer) {
      fetchAssignedLawyerDetails(
        selectedAppointment.appointmentDetails.assignedLawyer
      );
    }
  }, [selectedAppointment]);

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

    // Add modern, professional styles for printing
    printWindow.document.write("<style>");
    printWindow.document.write(`
      @media print {
        @page {
          size: 8.5in 13in;
          margin: 0.8in;
        }
        body {
          font-family: 'Arial', sans-serif;
          font-size: 12px;
          line-height: 1.6;
          color: #333;
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
        }
        .header h2 {
          font-size: 18px;
          font-weight: normal;
          color: #333;
          margin-bottom: 5px;
        }
        .header img {
          width: 60px;
          display: block;
          margin: 0 auto;
        }
        .section-title {
          font-size: 14px;
          font-weight: bold;
          margin-top: 30px;
          margin-bottom: 10px;
          color: #555;
          border-bottom: 1px solid #ddd;
          padding-bottom: 5px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 12px;
          color: #333;
        }
        table, th, td {
          border: 1px solid #ddd;
        }
        th, td {
          padding: 10px;
          text-align: left;
        }
        th {
          background-color: #f7f7f7;
          font-weight: normal;
          font-size: 12px;
          text-transform: uppercase;
          color: #555;
        }
        td {
          font-size: 12px;
          color: #333;
        }
        .form-label {
          font-size: 12px;
          font-weight: bold;
          margin-top: 15px;
          color: #333;
        }
        .form-field {
          font-size: 12px;
          padding: 5px 0;
          border-bottom: 1px solid #ddd;
          color: #555;
        }
        .print-image {
          width: 100%;
          height: auto;
          max-height: 10in;
          object-fit: contain;
          display: block;
          margin-bottom: 10px;
        }
        .no-print {
          display: none;
        }
        /* Modern table style */
        table thead {
          background-color: #f9f9f9;
        }
        table th {
          letter-spacing: 1px;
        }
        table tbody tr:nth-child(even) {
          background-color: #f5f5f5;
        }
        /* Add a page break before Employment Profile section */
        .employment-profile {
          page-break-before: always; /* Forces a page break before this section */
        }
      }
    `);
    printWindow.document.write("</style>");

    // Add the IBP logo and QR code to the print layout
    printWindow.document.write(`
      <div class="header">
        <img src="${ibpLogo}" alt="IBP Logo" />
        <h2>Integrated Bar of the Philippines - Malolos</h2>
        ${selectedAppointment.appointmentDetails.qrCode
        ? `<img src="${selectedAppointment.appointmentDetails.qrCode}" alt="QR Code" style="width: 60px; margin: 0 auto;" />`
        : ""
      }
      </div>
    `);

    // Insert the modified contents
    printWindow.document.write(modifiedPrintContents);

    // Handle image printing with modern margins and scaling
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

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSelectEvent = async (event) => {
    setSelectedAppointment(event);
    const appointmentId = event.id; // Assuming id exists in the event data
    await fetchRescheduleHistory(appointmentId);
  };

  const fetchRescheduleHistory = async (appointmentId) => {
    try {
      const appointmentRef = fs.collection("appointments").doc(appointmentId);
      const appointmentSnapshot = await appointmentRef.get();

      if (appointmentSnapshot.exists) {
        const appointmentData = appointmentSnapshot.data();
        const rescheduleHistory = appointmentData.rescheduleHistory || null;

        if (rescheduleHistory && Object.keys(rescheduleHistory).length > 0) {
          setSelectedAppointment((prev) => ({
            ...prev,
            rescheduleHistory: Object.values(rescheduleHistory), // Assuming rescheduleHistory is a map
          }));
        } else {
          setSelectedAppointment((prev) => ({
            ...prev,
            rescheduleHistory: [],
          }));
        }
      }
    } catch (error) {
      console.error("Error fetching reschedule history:", error);
    }
  };

  const handleCloseModal = () => {
    setSelectedAppointment(null);
  };

  const capitalizeFirstLetter = (string) => {
    if (string && typeof string === "string") {
      return string.charAt(0).toUpperCase() + string.slice(1);
    }
    return string; // Return the string as is if it's undefined or not a string
  };

  const getFormattedDate = (timestamp, includeTime = false) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp.seconds * 1000 || timestamp);
    const options = { year: "numeric", month: "long", day: "numeric" };
    if (includeTime) {
      options.hour = "numeric";
      options.minute = "numeric";
      options.hour12 = true;
    }
    return date.toLocaleString("en-US", options);
  };

  const openImageModal = (url) => {
    setCurrentImageUrl(url);
    setIsModalOpen(true);
  };

  return (
    <div className="dashboard-container">
      <SideNavBar />
      <div className="main-content">
        <br />
        <h3>Appts. Calendar</h3>
        <div className="appointment-calendar">
          <Calendar
            localizer={localizer}
            events={appointments}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 500 }}
            onSelectEvent={handleSelectEvent}
            components={{
              event: ({ event }) => (
                <span
                  className="event-container"
                  style={{ display: "flex", alignItems: "center" }}
                >
                  <strong>{event.title}</strong>
                  {/* Check if the appointment is online */}
                  {event.appointmentDetails?.apptType === "Online" && (
                    <button
                      onClick={() =>
                        window.open(
                          `/vpaas-magic-cookie-ef5ce88c523d41a599c8b1dc5b3ab765/${event.id}`,
                          "_blank"
                        )
                      }
                      className="join-meeting-btn"
                    >
                      <FontAwesomeIcon
                        icon={faVideo}
                        style={{ marginRight: "5px" }}
                      />
                      Join
                    </button>
                  )}
                </span>
              ),
              month: {
                dateHeader: ({ date, label }) => (
                  <div>
                    <span>{label}</span>
                    {appointments.filter((appt) =>
                      moment(appt.start).isSame(date, "day")
                    ).length > 1 && (
                        <span style={{ color: "red", marginLeft: "5px" }}>
                          +
                          {appointments.filter((appt) =>
                            moment(appt.start).isSame(date, "day")
                          ).length - 1}{" "}
                          more
                        </span>
                      )}
                  </div>
                ),
              },
            }}
          />
        </div>
        {selectedAppointment && (
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
                {(selectedAppointment.appointmentDetails?.newRequest ||
                  selectedAppointment.appointmentDetails?.requestReason) && (
                    <section className="mb-4 print-section no-print">
                      <h2>
                        <em style={{ color: "#a34bc9", fontSize: "16px" }}>
                          New Request Details
                        </em>
                      </h2>
                      <table className="table table-striped table-bordered">
                        <tbody>
                          {/* Only show the control number if newRequest is true */}
                          {selectedAppointment.appointmentDetails?.newRequest &&
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
                    {selectedAppointment.appointmentDetails?.apptType ===
                      "Online" && (
                        <tr className="no-print">
                          <th>Meeting Link:</th>
                          <td>
                            {selectedAppointment.appointmentDetails?.apptType ===
                              "Online" ? (
                              selectedAppointment.appointmentDetails
                                ?.appointmentStatus === "done" ? (
                                // Appointment is done, show "Done" with a check icon
                                <button
                                  style={{
                                    backgroundColor: "#1DB954", // Green background for "Done"
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
                      {selectedAppointment.appointmentStatus === "approved" && (
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
                                {entry.rescheduleStatus
                                  ? entry.rescheduleStatus.charAt(0).toUpperCase() + entry.rescheduleStatus.slice(1)
                                  : "N/A"}
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
                        {selectedAppointment?.phone || "Not Available"}
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
                          {selectedAppointment?.gender ||
                            "Not Specified"}
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
                        {selectedAppointment.employerAddress || "Not Available"}
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
                          {selectedAppointment.problemReason || "Not Available"}
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
                              openImageModal(selectedAppointment.dswdImageUrl);
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
                      <th>Recent Reschedule Request File:</th>
                      <td>
                        {selectedAppointment.newRequestUrl ? (
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              openImageModal(selectedAppointment.newRequestUrl);
                            }}
                          >
                            <img
                              src={selectedAppointment.newRequestUrl}
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
      </div>
    </div>
  );
}

const ImageModal = ({ isOpen, url, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="image-container">
          <img src={url} alt="Fullscreen Image" className="fullscreen-image" />
        </div>
        <button onClick={onClose} className="close-button">
          &times;
        </button>
      </div>
    </div>
  );
};

export default CalendarLawyer;
