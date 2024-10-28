import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getAuth, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const useIdleTimeout = (timeoutDuration = 10 * 60 * 1000) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const timeoutId = useRef(null);
  const [showSnackbar, setShowSnackbar] = useState(false);

  // Function to log out the user
  const logoutUser = async () => {
    const auth = getAuth();
    await signOut(auth);
    setShowSnackbar(true); // Show snackbar
    setTimeout(() => {
      setShowSnackbar(false); // Hide snackbar after a few seconds
      navigate("/"); // Redirect to login page
    }, 3000); // Show snackbar for 3 seconds before redirection
  };

  // Reset the idle timeout
  const resetTimeout = () => {
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
    }
    timeoutId.current = setTimeout(() => {
      logoutUser();
    }, timeoutDuration);
  };

  useEffect(() => {
    if (currentUser) {
      const events = ["mousemove", "keydown", "mousedown", "touchstart"];
      events.forEach((event) => window.addEventListener(event, resetTimeout));
      resetTimeout();

      return () => {
        events.forEach((event) =>
          window.removeEventListener(event, resetTimeout)
        );
        if (timeoutId.current) {
          clearTimeout(timeoutId.current);
        }
      };
    }
  }, [currentUser, timeoutDuration]);

  return { showSnackbar }; // Return showSnackbar to display snackbar in App component
};

export default useIdleTimeout;
