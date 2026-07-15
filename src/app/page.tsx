import {
  Navigation,
  HeroSection,
  ProblemSection,
  SolutionSection,
  FeaturesSection,
  TechnicalSection,
  TrustSection,
  CtaSection,
  LandingFooter
} from '@/components/landing';

// Landing page content configuration
const heroContent = {
  headline: 'Streamline Your Business Quotations and Management',
  subheadline: 'Transform manual workflows into an efficient digital platform. Modernize from paper-based processes to automated business management.',
  primaryCtaText: 'Get Started Today',
  primaryCtaLink: '/signup',
  secondaryCtaText: 'See How It Works',
  secondaryCtaLink: '#solution'
};

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navigation />
      <HeroSection {...heroContent} />
      <ProblemSection />
      <SolutionSection />
      <FeaturesSection />
      <TrustSection />
      <CtaSection />
      <LandingFooter />
    </main>
  );
}
