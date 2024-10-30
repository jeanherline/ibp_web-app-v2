import React, { useEffect, useState, useRef } from "react";
import { collection, getDocs, doc, getDoc, query, where } from "firebase/firestore";
import { fs, auth } from "../../Config/Firebase";
import SideNavBar from "../SideNavBar/SideNavBar";
import "./Dashboard.css";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function Dashboard() {
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLawyer, setIsLawyer] = useState(false);
  const [nextAppointment, setNextAppointment] = useState(null);
  const dashboardRef = useRef();
  const [averageRating, setAverageRating] = useState("No Ratings Available");
  const [lawyerAverageRating, setLawyerAverageRating] = useState("No Ratings Available");

  const fetchData = async () => {
    const usersSnapshot = await getDocs(collection(fs, "users"));
    const usersList = usersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  
    const currentUserId = auth.currentUser?.uid;
    const currentUserDoc = await getDoc(doc(fs, "users", currentUserId));
    const currentUserData = currentUserDoc.data();
  
    setCurrentUser(currentUserData);
    setIsLawyer(currentUserData.member_type === "lawyer");
  
    // Set the appointment query based on user type
    let appointmentsQuery = collection(fs, "appointments");
    if (currentUserData.member_type === "lawyer") {
      appointmentsQuery = query(
        appointmentsQuery,
        where("appointmentDetails.assignedLawyer", "==", currentUserId)
      );
    }
  
    // Fetch appointments
    const appointmentsSnapshot = await getDocs(appointmentsQuery);
    const appointmentsList = appointmentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  
    setUsers(usersList);
    setAppointments(appointmentsList);
  
    // Only show next appointment for lawyers
    if (currentUserData.member_type === "lawyer") {
      const upcomingAppointments = appointmentsList
        .filter(
          (app) =>
            app.appointmentDetails?.assignedLawyer === currentUserId &&
            app.appointmentDetails?.appointmentStatus === "scheduled" &&
            app.appointmentDetails?.appointmentDate.toDate() > new Date()
        )
        .sort(
          (a, b) =>
            a.appointmentDetails.appointmentDate.toDate() -
            b.appointmentDetails.appointmentDate.toDate()
        );
  
      if (upcomingAppointments.length > 0) {
        setNextAppointment(upcomingAppointments[0]);
      }
  
      // Calculate average rating of completed appointments for the lawyer
      const lawyerCompletedAppointmentsWithRating = appointmentsList.filter(
        (app) =>
          app.appointmentDetails?.appointmentStatus === "done" &&
          app.appointmentDetails?.assignedLawyer === currentUserId &&
          app.rating !== undefined
      );
  
      const lawyerAverageRatingValue =
        lawyerCompletedAppointmentsWithRating.length > 0
          ? (
              lawyerCompletedAppointmentsWithRating.reduce(
                (sum, app) => sum + app.rating,
                0
              ) / lawyerCompletedAppointmentsWithRating.length
            ).toFixed(2)
          : "No Ratings Available";
  
      setLawyerAverageRating(lawyerAverageRatingValue);
    } else {
      // For admins and heads, calculate the overall average rating
      const completedAppointmentsWithRating = appointmentsList.filter(
        (app) =>
          app.appointmentDetails?.appointmentStatus === "done" &&
          app.rating !== undefined
      );
  
      const overallAverageRating =
        completedAppointmentsWithRating.length > 0
          ? (
              completedAppointmentsWithRating.reduce(
                (sum, app) => sum + app.rating,
                0
              ) / completedAppointmentsWithRating.length
            ).toFixed(2)
          : "No Ratings Available";
  
      setAverageRating(overallAverageRating);
    }
  };
  

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        window.location.href = "/";
      } else {
        fetchData(); // Call fetchData after confirming user authentication
      }
    });
    return () => unsubscribe();
  }, [isLawyer]);

  const cities = [...new Set(users.map((user) => user.city))];

  const avgAppRatingPerCity = cities.reduce((acc, city) => {
    const cityUsers = users.filter(
      (user) => user.city === city && user.appRating !== undefined
    );
    const total = cityUsers.reduce((sum, user) => sum + user.appRating, 0);
    const count = cityUsers.length;
    acc[city] = count ? (total / count).toFixed(2) : 0;
    return acc;
  }, {});

  const avgAptRatingPerCity = cities.reduce((acc, city) => {
    const cityAppointments = appointments.filter((app) => {
      const user = users.find((user) => user.id === app.applicantProfile?.uid);
      return (
        user?.city === city && app.appointmentDetails?.rating !== undefined
      );
    });
    const total = cityAppointments.reduce(
      (sum, app) => sum + app.appointmentDetails.rating,
      0
    );
    const count = cityAppointments.length;
    acc[city] = count ? (total / count).toFixed(2) : 0;
    return acc;
  }, {});

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            let label = context.dataset.label || "";
            const city = context.label;
            if (label) {
              label += ": ";
            }
            if (
              context.dataset.label === "Total Number of Appointments per City"
            ) {
              label += `${context.raw} (Avg Rating: ${avgAptRatingPerCity[city]})`;
            } else if (context.dataset.label === "Total Number of Users") {
              label += `${context.raw} Users`;
            } else if (
              context.dataset.label ===
              "Total Number of Satisfied Users in Appointment Booking"
            ) {
              label += `${context.raw} (Avg Rating: ${avgAptRatingPerCity[city]})`;
            } else {
              label += context.raw;
            }
            return label;
          },
        },
      },
    },
  };

  const usersPerCityData = {
    labels: cities,
    datasets: [
      {
        label: "Total Number of Users",
        data: cities.map(
          (city) => users.filter((user) => user.city === city).length
        ),
        backgroundColor: "rgba(75, 192, 192, 0.6)",
      },
    ],
  };

  const totalAppointmentsPerCityData = {
    labels: cities,
    datasets: [
      {
        label: "Total Number of Appointments per City",
        data: cities.map(
          (city) =>
            appointments.filter(
              (app) =>
                users.find((user) => user.id === app.applicantProfile?.uid)
                  ?.city === city
            ).length
        ),
        backgroundColor: "rgba(255, 99, 132, 0.6)",
      },
    ],
  };

  const satisfiedUsersInBookingPerCityData = {
    labels: cities,
    datasets: [
      {
        label: "Total Number of Satisfied Users in Appointment Booking",
        data: cities.map(
          (city) =>
            appointments.filter(
              (app) =>
                app.appointmentDetails?.rating >= 4 && // Accessing rating directly from appointmentDetails
                users.find((user) => user.id === app.applicantProfile?.uid)
                  ?.city === city
            ).length
        ),
        backgroundColor: "rgba(75, 192, 192, 0.6)",
      },
    ],
  };

  const assignedAptPerCityChartData = {
    labels: cities,
    datasets: [
      {
        label: "Total Number of Assigned Appointments",
        data: cities.map((city) => {
          const cityAppointments = appointments.filter((app) => {
            const user = users.find(
              (user) => user.id === app.applicantProfile?.uid
            );
            return (
              user &&
              user.city === city &&
              app.appointmentDetails?.assignedLawyer === auth.currentUser?.uid
            );
          });
          return cityAppointments.length;
        }),
        backgroundColor: "rgba(153, 102, 255, 0.6)",
      },
    ],
  };
  const downloadDashboardAsPDF = () => {
    const pdf = new jsPDF();
    const currentDate = new Date().toLocaleString();
    let yOffset = 20;
  
    // Title Section
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text("Dashboard Report", 10, yOffset);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    yOffset += 6;
    pdf.text(`Generated on: ${currentDate}`, 10, yOffset);
  
    // Divider
    yOffset += 8;
    pdf.setDrawColor(200, 200, 200); // light grey
    pdf.line(10, yOffset, 200, yOffset);
    yOffset += 10;
  
    // Report Content
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
  
    if (!isLawyer) {
      // Overall Summary for Admins
      pdf.text("Overall Appointments Summary", 10, yOffset);
      yOffset += 10;
      pdf.setFont("helvetica", "normal");
      pdf.text(`• Total Appointments: ${appointments.length}`, 15, yOffset);
      yOffset += 8;
      pdf.text(
        `• Pending Appointments: ${
          appointments.filter(
            (app) => app.appointmentDetails?.appointmentStatus === "pending"
          ).length
        }`,
        15,
        yOffset
      );
      yOffset += 8;
      pdf.text(
        `• Approved Appointments: ${
          appointments.filter(
            (app) => app.appointmentDetails?.appointmentStatus === "scheduled"
          ).length
        }`,
        15,
        yOffset
      );
      yOffset += 8;
      pdf.text(
        `• Successful Appointments: ${
          appointments.filter(
            (app) => app.appointmentDetails?.appointmentStatus === "done"
          ).length
        }`,
        15,
        yOffset
      );
      yOffset += 8;
      pdf.text(
        `• Denied Appointments: ${
          appointments.filter(
            (app) => app.appointmentDetails?.appointmentStatus === "denied"
          ).length
        }`,
        15,
        yOffset
      );
      yOffset += 8;
      pdf.text(
        `• Average Appointment Rating: ${averageRating} / 5`,
        15,
        yOffset
      ); // Added line for average rating
  
      // User Summary Section
      yOffset += 12;
      pdf.setFont("helvetica", "bold");
      pdf.text("User Summary", 10, yOffset);
      pdf.setFont("helvetica", "normal");
      yOffset += 10;
      pdf.text(
        `• Active Users: ${
          users.filter((user) => user.user_status === "active").length
        }`,
        15,
        yOffset
      );
      yOffset += 8;
      pdf.text(
        `• Inactive Users: ${
          users.filter((user) => user.user_status === "inactive").length
        }`,
        15,
        yOffset
      );
    } else {
      // Lawyer-Specific Summary
      pdf.text("Lawyer-specific Appointment Summary", 10, yOffset);
      yOffset += 10;
      pdf.setFont("helvetica", "normal");
      const currentUserId = auth.currentUser?.uid;
      const lawyerAppointments = appointments.filter(
        (app) => app.appointmentDetails?.assignedLawyer === currentUserId
      );
  
      pdf.text(
        `• Your Total Appointments: ${lawyerAppointments.length}`,
        15,
        yOffset
      );
      yOffset += 8;
      pdf.text(
        `• Approved Appointments: ${
          lawyerAppointments.filter(
            (app) => app.appointmentDetails?.appointmentStatus === "scheduled"
          ).length
        }`,
        15,
        yOffset
      );
      yOffset += 8;
      pdf.text(
        `• Successful Appointments: ${
          lawyerAppointments.filter(
            (app) => app.appointmentDetails?.appointmentStatus === "done"
          ).length
        }`,
        15,
        yOffset
      );
      yOffset += 8;
      pdf.text(
        `• Your Average Appointment Rating: ${lawyerAverageRating} / 5`,
        15,
        yOffset
      ); // Added line for lawyer's average rating
  
      // Next Appointment Details
      if (nextAppointment) {
        yOffset += 12;
        pdf.setFont("helvetica", "bold");
        pdf.text("Next Upcoming Appointment", 10, yOffset);
        pdf.setFont("helvetica", "normal");
        yOffset += 10;
        pdf.text(
          `• Date: ${nextAppointment.appointmentDetails.appointmentDate
            .toDate()
            .toLocaleString()}`,
          15,
          yOffset
        );
        yOffset += 8;
        pdf.text(
          `• Client: ${nextAppointment.applicantProfile.fullName}`,
          15,
          yOffset
        );
      }
    }
  
    // Footer Section
    yOffset += 20;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(10, yOffset, 200, yOffset);
    yOffset += 10;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "italic");
    pdf.text("End of Report", 10, yOffset);
  
    pdf.save("dashboard_report.pdf");
  };
  

  return (
    <div className="dashboard-container" ref={dashboardRef}>
      <SideNavBar />
      <div className="main-content">
        <br />
        <h3>Dashboard</h3>
        <div className="download-container">
          <button onClick={downloadDashboardAsPDF} className="download-button">
            Download Dashboard Report
          </button>
        </div>
        <br />
        <center>
          <div className="stats-container">
            {!isLawyer && (
              <>
                <div className="stat-card">
                  <h2>Total Appointments</h2>
                  <p>{appointments.length}</p>
                </div>
                <div className="stat-card">
                  <h2>Pending Appointments</h2>
                  <p>
                    {
                      appointments.filter(
                        (app) =>
                          app.appointmentDetails?.appointmentStatus ===
                          "pending"
                      ).length
                    }
                  </p>
                </div>
                <div className="stat-card">
                  <h2>Approved Appointments</h2>
                  <p>
                    {
                      appointments.filter(
                        (app) =>
                          app.appointmentDetails?.appointmentStatus ===
                          "scheduled"
                      ).length
                    }
                  </p>
                </div>
                <div className="stat-card">
                  <h2>Successful Appointments</h2>
                  <p>
                    {
                      appointments.filter(
                        (app) =>
                          app.appointmentDetails?.appointmentStatus === "done"
                      ).length
                    }
                  </p>
                </div>
                <div className="stat-card">
                  <h2>Denied Appointments</h2>
                  <p>
                    {
                      appointments.filter(
                        (app) =>
                          app.appointmentDetails?.appointmentStatus === "denied"
                      ).length
                    }
                  </p>
                </div>
                <div className="stat-card">
                  <h2>Active App Users</h2>
                  <p>
                    {
                      users.filter((user) => user.user_status === "active")
                        .length
                    }
                  </p>
                </div>
                <div className="stat-card">
                  <h2>Inactive App Users</h2>
                  <p>
                    {
                      users.filter((user) => user.user_status === "inactive")
                        .length
                    }
                  </p>
                </div>
                <div className="stat-card">
                  <h2>Average Appointment Rating</h2>
                  <p>{averageRating} / 5</p>
                </div>
              </>
            )}
            {isLawyer && (
              <>
                <div className="stat-card">
                  <h2>Your Average Appointment Rating</h2>
                  <p>{lawyerAverageRating} / 5</p>
                </div>
                <div className="stat-card">
                  <h2>Your Total Appointments</h2>
                  <p>
                    {
                      appointments.filter(
                        (app) =>
                          app.appointmentDetails?.assignedLawyer ===
                          auth.currentUser?.uid
                      ).length
                    }
                  </p>
                </div>
                <div className="stat-card">
                  <h2>Your Approved Appointments</h2>
                  <p>
                    {
                      appointments.filter(
                        (app) =>
                          app.appointmentDetails?.appointmentStatus ===
                            "scheduled" &&
                          app.appointmentDetails?.assignedLawyer ===
                            auth.currentUser?.uid
                      ).length
                    }
                  </p>
                </div>
                <div className="stat-card">
                  <h2>Your Successful Appointments</h2>
                  <p>
                    {
                      appointments.filter(
                        (app) =>
                          app.appointmentDetails?.appointmentStatus ===
                            "done" &&
                          app.appointmentDetails?.assignedLawyer ===
                            auth.currentUser?.uid
                      ).length
                    }
                  </p>
                </div>
                {nextAppointment && (
                  <div className="next-appointment-card">
                    <h2>Next Upcoming Appointment</h2>
                    <p>
                      {nextAppointment.appointmentDetails.appointmentDate
                        .toDate()
                        .toLocaleString()}
                    </p>
                    <p>{nextAppointment.applicantProfile.fullName}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </center>
        <div className="charts-wrapper">
          {!isLawyer && (
            <>
              <div className="chart-container">
                <Bar
                  data={usersPerCityData}
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      title: {
                        ...chartOptions.plugins.title,
                        text: "Total Number of Users per City",
                      },
                    },
                  }}
                />
              </div>
              <div className="chart-container">
                <Bar
                  data={totalAppointmentsPerCityData}
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      title: {
                        ...chartOptions.plugins.title,
                        text: "Total Number of Appointments per City",
                      },
                    },
                  }}
                />
              </div>
            </>
          )}
          {isLawyer && (
            <>
              <div className="chart-container">
                <Bar
                  data={assignedAptPerCityChartData}
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      title: {
                        ...chartOptions.plugins.title,
                        text: "Total Assigned Appointments per City",
                      },
                    },
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
