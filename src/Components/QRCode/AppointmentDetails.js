import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import "./AppointmentDetails.css";
import { auth, fs } from "../../Config/Firebase"; // Adjust the import path to your Firebase configuration file

function AppointmentDetails() {
  const { controlNumber } = useParams(); // Extract controlNumber from URL
  const [appointmentDetails, setAppointmentDetails] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        window.location.href = "/";
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchAppointmentDetails = async () => {
      // Validate control number to ensure it's only numeric
      if (!/^\d+$/.test(controlNumber)) {
        setError("Invalid control number");
        return;
      }

      try {
        console.log(`Fetching details for control number: ${controlNumber}`);

        const q = query(
          collection(fs, "appointments"),
          where("appointmentDetails.controlNumber", "==", controlNumber)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          querySnapshot.forEach((doc) => {
            console.log("Appointment data:", doc.data());
            const data = doc.data();
            console.log("Fetched data:", data);
            console.log(
              "appointmentDate field:",
              data?.appointmentDetails?.appointmentDate
            );
            setAppointmentDetails(data); // Set the fetched data to state
          });
        } else {
          console.error(
            `No appointment found for control number: ${controlNumber}`
          );
          setError("No appointment found for this control number"); // Set error if document does not exist
        }
      } catch (err) {
        console.error("Error fetching appointment details:", err);
        setError("Error fetching appointment details"); // Set error in case of any other error
      }
    };

    fetchAppointmentDetails();
  }, [controlNumber]); // Dependency array includes controlNumber to re-fetch if it changes

  const formatDateTime = (timestamp) => {
    if (!timestamp) {
      return "Invalid date";
    }

    console.log("Formatting timestamp:", timestamp);

    try {
      if (timestamp.seconds) {
        const date = new Date(timestamp.seconds * 1000);
        const options = { year: "numeric", month: "long", day: "numeric" };
        const timeOptions = {
          hour: "numeric",
          minute: "numeric",
          hour12: true,
        };
        return `${date.toLocaleDateString(
          "en-US",
          options
        )} at ${date.toLocaleTimeString("en-US", timeOptions)}`;
      }

      if (timestamp instanceof Date) {
        const options = { year: "numeric", month: "long", day: "numeric" };
        const timeOptions = {
          hour: "numeric",
          minute: "numeric",
          hour12: true,
        };
        return `${timestamp.toLocaleDateString(
          "en-US",
          options
        )} at ${timestamp.toLocaleTimeString("en-US", timeOptions)}`;
      }

      if (typeof timestamp === "string") {
        const date = new Date(timestamp);
        const options = { year: "numeric", month: "long", day: "numeric" };
        const timeOptions = {
          hour: "numeric",
          minute: "numeric",
          hour12: true,
        };
        return `${date.toLocaleDateString(
          "en-US",
          options
        )} at ${date.toLocaleTimeString("en-US", timeOptions)}`;
      }
    } catch (error) {
      console.error("Error formatting date:", error);
    }

    return "Invalid date";
  };

  useEffect(() => {
    if (appointmentDetails) {
      console.log("appointmentDetails:", appointmentDetails);
      console.log(
        "appointmentDate:",
        appointmentDetails?.appointmentDetails?.appointmentDate
      );
      console.log(
        "Type of appointmentDate:",
        typeof appointmentDetails?.appointmentDetails?.appointmentDate
      );
      console.log(
        "createdDate:",
        appointmentDetails?.appointmentDetails?.createdDate
      );
      console.log(
        "Type of createdDate:",
        typeof appointmentDetails?.appointmentDetails?.createdDate
      );
    }
  }, [appointmentDetails]);

  return (
    <div className="appointment-details-container">
      <h2>
        APPROVED:{" "}
        {appointmentDetails
          ? formatDateTime(
              appointmentDetails?.appointmentDetails?.appointmentDate
            )
          : "Loading..."}
      </h2>
      {error && <p className="error">{error}</p>}
      {appointmentDetails ? (
        <div className="appointment-details">
          <h3>Applicant Profile</h3>
          <p>
            <strong>Full Name:</strong>{" "}
            {appointmentDetails?.applicantProfile?.fullName}
          </p>
          <p>
            <strong>Address:</strong>{" "}
            {appointmentDetails?.applicantProfile?.address}
          </p>
          <p>
            <strong>Contact Number:</strong>{" "}
            {appointmentDetails?.applicantProfile?.contactNumber}
          </p>
          <p>
            <strong>Date of Birth:</strong>{" "}
            {appointmentDetails?.applicantProfile?.dob}
          </p>
          <p>
            <strong>Gender:</strong>{" "}
            {appointmentDetails?.applicantProfile?.selectedGender}
          </p>

          <h3>Appointment Details</h3>
          <p>
            <strong>Control Number:</strong>{" "}
            {appointmentDetails?.appointmentDetails?.controlNumber}
          </p>
          <p>
            <strong>Appointment Date:</strong>{" "}
            {formatDateTime(
              appointmentDetails?.appointmentDetails?.appointmentDate
            )}
          </p>
          <p>
            <strong>Created Date:</strong>{" "}
            {formatDateTime(
              appointmentDetails?.appointmentDetails?.createdDate
            )}
          </p>
        </div>
      ) : (
        !error && <p>Loading appointment details...</p>
      )}
    </div>
  );
}

export default AppointmentDetails;
