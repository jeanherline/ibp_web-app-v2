import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import "./Config/Firebase"; // Firebase initialization
import reportWebVitals from "./reportWebVitals";
import { AuthProvider } from "./contexts/AuthContext"; // Import AuthProvider from the new path
import "bootstrap/dist/css/bootstrap.min.css";
import "buffer";
import "stream-browserify";
import "crypto-browserify";

// To handle Buffer
import { Buffer } from "buffer";
window.Buffer = Buffer; // Make Buffer available globally

// Get the root element in the HTML
const container = document.getElementById("root");

// Use createRoot instead of ReactDOM.render
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <AuthProvider>
      {/* Wrap your entire app with AuthProvider */}
      <App /> {/* App component where all routes are managed */}
    </AuthProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
