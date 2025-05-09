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
  endBefore,
  getCountFromServer,
  limitToLast,
} from "firebase/firestore"; // Import necessary functions directly from Firebase Firestore
import { fs, storage, signOut } from "./Firebase"; // Import fs from your Firebase configuration file
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const getAppointments = async (
  statusFilter,
  lastVisible = null,
  pageSize = 7,
  searchText = "",
  assistanceFilter = "all",
  isPrevious = false // Boolean to control direction for pagination
) => {
  try {
    let queryRef = collection(fs, "appointments");

    const conditions = [];

    if (statusFilter && statusFilter !== "all") {
      conditions.push(
        where("appointmentDetails.appointmentStatus", "==", statusFilter)
      );
    }

    if (assistanceFilter && assistanceFilter !== "all") {
      conditions.push(
        where(
          "legalAssistanceRequested.selectedAssistanceType",
          "==",
          assistanceFilter
        )
      );
    }

    if (conditions.length > 0) {
      queryRef = query(queryRef, ...conditions);
    }

    queryRef = query(
      queryRef,
      orderBy("appointmentDetails.createdDate", "desc")
    );

    if (lastVisible) {
      if (isPrevious) {
        queryRef = query(
          queryRef,
          endBefore(lastVisible),
          limitToLast(pageSize)
        );
      } else {
        queryRef = query(queryRef, startAfter(lastVisible), limit(pageSize));
      }
    } else {
      queryRef = query(queryRef, limit(pageSize));
    }

    const querySnapshot = await getDocs(queryRef);

    if (querySnapshot.empty) {
      return { data: [], total: 0, firstDoc: null, lastDoc: null };
    }

    const appointmentsData = [];

    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      const uid = data.appointmentDetails?.uid;

      let userData = {};
      if (uid) {
        const userDoc = await getDoc(doc(fs, "users", uid));
        if (userDoc.exists()) {
          userData = userDoc.data();
        }
      }

      const combined = {
        id: docSnap.id,
        ...data.appointmentDetails,
        ...data.legalAssistanceRequested,
        ...data.employmentProfile,

        ...data.uploadedImages,
        ...userData, // ✅ this includes display_name, gender, dob, address, etc.
        clientEligibility: data.clientEligibility,
        reviewerDetails: data.reviewerDetails,
        proceedingNotes: data.proceedingNotes,
        rescheduleHistory: data.rescheduleHistory || [],
        createdDate: data.appointmentDetails?.createdDate,
        appointmentStatus: data.appointmentDetails?.appointmentStatus,
        controlNumber: data.appointmentDetails?.controlNumber,
        appointmentDate: data.appointmentDetails?.appointmentDate,
      };

      appointmentsData.push(combined);
    }

    if (searchText) {
      const searchLower = searchText.toLowerCase();
      appointmentsData = appointmentsData.filter((a) =>
        `${a.display_name} ${a.middle_name} ${a.last_name}`
          .toLowerCase()
          .includes(searchLower)
      );
    }

    const countSnapshot = await getCountFromServer(
      query(collection(fs, "appointments"), ...conditions)
    );

    return {
      data: appointmentsData,
      total: countSnapshot.data().count,
      firstDoc: querySnapshot.docs[0],
      lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1],
    };
  } catch (error) {
    console.error("Error fetching appointments:", error);
    return { data: [], total: 0, firstDoc: null, lastDoc: null };
  }
};

const countTotalFilteredItems = async (
  statusFilter,
  searchText = "",
  assistanceFilter = "all"
) => {
  try {
    let queryRef = collection(fs, "appointments");

    // Apply filters
    const conditions = [];

    // Apply status filter
    if (statusFilter && statusFilter !== "all") {
      conditions.push(
        where("appointmentDetails.appointmentStatus", "==", statusFilter)
      );
    }

    // Apply assistance type filter
    if (assistanceFilter && assistanceFilter !== "all") {
      conditions.push(
        where(
          "legalAssistanceRequested.selectedAssistanceType",
          "==",
          assistanceFilter
        )
      );
    }

    // Apply search text filter (client-side)
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      conditions.push(
        where("applicantProfile.fullName", ">=", searchLower),
        where("applicantProfile.fullName", "<=", searchLower + "\uf8ff")
      );
    }

    // Apply conditions to the query
    if (conditions.length > 0) {
      queryRef = query(queryRef, ...conditions);
    }

    // Fetch the total count for filtered items
    const countSnapshot = await getCountFromServer(queryRef);

    return countSnapshot.data().count;
  } catch (error) {
    console.error("Error counting total filtered items:", error);
    return 0; // Return 0 if there's an error
  }
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
        phone: data.applicantProfile?.phone,
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
        doc.data().applicantProfile?.phone?.includes(searchText) ||
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
        ? query(queryRef, endBefore(lastVisible), limitToLast(pageSize))
        : query(queryRef, startAfter(lastVisible), limit(pageSize));
    }

    const querySnapshot = await getDocs(queryRef);
    const appointmentsRaw = [];
    const userFetchTasks = [];

    querySnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const userUid = data.appointmentDetails?.uid;

      appointmentsRaw.push({ id: docSnap.id, ...data, userUid });

      if (userUid) {
        userFetchTasks.push({
          uid: userUid,
          promise: getDoc(doc(fs, "users", userUid)),
        });
      }
    });

    const userResults = await Promise.all(userFetchTasks.map((t) => t.promise));
    const usersMap = {};
    userResults.forEach((res, index) => {
      const uid = userFetchTasks[index].uid;
      if (res.exists()) {
        usersMap[uid] = res.data();
      }
    });

    const appointmentsData = appointmentsRaw.map((appointment) => {
      const userData = usersMap[appointment.userUid] || {};

      return {
        id: appointment.id,
        uid: appointment.userUid,
        fullName: `${userData.display_name || ""} ${
          userData.middle_name || ""
        } ${userData.last_name || ""}`.trim(),
        display_name: userData.display_name || "",
        middle_name: userData.middle_name || "",
        last_name: userData.last_name || "",
        dob: userData.dob || null,
        phone: userData.phone || "",
        gender: userData.gender || "",
        address: userData.address || "",
        spouse: userData.spouse || "",
        spouseOccupation: userData.spouseOccupation || "",
        childrenNamesAges: userData.childrenNamesAges || "",
        email: userData.email || "",
        city: userData.city || "",
        occupation: userData.occupation || "",
        employerName: userData.employerName || "",
        employerAddress: userData.employerAddress || "",
        employmentType: userData.employmentType || "",
        monthlyIncome: userData.monthlyIncome || "",

        // Uploaded images from users collection
        barangayImageUrl: userData.uploadedImages?.barangayImageUrl || null,
        barangayImageUrlDateUploaded:
          userData.uploadedImages?.barangayImageUrlDateUploaded || null,
        dswdImageUrl: userData.uploadedImages?.dswdImageUrl || null,
        dswdImageUrlDateUploaded:
          userData.uploadedImages?.dswdImageUrlDateUploaded || null,
        paoImageUrl: userData.uploadedImages?.paoImageUrl || null,
        paoImageUrlDateUploaded:
          userData.uploadedImages?.paoImageUrlDateUploaded || null,

        // Appointment details
        appointmentStatus: appointment.appointmentDetails?.appointmentStatus,
        controlNumber: appointment.appointmentDetails?.controlNumber,
        appointmentDate: appointment.appointmentDetails?.appointmentDate,
        appointmentDetails: appointment.appointmentDetails,
        createdDate: appointment.appointmentDetails?.createdDate || null,
        reviewerDetails: appointment.reviewerDetails,
        proceedingNotes: appointment.proceedingNotes,
        rescheduleHistory: appointment.rescheduleHistory || [],
        clientEligibility: appointment.clientEligibility,

        // Additional appointment-related data
        ...appointment.legalAssistanceRequested,
        ...appointment.employmentProfile,
        ...appointment.uploadedImages, // includes newRequestUrl, proceedingFileUrl
      };
    });

    return {
      data: appointmentsData,
      total: appointmentsData.length,
      firstDoc: querySnapshot.docs[0],
      lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1],
    };
  } catch (error) {
    console.error("Failed to fetch appointments:", error);
    return { data: [], total: 0, firstDoc: null, lastDoc: null };
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
    // Only fetch appointments assigned to lawyer or secretary's associated lawyer
    if (
      currentUser?.member_type === "lawyer" ||
      currentUser?.member_type === "secretary"
    ) {
      const targetUid =
        currentUser.member_type === "secretary"
          ? currentUser.associate
          : currentUser.uid;

      if (targetUid) {
        queryRef = query(
          queryRef,
          where("appointmentDetails.assignedLawyer", "==", targetUid)
        );
      }
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
    return onSnapshot(queryRef, async (querySnapshot) => {
      const filtered = querySnapshot.docs.filter((doc) => {
        const data = doc.data();
        return (
          data.applicantProfile?.fullName
            ?.toLowerCase()
            .includes(searchText.toLowerCase()) ||
          data.applicantProfile?.address
            ?.toLowerCase()
            .includes(searchText.toLowerCase()) ||
          data.applicantProfile?.phone?.includes(searchText) ||
          data.appointmentDetails?.controlNumber?.includes(searchText) ||
          data.legalAssistanceRequested?.selectedAssistanceType
            ?.toLowerCase()
            .includes(searchText.toLowerCase())
        );
      });

      // Map the filtered data and trigger callback
      const appointments = await Promise.all(
        filtered.map(async (docSnap) => {
          const data = docSnap.data();
          const uid = data.appointmentDetails?.uid;

          let userData = {};
          if (uid) {
            const userDoc = await getDoc(doc(fs, "users", uid)); // ✅ Now `doc` refers to the Firebase function

            if (userDoc.exists()) {
              userData = userDoc.data();
            }
          }

          return {
            id: docSnap.id,

            // Flattened appointmentDetails
            appointmentDetails: data.appointmentDetails,
            appointmentStatus:
              data.appointmentDetails?.appointmentStatus || null,
            controlNumber: data.appointmentDetails?.controlNumber || null,
            appointmentDate: data.appointmentDetails?.appointmentDate || null,
            apptType: data.appointmentDetails?.apptType || null,
            meetingLink: data.appointmentDetails?.meetingLink || null,
            assignedLawyer: data.appointmentDetails?.assignedLawyer || null,
            newRequest: data.appointmentDetails?.newRequest || false,
            requestReason: data.appointmentDetails?.requestReason || null,
            newControlNumber: data.appointmentDetails?.newControlNumber || null,

            // Flattened legal assistance data
            selectedAssistanceType:
              data.legalAssistanceRequested?.selectedAssistanceType || null,
            problemReason: data.legalAssistanceRequested?.problemReason || null,
            problems: data.legalAssistanceRequested?.problems || null,
            desiredSolutions:
              data.legalAssistanceRequested?.desiredSolutions || null,

            // Employment
            ...data.employmentProfile,

            // Images from users collection (barangay, dswd, pao)
            barangayImageUrl: userData.uploadedImages?.barangayImageUrl || null,
            barangayImageUrlDateUploaded:
              userData.uploadedImages?.barangayImageUrlDateUploaded || null,
            dswdImageUrl: userData.uploadedImages?.dswdImageUrl || null,
            dswdImageUrlDateUploaded:
              userData.uploadedImages?.dswdImageUrlDateUploaded || null,
            paoImageUrl: userData.uploadedImages?.paoImageUrl || null,
            paoImageUrlDateUploaded:
              userData.uploadedImages?.paoImageUrlDateUploaded || null,

            // Images from appointments (for newRequest/proceedingNotes)
            ...data.uploadedImages,

            // User info (from users collection)
            display_name: userData.display_name || "",
            middle_name: userData.middle_name || "",
            last_name: userData.last_name || "",
            gender: userData.gender || "",
            dob: userData.dob || null,
            address: userData.address || "",
            city: userData.city || "",
            phone: userData.phone || "",
            email: userData.email || "",
            occupation: userData.occupation || "",
            employerName: userData.employerName || "",
            employerAddress: userData.employerAddress || "",
            employmentType: userData.employmentType || "",
            monthlyIncome: userData.monthlyIncome || "",
            spouse: userData.spouse || "",
            spouseOccupation: userData.spouseOccupation || "",
            childrenNamesAges: userData.childrenNamesAges || "",

            // Meta
            reviewerDetails: data.reviewerDetails || null,
            proceedingNotes: data.proceedingNotes || null,
            clientEligibility: data.clientEligibility || null,
            rescheduleHistory: data.rescheduleHistory || [],
            createdDate: data.appointmentDetails?.createdDate || null,
          };
        })
      );

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

// Utility function to convert a string to title case
const toTitleCase = (str) => {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
};

export const getAllAppointments = async (
  statusFilter,
  lastVisible = null,
  pageSize = 7,
  searchText = "",
  assistanceFilter = "all",
  isPrevious = false // Boolean to control direction for pagination
) => {
  try {
    let queryRef = collection(fs, "appointments");

    // Apply filters
    const conditions = [];

    // Apply status filter
    if (statusFilter && statusFilter !== "all") {
      conditions.push(
        where("appointmentDetails.appointmentStatus", "==", statusFilter)
      );
    }

    // Apply assistance type filter
    if (assistanceFilter && assistanceFilter !== "all") {
      conditions.push(
        where(
          "legalAssistanceRequested.selectedAssistanceType",
          "==",
          assistanceFilter
        )
      );
    }

    // Apply conditions to the query
    if (conditions.length > 0) {
      queryRef = query(queryRef, ...conditions);
    }

    // Order by created date for pagination
    queryRef = query(
      queryRef,
      orderBy("appointmentDetails.createdDate", "desc")
    );

    // Handle pagination logic
    if (lastVisible) {
      if (isPrevious) {
        queryRef = query(
          queryRef,
          endBefore(lastVisible),
          limitToLast(pageSize)
        );
      } else {
        queryRef = query(queryRef, startAfter(lastVisible), limit(pageSize));
      }
    } else {
      queryRef = query(queryRef, limit(pageSize)); // Initial load
    }

    // Fetch the data
    const querySnapshot = await getDocs(queryRef);

    if (querySnapshot.empty) {
      return { data: [], total: 0, firstDoc: null, lastDoc: null };
    }

    // Map the results into usable data
    let appointmentsData = [];

    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      const uid = data.appointmentDetails?.uid;

      let userData = {};
      if (uid) {
        const userDoc = await getDoc(doc(fs, "users", uid));
        if (userDoc.exists()) {
          userData = userDoc.data();
        }
      }

      const combined = {
        id: docSnap.id,
        ...data.appointmentDetails,
        ...data.legalAssistanceRequested,
        ...data.employmentProfile,
        ...data.uploadedImages,
        ...userData, // ✅ merge user data here
        clientEligibility: data.clientEligibility,
        reviewerDetails: data.reviewerDetails,
        proceedingNotes: data.proceedingNotes,
        rescheduleHistory: data.rescheduleHistory || [],
        createdDate: data.appointmentDetails?.createdDate,
        appointmentStatus: data.appointmentDetails?.appointmentStatus,
        controlNumber: data.appointmentDetails?.controlNumber,
        appointmentDate: data.appointmentDetails?.appointmentDate,
      };

      appointmentsData.push(combined);
    }

    // If searchText exists, filter by fullName in the results
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      appointmentsData = appointmentsData.filter((appointment) =>
        appointment.fullName.toLowerCase().includes(searchLower)
      );
    }

    // Get the total count for pagination
    const countSnapshot = await getCountFromServer(
      query(collection(fs, "appointments"), ...conditions)
    );

    return {
      data: appointmentsData, // Return the filtered and paginated data
      total: countSnapshot.data().count, // Return the total count
      firstDoc: querySnapshot.docs[0], // Store the first document for previous pages
      lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1], // Store the last document for next pages
    };
  } catch (error) {
    console.error("Error fetching appointments:", error);
    return { data: [], total: 0, firstDoc: null, lastDoc: null };
  }
};

const getAdminAppointments = async (
  statusFilter,
  lastVisible = null,
  pageSize = 7,
  searchText = "",
  assistanceFilter = "all",
  isPrevious = false
) => {
  try {
    let queryRef = collection(fs, "appointments");
    const conditions = [];

    // Filters
    if (statusFilter && statusFilter !== "all") {
      conditions.push(
        where("appointmentDetails.appointmentStatus", "==", statusFilter)
      );
    }

    if (assistanceFilter && assistanceFilter !== "all") {
      conditions.push(
        where(
          "legalAssistanceRequested.selectedAssistanceType",
          "==",
          assistanceFilter
        )
      );
    }

    if (conditions.length > 0) {
      queryRef = query(queryRef, ...conditions);
    }

    queryRef = query(
      queryRef,
      orderBy("appointmentDetails.createdDate", "desc")
    );

    if (lastVisible) {
      queryRef = isPrevious
        ? query(queryRef, endBefore(lastVisible), limitToLast(pageSize))
        : query(queryRef, startAfter(lastVisible), limit(pageSize));
    } else {
      queryRef = query(queryRef, limit(pageSize));
    }

    const querySnapshot = await getDocs(queryRef);
    if (querySnapshot.empty) {
      return { data: [], total: 0, firstDoc: null, lastDoc: null };
    }

    // Fetch user data
    const appointmentsRaw = [];
    const userFetchTasks = [];

    querySnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
    const userUid = data.appointmentDetails?.uid;
      appointmentsRaw.push({ id: docSnap.id, ...data, userUid });

      if (userUid) {
        userFetchTasks.push({
          uid: userUid,
          promise: getDoc(doc(fs, "users", userUid)),
        });
      }
    });

    const userResults = await Promise.all(userFetchTasks.map((t) => t.promise));
    const usersMap = {};
    userResults.forEach((res, index) => {
      const uid = userFetchTasks[index].uid;
      if (res.exists()) {
        usersMap[uid] = res.data();
      }
    });

    // Merge user + appointment data
    const appointmentsData = appointmentsRaw.map((appointment) => {
      const userData = usersMap[appointment.userUid] || {};

      return {
        id: appointment.id,
        uid: appointment.userUid,
        fullName: `${userData.display_name || ""} ${
          userData.middle_name || ""
        } ${userData.last_name || ""}`.trim(),
        display_name: userData.display_name || "",
        middle_name: userData.middle_name || "",
        last_name: userData.last_name || "",
        dob: userData.dob || null,
        phone: userData.phone || "",
        gender: userData.gender || "",
        address: userData.address || "",
        spouse: userData.spouse || "",
        spouseOccupation: userData.spouseOccupation || "",
        childrenNamesAges: userData.childrenNamesAges || "",
        email: userData.email || "",
        city: userData.city || "",
        occupation: userData.occupation || "",
        employerName: userData.employerName || "",
        employerAddress: userData.employerAddress || "",
        employmentType: userData.employmentType || "",
        monthlyIncome: userData.monthlyIncome || "",

        // ✅ uploadedImages from users
        barangayImageUrl: userData.uploadedImages?.barangayImageUrl || null,
        barangayImageUrlDateUploaded:
          userData.uploadedImages?.barangayImageUrlDateUploaded || null,
        dswdImageUrl: userData.uploadedImages?.dswdImageUrl || null,
        dswdImageUrlDateUploaded:
          userData.uploadedImages?.dswdImageUrlDateUploaded || null,
        paoImageUrl: userData.uploadedImages?.paoImageUrl || null,
        paoImageUrlDateUploaded:
          userData.uploadedImages?.paoImageUrlDateUploaded || null,

        // appointment data
        appointmentStatus: appointment.appointmentDetails?.appointmentStatus,
        controlNumber: appointment.appointmentDetails?.controlNumber,
        appointmentDate: appointment.appointmentDetails?.appointmentDate,
        appointmentDetails: appointment.appointmentDetails,
        reviewerDetails: appointment.reviewerDetails,
        proceedingNotes: appointment.proceedingNotes,
        rescheduleHistory: appointment.rescheduleHistory || [],
        clientEligibility: appointment.clientEligibility,
        createdDate: appointment.appointmentDetails?.createdDate || null,

        // additional data
        ...appointment.legalAssistanceRequested,
        ...appointment.employmentProfile,
        ...appointment.uploadedImages, // from appointment doc (like proceedingFileUrl, etc.)
      };
    });

    // Filter by name if searchText is present
    // Filter BEFORE paginating
    let filteredAppointments = appointmentsData;

    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filteredAppointments = appointmentsData.filter((a) => {
        const name = `${a.display_name || ""} ${a.middle_name || ""} ${
          a.last_name || ""
        }`.toLowerCase();
        const controlNumber = a.controlNumber?.toLowerCase() || "";
        const email = a.email?.toLowerCase() || "";
        const phone = a.phone || "";
        const city = a.city?.toLowerCase() || "";

        return (
          name.includes(searchLower) ||
          controlNumber.includes(searchLower) ||
          email.includes(searchLower) ||
          phone.includes(searchText) ||
          city.includes(searchLower)
        );
      });
    }

    const countSnapshot = await getCountFromServer(
      query(collection(fs, "appointments"), ...conditions)
    );

    return {
      data: filteredAppointments,
      total: filteredAppointments.length,
      firstDoc: querySnapshot.docs[0],
      lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1],
    };
  } catch (error) {
    console.error("Error fetching appointments:", error);
    return { data: [], total: 0, firstDoc: null, lastDoc: null };
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
        phone: data.applicantProfile?.phone, // Fetch phone from applicantProfile
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
  lastVisibleDoc,
  rowsPerPage
) => {
  try {
    let queryRef = collection(fs, "users");

    // Apply filters
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

    // Apply pagination
    if (lastVisibleDoc) {
      queryRef = query(
        queryRef,
        startAfter(lastVisibleDoc),
        limit(rowsPerPage)
      );
    } else {
      queryRef = query(queryRef, limit(rowsPerPage));
    }

    const querySnapshot = await getDocs(queryRef);
    const users = querySnapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    }));
    const lastVisibleDocument =
      querySnapshot.docs[querySnapshot.docs.length - 1];

    return { users, lastVisibleDoc: lastVisibleDocument };
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
    const notificationData = {
      message: message,
      read: false,
      timestamp: Timestamp.fromDate(new Date()),
      type: type,
      uid: uid,
    };

    // Only add controlNumber if it is defined
    if (controlNumber !== undefined) {
      notificationData.controlNumber = controlNumber;
    }

    await addDoc(collection(fs, "notifications"), notificationData);
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
  const q = query(usersRef, where("member_type", "==", "head"));

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
  countTotalFilteredItems,
  getAdminAppointments,
};
