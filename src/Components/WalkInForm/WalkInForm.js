import React, { useState, useEffect, useRef } from "react";
import SideNavBar from "../SideNavBar/SideNavBar";
import {
  getUserById,
  getUserByEmail,
  getAppointmentByUid,
  getAppointmentByEmail,
  createAppointment,
} from "../../Config/FirebaseServices";
import Camera, { FACING_MODES, IMAGE_TYPES } from "react-html5-camera-photo";
import "react-html5-camera-photo/build/css/index.css";
import "./WalkInForm.css";
import QRCode from "qrcode";
import { format } from "date-fns";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, fs, signOut } from "../../Config/Firebase";
import { sendEmailVerification } from "firebase/auth";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDocs,
  getDoc,
  query,
  where,
} from "firebase/firestore";
// Import Firestore functions // Import Firestore functions // Add getDocs, query, and where
import { useNavigate } from "react-router-dom";
const storage = getStorage();

const sendNotification = async (uid, message, controlNumber = null, type = "appointment") => {
  try {
    const docRef = await addDoc(collection(fs, "notifications"), {
      uid,
      message,
      controlNumber,
      timestamp: new Date(),
      read: false,
      type,
    });

    await setDoc(doc(fs, "notifications", docRef.id), {
      notifId: docRef.id,
    }, { merge: true });

  } catch (error) {
    console.error("Failed to send notification:", error);
  }
};


const generateQrCodeImageUrl = async (data, folder, controlNumber) => {
  try {
    const qrDataUrl = await QRCode.toDataURL(data, {
      errorCorrectionLevel: "L",
      color: {
        dark: "#000000", // QR code color
        light: "#FFFFFF00", // Transparent background
      },
      width: 200, // Set the width to 200
      margin: 2, // Set the margin
    });

    const response = await fetch(qrDataUrl);
    const blob = await response.blob();
    const file = new File([blob], `${controlNumber}.png`, {
      type: "image/png",
    });

    const storageRef = ref(storage, `${folder}/${controlNumber}.png`);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error("Failed to generate QR code: ", error);
    throw error;
  }
};

const generateControlNumber = () => {
  const now = new Date();
  return `${now.getFullYear().toString().padStart(4, "0")}${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}${now
      .getHours()
      .toString()
      .padStart(2, "0")}${now.getMinutes().toString().padStart(2, "0")}${now
        .getSeconds()
        .toString()
        .padStart(2, "0")}`;
};

const defaultImageUrl =
  "https://as2.ftcdn.net/v2/jpg/03/49/49/79/1000_F_349497933_Ly4im8BDmHLaLzgyKg2f2yZOvJjBtlw5.jpg";
const EMAIL_DOMAIN = "@gmail.com";

const initialUserData = {
  display_name: "",
  middle_name: "",
  last_name: "",
  dob: "",
  streetAddress: "",
  city: "",
  phone: "",
  gender: "",
  spouse: "",
  spouseOccupation: "",
  childrenNamesAges: "",
  maritalStatus: "",
  employment: "",
  employmentType: "",
  employerName: "",
  employerAddress: "",
  monthlyIncome: "",
  generatedEmail: "",
  generatedPassword: "",
  selectedAssistanceType: "",
  problems: "",
  problemReason: "",
  desiredSolutions: "",
};

const initialScannedDocuments = {
  certificateBarangay: null,
  certificateDSWD: null,
  disqualificationLetterPAO: null,
};

function WalkInForm() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingDocs, setIsUploadingDocs] = useState(false);
  const [scannedDocuments, setScannedDocuments] = useState(
    initialScannedDocuments
  );
  const [customAssistanceType, setCustomAssistanceType] = useState("");
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [currentDocumentType, setCurrentDocumentType] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [credentialsOmitted, setCredentialsOmitted] = useState(false);
  const [isFromAppointment, setIsFromAppointment] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState("");
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
  const [controlNumber, setControlNumber] = useState("");
  const [generatedEmail, setGeneratedEmail] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [appointmentQrCodeUrl, setAppointmentQrCodeUrl] = useState("");
  const [userQrCodeUrl, setUserQrCodeUrl] = useState("");
  const [uid, setUid] = useState("");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const formRef = useRef(null);
  const [reviewData, setReviewData] = useState(initialUserData);
  const [documentDates, setDocumentDates] = useState({
    certificateBarangay: null,
    certificateDSWD: null,
    disqualificationLetterPAO: null,
  });
  const [userData, setUserData] = useState(initialUserData);
  const currentUser = auth.currentUser;
  const [docValidityMessage, setDocValidityMessage] = useState(null);
  const expiredDocs = [];
  const validDocs = [];
  const [updateBarangay, setUpdateBarangay] = useState(false);
  const [updateDSWD, setUpdateDSWD] = useState(false);
  const [updatePAO, setUpdatePAO] = useState(false);
  const [customEmploymentType, setCustomEmploymentType] = useState("");

  const hasExpiredDocuments = () => {
    return Object.values(documentDates || {}).some((dateStr) => {
      if (!dateStr) return true;
      const date = new Date(
        typeof dateStr?.toDate === "function" ? dateStr.toDate() : dateStr
      );
      return (new Date() - date) / (1000 * 60 * 60 * 24 * 30) > 6;
    });
  };

  const handleSubmitDirectly = () => {
    if (hasExpiredDocuments()) {
      setSnackbarMessage(
        "Submission failed: one or more documents are expired."
      );
      setShowSnackbar(true);
      setTimeout(() => setShowSnackbar(false), 3000);
      return;
      const firstInvalid = document.querySelector("input:invalid, select:invalid, textarea:invalid");
      firstInvalid?.focus();

    }

    if (formRef.current) {
      formRef.current.dispatchEvent(
        new Event("submit", { cancelable: true, bubbles: true })
      );
    }
  };

  const loadScannedDocumentsFromUser = (user) => {
    if (user.uploadedImages) {
      setScannedDocuments({
        certificateBarangay: user.uploadedImages.barangayImageUrl || null,
        certificateDSWD: user.uploadedImages.dswdImageUrl || null,
        disqualificationLetterPAO: user.uploadedImages.paoImageUrl || null,
      });

      setDocumentDates({
        certificateBarangay: user.uploadedImages?.barangayImageUrlDateUploaded || null,
        certificateDSWD: user.uploadedImages?.dswdImageUrlDateUploaded || null,
        disqualificationLetterPAO: user.uploadedImages?.paoImageUrlDateUploaded || null,
      });
    }
  };

  useEffect(() => {
    if (uid) {
      console.log("Fetching user with UID:", uid);

      getUserById(uid).then((user) => {
        console.log("Fetched user data:", user);
        if (user) {
          const normalizeEmploymentType = (raw) => {
            if (!raw) return "";
            const trimmed = raw.trim().toLowerCase();
            if (trimmed.includes("lokal"))
              return "Lokal na Trabaho (Local Employer/Agency)";
            if (trimmed.includes("dayuhang"))
              return "Dayuhang Amo (Foreign Employer)";
            if (trimmed.includes("sarili"))
              return "Sa sarili nagttrabaho (Self-Employed)";
            if (trimmed.includes("iba")) return "Iba pa (Others)";
            return raw;
          };

          setUserData({
            display_name: user.display_name || "",
            middle_name: user.middle_name || "",
            last_name: user.last_name || "",
            dob: user.dob ? formatDob(user.dob) : "",
            streetAddress: user.address || "",
            city: user.city || "",
            phone: user.phone?.replace(/^0/, "+63") || "+63",
            maritalStatus: user.maritalStatus || "",
            gender: user.gender || "",
            spouse: user.spouse || "",
            spouseOccupation: user.spouseOccupation || "",
            childrenNamesAges: user.childrenNamesAges || "",
            employment: user.occupation || "",
            employmentType: user.employmentType || "",
            employerName: user.employerName || "",
            employerAddress: user.employerAddress || "",
            monthlyIncome: user.monthlyIncome || "",
            existingEmail: user.email || "",
            generatedEmail: "",
            generatedPassword: "",
            selectedAssistanceType: "",
            problems: "",
            problemReason: "",
            desiredSolutions: "",
          });
          loadScannedDocumentsFromUser(user);
        }
      });
    }
  }, [uid]);

  useEffect(() => {
    if (!userData.phone) {
      setUserData((prevData) => ({
        ...prevData,
        phone: "09",
      }));
    }
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!isSubmitting && step > 1) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [step, isSubmitting]);


  const formatDob = (dob) => {
    if (!dob) return "";
    const date =
      typeof dob?.toDate === "function" ? dob.toDate() : new Date(dob);

    if (isNaN(date.getTime())) return "Invalid Date";

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(date.getDate()).padStart(2, "0")}`;
  };

  useEffect(() => {
    let isMounted = true;

    const fetchUserData = async () => {
      if (!searchTerm) {
        if (isMounted) {
          setUserData(initialUserData);
          setScannedDocuments(initialScannedDocuments);
          setCredentialsOmitted(false);
          setIsFromAppointment(false);
          setUid("");
          setStep(1);
        }
        return;
      }


      try {
        let user;
        if (searchTerm.includes("@")) {
          user = await getUserByEmail(searchTerm);
        } else {
          user = await getUserById(searchTerm);
        }

        const formatDob = (dob) => {
          if (!dob) return "";
          if (dob.toDate) {
            const date = dob.toDate();
            return date.toISOString().split("T")[0];
          }
          const date = new Date(dob);
          return isNaN(date.getTime()) ? "" : date.toISOString().split("T")[0];
        };

        if (user && isMounted) {
          const normalizeEmploymentType = (raw) => {
            if (!raw) return "";
            const trimmed = raw.trim().toLowerCase();
            if (trimmed.includes("lokal"))
              return "Lokal na Trabaho (Local Employer/Agency)";
            if (trimmed.includes("dayuhang"))
              return "Dayuhang Amo (Foreign Employer)";
            if (trimmed.includes("sarili"))
              return "Sa sarili nagttrabaho (Self-Employed)";
            if (trimmed.includes("iba")) return "Iba pa (Others)";
            return raw;
          };

          setUserData({
            display_name: user.display_name || "",
            middle_name: user.middle_name || "",
            last_name: user.last_name || "",
            dob: formatDob(user.dob),
            streetAddress: user.address || "",
            city: user.city || "",
            phone: user.phone || "+63",
            gender: user.gender || "",
            spouse: user.spouse || "",
            spouseOccupation: user.spouseOccupation || "",
            childrenNamesAges: user.childrenNamesAges || "",
            employment: user.occupation || "",
            employmentType: normalizeEmploymentType(user.employmentType),
            employerName: user.employerName || "",
            employerAddress: user.employerAddress || "",
            monthlyIncome: user.monthlyIncome || "",
            existingEmail: user.email || "",
            generatedEmail: "",
            generatedPassword: "",
            selectedAssistanceType: "",
            problems: "",
            problemReason: "",
            desiredSolutions: "",
          });
          loadScannedDocumentsFromUser(user);
          setUid(user.uid); // ensure this is included
          const expiredDocs = [];
          const validDocs = [];

          const checkDocStatus = (dateStr, label) => {
            if (!dateStr) {
              expiredDocs.push(`${label}: Not uploaded`);
              return;
            }
            const date = new Date(
              typeof dateStr?.toDate === "function" ? dateStr.toDate() : dateStr
            );
            const months = (new Date() - date) / (1000 * 60 * 60 * 24 * 30);
            if (months > 6) {
              expiredDocs.push(
                `${label}: Expired (${date.toLocaleDateString()})`
              );
            } else {
              validDocs.push(`${label}: Valid (${date.toLocaleDateString()})`);
            }
          };

          checkDocStatus(
            user.uploadedImages?.barangayImageUrlDateUploaded,
            "Barangay Certificate"
          );
          checkDocStatus(
            user.uploadedImages?.dswdImageUrlDateUploaded,
            "DSWD Certificate"
          );
          checkDocStatus(
            user.uploadedImages?.paoImageUrlDateUploaded,
            "PAO Letter"
          );

          if (expiredDocs.length > 0) {
            const expiredFormatted = expiredDocs
              .map((doc) => `<strong>✗ ${doc}</strong>`)
              .join("<br/>");
            const validFormatted = validDocs
              .map((doc) => `✓ ${doc}`)
              .join("<br/>");

            setDocValidityMessage(`
  <p><strong>Some documents are expired or missing.</strong></p>
  <p>Please review the affected documents below. You will be able to update them in Step 4.</p>
  <br/>
  <strong>Expired or Missing:</strong><br/>
  ${expiredDocs.map((doc) => `✗ ${doc}`).join("<br/>")}
  <br/><br/>
  ${validDocs.length > 0
                ? `<strong>Still Valid:</strong><br/>${validDocs.join("<br/>")}`
                : ""}
`);

            return; // stop form display
          } else {
            setDocValidityMessage(null); // no expired docs
            setStep(1); // proceed to form
          }

          setCredentialsOmitted(true);
          setStep(1);
          setIsFromAppointment(false);
        } else if (isMounted) {
          setUserData(initialUserData);
          setCredentialsOmitted(false);
          setIsFromAppointment(false);
          setUid("");
        }
      } catch (error) {
        console.error("Error fetching user data: ", error);
      }
    };

    fetchUserData();

    return () => {
      isMounted = false;
    };
  }, [searchTerm]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "phone") {
      let formatted = value;

      // If input starts with 09, convert to +63
      if (/^09/.test(value)) {
        formatted = value.replace(/^0/, "+63");
      }

      // If user types +63 incorrectly
      if (!formatted.startsWith("+63")) {
        formatted = "+63" + formatted.replace(/^\+?63?/, "");
      }

      setUserData({ ...userData, phone: formatted });
    } else {
      // ✅ Update all other fields
      setUserData({ ...userData, [name]: value });
    }
  };

  const openImageModal = (url) => {
    setCurrentImageUrl(url);
    setIsModalOpen(true);
  };

  const handleTakePhoto = (dataUri) => {
    setScannedDocuments((prev) => ({
      ...prev,
      [currentDocumentType]: dataUri,
    }));
    setSnackbarMessage(
      `Successfully captured ${currentDocumentType
        .replace(/([A-Z])/g, " $1")
        .trim()}`
    );
    setShowSnackbar(true);
    setTimeout(() => setShowSnackbar(false), 3000);
    const firstInvalid = document.querySelector("input:invalid, select:invalid, textarea:invalid");
    firstInvalid?.focus();

    setShowCamera(false);
  };

  const handleDocumentScan = (documentType) => {
    setCurrentDocumentType(documentType);
    setShowCamera(true);
  };

  const dataURItoBlob = (dataURI) => {
    if (
      !dataURI ||
      typeof dataURI !== "string" ||
      !dataURI.startsWith("data:")
    ) {
      throw new Error("Invalid data URI for document upload.");
    }

    try {
      const byteString = atob(dataURI.split(",")[1]);
      const mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      return new Blob([ab], { type: mimeString });
    } catch (error) {
      throw new Error("Failed to decode Base64 data URI.");
    }
  };

  const signUpAndAuthenticate = async (email, password) => {
    try {
      const tempAuth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(
        tempAuth,
        email,
        password
      );
      const firebaseUid = userCredential.user.uid; // Retrieve the Firebase UID
      return firebaseUid; // Return the UID
    } catch (error) {
      console.error("Error signing up: ", error);
      throw error;
    }
  };

  const handleSubmitWithPrevent = (e) => {
    e.preventDefault();
    handleSubmit();
  };

  const uploadAllDocuments = async (scannedDocs, fullName, controlNumber, uid) => {
    const uploadDocument = async (file, path) => {
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    };

    const uploaded = {};

    for (const [key, label] of Object.entries({
      certificateBarangay: "barangayCertificateOfIndigency",
      certificateDSWD: "dswdCertificateOfIndigency",
      disqualificationLetterPAO: "paoDisqualificationLetter",
    })) {
      const scan = scannedDocs[key];
      if (scan?.startsWith("data:")) {
        const blob = dataURItoBlob(scan);
        const url = await uploadDocument(blob, `konsulta_user_uploads/${uid}/${controlNumber}/${fullName}_${controlNumber}_${label}`);
        uploaded[key] = url;
      } else {
        uploaded[key] = scan || null;
      }
    }

    return uploaded;
  };

  const isFirebaseStorageUrl = (url) => typeof url === "string" && url.startsWith("https://firebasestorage");

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (
        !userData.display_name ||
        !userData.last_name ||
        !userData.dob ||
        !userData.streetAddress ||
        !userData.city ||
        !userData.phone ||
        !userData.gender
      ) {
        throw new Error("All required fields must be filled out.");
      }

      const now = new Date();
      const datetime = format(now, "yyyyMMdd_HHmmss");

      const uploadDocument = async (file, path) => {
        if (file) {
          const storageRef = ref(storage, path);
          const snapshot = await uploadBytes(storageRef, file);
          return await getDownloadURL(storageRef);
        }
        return null;
      };

      const isFirebaseStorageUrl = (url) =>
        typeof url === "string" && url.startsWith("https://");

      const controlNumber = generateControlNumber();
      setControlNumber(controlNumber);

      const controlNumberQrCodeUrl = await generateQrCodeImageUrl(
        controlNumber,
        "appt_qr_codes",
        controlNumber
      );
      setAppointmentQrCodeUrl(controlNumberQrCodeUrl);

      let userQrCodeUrl = null;
      let firebaseUid = uid;
      const message = `Your appointment request with ticket number ${controlNumber} has been submitted successfully. Please wait for the confirmation of the date and type of appointment.`;
      await sendNotification(firebaseUid, message, controlNumber, "appointment");
      // Notify all frontdesk members
      const frontdeskQuery = query(collection(fs, "users"), where("member_type", "==", "frontdesk"));
      const frontdeskSnapshot = await getDocs(frontdeskQuery);

      frontdeskSnapshot.forEach((docSnap) => {
        const frontdeskUid = docSnap.id;
        const adminMessage = `A new Walk-In appointment with Ticket #${controlNumber} has been submitted. .`;
        sendNotification(frontdeskUid, adminMessage, controlNumber, "appointment");
      });

      const fullName = `${userData.display_name} ${userData.middle_name ? userData.middle_name + " " : ""
        }${userData.last_name}`;

      // ✅ Create new user if no UID
      if (!firebaseUid) {
        const email = userData.generatedEmail;
        const password =
          userData.generatedPassword ||
          `${userData.last_name.replace(/\s+/g, "")}!${userData.dob.replace(/-/g, "")}`;

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        firebaseUid = userCredential.user.uid;

        setGeneratedEmail(email);
        setGeneratedPassword(password);

        if (userCredential.user && !userCredential.user.emailVerified) {
          await sendEmailVerification(userCredential.user);
        }

        userQrCodeUrl = await generateQrCodeImageUrl(
          firebaseUid,
          "profile_qr_codes",
          firebaseUid
        );
        setUserQrCodeUrl(userQrCodeUrl);

        const userDataToSave = {
          display_name: userData.display_name,
          middle_name: userData.middle_name,
          last_name: userData.last_name,
          dob: userData.dob,
          phone: userData.phone.startsWith("09")
            ? userData.phone.replace(/^0/, "+63")
            : userData.phone,
          gender: userData.gender,
          maritalStatus: userData.maritalStatus, // <-- add this
          ...(userData.maritalStatus !== "Single" && {
            spouse: userData.spouse,
            spouseOccupation: userData.spouseOccupation,
            childrenNamesAges: userData.childrenNamesAges,
          }),
          email: email,
          city: userData.city,
          member_type: "client",
          user_status: "inactive",
          address: userData.streetAddress,
          created_time: now,
          userQrCode: userQrCodeUrl,
          occupation: userData.employment,
          employmentType:
            userData.employmentType === "Iba pa (Others)"
              ? customEmploymentType
              : userData.employmentType,
          employerName: userData.employerName,
          employerAddress: userData.employerAddress,
          monthlyIncome: userData.monthlyIncome,
        };

        await setDoc(doc(fs, "users", firebaseUid), userDataToSave);
      }

      // ✅ Document upload logic
      let uploadedBarangayUrl = null;
      let uploadedDswdUrl = null;
      let uploadedPaoUrl = null;

      if (scannedDocuments.certificateBarangay?.startsWith("data:")) {
        uploadedBarangayUrl = await uploadDocument(
          dataURItoBlob(scannedDocuments.certificateBarangay),
          `konsulta_user_uploads/${firebaseUid}/${fullName}_${controlNumber}_barangayCertificateOfIndigency`
        );
      } else if (isFirebaseStorageUrl(scannedDocuments.certificateBarangay)) {
        uploadedBarangayUrl = scannedDocuments.certificateBarangay;
      }

      if (scannedDocuments.certificateDSWD?.startsWith("data:")) {
        uploadedDswdUrl = await uploadDocument(
          dataURItoBlob(scannedDocuments.certificateDSWD),
          `konsulta_user_uploads/${firebaseUid}/${fullName}_${controlNumber}_dswdCertificateOfIndigency`
        );
      } else if (isFirebaseStorageUrl(scannedDocuments.certificateDSWD)) {
        uploadedDswdUrl = scannedDocuments.certificateDSWD;
      }

      if (scannedDocuments.disqualificationLetterPAO?.startsWith("data:")) {
        uploadedPaoUrl = await uploadDocument(
          dataURItoBlob(scannedDocuments.disqualificationLetterPAO),
          `konsulta_user_uploads/${firebaseUid}/${fullName}_${controlNumber}_paoDisqualificationLetter`
        );
      } else if (isFirebaseStorageUrl(scannedDocuments.disqualificationLetterPAO)) {
        uploadedPaoUrl = scannedDocuments.disqualificationLetterPAO;
      }

      const uploadedImagesToSave = {};

      if (uploadedBarangayUrl && isFirebaseStorageUrl(uploadedBarangayUrl)) {
        uploadedImagesToSave.barangayImageUrl = uploadedBarangayUrl;
        uploadedImagesToSave.barangayImageUrlDateUploaded = now;
      }
      if (uploadedDswdUrl && isFirebaseStorageUrl(uploadedDswdUrl)) {
        uploadedImagesToSave.dswdImageUrl = uploadedDswdUrl;
        uploadedImagesToSave.dswdImageUrlDateUploaded = now;
      }
      if (uploadedPaoUrl && isFirebaseStorageUrl(uploadedPaoUrl)) {
        uploadedImagesToSave.paoImageUrl = uploadedPaoUrl;
        uploadedImagesToSave.paoImageUrlDateUploaded = now;
      }

      if (Object.keys(uploadedImagesToSave).length > 0) {
        await setDoc(
          doc(fs, "users", firebaseUid),
          { uploadedImages: uploadedImagesToSave },
          { merge: true }
        );
      }

      // ✅ Update UI state
      setDocumentDates({
        certificateBarangay: uploadedBarangayUrl ? now : documentDates.certificateBarangay,
        certificateDSWD: uploadedDswdUrl ? now : documentDates.certificateDSWD,
        disqualificationLetterPAO: uploadedPaoUrl ? now : documentDates.disqualificationLetterPAO,
      });

      // ✅ Save appointment
      const appointmentData = {
        createdDate: now,
        uid: firebaseUid,
        appointmentDetails: {
          appointmentStatus: "pending",
          controlNumber,
          apptType: "Walk-in",
          qrCode: controlNumberQrCodeUrl,
        },
        legalAssistanceRequested: {
          desiredSolutions: userData.desiredSolutions,
          problemReason: userData.problemReason,
          problems: userData.problems,
          selectedAssistanceType:
            userData.selectedAssistanceType === "Other"
              ? customAssistanceType
              : userData.selectedAssistanceType,
        },
      };

      await setDoc(doc(fs, "appointments", controlNumber), appointmentData);

      setIsSubmissionModalOpen(true);
      setSnackbarMessage("Form submitted successfully!");
      setShowSnackbar(true);
      setTimeout(() => setShowSnackbar(false), 4000);

    } catch (error) {
      console.error("Error submitting form: ", error.message);
      setSnackbarMessage(`Failed to submit form. Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
      setShowSnackbar(true);
      setTimeout(() => setShowSnackbar(false), 3000);
      const firstInvalid = document.querySelector("input:invalid, select:invalid, textarea:invalid");
      firstInvalid?.focus();
    }
  };


  useEffect(() => {
    if (!userData.phone) {
      setUserData((prevData) => ({
        ...prevData,
        phone: "+63",
      }));
    }
  }, []);

  const nextStep = () => {
    if (step === 1) {
      if (
        !userData.display_name ||
        !userData.last_name ||
        !userData.dob ||
        !userData.streetAddress ||
        !userData.city ||
        !userData.phone ||
        !userData.gender
      ) {
        setSnackbarMessage(
          "Please fill in all required fields in the Applicant's Profile."
        );
        setShowSnackbar(true);
        setTimeout(() => setShowSnackbar(false), 3000);
        return;
        const firstInvalid = document.querySelector("input:invalid, select:invalid, textarea:invalid");
        firstInvalid?.focus();
      }
    } else if (step === 2) {
      if (
        !userData.employment ||
        !userData.employmentType ||
        !userData.monthlyIncome
      ) {
        setSnackbarMessage(
          "Please fill in all required fields in the Employment Information."
        );
        setShowSnackbar(true);
        setTimeout(() => setShowSnackbar(false), 3000);
        return;
        const firstInvalid = document.querySelector("input:invalid, select:invalid, textarea:invalid");
        firstInvalid?.focus();
      }
    } else if (step === 3) {
      if (
        !userData.selectedAssistanceType ||
        !userData.problems ||
        !userData.problemReason ||
        !userData.desiredSolutions
      ) {
        setSnackbarMessage(
          "Please fill in all required fields in the Legal Assistance Information."
        );
        setShowSnackbar(true);
        setTimeout(() => setShowSnackbar(false), 3000);
        return;
        const firstInvalid = document.querySelector("input:invalid, select:invalid, textarea:invalid");
        firstInvalid?.focus();

      }
    }

    if (step === 2 && isFromAppointment) {
      setStep(4); // Skip step 3 if details were fetched from appointments collection
    } else {
      setStep((prevStep) => prevStep + 1);
    }
  };

  const prevStep = () => setStep((prevStep) => prevStep - 1);

  const getDocStatus = (dateObj) => {
    if (!dateObj) return { status: "N/A", color: "#888" };
    const date = typeof dateObj?.toDate === "function" ? dateObj.toDate() : new Date(dateObj);
    const months = (new Date() - date) / (1000 * 60 * 60 * 24 * 30);
    return months > 6
      ? { status: "Expired", color: "red" }
      : { status: "Valid", color: "green" };
  };

  const formatDate = (dateObj) => {
    if (!dateObj) return "No Upload";
    const date = typeof dateObj?.toDate === "function" ? dateObj.toDate() : new Date(dateObj);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const renderStep = () => {

    switch (step) {
      case 1:
        return (
          <div className="profile-section">
            <h4>
              Profile ng Aplikante{" "}
              <span className="subtitle">(Applicant's Profile)</span>
            </h4>
            <div className="profile-details">
              <div className="form-group">
                <label htmlFor="display_name">
                  Pangalan <span className="subtitle">(First Name)</span>
                  <span style={{ color: "red", marginLeft: "5px" }}>*</span>
                </label>
                <input
                  type="text"
                  id="display_name"
                  name="display_name"
                  value={userData.display_name}
                  placeholder="First Name"
                  onChange={handleChange}
                  required
                  disabled={isFromAppointment || credentialsOmitted}
                />
              </div>
              <div className="form-group">
                <label htmlFor="middle_name">
                  Gitnang Pangalan{" "}
                  <span className="subtitle">(Middle Name)</span>
                </label>
                <input
                  type="text"
                  id="middle_name"
                  name="middle_name"
                  value={userData.middle_name}
                  placeholder="Middle Name"
                  onChange={handleChange}
                  disabled={isFromAppointment || credentialsOmitted}
                />
              </div>
              <div className="form-group">
                <label htmlFor="last_name">
                  Apilyido <span className="subtitle">(Last Name)</span>
                  <span style={{ color: "red", marginLeft: "5px" }}>*</span>
                </label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={userData.last_name}
                  placeholder="Last Name"
                  onChange={handleChange}
                  required
                  disabled={isFromAppointment || credentialsOmitted}
                />
              </div>
              <div className="form-group">
                <label htmlFor="dob">
                  Araw ng Kapanganakan{" "}
                  <span className="subtitle">(Date of Birth)</span>
                  <span style={{ color: "red", marginLeft: "5px" }}>*</span>
                </label>
                <input
                  type="date"
                  id="dob"
                  name="dob"
                  value={userData.dob}
                  onChange={handleChange}
                  required
                  max={new Date().toISOString().split("T")[0]} // Set the maximum date to today
                  disabled={isFromAppointment || credentialsOmitted}
                />
              </div>

              <div className="form-group">
                <label htmlFor="streetAddress">
                  Tirahan <span className="subtitle">(Street Address)</span>
                  <span style={{ color: "red", marginLeft: "5px" }}>*</span>
                </label>
                <input
                  type="text"
                  id="streetAddress"
                  name="streetAddress"
                  value={userData.streetAddress}
                  placeholder="Street Address"
                  onChange={handleChange}
                  required
                  disabled={isFromAppointment || credentialsOmitted}
                />
              </div>
              <div className="form-group">
                <label htmlFor="city">
                  Lungsod / Munisipalidad{" "}
                  <span className="subtitle">(City / Municipality)</span>
                  <span style={{ color: "red", marginLeft: "5px" }}>*</span>
                </label>
                <select
                  id="city"
                  name="city"
                  value={userData.city}
                  onChange={handleChange}
                  required
                  disabled={isFromAppointment || credentialsOmitted}
                >
                  <option value="" disabled>
                    Pumili ng Lungsod (Select City/Municipality)
                  </option>
                  <option value="Angat">Angat</option>
                  <option value="Balagtas">Balagtas</option>
                  <option value="Baliuag">Baliuag</option>
                  <option value="Bocaue">Bocaue</option>
                  <option value="Bulakan">Bulakan</option>
                  <option value="Bustos">Bustos</option>
                  <option value="Calumpit">Calumpit</option>
                  <option value="Doña Remedios Trinidad">
                    Doña Remedios Trinidad
                  </option>
                  <option value="Guiguinto">Guiguinto</option>
                  <option value="Hagonoy">Hagonoy</option>
                  <option value="Marilao">Marilao</option>
                  <option value="Norzagaray">Norzagaray</option>
                  <option value="Obando">Obando</option>
                  <option value="Pandi">Pandi</option>
                  <option value="Paombong">Paombong</option>
                  <option value="Plaridel">Plaridel</option>
                  <option value="Pulilan">Pulilan</option>
                  <option value="San Ildefonso">San Ildefonso</option>
                  <option value="San Miguel">San Miguel</option>
                  <option value="San Rafael">San Rafael</option>
                  <option value="Santa Maria">Santa Maria</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="phone">
                  Numero ng Telepono{" "}
                  <span className="subtitle">(Contact Number)</span>
                  <span style={{ color: "red", marginLeft: "5px" }}>*</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={userData.phone}
                  placeholder="+639XXXXXXXXX"
                  onChange={handleChange}
                  required
                  disabled={isFromAppointment || credentialsOmitted}
                />
              </div>
              <div className="form-group">
                <label htmlFor="gender">
                  Kasarian <span className="subtitle">(Gender)</span>
                  <span style={{ color: "red", marginLeft: "5px" }}>*</span>
                </label>
                <select
                  id="gender"
                  name="gender"
                  value={userData.gender}
                  onChange={handleChange}
                  required
                  disabled={isFromAppointment || credentialsOmitted}
                >
                  <option value="">Pumili ng Kasarian (Select Gender)</option>
                  <option value="Male">Lalaki (Male)</option>
                  <option value="Female">Babae (Female)</option>
                  <option value="Other">Iba pa (Other)</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="maritalStatus">
                  Katayuan sa Buhay <span className="subtitle">(Marital Status)</span>
                  <span style={{ color: "red", marginLeft: "5px" }}>*</span>
                </label>
                <select
                  id="maritalStatus"
                  name="maritalStatus"
                  value={userData.maritalStatus}
                  onChange={handleChange}
                  required
                >
                  <option value="">Pumili ng Katayuan (Status)</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Widowed">Widowed</option>
                  <option value="Separated">Separated</option>
                </select>
              </div>
              {userData.maritalStatus !== "Single" && (
                <>
                  <div className="form-group">
                    <label htmlFor="spouse">
                      Pangalan ng Asawa{" "}
                      <span className="subtitle">(Name of Spouse)</span>
                    </label>
                    <input
                      type="text"
                      id="spouse"
                      name="spouse"
                      value={userData.spouse}
                      placeholder="Name of Spouse"
                      onChange={handleChange}
                      disabled={isFromAppointment || credentialsOmitted}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="spouseOccupation">
                      Trabaho ng Asawa{" "}
                      <span className="subtitle">(Occupation of Spouse)</span>
                    </label>
                    <input
                      type="text"
                      id="spouseOccupation"
                      name="spouseOccupation"
                      value={userData.spouseOccupation}
                      placeholder="Occupation of Spouse"
                      onChange={handleChange}
                      disabled={isFromAppointment || credentialsOmitted}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="childrenNamesAges">
                      Kung kasal, ilagay ang pangalan ng mga anak at edad nila{" "}
                      <span className="subtitle">
                        (If married, write name of children and age)
                      </span>
                    </label>
                    <textarea
                      id="childrenNamesAges"
                      name="childrenNamesAges"
                      value={userData.childrenNamesAges}
                      placeholder="Ilagay ang pangalan at edad ng mga anak (Enter children’s name and age)"
                      onChange={handleChange}
                      disabled={isFromAppointment || credentialsOmitted}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="employment-section">
            <h4>
              Impormasyon patungkol sa Trabaho{" "}
              <span className="subtitle">(Employment Information)</span>
            </h4>
            <div className="employment-details">
              <div className="form-group">
                <label htmlFor="employment">
                  Hanapbuhay <span className="subtitle">(Occupation)</span>
                  <span style={{ color: "red", marginLeft: "5px" }}>*</span>
                </label>
                <input
                  type="text"
                  id="employment"
                  name="employment"
                  value={userData.employment}
                  placeholder="Occupation"
                  onChange={handleChange}
                  required
                  disabled={isFromAppointment || credentialsOmitted}
                />
              </div>
              <div className="form-group">
                <label htmlFor="employmentType">
                  Klase ng Trabaho{" "}
                  <span className="subtitle">(Type of Employment)</span>
                  <span style={{ color: "red", marginLeft: "5px" }}>*</span>
                </label>
                <select
                  id="employmentType"
                  name="employmentType"
                  value={userData.employmentType}
                  onChange={handleChange}
                  required
                  disabled={isFromAppointment || credentialsOmitted}
                >
                  <option value="" disabled>
                    Pumili ng Klase ng Trabaho (Select Type of Employment)
                  </option>
                  <option value="Lokal na Trabaho (Local Employer/Agency)">
                    Lokal na Trabaho (Local Employer/Agency)
                  </option>
                  <option value="Dayuhang Amo (Foreign Employer)">
                    Dayuhang Amo (Foreign Employer)
                  </option>
                  <option value="Sa sarili nagttrabaho (Self-Employed)">
                    Sa sarili nagttrabaho (Self-Employed)
                  </option>
                  <option value="Iba pa (Others)">Iba pa (Others)</option>
                </select>
              </div>
              {userData.employmentType === "Iba pa (Others)" && (
                <div className="form-group mt-2">
                  <label htmlFor="customEmploymentType">Iba pang detalye ng trabaho:</label>
                  <input
                    type="text"
                    id="customEmploymentType"
                    name="customEmploymentType"
                    value={customEmploymentType}
                    onChange={(e) => setCustomEmploymentType(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className="form-group">
                <label htmlFor="employerName">
                  Pangalan ng Employer{" "}
                  <span className="subtitle">(Employer's Name)</span>
                </label>
                <input
                  type="text"
                  id="employerName"
                  name="employerName"
                  value={userData.employerName}
                  placeholder="Employer's Name"
                  onChange={handleChange}
                  disabled={isFromAppointment || credentialsOmitted}
                />
              </div>
              <div className="form-group">
                <label htmlFor="employerAddress">
                  Tirahan ng Employer{" "}
                  <span className="subtitle">(Employer's Address)</span>
                </label>
                <input
                  type="text"
                  id="employerAddress"
                  name="employerAddress"
                  value={userData.employerAddress}
                  placeholder="Employer's Address"
                  onChange={handleChange}
                  disabled={isFromAppointment || credentialsOmitted}
                />
              </div>
              <div className="form-group">
                <label htmlFor="monthlyIncome">
                  Kita ng Pamilya Buwan-buwan{" "}
                  <span className="subtitle">(Monthly Family Income)</span>
                  <span style={{ color: "red", marginLeft: "5px" }}>*</span>
                </label>
                <input
                  type="number"
                  id="monthlyIncome"
                  name="monthlyIncome"
                  value={userData.monthlyIncome}
                  placeholder="Monthly Family Income"
                  onChange={handleChange}
                  required
                  disabled={isFromAppointment || credentialsOmitted}
                />
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="legal-assistance-section">
            <h4>
              Klase ng tulong legal{" "}
              <span className="subtitle">
                (Nature of Legal Assistance Requested)
              </span>
            </h4>
            <div className="legal-assistance-details">
              <div className="form-group">
                <label htmlFor="selectedAssistanceType">
                  Klase ng tulong legal{" "}
                  <span className="subtitle">(Nature of Legal Assistance)</span>
                  <span style={{ color: "red", marginLeft: "5px" }}>*</span>
                </label>
                <select
                  id="selectedAssistanceType"
                  name="selectedAssistanceType"
                  value={userData.selectedAssistanceType}
                  onChange={(e) => {
                    handleChange(e);
                    if (e.target.value !== "Other") {
                      setCustomAssistanceType("");
                    }
                  }}
                  required
                >
                  <option value="" disabled>Nature of Legal Assistance</option>
                  <option value="Payong Legal (Legal Advice)">Payong Legal (Legal Advice)</option>
                  <option value="Legal na Representasyon (Legal Representation)">
                    Legal na Representasyon (Legal Representation)
                  </option>
                  <option value="Pag gawa ng Legal na Dokumento (Drafting of Legal Documents)">
                    Pag gawa ng Legal na Dokumento (Drafting of Legal Documents)
                  </option>
                  <option value="Other">Iba pa (Other)</option>
                </select>

              </div>
              {userData.selectedAssistanceType === "Other" && (
                <div className="form-group">
                  <label htmlFor="customAssistanceType">
                    Tukuyin ang klase ng tulong legal (Please specify)
                    <span style={{ color: "red", marginLeft: "5px" }}>*</span>
                  </label>
                  <input
                    type="text"
                    id="customAssistanceType"
                    name="customAssistanceType"
                    value={customAssistanceType}
                    placeholder="Ilagay dito ang klase ng tulong legal"
                    onChange={(e) => setCustomAssistanceType(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className="form-group">
                <label htmlFor="problems">
                  Ano ang iyong problema?{" "}
                  <span className="subtitle">(Problem/s or complaint/s)</span>
                  <span style={{ color: "red", marginLeft: "5px" }}>*</span>
                </label>
                <textarea
                  id="problems"
                  name="problems"
                  value={userData.problems} // ✅ retain input
                  placeholder="Ilagay ang iyong problema (Enter your problem/s or complaint/s)"
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="problemReason">
                  Bakit o papaano nagkaroon ng ganoong problema?{" "}
                  <span style={{ color: "red", marginLeft: "5px" }}>*</span>
                  <span className="subtitle">
                    (Why or how did such problem/s arise?)
                  </span>
                </label>
                <textarea
                  id="problemReason"
                  name="problemReason"
                  value={userData.problemReason} // ✅ retain input
                  placeholder="Ilagay ang dahilan ng problema (Enter the reason why or how the problem/s arise)"
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="desiredSolutions">
                  Ano ang mga maaaring solusyon na gusto mong ibigay ng Abogado
                  sa iyo?{" "}
                  <span className="subtitle">
                    (What possible solution/s would you like to be given by the
                    lawyer to you?)
                  </span>
                  <span style={{ color: "red", marginLeft: "5px" }}>*</span>
                </label>
                <textarea
                  id="desiredSolutions"
                  name="desiredSolutions"
                  value={userData.desiredSolutions} // ✅ retain input
                  placeholder="Ilagay ang mga maaaring solusyon (Enter the possible solution/s would you like)"
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="credentials-section">
            {!uid && !userData.existingEmail && (
              <>
                <div className="form-group">
                  <label htmlFor="generatedEmail">
                    Magbigay ng Email <span className="subtitle">(Provide Email)</span>
                    <span style={{ color: "red", marginLeft: "5px" }}>*</span>
                  </label>
                  <input
                    type="email"
                    id="generatedEmail"
                    name="generatedEmail"
                    placeholder="Email"
                    value={userData.generatedEmail}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="generatedPassword">
                    Password <span className="subtitle">(Create or Use Suggested)</span>
                  </label>
                  <input
                    type="text"
                    id="generatedPassword"
                    name="generatedPassword"
                    placeholder="Enter or use suggested password"
                    value={
                      userData.generatedPassword ||
                      `${userData.last_name.replace(/\s+/g, "")}!${userData.dob.replace(/-/g, "")}`
                    }
                    onChange={handleChange}
                  />
                </div>
              </>
            )}

            <h4>Document Requirements</h4>
            {false ? (
              <div className="document-preview">
                {[
                  { key: "certificateBarangay", label: "Barangay Certificate" },
                  { key: "certificateDSWD", label: "DSWD Certificate" },
                  { key: "disqualificationLetterPAO", label: "PAO Disqualification Letter" },
                ].map(({ key, label }) => (
                  <div key={key} style={{ marginBottom: "20px", textAlign: "center" }}>
                    {scannedDocuments[key] ? (
                      <>
                        <img
                          src={scannedDocuments[key]}
                          alt={label}
                          onClick={() => openImageModal(scannedDocuments[key])}
                          className="document-thumbnail"
                          style={{ cursor: "pointer", marginBottom: "8px" }}
                        />
                        {documentDates[key] && (
                          <p style={{ fontSize: "13px", marginTop: "4px", color: "#555" }}>
                            Uploaded on: <strong>{formatDate(documentDates[key])}</strong><br />
                            Status:{" "}
                            <strong style={{ color: getDocStatus(documentDates[key]).color }}>
                              {getDocStatus(documentDates[key]).status}
                            </strong>
                          </p>
                        )}
                      </>
                    ) : (
                      <p style={{ fontStyle: "italic" }}>{label} not uploaded</p>
                    )}
                    <div style={{ marginTop: "8px" }}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setScannedDocuments((prev) => ({
                                ...prev,
                                [key]: reader.result,
                              }));
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </div>
                    <div>
                      <button
                        type="button"
                        className="scan-button"
                        onClick={() => handleDocumentScan(key)}
                        style={{ marginTop: "5px", fontSize: "14px" }}
                      >
                        Re-upload or Recapture {label}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="form-group document-upload-group">
                {[
                  {
                    key: "certificateBarangay",
                    label: "Certificate of Indigency from Barangay",
                  },
                  {
                    key: "certificateDSWD",
                    label: "Certificate of Indigency from DSWD",
                  },
                  {
                    key: "disqualificationLetterPAO",
                    label: "Disqualification Letter from PAO",
                  },
                ].map(({ key, label }) => (
                  <div key={key} style={{ marginBottom: "20px" }}>
                    <label style={{ fontWeight: "bold", display: "block", marginBottom: "5px" }}>
                      {label}
                      <span style={{ color: "red", marginLeft: "5px" }}>*</span>
                    </label>

                    {/* Preview image */}
                    {scannedDocuments[key] && (
                      <img
                        src={scannedDocuments[key]}
                        alt={label}
                        style={{
                          width: "200px",
                          height: "auto",
                          borderRadius: "6px",
                          border: "1px solid #ccc",
                          marginBottom: "10px",
                          cursor: "pointer",
                        }}
                        onClick={() => openImageModal(scannedDocuments[key])}
                      />
                    )}

                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      {/* Scan button */}
                      <button
                        type="button"
                        className="scan-button"
                        onClick={() => handleDocumentScan(key)}
                      >
                        Scan/Take Photo
                      </button>

                      {/* Upload button */}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setScannedDocuments((prev) => ({
                                ...prev,
                                [key]: reader.result,
                              }));
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const navigate = useNavigate(); // Initialize navigate

  const handleModalClose = async () => {
    setIsSubmissionModalOpen(false);
    setUserData(initialUserData);
    setScannedDocuments(initialScannedDocuments);
    setControlNumber("");
    setGeneratedEmail("");
    setGeneratedPassword("");
    setAppointmentQrCodeUrl("");
    setUserQrCodeUrl("");
    setUid("");
    setSearchTerm("");

    // ✅ Only logout if user is newly created
    if (!uid) {
      await signOut(auth);
      navigate("/"); // Go back to home or login
    } else {
      // ✅ Just reset the form and stay
      setSnackbarMessage("Appointment recorded. You're still signed in.");
      setShowSnackbar(true);
      setTimeout(() => setShowSnackbar(false), 3000);
    }
  };

  return (
    <div className="dashboard-container">
      <SideNavBar />
      <div className="main-content">
        <br />
        <h3>Walk-In Form</h3>
        <br />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by email or UID"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setUserData(initialUserData);
              setScannedDocuments(initialScannedDocuments);
              setCredentialsOmitted(false);
              setIsFromAppointment(false);
              setUid("");
              setStep(1);
              setDocValidityMessage(null);
              setGeneratedEmail("");
              setGeneratedPassword("");
              setControlNumber("");
              setAppointmentQrCodeUrl("");
              setUserQrCodeUrl("");
              formRef.current?.reset?.();
            }}
            style={{
              marginLeft: "10px",
              backgroundColor: "#580049",
              padding: "10px 12px",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        )}
        {searchTerm && userData.display_name && (

          <>
            <h6>
              <em>
                {userData.display_name} {userData.middle_name}{" "}
                {userData.last_name}
              </em>
            </h6>
            <br />
          </>
        )}
        {docValidityMessage && step === 1 ? (
          <div
            style={{
              backgroundColor: "#fff0f0",
              border: "1px solid #f44336",
              borderLeft: "5px solid #f44336",
              padding: "20px",
              borderRadius: "10px",
              color: "#d32f2f",
              boxShadow: "0 2px 8px rgba(244, 67, 54, 0.2)",
              marginTop: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                height="24"
                viewBox="0 0 24 24"
                width="24"
                fill="#f44336"
                style={{ marginRight: "10px" }}
              >
                <path d="M1 21h22L12 2 1 21z" />
                <path d="M12 16h-1v-4h2v4h-1zm0 4h-1v-2h2v2h-1z" fill="#fff" />
              </svg>
              <h4 style={{ margin: 0, fontSize: "18px" }}>Document Issue</h4>
            </div>
            <div
              dangerouslySetInnerHTML={{ __html: docValidityMessage }}
              style={{
                fontSize: "15px",
                lineHeight: "1.5",
                fontFamily: "inherit",
              }}
            ></div>
            <div style={{ marginTop: "20px", textAlign: "center" }}>
              <button
                type="button"
                onClick={() => setDocValidityMessage(null)}
                style={{
                  backgroundColor: "#580049",
                  color: "#fff",
                  padding: "10px 20px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Continue to Update Documents
              </button>
            </div>
          </div>
        ) : (
          <form ref={formRef} onSubmit={handleSubmitWithPrevent} className="walkin-form">
            <div className="progress-container">
              <div className="progress-labels">
                <span className={step >= 1 ? "active" : ""}>1. Profile</span>
                <span className={step >= 2 ? "active" : ""}>2. Employment</span>
                <span className={step >= 3 ? "active" : ""}>3. Legal Help</span>
                <span className={step === 4 ? "active" : ""}>4. Credentials</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${(step - 1) * 33.33 + 25}%` }}></div>
              </div>
            </div>

            {renderStep()}

            <div className="form-navigation" style={{ display: "flex", justifyContent: "space-between", marginTop: "20px" }}>
              <div>
                {step > 1 && (
                  <button type="button" onClick={prevStep}>
                    Previous
                  </button>
                )}
              </div>
              <div>
                {step < 4 && (
                  <button type="button" onClick={nextStep}>
                    Next
                  </button>
                )}
                {step === 4 && (
                  <button
                    type="button"
                    className="submit-button"
                    disabled={isSubmitting}
                    onClick={() => {
                      const latestReviewData = { ...userData };
                      const now = new Date();

                      // Check document presence and prepare dates
                      const latestDocumentDates = {
                        certificateBarangay: scannedDocuments.certificateBarangay ? now : null,
                        certificateDSWD: scannedDocuments.certificateDSWD ? now : null,
                        disqualificationLetterPAO: scannedDocuments.disqualificationLetterPAO ? now : null,
                      };

                      setReviewData(latestReviewData);
                      setDocumentDates(latestDocumentDates);
                      setShowReviewModal(true);
                    }}
                  >
                    <>
                      {isSubmitting ? (
                        <span><span className="spinner" /> Submitting...</span>
                      ) : (
                        "Submit Walk-In Form"
                      )}
                    </>
                  </button>
                )}
              </div>
            </div>

          </form>
        )}

        {showSnackbar && <div className="snackbar">{snackbarMessage}</div>}
        {showCamera && (
          <div className="camera-container">
            <div className="camera-header">
              <h4>
                Capture {currentDocumentType.replace(/([A-Z])/g, " $1").trim()}
              </h4>
              <button
                onClick={() => setShowCamera(false)}
                className="close-camera-button"
              >
                Close
              </button>
            </div>
            <Camera
              onTakePhoto={(dataUri) => {
                handleTakePhoto(dataUri);
              }}
              idealFacingMode={FACING_MODES.ENVIRONMENT}
              imageType={IMAGE_TYPES.JPG}
              isImageMirror={false}
              sizeFactor={1}
            />
          </div>
        )}

        <ImageModal
          isOpen={isModalOpen}
          url={currentImageUrl}
          onClose={() => setIsModalOpen(false)}
        />

        <SubmissionModal
          isOpen={isSubmissionModalOpen}
          onClose={handleModalClose}
          controlNumber={controlNumber}
          appointmentQrCodeUrl={appointmentQrCodeUrl}
          userQrCodeUrl={userQrCodeUrl}
          generatedEmail={generatedEmail}
          generatedPassword={generatedPassword}
        />
        <ReviewModal
          isOpen={showReviewModal}
          onCancel={() => setShowReviewModal(false)}
          onConfirm={() => {
            setShowReviewModal(false);
            handleSubmit();
          }}
          userData={reviewData}
          customEmploymentType={customEmploymentType}
          customAssistanceType={customAssistanceType}
          scannedDocuments={scannedDocuments}
          documentDates={documentDates}
          updateBarangay={updateBarangay}
          setUpdateBarangay={setUpdateBarangay}
          updateDSWD={updateDSWD}
          setUpdateDSWD={setUpdateDSWD}
          updatePAO={updatePAO}
          setUpdatePAO={setUpdatePAO}
        />
      </div>
    </div>
  );
}

const ImageModal = ({ isOpen, url, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="image-container">
          <img src={url} className="fullscreen-image" alt="Document" />
        </div>
        <button onClick={onClose} className="close-button">
          &times;
        </button>
      </div>
    </div>
  );
};

const SubmissionModal = ({
  isOpen,
  onClose,
  controlNumber,
  appointmentQrCodeUrl,
  userQrCodeUrl,
  generatedEmail,
  generatedPassword,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          padding: "30px",
          borderRadius: "12px",
          maxWidth: "450px",
          width: "100%",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
          backgroundColor: "#fff",
          textAlign: "center",
        }}
      >
        <h3 className="print-exclude" style={{ marginBottom: "20px" }}>
          Submission Successful!
        </h3>

        <div
          className="qr-section"
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "40px",
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <img
              src={appointmentQrCodeUrl}
              alt="Appointment QR"
              style={{ width: "120px", height: "120px" }}
            />
            <p style={{ marginTop: "8px", fontWeight: "500" }}>
              Appointment QR
            </p>
          </div>
          {userQrCodeUrl && (
            <div style={{ textAlign: "center" }}>
              <img
                src={userQrCodeUrl}
                alt="User QR"
                style={{ width: "120px", height: "120px" }}
              />
              <p style={{ marginTop: "8px", fontWeight: "500" }}>User QR</p>
            </div>
          )}
        </div>

        <div
          className="info-section"
          style={{ fontSize: "15px", lineHeight: "1.6" }}
        >
          <p>
            <strong>Ticket #:</strong> {controlNumber}
          </p>
          {generatedEmail && (
            <p>
              <strong>Email:</strong> {generatedEmail}
            </p>
          )}
          {generatedPassword && (
            <p>
              <strong>Password:</strong> {generatedPassword}
            </p>
          )}
          <p>
            <strong>Created Date:</strong> {new Date().toLocaleDateString()}
          </p>
        </div>

        <div
          className="button-section print-exclude"
          style={{ marginTop: "20px" }}
        >
          <button
            onClick={() => window.print()}
            className="print-button"
            style={{
              background: "#28a745",
              border: "none",
              padding: "10px 20px",
              color: "#fff",
              borderRadius: "6px",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            Print
          </button>
        </div>
      </div>
    </div>
  );
};
function ReviewModal({
  onConfirm,
  onCancel,
  userData,
  customEmploymentType,
  customAssistanceType,
  documentDates,
  hasExpiredDocs,
  isUploadingDocs,
  isOpen,
  updateBarangay,
  setUpdateBarangay,
  updateDSWD,
  setUpdateDSWD,
  updatePAO,
  setUpdatePAO,
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => document.body.classList.remove("modal-open");
  }, [isOpen]);

  if (!isOpen) return null;

  const getDocStatus = (dateObj) => {
    if (!dateObj) return { status: "N/A", color: "#888" };
    const date = typeof dateObj?.toDate === "function" ? dateObj.toDate() : new Date(dateObj);
    const months = (new Date() - date) / (1000 * 60 * 60 * 24 * 30);
    return months > 6
      ? { status: "Expired", color: "red" }
      : { status: "Valid", color: "green" };
  };

  const formatDate = (dateObj) => {
    if (!dateObj) return "No Upload";
    const date = typeof dateObj?.toDate === "function" ? dateObj.toDate() : new Date(dateObj);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h4 style={{ textAlign: "center" }}>Review Your Information</h4>
        <div className="scroll-box">

          {/* Section 1: Applicant Profile */}
          <div className="review-section">
            <h4>1. Applicant’s Profile</h4>
            <div className="review-row"><span className="review-label">Full Name:</span><span className="review-value">{userData.display_name} {userData.middle_name} {userData.last_name}</span></div>
            <div className="review-row"><span className="review-label">Date of Birth:</span><span className="review-value">{formatDate(userData.dob)}</span></div>
            <div className="review-row"><span className="review-label">Address:</span><span className="review-value">{userData.streetAddress}</span></div>
            <div className="review-row"><span className="review-label">City:</span><span className="review-value">{userData.city}</span></div>
            <div className="review-row"><span className="review-label">Phone:</span><span className="review-value">{userData.phone}</span></div>
            <div className="review-row"><span className="review-label">Gender:</span><span className="review-value">{userData.gender}</span></div>
            <div className="review-row"><span className="review-label">Spouse:</span><span className="review-value">{userData.spouse || "N/A"}</span></div>
            <div className="review-row"><span className="review-label">Spouse Occupation:</span><span className="review-value">{userData.spouseOccupation || "N/A"}</span></div>
            <div className="review-row"><span className="review-label">Children:</span><span className="review-value">{userData.childrenNamesAges}</span></div>
          </div>

          {/* Section 2: Employment Info */}
          <div className="review-section">
            <h4>2. Employment Information</h4>
            <div className="review-row"><span className="review-label">Occupation:</span><span className="review-value">{userData.employment}</span></div>
            <div className="review-row">
              <span className="review-label">Type of Employment:</span>
              <span className="review-value">
                {userData.employmentType === "Iba pa (Others)"
                  ? customEmploymentType
                  : userData.employmentType}
              </span>
            </div>
            <div className="review-row"><span className="review-label">Employer:</span><span className="review-value">{userData.employerName}</span></div>
            <div className="review-row"><span className="review-label">Employer Address:</span><span className="review-value">{userData.employerAddress}</span></div>
            <div className="review-row"><span className="review-label">Monthly Income:</span><span className="review-value">{userData.monthlyIncome ? `₱${Number(userData.monthlyIncome).toLocaleString()}` : "N/A"}</span></div>
          </div>

          {/* Section 3: Legal Assistance */}
          <div className="review-section">
            <h4>3. Legal Assistance Requested</h4>
            <div className="review-row">
              <span className="review-label">Nature of Assistance:</span>
              <span className="review-value">
                {userData.selectedAssistanceType === "Other"
                  ? customAssistanceType
                  : userData.selectedAssistanceType}
              </span>
            </div>
            <div className="review-row"><span className="review-label">Problems:</span><span className="review-value">{userData.problems}</span></div>
            <div className="review-row"><span className="review-label">Reason:</span><span className="review-value">{userData.problemReason}</span></div>
            <div className="review-row"><span className="review-label">Desired Solutions:</span><span className="review-value">{userData.desiredSolutions}</span></div>
          </div>

          {/* Section 4: Documents */}
          <div className="review-section">
            <h4>4. Documents</h4>
            {[
              { label: "Barangay Certificate", key: "certificateBarangay" },
              { label: "DSWD Certificate", key: "certificateDSWD" },
              { label: "PAO Disqualification Letter", key: "disqualificationLetterPAO" },
            ].map((doc) => {
              const status = getDocStatus(documentDates?.[doc.key]);
              return (
                <div className="review-row" key={doc.key}>
                  <span className="review-label">{doc.label}:</span>
                  <span className="review-value">
                    {formatDate(documentDates?.[doc.key])}{" "}
                    <strong style={{ color: status.color }}>({status.status})</strong>

                    {status.status === "Expired" && (
                      <div style={{ marginTop: "8px" }}>
                        <label>
                          <input
                            type="radio"
                            name={`update_${doc.key}`}
                            value="yes"
                            checked={
                              doc.key === "certificateBarangay" ? updateBarangay :
                                doc.key === "certificateDSWD" ? updateDSWD :
                                  doc.key === "disqualificationLetterPAO" ? updatePAO : false
                            }
                            onChange={() => {
                              if (doc.key === "certificateBarangay") setUpdateBarangay(true);
                              if (doc.key === "certificateDSWD") setUpdateDSWD(true);
                              if (doc.key === "disqualificationLetterPAO") setUpdatePAO(true);
                            }}
                          />{" "}
                          Update
                        </label>
                        <label style={{ marginLeft: "12px" }}>
                          <input
                            type="radio"
                            name={`update_${doc.key}`}
                            value="no"
                            checked={
                              doc.key === "certificateBarangay" ? !updateBarangay :
                                doc.key === "certificateDSWD" ? !updateDSWD :
                                  doc.key === "disqualificationLetterPAO" ? !updatePAO : true
                            }
                            onChange={() => {
                              if (doc.key === "certificateBarangay") setUpdateBarangay(false);
                              if (doc.key === "certificateDSWD") setUpdateDSWD(false);
                              if (doc.key === "disqualificationLetterPAO") setUpdatePAO(false);
                            }}
                          />{" "}
                          Skip
                        </label>
                      </div>
                    )}
                  </span>
                </div>
              );
            })}
            {hasExpiredDocs && (
              <div style={{ marginTop: "12px" }}>
                <p style={{ color: "red", fontWeight: "bold" }}>
                  You must upload valid (non-expired) documents to proceed.
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
            <button onClick={onCancel} className="cancel-button" disabled={isUploadingDocs}>
              Cancel
            </button>

            {!hasExpiredDocs && (
              isUploadingDocs ? (
                <button className="submit-button" disabled>
                  <span className="spinner" /> Uploading documents...
                </button>
              ) : (
                <button onClick={onConfirm} className="submit-button">
                  Confirm and Submit
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


export default WalkInForm;
