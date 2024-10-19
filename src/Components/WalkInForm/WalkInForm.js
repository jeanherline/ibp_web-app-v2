import React, { useState, useEffect } from "react";
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
import { auth, fs } from "../../Config/Firebase";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore"; // Add getDocs, query, and where

const storage = getStorage();

const signUpAndAuthenticate = async (email, password) => {
  try {
    const currentUser = auth.currentUser; // Store the current user
    const tempAuth = getAuth(); // Create a temporary auth instance
    const newUserCredential = await createUserWithEmailAndPassword(
      tempAuth,
      email,
      password
    );

    await tempAuth.signOut(); // Sign out the temporary auth instance
    if (currentUser) {
      await auth.updateCurrentUser(currentUser); // Restore the current user session
    }
    return newUserCredential.user;
  } catch (error) {
    console.error("Error signing up: ", error);
    throw error;
  }
};

const generateQrCodeImageUrl = async (data, folder, controlNumber) => {
  try {
    const qrDataUrl = await QRCode.toDataURL(data, {
      errorCorrectionLevel: "L",
      color: {
        dark: "#000000", // QR code color
        light: "rgba(0,0,0,0)", // Transparent background
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

const initialUserData = {
  display_name: "",
  middle_name: "",
  last_name: "",
  dob: "",
  streetAddress: "",
  city: "",
  phone: "",
  gender: "",
  spouseName: "",
  spouseOccupation: "",
  childrenNamesAges: "",
  employment: "",
  employmentType: "",
  employerName: "",
  employerAddress: "",
  monthlyIncome: "",
  existingEmail: "",
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
  const [userData, setUserData] = useState(initialUserData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scannedDocuments, setScannedDocuments] = useState(
    initialScannedDocuments
  );
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

  useEffect(() => {
    let isMounted = true;

    const fetchUserData = async () => {
      if (!searchTerm) {
        if (isMounted) {
          setUserData(initialUserData);
          setCredentialsOmitted(false);
          setIsFromAppointment(false);
        }
        return;
      }
      try {
        let appointment, user;
        if (searchTerm.includes("@")) {
          appointment = await getAppointmentByEmail(searchTerm);
          if (!appointment) {
            user = await getUserByEmail(searchTerm);
          }
        } else {
          appointment = await getAppointmentByUid(searchTerm);
          if (!appointment) {
            user = await getUserById(searchTerm);
          }
        }

        const formatDob = (dob) => {
          if (!dob) return "";
          const date = new Date(dob);
          return date.toISOString().split("T")[0]; // Format as YYYY-MM-DD
        };

        if (appointment) {
          const fullNameArray =
            appointment.applicantProfile.fullName.split(" ");
          const [display_name, middle_name, last_name] = fullNameArray;
          if (isMounted) {
            setUserData({
              display_name: display_name || "",
              middle_name: middle_name || "",
              last_name: last_name || "",
              dob: formatDob(appointment.applicantProfile.dob),
              streetAddress: appointment.applicantProfile.address || "",
              city: appointment.applicantProfile.city || "",
              phone: appointment.applicantProfile.contactNumber || "",
              gender: appointment.applicantProfile.selectedGender || "",
              spouseName: appointment.applicantProfile.spouseName || "",
              spouseOccupation:
                appointment.applicantProfile.spouseOccupation || "",
              childrenNamesAges:
                appointment.applicantProfile.childrenNamesAges || "",
              employment: appointment.employmentProfile?.occupation || "",
              employmentType:
                appointment.employmentProfile?.kindOfEmployment || "",
              employerName: appointment.employmentProfile?.employerName || "",
              employerAddress:
                appointment.employmentProfile?.employerAddress || "",
              monthlyIncome: appointment.employmentProfile?.monthlyIncome || "",
              existingEmail: "",
              generatedEmail: "",
              generatedPassword: "",
              selectedAssistanceType:
                appointment.legalAssistanceRequested?.selectedAssistanceType ||
                "",
              problems: appointment.legalAssistanceRequested?.problems || "",
              problemReason:
                appointment.legalAssistanceRequested?.problemReason || "",
              desiredSolutions:
                appointment.legalAssistanceRequested?.desiredSolutions || "",
            });
            setCredentialsOmitted(true);
            setIsFromAppointment(true);
            setStep(3); // Skip to step 3 if data is from appointment
            setUid(appointment.applicantProfile.uid); // Set UID from appointment
          }
        } else if (user) {
          if (isMounted) {
            setUserData({
              display_name: user.display_name || "",
              middle_name: user.middle_name || "",
              last_name: user.last_name || "",
              dob: formatDob(user.dob),
              streetAddress: user.streetAddress || "",
              city: user.city || "",
              phone: user.phone || "",
              gender: user.gender || "",
              spouseName: user.spouse || "",
              spouseOccupation: user.spouseOccupation || "",
              childrenNamesAges: "",
              employment: "",
              employmentType: "",
              employerName: "",
              employerAddress: "",
              monthlyIncome: "",
              existingEmail: "",
              generatedEmail: "",
              generatedPassword: "",
              selectedAssistanceType: "",
              problems: "",
              problemReason: "",
              desiredSolutions: "",
            });
            setCredentialsOmitted(true);
            setIsFromAppointment(false);
            setUid(user.uid); // Set UID from user
          }
        } else {
          if (isMounted) {
            setUserData(initialUserData);
            setCredentialsOmitted(false);
            setIsFromAppointment(false);
            setUid(""); // Clear UID
          }
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
    setUserData({ ...userData, [name]: value });
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
    setShowCamera(false);
  };

  const handleDocumentScan = (documentType) => {
    setCurrentDocumentType(documentType);
    setShowCamera(true);
  };

  const dataURItoBlob = (dataURI) => {
    const byteString = atob(dataURI.split(",")[1]);
    const mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate required fields
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

      const controlNumber = generateControlNumber();
      setControlNumber(controlNumber); // Store control number in state
      const controlNumberQrCodeUrl = await generateQrCodeImageUrl(
        controlNumber,
        "appt_qr_codes",
        controlNumber
      );

      setAppointmentQrCodeUrl(controlNumberQrCodeUrl); // Store appointment QR code URL in state

      let userQrCodeUrl = null;
      let user = null;

      if (!uid) {
        const email =
          userData.existingEmail === "yes"
            ? userData.generatedEmail
            : `${userData.display_name[0].toLowerCase()}${
                userData.middle_name
                  ? userData.middle_name[0].toLowerCase()
                  : ""
              }${userData.last_name
                .replace(/\s+/g, "")
                .toLowerCase()}${userData.dob.replace(/-/g, "")}@gmail.com`;
        const password = `${userData.last_name.replace(
          /\s+/g,
          ""
        )}!${userData.dob.replace(/-/g, "")}`;
        setGeneratedEmail(email); // Store generated email in state
        setGeneratedPassword(password); // Store generated password in state
        user = await signUpAndAuthenticate(email, password);
        const userQrCodeUrl = await generateQrCodeImageUrl(
          user.uid,
          "profile_qr_codes",
          controlNumber
        );

        setUserQrCodeUrl(userQrCodeUrl); // Store user QR code URL in state
        setUid(user.uid); // Set UID from newly created user

        const userDataToSave = {
          uid: user.uid,
          display_name: userData.display_name,
          middle_name: userData.middle_name,
          last_name: userData.last_name,
          dob: userData.dob,
          phone: userData.phone,
          gender: userData.gender,
          spouse: userData.spouseName,
          spouseOccupation: userData.spouseOccupation,
          email: email,
          city: userData.city,
          member_type: "client",
          user_status: "active",
          created_time: now,
          userQrCode: userQrCodeUrl,
        };
        await setDoc(doc(fs, "users", user.uid), userDataToSave);
      }

      // Validate UID
      if (!user && !uid) {
        throw new Error("User UID is not set. Unable to create appointment.");
      }

      const currentUid = user ? user.uid : uid;

      const barangayImageUrl = await uploadDocument(
        dataURItoBlob(scannedDocuments.certificateBarangay),
        `konsulta_user_uploads/${currentUid}/${controlNumber}/${fullName}_${controlNumber}_barangayCertificateOfIndigency`
      );
      const dswdImageUrl = await uploadDocument(
        dataURItoBlob(scannedDocuments.certificateDSWD),
        `konsulta_user_uploads/${currentUid}/${controlNumber}/${fullName}_${controlNumber}_certificateDSWD.png`
      );
      const paoImageUrl = await uploadDocument(
        dataURItoBlob(scannedDocuments.disqualificationLetterPAO),
        `konsulta_user_uploads/${currentUid}/${controlNumber}/${fullName}_${controlNumber}_disqualificationLetterPAO.png`
      );

      const appointmentData = {
        applicantProfile: {
          uid: currentUid,
          address: userData.streetAddress,
          city: userData.city,
          childrenNamesAges: userData.childrenNamesAges,
          contactNumber: userData.phone,
          dob: userData.dob,
          fullName: `${userData.display_name} ${
            userData.middle_name ? userData.middle_name + " " : ""
          }${userData.last_name}`,
          selectedGender: userData.gender,
          spouseName: userData.spouseName,
          spouseOccupation: userData.spouseOccupation,
        },
        appointmentDetails: {
          appointmentStatus: "pending",
          controlNumber,
          apptType: "Walk-in",
          createdDate: now,
          read: "false",
          qrCode: controlNumberQrCodeUrl,
        },
        legalAssistanceRequested: {
          desiredSolutions: userData.desiredSolutions,
          problemReason: userData.problemReason,
          problems: userData.problems,
          selectedAssistanceType: userData.selectedAssistanceType,
        },
        employmentProfile: {
          employerAddress: userData.employerAddress,
          employerName: userData.employerName,
          kindOfEmployment: userData.employmentType,
          monthlyIncome: userData.monthlyIncome,
          occupation: userData.employment,
        },
        uploadedImages: {
          barangayImageUrl,
          dswdImageUrl,
          paoImageUrl,
        },
      };

      await setDoc(doc(fs, "appointments", controlNumber), appointmentData);

      setSnackbarMessage("Walk-In form has been successfully submitted.");
      setUserData(initialUserData);
      setScannedDocuments(initialScannedDocuments);
      setIsSubmissionModalOpen(true); // Show submission modal

      const notificationsCollection = collection(fs, "notifications");

      // Notify the newly created user or searched user
      await addDoc(notificationsCollection, {
        uid: currentUid,
        message: `You have created a new appointment. Ticket# ${controlNumber}`,
        type: "appointment",
        read: false,
        timestamp: now,
      });

      // Notify all head lawyers
      const headLawyersSnapshot = await getDocs(
        query(collection(fs, "users"), where("member_type", "==", "head"))
      );
      headLawyersSnapshot.forEach(async (doc) => {
        await addDoc(notificationsCollection, {
          uid: doc.id,
          message: `A new appointment request has been submitted by ${
            userData.display_name
          } ${userData.middle_name ? userData.middle_name + " " : ""}${
            userData.last_name
          } with Ticket Number ${controlNumber} and is awaiting your approval.`,
          type: "appointment",
          read: false,
          timestamp: now,
        });
      });

      // Notify all frontdesk members
      const frontDeskSnapshot = await getDocs(
        query(collection(fs, "users"), where("member_type", "==", "frontdesk"))
      );
      frontDeskSnapshot.forEach(async (doc) => {
        await addDoc(notificationsCollection, {
          uid: doc.id,
          message: `A new walk-in appointment has been created by ${
            userData.display_name
          } ${userData.middle_name ? userData.middle_name + " " : ""}${
            userData.last_name
          } with Ticket Number ${controlNumber}.`,
          type: "appointment",
          read: false,
          timestamp: now,
        });
      });
    } catch (error) {
      console.error("Error submitting form: ", error.message);
      setSnackbarMessage(`Failed to submit form. Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
      setShowSnackbar(true);
      setTimeout(() => setShowSnackbar(false), 3000);
    }
  };

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
      }
    }

    if (step === 2 && isFromAppointment) {
      setStep(4); // Skip step 3 if details were fetched from appointments collection
    } else {
      setStep((prevStep) => prevStep + 1);
    }
  };

  const prevStep = () => setStep((prevStep) => prevStep - 1);

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
                >
                  <option value="" selected disabled>
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
                  type="number"
                  id="phone"
                  name="phone"
                  value={userData.phone}
                  placeholder="Contact Number"
                  onChange={handleChange}
                  required
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
                >
                  <option value="">Pumili ng Kasarian (Select Gender)</option>
                  <option value="Male">Lalaki (Male)</option>
                  <option value="Female">Babae (Female)</option>
                  <option value="Other">Iba pa (Other)</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="spouseName">
                  Pangalan ng Asawa{" "}
                  <span className="subtitle">(Name of Spouse)</span>
                </label>
                <input
                  type="text"
                  id="spouseName"
                  name="spouseName"
                  value={userData.spouseName}
                  placeholder="Name of Spouse"
                  onChange={handleChange}
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
                />
              </div>
              <div className="form-group">
                <label htmlFor="childrenNamesAges">
                  Kung kasal, ilagay ang pangalan ng mga anak at edad nila
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
                />
              </div>
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
                >
                  <option value="" selected disabled>
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
                  onChange={handleChange}
                  required
                >
                  <option value="" selected disabled>
                    Nature of Legal Assistance
                  </option>
                  <option value="Payong Legal (Legal Advice)">
                    Payong Legal (Legal Advice)
                  </option>
                  <option value="Legal na Representasyon (Legal Representation)">
                    Legal na Representasyon (Legal Representation)
                  </option>
                  <option value="Pag gawa ng Legal na Dokumento (Drafting of Legal Documents)">
                    Pag gawa ng Legal na Dokumento (Drafting of Legal Documents)
                  </option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="problems">
                  Ano ang iyong problema?{" "}
                  <span className="subtitle">(Problem/s or complaint/s)</span>
                  <span style={{ color: "red", marginLeft: "5px" }}>*</span>
                </label>
                <textarea
                  id="problems"
                  name="problems"
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
            {!credentialsOmitted && (
              <>
                <h4>
                  Kredensyal <span className="subtitle">(Credentials)</span>
                </h4>
                <div className="form-group">
                  <label>
                    Mayroon na bang Email?{" "}
                    <span className="subtitle">
                      (Already Have an Existing Email?)
                    </span>
                  </label>
                  <div className="form-group-inline radio-group">
                    <input
                      type="radio"
                      id="emailYes"
                      name="existingEmail"
                      value="yes"
                      onChange={handleChange}
                    />
                    <label htmlFor="emailYes">
                      Oo <span className="subtitle">(Yes)</span>
                    </label>
                    <input
                      type="radio"
                      id="emailNo"
                      name="existingEmail"
                      value="no"
                      onChange={handleChange}
                    />
                    <label htmlFor="emailNo">
                      Hindi <span className="subtitle">(No)</span>
                    </label>
                  </div>
                  {userData.existingEmail === "yes" && (
                    <>
                      <br />
                      <div className="form-group">
                        <label htmlFor="generatedEmail">
                          Magbigay ng Email{" "}
                          <span className="subtitle">(Provide Email)</span>
                          <span style={{ color: "red", marginLeft: "5px" }}>
                            *
                          </span>
                        </label>
                        <input
                          type="email"
                          id="generatedEmail"
                          name="generatedEmail"
                          placeholder="Email"
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="generatedPassword">
                          Generated Password
                        </label>
                        <input
                          type="text"
                          id="generatedPassword"
                          name="generatedPassword"
                          value={`${userData.last_name.replace(
                            /\s+/g,
                            ""
                          )}!${userData.dob.replace(/-/g, "")}`}
                          readOnly
                        />
                      </div>
                    </>
                  )}
                  {userData.existingEmail === "no" && (
                    <>
                      <br />
                      <div className="form-group">
                        <label htmlFor="generatedEmail">Generated Email</label>
                        <input
                          type="text"
                          id="generatedEmail"
                          name="generatedEmail"
                          value={`${userData.display_name[0].toLowerCase()}${
                            userData.middle_name
                              ? userData.middle_name[0].toLowerCase()
                              : ""
                          }${userData.last_name
                            .replace(/\s+/g, "")
                            .toLowerCase()}${userData.dob.replace(
                            /-/g,
                            ""
                          )}@gmail.com`}
                          readOnly
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="generatedPassword">
                          Generated Password
                        </label>
                        <input
                          type="text"
                          id="generatedPassword"
                          name="generatedPassword"
                          value={`${userData.last_name.replace(
                            /\s+/g,
                            ""
                          )}!${userData.dob.replace(/-/g, "")}`}
                          readOnly
                        />
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
            <h4>Capturing of Document Requirements</h4>
            <div className="form-group scan-buttons">
              <button
                type="button"
                className="scan-button"
                onClick={() => handleDocumentScan("certificateBarangay")}
              >
                Capture Certificate of Indigency from Barangay
                <span style={{ color: "red", marginLeft: "5px" }}>*</span>
              </button>
              <button
                type="button"
                className="scan-button"
                onClick={() => handleDocumentScan("certificateDSWD")}
              >
                Capture Certificate of Indigency from DSWD
                <span style={{ color: "red", marginLeft: "5px" }}>*</span>
              </button>
              <button
                type="button"
                className="scan-button"
                onClick={() => handleDocumentScan("disqualificationLetterPAO")}
              >
                Capture Disqualification Letter from PAO
                <span style={{ color: "red", marginLeft: "5px" }}>*</span>
              </button>
            </div>

            <div className="scanned-documents">
              <h4>Captured Documents</h4>
              <div className="documents-grid">
                {scannedDocuments.certificateBarangay && (
                  <div className="document-thumbnail">
                    <img
                      src={scannedDocuments.certificateBarangay}
                      alt="Certificate of Indigency from Barangay"
                      onClick={(e) => {
                        e.preventDefault();
                        openImageModal(scannedDocuments.certificateBarangay);
                      }}
                    />
                    <p>Certificate of Indigency from Barangay</p>
                  </div>
                )}
                {scannedDocuments.certificateDSWD && (
                  <div className="document-thumbnail">
                    <img
                      src={scannedDocuments.certificateDSWD}
                      alt="Certificate of Indigency from DSWD"
                      onClick={(e) => {
                        e.preventDefault();
                        openImageModal(scannedDocuments.certificateDSWD);
                      }}
                    />
                    <p>Certificate of Indigency from DSWD</p>
                  </div>
                )}
                {scannedDocuments.disqualificationLetterPAO && (
                  <div className="document-thumbnail">
                    <img
                      src={scannedDocuments.disqualificationLetterPAO}
                      alt="Disqualification Letter from PAO"
                      onClick={(e) => {
                        e.preventDefault();
                        openImageModal(
                          scannedDocuments.disqualificationLetterPAO
                        );
                      }}
                    />
                    <p>Disqualification Letter from PAO</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const handleModalClose = () => {
    setIsSubmissionModalOpen(false);
    setUserData(initialUserData); // Clear the form state
    setScannedDocuments(initialScannedDocuments); // Clear scanned documents
    setControlNumber(""); // Clear control number
    setGeneratedEmail(""); // Clear generated email
    setGeneratedPassword(""); // Clear generated password
    setAppointmentQrCodeUrl(""); // Clear appointment QR code URL
    setUserQrCodeUrl(""); // Clear user QR code URL
    setUid(""); // Clear UID
    setSearchTerm(""); // Clear search term
    window.location.reload(); // Reload the page
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
        <form onSubmit={handleSubmit} className="walkin-form">
          {renderStep()}
          <div className="form-navigation">
            {step > 1 && (
              <button type="button" onClick={prevStep}>
                Previous
              </button>
            )}
            {step < 4 && (
              <button type="button" onClick={nextStep}>
                Next
              </button>
            )}
            {step === 4 && (
              <button
                type="submit"
                className="submit-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit Walk-In Form"}
              </button>
            )}
          </div>
        </form>
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
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="close-button-position print-exclude"
        >
          &times;
        </button>
        <h4 className="print-exclude">Submission Successful!</h4>
        <div
          className="qr-section"
          style={{ justifyContent: userQrCodeUrl ? "space-between" : "center" }}
        >
          <div>
            <img src={appointmentQrCodeUrl} alt="Appointment QR" />
            <p>Appointment QR</p>
          </div>
          {userQrCodeUrl && (
            <div>
              <img src={userQrCodeUrl} alt="User QR" />
              <p>User QR</p>
            </div>
          )}
        </div>
        <div className="info-section">
          <p>Ticket #: {controlNumber}</p>
          {generatedEmail && <p>Email: {generatedEmail}</p>}
          <p>Created Date: {new Date().toLocaleDateString()}</p>
          {generatedPassword && <p>Password: {generatedPassword}</p>}
        </div>
        <div className="button-section print-exclude">
          <button onClick={() => window.print()} className="print-button">
            Print
          </button>
        </div>
      </div>
    </div>
  );
};

export default WalkInForm;
