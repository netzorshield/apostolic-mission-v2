import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    window.location.replace("/");
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-iam-bg px-6 text-center">
          <p className="font-inter text-sm text-iam-muted">Something went wrong. Returning to home…</p>
        </div>
      );
    }
    return this.props.children;
  }
}
