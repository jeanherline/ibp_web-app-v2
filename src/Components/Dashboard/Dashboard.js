import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  limit, // ✅ Add this
} from "firebase/firestore";
import { fs, auth } from "../../Config/Firebase";
import SideNavBar from "../SideNavBar/SideNavBar";
import "./Dashboard.css";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Bar, Line } from "react-chartjs-2";
import {
  FaCalendarCheck,
  FaUserCheck,
  FaUserTimes,
  FaStar,
  FaClock,
  FaCalendarAlt,
  FaUsers,
  FaTimesCircle,
} from "react-icons/fa";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
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
  const dashboardRef = useRef();
  const [averageRating, setAverageRating] = useState("0");
  const [lawyerAverageRating, setLawyerAverageRating] = useState("0");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showAllCharts, setShowAllCharts] = useState(false);
  const [selectedRange, setSelectedRange] = useState("month");

  const exportDashboardAsExcel = () => {
    const wb = XLSX.utils.book_new();
    const isAdmin = !isLawyer;

    // Summary Sheet
    const summaryData = [
      ["Metric", "Value"],
      ...(isAdmin
        ? [
          ["Total Appointments", appointments.length],
          ["Pending Appointments", appointments.filter(app => app.appointmentDetails?.appointmentStatus === "pending").length],
          ["Approved Appointments", appointments.filter(app => app.appointmentDetails?.appointmentStatus === "scheduled").length],
          ["Successful Appointments", appointments.filter(app => app.appointmentDetails?.appointmentStatus === "done").length],
          ["Denied Appointments", appointments.filter(app => app.appointmentDetails?.appointmentStatus === "denied").length],
          ["Average Appointment Rating", averageRating],
          ["Active Users", users.filter(user => user.user_status === "active").length],
          ["Inactive Users", users.filter(user => user.user_status === "inactive").length]
        ]
        : (() => {
          const currentUserId = auth.currentUser?.uid;
          const lawyerAppointments = appointments.filter(app => app.appointmentDetails?.assignedLawyer === currentUserId);
          const nextApp = nextAppointment;
          return [
            ["Your Total Appointments", lawyerAppointments.length],
            ["Your Approved Appointments", lawyerAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "scheduled").length],
            ["Your Successful Appointments", lawyerAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "done").length],
            ["Your Average Appointment Rating", lawyerAverageRating],
            ...(nextApp ? [
              ["Next Appointment Date", nextApp.appointmentDetails.appointmentDate.toDate().toLocaleString()],
              ["Next Appointment Client", (() => {
                const user = users.find(u => u.uid === nextApp.uid);
                return user ? `${user.display_name} ${user.middle_name} ${user.last_name}` : "Unknown";
              })()]
            ] : [])
          ];
        })())
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

    // Graph Data Sheets
    const timeRanges = ["day", "month", "quarter", "year"];
    timeRanges.forEach(range => {
      const grouped = groupDataByTimeRange(appointments, (app) => app.appointmentDetails?.createdDate, range);
      const sheetData = [["Time", "Total", "Done", "Denied", "Canceled", "Average Rating"]];
      Object.keys(grouped).forEach(label => {
        const apps = grouped[label];
        const total = apps.length;
        const done = apps.filter(app => app.appointmentDetails?.appointmentStatus === "done").length;
        const denied = apps.filter(app => app.appointmentDetails?.appointmentStatus === "denied").length;
        const canceled = apps.filter(app => app.appointmentDetails?.appointmentStatus === "canceled").length;
        const rated = apps.filter(app => app.rating !== undefined);
        const ratingAvg = rated.length > 0 ? (rated.reduce((sum, app) => sum + app.rating, 0) / rated.length).toFixed(2) : 0;

        sheetData.push([label, total, done, denied, canceled, ratingAvg]);
      });
      const sheet = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, sheet, `Stats_${range}`);
    });

    // Save File
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), "Dashboard_Report.xlsx");
  };


  const groupDataByRange = (items, getDate, range) => {
    const grouped = {};
    for (const item of items) {
      const date = getDate(item)?.toDate?.() || new Date(getDate(item));
      let key = "";

      switch (range) {
        case "day":
          key = date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
          break;
        case "month":
          key = `${date.toLocaleString("en-PH", { month: "short" })} ${date.getFullYear()}`;
          break;
        case "quarter":
          key = `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
          break;
        case "year":
          key = `${date.getFullYear()}`;
          break;
        default:
          key = date.toDateString();
      }

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    }

    return grouped;
  };

  const groupDataByTimeRange = (items, getDate, range) => {
    const formatMap = {
      day: { options: { month: "short", day: "numeric" }, key: (d) => d.toDateString() },
      month: { options: { month: "short", year: "numeric" }, key: (d) => `${d.getFullYear()}-${d.getMonth()}` },
      quarter: {
        options: {},
        key: (d) => `Q${Math.floor(d.getMonth() / 3) + 1}-${d.getFullYear()}`
      },
      year: { options: { year: "numeric" }, key: (d) => d.getFullYear().toString() },
    };

    const grouped = {};
    for (const item of items) {
      const rawDate = getDate(item)?.toDate?.() || new Date(getDate(item));
      const key = formatMap[range].key(rawDate);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    }
    return grouped;
  };

  const getRelativeTime = (timestamp) => {
    if (!timestamp) return "Unknown";
    const now = new Date();
    const loginTime = timestamp.toDate
      ? timestamp.toDate()
      : new Date(timestamp);
    const diffMs = now - loginTime;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute(s) ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour(s) ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day(s) ago`;
  };

  const fetchData = async () => {
    setLoadingUsers(true);

    // Fetch users and their latest login
    const usersSnapshot = await getDocs(collection(fs, "users"));
    const usersListRaw = await Promise.all(
      usersSnapshot.docs.map(async (doc) => {
        const userData = doc.data();
        if (userData.member_type === "client") return null;

        try {
          const loginActivityRef = collection(
            fs,
            "users",
            doc.id,
            "loginActivity"
          );
          const loginQuery = query(
            loginActivityRef,
            orderBy("loginTime", "desc"),
            limit(1)
          );
          const loginSnapshot = await getDocs(loginQuery);
          const lastLoginDoc = loginSnapshot.docs[0];

          return {
            id: doc.id,
            ...userData,
            last_login: lastLoginDoc?.data()?.loginTime || null,
          };
        } catch (err) {
          console.error("Error fetching loginActivity:", err);
          return {
            id: doc.id,
            ...userData,
            last_login: null,
          };
        }
      })
    );

    // Remove nulls (clients)
    const usersList = usersListRaw.filter(Boolean);

    // Fetch audit logs to determine online status
    const auditSnapshot = await getDocs(
      query(
        collection(fs, "audit_logs"),
        orderBy("timestamp", "desc"),
        limit(300)
      )
    );

    const auditLogs = auditSnapshot.docs.map((doc) => doc.data());

    const userStatusMap = {};
    for (const log of auditLogs) {
      const uid = log.uid || log.affectedData?.userId;
      const lastAction = log.changes?.action;
      const lastStatus = log.changes?.status;

      if (!uid || userStatusMap[uid]) continue;

      // Mark user as online if last action is Login and it was successful
      userStatusMap[uid] = (lastAction === "Login" && lastStatus === "Success") ? "Online" : "Offline";
    }

    const updatedUsers = usersList.map((user) => ({
      ...user,
      isOnline: userStatusMap[user.uid] === "Online",
    }));


    setUsers(updatedUsers);
    setLoadingUsers(false);

    // Fetch current user
    const currentUserId = auth.currentUser?.uid;
    const currentUserDoc = await getDoc(doc(fs, "users", currentUserId));
    const currentUserData = currentUserDoc.data();

    setCurrentUser(currentUserData);
    setIsLawyer(currentUserData.member_type === "lawyer");

    // Fetch appointments
    let appointmentsQuery = collection(fs, "appointments");
    if (currentUserData.member_type === "lawyer") {
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

    setAppointments(appointmentsList);

    // For lawyer: get next appointment and average rating
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
          : "0";

      setLawyerAverageRating(lawyerAverageRatingValue);
    } else {
      // For admin/head: get overall average rating
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
          : "0";

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
  // Generate weekly ranges for the last 8 weeks
  const getWeekLabel = (date) => {
    const d = new Date(date);
    const weekStart = new Date(d.setDate(d.getDate() - d.getDay() + 1));
    return `${weekStart.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
    })}`;
  };

  const generateWeeklyStats = (items, getDate, label) => {
    const stats = {};
    for (let i = 7; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const weekLabel = getWeekLabel(start);

      const weekItems = items.filter((item) => {
        const date = getDate(item)?.toDate?.() || new Date(getDate(item));
        return date >= start && date <= end;
      });

      stats[weekLabel] = weekItems;
    }

    return stats;
  };

  const groupedAppointments = groupDataByTimeRange(
    appointments,
    (app) => app.appointmentDetails?.createdDate,
    selectedRange
  );

  const groupedUsers = groupDataByTimeRange(
    users,
    (user) => user.created_time,
    selectedRange
  );


  const weeklyAppointmentsData = {
    labels: Object.keys(groupedAppointments),
    datasets: [
      {
        label: "Total Appointments",
        data: Object.values(groupedAppointments).map((apps) => apps.length),
        borderColor: "#580049",
        backgroundColor: "rgba(167, 58, 148, 0.1)",
        fill: true,
        tension: 0.3,
      },
    ],
  };
  const weeklyRescheduledAppointmentsData = {
    labels: Object.keys(groupedAppointments),
    datasets: [
      {
        label: "Rescheduled Appointments",
        data: Object.values(groupedAppointments).map(
          (apps) => apps.filter((app) => !!app.rescheduleHistory?.rescheduleDate).length
        ),

        borderColor: "#795548",
        backgroundColor: "rgba(121, 85, 72, 0.1)",
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const weeklyAppointmentTypeData = {
    labels: Object.keys(groupedAppointments),
    datasets: [
      {
        label: "Via App",
        data: Object.values(groupedAppointments).map(
          (apps) =>
            apps.filter((app) => app.appointmentType === "Via App").length
        ),
        borderColor: "#3f51b5",
        backgroundColor: "rgba(63, 81, 181, 0.1)",
        fill: true,
        tension: 0.3,
      },
      {
        label: "Walk-in",
        data: Object.values(groupedAppointments).map(
          (apps) =>
            apps.filter((app) => app.appointmentType === "Walk-in").length
        ),
        borderColor: "#ff5722",
        backgroundColor: "rgba(255, 87, 34, 0.1)",
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const weeklyScheduleTypeData = {
    labels: Object.keys(groupedAppointments),
    datasets: [
      {
        label: "Online",
        data: Object.values(groupedAppointments).map(
          (apps) => apps.filter((app) => app.scheduleType === "Online").length
        ),
        borderColor: "#00bcd4",
        backgroundColor: "rgba(0, 188, 212, 0.1)",
        fill: true,
        tension: 0.3,
      },
      {
        label: "In-Person",
        data: Object.values(groupedAppointments).map(
          (apps) =>
            apps.filter((app) => app.scheduleType === "In-Person").length
        ),
        borderColor: "#8bc34a",
        backgroundColor: "rgba(139, 195, 74, 0.1)",
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const weeklyUsersData = {
    labels: Object.keys(groupedUsers),
    datasets: [
      {
        label: `New Users (${selectedRange})`,
        data: Object.values(groupedUsers).map((users) => users.length),

        borderColor: "#4caf50",
        backgroundColor: "rgba(76, 175, 80, 0.1)",
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const weeklyRatingsData = {
    labels: Object.keys(groupedAppointments),
    datasets: [
      {
        label: "Rating",
        data: Object.values(groupedAppointments).map((apps) => {
          const rated = apps.filter((app) => app.rating !== undefined);
          const total = rated.reduce((sum, app) => sum + app.rating, 0);
          return rated.length ? (total / rated.length).toFixed(2) : 0;
        }),
        borderColor: "#ff9800",
        backgroundColor: "rgba(255, 152, 0, 0.1)",
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const weeklyDoneVsDeniedData = {
    labels: Object.keys(groupedAppointments),
    datasets: [
      {
        label: "Done",
        data: Object.values(groupedAppointments).map(
          (apps) =>
            apps.filter(
              (app) => app.appointmentDetails?.appointmentStatus === "done"
            ).length
        ),
        borderColor: "#4caf50",
        backgroundColor: "rgba(76, 175, 80, 0.1)",
        tension: 0.3,
        fill: true,
      },
      {
        label: "Denied",
        data: Object.values(groupedAppointments).map(
          (apps) =>
            apps.filter(
              (app) => app.appointmentDetails?.appointmentStatus === "denied"
            ).length
        ),
        borderColor: "#f44336",
        backgroundColor: "rgba(244, 67, 54, 0.1)",
        tension: 0.3,
        fill: true,
      },
    ],
  };
  const weeklyCanceledData = {
    labels: Object.keys(groupedAppointments),
    datasets: [
      {
        label: "Canceled Appointments",
        data: Object.values(groupedAppointments).map(
          (apps) =>
            apps.filter(
              (app) => app.appointmentDetails?.appointmentStatus === "canceled"
            ).length
        ),
        borderColor: "#ff5722",
        backgroundColor: "rgba(255, 87, 34, 0.1)",
        fill: true,
        tension: 0.3,
      },
    ],
  };
  const weeklyPendingAppointmentsData = {
    labels: Object.keys(groupedAppointments),
    datasets: [
      {
        label: "Pending Appointments",
        data: Object.values(groupedAppointments).map(
          (apps) => apps.filter((app) => app.appointmentDetails?.appointmentStatus === "pending").length
        ),
        borderColor: "#2196f3",
        backgroundColor: "rgba(33, 150, 243, 0.1)",
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const weeklyApptTypesData = {
    labels: Object.keys(groupedAppointments),
    datasets: [
      {
        label: "Online",
        data: Object.values(groupedAppointments).map(
          (apps) =>
            apps.filter((app) => app.appointmentDetails?.apptType === "Online")
              .length
        ),
        borderColor: "#03a9f4",
        backgroundColor: "rgba(3, 169, 244, 0.1)",
        fill: true,
        tension: 0.3,
      },
      {
        label: "Walk-in",
        data: Object.values(groupedAppointments).map(
          (apps) =>
            apps.filter((app) => app.appointmentDetails?.apptType === "Walk-in")
              .length
        ),
        borderColor: "#9c27b0",
        backgroundColor: "rgba(156, 39, 176, 0.1)",
        fill: true,
        tension: 0.3,
      },
    ],
  };

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
      const user = users.find((user) => user.uid === app.uid);
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
              (app) => users.find((user) => user.uid === app.uid)?.city === city
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
                users.find((user) => user.uid === app.uid)?.city === city
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
        `• Pending Appointments: ${appointments.filter(
          (app) => app.appointmentDetails?.appointmentStatus === "pending"
        ).length
        }`,
        15,
        yOffset
      );
      yOffset += 8;
      pdf.text(
        `• Approved Appointments: ${appointments.filter(
          (app) => app.appointmentDetails?.appointmentStatus === "scheduled"
        ).length
        }`,
        15,
        yOffset
      );
      yOffset += 8;
      pdf.text(
        `• Successful Appointments: ${appointments.filter(
          (app) => app.appointmentDetails?.appointmentStatus === "done"
        ).length
        }`,
        15,
        yOffset
      );
      yOffset += 8;
      pdf.text(
        `• Denied Appointments: ${appointments.filter(
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
        `• Active Users: ${users.filter((user) => user.user_status === "active").length
        }`,
        15,
        yOffset
      );
      yOffset += 8;
      pdf.text(
        `• Inactive Users: ${users.filter((user) => user.user_status === "inactive").length
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
        `• Approved Appointments: ${lawyerAppointments.filter(
          (app) => app.appointmentDetails?.appointmentStatus === "scheduled"
        ).length
        }`,
        15,
        yOffset
      );
      yOffset += 8;
      pdf.text(
        `• Successful Appointments: ${lawyerAppointments.filter(
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
          `• Client: ${(() => {
            const user = users.find((user) => user.uid === nextAppointment.uid);
            return user
              ? `${user.display_name} ${user.middle_name} ${user.last_name}`
              : "Unknown";
          })()}`,
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
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px", minHeight: "60px" }}>
          <h3 style={{ position: "absolute", left: 0, margin: 0 }}>Dashboard</h3>
          <img
            src="https://firebasestorage.googleapis.com/v0/b/lawyer-app-ed056.appspot.com/o/signin-logo-removebg-preview%20(1).png?alt=media&token=f8376063-65cb-4a70-b2a7-a59dccd71c7e"
            alt="Dashboard Logo"
            style={{ maxWidth: "500px", height: "auto" }}
          />
        </div>
        <div className="download-container">
          <button onClick={exportDashboardAsExcel} className="download-button">
            Download Report
          </button>
        </div>
        <br />
        <center>
          <div className="stats-container">
            {!isLawyer && (
              <>
                <div className="stat-card">
                  <FaCalendarAlt className="stat-icon" />
                  <h2>Total Appointments</h2>
                  <p>{appointments.length}</p>
                </div>
                <div className="stat-card">
                  <FaClock className="stat-icon" />
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
                  <FaCalendarCheck className="stat-icon" />
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
                  <FaUserCheck className="stat-icon" />
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
                  <FaTimesCircle className="stat-icon" />
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
                  <FaUsers className="stat-icon" />
                  <h2>Active App Users</h2>
                  <p>
                    {
                      users.filter((user) => user.user_status === "active")
                        .length
                    }
                  </p>
                </div>
                <div className="stat-card">
                  <FaUserTimes className="stat-icon" />
                  <h2>Inactive App Users</h2>
                  <p>
                    {
                      users.filter((user) => user.user_status === "inactive")
                        .length
                    }
                  </p>
                </div>
                <div className="stat-card">
                  <FaStar className="stat-icon" />
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
                    <p>
                      {(() => {
                        const user = users.find(
                          (user) => user.uid === nextAppointment.uid
                        );
                        return user
                          ? `${user.display_name} ${user.middle_name} ${user.last_name}`
                          : "Unknown";
                      })()}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </center>
        {/* Toggle Button */}
        <div className="toggle-charts-wrapper">
          <button
            onClick={() => setShowAllCharts(!showAllCharts)}
            className="toggle-charts-button"
          >
            {showAllCharts ? "▲ Hide More Charts" : "▼ Show More Charts"}
          </button>

          <select
            value={selectedRange}
            onChange={(e) => setSelectedRange(e.target.value)}
            style={{ marginLeft: "1rem", padding: "5px", borderRadius: "6px" }}
          >
            <option value="day">Day</option>
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
            <option value="year">Year</option>
          </select>
        </div>

        <div className="charts-wrapper">
          {/* Always show top priority charts */}
          <div className="chart-container">
            <Line
              data={weeklyAppointmentTypeData}
              options={{
                ...chartOptions,
                plugins: {
                  ...chartOptions.plugins,
                  title: {
                    display: true,
                    text: `Appointment Type: Via App vs Walk-in (${selectedRange})`,
                  },
                },
              }}
            />
          </div>

          <div className="chart-container">
            <Line
              data={weeklyScheduleTypeData}
              options={{
                ...chartOptions,
                plugins: {
                  ...chartOptions.plugins,
                  title: {
                    display: true,
                    text: `Schedule Type: Online vs In-Person (${selectedRange})`,
                  },
                },
              }}
            />
          </div>

          {showAllCharts && (
            <>
              <div className="chart-container">
                <Line
                  data={weeklyRescheduledAppointmentsData}
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      title: {
                        display: true,
                        text: `Rescheduled Appointments (${selectedRange})`,
                      },
                    },
                  }}
                />
              </div>
              <div className="chart-container">
                <Line
                  data={weeklyAppointmentsData}
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      title: { display: true, text: `Appointments (${selectedRange})` },
                    },
                  }}
                />
              </div>

              <div className="chart-container">
                <Line
                  data={weeklyUsersData}
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      title: { display: true, text: `New Users (${selectedRange})` },
                    },
                  }}
                />
              </div>
              <div className="chart-container">
                <Line
                  data={weeklyRatingsData}
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      title: {
                        display: true,
                        text: `Average Ratings (${selectedRange})`,
                      },
                    },
                  }}
                />
              </div>

              <div className="chart-container">
                <Line
                  data={weeklyDoneVsDeniedData}
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      title: {
                        display: true,
                        text: `Done vs Denied Appointments (${selectedRange})`,
                      },
                    },
                  }}
                />
              </div>
              <div className="chart-container">
                <Line
                  data={weeklyCanceledData}
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      title: {
                        display: true,
                        text: `Canceled Appointments (${selectedRange})`,
                      },
                    },
                  }}
                />
              </div>
              <div className="chart-container">
                <Line
                  data={weeklyPendingAppointmentsData}
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      title: {
                        display: true,
                        text: `Pending Appointments (${selectedRange})`,
                      },
                    },
                  }}
                />
              </div>

              {!isLawyer && (
                <>
                  <div className="chart-container">
                    <Line
                      data={totalAppointmentsPerCityData}
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          title: {
                            display: true,
                            text: "Total Appointments per City",
                          },
                        },
                      }}
                    />
                  </div>

                  <div className="chart-container">
                    <Line
                      data={usersPerCityData}
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          title: {
                            display: true,
                            text: "Total Users per City",
                          },
                        },
                      }}
                    />
                  </div>

                  <div className="chart-container">
                    <Line
                      data={satisfiedUsersInBookingPerCityData}
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          title: {
                            display: true,
                            text: "Satisfied Users in Appointment Booking (Rating ≥ 4)",
                          },
                        },
                      }}
                    />
                  </div>
                </>
              )}

              {isLawyer && (
                <div className="chart-container">
                  <Line
                    data={assignedAptPerCityChartData}
                    options={{
                      ...chartOptions,
                      plugins: {
                        ...chartOptions.plugins,
                        title: {
                          display: true,
                          text: "Total Assigned Appointments per City",
                        },
                      },
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>

      </div>
      <div className="right-panel">
        <div className="online-users">
          <h4>Active Members</h4>

          {loadingUsers ? (
            <div className="loading-spinner">
              <div className="spinner" />
              <p>Loading users...</p>
            </div>
          ) : (
            ["admin", "lawyer", "frontdesk"].map((roleKey) => {
              const roleUsers = users
                .filter(
                  (user) =>
                    user.member_type === roleKey &&
                    user.member_status !== "inactive" &&
                    user.uid !== auth.currentUser?.uid
                )

                .sort((a, b) => {
                  const nameA =
                    `${a.display_name} ${a.last_name}`.toLowerCase();
                  const nameB =
                    `${b.display_name} ${b.last_name}`.toLowerCase();
                  return nameA.localeCompare(nameB);
                });

              if (roleUsers.length === 0) return null;

              return (
                <div key={roleKey} className="role-group">
                  <div className="role-header">
                    <span>{roleKey.toUpperCase()}</span>
                    <span className="role-count">{roleUsers.length}</span>
                  </div>

                  {roleUsers.map((user) => {
                    const isOnline = user.isOnline;
                    const fullName = `${user.display_name || ""} ${user.last_name || ""
                      }`;
                    const defaultImg =
                      "https://firebasestorage.googleapis.com/v0/b/lawyer-app-ed056.appspot.com/o/DefaultUserImage.jpg?alt=media&token=3ba45526-99d8-4d30-9cb5-505a5e23eda1";

                    return (
                      <div key={user.uid} className="user-card">
                        <div className="user-card-header">
                          <div className="user-avatar-wrapper">
                            <img
                              src={
                                user.photo_url?.trim()
                                  ? user.photo_url
                                  : defaultImg
                              }
                              alt={fullName}
                              className="user-avatar"
                            />
                            <span
                              className="status-indicator"
                              style={{
                                backgroundColor: isOnline ? "#4caf50" : "#9e9e9e",
                              }}
                            />

                          </div>
                          <div className="user-info">
                            <div className="user-fullname">{fullName}</div>
                            <div className="user-meta">
                              <span
                                className={`user-status-text ${isOnline ? "online" : "offline"
                                  }`}
                                style={{
                                  color: isOnline ? "#4caf50" : "#9e9e9e",
                                }}
                              >
                                {isOnline ? "Online" : "Offline"}
                              </span>
                            </div>
                            {user.last_login && (
                              <div className="last-login">
                                Last login: {getRelativeTime(user.last_login)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
