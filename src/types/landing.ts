// Landing page component prop types

export interface HeroSectionProps {
  headline: string;
  subheadline: string;
  primaryCtaText: string;
  primaryCtaLink: string;
  secondaryCtaText: string;
  secondaryCtaLink: string;
}

export interface ProblemCardProps {
  icon: string;
  title: string;
  description: string;
}

export interface SolutionFeatureProps {
  icon: string;
  title: string;
  description: string;
}

export interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  benefit: string;
}

export interface TechnicalCardProps {
  icon: string;
  title: string;
  description: string;
}

export interface TrustSignalProps {
  icon: string;
  title: string;
  description: string;
}

export interface CtaSectionProps {
  headline: string;
  subtext: string;
  primaryCtaText: string;
  primaryCtaLink: string;
  secondaryCtaText: string;
  secondaryCtaLink: string;
  benefits: string[];
}

export interface NavigationProps {
  logoText: string;
  links: Array<{ text: string; href: string }>;
  ctaText: string;
  ctaLink: string;
}

export interface FooterProps {
  companyName: string;
  links: Array<{ text: string; href: string }>;
  techStack: string;
  year: number;
}
