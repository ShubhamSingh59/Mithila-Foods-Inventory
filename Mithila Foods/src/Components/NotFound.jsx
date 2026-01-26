// src/Components/NotFound.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>404</h1>
      <p style={styles.text}>Oops! The page you are looking for does not exist.</p>
      <Link to="/stock/daily" style={styles.button}>
        Go Back Home
      </Link>
    </div>
  );
}

const styles = {
  container: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
  },
  title: {
    fontSize: "4rem",
    fontWeight: "700",
    color: "#0f172a",
    margin: 0,
  },
  text: {
    fontSize: "1.2rem",
    marginTop: "10px",
    marginBottom: "20px",
  },
  button: {
    padding: "10px 20px",
    backgroundColor: "#0f172a",
    color: "white",
    textDecoration: "none",
    borderRadius: "8px",
    fontWeight: "600",
  }
};