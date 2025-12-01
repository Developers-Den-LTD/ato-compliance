#!/bin/bash
# Script to fix all import paths from ../../shared/schema to ../schema

echo "🔧 Fixing import paths in backend-repo..."

# Fix imports in src/services/
find backend-repo/src/services -name "*.ts" -type f -exec sed -i "s|from '../../shared/schema'|from '../schema'|g" {} +
find backend-repo/src/services -name "*.ts" -type f -exec sed -i 's|from "../../shared/schema"|from "../schema"|g' {} +

# Fix imports in src/routes/
find backend-repo/src/routes -name "*.ts" -type f -exec sed -i "s|from '../../shared/schema'|from '../schema'|g" {} +
find backend-repo/src/routes -name "*.ts" -type f -exec sed -i 's|from "../../shared/schema"|from "../schema"|g' {} +

# Fix imports in src/parsers/
find backend-repo/src/parsers -name "*.ts" -type f -exec sed -i "s|from '../../shared/schema'|from '../schema'|g" {} +
find backend-repo/src/parsers -name "*.ts" -type f -exec sed -i 's|from "../../shared/schema"|from "../schema"|g' {} +

# Fix imports in src/data/
find backend-repo/src/data -name "*.ts" -type f -exec sed -i "s|from '../../shared/schema'|from '../schema'|g" {} +
find backend-repo/src/data -name "*.ts" -type f -exec sed -i 's|from "../../shared/schema"|from "../schema"|g' {} +

# Fix imports in src/utils/
find backend-repo/src/utils -name "*.ts" -type f -exec sed -i "s|from '../../shared/schema'|from '../schema'|g" {} +
find backend-repo/src/utils -name "*.ts" -type f -exec sed -i 's|from "../../shared/schema"|from "../schema"|g' {} +

# Fix imports in scripts/
find backend-repo/scripts -name "*.ts" -type f -exec sed -i "s|from '../../shared/schema'|from '../schema'|g" {} +
find backend-repo/scripts -name "*.ts" -type f -exec sed -i 's|from "../../shared/schema"|from "../schema"|g' {} +

echo "✅ Import paths fixed!"
echo ""
echo "Files modified:"
find backend-repo/src -name "*.ts" -type f -exec grep -l "from '../schema'" {} + | wc -l
echo ""
echo "Please verify the changes and restart the backend server."
