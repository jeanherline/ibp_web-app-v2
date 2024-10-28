// src/Components/AllAuditLogs.js
import React, { useEffect, useState } from "react";
import { fs, collection, getDocs, orderBy, query } from "../../Config/Firebase";
import {
  Container,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import "./Settings.css";

function AllAuditLogs() {
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    const fetchAllAuditLogs = async () => {
      const auditLogsRef = collection(fs, "audit_logs");
      const auditLogsQuery = query(auditLogsRef, orderBy("timestamp", "desc"));
      const auditLogsSnapshot = await getDocs(auditLogsQuery);
      const logs = auditLogsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAuditLogs(logs);
    };

    fetchAllAuditLogs();
  }, []);

  return (
    <Container maxWidth="lg" style={{ marginTop: "20px" }}>
      <Typography variant="h3" gutterBottom>
        All Audit Logs
      </Typography>
      {auditLogs.length > 0 ? (
        <TableContainer component={Paper}>
          <Table style={{ width: "100%" }}>
            <TableHead>
              <TableRow>
                <TableCell>
                  <strong>Action Type</strong>
                </TableCell>
                <TableCell>
                  <strong>Timestamp</strong>
                </TableCell>
                <TableCell>
                  <strong>Changes</strong>
                </TableCell>
                <TableCell>
                  <strong>Affected Data</strong>
                </TableCell>
                <TableCell>
                  <strong>Metadata</strong>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{log.actionType}</TableCell>
                  <TableCell>
                    {new Date(log.timestamp.seconds * 1000).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <pre>{JSON.stringify(log.changes, null, 2)}</pre>
                  </TableCell>
                  <TableCell>
                    <pre>{JSON.stringify(log.affectedData, null, 2)}</pre>
                  </TableCell>
                  <TableCell>
                    <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography variant="body1">No audit logs found.</Typography>
      )}
    </Container>
  );
}

export default AllAuditLogs;
