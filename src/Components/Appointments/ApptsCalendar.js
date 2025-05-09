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
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const localizer = momentLocalizer(moment);

function ApptsCalendar() {
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
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    const fetchAppointmentsAndSlots = async () => {
      try {
        setLoading(true);
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

        const formattedAppointments = apptData.data.map((appt) => {
          const appointmentDate = new Date(
            appt.appointmentDate?.seconds * 1000
          );

          return {
            id: appt.id,
            uid: appt.uid,
            start: appointmentDate,
            end: appointmentDate,
            allDay: false,
            title: `${appointmentDate.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })} - ${appt.fullName || "Unknown User"}`,

            // Appointment metadata
            appointmentStatus: appt.appointmentStatus,
            appointmentDate: appt.appointmentDate,
            appointmentDetails: appt.appointmentDetails,
            controlNumber: appt.controlNumber,
            createdDate: appt.createdDate,
            proceedingNotes: appt.proceedingNotes,
            clientEligibility: appt.clientEligibility,
            reviewerDetails: appt.reviewerDetails,
            rescheduleHistory: appt.rescheduleHistory || [],

            // Legal Assistance
            selectedAssistanceType: appt.selectedAssistanceType,
            problemReason: appt.problemReason,
            problems: appt.problems,
            desiredSolutions: appt.desiredSolutions,

            // Employment info
            occupation: appt.occupation || "",
            employmentType: appt.employmentType || "",
            employerName: appt.employerName || "",
            employerAddress: appt.employerAddress || "",
            monthlyIncome: appt.monthlyIncome || "",

            // Personal info
            dob: appt.dob || null,
            phone: appt.phone || "",
            gender: appt.gender || "",
            address: appt.address || "",
            spouse: appt.spouse || "",
            spouseOccupation: appt.spouseOccupation || "",
            childrenNamesAges: appt.childrenNamesAges || "",
            fullName: appt.fullName || "",

            // Uploaded Images
            barangayImageUrl: appt.barangayImageUrl || "",
            dswdImageUrl: appt.dswdImageUrl || "",
            paoImageUrl: appt.paoImageUrl || "",
            proceedingFileUrl: appt.proceedingFileUrl || "",
            newRequestUrl: appt.newRequestUrl || "",
          };
        });

        const formattedBookedSlots = slotsData.map((slot) => {
          const appointmentDate = new Date(slot.appointmentDate.seconds * 1000);
          return {
            start: appointmentDate,
            end: appointmentDate,
            title: `${formatTime(appointmentDate)} - ${slot.fullName}`,
            allDay: false,
            appointmentStatus: "scheduled", // Include appointmentStatus
            ...slot,
          };
        });

        setAppointments([...formattedAppointments, ...formattedBookedSlots]);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching appointments and slots:", error);
        setLoading(false);
      }
    };

    fetchAppointmentsAndSlots();
  }, [statusFilters]);

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
      {loading ? (
        <div
          className="main-content"
          style={{ textAlign: "center", paddingTop: "5rem" }}
        >
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <div className="main-content">
          <br />
          <h3>Appts. Calendar</h3>

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
                  {event.appointmentDetails?.scheduleType === "Online" &&
                    (event.appointmentDetails?.appointmentStatus === "done" ? (
                      <button
                        className="join-meeting-btn"
                        disabled
                        style={{
                          backgroundColor: "#1DB954",
                          color: "white",
                          border: "none",
                          padding: "2px 6px",
                          marginLeft: "8px",
                          fontSize: "12px",
                          cursor: "not-allowed",
                        }}
                      >
                        <FontAwesomeIcon icon={faCheck} style={{ marginRight: "5px" }} />
                        Done
                      </button>
                    ) : event.appointmentDetails?.appointmentStatus === "missed" ? (
                      <button
                        className="join-meeting-btn"
                        disabled
                        style={{
                          backgroundColor: "#dc3545",
                          color: "white",
                          border: "none",
                          padding: "2px 6px",
                          marginLeft: "8px",
                          fontSize: "12px",
                          cursor: "not-allowed",
                        }}
                      >
                        Missed
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          window.open(
                            `/vpaas-magic-cookie-ef5ce88c523d41a599c8b1dc5b3ab765/${event.id}`,
                            "_blank"
                          )
                        }
                        className="join-meeting-btn"
                        style={{
                          backgroundColor: "#28a745",
                          color: "white",
                          border: "none",
                          padding: "2px 6px",
                          marginLeft: "8px",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        <FontAwesomeIcon icon={faVideo} style={{ marginRight: "5px" }} />
                        Join
                      </button>
                    ))}

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
      )}

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
                    <td>{selectedAppointment?.phone || "Not Available"}</td>
                  </tr>
                  <>
                    <tr>
                      <th>Address:</th>
                      <td>{selectedAppointment?.address || "Not Available"}</td>
                    </tr>
                    <tr>
                      <th>Gender:</th>
                      <td>{selectedAppointment?.gender || "Not Specified"}</td>
                    </tr>
                    <tr>
                      <th>Spouse Name:</th>
                      <td>{selectedAppointment.spouse || "Not Available"}</td>
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
                            src={selectedAppointment.appointmentDetails.qrCode}
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
                          {selectedAppointment.appointmentDetails?.appointmentStatus === "done" ? (
                            <button
                              style={{
                                backgroundColor: "#1DB954",
                                color: "white",
                                border: "none",
                                padding: "5px 8px",
                                cursor: "not-allowed",
                                display: "flex",
                                alignItems: "center",
                              }}
                              disabled
                            >
                              <FontAwesomeIcon icon={faCheck} style={{ marginRight: "8px" }} />
                              Done
                            </button>
                          ) : selectedAppointment.appointmentDetails?.appointmentStatus === "missed" ? (
                            <button
                              style={{
                                backgroundColor: "#dc3545",
                                color: "white",
                                border: "none",
                                padding: "5px 8px",
                                cursor: "not-allowed",
                                display: "flex",
                                alignItems: "center",
                              }}
                              disabled
                            >
                              Missed
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
                                backgroundColor: "#28a745",
                                color: "white",
                                border: "none",
                                padding: "5px 8px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              <FontAwesomeIcon icon={faVideo} style={{ marginRight: "8px" }} />
                              Join Meeting
                            </button>
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
                    <td>{getFormattedDate(selectedAppointment.createdDate)}</td>
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
                    {selectedAppointment.appointmentStatus === "scheduled" && (
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
                    <td>{selectedAppointment.occupation || "Not Available"}</td>
                  </tr>
                  <tr>
                    <th>Type of Employment:</th>
                    <td>
                      {selectedAppointment?.employmentType || "Not Specified"}
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
                      <td>{selectedAppointment.problems || "Not Available"}</td>
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
                    <th>New Appointment Request File:</th>
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

export default ApptsCalendar;
