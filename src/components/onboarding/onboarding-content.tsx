import { FeatureOnboardingContent } from '@/types/onboarding';

export const dashboardOnboarding: FeatureOnboardingContent = {
  featureId: 'dashboard',
  featureName: 'Dashboard',
  description: 'Learn how to navigate your dashboard and track your business performance',
  primaryColor: 'blue',
  steps: [
    {
      id: 'welcome-dashboard',
      title: 'Welcome to Your Dashboard!',
      content: [
        'Think of your dashboard as your business command center. Everything you need to run your blinds business is right here.',
        'You\'ll see your most important numbers at a glance - sales, quotes, and profits - all updated in real-time.'
      ],
      tips: [
        '💡 Check your dashboard daily to stay on top of your business',
        '📊 The numbers refresh automatically - no manual updates needed'
      ],
      icon: '🏠'
    },
    {
      id: 'navigate-dashboard',
      title: 'Finding Your Way Around',
      content: [
        'Your dashboard shows your key business metrics at the top - like total sales, number of quotes, and profit margins.',
        'Below that, you\'ll see charts showing your sales trends over time and your most popular products.',
        'At the bottom, find your top customers and their purchase history.'
      ],
      tips: [
        '👆 Tap any chart or metric to see more details',
        '📅 Use the date filters to view specific time periods'
      ],
      icon: '🗺️'
    },
    {
      id: 'understand-metrics',
      title: 'Understanding Your Numbers',
      content: [
        'Monthly Sales: Money you\'ve made this month from all your quotes',
        'Conversion Rate: Percentage of quotes that become actual orders',
        'Average Order Value: Typical amount customers spend per order',
        'Popular Collections: Which blind styles customers buy most often'
      ],
      tips: [
        '📈 Watch your conversion rate - higher means more sales success',
        '🏆 Use popular collections data to stock best-selling products'
      ],
      icon: '📊'
    },
    {
      id: 'take-action',
      title: 'Turn Insights into Action',
      content: [
        'When you see sales trends, you can plan better inventory',
        'Customer insights help you provide better service and follow up',
        'Use conversion rates to improve your quote process and close more deals'
      ],
      tips: [
        '🎯 Focus on products with high popularity to boost sales',
        '🤝 Reach out to top customers with special offers or new products'
      ],
      icon: '🚀',
      actionLabel: 'Go to Dashboard',
      actionLink: '/dashboard'
    }
  ]
};

export const quotesOnboarding: FeatureOnboardingContent = {
  featureId: 'quotes',
  featureName: 'Quotes & Orders',
  description: 'Master the process of creating and managing customer quotes',
  primaryColor: 'green',
  steps: [
    {
      id: 'quotes-intro',
      title: 'Creating Quotes Made Easy',
      content: [
        'Your quote wizard walks you through creating professional quotes step-by-step.',
        'Each quote includes customer info, window measurements, product selection, and automatic pricing calculations.'
      ],
      tips: [
        '✨ Quotes save automatically as you work - never lose your progress',
        '📋 You can edit quotes anytime before sending them to customers'
      ],
      icon: '📝'
    },
    {
      id: 'quotes-step1',
      title: 'Step 1: Customer Information',
      content: [
        'Start by entering your customer\'s name and address.',
        'Add the date when you\'re creating the quote (usually today\'s date).',
        'Optionally add a reference number for your own tracking.'
      ],
      tips: [
        '👤 Use the customer\'s preferred name for personalization',
        '📍 Complete addresses help with delivery planning'
      ],
      icon: '👤'
    },
    {
      id: 'quotes-step2',
      title: 'Step 2: Window Measurements',
      content: [
        'Add each window or area where you\'ll install blinds.',
        'Enter the width and height measurements - the system handles all the math.',
        'Choose between inches or centimeters, based on your preference.'
      ],
      tips: [
        '📏 Measure twice for accuracy - small errors affect pricing',
        '🪟 Add notes about each window for reference during installation'
      ],
      icon: '📏'
    },
    {
      id: 'quotes-step3',
      title: 'Step 3: Select Products',
      content: [
        'Choose the blind style and collection for each window.',
        'The system shows you product options with descriptions and images.',
        'Pricing calculates automatically based on your selections.'
      ],
      tips: [
        '🏷️ Product codes help you quickly find the right items',
        '💰 Compare different options to give customers choices'
      ],
      icon: '🏷️'
    },
    {
      id: 'quotes-review',
      title: 'Step 4: Review & Finalize',
      content: [
        'Review all the details before sending the quote to your customer.',
        'You\'ll see a complete summary including items, measurements, and total pricing.',
        'Add any delivery fees or installation charges, then save or send the quote.'
      ],
      tips: [
        '✅ Double-check measurements and customer details',
        '📧 Send quotes directly from the system or download as PDF'
      ],
      icon: '✅'
    },
    {
      id: 'quotes-manage',
      title: 'Managing Your Quotes',
      content: [
        'View all your quotes in one place and track their status.',
        'Update quotes from draft to sent, delivered, or cancelled.',
        'Follow up on pending quotes to convert them into orders.'
      ],
      tips: [
        '🔔 Check quote status regularly to follow up with customers',
        '📊 Track your conversion rate to improve sales process'
      ],
      icon: '📋',
      actionLabel: 'Create Your First Quote',
      actionLink: '/quotes/new'
    }
  ]
};

export const productsOnboarding: FeatureOnboardingContent = {
  featureId: 'products',
  featureName: 'Products',
  description: 'Browse and understand your product catalog',
  primaryColor: 'purple',
  steps: [
    {
      id: 'products-intro',
      title: 'Your Product Catalog',
      content: [
        'Browse all available blind products in your catalog.',
        'Each product includes details like materials, sizes, colors, and pricing information.',
        'Products are organized by collections for easy navigation.'
      ],
      tips: [
        '🔍 Use the search bar to find specific products quickly',
        '📱 Access your catalog from any device, even on customer visits'
      ],
      icon: '📦'
    },
    {
      id: 'products-browse',
      title: 'Finding the Right Products',
      content: [
        'Browse products by collection to see similar items together.',
        'Use filters to narrow down by material type, size, or price range.',
        'Product cards show key details at a glance - code, description, and pricing.'
      ],
      tips: [
        '💡 Click on any product to see full specifications and details',
        '🏷️ Product codes help you reference items accurately in quotes'
      ],
      icon: '🔍'
    },
    {
      id: 'products-understand',
      title: 'Understanding Product Details',
      content: [
        'Product Code: Unique identifier for ordering and reference',
        'Collection: Group of similar products (e.g., roller blinds, vertical blinds)',
        'Unit: Pricing per square foot or square meter',
        'Description: Material type, features, and specifications'
      ],
      tips: [
        '📏 Make sure you understand the unit (sqft vs sqm) for accurate pricing',
        '🎨 Check product descriptions to match customer preferences'
      ],
      icon: '📖'
    },
    {
      id: 'products-company',
      title: 'Company-Specific Products',
      content: [
        'Create your own company products with custom pricing and specifications.',
        'These products are specific to your business and not shared globally.',
        'Use them for proprietary offerings or special customer arrangements.'
      ],
      tips: [
        '🏢 Company products appear only in your catalog',
        '⚙️ Customize all details including pricing and descriptions'
      ],
      icon: '🏢'
    },
    {
      id: 'products-in-quotes',
      title: 'Using Products in Quotes',
      content: [
        'When creating quotes, select products from your catalog.',
        'The system automatically pulls pricing and specifications for accurate quotes.',
        'Both global and company products are available for quote creation.'
      ],
      tips: [
        '🔗 Link product selection directly to customer preferences',
        '💰 Product pricing updates automatically in quotes'
      ],
      icon: '💼',
      actionLabel: 'Browse Products',
      actionLink: '/products'
    }
  ]
};

export const settingsOnboarding: FeatureOnboardingContent = {
  featureId: 'settings',
  featureName: 'Settings',
  description: 'Manage your company settings and account preferences',
  primaryColor: 'gray',
  steps: [
    {
      id: 'settings-intro',
      title: 'Your Business Settings',
      content: [
        'Settings control your business information and how the system works for you.',
        'Keep your company details updated for professional quotes and communications.',
        'Configure preferences to match your business workflow.'
      ],
      tips: [
        '⚙️ Review settings periodically to keep information current',
        '🔄 Updates take effect immediately - no restart needed'
      ],
      icon: '⚙️'
    },
    {
      id: 'settings-company',
      title: 'Company Information',
      content: [
        'Company Name: Your business name that appears on quotes and documents',
        'Address: Your business address for customer correspondence',
        'Contact Details: Phone and email for customer communication',
        'Prepared By: Name of person creating quotes (typically yours)'
      ],
      tips: [
        '📧 Use a professional email address that customers can contact',
        '📱 Make sure phone numbers are current and accurate'
      ],
      icon: '🏢'
    },
    {
      id: 'settings-terms',
      title: 'Terms & Notes',
      content: [
        'Terms: Standard terms and conditions that appear on all your quotes',
        'Delivery Notes: Instructions for delivery or installation',
        'Closing Notes: Thank-you messages or follow-up information',
        'These sections help you provide professional, consistent communications.'
      ],
      tips: [
        '📝 Keep terms clear and customer-friendly',
        '✨ Personalize notes to reflect your business style'
      ],
      icon: '📄'
    },
    {
      id: 'settings-account',
      title: 'Account Management',
      content: [
        'Update your password and security settings to protect your account.',
        'Manage your subscription and billing information.',
        'Control notification preferences and email updates.'
      ],
      tips: [
        '🔒 Use strong passwords and update them regularly',
        '📧 Keep contact email updated for important notifications'
      ],
      icon: '🔒'
    },
    {
      id: 'settings-complete',
      title: 'You\'re All Set!',
      content: [
        'Your settings are configured and ready to use.',
        'Changes take effect immediately across all your quotes and documents.',
        'Come back anytime to update information as your business grows.'
      ],
      tips: [
        '🎯 Well-configured settings save time and improve professionalism',
        '🚀 Your business info now appears consistently in all communications'
      ],
      icon: '✅',
      actionLabel: 'Go to Settings',
      actionLink: '/settings'
    }
  ]
};

export const allOnboardingContent: Record<string, FeatureOnboardingContent> = {
  dashboard: dashboardOnboarding,
  quotes: quotesOnboarding,
  products: productsOnboarding,
  settings: settingsOnboarding
};