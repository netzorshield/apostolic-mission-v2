import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Globe,
  ShieldCheck,
  BadgeCheck,
  Users,
  Sparkles,
  Lock,
} from "lucide-react";
import SiteNav from "../components/SiteNav";
import { HeroHeadline } from "../components/HeroHeadline";

const STATS = [
  { value: "60+", label: "Nations Reached" },
  { value: "10K+", label: "Members" },
  { value: "500+", label: "Partner Churches" },
];

const FEATURES = [
  {
    icon: Globe,
    title: "Global Network",
    desc: "A connected apostolic family across 60+ nations.",
  },
  {
    icon: ShieldCheck,
    title: "Verified Identity",
    desc: "Enterprise-grade church & member verification.",
  },
  {
    icon: BadgeCheck,
    title: "Digital Credential",
    desc: "Tamper-proof membership ID with QR verification.",
  },
  {
    icon: Users,
    title: "Ministry Hub",
    desc: "Collaborate, serve and grow within ministry teams.",
  },
  {
    icon: Sparkles,
    title: "Kingdom Excellence",
    desc: "Premium platform built for global mission impact.",
  },
  {
    icon: Lock,
    title: "Secure & Private",
    desc: "OWASP-compliant, encrypted, and audit-logged.",
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6 },
};

export default function HomePage() {
  useEffect(() => {
    document.title = "International Apostolic Mission";
  }, []);

  return (
    <div className="min-h-screen text-white">
      <SiteNav />
      <HeroHeadline />

      {/* Stats */}
      <section className="relative border-y border-iam-gold/15 px-6 py-14">
        <div className="mx-auto flex max-w-4xl flex-row flex-wrap items-center justify-center gap-x-14 gap-y-8 md:gap-x-24">
          {STATS.map(({ value, label }) => (
            <motion.div key={label} className="text-center" {...fadeUp}>
              <p className="font-cinzel text-3xl font-semibold text-iam-gold-light md:text-4xl">{value}</p>
              <p className="mt-2 font-inter text-xs uppercase tracking-widest text-white/60">{label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Platform */}
      <section className="px-6 py-24 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <motion.div className="text-center" {...fadeUp}>
            <p className="font-inter text-xs uppercase tracking-[0.3em] text-iam-gold">The Platform</p>
            <h2 className="mt-4 font-playfair text-3xl text-white md:text-4xl lg:text-5xl">
              Built for Kingdom Excellence.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl font-inter text-base leading-relaxed text-white/65">
              From secure onboarding to digital credentialing, every detail is engineered with luxury,
              trust and global reach.
            </p>
          </motion.div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                className="glass-panel group p-8 transition hover:border-iam-gold/40"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-iam-gold/30 bg-iam-bg/60 transition group-hover:border-iam-gold/60 group-hover:shadow-gold">
                  <Icon className="h-6 w-6 text-iam-gold" strokeWidth={1.5} />
                </div>
                <h3 className="font-cinzel text-sm font-semibold uppercase tracking-wider text-iam-gold-light">
                  {title}
                </h3>
                <p className="mt-3 font-inter text-sm leading-relaxed text-white/65">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Worship / CTA */}
      <section className="relative overflow-hidden px-6 py-28 lg:px-10">
        <motion.div className="relative mx-auto max-w-3xl text-center drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]" {...fadeUp}>
          <p className="font-inter text-xs uppercase tracking-[0.3em] text-iam-gold">Worship</p>
          <h2 className="mt-4 font-playfair text-3xl text-white md:text-4xl">
            A Calling. A Family. A Mission.
          </h2>
          <blockquote className="mt-10">
            <p className="font-cormorant text-2xl italic leading-relaxed text-white/85 md:text-3xl">
              &ldquo;Go therefore and make disciples of all nations.&rdquo;
            </p>
            <cite className="mt-4 block font-inter text-xs uppercase tracking-widest text-iam-gold/90 not-italic">
              — Matthew 28:19
            </cite>
          </blockquote>
          <Link to="/enroll" className="btn-gold mt-12 inline-flex">
            Join Our Mission <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-10 text-center">
        <p className="font-inter text-sm text-white/50">
          © 2026 International Apostolic Mission
        </p>
        <p className="mt-2 font-inter text-xs uppercase tracking-widest text-iam-gold/70">
          Kingdom Excellence · Global Reach · Enterprise Security
        </p>
      </footer>
    </div>
  );
}
