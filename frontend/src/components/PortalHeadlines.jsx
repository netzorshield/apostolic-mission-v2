import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function PortalHeadlineStrip({ items, activeId, onSelect, compact = false }) {
  return (
    <nav
      className={`border-y border-iam-gold/30 ${compact ? "mb-6 py-2" : "mb-8 py-4"}`}
      aria-label="Member portal sections"
    >
      <div className="flex flex-wrap items-stretch justify-center gap-x-0 gap-y-2 md:justify-between">
        {items.map((item, index) => {
          const active = activeId === item.id;
          return (
            <div key={item.id} className="flex min-w-0 flex-1 items-stretch">
              {index > 0 && (
                <span
                  className={`mx-2 hidden w-px shrink-0 self-stretch bg-iam-gold/25 md:block ${compact ? "mx-2" : "mx-3"}`}
                  aria-hidden
                />
              )}
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className={`group flex min-w-0 flex-1 flex-col items-center justify-center px-1 py-1 text-center transition md:px-3 ${
                  active ? "text-iam-gold-light" : "text-white/70 hover:text-iam-gold-light"
                }`}
              >
                {item.eyebrow && (
                  <span className="font-cinzel text-[10px] uppercase tracking-[0.35em] text-iam-gold/80 group-hover:text-iam-gold-light">
                    {item.eyebrow}
                  </span>
                )}
                <span
                  className={`font-playfair leading-tight ${
                    compact
                      ? active
                        ? "text-base text-white md:text-lg"
                        : "text-sm text-white/90 md:text-base"
                      : item.eyebrow
                        ? `mt-1 ${active ? "text-2xl text-white md:text-3xl" : "text-xl text-white/90 md:text-2xl"}`
                        : active
                          ? "text-2xl text-white md:text-3xl"
                          : "text-xl text-white/90 md:text-2xl"
                  }`}
                >
                  {item.title}
                </span>
                {!compact && item.hint && (
                  <span className="mt-1 hidden font-inter text-[10px] text-iam-muted sm:block">{item.hint}</span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

export function PortalSectionHeadline({ eyebrow, title, description, badge, compact }) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-4 ${compact ? "" : "mb-8 border-b border-iam-gold/25 pb-5"}`}>
      <div>
        {eyebrow && (
          <p className="font-cinzel text-xs uppercase tracking-[0.35em] text-iam-gold-light">{eyebrow}</p>
        )}
        <h2 className={`mt-2 font-playfair text-white ${compact ? "text-2xl md:text-3xl" : "text-3xl md:text-4xl"}`}>
          {title}
        </h2>
        {description && (
          <p className="mt-2 font-inter text-sm text-iam-muted md:text-base">{description}</p>
        )}
      </div>
      {badge}
    </div>
  );
}

export function PortalAccordionSection({
  eyebrow,
  title,
  description,
  badge,
  open,
  onToggle,
  children,
}) {
  return (
    <section className="glass-panel mb-4 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 p-6 text-left transition hover:bg-white/5 md:p-8"
      >
        <div className="min-w-0 flex-1">
          {eyebrow && eyebrow !== title && (
            <p className="font-cinzel text-xs uppercase tracking-[0.35em] text-iam-gold-light">{eyebrow}</p>
          )}
          <h2 className={`font-playfair text-2xl text-white md:text-3xl ${eyebrow && eyebrow !== title ? "mt-2" : ""}`}>
            {title}
          </h2>
          {description && (
            <p className="mt-1 font-inter text-sm text-iam-muted">{description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {badge}
          <ChevronDown
            className={`h-5 w-5 text-iam-gold transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      {open && (
        <div className="border-t border-white/10 px-6 pb-8 pt-4 md:px-8">
          {children}
        </div>
      )}
    </section>
  );
}

export function PortalStepAccordion({ stepId, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-white/10 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-5 text-left transition hover:text-iam-gold-light"
      >
        <h3 className="font-cinzel text-base uppercase tracking-[0.18em] text-iam-gold-light md:text-lg">
          {title}
        </h3>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-iam-gold transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="pb-6">{children}</div>}
    </div>
  );
}

export function PortalField({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="border-b border-white/5 py-4">
      <p className="font-inter text-[10px] font-medium uppercase tracking-[0.22em] text-iam-muted">{label}</p>
      <p className="mt-2 break-words font-cormorant text-xl leading-snug text-white md:text-2xl">{String(value)}</p>
    </div>
  );
}

export function PortalBrandMark({ subtitle = "Member Portal" }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-cinzel text-2xl text-iam-gold-light">✦</span>
      <div className="leading-tight">
        <span className="block font-cinzel text-sm font-semibold tracking-[0.25em] text-iam-gold-light">IAM</span>
        <span className="mt-0.5 block font-cormorant text-sm italic text-white/80">{subtitle}</span>
      </div>
    </div>
  );
}
