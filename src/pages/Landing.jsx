import { useEffect } from 'react';
import Navbar from '../design/components/Navbar';
import HeroCarousel from '../design/components/HeroCarousel';
import HowItWorks from '../design/components/HowItWorks';
import ServicesSection from '../design/components/ServicesSection';
import CTASection from '../design/components/CTASection';
import Footer from '../design/components/Footer';
import WhatsAppButton from '../components/WhatsAppButton';

export default function Landing() {
  // Activate all reveal animations immediately on page load
  useEffect(() => {
    const activate = () => {
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('in-view'));
    };
    // Run now and also after a short delay for elements that render late
    activate();
    const t = setTimeout(activate, 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-softwhite text-darknavy landing-page">
      <Navbar />
      <main id="home">
        <HeroCarousel />
        <div style={{ height: '2.5rem' }} />
        <HowItWorks />
        <ServicesSection />
        <CTASection />
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
