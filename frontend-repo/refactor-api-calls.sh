#!/bin/bash

# Automated refactoring script for API calls
# This script helps identify and suggest fixes for inconsistent API usage

echo "=== Frontend API Call Refactoring Tool ==="
echo ""

# Find all files using direct fetch()
echo "Files using direct fetch():"
grep -r "await fetch(" src/components/*.tsx src/pages/*.tsx 2>/dev/null | cut -d: -f1 | sort -u
echo ""

# Find all files using authenticatedFetch
echo "Files using authenticatedFetch:"
grep -r "authenticatedFetch" src/components/*.tsx src/pages/*.tsx 2>/dev/null | cut -d: -f1 | sort -u
echo ""

# Find all files using authApi.authenticatedFetch
echo "Files using authApi.authenticatedFetch:"
grep -r "authApi.authenticatedFetch" src/components/*.tsx src/pages/*.tsx 2>/dev/null | cut -d: -f1 | sort -u
echo ""

# Count total files needing refactoring
TOTAL=$(grep -r -l "await fetch(\|authenticatedFetch\|authApi.authenticatedFetch" src/components/*.tsx src/pages/*.tsx 2>/dev/null | sort -u | wc -l)
echo "Total files needing refactoring: $TOTAL"
echo ""

echo "See REFACTORING_GUIDE.md for detailed instructions"
