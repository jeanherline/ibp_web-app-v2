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
import { DateRange } from "react-date-range";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import { enUS } from "date-fns/locale";
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
  const isSecretary = currentUser?.member_type === "secretary";
  const associatedLawyerUid = currentUser?.associate?.[0] || null;
  const [nextAppointment, setNextAppointment] = useState(null);
  const dashboardRef = useRef();
  const [averageRating, setAverageRating] = useState("0");
  const [lawyerAverageRating, setLawyerAverageRating] = useState("0");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showAllCharts, setShowAllCharts] = useState(false);
  const [showPercentage, setShowPercentage] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [appointmentsPerLawyerData, setAppointmentsPerLawyerData] = useState({ labels: [], datasets: [] });
  const [acceptanceVsRefusalData, setAcceptanceVsRefusalData] = useState({ labels: [], datasets: [] });
  const [topCitiesData, setTopCitiesData] = useState({ labels: [], datasets: [] });


  const today = new Date();
  const [dateRange, setDateRange] = useState([
    {
      startDate: today,
      endDate: today,
      key: "selection",
    },
  ]);
  const timeSlots = [];
  for (let hour = 13; hour < 17; hour++) {
    for (let min = 0; min < 60; min += 5) {
      const label = `${(hour % 12 || 12).toString().padStart(2, '0')}:${min.toString().padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
      timeSlots.push(label);
    }
  }

  const filteredAppointments = appointments.filter((app) => {
    const date = app.appointmentDetails?.createdDate?.toDate?.() || new Date(app.appointmentDetails?.createdDate);
    return date >= dateRange[0].startDate && date <= dateRange[0].endDate;
  });

  const filteredUsers = users.filter((user) => {
    const date = user.created_time?.toDate?.() || new Date(user.created_time);
    return date >= dateRange[0].startDate && date <= dateRange[0].endDate;
  });

  const exportDashboardAsExcel = () => {
    const wb = XLSX.utils.book_new();
    const isAdmin = currentUser?.member_type === "admin";
    const isHeadLawyer = currentUser?.member_type === "head";


    const summaryData = [];

    if (isAdmin) {
      summaryData.push(
        ["ADMIN DASHBOARD SUMMARY"],
        [],
        ["Appointments Summary"],
        ["Metric", "Value"],
        ["Total Appointments", filteredAppointments.length],
        ["Pending", filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "pending").length],
        ["Approved", filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "approved").length],
        ["Accepted", filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "accepted").length],
        ["Denied", filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "denied").length],
        ["Scheduled", filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "scheduled").length],
        ["Successful", filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "done").length],
        ["Missed", filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "missed").length],
        ["Rescheduled", filteredAppointments.filter(app => !!app.rescheduleHistory?.rescheduleDate).length],
        [],
        ["User Summary"],
        ["Active App Users", filteredUsers.filter(user => user.user_status === "active").length],
        ["Inactive App Users", filteredUsers.filter(user => user.user_status === "inactive").length],
        [],
        ["Booking & Schedule Types"],
        ["Walk-In Bookings", filteredAppointments.filter(app => app.appointmentDetails?.apptType === "Walk-in").length],
        ["Via App Bookings", filteredAppointments.filter(app => app.appointmentDetails?.apptType === "Via App").length],
        ["Online Schedule", filteredAppointments.filter(app => app.appointmentDetails?.scheduleType === "Online").length],
        ["In-Person Schedule", filteredAppointments.filter(app => app.appointmentDetails?.scheduleType === "In-Person").length],
        [],
        ["Average Appointment Rating", averageRating]
      );
    } else if (isHeadLawyer) {
      const lawyerAssignedCounts = {};
      users
        .filter((u) => u.member_type === "lawyer")
        .forEach((lawyer) => {
          const count = filteredAppointments.filter(
            (app) => app.appointmentDetails?.assignedLawyer === lawyer.uid
          ).length;
          lawyerAssignedCounts[lawyer.uid] = count;
        });

      const mostActive = Object.entries(lawyerAssignedCounts).sort((a, b) => b[1] - a[1])[0];
      const leastActive = Object.entries(lawyerAssignedCounts).sort((a, b) => a[1] - b[1])[0];

      const mostActiveLawyer = users.find(u => u.uid === mostActive?.[0]);
      const leastActiveLawyer = users.find(u => u.uid === leastActive?.[0]);

      const sameLawyer = mostActive?.[0] === leastActive?.[0];

      summaryData.push(
        ["HEAD LAWYER DASHBOARD SUMMARY"],
        [],
        ["Appointments Summary"],
        ["Metric", "Value"],
        ["Total Appointments Assigned to Lawyers", filteredAppointments.filter(app => app.appointmentDetails?.assignedLawyer).length],
        ["Pending Lawyer Assignments", filteredAppointments.filter(app => !app.appointmentDetails?.assignedLawyer).length],
        ["Pending", filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "pending").length],
        ["Approved", filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "approved").length],
        ["Accepted", filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "accepted").length],
        ["Denied", filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "denied").length],
        ["Scheduled", filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "scheduled").length],
        ["Successful", filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "done").length],
        ["Missed", filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "missed").length],
        ["Rescheduled", filteredAppointments.filter(app => !!app.rescheduleHistory?.rescheduleDate).length],
        ["Average Appointment Rating", averageRating],
        ...(
          sameLawyer
            ? [
              ["Most Active Lawyer", "N/A"],
              ["Least Active Lawyer", "N/A"]
            ]
            : [
              ["Most Active Lawyer", mostActiveLawyer ? `${mostActiveLawyer.display_name} ${mostActiveLawyer.last_name} (${mostActive[1]})` : "N/A"],
              ["Least Active Lawyer", leastActiveLawyer ? `${leastActiveLawyer.display_name} ${leastActiveLawyer.last_name} (${leastActive[1]})` : "N/A"]
            ]
        )
      );

      if (showAllCharts) {
        // Add charts data as separate sheets
        const chartSheets = [
          {
            name: "AppointmentsPerLawyer",
            data: [
              ["Lawyer", "Total Assigned"],
              ...appointmentsPerLawyerData.labels.map((label, i) => [
                label,
                appointmentsPerLawyerData.datasets[0]?.data[i] ?? 0,
              ]),
            ],
          },
          {
            name: "AppointmentStatusBreakdown",
            data: [
              ["Status", "Total"],
              ...acceptanceVsRefusalData.labels.map((label, i) => [
                label,
                acceptanceVsRefusalData.datasets[0]?.data[i] ?? 0,
              ]),
            ],
          },
          {
            name: "SatisfactionPerLawyer",
            data: [
              ["Lawyer", "Satisfied Users (Rating ≥ 4)"],
              ...satisfiedUsersByLawyerData.labels.map((label, i) => [
                label,
                satisfiedUsersByLawyerData.datasets[0]?.data[i] ?? 0,
              ]),
            ],
          },
          {
            name: "TopCitiesLegalNeed",
            data: [
              ["City", "Total Appointments"],
              ...topCitiesData.labels.map((label, i) => [
                label,
                topCitiesData.datasets[0]?.data[i] ?? 0,
              ]),
            ],
          },
        ];

        chartSheets.forEach(({ name, data }) => {
          const sheet = XLSX.utils.aoa_to_sheet(data);
          sheet["!cols"] = [{ wch: 30 }, { wch: 20 }];
          XLSX.utils.book_append_sheet(wb, sheet, name);
        });
      }
    }
    else if (currentUser?.member_type === "lawyer") {
      const lawyerAppointments = appointments.filter(
        (app) => app.appointmentDetails?.assignedLawyer === currentUser?.uid
      );

      // Compute average rating
      const rated = lawyerAppointments.filter(app => app.rating !== undefined);
      const totalRating = rated.reduce((sum, app) => sum + app.rating, 0);
      const avgRating = rated.length ? (totalRating / rated.length).toFixed(2) : "0";

      // Compute average time to case resolution
      const caseResolutionTimes = lawyerAppointments
        .filter(app =>
          app.appointmentDetails?.appointmentStatus === "done" &&
          app.appointmentDetails?.createdDate &&
          app.appointmentDetails?.appointmentDate
        )
        .map(app => {
          const start = app.appointmentDetails.createdDate.toDate?.() || new Date(app.appointmentDetails.createdDate);
          const end = app.appointmentDetails.appointmentDate.toDate?.() || new Date(app.appointmentDetails.appointmentDate);
          return (end - start) / (1000 * 60 * 60 * 24); // in days
        });

      const avgResolutionTime = caseResolutionTimes.length
        ? (caseResolutionTimes.reduce((a, b) => a + b, 0) / caseResolutionTimes.length).toFixed(1)
        : "0";

      summaryData.push(
        ["LAWYER DASHBOARD SUMMARY"],
        [],
        ["Appointments Summary"],
        ["Metric", "Value"],
        ["Total Appointments", lawyerAppointments.length],
        ["Accepted Appointments", lawyerAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "accepted").length],
        ["Refused Appointments", lawyerAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "refused").length],
        ["Scheduled Appointments", lawyerAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "scheduled").length],
        ["Completed Appointments", lawyerAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "done").length],
        ["Missed Appointments", lawyerAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "missed").length],
        ["Rescheduled Appointments", lawyerAppointments.filter(app => !!app.rescheduleHistory?.rescheduleDate).length],
        ["Average Appointment Rating", avgRating],
        ["Average Time to Case Resolution (days)", avgResolutionTime]
      );
    } else if (currentUser?.member_type === "frontdesk") {
      const today = new Date().toDateString();
      const todayAppointments = filteredAppointments.filter(app => {
        const date = app.appointmentDetails?.appointmentDate?.toDate?.() || new Date(app.appointmentDetails?.appointmentDate);
        return date?.toDateString() === today;
      }).length;

      summaryData.push(
        ["FRONT DESK DASHBOARD SUMMARY"],
        [],
        ["Appointments Summary"],
        ["Metric", "Value"],
        ["Total Appointments", filteredAppointments.length],
        ["Today's Appointments", todayAppointments],
        ["Pending Appointments", filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "pending").length],
        ["Approved Appointments", filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "approved").length],
        ["Scheduled Appointments", filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "scheduled").length],
        ["Missed Appointments", filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "missed").length],
        ["Successful Appointments (Done)", filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "done").length],
        ["Rescheduled Appointments", filteredAppointments.filter(app => !!app.rescheduleHistory?.rescheduleDate).length],
        ["Walk-In Bookings", filteredAppointments.filter(app => app.appointmentDetails?.apptType === "Walk-in").length],
        ["Via App Bookings", filteredAppointments.filter(app => app.appointmentDetails?.apptType === "Via App").length],
        ["Online Appointments", filteredAppointments.filter(app => (app.appointmentDetails?.scheduleType || "").toLowerCase() === "online").length],
        ["In-Person Appointments", filteredAppointments.filter(app => (app.appointmentDetails?.scheduleType || "").toLowerCase() === "in-person").length]
      );
    }
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

    summarySheet['!cols'] = [{ wch: 30 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

    // Graph Data Sheets (only for Admins)
    if (isAdmin) {
      const timeRanges = ["day", "month", "quarter", "year"];
      timeRanges.forEach(range => {
        const grouped = groupDataByTimeRange(
          filteredAppointments,
          (app) => app.appointmentDetails?.createdDate,
          range
        );

        const sheetData = [["Time", "Total", "Done", "Denied", "Canceled", "Average Rating"]];
        Object.keys(grouped).forEach(label => {
          const apps = grouped[label];
          const total = apps.length;
          const done = apps.filter(app => app.appointmentDetails?.appointmentStatus === "done").length;
          const denied = apps.filter(app => app.appointmentDetails?.appointmentStatus === "denied").length;
          const canceled = apps.filter(app => app.appointmentDetails?.appointmentStatus === "canceled").length;
          const rated = apps.filter(app => app.rating !== undefined);
          const ratingAvg = rated.length > 0
            ? (rated.reduce((sum, app) => sum + app.rating, 0) / rated.length).toFixed(2)
            : 0;

          sheetData.push([label, total, done, denied, canceled, ratingAvg]);
        });

        const sheet = XLSX.utils.aoa_to_sheet(sheetData);
        sheet['!cols'] = [
          { wch: 20 }, { wch: 10 }, { wch: 10 },
          { wch: 10 }, { wch: 10 }, { wch: 15 }
        ];
        XLSX.utils.book_append_sheet(wb, sheet, `Stats_${range}`);
      });
    }

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const start = dateRange[0].startDate.toLocaleDateString("en-PH");
    const end = dateRange[0].endDate.toLocaleDateString("en-PH");
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), `Dashboard_Report_${start}_to_${end}.xlsx`);
  };


  const appointmentStatusData = {
    labels: [
      "Pending",
      "Approved",
      "Accepted",
      "Denied",
      "Scheduled",
      "Successful",
      "Missed",
      "Rescheduled",
    ],
    datasets: [
      {
        label: "Appointments",
        data: [
          filteredAppointments.filter((a) => a.appointmentDetails?.appointmentStatus === "pending").length,
          filteredAppointments.filter((a) => a.appointmentDetails?.appointmentStatus === "approved").length,
          filteredAppointments.filter((a) => a.appointmentDetails?.appointmentStatus === "accepted").length,
          filteredAppointments.filter((a) => a.appointmentDetails?.appointmentStatus === "denied").length,
          filteredAppointments.filter((a) => a.appointmentDetails?.appointmentStatus === "scheduled").length,
          filteredAppointments.filter((a) => a.appointmentDetails?.appointmentStatus === "done").length,
          filteredAppointments.filter((a) => a.appointmentDetails?.appointmentStatus === "missed").length,
          filteredAppointments.filter((a) => a.appointmentDetails?.appointmentStatus === "rescheduled").length,
        ],
        borderColor: "#8e24aa",
        backgroundColor: "rgba(142, 36, 170, 0.1)",
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const ageGroups = ["<18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
  const ageGroupCounts = Array(ageGroups.length).fill(0);

  filteredUsers.forEach((user) => {
    const dob = user.dob?.toDate?.() || new Date(user.dob);
    const age = Math.floor((new Date() - dob) / (365.25 * 24 * 60 * 60 * 1000));

    const index =
      age < 18
        ? 0
        : age <= 24
          ? 1
          : age <= 34
            ? 2
            : age <= 44
              ? 3
              : age <= 54
                ? 4
                : age <= 64
                  ? 5
                  : 6;
    ageGroupCounts[index]++;
  });

  const newUsersByAgeData = {
    labels: ageGroups,
    datasets: [
      {
        label: "New Users",
        data: ageGroupCounts,
        borderColor: "#009688",
        backgroundColor: "rgba(0, 150, 136, 0.1)",
        fill: true,
        tension: 0.3,
      },
    ],
  };


  const cities = [
    "Angat", "Balagtas", "Baliuag", "Bocaue", "Bulakan", "Bustos", "Calumpit",
    "Doña Remedios Trinidad", "Guiguinto", "Hagonoy", "Marilao", "Norzagaray",
    "Obando", "Pandi", "Paombong", "Plaridel", "Pulilan", "San Ildefonso",
    "San Miguel", "San Rafael", "Santa Maria"
  ];

  const usersPerCityData = {
    labels: cities,
    datasets: [
      {
        label: "New Users",
        data: cities.map((city) =>
          filteredUsers.filter((user) => user.city === city).length
        ),
        borderColor: "#607d8b",
        backgroundColor: "rgba(96, 125, 139, 0.1)",
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const [satisfiedUsersByLawyerData, setSatisfiedUsersByLawyerData] = useState({
    labels: [],
    datasets: [],
  });


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

  const generateDayOfWeekVolumeData = () => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayCounts = days.map((_, i) =>
      filteredAppointments.filter(app => {
        const date = app.appointmentDetails?.appointmentDate?.toDate?.() || new Date(app.appointmentDetails?.appointmentDate);
        return date.getDay() === i;
      }).length
    );

    return {
      labels: days,
      datasets: [{
        label: "Appointments",
        data: dayCounts,
        borderColor: "#03a9f4",
        backgroundColor: "rgba(3, 169, 244, 0.1)",
        fill: true,
        tension: 0.3,
      }],
    };
  };

  const generateNewWalkInUsersData = () => {
    const groupedWalkIns = groupDataByTimeRange(
      filteredAppointments.filter(app => app.appointmentDetails?.apptType === "Walk-in"),
      (app) => app.appointmentDetails?.createdDate,
      "day"
    );

    return {
      labels: Object.keys(groupedWalkIns),
      datasets: [{
        label: "New Walk-In Registrations",
        data: Object.values(groupedWalkIns).map(apps => apps.length),
        borderColor: "#4caf50",
        backgroundColor: "rgba(76, 175, 80, 0.1)",
        fill: true,
        tension: 0.3,
      }],
    };
  };

  const appointmentVolumeByTimeData = {
    labels: timeSlots,
    datasets: [
      {
        label: "Appointments",
        data: timeSlots.map(slot => {
          const [time, meridiem] = slot.split(" ");
          const [hourStr, minStr] = time.split(":");
          let hour = parseInt(hourStr);
          const minutes = parseInt(minStr);
          if (meridiem === "PM" && hour !== 12) hour += 12;

          return filteredAppointments.filter(app => {
            const date = app.appointmentDetails?.appointmentDate?.toDate?.() || new Date(app.appointmentDetails?.appointmentDate);
            return date.getHours() === hour && date.getMinutes() === minutes;
          }).length;
        }),
        borderColor: "#9c27b0",
        backgroundColor: "rgba(156, 39, 176, 0.1)",
        fill: true,
        tension: 0.3,
      },
    ],
  };


  const userStatusData = {
    labels: ["Active", "Inactive"],
    datasets: [
      {
        label: "Users",
        data: [
          filteredUsers.filter((u) => u.user_status === "active").length,
          filteredUsers.filter((u) => u.user_status === "inactive").length,
        ],
        borderColor: "#3f51b5",
        backgroundColor: "rgba(63, 81, 181, 0.1)",
        fill: true,
        tension: 0.3,
      },
    ],
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
    const currentUserId = auth.currentUser?.uid;
    const currentUserDoc = await getDoc(doc(fs, "users", currentUserId));
    const currentUserData = currentUserDoc.data();
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
    // ✅ FETCH APPOINTMENTS FIRST
    let appointmentsQuery = collection(fs, "appointments");
    if (currentUserData.member_type === "lawyer") {
      appointmentsQuery = query(
        appointmentsQuery,
        where("appointmentDetails.assignedLawyer", "==", currentUserId)
      );
    }
    const appointmentsSnapshot = await getDocs(appointmentsQuery);
    const appointmentsList = appointmentsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        uid: data.appointmentDetails?.uid || null, // ✅ Pull UID from inside appointmentDetails
      };
    });
    setAppointments(appointmentsList);

    // ✅ THEN generate satisfied users by lawyer
    const lawyerUsers = updatedUsers.filter((user) => user.member_type === "lawyer");
    const lawyerRatingsMap = {};

    lawyerUsers.forEach((lawyer) => {
      const satisfied = appointmentsList.filter(
        (app) =>
          app.appointmentDetails?.assignedLawyer === lawyer.uid &&
          app.rating >= 4
      ).length;

      lawyerRatingsMap[
        `${lawyer.last_name || ""}`.trim()
      ] = satisfied;
    });

    setSatisfiedUsersByLawyerData({
      labels: Object.keys(lawyerRatingsMap),
      datasets: [
        {
          label: "Satisfied Users (Rating ≥ 4)",
          data: Object.values(lawyerRatingsMap),
          borderColor: "#00c853",
          backgroundColor: "rgba(0, 200, 83, 0.1)",
          fill: true,
          tension: 0.3,
        },
      ],
    });

    const appointmentsPerLawyer = {
      labels: lawyerUsers.map(lawyer => `${lawyer.last_name}`),
      datasets: [
        {
          label: "Appointments Assigned",
          data: lawyerUsers.map(lawyer =>
            filteredAppointments.filter(app => app.appointmentDetails?.assignedLawyer === lawyer.uid).length
          ),
          borderColor: "#3f51b5",
          backgroundColor: "rgba(63, 81, 181, 0.1)",
          fill: true,
          tension: 0.3,
        },
      ],
    };
    setAppointmentsPerLawyerData(appointmentsPerLawyer);

    // Lawyer Acceptance vs Refusal Rate
    const lawyerUid = currentUser?.uid || associatedLawyerUid;
    const lawyerAppointments = filteredAppointments.filter(app => app.appointmentDetails?.assignedLawyer === lawyerUid);

    const appointmentStatusBreakdownData = {
      labels: [
        "Pending", "Approved", "Accepted", "Denied", "Scheduled", "Successful", "Missed", "Rescheduled"
      ],
      datasets: [
        {
          label: "Appointments",
          data: [
            lawyerAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "pending").length,
            lawyerAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "approved").length,
            lawyerAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "accepted").length,
            lawyerAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "denied").length,
            lawyerAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "scheduled").length,
            lawyerAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "done").length,
            lawyerAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "missed").length,
            lawyerAppointments.filter(app => !!app.rescheduleHistory?.rescheduleDate).length,
          ],
          borderColor: "#8e24aa",
          backgroundColor: "rgba(142, 36, 170, 0.1)",
          fill: true,
          tension: 0.3,
        },
      ],
    };
    setAcceptanceVsRefusalData(appointmentStatusBreakdownData); // Reuse existing state variable

    const topCitiesData = {
      labels: cities,
      datasets: [
        {
          label: "Appointments",
          data: cities.map(city =>
            filteredAppointments.filter(app =>
              app.appointmentDetails?.assignedLawyer === lawyerUid &&
              users.find(user => user.uid === app.uid)?.city === city
            ).length
          ),
          borderColor: "#ff9800",
          backgroundColor: "rgba(255, 152, 0, 0.1)",
          fill: true,
          tension: 0.3,
        },
      ],
    };

    setTopCitiesData(topCitiesData);

    setLoadingUsers(false);
    setCurrentUser(currentUserData);
    setIsLawyer(currentUserData.member_type === "lawyer");



    setAppointments(appointmentsList);

    // Save to chart data
    setSatisfiedUsersByLawyerData({
      labels: Object.keys(lawyerRatingsMap),
      datasets: [
        {
          label: "Satisfied Users (Rating ≥ 4)",
          data: Object.values(lawyerRatingsMap),
          borderColor: "#00c853",
          backgroundColor: "rgba(0, 200, 83, 0.1)",
          fill: true,
          tension: 0.3,
        },
      ],
    });

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
    filteredAppointments,
    (app) => app.appointmentDetails?.createdDate,
    "day" // or "month", depending on how you want to group
  );

  const groupedUsers = groupDataByTimeRange(
    filteredUsers,
    (user) => user.created_time,
    "day"
  );

  const weeklyAppointmentsData = {
    labels: Object.keys(groupedAppointments),
    datasets: [
      {
        label: "Total Appointments",
        data: Object.values(groupedAppointments).map(apps => {
          const count = apps.filter(app => app.appointmentDetails?.apptType === "Via App").length;
          return showPercentage ? (count / apps.length) * 100 : count;
        }),
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
            apps.filter((app) => app.appointmentDetails?.apptType === "Via App").length
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
            apps.filter((app) => app.appointmentDetails?.apptType === "Walk-in").length
        ),
        borderColor: "#ff5722",
        backgroundColor: "rgba(255, 87, 34, 0.1)",
        fill: true,
        tension: 0.3,
      },
    ],
  };


  const groupedScheduleTypeAppointments = groupDataByTimeRange(
    filteredAppointments,
    (app) => app.appointmentDetails?.createdDate,
    "day"
  );

  const weeklyScheduleTypeData = {
    labels: Object.keys(groupedScheduleTypeAppointments),
    datasets: [
      {
        label: "Online",
        data: Object.values(groupedScheduleTypeAppointments).map((apps) =>
          apps.filter(
            (app) =>
              (app.appointmentDetails?.scheduleType || "").toLowerCase() === "online"
          ).length
        ),
        borderColor: "#00bcd4",
        backgroundColor: "rgba(0, 188, 212, 0.1)",
        fill: true,
        tension: 0.3,
      },
      {
        label: "In-Person",
        data: Object.values(groupedScheduleTypeAppointments).map((apps) =>
          apps.filter(
            (app) =>
              (app.appointmentDetails?.scheduleType || "").toLowerCase() === "in-person"
          ).length
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
        label: `New Users)`,
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
              label += `${context.raw} Appointments`;
            }
            else if (context.dataset.label === "Total Number of Users") {
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
              (user) => user.id === app.uid
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
      pdf.text("Lawyer-specific Appointment Summary", 10, yOffset);
      yOffset += 10;
      pdf.setFont("helvetica", "normal");
      const currentUserId = auth.currentUser?.uid;
      const lawyerAppointments = filteredAppointments.filter(
        app => app.appointmentDetails?.assignedLawyer === (currentUser?.uid || associatedLawyerUid)
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

    yOffset += 20;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(10, yOffset, 200, yOffset);
    yOffset += 10;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "italic");
    pdf.text("End of Report", 10, yOffset);

    pdf.save("dashboard_report.pdf");
  };

  const caseResolutionTimes = filteredAppointments
    .filter(app =>
      app.appointmentDetails?.appointmentStatus === "done" &&
      app.appointmentDetails?.createdDate &&
      app.appointmentDetails?.appointmentDate
    )
    .map(app => {
      const start = app.appointmentDetails.createdDate.toDate?.() || new Date(app.appointmentDetails.createdDate);
      const end = app.appointmentDetails.appointmentDate.toDate?.() || new Date(app.appointmentDetails.appointmentDate);
      return (end - start) / (1000 * 60 * 60 * 24); // in days
    });

  const averageResolutionTime = caseResolutionTimes.length
    ? (caseResolutionTimes.reduce((a, b) => a + b, 0) / caseResolutionTimes.length).toFixed(1)
    : "0";

  const weeklyResolutionTimeData = {
    labels: Object.keys(groupedAppointments),
    datasets: [
      {
        label: "Avg. Case Resolution Time (days)",
        data: Object.values(groupedAppointments).map(apps => {
          const durations = apps
            .filter(app =>
              app.appointmentDetails?.appointmentStatus === "done" &&
              app.appointmentDetails?.createdDate &&
              app.appointmentDetails?.appointmentDate
            )
            .map(app => {
              const start = app.appointmentDetails.createdDate.toDate?.() || new Date(app.appointmentDetails.createdDate);
              const end = app.appointmentDetails.appointmentDate.toDate?.() || new Date(app.appointmentDetails.appointmentDate);
              return (end - start) / (1000 * 60 * 60 * 24);
            });
          return durations.length
            ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1)
            : 0;
        }),
        borderColor: "#607d8b",
        backgroundColor: "rgba(96, 125, 139, 0.1)",
        fill: true,
        tension: 0.3,
      },
    ],
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
        <div className="toggle-charts-wrapper" style={{ position: "relative" }}>
          <button onClick={exportDashboardAsExcel} className="download-button">
            Download Report
          </button>

          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="toggle-charts-button"
            style={{ marginLeft: "10px" }}
          >
            {showDatePicker ? "Hide Date Filter" : "Filter by Date Range"}
          </button>

          <div style={{ position: "relative", display: "inline-block" }}>
            {showDatePicker && (
              <div
                style={{
                  position: "absolute",
                  top: "50px", // ⬅️ Adjust this for vertical placement (was 0)
                  right: "calc(100% + 12px)", // ⬅️ Position to the left of buttons
                  zIndex: 999,
                  backgroundColor: "#fff",
                  border: "1px solid #ccc",
                  borderRadius: "12px",
                  boxShadow: "0 8px 16px rgba(0, 0, 0, 0.15)",
                }}
              >
                <DateRange
                  editableDateInputs={true}
                  onChange={(item) => setDateRange([item.selection])}
                  moveRangeOnFirstSelection={false}
                  ranges={dateRange}
                  locale={enUS}
                />
              </div>
            )}
          </div>

        </div>

        <br />
        <center>
          <div className="stats-container">
            {currentUser?.member_type === "admin" && (
              <>
                <div className="stat-card">
                  <FaCalendarAlt className="stat-icon" />
                  <h2>Total Appointments</h2>
                  <p>{filteredAppointments.length}</p>
                </div>
                <div className="stat-card">
                  <FaClock className="stat-icon" />
                  <h2>Pending Appointments</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "pending").length}</p>
                </div>
                <div className="stat-card">
                  <FaCalendarCheck className="stat-icon" />
                  <h2>Approved Appointments</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "approved").length}</p>
                </div>
                <div className="stat-card">
                  <FaUserCheck className="stat-icon" />
                  <h2>Accepted Appointments</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "accepted").length}</p>
                </div>
                <div className="stat-card">
                  <FaTimesCircle className="stat-icon" />
                  <h2>Denied Appointments</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "denied").length}</p>
                </div>
                <div className="stat-card">
                  <FaClock className="stat-icon" />
                  <h2>Scheduled Appointments</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "scheduled").length}</p>
                </div>
                <div className="stat-card">
                  <FaUserCheck className="stat-icon" />
                  <h2>Successful Appointments</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "done").length}</p>
                </div>
                <div className="stat-card">
                  <FaTimesCircle className="stat-icon" />
                  <h2>Missed Appointments</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "missed").length}</p>
                </div>
                <div className="stat-card">
                  <FaClock className="stat-icon" />
                  <h2>Rescheduled</h2>
                  <p>{filteredAppointments.filter(app => !!app.rescheduleHistory?.rescheduleDate).length}</p>
                </div>
                <div className="stat-card">
                  <FaUsers className="stat-icon" />
                  <h2>Active App Users</h2>
                  <p>{filteredUsers.filter(user => user.user_status === "active").length}</p>
                </div>
                <div className="stat-card">
                  <FaUserTimes className="stat-icon" />
                  <h2>Inactive App Users</h2>
                  <p>{filteredUsers.filter(user => user.user_status === "inactive").length}</p>
                </div>
                <div className="stat-card">
                  <FaStar className="stat-icon" />
                  <h2>Average Appointment Rating</h2>
                  <p>
                    {(() => {
                      const rated = filteredAppointments.filter(app => app.rating !== undefined);
                      const total = rated.reduce((sum, app) => sum + app.rating, 0);
                      return rated.length ? (total / rated.length).toFixed(2) : "0";
                    })()} / 5
                  </p>
                </div>
                <div className="stat-card">
                  <FaCalendarAlt className="stat-icon" />
                  <h2>Walk-In Booking</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.apptType === "Walk-in").length}</p>
                </div>
                <div className="stat-card">
                  <FaCalendarAlt className="stat-icon" />
                  <h2>Via App Booking</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.apptType === "Via App").length}</p>
                </div>
                <div className="stat-card">
                  <FaCalendarAlt className="stat-icon" />
                  <h2>Online Schedule</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.scheduleType === "Online").length}</p>
                </div>
                <div className="stat-card">
                  <FaCalendarAlt className="stat-icon" />
                  <h2>In-Person Schedule</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.scheduleType === "In-Person").length}</p>
                </div>
              </>
            )}
            {currentUser?.member_type === "head" && (
              <>
                <div className="stat-card">
                  <FaCalendarAlt className="stat-icon" />
                  <h2>Total Appointments Assigned</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.assignedLawyer).length}</p>
                </div>

                <div className="stat-card">
                  <FaClock className="stat-icon" />
                  <h2>Pending Lawyer Assignments</h2>
                  <p>{filteredAppointments.filter(app => !app.appointmentDetails?.assignedLawyer).length}</p>
                </div>

                <div className="stat-card">
                  <FaCalendarCheck className="stat-icon" />
                  <h2>Approved Appointments</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "approved").length}</p>
                </div>

                <div className="stat-card">
                  <FaUserCheck className="stat-icon" />
                  <h2>Accepted by Lawyers</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "accepted").length}</p>
                </div>

                <div className="stat-card">
                  <FaTimesCircle className="stat-icon" />
                  <h2>Refused by Lawyers</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "refused").length}</p>
                </div>

                <div className="stat-card">
                  <FaClock className="stat-icon" />
                  <h2>Scheduled by Lawyers</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "scheduled").length}</p>
                </div>

                <div className="stat-card">
                  <FaUserCheck className="stat-icon" />
                  <h2>Completed Appointments</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "done").length}</p>
                </div>

                <div className="stat-card">
                  <FaTimesCircle className="stat-icon" />
                  <h2>Missed Appointments</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "missed").length}</p>
                </div>

                <div className="stat-card">
                  <FaClock className="stat-icon" />
                  <h2>Rescheduled Appointments</h2>
                  <p>{filteredAppointments.filter(app => !!app.rescheduleHistory?.rescheduleDate).length}</p>
                </div>

                <div className="stat-card">
                  <FaStar className="stat-icon" />
                  <h2>Average Appointment Rating</h2>
                  <p>
                    {(() => {
                      const rated = filteredAppointments.filter(app => app.rating !== undefined);
                      const total = rated.reduce((sum, app) => sum + app.rating, 0);
                      return rated.length ? (total / rated.length).toFixed(2) : "0";
                    })()} / 5
                  </p>
                </div>

                <div className="stat-card">
                  <FaUserCheck className="stat-icon" />
                  <h2>Most Active Lawyer</h2>
                  <p>{(() => {
                    const lawyerAssignedCounts = {};

                    users
                      .filter(user => user.member_type === "lawyer")
                      .forEach(lawyer => {
                        const count = filteredAppointments.filter(
                          app => app.appointmentDetails?.assignedLawyer === lawyer.uid
                        ).length;
                        lawyerAssignedCounts[lawyer.uid] = count;
                      });

                    const sorted = Object.entries(lawyerAssignedCounts).sort((a, b) => b[1] - a[1]);
                    const [mostActiveId, count] = sorted[0] || [];
                    const lawyer = users.find(u => u.uid === mostActiveId);
                    return lawyer ? `${lawyer.display_name} ${lawyer.last_name} (${count})` : "N/A";

                  })()}</p>
                </div>

                <div className="stat-card">
                  <FaUserTimes className="stat-icon" />
                  <h2>Least Active Lawyer</h2>
                  <p>{(() => {
                    const lawyerAssignedCounts = {};

                    users
                      .filter(user => user.member_type === "lawyer")
                      .forEach(lawyer => {
                        const count = filteredAppointments.filter(
                          app => app.appointmentDetails?.assignedLawyer === lawyer.uid
                        ).length;
                        lawyerAssignedCounts[lawyer.uid] = count;
                      });

                    const sorted = Object.entries(lawyerAssignedCounts).sort((a, b) => a[1] - b[1]);
                    const [leastActiveId, count] = sorted[0] || [];
                    const lawyer = users.find(u => u.uid === leastActiveId);
                    return lawyer ? `${lawyer.display_name} ${lawyer.last_name} (${count})` : "N/A";
                  })()}</p>
                </div>
              </>
            )}
            {(currentUser?.member_type === "lawyer" || isSecretary) && (
              <>
                {(() => {
                  const lawyerUid = currentUser?.uid || associatedLawyerUid;
                  const myAppointments = filteredAppointments.filter(
                    app => app.appointmentDetails?.assignedLawyer === lawyerUid
                  );
                  const averageRating = (() => {
                    const rated = myAppointments.filter(app => app.rating !== undefined);
                    const total = rated.reduce((sum, app) => sum + app.rating, 0);
                    return rated.length ? (total / rated.length).toFixed(2) : "0";
                  })();

                  return (
                    <>
                      <div className="stat-card">
                        <FaCalendarAlt className="stat-icon" />
                        <h2>Total Appointments Assigned</h2>
                        <p>{myAppointments.length}</p>
                      </div>

                      <div className="stat-card">
                        <FaUserCheck className="stat-icon" />
                        <h2>Accepted Appointments</h2>
                        <p>{myAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "accepted").length}</p>
                      </div>

                      <div className="stat-card">
                        <FaUserTimes className="stat-icon" />
                        <h2>Refused Appointments</h2>
                        <p>{myAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "refused").length}</p>
                      </div>

                      <div className="stat-card">
                        <FaClock className="stat-icon" />
                        <h2>Scheduled Appointments</h2>
                        <p>{myAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "scheduled").length}</p>
                      </div>

                      <div className="stat-card">
                        <FaCalendarCheck className="stat-icon" />
                        <h2>Total Clients Assisted</h2>
                        <p>{myAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "done").length}</p>
                      </div>

                      <div className="stat-card">
                        <FaTimesCircle className="stat-icon" />
                        <h2>Missed Appointments</h2>
                        <p>{myAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "missed").length}</p>
                      </div>

                      <div className="stat-card">
                        <FaClock className="stat-icon" />
                        <h2>Rescheduled Appointments</h2>
                        <p>{myAppointments.filter(app => !!app.rescheduleHistory?.rescheduleDate).length}</p>
                      </div>

                      <div className="stat-card">
                        <FaStar className="stat-icon" />
                        <h2>Average Appointment Rating</h2>
                        <p>{averageRating} / 5</p>
                      </div>
                    </>
                  );
                })()}
              </>
            )}
            {currentUser?.member_type === "frontdesk" && (
              <>
                <div className="stat-card">
                  <FaCalendarAlt className="stat-icon" />
                  <h2>Total Appointments</h2>
                  <p>{filteredAppointments.length}</p>
                </div>
                <div className="stat-card">
                  <FaCalendarCheck className="stat-icon" />
                  <h2>Today's Appointments</h2>
                  <p>{
                    filteredAppointments.filter(app => {
                      const date = app.appointmentDetails?.appointmentDate?.toDate?.() || new Date(app.appointmentDetails?.appointmentDate);
                      const today = new Date();
                      return date?.toDateString() === today?.toDateString();
                    }).length
                  }</p>
                </div>
                <div className="stat-card">
                  <FaClock className="stat-icon" />
                  <h2>Pending Appointments</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "pending").length}</p>
                </div>
                <div className="stat-card">
                  <FaCalendarCheck className="stat-icon" />
                  <h2>Approved Appointments</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "approved").length}</p>
                </div>
                <div className="stat-card">
                  <FaClock className="stat-icon" />
                  <h2>Scheduled Appointments</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "scheduled").length}</p>
                </div>
                <div className="stat-card">
                  <FaTimesCircle className="stat-icon" />
                  <h2>Missed Appointments</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "missed").length}</p>
                </div>
                <div className="stat-card">
                  <FaUserCheck className="stat-icon" />
                  <h2>Successful Appointments</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.appointmentStatus === "done").length}</p>
                </div>
                <div className="stat-card">
                  <FaClock className="stat-icon" />
                  <h2>Rescheduled Appointments</h2>
                  <p>{filteredAppointments.filter(app => !!app.rescheduleHistory?.rescheduleDate).length}</p>
                </div>
                <div className="stat-card">
                  <FaCalendarAlt className="stat-icon" />
                  <h2>Walk-In Bookings</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.apptType === "Walk-in").length}</p>
                </div>
                <div className="stat-card">
                  <FaCalendarAlt className="stat-icon" />
                  <h2>Via App Bookings</h2>
                  <p>{filteredAppointments.filter(app => app.appointmentDetails?.apptType === "Via App").length}</p>
                </div>
                <div className="stat-card">
                  <FaCalendarAlt className="stat-icon" />
                  <h2>Online Appointments</h2>
                  <p>{filteredAppointments.filter(app => (app.appointmentDetails?.scheduleType || "").toLowerCase() === "online").length}</p>
                </div>
                <div className="stat-card">
                  <FaCalendarAlt className="stat-icon" />
                  <h2>In-Person Appointments</h2>
                  <p>{filteredAppointments.filter(app => (app.appointmentDetails?.scheduleType || "").toLowerCase() === "in-person").length}</p>
                </div>
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
        </div>

        <div className="charts-wrapper">
          {/* Admin Charts */}
          {currentUser?.member_type === "admin" && (
            <>
              <div className="chart-container">
                <Line
                  data={weeklyAppointmentTypeData}
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      title: {
                        display: true,
                        text: `Appointment Type: Via App vs Walk-in`,
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
                        text: `Schedule Type: Online vs In-Person`,
                      },
                    },
                  }}
                />
              </div>

              {showAllCharts && (
                <>
                  <div className="chart-container">
                    <Line
                      data={userStatusData}
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          title: {
                            display: true,
                            text: `User Status: Active vs Inactive`,
                          },
                        },
                      }}
                    />
                  </div>

                  <div className="chart-container">
                    <Line
                      data={appointmentStatusData}
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          title: {
                            display: true,
                            text: `Appointment Status Breakdown`,
                          },
                        },
                      }}
                    />
                  </div>

                  <div className="chart-container">
                    <Line
                      data={newUsersByAgeData}
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          title: {
                            display: true,
                            text: `New Users by Age Demographic`,
                          },
                        },
                      }}
                    />
                  </div>

                  <div className="chart-container">
                    <Line
                      data={appointmentVolumeByTimeData}
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          title: {
                            display: true,
                            text: `Appointment Volume by Time of Day (1PM–5PM)`,
                          },
                        },
                        scales: {
                          x: {
                            ticks: {
                              callback: function (value, index, ticks) {
                                const label = this.getLabelForValue(value);
                                return label.endsWith("00 PM") ? label : "";
                              },
                              maxRotation: 0,
                              minRotation: 0,
                              autoSkip: false,
                            },
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
                            text: `New Users per City`,
                          },
                        },
                      }}
                    />
                  </div>

                  <div className="chart-container">
                    <Line
                      data={satisfiedUsersByLawyerData}
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          title: {
                            display: true,
                            text: `Satisfied Users in Appointment Booking per Lawyer`,
                          },
                        },
                      }}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* Head Lawyer Charts */}
          {currentUser?.member_type === "head" && (
            <>
              {/* Always show first two */}
              <div className="chart-container">
                <Line
                  data={weeklyAppointmentTypeData}
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      title: {
                        display: true,
                        text: `Appointment Type: Via App vs Walk-in`,
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
                        text: `Schedule Type: Online vs In-Person`,
                      },
                    },
                  }}
                />
              </div>
              {/* Only show these if toggled */}
              {showAllCharts && (
                <>
                  <div className="chart-container">
                    <Line
                      data={appointmentsPerLawyerData}
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          title: {
                            display: true,
                            text: "Appointments per Lawyer",
                          },
                        },
                      }}
                    />
                  </div>

                  <div className="chart-container">
                    <Line
                      data={acceptanceVsRefusalData}
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          title: {
                            display: true,
                            text: "Appointment Status Breakdown",
                          },
                        },
                      }}
                    />
                  </div>
                  <div className="chart-container">
                    <Line
                      data={satisfiedUsersByLawyerData}
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          title: {
                            display: true,
                            text: "Client Satisfaction per Lawyer",
                          },
                        },
                      }}
                    />
                  </div>

                  <div className="chart-container">
                    <Line
                      data={topCitiesData}
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          title: {
                            display: true,
                            text: "Top Cities Needing Legal Assistance",
                          },
                        },
                      }}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {(currentUser?.member_type === "lawyer" || isSecretary) && (
            <>
              {/* Always show first two */}
              <div className="chart-container">
                <Line
                  data={weeklyAppointmentTypeData}
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      title: {
                        display: true,
                        text: `Appointment Type: Via App vs Walk-in`,
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
                        text: `Schedule Type: Online vs In-Person`,
                      },
                    },
                  }}
                />
              </div>

              {/* Show more charts only when toggled */}
              {showAllCharts && (
                <>
                  <div className="chart-container">
                    <Line
                      data={weeklyAppointmentsData}
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          title: {
                            display: true,
                            text: "Appointments Over Time",
                          },
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
                            text: "Client Ratings Over Time",
                          },
                        },
                      }}
                    />
                  </div>

                  <div className="chart-container">
                    <Line
                      data={acceptanceVsRefusalData}
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          title: {
                            display: true,
                            text: "Appointment Status Breakdown",
                          },
                        },
                      }}
                    />
                  </div>

                  <div className="chart-container">
                    <Line
                      data={weeklyResolutionTimeData}
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          title: {
                            display: true,
                            text: "Average Case Resolution Time per Week",
                          },
                        },
                      }}
                    />

                  </div>
                </>
              )}
            </>
          )}

          {currentUser?.member_type === "frontdesk" && (
            <>
              {/* Always Show These Two */}
              <div className="chart-container">
                <Line
                  data={weeklyAppointmentTypeData}
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      title: {
                        display: true,
                        text: "Appointment Type: Via App vs Walk-in",
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
                        text: "Schedule Type: Online vs In-Person",
                      },
                    },
                  }}
                />
              </div>

              {/* Show others only when toggled */}
              {showAllCharts && (
                <>
                  <div className="chart-container">
                    <Line
                      data={appointmentStatusData}
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          title: {
                            display: true,
                            text: "Appointment Status Breakdown",
                          },
                        },
                      }}
                    />
                  </div>

                  <div className="chart-container">
                    <Line
                      data={generateDayOfWeekVolumeData()}
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          title: {
                            display: true,
                            text: "Volume of Appointments by Day of Week",
                          },
                        },
                      }}
                    />
                  </div>

                  <div className="chart-container">
                    <Line
                      data={appointmentVolumeByTimeData}
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          title: {
                            display: true,
                            text: "Appointment Volume by Time of Day",
                          },
                        },
                      }}
                    />
                  </div>

                  <div className="chart-container">
                    <Line
                      data={generateNewWalkInUsersData()}
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          title: {
                            display: true,
                            text: "New Walk-In Registrations Over Time",
                          },
                        },
                      }}
                    />
                  </div>
                </>
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
