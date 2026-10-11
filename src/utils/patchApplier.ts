import {
  ALLOWLISTED_REMIX_PATH_PATTERNS,
  FORBIDDEN_PATH_KEYWORDS,
  type JsonPatchOperation,
  type AffectedSystem,
} from '../types/remix.js';

export interface PatchValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  affectedSystems: AffectedSystem[];
  canHotUpdate: boolean;
}

export interface PatchApplyResult<T> {
  success: boolean;
  patchedObject: T;
  report: PatchValidationReport;
  error?: string;
}

/**
 * Validates a list of RFC 6902 JSON patch operations against allowlists and security rules
 */
export function validateJsonPatch(patch: JsonPatchOperation[]): PatchValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const affectedSystemsSet = new Set<AffectedSystem>();

  if (!Array.isArray(patch) || patch.length === 0) {
    errors.push('Patch must be a non-empty array of operations.');
    return {
      valid: false,
      errors,
      warnings,
      affectedSystems: [],
      canHotUpdate: false,
    };
  }

  if (patch.length > 30) {
    errors.push(`Patch contains ${patch.length} operations, exceeding safety limit of 30 operations.`);
  }

  for (let i = 0; i < patch.length; i++) {
    const op = patch[i];

    if (!op || typeof op !== 'object') {
      errors.push(`Operation #${i} is not a valid object.`);
      continue;
    }

    if (!['add', 'replace', 'remove'].includes(op.op)) {
      errors.push(`Operation #${i} has unsupported op '${op.op}'. Only 'add', 'replace', 'remove' are permitted.`);
    }

    if (typeof op.path !== 'string' || !op.path.startsWith('/')) {
      errors.push(`Operation #${i} path '${op.path}' is invalid. Must be a valid JSON pointer starting with '/'.`);
      continue;
    }

    // Prototype pollution & forbidden keywords defense
    for (const forbidden of FORBIDDEN_PATH_KEYWORDS) {
      if (op.path.includes(forbidden)) {
        errors.push(`Operation #${i} targets forbidden protected path component '${forbidden}'.`);
      }
    }

    // Allowlist check
    const isAllowlisted = ALLOWLISTED_REMIX_PATH_PATTERNS.some((pattern) => pattern.test(op.path));
    if (!isAllowlisted) {
      errors.push(`Operation #${i} path '${op.path}' is not in the allowlisted remix schema paths.`);
    }

    // Classify affected systems
    if (
      op.path.startsWith('/theme') ||
      op.path.startsWith('/world/theme') ||
      op.path.startsWith('/world/backgroundColor') ||
      op.path.startsWith('/world/ambientEffect')
    ) {
      affectedSystemsSet.add('presentation');
    } else if (
      op.path.startsWith('/world/gravity') ||
      op.path.startsWith('/world/friction') ||
      op.path.startsWith('/difficulty') ||
      op.path.startsWith('/player/speed') ||
      op.path.startsWith('/player/jumpPower')
    ) {
      affectedSystemsSet.add('physics');
    } else if (
      op.path.startsWith('/terrain/hazards') ||
      op.path.startsWith('/hazards') ||
      op.path.startsWith('/entities/collectibles') ||
      op.path.startsWith('/coins') ||
      op.path.startsWith('/entities/enemies') ||
      op.path.startsWith('/enemies') ||
      op.path.startsWith('/objectives/checkpoints')
    ) {
      affectedSystemsSet.add('entities');
    } else if (
      op.path.startsWith('/terrain/platforms') ||
      op.path.startsWith('/platforms') ||
      op.path.startsWith('/world/width') ||
      op.path.startsWith('/world/height')
    ) {
      affectedSystemsSet.add('structural');
    } else {
      affectedSystemsSet.add('presentation');
    }
  }

  const affectedSystems = Array.from(affectedSystemsSet);
  // Hot update is possible if there are NO structural changes
  const canHotUpdate = !affectedSystems.includes('structural');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    affectedSystems,
    canHotUpdate,
  };
}

/**
 * Applies a validated RFC 6902 JSON Patch cleanly and immutably to a target object
 */
export function applyJsonPatch<T extends Record<string, any>>(
  target: T,
  patch: JsonPatchOperation[]
): PatchApplyResult<T> {
  const report = validateJsonPatch(patch);
  if (!report.valid) {
    return {
      success: false,
      patchedObject: target,
      report,
      error: `Patch validation failed: ${report.errors.join('; ')}`,
    };
  }

  // Deep clone target to guarantee immutability on failure
  const cloned = JSON.parse(JSON.stringify(target));

  try {
    for (const op of patch) {
      applySingleOperation(cloned, op);
    }

    return {
      success: true,
      patchedObject: cloned,
      report,
    };
  } catch (err: any) {
    return {
      success: false,
      patchedObject: target,
      report,
      error: `Patch execution error: ${err.message}`,
    };
  }
}

/**
 * Applies a single RFC 6902 operation using JSON pointer traversal
 */
function applySingleOperation(root: any, op: JsonPatchOperation): void {
  const segments = op.path
    .split('/')
    .slice(1)
    .map((seg) => decodeURIComponent(seg.replace(/~1/g, '/').replace(/~0/g, '~')));

  if (segments.length === 0) {
    throw new Error('Cannot apply patch to root object directly');
  }

  let current = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (current[seg] === undefined || current[seg] === null) {
      // Auto-create intermediate objects or arrays if needed for 'add'
      if (op.op === 'add') {
        const nextSeg = segments[i + 1];
        current[seg] = /^\d+$/.test(nextSeg) ? [] : {};
      } else {
        throw new Error(`Path element '${seg}' does not exist in target`);
      }
    }
    current = current[seg];
  }

  const lastKey = segments[segments.length - 1];

  switch (op.op) {
    case 'add': {
      if (Array.isArray(current)) {
        if (lastKey === '-') {
          current.push(op.value);
        } else {
          const index = parseInt(lastKey, 10);
          if (isNaN(index) || index < 0 || index > current.length) {
            throw new Error(`Invalid array index '${lastKey}' for add operation`);
          }
          current.splice(index, 0, op.value);
        }
      } else {
        current[lastKey] = op.value;
      }
      break;
    }

    case 'replace': {
      if (Array.isArray(current)) {
        const index = parseInt(lastKey, 10);
        if (isNaN(index) || index < 0 || index >= current.length) {
          throw new Error(`Invalid array index '${lastKey}' for replace operation`);
        }
        current[index] = op.value;
      } else {
        if (!(lastKey in current)) {
          // Fall back gracefully to add if key is valid
          current[lastKey] = op.value;
        } else {
          current[lastKey] = op.value;
        }
      }
      break;
    }

    case 'remove': {
      if (Array.isArray(current)) {
        const index = parseInt(lastKey, 10);
        if (isNaN(index) || index < 0 || index >= current.length) {
          throw new Error(`Invalid array index '${lastKey}' for remove operation`);
        }
        current.splice(index, 1);
      } else {
        delete current[lastKey];
      }
      break;
    }
  }
}
