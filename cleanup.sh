#!/bin/bash
# DocuTrustChain Bloat Cleanup Script
# Run from project root: bash cleanup.sh

UI="frontend/src/components/ui"

echo "🧹 Cleaning unused UI components..."

# Delete 35 unused Shadcn/Radix components
rm -f "$UI/accordion.tsx"
rm -f "$UI/alert.tsx"
rm -f "$UI/aspect-ratio.tsx"
rm -f "$UI/avatar.tsx"
rm -f "$UI/breadcrumb.tsx"
rm -f "$UI/calendar.tsx"
rm -f "$UI/carousel.tsx"
rm -f "$UI/chart.tsx"
rm -f "$UI/checkbox.tsx"
rm -f "$UI/collapsible.tsx"
rm -f "$UI/command.tsx"
rm -f "$UI/context-menu.tsx"
rm -f "$UI/dialog.tsx"
rm -f "$UI/drawer.tsx"
rm -f "$UI/dropdown-menu.tsx"
rm -f "$UI/form.tsx"
rm -f "$UI/hover-card.tsx"
rm -f "$UI/input-otp.tsx"
rm -f "$UI/menubar.tsx"
rm -f "$UI/navigation-menu.tsx"
rm -f "$UI/pagination.tsx"
rm -f "$UI/popover.tsx"
rm -f "$UI/radio-group.tsx"
rm -f "$UI/resizable.tsx"
rm -f "$UI/scroll-area.tsx"
rm -f "$UI/separator.tsx"
rm -f "$UI/sheet.tsx"
rm -f "$UI/sidebar.tsx"
rm -f "$UI/skeleton.tsx"
rm -f "$UI/slider.tsx"
rm -f "$UI/switch.tsx"
rm -f "$UI/tabs.tsx"
rm -f "$UI/textarea.tsx"
rm -f "$UI/toggle.tsx"
rm -f "$UI/toggle-group.tsx"

echo "✅ Deleted 35 unused UI components"

# Delete Replit-specific files
rm -f .replit
rm -f components.json
rm -f restructure.sh
rm -f docs/replit.md

echo "✅ Removed Replit artifacts"

# Delete dead backend code
rm -f backend/middleware/logger.ts

echo "✅ Removed dead logger middleware (pino removed)"

# Delete leftover frontend/shared if exists
rm -rf frontend/shared

echo "✅ Removed leftover shared directory"

# Reinstall with cleaned dependencies
echo ""
echo "📦 Reinstalling clean dependencies..."
rm -rf node_modules package-lock.json
npm install

# Show what remains in UI folder
echo ""
echo "📁 Remaining UI components (12 used):"
ls -1 "$UI/"

echo ""
echo "🎉 Cleanup complete!"
