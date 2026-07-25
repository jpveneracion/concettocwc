# Onboarding Modal System

User-friendly onboarding components for the Concetto platform. These components provide clear, simple instructional content about how to use platform features.

## Components

### 1. OnboardingModal
General platform onboarding covering all main features. Ideal for first-time users.

**Features:**
- Multi-step tour covering dashboard, quotes, products, and settings
- Progress indicators and skip/complete options
- Mobile-first responsive design
- Auto-completion tracking in localStorage

### 2. FeatureOnboardingModal
Reusable modal for feature-specific onboarding. Ideal for targeted guidance.

**Features:**
- Feature-specific content with step-by-step instructions
- Tips and best practices for each feature
- Action buttons that link to relevant pages
- Per-feature completion tracking

## Usage Examples

### General Onboarding

```tsx
import { OnboardingModal } from '@/components/onboarding';

function App() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  return (
    <>
      <button onClick={() => setShowOnboarding(true)}>
        Start Onboarding
      </button>
      
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </>
  );
}
```

### Feature-Specific Onboarding

```tsx
import { FeatureOnboardingModal, allOnboardingContent } from '@/components/onboarding';

function Dashboard() {
  const [showGuide, setShowGuide] = useState(false);
  
  return (
    <>
      <button onClick={() => setShowGuide(true)}>
        Show Dashboard Guide
      </button>
      
      <FeatureOnboardingModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        content={allOnboardingContent.dashboard}
        onComplete={() => setShowGuide(false)}
      />
    </>
  );
}
```

## Available Features

- **dashboard**: Dashboard navigation and metrics understanding
- **quotes**: Quote creation and management process
- **products**: Product catalog browsing and selection
- **settings**: Company settings and account management

## Content Structure

Each feature contains:

```typescript
{
  featureId: string;
  featureName: string;
  description: string;
  steps: [
    {
      title: string;
      content: string[];        // Main instructional content
      tips: string[];           // Pro tips and best practices
      icon: string;             // Emoji icon
      actionLabel?: string;     // Optional action button text
      actionLink?: string;      // Optional action button link
    }
  ];
}
```

## Mobile Optimization

- Responsive text sizing and spacing
- Touch-friendly button sizes
- Optimized for vertical scrolling
- Adaptive layouts for different screen sizes

## User Progress Tracking

- Completion status stored in localStorage
- Separate tracking for general and feature onboarding
- Progress persists across sessions
- Users can skip and return later

## Content Guidelines

- **Simple language**: Focus on "how to use" not technical details
- **Practical examples**: Relatable to daily business operations
- **Step-by-step format**: Easy to follow sequentially
- **Mobile-optimized**: Appropriate text length for mobile screens
- **Clear hierarchy**: Visual structure guides user attention

## Customization

To add new features or modify content, edit:
- `/src/components/onboarding/onboarding-content.tsx`

To customize styling:
- Edit the component files directly
- Modify Tailwind classes for different appearances
- Colors and spacing can be adjusted per feature

## Accessibility

- ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader friendly
- High contrast ratios for readability