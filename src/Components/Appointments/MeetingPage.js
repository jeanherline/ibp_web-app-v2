import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { fs } from "../../Config/Firebase";
import SideNavBar from "../SideNavBar/SideNavBar";
import "./Appointments.css";

const MeetingPage = () => {
  const { id } = useParams(); // Get the meeting ID from the route params
  const [meetingData, setMeetingData] = useState(null);
  const [lawyerData, setLawyerData] = useState(null); // State to store lawyer's data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const jitsiApiRef = useRef(null); // Ref to store the Jitsi API instance
  const [jwtToken, setJwtToken] = useState(null); // State to store the JWT

  // Fetch meeting details from Firestore
  useEffect(() => {
    const fetchMeetingDetails = async () => {
      try {
        const meetingDoc = await getDoc(doc(fs, "appointments", id)); // Fetch meeting from Firestore
        if (meetingDoc.exists()) {
          setMeetingData(meetingDoc.data());
        } else {
          setError("No such meeting found!");
        }
      } catch (err) {
        console.error("Error fetching meeting:", err);
        setError("Failed to load meeting details.");
      } finally {
        setLoading(false);
      }
    };

    fetchMeetingDetails();
  }, [id]);

  // Fetch lawyer data
  useEffect(() => {
    const fetchLawyerData = async () => {
      const auth = getAuth();
      const user = auth.currentUser;

      if (user) {
        try {
          const userDoc = await getDoc(doc(fs, "users", user.uid)); // Fetch current authenticated user
          if (userDoc.exists()) {
            setLawyerData(userDoc.data()); // Store lawyer's data
          } else {
            setError("User data not found");
          }
        } catch (err) {
          console.error("Error fetching lawyer data:", err);
          setError("Failed to load lawyer data.");
        }
      } else {
        setError("No authenticated user");
      }
    };

    fetchLawyerData();
  }, []);

  // Fetch JWT from the backend before starting the meeting
  const fetchJwtToken = useCallback(async () => {
    if (!meetingData?.appointmentDetails?.controlNumber) return;
    const roomName = meetingData?.appointmentDetails?.controlNumber;
    try {
      const response = await fetch(
        `https://us-central1-lawyer-app-ed056.cloudfunctions.net/api/generate-jwt?roomName=${roomName}&isModerator=true`
      );
      const data = await response.json();
      setJwtToken(data.token); // Save the JWT token
    } catch (error) {
      console.error("Error fetching JWT:", error);
    }
  }, [meetingData]);

  // Get display name for the lawyer
  const getDisplayName = () => {
    if (!lawyerData) return "Lawyer";
    const title = lawyerData.gender === "Male" ? "Mr." : "Ms.";
    return `${title} ${lawyerData.display_name} ${lawyerData.last_name}`;
  };

  // Start Jitsi meeting with password and lobby enabled
  const startJitsiMeeting = useCallback(() => {
    if (!window.JitsiMeetExternalAPI) {
      console.error("JitsiMeetExternalAPI not loaded.");
      return;
    }

    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
    }

    const roomName = meetingData?.appointmentDetails?.controlNumber;
    const meetingPassword = meetingData?.appointmentDetails?.meetingPass;

    if (!roomName || !jwtToken) {
      console.error("Room name or JWT token is missing");
      return;
    }

    const domain = "8x8.vc";
    const options = {
      roomName: `vpaas-magic-cookie-ef5ce88c523d41a599c8b1dc5b3ab765/${roomName}`,
      parentNode: document.querySelector("#jaas-container"),
      jwt: jwtToken,
      userInfo: {
        displayName: getDisplayName(),
      },
      configOverwrite: {
        startWithAudioMuted: true,
        disableModeratorIndicator: false,
        prejoinPageEnabled: true,
        enableUserRolesBasedOnToken: true,
      },
      interfaceConfigOverwrite: {
        DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
      },
    };

    const api = new window.JitsiMeetExternalAPI(domain, options);
    jitsiApiRef.current = api;

    // Set the room password and enable lobby when the moderator joins
    api.addEventListener("participantRoleChanged", (event) => {
      if (event.role === "moderator") {
        // Set password for the room
        if (meetingPassword) {
          api.executeCommand("password", meetingPassword); // Set the password from Firestore
          console.log("Password set for the meeting:", meetingPassword);
        } else {
          console.log("No password available for this meeting.");
        }
        // Enable the lobby immediately after the moderator joins
        api.executeCommand("toggleLobby", true); // This enables the lobby automatically
        console.log("Lobby has been enabled.");
      }
    });

    // Handle password-protected meeting
    api.on("passwordRequired", () => {
      api.executeCommand("password", meetingPassword); // Join the meeting with the password
    });
  }, [meetingData, jwtToken]);

  // Load Jitsi API script and start the meeting
  useEffect(() => {
    const loadJitsiScript = () => {
      if (!window.JitsiMeetExternalAPI) {
        const script = document.createElement("script");
        script.src =
          "https://8x8.vc/vpaas-magic-cookie-ef5ce88c523d41a599c8b1dc5b3ab765/external_api.js";
        script.async = true;
        script.onload = () => {
          console.log("Jitsi API script loaded successfully.");
          if (meetingData && jwtToken) {
            startJitsiMeeting();
          }
        };
        document.body.appendChild(script);

        return () => {
          document.body.removeChild(script);
          if (jitsiApiRef.current) {
            jitsiApiRef.current.dispose();
            jitsiApiRef.current = null;
          }
        };
      } else if (meetingData && jwtToken) {
        startJitsiMeeting();
      }
    };

    loadJitsiScript();
  }, [meetingData, jwtToken, startJitsiMeeting]);

  useEffect(() => {
    if (meetingData) {
      console.log("Fetching JWT token for the meeting...");
      fetchJwtToken();
    }
  }, [meetingData, fetchJwtToken]);

  if (loading) {
    return <div>Loading meeting...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!meetingData) {
    return <div>No meeting found</div>;
  }

  return (
    <div className="dashboard-container">
      <SideNavBar />
      <div className="main-content">
        <br />
        <h3>Meeting Details</h3>
        <br />
        <div
          id="jaas-container"
          style={{ height: "800px", width: "100%" }}
        ></div>
      </div>
    </div>
  );
};

export default MeetingPage;
