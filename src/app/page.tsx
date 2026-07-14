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
  headline: 'Still Using Excel for Window Blinds Quotations?',
  subheadline: 'Transform your manual workflows into a streamlined digital platform. Modernize your business from paper measurements to automated invoicing.',
  primaryCtaText: 'Start Your Free Trial',
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
      <TechnicalSection />
      <TrustSection />
      <CtaSection />
      <LandingFooter />
    </main>
  );
}
