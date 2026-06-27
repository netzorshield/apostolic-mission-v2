import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function BackLink({ to = "/", label = "Back", showIcon = true, className = "" }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 font-inter text-sm text-white/60 transition hover:text-iam-gold-light ${className}`}
    >
      {showIcon && <ArrowLeft className="h-4 w-4" />}
      {label}
    </Link>
  );
}
