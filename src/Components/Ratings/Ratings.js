import React, { useState, useEffect } from "react";
import SideNavBar from "../SideNavBar/SideNavBar";
import "../Dashboard/Dashboard.css";
import "./Ratings.css";
import Pagination from "react-bootstrap/Pagination";
import { getUsers, getUsersCount } from "../../Config/FirebaseServices";
import { auth } from "../../Config/Firebase";

function Ratings() {
  const [users, setUsers] = useState([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lastVisible, setLastVisible] = useState(null);
const predefinedOptions = [
  "Payong Legal (Legal Advice)",
  "Legal na Representasyon (Legal Representation)",
  "Pag gawa ng Legal na Dokumento (Drafting of Legal Document)"
];

  const pageSize = 10;
  const [cityFilter, setCityFilter] = useState("all");
  const [totalFilteredItems, setTotalFilteredItems] = useState(0);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        window.location.href = "/";
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [filterStatus, searchText, currentPage, cityFilter]);

  const fetchUsers = async () => {
    try {
      const { users, lastVisibleDoc } = await getUsers(
        filterStatus,
        "",
        cityFilter,
        searchText,
        lastVisible,
        pageSize,
        currentPage
      );
      const totalUsersCount = await getUsersCount(
        filterStatus,
        "",
        cityFilter,
        searchText
      );

      setUsers(users);
      setLastVisible(lastVisibleDoc);
      setTotalFilteredItems(totalUsersCount);
      setTotalPages(Math.ceil(totalUsersCount / pageSize));
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const handleFilterChange = (setter) => (event) => {
    setter(event.target.value);
    setCurrentPage(1); // Reset to the first page whenever filters change
  };

  const handlePageClick = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handleFirst = () => {
    setCurrentPage(1);
  };

  const handlePrevious = () => {
    setCurrentPage((prevPage) => Math.max(prevPage - 1, 1));
  };

  const handleNext = () => {
    setCurrentPage((prevPage) => Math.min(prevPage + 1, totalPages));
  };

  const handleLast = () => {
    setCurrentPage(totalPages);
  };

  const resetFilters = () => {
    setFilterStatus("all");
    setSearchText("");
    setCityFilter("all");
  };

  return (
    <div className="dashboard-container">
      <SideNavBar />
      <div className="main-content">
        <br />
        <h3>Ratings</h3>
        <br />
        <input
          type="text"
          value={searchText}
          onChange={handleFilterChange(setSearchText)}
          placeholder="Search..."
        />
        &nbsp;&nbsp;
        <select
          onChange={handleFilterChange(setFilterStatus)}
          value={filterStatus}
        >
          <option value="all">All</option>
          <option value="application">Application</option>
          <option value="appointments">Appointments</option>
        </select>
        &nbsp;&nbsp;
        <button onClick={resetFilters}>Reset Filters</button>
        <br />
        <p>Total Filtered Items: {totalFilteredItems}</p>
        <table className="table table-striped table-bordered">
          <thead>
            <tr>
              <th>#</th>
              <th>First Name</th>
              <th>Middle Name</th>
              <th>Last Name</th>
              <th>Email</th>
              <th>City</th>
              <th>Rating Type</th>
              <th>User Rating</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => (
              <tr key={user.uid}>
                <td>{(currentPage - 1) * pageSize + index + 1}</td>
                <td>{user.display_name}</td>
                <td>{user.middle_name}</td>
                <td>{user.last_name}</td>
                <td>{user.email}</td>
                <td>{user.city}</td>
                <td>{user.appRating ? "Application" : "N/A"}</td>
                <td>{user.appRating || "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination>
          <Pagination.First onClick={handleFirst} disabled={currentPage === 1} />
          <Pagination.Prev onClick={handlePrevious} disabled={currentPage === 1} />
          {[...Array(totalPages).keys()].map((_, index) => (
            <Pagination.Item
              key={index + 1}
              active={index + 1 === currentPage}
              onClick={() => handlePageClick(index + 1)}
            >
              {index + 1}
            </Pagination.Item>
          ))}
          <Pagination.Next onClick={handleNext} disabled={currentPage === totalPages} />
          <Pagination.Last onClick={handleLast} disabled={currentPage === totalPages} />
        </Pagination>
      </div>
    </div>
  );
}

export default Ratings;
