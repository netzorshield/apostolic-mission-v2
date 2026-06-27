import { Link } from "react-router-dom";

export default function BrandLogo({ to = "/", subtitle = "Apostolic Mission", className = "" }) {
  return (
    <Link to={to} className={`group flex items-center gap-3 ${className}`}>
      <span className="font-cinzel text-lg text-iam-gold-light transition group-hover:text-iam-gold">✦</span>
      <div className="leading-tight">
        <span className="block font-cinzel text-sm font-semibold tracking-[0.25em] text-iam-gold-light transition group-hover:text-iam-gold">
          IAM
        </span>
        <span className="mt-0.5 block font-cormorant text-xs italic text-white/70 transition group-hover:text-white/90">
          {subtitle}
        </span>
      </div>
    </Link>
  );
}
