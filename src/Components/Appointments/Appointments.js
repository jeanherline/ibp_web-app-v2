import React, { useState, useEffect } from "react";
import SideNavBar from "../SideNavBar/SideNavBar";
import "../Dashboard/Dashboard.css";
import "./Appointments.css";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Pagination from "react-bootstrap/Pagination";
import {
  getAppointments,
  updateAppointment,
  getBookedSlots,
  getUserById,
} from "../../Config/FirebaseServices";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "../../AuthContext";

function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [filter, setFilter] = useState("pending");
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lastVisible, setLastVisible] = useState(null);
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
  const [bookedSlots, setBookedSlots] = useState([]);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState("");
  const { currentUser } = useAuth();
  const [reviewerDetails, setReviewerDetails] = useState(null);
  const [proceedingNotes, setProceedingNotes] = useState("");
  const [showProceedingNotesForm, setShowProceedingNotesForm] = useState(false);
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);

  useEffect(() => {
    const fetchAppointments = async () => {
      const { data, total } = await getAppointments(
        filter,
        lastVisible,
        pageSize,
        searchText
      );
      setAppointments(data);
      setTotalPages(Math.ceil(total / pageSize));
    };
    fetchAppointments();
  }, [filter, lastVisible, searchText]);

  useEffect(() => {
    const fetchBookedSlots = async () => {
      const data = await getBookedSlots();
      setBookedSlots(data.map((slot) => new Date(slot)));
    };
    fetchBookedSlots();
  }, []);

  useEffect(() => {
    setSelectedAppointment(null);
    setShowProceedingNotesForm(false);
    setShowRescheduleForm(false);
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

  const openImageModal = (url) => {
    setCurrentImageUrl(url);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  const isWeekday = (date) => {
    const day = date.getDay();
    return day === 2 || day === 4;
  };

  const isSlotBooked = (dateTime) => {
    return bookedSlots.some(
      (bookedDate) =>
        dateTime.getDate() === bookedDate.getDate() &&
        dateTime.getMonth() === bookedDate.getMonth() &&
        dateTime.getFullYear() === bookedDate.getFullYear() &&
        dateTime.getHours() === bookedDate.getHours() &&
        dateTime.getMinutes() === bookedDate.getMinutes()
    );
  };

  const filterDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isFullyBooked =
      bookedSlots.filter(
        (slot) =>
          slot.getDate() === date.getDate() &&
          slot.getMonth() === date.getMonth() &&
          slot.getFullYear() === date.getFullYear() &&
          slot.getHours() >= 13 &&
          slot.getHours() < 17
      ).length === 4;
    return isWeekday(date) && date >= today && !isFullyBooked;
  };

  const filterTime = (time) => {
    if (!(time instanceof Date)) return false;
    const hours = time.getHours();
    const minutes = time.getMinutes();

    if (hours < 13 || hours >= 17) return false;

    const dateTime = new Date(appointmentDate);
    dateTime.setHours(hours, minutes, 0, 0);
    return !isSlotBooked(dateTime);
  };

  const handleNext = () => {
    setLastVisible(appointments[appointments.length - 1]);
    setCurrentPage((prevPage) => Math.min(prevPage + 1, totalPages));
  };

  const handlePrevious = () => {
    setLastVisible(appointments[0]);
    setCurrentPage((prevPage) => Math.max(prevPage - 1, 1));
  };

  const handleFirst = () => {
    setLastVisible(null);
    setCurrentPage(1);
  };

  const handleLast = () => {
    setLastVisible(appointments[appointments.length - 1]);
    setCurrentPage(totalPages);
  };

  const toggleDetails = (appointment) => {
    setSelectedAppointment(
      selectedAppointment?.id === appointment.id ? null : appointment
    );
    setShowProceedingNotesForm(false);
    setShowRescheduleForm(false);
  };

  const handleCloseDetails = () => {
    setSelectedAppointment(null);
    setShowProceedingNotesForm(false);
    setShowRescheduleForm(false);
  };

  const handleEligibilityChange = (e) => {
    setClientEligibility({ ...clientEligibility, eligibility: e.target.value });
    setAppointmentDate(null);
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

    const status =
      clientEligibility.eligibility === "yes"
        ? "approved"
        : clientEligibility.eligibility === "no"
        ? "denied"
        : "done";

    const updatedData = {
      clientEligibility,
      "appointmentDetails.appointmentDate": Timestamp.fromDate(appointmentDate),
      "appointmentDetails.appointmentStatus": status,
      "appointmentDetails.reviewedBy": currentUser.uid,
    };

    if (status === "done") {
      updatedData["appointmentDetails.proceedingNotes"] = proceedingNotes;
    }

    await updateAppointment(selectedAppointment.id, updatedData);

    setSelectedAppointment(null);
    setClientEligibility({
      eligibility: "",
      denialReason: "",
      notes: "",
      ibpParalegalStaff: "",
      assistingCounsel: "",
    });
    setProceedingNotes("");
    setShowProceedingNotesForm(false);
    setShowRescheduleForm(false);

    const { data, total } = await getAppointments(
      filter,
      lastVisible,
      pageSize,
      searchText
    );
    setAppointments(data);
    setTotalPages(Math.ceil(total / pageSize));

    setSnackbarMessage("Form has been successfully submitted.");
    setShowSnackbar(true);
    setTimeout(() => setShowSnackbar(false), 3000);
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();

    const updatedData = {
      "appointmentDetails.appointmentDate": Timestamp.fromDate(rescheduleDate),
      "appointmentDetails.rescheduleReason": rescheduleReason,
      "appointmentDetails.reviewedBy": currentUser.uid,
    };

    await updateAppointment(selectedAppointment.id, updatedData);

    setSelectedAppointment(null);
    setRescheduleDate(null);
    setRescheduleReason("");
    setShowRescheduleForm(false);

    const { data, total } = await getAppointments(
      filter,
      lastVisible,
      pageSize,
      searchText
    );
    setAppointments(data);
    setTotalPages(Math.ceil(total / pageSize));

    setSnackbarMessage("Appointment has been successfully rescheduled.");
    setShowSnackbar(true);
    setTimeout(() => setShowSnackbar(false), 3000);
  };

  const getFormattedDate = (timestamp, includeTime = false) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp.seconds * 1000);
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
    return isFullyBooked ? "fully-booked-day disabled-day" : "";
  };

  const getTimeClassName = (time) => {
    const dateTime = new Date(appointmentDate);
    dateTime.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return isSlotBooked(dateTime) ? "booked-time" : "";
  };

  return (
    <div className="dashboard-container">
      <SideNavBar />
      <div className="main-content">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search..."
        />
        <select onChange={(e) => setFilter(e.target.value)} value={filter}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="denied">Denied</option>
          <option value="done">Done</option>
        </select>
        <table className="table table-striped table-bordered">
          <thead>
            <tr>
              <th>Control Number</th>
              <th>Full Name</th>
              <th>Contact Number</th>
              <th>Nature of Legal Assistance Requested</th>
              <th>Date Submitted</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((appointment) => (
              <tr key={appointment.id}>
                <td>{appointment.controlNumber}</td>
                <td>{appointment.fullName}</td>
                <td>{appointment.contactNumber}</td>
                <td>{appointment.selectedAssistanceType}</td>
                <td>{getFormattedDate(appointment.createdDate)}</td>
                <td>
                  <button onClick={() => toggleDetails(appointment)}>
                    View
                  </button>
                  &nbsp; &nbsp;
                  {filter === "approved" && (
                    <>
                      <button
                        onClick={() => {
                          setSelectedAppointment(appointment);
                          setShowProceedingNotesForm(true);
                          setShowRescheduleForm(false);
                        }}
                      >
                        Done
                      </button>
                      &nbsp; &nbsp;
                      <button
                        onClick={() => {
                          setSelectedAppointment(appointment);
                          setShowProceedingNotesForm(false);
                          setShowRescheduleForm(true);
                        }}
                      >
                        Reschedule
                      </button>
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
          selectedAppointment.appointmentStatus !== "done" &&
          !showProceedingNotesForm &&
          !showRescheduleForm && (
            <div className="client-eligibility">
              <br />
              <h2>Appointment Details</h2>

              <section className="mb-4">
                <h3>
                  <em>Basic Information</em>
                </h3>
                <p>
                  <strong>Control Number:</strong> <br></br>{" "}
                  {selectedAppointment.controlNumber}
                </p>
                <br></br>
                <p>
                  <strong>Date Request Created:</strong> <br></br>
                  {getFormattedDate(selectedAppointment.createdDate)}
                </p>
                <br></br>
                <p>
                  <strong>Appointment Status:</strong> <br></br>
                  {capitalizeFirstLetter(selectedAppointment.appointmentStatus)}
                </p>
                <br></br>
                {selectedAppointment.appointmentStatus !== "pending" && (
                  <>
                    <p>
                      <strong>Appointment Date:</strong> <br></br>
                      {getFormattedDate(
                        selectedAppointment.appointmentDate,
                        true
                      )}
                    </p>
                    <br></br>
                    <p>
                      <strong>Eligibility:</strong> <br></br>
                      {capitalizeFirstLetter(
                        selectedAppointment.clientEligibility?.eligibility ||
                          "-"
                      )}
                    </p>

                    {selectedAppointment.appointmentStatus === "denied" && (
                      <p>
                        <strong>Denial Reason:</strong> <br></br>
                        {selectedAppointment.clientEligibility?.denialReason ||
                          "-"}
                      </p>
                    )}
                    <br></br>
                    <p>
                      <strong>Notes:</strong> <br></br>
                      {selectedAppointment.clientEligibility?.notes || "-"}
                    </p>
                    <br></br>
                    <p>
                      <strong>IBP Paralegal Staff:</strong> <br></br>
                      {selectedAppointment.clientEligibility
                        ?.ibpParalegalStaff || "-"}
                    </p>
                    <br></br>
                    <p>
                      <strong>Assisting Counsel:</strong> <br></br>
                      {selectedAppointment.clientEligibility
                        ?.assistingCounsel || "-"}
                    </p>
                    <br></br>
                    <p>
                      <strong>Reviewed By:</strong> <br></br>
                      {reviewerDetails
                        ? `${reviewerDetails.display_name} ${reviewerDetails.middle_name} ${reviewerDetails.last_name}`
                        : "Not Available"}
                    </p>
                    <br></br>
                    <p>
                      <strong>Appointment Experience Rating:</strong>
                      <br></br>{" "}
                      {selectedAppointment.appointmentDetails?.feedbackRating ||
                        "-"}{" "}
                      Star/s Rating
                    </p>
                  </>
                )}
              </section>

              <section className="mb-4">
                <h3>
                  <em>Applicant Profile</em>
                </h3>
                <p>
                  <strong>Full Name:</strong> <br></br>
                  {selectedAppointment.fullName}
                </p>
                <br></br>
                <p>
                  <strong>Date of Birth:</strong> <br></br>
                  {selectedAppointment.dob
                    ? new Date(selectedAppointment.dob).toLocaleDateString(
                        "en-US",
                        { year: "numeric", month: "long", day: "numeric" }
                      )
                    : "N/A"}
                </p>
                <br></br>
                <p>
                  <strong>Address:</strong> <br></br>
                  {selectedAppointment?.address || "Not Available"}
                </p>
                <br></br>
                <p>
                  <strong>Contact Number:</strong> <br></br>
                  {selectedAppointment?.contactNumber || "Not Available"}
                </p>
                <br></br>
                <p>
                  <strong>Gender:</strong> <br></br>
                  {selectedAppointment?.selectedGender || "Not Specified"}
                </p>
                <br></br>
                <p>
                  <strong>Spouse Name:</strong> <br></br>
                  {selectedAppointment.spouseName || "Not Available"}
                </p>
                <br></br>
                <p>
                  <strong>Spouse Occupation:</strong> <br></br>
                  {selectedAppointment.spouseOccupation || "Not Available"}
                </p>
                <br></br>
                <p>
                  <strong>Children Names and Ages:</strong> <br></br>
                  {selectedAppointment.childrenNamesAges || "Not Available"}
                </p>
                <br></br>
              </section>

              <section className="mb-4">
                <h3>
                  <em>Employment Profile</em>
                </h3>
                <p>
                  <strong>Occupation:</strong> <br></br>
                  {selectedAppointment.occupation || "Not Available"}
                </p>
                <br></br>
                <p>
                  <strong>Type of Employment:</strong> <br></br>
                  {selectedAppointment?.kindOfEmployment || "Not Specified"}
                </p>
                <br></br>
                <p>
                  <strong>Employer Name:</strong>
                  <br></br>{" "}
                  {selectedAppointment?.employerName || "Not Available"}
                </p>
                <br></br>
                <p>
                  <strong>Employer Address:</strong> <br></br>
                  {selectedAppointment.employerAddress || "Not Available"}
                </p>
                <br></br>
                <p>
                  <strong>Monthly Income:</strong> <br></br>
                  {selectedAppointment.monthlyIncome || "Not Available"}
                </p>
                <br></br>
              </section>

              <section className="mb-4">
                <h3>
                  <em>Nature of Legal Assistance Requested</em>
                </h3>
                <p>
                  <strong>Type of Legal Assistance:</strong> <br></br>
                  {selectedAppointment.selectedAssistanceType ||
                    "Not Specified"}
                </p>
                <br></br>
                <p>
                  <strong>Problem:</strong> <br></br>
                  {selectedAppointment.problems || "Not Available"}
                </p>
                <br></br>
                <p>
                  <strong>Reason for Problem:</strong> <br></br>
                  {selectedAppointment.problemReason || "Not Available"}
                </p>
                <br></br>
                <p>
                  <strong>Desired Solutions:</strong>
                  <br></br>{" "}
                  {selectedAppointment.desiredSolutions || "Not Available"}
                </p>
                <br></br>
              </section>

              <section>
                <h3>
                  <em>Uploaded Images</em>
                </h3>
                <div className="mb-3">
                  <p>
                    <strong>Barangay Certificate of Indigency:</strong>
                  </p>
                  {selectedAppointment?.barangayImageUrl ? (
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        openImageModal(selectedAppointment.barangayImageUrl);
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
                </div>
                <div className="mb-3">
                  <p>
                    <strong>DSWD Certificate of Indigency:</strong>
                  </p>
                  {selectedAppointment?.dswdImageUrl ? (
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
                </div>
                <div className="mb-3">
                  <p>
                    <strong>Disqualification Letter from PAO:</strong>
                  </p>
                  {selectedAppointment?.paoImageUrl ? (
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
                </div>
              </section>

              {isModalOpen && (
                <ImageModal
                  isOpen={isModalOpen}
                  url={currentImageUrl}
                  onClose={closeModal}
                />
              )}
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
                  No, the client MAY BE DISQUALIFIED/DENIED, subject to further
                  assessment by the volunteer legal aid lawyer
                </label>
                <br />
                <br />
                {clientEligibility.eligibility === "yes" && (
                  <ReactDatePicker
                    selected={appointmentDate}
                    onChange={(date) => setAppointmentDate(date)}
                    showTimeSelect
                    filterDate={filterDate}
                    filterTime={filterTime}
                    dateFormat="MMMM d, yyyy h:mm aa"
                    inline
                    timeIntervals={15}
                    minTime={new Date(new Date().setHours(13, 0, 0))}
                    maxTime={new Date(new Date().setHours(17, 0, 0))}
                    dayClassName={getDayClassName}
                    timeClassName={getTimeClassName}
                  />
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
                  ></textarea>
                </div>
                <div>
                  <b>
                    <label>IBP Paralegal/Staff: *</label>
                  </b>
                  <input
                    type="text"
                    name="ibpParalegalStaff"
                    placeholder="Enter name here..."
                    value={clientEligibility.ibpParalegalStaff}
                    onChange={handleChange}
                    required
                  />
                  <b>
                    <label>Assisting Counsel: *</label>
                  </b>
                  <input
                    type="text"
                    name="assistingCounsel"
                    placeholder="Enter name here..."
                    value={clientEligibility.assistingCounsel}
                    onChange={handleChange}
                    required
                  />
                </div>
                <button>Submit</button>
              </form>
            </div>
          )}

        {selectedAppointment && showProceedingNotesForm && (
          <div className="client-eligibility">
            <h2>Proceeding Notes</h2>
            <form onSubmit={handleSubmit}>
              <div>
                <b>
                  <label>Proceeding Notes:</label>
                </b>
                <textarea
                  name="proceedingNotes"
                  rows="4"
                  placeholder="Enter proceeding notes here..."
                  value={proceedingNotes}
                  onChange={handleNotesChange}
                ></textarea>
              </div>
              <button>Submit</button>
            </form>
          </div>
        )}

        {selectedAppointment && showRescheduleForm && (
          <div className="client-eligibility">
            <h2>Reschedule Appointment</h2>
            <p>
              <strong>Current Appointment Date:</strong> <br></br>
              {getFormattedDate(selectedAppointment.appointmentDate, true)}
            </p>
            <form onSubmit={handleRescheduleSubmit}>
              <div>
                <ReactDatePicker
                  selected={rescheduleDate}
                  onChange={(date) => setRescheduleDate(date)}
                  showTimeSelect
                  filterDate={filterDate}
                  filterTime={filterTime}
                  dateFormat="MMMM d, yyyy h:mm aa"
                  inline
                  timeIntervals={15}
                  minTime={new Date(new Date().setHours(13, 0, 0))}
                  maxTime={new Date(new Date().setHours(17, 0, 0))}
                  dayClassName={getDayClassName}
                  timeClassName={getTimeClassName}
                />
              </div>
              <div>
                <b>
                  <label>Reason for Reschedule:</label>
                </b>
                <textarea
                  name="rescheduleReason"
                  rows="4"
                  placeholder="Enter reason for reschedule here..."
                  value={rescheduleReason}
                  onChange={handleRescheduleChange}
                ></textarea>
              </div>
              <button>Submit</button>
            </form>
          </div>
        )}

        {showSnackbar && <div className="snackbar">{snackbarMessage}</div>}
      </div>
    </div>
  );
}

const ImageModal = ({ isOpen, url, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <img src={url} alt="Fullscreen Image" className="fullscreen-image" />
        <button onClick={onClose} className="close-button">
          &times;
        </button>
      </div>
    </div>
  );
};

export default Appointments;
