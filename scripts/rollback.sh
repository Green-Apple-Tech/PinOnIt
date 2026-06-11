#!/bin/bash
echo "Recent backup tags:"
git tag | grep backup | sort | tail -20
echo ""
echo "To rollback to a tag, run:"
echo "  git reset --hard <tag-name> && git push --force"
