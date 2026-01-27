import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service here
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Optional: reload page or reset specific logic
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <h2 style={styles.title}>Something went wrong</h2>
            <p style={styles.text}>
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button style={styles.button} onClick={this.handleReset}>
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    padding: "20px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  card: {
    padding: "24px",
    border: "1px solid #fecaca",
    backgroundColor: "#fef2f2",
    borderRadius: "12px",
    textAlign: "center",
    maxWidth: "400px",
  },
  title: {
    margin: "0 0 8px 0",
    color: "#991b1b",
    fontSize: "1.25rem",
  },
  text: {
    color: "#b91c1c",
    marginBottom: "16px",
    fontSize: "0.9rem",
  },
  button: {
    padding: "8px 16px",
    backgroundColor: "#991b1b",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
  },
};

export default ErrorBoundary;
