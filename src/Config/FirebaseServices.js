import {
  collection,
  query,
  where,
  getDocs,
  limit,
  startAfter,
  startAt,
  orderBy,
  doc,
  updateDoc,
  getDoc,
  addDoc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  Timestamp,
} from "firebase/firestore"; // Import necessary functions directly from Firebase Firestore
import { fs, storage, signOut } from "./Firebase"; // Import fs from your Firebase configuration file
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { toPng } from "html-to-image";
import { QRCodeCanvas } from "qrcode.react";
import ReactDOMServer from "react-dom/server";

const getAppointments = async (
  statusFilter,
  lastVisible,
  pageSize = 7,
  searchText = "",
  assistanceFilter = "all"
) => {
  let queryRef = collection(fs, "appointments");

  // Apply filters as necessary
  if (statusFilter && statusFilter !== "all") {
    queryRef = query(
      queryRef,
      where("appointmentDetails.appointmentStatus", "==", statusFilter)
    );
  }

  if (assistanceFilter && assistanceFilter !== "all") {
    queryRef = query(
      queryRef,
      where("legalAssistanceRequested.selectedAssistanceType", "==", assistanceFilter)
    );
  }

  // Apply search text filtering
  if (searchText) {
    queryRef = query(
      queryRef,
      where("applicantProfile.fullName", ">=", searchText),
      where("applicantProfile.fullName", "<=", searchText + "\uf8ff")
    );
  }

  queryRef = query(queryRef, orderBy("appointmentDetails.createdDate", "desc"));

  // Handle pagination with lastVisible doc
  if (lastVisible) {
    queryRef = query(queryRef, startAfter(lastVisible), limit(pageSize));
  } else {
    queryRef = query(queryRef, limit(pageSize));
  }

  const querySnapshot = await getDocs(queryRef);

  return {
    data: querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })),
    firstDoc: querySnapshot.docs[0], // Store first doc for "previous" navigation
    lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1], // Store last doc for "next" navigation
    total: querySnapshot.size,
  };
};


const getLawyerCalendar = async (assignedLawyer) => {
  const appointmentsRef = collection(fs, "appointments");
  const q = query(
    appointmentsRef,
    where("appointmentDetails.appointmentStatus", "==", "scheduled"),
    where("appointmentDetails.assignedLawyer", "==", assignedLawyer)
  );
  const querySnapshot = await getDocs(q);

  const bookedSlots = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.appointmentDetails?.appointmentDate) {
      bookedSlots.push({
        appointmentDate: data.appointmentDetails.appointmentDate.toDate(),
        fullName: data.applicantProfile?.fullName,
        contactNumber: data.applicantProfile?.contactNumber,
      });
    }
  });

  return bookedSlots;
};

const aptsLawyerCalendar = async (
  statusFilters,
  lastVisible,
  pageSize = 7,
  searchText = "",
  assignedLawyer = "",
  assistanceFilter = "all",
  isPrevious = false
) => {
  try {
    let queryRef = collection(fs, "appointments");

    const updatedStatusFilters = ["done", "scheduled"];
    queryRef = query(
      queryRef,
      where("appointmentDetails.appointmentStatus", "in", updatedStatusFilters),
      where("appointmentDetails.assignedLawyer", "==", assignedLawyer)
    );

    if (assistanceFilter !== "all") {
      queryRef = query(
        queryRef,
        where(
          "legalAssistanceRequested.selectedAssistanceType",
          "==",
          assistanceFilter
        )
      );
    }

    queryRef = query(
      queryRef,
      orderBy("appointmentDetails.createdDate", "desc"),
      limit(pageSize)
    );

    if (lastVisible) {
      queryRef = isPrevious
        ? query(
            queryRef,
            startAt(lastVisible?.appointmentDetails?.controlNumber || "")
          )
        : query(
            queryRef,
            startAfter(lastVisible?.appointmentDetails?.controlNumber || "")
          );
    }

    const querySnapshot = await getDocs(queryRef);

    const filtered = querySnapshot.docs.filter(
      (doc) =>
        doc
          .data()
          .applicantProfile?.fullName?.toLowerCase()
          .includes(searchText.toLowerCase()) ||
        doc
          .data()
          .applicantProfile?.address?.toLowerCase()
          .includes(searchText.toLowerCase()) ||
        doc.data().applicantProfile?.contactNumber?.includes(searchText) ||
        doc.data().appointmentDetails?.controlNumber?.includes(searchText) ||
        doc
          .data()
          .legalAssistanceRequested?.selectedAssistanceType?.toLowerCase()
          .includes(searchText.toLowerCase())
    );

    const totalQuery = await getDocs(
      query(
        collection(fs, "appointments"),
        where(
          "appointmentDetails.appointmentStatus",
          "in",
          updatedStatusFilters
        ),
        where("appointmentDetails.assignedLawyer", "==", assignedLawyer)
      )
    );

    return {
      data: filtered.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data.applicantProfile,
          ...data.employmentProfile,
          ...data.legalAssistanceRequested,
          ...data.uploadedImages,
          createdDate: data.appointmentDetails?.createdDate,
          appointmentStatus: data.appointmentDetails?.appointmentStatus,
          controlNumber: data.appointmentDetails?.controlNumber,
          appointmentDate: data.appointmentDetails?.appointmentDate,
          clientEligibility: data.clientEligibility,
          appointmentDetails: data.appointmentDetails,
        };
      }),
      total: totalQuery.size,
      firstDoc: querySnapshot.docs[0],
      lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1],
    };
  } catch (error) {
    console.error("Failed to fetch appointments:", error);
    throw error;
  }
};

const aptsCalendar = async (
  statusFilters,
  lastVisible,
  pageSize = 7,
  searchText = "",
  assistanceFilter = "all",
  isPrevious = false
) => {
  try {
    let queryRef = collection(fs, "appointments");

    // Ensure statusFilters include "done" and "scheduled"
    const updatedStatusFilters = ["done", "scheduled"];
    queryRef = query(
      queryRef,
      where("appointmentDetails.appointmentStatus", "in", updatedStatusFilters)
    );

    if (assistanceFilter !== "all") {
      queryRef = query(
        queryRef,
        where(
          "legalAssistanceRequested.selectedAssistanceType",
          "==",
          assistanceFilter
        )
      );
    }

    queryRef = query(
      queryRef,
      orderBy("appointmentDetails.createdDate", "desc"),
      limit(pageSize)
    );

    if (lastVisible) {
      queryRef = isPrevious
        ? query(
            queryRef,
            startAt(lastVisible?.appointmentDetails?.controlNumber || "")
          )
        : query(
            queryRef,
            startAfter(lastVisible?.appointmentDetails?.controlNumber || "")
          );
    }

    const querySnapshot = await getDocs(queryRef);

    const filtered = querySnapshot.docs.filter(
      (doc) =>
        doc
          .data()
          .applicantProfile?.fullName?.toLowerCase()
          .includes(searchText.toLowerCase()) ||
        doc
          .data()
          .applicantProfile?.address?.toLowerCase()
          .includes(searchText.toLowerCase()) ||
        doc.data().applicantProfile?.contactNumber?.includes(searchText) ||
        doc.data().appointmentDetails?.controlNumber?.includes(searchText) ||
        doc
          .data()
          .legalAssistanceRequested?.selectedAssistanceType?.toLowerCase()
          .includes(searchText.toLowerCase())
    );

    const totalQuery = await getDocs(
      query(
        collection(fs, "appointments"),
        where(
          "appointmentDetails.appointmentStatus",
          "in",
          updatedStatusFilters
        )
      )
    );

    return {
      data: filtered.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data.applicantProfile,
          ...data.employmentProfile,
          ...data.legalAssistanceRequested,
          ...data.uploadedImages,
          createdDate: data.appointmentDetails?.createdDate,
          appointmentStatus: data.appointmentDetails?.appointmentStatus,
          controlNumber: data.appointmentDetails?.controlNumber,
          appointmentDate: data.appointmentDetails?.appointmentDate,
          clientEligibility: data.clientEligibility,
          appointmentDetails: data.appointmentDetails,
        };
      }),
      total: totalQuery.size,
      firstDoc: querySnapshot.docs[0],
      lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1],
    };
  } catch (error) {
    console.error("Failed to fetch appointments:", error);
    throw error;
  }
};

const getLawyerAppointments = (
  filter,
  lastVisible,
  pageSize,
  searchText,
  natureOfLegalAssistanceFilter,
  currentUser,
  callback
) => {
  try {
    let queryRef = collection(fs, "appointments");

    // Apply appointment status filter
    if (filter && filter !== "all") {
      queryRef = query(
        queryRef,
        where("appointmentDetails.appointmentStatus", "==", filter)
      );
    }

    if (
      natureOfLegalAssistanceFilter &&
      natureOfLegalAssistanceFilter !== "all"
    ) {
      queryRef = query(
        queryRef,
        where(
          "legalAssistanceRequested.selectedAssistanceType",
          "==",
          natureOfLegalAssistanceFilter
        )
      );
    }

    // Ensure only appointments assigned to the current user are fetched
    if (currentUser?.uid) {
      queryRef = query(
        queryRef,
        where("appointmentDetails.assignedLawyer", "==", currentUser.uid)
      );
    }

    // Order by createdDate and limit results for pagination
    queryRef = query(
      queryRef,
      orderBy("appointmentDetails.createdDate", "desc"),
      limit(pageSize)
    );

    // Handle pagination
    if (lastVisible) {
      queryRef = query(queryRef, startAfter(lastVisible));
    }

    // Use onSnapshot for real-time updates
    return onSnapshot(queryRef, (querySnapshot) => {
      const filtered = querySnapshot.docs.filter((doc) => {
        const data = doc.data();
        return (
          data.applicantProfile?.fullName
            ?.toLowerCase()
            .includes(searchText.toLowerCase()) ||
          data.applicantProfile?.address
            ?.toLowerCase()
            .includes(searchText.toLowerCase()) ||
          data.applicantProfile?.contactNumber?.includes(searchText) ||
          data.appointmentDetails?.controlNumber?.includes(searchText) ||
          data.legalAssistanceRequested?.selectedAssistanceType
            ?.toLowerCase()
            .includes(searchText.toLowerCase())
        );
      });

      // Map the filtered data and trigger callback
      const appointments = filtered.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data.applicantProfile,
          ...data.employmentProfile,
          ...data.legalAssistanceRequested,
          ...data.uploadedImages,
          createdDate: data.appointmentDetails?.createdDate,
          appointmentStatus: data.appointmentDetails?.appointmentStatus,
          controlNumber: data.appointmentDetails?.controlNumber,
          appointmentDate: data.appointmentDetails?.appointmentDate,
          clientEligibility: data.clientEligibility,
          appointmentDetails: data.appointmentDetails,
          rescheduleHistory: data.rescheduleHistory || [],  // Ensure rescheduleHistory is included
        };
      });

      callback({
        data: appointments,
        total: querySnapshot.size,
        firstDoc: querySnapshot.docs[0],
        lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1],
      });
    });
  } catch (error) {
    console.error("Failed to fetch appointments:", error);
    throw error;
  }
};

export const generateControlNumber = () => {
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

export const getAdminAppointments = async (
  filter,
  lastVisible,
  pageSize,
  searchText,
  natureOfLegalAssistanceFilter,
  currentUser,
  appointmentStatus,
  assignedLawyer
) => {
  try {
    let queryRef = collection(fs, "appointments");

    // Apply appointment status filter
    if (filter && filter !== "all") {
      queryRef = query(
        queryRef,
        where("appointmentDetails.appointmentStatus", "==", filter)
      );
    }

    if (natureOfLegalAssistanceFilter !== "all") {
      queryRef = query(
        queryRef,
        where(
          "legalAssistanceRequested.selectedAssistanceType",
          "==",
          natureOfLegalAssistanceFilter
        )
      );
    }

    if (assignedLawyer) {
      queryRef = query(
        queryRef,
        where("appointmentDetails.assignedLawyer", "==", assignedLawyer)
      );
    }

    // Order by controlNumber and limit results for pagination
    queryRef = query(
      queryRef,
      orderBy("appointmentDetails.createdDate", "desc"),
      limit(pageSize)
    );

    // Handle pagination
    if (lastVisible) {
      queryRef = query(queryRef, startAfter(lastVisible));
    }

    const querySnapshot = await getDocs(queryRef);

    // Filter results by searchText, if any
    const filtered = querySnapshot.docs.filter((doc) => {
      const data = doc.data();
      return (
        data.applicantProfile?.fullName
          ?.toLowerCase()
          .includes(searchText.toLowerCase()) ||
        data.applicantProfile?.address
          ?.toLowerCase()
          .includes(searchText.toLowerCase()) ||
        data.applicantProfile?.contactNumber?.includes(searchText) ||
        data.appointmentDetails?.controlNumber?.includes(searchText) ||
        data.legalAssistanceRequested?.selectedAssistanceType
          ?.toLowerCase()
          .includes(searchText.toLowerCase())
      );
    });

    // Manually count total documents matching the filters
    let totalQueryRef = collection(fs, "appointments");
    if (filter && filter !== "all") {
      totalQueryRef = query(
        totalQueryRef,
        where("appointmentDetails.appointmentStatus", "==", filter)
      );
    }
    if (natureOfLegalAssistanceFilter !== "all") {
      totalQueryRef = query(
        totalQueryRef,
        where(
          "legalAssistanceRequested.selectedAssistanceType",
          "==",
          natureOfLegalAssistanceFilter
        )
      );
    }
    if (assignedLawyer) {
      totalQueryRef = query(
        totalQueryRef,
        where("appointmentDetails.assignedLawyer", "==", assignedLawyer)
      );
    }
    const totalQuerySnapshot = await getDocs(totalQueryRef);
    const total = totalQuerySnapshot.size;

    return {
      data: filtered.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data.applicantProfile,
          ...data.employmentProfile,
          ...data.legalAssistanceRequested,
          ...data.uploadedImages,
          createdDate: data.appointmentDetails?.createdDate,
          appointmentStatus: data.appointmentDetails?.appointmentStatus,
          controlNumber: data.appointmentDetails?.controlNumber,
          appointmentDate: data.appointmentDetails?.appointmentDate,
          clientEligibility: data.clientEligibility,
          appointmentDetails: data.appointmentDetails,
        };
      }),
      total: total,
      firstDoc: querySnapshot.docs[0],
      lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1],
    };
  } catch (error) {
    console.error("Failed to fetch appointments:", error);
    throw error;
  }
};

const updateAppointment = async (appointmentId, updatedData) => {
  const appointmentRef = doc(fs, "appointments", appointmentId);
  await updateDoc(appointmentRef, updatedData);
};

export const getLawyerBookedSlots = async (lawyerId) => {
  const snapshot = await getDocs(
    query(
      collection(fs, "appointments"),
      where("appointmentDetails.assignedLawyer", "==", lawyerId)
    )
  );

  const slots = snapshot.docs
    .map((doc) => doc.data().appointmentDetails?.appointmentDate)
    .filter((date) => date)
    .map((date) => date.toDate());

  return slots;
};

export const getBookedSlots = (callback) => {
  const appointmentsRef = collection(fs, "appointments");
  const q = query(
    appointmentsRef,
    where("appointmentDetails.appointmentStatus", "==", "scheduled")
  );

  return onSnapshot(q, (querySnapshot) => {
    const bookedSlots = [];
    querySnapshot.forEach((doc) => {
      const appointmentData = doc.data();
      if (appointmentData.appointmentDetails?.appointmentDate) {
        bookedSlots.push(
          appointmentData.appointmentDetails.appointmentDate.toDate()
        );
      }
    });
    if (typeof callback === "function") {
      callback(bookedSlots);
    }
  });
};

export const getCalendar = async () => {
  const appointmentsRef = collection(fs, "appointments");
  const q = query(
    appointmentsRef,
    where("appointmentDetails.appointmentStatus", "==", "scheduled")
  );
  const querySnapshot = await getDocs(q);

  const bookedSlots = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.appointmentDetails?.appointmentDate) {
      bookedSlots.push({
        appointmentDate: data.appointmentDetails.appointmentDate.toDate(), // Convert Firestore Timestamp to JavaScript Date
        fullName: data.applicantProfile?.fullName, // Fetch fullName from applicantProfile
        contactNumber: data.applicantProfile?.contactNumber, // Fetch contactNumber from applicantProfile
      });
    }
  });

  return bookedSlots;
};

const getUsers = async (
  statusFilter,
  filterType,
  cityFilter,
  searchText,
  lastVisible,
  pageSize,
  pageNumber = 1
) => {
  try {
    let queryRef = collection(fs, "users");

    if (statusFilter && statusFilter !== "all") {
      queryRef = query(queryRef, where("user_status", "==", statusFilter));
    }

    if (filterType) {
      queryRef = query(queryRef, where("member_type", "==", filterType));
    }

    if (cityFilter && cityFilter !== "all") {
      queryRef = query(queryRef, where("city", "==", cityFilter));
    }

    if (searchText) {
      queryRef = query(
        queryRef,
        where("display_name", ">=", searchText),
        where("display_name", "<=", searchText + "\uf8ff")
      );
    }

    if (lastVisible) {
      queryRef = query(queryRef, limit(pageSize), startAfter(lastVisible));
    } else {
      queryRef = query(queryRef, limit(pageSize));
    }

    const querySnapshot = await getDocs(queryRef);
    const users = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    const lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];

    return { users, lastVisibleDoc };
  } catch (error) {
    console.error("Failed to fetch users:", error);
    throw error;
  }
};


const getUsersCount = async (
  statusFilter,
  filterType,
  cityFilter,
  searchText
) => {
  try {
    let queryRef = collection(fs, "users");

    if (statusFilter !== "all") {
      queryRef = query(queryRef, where("user_status", "==", statusFilter));
    }

    if (filterType) {
      queryRef = query(queryRef, where("member_type", "==", filterType));
    }

    if (cityFilter !== "all") {
      queryRef = query(queryRef, where("city", "==", cityFilter));
    }

    if (searchText) {
      queryRef = query(
        queryRef,
        where("display_name", ">=", searchText),
        where("display_name", "<=", searchText + "\uf8ff")
      );
    }

    const querySnapshot = await getDocs(queryRef);
    return querySnapshot.size;
  } catch (error) {
    console.error("Failed to fetch users count:", error);
    throw error;
  }
};

const updateUser = async (id, userData) => {
  try {
    const userRef = doc(fs, "users", id);
    await updateDoc(userRef, userData);
  } catch (error) {
    console.error("Failed to update user:", error);
    throw error;
  }
};

const addUser = async (userData) => {
  const {
    display_name,
    middle_name,
    last_name,
    dob,
    email,
    password,
    city,
    member_type,
    user_status,
  } = userData;

  const auth = getAuth();
  try {
    // Create user with email and password
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    // Get the user's UID
    const uid = user.uid;

    // Reference to the users collection
    const userCollectionRef = collection(fs, "users");

    // Create a document in Firestore with the UID as the document ID
    const userDocRef = doc(userCollectionRef, uid);
    await setDoc(userDocRef, {
      display_name: display_name,
      middle_name: middle_name,
      last_name: last_name,
      dob: dob, // Assuming dob is a Date object or a valid Firestore timestamp
      email: email,
      password: password,
      city: city,
      member_type: member_type,
      user_status: user_status || "active", // Defaulting to "active" if user_status is not provided
      created_time: serverTimestamp(),
      uid: uid,
    });

    // Sign out the user after creation
    await signOut(auth);
  } catch (error) {
    console.error("Error creating user:", error);
    // Handle errors here
  }
};

export const sendNotification = async (message, uid, type, controlNumber) => {
  try {
    await addDoc(collection(fs, "notifications"), {
      message: message,
      read: false,
      timestamp: Timestamp.fromDate(new Date()),
      type: type,
      uid: uid,
      controlNumber: controlNumber
    });
  } catch (error) {
    console.error("Error sending notification:", error);
  }
};


export const createAppointment = async (appointmentData) => {
  try {
    const appointmentRef = doc(collection(fs, "appointments"));
    await setDoc(appointmentRef, appointmentData);
    return appointmentRef.id;
  } catch (error) {
    console.error("Error creating appointment: ", error.message);
    throw error;
  }
};

export const getHeadLawyerUid = async () => {
  const usersRef = collection(fs, "users");
  const q = query(usersRef, where("member_type", "==", "headLawyer"));
  
  try {
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      // Assuming there is only one head lawyer
      const headLawyer = querySnapshot.docs[0].data();
      return headLawyer.uid;
    } else {
      console.error("No head lawyer found.");
      return null;
    }
  } catch (error) {
    console.error("Error fetching head lawyer UID:", error);
    return null;
  }
};

export const getAppointmentByUid = async (uid) => {
  const q = query(
    collection(fs, "appointments"),
    where("applicantProfile.uid", "==", uid)
  );
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    return querySnapshot.docs[0].data(); // return the first matching appointment
  }
  return null;
};

export const getAppointmentByEmail = async (email) => {
  const q = query(
    collection(fs, "appointments"),
    where("applicantProfile.email", "==", email)
  );
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    return querySnapshot.docs[0].data(); // return the first matching appointment
  }
  return null;
};

export const getUserById = async (userId) => {
  const userRef = doc(fs, "users", userId);
  const userDoc = await getDoc(userRef);
  if (userDoc.exists()) {
    return userDoc.data();
  } else {
    return null;
  }
};

export const getUserByEmail = async (email) => {
  const q = query(collection(fs, "users"), where("email", "==", email));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    return querySnapshot.docs[0].data(); // return the first matching user
  }
  return null;
};

export const uploadImage = async (file, path) => {
  try {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading image: ", error.message);
    throw error;
  }
};
export {
  getAppointments,
  updateAppointment,
  getLawyerAppointments,
  getLawyerCalendar,
  aptsLawyerCalendar,
  getUsers,
  updateUser,
  addUser,
  getUsersCount,
  aptsCalendar,
};
