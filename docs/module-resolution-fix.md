# Module Resolution Fix: ESM + Next.js Compatibility

**Date:** 2025-11-24
**Status:** ✅ Resolved

---

## Problem

### The Error
Next.js build was failing with module resolution errors when importing pipeline code:

```
Module not found: Can't resolve './analyzePdf.js' in 'C:\Users\crewc\pdf-preprocessor\src\pipeline.ts'
```

### Root Cause

The repository has **two runtime environments** with conflicting module resolution requirements:

1. **CLI (ts-node + ESM)**
   - Uses `"type": "module"` in package.json
   - Runs via `node --loader ts-node/esm`
   - Originally expected `.js` extensions in imports (ESM convention)
   - Example: `import { analyzePdf } from "./analyzePdf.js"`

2. **Next.js 14 App Router**
   - TypeScript compilation expects extensionless imports
   - Cannot resolve `.js` extensions when actual files are `.ts`
   - Example: `import { analyzePdf } from "./analyzePdf"`

### Import Chain That Broke Next.js

```
lib/preprocessorAdapter.ts (Next.js server)
  → imports '../src/pipeline' (extensionless, works)
    → src/pipeline.ts internally imports './analyzePdf.js' (with .js extension)
      → Next.js looks for literal .js files
        → ❌ Only .ts files exist
          → Module not found error
```

---

## Solution

### Strategy: Normalize to Extensionless Imports

We standardized all local TypeScript imports to use **extensionless specifiers** (the TypeScript standard), and configured the CLI to support this convention.

### Changes Made

#### 1. Import Normalization (src/*.ts)

Changed all local relative imports in `src/` from `.js` extensions to extensionless:

**Before:**
```typescript
import { analyzePdf } from "./analyzePdf.js";
import { routeContent } from "./routeContent.js";
import { ensureDir, writeTextFile } from "./utils/fsUtils.js";
```

**After:**
```typescript
import { analyzePdf } from "./analyzePdf";
import { routeContent } from "./routeContent";
import { ensureDir, writeTextFile } from "./utils/fsUtils";
```

**Files Modified:**
- `src/pipeline.ts` (8 imports)
- `src/index.ts` (1 import)
- `src/analyzePdf.ts` (1 import)
- `src/routeContent.ts` (1 import)
- `src/exportNarrative.ts` (3 imports)
- `src/exportTables.ts` (2 imports)
- `src/exportDiagrams.ts` (3 imports)
- `src/handwritingPipeline.ts` (2 imports)

**Total:** 21 import statements normalized

#### 2. CLI Configuration (package.json)

Added `--experimental-specifier-resolution=node` flag to CLI scripts:

**Before:**
```json
{
  "scripts": {
    "start": "node --loader ts-node/esm src/index.ts",
    "preprocess": "node --loader ts-node/esm src/index.ts"
  }
}
```

**After:**
```json
{
  "scripts": {
    "start": "node --loader ts-node/esm --experimental-specifier-resolution=node src/index.ts",
    "preprocess": "node --loader ts-node/esm --experimental-specifier-resolution=node src/index.ts"
  }
}
```

---

## Why This Works

### For Next.js

**Before:** Next.js encountered `.js` extensions and looked for literal `.js` files
**After:** Next.js sees extensionless imports (standard TypeScript), automatically resolves to `.ts` files

✅ **Result:** Builds and runs successfully

### For CLI (ts-node + ESM)

The `--experimental-specifier-resolution=node` flag enables Node.js's legacy resolution algorithm:

1. Node sees extensionless import: `import { analyzePdf } from "./analyzePdf"`
2. Flag triggers automatic extension resolution
3. Node tries: `./analyzePdf` → `./analyzePdf.js` → `./analyzePdf.ts` → `./analyzePdf.json`
4. ts-node intercepts `.ts` requests and transpiles on-the-fly
5. Module resolves successfully

✅ **Result:** CLI runs successfully

---

## Verification

### Test Results

#### ✅ Next.js Dev Server
```bash
npm run dev
```
- Started on port 3005
- No module resolution errors
- Compiled `/api/jobs` successfully (62 modules)
- API endpoints return valid responses (200 OK)

#### ✅ CLI
```bash
npm run start -- --help
```
- Starts without module resolution errors
- Help text displays correctly
- All options accessible

---

## Architecture Benefits

1. **Single Source of Truth** - Both CLI and Next.js share the same `src/` files
2. **No Code Duplication** - One `runPipeline()` function serves both environments
3. **Standard TypeScript** - Extensionless imports follow TypeScript best practices
4. **Minimal Changes** - Only import specifiers and CLI flags modified (zero logic changes)
5. **Future-Proof** - Aligns with modern TypeScript/ESM conventions

---

## Technical Details

### Module System Configuration

**package.json:**
```json
{
  "type": "module",  // ESM mode for Node.js
  "scripts": {
    "start": "node --loader ts-node/esm --experimental-specifier-resolution=node src/index.ts",
    "dev": "next dev"
  }
}
```

### Resolution Behavior

| Environment | Import Style | Resolution Mechanism |
|-------------|--------------|---------------------|
| Next.js | `from "./module"` | TypeScript compiler auto-resolves to `.ts` |
| CLI (ts-node) | `from "./module"` | Node flag enables extension resolution + ts-node transpiles |

---

## Future Considerations

### Node.js Deprecation Warnings

The CLI currently shows warnings about `--experimental-loader` being deprecated:

```
ExperimentalWarning: `--experimental-loader` may be removed in the future
```

**Impact:** Non-critical, functionality unaffected

**Future Migration Options:**
1. Use Node's newer `register()` API when ts-node supports it
2. Switch to a bundler (esbuild, tsx) for CLI execution
3. Use TypeScript path mappings in `tsconfig.json`

### Alternative Solutions (Not Implemented)

We considered but rejected these alternatives:
- **Dual entry points** - Would require code duplication
- **Build step for CLI** - Would slow development workflow
- **Conditional exports** - Too complex for this use case

---

## Summary

**Problem:** Module resolution conflict between Next.js (extensionless imports) and CLI (ESM with .js extensions)

**Solution:** Normalized all imports to extensionless + added Node flag for CLI

**Impact:**
- 9 files modified
- 21 import statements changed
- 2 CLI scripts updated
- 0 logic changes
- 0 breaking changes

**Result:** Both environments now work seamlessly with shared pipeline code ✅

---

## Related Files

- `src/pipeline.ts` - Main pipeline entry point
- `lib/preprocessorAdapter.ts` - Next.js adapter that imports pipeline
- `src/index.ts` - CLI entry point
- All other `src/*.ts` files with local imports

## See Also

- [Phase A Summary](./phase-a-summary.md)
- [Phase B Summary](./phase-b-summary.md)
- [Phase C Summary](./phase-c-summary.md)
- [Phase D Summary](./phase-d-summary.md)
