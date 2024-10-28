// src/contexts/AuthContext.js

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; // Firebase authentication

// Create the AuthContext
const AuthContext = createContext();

// Export a custom hook to use AuthContext
export function useAuth() {
  return useContext(AuthContext);
}

// AuthProvider component to wrap around your app
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null); // State to store the current user
  const [loading, setLoading] = useState(true); // State to track if Firebase is loading the user
  
  // Set up Firebase auth listener
  useEffect(() => {
    const auth = getAuth(); // Initialize Firebase auth

    // Listen for changes in user authentication state
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user); // Set the current user
      setLoading(false); // Set loading to false once Firebase auth is ready
    });

    // Clean up the listener on unmount
    return unsubscribe;
  }, []);

  // The context value that will be supplied to any descendants of this component
  const value = {
    currentUser,
  };

  // Prevent rendering the app until Firebase auth state is known
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
