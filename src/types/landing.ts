// Landing page component prop types

// Icon types for each component
export type ProblemIconType = 'spreadsheet' | 'paper' | 'invoice';
export type SolutionIconType = 'smartphone' | 'wizard' | 'invoice-check';
export type FeatureIconType = 'quote-wizard' | 'dashboard' | 'catalog' | 'security' | 'mobile' | 'admin';
export type TechnicalIconType = 'tech-stack' | 'security' | 'global' | 'scalable';
export type TrustIconType = 'gift' | 'setup' | 'support';

export interface HeroSectionProps {
  headline: string;
  subheadline: string;
  primaryCtaText: string;
  primaryCtaLink: string;
  secondaryCtaText: string;
  secondaryCtaLink: string;
}

export interface ProblemCardProps {
  icon: ProblemIconType;
  title: string;
  description: string;
}

export interface SolutionFeatureProps {
  icon: SolutionIconType;
  title: string;
  description: string;
}

export interface FeatureCardProps {
  icon: FeatureIconType;
  title: string;
  description: string;
  benefit: string;
}

export interface TechnicalCardProps {
  icon: TechnicalIconType;
  title: string;
  description: string;
}

export interface TrustSignalProps {
  icon: TrustIconType;
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

export interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface OAuthProvider {
  id: string;
  name: string;
  icon: string;
  bgColor: string;
  hoverColor: string;
  textColor: string;
}
