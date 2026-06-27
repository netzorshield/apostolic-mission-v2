import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export function HeroHeadline({ compact = false }) {
  return (
    <section className={`relative flex items-center overflow-hidden ${compact ? "min-h-[70vh]" : "min-h-screen"} pt-20`}>
      <div className={`relative z-10 mx-auto w-full max-w-3xl px-6 text-left md:-translate-x-4 lg:-translate-x-8 ${compact ? "py-16" : "py-24"}`}>
        <div className="max-w-xl drop-shadow-[0_2px_16px_rgba(0,0,0,0.75)]">
          <motion.p
            className="font-cinzel text-xs uppercase tracking-[0.35em] text-iam-gold/90"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            International Apostolic Mission
          </motion.p>

          <motion.h1
            className="mt-6 font-cormorant text-4xl font-medium leading-tight text-white sm:text-5xl md:text-6xl lg:text-7xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            Preaching Christ.
            <br />
            <span className="text-iam-gold-light">Transforming Lives.</span>
            <br />
            <span className="mt-1 block text-[32px] text-white">Reaching the Nations.</span>
          </motion.h1>

          <motion.p
            className="mt-8 max-w-2xl font-inter text-base leading-relaxed text-white/90 md:text-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            A premium global ministry ecosystem for secure digital membership, identity verification,
            ministry collaboration, and kingdom-focused mission engagement.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col items-start gap-4 sm:flex-row"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <Link to="/enroll" className="btn-gold min-w-[220px]">
              Join Our Mission <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/login" className="btn-gold min-w-[220px]">
              Member Sign In <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
