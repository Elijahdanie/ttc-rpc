# Publishing Guide for ttc-rpc

## Pre-Publishing Checklist

1. **Update Version**: Update the version in `package.json` according to semantic versioning
   ```bash
   npm version patch  # for bug fixes
   npm version minor  # for new features
   npm version major  # for breaking changes
   ```

2. **Validate Package**: 
   ```bash
   npm run validate
   ```

3. **Test Build**:
   ```bash
   npm run clean && npm run build
   ```

4. **Check Package Contents**:
   ```bash
   npm pack --dry-run
   ```

## Publishing

### To npm registry:
```bash
npm publish
```

### To a private registry:
```bash
npm publish --registry https://your-private-registry.com
```

## Post-Publishing

1. Tag the release in git:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. Create a GitHub/GitLab release with changelog

## Package Structure

The published package includes:
- `dist/` - Compiled JavaScript and TypeScript declarations
- `README.md` - Documentation
- `package.json` - Package metadata

The package excludes:
- `src/` - Source TypeScript files
- `node_modules/` - Dependencies
- Development configuration files
- Logs and temporary files
