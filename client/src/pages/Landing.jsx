import React from 'react';
import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div>
      <nav className="nav">
        <div className="nav-inner">
          <div className="brand">
            <span className="brand-mark">C</span>
            CareThread
          </div>
          <div className="flex gap-12">
            <Link to="/login" className="btn btn-ghost">Sign in</Link>
            <Link to="/signup" className="btn btn-primary">Get started</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header style={heroWrap}>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={heroGrid}>
            <div>
              <div style={eyebrow}>Virtual clinical trial visits</div>
              <h1 style={heroTitle}>
                The hospital visit,<br />
                <span style={{ color: 'var(--purple)' }}>without the hospital.</span>
              </h1>
              <p style={heroSub}>
                CareThread lets clinical trial patients complete their periodic
                dosage visits from home — full video consultation, vitals capture,
                and protocol-grade tracking, without ever stepping into a hospital.
              </p>
              <div className="flex gap-12 mt-32">
                <Link to="/signup" className="btn btn-primary" style={{ padding: '14px 28px', fontSize: 16 }}>
                  I'm a Doctor
                </Link>
                <Link to="/signup" className="btn btn-teal" style={{ padding: '14px 28px', fontSize: 16 }}>
                  I'm a Patient
                </Link>
              </div>
              <div className="flex gap-24 mt-32" style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
                <div className="flex items-center gap-8"><Dot color="var(--teal)" /> Live video visits</div>
                <div className="flex items-center gap-8"><Dot color="var(--purple)" /> Vitals tracked per visit</div>
                <div className="flex items-center gap-8"><Dot color="var(--amber)" /> Doctor analytics</div>
              </div>
            </div>

            <div style={heroCardWrap}>
              <div style={heroCardGlow} />
              <div className="card" style={heroCard}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-8">
                    <div style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--teal)' }} />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Visit Room · Live</span>
                  </div>
                  <span className="badge badge-active">Active</span>
                </div>
                <div style={mockVideoRow}>
                  <div style={mockVideoTile}>Dr. Rao</div>
                  <div style={{ ...mockVideoTile, background: 'linear-gradient(135deg,#EEEDFE,#E1F5EE)' }}>You</div>
                </div>
                <div style={{ marginTop: 16 }}>
                  <div className="text-sm text-muted" style={{ marginBottom: 8, fontWeight: 600 }}>Vitals — this visit</div>
                  <div style={vitalsMockGrid}>
                    <VitalPill label="Temp" value="98.6°F" />
                    <VitalPill label="BP" value="122/80" />
                    <VitalPill label="SpO₂" value="98%" />
                    <VitalPill label="Sugar" value="104" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* HOW IT WORKS */}
      <section className="container" style={{ padding: '90px 32px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={eyebrow}>How it works</div>
          <h2 style={{ fontSize: 34, marginTop: 8 }}>Three roles, one visit.</h2>
        </div>
        <div style={stepsGrid}>
          <StepCard
            num="01"
            color="purple"
            title="Doctor creates a Visit Room"
            desc="A trial investigator opens a Visit Room for a scheduled dosage visit and gets a short join code to share with the patient."
          />
          <StepCard
            num="02"
            color="teal"
            title="Patient joins with the code"
            desc="The patient enters the code from home — no app install, no travel — and is connected into a live video consultation."
          />
          <StepCard
            num="03"
            color="coral"
            title="Vitals captured & tracked"
            desc="The doctor records parameters during the call. Every visit feeds a running dashboard of the patient's trial data over time."
          />
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ background: 'var(--paper-raised)', borderTop: '1px solid var(--line-soft)', borderBottom: '1px solid var(--line-soft)', padding: '80px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={eyebrow}>Built for trial-grade rigor</div>
            <h2 style={{ fontSize: 34, marginTop: 8 }}>What's inside</h2>
          </div>
          <div style={featureGrid}>
            <FeatureCard icon="🎥" title="Live video visits" desc="Peer-to-peer video consultation built directly into every Visit Room, no third-party meeting link needed." />
            <FeatureCard icon="🔑" title="Shareable room codes" desc="Doctors generate a Visit Room and share a simple code — patients join in seconds." />
            <FeatureCard icon="📋" title="Structured vitals capture" desc="Temperature, blood pressure, sugar, SpO₂ and dosage stage recorded per visit, pre- and post-dosage." />
            <FeatureCard icon="📊" title="Interactive doctor dashboard" desc="Trends across patients and visits, visualized live as data comes in." />
            <FeatureCard icon="🧾" title="Patient intake profile" desc="Demographics and medical history captured directly from the patient at signup." />
            <FeatureCard icon="🧭" title="Visit history" desc="Every patient's full visit and vitals history, organized and reviewable at a glance." />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container" style={{ padding: '90px 32px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 32, maxWidth: 560, margin: '0 auto' }}>Ready to run a visit without the waiting room?</h2>
        <p className="text-muted mt-16" style={{ maxWidth: 480, margin: '16px auto 0' }}>
          Set up in under a minute — sign up as a doctor or a patient and get straight into a Visit Room.
        </p>
        <div className="flex gap-12 justify-center mt-32" style={{ justifyContent: 'center' }}>
          <Link to="/signup" className="btn btn-primary" style={{ padding: '14px 28px', fontSize: 16 }}>Create your account</Link>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--line-soft)', padding: '32px 0', textAlign: 'center' }}>
        <p className="text-muted text-sm">CareThread — Virtual Clinical Trial Visit Management</p>
      </footer>
    </div>
  );
}

function Dot({ color }) {
  return <span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: 'inline-block' }} />;
}

function VitalPill({ label, value }) {
  return (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 10, padding: '8px 10px' }}>
      <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function StepCard({ num, color, title, desc }) {
  const colorMap = {
    purple: { bg: 'var(--purple-light)', fg: 'var(--purple-dark)' },
    teal: { bg: 'var(--teal-light)', fg: 'var(--teal)' },
    coral: { bg: 'var(--coral-light)', fg: 'var(--coral)' },
  };
  const c = colorMap[color];
  return (
    <div className="card" style={{ padding: 28 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: c.bg, color: c.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: 'Fraunces, serif' }}>
        {num}
      </div>
      <h3 style={{ fontSize: 19, marginTop: 18, marginBottom: 8 }}>{title}</h3>
      <p className="text-muted" style={{ fontSize: 14.5, lineHeight: 1.6 }}>{desc}</p>
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ fontSize: 26, marginBottom: 10 }}>{icon}</div>
      <h3 style={{ fontSize: 16.5, marginBottom: 6 }}>{title}</h3>
      <p className="text-muted" style={{ fontSize: 14, lineHeight: 1.6 }}>{desc}</p>
    </div>
  );
}

const heroWrap = {
  position: 'relative',
  overflow: 'hidden',
  paddingTop: 72,
  paddingBottom: 60,
  background: 'radial-gradient(1100px 500px at 15% -10%, #EEEDFE 0%, transparent 60%), radial-gradient(900px 500px at 100% 0%, #E1F5EE 0%, transparent 55%)',
};
const heroGrid = { display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 56, alignItems: 'center' };
const eyebrow = { textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12.5, fontWeight: 700, color: 'var(--purple)' };
const heroTitle = { fontSize: 52, lineHeight: 1.08, marginTop: 14, fontWeight: 600 };
const heroSub = { fontSize: 17, color: 'var(--ink-soft)', marginTop: 20, maxWidth: 480, lineHeight: 1.65 };
const heroCardWrap = { position: 'relative' };
const heroCardGlow = { position: 'absolute', inset: -20, background: 'linear-gradient(135deg, rgba(91,79,191,0.25), rgba(15,110,86,0.2))', filter: 'blur(50px)', borderRadius: 30, zIndex: 0 };
const heroCard = { position: 'relative', zIndex: 1, padding: 22, boxShadow: 'var(--shadow-lg)' };
const mockVideoRow = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 };
const mockVideoTile = { height: 110, borderRadius: 12, background: 'linear-gradient(135deg,#2b2740,#413a66)', color: 'white', display: 'flex', alignItems: 'flex-end', padding: 10, fontSize: 13, fontWeight: 600 };
const vitalsMockGrid = { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 };
const stepsGrid = { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 };
const featureGrid = { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 40, marginTop: 8 };
