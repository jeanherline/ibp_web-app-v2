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
import { faVideo } from "@fortawesome/free-solid-svg-icons"; // Import the video icon

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
        <h3>Appointments Calendar</h3>
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
              <th>Link</th>
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
                    {appointment.appointmentDetails?.apptType === "Online" ? (
                      appointment.appointmentDetails?.appointmentStatus ===
                      "done" ? (
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
                      ) : appointment.clientAttend === "no" ? (
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
                              `/vpaas-magic-cookie-ef5ce88c523d41a599c8b1dc5b3ab765/${appointment.id}`,
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
                          <FontAwesomeIcon
                            icon={faVideo}
                            style={{ marginRight: "8px" }}
                          />
                          Join Meeting
                        </button>
                      )
                    ) : (
                      "N/A"
                    )}
                  </td>

                  <td>
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
                    &nbsp; &nbsp;
                    {appointment.appointmentStatus === "approved" && (
                      <>
                        <OverlayTrigger
                          placement="top"
                          overlay={renderTooltip({ title: "Schedule" })}
                        >
                          <button
                            onClick={() => {
                              setSelectedAppointment(appointment);
                              setShowProceedingNotesForm(false);
                              setShowRescheduleForm(false);
                              setShowScheduleForm(true);
                            }}
                            style={{
                              backgroundColor: "#1DB954",
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
                              setSelectedAppointment(appointment);
                              setShowProceedingNotesForm(true);
                              setShowRescheduleForm(false);
                              setShowScheduleForm(false);
                            }}
                            style={{
                              backgroundColor:
                                appointment.appointmentStatus === "approved"
                                  ? "gray"
                                  : "#1DB954",
                              color: "white",
                              border: "none",
                              padding: "5px 10px",
                              cursor:
                                appointment.appointmentStatus === "approved"
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                            disabled={
                              appointment.appointmentStatus === "approved"
                            } // Disable when status is approved
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
                              setSelectedAppointment(appointment);
                              setShowProceedingNotesForm(true);
                              setShowRescheduleForm(false);
                              setShowScheduleForm(false);
                            }}
                            style={{
                              backgroundColor: "#1DB954",
                              color: "white",
                              border: "none",
                              padding: "5px 10px",
                              cursor: "pointer",
                            }}
                          >
                            <FontAwesomeIcon icon={faCheck} />
                          </button>
                        </OverlayTrigger>
                      </>
                    )}
                    {(appointment.appointmentStatus === "pending" ||
                      appointment.appointmentStatus === "done" ||
                      appointment.appointmentStatus === "denied") && (
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
                  {(selectedAppointment.appointmentDetails?.newRequest ||
                    selectedAppointment.appointmentDetails?.requestReason) && (
                    <section className="mb-4 print-section">
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
                            ?.newRequestFile && (
                            <tr>
                              <th>Attached File:</th>
                              <td>
                                <a
                                  href={
                                    selectedAppointment.appointmentDetails
                                      ?.newRequestFile
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
                        <tr>
                          <th>Meeting Link:</th>
                          <td>
                            {selectedAppointment.appointmentDetails
                              ?.apptType === "Online" ? (
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
                                    backgroundColor: "#28a745",
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
                                  Join Meeting
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
                <button disabled={isSubmitting}>Submit</button>
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

              <button disabled={isSubmitting}>Submit</button>
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
              <div>
                <b>
                  <label>Reschedule Date and Time: *</label>
                </b>
                <br />
                <ReactDatePicker
                  selected={rescheduleDate}
                  onChange={(date) => setRescheduleDate(date)}
                  showTimeSelect
                  filterDate={(date) => filterDate(date) && date > new Date()}
                  filterTime={(time) => filterRescheduleTime(time)} // Apply the correct filter
                  dateFormat="MM/dd/yy h:mm aa"
                  inline
                  timeIntervals={60}
                  minTime={new Date(new Date().setHours(13, 0, 0))} // Starting from 1:00 PM
                  maxTime={new Date(new Date().setHours(17, 0, 0))} // Ending at 5:00 PM
                  dayClassName={(date) => getDayClassName(date)}
                  timeClassName={(time) => getTimeRescheduleClassName(time)} // Ensure className application
                />
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
              <button disabled={isSubmitting}>Submit</button>
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
            <form onSubmit={handleScheduleSubmit}>
              <div>
                <b>
                  <label>Appointment Date and Time: *</label>
                </b>
                <br />
                <ReactDatePicker
                  selected={appointmentDate} // Correct state for scheduling
                  onChange={(date) => setAppointmentDate(date)} // Ensure it updates appointmentDate
                  showTimeSelect
                  filterDate={(date) => filterDate(date) && date > new Date()}
                  filterTime={(time) => filterTime(time)} // Apply correct filtering for valid times
                  dateFormat="MM/dd/yy h:mm aa"
                  inline
                  timeIntervals={60} // Set to 60 minutes for 1-hour intervals
                  minTime={new Date(new Date().setHours(13, 0, 0))} // Starting from 1:00 PM
                  maxTime={new Date(new Date().setHours(17, 0, 0))} // Ending at 5:00 PM
                  dayClassName={(date) => getDayClassName(date)} // Add class for fully booked days
                  timeClassName={(time) => getTimeClassName(time)} // Ensure className application for time
                />
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
              <button disabled={isSubmitting}>Submit</button>
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
