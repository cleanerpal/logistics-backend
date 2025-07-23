#!/bin/bash

echo "🎯 Final Setup and Validation Script"
echo "==================================="

echo ""
echo "🔍 Checking project structure..."

# Check if all required files exist
required_files=(
  "src/app/interfaces/job-billing.interface.ts"
  "src/app/services/job-billing.service.ts"
  "src/app/services/email.service.ts"
  "src/app/components/job-billing/job-billing.component.ts"
  "src/app/components/job-billing/job-billing.component.html"
  "src/app/components/job-billing/job-billing.component.scss"
  "src/app/pages/billing/billing-dashboard.component.ts"
  "src/app/pages/billing/billing-dashboard.component.html"
  "src/app/pages/billing/billing-dashboard.component.scss"
  "src/app/pages/settings/billing-settings/billing-settings.component.ts"
  "src/app/pages/settings/billing-settings/billing-settings.component.html"
  "src/app/pages/settings/billing-settings/billing-settings.component.scss"
  "src/app/modules/billing.module.ts"
)

missing_files=()
for file in "${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    missing_files+=("$file")
  fi
done

if [ ${#missing_files[@]} -eq 0 ]; then
  echo "✅ All required files are present!"
else
  echo "❌ Missing files:"
  for file in "${missing_files[@]}"; do
    echo "   - $file"
  done
  echo ""
  echo "Please run the previous setup scripts to create missing files."
  exit 1
fi

echo ""
echo "🔧 Installing additional dependencies..."

# Install any missing Angular dependencies
npm install --save @angular/common@^19.0.0 @angular/forms@^19.0.0

echo ""
echo "📦 Building project to check for errors..."

# Try to build the project
if ng build --configuration development --progress=false --stats=false; then
  echo "✅ Project builds successfully!"
else
  echo "❌ Build failed. Please check the errors above and fix them."
  echo ""
  echo "Common issues:"
  echo "1. Missing imports in app.module.ts"
  echo "2. Incorrect component declarations"
  echo "3. Missing Material Design modules"
  exit 1
fi

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "Your job billing system is now ready to use!"
echo ""
echo "📋 Next steps:"
echo "1. Read BILLING_INTEGRATION_GUIDE.md for detailed integration instructions"
echo "2. Add the billing tab to your job detail component"
echo "3. Update your navigation menu"
echo "4. Configure Firebase security rules"
echo "5. Test the system thoroughly"
echo ""
echo "🚀 To start the development server:"
echo "   ng serve"
echo ""
echo "🌐 Then navigate to:"
echo "   http://localhost:4200/billing"
echo ""
echo "Happy billing! 💰"
