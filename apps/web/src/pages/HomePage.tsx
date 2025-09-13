//apps/web/src/pages/HomePage.tsx

import { motion } from "framer-motion";
import {
  GiKitchenKnives,
  GiCircularSaw,
  GiGearHammer,
  GiMeatCleaver,
  GiGardeningShears,
  GiSparkles,
} from "react-icons/gi";
import logoUrl from "../assets/Main-logo.svg";

const services = [
  { title: "Knife Sharpening", desc: "Chef knives, cleavers, paring and specialty blades with mirror edges.", Icon: GiKitchenKnives },
  { title: "Saw Blades", desc: "Carbide-tipped & HSS circular saws, accurate tooth geometry & set.", Icon: GiCircularSaw },
  { title: "Annular Cutters", desc: "Precision reliefs and consistent cutting edges for steel & stainless.", Icon: GiGearHammer },
  { title: "Deli Slicers", desc: "Hygienic, razor-sharp edges for food service equipment.", Icon: GiMeatCleaver },
  { title: "Garden Tools", desc: "Secateurs, shears, mower blades – tidy, durable edges.", Icon: GiGardeningShears },
  { title: "Custom Jobs", desc: "If it cuts, we can likely sharpen it. Ask for a quote.", Icon: GiSparkles },
];

const pricing = [
  { item: "Chef Knife", price: "from $15" },
  { item: "Circular Saw Blade", price: "from $25" },
  { item: "Annular Cutter", price: "from $18" },
  { item: "Deli Slicer", price: "from $35" },
];

const testimonials = [
  { name: "Sam — Local Chef", quote: "Edges better than new. Turnaround was quick and the finish is mint." },
  { name: "Riley — Carpenter", quote: "Saw blades cut cleaner and last longer now. Honest pricing as well." },
  { name: "Morgan — Cafe Owner", quote: "Reliable pickup and drop-off. Big time-saver for our team." },
];

function Hero() {
  return (
    <section
      id="home"
      className="relative scroll-mt-20 flex min-h-[82vh] items-center justify-center overflow-hidden bg-paper text-graphite pt-24"
    >
      <div className="relative z-10 mx-auto max-w-5xl px-4 text-center md:px-6">
        <div className="inline-block text-center mx-auto w-full md:w-auto">
          {/* Logo + Tagline grouped so widths align */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center text-center"
          >
            <img
              src={logoUrl}
              alt="Ship Shape Sharpening"
              className="mb-4 w-full max-w-xs md:max-w-sm"
            />
            <h1 className="text-4xl font-black leading-tight md:text-6xl">
              Keep Your Edge <span className="text-accent">Sharp</span>
            </h1>
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mx-auto mt-4 max-w-2xl text-base text-ink md:text-lg"
        >
          Professional sharpening for knives, saw blades, annular cutters, deli slicers and more — fast, precise, and reliable.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="mt-8 flex items-center justify-center gap-4"
        >
          <a
            href="#pricing"
            className="rounded-full px-6 py-3 text-sm font-extrabold text-graphite transition bg-paper border border-steel-300 shadow-sm hover:scale-105 hover:shadow-xl hover:bg-steel-100 active:scale-95"
          >
            See Pricing
          </a>
          <a
            href="#contact"
            className="rounded-full px-6 py-3 text-sm font-extrabold text-white transition bg-accent shadow-sm hover:scale-105 hover:shadow-xl hover:brightness-110 active:scale-95"
          >
            Get a Quote
          </a>
        </motion.div>
      </div>
    </section>
  );
}

function Services() {
  return (
    <section id="services" className="bg-paper py-20 scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <h2 className="text-3xl font-black tracking-tight md:text-4xl text-graphite">Services</h2>
        <p className="mt-2 max-w-2xl text-ink">Precision sharpening across trades, hospitality, and home use.</p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map(({ title, desc, Icon }) => (
            <div key={title} className="group relative overflow-hidden rounded-2xl border border-steel-300 bg-white p-6 shadow-sm transition hover:shadow-md">
              <Icon className="h-8 w-8 text-accent" />
              <h3 className="mt-4 text-lg font-bold text-graphite">{title}</h3>
              <p className="mt-1 text-sm text-ink">{desc}</p>
              <div className="absolute inset-x-0 bottom-0 h-1 opacity-0 transition group-hover:opacity-100 bg-accent" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyUs() {
  return (
    <section id="whyus" className="bg-steel-100 py-20 scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-3xl font-black md:text-4xl text-graphite">Why Choose Us</h2>
            <ul className="space-y-3 text-graphite/80">
              <li className="flex items-start gap-3"><span className="mt-1 inline-block h-2 w-2 rounded-full bg-accent" /> <span><strong>Precision & Consistency</strong> — CNC-calibrated processes guided by machinist-grade QA.</span></li>
              <li className="flex items-start gap-3"><span className="mt-1 inline-block h-2 w-2 rounded-full bg-accent" /> <span><strong>Fast Turnaround</strong> — Same-day options available by arrangement.</span></li>
              <li className="flex items-start gap-3"><span className="mt-1 inline-block h-2 w-2 rounded-full bg-accent" /> <span><strong>Local & Reliable</strong> — Pickup/drop-off available for regular clients.</span></li>
            </ul>
          </div>
          <div className="rounded-2xl border border-steel-300 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-xl bg-steel-200 p-6"><div className="text-3xl font-black text-accent">4.9★</div><div className="mt-1 text-sm text-ink">Avg. Rating</div></div>
              <div className="rounded-xl bg-steel-200 p-6"><div className="text-3xl font-black text-accent">24h</div><div className="mt-1 text-sm text-ink">Typical Turnaround</div></div>
              <div className="rounded-xl bg-steel-200 p-6"><div className="text-3xl font-black text-accent">+1,000</div><div className="mt-1 text-sm text-ink">Tools Sharpened</div></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="bg-paper py-20 scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <h2 className="text-3xl font-black tracking-tight md:text-4xl text-graphite">Pricing</h2>
        <p className="mt-2 max-w-2xl text-ink">Transparent pricing with pro results. Bulk rates available.</p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {pricing.map((p) => (
            <div key={p.item} className="flex items-center justify-between rounded-2xl border border-steel-300 bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="text-lg font-semibold text-graphite">{p.item}</div>
              <div className="text-base font-bold text-accent">{p.price}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 text-sm text-ink">* Final quotes may vary based on condition, diameter, tooth geometry, and repair needs.</div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section id="testimonials" className="bg-steel-100 py-20 scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <h2 className="text-3xl font-black tracking-tight md:text-4xl text-graphite">What Clients Say</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <div key={t.name} className="rounded-2xl border border-steel-300 bg-white p-6 shadow-sm transition hover:shadow-md">
              <div className="text-xl text-graphite">“{t.quote}”</div>
              <div className="mt-4 text-sm font-semibold text-ink">{t.name}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section id="contact" className="bg-paper py-20 scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-black tracking-tight md:text-4xl text-graphite">Get a Quote</h2>
            <p className="mt-2 max-w-xl text-ink">Tell us what you need sharpened and we’ll get back with a quick quote.</p>
            <form onSubmit={(e) => e.preventDefault()} className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-graphite">Name</label>
                <input className="mt-1 w-full rounded-xl border border-steel-300 bg-white px-4 py-3 outline-none ring-0 focus:border-graphite" placeholder="Your full name" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-graphite">Email</label>
                  <input type="email" className="mt-1 w-full rounded-xl border border-steel-300 bg-white px-4 py-3 outline-none focus:border-graphite" placeholder="you@example.com" />
                </div>
                <div>
                  <label className="text-sm font-medium text-graphite">Phone</label>
                  <input className="mt-1 w-full rounded-xl border border-steel-300 bg-white px-4 py-3 outline-none focus:border-graphite" placeholder="04xx xxx xxx" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-graphite">What needs sharpening?</label>
                <textarea rows={5} className="mt-1 w-full rounded-xl border border-steel-300 bg-white px-4 py-3 outline-none focus:border-graphite" placeholder="e.g., 3 chef knives, 2x 210mm circular saw blades (24T), and a deli slicer blade." />
              </div>
              <button className="w-full rounded-full px-6 py-3 text-sm font-semibold text-white hover:opacity-90 active:opacity-80 bg-accent">
                Request Quote
              </button>
            </form>
          </div>
          <div className="rounded-2xl border border-steel-300 bg-steel-100 p-6">
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-ink">Email</div>
                <a href="mailto:hello@shipshapesharpening.com.au" className="text-lg font-medium text-graphite hover:underline">hello@shipshapesharpening.com.au</a>
              </div>
              <div>
                <div className="text-sm font-semibold text-ink">Phone</div>
                <a href="tel:+61XXXXXXXXX" className="text-lg font-medium text-graphite hover:underline">+61 xx xxx xxxx</a>
              </div>
              <div>
                <div className="text-sm font-semibold text-ink">Hours</div>
                <div className="text-lg font-medium text-graphite">Mon–Fri 9:00–5:00</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-ink">Location</div>
                <div className="text-lg font-medium text-graphite">Melbourne, VIC</div>
              </div>
              <div className="pt-2">
                <a href="#" className="inline-block rounded-full px-5 py-2 text-sm font-semibold text-white hover:opacity-90 active:opacity-80 bg-accent">
                  Book Pickup / Drop-off
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-steel-300 bg-graphite py-10 text-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 md:flex-row md:px-6">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">Ship Shape Sharpening</span>
        </div>
        <div className="text-xs text-white/70">© {new Date().getFullYear()} Ship Shape Sharpening — All rights reserved.</div>
      </div>
    </footer>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen scroll-smooth font-sans antialiased bg-paper">
      <main>
        <Hero />
        <Services />
        <WhyUs />
        <Pricing />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
