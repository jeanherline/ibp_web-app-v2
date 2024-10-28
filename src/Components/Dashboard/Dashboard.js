import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { fs, auth, query, where } from "../../Config/Firebase";
import SideNavBar from "../SideNavBar/SideNavBar";
import "./Dashboard.css";
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
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function Dashboard() {
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLawyer, setIsLawyer] = useState(false);
  const [nextAppointment, setNextAppointment] = useState(null);
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
    const fetchData = async () => {
      const usersSnapshot = await getDocs(collection(fs, "users"));
      const usersList = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const currentUserId = auth.currentUser?.uid;

      let appointmentsQuery = collection(fs, "appointments");
      if (isLawyer) {
        appointmentsQuery = query(
          appointmentsQuery,
          where("appointmentDetails.assignedLawyer", "==", currentUserId)
        );
      }
      const appointmentsSnapshot = await getDocs(appointmentsQuery);
      const appointmentsList = appointmentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setUsers(usersList);
      setAppointments(appointmentsList);

      // Find the next upcoming appointment
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
    };

    const fetchCurrentUser = async () => {
      if (auth.currentUser) {
        const userDoc = await getDoc(doc(fs, "users", auth.currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setCurrentUser(userData);
          setIsLawyer(userData.member_type === "lawyer");
        }
      }
    };

    fetchCurrentUser();
    fetchData();
  }, [isLawyer]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        window.location.href = "/";
      } else {
        console.log("Current user:", user);
      }
    });

    return () => unsubscribe();
  }, []);

  // Calculate average ratings for each city
  const calculateAverageRatingPerCity = (data, city, ratingField) => {
    const cityData = data.filter(
      (item) => item.city === city && item[ratingField] !== undefined
    );
    const total = cityData.reduce((sum, item) => sum + item[ratingField], 0);
    const count = cityData.length;
    return count ? (total / count).toFixed(2) : 0;
  };

  const cities = [...new Set(users.map((user) => user.city))];

  const avgAppRatingPerCity = cities.reduce((acc, city) => {
    acc[city] = calculateAverageRatingPerCity(users, city, "appRating");
    return acc;
  }, {});

  const avgAptRatingPerCity = cities.reduce((acc, city) => {
    const cityAppointments = appointments.filter((app) => {
      const user = users.find((user) => user.id === app.applicantProfile?.uid);
      return (
        user &&
        user.city === city &&
        app.appointmentDetails?.aptRating !== undefined
      );
    });
    const total = cityAppointments.reduce(
      (sum, app) => sum + app.appointmentDetails.aptRating,
      0
    );
    const count = cityAppointments.length;
    acc[city] = count ? (total / count).toFixed(2) : 0;
    return acc;
  }, {});

  // Calculate assigned appointments per city for the current lawyer
  const assignedAptPerCityData = cities.reduce((acc, city) => {
    const cityAppointments = appointments.filter((app) => {
      const user = users.find((user) => user.id === app.applicantProfile?.uid);
      return (
        user &&
        user.city === city &&
        app.appointmentDetails?.assignedLawyer === auth.currentUser?.uid
      );
    });
    acc[city] = cityAppointments.length;
    return acc;
  }, {});

  const assignedAptPerCityChartData = {
    labels: cities,
    datasets: [
      {
        label: "Total Number of Assigned Appointments",
        data: cities.map((city) => assignedAptPerCityData[city]),
        backgroundColor: "rgba(153, 102, 255, 0.6)",
      },
    ],
  };

  // Process the data to fit into the charts
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

  const satisfiedAppUsersPerCityData = {
    labels: cities,
    datasets: [
      {
        label: "Total Number of Satisfied App Users",
        data: cities.map(
          (city) =>
            users.filter((user) => user.city === city && user.appRating >= 4)
              .length
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
                app.appointmentDetails?.aptRating >= 4 &&
                users.find((user) => user.id === app.applicantProfile?.uid)
                  ?.city === city
            ).length
        ),
        backgroundColor: "rgba(75, 192, 192, 0.6)",
      },
    ],
  };

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
              context.dataset.label === "Total Number of Satisfied App Users"
            ) {
              label += `${context.raw} (Avg Rating: ${avgAppRatingPerCity[city]})`;
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

  return (
    <div className="dashboard-container">
      <SideNavBar />
      <div className="main-content">
        <br />
        <h3>Dashboard</h3>
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
              </>
            )}
            {isLawyer && (
              <>
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
        {!isLawyer && (
          <>
            <div className="chart-container">
              <br />
              <Bar
                data={usersPerCityData}
                options={{
                  ...chartOptions,
                  title: {
                    ...chartOptions.title,
                    text: "Total Number of Users per City in Bulacan",
                  },
                }}
              />
            </div>
            <div className="chart-container">
              <br />
              <Bar
                data={satisfiedAppUsersPerCityData}
                options={{
                  ...chartOptions,
                  title: {
                    ...chartOptions.title,
                    text: "Average Ratings of App Users per City",
                  },
                }}
              />
            </div>
            <div className="chart-container">
              <br />
              <Bar
                data={satisfiedUsersInBookingPerCityData}
                options={{
                  ...chartOptions,
                  title: {
                    ...chartOptions.title,
                    text: "Average Ratings of App Users in Appointment Booking per City",
                  },
                }}
              />
            </div>
          </>
        )}
        {isLawyer && (
          <>
            <div className="chart-container">
              <br />
              <Bar
                data={assignedAptPerCityChartData}
                options={{
                  ...chartOptions,
                  title: {
                    ...chartOptions.title,
                    text: "Total Number of Assigned Appointments per City in Bulacan",
                  },
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
