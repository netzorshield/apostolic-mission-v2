import { motion } from "framer-motion";
import { Globe, Shield, BookOpen } from "lucide-react";
import BackLink from "./BackLink";

export default function HeroPanel() {
  return (
    <aside className="relative hidden min-h-screen flex-col px-10 pb-14 pt-10 lg:flex lg:w-[55%]">

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-iam-gold/80 shadow-gold">
          <Globe className="h-7 w-7 text-iam-gold-light" strokeWidth={1.5} />
        </div>
        <h1 className="mt-5 max-w-[20rem] font-cinzel text-xl font-semibold uppercase leading-snug tracking-[0.12em] text-iam-gold-light md:text-2xl lg:text-[1.65rem]">
          International Apostolic Mission
        </h1>
        <p className="mt-3 max-w-[18rem] font-cormorant text-base leading-snug text-white/85 md:text-lg lg:text-xl">
          Preaching Christ. Transforming Lives. Reaching the Nations.
        </p>
      </div>

      <div className="relative z-10 mt-auto space-y-6">
        <motion.blockquote
          className="max-w-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          <p className="font-cormorant text-sm italic leading-relaxed text-white/75 md:text-[0.8125rem]">
            &ldquo;Go therefore and make disciples of all nations, baptizing them in the name of the
            Father, and of the Son, and of the Holy Spirit.&rdquo;
          </p>
          <cite className="mt-2 block font-inter text-[10px] uppercase tracking-widest text-iam-gold/90">
            — Matthew 28:19
          </cite>
        </motion.blockquote>

        <div className="flex flex-wrap gap-6">
          {[
            { icon: Shield, title: "Secure Access", sub: "Your data is protected" },
            { icon: Globe, title: "Global Community", sub: "Connected in Christ" },
            { icon: BookOpen, title: "Kingdom Impact", sub: "Changing the world" },
          ].map(({ icon: Icon, title, sub }) => (
            <div key={title} className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-iam-gold/30 bg-black/30">
                <Icon className="h-5 w-5 text-iam-gold" />
              </div>
              <div>
                <p className="font-inter text-[10px] font-semibold uppercase tracking-widest text-iam-gold-light">
                  {title}
                </p>
                <p className="font-inter text-[10px] text-white/60">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

export function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="relative flex min-h-screen">
      <BackLink to="/" className="absolute left-6 top-6 z-20 lg:left-8 lg:top-8" />
      <HeroPanel />
      <main className="relative flex flex-1 flex-col justify-center px-6 py-10 lg:px-16 lg:py-12">
        <div className="mx-auto w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 text-center lg:pt-6"
          >
            <h2 className="font-playfair text-3xl font-medium text-white md:text-4xl">{title}</h2>
            {subtitle && <p className="mt-2 font-inter text-sm text-iam-muted">{subtitle}</p>}
          </motion.div>
          {children}
        </div>
        <p className="mx-auto mt-12 text-center font-inter text-[10px] text-iam-muted/60">
          © 2025 International Apostolic Mission. All rights reserved.
        </p>
      </main>
    </div>
  );
}
