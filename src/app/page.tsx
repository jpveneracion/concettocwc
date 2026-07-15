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
      <Navigation
        logoText="Concetto"
        links={[
          { text: 'Features', href: '#features' },
          { text: 'How It Works', href: '#solution' }
        ]}
        ctaText="Start Trial"
        ctaLink="/signup"
      />
      <HeroSection {...heroContent} />
      <ProblemSection />
      <SolutionSection />
      <FeaturesSection />
      <TechnicalSection />
      <TrustSection />
      <CtaSection
        headline="Ready to Transform Your Blinds Business?"
        subtext="Join manufacturers and retailers who've modernized their quotation workflow"
        primaryCtaText="Start Your Free Trial"
        primaryCtaLink="/signup"
        secondaryCtaText="Learn More About Features"
        secondaryCtaLink="#features"
        benefits={[
          'No credit card required for trial',
          'OAuth authentication for secure setup',
          'Mobile-first design for on-the-go access',
          'Instant company setup and dashboard access'
        ]}
      />
      <LandingFooter
        companyName="Concetto Window Coverings"
        links={[
          { text: 'Terms of Service', href: '/terms' },
          { text: 'Privacy Policy', href: '/privacy' },
          { text: 'Contact', href: '/contact' }
        ]}
        techStack="Built with Next.js, React, TypeScript"
        year={new Date().getFullYear()}
      />
    </main>
  );
}
